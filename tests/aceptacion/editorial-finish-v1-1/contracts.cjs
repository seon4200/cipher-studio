const {app,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const fixture=createTestFixture('editorial-finish-contracts'),projectRoot=path.join(fixture,'project')
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase()
app.setPath('userData',path.join(fixture,'userData'))
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'finish-contracts',clips:[],timelineVideoClips:[]})
    assert.equal(sha(path.join(root,'public/fonts/fraunces-var.ttf')),b.EDITORIAL_FINISH_FONT_SHA_V11.Fraunces)
    assert.equal(sha(path.join(root,'public/fonts/instrument-serif-regular.ttf')),
      b.EDITORIAL_FINISH_FONT_SHA_V11['Instrument Serif'])
    assert.equal(sha(path.join(root,'public/fonts/bricolage-grotesque-var.ttf')),
      b.EDITORIAL_FINISH_FONT_SHA_V11['Bricolage Grotesque'])
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const assetId=code=>inventory.entries.find(e=>e.code===code).assetId
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const ids=['H001','S001','S002','S003','S004','L001','L036'].map(assetId)
    const imported=Object.fromEntries(ids.map(id=>[id,catalog.publish(projectRoot,id)]))
    const text='Una idea conecta personas, datos, soluciones e impacto.'
    const semantic=b.createLocalSceneSemanticV1({sceneId:'C01',start:0,end:4,
      transcriptSegments:[{start:0,end:4,text}],concepts:[{label:'Idea',scope:'scene'}],
      anchor:'Idea',globalText:text})
    const context=b.createModernVisualGenerationContextV2({sceneId:'C01',duration:4,
      localSemantic:semantic,keywordCandidates:[{keyword:'IDEA',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',
      direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:99101},
      videoStyleId:'cream-editorial'})
    const template=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const historicalIdentity=b.sceneSpecPixelIdentityAny(template.sceneSpec)
    const common={template,catalog,imported,family:'marcoPoster',heroId:ids[0],supportIds:ids.slice(1,5),
      rearId:ids[5],accentId:ids[6],background:'ivory-clean',entry:'text-first',
      supportTreatment:'paper-card',camera:'fixed',particles:'none',color:'#A83B19',
      headline:{connector:'UNA',keyword:'IDEA',closing:'conecta personas, datos y soluciones'},
      relations:[{from:'support-1',to:'hero',meaning:'informs'},
        {from:'hero',to:'support-2',meaning:'transfers'},
        {from:'hero',to:'support-3',meaning:'connects'},
        {from:'support-3',to:'support-4',meaning:'causes'}]}
    const make=(finish={})=>b.bindEditorialModularFinishV11({...common,finish:{display:'Fraunces',
      local:'discreto',ambient:'discreto',representation:'auto',response:'auto',composition:'base',...finish}})
    const first=make(),repeated=make()
    const driftRequested=b.bindEditorialModularFinishV11({...common,camera:'quiet-drift',
      finish:{display:'Fraunces',local:'discreto',ambient:'discreto',representation:'auto',
        response:'auto',composition:'base'}})
    assert.equal(driftRequested.sceneSpec.editorialFamily.camera.mode,'fixed',
      'RELATION_ROUTE_MUST_NOT_DETACH_FROM_DRIFTING_HERO')
    assert.equal(first.pixelIdentity,repeated.pixelIdentity,'V11_IDENTITY_NOT_DETERMINISTIC')
    assert.equal(b.sceneSpecPixelIdentityAny(template.sceneSpec),historicalIdentity,'HISTORICAL_INPUT_MUTATED')
    assert.equal(first.sceneSpec.editorialFinish.relations.length,4,'NOT_ALL_RELATIONS_PRESENT')
    assert.equal(first.sceneSpec.editorialFinish.events.filter(e=>e.kind==='arrival').length,4)
    assert(!first.pixelIdentity.includes(projectRoot)&&!first.pixelIdentity.includes(catalogRoot))
    b.validateVisualSceneSpecV2(first.sceneSpec)
    const origins=first.sceneSpec.editorialFinish.relations.map(r=>`${r.from}>${r.to}`)
    assert.deepEqual(origins,['support-1>hero','hero>support-2','hero>support-3','support-3>support-4'])
    for(const finish of [{display:'Instrument Serif'},{display:'Bricolage Grotesque'},
      {headline:'#176A66'},{keyword:'#238C87'},{effects:'#238C87'},
      {local:'off'},{ambient:'off'},{representation:'dotted'},
      {response:'scale'}])
      {let candidate;try{candidate=make(finish)}catch(error){throw new Error('VARIANT_FAILED:'+JSON.stringify(finish),{cause:error})}
      assert.notEqual(candidate.pixelIdentity,first.pixelIdentity,
        'VISIBLE_CHANGE_NOT_IDENTIFIED:'+JSON.stringify(finish))}
    const changedColor=make({effects:'#238C87'}).sceneSpec.editorialFinish
    assert.throws(()=>make({composition:'focus'}),/EDITORIAL_FINISH_ROUTE_BLOCKED/,
      'INCOMPATIBLE_FOCUS_LAYOUT_MUST_NOT_DRAW_COLLIDING_RELATION')
    assert.deepEqual(changedColor.relations.map(r=>r.portrait),first.sceneSpec.editorialFinish.relations.map(r=>r.portrait),
      'COLOR_CHANGED_ROUTE')
    assert.deepEqual(changedColor.relations.map(r=>[r.start,r.arrival,r.end]),
      first.sceneSpec.editorialFinish.relations.map(r=>[r.start,r.arrival,r.end]),'COLOR_CHANGED_TIMING')
    const changedDisplay=make({display:'Instrument Serif'}).sceneSpec.editorialFinish
    assert.deepEqual(changedDisplay.relations.map(r=>r.portrait),first.sceneSpec.editorialFinish.relations.map(r=>r.portrait),
      'FONT_CHANGED_ROUTE_WITHOUT_LAYOUT_CHANGE')
    const v1=b.bindEditorialModularFamilyV1(common)
    const v1Identity=v1.pixelIdentity
    b.validateVisualSceneSpecV2(v1.sceneSpec)
    assert.equal(v1.pixelIdentity,v1Identity,'V1_IDENTITY_CHANGED')
    assert(!v1.sceneSpec.editorialFinish,'V1_ACQUIRED_V11_FIELDS')
    assert.notEqual(v1Identity,first.pixelIdentity,'V1_AND_V11_IDENTICAL')
    const reject=(mutate,label)=>{const copy=structuredClone(first.sceneSpec);mutate(copy)
      assert.throws(()=>b.validateVisualSceneSpecV2(copy),undefined,label)}
    reject(s=>{s.editorialFinish.colors.effects='#00ff00'},'NONCANONICAL_HEX')
    reject(s=>{s.editorialFinish.relations[0].to='support-4'},'FORGED_ENDPOINT')
    reject(s=>{s.editorialFinish.relations[0].portrait.points[0].x+=2},'UNCERTIFIED_ROUTE')
    reject(s=>{s.editorialFinish.events[0].seed=-1.5},'INVALID_EVENT_SEED')
    reject(s=>{s.editorialFinish.typography.displaySha256='0'.repeat(64)},'FONT_SHA')
    const impossible=structuredClone(first.sceneSpec.editorialFinish.portraitLayout)
    impossible.textBounds={x:1,y:1,width:98,height:98}
    assert.throws(()=>b.routeEditorialFinishV11(impossible,'support-1','hero'),
      /EDITORIAL_FINISH_ROUTE_BLOCKED/,'IMPOSSIBLE_ROUTE_NOT_REJECTED')
    console.log(JSON.stringify({passed:true,displayFonts:3,identityVariations:9,
      historicalParity:true,relations:4,arrivalEvents:4,invalidContractsRejected:5,
      impossibleRoute:'REJECTED',fontFilesVerified:3}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
