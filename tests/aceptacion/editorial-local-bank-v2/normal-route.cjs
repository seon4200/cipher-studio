const {app, BrowserWindow, dialog, ipcMain, session} = require('electron')
const assert = require('node:assert/strict')
const {execFileSync} = require('node:child_process')
const fs = require('node:fs'), path = require('node:path')
const {createTestFixture, cleanupTestFixture} = require('../../helpers/safe-fixture')

const root = path.resolve(__dirname, '../../..')
const catalogRoot = process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH ||
  path.resolve(root, '../_cipher-editorial-catalog-v1-250')
const evidence = path.resolve(root, '../_cipher-editorial-local-bank-v2/evidence/normal-route')
const ffmpeg = process.env.CIPHER_FFMPEG_EXE ||
  path.resolve(root, '../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
process.env.PATH = path.dirname(ffmpeg) + path.delimiter + process.env.PATH
const fixture = createTestFixture('editorial-local-normal-route')
const projectRoot = path.join(fixture, 'project')
const originalKey = process.env.DEEPSEEK_API_KEY
const originalFetch = global.fetch
let semanticCalls = 0, forbiddenNetwork = 0
app.setPath('userData', path.join(fixture, 'userData'))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
process.chdir(fixture)

const scenes = [
  {text:'Una idea conecta personas y datos.', terms:['idea','personas','datos'], relation:'conecta'},
  {text:'Las piezas avanzan con herramientas y construcción.', terms:['piezas','herramientas','construcción'], relation:'secuencia'},
  {text:'Una señal conecta la red y la cámara.', terms:['señal','red','cámara'], relation:'red de conexiones'},
]
const solarIcons = [
  ['star','users-group-rounded','flag'],
  ['star','flag','users-group-rounded'],
  ['star','users-group-rounded','flag'],
]
const emoji = [['💡','👥','📊'],['🧩','🔧','🏗️'],['📡','🔗','📷']]
const segments = scenes.map((scene,index)=>({start:index*2.5,end:(index+1)*2.5,text:scene.text}))
const semanticResponse = ()=>({phrases:scenes.map((scene,index)=>{
  const conceptos = scene.terms.map((etiqueta,term)=>({icono:solarIcons[index][term],ic:emoji[index][term],etiqueta}))
  return {phraseIndex:index+1,visualClips:[{keyword:scene.terms[0],timestamp:index*2.5+.05,
    duration:2.4,prompt:scene.text,conceptos,
    semantica:{relacion:scene.relation,ancla:conceptos[0],terminos:conceptos}}]}
})})
const invoke = (channel,payload)=>{
  const handler = ipcMain._invokeHandlers.get(channel)
  assert(handler,'IPC_MISSING:'+channel)
  return handler({sender:{isDestroyed:()=>false,send:()=>{}}},payload)
}

app.whenReady().then(async()=>{
  let window, exitCode = 1
  try {
    fs.mkdirSync(evidence,{recursive:true})
    process.env.DEEPSEEK_API_KEY = 'offline-editorial-test-fixture'
    global.fetch = async url=>{
      if(String(url).startsWith('https://api.deepseek.com/chat/completions')){
        semanticCalls++
        return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',
          message:{content:JSON.stringify(semanticResponse())}}]})}
      }
      forbiddenNetwork++
      throw new Error('NORMAL_ROUTE_NETWORK_FORBIDDEN:'+String(url))
    }
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url))forbiddenNetwork++
      callback({cancel:/^https?:/i.test(details.url)})
    })
    const main = require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    main.createProjectFiles(projectRoot,{id:'editorial-local-route',name:'Editorial local route',
      clips:[],timelineVideoClips:[],aiScript:scenes.map(s=>s.text).join(' ')})
    const loaded = await invoke('load-project',{projectPath:projectRoot})
    assert(loaded.success,'PROJECT_OPEN:'+loaded.error)
    const source = path.join(fixture,'black.mp4')
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
      'color=c=black:s=360x640:r=12:d=8','-c:v','libx264','-pix_fmt','yuv420p',source])
    const generated = await invoke('generate-timeline-assets',{
      scriptText:scenes.map(s=>s.text).join(' '),audioDuration:7.5,
      transcriptSegments:segments,newAudioSegments:segments,videoPath:source,
      weights:[0,0,0,100],iaStyle:'editorial',aspectRatio:'vertical',graphicsPercent:0,
      visualPresentationProfile:'editorial-local-bank-v2',modularCatalogRoot:catalogRoot,
      editorialFamilyColor:'auto',
    })
    assert(generated.success,'NORMAL_GENERATION:'+generated.error)
    const visuals = generated.clips.filter(clip=>clip.category==='visual')
    assert(visuals.length>=3,'VISUALS_TOO_FEW:'+visuals.length)
    assert(visuals.every(clip=>fs.existsSync(clip.path)&&fs.statSync(clip.path).size>0),
      'VISUAL_SIN_FICHERO')
    const plans = visuals.map(clip=>clip.visualRegeneration?.graphicData?.extra?.sceneSpec?.editorialBankV2)
    assert(plans.every(plan=>plan?.revision==='editorial-local-bank-2026-09-v2'),
      'LOCAL_BANK_NOT_PERSISTED')
    assert(plans.every(plan=>plan.hero&&plan.supports.length>=2&&plan.layers.length===3),
      'AUTO_ASSETS_OR_LAYERS_MISSING')
    window = new BrowserWindow({show:false,width:800,height:600,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist/catalog-matrix.html'))
    const js = code=>window.webContents.executeJavaScript(code)
    const state = {...loaded.data,visualPresentationProfile:'editorial-local-bank-v2',
      modularCatalogRoot:catalogRoot,editorialLocalAccent:'auto',timelineVideoClips:generated.clips}
    const saved = await js(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'SAVE:'+saved.error)
    const reopened = await js(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data?.timelineVideoClips?.filter(c=>c.category==='visual').length===visuals.length,
      'REOPEN_FAILED')
    const replay = await js(`window.electronAPI.regenerateGraphics(${JSON.stringify({
      mode:'modern-visual',aspectRatio:'vertical',resolution:'720p',
      modernVisuals:[{clipId:visuals[0].id,context:visuals[0].visualRegeneration}],
    })})`)
    assert(replay.success&&replay.clips?.[0]?.success&&fs.existsSync(replay.clips[0].path),
      'REPLAY_FAILED:'+replay.error)
    const destination = path.join(evidence,'normal-route-vertical.mp4')
    dialog.showSaveDialog = async()=>({canceled:false,filePath:destination})
    const exported = await js(`window.electronAPI.exportVideo(${JSON.stringify({
      clips:generated.clips,aspectRatio:'vertical',resolution:'720p',format:'mp4',quality:'medium',
      assignedTransitions:{},transitionDuration:.5,ajustesVideo:{},
    })})`)
    assert(exported.success&&fs.statSync(destination).size>0,'EXPORT_FAILED:'+exported.error)
    const result = {passed:true,semanticMode:'OFFLINE_MOCK',semanticCalls,forbiddenNetwork,
      visuals:visuals.length,visualSinFichero:0,families:plans.map(p=>p.family),
      assets:plans.map(p=>({hero:p.hero.assetId,supports:p.supports.map(s=>s.assetId),
        layers:p.layers.map(l=>l.catalogAssetId)})),saved:true,reopened:true,replayed:true,
      exported:destination,productUIInteracted:false}
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result));exitCode=0
  } catch(error) {
    fs.mkdirSync(evidence,{recursive:true})
    fs.writeFileSync(path.join(evidence,'failure.txt'),String(error?.stack||error))
    console.error(error?.stack||error)
  } finally {
    if(window&&!window.isDestroyed())window.destroy()
    global.fetch=originalFetch
    if(originalKey===undefined)delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY=originalKey
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}
    app.exit(exitCode)
  }
}).catch(error=>{console.error(error);app.exit(1)})
