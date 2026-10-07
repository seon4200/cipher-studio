// Synthetic, isolated, art-directed A/B using the productive V15 resolver/ProjectAsset/render path.
const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process'),{performance}=require('node:perf_hooks')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const rows=require('../../fixtures/editorial-explainer-light-v2-corpus')
const candidates=require('../../fixtures/editorial-explainer-light-v2-candidates')
const repo=path.resolve(__dirname,'../../..'),fixture=createTestFixture('light-v2-demo')
const project=path.join(fixture,'project')
const external=path.resolve(repo,'../_editorial-explainer-light-v2-assets')
const out=path.resolve(repo,'../_editorial-explainer-light-v2-evidence',
  `run-${new Date().toISOString().replace(/[-:]/g,'').replace(/\..*/, '').replace('T','-')}`)
process.env.CIPHER_VISUAL_LIBRARY_PATH=path.join(external,'local-library-lucide')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const quote=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data)}
function ff(args,timeout=300000){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],
  {encoding:'utf8',timeout});if(r.status!==0)throw Error(`FFMPEG:${r.status}:${r.error?.message||r.stderr}`)}
function still(mp4,t,png){fs.mkdirSync(path.dirname(png),{recursive:true});ff(['-ss',String(t),'-i',mp4,'-frames:v','1','-update','1',png])}
function join(files,target){const list=path.join(out,`${path.basename(target)}.concat.txt`)
  write(list,files.map(file=>`file '${file.replace(/'/g,"'\\''").replace(/\\/g,'/')}'`).join('\n')+'\n')
  ff(['-f','concat','-safe','0','-i',list,'-c','copy',target])}
function context(b,row,i,profile,locks){const sceneId=`light-v2-${row.id}`,duration=row.duration
  const localSemantic=b.createLocalSceneSemanticV1({sceneId,start:0,end:duration,
    transcriptSegments:[{start:0,end:duration,text:row.text}],
    concepts:row.concepts.map(c=>({...c,start:.03,end:duration-.03,scope:'scene'})),
    anchor:row.concepts[0]?.label,relation:row.relation,globalText:row.text,
    globalHints:[],globalContextRef:'synthetic:editorial-explainer-light-v2'})
  return b.createModernVisualGenerationContextV2({sceneId,duration,localSemantic,
    keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],preferredVisualMode:row.mode||'auto',
    sistema:'editorial',direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',
      densidad:'media',ritmo:'simultaneo',semilla:62001+i},videoStyleId:'cream-editorial',
    presentationProfile:profile,visualAssetPack:{...b.MODERN_VISUAL_PACK_V1,localLibrary:true},
    ...(locks?.length?{lockedChoices:locks}:{}),
    colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],revision:b.COLOR_PALETTE_REVISION_V1}})}
