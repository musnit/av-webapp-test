import { getBraBlob } from './_bra-utils.js';

const KNOWN_R = new Set(['1', '2', '3', '4', '5']);
const KNOWN_SAT = new Set(['1', '2', '3', '4', '5', '6']);

function attr(xml, tag, key) {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${key}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const xml = await (await getBraBlob(massif, 'xml')).text();

    const risk = attr(xml, 'RISQUE', 'RISQUEMAXI');
    const sat1 = attr(xml, 'SitAvalTyp', 'SAT1');
    const sat2 = attr(xml, 'SitAvalTyp', 'SAT2');

    const warnings = [];
    if (!risk) warnings.push('Missing RISQUEMAXI in XML');
    else if (!KNOWN_R.has(risk)) warnings.push(`Unknown RISQUEMAXI value: ${risk}`);

    for (const [k, v] of [['SAT1', sat1], ['SAT2', sat2]]) {
      if (v && !KNOWN_SAT.has(v)) warnings.push(`Unknown ${k} value: ${v}`);
    }

    const ok = warnings.length === 0;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok, massif, risk, sat1, sat2, warnings });
  } catch (err) {
    return res.status(200).json({ ok: false, warnings: [`Validation error: ${err.message}`] });
  }
}
