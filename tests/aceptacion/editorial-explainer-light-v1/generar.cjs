// Isolated, offline, synthetic A/B through the productive resolver and V15 compositor.
const {app,session,ipcMain}=require('electron')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {spawnSync}=require('node:child_process'),{performance}=require('node:perf_hooks')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const rows=require('../../fixtures/editorial-explainer-light-v1-corpus')
const active=process.env.CIPHER_LIGHT_ONLY ? rows.filter(row=>row.id===process.env.CIPHER_LIGHT_ONLY) : rows
const repo=path.resolve(__dirname,'../../..'),fixture=createTestFixture('light-v1-acceptance')
const project=path.join(fixture,'project'),out=path.resolve(repo,'../_editorial-explainer-light-v1-evidence',
  `run-${new Date().toISOString().replace(/[-:]/g,'').replace(/\..*/, '').replace('T','-')}`)
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','2.25')
process.chdir(fixture)
const quote=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data)}
function ff(args){const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],
  {encoding:'utf8',timeout:180000});if(result.status!==0)throw Error(`FFMPEG:${result.status}:${result.error?.message||result.stderr}`)}
function still(mp4,png){ff(['-ss','1.65','-i',mp4,'-frames:v','1','-update','1',png])}
function join(files,target){const list=path.join(out,`${path.basename(target)}.concat.txt`)
  write(list,files.map(file=>`file '${file.replace(/'/g,"'\\''").replace(/\\/g,'/')}'`).join('\n')+'\n')
  ff(['-f','concat','-safe','0','-i',list,'-c','copy',target])}
function sheet(files){const cards=files.map(item=>`<article><img src="${quote(path.relative(out,item.png).replace(/\\/g,'/'))}"><h2>${quote(item.id)} · ${quote(item.profile)}</h2><p>${quote(item.aspect)}</p></article>`).join('')
  write(path.join(out,'before-after.html'),`<!doctype html><meta charset="utf-8"><title>Editorial Explainer Light V1 · A/B sintético</title><style>body{background:#17171b;color:#f4f2ed;font:16px sans-serif;padding:2rem}main{display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:1rem}article{background:#232327;padding:1rem}img{width:100%;max-height:500px;object-fit:contain;background:#eee}</style><h1>Antes / después — mismas entradas sintéticas</h1><main>${cards}</main>`)}