function locksFor(b,row,catalog){const locks=[]
  if(row.hero){
    const file=path.join(external,'heroes',row.hero+'.png'),bytes=fs.readFileSync(file)
    const published=b.publishRasterProjectAssetV1({projectRoot:project,provider:'editorial-pilot-raster',
      assetId:`editorial-pilot-${row.hero}`,bytes,requireUsefulAlpha:true,
      source:{providerVersion:'synthetic-pilot-v2',attribution:'Original AI-generated pilot image; not a retrieved photograph'},
      validationRevision:'editorial-pilot-raster-v1'})
    const asset=published.asset
    locks.push({slotId:'hero',concept:row.concepts[0].label,provider:'editorial-pilot-raster',
      representation:'photo-cutout',reason:'EXPLICIT_PILOT_ART_DIRECTION:AI_RASTER',score:3,
      assetId:asset.id,relativeFile:asset.relativeFile,sha256:asset.sha256,mime:asset.mime,
      bounds:b.subjectBoundsFromPixabayRasterV1(bytes),kind:'photo-cutout',alphaMode:'useful-alpha'})
  }
  for(const [i,name] of (row.supports||[]).entries()){
    const slotId=i?'support-2':'support-1',concept=row.concepts[i+1]?.label||name
    const entry=catalog.getById(`local-editorial-light-${name}`)
    assert(entry&&entry.origin==='local'&&entry.asset.canonicalConcept===name&&entry.asset.supportAllowed,
      `LOCAL_SUPPORT_MISMATCH:${name}`)
    const asset=b.publishModernVisualPackAssetV1(project,entry.asset.assetId,catalog).asset
    locks.push({slotId,concept,provider:'modern-pack',catalogAsset:entry.identity,originalColor:false,
      representation:'icon',reason:'EXPLICIT_PILOT_ART_DIRECTION:EXACT_CURATED_LOCAL',score:3,
      assetId:asset.id,relativeFile:asset.relativeFile,sha256:asset.sha256,mime:asset.mime,
      bounds:b.fullSubjectBounds(),kind:'simple-icon',alphaMode:'vector'})
  }
  return locks
}
async function render(b,result,row,aspect,profile){const compiled=result.resolved.compiled
  const size=aspect==='vertical'?{ancho:720,alto:1280}:{ancho:1280,alto:720}
  let qc;const start=performance.now()
  const file=await b.renderGraphicClip(compiled.graphicData,{...size,fps:24,duracion:row.duration,
    modo:'pantalla',sistema:'editorial',projectRoot:project,renderBindings:compiled.renderBindings,
    onQcReport:v=>qc=v,onQcFailure:v=>qc=v})
  assert(file&&fs.existsSync(file),`VISUAL_SIN_FICHERO:${row.id}:${aspect}:${JSON.stringify(qc?.findings)}`)
  assert.equal(qc?.findings?.filter(f=>f.level==='error').length,0,JSON.stringify(qc?.findings))
  const stem=`${row.id}-${profile}-${aspect}`,mp4=path.join(out,'clips',stem+'.mp4')
  fs.mkdirSync(path.dirname(mp4),{recursive:true});fs.copyFileSync(file,mp4)
  const keyframes={}
  for(const [key,t] of Object.entries({entry:.42,stable:row.duration*.55,exit:row.duration-.28})){
    const png=path.join(out,'keyframes',stem+'-'+key+'.png');still(mp4,t,png);keyframes[key]=png
  }
  return {id:row.id,profile,aspect,mp4,keyframes,duration:row.duration,
    renderMs:performance.now()-start,qc:qc.findings,identity:b.sceneSpecPixelIdentityAny(compiled.sceneSpec),
    sceneSpec:compiled.sceneSpec,bindings:compiled.renderBindings}
}
function contact(results){const cards=results.filter(r=>r.aspect==='vertical').map(r=>
  `<article><img src="${quote(path.relative(out,r.keyframes.stable).replace(/\\/g,'/'))}"><p>${quote(r.id)} · ${quote(r.profile)}</p></article>`).join('')
  const keyframes=results.filter(r=>r.profile==='v2').flatMap(r=>Object.entries(r.keyframes).map(([phase,png])=>
    `<article><img src="${quote(path.relative(out,png).replace(/\\/g,'/'))}"><p>${quote(r.id)} · ${quote(r.aspect)} · ${phase}</p></article>`)).join('')
  write(path.join(out,'pilot-v1-v2-comparison.html'),`<!doctype html><meta charset="utf-8"><title>Light V1 vs V2 — mismo texto/asset</title><style>body{background:#171717;color:#f4f2ed;font:16px Arial;padding:2rem}main{display:grid;grid-template-columns:repeat(2,minmax(270px,1fr));gap:1rem}article{background:#282828;padding:1rem}img{width:100%;max-height:620px;object-fit:contain;background:#fff}</style><h1>V1 / V2 — seis escenas sintéticas, mismos assets</h1><main>${cards}</main>`)
  write(path.join(out,'keyframes.html'),`<!doctype html><meta charset="utf-8"><title>Light V2 keyframes</title><style>body{background:#171717;color:#f4f2ed;font:16px Arial;padding:2rem}main{display:grid;grid-template-columns:repeat(3,minmax(240px,1fr));gap:1rem}article{background:#282828;padding:1rem}img{width:100%;max-height:480px;object-fit:contain;background:#fff}</style><h1>Entrada / lectura / salida</h1><main>${keyframes}</main>`)
  const stills=rows.map(row=>results.find(r=>r.id===row.id&&r.profile==='v2'&&r.aspect==='vertical').keyframes.stable)
  const inputs=stills.flatMap(file=>['-i',file])
  const scales=stills.map((_,i)=>`[${i}:v]scale=270:480[v${i}]`).join(';')
  const stacked=stills.map((_,i)=>`[v${i}]`).join('')
  ff([...inputs,'-filter_complex',`${scales};${stacked}xstack=inputs=6:layout=0_0|270_0|540_0|0_480|270_480|540_480[out]`,
    '-map','[out]','-frames:v','1','-update','1',path.join(out,'light-v2-contact-sheet.png')])
}
app.whenReady().then(async()=>{let code=1,b;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  b=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  assert.equal(rows.length,6);assert.equal(rows.reduce((n,r)=>n+r.duration,0),20)
  assert.deepEqual([candidates.heroes.length,candidates.supports.length,candidates.utilities.length],[4,8,4])
  b.createProjectFiles(project,{id:'light-v2-demo',clips:[],timelineVideoClips:[],aiScript:'synthetic pilot'})
  const catalog=b.createCompositeVisualCatalogV1(process.env.CIPHER_VISUAL_LIBRARY_PATH)
  assert(catalog.diagnostics.some(d=>d.code==='LOCAL_CATALOG_READY'))
  assert.equal(catalog.entries().filter(e=>e.origin==='local').length,12)
  const results=[],assetSignatures=[]
  const lockedByScene=rows.map(row=>locksFor(b,row,catalog))
  const v2Batch=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((row,i)=>
    context(b,row,i,b.EDITORIAL_EXPLAINER_LIGHT_V2,lockedByScene[i])),projectRoot:project})
  const v2Replay=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((row,i)=>
    context(b,row,i,b.EDITORIAL_EXPLAINER_LIGHT_V2,lockedByScene[i])),projectRoot:project})
  const v1Batch=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((row,i)=>
    context(b,row,i,b.EDITORIAL_EXPLAINER_LIGHT_V1,lockedByScene[i])),projectRoot:project})
  for(let i=0;i<rows.length;i++){
    const row=rows[i],v2=v2Batch[i],v1=v1Batch[i]
    const sig=spec=>spec.slots.map(s=>`${s.slotId}:${s.sha256||s.solarIcon||s.state}`).join('|')
    assert.equal(sig(v1.resolved.compiled.sceneSpec),sig(v2.resolved.compiled.sceneSpec),`A/B asset drift:${row.id}`)
    assert.equal(v1.context.localSemantic.localText,v2.context.localSemantic.localText)
    assert.equal(b.sceneSpecPixelIdentityAny(v2.resolved.compiled.sceneSpec),
      b.sceneSpecPixelIdentityAny(v2Replay[i].resolved.compiled.sceneSpec),`REGENERATION_DRIFT:${row.id}`)
    assert.equal(v2.resolved.compiled.sceneSpec.lightStyle.revision,b.EDITORIAL_EXPLAINER_LIGHT_V2.revision)
    const visible=v2.resolved.compiled.sceneSpec.text
    assert.equal([visible.connector,visible.keyword,visible.closing].filter(Boolean).join(' ').toLocaleLowerCase('es'),
      row.text.toLocaleLowerCase('es'),`NARRATION_TEXT_LOST:${row.id}`)
    assert(v2.resolved.compiled.sceneSpec.slots.filter(s=>s.state==='present'||s.state==='procedural').length<=3)
    if(row.confirmedValue)assert.equal(v2.resolved.compiled.sceneSpec.lightStyle.dataRepeater?.confirmedValue,row.confirmedValue)
    assetSignatures.push({id:row.id,signature:sig(v2.resolved.compiled.sceneSpec)})
    results.push(await render(b,v1,row,'vertical','v1'))
    results.push(await render(b,v2,row,'vertical','v2'))
    results.push(await render(b,v2,row,'horizontal','v2'))
    write(path.join(out,'progress.json'),JSON.stringify({completed:i+1,total:rows.length,last:row.id},null,2))
  }
  for(const aspect of ['vertical','horizontal'])join(rows.map(row=>results.find(r=>r.id===row.id&&r.profile==='v2'&&r.aspect===aspect).mp4),
    path.join(out,`editorial-explainer-light-v2-${aspect}.mp4`))
  contact(results)
  const runtimeLog=path.join(fixture,'cipher-studio','generation-debug.log')
  if(fs.existsSync(runtimeLog))assert(!/FUENTE AUSENTE|fonts\.load lanzo/iu.test(fs.readFileSync(runtimeLog,'utf8')),
    'FONT_FALLBACK_OR_LOAD_FAILURE')
  const summary={synthetic:true,artDirectedAssetSelection:true,notAutomaticRasterRetrieval:true,durationSeconds:20,fps:24,
    localCatalogCount:12,rasterHeroCount:4,assetSignatures,visualSinFichero:0,
    qcErrors:results.flatMap(r=>r.qc).filter(f=>f.level==='error').length,
    results:results.map(({sceneSpec,bindings,...r})=>({...r,sceneSpec,bindings}))}
  write(path.join(out,'evidence.json'),JSON.stringify(summary,null,2))
  console.log('LIGHT_V2_EVIDENCE',out)
  console.log('LIGHT_V2_ACCEPTANCE',JSON.stringify({scenes:rows.length,duration:20,files:results.length,
    qcErrors:summary.qcErrors,vertical:path.join(out,'editorial-explainer-light-v2-vertical.mp4'),
    horizontal:path.join(out,'editorial-explainer-light-v2-horizontal.mp4')}))
  code=0
}catch(e){console.error(e.stack||e);console.error('LIGHT_V2_EVIDENCE_PARTIAL',out)}finally{
  try{b?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}catch(e){console.error(e.stack||e);code=1}
  app.exit(code)}})
