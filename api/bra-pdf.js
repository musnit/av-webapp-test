const METEO_PAGE = 'https://meteofrance.com/meteo-montagne/alpes-du-nord/risques-avalanche';

function rot13LettersOnly(input = '') {
  return input.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + ((ch.charCodeAt(0) - base + 13) % 26));
  });
}

function getCookieValue(setCookieHeaders, name) {
  for (const entry of setCookieHeaders || []) {
    const m = entry.match(new RegExp(`${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';

    const pageResp = await fetch(METEO_PAGE, { redirect: 'follow' });
    const setCookie = pageResp.headers.getSetCookie?.() || [pageResp.headers.get('set-cookie')].filter(Boolean);
    const mfsession = getCookieValue(setCookie, 'mfsession');

    if (!mfsession) {
      return res.status(502).send('Could not get Meteo-France session token');
    }

    const token = rot13LettersOnly(decodeURIComponent(mfsession));
    const pdfUrl = new URL('https://rwg.meteofrance.com/gdss/v1/metronome_bra/blob');
    pdfUrl.searchParams.set('sort-results-by', '-blob_creation_time');
    pdfUrl.searchParams.set('blob_filename', `BRA_${massif}.pdf`);

    const pdfResp = await fetch(pdfUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!pdfResp.ok) {
      const txt = await pdfResp.text();
      return res.status(502).send(`Upstream PDF fetch failed: ${pdfResp.status} ${txt.slice(0, 200)}`);
    }

    const arr = await pdfResp.arrayBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="BRA_${massif}.pdf"`);
    return res.status(200).send(Buffer.from(arr));
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
}
