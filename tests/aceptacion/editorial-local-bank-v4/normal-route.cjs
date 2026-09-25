const {app,BrowserWindow,dialog,ipcMain,session}=require('electron')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const evidence=path.resolve(root,'../_cipher-editorial-product-route-v1/evidence/normal-route')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
const fixture=createTestFixture('editorial-local-v4-normal-route'),projectRoot=path.join(fixture,'project')
const previousKey=process.env.DEEPSEEK_API_KEY,previousFetch=global.fetch
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const words='El cromatógrafo líquido analiza una muestra.'
const segments=[{start:0,end:3,text:words}]
const terms=[{icono:'star',ic:'🧪',etiqueta:'cromatógrafo líquido'},
  {icono:'flag',ic:'🧫',etiqueta:'muestra'},
  {icono:'users-group-rounded',ic:'📊',etiqueta:'datos'}]
const reply={phrases:[{phraseIndex:1,visualClips:[{keyword:'cromatógrafo',timestamp:.05,duration:2.9,
  prompt:words,conceptos:terms,
  semantica:{relacion:'conecta',ancla:terms[0],terminos:terms}}]}]}
const invoke=(channel,payload)=>{
  const handler=ipcMain._invokeHandlers.get(channel)
  assert(handler,'IPC_MISSING:'+channel)
  return handler({sender:{isDestroyed:()=>false,send:()=>{}}},payload)
}
app.whenReady().then(async()=>{
  let window,code=1,semanticCalls=0,otherNetwork=0
  try{
    fs.mkdirSync(evidence,{recursive:true})
    process.env.DEEPSEEK_API_KEY='offline-controlled-semantic-fixture'
    global.fetch=async url=>{
      if(String(url).startsWith('https://api.deepseek.com/chat/completions')){
        semanticCalls++
        return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]})}
      }
      otherNetwork++
      throw Error('UNEXPECTED_NETWORK:'+String(url))
    }
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url))otherNetwork++
      callback({cancel:/^https?:/i.test(details.url)})
    })
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'v4-normal-route',name:'V4 temporary',clips:[],
      timelineVideoClips:[],aiScript:words})
    const loaded=await invoke('load-project',{projectPath:projectRoot})
    assert(loaded.success,'PROJECT_OPEN:'+loaded.error)
    const source=path.join(fixture,'black.mp4')
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
      'color=c=black:s=360x640:r=12:d=3','-c:v','libx264','-pix_fmt','yuv420p',source])
    const generated=await invoke('generate-timeline-assets',{scriptText:words,audioDuration:3,
      transcriptSegments:segments,newAudioSegments:segments,videoPath:source,
      weights:[0,0,0,100],iaStyle:'editorial',aspectRatio:'vertical',graphicsPercent:0,
      visualPresentationProfile:'editorial-local-bank-v4',modularCatalogRoot:catalogRoot,
      editorialFamilyColor:'auto'})
    assert(generated.success,'NORMAL_GENERATION:'+generated.error)
    const diagnosticFolder=path.join(projectRoot,'materiales','diagnostics','visual-decisions')
    const diagnosticFiles=fs.readdirSync(diagnosticFolder).filter(name=>name.endsWith('.json'))
    assert(diagnosticFiles.length,'NO_PERSISTED_VISUAL_DIAGNOSTIC')
    const diagnostic=JSON.parse(fs.readFileSync(path.join(diagnosticFolder,diagnosticFiles.at(-1)),'utf8'))
    assert.equal(diagnostic.scenes[0].catalogDecision?.trace?.outcome,'SELECTED','CATALOG_TRACE_NOT_PERSISTED')
    assert.equal(diagnostic.scenes[0].catalogDecision?.effectiveRevision,
      b.EDITORIAL_LOCAL_BANK_V4.revision,'EFFECTIVE_REVISION_NOT_RECORDED')
    const visuals=generated.clips.filter(clip=>clip.category==='visual')
    assert(visuals.length>=1,'NO_VISUAL_CLIP')
    assert(visuals.every(clip=>fs.existsSync(clip.path)&&fs.statSync(clip.path).size>0),'VISUAL_SIN_FICHERO')
    const plan=visuals[0].visualRegeneration?.graphicData?.extra?.sceneSpec?.editorialBankV2
    assert(plan?.revision===b.EDITORIAL_LOCAL_BANK_V4.revision,'V4_PLAN_NOT_PERSISTED')
    assert(plan.hero.assetId,'SEMANTIC_HERO_MUST_SURVIVE')
    const catalog=new b.CuratedModularCatalogV2(catalogRoot)
    const active=JSON.parse(fs.readFileSync(path.join(catalogRoot,'extension-v2','active.json'),'utf8'))
    const extensionIds=new Set(active.batches.flatMap(batch=>JSON.parse(fs.readFileSync(path.join(catalogRoot,
      'extension-v2','batches',batch.id,'manifest.json'),'utf8')).entries.map(entry=>entry.assetId)))
    assert(extensionIds.has(plan.hero.assetId),'SEMANTIC_SELECTION_MUST_REACH_ACTIVE_EXTENSION')
    assert.equal(catalog.getById(plan.hero.assetId)?.sha256,plan.hero.sha256)
    window=new BrowserWindow({show:false,width:800,height:600,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist/catalog-matrix.html'))
    const js=code=>window.webContents.executeJavaScript(code)
    const state={...loaded.data,visualPresentationProfile:'editorial-local-bank-v4',
      modularCatalogRoot:catalogRoot,editorialLocalAccent:'auto',timelineVideoClips:generated.clips}
    const saved=await js(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'SAVE:'+saved.error)
    const reopened=await js(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data?.timelineVideoClips?.some(clip=>clip.category==='visual'),'REOPEN')
    const replay=await js(`window.electronAPI.regenerateGraphics(${JSON.stringify({mode:'modern-visual',
      aspectRatio:'vertical',resolution:'720p',modernVisuals:[{clipId:visuals[0].id,
        context:visuals[0].visualRegeneration}]})})`)
    assert(replay.success&&replay.clips?.[0]?.success&&fs.existsSync(replay.clips[0].path),
      'REPLAY_FAILED:'+replay.error)
    const destination=path.join(evidence,'v4-controlled-handler-vertical.mp4')
    dialog.showSaveDialog=async()=>({canceled:false,filePath:destination})
    const exported=await js(`window.electronAPI.exportVideo(${JSON.stringify({clips:generated.clips,
      aspectRatio:'vertical',resolution:'720p',format:'mp4',quality:'medium',assignedTransitions:{},
      transitionDuration:.5,ajustesVideo:{}})})`)
    assert(exported.success&&fs.statSync(destination).size>0,'EXPORT_FAILED:'+exported.error)
    const result={passed:true,semanticMode:'OFFLINE_MOCK',semanticCalls,otherNetwork,
      visualsRequested:1,visualsAttempted:1,visualsMaterialized:visuals.length,
      timelineVisuals:visuals.length,visualSinFichero:0,heroId:plan.hero.assetId,
      heroSha256:plan.hero.sha256,supports:plan.supports.length,
      saved:true,reopened:true,replayed:true,exported:destination,productUIInteracted:false}
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result));code=0
  }catch(error){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'failure.txt'),
    String(error?.stack||error));console.error(error?.stack||error)}
  finally{if(window&&!window.isDestroyed())window.destroy();global.fetch=previousFetch
    if(previousKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previousKey
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
