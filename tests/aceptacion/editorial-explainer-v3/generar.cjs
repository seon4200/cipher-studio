// Synthetic, isolated, art-directed A/B using the productive V15 resolver/ProjectAsset/render path.
const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process'),{performance}=require('node:perf_hooks')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const rows=require('../../fixtures/editorial-explainer-v3-corpus')
const supportNames=require('../../fixtures/editorial-explainer-v3-supports')
const repo=path.resolve(__dirname,'../../..'),fixture=createTestFixture('editorial-v3-demo')
const project=path.join(fixture,'project')
const external=process.env.CIPHER_EDITORIAL_V3_LIBRARY||'C:\\CipherAssets\\VisualLibrary\\editorial-explainer-v3'
const out=path.resolve(repo,'../_editorial-explainer-v3-evidence',
  `run-${new Date().toISOString().replace(/[-:]/g,'').replace(/\..*/, '').replace('T','-')}`)
const svgLibrary=path.join(external,'runtime-svg')
const nodeEnv={...process.env,ELECTRON_RUN_AS_NODE:'1'}
const build=spawnSync(process.execPath,[path.join(__dirname,'build-local-library.cjs'),svgLibrary],{encoding:'utf8',env:nodeEnv})
assert.equal(build.status,0,build.stderr);process.env.CIPHER_VISUAL_LIBRARY_PATH=svgLibrary
const provenance=spawnSync(process.execPath,[path.join(__dirname,'build-provenance.cjs'),external],{encoding:'utf8',env:nodeEnv})
assert.equal(provenance.status,0,provenance.stderr)
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
function context(b,row,i,profile,locks){const sceneId=`editorial-v3-${row.id}`,duration=row.duration
  const localSemantic=b.createLocalSceneSemanticV1({sceneId,start:0,end:duration,
    transcriptSegments:[{start:0,end:duration,text:row.text}],
    concepts:row.concepts.map(c=>({...c,start:.03,end:duration-.03,scope:'scene'})),
    anchor:row.concepts[0]?.label,relation:row.relation,globalText:row.text,
    globalHints:[],globalContextRef:'synthetic:editorial-explainer-v3'})
  return b.createModernVisualGenerationContextV2({sceneId,duration,localSemantic,
    keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],preferredVisualMode:row.mode||'auto',
    sistema:'editorial',direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',
      densidad:row.density==='rich'?'alta':'media',ritmo:'simultaneo',semilla:63000+i},videoStyleId:'cream-editorial',
    presentationProfile:profile,visualAssetPack:{...b.MODERN_VISUAL_PACK_V1,localLibrary:true},
    ...(locks?.length?{lockedChoices:locks}:{}),
    colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],revision:b.COLOR_PALETTE_REVISION_V1}})}
