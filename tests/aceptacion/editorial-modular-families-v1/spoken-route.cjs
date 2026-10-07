/** Isolated, no-paid-service acceptance using a spoken test fixture created by
 * an earlier Cipher UI acceptance run. The four editorial scenes quote only
 * concepts present in that fixture's segment-level transcript. */
const {app,BrowserWindow,session,ipcMain,dialog}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const sourceProject=path.resolve(root,'../_visual-recovery-ui-closure/acceptance-2/cipher-studio/proyectos/visual-recovery-functional-closure-1789781964152')
const sourceAudio=path.join(sourceProject,'materiales/audio/maestro.m4a')
const sourceState=path.join(sourceProject,'project-state.json')
const outputRoot=path.resolve(root,'../_cipher-editorial-integration-v1/evidence/spoken-route')
const fixture=createTestFixture('editorial-family-spoken-route'),projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
app.whenReady().then(async()=>{
  let exitCode=1,window
  try{
    assert(fs.existsSync(sourceAudio)&&fs.existsSync(sourceState),'SPOKEN_FIXTURE_MISSING')
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    const source=JSON.parse(fs.readFileSync(sourceState,'utf8'))
    const transcript=source.transcriptSegments.map(({start,end,text})=>({start,end,text}))
    assert(transcript.length>=6)
    const spans=[
      {start:0,end:5.6,connector:'PERSONAS',keyword:'JÓVENES',closing:'y la inteligencia artificial'},
      {start:5.6,end:10.42,connector:'UNA',keyword:'EMOCIÓN',closing:'la ira ante el cambio'},
      {start:10.42,end:15.38,connector:'TRABAJAR EN',keyword:'TECNOLOGÍA',closing:'una mirada generacional'},
      {start:15.38,end:20.14,connector:'ANTES',keyword:'INGENIERÍA',closing:'otra forma de mirar el futuro'},
    ]
    b.createProjectFiles(projectRoot,{id:'families-spoken-fixture',name:'Familias · prueba hablada',
      clips:[],timelineVideoClips:[],transcriptSegments:transcript,
      aiScript:transcript.map(item=>item.text).join(' ')})
    const audioPath=path.join(projectRoot,'materiales','audio','maestro.m4a')
    fs.mkdirSync(path.dirname(audioPath),{recursive:true})
    fs.copyFileSync(sourceAudio,audioPath)
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN_SPOKEN_ROUTE')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    const contexts=spans.map((item,index)=>{
      const localSemantic=b.createLocalSceneSemanticV1({sceneId:`spoken-${index+1}`,
        start:item.start,end:item.end,transcriptSegments:transcript,
        anchor:item.keyword,globalText:source.aiScript})
      return b.createModernVisualGenerationContextV2({sceneId:`spoken-${index+1}`,
        duration:item.end-item.start,localSemantic,
        keywordCandidates:[{keyword:item.keyword,source:'scene-semantic'}],
        preferredVisualMode:'editorial-text',sistema:'editorial',
        direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',
          ritmo:'simultaneo',semilla:95001+index},videoStyleId:'cream-editorial'})
    })
    const bases=await b.resolveModernVisualGenerationBatchV2({contexts,projectRoot})
    const catalog=new b.CuratedModularCatalogV1(path.resolve(root,'../_cipher-editorial-catalog-v1-250'))
    const clips=[]
    for(let index=0;index<spans.length;index++){
      const item=spans[index]
      const built=b.bindEditorialModularFamilyV1({template:bases[index].resolved.compiled,catalog,
        imported:{},family:'editorial',layoutVariant:index%2?'inverse':'base',supportIds:[],
        background:index%2?'white-soft-paper':'ivory-clean',entry:'word-first',
        supportTreatment:'naked-label',camera:'fixed',particles:'none',color:'#A83B19',
        headline:{connector:item.connector,keyword:item.keyword,closing:item.closing}})
      const generated=await b.renderGraphicClip(built.graphicData,{ancho:720,alto:1280,fps:24,
        duracion:item.end-item.start,modo:'pantalla',sistema:'editorial',projectRoot,
        renderBindings:built.renderBindings})
      assert(generated&&fs.existsSync(generated),'SPOKEN_VISUAL_SIN_FICHERO:'+index)
      clips.push({id:`spoken-${index+1}`,name:item.keyword,type:'video',category:'visual',
        startSeconds:item.start,durationSeconds:item.end-item.start,path:generated,
        graphicData:built.graphicData,visualRegeneration:{version:3,
          revision:'editorial-modular-families-2026-09-v1',sceneId:`spoken-${index+1}`,
          duration:item.end-item.start,sistema:'editorial',graphicData:built.graphicData,
          renderBindings:built.renderBindings}})
    }
    const audioClip={id:'spoken-audio',name:'Narración local de prueba',type:'audio',
      category:'original',startSeconds:0,durationSeconds:22.011995,path:audioPath}
    window=new BrowserWindow({show:false,width:850,height:650,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist','catalog-matrix.html'))
    const invoke=js=>window.webContents.executeJavaScript(js)
    const opened=await invoke(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(opened.success,'SPOKEN_PROJECT_LOAD_FAILED:'+opened.error)
    const state={...opened.data,id:'families-spoken-fixture',name:'Familias · prueba hablada',
      visualPresentationProfile:'editorial-modular-families-v1',
      modularCatalogRoot:path.resolve(root,'../_cipher-editorial-catalog-v1-250'),
      editorialFamilyChoice:'editorial',editorialFamilyColor:'#A83B19',
      editorialFamilyEffects:'none',transcriptSegments:transcript,
      clips:[audioClip],timelineVideoClips:clips}
    const saved=await invoke(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'SPOKEN_PROJECT_SAVE_FAILED:'+saved.error)
    const reopened=await invoke(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data.timelineVideoClips.length===4,'SPOKEN_REOPEN_FAILED')
    const exported=path.join(outputRoot,'editorial-spoken-project-export.mp4')
    dialog.showSaveDialog=async()=>({canceled:false,filePath:exported})
    const result=await invoke(`window.electronAPI.exportVideo(${JSON.stringify({
      clips:[...reopened.data.timelineVideoClips,audioClip],aspectRatio:'vertical',resolution:'720p',
      format:'mp4',quality:'medium',assignedTransitions:{},transitionDuration:.5,ajustesVideo:{}})})`)
    assert(result.success&&fs.existsSync(exported),'SPOKEN_EXPORT_FAILED:'+result.error)
    assert.equal(networkAttempts,0,'SPOKEN_NETWORK_AFTER_MATERIALIZATION')
    const report={passed:true,sourceAudio,sourceAudioSha256:sha(sourceAudio),
      sourceTranscript:sourceState,segments:transcript.length,visualClips:clips.length,
      visualSinFichero:0,exported,exportedSha256:sha(exported),networkAttempts,
      timingAuthority:'segment boundaries only; no word-level or lip-sync claim'}
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify(report))
    exitCode=0
  }catch(error){fs.mkdirSync(outputRoot,{recursive:true})
    fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error))
    console.error(error?.stack||error)}
  finally{if(window&&!window.isDestroyed())window.destroy()
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(exitCode)}
}).catch(error=>{console.error(error);app.exit(1)})
