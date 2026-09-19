// Real renderer + preload + IPC, but project root and userData belong only to this fixture.
const {app,BrowserWindow,session}=require('electron');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture');
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('pack-ui');
app.setPath('userData',path.join(fixture,'userData'));process.chdir(fixture);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){for(let i=0;i<100;i++){const v=await check();if(v)return v;await delay(100)}throw Error('UI_TIMEOUT:'+label)}
app.whenReady().then(async()=>{let code=1;try{
  const deny=()=>{throw Error('UI_TEST_NETWORK_BLOCKED')};global.fetch=deny;require('http').request=deny;require('https').request=deny;
  session.defaultSession.webRequest.onBeforeRequest((d,c)=>c({cancel:/^https?:/.test(d.url)}));
  require(path.join(root,'dist-electron/main/index.js'));
  const win=await until(()=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html')),'main window');
  win.hide();win.webContents.setBackgroundThrottling(false);const js=s=>win.webContents.executeJavaScript(s);
  await until(()=>js(`!![...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Nuevo Proyecto')`),'dashboard');
  await js(`[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Nuevo Proyecto').click()`);
  await until(()=>js(`!![...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Crear Proyecto')`),'new project modal');
  await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Crear Proyecto').click()`);
  await until(()=>js(`!!document.querySelector('#visual-asset-pack')`),'asset pack selector');
  assert.equal(await js(`document.querySelector('#visual-asset-pack').value`),'legacy');
  const choose=(id,value)=>js(`(()=>{const s=document.querySelector('#${id}');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'${value}');s.dispatchEvent(new Event('change',{bubbles:true}));return s.value})()`);
  await delay(1500);await choose('visual-asset-pack','modern-pack-100-v1');await delay(200);await choose('visual-presentation-profile','premium-type-color-v1');await delay(300);
  console.log('UI_SELECTION',await js(`JSON.stringify([...document.querySelectorAll('select[id]')].map(s=>[s.id,s.value]))`));
  console.log('UI_SAVE_BUTTON',await js(`JSON.stringify([...document.querySelectorAll('button')].filter(e=>/Guardar/.test(e.title)).map(e=>({title:e.title,disabled:e.disabled,text:e.textContent})))`));
  await js(`[...document.querySelectorAll('button')].find(e=>e.title==='Guardar cambios pendientes')?.click()`);
  const projectsRoot=path.join(fixture,'cipher-studio/proyectos');
  const project=await until(()=>fs.existsSync(projectsRoot)&&fs.readdirSync(projectsRoot).map(n=>path.join(projectsRoot,n)).find(p=>fs.existsSync(path.join(p,'project-state.json'))),'isolated project');
  console.log('UI_STATE_KEYS',Object.keys(JSON.parse(fs.readFileSync(path.join(project,'project-state.json'),'utf8'))));
  const state=await until(()=>{const v=JSON.parse(fs.readFileSync(path.join(project,'project-state.json'),'utf8'));return v.visualAssetPack==='modern-pack-100-v1'?v:false},'persisted pack selection');
  assert.equal(state.visualPresentationProfile,'premium-type-color-v1');
  const bounds=await js(`(()=>{const s=document.querySelector('#visual-asset-pack'),r=s.getBoundingClientRect();return {value:s.value,x:r.x,y:r.y,width:r.width,height:r.height,innerHeight:innerHeight}})()`);
  const result={selector:true,defaultLegacy:true,packPersisted:true,presentationIndependent:true,bounds,projectIsTemporary:project.startsWith(fixture)};
  fs.mkdirSync(path.join(root,'../_modern-visual-pack-evidence'),{recursive:true});
  fs.writeFileSync(path.join(root,'../_modern-visual-pack-evidence/ui-check.json'),JSON.stringify(result,null,2));
  console.log('MODERN_PACK_UI_OK',JSON.stringify(result));code=0;
}catch(e){console.error(e)}finally{for(const w of BrowserWindow.getAllWindows())w.destroy();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture);app.exit(code)}});
