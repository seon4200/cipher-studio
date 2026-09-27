const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const batchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-17')
const evidence=path.resolve(root,'../_cipher-editorial-catalog-1265/evidence/batch-p20-17')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
const fixture=createTestFixture('editorial-catalog-p20-17'),projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'));app.commandLine.appendSwitch('force-device-scale-factor','1');process.chdir(fixture)
const sha=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex')
const scenes=[
  {id:'microscope',hero:'microscopio de laboratorio',expected:'editorial-hero-microscopio-laboratorio-001',supports:['lente de microscopio','portaobjetos'],keyword:'MICROSCOPÍA',closing:'lente y muestra revelan detalle.'},
  {id:'seismograph',hero:'sismógrafo',expected:'editorial-hero-sismografo-001',supports:['sismograma','brújula magnética'],keyword:'SISMO',closing:'registra temblores en campo.'},
  {id:'electric-motor',hero:'motor eléctrico seccionado',expected:'editorial-hero-motor-electrico-seccionado-001',supports:['celda eléctrica','brújula magnética'],keyword:'MOTOR',closing:'electricidad y campo magnético producen movimiento.'},
  {id:'wind-turbine',hero:'aerogenerador',expected:'editorial-hero-aerogenerador-001',supports:['anemómetro','celda eléctrica'],keyword:'VIENTO',closing:'medir y almacenar energía.'},
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
    b.createProjectFiles(projectRoot,{id:'editorial-catalog-p20-17',clips:[],timelineVideoClips:[],aiScript:'Fixture instrumental de selección editorial.'})
    const legacy=new b.CuratedModularCatalogV1(catalogRoot);assert.deepEqual([legacy.verifyAll().listed,legacy.verifyAll().verified],[250,250])
    const before=new b.CuratedModularCatalogV2(catalogRoot),entriesBefore=before.entries().length
    const manifest=JSON.parse(fs.readFileSync(path.join(batchFolder,'manifest.json'),'utf8'))
    assert.equal(manifest.entries.length,20)
    const expectedRoles={'support':8,'hero-core':9,'rear-collage':1,'accent-mask':1,'background':1}
    for(const [role,count] of Object.entries(expectedRoles))assert.equal(manifest.entries.filter(x=>x.role===role).length,count,role)
    const ids=new Set(),shas=new Set()
    for(const entry of manifest.entries){assert(!ids.has(entry.assetId));ids.add(entry.assetId);assert(!shas.has(entry.sha256));shas.add(entry.sha256)}
    const alreadyActive=manifest.entries.every(entry=>before.getById(entry.assetId)?.sha256===entry.sha256)
    if(!alreadyActive){
      assert(manifest.entries.every(entry=>before.getById(entry.assetId)===undefined),'PARTIAL_BATCH_ALREADY_ACTIVE')
      const preview=b.previewEditorialCatalogBatchV2(catalogRoot,batchFolder)
      assert.deepEqual([preview.accepted,preview.metadataRevisions,preview.duplicates,preview.rejected.length],[20,0,0,0],JSON.stringify(preview))
      b.activateEditorialCatalogBatchV2(catalogRoot,batchFolder)
    }
    const catalog=new b.CuratedModularCatalogV2(catalogRoot),health=catalog.verifyAll()
    const expectedCount=entriesBefore+(alreadyActive?0:20)
    assert.deepEqual([health.listed,health.verified],[expectedCount,expectedCount],JSON.stringify(health.failures))
    for(const entry of manifest.entries){
      assert.equal(sha(catalog.resolveAsset(entry.assetId)),entry.sha256,entry.assetId)
      const query=entry.primaryWordEs
      if(['support','hero-core','rear-collage','background'].includes(entry.role))
        assert(catalog.searchEditorialLocalV2(query,entry.role).some(x=>x.asset.assetId===entry.assetId),'SEARCH:'+entry.assetId)
    }
    const imported=Object.fromEntries(manifest.entries.map(entry=>[entry.assetId,catalog.publish(projectRoot,entry.assetId)]))
    for(const entry of manifest.entries)assert.equal(imported[entry.assetId].asset.sha256,entry.sha256,'PROJECT_ASSET:'+entry.assetId)
    const outputs=[]
    for(const orientation of ['portrait','landscape'])for(const item of scenes){
      const concepts=[item.hero,...item.supports]
      if(item.id==='microscope')concepts.push('microscopía','archivo de microscopía')
      const semantic=b.createLocalSceneSemanticV1({sceneId:'p20-17-'+item.id,start:0,end:3,
        transcriptSegments:[{start:0,end:3,text:`${item.keyword} ${item.closing}`}],anchor:item.hero,
        concepts:concepts.map((label,index)=>({label,scope:'scene',...(index===0?{start:0,end:3}:{})}))
          .concat([{label:'papel verjurado perla',scope:'context'}]),globalText:`${item.keyword} ${item.closing}`})
      const contextual=b.selectEditorialLocalBankV3Detailed({catalog,semantic})
      assert.equal(contextual.trace.outcome,'SELECTED',`${item.id}:${JSON.stringify(contextual.trace)}`)
      assert.equal(contextual.selection.heroId,item.expected,`${item.id}:HERO_SELECTION`)
      assert(contextual.selection.supportIds.length>=2&&contextual.selection.supportIds.length<=4,`${item.id}:SUPPORT_BUDGET`)
      for(const term of item.supports)assert(contextual.selection.supportIds.includes(catalog.searchEditorialLocalV2(term,'support')[0]?.asset.assetId),`${item.id}:SUPPORT:${term}`)
      assert.equal(contextual.selection.backgroundId,'editorial-background-papel-verjurado-perla-001',`${item.id}:BACKGROUND`)
      if(item.id==='microscope')assert.equal(contextual.selection.rearId,'editorial-paper-microscopia-ancho-001')
      const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:3,localSemantic:semantic,
        keywordCandidates:[{keyword:item.keyword,source:'scene-semantic'}],preferredVisualMode:'editorial-text',sistema:'editorial',
        direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:51721},videoStyleId:'cream-editorial'})
      const template=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
      const selection={...contextual.selection,reason:'P20-17 context-ranked selection acceptance',missingTerms:[]}
      for(const id of [selection.heroId,...selection.supportIds,selection.rearId,selection.accentId,selection.backgroundId].filter(Boolean))
        if(!imported[id])imported[id]=catalog.publish(projectRoot,id)
      const built=b.bindEditorialLocalBankV2({template,catalog,imported,selection,color:'#A83B19',contract:b.EDITORIAL_LOCAL_BANK_V3,
        headline:{connector:'El',keyword:item.keyword,closing:item.closing}})
      b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,renderBindings:built.renderBindings})
      let qc=null
      console.log(`RENDER_START ${orientation} ${item.id}`)
      const mp4Source=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
        alto:orientation==='portrait'?1280:720,fps:24,duracion:3,modo:'pantalla',sistema:'editorial',projectRoot,
        renderBindings:built.renderBindings,onQcReport:value=>{qc=value},onQcFailure:value=>{qc=value}})
      assert(mp4Source&&fs.existsSync(mp4Source),`VISUAL_SIN_FICHERO:${orientation}:${item.id}:${JSON.stringify(qc)}`)
      const findings=Array.isArray(qc)?qc.flatMap(x=>x.findings??[]):qc?.findings??[]
      assert.deepEqual(findings,[],`QC:${orientation}:${item.id}`)
      const stem=`${orientation}-${item.id}`,mp4=path.join(evidence,stem+'.mp4'),frame=path.join(evidence,stem+'-stable.png')
      fs.copyFileSync(mp4Source,mp4)
      execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss','1.6','-i',mp4,'-frames:v','1',frame])
      outputs.push({orientation,scene:item.id,selectedHero:selection.heroId,selectedSupports:selection.supportIds,
        selectedRear:selection.rearId??null,selectedAccent:selection.accentId,selectedBackground:selection.backgroundId,
        family:selection.family,mp4,mp4Sha256:sha(fs.readFileSync(mp4)),frame,frameSha256:sha(fs.readFileSync(frame)),qc:[]})
      console.log(`RENDER_DONE ${orientation} ${item.id}`)
    }
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION');assert.equal(outputs.length,8)
    const report={passed:true,batch:manifest.id,acceptedAssets:20,roles:expectedRoles,catalogListed:health.listed,catalogVerified:health.verified,
      contextualHeroCases:scenes.length,orientations:['portrait','landscape'],fps:24,sceneDurationSeconds:3,renderCount:outputs.length,
      noNetworkAfterMaterialization:true,visualSinFichero:0,qcErrors:0,batchAlreadyActiveAtStart:alreadyActive,outputs}
    fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(report,null,2)+'\n')
    assert.equal(legacy.verifyAll().verified,250,'BASE_250_SHA_PARITY')
    console.log(JSON.stringify({passed:true,batch:manifest.id,accepted:manifest.entries.length,catalogListed:health.listed,
      contextualHeroCases:scenes.length,renders:outputs.length,visualSinFichero:0,networkAttempts,evidence},null,2));code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
