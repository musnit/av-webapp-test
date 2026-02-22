const FR_XSLT_URL = 'https://meteofrance.com/modules/custom/mf_map_layers_v2/assets/bra.xslt';

export default async function handler(req, res) {
  try {
    const frResp = await fetch(FR_XSLT_URL);
    if (!frResp.ok) throw new Error(`XSLT fetch failed: ${frResp.status}`);
    const frXslt = await frResp.text();

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(frXslt);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
