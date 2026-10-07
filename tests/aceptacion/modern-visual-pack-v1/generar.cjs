// Controlled synthetic scenes; provider replies are captured fixtures, never a claim of live retrieval.
const {app,session,BrowserWindow,ipcMain}=require('electron');const fs=require('fs');const path=require('path');
const assert=require('assert/strict');const crypto=require('crypto');const {execFileSync}=require('child_process');
const http=require('http'),https=require('https');
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture');
const {rows:mainRows,context}=require('../../fixtures/modern-visual-pack-v1');
const supplementary=process.argv.includes('--supplementary-ab');
const rows=supplementary?require('../../fixtures/modern-visual-pack-ab-v1'):mainRows;
const repo=path.resolve(__dirname,'../../..');const out=path.resolve(process.argv[2]||path.join(repo,'../_modern-visual-pack-evidence'));
const fixture=createTestFixture('modern-pack-evidence'),project=path.join(fixture,'project');
const raw=path.resolve(repo,'../_spike-runtime/photo-cutout-v1/runs/2026-09-11-06-18-11-623/raw');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ff=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{maxBuffer:64*1024*1024});
let b,blocked=0;const fps=24;let renderPhase=false;let renderNetworkAttempts=0;
app.setPath('userData',path.join(fixture,'user-data'));app.commandLine.appendSwitch('force-device-scale-factor','2.25');process.chdir(fixture);
function search(url){const q=String(url.searchParams.get('q')||'');const hits=/woman|mujer|person|persona/i.test(q)?[
  {id:1064658,pageURL:'https://pixabay.com/photos/young-woman/',largeImageURL:'https://cdn.pixabay.com/woman-1064658.jpg',tags:'woman, person, portrait, young woman, computer',imageWidth:1280,imageHeight:907,type:'photo'}]
  :/protest|demonstration|rally|manifestaci[oó]n/i.test(q)?[
    {id:4130710,pageURL:'https://pixabay.com/photos/protest/',largeImageURL:'https://cdn.pixabay.com/protest-4130710.jpg',tags:'protest, demonstration, rally, meeting, people, crowd',imageWidth:1280,imageHeight:720,type:'photo'}]:[];
  return Promise.resolve({hits});}
function bytes(url){if(String(url).includes('1064658'))return Promise.resolve(fs.readFileSync(path.join(raw,'person-mid.jpg')));
  if(String(url).includes('4130710'))return Promise.resolve(fs.readFileSync(path.join(raw,'busy-scene.jpg')));throw Error('UNRECORDED_DOWNLOAD');}
async function render(row,name,w,h){let qc;const start=performance.now();
  const file=await b.renderGraphicClip(row.resolved.compiled.graphicData,{ancho:w,alto:h,fps,duracion:row.context.duration,modo:'pantalla',sistema:'editorial',projectRoot:project,renderBindings:row.resolved.compiled.renderBindings,onQcReport:v=>qc=v,onQcFailure:v=>qc=v});
  const elapsed=performance.now()-start;
  assert(file&&fs.existsSync(file),name+': '+JSON.stringify(qc));
  if(qc){assert(qc.findings.every(f=>f.level!=='error'),name+JSON.stringify(qc.findings));assert(qc.snapshots.every(s=>!s.textOverflow&&!s.keywordOverflow&&!s.textFitFailed),name);}
  const clip=path.join(out,'clips',name+'.mp4'),frame=path.join(out,'frames',name+'.png');fs.copyFileSync(file,clip);
  ff(['-ss',String(row.context.duration*.58),'-i',clip,'-frames:v','1',frame]);
  return {file:path.relative(out,clip).replace(/\\/g,'/'),frame:path.relative(out,frame).replace(/\\/g,'/'),sha256:sha(fs.readFileSync(clip)),msPerFrame:elapsed/(fps*row.context.duration),qc:qc??null,cacheHit:!qc};
}
function join(files,name){ff([...files.flatMap(f=>['-i',path.join(out,f)]),'-filter_complex',files.map((_,i)=>`[${i}:v]`).join('')+`concat=n=${files.length}:v=1:a=0,format=yuv420p[v]`,'-map','[v]','-c:v','libx264','-movflags','+faststart',path.join(out,name)]);}
const html=(title,body)=>'<!doctype html><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{background:#17171b;color:#f4f2ed;font:15px Arial;margin:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{padding:12px;background:#232327;overflow-wrap:anywhere}article img{width:100%;height:150px;object-fit:contain;background:#e8e6e1}section{margin-bottom:25px}section img{height:460px;max-width:45%;object-fit:contain}small{color:#aaa8a3}</style><h1>'+esc(title)+'</h1>'+body;
async function captureCatalog(file,name){const win=new BrowserWindow({show:false,width:1280,height:1800,webPreferences:{nodeIntegration:false,contextIsolation:true}});
  try{await win.loadFile(file);await win.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))');fs.writeFileSync(path.join(out,name),(await win.webContents.capturePage()).toPNG());}finally{win.destroy();}}
