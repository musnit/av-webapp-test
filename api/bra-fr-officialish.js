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
    const xmlUrl = ('${lang}'==='en')
      ? '/api/bra-xml-en?massif=${massif}&t='+Date.now()
      : '/api/bra-xml?massif=${massif}&t='+Date.now();
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
    out.appendChild(frag);

    if('${lang}'==='en'){
      let h=out.innerHTML;
      const staticMap = [
        ["Bulletin d'estimation du risque d'avalanche","Avalanche hazard bulletin"],
        ["(valable en dehors des pistes balisées et ouvertes)","(valid outside marked/open runs)"],
        ["MASSIF :","MASSIF:"],
        ["rédigé le","issued on"],
        ["Estimation des risques pour le","Risk estimate for"],
        ["Stabilité du manteau neigeux jusqu'au","Snowpack stability until"],
        ["au soir","in the evening"],
        ["Situtation avalancheuse typique :","Typical avalanche problem:"],
        ["Situation avalancheuse typique :","Typical avalanche problem:"],
        ["Enneigement","Snowpack depth"],
        ["Neige fraîche","Fresh snow"],
        ["Qualité de la neige","Snow quality"],
        ["Aperçu météo pour le","Weather outlook for"],
        ["Météo","Weather"],
        ["Déclenchements provoqués","Human-triggered avalanches"],
        ["Départs spontanés","Natural avalanche activity"],
        ["Pour consulter la vigilance en cours, veuillez vous rendre sur le site","To view current weather warnings, please visit"],
        ["Indices de risque : 5 très fort - 4 fort - 3 marqué - 2 limité - 1 faible","Danger levels: 5 very high - 4 high - 3 considerable - 2 moderate - 1 low"],
        ["Epaisseur de neige hors-piste","Off-piste snow depth"],
        ["Épaisseur de neige hors-piste","Off-piste snow depth"],
        ["Risque d'avalanche","Avalanche danger"],
        ["Risque détaillé","Detailed danger"],
        ["Graphe d'enneigement","Snow depth chart"],
        ["Graphe de neige fraîche","Fresh snow chart"],
        ["Enneigement Nord","North-facing snow depth"],
        ["Enneigement sud","South-facing snow depth"],
        ["Enneigement","Snow depth"],
        ["Isotherme 0°C et limite pluie neige","Freezing level and rain/snow line"],
        ["samedi","Saturday"],["dimanche","Sunday"],["lundi","Monday"],["mardi","Tuesday"],["mercredi","Wednesday"],["jeudi","Thursday"],["vendredi","Friday"],
        ["janvier","January"],["février","February"],["mars","March"],["avril","April"],["mai","May"],["juin","June"],["juillet","July"],["août","August"],["septembre","September"],["octobre","October"],["novembre","November"],["décembre","December"],
        ["Neige fraîche","Fresh snow"],["Neige ventée","Wind slab"],["Sous-couche fragile persistante","Persistent weak layer"],["Neige humide","Wet snow"],["Avalanches de fond","Gliding snow"],["Corniches","Cornices"]
      ];
      staticMap.forEach(([fr,en])=>{ h=swap(h,fr,en); });
      out.innerHTML=h;
      document.getElementById('status').textContent='Official XSLT render attempt (EN, full-XML translated)';
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
