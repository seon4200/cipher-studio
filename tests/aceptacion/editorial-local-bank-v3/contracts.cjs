const {app}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const batchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-04')
const backgroundBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-05')
const thermometerBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-06')
const fireBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-07')
const paperBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-10')
const accentBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-09')
const backingAccentBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-11')
const heroBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-12')
const heroExpansionBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-13')
const paperExpansionBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-14')
const accentExpansionBatchFolder=path.resolve(root,'../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-15')
const fixture=createTestFixture('editorial-local-bank-v3')
const projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    const b=require(path.join(root,'dist-electron/main/index.js'))
    const activePath=path.join(catalogRoot,'extension-v2','active.json')
    const legacy=new b.CuratedModularCatalogV1(catalogRoot)
    const legacyHealth=legacy.verifyAll()
    assert.deepEqual([legacyHealth.listed,legacyHealth.verified],[250,250])
    const before=new b.CuratedModularCatalogV2(catalogRoot),beforeHealth=before.verifyAll()
    const priorPointer=fs.existsSync(activePath)?fs.readFileSync(activePath):null
    const preview=b.previewEditorialCatalogBatchV2(catalogRoot,batchFolder)
    const alreadyPresent=before.getById('editorial-support-turbina-hidroelectrica-001')
    assert.equal(preview.accepted,alreadyPresent?0:1)
    assert.equal(preview.metadataRevisions,alreadyPresent?1:0)
    assert.equal(preview.rejected.length,0)

    const corrupt=path.join(fixture,'bad-batch');fs.cpSync(batchFolder,corrupt,{recursive:true})
    const manifest=JSON.parse(fs.readFileSync(path.join(corrupt,'manifest.json'),'utf8'))
    const runtime=path.join(corrupt,...manifest.entries[0].runtimeRef.split('/'))
    const bytes=fs.readFileSync(runtime);bytes[bytes.length-10]^=1;fs.writeFileSync(runtime,bytes)
    const badPreview=b.previewEditorialCatalogBatchV2(catalogRoot,corrupt)
    assert(badPreview.rejected.some(item=>item.reason.includes('SHA_MISMATCH')),
      JSON.stringify(badPreview.rejected))
    assert.throws(()=>b.activateEditorialCatalogBatchV2(catalogRoot,corrupt),/ATOMIC_REJECT/)
    assert.deepEqual(fs.existsSync(activePath)?fs.readFileSync(activePath):null,priorPointer,
      'INVALID_BATCH_MUST_NOT_CHANGE_ACTIVE_POINTER')

    if(!alreadyPresent)b.activateEditorialCatalogBatchV2(catalogRoot,batchFolder)
    const composite=new b.CuratedModularCatalogV2(catalogRoot)
    const health=composite.verifyAll()
    assert.deepEqual([health.listed,health.verified],[beforeHealth.listed+(alreadyPresent?0:1),beforeHealth.verified+(alreadyPresent?0:1)],JSON.stringify(health.failures))
    assert.equal(composite.searchEditorialLocalV2('glaciares','support')[0]?.asset.assetId,
      'editorial-support-glaciar-001')
    assert.equal(composite.searchEditorialLocalV2('glacier','support')[0]?.asset.assetId,
      'editorial-support-glaciar-001')
    assert.equal(composite.searchEditorialLocalV2('coral reef','support')[0]?.asset.assetId,
      'editorial-support-arrecife-001')
    assert.equal(composite.searchEditorialLocalV2('crecida','support')[0]?.asset.assetId,
      'editorial-support-inundacion-001')
    assert.equal(composite.searchEditorialLocalV2('flood','support')[0]?.asset.assetId,
      'editorial-support-inundacion-001')
    assert.equal(composite.searchEditorialLocalV2('turbina hidroeléctrica','support')[0]?.asset.assetId,
      'editorial-support-turbina-hidroelectrica-001')
    const backgroundPreview=b.previewEditorialCatalogBatchV2(catalogRoot,backgroundBatchFolder)
    assert.equal(backgroundPreview.rejected.length,0,JSON.stringify(backgroundPreview.rejected))
    const backgroundAlreadyPresent=Boolean(composite.getById('editorial-background-papel-marfil-fibras-001'))
    if(!backgroundAlreadyPresent)
      b.activateEditorialCatalogBatchV2(catalogRoot,backgroundBatchFolder)
    const completeCatalog=new b.CuratedModularCatalogV2(catalogRoot)
    assert.equal(completeCatalog.verifyAll().listed,beforeHealth.listed+(backgroundAlreadyPresent?0:1))
    assert.equal(completeCatalog.searchEditorialLocalV2('papel editorial','background')[0]?.asset.assetId,
      'editorial-background-papel-marfil-fibras-001')
    const thermometerPreview=b.previewEditorialCatalogBatchV2(catalogRoot,thermometerBatchFolder)
    assert.equal(thermometerPreview.rejected.length,0,JSON.stringify(thermometerPreview.rejected))
    const thermometerAlreadyPresent=Boolean(completeCatalog.getById('editorial-support-temperatura-001'))
    if(!thermometerAlreadyPresent)
      b.activateEditorialCatalogBatchV2(catalogRoot,thermometerBatchFolder)
    const acceptedCatalog=new b.CuratedModularCatalogV2(catalogRoot)
    assert.deepEqual([acceptedCatalog.verifyAll().listed,acceptedCatalog.verifyAll().verified],
      [completeCatalog.verifyAll().listed+(thermometerAlreadyPresent?0:1),completeCatalog.verifyAll().verified+(thermometerAlreadyPresent?0:1)])
    assert.equal(acceptedCatalog.searchEditorialLocalV2('temperatura','support')[0]?.asset.assetId,
      'editorial-support-temperatura-001')
    assert.equal(acceptedCatalog.searchEditorialLocalV2('thermometer','support')[0]?.asset.assetId,
      'editorial-support-temperatura-001')
    const firePreview=b.previewEditorialCatalogBatchV2(catalogRoot,fireBatchFolder)
    assert.equal(firePreview.rejected.length,0,JSON.stringify(firePreview.rejected))
    const fireAlreadyPresent=Boolean(acceptedCatalog.getById('editorial-support-incendio-001'))
    if(!fireAlreadyPresent)
      b.activateEditorialCatalogBatchV2(catalogRoot,fireBatchFolder)
    const finalCatalog=new b.CuratedModularCatalogV2(catalogRoot)
    assert.deepEqual([finalCatalog.verifyAll().listed,finalCatalog.verifyAll().verified],
      [acceptedCatalog.verifyAll().listed+(fireAlreadyPresent?0:1),acceptedCatalog.verifyAll().verified+(fireAlreadyPresent?0:1)])
    assert.equal(finalCatalog.searchEditorialLocalV2('incendio','support')[0]?.asset.assetId,
      'editorial-support-incendio-001')
    assert.equal(finalCatalog.searchEditorialLocalV2('fire','support')[0]?.asset.assetId,
      'editorial-support-incendio-001')
    const paperPreview=b.previewEditorialCatalogBatchV2(catalogRoot,paperBatchFolder)
    assert.equal(paperPreview.rejected.length,0,JSON.stringify(paperPreview.rejected))
    const paperAlreadyPresent=Boolean(finalCatalog.getById('editorial-paper-laboratorio-temperatura-002'))
    if(!paperAlreadyPresent)b.activateEditorialCatalogBatchV2(catalogRoot,paperBatchFolder)
    const accentPreview=b.previewEditorialCatalogBatchV2(catalogRoot,accentBatchFolder)
    assert.equal(accentPreview.rejected.length,0,JSON.stringify(accentPreview.rejected))
    const accentAlreadyPresent=Boolean(finalCatalog.getById('editorial-accent-vermilion-sweep-001'))
    assert.equal(accentPreview.accepted,accentAlreadyPresent?0:1,JSON.stringify(accentPreview))
    assert.equal(accentPreview.metadataRevisions,accentAlreadyPresent?1:0,JSON.stringify(accentPreview))
    if(!accentAlreadyPresent)b.activateEditorialCatalogBatchV2(catalogRoot,accentBatchFolder)
    const backingAccentPreview=b.previewEditorialCatalogBatchV2(catalogRoot,backingAccentBatchFolder)
    assert.equal(backingAccentPreview.rejected.length,0,JSON.stringify(backingAccentPreview))
    const backingAccentAlreadyPresent=Boolean(new b.CuratedModularCatalogV2(catalogRoot)
      .getById('editorial-accent-placa-cuadrada-desigual-001'))
    if(!backingAccentAlreadyPresent)b.activateEditorialCatalogBatchV2(catalogRoot,backingAccentBatchFolder)
    const layerCatalog=new b.CuratedModularCatalogV2(catalogRoot)
    assert.equal(layerCatalog.verifyAll().listed,finalCatalog.verifyAll().listed+
      (paperAlreadyPresent?0:1)+(accentAlreadyPresent?0:1)+(backingAccentAlreadyPresent?0:1))
    assert.equal(layerCatalog.searchEditorialLocalV2('cuaderno de laboratorio','rear-collage')[0]?.asset.assetId,
      'editorial-paper-laboratorio-temperatura-002')
    assert.equal(layerCatalog.getById('editorial-paper-laboratorio-temperatura-002').surfaceProfile,
      'continuous-filled-v1')
    assert.equal(layerCatalog.getById('editorial-accent-vermilion-sweep-001').surfaceProfile,
      'continuous-filled-v1')
    assert.equal(layerCatalog.getById('editorial-accent-vermilion-sweep-001').masterSHA256,
      '6629994b25fc3926c4762a91e28c09811c5c31a7bddada5d387b2d745c68486d')
    assert.equal(layerCatalog.getById('editorial-accent-vermilion-sweep-001').runtimeTransform,
      'largest-8-connected-alpha-core-morphological-open-v1')
    assert.equal(layerCatalog.getById('editorial-accent-placa-cuadrada-desigual-001').surfaceUse,
      'hero-backing-accent-v1')
    const semantic=b.createLocalSceneSemanticV1({sceneId:'v3-climate-fixture',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'La idea explica el glaciar, su sondeo, el clima, el agua y los datos de la inundación.'}],
      anchor:'Idea',
      concepts:['Idea','Glaciar','Sondeo glaciar','Clima','Agua','Datos','Inundación'].map(label=>({label,scope:'scene'}))
        .concat([{label:'Papel editorial',scope:'context'}]),
      globalText:'Contexto global irrelevante'})
    const contextual=b.selectEditorialLocalBankV3Detailed({catalog:layerCatalog,semantic})
    assert.equal(contextual.trace.outcome,'SELECTED',JSON.stringify(contextual.trace))
    assert.equal(contextual.selection.heroId,'editorial-hero-h001-v1')
    assert(contextual.selection.supportIds.includes('editorial-support-glaciar-001'))
    assert(contextual.selection.supportIds.includes('editorial-support-inundacion-001'))
    assert(contextual.selection.supportIds.length<=4)
    assert.equal(contextual.selection.backgroundId,'editorial-background-papel-marfil-fibras-001')
    assert.equal(contextual.selection.rearId,'editorial-paper-sondeo-glaciar-002',
      'REAR_PAPER_MUST_HAVE_DIRECT_SEMANTIC_MATCH')
    assert(['editorial-accent-placa-cuadrada-desigual-001','editorial-accent-lamina-diagonal-ancha-001']
      .includes(contextual.selection.accentId),'V3_1_ACCENT_MUST_BE_AN_APPROVED_CONTINUOUS_MASK')
    assert.equal(contextual.selection.frontId,undefined,'V3_BACKING_RECIPE_DOES_NOT_ADD_FRONT_COLLAGE')
    assert.notEqual(contextual.selection.rearId,'editorial-layer-l003-v1')
    b.createProjectFiles(projectRoot,{id:'v3-context-contract',clips:[],timelineVideoClips:[]})
    const context=b.createModernVisualGenerationContextV2({sceneId:'v3-climate-fixture',duration:3,
      localSemantic:semantic,keywordCandidates:[{keyword:'IDEA',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',
        camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:51721},videoStyleId:'cream-editorial'})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const usedIds=[contextual.selection.heroId,...contextual.selection.supportIds,contextual.selection.rearId,
      contextual.selection.accentId,contextual.selection.frontId,contextual.selection.backgroundId].filter(Boolean)
    const imported=Object.fromEntries([...new Set(usedIds)].map(id=>[id,layerCatalog.publish(projectRoot,id)]))
    const bind=()=>b.bindEditorialLocalBankV2({template:base,catalog:layerCatalog,imported,
      selection:contextual.selection,color:'#A83B19',contract:b.EDITORIAL_LOCAL_BANK_V3,
      headline:{connector:'La',keyword:'IDEA',closing:'explica el clima y el agua.'}})
    const renderedSpec=bind(),replayedSpec=bind()
    const noBackgroundSelection={...contextual.selection};delete noBackgroundSelection.backgroundId
    const proceduralBackground=b.bindEditorialLocalBankV2({template:base,catalog:layerCatalog,imported,
      selection:noBackgroundSelection,color:'#A83B19',contract:b.EDITORIAL_LOCAL_BANK_V3,
      headline:{connector:'La',keyword:'IDEA',closing:'explica el clima y el agua.'}})
    b.validateVisualSceneSpecV2(renderedSpec.sceneSpec)
    b.validateRenderBindingsAny(renderedSpec.renderBindings,renderedSpec.sceneSpec)
    assert.equal(renderedSpec.sceneSpec.presentationProfile.revision,b.EDITORIAL_LOCAL_BANK_V3.revision)
    assert.deepEqual(renderedSpec.sceneSpec.editorialBankV2.layers.find(layer=>layer.id==='idea-accent').rect,
      {x:18,y:18,width:64,height:64},'V3_1_BACKING_GEOMETRY_IS_REDUCED_AND_VERSIONED')
    assert.equal(renderedSpec.sceneSpec.editorialBankV2.backgroundAsset.assetId,contextual.selection.backgroundId)
    assert(renderedSpec.renderBindings.assets.some(item=>item.slotId==='idea-background'&&
      item.assetId===contextual.selection.backgroundId))
    assert(!renderedSpec.renderBindings.assets.some(item=>item.slotId==='idea-front'),
      'V3_DEFAULT_RECIPE_MUST_NOT_ADD_FRONT_LAYER')
    assert.equal(renderedSpec.pixelIdentity,replayedSpec.pixelIdentity)
    assert.notEqual(renderedSpec.pixelIdentity,proceduralBackground.pixelIdentity,
      'BACKGROUND_PIXEL_CHOICE_MUST_BE_HASHED')
    assert(!renderedSpec.pixelIdentity.includes(catalogRoot)&&!renderedSpec.pixelIdentity.includes(projectRoot))
    const heroPreview=b.previewEditorialCatalogBatchV2(catalogRoot,heroBatchFolder)
    assert.equal(heroPreview.rejected.length,0,JSON.stringify(heroPreview))
    const heroAlreadyPresent=Boolean(layerCatalog.getById('editorial-hero-turbina-hidroelectrica-001'))
    if(!heroAlreadyPresent)b.activateEditorialCatalogBatchV2(catalogRoot,heroBatchFolder)
    const heroCatalog=new b.CuratedModularCatalogV2(catalogRoot)
    assert.equal(heroCatalog.verifyAll().listed,layerCatalog.verifyAll().listed+(heroAlreadyPresent?0:1))
    assert.equal(heroCatalog.searchEditorialLocalV2('turbina hidroeléctrica','hero-core')[0]?.asset.assetId,
      'editorial-hero-turbina-hidroelectrica-001')
    assert.equal(heroCatalog.searchEditorialLocalV2('hydroelectric turbine','hero-core')[0]?.asset.assetId,
      'editorial-hero-turbina-hidroelectrica-001')
    const turbineSemantic=b.createLocalSceneSemanticV1({sceneId:'v3-hydroelectric-hero-fixture',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'La turbina hidroeléctrica transforma el flujo de agua en energía.'}],
      anchor:'Turbina hidroeléctrica',concepts:['Turbina hidroeléctrica','Agua','Energía','Flujo'].map(label=>({label,scope:'scene'})),
      globalText:'La turbina aprovecha el movimiento del agua.'})
    const turbineSelection=b.selectEditorialLocalBankV3Detailed({catalog:heroCatalog,semantic:turbineSemantic})
    assert.equal(turbineSelection.trace.outcome,'SELECTED',JSON.stringify(turbineSelection.trace))
    assert.equal(turbineSelection.selection.heroId,'editorial-hero-turbina-hidroelectrica-001')
    assert(turbineSelection.selection.supportIds.length>=2)
    const heroExpansionPreview=b.previewEditorialCatalogBatchV2(catalogRoot,heroExpansionBatchFolder)
    const heroExpansionIds=['editorial-hero-arrecife-coral-001','editorial-hero-glaciar-frente-calving-001',
      'editorial-hero-frente-incendio-forestal-001','editorial-hero-rov-investigacion-submarina-001',
      'editorial-hero-compuerta-presa-001']
    const heroExpansionBefore=new b.CuratedModularCatalogV2(catalogRoot)
    const heroExpansionAlreadyActive=heroExpansionIds.every(id=>heroExpansionBefore.getById(id))
    assert.equal(heroExpansionPreview.accepted,heroExpansionAlreadyActive?0:5,JSON.stringify(heroExpansionPreview))
    assert.equal(heroExpansionPreview.metadataRevisions,heroExpansionAlreadyActive?5:0,JSON.stringify(heroExpansionPreview))
    assert.equal(heroExpansionPreview.rejected.length,0,JSON.stringify(heroExpansionPreview))
    if(!heroExpansionAlreadyActive)b.activateEditorialCatalogBatchV2(catalogRoot,heroExpansionBatchFolder)
    const paperExpansionPreview=b.previewEditorialCatalogBatchV2(catalogRoot,paperExpansionBatchFolder)
    const paperExpansionIds=['editorial-paper-registro-incendio-001','editorial-paper-sondeo-glaciar-002',
      'editorial-paper-carta-ecologia-marina-001']
    const paperExpansionBefore=new b.CuratedModularCatalogV2(catalogRoot)
    const paperExpansionAlreadyActive=paperExpansionIds.every(id=>paperExpansionBefore.getById(id))
    assert.equal(paperExpansionPreview.accepted,paperExpansionAlreadyActive?0:3,JSON.stringify(paperExpansionPreview))
    assert.equal(paperExpansionPreview.metadataRevisions,paperExpansionAlreadyActive?3:0,JSON.stringify(paperExpansionPreview))
    assert.equal(paperExpansionPreview.rejected.length,0,JSON.stringify(paperExpansionPreview))
    if(!paperExpansionAlreadyActive)b.activateEditorialCatalogBatchV2(catalogRoot,paperExpansionBatchFolder)
    const accentExpansionPreview=b.previewEditorialCatalogBatchV2(catalogRoot,accentExpansionBatchFolder)
    const accentExpansionBefore=new b.CuratedModularCatalogV2(catalogRoot)
    const accentExpansionAlreadyActive=Boolean(accentExpansionBefore.getById('editorial-accent-lamina-diagonal-ancha-001'))
    assert.equal(accentExpansionPreview.accepted,accentExpansionAlreadyActive?0:1,JSON.stringify(accentExpansionPreview))
    assert.equal(accentExpansionPreview.metadataRevisions,accentExpansionAlreadyActive?1:0,JSON.stringify(accentExpansionPreview))
    assert.equal(accentExpansionPreview.rejected.length,0,JSON.stringify(accentExpansionPreview))
    if(!accentExpansionAlreadyActive)b.activateEditorialCatalogBatchV2(catalogRoot,accentExpansionBatchFolder)
    const expandedCatalog=new b.CuratedModularCatalogV2(catalogRoot)
    assert.equal(expandedCatalog.searchEditorialLocalV2('registro de campo de incendio','rear-collage')[0]?.asset.assetId,
      'editorial-paper-registro-incendio-001')
    assert.equal(expandedCatalog.searchEditorialLocalV2('marine ecology chart','rear-collage')[0]?.asset.assetId,
      'editorial-paper-carta-ecologia-marina-001')
    assert.equal(expandedCatalog.searchEditorialLocalV2('diagonal accent sheet','accent-mask')[0]?.asset.assetId,
      'editorial-accent-lamina-diagonal-ancha-001')
    const contextualHeroCases=[
      ['El arrecife de coral alberga biodiversidad marina.','Arrecife de coral','editorial-hero-arrecife-coral-001'],
      ['El glaciar retrocede y revela sus estratos.','Glaciar','editorial-hero-glaciar-frente-calving-001'],
      ['El incendio forestal avanza por el bosque.','Incendio forestal','editorial-hero-frente-incendio-forestal-001'],
      ['El ROV submarino explora el fondo oceánico.','Vehículo ROV submarino','editorial-hero-rov-investigacion-submarina-001'],
      ['La compuerta de la presa regula el caudal.','Compuerta de presa','editorial-hero-compuerta-presa-001'],
    ]
    for(const [sentence,anchor,expectedHeroId] of contextualHeroCases){
      const semantic=b.createLocalSceneSemanticV1({sceneId:'v3-'+expectedHeroId,start:0,end:3,
        transcriptSegments:[{start:0,end:3,text:sentence}],anchor,
        concepts:[anchor,...['Agua','Energía','Clima'].slice(0,2)].map(label=>({label,scope:'scene'})),globalText:sentence})
      const result=b.selectEditorialLocalBankV3Detailed({catalog:expandedCatalog,semantic})
      assert.equal(result.trace.outcome,'SELECTED',JSON.stringify(result.trace))
      assert.equal(result.selection.heroId,expectedHeroId,`${anchor}:${JSON.stringify(result.trace)}`)
    }
    assert.equal(expandedCatalog.verifyAll().verified,expandedCatalog.entries().length)
    assert.equal(health.listed,beforeHealth.listed+(alreadyPresent?0:1))
    for(const asset of legacy.entries())assert.equal(composite.getById(asset.assetId)?.sha256,asset.sha256,
      `BASE_250_CHANGED:${asset.assetId}`)
    assert.equal(legacy.verifyAll().verified,250)
    console.log(JSON.stringify({passed:true,baseListed:legacyHealth.listed,baseVerified:legacyHealth.verified,
      extensionPreviewAccepted:preview.accepted,invalidBatchRejected:true,searchEsAlias:true,searchEnAlias:true,
      compositeListed:expandedCatalog.entries().length,compositeVerified:expandedCatalog.verifyAll().verified,baseShaParity:true,
      previousExtensionListed:beforeHealth.listed,activePointerUntouchedByRejectedBatch:true,
      backgroundPreviewAccepted:backgroundPreview.accepted,thermometerPreviewAccepted:thermometerPreview.accepted,
      firePreviewAccepted:firePreview.accepted,contextualBackgroundSelection:true,temperatureSearches:true,
      fireSearches:true,paperPreviewAccepted:paperPreview.accepted,accentPreviewAccepted:accentPreview.accepted,
      continuousSurfaceSelection:true,heroImportAccepted:true,contextualNewHeroSelected:true,
      fiveHeroExpansionImported:heroExpansionAlreadyActive?5:heroExpansionPreview.accepted,
      paperExpansionImported:paperExpansionAlreadyActive?3:paperExpansionPreview.accepted,
      accentExpansionImported:accentExpansionAlreadyActive?1:accentExpansionPreview.accepted,
      contextualHeroCases:contextualHeroCases.length,
      sceneSpecAndBindingsValidated:true,identityReplay:true}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
