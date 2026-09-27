const {app,BrowserWindow,dialog,ipcMain,session}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('editorial-local-v4-ui-route')
const projectRoot=path.join(fixture,'project')
// The automated UI fixture is not a GPU performance test. Use Chromium's
// software compositing so headless Windows workers do not gate route coverage.
app.disableHardwareAcceleration()
const evidence=process.env.CIPHER_DECISION_EVIDENCE||path.resolve(root,'../_cipher-editorial-product-route-v1/evidence/ui-route')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
const oldKey=process.env.DEEPSEEK_API_KEY,oldFetch=global.fetch,oldDialog=dialog.showOpenDialog,
  oldSaveDialog=dialog.showSaveDialog
const realSemantic=process.argv.includes('--real-semantic')
const naturalSemantic=process.argv.includes('--natural-semantic')
const naturalSemanticHero=process.argv.includes('--natural-semantic-hero')
const freshNaturalSemantic=process.argv.includes('--fresh-natural-semantic')
const testNarration=process.env.CIPHER_TEST_NARRATION?.trim()
const testCaseId=process.env.CIPHER_TEST_CASE_ID?.trim()
if(testCaseId&&!/^[a-z0-9-]{1,40}$/.test(testCaseId))throw Error('INVALID_TEST_CASE_ID')
const vertical=process.argv.includes('--vertical')
const manualColor=process.argv.includes('--manual-color')
const richScene=process.argv.includes('--rich-scene')
const networkScene=process.argv.includes('--network-scene')
const abstractScene=process.argv.includes('--abstract-scene')
const exportFromUi=process.argv.includes('--export-from-ui')
const gate2Evidence=process.argv.includes('--gate2-evidence')
const regenerateFromUi=process.argv.includes('--regenerate-from-ui')
const regenerateWithoutCatalog=process.argv.includes('--regenerate-without-catalog')
const duration=testNarration||naturalSemantic||naturalSemanticHero||freshNaturalSemantic?4:3
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const words=testNarration??(networkScene?'Un sensor conecta la cámara y los datos en una red.':richScene
  ?'Cromatógrafo líquido analiza vial de muestra y micropipeta automática; hoja de registro de análisis químico conserva datos.'
  :abstractScene?'Ninguna certeza basta para responder.'
  :naturalSemantic
  ?'Un técnico utiliza el cromatógrafo para estudiar una muestra; después registra los resultados.'
  :naturalSemanticHero
  ?'Un cromatógrafo líquido separa la muestra mientras una técnica revisa el resultado.'
  :freshNaturalSemantic
  ?'Durante la madrugada, una científica observa el agua del río y descubre una alteración que obliga a revisar los datos.'
  :realSemantic
  ?'Un cromatógrafo líquido separa los componentes de una muestra para revelar qué contiene.'
  :'El cromatógrafo líquido analiza una muestra.')
const terms=networkScene?[{icono:'star',ic:'⚙️',etiqueta:'sensor'},
  {icono:'camera',ic:'📷',etiqueta:'cámara'},{icono:'chart',ic:'📊',etiqueta:'datos'}]:
  abstractScene?[{icono:'question-circle',ic:'❓',etiqueta:'certeza'},
  {icono:'question-circle',ic:'❓',etiqueta:'responder'},
  {icono:'question-circle',ic:'❓',etiqueta:'duda'}]:richScene?[{icono:'star',ic:'🧪',etiqueta:'cromatógrafo líquido'},
  {icono:'document',ic:'🧫',etiqueta:'vial de muestra'},
  {icono:'document',ic:'🧪',etiqueta:'micropipeta automática'},
  {icono:'document',ic:'📄',etiqueta:'hoja de registro de análisis químico'}]:[
  {icono:'star',ic:'🧪',etiqueta:'cromatógrafo líquido'},
  {icono:'flag',ic:'🧫',etiqueta:'muestra'},
  {icono:'users-group-rounded',ic:'📊',etiqueta:'datos'}]
