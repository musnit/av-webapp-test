import crypto from 'crypto';
import { head } from '@vercel/blob';
import { getBraBlob } from './_bra-utils.js';

function hash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function decodeCdata(s = '') { return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'); }
function pickTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const frXml = await (await getBraBlob(massif, 'xml')).text();

    const sections = [];
    const refs = [];

    const riskComment = (frXml.match(/<RISQUE[^>]*\bCOMMENTAIRE="([^"]*)"/i)?.[1]) || '';
    if (riskComment) { refs.push('RISQUE@COMMENTAIRE'); sections.push(riskComment); }

    const tagSingles = ['ACCIDENTEL', 'NATUREL', 'RESUME', 'RisqueJ2', 'CommentaireRisqueJ2', 'TITRE', 'TEXTESANSTITRE', 'TEXTE'];
    for (const t of tagSingles) {
      const v = pickTag(frXml, t);
      if (v) { refs.push(t); sections.push(decodeCdata(v)); }
    }

    const qual = frXml.match(/<QUALITE>[\s\S]*?<TEXTE>([\s\S]*?)<\/TEXTE>[\s\S]*?<\/QUALITE>/i)?.[1];
    if (qual) { refs.push('QUALITE/TEXTE'); sections.push(decodeCdata(qual)); }

    const meteoComment = frXml.match(/<METEO[^>]*>[\s\S]*?<COMMENTAIRE>([\s\S]*?)<\/COMMENTAIRE>/i)?.[1];
    if (meteoComment) { refs.push('METEO/COMMENTAIRE'); sections.push(decodeCdata(meteoComment)); }

    const translationVersion = 'xml-section-v1';
    const contentHash = hash(translationVersion + '|' + JSON.stringify(sections));
    const blobPath = `translations/bra-xml-en-sections/${massif}/${contentHash}.xml`;

    let cacheHit = false;
    try {
      await head(blobPath);
      cacheHit = true;
    } catch {}

    return res.status(200).json({
      massif,
      sectionCount: sections.length,
      refs,
      contentHash,
      blobPath,
      cacheHit,
      sample: sections.slice(0, 3)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
