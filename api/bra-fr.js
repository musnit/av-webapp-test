import { getBraBlob } from './_bra-utils.js';

function escapeHtml(s = '') {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const xmlResp = await getBraBlob(massif, 'xml');
    const xml = await xmlResp.text();

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BRA Mont-Blanc XML (FR)</title>
<style>
body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#0b1324;color:#e2e8f0;padding:12px;margin:0}
pre{white-space:pre-wrap;word-break:break-word;background:#111827;border:1px solid #334155;border-radius:10px;padding:12px;line-height:1.35}
</style></head><body>
<pre>${escapeHtml(xml)}</pre>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