const semanticReply={phrases:[{phraseIndex:1,visualClips:[{keyword:networkScene?'sensor':abstractScene?'certeza':'cromatógrafo',timestamp:.05,
  duration:duration-.1,prompt:words,conceptos:terms,semantica:{relacion:'conecta',ancla:terms[0],terminos:terms}}]}]}
async function until(check,label,iterations=120){for(let i=0;i<iterations;i++){
  const value=await check();if(value)return value;await pause(250)}throw Error('UI_TIMEOUT:'+label)}
app.whenReady().then(async()=>{let code=1,semanticCalls=0,otherNetwork=0,openDialogCalls=0,win,
  realSemanticShape=null
  try{
    fs.mkdirSync(evidence,{recursive:true})
    if(!realSemantic)process.env.DEEPSEEK_API_KEY='offline-controlled-semantic-fixture'
    global.fetch=async (url,options)=>{if(String(url).startsWith('https://api.deepseek.com/chat/completions')){
      semanticCalls++
      if(realSemantic){const response=await oldFetch(url,options)
        if(response.ok){const payload=await response.clone().json()
          const content=String(payload?.choices?.[0]?.message?.content??'')
          try{const parsed=JSON.parse(content.slice(content.indexOf('{'),content.lastIndexOf('}')+1))
            const clip=parsed?.phrases?.[0]?.visualClips?.[0]??parsed?.phrases?.[0]?.clips?.[0]
            const semantics=clip?.semantica
            realSemanticShape={clipKeys:Object.keys(clip??{}),semanticKeys:semantics&&typeof semantics==='object'?Object.keys(semantics):null,
              relation:semantics?.relacion??null,anchor:semantics?.ancla??null,terms:semantics?.terminos??null,
              legacyConcepts:clip?.conceptos??null}
          }catch(error){realSemanticShape={parseError:String(error)}}
          fs.writeFileSync(path.join(evidence,testCaseId?`real-semantic-${testCaseId}-shape.json`:
            freshNaturalSemantic?'real-semantic-fresh-natural-shape.json':
            naturalSemantic?'real-semantic-natural-shape.json':'real-semantic-shape.json'),
            JSON.stringify(realSemanticShape,null,2)+'\n')}
        return response}
      const prompt=JSON.parse(options.body).messages.at(-1).content
      if(prompt.startsWith('Comprende una escena editorial')){
        const meaning={sourceQuote:words,proposition:words,
          headline:networkScene?'Sensor conecta cámara y datos':words,secondary:'',
          framing:abstractScene?'negation':'assertion',concepts:terms.map(item=>item.etiqueta),
          intent:networkScene?'relation':abstractScene?'statement':'object',
          reason:'Controlled fixture; not real model semantics.'}
        return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',
          message:{content:JSON.stringify(meaning)}}]})}
      }
      if(prompt.includes('Candidatos por rol:')){
        const candidates=JSON.parse(prompt.split('Candidatos por rol: ')[1].split('\n')[0])
        const surfaces=JSON.parse(prompt.split('Superficies de composición opcionales (metadata, nunca prueba de inspección visual): ')[1].split('\n')[0])
        const chosenBackground=surfaces.find(item=>item.role==='background')
        const chosenAccent=surfaces.find(item=>item.role==='accent-mask')
        const hero=abstractScene?null:candidates.find(item=>item.role==='hero-core'&&
          item.primaryWordEs?.toLowerCase().includes(networkScene?'sensor':'cromatógrafo'))
        const supports=networkScene?['cámara','datos'].map(term=>candidates.find(item=>
          item.role==='support'&&item.primaryWordEs?.toLowerCase().includes(term))).filter(Boolean):[]
        const supportIds=supports.map(item=>item.assetId)
        const choice={mode:hero?'asset':'typographic',heroId:hero?.assetId??null,
          supportIds,reason:'Controlled choice from offered metadata; not real model semantics.',
          evidence:hero?[{assetId:hero.assetId,quote:words,reason:'Subject named in the interval.'},
            ...supports.map(item=>({assetId:item.assetId,quote:words,reason:'Participant named in the interval.'}))]:[],
          rejected:[],omission:hero?null:'deliberate-typography',additionalTerms:[],
          layerChoices:{'rear-collage':{assetId:null,reason:'This controlled scene does not need thematic paper.'},
            'accent-mask':{assetId:hero&&richScene?chosenAccent?.assetId??null:null,
              reason:hero&&richScene?'Role-safe accent backing from the offered shortlist.':'No extra accent needed.'},
            background:{assetId:hero?chosenBackground?.assetId??null:null,
              reason:hero?'Neutral editorial reading surface offered by metadata.':'Typography remains on the base paper.'}},
          direction:{revision:networkScene?'editorial-scene-direction-2026-09-v3':'editorial-scene-decision-2026-09-v2',
            intent:networkScene?'relation':hero?'object':'statement',
            family:networkScene?'redNodos':hero?'marcoPoster':'editorial',variant:'base',
            entry:hero?'hero-first':'word-first',background:'ivory-clean',relations:[],
            reason:'Contract fixture with no unsupported relation.'}}
        if(networkScene&&hero&&supports.length===2)choice.direction.relations=supports.map(item=>({
          fromId:hero.assetId,toId:item.assetId,relation:'conecta',quote:words,
          reason:'The spoken sentence explicitly connects the sensor with both named participants.'}))
        return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',
          message:{content:JSON.stringify(choice)}}]})}
      }
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
      `color=c=black:s=360x640:r=12:d=${duration}`,'-f','lavfi','-i',`sine=frequency=440:duration=${duration}`,
      '-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source])
    const tokens=words.split(/\s+/u)
    const segment={start:0,end:duration,text:words,words:tokens.map((word,index)=>({word,
      start:duration*index/tokens.length,end:duration*(index+1)/tokens.length}))}
    const video={id:'temp-original',name:'original.mp4',duration:`0:0${duration}`,durationSeconds:duration,
      type:'video',path:source,size:'1 MB',category:'originales'}
    const audio={id:'temp-audio',name:'Voz - Audio Original',startSeconds:0,durationSeconds:duration,
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
    dialog.showOpenDialog=async()=>{openDialogCalls++;return {canceled:false,
      filePaths:[path.join(projectRoot,'project-state.json')]}}
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
      if(error&&i>=5)throw Error('UI_GENERATION_VISIBLE_ERROR:'+error)
    }
    assert(state?.timelineVideoClips?.some(clip=>clip.category==='visual'),'UI_DID_NOT_PERSIST_VISUAL')
    const visuals=state.timelineVideoClips.filter(clip=>clip.category==='visual')
    assert(visuals.every(clip=>fs.existsSync(clip.path)),'UI_VISUAL_SIN_FICHERO')
    assert(visuals.every(clip=>clip.visualRegeneration?.revision===b.EDITORIAL_LOCAL_BANK_V4.revision),
      'UI_WRONG_REVISION')
    for(const clip of visuals){const spec=clip.visualRegeneration.graphicData.extra.sceneSpec
      if(spec.editorialBankV2)assert.equal(spec.editorialBankV2.finishIntegration,
        'editorial-finish-integration-2026-09-v2','UI_NEW_SCENE_FINISH_NOT_PERSISTED')}
    if(networkScene){const plan=visuals[0].visualRegeneration.graphicData.extra.sceneSpec.editorialBankV2
      assert.equal(plan?.family,'redNodos','NETWORK_FAMILY_NOT_SELECTED_IN_ORDINARY_ROUTE')
      assert.equal(plan.supports.length,2)
      assert.equal(plan.relations.length,2)
      assert.equal(plan.events.filter(item=>item.kind==='arrival').length,2)
      const ungrounded=structuredClone(visuals[0].visualRegeneration.graphicData.extra.sceneSpec)
      ungrounded.editorialBankV2.sceneDecision.planning.direction.relations.pop()
      assert.throws(()=>b.validateVisualSceneSpecV2(ungrounded),/EDITORIAL_NETWORK_NOT_GROUNDED/,
        'NETWORK_WITH_MISSING_PARTICIPANT_MUST_BE_REJECTED')}
    if(manualColor){const plan=visuals[0].visualRegeneration.graphicData.extra.sceneSpec.editorialBankV2
      assert.equal(plan.accent,'#238C87','MANUAL_COLOR_NOT_PERSISTED')
      assert.equal(plan.sceneDecision.colorMode,'manual','MANUAL_COLOR_MODE_NOT_PERSISTED')}
    if(richScene){const plan=visuals[0].visualRegeneration.graphicData.extra.sceneSpec.editorialBankV2
      assert(plan.supports.length>=2,'RICH_SCENE_SUPPORTS_MISSING')
      assert(plan.backgroundAsset&&plan.layers.some(item=>item.id==='idea-accent'),
        'RICH_SCENE_COMPATIBLE_BACKGROUND_OR_ACCENT_MISSING')
      assert(!plan.layers.some(item=>item.id==='idea-rear'),
        'RICH_SCENE_INCOMPATIBLE_REAR_WAS_NOT_OMITTED')}
    if(abstractScene){const spec=visuals[0].visualRegeneration.graphicData.extra.sceneSpec
      assert(spec.editorialTextV4&&spec.visualMode==='editorial-text'&&!spec.editorialBankV2,
        'ABSTRACT_SCENE_MUST_BE_EXPLICIT_V4_TYPE_LED')}
    const prefix=`${realSemantic?'ui-real-semantic':'ui-controlled-semantic'}-${vertical?'vertical':'horizontal'}${testCaseId?'-'+testCaseId:''}${naturalSemantic?'-natural':''}${naturalSemanticHero?'-natural-hero':''}${freshNaturalSemantic?'-fresh-natural':''}${richScene?'-rich':''}${networkScene?'-network':''}${abstractScene?'-abstract':''}${manualColor?'-manual-teal':''}${gate2Evidence?'-gate2':''}${regenerateWithoutCatalog?'-no-catalog-replay':''}`
    const copied=path.join(evidence,`${prefix}-visual.mp4`)
    fs.copyFileSync(visuals[0].path,copied)
    fs.writeFileSync(path.join(evidence,`${prefix}-scene-spec.json`),
      JSON.stringify(visuals[0].visualRegeneration.graphicData.extra.sceneSpec,null,2)+'\n')
    const diagnosticDir=path.join(projectRoot,'materiales','diagnostics','visual-decisions')
    const diagnosticFiles=fs.existsSync(diagnosticDir)?fs.readdirSync(diagnosticDir).filter(name=>name.endsWith('.json')):[]
    const diagnostic=diagnosticFiles.length?JSON.parse(fs.readFileSync(path.join(diagnosticDir,
      diagnosticFiles.sort().at(-1)),'utf8')):null
    if(diagnostic)fs.writeFileSync(path.join(evidence,`${prefix}-diagnostic.json`),
      JSON.stringify(diagnostic,null,2)+'\n')
    const semanticRejection=realSemanticShape?.semanticKeys?
      b.diagnosticarSemanticaVisual({relacion:realSemanticShape.relation,
        ancla:realSemanticShape.anchor,terminos:realSemanticShape.terms}):null
    let uiExport=null,uiReplay=null
    if(exportFromUi){
      console.log('UI_EXPORT_CHECK','save')
      await js(`(()=>{window.alert=(message)=>{window.__cipherTestAlert=String(message)};return true})()`)
      await js(`(()=>{const b=[...document.querySelectorAll('button')].find(item=>
        item.textContent.includes('Archivo'));if(!b)return false;b.click();return true})()`)
      await until(()=>js(`!![...document.querySelectorAll('button')].find(item=>
        item.textContent.trim()==='Guardar'&&!item.disabled)`),'ui-save-menu')
      assert(await js(`(()=>{const b=[...document.querySelectorAll('button')].find(item=>
        item.textContent.trim()==='Guardar'&&!item.disabled);if(!b)return false;b.click();return true})()`),
      'UI_SAVE_BUTTON_UNAVAILABLE')
      await until(()=>JSON.parse(fs.readFileSync(path.join(projectRoot,'project-state.json'),'utf8'))
        .timelineVideoClips?.some(clip=>clip.category==='visual'),'ui-save-visual')
      console.log('UI_EXPORT_CHECK','reopen')
      await js(`(()=>{const b=[...document.querySelectorAll('button')].find(item=>
        item.textContent.includes('Archivo'));if(!b)return false;b.click();return true})()`)
      await until(()=>js(`!![...document.querySelectorAll('button')].find(item=>
        item.textContent.trim()==='Abrir proyecto')`),'ui-reopen-menu')
      assert(await js(`(()=>{const b=[...document.querySelectorAll('button')].find(item=>
        item.textContent.trim()==='Abrir proyecto');if(!b)return false;b.click();return true})()`),
      'UI_REOPEN_BUTTON_UNAVAILABLE')
      await until(()=>openDialogCalls>=2,'ui-reopen-dialog')
      await pause(500)
      await until(()=>js(`!!document.querySelector('#visual-presentation-profile') &&
        document.querySelector('#visual-presentation-profile').value==='editorial-local-bank-v4'`),'ui-reopen-profile')
      const reopened=JSON.parse(fs.readFileSync(path.join(projectRoot,'project-state.json'),'utf8'))
      assert(reopened.timelineVideoClips.some(clip=>clip.category==='visual'),'UI_REOPEN_LOST_VISUAL')
      if(regenerateFromUi){
        const before=reopened.timelineVideoClips.find(clip=>clip.category==='visual')
        const beforeSpec=before.visualRegeneration.graphicData.extra.sceneSpec
        const beforeSpecSha=crypto.createHash('sha256').update(JSON.stringify(beforeSpec)).digest('hex')
        const beforeVideoSha=crypto.createHash('sha256').update(fs.readFileSync(before.path)).digest('hex')
        if(regenerateWithoutCatalog){
          const absentRoot=path.join(fixture,'catalog-absent-after-materialization')
          assert(!fs.existsSync(absentRoot),'REPLAY_CATALOG_ROOT_NOT_ABSENT')
          const changed=await js(`(()=>{const input=[...document.querySelectorAll('input')]
            .find(item=>item.closest('label')?.textContent.includes('Biblioteca editorial local'));
            if(!input)return null;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')
            .set.call(input,${JSON.stringify(absentRoot)});input.dispatchEvent(new Event('input',{bubbles:true}));
            input.dispatchEvent(new Event('change',{bubbles:true}));return input.value})()`)
          assert.equal(changed,absentRoot,'UI_CATALOG_ROOT_NOT_SWITCHED_TO_ABSENT')
        }
        assert(await js(`(()=>{const button=[...document.querySelectorAll('button')].find(item=>
          item.textContent.trim()==='Regenerar Visuales V4 guardados');
          if(!button||button.disabled)return false;button.click();return true})()`),
        'UI_VISUAL_REGENERATION_BUTTON_UNAVAILABLE')
        await until(()=>js(`[...document.querySelectorAll('[role="status"]')].some(item=>
          item.textContent.includes('1/1 Visuales V4 regenerados.'))`),'ui-visual-regeneration',240)
        await pause(400)
        await js(`(()=>{const b=[...document.querySelectorAll('button')].find(item=>
          item.textContent.includes('Archivo'));if(!b)return false;b.click();return true})()`)
        await until(()=>js(`!![...document.querySelectorAll('button')].find(item=>
          item.textContent.trim()==='Guardar'&&!item.disabled)`),'ui-regen-save-menu')
        await js(`[...document.querySelectorAll('button')].find(item=>
          item.textContent.trim()==='Guardar'&&!item.disabled).click()`)
        await pause(400)
        const after=JSON.parse(fs.readFileSync(path.join(projectRoot,'project-state.json'),'utf8'))
          .timelineVideoClips.find(clip=>clip.category==='visual')
        assert.deepEqual(after.visualRegeneration.graphicData.extra.sceneSpec,beforeSpec,
          'UI_REGENERATION_CHANGED_FROZEN_SCENESPEC')
        assert(fs.existsSync(after.path),'UI_REGENERATION_VISUAL_SIN_FICHERO')
        assert.equal(crypto.createHash('sha256').update(fs.readFileSync(after.path)).digest('hex'),
          beforeVideoSha,'UI_REGENERATION_CHANGED_MP4_BYTES')
        uiReplay={buttonClicked:true,catalogAbsent:regenerateWithoutCatalog,
          sceneSpecSha256Before:beforeSpecSha,
          sceneSpecSha256After:crypto.createHash('sha256').update(JSON.stringify(
            after.visualRegeneration.graphicData.extra.sceneSpec)).digest('hex'),
          mp4Sha256Before:beforeVideoSha,
          mp4Sha256After:crypto.createHash('sha256').update(fs.readFileSync(after.path)).digest('hex')}
      }
      const exportPath=path.join(evidence,`${prefix}-timeline-export.mp4`)
      dialog.showSaveDialog=async()=>({canceled:false,filePath:exportPath})
      console.log('UI_EXPORT_CHECK','export')
      assert(await js(`(()=>{const b=[...document.querySelectorAll('button')].find(item=>
        item.textContent.trim()==='Exportar');if(!b)return false;b.click();return true})()`),
      'UI_EXPORT_BUTTON_UNAVAILABLE')
      await until(()=>js(`!![...document.querySelectorAll('button')].find(item=>
        item.textContent.trim()==='Exportar Video')`),'ui-export-modal')
      await js(`[...document.querySelectorAll('button')].find(item=>
        item.textContent.trim()==='Exportar Video').click()`)
      await until(()=>fs.existsSync(exportPath)&&fs.statSync(exportPath).size>1000,'ui-export-mp4',240)
      const probe=JSON.parse(execFileSync(path.join(path.dirname(ffmpeg),'ffprobe.exe'),
        ['-v','error','-show_streams','-of','json',exportPath],{encoding:'utf8'}))
      assert(probe.streams.some(stream=>stream.codec_type==='video'),'UI_EXPORT_MISSING_VIDEO')
      uiExport={path:exportPath,bytes:fs.statSync(exportPath).size,
        audio:probe.streams.some(stream=>stream.codec_type==='audio')}
    }
    const png=(await win.webContents.capturePage()).toPNG()
    fs.writeFileSync(path.join(evidence,`${prefix}.png`),png)
    const result={passed:true,semanticMode:realSemantic?'DEEPSEEK_REAL':'OFFLINE_MOCK',semanticCalls,otherNetwork,
      realSemanticShape,semanticRejection,catalogDecision:diagnostic?.scenes?.[0]?.catalogDecision??null,
      projectTemporary:true,profileSelectedInUI:true,buildClickedInUI:true,orientation:vertical?'9:16':'16:9',
      manualColor:manualColor?'#238C87':null,richScene,abstractScene,regenerateFromUi,
      uiExport,uiReplay,
      visualsRequested:1,visualsMaterialized:visuals.length,timelineVisuals:visuals.length,
      visualSinFichero:0,visualCopy:copied,screenshot:path.join(evidence,`${prefix}.png`)}
    fs.writeFileSync(path.join(evidence,`${prefix}-result.json`),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result));code=0
  }catch(error){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'failure.txt'),
    String(error?.stack||error));console.error(error?.stack||error)}
  finally{dialog.showOpenDialog=oldDialog;dialog.showSaveDialog=oldSaveDialog;global.fetch=oldFetch
    if(oldKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=oldKey
    if(win&&!win.isDestroyed())win.destroy()
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
