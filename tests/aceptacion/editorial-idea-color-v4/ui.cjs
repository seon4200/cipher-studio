// Isolated UI/preload/IPC persistence check. Does not access the user's project root.
const {app,BrowserWindow,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const source=path.resolve(root,'../_cipher-idea-assembly-v3/runtime')
const fixture=createTestFixture('editorial-idea-color-v4-ui')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
require(path.join(root,'dist-electron/main/index.js'))
ipcMain.removeHandler('get-elevenlabs-voices')
ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function waitForMainWindow(){
  for(let i=0;i<120;i++){
    const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/dist/index.html'))
    if(win && !win.webContents.isLoading())return win
    await delay(100)
  }
  throw Error('IDEA_V4_UI_WINDOW_NOT_READY')
}

app.whenReady().then(async()=>{let code=1;try{
  assert(fs.existsSync(source),'CHATGPT_IDEA_RUNTIME_MISSING')
  const win=await waitForMainWindow();win.hide()
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('h2'))
    .find(h=>h.textContent.trim()==='Nuevo Proyecto')?.closest('.group')?.click()`)
  await delay(100)
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button'))
    .find(b=>b.textContent.trim()==='Crear Proyecto')?.click()`)
  let editorReady=false
  for(let i=0;i<100;i++){
    editorReady=await win.webContents.executeJavaScript(`Boolean(document.querySelector('option[value="editorial-idea-assembly-v4"]'))`)
    if(editorReady)break
    await delay(100)
  }
  assert(editorReady,'IDEA_V4_EDITOR_NOT_READY')
  const ui=await win.webContents.executeJavaScript(`(() => {
    const option=document.querySelector('option[value="editorial-idea-assembly-v4"]')
    if(!option)return {option:false}
    const select=option.parentElement
    select.value=option.value
    select.dispatchEvent(new Event('change',{bubbles:true}))
    return {option:true,preload:typeof window.electronAPI.generateIdeaAssemblyV4Pilot==='function',
      replay:typeof window.electronAPI.regenerateIdeaAssemblyV4Pilot==='function'}
  })()`)
  assert.deepEqual(ui,{option:true,preload:true,replay:true})
  await delay(250)
  const pilotControls=await win.webContents.executeJavaScript(`({
    button:Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Generar IDEA V4 en timeline')),
    input:Array.from(document.querySelectorAll('input')).some(i=>i.placeholder.includes('Ruta absoluta de la carpeta runtime')),
    heroMode:Array.from(document.querySelectorAll('option')).filter(o=>
      o.value==='dual-accent'||o.value==='fixed-spectrum').every(o=>o.disabled)
  })`)
  assert.deepEqual(pilotControls,{button:true,input:true,heroMode:true})
  await win.webContents.executeJavaScript(`(() => {
    const select=document.querySelector('option[value="custom"]').parentElement
    select.value='custom';select.dispatchEvent(new Event('change',{bubbles:true}))
  })()`)
  await delay(100)
  await win.webContents.executeJavaScript(`(() => {
    const input=Array.from(document.querySelectorAll('label'))
      .find(label=>label.textContent.includes('HEX de Supports')).querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'#7B4EA3')
    input.dispatchEvent(new Event('input',{bubbles:true}))
  })()`)
  await delay(100)
  const current=await win.webContents.executeJavaScript('window.electronAPI.loadProjectState()')
  assert(current.success,current.error)
  const projectPath=path.join(fixture,'cipher-studio','proyectos',current.data.id)
  assert(fs.existsSync(path.join(projectPath,'project-state.json')),'PROJECT_OUTSIDE_FIXTURE')
  let attempts=0
  global.fetch=()=>{attempts++;throw Error('NETWORK_FORBIDDEN_V4_UI')}
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
    if(/^https?:/i.test(details.url)){attempts++;callback({cancel:true})}else callback({cancel:false})
  })
  const filled=await win.webContents.executeJavaScript(`(() => {
    const input=Array.from(document.querySelectorAll('input')).find(i=>i.placeholder.includes('Ruta absoluta de la carpeta runtime'))
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
    setter.call(input,${JSON.stringify(source)})
    input.dispatchEvent(new Event('input',{bubbles:true}))
    return input.value
  })()`)
  assert.equal(filled,source)
  let enabled=false
  for(let i=0;i<50;i++){
    enabled=await win.webContents.executeJavaScript(`!Array.from(document.querySelectorAll('button'))
      .find(b=>b.textContent.includes('Generar IDEA V4 en timeline'))?.disabled`)
    if(enabled)break
    await delay(100)
  }
  assert(enabled,'IDEA_V4_GENERATE_BUTTON_DISABLED')
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button'))
    .find(b=>b.textContent.includes('Generar IDEA V4 en timeline')).click()`)
  let generatedStatus=false
  for(let i=0;i<600;i++){
    generatedStatus=await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[role="status"]'))
      .some(e=>e.textContent.includes('IDEA V4 añadida al timeline'))`)
    if(generatedStatus)break
    await delay(100)
  }
  assert(generatedStatus,'IDEA_V4_UI_GENERATION_NOT_COMPLETED')
  let loaded
  for(let i=0;i<60;i++){
    loaded=await win.webContents.executeJavaScript('window.electronAPI.loadProjectState()')
    if(loaded.success && loaded.data.timelineVideoClips?.some(c=>c.visualRegeneration?.revision==='editorial-idea-assembly-2026-09-v4'))break
    await delay(100)
  }
  assert(loaded?.success,'IDEA_V4_AUTOSAVE_MISSING')
  const clip=loaded.data.timelineVideoClips.find(c=>c.visualRegeneration?.revision==='editorial-idea-assembly-2026-09-v4')
  assert(clip && fs.existsSync(clip.path),'IDEA_V4_TIMELINE_VISUAL_MISSING')
  assert.equal(loaded.data.visualPresentationProfile,'editorial-idea-assembly-v4')
  assert.equal(loaded.data.ideaV4AssetRoot,source)
  assert.deepEqual(loaded.data.ideaV4Color,{supportSource:'custom',customColor:'#7B4EA3',heroMode:'recolorable',heroPrimary:'#C5481E'})
  assert.equal(clip.visualRegeneration.graphicData.extra.sceneSpec.ideaAssembly.supportTint.resolvedColor,'#7B4EA3')
  const replay=await win.webContents.executeJavaScript(`window.electronAPI.regenerateIdeaAssemblyV4Pilot(${JSON.stringify(loaded.data.timelineVideoClips[0].visualRegeneration)})`)
  assert(replay.success && fs.existsSync(replay.path),replay.error||'IDEA_V4_IPC_REPLAY_MISSING')
  assert.equal(attempts,0,'NETWORK_ATTEMPT_AFTER_MATERIALIZATION')
  console.log(JSON.stringify({result:'PASS',projectInsideFixture:true,uiControls:pilotControls,
    persistedColor:loaded.data.ideaV4Color,generated:true,replayed:true,networkAttempts:attempts}))
  code=0
}catch(error){console.error(error?.stack||error)}finally{
  // The app owns only this marked temp fixture. Nothing in the user's workspace is removed.
  cleanupTestFixture(fixture)
  app.exit(code)
}}).catch(error=>{console.error(error);cleanupTestFixture(fixture);app.exit(1)})
