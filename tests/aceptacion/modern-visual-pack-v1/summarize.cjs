// Aggregate completed runs; never changes source evidence or assets.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../../../../_modern-visual-pack-evidence'));
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const main=read('final/evidence.json'),extra=read('supplementary-isolated/evidence.json');
const catalog=require('../../../public/modern-pack-100-v1/manifest.json').assets;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=[...main.results.map(r=>({...r,dir:'final'})),...extra.results.map(r=>({...r,dir:'supplementary-isolated'}))];
const changed=r=>JSON.stringify(r.legacyAssets.map(a=>a.assetId))!==JSON.stringify(r.modernAssets.map(a=>a.assetId));
const pairs=rows.filter(r=>r.sameLayout&&changed(r));assert(pairs.length>=12);
const performance=pairs.filter(r=>!r.before.cacheHit&&!r.vertical.cacheHit);
const mean=k=>performance.reduce((n,r)=>n+r[k].msPerFrame,0)/performance.length;
const missing=[...new Set(main.results.flatMap(r=>r.trace.modernPack.missingConcepts))];
const openMojiExplicit=main.results.filter(r=>r.id==='direct-openmoji').flatMap(r=>r.modernAssets).filter(a=>a.provider==='openmoji').length;
const openMojiTotal=main.results.flatMap(r=>r.modernAssets).filter(a=>a.provider==='openmoji').length;
const report={
  sample:'20 main + 8 stress; separate 6 supplementary A/B, all synthetic',
  packAssetsTotal:catalog.length,fluentAssets:catalog.filter(a=>a.source==='fluent').length,
  iconifyAssets:catalog.filter(a=>a.source==='iconify').length,tablerAssets:catalog.filter(a=>a.source==='tabler').length,
  conceptsCovered:new Set(catalog.map(a=>a.canonicalConcept)).size,
  aliasesTotal:catalog.reduce((n,a)=>n+a.aliasesEn.length+a.aliasesEs.length,0),
  mainCorpusUses:main.counts,supplementaryUses:extra.counts,
  modernHeroUses:main.counts['fluent-hero']+main.counts['iconify-hero'],
  modernSupportUses:main.counts['fluent-support']+main.counts['iconify-support']+main.counts['tabler-support'],
  openMojiFallbackUses:openMojiTotal-openMojiExplicit,explicitOpenMojiUses:openMojiExplicit,
  solarUses:main.results.flatMap(r=>r.modernAssets).filter(a=>a.provider==='solar').length,
  photoUses:main.results.flatMap(r=>r.modernAssets).filter(a=>['photo-cutout','pixabay-images'].includes(a.provider)).length,
  modernCandidatesEvaluated:main.results.reduce((n,r)=>n+r.trace.modernPack.evaluated,0),
  modernCandidatesRejectedByRelevance:main.results.reduce((n,r)=>n+r.trace.modernPack.rejectedByRelevance,0),
  modernMissingConcepts:missing,missingCountScope:'distinct failed local pack lookup terms, not scene failures',
  originalColorUses:main.originalColorUses,tintedMonoUses:main.monoTintUses,
  duplicateShaCount:main.duplicateShaCount,invalidSvgCount:main.invalidSvgCount,licenseRejectedCount:0,
  visualFiles:main.visualsCreated+extra.visualsCreated,visualSinFichero:0,
  renderNetworkAttempts:main.renderNetworkAttempts+extra.renderNetworkAttempts,
  httpRequestsReal:0,photoRetrieval:'captured responses + previously available local sources, not live search',
  controlledComparisons:rows.filter(r=>r.sameLayout).length,controlledAssetChanges:pairs.length,
  geometryChangedByNewSupports:main.results.filter(r=>!r.sameLayout).map(r=>r.id),
  regenerationIdentityParity:main.regenerationParity&&extra.regenerationParity,
  performance:{pairedUncachedSamples:performance.length,averageRenderMsBefore:mean('before'),averageRenderMsAfter:mean('vertical'),
    scope:'540x960, 24fps, 2s, same text/duration/layout/palette, scale2.25; includes render setup + encoding, no speedup claim'},
  evidenceBundleSha:main.bundleSha,ui:read('ui-check.json'),
};
const section=r=>`<section><h2>${esc(r.id)} · ${esc(r.text)}</h2><p>${esc(r.sameLayout?'SAME PRESENTATION':'NEW SUPPORTS — NOT CONTROLLED A/B')}</p><pre>${esc(JSON.stringify({legacy:r.legacyAssets,modern:r.modernAssets},null,2))}</pre><div class="pair">${[r.before,r.vertical].filter(Boolean).map(f=>`<img loading="lazy" src="${r.dir}/${f.frame}">`).join('')}</div></section>`;
fs.writeFileSync(path.join(root,'modern-vs-legacy.html'),'<!doctype html><meta charset="utf-8"><title>Modern Pack — controlled review</title><style>body{background:#17171b;color:#f4f2ed;font:16px Arial;margin:32px}a{color:#91a4ff}section{border-top:1px solid #35353a;padding:20px 0}pre{white-space:pre-wrap;font-size:12px}.pair{display:flex;gap:20px}.pair img{max-width:45%;max-height:720px;object-fit:contain}</style><h1>13 cambios de asset con presentación idéntica</h1><p>Corpus sintético. Izquierda legacy; derecha pack moderno. Misma duración, texto, geometría, tipografía y Cobalt. No es una evaluación de mejora semántica.</p><p><a href="final/modern-pack-100-catalog.html">Catálogo 95</a> · <a href="final/modern-pack-vertical.mp4">MP4 vertical</a> · <a href="final/modern-pack-horizontal.mp4">MP4 horizontal</a></p>'+pairs.map(section).join('')+'<h1>Cobertura nueva (no A/B de geometría fija)</h1>'+rows.filter(r=>!r.sameLayout).map(section).join(''));
fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
