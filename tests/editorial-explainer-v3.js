const {app,session,ipcMain}=require('electron')
const assert=require('node:assert/strict'),path=require('node:path')
const {createTestFixture,cleanupTestFixture}=require('./helpers/safe-fixture')
const rows=require('./fixtures/editorial-explainer-v3-corpus')
const repo=path.resolve(__dirname,'..'),fixture=createTestFixture('editorial-explainer-v3')
const project=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
process.chdir(fixture)
app.whenReady().then(async()=>{let code=1,b;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  b=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  b.createProjectFiles(project,{id:'editorial-v3-contract',clips:[],timelineVideoClips:[],aiScript:'synthetic'})
  function context(row,i,profile,lockedChoices){const duration=3,sceneId=`light-contract-${row.id}`
    const localSemantic=b.createLocalSceneSemanticV1({sceneId,start:0,end:duration,
      transcriptSegments:[{start:0,end:duration,text:row.text}],
      concepts:row.concepts.map(c=>({...c,start:.05,end:2.95,scope:'scene'})),
      anchor:row.concepts[0]?.label,relation:row.relation,globalText:row.text,
      globalHints:[],globalContextRef:'synthetic:light-v2-contract'})
    return b.createModernVisualGenerationContextV2({sceneId,duration,localSemantic,
      keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],preferredVisualMode:row.mode||'auto',
      sistema:'editorial',direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',
        densidad:'media',ritmo:'simultaneo',semilla:63000+i},videoStyleId:'cream-editorial',
      presentationProfile:profile,visualAssetPack:b.MODERN_VISUAL_PACK_V1,
      ...(lockedChoices?{lockedChoices}:{}),
      colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],revision:b.COLOR_PALETTE_REVISION_V1}})}
  const v1=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((r,i)=>context(r,i,b.EDITORIAL_EXPLAINER_LIGHT_V2)),projectRoot:project})
  const contexts=rows.map((r,i)=>context(r,i,b.EDITORIAL_EXPLAINER_V3,v1[i].context.lockedChoices))
  const v2=await b.resolveModernVisualGenerationBatchV2({contexts,projectRoot:project})
  const replay=await b.resolveModernVisualGenerationBatchV2({contexts,projectRoot:project})
  assert.equal(v2.length,6)
  for(let i=0;i<v2.length;i++){
    const a=v1[i].resolved.compiled.sceneSpec,s=v2[i].resolved.compiled.sceneSpec
    assert.equal(a.presentationProfile.revision,b.EDITORIAL_EXPLAINER_LIGHT_V2.revision)
    assert.equal(s.presentationProfile.revision,b.EDITORIAL_EXPLAINER_V3.revision)
    assert.equal(s.lightStyle.revision,b.EDITORIAL_EXPLAINER_V3.revision)
    assert.equal(s.lightStyle.accentTheme,'orange')
    assert(['paper-icon-card','black-micro-badge','accent-tile'].includes(s.lightStyle.supportTreatment))
    for(const supportTreatment of ['paper-icon-card','black-micro-badge','accent-tile'])
      b.validateVisualSceneSpecV2({...s,lightStyle:{...s.lightStyle,supportTreatment}})
    assert(Number.isInteger(s.lightStyle.microdetailVariant))
    assert.equal(s.slots.filter(slot=>slot.state==='present'||slot.state==='procedural').length<=3,true)
    assert.equal(b.sceneSpecPixelIdentityAny(s),b.sceneSpecPixelIdentityAny(replay[i].resolved.compiled.sceneSpec))
    assert.notEqual(b.sceneSpecPixelIdentityAny(s),b.sceneSpecPixelIdentityAny(a))
    assert.deepEqual(s.slots.map(slot=>slot.sha256||slot.solarIcon||slot.state),
      a.slots.map(slot=>slot.sha256||slot.solarIcon||slot.state))
    assert.equal(b.sceneSpecPixelIdentityAny(b.validateVisualSceneSpecV2(JSON.parse(JSON.stringify(s)))),
      b.sceneSpecPixelIdentityAny(s))
    assert.notEqual(b.sceneSpecPixelIdentityAny({...s,lightStyle:{...s.lightStyle,
      background:s.lightStyle.background==='white-soft-paper'?'ivory-clean':'white-soft-paper'}}),
      b.sceneSpecPixelIdentityAny(s))
    assert.notEqual(b.sceneSpecPixelIdentityAny({...s,lightStyle:{...s.lightStyle,accentTheme:'teal'}}),b.sceneSpecPixelIdentityAny(s))
    assert.notEqual(b.sceneSpecPixelIdentityAny({...s,lightStyle:{...s.lightStyle,microdetailVariant:(s.lightStyle.microdetailVariant+1)%8}}),b.sceneSpecPixelIdentityAny(s))
    assert.throws(()=>b.validateVisualSceneSpecV2({...s,lightStyle:{...s.lightStyle,shadowPreset:'unknown'}}))
    if(rows[i].id==='people'){
      assert.equal(s.text.keyword,'12');assert.equal(s.lightStyle.dataRepeater.tokenCount,12)
      assert.equal(s.slots.filter(slot=>slot.state==='present'||slot.state==='procedural').length,0)
    }
  }
  assert.equal(b.makeLightDataRepeaterV1(12,'participantes').tokenCount,12)
  assert.equal(b.makeLightDataRepeaterV1(12,'inventos'),null)
  console.log('EDITORIAL_V3_CONTRACT_PASS',JSON.stringify({scenes:v2.length,revision:b.EDITORIAL_EXPLAINER_V3.revision}))
  code=0
}catch(e){console.error(e.stack||e)}finally{try{b?.cerrarVentanaGraficos();cleanupTestFixture(fixture)}catch(e){console.error(e.stack||e);code=1}app.exit(code)}})
