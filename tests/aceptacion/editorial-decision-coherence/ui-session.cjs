// Bootstrap only. Generation, reopen, regeneration and export MUST be clicked in
// the real app; this file never invokes an IPC handler or a DOM control.
const {app,dialog,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'../../..'),source=process.env.CIPHER_UI_SOURCE
const evidence=process.env.CIPHER_DECISION_EVIDENCE
if(!source||!evidence)throw Error('EXPLICIT_TEMPORARY_UI_SOURCE_AND_EVIDENCE_REQUIRED')
const run=path.join(evidence,'ui-'+path.basename(source)+'-'+Date.now()),project=path.join(run,'project')
fs.mkdirSync(run,{recursive:true});fs.cpSync(source,project,{recursive:true,errorOnExist:true,force:false})
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const before={project:source,stateSha256:sha(path.join(source,'project-state.json')),
  mainBundleSha256:sha(path.join(root,'dist-electron/main/index.js')),backupSha256:sha(path.join(root,'project-state.json.bak')),
  checkpoint:'651d021e689f1c4d50493d3dd0bc069a36a5d2df'}
let state=JSON.parse(fs.readFileSync(path.join(source,'project-state.json'),'utf8'))
state=JSON.parse(JSON.stringify(state).split(source.replace(/\\/g,'\\\\')).join(project.replace(/\\/g,'\\\\')))
state.id='decision-test-'+state.id;state.name='DECISION TEMPORAL '+path.basename(source)
state.timelineVideoClips=state.timelineVideoClips.filter(c=>c.type==='audio')
state.timelineVersions=[];state.activeVersionId=null
fs.writeFileSync(path.join(project,'project-state.json'),JSON.stringify(state,null,2))
fs.writeFileSync(path.join(run,'source-integrity.json'),JSON.stringify(before,null,2))
app.setPath('userData',path.join(run,'userData'));app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(run)
if(process.env.CIPHER_FFMPEG_EXE)process.env.PATH=path.dirname(process.env.CIPHER_FFMPEG_EXE)+path.delimiter+process.env.PATH
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path.join(project,'project-state.json')]})
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(run,'export-after.mp4')})
const originalHandle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(channel,listener)=>originalHandle(channel,async(event,...args)=>{
  if(channel==='get-elevenlabs-voices')return {success:true,voices:[]}
  const started=Date.now()
  try{const result=await listener(event,...args)
    if(['generate-timeline-assets','export-video','regenerate-graphics','save-project-state','load-project'].includes(channel))
      fs.writeFileSync(path.join(run,channel+'-'+started+'.json'),JSON.stringify({channel,milliseconds:Date.now()-started,result},null,2))
    return result
  }catch(error){fs.appendFileSync(path.join(run,'handler-errors.txt'),channel+': '+error.stack+'\n');throw error}
})
require(path.join(root,'dist-electron/main/index.js'))
console.log(JSON.stringify({run,project,source,weights:state.timelineWeights}))
