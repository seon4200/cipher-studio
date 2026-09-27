// Persisted-plan replay through the ordinary regeneration handler, not UI or a
// semantic-selection test. Three fresh project caches per orientation; no deletion.
const {app,ipcMain,session}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('decision-replay')
const output=process.env.CIPHER_DECISION_EVIDENCE,source=process.env.CIPHER_REPLAY_SOURCE_PROJECT
const sceneFile=process.env.CIPHER_REPLAY_SCENE_FILE,external=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH
if(!output||!source||!sceneFile||!external)throw Error('EXPLICIT_REPLAY_PATHS_REQUIRED')
app.setPath('userData',path.join(fixture,'userData'));process.chdir(fixture)
const originalHandle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(name,fn)=>originalHandle(name,name==='get-elevenlabs-voices'?async()=>({success:true,voices:[]}):fn)
app.on('browser-window-created',(_,window)=>{window.hide();window.on('ready-to-show',()=>window.hide())})
const sha=data=>crypto.createHash('sha256').update(data).digest('hex')
app.whenReady().then(async()=>{let exit=1;try{
  const saved=JSON.parse(fs.readFileSync(sceneFile,'utf8')),spec=saved.sceneSpec
  const b=require(path.join(root,'dist-electron/main/index.js'));app.removeAllListeners('window-all-closed')
  let networkAttempts=0,catalogAttempts=0
  global.fetch=async()=>{networkAttempts++;throw Error('REPLAY_NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url))networkAttempts++;cb({cancel:/^https?:/.test(d.url)})})
  const guard=file=>{if(typeof file==='string'&&path.resolve(file).toLowerCase().startsWith(path.resolve(external).toLowerCase()+path.sep)){
    catalogAttempts++;throw Error('REPLAY_EXTERNAL_CATALOG_FORBIDDEN')}}
  for(const name of ['readFileSync','readdirSync','openSync','statSync','accessSync']){
    const original=fs[name].bind(fs);fs[name]=(file,...args)=>{guard(file);return original(file,...args)}
  }
  for(const name of ['readFile','readdir','open','stat','access']){
    const original=fs.promises[name].bind(fs.promises);fs.promises[name]=async(file,...args)=>{guard(file);return original(file,...args)}
  }
  const invoke=(channel,payload)=>ipcMain._invokeHandlers.get(channel)({sender:{send:()=>{},isDestroyed:()=>false}},payload)
  const context={version:3,sceneId:spec.editorialBankV2.sceneDecision.sceneId,revision:spec.presentationProfile.revision,
    graphicData:saved.graphicData,renderBindings:saved.renderBindings,
    duration:spec.editorialBankV2.sceneDecision.durationSeconds,sistema:'editorial'}
  const contextSha=sha(JSON.stringify(context)),outputs=[]
  fs.mkdirSync(output,{recursive:true})
  for(const orientation of ['vertical','horizontal']){
    const hashes=[]
    for(let run=1;run<=3;run++){
      const project=path.join(fixture,orientation+'-'+run)
      b.createProjectFiles(project,{id:'replay-'+orientation+'-'+run,name:'Temporary replay',clips:[],timelineVideoClips:[]})
      fs.cpSync(path.join(source,'materiales','assets'),path.join(project,'materiales','assets'),{recursive:true})
      const loaded=await invoke('load-project',{projectPath:project});assert(loaded.success)
      const state={...loaded.data,timelineVideoClips:[{id:'replay-visual',category:'visual',visualRegeneration:context}]}
      assert((await invoke('save-project-state',state)).success)
      const reopened=await invoke('load-project',{projectPath:project});assert(reopened.success)
      const restored=reopened.data.timelineVideoClips[0].visualRegeneration
      assert.equal(sha(JSON.stringify(restored)),contextSha,'SAVED_DECISIONS_CHANGED')
      const replay=await invoke('regenerate-graphics',{mode:'modern-visual',aspectRatio:orientation,resolution:'720p',
        modernVisuals:[{clipId:'replay-visual',context:restored}]})
      assert(replay.success&&replay.clips?.[0]?.success,'REPLAY_FAILED:'+JSON.stringify(replay))
      assert.equal(sha(JSON.stringify(replay.clips[0].visualRegeneration)),contextSha)
      const file=replay.clips[0].path;assert(fs.existsSync(file)&&fs.statSync(file).size>0)
      const destination=path.join(output,orientation+'-'+run+'.mp4');fs.copyFileSync(file,destination)
      const digest=sha(fs.readFileSync(file));hashes.push(digest);outputs.push({orientation,run,project,file:destination,sha256:digest})
    }
    assert.equal(new Set(hashes).size,1,'REPLAY_MP4_SHA_DIFFERENT:'+orientation)
  }
  assert.equal(networkAttempts,0);assert.equal(catalogAttempts,0)
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,productUI:false,directedSavedPlan:true,
    contextSha,networkAttempts,catalogAttempts,outputs,bundleSha256:sha(fs.readFileSync(path.join(root,'dist-electron/main/index.js')))},null,2))
  exit=0
}catch(error){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.txt'),error.stack);console.error(error.stack)}finally{app.exit(exit)}})
