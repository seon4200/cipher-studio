const {app,session,ipcMain}=require('electron')
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs')
const {createTestFixture,cleanupTestFixture}=require('./helpers/safe-fixture')
const rows=require('./fixtures/editorial-explainer-light-v1-corpus')
const candidates=require('./fixtures/editorial-explainer-light-v1-candidates')
const repo=path.resolve(__dirname,'..'),fixture=createTestFixture('editorial-explainer-light-v1')
const project=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
process.chdir(fixture)
app.whenReady().then(async()=>{let code=1;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  const b=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  b.createProjectFiles(project,{id:'light-v1-temp',clips:[],timelineVideoClips:[],aiScript:'synthetic pilot'})
  assert.equal(rows.length,4)
  const manifest=require(path.join(repo,'public/modern-pack-100-v1/manifest.json'))
  const candidateIds=[...candidates.hero,...candidates.support,...candidates.utility]
  assert.deepEqual([candidates.hero.length,candidates.support.length,candidates.utility.length],[8,12,4])
  assert.equal(new Set(candidateIds).size,24)
  for(const file of ['dm-sans-var.ttf','instrument-serif-regular.ttf','ibm-plex-sans-condensed-400.woff2']){
    assert(fs.statSync(path.join(repo,'public/fonts',file)).size>1000,`Local font missing: ${file}`)
  }
  for(const id of candidateIds){const asset=manifest.assets.find(item=>item.assetId===id)
    assert(asset,`Candidate absent: ${id}`);assert.match(asset.sha256,/^[a-f0-9]{64}$/)
    assert(['MIT','ISC','Apache-2.0'].includes(asset.license))}
  for(let i=0;i<rows.length;i++){
    const row=rows[i], duration=3, sceneId=`light-${row.id}`
    const localSemantic=b.createLocalSceneSemanticV1({sceneId,start:0,end:duration,
      transcriptSegments:[{start:0,end:duration,text:row.text}],
      concepts:row.concepts.map(c=>({...c,start:.05,end:2.95,scope:'scene'})),
      anchor:row.concepts[0]?.label,relation:row.relation,globalText:row.text,
      globalHints:[],globalContextRef:'synthetic:editorial-explainer-light-v1'})
    const makeContext=profile=>b.createModernVisualGenerationContextV2({sceneId,duration,localSemantic,
      keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],preferredVisualMode:row.mode,
      sistema:'editorial',direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',
        densidad:'media',ritmo:'simultaneo',semilla:51001+i},videoStyleId:'cream-editorial',
      presentationProfile:profile,visualAssetPack:b.MODERN_VISUAL_PACK_V1,
      colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],revision:b.COLOR_PALETTE_REVISION_V1}})
    const result=(await b.resolveModernVisualGenerationBatchV2({contexts:[makeContext(b.EDITORIAL_EXPLAINER_LIGHT_V1)],projectRoot:project}))[0]
    const spec=result.resolved.compiled.sceneSpec
    const replay=(await b.resolveModernVisualGenerationBatchV2({contexts:[makeContext(b.EDITORIAL_EXPLAINER_LIGHT_V1)],projectRoot:project}))[0]
    assert.equal(b.sceneSpecPixelIdentityAny(replay.resolved.compiled.sceneSpec),b.sceneSpecPixelIdentityAny(spec),
      `Regeneration identity drift: ${row.id}`)
    assert.deepEqual(replay.resolved.compiled.sceneSpec.slots,spec.slots,`Regeneration slots drift: ${row.id}`)
    assert.equal(spec.presentationProfile.revision,b.EDITORIAL_EXPLAINER_LIGHT_V1.revision)
    assert(spec.lightStyle)
    assert(spec.slots.filter(s=>s.state==='present'||s.state==='procedural').length<=3)
    if(row.id==='relation-transfer'){
      const hero=spec.slots.find(s=>s.slotId==='hero'),support=spec.slots.find(s=>s.slotId==='support-1')
      assert.equal(hero.tint.treatment,'original-color')
      assert.equal(support.tint.treatment,'system-tint')
      assert.equal(spec.lightStyle.iconTreatment,'black-circle')
      assert.equal(spec.lightStyle.connector?.variant,'curved')
    }
    assert.equal(b.sceneSpecPixelIdentityAny(b.validateVisualSceneSpecV2(JSON.parse(JSON.stringify(spec)))),
      b.sceneSpecPixelIdentityAny(spec))
    if(row.id==='count-12'){
      assert.equal(spec.lightStyle.dataRepeater?.confirmedValue,12)
      assert.equal(spec.lightStyle.dataRepeater?.tokenCount,12)
      assert.equal(spec.slots.filter(s=>s.state==='present'||s.state==='procedural').length,0)
    }
    if(row.id==='editorial-close')assert.equal(spec.lightStyle.dataRepeater,null)
    const old=(await b.resolveModernVisualGenerationBatchV2({contexts:[makeContext(b.FAMILIES_MOTION_PROFILE_V2)],projectRoot:project}))[0]
    assert(!old.resolved.compiled.sceneSpec.lightStyle)
    assert.notEqual(b.sceneSpecPixelIdentityAny(spec),b.sceneSpecPixelIdentityAny(old.resolved.compiled.sceneSpec))
    const changed={...spec,lightStyle:{...spec.lightStyle,background:spec.lightStyle.background==='ivory-clean'?'white-soft-paper':'ivory-clean'}}
    assert.notEqual(b.sceneSpecPixelIdentityAny(changed),b.sceneSpecPixelIdentityAny(spec))
    for(const visibleChange of [
      {materialPreset:spec.lightStyle.materialPreset==='raised-object'?'flat-editorial':'raised-object'},
      {iconTreatment:spec.lightStyle.iconTreatment==='black-circle'?'orange-tile':'black-circle'},
    ])assert.notEqual(b.sceneSpecPixelIdentityAny({...spec,lightStyle:{...spec.lightStyle,...visibleChange}}),
      b.sceneSpecPixelIdentityAny(spec))
    if(spec.lightStyle.connector){
      const variant=spec.lightStyle.connector.variant==='curved'?'straight':'curved'
      assert.notEqual(b.sceneSpecPixelIdentityAny({...spec,lightStyle:{...spec.lightStyle,
        connector:{...spec.lightStyle.connector,variant}}}),b.sceneSpecPixelIdentityAny(spec))
    }
    console.log('LIGHT_V1_CONTRACT',JSON.stringify({id:row.id,mode:spec.visualMode,slots:spec.slots.map(s=>({role:s.slotId,asset:s.catalogAsset?.assetId||s.solarIcon||null})),
      data:spec.lightStyle.dataRepeater?.confirmedValue??null,light:spec.lightStyle.background}))
  }
  const invalid=b.makeLightDataRepeaterV1(12,'inventos')
  assert.equal(invalid,null)
  const grouped=b.makeLightDataRepeaterV1(92,'personas')
  assert.equal(grouped.tokenCount*grouped.grouping,92)
  assert(grouped.label.includes('1 símbolo ='))
  assert.equal(b.makeLightDataRepeaterV1(0,'personas'),null)
  assert.equal(b.makeLightDataRepeaterV1(29,'personas'),null)
  code=0
}catch(e){console.error(e.stack||e)}finally{cleanupTestFixture(fixture);app.exit(code)}})
