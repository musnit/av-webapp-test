import { fetchBlobByFilename } from './_bra-utils.js';

function guessContentType(filename = '') {
  const f = filename.toLowerCase();
  if (f.endsWith('.png')) return 'image/png';
  if (f.endsWith('.jpg') || f.endsWith('.jpeg')) return 'image/jpeg';
  if (f.endsWith('.gif')) return 'image/gif';
  if (f.endsWith('.pdf')) return 'application/pdf';
  if (f.endsWith('.xml')) return 'text/xml; charset=utf-8';
  return 'application/octet-stream';
}

export default async function handler(req, res) {
  try {
    const blobFilename = String(req.query.blob_filename || '').trim();
    if (!blobFilename) return res.status(400).send('Missing blob_filename');

    const upstream = await fetchBlobByFilename(blobFilename);
    const arr = await upstream.arrayBuffer();
    res.setHeader('Content-Type', guessContentType(blobFilename));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(arr));
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
