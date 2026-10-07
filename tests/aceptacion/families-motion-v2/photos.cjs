// Captured provider-response acceptance for the V2 presentation profile.
// The three opaque sources are supplied explicitly from the earlier cutout
// spike corpus. They are never shipped or copied into the repository.
const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const repo=path.resolve(__dirname,'../../..'),out=path.resolve(repo,'../_families-motion-v2-evidence')
const fixture=createTestFixture('families-motion-v2-photos'),project=path.join(fixture,'project')
const source={camera:process.env.CIPHER_FAMILIES_V2_CAMERA_SOURCE,
  person:process.env.CIPHER_FAMILIES_V2_PERSON_SOURCE,
  context:process.env.CIPHER_FAMILIES_V2_CONTEXT_SOURCE}
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','2.25')
process.chdir(fixture)
let bundle
function ffmpeg(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],
  {encoding:'utf8',timeout:120000});if(r.status!==0)throw Error(`FFMPEG:${r.stderr}`)}
const rows=[
  {id:'photo-camera',text:'La cámara documenta el experimento.',keyword:'CÁMARA',
    relation:'documenta',concepts:[{label:'cámara',canonicalHint:'camera',emoji:'📷'}],kind:'camera'},
  {id:'photo-person',text:'La mujer observa una computadora portátil.',keyword:'PERSONA',
    relation:'observa',concepts:[{label:'mujer',canonicalHint:'woman',emoji:'👩'}],kind:'person'},
  {id:'photo-context',text:'La protesta ocupa la calle y reúne a una multitud.',keyword:'PROTESTA',
    relation:'contexto',concepts:[{label:'protesta',canonicalHint:'protest'}],kind:'context'},
]
function contextFor(row,index){
  const localSemantic=bundle.createLocalSceneSemanticV1({sceneId:row.id,start:0,end:2.4,
    transcriptSegments:[{start:0,end:2.4,text:row.text}],
    concepts:row.concepts.map(c=>({...c,start:.1,end:2.2,scope:'scene'})),
    anchor:row.concepts[0].label,relation:row.relation,globalText:row.text,
    globalHints:[],globalContextRef:'synthetic:families-v2-photo'})
  return bundle.createModernVisualGenerationContextV2({sceneId:row.id,duration:2.4,localSemantic,
    keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],preferredVisualMode:'auto',sistema:'editorial',
    direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:47001+index},
    videoStyleId:'cream-editorial',presentationProfile:bundle.FAMILIES_MOTION_PROFILE_V2,
    visualAssetPack:bundle.MODERN_VISUAL_PACK_V1,
    colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],revision:bundle.COLOR_PALETTE_REVISION_V1}})
}
function kindFor(query){return /camera|camara|cámara|fotograf/i.test(query)?'camera'
  :/woman|mujer|person|female/i.test(query)?'person'
    :/protest|protesta|crowd|multitud|street|calle/i.test(query)?'context':null}
function hit(query,kind){const tags={camera:'camera, photography, device',person:'woman, person, laptop',
  context:'protest, crowd, street'}[kind]
  return {id:{camera:47001,person:47002,context:47003}[kind],
    pageURL:`https://pixabay.com/photos/${kind}-recorded-4700/`,
    largeImageURL:`https://cdn.pixabay.com/photo/${kind}-recorded.jpg`,
    tags:`${tags}, ${query}`,imageWidth:1280,imageHeight:850,type:'photo'}}
app.whenReady().then(async()=>{let code=1;try{
  for(const [kind,file] of Object.entries(source)){
    if(!file||!fs.existsSync(file))throw Error(`SOURCE_REQUIRED:${kind}`)
  }
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  bundle=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  bundle.createProjectFiles(project,{id:'families-v2-photo-temp',clips:[],timelineVideoClips:[],aiScript:'synthetic photo acceptance'})
  const hooks={searchRequestJson:async url=>{const query=String(url.searchParams.get('q')||'')
    const kind=kindFor(query);return {hits:kind?[hit(query,kind)]:[]}},
    downloadRequestBytes:async url=>{const kind=/camera-recorded/.test(String(url))?'camera'
      :/person-recorded/.test(String(url))?'person':/context-recorded/.test(String(url))?'context':null
      if(!kind)throw Error('UNEXPECTED_DOWNLOAD');return fs.readFileSync(source[kind])}}
  const records=[]
  for(let i=0;i<rows.length;i++){
    const row=rows[i]
    const result=(await bundle.resolveModernVisualGenerationBatchV2({contexts:[contextFor(row,i)],
      projectRoot:project,pixabayApiKey:'recorded-response',hooks}))[0]
    const spec=result.resolved.compiled.sceneSpec
    const choices=result.resolved.choices.map(c=>({slotId:c.slotId,provider:c.provider,
      representation:c.representation,kind:c.kind,sha256:c.asset?.sha256||null}))
    const views={}
    for(const [orientation,width,height] of [['vertical',540,960],['horizontal',960,540]]){
      let qc;const file=await bundle.renderGraphicClip(result.resolved.compiled.graphicData,
        {ancho:width,alto:height,fps:24,duracion:2.4,modo:'pantalla',sistema:'editorial',
          projectRoot:project,renderBindings:result.resolved.compiled.renderBindings,
          onQcReport:x=>qc=x,onQcFailure:x=>qc=x})
      if(!file||!fs.existsSync(file))throw Error(`PHOTO_RENDER_FAILED:${row.id}:${orientation}:${JSON.stringify(qc?.findings)}`)
      const mp4=path.join(out,`${row.id}-${orientation}.mp4`),png=path.join(out,`${row.id}-${orientation}.png`)
      fs.copyFileSync(file,mp4);ffmpeg(['-ss','1.4','-i',mp4,'-frames:v','1','-update','1',png])
      views[orientation]={mp4,png,findings:qc?.findings||[]}
    }
    records.push({id:row.id,text:row.text,family:spec.layout.family,
      layoutVariant:spec.compositionV2?.layoutVariant,choices,views})
    console.log('PHOTO_V2',row.id,JSON.stringify(choices))
  }
  fs.writeFileSync(path.join(out,'photos.json'),JSON.stringify(records,null,2))
  const providers=records.flatMap(r=>r.choices.map(c=>c.provider))
  code=providers.includes('photo-cutout')&&providers.includes('pixabay-images')?0:1
}catch(error){console.error(error)}finally{
  try{const debug=path.join(fixture,'cipher-studio','generation-debug.log')
    if(fs.existsSync(debug))fs.copyFileSync(debug,path.join(out,'photo-generation-debug.log'))
    bundle?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)
  }catch(error){console.error(error);code=1}app.exit(code)
}})
