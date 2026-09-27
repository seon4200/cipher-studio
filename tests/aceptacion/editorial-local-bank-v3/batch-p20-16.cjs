const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const batchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-16')
const evidence=path.resolve(root,'../_cipher-editorial-catalog-1265/evidence/batch-p20-16')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
const fixture=createTestFixture('editorial-catalog-p20-16'),projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'));app.commandLine.appendSwitch('force-device-scale-factor','1');process.chdir(fixture)
const sha=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex')
const scenes=[
  {id:'weather-radar',hero:'editorial-hero-radar-meteorologico-001',supports:['editorial-support-barometro-001','editorial-support-globo-meteorologico-001'],rear:'editorial-paper-registro-meteorologico-001',accent:'editorial-accent-ovalo-papel-001',keyword:'RADAR',closing:'observa el tiempo.'},
  {id:'soil-sample',hero:'editorial-hero-barrena-muestreo-suelo-001',supports:['editorial-support-muestra-suelo-001','editorial-support-raices-hidroponicas-001'],rear:'editorial-paper-muestreo-suelo-001',accent:'editorial-accent-panel-vertical-001',keyword:'SUELO',closing:'revela sus capas.'},
  {id:'hydroponics',hero:'editorial-hero-canal-hidroponico-001',supports:['editorial-support-raices-hidroponicas-001','editorial-support-muestra-suelo-001'],rear:'editorial-paper-hidroponia-ancho-001',accent:'editorial-accent-poligono-diagonal-001',keyword:'CULTIVO',closing:'circula por el canal.'},
  {id:'electric-bus',hero:'editorial-hero-autobus-electrico-urbano-001',supports:['editorial-support-senal-transito-001','editorial-support-barometro-001'],rear:undefined,accent:'editorial-accent-ovalo-papel-001',keyword:'MOVILIDAD',closing:'señales y clima guían la ruta.'},
  {id:'tram-route',hero:'editorial-hero-tranvia-moderno-001',supports:['editorial-support-senal-transito-001','editorial-support-planisferio-celeste-001'],rear:'editorial-paper-rutas-tranvia-001',accent:'editorial-accent-panel-vertical-001',keyword:'TRANVÍA',closing:'sigue una ruta.'},
  {id:'nautical-astrolabe',hero:'editorial-hero-astrolabio-nautico-001',supports:['editorial-support-planisferio-celeste-001','editorial-support-barometro-001'],rear:undefined,accent:'editorial-accent-poligono-diagonal-001',keyword:'NAVEGAR',closing:'lee el cielo y el mar.'},
]
app.whenReady().then(async()=>{
  let code=1
  try{
    assert(fs.existsSync(ffmpeg),'FFMPEG_MISSING:'+ffmpeg);fs.mkdirSync(evidence,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed');ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)}))
    let networkAttempts=0;global.fetch=async url=>{networkAttempts++;throw Error('NETWORK_FORBIDDEN_AFTER_MATERIALIZATION:'+String(url))}
    b.createProjectFiles(projectRoot,{id:'editorial-catalog-p20-16',clips:[],timelineVideoClips:[],aiScript:'Fixture de importación editorial.'})
    const legacy=new b.CuratedModularCatalogV1(catalogRoot);assert.deepEqual([legacy.verifyAll().listed,legacy.verifyAll().verified],[250,250])
    const before=new b.CuratedModularCatalogV2(catalogRoot),entriesBefore=before.entries().length
    const expectedRoles={'support':6,'hero-core':6,'rear-collage':4,'accent-mask':3,'background':1}
    const manifest=JSON.parse(fs.readFileSync(path.join(batchFolder,'manifest.json'),'utf8'))
    assert.equal(manifest.entries.length,20)
    for(const [role,count] of Object.entries(expectedRoles))assert.equal(manifest.entries.filter(x=>x.role===role).length,count,role)
    const ids=new Set(),shas=new Set()
    for(const entry of manifest.entries){
      assert(!ids.has(entry.assetId));ids.add(entry.assetId);assert(!shas.has(entry.sha256));shas.add(entry.sha256)
    }
    const alreadyActive=manifest.entries.every(entry=>before.getById(entry.assetId)?.sha256===entry.sha256)
    if(!alreadyActive){
      assert(manifest.entries.every(entry=>before.getById(entry.assetId)===undefined),'PARTIAL_BATCH_ALREADY_ACTIVE')
      const preview=b.previewEditorialCatalogBatchV2(catalogRoot,batchFolder)
      assert.deepEqual([preview.accepted,preview.metadataRevisions,preview.duplicates,preview.rejected.length],[20,0,0,0],JSON.stringify(preview))
      b.activateEditorialCatalogBatchV2(catalogRoot,batchFolder)
    }
    const catalog=new b.CuratedModularCatalogV2(catalogRoot),health=catalog.verifyAll()
    const expectedCatalogCount=entriesBefore+(alreadyActive?0:20)
    assert.deepEqual([health.listed,health.verified],[expectedCatalogCount,expectedCatalogCount],JSON.stringify(health.failures))
    for(const entry of manifest.entries){
      const found=catalog.getById(entry.assetId);assert(found,entry.assetId);assert.equal(sha(catalog.resolveAsset(entry.assetId)),entry.sha256)
      if(entry.role==='support'||entry.role==='hero-core'||entry.role==='rear-collage')
        assert(catalog.searchEditorialLocalV2(entry.primaryWordEs,entry.role).some(x=>x.asset.assetId===entry.assetId),`SEARCH:${entry.assetId}`)
    }
    const imported=Object.fromEntries(manifest.entries.map(entry=>[entry.assetId,catalog.publish(projectRoot,entry.assetId)]))
    for(const entry of manifest.entries)assert.equal(imported[entry.assetId].asset.sha256,entry.sha256,`PROJECT_ASSET:${entry.assetId}`)

    const outputs=[]
    for(const orientation of ['portrait','landscape'])for(const item of scenes){
      console.log(`RENDER_START ${orientation} ${item.id}`)
      const conceptLabels=[item.hero,...item.supports,item.rear].filter(Boolean)
        .map(id=>catalog.getById(id)?.primaryWordEs??id)
      const semantic=b.createLocalSceneSemanticV1({sceneId:'p20-16-'+item.id,start:0,end:3,
        transcriptSegments:[{start:0,end:3,text:`${item.keyword} ${item.closing}`}],anchor:item.keyword,
        concepts:[item.keyword,...conceptLabels].map(label=>({label,scope:'scene'})),
        globalText:`${item.keyword} ${item.closing}`})
      const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:3,localSemantic:semantic,
        keywordCandidates:[{keyword:item.keyword,source:'scene-semantic'}],preferredVisualMode:'editorial-text',sistema:'editorial',
        direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:51721},videoStyleId:'cream-editorial'})
      const template=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
      const selection={family:'editorial',variant:'base',heroId:item.hero,supportIds:item.supports,
        rearId:item.rear,accentId:item.accent,backgroundId:'editorial-background-papel-cartografico-claro-001',
        reason:'Batch p20-16 fixed acceptance fixture',missingTerms:[]}
      const built=b.bindEditorialLocalBankV2({template,catalog,imported,selection,color:'#A83B19',contract:b.EDITORIAL_LOCAL_BANK_V3,
        headline:{connector:'El',keyword:item.keyword,closing:item.closing}})
      b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,renderBindings:built.renderBindings})
      let qc=null
      const mp4Source=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
        alto:orientation==='portrait'?1280:720,fps:24,duracion:3,modo:'pantalla',sistema:'editorial',projectRoot,
        renderBindings:built.renderBindings,onQcReport:value=>{qc=value},onQcFailure:value=>{qc=value}})
      assert(mp4Source&&fs.existsSync(mp4Source),`VISUAL_SIN_FICHERO:${orientation}:${item.id}:${JSON.stringify(qc)}`)
      const qcFindings=Array.isArray(qc)?qc.flatMap(x=>x.findings??[]):qc?.findings??[]
      assert.deepEqual(qcFindings,[],`QC:${orientation}:${item.id}`)
      const stem=`${orientation}-${item.id}`,mp4=path.join(evidence,stem+'.mp4'),frame=path.join(evidence,stem+'-stable.png')
      fs.copyFileSync(mp4Source,mp4)
      execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss','1.6','-i',mp4,'-frames:v','1',frame])
      outputs.push({orientation,scene:item.id,heroId:item.hero,supportIds:item.supports,rearId:item.rear??null,accentId:item.accent,
        backgroundId:selection.backgroundId,mp4,mp4Sha256:sha(fs.readFileSync(mp4)),frame,frameSha256:sha(fs.readFileSync(frame)),qc:[]})
      console.log(`RENDER_DONE ${orientation} ${item.id}`)
    }
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    assert.equal(outputs.length,12)
    const report={passed:true,batch:manifest.id,acceptedAssets:20,roles:expectedRoles,catalogListed:health.listed,catalogVerified:health.verified,
      batchAlreadyActiveAtStart:alreadyActive,
      orientations:['portrait','landscape'],fps:24,sceneDurationSeconds:3,renderCount:12,noNetworkAfterMaterialization:true,
      visualSinFichero:0,qcErrors:0,outputs}
    fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify({passed:true,batch:manifest.id,accepted:manifest.entries.length,catalogListed:health.listed,
      renders:outputs.length,visualSinFichero:0,networkAttempts,evidence},null,2));code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
