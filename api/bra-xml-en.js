import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getBraBlob } from './_bra-utils.js';

function hash(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function cachePath(massif, h) {
  return path.join('/tmp', 'bra-xml-en-cache', massif, `${h}.xml`);
}

async function translateXml(xml) {
  const prompt = `Translate the following French avalanche bulletin XML to English.
Rules:
- Keep XML structure, element names, attributes names, ordering, and numeric values unchanged.
- Translate only human-readable French text content and French text attribute values.
- Keep URLs unchanged.
- Keep valid XML output only. No markdown, no explanations.

XML:\n${xml}`;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are an XML translator. Return XML only.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`LLM XML translation failed: ${r.status} ${t.slice(0, 180)}`);
  }
  const j = await r.json();
  let out = j?.choices?.[0]?.message?.content || '';
  out = out.trim().replace(/^```xml\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  if (!out.startsWith('<?xml') && !out.startsWith('<BULLETINS_NEIGE_AVALANCHE')) {
    throw new Error('LLM did not return XML');
  }
  return out;
}

export default async function handler(req, res) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).send('Missing OPENAI_API_KEY');
    }
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
    const frXml = await (await getBraBlob(massif, 'xml')).text();
    const h = hash(frXml);
    const p = cachePath(massif, h);

    if (fs.existsSync(p)) {
      const cached = fs.readFileSync(p, 'utf8');
      res.setHeader('X-Translation-Cache', 'hit');
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      return res.status(200).send(cached);
    }

    const enXml = await translateXml(frXml);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, enXml);

    res.setHeader('X-Translation-Cache', 'miss');
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    return res.status(200).send(enXml);
  } catch (e) {
    return res.status(500).send(`Error: ${e.message}`);
  }
}
