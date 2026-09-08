// Real compiled consumers and existing IPC; every mutable fixture is confined to os.tmpdir().
const {app, ipcMain, dialog} = require('electron')
const fs = require('fs'), path = require('path'), assert = require('assert/strict')
const { MARKER, assertSafeFixtureRoot, assertFixtureChild, createTestFixture, cleanupTestFixture, removeFixtureFile } = require('./helpers/safe-fixture')
const REPO_ROOT = path.resolve(__dirname, '..')
const root = createTestFixture('assets-persistence')
process.chdir(root)
const rootProjectStateFiles = [
  path.join(REPO_ROOT, 'project-state.json'),
  path.join(REPO_ROOT, 'project-state.json.bak'),
]
const assertNoRepositoryProjectState = () => {
  for (const file of rootProjectStateFiles) assert(!fs.existsSync(file), 'la suite no puede crear ' + file)
}
let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('OK ' + name) }
const put = (p,v) => { fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,JSON.stringify(v)) }
const raw = p => fs.readFileSync(p,'utf8')
const call = (name,arg) => ipcMain._invokeHandlers.get(name)({sender:{send(){}}},arg)
app.whenReady().then(async () => {
  const b = require(path.resolve(__dirname,'../dist-electron/main/index.js'))
  const substrate = {projectSubstrateVersion:1,primaryStyle:'tech',paletteId:'clinico',
    fontPairId:'technical-black',decoratorFamilyId:'circuits',textureFamilyId:'dark-lines'}
  const legacy = {id:'test-only',clips:[{path:'C:\\legacy\\video.mp4'}],timelineVideoClips:[],
    aiScript:'fixture',unknown:{nested:[1,2,3]}}
  const future = {schemaVersion:99,projectSubstrate:null}
  const fail = (fn,code) => assert.throws(fn,e=>e.code===code)
  const p = path.join(root,'project-state.json')
  const manifest = path.join(root,'materiales/assets/manifest.json')
  const asset = () => ({id:'a',provider:'fixture',relativeFile:'materiales/assets/fixture/a.bin',
    sha256:'a'.repeat(64),mime:'application/octet-stream',byteLength:5,source:{},
    validation:{status:'accepted',validationRevision:'fixture-v1',warnings:[]}})
  const m = (assets=[]) => ({assetManifestVersion:1,assets})
  test('fixture isolation rejects repository-like roots and only cleans its own exact temporary directory',()=>{
    assertNoRepositoryProjectState()
    assert.throws(()=>assertSafeFixtureRoot(REPO_ROOT), error=>error && error.code==='CIPHER_TEST_FIXTURE_UNSAFE')
    const isolation = createTestFixture('isolation')
    const withGit = path.join(isolation, 'with-git')
    const withProjects = path.join(isolation, 'with-projects')
    const withoutMarker = path.join(isolation, 'without-marker')
    const valid = createTestFixture('isolation-valid')
    const sibling = createTestFixture('isolation-sibling')
    try {
      for (const unsafe of [withGit, withProjects]) {
        fs.mkdirSync(unsafe, { recursive: true })
        fs.writeFileSync(path.join(unsafe, MARKER), 'synthetic marker')
      }
      fs.mkdirSync(path.join(withGit, '.git'))
      fs.mkdirSync(path.join(withProjects, 'proyectos'))
      fs.mkdirSync(withoutMarker)
      assert.throws(()=>assertSafeFixtureRoot(withGit), error=>error && error.code==='CIPHER_TEST_FIXTURE_UNSAFE')
      assert.throws(()=>assertSafeFixtureRoot(withProjects), error=>error && error.code==='CIPHER_TEST_FIXTURE_UNSAFE')
      assert.throws(()=>assertFixtureChild(root, path.join(REPO_ROOT, 'proyectos')), error=>error && error.code==='CIPHER_TEST_FIXTURE_UNSAFE')
      assert.throws(()=>cleanupTestFixture(withoutMarker), error=>error && error.code==='CIPHER_TEST_FIXTURE_UNSAFE')
      assert.throws(()=>cleanupTestFixture(path.dirname(valid)), error=>error && error.code==='CIPHER_TEST_FIXTURE_UNSAFE')
      fs.writeFileSync(path.join(valid, 'only-this-fixture.txt'), 'fixture')
      assert.doesNotThrow(()=>assertSafeFixtureRoot(valid))
      cleanupTestFixture(valid)
      assert(!fs.existsSync(valid))
      assert(fs.existsSync(sibling))
    } finally {
      if (fs.existsSync(sibling)) cleanupTestFixture(sibling)
      if (fs.existsSync(isolation)) cleanupTestFixture(isolation)
    }
    assertNoRepositoryProjectState()
  })
  test('legacy migrates in memory without mutation or unknown-field loss',()=>{
    const copy=JSON.stringify(legacy),r=b.migrateProjectState(legacy)
    assert.equal(r.sourceVersion,0);assert.equal(r.targetVersion,1);assert.equal(r.migrated,true)
    assert.deepEqual(r.state,{...legacy,schemaVersion:1,projectSubstrate:null})
    assert.equal(JSON.stringify(legacy),copy)
  })
  test('legacy load leaves bytes and absent asset storage untouched',()=>{
    put(p,legacy);const bytes=raw(p),time=fs.statSync(p).mtimeMs
    const r=b.loadProjectFile(p)
    assert.equal(r.assets.status,'absent');assert(r.warnings.includes('PROJECT_STATE_MIGRATED_IN_MEMORY'))
    assert.equal(raw(p),bytes);assert.equal(fs.statSync(p).mtimeMs,time);assert(!fs.existsSync(manifest))
  })
  test('new project creates V1 state and empty manifest',()=>{
    const dir=path.join(root,'new')
    const state=b.createProjectFiles(dir,legacy)
    assert.equal(state.schemaVersion,1);assert.equal(state.projectSubstrate,null)
    assert.deepEqual(b.readAssetStorage(dir).manifest,m())
  })
  test('ensure storage is idempotent',()=>{
    b.ensureAssetStorage(root);const bytes=raw(manifest),time=fs.statSync(manifest).mtimeMs
    b.ensureAssetStorage(root);assert.equal(raw(manifest),bytes);assert.equal(fs.statSync(manifest).mtimeMs,time)
  })
  test('V1 and substrate round trip through save/load',()=>{
    b.saveProjectFile(p,{...legacy,schemaVersion:1,projectSubstrate:substrate})
    const r=b.loadProjectFile(p);assert.deepEqual(r.state.projectSubstrate,substrate)
    assert.deepEqual(r.state.clips,legacy.clips);assert.deepEqual(r.state.unknown,legacy.unknown)
    assert.equal(b.migrateProjectState(r.state).migrated,false)
  })
  test('renderer partial payload preserves unknown data and substrate',()=>{
    b.saveProjectFile(p,{id:'test-only',aiScript:'edited'})
    const r=b.loadProjectFile(p).state
    assert.deepEqual(r.projectSubstrate,substrate);assert.deepEqual(r.unknown,legacy.unknown)
  })
  test('future source rejects load/save without overwrite or backup downgrade',()=>{
    const q=path.join(root,'future.json');put(q,future);put(q+'.bak',legacy);const before=raw(q)
    fail(()=>b.loadProjectFile(q),'PROJECT_STATE_UNSUPPORTED_VERSION')
    fail(()=>b.saveProjectFile(q,legacy),'PROJECT_STATE_UNSUPPORTED_VERSION');assert.equal(raw(q),before)
  })
  test('invalid schema is typed (including numeric string and explicit zero)',()=>{
    for(const v of ['1',null,0,-1,1.5]) fail(()=>b.migrateProjectState({...legacy,schemaVersion:v}),'PROJECT_STATE_INVALID_VERSION')
  })
  test('invalid substrate cannot erase the rest of the persisted project',()=>{
    const q=path.join(root,'bad-substrate.json');put(q,{...legacy,schemaVersion:1,projectSubstrate:{...substrate,paletteId:'red'}})
    const before=raw(q);fail(()=>b.loadProjectFile(q),'PROJECT_SUBSTRATE_INVALID');assert.equal(raw(q),before)
    for(const brandMarkId of ['','https://example.com','C:\\x','#fff','x{}'])
      fail(()=>b.validateProjectSubstrate({...substrate,brandMarkId}),'PROJECT_SUBSTRATE_INVALID')
    fail(()=>b.validateProjectSubstrate({...substrate,css:'red'}),'PROJECT_SUBSTRATE_INVALID')
  })
  test('manifest empty and nonempty validate',()=>{
    assert.deepEqual(b.validateAssetManifest(m()),m())
    assert.equal(b.validateAssetManifest(m([asset()])).assets.length,1)
  })
  test('absolute, traversal, UNC, drive-relative and URL paths reject',()=>{
    for(const relativeFile of ['C:\\a.png','../a','materiales/assets/fixture/../a','\\\\host\\share\\a','C:a','/tmp/a','https://example.com/a'])
      fail(()=>b.validateAssetManifest(m([{...asset(),relativeFile}])),'ASSET_MANIFEST_PATH_OUTSIDE_PROJECT')
  })
  test('duplicate IDs and case-insensitive paths reject',()=>{
    fail(()=>b.validateAssetManifest(m([asset(),{...asset(),relativeFile:'materiales/assets/fixture/b.bin'}])),'ASSET_MANIFEST_DUPLICATE_ID')
    fail(()=>b.validateAssetManifest(m([asset(),{...asset(),id:'b',relativeFile:'materiales/assets/fixture/A.bin'}])),'ASSET_MANIFEST_DUPLICATE_PATH')
  })
  test('duplicate active content rejects but a rejected record is historical',()=>{
    const a2={...asset(),id:'b',relativeFile:'materiales/assets/fixture/b.bin'}
    fail(()=>b.validateAssetManifest(m([asset(),a2])),'ASSET_MANIFEST_DUPLICATE_CONTENT')
    a2.validation={...a2.validation,status:'rejected'}
    assert.equal(b.validateAssetManifest(m([asset(),a2])).assets.length,2)
  })
  test('SHA, byteLength, unknown scene fields and invalid validation reject',()=>{
    for(const change of [{sha256:'A'.repeat(64)},{sha256:'abc'},{byteLength:-1},{byteLength:1.5},{keyword:'bad'},{validation:{status:'yes'}}])
      assert.throws(()=>b.validateAssetManifest(m([{...asset(),...change}])),b.PersistenceError)
  })
  test('separators normalize consistently without drive/ADS/reserved names',()=>{
    assert.equal(b.normalizeProjectRelativePath('materiales\\assets\\fixture\\a.bin',true),asset().relativeFile)
    for(const name of ['a:stream','CON','a.','a ']) assert.throws(()=>b.normalizeProjectRelativePath('materiales/assets/fixture/'+name,true))
    assert.equal(b.resolveProjectRelativePath(root,asset().relativeFile,true),path.join(root,asset().relativeFile))
  })
  test('structural audit does not require bytes; physical reports missing/size',()=>{
    assert.equal(b.auditAssetManifest(root,m([asset()])).status,'valid')
    assert.deepEqual(b.auditAssetManifest(root,m([asset()]),true).missingAssets,['a'])
    const file=path.join(root,asset().relativeFile);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from('12345'))
    assert.equal(b.auditAssetManifest(root,m([asset()]),true).status,'valid')
    assert(b.auditAssetManifest(root,m([{...asset(),byteLength:6}]),true).errors.length)
  })
  test('physical confinement rejects an external junction',()=>{
    const outside=createTestFixture('assets-outside')
    try {
      const link=path.join(root,'materiales/assets/linked');fs.symlinkSync(outside,link,'junction')
      fail(()=>b.resolveProjectRelativePath(root,'materiales/assets/linked/file.bin',true),'ASSET_MANIFEST_PATH_OUTSIDE_PROJECT')
      assert.equal(b.auditAssetManifest(root,m([{...asset(),provider:'linked',relativeFile:'materiales/assets/linked/file.bin'}]),true).outsideAssets.length,1)
      removeFixtureFile(root, link)
    } finally { cleanupTestFixture(outside) }
  })
  test('atomic write leaves complete target and valid previous backup',()=>{
    b.saveProjectFile(p,{aiScript:'before'})
    b.saveProjectFile(p,{aiScript:'after'})
    assert.equal(JSON.parse(raw(p)).aiScript,'after');assert.equal(JSON.parse(raw(p+'.bak')).aiScript,'before')
    assert(!fs.readdirSync(root).some(n=>n.startsWith('.project-state.json.cipher-')))
  })
  test('injected pre-publication failure preserves previous primary',()=>{
    const before=raw(p)
    fail(()=>b.writeJsonAtomic(p,{...legacy,aiScript:'should-not-publish'},
      v=>b.migrateProjectState(v).state,'PROJECT_STATE',{beforePublish(){throw Error('injected')}}),'PROJECT_STATE_WRITE_FAILED')
    assert.equal(raw(p),before);JSON.parse(raw(p+'.bak'))
    assert(!fs.readdirSync(root).some(n=>n.startsWith('.project-state.json.cipher-')))
  })
  test('corrupt primary recovers backup honestly without rewriting',()=>{
    fs.writeFileSync(p,'{broken');const r=b.loadProjectFile(p)
    assert.equal(r.status,'recovered-from-backup');assert(r.warnings.includes('PROJECT_STATE_RECOVERED_FROM_BACKUP'))
    assert.equal(raw(p),'{broken')
    b.saveProjectFile(p,{aiScript:'repair-on-explicit-save'});JSON.parse(raw(p));JSON.parse(raw(p+'.bak'))
  })
  test('both corrupt are not replaced with defaults',()=>{
    const q=path.join(root,'both.json');fs.writeFileSync(q,'{');fs.writeFileSync(q+'.bak','{')
    fail(()=>b.loadProjectFile(q),'PROJECT_STATE_UNRECOVERABLE')
    fail(()=>b.saveProjectFile(q,legacy),'PROJECT_STATE_UNRECOVERABLE');assert.equal(raw(q),'{')
  })
  test('manifest backup recovery and unsupported-version are explicit',()=>{
    b.saveAssetManifest(root,m([asset()]));fs.writeFileSync(manifest,'{')
    assert.equal(b.readAssetStorage(root).status,'recovered-from-backup');assert.equal(raw(manifest),'{')
    b.saveAssetManifest(root,m())
    put(manifest,{assetManifestVersion:99,assets:[]})
    assert.equal(b.readAssetStorage(root).status,'unsupported-version')
    fail(()=>b.ensureAssetStorage(root),'ASSET_MANIFEST_UNSUPPORTED_VERSION')
    fail(()=>b.saveAssetManifest(root,m()),'ASSET_MANIFEST_UNSUPPORTED_VERSION')
    fs.writeFileSync(manifest,'{');fs.writeFileSync(manifest+'.bak','{')
    assert.equal(b.readAssetStorage(root).status,'invalid')
    assert.throws(()=>b.ensureAssetStorage(root));assert.equal(raw(manifest),'{')
  })
  test('own leftovers reported, foreign temporary untouched, primary preferred',()=>{
    const q=path.join(root,'temps.json');put(q,legacy)
    const temp=path.join(root,'.temps.json.cipher-leftover.tmp'),foreign=path.join(root,'foreign.tmp')
    put(temp,future);fs.writeFileSync(foreign,'do not delete')
    const r=b.loadProjectFile(q);assert.equal(r.status,'valid');assert(r.warnings.includes('PROJECT_STATE_TEMPORARIES_PRESENT'))
    b.saveProjectFile(q,{aiScript:'ok'});assert(fs.existsSync(temp));assert(fs.existsSync(foreign))
  })
  // Existing IPC handlers (no new test IPC) with temporary projects, never the user's 61.
  await new Promise(r=>setTimeout(r,1000))
  const ipcDir=path.join(root,'ipc'),ipcFile=path.join(ipcDir,'project-state.json')
  put(ipcFile,legacy);const original=raw(ipcFile)
  const loaded=await call('load-project',{projectPath:ipcDir})
  assert(loaded.success);assert.equal(raw(ipcFile),original);assert.equal(loaded.persistence.assets.status,'absent')
  const saved=await call('save-project-state',{projectSubstrate:substrate,aiScript:'IPC'})
  assert(saved.success)
  const reloaded=await call('load-project-state')
  assert.deepEqual(reloaded.data.projectSubstrate,substrate);assert.deepEqual(reloaded.data.unknown,legacy.unknown)
  const copy=path.join(root,'saved-as.json')
  dialog.showSaveDialog=async()=>({canceled:false,filePath:copy})
  assert((await call('save-project-as',{aiScript:'AS'})).success)
  assert.deepEqual(b.loadProjectFile(copy).state.projectSubstrate,substrate)
  const other=path.join(root,'other-project')
  b.createProjectFiles(other,{...legacy,unknown:{belongsTo:'other'},projectSubstrate:null})
  const copyAfterSwitch=path.join(root,'saved-after-switch.json')
  dialog.showSaveDialog=async()=>{
    assert((await call('load-project',{projectPath:other})).success)
    return {canceled:false,filePath:copyAfterSwitch}
  }
  assert((await call('save-project-as',{aiScript:'source captured before dialog'})).success)
  assert.deepEqual(b.loadProjectFile(copyAfterSwitch).state.projectSubstrate,substrate)
  assert.deepEqual(b.loadProjectFile(copyAfterSwitch).state.unknown,legacy.unknown)
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[copy]})
  assert((await call('open-project')).success)
  put(copy,future)
  const blocked=await call('open-project');assert(!blocked.success);assert.equal(blocked.code,'PROJECT_STATE_UNSUPPORTED_VERSION')
  passed++;console.log('OK integrated IPC load/save/autosave-payload/save-as/open, unknown fields and future rejection')
  // Independent helper close/reopen: no singleton or hidden state needed.
  const rt=path.join(root,'roundtrip');const state=b.createProjectFiles(rt,{...legacy,projectSubstrate:substrate})
  assert.deepEqual(b.loadProjectFile(path.join(rt,'project-state.json')).state,state)
  assert.deepEqual(b.readAssetStorage(rt).manifest,m())
  passed++;console.log('OK integrated temporary project + substrate + empty manifest round trip')
  await call('close-project')
  assertNoRepositoryProjectState()
  console.log('ASSETS PERSISTENCE: '+passed+' groups passed on '+process.platform+'; fixtures: '+root)
  process.chdir(path.dirname(root))
  cleanupTestFixture(root)
  app.exit(0)
}).catch(e=>{console.error(e);console.error('Fixtures retained for diagnosis: '+root);app.exit(1)})
