const {app,BrowserWindow,dialog,ipcMain,session}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('editorial-local-v4-ui-route')
const projectRoot=path.join(fixture,'project')
const evidence=path.resolve(root,'../_cipher-editorial-product-route-v1/evidence/ui-route')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
const oldKey=process.env.DEEPSEEK_API_KEY,oldFetch=global.fetch,oldDialog=dialog.showOpenDialog
const realSemantic=process.argv.includes('--real-semantic')
const vertical=process.argv.includes('--vertical')
const manualColor=process.argv.includes('--manual-color')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const words=realSemantic
  ?'Un cromatógrafo líquido separa los componentes de una muestra para revelar qué contiene.'
  :'El cromatógrafo líquido analiza una muestra.'
const terms=[{icono:'star',ic:'🧪',etiqueta:'cromatógrafo líquido'},
  {icono:'flag',ic:'🧫',etiqueta:'muestra'},
  {icono:'users-group-rounded',ic:'📊',etiqueta:'datos'}]
const semanticReply={phrases:[{phraseIndex:1,visualClips:[{keyword:'cromatógrafo',timestamp:.05,
  duration:2.9,prompt:words,conceptos:terms,semantica:{relacion:'conecta',ancla:terms[0],terminos:terms}}]}]}
async function until(check,label,iterations=120){for(let i=0;i<iterations;i++){
  const value=await check();if(value)return value;await pause(250)}throw Error('UI_TIMEOUT:'+label)}
