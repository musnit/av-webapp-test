import { getBraBlob } from './_bra-utils.js';

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const pdfResp = await getBraBlob(massif, 'pdf');
    const arr = await pdfResp.arrayBuffer();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="BRA_${massif}.pdf"`);
    return res.status(200).send(Buffer.from(arr));
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
