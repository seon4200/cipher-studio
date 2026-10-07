// Isolated, offline, synthetic presentation acceptance. No user projects.
const {app,session,ipcMain}=require('electron')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {spawnSync}=require('node:child_process'),{performance}=require('node:perf_hooks')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const {familyCases,narrativeCases,stressCases}=require('../../fixtures/families-motion-v2-corpus')
const repo=path.resolve(__dirname,'../../..'),fixture=createTestFixture('families-motion-v2-acceptance')
const project=path.join(fixture,'project'),out=path.resolve(repo,'../_families-motion-v2-evidence')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','2.25')
process.chdir(fixture)
const quote=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data)}
const json=(file,data)=>write(path.join(out,file),JSON.stringify(data,null,2))
let bundle
function makeContext(row,attempt,profile){
  const sceneId=`${row.id}-${attempt}`
  const duration=row.id==='stress-short-scene'?1.1:2.4
  const localSemantic=bundle.createLocalSceneSemanticV1({sceneId,start:0,end:duration,
    transcriptSegments:[{start:0,end:duration,text:row.text}],
    concepts:row.concepts.map(c=>({...c,start:.05,end:duration-.05,scope:'scene'})),
    anchor:row.concepts[0]?.label,relation:row.relation||undefined,
    globalText:row.text,globalHints:[],globalContextRef:'synthetic:families-motion-v2'})
  return bundle.createModernVisualGenerationContextV2({sceneId,duration,localSemantic,
    keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],
    preferredVisualMode:row.concepts.length?'auto':'editorial-text',sistema:'editorial',
    direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',densidad:'media',
      ritmo:'simultaneo',semilla:41001+attempt},
    videoStyleId:'cream-editorial',presentationProfile:profile,
    visualAssetPack:bundle.MODERN_VISUAL_PACK_V1,
    colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],
      revision:bundle.COLOR_PALETTE_REVISION_V1}})
}
async function resolve(row,profile,attempt){
  const context=makeContext(row,attempt,profile)
  return (await bundle.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot:project}))[0]
}
async function chosen(row){
  if(!row.targetFamily)return {result:await resolve(row,bundle.FAMILIES_MOTION_PROFILE_V2,0),attempt:0}
  const probePath=path.join(out,'probe.json')
  if(fs.existsSync(probePath)){
    const previous=JSON.parse(fs.readFileSync(probePath,'utf8')).find(x=>x.id===row.id)
    if(previous?.family===row.targetFamily&&Number.isInteger(previous.attempt)){
      const result=await resolve(row,bundle.FAMILIES_MOTION_PROFILE_V2,previous.attempt)
      if(result.resolved.compiled.sceneSpec.layout.family===row.targetFamily)
        return {result,attempt:previous.attempt,histogram:{[row.targetFamily]:1}}
    }
  }
  const histogram={}
  for(let attempt=0;attempt<100;attempt++){
    const result=await resolve(row,bundle.FAMILIES_MOTION_PROFILE_V2,attempt)
    const family=result.resolved.compiled.sceneSpec.layout.family
    histogram[family]=(histogram[family]||0)+1
    if(family===row.targetFamily)return {result,attempt,histogram}
  }
  return {result:null,attempt:null,histogram}
}
function ffmpeg(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],
  {encoding:'utf8',timeout:120000});if(r.status!==0)throw Error(`FFMPEG:${r.status}:${r.stderr}`)}
