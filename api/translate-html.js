import crypto from 'crypto';
import { put, head } from '@vercel/blob';

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function readBlobJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Blob read failed: ${r.status}`);
  return r.json();
}

async function llmTranslateHtml(html) {
  const prompt = `Translate this French HTML fragment to English.
Rules:
- Preserve HTML structure exactly.
- Do not add/remove/reorder tags or attributes.
- Translate only human-readable text nodes.
- Keep numbers, URLs, units, and proper nouns intact.
- Return HTML only.

HTML:\n${html}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: 'You are an HTML translator. Return HTML only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LLM HTML translation failed: ${r.status} ${t.slice(0, 180)}`);
  }

  const j = await r.json();
  let out = j?.choices?.[0]?.message?.content || '';
  out = out.trim().replace(/^```html\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'Missing BLOB_READ_WRITE_TOKEN' });

    const body = req.body || {};
    const html = String(body.html || '');
    if (!html) return res.status(400).json({ error: 'Missing html' });

    const version = 'html-en-v1';
    const h = sha(version + '|' + html);
    const blobPath = `translations/html-en/${h}.json`;

    try {
      const meta = await head(blobPath);
      const cached = await readBlobJson(meta.url);
      return res.status(200).json({ translatedHtml: cached.translatedHtml, cached: true, hash: h });
    } catch {
      // miss
    }

    const translatedHtml = await llmTranslateHtml(html);
    await put(blobPath, JSON.stringify({ translatedHtml }, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    });

    return res.status(200).json({ translatedHtml, cached: false, hash: h });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
