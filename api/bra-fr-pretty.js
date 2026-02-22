import { getBraBlob } from './_bra-utils.js';

function esc(s = '') {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unCdata(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function attr(xml, tag, key) {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${key}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function tag(xml, t) {
  const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\/${t}>`, 'i'));
  return m ? unCdata(m[1]) : '';
}

function quality(xml) {
  const m = xml.match(/<QUALITE>[\s\S]*?<TEXTE>([\s\S]*?)<\/TEXTE>[\s\S]*?<\/QUALITE>/i);
  return m ? unCdata(m[1]) : '';
}

function meteoComment(xml) {
  const m = xml.match(/<METEO[^>]*>[\s\S]*?<COMMENTAIRE>([\s\S]*?)<\/COMMENTAIRE>/i);
  return m ? unCdata(m[1]) : '';
}

function niv(xml) {
  const rows = [...xml.matchAll(/<NIVEAU[^>]*ALTI="(\d+)"[^>]*N="(\d+)"[^>]*S="(\d+)"[^>]*\/>/g)];
  if (!rows.length) return '<p>—</p>';
  return `<table><thead><tr><th>Altitude</th><th>Nord</th><th>Sud</th></tr></thead><tbody>${rows
    .map((r) => `<tr><td>${r[1]} m</td><td>${r[2]} cm</td><td>${r[3]} cm</td></tr>`)
    .join('')}</tbody></table>`;
}

function neige24(xml) {
  const rows = [...xml.matchAll(/<NEIGE24H[^>]*DATE="([^"]+)"[^>]*SS24Min="([^"]+)"[^>]*SS24Max="([^"]+)"[^>]*\/>/g)];
  if (!rows.length) return '<p>—</p>';
  const last = rows.slice(-6);
  return `<table><thead><tr><th>Date</th><th>Fresh snow (min-max)</th></tr></thead><tbody>${last
    .map((r) => `<tr><td>${r[1].slice(0,10)}</td><td>${r[2]}-${r[3]} cm</td></tr>`)
    .join('')}</tbody></table>`;
}

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const xml = await (await getBraBlob(massif, 'xml')).text();

    const massifName = attr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'MASSIF') || 'Mont-Blanc';
    const dateBulletin = attr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'DATEBULLETIN');
    const validUntil = attr(xml, 'BULLETINS_NEIGE_AVALANCHE', 'DATEVALIDITE');
    const risk = attr(xml, 'RISQUE', 'RISQUEMAXI');
    const riskComment = attr(xml, 'RISQUE', 'COMMENTAIRE');
    const acc = tag(xml, 'ACCIDENTEL');
    const nat = tag(xml, 'NATUREL');
    const title = tag(xml, 'TITRE');
    const stability = tag(xml, 'TEXTESANSTITRE') || tag(xml, 'TEXTE');
    const qual = quality(xml);
    const met = meteoComment(xml);

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BRA ${esc(massifName)}</title>
<style>
body{margin:0;background:#f3f6fb;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:14px}
.card{background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:14px;margin-bottom:10px}
h1{margin:0 0 8px;font-size:24px}.muted{color:#475569;font-size:13px}
.badge{display:inline-block;padding:6px 10px;border-radius:999px;background:#e2e8f0;font-weight:700}
.risk{font-size:28px;font-weight:800;margin-top:6px}
.grid{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:860px){.grid{grid-template-columns:1fr 1fr}}
h3{margin:0 0 8px;font-size:17px} p{margin:0;white-space:pre-wrap;line-height:1.45}
table{width:100%;border-collapse:collapse;font-size:14px} th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
</style></head><body><div class="wrap">
<div class="card"><h1>Bulletin d'estimation du risque d'avalanche</h1>
<div class="muted">Massif: <b>${esc(massifName)}</b> • Émis: ${esc(dateBulletin)} • Valide jusqu'à: ${esc(validUntil)}</div>
<div class="risk">Risque ${esc(risk)}/5</div><div class="badge">${esc(riskComment)}</div></div>
<div class="grid">
<div class="card"><h3>Déclenchements provoqués</h3><p>${esc(acc)}</p></div>
<div class="card"><h3>Départs spontanés</h3><p>${esc(nat)}</p></div>
</div>
<div class="card"><h3>${esc(title || 'Stabilité du manteau neigeux')}</h3><p>${esc(stability)}</p></div>
<div class="card"><h3>Qualité de la neige</h3><p>${esc(qual)}</p></div>
<div class="card"><h3>Météo</h3><p>${esc(met)}</p></div>
<div class="grid">
<div class="card"><h3>Enneigement (N/S)</h3>${niv(xml)}</div>
<div class="card"><h3>Neige fraîche récente</h3>${neige24(xml)}</div>
</div>
<div class="muted">Source: Météo-France BRA XML officiel (mise en page web non officielle).</div>
</div></body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  } catch (e) {
    res.status(500).send(`Error: ${e.message}`);
  }
}
