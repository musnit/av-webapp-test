import { getBraBlob } from './_bra-utils.js';

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const xml = await (await getBraBlob(massif, 'xml')).text();
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(xml);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
