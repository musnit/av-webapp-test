const METEO_PAGE = 'https://meteofrance.com/meteo-montagne/alpes-du-nord/risques-avalanche';

export function rot13LettersOnly(input = '') {
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

export async function getMfToken() {
  const pageResp = await fetch(METEO_PAGE, { redirect: 'follow' });
  const setCookie = pageResp.headers.getSetCookie?.() || [pageResp.headers.get('set-cookie')].filter(Boolean);
  const mfsession = getCookieValue(setCookie, 'mfsession');
  if (!mfsession) throw new Error('Could not get Meteo-France session token');
  return rot13LettersOnly(decodeURIComponent(mfsession));
}

export async function fetchBlobByFilename(blobFilename) {
  const token = await getMfToken();
  const url = new URL('https://rwg.meteofrance.com/gdss/v1/metronome_bra/blob');
  url.searchParams.set('sort-results-by', '-blob_creation_time');
  url.searchParams.set('blob_filename', blobFilename);

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Upstream fetch failed: ${resp.status} ${txt.slice(0, 200)}`);
  }
  return resp;
}

export async function getBraBlob(massif = '3', ext = 'pdf') {
  return fetchBlobByFilename(`BRA_${massif}.${ext}`);
}
