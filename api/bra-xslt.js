import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const lang = String(req.query.lang || 'fr').toLowerCase();
    const file = lang === 'en' ? 'bra.en.xslt' : 'bra.fr.xslt';
    const p = path.join(process.cwd(), 'assets', 'xslt', file);
    const xslt = fs.readFileSync(p, 'utf8');

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(xslt);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
