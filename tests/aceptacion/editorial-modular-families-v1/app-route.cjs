const {app,BrowserWindow,session,ipcMain,dialog}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const outputRoot=path.resolve(root,'../_cipher-editorial-integration-v1/evidence/app-route')
const fixture=createTestFixture('editorial-family-app-route'),projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
app.whenReady().then(async()=>{
  let exitCode=1,window
  try{
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'families-app-fixture',name:'Families App Fixture',
      clips:[],timelineVideoClips:[],aiScript:'Una idea conecta personas y datos.'})
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const id=code=>inventory.entries.find(item=>item.code===code).assetId
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const codes=['H001','S001','S002','S003','S004','L001','L036']
    const imported=Object.fromEntries(codes.map(code=>{const assetId=id(code)
      return [assetId,catalog.publish(projectRoot,assetId)]}))
    const semantic=b.createLocalSceneSemanticV1({sceneId:'app-r01',start:0,end:2,
      transcriptSegments:[{start:0,end:2,text:'Una idea conecta personas y datos.'}],
      concepts:codes.slice(0,3).map(code=>({label:inventory.entries.find(item=>item.code===code).primaryWordEs,scope:'scene'})),
      anchor:'Idea',globalText:'Una idea conecta personas y datos.'})
    const context=b.createModernVisualGenerationContextV2({sceneId:'app-r01',duration:2,
      localSemantic:semantic,keywordCandidates:[{keyword:'IDEA',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',
      direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:94511},
      videoStyleId:'cream-editorial'})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const built=b.bindEditorialModularFamilyV1({template:base,catalog,imported,
      family:'marcoPoster',heroId:id('H001'),supportIds:['S001','S002','S003','S004'].map(id),
      rearId:id('L001'),accentId:id('L036'),background:'ivory-clean',entry:'text-first',
      supportTreatment:'paper-card',camera:'fixed',particles:'none',color:'#A83B19',
      headline:{connector:'UNA',keyword:'IDEA',closing:'conecta personas y datos'},
      relations:[{from:'support-1',to:'hero',meaning:'informs'},
        {from:'support-2',to:'hero',meaning:'informs'}]})
    const generated=await b.renderGraphicClip(built.graphicData,{ancho:720,alto:1280,fps:30,
      duracion:2,modo:'pantalla',sistema:'editorial',projectRoot,renderBindings:built.renderBindings})
    assert(generated&&fs.existsSync(generated),'APP_ROUTE_VISUAL_SIN_FICHERO')
    window=new BrowserWindow({show:false,width:850,height:650,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist','catalog-matrix.html'))
    const invoke=js=>window.webContents.executeJavaScript(js)
    const opened=await invoke(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(opened.success,'PROJECT_LOAD_FAILED:'+opened.error)
    const regeneration={version:3,revision:'editorial-modular-families-2026-09-v1',
      sceneId:'app-r01',duration:2,sistema:'editorial',
      graphicData:built.graphicData,renderBindings:built.renderBindings}
    const clip={id:'app-visual-r01',name:'IDEA · familia editorial',type:'video',category:'visual',
      startSeconds:0,durationSeconds:2,path:generated,graphicData:built.graphicData,
      visualRegeneration:regeneration}
    const state={...opened.data,id:'families-app-fixture',name:'Families App Fixture',
      visualPresentationProfile:'editorial-modular-families-v1',modularCatalogRoot:catalogRoot,
      editorialFamilyChoice:'marcoPoster',editorialFamilyColor:'#A83B19',
      editorialFamilyEffects:'none',timelineVideoClips:[clip]}
    const saved=await invoke(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'AUTOSAVE_FAILED:'+saved.error)
    const reopened=await invoke(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data?.timelineVideoClips?.length===1,'PROJECT_REOPEN_FAILED')
    const stored=reopened.data.timelineVideoClips[0].visualRegeneration
    assert.equal(stored.version,3)
    assert.equal(stored.revision,regeneration.revision)
    const replay=await invoke(`window.electronAPI.regenerateGraphics(${JSON.stringify({
      mode:'modern-visual',aspectRatio:'vertical',resolution:'720p',
      modernVisuals:[{clipId:'app-visual-r01',context:stored}]})})`)
    assert(replay.success&&replay.clips?.[0]?.success&&fs.existsSync(replay.clips[0].path),
      'APP_REPLAY_VISUAL_SIN_FICHERO:'+replay.error)
    const exported=path.join(outputRoot,'app-route-visual-export-vertical.mp4')
    dialog.showSaveDialog=async()=>({canceled:false,filePath:exported})
    const exportResult=await invoke(`window.electronAPI.exportVideo(${JSON.stringify({
      clips:[replay.clips[0]],aspectRatio:'vertical',resolution:'720p',
      format:'mp4',quality:'medium',assignedTransitions:{},transitionDuration:.5,ajustesVideo:{}})})`)
    assert(exportResult.success&&fs.existsSync(exported),'APP_EXPORT_FAILED:'+exportResult.error)
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    const result={passed:true,projectSaved:true,reopened:true,regenerationVersion:3,
      replayVisualFile:true,exported,visualSinFichero:0,networkAttempts,
      audioSync:'NOT_TESTED_NO_AUTHORIZED_SPOKEN_AUDIO'}
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result))
    exitCode=0
  }catch(error){fs.mkdirSync(outputRoot,{recursive:true})
    fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error))
    console.error(error?.stack||error)}
  finally{if(window&&!window.isDestroyed())window.destroy()
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(exitCode)}
}).catch(error=>{console.error(error);app.exit(1)})
