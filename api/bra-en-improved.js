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

async function trBatch(texts) {
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
        { role: 'system', content: 'Translate avalanche bulletin text from French to accurate English. Return strict JSON only.' },
        { role: 'user', content: `Return JSON {"translations": [...]} same order and length. Keep numbers/units.\n${JSON.stringify(texts)}` }
      ]
    })
  });
  if (!r.ok) throw new Error(`translate failed ${r.status}`);
  const j = await r.json();
  const raw = j?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  return parsed.translations || texts;
}

export default async function handler(req, res) {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).send('Missing OPENAI_API_KEY');
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

    const keys = ['riskComment','title','accidental','natural','summary','stability','quality','meteo'];
    const translated = await trBatch(keys.map(k => data[k] || ''));
    keys.forEach((k,i)=> data[k+'En'] = translated[i] || data[k] || '');

    const h = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;background:#f4f7fb;color:#0f172a;margin:0;padding:12px}
.wrap{max-width:960px;margin:0 auto}.card{background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:12px;margin-bottom:10px}
h1{margin:0 0 6px;font-size:24px}.muted{color:#475569;font-size:13px}.risk{font-size:30px;font-weight:800}.grid{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:860px){.grid{grid-template-columns:1fr 1fr}} h3{margin:0 0 6px} p{margin:0;white-space:pre-wrap;line-height:1.42}
</style></head><body><div class="wrap">
<div class="card"><h1>Avalanche hazard bulletin</h1><div class="muted">Massif: <b>${data.massif}</b> • Issued: ${data.issued} • Valid until: ${data.valid}</div><div class="risk">${data.risk}/5</div><div>${data.riskCommentEn}</div></div>
<div class="grid"><div class="card"><h3>Human-triggered avalanches</h3><p>${data.accidentalEn}</p></div><div class="card"><h3>Natural avalanche activity</h3><p>${data.naturalEn}</p></div></div>
<div class="card"><h3>Main message</h3><p>${data.titleEn}</p></div>
<div class="card"><h3>Summary</h3><p>${data.summaryEn}</p></div>
<div class="card"><h3>Snowpack stability</h3><p>${data.stabilityEn}</p></div>
<div class="card"><h3>Snow quality</h3><p>${data.qualityEn}</p></div>
<div class="card"><h3>Weather outlook</h3><p>${data.meteoEn}</p></div>
</div></body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(h);
  } catch (e) {
    return res.status(500).send(`Error: ${e.message}`);
  }
}
