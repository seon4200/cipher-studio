const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const fixture=createTestFixture('editorial-local-bank-v4-controlled')
const projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    const b=require(path.join(root,'dist-electron/main/index.js'))
    const rejectedRelation={relacion:'separa',ancla:{icono:'water',ic:'💧',etiqueta:'líquido'},
      terminos:[{icono:'water',ic:'💧',etiqueta:'líquido'},
        {icono:'document',ic:'📄',etiqueta:'muestra'},
        {icono:'chart',ic:'📊',etiqueta:'componentes'}]}
    assert.equal(b.diagnosticarSemanticaVisual(rejectedRelation),'RELACION_FUERA_DE_ENUM')
    assert.equal(b.sanearSemanticaVisual(rejectedRelation),null,'UNKNOWN_RELATION_STILL_REJECTED')
    assert.equal(b.diagnosticarSemanticaVisual({...rejectedRelation,relacion:'estratifica'}),null)
    assert.equal(b.editorialVisibleExcerptV4(
      'Cromatógrafo líquido analiza vial de muestra y micropipeta automática; hoja de registro conserva datos.',3),
      'Cromatógrafo líquido analiza vial de muestra')
    assert.equal(b.editorialVisibleExcerptV4('No desaparece el peligro ni se conocen las causas.',3),
      'No desaparece el peligro')
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)}))
    let networkAttempts=0
    global.fetch=async url=>{networkAttempts++;throw Error('NETWORK_FORBIDDEN_AFTER_MATERIALIZATION:'+String(url))}
    b.createProjectFiles(projectRoot,{id:'v4-controlled',clips:[],timelineVideoClips:[],aiScript:'Prueba temporal.'})
    const catalog=new b.CuratedModularCatalogV2(catalogRoot)
    const health=catalog.verifyAll()
    assert.equal(health.failures.length,0,JSON.stringify(health.failures))
    assert.equal(b.preflightEditorialLocalCatalogV3(undefined,0),null,'ZERO_VISUAL_QUOTA_NEEDS_NO_CATALOG')
    const semantic=b.createLocalSceneSemanticV1({sceneId:'v4-controlled',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'El cromatógrafo líquido analiza una muestra.'}],
      anchor:'cromatógrafo líquido',concepts:[{label:'cromatógrafo líquido',scope:'scene'}],
      globalText:'El cromatógrafo líquido analiza una muestra.'})
    const selectionResult=b.selectEditorialLocalBankV4Detailed({catalog,semantic})
    assert.equal(selectionResult.trace.outcome,'SELECTED',JSON.stringify(selectionResult.trace))
    const selection=selectionResult.selection
    assert(selection.heroId&&selection.supportIds.length<2,'HERO_MUST_NOT_REQUIRE_TWO_SUPPORTS')
    assert(selection.backgroundId,'HERO_METADATA_MUST_SELECT_COMPATIBLE_BACKGROUND_WITHOUT_PAPER_IN_SCRIPT')
    assert(selection.accentId,'HERO_OR_BACKGROUND_METADATA_MUST_SELECT_COMPATIBLE_ACCENT')
    assert.equal(selection.rearId,undefined,'INCOMPATIBLE_REAR_MUST_BE_OMITTED')
    assert(selectionResult.trace.layerDecisions?.some(item=>item.role==='rear-collage'&&
      item.reason==='NO_COMPATIBLE_REAR'),'REAR_OMISSION_MUST_HAVE_EXPLICIT_REASON')
    assert(!catalogRoot.includes(selection.heroId),'NO_PHYSICAL_PATH_AS_ASSET_ID')
    const active=JSON.parse(fs.readFileSync(path.join(catalogRoot,'extension-v2','active.json'),'utf8'))
    const activeIds=new Set(active.batches.flatMap(batch=>JSON.parse(fs.readFileSync(
      path.join(catalogRoot,'extension-v2','batches',batch.id,'manifest.json'),'utf8')).entries.map(item=>item.assetId)))
    assert(activeIds.has(selection.heroId),'SCRIPT_DID_NOT_FIX_AN_ASSET_ID_BUT_MUST_REACH_ACTIVE_EXTENSION')
    const missingSemantic=b.createLocalSceneSemanticV1({sceneId:'v4-literal-recovery',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'Un cromatógrafo líquido analiza una muestra.'}],
      anchor:'líquido',concepts:[{label:'muestra',scope:'scene'}]})
    const recovered=b.selectEditorialLocalBankV4Detailed({catalog,semantic:missingSemantic})
    assert.equal(recovered.selection?.heroId,selection.heroId,'LITERAL_TRANSCRIPT_HERO_RECOVERY')
    assert(recovered.trace.literalTerms?.length,'LITERAL_EVIDENCE_RECORDED')
    const abstractSemantic=b.createLocalSceneSemanticV1({sceneId:'v4-abstract',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'Ninguna certeza basta para responder.'}],
      anchor:'certeza',concepts:[{label:'certeza',scope:'scene'}]})
    const abstract=b.selectEditorialLocalBankV4Detailed({catalog,semantic:abstractSemantic})
    assert.equal(abstract.trace.outcome,'NO_HERO','ABSTRACT_MUST_NOT_INVENT_ASSET')
    const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:3,
      localSemantic:semantic,keywordCandidates:[{keyword:'cromatógrafo',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',
        camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:51721},videoStyleId:'cream-editorial'})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const ids=[selection.heroId,...selection.supportIds,selection.rearId,selection.accentId,selection.backgroundId].filter(Boolean)
    const imported=Object.fromEntries([...new Set(ids)].map(id=>[id,catalog.publish(projectRoot,id)]))
    const bind=(color='#A83B19',colorMode='auto')=>b.bindEditorialLocalBankV2({template:base,catalog,imported,selection,color,
      contract:b.EDITORIAL_LOCAL_BANK_V4,
      sceneDecision:{sceneId:semantic.sceneId,localText:semantic.localText,anchor:semantic.anchor??'',
        evidence:semantic.directEvidence.map(item=>item.query),durationSeconds:3,
        selectionReason:selection.reason,familyReason:selection.reason,missingTerms:selection.missingTerms,
        colorMode,seed:51721},
      headline:{connector:'El',keyword:'CROMATÓGRAFO',closing:'analiza una muestra.'}})
    const built=bind(),replayed=bind(),recolored=bind('#238C87','manual')
    assert.equal(built.pixelIdentity,replayed.pixelIdentity)
    assert.notEqual(built.pixelIdentity,recolored.pixelIdentity,'VISIBLE_COLOR_MUST_CHANGE_IDENTITY')
    assert.equal(built.sceneSpec.presentationProfile.revision,b.EDITORIAL_LOCAL_BANK_V4.revision)
    assert(!built.pixelIdentity.includes(catalogRoot)&&!built.pixelIdentity.includes(projectRoot))
    b.validateVisualSceneSpecV2(built.sceneSpec)
    b.validateRenderBindingsAny(built.renderBindings,built.sceneSpec)
    b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,renderBindings:built.renderBindings})
    const outputs=[]
    for(const orientation of ['portrait','landscape']){
      let qc=null
      const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
        alto:orientation==='portrait'?1280:720,fps:24,duracion:3,modo:'pantalla',sistema:'editorial',
        projectRoot,renderBindings:built.renderBindings,onQcReport:value=>{qc=value},onQcFailure:value=>{qc=value}})
      assert(file&&fs.existsSync(file),'VISUAL_SIN_FICHERO:'+orientation+':'+JSON.stringify(qc))
      outputs.push({orientation,file,qc:qc?.findings??[]})
    }
    assert.equal(networkAttempts,0)
    console.log(JSON.stringify({passed:true,profile:built.sceneSpec.presentationProfile,
      catalogAssets:health.verified,heroId:selection.heroId,supportIds:selection.supportIds,
      family:selection.family,layerDecisions:selectionResult.trace.layerDecisions,
      identitySha256:crypto.createHash('sha256').update(built.pixelIdentity).digest('hex'),
      networkAttempts,outputs}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