app.whenReady().then(async()=>{let code=1,semanticCalls=0,otherNetwork=0,win
  try{
    fs.mkdirSync(evidence,{recursive:true})
    if(!realSemantic)process.env.DEEPSEEK_API_KEY='offline-controlled-semantic-fixture'
    global.fetch=async (url,options)=>{if(String(url).startsWith('https://api.deepseek.com/chat/completions')){
      semanticCalls++
      if(realSemantic)return oldFetch(url,options)
      return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',
        message:{content:JSON.stringify(semanticReply)}}]})}}
      otherNetwork++;throw Error('UNEXPECTED_NETWORK:'+String(url))}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url))otherNetwork++
      callback({cancel:/^https?:/i.test(details.url)})})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    const source=path.join(fixture,'original.mp4')
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
      'color=c=black:s=360x640:r=12:d=3','-f','lavfi','-i','sine=frequency=440:duration=3',
      '-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source])
    const tokens=words.split(/\s+/u)
    const segment={start:0,end:3,text:words,words:tokens.map((word,index)=>({word,
      start:3*index/tokens.length,end:3*(index+1)/tokens.length}))}
    const video={id:'temp-original',name:'original.mp4',duration:'0:03',durationSeconds:3,
      type:'video',path:source,size:'1 MB',category:'originales'}
    const audio={id:'temp-audio',name:'Voz - Audio Original',startSeconds:0,durationSeconds:3,
      type:'audio',path:source}
    b.createProjectFiles(projectRoot,{id:'v4-ui-route',name:'V4 UI temporal',clips:[video],
      timelineVideoClips:[audio],transcriptionStatus:'completed',transcriptSegments:[segment],
      newAudioSegments:[segment],aiScript:words,timelineWeights:[0,0,0,100],
      aspectRatio:vertical?'vertical':'horizontal',
      visualPresentationProfile:'editorial-local-bank-v2',modularCatalogRoot:catalogRoot,
      editorialLocalAccent:'auto'})
    console.log('PROJECT_STATE_BEFORE_UI',JSON.stringify((()=>{const s=JSON.parse(fs.readFileSync(
      path.join(projectRoot,'project-state.json'),'utf8'));return {aiScript:s.aiScript,
      clips:s.clips?.length,timeline:s.timelineVideoClips?.length,profile:s.visualPresentationProfile}})()))
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path.join(projectRoot,'project-state.json')]})
    win=await until(()=>BrowserWindow.getAllWindows().find(item=>item.webContents.getURL().includes('/dist/index.html')&&
      !item.webContents.isLoading()),'editor-window')
    win.webContents.setBackgroundThrottling(false)
    const js=code=>win.webContents.executeJavaScript(code)
    await until(()=>js(`!![...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Abrir Proyecto')`),'dashboard')
    await js(`[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Abrir Proyecto').closest('.group').click()`)
    await until(()=>js(`!!document.querySelector('#visual-presentation-profile')`),'project-loaded')
    const choose=(id,value)=>js(`(()=>{const s=document.querySelector('#${id}');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(value)});
      s.dispatchEvent(new Event('change',{bubbles:true}));return s.value})()`)
    assert.equal(await choose('visual-presentation-profile','editorial-local-bank-v4'),'editorial-local-bank-v4')
    await pause(300)
    const uiRoot=await js(`[...document.querySelectorAll('input')].find(i=>i.closest('label')?.textContent.includes('Biblioteca editorial local'))?.value`)
    assert.equal(uiRoot,catalogRoot)
    if(manualColor){
      const selected=await js(`(()=>{const s=[...document.querySelectorAll('label')]
        .find(item=>item.textContent.includes('Acento del video'))?.querySelector('select');
        if(!s)return null;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')
          .set.call(s,'#238C87');s.dispatchEvent(new Event('change',{bubbles:true}));return s.value})()`)
      assert.equal(selected,'#238C87','MANUAL_COLOR_CONTROL_UNAVAILABLE')
    }
    console.log('UI_BUILD_CANDIDATES',await js(`JSON.stringify({buttons:[...document.querySelectorAll('button')]
      .filter(item=>item.textContent.includes('Construir Timeline IA')).map(item=>({disabled:item.disabled,text:item.textContent})),
      script:[...document.querySelectorAll('textarea')].map(item=>item.value.slice(0,90))})`))
    const build=await js(`(()=>{const b=[...document.querySelectorAll('button')]
      .find(item=>item.textContent.includes('Construir Timeline IA')&&!item.disabled);
      if(!b)return false;b.click();return true})()`)
    assert(build,'BUILD_BUTTON_UNAVAILABLE')
    let state=null
    for(let i=0;i<300;i++){
      await pause(1000)
      if(i%15===0)console.log('UI_WAIT',i)
      try{state=JSON.parse(fs.readFileSync(path.join(projectRoot,'project-state.json'),'utf8'))}catch{}
      if(state?.timelineVideoClips?.some(clip=>clip.category==='visual'))break
      const error=await js(`document.body.innerText.match(/(?:Error|error):.{0,180}/)?.[0]??''`)
      if(error&&i%15===0)console.log('UI_VISIBLE_ERROR',error)
    }
    assert(state?.timelineVideoClips?.some(clip=>clip.category==='visual'),'UI_DID_NOT_PERSIST_VISUAL')
    const visuals=state.timelineVideoClips.filter(clip=>clip.category==='visual')
    assert(visuals.every(clip=>fs.existsSync(clip.path)),'UI_VISUAL_SIN_FICHERO')
    assert(visuals.every(clip=>clip.visualRegeneration?.revision===b.EDITORIAL_LOCAL_BANK_V4.revision),
      'UI_WRONG_REVISION')
    if(manualColor){const plan=visuals[0].visualRegeneration.graphicData.extra.sceneSpec.editorialBankV2
      assert.equal(plan.accent,'#238C87','MANUAL_COLOR_NOT_PERSISTED')
      assert.equal(plan.sceneDecision.colorMode,'manual','MANUAL_COLOR_MODE_NOT_PERSISTED')}
    const prefix=`${realSemantic?'ui-real-semantic':'ui-controlled-semantic'}-${vertical?'vertical':'horizontal'}${manualColor?'-manual-teal':''}`
    const copied=path.join(evidence,`${prefix}-visual.mp4`)
    fs.copyFileSync(visuals[0].path,copied)
    const png=(await win.webContents.capturePage()).toPNG()
    fs.writeFileSync(path.join(evidence,`${prefix}.png`),png)
    const result={passed:true,semanticMode:realSemantic?'DEEPSEEK_REAL':'OFFLINE_MOCK',semanticCalls,otherNetwork,
      projectTemporary:true,profileSelectedInUI:true,buildClickedInUI:true,orientation:vertical?'9:16':'16:9',
      manualColor:manualColor?'#238C87':null,
      visualsRequested:1,visualsMaterialized:visuals.length,timelineVisuals:visuals.length,
      visualSinFichero:0,visualCopy:copied,screenshot:path.join(evidence,`${prefix}.png`)}
    fs.writeFileSync(path.join(evidence,`${prefix}-result.json`),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result));code=0
  }catch(error){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'failure.txt'),
    String(error?.stack||error));console.error(error?.stack||error)}
  finally{dialog.showOpenDialog=oldDialog;global.fetch=oldFetch
    if(oldKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=oldKey
    if(win&&!win.isDestroyed())win.destroy()
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
