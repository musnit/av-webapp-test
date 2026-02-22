import crypto from 'crypto';
import { put, head } from '@vercel/blob';
import { getBraBlob } from './_bra-utils.js';

function hash(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function readBlobText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Blob read failed: ${r.status}`);
  return r.text();
}

function decodeCdata(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function encodeCdata(s = '') {
  return `<![CDATA[${s}]]>`;
}

function pickTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}

function replaceTag(xml, tag, newInner) {
  return xml.replace(new RegExp(`(<${tag}[^>]*>)[\\s\\S]*?(<\\/${tag}>)`, 'i'), `$1${newInner}$2`);
}

function replaceAllTag(xml, tag, mapper) {
  return xml.replace(new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'gi'), (_, a, b, c) => `${a}${mapper(b)}${c}`);
}

function replaceAttr(xml, tag, attr, value) {
  const re = new RegExp(`(<${tag}[^>]*\\b${attr}=")([^"]*)(")`, 'i');
  return xml.replace(re, `$1${value}$3`);
}

function translateDateWordsFrToEn(text = '') {
  const map = [
    ['lundi', 'Monday'], ['mardi', 'Tuesday'], ['mercredi', 'Wednesday'], ['jeudi', 'Thursday'], ['vendredi', 'Friday'], ['samedi', 'Saturday'], ['dimanche', 'Sunday'],
    ['janvier', 'January'], ['février', 'February'], ['mars', 'March'], ['avril', 'April'], ['mai', 'May'], ['juin', 'June'], ['juillet', 'July'], ['août', 'August'], ['septembre', 'September'], ['octobre', 'October'], ['novembre', 'November'], ['décembre', 'December']
  ];
  let s = text;
  for (const [fr, en] of map) s = s.replace(new RegExp(fr, 'gi'), en);
  return s;
}

async function translateTextsBatch(texts) {
  if (!texts.length) return [];
  const prompt = `Translate the following French avalanche bulletin text snippets into accurate technical English.
Rules:
- Translate only the provided human-language text snippets.
- Keep numbers, units, URLs, and bullet structure intact.
- Return strict JSON: {"translations":[...]} in same order/length.

Snippets:\n${JSON.stringify(texts)}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise avalanche bulletin translator. Output JSON only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LLM translation failed: ${r.status} ${t.slice(0, 180)}`);
  }

  const j = await r.json();
  const raw = j?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const arr = parsed?.translations || [];
  if (!Array.isArray(arr) || arr.length !== texts.length) {
    throw new Error('LLM returned invalid translation batch length');
  }
  return arr;
}

export default async function handler(req, res) {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).send('Missing OPENAI_API_KEY');
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).send('Missing BLOB_READ_WRITE_TOKEN');

    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const frXml = await (await getBraBlob(massif, 'xml')).text();

    // Extract human-language sections only (no XML structure sent to LLM)
    const sections = [];
    const sectionRefs = [];

    const riskComment = (frXml.match(/<RISQUE[^>]*\bCOMMENTAIRE="([^"]*)"/i)?.[1]) || '';
    if (riskComment) { sectionRefs.push({ type: 'attr', tag: 'RISQUE', attr: 'COMMENTAIRE' }); sections.push(riskComment); }

    const tagSingles = ['ACCIDENTEL', 'NATUREL', 'RESUME', 'RisqueJ2', 'CommentaireRisqueJ2', 'TITRE', 'TEXTESANSTITRE', 'TEXTE'];
    for (const t of tagSingles) {
      const v = pickTag(frXml, t);
      if (v) { sectionRefs.push({ type: 'tag', tag: t, cdata: true }); sections.push(decodeCdata(v)); }
    }

    const qual = frXml.match(/<QUALITE>[\s\S]*?<TEXTE>([\s\S]*?)<\/TEXTE>[\s\S]*?<\/QUALITE>/i)?.[1];
    if (qual) { sectionRefs.push({ type: 'qualiteTexte' }); sections.push(decodeCdata(qual)); }

    const meteoComment = frXml.match(/<METEO[^>]*>[\s\S]*?<COMMENTAIRE>([\s\S]*?)<\/COMMENTAIRE>/i)?.[1];
    if (meteoComment) { sectionRefs.push({ type: 'meteoComment' }); sections.push(decodeCdata(meteoComment)); }

    const translationVersion = 'xml-section-v1';
    const contentHash = hash(translationVersion + '|' + JSON.stringify(sections));
    const blobPath = `translations/bra-xml-en-sections/${massif}/${contentHash}.xml`;

    try {
      const meta = await head(blobPath);
      const cached = await readBlobText(meta.url);
      res.setHeader('X-Translation-Cache', 'hit');
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      return res.status(200).send(cached);
    } catch {
      // miss
    }

    const translated = await translateTextsBatch(sections);

    let enXml = frXml;
    let i = 0;
    for (const ref of sectionRefs) {
      const tr = translated[i++] || '';
      if (ref.type === 'attr') {
        enXml = replaceAttr(enXml, ref.tag, ref.attr, tr);
      } else if (ref.type === 'tag') {
        enXml = replaceTag(enXml, ref.tag, encodeCdata(tr));
      } else if (ref.type === 'qualiteTexte') {
        enXml = enXml.replace(/(<QUALITE>[\s\S]*?<TEXTE>)([\s\S]*?)(<\/TEXTE>[\s\S]*?<\/QUALITE>)/i, `$1${encodeCdata(tr)}$3`);
      } else if (ref.type === 'meteoComment') {
        enXml = enXml.replace(/(<METEO[^>]*>[\s\S]*?<COMMENTAIRE>)([\s\S]*?)(<\/COMMENTAIRE>)/i, `$1${tr}$3`);
      }
    }

    // translate explicit date words everywhere (days/months)
    enXml = translateDateWordsFrToEn(enXml);

    await put(blobPath, enXml, {
      access: 'public',
      contentType: 'text/xml; charset=utf-8',
      addRandomSuffix: false
    });

    res.setHeader('X-Translation-Cache', 'miss');
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    return res.status(200).send(enXml);
  } catch (e) {
    return res.status(500).send(`Error: ${e.message}`);
  }
}
