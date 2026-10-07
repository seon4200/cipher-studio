const {app,ipcMain,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('editorial-real-decisions')
app.setPath('userData',path.join(fixture,'userData'));process.chdir(fixture)
const handle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(channel,fn)=>handle(channel,channel==='get-elevenlabs-voices'?async()=>({success:true,voices:[]}):fn)
app.on('browser-window-created',(_event,window)=>{window.hide();window.on('ready-to-show',()=>window.hide())})
const evidence=path.resolve(root,'../_cipher-scene-corrections-20260927')
const narrations=[
  'Millones de familias no tienen alimentos suficientes para llegar al final del día.',
  'Las temperaturas extremas aumentan mientras los bosques pierden humedad.',
  'Durante el recorrido, una investigadora recoge muestras del río para comprobar si el agua sigue siendo potable.',
  'Pensar en lo que podrías conseguir no sustituye el trabajo que todavía no has hecho.'
]
app.whenReady().then(async()=>{let code=1;try{
  const b=require(path.join(root,'dist-electron/main/index.js'));app.removeAllListeners('window-all-closed')
  if(!process.env.DEEPSEEK_API_KEY)throw Error('DEEPSEEK_KEY_UNAVAILABLE')
  const catalog=new b.CuratedModularCatalogV2(process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250'))
  const results=[];fs.mkdirSync(evidence,{recursive:true})
  for(const [index,narration] of narrations.entries()){
    const semantic=b.createLocalSceneSemanticV1({sceneId:'natural-holdout-'+index,start:0,end:6,
      transcriptSegments:[{start:0,end:6,text:narration}],concepts:[]})
    const result=await b.decideEditorialScene({catalog,semantic,duration:6,apiKey:process.env.DEEPSEEK_API_KEY})
    results.push({narration,conditions:'candidate decision only; synthetic six-second interval; no audio or UI',...result})
    fs.writeFileSync(path.join(evidence,'real-decisions.json'),JSON.stringify(results,null,2))
    console.log(JSON.stringify({index,mode:result.decision?.mode,hero:result.decision?.heroId,
      title:result.decision?.visibleText,errors:result.attempts.map(a=>a.error??null),attempts:result.attempts.length}))
  }
  code=results.every(item=>item.decision)?0:2
}catch(error){console.error(error.stack)}finally{app.exit(code)}})
