const {app,session}=require('electron'); const assert=require('assert/strict');
const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
const {createTestFixture,cleanupTestFixture}=require('./helpers/safe-fixture');
const {rows,context}=require('./fixtures/modern-visual-pack-v1');
const repo=path.resolve(__dirname,'..'), fixture=createTestFixture('modern-pack'), project=path.join(fixture,'project');
app.setPath('userData',path.join(fixture,'user-data')); app.commandLine.appendSwitch('force-device-scale-factor','2.25'); process.chdir(fixture);
let b;const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
app.whenReady().then(async()=>{let code=1;try {
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}));
  const deny=()=>{throw Error('NETWORK_BLOCKED_IN_PACK_TEST')};global.fetch=deny;require('http').request=deny;require('https').request=deny;
  b=require(path.join(repo,'dist-electron/main/index.js'));
  assert(b.COLOR_PALETTE_REVISION_V1,'exported palette revision');
  const catalog=b.modernVisualPackCatalogV1(); assert.equal(catalog.length,95);
  assert.equal(new Set(catalog.map(a=>a.sha256)).size,catalog.length);
  for(const a of catalog) {assert.equal(hash(b.readModernVisualPackAssetV1(a.assetId)),a.sha256);assert(fs.existsSync(path.join(repo,'dist/modern-pack-100-v1',a.licenseNotice)));}
  const concept=(term,extra={})=>({originalTerm:term,normalizedTerm:term,aliases:[],subject:'object',importance:3,preferredRole:'hero',evidence:'direct-timed-concept',...extra});
  assert(b.findModernVisualPackCandidatesV1(concept('cámara'),'hero').some(c=>c.asset.source==='fluent'));
  assert.equal(b.findModernVisualPackCandidatesV1(concept('camera',{hygieneAuthority:'explicit-visual-evidence'}),'hero').length,0);
  assert.equal(b.findModernVisualPackCandidatesV1(concept('camera',{hygiene:{eligibility:'not-visual'}}),'hero').length,0);
  assert.equal(b.findModernVisualPackCandidatesV1(concept('bastante'),'hero').length,0);
  assert.equal(b.findModernVisualPackCandidatesV1(concept('scientist',{aliases:['microscope']}),'hero').length,0);
  assert(b.findModernVisualPackCandidatesV1(concept('wallet',{aliases:['money']}),'support').every(c=>c.asset.canonicalConcept==='wallet'));
  assert.equal(b.findModernVisualPackCandidatesV1(concept('engine'),'hero').some(c=>c.asset.source==='fluent'),false);
  assert.equal(b.findModernVisualPackCandidatesV1(concept('wallet'),'hero').length,0);
  assert(b.findModernVisualPackCandidatesV1(concept('wallet'),'support').some(c=>c.asset.source==='tabler'));
  assert.throws(()=>b.validateModernVisualPackSelectionV1({id:'modern-pack-100-v1',revision:'unknown'}));
  assert.deepEqual(b.findModernVisualPackCandidatesV1(concept('camera'),'hero').map(c=>c.asset.assetId),
    b.findModernVisualPackCandidatesV1(concept('camera'),'hero').map(c=>c.asset.assetId));
  const fish=b.findModernVisualPackCandidatesV1(concept('fish'),'support');assert(fish.length>=2);
  assert.notEqual(b.findModernVisualPackCandidatesV1(concept('fish'),'support',[fish[0].asset.assetId])[0].asset.assetId,
    fish[0].asset.assetId,'equivalent-priority alternatives avoid immediate repetition');
  b.createProjectFiles(project,{id:'modern-pack-test',clips:[],timelineVideoClips:[],aiScript:'synthetic'});
  const resolve=inputs=>b.resolveModernVisualGenerationBatchV2({contexts:inputs,projectRoot:project});
  const before=await resolve(rows.map((r,i)=>context(b,r,i,false)));
  const modern=await resolve(rows.map((r,i)=>context(b,r,i,true)));
  const after=await resolve(rows.map((r,i)=>context(b,r,i,false)));
  const repeat=await resolve(modern.map(r=>r.context));
  for(let i=0;i<rows.length;i++) {
    assert.equal(b.sceneSpecPixelIdentityAny(before[i].resolved.compiled.sceneSpec),b.sceneSpecPixelIdentityAny(after[i].resolved.compiled.sceneSpec));
    assert.equal(b.sceneSpecPixelIdentityAny(modern[i].resolved.compiled.sceneSpec),b.sceneSpecPixelIdentityAny(repeat[i].resolved.compiled.sceneSpec));
    assert.deepEqual(before[i].context.localSemantic,modern[i].context.localSemantic);
    assert(modern[i].resolved.choices.length<=3);
    for(const s of modern[i].resolved.compiled.sceneSpec.slots.filter(s=>s.catalogAsset)) {
      const a=catalog.find(a=>a.assetId===s.catalogAsset.assetId);assert(a);
      assert.equal(s.tint.treatment,a.originalColor?'original-color':'system-tint');assert.equal(s.sha256,a.sha256);
    }
  }
  for(const id of ['symbol-clock','direct-openmoji']) {
    const i=rows.findIndex(r=>r.id===id);
    assert.deepEqual(before[i].resolved.choices.map(c=>[c.provider,c.stableId,c.solarIcon]),modern[i].resolved.choices.map(c=>[c.provider,c.stableId,c.solarIcon]));
  }
  const identitySpec=structuredClone(modern[0].resolved.compiled.sceneSpec);
  const packedSlot=identitySpec.slots.find(s=>s.catalogAsset);assert(packedSlot);
  const withCatalog=b.sceneSpecPixelIdentityAny(identitySpec);
  delete packedSlot.catalogAsset;
  assert.notEqual(withCatalog,b.sceneSpecPixelIdentityAny(identitySpec),'visible catalog identity participates in PixelIdentity');
  const providers=modern.flatMap(r=>r.resolved.choices.map(c=>({role:c.slotId,provider:c.provider,source:catalog.find(a=>a.assetId===c.catalogAsset?.assetId)?.source})));
  assert(providers.some(p=>p.source==='fluent'&&p.role==='hero'));
  assert(providers.some(p=>p.source==='iconify'&&p.role==='hero'));
  assert(providers.some(p=>p.source==='tabler'&&p.role!=='hero'));
  assert(providers.some(p=>p.provider==='openmoji'));
  assert(providers.some(p=>p.provider==='solar'));
  for(const i of [0,1,2]) {
    const row=modern[i];let qc;
    const file=await b.renderGraphicClip(row.resolved.compiled.graphicData,{ancho:540,alto:960,fps:24,duracion:row.context.duration,modo:'pantalla',sistema:'editorial',projectRoot:project,renderBindings:row.resolved.compiled.renderBindings,onQcReport:v=>qc=v,onQcFailure:v=>qc=v});
    assert(file&&fs.existsSync(file),JSON.stringify(qc));assert(qc&&qc.findings.every(f=>f.level!=='error'));
    const regenerated=await b.renderGraphicClip(repeat[i].resolved.compiled.graphicData,{ancho:540,alto:960,fps:24,duracion:row.context.duration,modo:'pantalla',sistema:'editorial',projectRoot:project,renderBindings:repeat[i].resolved.compiled.renderBindings});
    assert.equal(hash(fs.readFileSync(file)),hash(fs.readFileSync(regenerated)),'locked regeneration reuses identical render bytes');
  }
  const published=b.publishModernVisualPackAssetV1(project,catalog[0].assetId);
  assert.equal(b.publishModernVisualPackAssetV1(project,catalog[0].assetId).status,'reused');
  // Only this temporary published fixture is modified. Inventory and packaged bytes stay intact.
  const saved=fs.readFileSync(published.absoluteFile);fs.writeFileSync(published.absoluteFile,Buffer.from('<svg/>'));
  assert.throws(()=>b.publishModernVisualPackAssetV1(project,catalog[0].assetId));fs.writeFileSync(published.absoluteFile,saved);
  console.log('MODERN_PACK_OK',JSON.stringify({assets:catalog.length,scenes:rows.length,providers}));code=0;
}catch(e){console.error(e)}finally{try{b?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}catch(e){console.error(e);code=1}app.exit(code)}});
