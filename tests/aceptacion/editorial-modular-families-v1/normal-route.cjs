const {app,BrowserWindow,dialog,ipcMain,session}=require('electron')
const assert=require('node:assert/strict')
const {execFileSync}=require('node:child_process')
const fs=require('node:fs'),path=require('node:path')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')

const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||
  path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const evidence=path.resolve(root,'../_cipher-editorial-integration-v1/evidence/normal-route')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
const fixture=createTestFixture('editorial-family-normal-route')
const projectRoot=path.join(fixture,'project')
const priorKey=process.env.DEEPSEEK_API_KEY
const priorFetch=global.fetch
let networkAttempts=0,semanticCalls=0
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)

const segments=[
  {start:0,end:2.5,text:'Una idea conecta personas y datos.'},
  {start:2.5,end:5,text:'Las piezas avanzan con herramientas y construcción.'},
  {start:5,end:7.5,text:'Una señal conecta la red y la cámara.'},
]
const terms=[['idea','personas','datos'],['piezas','herramientas','construcción'],
  ['señal','red','cámara']]
const icons=[['star','users-group-rounded','flag'],['star','flag','users-group-rounded'],
  ['star','users-group-rounded','flag']]
const emoji=[['💡','👥','📊'],['🧩','🔧','🏗️'],['📡','🔗','📷']]
const concept=(scene,index)=>({icono:icons[scene][index],ic:emoji[scene][index],
  etiqueta:terms[scene][index]})
const response=()=>({phrases:segments.map((segment,index)=>({
  phraseIndex:index+1,visualClips:[{keyword:terms[index][0],timestamp:segment.start+.05,
    duration:2.4,prompt:segment.text,
    conceptos:terms[index].map((_,term)=>concept(index,term)),
    semantica:{relacion:index===1?'secuencia':'conecta',
      ancla:concept(index,0),terminos:terms[index].map((_,term)=>concept(index,term))}}],
}))})
const invoke=(channel,payload)=>{
  const handler=ipcMain._invokeHandlers.get(channel)
  assert(handler,'IPC_MISSING:'+channel)
  return handler({sender:{isDestroyed:()=>false,send:()=>{}}},payload)
}

