import crypto from 'crypto';
import { put, head } from '@vercel/blob';

const FR_XSLT_URL = 'https://meteofrance.com/modules/custom/mf_map_layers_v2/assets/bra.xslt';

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function readBlobText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Blob read failed: ${r.status}`);
  return r.text();
}

function safeHeuristicXsltEn(frXslt) {
  const map = [
    ["Bulletin d'estimation du risque d'avalanche","Avalanche hazard bulletin"],
    ["(valable en dehors des pistes balisées et ouvertes)","(valid outside marked/open runs)"],
    ["rédigé le ","issued on "],
    ["Estimation des risques pour le ","Risk estimate for "],
    ["Stabilité du manteau neigeux jusqu'au","Snowpack stability until"],
    [" au soir"," in the evening"],
    ["Situtation avalancheuse typique :","Typical avalanche problem:"],
    ["Situation avalancheuse typique :","Typical avalanche problem:"],
    ["Qualité de la neige","Snow quality"],
    ["Aperçu météo pour le ","Weather outlook for "],
    ["Epaisseur de neige hors-piste","Off-piste snow depth"],
    ["Épaisseur de neige hors-piste","Off-piste snow depth"],
    ["Risque d'avalanche","Avalanche danger"],
    ["Risque détaillé","Detailed danger"],
    ["Graphe d'enneigement","Snow depth chart"],
    ["Graphe de neige fraîche","Fresh snow chart"],
    ["Enneigement Nord","North-facing snow depth"],
    ["Enneigement sud","South-facing snow depth"],
    ["Enneigement","Snow depth"],
    ["Isotherme 0°C et limite pluie neige","Freezing level and rain/snow line"],
    ["Indices de risque : 5 très fort - 4 fort - 3 marqué - 2 limité - 1 faible","Danger levels: 5 very high - 4 high - 3 considerable - 2 moderate - 1 low"],
    ["A la descente","On descent"],
    ["Altitude","Elevation"]
  ];
  let s = frXslt;
  map.forEach(([fr,en])=>{ s=s.replaceAll(fr,en); });
  return s;
}

// LLM XSLT translation removed intentionally: it can produce malformed XML.

export default async function handler(req, res) {
  try {
    const lang = String(req.query.lang || 'fr').toLowerCase();
    const frResp = await fetch(FR_XSLT_URL);
    if (!frResp.ok) throw new Error(`XSLT fetch failed: ${frResp.status}`);
    const frXslt = await frResp.text();

    if (lang !== 'en') {
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(frXslt);
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).send('Missing BLOB_READ_WRITE_TOKEN');

    const versionTag = 'xslt-en-v2-safe';
    const h = sha(versionTag + '|' + frXslt);
    const blobPath = `translations/bra-xslt-en/${h}.xslt`;

    try {
      const meta = await head(blobPath);
      const cached = await readBlobText(meta.url);
      res.setHeader('X-Translation-Cache', 'hit');
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      return res.status(200).send(cached);
    } catch {
      // miss
    }

    const enXslt = safeHeuristicXsltEn(frXslt);

    await put(blobPath, enXslt, {
      access: 'public',
      contentType: 'text/xml; charset=utf-8',
      addRandomSuffix: false
    });

    res.setHeader('X-Translation-Cache', 'miss');
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    return res.status(200).send(enXslt);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
