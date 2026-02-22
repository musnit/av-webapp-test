import fs from 'fs';
import path from 'path';

const BASE = path.join(process.cwd(), 'assets', 'eaws-curated');

const MAP = {
  // Risk blocks from XSLT (R1..R5)
  'R1.PNG': 'Icon-Avalanche-Danger-Level-Dry-Snow-1-EAWS.svg',
  'R2.PNG': 'Icon-Avalanche-Danger-Level-Dry-Snow-2-EAWS.svg',
  'R3.PNG': 'Icon-Avalanche-Danger-Level-Dry-Snow-3-EAWS.svg',
  'R4.PNG': 'Icon-Avalanche-Danger-Level-Dry-Snow-4-5-EAWS.svg',
  'R5.PNG': 'Icon-Avalanche-Danger-Level-Dry-Snow-4-5-EAWS.svg',

  // SAT mapping (French BRA SAT1..SAT6 -> closest EAWS problems)
  'SAT1.PNG': 'Icon-Avalanche-Problem-New-Snow-EAWS.svg',
  'SAT2.PNG': 'Icon-Avalanche-Problem-Wind-Slab-EAWS.svg',
  'SAT3.PNG': 'Icon-Avalanche-Problem-Persistent-Weak-Layer-EAWS.svg',
  'SAT4.PNG': 'Icon-Avalanche-Problem-Wet-Snow-EAWS.svg',
  'SAT5.PNG': 'Icon-Avalanche-Problem-Gliding-Snow-EAWS.svg',
  'SAT6.PNG': 'Icon-Avalanche-Problem-Cornices.svg',
};

function fallbackSvg(label = '•') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="56" viewBox="0 0 120 56"><rect x="2" y="2" width="116" height="52" rx="10" fill="#334155"/><text x="60" y="34" text-anchor="middle" font-family="Arial" font-size="18" fill="#fff">${label}</text></svg>`;
}

export default async function handler(req, res) {
  try {
    const name = String(req.query.name || '').toUpperCase();
    const rel = MAP[name];

    if (rel) {
      const abs = path.join(BASE, rel);
      if (fs.existsSync(abs)) {
        const svg = fs.readFileSync(abs, 'utf8');
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(svg);
      }
    }

    // keep tiny placeholders for misc icons in XSLT
    const short = name.replace('.PNG', '') || '?';
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(fallbackSvg(short));
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
