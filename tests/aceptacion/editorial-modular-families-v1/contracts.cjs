const {app,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const fixture=createTestFixture('editorial-family-contracts'),projectRoot=path.join(fixture,'project')
const variableWeightRange=file=>{
  const bytes=fs.readFileSync(file),tables=bytes.readUInt16BE(4)
  for(let index=0;index<tables;index++){
    const table=12+index*16
    if(bytes.toString('ascii',table,table+4)!=='fvar')continue
    const start=bytes.readUInt32BE(table+8),axesOffset=bytes.readUInt16BE(start+4)
    const axes=bytes.readUInt16BE(start+8),size=bytes.readUInt16BE(start+10)
    for(let axis=0;axis<axes;axis++){
      const at=start+axesOffset+axis*size
      if(bytes.toString('ascii',at,at+4)==='wght')
        return [bytes.readInt32BE(at+4)/65536,bytes.readInt32BE(at+12)/65536]
    }
  }
  throw new Error('VARIABLE_FONT_WEIGHT_AXIS_MISSING:'+file)
}
app.setPath('userData',path.join(fixture,'userData'))
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'editorial-contracts',clips:[],timelineVideoClips:[]})
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const counts=Object.fromEntries(['hero-core','support','rear-collage','front-collage','accent-mask']
      .map(role=>[role,inventory.entries.filter(item=>item.role===role).length]))
    assert.deepEqual(counts,{'hero-core':150,support:50,'rear-collage':20,'front-collage':15,'accent-mask':15})
    const fraunces=variableWeightRange(path.join(root,'public/fonts/fraunces-var.ttf'))
    const dmSans=variableWeightRange(path.join(root,'public/fonts/dm-sans-var.ttf'))
    assert(fraunces[0]<=650&&fraunces[1]>=650,'FRAUNCES_650_NOT_REAL')
    assert(dmSans[0]<=500&&dmSans[1]>=500,'DM_SANS_500_NOT_REAL')
    assert(fs.existsSync(path.join(root,'public/fonts/ibm-plex-sans-condensed-400.woff2')))
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    assert.equal(catalog.entries().length,250)
    for(const entry of catalog.entries())
      assert(catalog.search([entry.primaryWordEs],entry.role).some(candidate=>candidate.assetId===entry.assetId),
        'CURATED_ASSET_NOT_SEARCHABLE:'+entry.assetId)
    const id=code=>inventory.entries.find(item=>item.code===code).assetId
    const assetCodes=['H001','S001','S002','S003','S004','L001','L036']
    const imported=Object.fromEntries(assetCodes.map(code=>{const assetId=id(code)
      return [assetId,catalog.publish(projectRoot,assetId)]}))
    const text='Una idea abre nuevas posibilidades.'
    const semantic=b.createLocalSceneSemanticV1({sceneId:'R01',start:0,end:2,
      transcriptSegments:[{start:0,end:2,text}],concepts:[{label:'Idea',scope:'scene'}],
      anchor:'Idea',globalText:text})
    const context=b.createModernVisualGenerationContextV2({sceneId:'R01',duration:2,
      localSemantic:semantic,keywordCandidates:[{keyword:'IDEA',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',
      direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:95151},
      videoStyleId:'cream-editorial'})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const historicalIdentity=b.sceneSpecPixelIdentityAny(base.sceneSpec)
    const make=(overrides={})=>b.bindEditorialModularFamilyV1({template:base,catalog,imported,
      family:'marcoPoster',heroId:id('H001'),supportIds:['S001','S002','S003','S004'].map(id),
      rearId:id('L001'),accentId:id('L036'),background:'ivory-clean',entry:'text-first',
      supportTreatment:'paper-card',camera:'fixed',particles:'none',color:'#A83B19',
      headline:{connector:'UNA',keyword:'IDEA',closing:'abre nuevas posibilidades'},
      relations:[{from:'support-1',to:'hero',meaning:'informs'}],...overrides})
    const first=make(),second=make()
    assert.equal(first.pixelIdentity,second.pixelIdentity,'NON_DETERMINISTIC_PLAN')
    assert.equal(b.sceneSpecPixelIdentityAny(base.sceneSpec),historicalIdentity,'HISTORICAL_BASE_MUTATED')
    assert.equal(first.sceneSpec.presentationProfile.id,'editorial-modular-families-v1')
    assert(!first.pixelIdentity.includes(projectRoot)&&!first.pixelIdentity.includes(catalogRoot),'PATH_IN_IDENTITY')
    for(const change of [{layoutVariant:'inverse'},{background:'white-soft-paper'},{entry:'hero-first'},{color:'#238C87'},
      {supportTreatment:'ink-badge'},{camera:'quiet-drift'},{particles:'dust'},
      {relations:[{from:'hero',to:'support-1',meaning:'transfers'}]}])
      assert.notEqual(make(change).pixelIdentity,first.pixelIdentity,'VISIBLE_CHANGE_NOT_IDENTIFIED:'+JSON.stringify(change))
    const reject=(mutation,reason)=>{
      const copy=structuredClone(first.sceneSpec)
      mutation(copy)
      assert.throws(()=>b.validateVisualSceneSpecV2(copy),undefined,reason)
    }
    reject(spec=>{spec.editorialFamily.supports[0].assetId='other'},'FORGED_ASSET_ID')
    reject(spec=>{spec.editorialFamily.layers[0].sha256='0'.repeat(64)},'FORGED_LAYER_SHA')
    reject(spec=>{spec.editorialFamily.extraPath='C:\\private\\file.png'},'UNIDENTIFIED_PIXEL_FIELD')
    reject(spec=>{spec.editorialFamily.relations[0].start=0},'CONNECTOR_BEFORE_ENDPOINT_VISIBLE')
    reject(spec=>{spec.editorialFamily.layoutVariant='unapproved'},'LAYOUT_VARIANT_INVALID')
    reject(spec=>{spec.layout.textAlignment='right'},'LAYOUT_NOT_FROZEN')
    const auto=b.selectEditorialModularFamilyAssetsV1({catalog,semantic,sceneIndex:0})
    assert.equal(auto.heroId,id('H001'))
    assert(!auto.rearId&&!auto.accentId&&!auto.frontId,'UNAPPROVED_AUTOMATIC_COLLAGE_PAIR')
    const processText='Las piezas avanzan en un proceso con herramientas y construcción.'
    const processSemantic=b.createLocalSceneSemanticV1({sceneId:'process',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:processText}],anchor:'Piezas',relation:'proceso',
      concepts:['Piezas','Herramientas','Construcción'].map(label=>({label,scope:'scene'}))})
    const processSelection=b.selectEditorialModularFamilyAssetsV1({catalog,semantic:processSemantic,sceneIndex:1})
    assert.equal(processSelection.heroId,id('H101'),'PROCESS_HERO_RELEVANCE')
    assert.equal(processSelection.family,'cascada','PROCESS_ELIGIBILITY')
    assert(processSelection.supportIds.includes(id('S049'))&&processSelection.supportIds.includes(id('S050')),
      'PROCESS_SUPPORTS_RELEVANCE')
    assert(processSelection.relations.every(item=>item.meaning==='connects'),
      'PROCESS_LABEL_MUST_NOT_INVENT_CAUSALITY')
    const typeOnly=make({family:'editorial',heroId:undefined,supportIds:[],rearId:undefined,
      accentId:undefined,entry:'hero-first',relations:[]})
    assert.equal(typeOnly.sceneSpec.editorialFamily.entry,'word-first',
      'TYPE_ONLY_MUST_NOT_WAIT_FOR_NONEXISTENT_HERO')
    const editorialPreference=b.selectEditorialModularFamilyAssetsV1({catalog,
      semantic:processSemantic,sceneIndex:1,preferredFamily:'editorial'})
    assert.equal(editorialPreference.family,'editorial')
    assert(!editorialPreference.heroId&&editorialPreference.supportIds.length===0)
    const supportOnlySemantic=b.createLocalSceneSemanticV1({sceneId:'type-led',start:0,end:2,
      transcriptSegments:[{start:0,end:2,text:'Personas'}],anchor:'Personas',concepts:[{label:'Personas',scope:'scene'}]})
    const selected=b.selectEditorialModularFamilyAssetsV1({catalog,semantic:supportOnlySemantic,sceneIndex:0})
    assert.equal(selected.family,'editorial')
    assert.equal(selected.supportIds.length,0,'DETACHED_SUPPORT_IN_TYPE_LED')
    console.log(JSON.stringify({passed:true,catalogAssets:250,searchableAssets:250,counts,frauncesWeightRange:fraunces,
      dmSansWeightRange:dmSans,ibmPlexStaticWeight:400,identityChanges:8,
      maliciousContractsRejected:6,historicalInputUnchanged:true}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
