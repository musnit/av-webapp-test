export default async function handler(req, res) {
  const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
  const lang = String(req.query.lang || 'en').toLowerCase();
  const html = `<!doctype html><html lang="${lang === 'en' ? 'en' : 'fr'}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>BRA FR via XSLT</title>
<style>html,body{margin:0;padding:0;background:#0b1324;color:#e2e8f0}body{padding:10px;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif}#status{font-size:13px;color:#94a3b8;margin-bottom:8px}#out img{max-width:100%;height:auto}#out .bloc1{display:flex !important;flex-direction:row !important;align-items:center;gap:10px;flex-wrap:nowrap}#out .risqueMaxi,#out .figurineRisque,#out .figurinePente{flex:0 0 auto}#out .risqueMaxi img{width:76px !important;height:76px !important;object-fit:contain}#out .figurineRisque img,#out .figurinePente img{max-height:120px !important;width:auto !important;object-fit:contain}#out .pictoSAT{width:28px !important;height:28px !important;vertical-align:middle}#out table img{max-height:28px !important;width:auto !important}#out .bloc2,#out .col1,#out .col2{overflow:hidden}</style>
</head><body>
<div id="status">Rendering with official XSLT…</div>
<div id="out"></div>
<script>
(async()=>{
  try {
    const xmlUrl = '/api/bra-xml?massif=${massif}&t='+Date.now();
    const [xmlTxt,xsltTxt]=await Promise.all([
      fetch(xmlUrl).then(r=>r.text()),
      fetch('/api/bra-xslt?lang=${lang}&t='+Date.now()).then(r=>r.text())
    ]);
    const parser=new DOMParser();
    const xml=parser.parseFromString(xmlTxt,'text/xml');
    const xsl=parser.parseFromString(xsltTxt,'text/xml');
    const out=document.getElementById('out');

    const xmlErr = xml.querySelector('parsererror');
    if (xmlErr) throw new Error('XML parse error: '+xmlErr.textContent.slice(0,180));
    const xslErr = xsl.querySelector('parsererror');
    if (xslErr) throw new Error('XSLT parse error: '+xslErr.textContent.slice(0,180));

    const p=new XSLTProcessor();
    p.importStylesheet(xsl);
    p.setParameter(null,'urlBlob',window.location.origin + '/api/bra-blob?blob_filename=');
    p.setParameter(null,'CheminPicto',window.location.origin + '/api/bra-picto?name=');
    p.setParameter(null,'dateExp',new Date().toString());
    const frag=p.transformToFragment(xml,document);
    if (!frag || !(frag instanceof Node)) throw new Error('XSLT transform returned empty/non-node fragment');

    if('${lang}'==='en'){
      // Render off-screen first so no French flashes before EN is ready.
      const tmp = document.createElement('div');
      tmp.style.display = 'none';
      tmp.appendChild(frag);
      document.body.appendChild(tmp);

      const resp = await fetch('/api/translate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: tmp.innerHTML })
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'HTML translation failed');
      out.innerHTML = j.translatedHtml || tmp.innerHTML;
      tmp.remove();
      document.getElementById('status').textContent='English translation ready';
    } else {
      out.appendChild(frag);
      document.getElementById('status').textContent='Official XSLT render attempt (FR)';
    }
  } catch(e){
    document.getElementById('status').textContent='XSLT render failed: '+e.message;
  }
})();
</script>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
}