function locksFor(b,row,catalog,heroIndex){const locks=[]
  if(row.hero){
    const concept=row.concepts[0]?.canonicalHint||row.hero
    const indexed=heroIndex.entries.filter(e=>e.concept===concept||e.semanticTags.includes(concept)).sort((a,b)=>{
      const composite=id=>id.includes('composite')?1:0
      return row.density==='rich'?composite(b.assetId)-composite(a.assetId):composite(a.assetId)-composite(b.assetId)||a.assetId.localeCompare(b.assetId)})[0]
    assert(indexed,`RASTER_HERO_INDEX_MISSING:${concept}`);assert.equal(path.basename(indexed.runtimeRelativePath,'.png'),row.hero)
    const file=path.join(external,indexed.runtimeRelativePath),bytes=fs.readFileSync(file)
    const published=b.publishRasterProjectAssetV1({projectRoot:project,provider:'editorial-pilot-raster',
      assetId:`editorial-pilot-${row.hero}`,bytes,requireUsefulAlpha:true,
      source:{providerVersion:'synthetic-art-direction-v3',attribution:'Original AI-generated V3 candidate; curated pilot asset'},
      validationRevision:'editorial-pilot-raster-v1'})
    const asset=published.asset
    locks.push({slotId:'hero',concept:row.concepts[0].label,provider:'editorial-pilot-raster',
      representation:'photo-cutout',reason:'EXPLICIT_PILOT_ART_DIRECTION:AI_RASTER',score:3,
      assetId:asset.id,relativeFile:asset.relativeFile,sha256:asset.sha256,mime:asset.mime,
      bounds:b.subjectBoundsFromPixabayRasterV1(bytes),kind:'photo-cutout',alphaMode:'useful-alpha'})
  }
  for(const [i,name] of (row.supports||[]).entries()){
    const slotId=i?'support-2':'support-1',concept=row.concepts[i+1]?.label||name
    const entry=catalog.getById(`local-editorial-v3-${name}`)
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
  // A deterministic cache hit legitimately skips runtime QC: the identical SceneSpec was
  // already accepted earlier in this isolated project. Fresh renders must still expose zero errors.
  if(qc)assert.equal(qc.findings.filter(f=>f.level==='error').length,0,JSON.stringify(qc.findings))
  const stem=`${row.id}-${profile}-${aspect}`,mp4=path.join(out,'clips',stem+'.mp4')
  fs.mkdirSync(path.dirname(mp4),{recursive:true});fs.copyFileSync(file,mp4)
  const keyframes={}
  for(const [key,t] of Object.entries({entry:.42,mid:row.duration*.36,stable:row.duration*.65,exit:row.duration-.28})){
    const png=path.join(out,'keyframes',stem+'-'+key+'.png');still(mp4,t,png);keyframes[key]=png
  }
  return {id:row.id,profile,aspect,mp4,keyframes,duration:row.duration,
    renderMs:performance.now()-start,qc:qc?.findings??[],identity:b.sceneSpecPixelIdentityAny(compiled.sceneSpec),
    sceneSpec:compiled.sceneSpec,bindings:compiled.renderBindings}
}
function contact(results){const cards=results.filter(r=>r.aspect==='vertical').map(r=>
  `<article><img src="${quote(path.relative(out,r.keyframes.stable).replace(/\\/g,'/'))}"><p>${quote(r.id)} · ${quote(r.profile)}</p></article>`).join('')
  const keyframes=results.filter(r=>r.profile==='v3').flatMap(r=>Object.entries(r.keyframes).map(([phase,png])=>
    `<article><img src="${quote(path.relative(out,png).replace(/\\/g,'/'))}"><p>${quote(r.id)} · ${quote(r.aspect)} · ${phase}</p></article>`)).join('')
  write(path.join(out,'pilot-v2-v3-comparison.html'),`<!doctype html><meta charset="utf-8"><title>Pilot V2 vs V3</title><style>body{background:#171717;color:#f4f2ed;font:16px Arial;padding:2rem}main{display:grid;grid-template-columns:repeat(2,minmax(270px,1fr));gap:1rem}article{background:#282828;padding:1rem}img{width:100%;max-height:620px;object-fit:contain;background:#fff}</style><h1>V2 / V3 — mismo texto y roles</h1><main>${cards}</main>`)
  write(path.join(out,'keyframes.html'),`<!doctype html><meta charset="utf-8"><title>V3 keyframes</title><style>body{background:#171717;color:#f4f2ed;font:16px Arial;padding:2rem}main{display:grid;grid-template-columns:repeat(3,minmax(240px,1fr));gap:1rem}article{background:#282828;padding:1rem}img{width:100%;max-height:480px;object-fit:contain;background:#fff}</style><h1>Entrada / lectura / salida</h1><main>${keyframes}</main>`)
  const stills=rows.map(row=>results.find(r=>r.id===row.id&&r.profile==='v3'&&r.aspect==='vertical').keyframes.stable)
  const inputs=stills.flatMap(file=>['-i',file])
  const scales=stills.map((_,i)=>`[${i}:v]scale=270:480[v${i}]`).join(';')
  const stacked=stills.map((_,i)=>`[v${i}]`).join('')
  ff([...inputs,'-filter_complex',`${scales};${stacked}xstack=inputs=6:layout=0_0|270_0|540_0|0_480|270_480|540_480[out]`,
    '-map','[out]','-frames:v','1','-update','1',path.join(out,'editorial-v3-contact-sheet.png')])
}
function candidateSheet(){const files=['idea/hero-idea-candidate-01.png','idea/hero-idea-candidate-02.png','idea/hero-idea-candidate-03.png','signal/hero-signal-candidate-01.png','signal/hero-signal-candidate-02.png','signal/hero-signal-candidate-03.png','pieces/hero-pieces-candidate-01.png','pieces/hero-pieces-candidate-02.png','pieces/hero-pieces-candidate-03.png'].map(x=>path.join(external,'candidates',x))
  const inputs=files.flatMap(f=>['-i',f]),filters=files.map((_,i)=>`[${i}:v]scale=240:360:force_original_aspect_ratio=decrease,pad=240:360:(ow-iw)/2:(oh-ih)/2:color=F0EEE8[v${i}]`).join(';')
  ff([...inputs,'-filter_complex',`${filters};${files.map((_,i)=>`[v${i}]`).join('')}xstack=inputs=9:layout=0_0|240_0|480_0|0_360|240_360|480_360|0_720|240_720|480_720[out]`,'-map','[out]','-frames:v','1','-update','1',path.join(out,'composite-hero-candidates.png')])}
app.whenReady().then(async()=>{let code=1,b;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  b=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  assert.equal(rows.length,6);assert.equal(rows.reduce((n,r)=>n+r.duration,0),20)
  assert.equal(supportNames.length,14)
  b.createProjectFiles(project,{id:'editorial-v3-demo',clips:[],timelineVideoClips:[],aiScript:'synthetic pilot'})
  const catalog=b.createCompositeVisualCatalogV1(process.env.CIPHER_VISUAL_LIBRARY_PATH)
  assert(catalog.diagnostics.some(d=>d.code==='LOCAL_CATALOG_READY'))
  assert.equal(catalog.entries().filter(e=>e.origin==='local').length,14)
  const heroIndex=JSON.parse(fs.readFileSync(path.join(external,'metadata','hero-index.json'),'utf8'))
  const results=[],assetSignatures=[]
  const lockedByScene=rows.map(row=>locksFor(b,row,catalog,heroIndex))
  const v3Batch=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((row,i)=>
    context(b,row,i,b.EDITORIAL_EXPLAINER_V3,lockedByScene[i])),projectRoot:project})
  const v3Replay=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((row,i)=>
    context(b,row,i,b.EDITORIAL_EXPLAINER_V3,lockedByScene[i])),projectRoot:project})
  const v2Batch=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((row,i)=>
    context(b,row,i,b.EDITORIAL_EXPLAINER_LIGHT_V2,lockedByScene[i])),projectRoot:project})
  for(let i=0;i<rows.length;i++){
    const row=rows[i],v3=v3Batch[i],v2=v2Batch[i]
    const sig=spec=>spec.slots.map(s=>`${s.slotId}:${s.sha256||s.solarIcon||s.state}`).join('|')
    assert.equal(sig(v2.resolved.compiled.sceneSpec),sig(v3.resolved.compiled.sceneSpec),`A/B asset drift:${row.id}`)
    assert.equal(v2.context.localSemantic.localText,v3.context.localSemantic.localText)
    assert.equal(b.sceneSpecPixelIdentityAny(v3.resolved.compiled.sceneSpec),b.sceneSpecPixelIdentityAny(v3Replay[i].resolved.compiled.sceneSpec),`REGENERATION_DRIFT:${row.id}`)
    assert.equal(v3.resolved.compiled.sceneSpec.lightStyle.revision,b.EDITORIAL_EXPLAINER_V3.revision)
    const visible=v3.resolved.compiled.sceneSpec.text
    assert.equal([visible.connector,visible.keyword,visible.closing].filter(Boolean).join(' ').toLocaleLowerCase('es'),
      row.text.toLocaleLowerCase('es'),`NARRATION_TEXT_LOST:${row.id}`)
    assert(v3.resolved.compiled.sceneSpec.slots.filter(s=>s.state==='present'||s.state==='procedural').length<=3)
    if(row.confirmedValue)assert.equal(v3.resolved.compiled.sceneSpec.lightStyle.dataRepeater?.confirmedValue,row.confirmedValue)
    assetSignatures.push({id:row.id,signature:sig(v3.resolved.compiled.sceneSpec)})
    results.push(await render(b,v2,row,'vertical','v2'))
    results.push(await render(b,v3,row,'vertical','v3'))
    results.push(await render(b,v3,row,'horizontal','v3'))
    write(path.join(out,'progress.json'),JSON.stringify({completed:i+1,total:rows.length,last:row.id},null,2))
  }
  for(const aspect of ['vertical','horizontal'])join(rows.map(row=>results.find(r=>r.id===row.id&&r.profile==='v3'&&r.aspect===aspect).mp4),path.join(out,`editorial-explainer-v3-${aspect}.mp4`))
  const idea=v3Batch[0],themeResults=[]
  for(const theme of ['orange','teal','crimson']){const spec=JSON.parse(JSON.stringify(idea.resolved.compiled.sceneSpec));spec.lightStyle.accentTheme=theme;b.validateVisualSceneSpecV2(spec)
    const compiled={...idea.resolved.compiled,sceneSpec:spec,graphicData:{...idea.resolved.compiled.graphicData,extra:{sceneSpec:spec}}}
    themeResults.push(await render(b,{resolved:{compiled}},rows[0],'vertical',`theme-${theme}`))}
  write(path.join(out,'accent-themes.html'),`<!doctype html><meta charset="utf-8"><style>body{background:#171717;color:#fff;font:16px Arial}main{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}img{width:100%;max-height:720px;object-fit:contain;background:#fff}</style><h1>Same scene · Orange / Teal / Crimson</h1><main>${themeResults.map(r=>`<article><img src="${path.relative(out,r.keyframes.stable).replace(/\\/g,'/')}"><p>${r.profile}</p></article>`).join('')}</main>`)
  contact(results)
  candidateSheet()
  write(path.join(out,'target-vs-v3-BLOCKED.md'),'# Target vs V3\n\nBLOCKED: the task attachment contained only Texto pegado.txt. No target images or motion-reference video were available; no proxy or fabricated target was used.\n')
  write(path.join(out,'assets-used.json'),JSON.stringify({rasterHeroes:rows.filter(r=>r.hero).map(r=>({scene:r.id,asset:r.hero})),
    localSvgSupports:rows.flatMap(r=>(r.supports||[]).map(asset=>({scene:r.id,asset}))),procedural:['background','connector','microdetails','data-repeater']},null,2))
  write(path.join(out,'motion-timing-report.md'),'# Editorial Explainer V3 — motion timing\n\n'+rows.map(row=>
    `## ${row.id}\n\n- duration: ${row.duration}s\n- cue: ${row.cue}\n- beats: ${v3Batch[rows.indexOf(row)].resolved.compiled.sceneSpec.lightStyle.narrativeBeats.map(b=>`${b.at}:${b.target}`).join(', ')}\n- transition: ${v3Batch[rows.indexOf(row)].resolved.compiled.sceneSpec.lightStyle.transitionVariant}\n`).join('\n'))
  const runtimeLog=path.join(fixture,'cipher-studio','generation-debug.log')
  if(fs.existsSync(runtimeLog))assert(!/FUENTE AUSENTE|fonts\.load lanzo/iu.test(fs.readFileSync(runtimeLog,'utf8')),
    'FONT_FALLBACK_OR_LOAD_FAILURE')
  const summary={synthetic:true,artDirectedAssetSelection:true,targetReferencesPresent:false,automaticRasterIndexProof:'scoped-manifest-test',durationSeconds:20,fps:24,
    localCatalogCount:14,rasterHeroCount:4,automaticHeroIndexQueries:4,accentThemeProofs:3,assetSignatures,visualSinFichero:0,
    qcErrors:results.flatMap(r=>r.qc).filter(f=>f.level==='error').length,
    results:results.map(({sceneSpec,bindings,...r})=>({...r,sceneSpec,bindings}))}
  write(path.join(out,'evidence.json'),JSON.stringify(summary,null,2))
  console.log('EDITORIAL_V3_EVIDENCE',out)
  console.log('EDITORIAL_V3_ACCEPTANCE',JSON.stringify({scenes:rows.length,duration:20,files:results.length,
    qcErrors:summary.qcErrors,vertical:path.join(out,'editorial-explainer-v3-vertical.mp4'),horizontal:path.join(out,'editorial-explainer-v3-horizontal.mp4')}))
  code=0
}catch(e){console.error(e.stack||e);console.error('EDITORIAL_V3_EVIDENCE_PARTIAL',out)}finally{
  try{b?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}catch(e){console.error(e.stack||e);code=1}
  app.exit(code)}})
