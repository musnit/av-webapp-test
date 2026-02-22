export default async function handler(req, res) {
  const massif = String(req.query.massif || '3').replace(/[^0-9]/g, '') || '3';
  const lang = String(req.query.lang || 'en').toLowerCase();
  const html = `<!doctype html><html lang="${lang === 'en' ? 'en' : 'fr'}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>BRA FR via XSLT</title>
<style>body{margin:0;padding:10px;background:#f8fafc;font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif}#status{font-size:13px;color:#475569;margin-bottom:8px}#out img{max-width:100%;height:auto}#out .bloc1{display:flex !important;flex-direction:row !important;align-items:center;gap:10px;flex-wrap:nowrap}#out .risqueMaxi,#out .figurineRisque,#out .figurinePente{flex:0 0 auto}#out .risqueMaxi img{width:76px !important;height:76px !important;object-fit:contain}#out .figurineRisque img,#out .figurinePente img{max-height:120px !important;width:auto !important;object-fit:contain}#out .pictoSAT{width:28px !important;height:28px !important;vertical-align:middle}#out table img{max-height:28px !important;width:auto !important}#out .bloc2,#out .col1,#out .col2{overflow:hidden}</style>
</head><body>
<div id="status">Rendering with official XSLT…</div>
<div id="out"></div>
<script>
(async()=>{
  function escRe(s){return s.replace(/[.*+?^$()|[\]\\]/g,'\\$&')}
  function swap(txt,from,to){ if(!from||!to) return txt; return txt.replace(new RegExp(escRe(from),'g'),to); }
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
    const out=document.getElementById('out');
    out.appendChild(frag);

    if('${lang}'==='en'){
      const tr=await fetch('/api/bra-en-llm?massif=${massif}&t='+Date.now()).then(r=>r.json());
      let h=out.innerHTML;
      // Static labels
      h=swap(h,"Bulletin d'estimation du risque d'avalanche","Avalanche hazard bulletin");
      h=swap(h,"(valable en dehors des pistes balisées et ouvertes)","(valid outside marked/open runs)");
      h=swap(h,"MASSIF :","MASSIF:");
      h=swap(h,"rédigé le","issued on");
      h=swap(h,"Estimation des risques pour le","Risk estimate for");
      h=swap(h,"Stabilité du manteau neigeux jusqu'au","Snowpack stability until");
      h=swap(h,"au soir","in the evening");
      h=swap(h,"Situtation avalancheuse typique :","Typical avalanche problem:");
      h=swap(h,"Indices de risque : 5 très fort - 4 fort - 3 marqué - 2 limité - 1 faible","Danger levels: 5 very high - 4 high - 3 considerable - 2 moderate - 1 low");

      // Dynamic text blocks (LLM)
      h=swap(h,tr.riskComment||'',tr.riskCommentEn||'');
      h=swap(h,tr.title||'',tr.titleEn||'');
      h=swap(h,tr.stability||'',tr.stabilityEn||'');
      h=swap(h,tr.quality||'',tr.qualityEn||'');
      h=swap(h,tr.meteo||'',tr.meteoEn||'');

      out.innerHTML=h;
      document.getElementById('status').textContent='Official XSLT render attempt (EN)';
    } else {
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