function pngSheet(files){const scaled=files.map((_,i)=>`[${i}:v]scale=270:480[v${i}]`).join(';')
  const positions=files.map((_,i)=>`${i%2*270}_${Math.floor(i/2)*480}`).join('|')
  const inputs=files.flatMap(item=>['-i',item.png])
  ff([...inputs,'-filter_complex',`${scaled};${files.map((_,i)=>`[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${positions}[out]`,
    '-map','[out]','-frames:v','1','-update','1',path.join(out,'before-after-contact-sheet.png')])}
let bundle
function context(row,i,profile,lockedChoices){const sceneId=`light-${row.id}`,duration=3
  const localSemantic=bundle.createLocalSceneSemanticV1({sceneId,start:0,end:duration,
    transcriptSegments:[{start:0,end:duration,text:row.text}],
    concepts:row.concepts.map(c=>({...c,start:.05,end:2.95,scope:'scene'})),
    anchor:row.concepts[0]?.label,relation:row.relation,globalText:row.text,
    globalHints:[],globalContextRef:'synthetic:editorial-explainer-light-v1'})
  return bundle.createModernVisualGenerationContextV2({sceneId,duration,localSemantic,
    keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],preferredVisualMode:row.mode,
    sistema:'editorial',direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',
      densidad:'media',ritmo:'simultaneo',semilla:51001+i},videoStyleId:'cream-editorial',
    presentationProfile:profile,visualAssetPack:bundle.MODERN_VISUAL_PACK_V1,
    ...(lockedChoices?{lockedChoices}:{}),
    colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],revision:bundle.COLOR_PALETTE_REVISION_V1}})}
async function render(result,row,aspect,profile){const compiled=result.resolved.compiled
  const size=aspect==='vertical'?{ancho:540,alto:960}:{ancho:960,alto:540}
  let qc;const started=performance.now()
  const file=await bundle.renderGraphicClip(compiled.graphicData,{...size,fps:24,duracion:3,modo:'pantalla',
    sistema:'editorial',projectRoot:project,renderBindings:compiled.renderBindings,
    onQcReport:v=>qc=v,onQcFailure:v=>qc=v})
  assert(file&&fs.existsSync(file),`VISUAL_SIN_FICHERO:${row.id}:${aspect}:${JSON.stringify(qc?.findings)}`)
  assert.equal(qc?.findings?.filter(f=>f.level==='error').length,0,JSON.stringify(qc?.findings))
  const stem=`${row.id}-${profile}-${aspect}`,mp4=path.join(out,'clips',stem+'.mp4'),png=path.join(out,'stills',stem+'.png')
  fs.mkdirSync(path.dirname(mp4),{recursive:true});fs.mkdirSync(path.dirname(png),{recursive:true})
  fs.copyFileSync(file,mp4);still(mp4,png)
  return {id:row.id,profile,aspect,mp4,png,renderMs:performance.now()-started,qc:qc.findings,
    slots:compiled.sceneSpec.slots.map(s=>({slotId:s.slotId,state:s.state,sha256:s.sha256||null})),
    background:compiled.sceneSpec.lightStyle?.background||null}}
app.whenReady().then(async()=>{let code=1;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  bundle=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  bundle.createProjectFiles(project,{id:'light-v1-acceptance',clips:[],timelineVideoClips:[],aiScript:'synthetic'})
  const light=(await bundle.resolveModernVisualGenerationBatchV2({contexts:active.map((row,i)=>context(row,i,bundle.EDITORIAL_EXPLAINER_LIGHT_V1)),projectRoot:project}))
  assert.equal(light.length,active.length)
  const before=(await bundle.resolveModernVisualGenerationBatchV2({contexts:active.map((row,i)=>context(row,i,bundle.FAMILIES_MOTION_PROFILE_V2,light[i].context.lockedChoices)),projectRoot:project}))
  const assetSignature=spec=>spec.slots.map(s=>`${s.slotId}:${s.sha256||s.solarIcon||s.state}`).join('|')
  for(let i=0;i<active.length;i++){
    const a=light[i].resolved.compiled.sceneSpec,b=before[i].resolved.compiled.sceneSpec
    assert.equal(assetSignature(a),assetSignature(b),`A/B assets differ ${active[i].id}`)
    assert.equal(a.text.keyword,b.text.keyword,`A/B keyword differs ${active[i].id}`)
    assert.equal(a.lightStyle.revision,bundle.EDITORIAL_EXPLAINER_LIGHT_V1.revision)
    if(active[i].id==='count-12')assert.equal(a.lightStyle.dataRepeater?.tokenCount,12)
  }
  const results=[]
  for(let i=0;i<active.length;i++)for(const aspect of ['vertical','horizontal']){
    results.push(await render(before[i],active[i],aspect,'before'))
    results.push(await render(light[i],active[i],aspect,'light'))
    write(path.join(out,'progress.json'),JSON.stringify({completed:results.length,total:4*active.length,last:active[i].id,aspect},null,2))
  }
  join(active.map(row=>results.find(r=>r.id===row.id&&r.profile==='light'&&r.aspect==='vertical').mp4),
    path.join(out,'editorial-explainer-light-v1-vertical.mp4'))
  join(active.map(row=>results.find(r=>r.id===row.id&&r.profile==='light'&&r.aspect==='horizontal').mp4),
    path.join(out,'editorial-explainer-light-v1-horizontal.mp4'))
  const verticalComparison=results.filter(r=>r.aspect==='vertical')
  sheet(verticalComparison)
  pngSheet(verticalComparison)
  const runtimeLog=path.join(fixture,'cipher-studio','generation-debug.log')
  if(fs.existsSync(runtimeLog))assert(!/FUENTE AUSENTE|fonts\.load lanzo/iu.test(fs.readFileSync(runtimeLog,'utf8')),
    'FONT_FALLBACK_OR_LOAD_FAILURE')
  const summary={synthetic:true,durationSeconds:3*active.length,fps:24,scenes:active.length,files:results.length,
    lightBackgrounds:[...new Set(results.filter(r=>r.profile==='light').map(r=>r.background))],
    abAssetsMatched:true,qcErrors:results.flatMap(r=>r.qc).filter(f=>f.level==='error').length,
    visualSinFichero:0,results}
  write(path.join(out,'evidence.json'),JSON.stringify(summary,null,2))
  console.log('LIGHT_V1_EVIDENCE',out)
  console.log('LIGHT_V1_ACCEPTANCE',JSON.stringify({files:summary.files,qcErrors:summary.qcErrors,
    backgrounds:summary.lightBackgrounds,vertical:path.join(out,'editorial-explainer-light-v1-vertical.mp4')}))
  code=0
}catch(e){console.error(e.stack||e);console.error('LIGHT_V1_EVIDENCE_PARTIAL',out)}finally{
  try{const log=path.join(fixture,'cipher-studio','generation-debug.log')
    if(fs.existsSync(log)){fs.mkdirSync(out,{recursive:true});fs.copyFileSync(log,path.join(out,'acceptance-generation-debug.log'))}
    bundle?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}
  catch(e){console.error(e.stack||e);code=1}app.exit(code)}})