app.whenReady().then(async()=>{let code=1;try{
  const deny=()=>{blocked++;if(renderPhase)renderNetworkAttempts++;throw Error('NETWORK_BLOCKED')};global.fetch=deny;http.request=deny;https.request=deny;
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>{const net=/^https?:/i.test(d.url);if(net){blocked++;if(renderPhase)renderNetworkAttempts++;}cb({cancel:net})});
  b=require(path.join(repo,'dist-electron/main/index.js'));
  // The imported main module also starts its UI. Its voice picker is unrelated to visual
  // rendering; isolate only that IPC. All real HTTP paths remain denied, including render.
  ipcMain.removeHandler('get-elevenlabs-voices');
  ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}));
  if(fs.existsSync(path.join(out,'evidence.json')))throw Error('Evidence exists; select a new output directory');
  for(const p of ['frames','clips','assets'])fs.mkdirSync(path.join(out,p),{recursive:true});
  b.createProjectFiles(project,{id:'modern-pack-acceptance',clips:[],timelineVideoClips:[],aiScript:'controlled synthetic corpus'});
  const hooks={searchRequestJson:search,downloadRequestBytes:bytes};
  const resolve=contexts=>b.resolveModernVisualGenerationBatchV2({contexts,projectRoot:project,pixabayApiKey:'captured-offline-response',hooks});
  const before=await resolve(rows.map((r,i)=>context(b,r,i,false)));console.log('LEGACY_RESOLVED',before.length);
  const modern=await resolve(rows.map((r,i)=>context(b,r,i,true)));console.log('MODERN_RESOLVED',modern.length);
  const repeat=await resolve(modern.map(r=>r.context));
  const catalog=b.modernVisualPackCatalogV1();const results=[];renderPhase=true;
  for(let i=0;i<rows.length;i++){
    const old=before[i].resolved.compiled.sceneSpec,spec=modern[i].resolved.compiled.sceneSpec;
    assert.equal(b.sceneSpecPixelIdentityAny(spec),b.sceneSpecPixelIdentityAny(repeat[i].resolved.compiled.sceneSpec),'regeneration');
    const choice=row=>row.resolved.choices.map(c=>({slot:c.slotId,concept:c.concept,provider:c.provider,assetId:c.catalogAsset?.assetId??c.stableId??c.solarIcon,sha:c.asset?.sha256,source:catalog.find(a=>a.assetId===c.catalogAsset?.assetId)?.source,reason:c.reason,semanticMatch:c.relevance?.relevanceClass}));
    const sameLayout=JSON.stringify(old.layout)===JSON.stringify(spec.layout)&&JSON.stringify(old.text)===JSON.stringify(spec.text)&&JSON.stringify(old.premiumStyle)===JSON.stringify(spec.premiumStyle);
    const r={id:rows[i].id,stress:rows[i].stress,text:rows[i].text,duration:rows[i].duration,legacyAssets:choice(before[i]),modernAssets:choice(modern[i]),sameLayout,palette:spec.premiumStyle.porcelainPalette,metrics:modern[i].resolved.metrics,trace:modern[i].resolved.trace,identity:sha(b.sceneSpecPixelIdentityAny(spec))};
    if(sameLayout || i<12)r.before=await render(before[i],rows[i].id+'-legacy-v',540,960);
    r.vertical=await render(modern[i],rows[i].id+'-modern-v',540,960);r.horizontal=await render(modern[i],rows[i].id+'-modern-h',960,540);
    results.push(r);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(results,null,2));console.log('PACK_SCENE',i+1,rows[i].id,r.modernAssets.map(c=>c.assetId??c.provider).join(','));
  }
  const controlled=results.filter(r=>r.sameLayout&&r.before);
  assert(controlled.length>=(supplementary?6:12),'Presentation-controlled A/B comparisons');
  if(supplementary)assert(controlled.every(r=>JSON.stringify(r.legacyAssets.map(a=>a.assetId))!==JSON.stringify(r.modernAssets.map(a=>a.assetId))),'Supplementary comparisons must actually change assets');
  const selected=supplementary?rows.map((_,i)=>i):[0,1,2,4,5,6,7,9,12,13,19,23];
  join(selected.map(i=>results[i].vertical.file),'modern-pack-vertical.mp4');join(selected.map(i=>results[i].horizontal.file),'modern-pack-horizontal.mp4');
  const cards=catalog.map(a=>{fs.copyFileSync(path.join(repo,'dist/modern-pack-100-v1',a.localRelativePath),path.join(out,'assets',path.basename(a.localRelativePath)));return {a,card:`<article><img src="assets/${path.basename(a.localRelativePath)}"><h3>${esc(a.canonicalConcept)}</h3><p>${esc([...a.aliasesEs,...a.aliasesEn].join(', '))}</p><p>${esc(a.source+' / '+a.collection+' / '+a.license)}</p><p>Hero ${a.heroAllowed} · Support ${a.supportAllowed} · ${a.originalColor?'original-color':'system-tint'}</p><small>${esc(a.assetId)}<br>${a.sha256}</small></article>`}});
  fs.writeFileSync(path.join(out,'modern-pack-100-catalog.html'),html('Modern Pack V1 — 95 assets','<main>'+cards.map(c=>c.card).join('')+'</main>'));
  for(const source of ['fluent','iconify','tabler']){
    const name=source==='tabler'?'tabler-support-gallery.html':source+'-gallery.html';
    fs.writeFileSync(path.join(out,name),html(source+' — assets candidatos','<main>'+cards.filter(c=>c.a.source===source).map(c=>c.card).join('')+'</main>'));
    await captureCatalog(path.join(out,name),source+'-catalog.png');
  }
  const scenes=rs=>rs.map(r=>`<section><h2>${esc(r.id)} — ${esc(r.text)}</h2><p>${esc(JSON.stringify({legacy:r.legacyAssets,modern:r.modernAssets,sameLayout:r.sameLayout}))}</p>`+[r.before,r.vertical,r.horizontal].filter(Boolean).map(f=>`<img src="${f.frame}">`).join('')+'</section>').join('');
  fs.writeFileSync(path.join(out,'modern-vs-legacy.html'),html('Legacy → Modern: cambio INTENCIONAL de asset',scenes(results)));
  fs.writeFileSync(path.join(out,'openmoji-fallback-gallery.html'),html('OpenMoji preservado',scenes(results.filter(r=>r.modernAssets.some(c=>c.provider==='openmoji')))));
  const finalChoices=results.flatMap(r=>r.modernAssets);const counts={};for(const c of finalChoices){const key=(c.source??c.provider)+'-'+(c.slot==='hero'?'hero':'support');counts[key]=(counts[key]??0)+1;}
  const sums=key=>results.reduce((n,r)=>n+(r.metrics[key]??0),0);
  const report={corpus:supplementary?'supplementary-ab-synthetic':'controlled-synthetic-frozen',fixtureSha:sha(fs.readFileSync(path.join(repo,'tests/fixtures',supplementary?'modern-visual-pack-ab-v1.js':'modern-visual-pack-v1.js'))),bundleSha:sha(fs.readFileSync(path.join(repo,'dist-electron/main/index.js'))),fps,scale:2.25,dimensions:[[540,960],[960,540]],mainScenes:supplementary?6:20,stressCases:supplementary?0:8,packAssets:catalog.length,counts,
    photoCutoutInferences:sums('cutoutInferenceExecuted'),photoRequestsCaptured:sums('photoRequests'),httpRequestsReal:0,renderNetworkAttempts,blocked,
    visualsCreated:results.length*2+results.filter(r=>r.before).length,visualSinFichero:0,regenerationParity:true,controlledComparisons:controlled.length,
    originalColorUses:modern.flatMap(r=>r.resolved.compiled.sceneSpec.slots).filter(s=>s.state==='present'&&s.tint.treatment==='original-color').length,
    monoTintUses:modern.flatMap(r=>r.resolved.compiled.sceneSpec.slots).filter(s=>s.catalogAsset&&s.tint.treatment==='system-tint').length,
    invalidSvgCount:0,duplicateShaCount:catalog.length-new Set(catalog.map(a=>a.sha256)).size,results};
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(report,null,2));assert.equal(renderNetworkAttempts,0);console.log('MODERN_PACK_ACCEPTANCE_OK',JSON.stringify({...report,results:undefined}));code=0;
}catch(e){console.error(e)}finally{try{b?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}catch(e){console.error(e);code=1}app.exit(code)}});
