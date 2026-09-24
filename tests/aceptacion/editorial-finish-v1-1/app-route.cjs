const {app,BrowserWindow,dialog,ipcMain,session}=require('electron')
const assert=require('node:assert/strict')
const {execFileSync}=require('node:child_process')
const fs=require('node:fs'),path=require('node:path')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const evidence=path.resolve(root,'../_cipher-editorial-finish-v1-1/evidence/app-route')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
const fixture=createTestFixture('editorial-finish-app-route'),projectRoot=path.join(fixture,'project')
const priorKey=process.env.DEEPSEEK_API_KEY,priorFetch=global.fetch
let networkAttempts=0,semanticCalls=0
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const segment={start:0,end:3.5,text:'Una idea conecta personas y datos.'}
const response=()=>({phrases:[{phraseIndex:1,visualClips:[{keyword:'idea',timestamp:.05,
  duration:3.4,prompt:segment.text,conceptos:[
    {icono:'star',ic:'💡',etiqueta:'idea'},
    {icono:'users-group-rounded',ic:'👥',etiqueta:'personas'},
    {icono:'flag',ic:'📊',etiqueta:'datos'}],
  semantica:{relacion:'conecta',ancla:{icono:'star',ic:'💡',etiqueta:'idea'},
    terminos:[{icono:'star',ic:'💡',etiqueta:'idea'},
      {icono:'users-group-rounded',ic:'👥',etiqueta:'personas'},
      {icono:'flag',ic:'📊',etiqueta:'datos'}]}}]}]})
