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

async function gTranslate(text) {
  if (!text) return '';
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'fr');
  url.searchParams.set('tl', 'en');
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);
  const r = await fetch(url);
  const j = await r.json();
  return (j?.[0] || []).map((x) => x?.[0] || '').join('').trim() || text;
}

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const xmlResp = await getBraBlob(massif, 'xml');
    const xml = await xmlResp.text();

    const risk = pickAttr(xml, 'RISQUE', 'RISQUEMAXI');
    const riskComment = pickAttr(xml, 'RISQUE', 'COMMENTAIRE');
    const title = pickTag(xml, 'TITRE');
    const stability = pickTag(xml, 'TEXTESANSTITRE') || pickTag(xml, 'TEXTE');
    const quality = xml.match(/<QUALITE>[\s\S]*?<TEXTE><!\[CDATA\[([\s\S]*?)\]\]><\/TEXTE>[\s\S]*?<\/QUALITE>/i)?.[1]?.trim() || '';
    const meteoComment = xml.match(/<METEO[^>]*>[\s\S]*?<COMMENTAIRE>([\s\S]*?)<\/COMMENTAIRE>/i)?.[1]?.trim() || '';

    const [riskCommentEn, titleEn, stabilityEn, qualityEn, meteoEn] = await Promise.all([
      gTranslate(riskComment),
      gTranslate(title),
      gTranslate(stability),
      gTranslate(quality),
      gTranslate(meteoComment)
    ]);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      massif: 'Mont-Blanc',
      risk,
      riskCommentEn,
      titleEn,
      stabilityEn,
      qualityEn,
      meteoEn
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