app.whenReady().then(async()=>{
  let window,exitCode=1
  try{
    fs.mkdirSync(evidence,{recursive:true})
    process.env.DEEPSEEK_API_KEY='offline-editorial-fixture'
    global.fetch=async url=>{
      if(String(url).startsWith('https://api.deepseek.com/chat/completions')){
        semanticCalls++
        return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',
          message:{content:JSON.stringify(response())}}]})}
      }
      networkAttempts++
      throw new Error('NORMAL_ROUTE_NETWORK_FORBIDDEN:'+String(url))
    }
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url))networkAttempts++
      callback({cancel:/^https?:/i.test(details.url)})
    })
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'editorial-normal-route',name:'Editorial normal route',
      clips:[],timelineVideoClips:[],aiScript:segments.map(s=>s.text).join(' ')})
    const loaded=await invoke('load-project',{projectPath:projectRoot})
    assert(loaded.success,'PROJECT_OPEN:'+loaded.error)
    const source=path.join(fixture,'black.mp4')
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
      'color=c=black:s=360x640:r=12:d=8','-c:v','libx264','-pix_fmt','yuv420p',source])
    const generated=await invoke('generate-timeline-assets',{
      scriptText:segments.map(s=>s.text).join(' '),audioDuration:7.5,
      transcriptSegments:segments,newAudioSegments:segments,videoPath:source,
      weights:[0,0,0,100],iaStyle:'editorial',aspectRatio:'vertical',graphicsPercent:100,
      visualPresentationProfile:'editorial-modular-families-v1',modularCatalogRoot:catalogRoot,
      editorialFamilyChoice:'auto',editorialFamilyColor:'#A83B19',editorialFamilyEffects:'none',
    })
    assert(generated.success,'NORMAL_GENERATION:'+generated.error)
    const visuals=generated.clips.filter(clip=>clip.category==='visual')
    assert(visuals.length>=3,'NORMAL_VISUALS_TOO_FEW:'+visuals.length)
    assert(visuals.every(clip=>fs.existsSync(clip.path)&&fs.statSync(clip.path).size>0),
      'NORMAL_VISUAL_SIN_FICHERO')
    const plans=visuals.map(clip=>clip.visualRegeneration?.graphicData?.extra?.sceneSpec?.editorialFamily)
    const displayed=visuals.map(clip=>clip.visualRegeneration?.graphicData?.extra?.sceneSpec?.text)
    const tokens=value=>(String(value).toLocaleLowerCase('es').match(/[\p{L}\p{N}]+/gu)??[])
    for(let index=0;index<segments.length;index++){
      const actual=tokens([displayed[index]?.connector,displayed[index]?.keyword,
        displayed[index]?.closing].join(' '))
      const expected=tokens(segments[index].text)
      assert.deepEqual(actual,expected,'SEGMENT_TEXT_NOT_LITERAL:'+index+
        ' actual='+JSON.stringify(displayed[index])+' expected='+segments[index].text)
    }
    assert(plans.every(plan=>plan?.revision==='editorial-modular-families-2026-09-v1'),
      'NORMAL_PROFILE_NOT_BOUND')
    assert(plans.some(plan=>plan.hero?.assetId==='editorial-hero-h001-v1'),
      'NORMAL_IDEA_HERO_NOT_SELECTED')
    assert(plans.some(plan=>plan.hero?.assetId==='editorial-hero-h101-v1'),
      'NORMAL_PIECES_HERO_NOT_SELECTED')
    window=new BrowserWindow({show:false,width:800,height:600,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist','catalog-matrix.html'))
    const js=code=>window.webContents.executeJavaScript(code)
    const state={...loaded.data,visualPresentationProfile:'editorial-modular-families-v1',
      modularCatalogRoot:catalogRoot,editorialFamilyChoice:'auto',editorialFamilyColor:'#A83B19',
      editorialFamilyEffects:'none',timelineVideoClips:generated.clips}
    const saved=await js(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'NORMAL_SAVE:'+saved.error)
    const reopened=await js(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data?.timelineVideoClips?.filter(c=>c.category==='visual').length===visuals.length,
      'NORMAL_REOPEN_FAILED')
    const replay=await js(`window.electronAPI.regenerateGraphics(${JSON.stringify({
      mode:'modern-visual',aspectRatio:'vertical',resolution:'720p',
      modernVisuals:[{clipId:visuals[0].id,context:visuals[0].visualRegeneration}],
    })})`)
    assert(replay.success&&replay.clips?.[0]?.success&&fs.existsSync(replay.clips[0].path),
      'NORMAL_REPLAY_FAILED:'+replay.error)
    const firstPlan=plans[0]
    assert(firstPlan.supports.length>=2,'MANUAL_SWAP_REQUIRES_TWO_SUPPORTS')
    const edit={family:firstPlan.family,heroId:firstPlan.hero.assetId,
      supportIds:firstPlan.supports.map(s=>s.assetId).reverse(),
      rearId:undefined,accentId:undefined,frontId:undefined}
    const edited=await js(`window.electronAPI.rebindEditorialFamilyClipV1(${JSON.stringify({
      catalogRoot,graphicData:visuals[0].visualRegeneration.graphicData,
      renderBindings:visuals[0].visualRegeneration.renderBindings,
      orientation:'portrait',durationSeconds:visuals[0].durationSeconds,edits:edit,
    })})`)
    assert(edited.success&&fs.existsSync(edited.path),'MANUAL_ASSET_REBIND_FAILED:'+edited.error)
    assert.notEqual(edited.pixelIdentity,
      b.sceneSpecPixelIdentityAny(visuals[0].visualRegeneration.graphicData.extra.sceneSpec),
      'MANUAL_SWAP_NOT_IN_PIXEL_IDENTITY')
    const editedPlan=edited.graphicData.extra.sceneSpec.editorialFamily
    const changedSlots=new Set(firstPlan.supports.filter((support,index)=>
      support.assetId!==edit.supportIds[index]).map(support=>support.slotId))
    assert(editedPlan.relations.every(relation=>
      !changedSlots.has(relation.from)&&!changedSlots.has(relation.to)),
    'MANUAL_SWAP_RETAINED_FALSE_SEMANTIC_RELATION')
    const forged=await js(`window.electronAPI.rebindEditorialFamilyClipV1(${JSON.stringify({
      catalogRoot,graphicData:visuals[0].visualRegeneration.graphicData,
      renderBindings:visuals[0].visualRegeneration.renderBindings,
      orientation:'portrait',durationSeconds:visuals[0].durationSeconds,
      edits:{...edit,heroId:'unauthorized-hero'},
    })})`)
    assert.equal(forged.success,false,'FORGED_MANUAL_ASSET_ACCEPTED')
    const editedClips=generated.clips.map(clip=>clip.id===visuals[0].id?{
      ...clip,path:edited.path,url:edited.url,graphicData:edited.graphicData,
      visualRegeneration:{...clip.visualRegeneration,graphicData:edited.graphicData,
        renderBindings:edited.renderBindings}}:clip)
    const savedEdit=await js(`window.electronAPI.saveProjectState(${JSON.stringify({
      ...state,timelineVideoClips:editedClips,
    })})`)
    assert(savedEdit.success,'MANUAL_EDIT_SAVE_FAILED:'+savedEdit.error)
    const reopenedEdit=await js(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    const reopenedPlan=reopenedEdit.data?.timelineVideoClips?.[0]?.visualRegeneration
      ?.graphicData?.extra?.sceneSpec?.editorialFamily
    assert.equal(reopenedPlan?.supports?.[0]?.assetId,edit.supportIds[0],
      'MANUAL_EDIT_REOPEN_FAILED')
    const destination=path.join(evidence,'normal-route-vertical.mp4')
    dialog.showSaveDialog=async()=>({canceled:false,filePath:destination})
    const exported=await js(`window.electronAPI.exportVideo(${JSON.stringify({
      clips:editedClips,aspectRatio:'vertical',resolution:'720p',format:'mp4',quality:'medium',
      assignedTransitions:{},transitionDuration:.5,ajustesVideo:{},
    })})`)
    assert(exported.success&&fs.statSync(destination).size>0,'NORMAL_EXPORT_FAILED:'+exported.error)
    const result={passed:true,semanticCalls,networkAttempts,visuals:visuals.length,
      families:plans.map(plan=>plan.family),heroIds:plans.map(plan=>plan.hero?.assetId??null),
      displayedText:displayed,
      visualSinFichero:0,saved:true,reopened:true,replayed:true,manualAssetSwap:true,
      forgedAssetRejected:true,exported:destination,
      semanticMode:'OFFLINE_MOCK; product handler, real catalog, real render and export'}
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify(result));exitCode=0
  }catch(error){fs.mkdirSync(evidence,{recursive:true})
    fs.writeFileSync(path.join(evidence,'failure.txt'),String(error?.stack||error))
    console.error(error?.stack||error)}
  finally{
    if(window&&!window.isDestroyed())window.destroy()
    global.fetch=priorFetch
    if(priorKey===undefined)delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY=priorKey
    try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}
    app.exit(exitCode)
  }
}).catch(error=>{console.error(error);app.exit(1)})
