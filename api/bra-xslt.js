export default async function handler(req, res) {
  try {
    const r = await fetch('https://meteofrance.com/modules/custom/mf_map_layers_v2/assets/bra.xslt');
    if (!r.ok) throw new Error(`XSLT fetch failed: ${r.status}`);
    const xslt = await r.text();
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(xslt);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
