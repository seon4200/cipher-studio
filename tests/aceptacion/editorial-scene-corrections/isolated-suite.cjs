// Supply an isolated Electron profile to older suites which already isolate projects.
const {app,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const root=path.resolve(__dirname,'../../..'),target=path.resolve(root,process.argv.at(-1))
if(!target.startsWith(path.join(root,'tests')+path.sep)||target===__filename)throw Error('TEST_PATH_NOT_ALLOWED')
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cipher-suite-profile-')))
const handle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(name,fn)=>handle(name,name==='get-elevenlabs-voices'?async()=>({success:true,voices:[]}):fn)
require(target)
