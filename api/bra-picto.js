function svgForRisk(level = '3') {
  const colors = { '1': '#22c55e', '2': '#84cc16', '3': '#f59e0b', '4': '#f97316', '5': '#ef4444' };
  const c = colors[level] || '#94a3b8';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110">
    <rect x="5" y="5" width="100" height="100" rx="14" fill="${c}" />
    <text x="55" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="white">${level}</text>
  </svg>`;
}

function tinyIcon(label = '?') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <rect x="2" y="2" width="44" height="44" rx="10" fill="#1f2937"/>
    <text x="24" y="29" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#e5e7eb">${label}</text>
  </svg>`;
}

function satIcon(level = '1') {
  const colors = { '1': '#2563eb', '2': '#7c3aed', '3': '#0ea5e9', '4': '#f59e0b', '5': '#ef4444', '6': '#059669' };
  const c = colors[level] || '#64748b';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="56" viewBox="0 0 120 56">
    <rect x="2" y="2" width="116" height="52" rx="10" fill="${c}"/>
    <text x="60" y="36" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="white">SAT ${level}</text>
  </svg>`;
}

export default async function handler(req, res) {
  const name = String(req.query.name || '').toUpperCase();

  let svg = '';
  const riskMatch = name.match(/^R([1-5])\.PNG$/);
  const satMatch = name.match(/^SAT([1-6])\.PNG$/);
  if (riskMatch) {
    svg = svgForRisk(riskMatch[1]);
  } else if (satMatch) {
    svg = satIcon(satMatch[1]);
  } else if (name === 'VENT.PNG') {
    svg = tinyIcon('Wind');
  } else if (name === 'WW.PNG') {
    svg = tinyIcon('Wx');
  } else if (name === 'LPN.PNG') {
    svg = tinyIcon('LPN');
  } else if (name === 'ISO0.PNG') {
    svg = tinyIcon('0°');
  } else if (name === 'BAISSE.PNG') {
    svg = tinyIcon('↓');
  } else if (name === 'HAUSSE.PNG') {
    svg = tinyIcon('↑');
  } else if (name === 'STABLE2.PNG') {
    svg = tinyIcon('=');
  } else if (name === 'LOGO_METEOFRANCE.PNG') {
    svg = tinyIcon('MF');
  } else {
    svg = tinyIcon('•');
  }

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(svg);
}
