import crypto from 'crypto';
import { put, head } from '@vercel/blob';
import { getBraBlob } from './_bra-utils.js';

function getAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function readBlobJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Blob read failed: ${r.status}`);
  return r.json();
}

async function translateHtmlCached(html) {
  const version = 'html-en-v1';
  const h = sha(version + '|' + html);
  const blobPath = `translations/html-en/${h}.json`;

  try {
    const meta = await head(blobPath);
    const cached = await readBlobJson(meta.url);
    if (cached?.translatedHtml) return { translatedHtml: cached.translatedHtml, cached: true };
  } catch {}

  const prompt = `Translate this French HTML fragment to English.
Rules:
- Preserve HTML structure exactly.
- Do not add/remove/reorder tags or attributes.
- Translate only human-readable text nodes.
- Keep numbers, URLs, units, and proper nouns intact.
- Return HTML only.

HTML:\n${html}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: 'You are an HTML translator. Return HTML only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LLM HTML translation failed: ${r.status} ${t.slice(0, 180)}`);
  }

  const j = await r.json();
  let translatedHtml = (j?.choices?.[0]?.message?.content || '').trim();
  translatedHtml = translatedHtml.replace(/^```html\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();

  await put(blobPath, JSON.stringify({ translatedHtml }, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false
  });

  return { translatedHtml, cached: false };
}

export default async function handler(req, res) {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).send('Missing OPENAI_API_KEY');
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).send('Missing BLOB_READ_WRITE_TOKEN');

    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const xml = await (await getBraBlob(massif, 'xml')).text();

    const data = {
      massif: getAttr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'MASSIF') || 'Mont-Blanc',
      issued: getAttr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'DATEBULLETIN'),
      valid: getAttr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'DATEVALIDITE'),
      risk: getAttr(xml, 'RISQUE', 'RISQUEMAXI'),
      riskComment: getAttr(xml, 'RISQUE', 'COMMENTAIRE'),
      title: getTag(xml, 'TITRE'),
      accidental: getTag(xml, 'ACCIDENTEL'),
      natural: getTag(xml, 'NATUREL'),
      summary: getTag(xml, 'RESUME'),
      stability: getTag(xml, 'TEXTESANSTITRE') || getTag(xml, 'TEXTE'),
      quality: xml.match(/<QUALITE>[\s\S]*?<TEXTE>([\s\S]*?)<\/TEXTE>[\s\S]*?<\/QUALITE>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || '',
      meteo: xml.match(/<METEO[^>]*>[\s\S]*?<COMMENTAIRE>([\s\S]*?)<\/COMMENTAIRE>/i)?.[1]?.trim() || ''
    };

    const frHtml = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;background:#0b1324;color:#e2e8f0;margin:0;padding:12px}
.wrap{max-width:960px;margin:0 auto}.card{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:12px;margin-bottom:10px}
h1{margin:0 0 6px;font-size:24px;color:#f8fafc}.muted{color:#94a3b8;font-size:13px}.risk{font-size:30px;font-weight:800;color:#f8fafc}.grid{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:860px){.grid{grid-template-columns:1fr 1fr}} h3{margin:0 0 6px} p{margin:0;white-space:pre-wrap;line-height:1.42}
</style></head><body><div class="wrap">
<div class="card"><h1>Bulletin d'estimation du risque d'avalanche</h1><div class="muted">Massif: <b>${data.massif}</b> • Rédigé: ${data.issued} • Valide jusqu'à: ${data.valid}</div><div class="risk">${data.risk}/5</div><div>${data.riskComment}</div></div>
<div class="grid"><div class="card"><h3>Déclenchements provoqués</h3><p>${data.accidental}</p></div><div class="card"><h3>Départs spontanés</h3><p>${data.natural}</p></div></div>
<div class="card"><h3>Message principal</h3><p>${data.title}</p></div>
<div class="card"><h3>Résumé</h3><p>${data.summary}</p></div>
<div class="card"><h3>Stabilité du manteau neigeux</h3><p>${data.stability}</p></div>
<div class="card"><h3>Qualité de la neige</h3><p>${data.quality}</p></div>
<div class="card"><h3>Aperçu météo</h3><p>${data.meteo}</p></div>
</div></body></html>`;

    const { translatedHtml, cached } = await translateHtmlCached(frHtml);

    res.setHeader('X-Translation-Cache', cached ? 'hit' : 'miss');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(translatedHtml || frHtml);
  } catch (e) {
    return res.status(500).send(`Error: ${e.message}`);
  }
}
