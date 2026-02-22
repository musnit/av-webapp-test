import crypto from 'crypto';
import { put, head } from '@vercel/blob';
import { getBraBlob } from './_bra-utils.js';

function pickTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function pickAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function structuredFromXml(xml) {
  return {
    massif: pickAttr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'MASSIF') || 'Mont-Blanc',
    dateBulletin: pickAttr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'DATEBULLETIN') || '',
    validUntil: pickAttr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'DATEVALIDITE') || '',
    risk: pickAttr(xml, 'RISQUE', 'RISQUEMAXI') || '',
    riskComment: pickAttr(xml, 'RISQUE', 'COMMENTAIRE') || '',
    title: pickTag(xml, 'TITRE') || '',
    stability: pickTag(xml, 'TEXTESANSTITRE') || pickTag(xml, 'TEXTE') || '',
    quality: xml.match(/<QUALITE>[\s\S]*?<TEXTE><!\[CDATA\[([\s\S]*?)\]\]><\/TEXTE>[\s\S]*?<\/QUALITE>/i)?.[1]?.trim() || '',
    meteo: xml.match(/<METEO[^>]*>[\s\S]*?<COMMENTAIRE>([\s\S]*?)<\/COMMENTAIRE>/i)?.[1]?.trim() || ''
  };
}

function hashPayload(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

async function readBlobJson(url) {
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
    }
  });
  if (!r.ok) throw new Error(`Blob read failed: ${r.status}`);
  return r.json();
}

async function translateWithLlm(frObj) {
  const prompt = `Translate this French avalanche bulletin content into precise, technical English for ski-tour users. Keep units and numbers exact. Preserve meaning, avoid simplification. Return strict JSON with keys: riskCommentEn,titleEn,stabilityEn,qualityEn,meteoEn.\n\nFrench JSON:\n${JSON.stringify(frObj, null, 2)}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a professional avalanche bulletin translator. Output valid JSON only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`LLM failed: ${resp.status} ${t.slice(0, 200)}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  return {
    riskCommentEn: parsed.riskCommentEn || '',
    titleEn: parsed.titleEn || '',
    stabilityEn: parsed.stabilityEn || '',
    qualityEn: parsed.qualityEn || '',
    meteoEn: parsed.meteoEn || ''
  };
}

export default async function handler(req, res) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY env var' });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'Missing BLOB_READ_WRITE_TOKEN env var' });
    }

    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const xml = await (await getBraBlob(massif, 'xml')).text();
    const fr = structuredFromXml(xml);

    const hashBase = {
      massif,
      risk: fr.risk,
      riskComment: fr.riskComment,
      title: fr.title,
      stability: fr.stability,
      quality: fr.quality,
      meteo: fr.meteo
    };
    const contentHash = hashPayload(hashBase);

    const blobPath = `translations/bra/${massif}/${contentHash}.json`;

    try {
      const meta = await head(blobPath);
      const cached = await readBlobJson(meta.url);
      return res.status(200).json({ ...fr, ...cached.translation, cached: true, contentHash, cachePath: blobPath });
    } catch {
      // cache miss
    }

    const translation = await translateWithLlm(fr);
    await put(blobPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      contentHash,
      massif,
      source: hashBase,
      translation
    }, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    return res.status(200).json({ ...fr, ...translation, cached: false, contentHash, cachePath: blobPath });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
