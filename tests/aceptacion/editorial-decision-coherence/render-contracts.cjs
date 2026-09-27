// Directed capability test, NOT proof of automatic semantic selection or UI.
const {app,ipcMain,session}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('decision-render-contracts')
const output=process.env.CIPHER_DECISION_EVIDENCE,ffmpeg=process.env.CIPHER_FFMPEG_EXE
if(!output||!ffmpeg)throw Error('EXPLICIT_EVIDENCE_AND_FFMPEG_REQUIRED')
app.setPath('userData',path.join(fixture,'userData'));process.chdir(fixture)
app.commandLine.appendSwitch('force-device-scale-factor','1')
const handle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(name,fn)=>handle(name,name==='get-elevenlabs-voices'?async()=>({success:true,voices:[]}):fn)
app.on('browser-window-created',(_,win)=>{win.hide();win.on('ready-to-show',()=>win.hide())})
app.whenReady().then(async()=>{let code=1;try{
  const b=require(path.join(root,'dist-electron/main/index.js'));app.removeAllListeners('window-all-closed')
  let networkAttempts=0
  global.fetch=async()=>{networkAttempts++;throw Error('RENDER_NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url))networkAttempts++;cb({cancel:/^https?:/.test(d.url)})})
  const catalog=new b.CuratedModularCatalogV2(process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH)
  const project=path.join(fixture,'project');b.createProjectFiles(project,{id:'decision-contract',clips:[],timelineVideoClips:[]})
  const narration='El cromatógrafo líquido registra datos de la muestra.'
  const semantic=b.createLocalSceneSemanticV1({sceneId:'directed-contract',start:0,end:4,
    transcriptSegments:[{start:0,end:4,text:narration}],concepts:[{label:'cromatógrafo líquido',scope:'scene'},{label:'datos',scope:'scene'}],globalText:narration})
  const hero=catalog.searchEditorialLocalV2('cromatógrafo líquido','hero-core')[0].asset
  const support=catalog.searchEditorialLocalV2('datos','support')[0].asset
  const direction={revision:'editorial-scene-decision-2026-09-v2',intent:'relation',family:'marcoPoster',variant:'base',
    entry:'hero-first',background:'ivory-clean',relations:[{fromId:hero.assetId,toId:support.assetId,
      relation:'informa',quote:narration,reason:'Directed contract: instrument records sample data.'}],reason:'Directed composition capability.'}
  const selection=b.selectEditorialLocalBankV4Detailed({catalog,semantic,useInventoryMetadata:true,
    contextualChoice:{heroId:hero.assetId,supportIds:[support.assetId],direction}})
  const ids=[selection.selection.heroId,...selection.selection.supportIds,selection.selection.rearId,
    selection.selection.accentId,selection.selection.backgroundId].filter(Boolean)
  const imported=Object.fromEntries(ids.map(id=>[id,catalog.publish(project,id)]))
  const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:4,localSemantic:semantic,
    keywordCandidates:[],preferredVisualMode:'editorial-text',sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',
      camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:22131},videoStyleId:'cream-editorial'})
  const template=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot:project}))[0].resolved.compiled
  const sceneDecision={sceneId:semantic.sceneId,localText:narration,anchor:'',evidence:[],durationSeconds:4,
    selectionReason:'directed-test',familyReason:'directed-test',missingTerms:[],colorMode:'auto',seed:22131,
    planning:{revision:direction.revision,start:0,end:4,intervalText:narration,neighborContext:narration,
      proposition:narration,visibleText:'El análisis aporta datos',sourceQuote:narration,headline:'El análisis aporta datos',secondary:'',
      framing:'assertion',contextRef:'fixture:0-4',direction,adjustments:[],reason:'Directed test, not selection validation.'}}
  const input={template,catalog,imported,selection:selection.selection,color:'#A83B19',contract:b.EDITORIAL_LOCAL_BANK_V4,
    sceneDecision,headline:{keyword:sceneDecision.planning.headline}}
  const built=b.bindEditorialLocalBankV2(input),again=b.bindEditorialLocalBankV2(input)
  assert.equal(built.pixelIdentity,again.pixelIdentity)
  assert.equal(built.sceneSpec.editorialBankV2.supports.length,1)
  const relation=built.sceneSpec.editorialBankV2.relations[0]
  assert(relation,'DIRECTED_RELATION_MUST_HAVE_CLEAR_ROUTE')
  assert.equal(relation.meaning,'informs');assert.equal(relation.representation,'arrow')
  assert(relation.start>built.sceneSpec.editorialBankV2.supports[0].settle)
  const forged=structuredClone(built.sceneSpec);forged.editorialBankV2.relations[0].meaning='causes'
  assert.throws(()=>b.validateVisualSceneSpecV2(forged),/NOT_AUTHORIZED/)
  const missingDecision=structuredClone(built.sceneSpec);delete missingDecision.editorialBankV2.relationDecision
  assert.throws(()=>b.validateVisualSceneSpecV2(missingDecision),/DECISION_REQUIRED/)
  assert(!built.pixelIdentity.includes(project));assert(!built.pixelIdentity.includes(catalog.root??'C:/never'))
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'scene.json'),JSON.stringify(built,null,2))
  const outputs=[]
  for(const [orientation,width,height] of [['portrait',720,1280],['landscape',1280,720]]){
    let qc
    const file=await b.renderGraphicClip(built.graphicData,{ancho:width,alto:height,fps:24,duracion:4,modo:'pantalla',sistema:'editorial',
      projectRoot:project,renderBindings:built.renderBindings,onQcReport:r=>{qc=r},onQcFailure:r=>{qc=r}})
    assert(file&&fs.existsSync(file),'VISUAL_SIN_FICHERO:'+JSON.stringify(qc))
    const destination=path.join(output,orientation+'.mp4');fs.copyFileSync(file,destination)
    for(const [name,time] of [['entry',.5],['reading',2.4],['exit',3.8]])execFileSync(ffmpeg,['-v','error','-y','-ss',String(time),'-i',destination,
      '-frames:v','1','-vf',orientation==='portrait'?'scale=360:640':'scale=640:360',path.join(output,orientation+'-'+name+'.png')])
    outputs.push({orientation,file:destination,qc,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})
  }
  assert.equal(networkAttempts,0)
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,directedFixture:true,productUI:false,project,
    networkAttempts,outputs,selectionTrace:selection.trace},null,2));code=0
}catch(e){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.txt'),e.stack);console.error(e.stack)}finally{app.exit(code)}})