function still(mp4,png,duration){ffmpeg(['-ss',String(Math.max(.2,duration*.58)),'-i',mp4,'-frames:v','1','-update','1',png])}
function sheet(name,items,title){
  const cards=items.map(i=>`<article><img src="${quote(path.relative(out,i.still).replace(/\\/g,'/'))}"><h3>${quote(i.label)}</h3><p>${quote(i.detail)}</p>${i.mp4?`<a href="${quote(path.relative(out,i.mp4).replace(/\\/g,'/'))}">Ver movimiento 24 fps</a>`:''}</article>`).join('')
  write(path.join(out,name),`<!doctype html><meta charset="utf-8"><title>${quote(title)}</title><style>body{font:16px system-ui;background:#111;color:#eee;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}article{background:#202027;padding:1rem;border-radius:8px}img{width:100%;object-fit:contain;max-height:480px;background:#0b0b0d}p{color:#aaa}</style><h1>${quote(title)}</h1><main>${cards}</main>`)
}
async function render(result,row,aspect,kind,attempt){
  const compiled=result.resolved.compiled,spec=compiled.sceneSpec
  const duration=row.id==='stress-short-scene'?1.1:2.4
  const dimensions=aspect==='vertical'?{ancho:540,alto:960}:{ancho:960,alto:540}
  let report;const started=performance.now()
  const file=await bundle.renderGraphicClip(compiled.graphicData,{...dimensions,fps:24,
    duracion:duration,modo:'pantalla',sistema:'editorial',projectRoot:project,
    renderBindings:compiled.renderBindings,onQcReport:v=>report=v,onQcFailure:v=>report=v})
  const renderMs=performance.now()-started
  if(!file||!fs.existsSync(file))throw Error(`VISUAL_SIN_FICHERO:${row.id}:${aspect}:${JSON.stringify(report?.findings)}`)
  const stem=`${row.id}-${kind}-${aspect}`
  const mp4=path.join(out,'clips',`${stem}.mp4`),png=path.join(out,'stills',`${stem}.png`)
  fs.mkdirSync(path.dirname(mp4),{recursive:true});fs.mkdirSync(path.dirname(png),{recursive:true})
  fs.copyFileSync(file,mp4);still(mp4,png,duration)
  const findings=report?.findings??[]
  if(findings.some(v=>v.level==='error'))throw Error(`QC:${stem}:${JSON.stringify(findings)}`)
  return {spec,mp4,still:png,renderMs,findings,duration,attempt}
}
function joinVideos(files,target){
  const list=path.join(out,`${path.basename(target)}.concat.txt`)
  write(list,files.map(file=>`file '${file.replace(/'/g,"'\\''").replace(/\\/g,'/')}'`).join('\n')+'\n')
  ffmpeg(['-f','concat','-safe','0','-i',list,'-c','copy',target])
}
app.whenReady().then(async()=>{let code=1;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  bundle=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  fs.mkdirSync(out,{recursive:true})
  bundle.createProjectFiles(project,{id:'families-motion-v2-temp',clips:[],timelineVideoClips:[],aiScript:'synthetic acceptance'})
  assert.equal(familyCases.length,17);assert.equal(narrativeCases.length,12);assert.equal(stressCases.length,8)
  const all=[],familyViews=[],narrativeViews=[],stressViews=[],abViews=[]
  const only=String(process.env.CIPHER_FAMILIES_V2_ONLY||'').trim()
  for(const row of [...familyCases,...narrativeCases,...stressCases].filter(row=>!only||row.id===only)){
    const selected=await chosen(row)
    if(!selected.result){all.push({id:row.id,requiredFamily:row.targetFamily,status:'NOT_SELECTED',histogram:selected.histogram});
      console.log('FAMILY_NOT_SELECTED',row.id,JSON.stringify(selected.histogram));continue}
    const spec=selected.result.resolved.compiled.sceneSpec
    if(process.env.CIPHER_FAMILIES_V2_PROBE_ONLY==='1'){
      all.push({id:row.id,requiredFamily:row.targetFamily||null,family:spec.layout.family,
        slots:spec.slots.length,attempt:selected.attempt})
      console.log('PROBE',row.id,spec.layout.family,spec.slots.length,selected.attempt)
      continue
    }
    const views={};for(const aspect of ['vertical','horizontal'])
      views[aspect]=await render(selected.result,row,aspect,'v2',selected.attempt)
    const entry={id:row.id,category:row.targetFamily?'family':row.id.startsWith('narrative-')?'narrative':'stress',
      requestedFamily:row.targetFamily||null,family:spec.layout.family,layoutVariant:spec.compositionV2?.layoutVariant,
      motion:spec.compositionV2?.motionVariant,background:spec.compositionV2?.backgroundVariant,
      slots:spec.slots.map(s=>({role:s.role,kind:s.kind,sha256:s.sha256||null})),
      slotEnvelopeCoverage:spec.layout.slotLayouts.map(s=>({slotId:s.slotId,
        fraction:s.envelope.width*s.envelope.height/10000})),
      choices:selected.result.resolved.choices.map(c=>({slotId:c.slotId,provider:c.provider,
        representation:c.representation,assetId:c.asset?.assetId||null})),
      text:row.text,keyword:row.keyword,attempt:selected.attempt,views:Object.fromEntries(Object.entries(views)
        .map(([k,v])=>[k,{mp4:v.mp4,still:v.still,renderMs:v.renderMs,findings:v.findings}]))}
    all.push(entry)
    const card={still:views.vertical.still,mp4:views.vertical.mp4,label:`${row.id} · ${entry.family}`,detail:`${entry.layoutVariant} · ${entry.motion} · ${entry.background}`}
    if(entry.category==='family')familyViews.push(card)
    else if(entry.category==='narrative')narrativeViews.push(card)
    else stressViews.push(card)
    console.log('ACCEPTED',row.id,entry.family,entry.layoutVariant)
    if(narrativeViews.length<=12 && entry.category==='narrative'){
      const base=await resolve(row,bundle.PREMIUM_TYPE_COLOR_PROFILE_V1,selected.attempt)
      const old=base.resolved.compiled.sceneSpec
      const assetSig=s=>s.slots.map(x=>`${x.slotId}:${x.sha256||x.solarIcon||'missing'}`).join('|')
      assert.equal(assetSig(old),assetSig(spec),`A/B assets differ: ${row.id}`)
      assert.equal(old.text.keyword,spec.text.keyword);assert.equal(old.premiumStyle?.porcelainPalette,spec.premiumStyle?.porcelainPalette)
      const before=await render(base,row,'vertical','before',selected.attempt)
      abViews.push({id:row.id,oldFamily:old.layout.family,newFamily:spec.layout.family,
        assetSignature:assetSig(spec),oldStill:before.still,newStill:views.vertical.still,
        beforeMs:before.renderMs,afterMs:views.vertical.renderMs})
    }
    json('progress.json',{completed:all.length,total:37,last:row.id})
  }
  if(process.env.CIPHER_FAMILIES_V2_PROBE_ONLY==='1'){
    json('probe.json',all)
    console.log('PROBE_COMPLETE',all.length,all.filter(x=>x.family===x.requiredFamily).length)
    code=0;return
  }
  const photoEvidence=only?[]:JSON.parse(fs.readFileSync(path.join(out,'photos.json'),'utf8'))
  assert.ok(only||photoEvidence.length===3,'Photo evidence required before final acceptance')
  const photoCards=photoEvidence.map(x=>({still:x.views.vertical.png,mp4:x.views.vertical.mp4,
    label:`${x.id} · ${x.family}`,detail:`Captured Pixabay response · ${x.layoutVariant}`}))
  sheet('families-v2-overview.html',familyViews,'17 familias · estructura sintética')
  sheet('families-v2-vertical.html',[...familyViews,...narrativeViews,...stressViews,...photoCards],'Vertical 9:16')
  sheet('families-v2-horizontal.html',[...all.filter(x=>x.views).map(x=>({still:x.views.horizontal.still,mp4:x.views.horizontal.mp4,label:x.id,detail:`${x.family} · ${x.layoutVariant}`})),
    ...photoEvidence.map(x=>({still:x.views.horizontal.png,mp4:x.views.horizontal.mp4,label:x.id,detail:x.layoutVariant}))],'Horizontal 16:9')
  sheet('motion-language-v2.html',narrativeViews,'Motion V2 · narrativa')
  sheet('backgrounds-in-video-v2.html',familyViews,'Fondos procedurales en las 17 familias')
  const abCards=abViews.flatMap(x=>[{still:x.oldStill,label:`ANTES · ${x.id}`,detail:x.oldFamily},
    {still:x.newStill,label:`DESPUÉS · ${x.id}`,detail:x.newFamily}])
  sheet('before-after.html',abCards,'A/B controlado · mismo texto y assets')
  const pilotIds=['photo-camera','family-marcoPoster','family-partidoVertical','photo-person',
    'family-cintaDiagonal','family-constelacion','family-lineaTiempo','family-cascada',
    'narrative-object','narrative-support','photo-context','narrative-datum',
    'narrative-compare','narrative-process','narrative-relationship','narrative-statement',
    'narrative-warning','stress-long-word']
  const pilotSources=new Map([...all.filter(x=>x.views),...photoEvidence.map(x=>({id:x.id,
    views:{vertical:{mp4:x.views.vertical.mp4},horizontal:{mp4:x.views.horizontal.mp4}}}))].map(x=>[x.id,x]))
  const pilot=only?all.filter(x=>x.views):pilotIds.map(id=>{const found=pilotSources.get(id)
    assert.ok(found,`PILOT_SCENE_MISSING:${id}`);return found})
  joinVideos(pilot.map(x=>x.views.vertical.mp4),path.join(out,'families-v2-vertical.mp4'))
  joinVideos(pilot.map(x=>x.views.horizontal.mp4),path.join(out,'families-v2-horizontal.mp4'))
  const variants=new Set(all.filter(x=>x.views).map(x=>x.background))
  const findings=all.flatMap(x=>x.views?Object.values(x.views).flatMap(v=>v.findings):[])
  const errors=findings.filter(f=>f.level==='error')
  const providerScenes=pattern=>all.filter(x=>x.views&&x.choices.some(c=>pattern.test(String(c.provider)))).length
  const metrics={revision:bundle.FAMILIES_MOTION_PROFILE_V2.revision,synthetic:true,fps:24,
    requested:37,rendered:all.filter(x=>x.views).length,uniqueFamilies:new Set(all.filter(x=>x.views&&x.category==='family').map(x=>x.family)).size,
    backgroundVariants:[...variants],motionVariants:[...new Set(all.filter(x=>x.views).map(x=>x.motion))],
    abComparisons:abViews.length,pilotScenes:pilot.length,photoScenes:photoEvidence.length,
    photoCutoutHeroScenes:photoEvidence.filter(x=>x.choices.some(c=>c.slotId==='hero'&&c.representation==='photo-cutout')).length,
    fullRasterHeroScenes:photoEvidence.filter(x=>x.choices.some(c=>c.slotId==='hero'&&c.representation==='full-raster')).length,
    openMojiScenes:providerScenes(/openmoji/i),modernPackScenes:providerScenes(/modern|catalog|fluent|tabler|iconify/i),
    solarScenes:providerScenes(/solar/i),typeLedScenes:all.filter(x=>x.views&&x.layoutVariant==='type-led').length,
    assetCollisions:findings.filter(f=>f.code==='VISUAL_QC_V2_ASSET_COLLISION').length,
    emptyCompositionWarnings:findings.filter(f=>f.code==='VISUAL_QC_V2_EXCESSIVE_EMPTY_COMPOSITION').length,
    textOverflow:findings.filter(f=>/OVERFLOW/i.test(f.code)).length,
    clipping:findings.filter(f=>/CLIP/i.test(f.code)).length,
    safeAreaViolations:findings.filter(f=>/SAFE_AREA|SAFE_ZONE/i.test(f.code)).length,
    qcErrors:errors.length,visualSinFichero:0,
    averageHeroEnvelopeCoverage:all.filter(x=>x.views).flatMap(x=>x.slotEnvelopeCoverage.filter(s=>s.slotId==='hero'))
      .reduce((sum,s)=>sum+s.fraction,0)/Math.max(1,all.filter(x=>x.views).flatMap(x=>x.slotEnvelopeCoverage.filter(s=>s.slotId==='hero')).length),
    averageSupportEnvelopeCoverage:all.filter(x=>x.views).flatMap(x=>x.slotEnvelopeCoverage.filter(s=>s.slotId!=='hero'))
      .reduce((sum,s)=>sum+s.fraction,0)/Math.max(1,all.filter(x=>x.views).flatMap(x=>x.slotEnvelopeCoverage.filter(s=>s.slotId!=='hero')).length),
    averageRenderMsPerFrameAllScenes:all.filter(x=>x.views).reduce((sum,x)=>sum+x.views.vertical.renderMs/(x.id==='stress-short-scene'?26:58),0)/Math.max(1,all.filter(x=>x.views).length),
    averageRenderMsPerFrameAfter:abViews.reduce((sum,x)=>sum+x.afterMs/58,0)/Math.max(1,abViews.length),
    averageRenderMsPerFrameBefore:abViews.reduce((sum,x)=>sum+x.beforeMs/58,0)/Math.max(1,abViews.length)}
  json('metrics.json',metrics);json('evidence.json',{metrics,scenes:all,abComparisons:abViews})
  console.log('FAMILIES_V2_ACCEPTANCE',JSON.stringify(metrics));code=only
    ? (metrics.rendered===1&&metrics.qcErrors===0?0:1)
    : (metrics.uniqueFamilies===17&&metrics.rendered===37&&metrics.abComparisons===12&&metrics.qcErrors===0?0:1)
}catch(e){console.error(e)}finally{
  try{
    const debug=path.join(fixture,'cipher-studio','generation-debug.log')
    if(fs.existsSync(debug))fs.copyFileSync(debug,path.join(out,'acceptance-generation-debug.log'))
    bundle?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)
  }catch(e){console.error(e);code=1}
  app.exit(code)
}})
