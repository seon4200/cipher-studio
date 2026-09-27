const {app,BrowserWindow,dialog,ipcMain,session}=require('electron')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const evidence=process.env.CIPHER_DECISION_EVIDENCE||path.resolve(root,'../_cipher-scene-corrections-20260927/normal-route')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
const fixture=createTestFixture('editorial-local-v4-normal-route'),projectRoot=path.join(fixture,'project')
const previousKey=process.env.DEEPSEEK_API_KEY,previousFetch=global.fetch
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
let words='El cromatógrafo líquido analiza una muestra.'
let segments=[{start:0,end:3,text:words}]
let terms=[{icono:'star',ic:'🧪',etiqueta:'cromatógrafo líquido'},
  {icono:'flag',ic:'🧫',etiqueta:'muestra'},
  {icono:'users-group-rounded',ic:'📊',etiqueta:'datos'}]
let reply={phrases:[{phraseIndex:1,visualClips:[{keyword:'cromatógrafo',timestamp:.05,duration:2.9,
  prompt:words,conceptos:terms,
  semantica:{relacion:'conecta',ancla:terms[0],terminos:terms}}]}]}
const invoke=(channel,payload)=>{
  const handler=ipcMain._invokeHandlers.get(channel)
  assert(handler,'IPC_MISSING:'+channel)
  return handler({sender:{isDestroyed:()=>false,send:()=>{}}},payload)
}
app.whenReady().then(async()=>{
  let window,code=1,semanticCalls=0,otherNetwork=0
  try{
    fs.mkdirSync(evidence,{recursive:true})
    process.env.DEEPSEEK_API_KEY='offline-controlled-semantic-fixture'
    global.fetch=async (url,options)=>{
      if(String(url).startsWith('https://api.deepseek.com/chat/completions')){
        semanticCalls++
        const prompt=JSON.parse(options.body).messages.at(-1).content
        if(prompt.startsWith('Comprende una escena editorial')){
          const meaning={sourceQuote:words,proposition:words,headline:words,secondary:'',
            framing:words.includes('ninguna')?'negation':'assertion',concepts:terms.map(t=>t.etiqueta),
            intent:'object',reason:'Controlled contract fixture, not real semantics.'}
          return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(meaning)}}]})}
        }
        if(prompt.includes('Candidatos por rol:')){
          const candidates=JSON.parse(prompt.split('Candidatos por rol: ')[1].split('\n')[0])
          const surfaces=JSON.parse(prompt.split('Superficies de composición opcionales (metadata, nunca prueba de inspección visual): ')[1].split('\n')[0])
          const hero=candidates.find(c=>c.role==='hero-core'&&c.primaryWordEs.toLowerCase().includes('cromatógrafo'))
          const background=surfaces.find(c=>c.role==='background')
          const accent=surfaces.find(c=>c.role==='accent-mask')
          const rear=surfaces.find(c=>c.role==='rear-collage'&&c.retrievalEvidence.includes('metadata-overlap')&&
            /qu[ií]mic|cromat|laborat/i.test([c.primaryWordEs,c.description].join(' ')))
          const selected={mode:hero?'asset':'typographic',heroId:hero?.assetId??null,supportIds:[],
            proposition:words,visibleText:words,emphasis:'',reason:'Controlled fixture based on offered metadata, not real semantics.',
            evidence:hero?[{assetId:hero.assetId,quote:words,reason:'Fixture selects the exact instrument present in the text.'}]:[],
            omission:hero?null:'no-suitable-material',rejected:[],additionalTerms:[],
            layerChoices:{'rear-collage':{assetId:hero?rear?.assetId??null:null,
              reason:hero&&rear?'El metadato de relación conecta el papel de análisis con el concepto.':'No hay papel temático compatible ofrecido.'},
              'accent-mask':{assetId:hero?accent?.assetId??null:null,reason:hero?'Backing de rol seguro ofrecido.':'Sin Hero que acompañar.'},
              background:{assetId:hero?background?.assetId??null:null,reason:hero?'Superficie neutral editorial.':'La tipografía conserva el fondo base.'}},
            direction:{revision:'editorial-scene-decision-2026-09-v2',intent:hero?'object':'statement',
              family:'editorial',variant:'base',entry:'word-first',background:'ivory-clean',relations:[],reason:'Contract fixture'}}
          return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(selected)}}]})}
        }
        return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]})}
      }
      otherNetwork++
      throw Error('UNEXPECTED_NETWORK:'+String(url))
    }
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url))otherNetwork++
      callback({cancel:/^https?:/i.test(details.url)})
    })
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'v4-normal-route',name:'V4 temporary',clips:[],
      timelineVideoClips:[],aiScript:words})
    const loaded=await invoke('load-project',{projectPath:projectRoot})
    assert(loaded.success,'PROJECT_OPEN:'+loaded.error)
    const source=path.join(fixture,'black.mp4')
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
      'color=c=black:s=360x640:r=12:d=3','-c:v','libx264','-pix_fmt','yuv420p',source])
    const generated=await invoke('generate-timeline-assets',{scriptText:words,audioDuration:3,
      transcriptSegments:segments,newAudioSegments:segments,videoPath:source,
      weights:[0,0,0,100],iaStyle:'editorial',aspectRatio:'vertical',graphicsPercent:0,
      visualPresentationProfile:'editorial-local-bank-v4',modularCatalogRoot:catalogRoot,
      editorialFamilyColor:'auto'})
    assert(generated.success,'NORMAL_GENERATION:'+generated.error)
    const diagnosticFolder=path.join(projectRoot,'materiales','diagnostics','visual-decisions')
    const diagnosticFiles=fs.readdirSync(diagnosticFolder).filter(name=>name.endsWith('.json'))
    assert(diagnosticFiles.length,'NO_PERSISTED_VISUAL_DIAGNOSTIC')
    const diagnostic=JSON.parse(fs.readFileSync(path.join(diagnosticFolder,diagnosticFiles.at(-1)),'utf8'))
    assert.equal(diagnostic.scenes[0].catalogDecision?.trace?.outcome,'SELECTED','CATALOG_TRACE_NOT_PERSISTED')
    assert.equal(diagnostic.scenes[0].catalogDecision?.effectiveRevision,
      b.EDITORIAL_LOCAL_BANK_V4.revision,'EFFECTIVE_REVISION_NOT_RECORDED')
    const visuals=generated.clips.filter(clip=>clip.category==='visual')
    assert(visuals.length>=1,'NO_VISUAL_CLIP')
    assert(visuals.every(clip=>fs.existsSync(clip.path)&&fs.statSync(clip.path).size>0),'VISUAL_SIN_FICHERO')
    const plan=visuals[0].visualRegeneration?.graphicData?.extra?.sceneSpec?.editorialBankV2
    assert(plan?.revision===b.EDITORIAL_LOCAL_BANK_V4.revision,'V4_PLAN_NOT_PERSISTED')
    assert.equal(plan.finishIntegration,'editorial-finish-integration-2026-09-v2',
      'ORDINARY_HANDLER_DID_NOT_PERSIST_INTEGRATED_FINISH')
    assert(plan.hero.assetId,'SEMANTIC_HERO_MUST_SURVIVE')
    assert.equal(plan.sceneDecision.planning.layerChoices.source,'model')
    assert.equal(plan.sceneDecision.planning.layerChoices.choices.background.assetId,plan.backgroundAsset?.assetId??null)
    assert.equal(plan.sceneDecision.planning.layerChoices.choices['rear-collage'].assetId,
      plan.layers.find(layer=>layer.id==='idea-rear')?.catalogAssetId??null)
    const catalog=new b.CuratedModularCatalogV2(catalogRoot)
    const active=JSON.parse(fs.readFileSync(path.join(catalogRoot,'extension-v2','active.json'),'utf8'))
    const extensionIds=new Set(active.batches.flatMap(batch=>JSON.parse(fs.readFileSync(path.join(catalogRoot,
      'extension-v2','batches',batch.id,'manifest.json'),'utf8')).entries.map(entry=>entry.assetId)))
    assert(extensionIds.has(plan.hero.assetId),'SEMANTIC_SELECTION_MUST_REACH_ACTIVE_EXTENSION')
    assert.equal(catalog.getById(plan.hero.assetId)?.sha256,plan.hero.sha256)
    // Exercise the ordinary generation handler again with a type-led V4 scene.
    // Its display keyword starts the literal, so an empty connector must be
    // omitted before the legacy family binder validates the scene.
    words='Incertidumbre: ninguna respuesta elimina todas las dudas.'
    segments=[{start:0,end:3,text:words}]
    terms=[{icono:'question',ic:'❔',etiqueta:'incertidumbre'}]
    reply={phrases:[{phraseIndex:1,visualClips:[{keyword:'incertidumbre',timestamp:.05,duration:2.9,
      prompt:words,conceptos:terms}]}]}
    const fallbackProject=path.join(fixture,'type-led-project')
    b.createProjectFiles(fallbackProject,{id:'v4-type-led-handler',name:'V4 type-led handler',clips:[],
      timelineVideoClips:[],aiScript:words})
    const fallbackLoaded=await invoke('load-project',{projectPath:fallbackProject})
    assert(fallbackLoaded.success,'TYPE_LED_PROJECT_OPEN:'+fallbackLoaded.error)
    const fallbackSource=path.join(fixture,'fallback-black.mp4')
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
      'color=c=black:s=360x640:r=12:d=3','-c:v','libx264','-pix_fmt','yuv420p',fallbackSource])
    const fallbackResult=await invoke('generate-timeline-assets',{scriptText:words,audioDuration:3,
      transcriptSegments:segments,newAudioSegments:segments,videoPath:fallbackSource,
      weights:[0,0,0,100],iaStyle:'editorial',aspectRatio:'vertical',graphicsPercent:0,
      visualPresentationProfile:'editorial-local-bank-v4',modularCatalogRoot:catalogRoot,
      editorialFamilyColor:'auto'})
    assert(fallbackResult.success,'TYPE_LED_NORMAL_HANDLER:'+fallbackResult.error)
    const fallbackVisuals=fallbackResult.clips.filter(clip=>clip.category==='visual')
    assert(fallbackVisuals.length>0,'TYPE_LED_NORMAL_HANDLER_NO_VISUAL')
    assert(fallbackVisuals.every(clip=>fs.existsSync(clip.path)&&fs.statSync(clip.path).size>0),
      'TYPE_LED_NORMAL_HANDLER_VISUAL_SIN_FICHERO')
    const fallbackSpec=fallbackVisuals[0].visualRegeneration?.graphicData?.extra?.sceneSpec
    assert(fallbackSpec?.editorialTextV4,'TYPE_LED_PROFILE_NOT_PERSISTED')
    assert.equal(fallbackSpec.editorialTextV4.revision,b.EDITORIAL_LOCAL_BANK_V4.revision)
    assert.equal(fallbackSpec.text?.connector,undefined,'EMPTY_CONNECTOR_MUST_NOT_REACH_SCENESPEC')
    assert(fallbackSpec.text?.keyword,'TYPE_LED_KEYWORD_MISSING')
    const primaryReloaded=await invoke('load-project',{projectPath:projectRoot})
    assert(primaryReloaded.success,'PRIMARY_PROJECT_RELOAD:'+primaryReloaded.error)
    window=new BrowserWindow({show:false,width:800,height:600,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist/catalog-matrix.html'))
    const js=code=>window.webContents.executeJavaScript(code)
    const state={...primaryReloaded.data,visualPresentationProfile:'editorial-local-bank-v4',
      modularCatalogRoot:catalogRoot,editorialLocalAccent:'auto',timelineVideoClips:generated.clips}
    const saved=await js(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'SAVE:'+saved.error)
    const reopened=await js(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data?.timelineVideoClips?.some(clip=>clip.category==='visual'),'REOPEN')
    const replay=await js(`window.electronAPI.regenerateGraphics(${JSON.stringify({mode:'modern-visual',
      aspectRatio:'vertical',resolution:'720p',modernVisuals:[{clipId:visuals[0].id,
        context:visuals[0].visualRegeneration}]})})`)
    assert(replay.success&&replay.clips?.[0]?.success&&fs.existsSync(replay.clips[0].path),
      'REPLAY_FAILED:'+replay.error)
    const destination=path.join(evidence,'v4-controlled-handler-vertical.mp4')
    dialog.showSaveDialog=async()=>({canceled:false,filePath:destination})
    const exported=await js(`window.electronAPI.exportVideo(${JSON.stringify({clips:generated.clips,
      aspectRatio:'vertical',resolution:'720p',format:'mp4',quality:'medium',assignedTransitions:{},
      transitionDuration:.5,ajustesVideo:{}})})`)
    assert(exported.success&&fs.statSync(destination).size>0,'EXPORT_FAILED:'+exported.error)
    const result={passed:true,semanticMode:'OFFLINE_MOCK',semanticCalls,otherNetwork,
      visualsRequested:1,visualsAttempted:1,visualsMaterialized:visuals.length,
      timelineVisuals:visuals.length,visualSinFichero:0,heroId:plan.hero.assetId,
      heroSha256:plan.hero.sha256,supports:plan.supports.length,
      typeLedHandler:{passed:true,visualsMaterialized:fallbackVisuals.length,
        emptyConnectorOmitted:fallbackSpec.text?.connector===undefined},
      saved:true,reopened:true,replayed:true,exported:destination,productUIInteracted:false}
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result));code=0
  }catch(error){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'failure.txt'),
    String(error?.stack||error));console.error(error?.stack||error)}
  finally{if(window&&!window.isDestroyed())window.destroy();global.fetch=previousFetch
    if(previousKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previousKey
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
