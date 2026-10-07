// Isolated built-app UI check; never opens the user's project or Electron userData.
const {app,BrowserWindow,ipcMain}=require('electron')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const fixture=createTestFixture('editorial-local-ui-panel')
const evidence=path.resolve(root,'../_cipher-editorial-local-bank-v2/evidence/ui-panel')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
require(path.join(root,'dist-electron/main/index.js'))
ipcMain.removeHandler('get-elevenlabs-voices')
ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function editorWindow(){
  for(let n=0;n<120;n++){
    const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/dist/index.html'))
    if(win&&!win.webContents.isLoading())return win
    await pause(100)
  }
  throw Error('EDITORIAL_LOCAL_UI_WINDOW_NOT_READY')
}

app.whenReady().then(async()=>{let exitCode=1;try{
  fs.mkdirSync(evidence,{recursive:true})
  const win=await editorWindow();win.showInactive()
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('h2'))
    .find(h=>h.textContent.trim()==='Nuevo Proyecto')?.closest('.group')?.click()`)
  await pause(100)
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button'))
    .find(b=>b.textContent.trim()==='Crear Proyecto')?.click()`)
  let ready=false
  for(let n=0;n<100;n++){
    ready=await win.webContents.executeJavaScript(`Boolean(document.querySelector('option[value="editorial-local-bank-v2"]'))`)
    if(ready)break
    await pause(100)
  }
  assert(ready,'EDITORIAL_LOCAL_UI_EDITOR_NOT_READY')
  const view=()=>win.webContents.executeJavaScript(`(() => {
    const panel=document.querySelector('[aria-label="Mezcla y construcción del timeline"]')
    const profile=document.querySelector('#visual-presentation-profile')
    const build=Array.from(document.querySelectorAll('button'))
      .find(b=>b.textContent.includes('Construir Timeline IA'))
    if(!panel||!profile||!build)return {missing:true}
    build.scrollIntoView({block:'end',inline:'nearest'})
    const panelRect=panel.getBoundingClientRect(),buttonRect=build.getBoundingClientRect(),
      sectionRect=panel.closest('section').getBoundingClientRect()
    return {missing:false,profile:profile.value,width:innerWidth,height:innerHeight,
      panelHeight:panel.clientHeight,contentHeight:panel.scrollHeight,
      scrollTop:panel.scrollTop,buttonInsidePanel:panel.contains(build),
      buttonVisible:buttonRect.top>=panelRect.top-2&&
        buttonRect.bottom<=panelRect.bottom+2&&buttonRect.bottom<=sectionRect.bottom+2,
      panelInsideSection:panelRect.bottom<=sectionRect.bottom+2,
      rootField:Boolean(Array.from(panel.querySelectorAll('input'))
          .find(i=>i.closest('label')?.textContent.includes('Biblioteca editorial local'))),
      accentSelect:Boolean(Array.from(panel.querySelectorAll('label'))
          .find(l=>l.textContent.includes('Acento del video'))?.querySelector('select'))}
  })()`)
  const checks=[]
  const bounded=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>
    setTimeout(()=>reject(Error('UI_TIMEOUT:'+label)),12000))])
  for(const item of [{width:1366,height:768,zoom:1},{width:1920,height:1080,zoom:1},
    {width:1366,height:768,zoom:1.25}]){
    console.log('UI_PANEL_CASE',item)
    win.setContentSize(item.width,item.height)
    win.webContents.setZoomFactor(item.zoom)
    await pause(300)
    const result=await bounded(view(),'measure')
    assert(!result.missing&&result.profile==='editorial-local-bank-v2',
      'PROFILE_OR_PANEL_MISSING:'+JSON.stringify(result))
    assert(result.panelHeight>0&&result.contentHeight>=result.panelHeight&&result.panelInsideSection&&
      result.buttonInsidePanel&&result.buttonVisible,
      'PANEL_BUTTON_NOT_REACHABLE:'+JSON.stringify(result))
    assert(result.rootField&&result.accentSelect,'CATALOG_OR_ACCENT_CONTROL_MISSING')
    await pause(250)
    const filename=`panel-${item.width}x${item.height}-zoom-${item.zoom}.png`
    const png=(await bounded(win.webContents.capturePage(),'capture')).toPNG()
    assert(png.length>1000,'PANEL_SCREENSHOT_EMPTY')
    fs.writeFileSync(path.join(evidence,filename),png)
    checks.push({...item,...result,screenshot:path.join(evidence,filename)})
  }
  fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({passed:true,checks},null,2)+'\n')
  console.log(JSON.stringify({passed:true,checks}))
  exitCode=0
}catch(error){console.error(error?.stack||error)}finally{
  try{cleanupTestFixture(fixture)}catch(error){console.error(error)}
  app.exit(exitCode)
}}).catch(error=>{console.error(error);app.exit(1)})
