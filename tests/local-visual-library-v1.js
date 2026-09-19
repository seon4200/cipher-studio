const {app,session,ipcMain}=require('electron'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {createTestFixture,cleanupTestFixture}=require('./helpers/safe-fixture');
const {rows,context}=require('./fixtures/modern-visual-pack-v1');
const {hash,camera,document,write}=require('./fixtures/local-visual-library-v1.cjs');
const repo=path.resolve(__dirname,'..'),fixture=createTestFixture('local-library'),project=path.join(fixture,'project'),library=path.join(fixture,'library');
const evidence=path.resolve(repo,'../_local-visual-library-evidence');
const baselineFile=path.join(repo,'tests/fixtures/local-visual-library-baseline.json');
app.setPath('userData',path.join(fixture,'userData'));app.commandLine.appendSwitch('force-device-scale-factor','2.25');process.chdir(fixture);
 let b;
app.whenReady().then(async()=>{let exit=1,networkAttempts=0;try{
 const deny=()=>{networkAttempts++;throw Error('NETWORK_FORBIDDEN')};global.fetch=deny;require('http').request=deny;require('https').request=deny;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>{const cancel=/^https?:/i.test(d.url);if(cancel)networkAttempts++;cb({cancel})});
 b=require(path.join(repo,'dist-electron/main/index.js'));
 ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}));
 b.createProjectFiles(project,{id:'library-test',clips:[],timelineVideoClips:[],aiScript:'synthetic contract test'});
 const concept=t=>({originalTerm:t,normalizedTerm:t,aliases:[],subject:'object',importance:3,preferredRole:'hero',evidence:'direct-timed-concept'});
 const catalog=b.modernVisualPackCatalogV1();const terms=[...new Set(catalog.map(a=>a.canonicalConcept))];
 const identities=await b.resolveModernVisualGenerationBatchV2({contexts:rows.map((r,i)=>context(b,r,i,true)),projectRoot:project});
 const baseline={bundleSha:hash(fs.readFileSync(path.join(repo,'dist-electron/main/index.js'))),assets:catalog.map(a=>[a.assetId,a.sha256]),
   search:terms.map(t=>[t,...['hero','support'].map(role=>b.findModernVisualPackCandidatesV1(concept(t),role).map(c=>c.asset.assetId))]),
   scenes:identities.map(r=>b.sceneSpecPixelIdentityAny(r.resolved.compiled.sceneSpec))};
 fs.mkdirSync(evidence,{recursive:true});
 if(process.argv.includes('--record-baseline')){assert(!fs.existsSync(baselineFile),'baseline immutable');fs.writeFileSync(baselineFile,JSON.stringify(baseline,null,2));console.log('BASELINE_RECORDED',baseline.bundleSha);exit=0;return;}
 const previous=JSON.parse(fs.readFileSync(baselineFile));
 assert.deepEqual(baseline.assets,previous.assets);assert.deepEqual(baseline.search,previous.search);assert.deepEqual(baseline.scenes,previous.scenes);
 assert.equal(catalog.length,95);assert.equal(terms.length,63);
 for(const a of catalog)assert.equal(hash(b.readModernVisualPackAssetV1(a.assetId)),a.sha256);
 const doc=write(library);process.env.CIPHER_VISUAL_LIBRARY_PATH=library;
 const composite=b.createCompositeVisualCatalogV1();assert.equal(composite.entries().length,96);
 assert.equal(composite.getById(doc.assets[0].assetId).origin,'local');assert.equal(composite.getById(catalog[0].assetId).origin,'embedded');
 assert.equal(composite.getVariants('cameras').some(c=>c.origin==='local'),true);
 assert.equal(hash(composite.resolveAsset(doc.assets[0].assetId)),doc.assets[0].sha256);
 assert.equal(fs.readdirSync(path.join(library,'assets')).length,1,'no embedded seed copied');
 assert(b.findModernVisualPackCandidatesV1(concept('camera'),'hero',[],undefined,composite).some(c=>c.origin==='local'));
 assert(!b.findModernVisualPackCandidatesV1(concept('camera'),'hero').some(c=>c.origin==='local'),'old API remains embedded-only even with configured library');
 assert.equal(b.findModernVisualPackCandidatesV1({...concept('scientist'),aliases:['camera']},'hero',[],undefined,composite).length,0);
 assert.equal(b.findModernVisualPackCandidatesV1({...concept('camera'),hygieneAuthority:'explicit-visual-evidence'},'hero',[],undefined,composite).length,0);
 assert.equal(b.findModernVisualPackCandidatesV1({...concept('camera'),hygiene:{eligibility:'not-visual'}},'hero',[],undefined,composite).length,0);
 assert(b.findModernVisualPackCandidatesV1(concept('camera'),'support',[],undefined,composite,'modern-color')[0].asset.originalColor,'preferred style ranks before variation');
 const lookup=()=>b.createCompositeVisualCatalogV1(library);
 const bad=[d=>d.assets[0].localRelativePath='../outside.svg',d=>d.assets[0].license='UNKNOWN',d=>d.collections[0].licenseApproved=false,
   d=>d.assets[0].source='fluent',d=>d.assets[0].source='tabler',d=>d.assets.push(d.assets[0]),d=>d.packId='modern-pack-100-v1'];
 for(const mutate of bad){const d=structuredClone(doc);mutate(d);write(library,d,false);assert.equal(lookup().entries().length,95);assert.equal(lookup().diagnostics[0].code,'LOCAL_CATALOG_INVALID');}
 write(library,doc);
 const file=path.join(library,doc.assets[0].localRelativePath);
 for(const svg of [camera+'\n',camera.replace('</svg>','<script>alert(1)</script></svg>'),camera.replace('</svg>','<image href="https://example.org/a.svg"/></svg>')]){
   fs.writeFileSync(file,svg);assert.throws(()=>composite.resolveAsset(doc.assets[0].assetId));
 }
 fs.writeFileSync(file,camera);
 const published=b.publishModernVisualPackAssetV1(project,doc.assets[0].assetId,composite);
 assert.equal(b.publishModernVisualPackAssetV1(project,doc.assets[0].assetId,composite).status,'reused');
 assert(published.asset.source.catalogSnapshot);assert.equal(published.asset.source.catalogSnapshot.identity.id,doc.packId);
 // Production context/materializer; no final SceneSpec is handwritten.
 const cameraRow=rows[0];const ctx={...context(b,cameraRow,0,true),visualAssetPack:{...b.MODERN_VISUAL_PACK_V1,localLibrary:true}};
 const resolve=contexts=>b.resolveModernVisualGenerationBatchV2({contexts,projectRoot:project});
 const selected=(await resolve([ctx]))[0];assert(selected.resolved.choices.some(c=>c.catalogAsset?.id===doc.packId),'local Hero reaches production');
 assert(selected.resolved.choices.length<=3);
 const supportRow={id:'local-support',keyword:'PASTEL',text:'Un pastel aparece junto a una cámara.',concepts:[{label:'1F382',canonicalHint:'1F382'},{label:'cámara',canonicalHint:'camera',emoji:'📷'}],mode:'auto',duration:2};
 const support=(await resolve([{...context(b,supportRow,31,true),visualAssetPack:ctx.visualAssetPack}]))[0];
 assert(support.resolved.choices.some(c=>c.slotId!=='hero'&&c.catalogAsset?.id===doc.packId),'local Support reaches production');
 assert(support.resolved.choices.some(c=>c.provider==='openmoji'),'direct icon preserved beside local asset');
 const selectedIdentity=b.sceneSpecPixelIdentityAny(selected.resolved.compiled.sceneSpec);
 // Removing configuration simulates a removed library, not removal of project content.
 process.env.CIPHER_VISUAL_LIBRARY_PATH=path.join(fixture,'absent');
 const absent=b.createCompositeVisualCatalogV1();assert.equal(absent.entries().length,95);assert.equal(absent.diagnostics[0].code,'LOCAL_CATALOG_UNAVAILABLE');
 const regenerated=(await resolve([selected.context]))[0];assert.equal(b.sceneSpecPixelIdentityAny(regenerated.resolved.compiled.sceneSpec),selectedIdentity);
 const fallback=(await resolve([ctx]))[0];assert(fallback.resolved.choices.some(c=>c.catalogAsset?.id===b.MODERN_VISUAL_PACK_V1.id));
 let qc;const render=async row=>b.renderGraphicClip(row.resolved.compiled.graphicData,{ancho:540,alto:960,fps:24,duracion:row.context.duration,modo:'pantalla',sistema:'editorial',projectRoot:project,renderBindings:row.resolved.compiled.renderBindings,onQcReport:v=>qc=v,onQcFailure:v=>qc=v});
 const visual=await render(selected);assert(visual&&fs.existsSync(visual),JSON.stringify(qc));assert(qc&&!qc.findings.some(f=>f.level==='error'));
 const again=await render(regenerated);assert.equal(hash(fs.readFileSync(visual)),hash(fs.readFileSync(again)));
 fs.copyFileSync(visual,path.join(evidence,'local-library-offline.mp4'));
 const supportVideo=await render(support);assert(supportVideo&&fs.existsSync(supportVideo),JSON.stringify(qc));assert(!qc.findings.some(f=>f.level==='error'));
 fs.copyFileSync(supportVideo,path.join(evidence,'local-library-support-offline.mp4'));
 // Missing project content is NOT a cached successful render of the present state.
 const bytes=fs.readFileSync(published.absoluteFile);fs.unlinkSync(published.absoluteFile);
 await assert.rejects(()=>resolve([selected.context]),e=>e.code==='MOTION_GRAPHICS_LOCKED_ASSET_INVALID','missing materialized asset fails before render/cache');
 fs.writeFileSync(published.absoluteFile,bytes);
 const sizes=[];
 for(const n of [100,500,1500,5000]){
   const root=path.join(fixture,'scale-'+n);write(root,document(n),false);const t=performance.now(),index=new b.LocalManifestCatalog(root),loadMs=performance.now()-t;
   const q=performance.now();for(let i=0;i<1000;i++){assert.equal(index.search(['fixture-concept-'+(n-1)]).length,1);assert.equal(index.search(['unlisted-term']).length,0)}
   sizes.push({metadataEntries:n,loadMs,queries:2000,queryMs:performance.now()-q,bytes:fs.statSync(path.join(root,'manifest.json')).size});
 }
 assert.equal(networkAttempts,0,'no network attempts during catalog or render; unrelated voice UI isolated');
 const report={baselineBundle:previous.bundleSha,currentBundle:baseline.bundleSha,embeddedAssets:95,baselineConcepts:63,baselineSearchAndIdentityParity:true,
   localFixtureAssets:1,productionAssetsAdded:0,localHero:true,localSupport:true,removedLibraryRegenerationParity:true,missingProjectAssetRejectedBeforeCache:true,visualFilesCreated:2,visualSinFichero:0,networkAttempts,scale:sizes};
 fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(report,null,2));console.log('LOCAL_LIBRARY_OK',JSON.stringify(report));exit=0;
}catch(e){console.error(e)}finally{try{b?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}catch(e){console.error(e);exit=1}app.exit(exit)}});
