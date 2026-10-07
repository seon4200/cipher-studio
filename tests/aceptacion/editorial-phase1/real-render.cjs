// New DeepSeek decision -> ordinary catalog selector/binder/renderer, without UI.
// Never substitutes for the UI acceptance gate or audio synchronization.
const {app,ipcMain,session}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const source=process.env.CIPHER_PHASE1_REAL_DECISIONS
const catalogPath=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH
const output=process.env.CIPHER_PHASE1_EVIDENCE
const ffmpeg=process.env.CIPHER_FFMPEG_EXE
if(!source||!catalogPath||!output||!ffmpeg)throw Error('EXPLICIT_INPUTS_REQUIRED')
const fixture=createTestFixture('editorial-phase1-real-render'),project=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const handle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(name,fn)=>handle(name,name==='get-elevenlabs-voices'?async()=>({success:true,voices:[]}):fn)
app.on('browser-window-created',(_,win)=>{win.hide();win.on('ready-to-show',()=>win.hide())})
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
app.whenReady().then(async()=>{let exit=1;try{
  const b=require(path.join(root,'dist-electron/main/index.js'))
  app.removeAllListeners('window-all-closed')
  const item=JSON.parse(fs.readFileSync(source,'utf8')).find(row=>row.id==='visual-8:0')
  assert(item?.meaning&&item?.decision?.heroId,'NO_REAL_SELECTED_HERO')
  assert(!item.presentationAdjustments?.includes('PRESENTATION_UNRESOLVED'),'PRESENTATION_NOT_RENDERABLE')
  const catalog=new b.CuratedModularCatalogV2(catalogPath)
  assert.equal(catalog.verifyAll().failures.length,0)
  const semantic=item.semantic,decision=item.decision,meaning=item.meaning
  const selected=b.selectEditorialLocalBankV4Detailed({catalog,semantic,recentFamilies:[],
    contextualChoice:{heroId:decision.heroId,supportIds:decision.supportIds,direction:decision.direction},
    useInventoryMetadata:true})
  assert(selected.selection,'REAL_DECISION_NO_COMPATIBLE_SELECTION:'+JSON.stringify(selected.trace))
  const selection=selected.selection
  b.createProjectFiles(project,{id:'phase1-real-selected',clips:[],timelineVideoClips:[]})
  const ids=[selection.heroId,...selection.supportIds,selection.rearId,selection.accentId,
    selection.frontId,selection.backgroundId].filter(Boolean)
  const imported=Object.fromEntries([...new Set(ids)].map(id=>[id,catalog.publish(project,id)]))
  const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,
    duration:item.duration,localSemantic:semantic,keywordCandidates:[],
    preferredVisualMode:'editorial-text',sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',
      camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:270927},videoStyleId:'cream-editorial'})
  const template=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot:project}))[0].resolved.compiled
  const sceneDecision={sceneId:semantic.sceneId,localText:semantic.localText,anchor:semantic.anchor??'',
    evidence:semantic.directEvidence?.map(entry=>entry.query)??[],durationSeconds:item.duration,
    selectionReason:selection.reason,familyReason:selection.reason,missingTerms:selected.trace.missingTerms??[],
    colorMode:'auto',seed:270927,planning:{revision:'editorial-scene-decision-2026-09-v3',
      start:semantic.start,end:semantic.end,intervalText:semantic.localText,neighborContext:semantic.globalText??'',
      proposition:meaning.proposition,propositionSource:decision.propositionSource,
      visibleText:[meaning.headline,meaning.secondary].filter(Boolean).join(' '),sourceQuote:meaning.sourceQuote,
      headline:meaning.headline,secondary:meaning.secondary,framing:meaning.framing,
      contextRef:semantic.globalContextRef??'',sourceScope:decision.propositionSource==='interval'?'interval':'interval-with-prior-context',
      neighborBefore:semantic.neighborBefore??'',neighborAfter:semantic.neighborAfter??'',
      direction:decision.direction,adjustments:item.presentationAdjustments??[],reason:decision.reason}}
  const built=b.bindEditorialLocalBankV2({template,catalog,imported,selection,color:'#A83B19',
    contract:b.EDITORIAL_LOCAL_BANK_V4,sceneDecision,
    headline:{keyword:meaning.headline,...(meaning.secondary?{closing:meaning.secondary}:{})}})
  let networkAttempts=0
  global.fetch=async()=>{networkAttempts++;throw Error('RENDER_NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
    if(/^https?:/i.test(details.url))networkAttempts++
    callback({cancel:/^https?:/i.test(details.url)})})
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(output,'scene.json'),JSON.stringify(built,null,2))
  const outputs=[]
  for(const [orientation,width,height] of [['portrait',720,1280],['landscape',1280,720]]){
    let qc
    const file=await b.renderGraphicClip(built.graphicData,{ancho:width,alto:height,fps:24,
      duracion:item.duration,modo:'pantalla',sistema:'editorial',projectRoot:project,
      renderBindings:built.renderBindings,onQcReport:value=>{qc=value},onQcFailure:value=>{qc=value}})
    assert(file&&fs.existsSync(file),'VISUAL_SIN_FICHERO:'+orientation+':'+JSON.stringify(qc))
    const mp4=path.join(output,orientation+'.mp4')
    fs.copyFileSync(file,mp4)
    execFileSync(ffmpeg,['-v','error','-y','-ss',String(Math.min(1.8,item.duration*.6)),
      '-i',mp4,'-frames:v','1',path.join(output,orientation+'-reading.png')])
    outputs.push({orientation,mp4,sha256:sha(mp4),qc:qc?.findings??[]})
  }
  assert.equal(networkAttempts,0)
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,ui:false,
    source:'real-deepseek-decision',sceneId:item.id,heroId:decision.heroId,selection,
    planningRevision:sceneDecision.planning.revision,networkAttempts,project,outputs},null,2))
  console.log(JSON.stringify({passed:true,sceneId:item.id,heroId:decision.heroId,outputs}))
  exit=0
}catch(error){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.txt'),error.stack)
  console.error(error.stack)}finally{app.exit(exit)}})