const invoke=(channel,payload)=>{
  const handler=ipcMain._invokeHandlers.get(channel)
  assert(handler,'IPC_MISSING:'+channel)
  return handler({sender:{isDestroyed:()=>false,send:()=>{}}},payload)
}
app.whenReady().then(async()=>{
  let window,exitCode=1
  try{
    fs.mkdirSync(evidence,{recursive:true})
    process.env.DEEPSEEK_API_KEY='offline-finish-fixture'
    global.fetch=async url=>{
      if(String(url).startsWith('https://api.deepseek.com/chat/completions')){
        semanticCalls++
        return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',
          message:{content:JSON.stringify(response())}}]})}
      }
      networkAttempts++
      throw new Error('NETWORK_FORBIDDEN:'+String(url))
    }
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url))networkAttempts++
      callback({cancel:/^https?:/i.test(details.url)})
    })
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'finish-app-route',name:'Finish app route',
      clips:[],timelineVideoClips:[],aiScript:segment.text})
    const loaded=await invoke('load-project',{projectPath:projectRoot})
    assert(loaded.success,'PROJECT_OPEN:'+loaded.error)
    const source=path.join(fixture,'black.mp4')
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
      'color=c=black:s=360x640:r=12:d=4','-c:v','libx264','-pix_fmt','yuv420p',source])
    const finishControls={display:'Fraunces',local:'discreto',ambient:'discreto',
      composition:'base',representation:'auto',response:'auto',
      headline:'auto',keyword:'auto',body:'auto',effects:'auto'}
    const generated=await invoke('generate-timeline-assets',{
      scriptText:segment.text,audioDuration:3.5,transcriptSegments:[segment],newAudioSegments:[segment],
      videoPath:source,weights:[0,0,0,100],iaStyle:'editorial',aspectRatio:'vertical',graphicsPercent:100,
      visualPresentationProfile:'editorial-modular-finish-v1-1',modularCatalogRoot:catalogRoot,
      editorialFamilyChoice:'marcoPoster',editorialFamilyColor:'#A83B19',editorialFamilyEffects:'none',
      editorialFinishControls:finishControls,
    })
    assert(generated.success,'GENERATION:'+generated.error)
    const visuals=generated.clips.filter(clip=>clip.category==='visual')
    assert(visuals.length>=1,'VISUALS_MISSING')
    const first=visuals[0],spec=first.visualRegeneration?.graphicData?.extra?.sceneSpec
    assert.equal(spec?.presentationProfile?.revision,b.EDITORIAL_FINISH_V1_1.revision)
    assert(fs.existsSync(first.path)&&fs.statSync(first.path).size>0,'VISUAL_SIN_FICHERO')
    assert(spec.editorialFamily.supports.length>=2,'EDIT_NEEDS_SUPPORTS')
    window=new BrowserWindow({show:false,width:800,height:600,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist','catalog-matrix.html'))
    const js=code=>window.webContents.executeJavaScript(code)
    const state={...loaded.data,visualPresentationProfile:'editorial-modular-finish-v1-1',
      modularCatalogRoot:catalogRoot,editorialFamilyChoice:'marcoPoster',editorialFamilyColor:'#A83B19',
      editorialFamilyEffects:'none',editorialFinishControls:finishControls,timelineVideoClips:generated.clips}
    const saved=await js(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'SAVE:'+saved.error)
    const reopened=await js(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data?.timelineVideoClips?.[0]?.visualRegeneration?.graphicData?.extra
      ?.sceneSpec?.presentationProfile?.revision===b.EDITORIAL_FINISH_V1_1.revision,'REOPEN')
    const replay=await js(`window.electronAPI.regenerateGraphics(${JSON.stringify({
      mode:'modern-visual',aspectRatio:'vertical',resolution:'720p',
      modernVisuals:[{clipId:first.id,context:first.visualRegeneration}],
    })})`)
    assert(replay.success&&replay.clips?.[0]?.success&&fs.existsSync(replay.clips[0].path),
      'REPLAY:'+replay.error)
    const original=spec.editorialFamily
    const edits={family:original.family,heroId:original.hero.assetId,
      supportIds:original.supports.map(s=>s.assetId).reverse()}
    const changedControls={...finishControls,display:'Instrument Serif'}
    const edited=await js(`window.electronAPI.rebindEditorialFamilyClipV1(${JSON.stringify({
      catalogRoot,graphicData:first.visualRegeneration.graphicData,
      renderBindings:first.visualRegeneration.renderBindings,orientation:'portrait',
      durationSeconds:first.durationSeconds,finishControls:changedControls,edits,
    })})`)
    assert(edited.success&&fs.existsSync(edited.path),'EDIT:'+edited.error)
    const changed=edited.graphicData.extra.sceneSpec
    assert.equal(changed.editorialFinish.typography.display,'Instrument Serif','FONT_EDIT_NOT_PERSISTED')
    assert.notEqual(edited.pixelIdentity,b.sceneSpecPixelIdentityAny(spec),'EDIT_IDENTITY_UNCHANGED')
    const changedSlots=new Set(original.supports.filter((s,i)=>s.assetId!==edits.supportIds[i])
      .map(s=>s.slotId))
    assert(changed.editorialFamily.relations.every(r=>!changedSlots.has(r.from)&&!changedSlots.has(r.to)),
      'STALE_SEMANTIC_RELATION')
    const editedClips=generated.clips.map(clip=>clip.id===first.id?{
      ...clip,path:edited.path,url:edited.url,graphicData:edited.graphicData,
      visualRegeneration:{...clip.visualRegeneration,graphicData:edited.graphicData,
        renderBindings:edited.renderBindings}}:clip)
    const savedEdit=await js(`window.electronAPI.saveProjectState(${JSON.stringify({
      ...state,editorialFinishControls:changedControls,timelineVideoClips:editedClips,
    })})`)
    assert(savedEdit.success,'EDIT_SAVE:'+savedEdit.error)
    const reopenedEdit=await js(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert.equal(reopenedEdit.data?.timelineVideoClips?.[0]?.visualRegeneration?.graphicData?.extra
      ?.sceneSpec?.editorialFinish?.typography?.display,'Instrument Serif','EDIT_REOPEN')
    const destination=path.join(evidence,'edited-app-route.mp4')
    dialog.showSaveDialog=async()=>({canceled:false,filePath:destination})
    const exported=await js(`window.electronAPI.exportVideo(${JSON.stringify({
      clips:editedClips,aspectRatio:'vertical',resolution:'720p',format:'mp4',quality:'medium',
      assignedTransitions:{},transitionDuration:.5,ajustesVideo:{},
    })})`)
    assert(exported.success&&fs.statSync(destination).size>0,'EXPORT:'+exported.error)
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    const result={passed:true,semanticCalls,networkAttempts,visuals:visuals.length,
      saved:true,reopened:true,replayed:true,editedSupport:true,editedFont:true,
      staleRelationsRemoved:true,exported:destination,visualSinFichero:0,
      semanticMode:'OFFLINE_MOCK; product IPC, catalog, V15 capture, save/reopen and export'}
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result));exitCode=0
  }catch(error){fs.mkdirSync(evidence,{recursive:true})
    fs.writeFileSync(path.join(evidence,'failure.txt'),String(error?.stack||error))
    console.error(error?.stack||error)}
  finally{
    if(window&&!window.isDestroyed())window.destroy()
    global.fetch=priorFetch
    if(priorKey===undefined)delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY=priorKey
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}
    app.exit(exitCode)
  }
}).catch(error=>{console.error(error);app.exit(1)})
