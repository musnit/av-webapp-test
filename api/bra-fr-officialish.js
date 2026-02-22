export default async function handler(req, res) {
  const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>BRA FR via XSLT</title>
<style>body{margin:0;padding:10px;background:#f8fafc;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif}#status{font-size:13px;color:#475569;margin-bottom:8px}#out img{max-width:100%;height:auto}#out .risqueMaxi img{width:76px !important;height:76px !important;object-fit:contain}#out .figurineRisque img,#out .figurinePente img{max-height:120px !important;width:auto !important;object-fit:contain}#out .pictoSAT{width:28px !important;height:28px !important;vertical-align:middle}#out table img{max-height:28px !important;width:auto !important}#out .bloc1,#out .bloc2,#out .col1,#out .col2{overflow:hidden}</style>
</head><body>
<div id="status">Rendering with official XSLT…</div>
<div id="out"></div>
<script>
(async()=>{
  try {
    const [xmlTxt,xsltTxt]=await Promise.all([
      fetch('/api/bra-xml?massif=${massif}&t='+Date.now()).then(r=>r.text()),
      fetch('/api/bra-xslt?t='+Date.now()).then(r=>r.text())
    ]);
    const parser=new DOMParser();
    const xml=parser.parseFromString(xmlTxt,'text/xml');
    const xsl=parser.parseFromString(xsltTxt,'text/xml');
    const p=new XSLTProcessor();
    p.importStylesheet(xsl);
    p.setParameter(null,'urlBlob',window.location.origin + '/api/bra-blob?blob_filename=');
    p.setParameter(null,'CheminPicto',window.location.origin + '/api/bra-picto?name=');
    p.setParameter(null,'dateExp',new Date().toString());
    const frag=p.transformToFragment(xml,document);
    document.getElementById('out').appendChild(frag);
    document.getElementById('status').textContent='Official XSLT render attempt';
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
