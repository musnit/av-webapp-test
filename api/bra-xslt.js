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

async function translateXslt(frXslt) {
  const prompt = `Translate this French XSLT template to English UI text while keeping valid XSLT.
Rules:
- Keep XML/XSL structure, tags, attributes, expressions, IDs, class names, and logic unchanged.
- Translate only human-readable French literal text nodes and French literal string values.
- Do not alter URLs.
- Return only valid XSLT XML.

XSLT:\n${frXslt}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: 'You are an XSLT translator. Return XSLT XML only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LLM XSLT translation failed: ${r.status} ${t.slice(0, 180)}`);
  }

  const j = await r.json();
  let out = j?.choices?.[0]?.message?.content || '';
  out = out.trim().replace(/^```xml\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  if (!out.startsWith('<?xml') && !out.includes('<xsl:stylesheet')) {
    throw new Error('LLM did not return valid XSLT');
  }
  return out;
}

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

    if (!process.env.OPENAI_API_KEY) return res.status(500).send('Missing OPENAI_API_KEY');
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).send('Missing BLOB_READ_WRITE_TOKEN');

    const versionTag = 'xslt-en-v1';
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

    const enXslt = await translateXslt(frXslt);
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
