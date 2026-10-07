// Eight independent synthetic video themes demonstrate each procedural recipe.
// Within a real video the selector only rotates inside one compatible group.
const {app,session,ipcMain}=require('electron')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {spawnSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const repo=path.resolve(__dirname,'../../..'),out=path.resolve(repo,'../_families-motion-v2-evidence')
const fixture=createTestFixture('families-v2-backgrounds'),project=path.join(fixture,'project')
const palettes=['blue-tech','cyan-digital','green-nature','sunset-energy','purple-cosmic',
  'red-alert','magenta-creative','silver-industrial','yellow-energy']
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','2.25')
process.chdir(fixture)
let bundle
function contextFor(id,palette,seed){
  const text='Una cámara registra la escena.'
  const localSemantic=bundle.createLocalSceneSemanticV1({sceneId:id,start:0,end:2.4,
    transcriptSegments:[{start:0,end:2.4,text}],
    concepts:[{label:'cámara',canonicalHint:'camera',emoji:'📷',start:.1,end:2.2,scope:'scene'}],
    anchor:'cámara',relation:'documenta',globalText:text,globalHints:[],globalContextRef:'synthetic:background-v2'})
  return bundle.createModernVisualGenerationContextV2({sceneId:id,duration:2.4,localSemantic,
    keywordCandidates:[{keyword:'CÁMARA',source:'scene-semantic'}],preferredVisualMode:'auto',sistema:'editorial',
    direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:seed},
    videoStyleId:'cream-editorial',presentationProfile:bundle.FAMILIES_MOTION_PROFILE_V2,
    visualAssetPack:bundle.MODERN_VISUAL_PACK_V1,
    colorPalettePlan:{version:1,primaryFamily:palette,compatibleFamilies:[],revision:bundle.COLOR_PALETTE_REVISION_V1}})
}
app.whenReady().then(async()=>{let code=1;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  bundle=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  bundle.createProjectFiles(project,{id:'families-v2-background-temp',clips:[],timelineVideoClips:[],aiScript:'synthetic background variants'})
  const records=[]
  for(const variant of bundle.BACKGROUND_VARIANTS_V2){
    let found=null
    for(const palette of palettes){
      for(let index=0;index<80;index++){
        const id=`background-${variant}-${index}`
        const selection=bundle.selectCompositionV2({family:'marcoPoster',mode:'asset-led',supportCount:0,
          seed:48001+index,sceneId:id,cue:'protagonist',heroKind:'simple-icon',videoPaletteFamily:palette})
        if(selection.backgroundVariant===variant){found={id,palette,index};break}
      }
      if(found)break
    }
    assert(found,`BACKGROUND_VARIANT_UNREACHABLE:${variant}`)
    const resolved=(await bundle.resolveModernVisualGenerationBatchV2({contexts:[contextFor(found.id,
      found.palette,48001+found.index)],projectRoot:project}))[0]
    const spec=resolved.resolved.compiled.sceneSpec
    assert.equal(spec.compositionV2.backgroundVariant,variant,`BACKGROUND_SELECTION_DRIFT:${variant}`)
    let qc;const clip=await bundle.renderGraphicClip(resolved.resolved.compiled.graphicData,{ancho:540,alto:960,
      fps:24,duracion:2.4,modo:'pantalla',sistema:'editorial',projectRoot:project,
      renderBindings:resolved.resolved.compiled.renderBindings,onQcReport:v=>qc=v,onQcFailure:v=>qc=v})
    assert(clip&&fs.existsSync(clip),`BACKGROUND_RENDER_FAILED:${variant}:${JSON.stringify(qc?.findings)}`)
    const video=path.join(out,`background-${variant}.mp4`),still=path.join(out,`background-${variant}.png`)
    fs.copyFileSync(clip,video)
    const frame=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','1.4','-i',video,
      '-frames:v','1','-update','1',still],{encoding:'utf8'})
    assert.equal(frame.status,0,frame.stderr)
    records.push({variant,palette:found.palette,sceneId:found.id,family:spec.layout.family,video,still,
      qc:qc?.findings||[]})
    console.log('BACKGROUND_V2',variant,found.palette)
  }
  fs.writeFileSync(path.join(out,'background-variants.json'),JSON.stringify(records,null,2))
  const cards=records.map(r=>`<article><img src="${path.basename(r.still)}"><h2>${r.variant}</h2><p>${r.palette}</p></article>`).join('')
  fs.writeFileSync(path.join(out,'backgrounds-v2.html'),`<!doctype html><meta charset="utf-8"><title>8 fondos V2</title><style>body{background:#111;color:#eee;font:16px system-ui;margin:2rem}main{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}article{background:#222;padding:1rem}img{width:100%;max-height:500px;object-fit:contain}</style><h1>Fondos V2 · vídeos sintéticos independientes</h1><main>${cards}</main>`)
  code=0
}catch(error){console.error(error)}finally{
  try{bundle?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}
  catch(error){console.error(error);code=1}app.exit(code)
}})
