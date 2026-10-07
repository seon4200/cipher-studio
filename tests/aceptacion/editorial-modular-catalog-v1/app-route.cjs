const {app,BrowserWindow,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const assetRoot=path.resolve(root,'../_cipher-idea-assembly-v3/runtime')
const outputRoot=path.join(catalogRoot,'evidence','app-route')
const fixture=createTestFixture('editorial-modular-app-route'),projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1,window
  try{
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'modular-app-fixture',name:'Modular App Fixture',
      clips:[],timelineVideoClips:[],aiScript:''})
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    window=new BrowserWindow({show:false,width:850,height:650,webPreferences:{
      preload:path.join(root,'dist-electron/preload/index.js'),contextIsolation:true,sandbox:true}})
    await window.loadFile(path.join(root,'dist','catalog-matrix.html'))
    const invoke=js=>window.webContents.executeJavaScript(js)
    assert.equal(await invoke('typeof window.electronAPI.generateEditorialModularCatalogV1'),'function')
    const opened=await invoke(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(opened.success,'TEMP_PROJECT_LOAD_FAILED:'+opened.error)
    const listed=await invoke(`window.electronAPI.listEditorialModularCatalogV1(${JSON.stringify(catalogRoot)})`)
    assert(listed.success&&listed.assets.length===250,'APP_CATALOG_SELECTOR_UNAVAILABLE')
    const request={catalogRoot,assetRoot,heroId:'editorial-hero-h001-v1',
      supportIds:['idea-support-personas-v1','idea-support-datos-v1',
        'idea-support-soluciones-v1','idea-support-impacto-v1'],
      rearId:'editorial-layer-l001-v1',accentId:'editorial-layer-l036-v1',
      recipe:'vertical',orientation:'portrait',
      color:{supportSource:'ink',heroMode:'recolorable',heroPrimary:'#A83B19'},
      headline:{connector:'UNA',keyword:'IDEA',closing:'abre nuevas posibilidades'}}
    const generated=await invoke(`window.electronAPI.generateEditorialModularCatalogV1(${JSON.stringify(request)})`)
    assert(generated.success&&generated.path&&fs.existsSync(generated.path),
      'APP_VISUAL_SIN_FICHERO:'+generated.error)
    const clip={id:'modular-app-clip',name:'IDEA modular',type:'video',category:'visual',
      startSeconds:0,durationSeconds:generated.durationSeconds,path:generated.path,url:generated.url,
      graphicData:generated.graphicData,visualRegeneration:{revision:'editorial-modular-catalog-2026-09-v1',
        graphicData:generated.graphicData,renderBindings:generated.renderBindings,orientation:'portrait'}}
    const state={...opened.data,id:'modular-app-fixture',name:'Modular App Fixture',
      visualPresentationProfile:'editorial-modular-catalog-v1',modularCatalogRoot:catalogRoot,
      modularHeroId:request.heroId,modularSupportIds:request.supportIds,
      modularRearId:request.rearId,modularAccentId:request.accentId,
      timelineVideoClips:[clip]}
    const saved=await invoke(`window.electronAPI.saveProjectState(${JSON.stringify(state)})`)
    assert(saved.success,'APP_AUTOSAVE_FAILED:'+saved.error)
    const reopened=await invoke(`window.electronAPI.loadProject({projectPath:${JSON.stringify(projectRoot)}})`)
    assert(reopened.success&&reopened.data?.timelineVideoClips?.length===1,'APP_PROJECT_RELOAD_FAILED')
    const persisted=reopened.data.timelineVideoClips[0].visualRegeneration
    assert.equal(persisted.revision,'editorial-modular-catalog-2026-09-v1')
    const replay=await invoke(`window.electronAPI.regenerateEditorialModularCatalogV1(${JSON.stringify(persisted)})`)
    assert(replay.success&&replay.path&&fs.existsSync(replay.path),'APP_REPLAY_FAILED:'+replay.error)
    assert.equal(replay.path,generated.path,'APP_REPLAY_IDENTITY_CHANGED')
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    const result={passed:true,selectorCount:listed.assets.length,projectSaved:true,reloaded:true,
      replaySamePath:true,visualSinFichero:0,networkAttempts,profile:state.visualPresentationProfile,
      generatedPath:generated.path,assetRootConfigured:true,catalogRootConfigured:true}
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify({passed:true,selectorCount:listed.assets.length,outputRoot}))
    code=0
  }catch(error){fs.mkdirSync(outputRoot,{recursive:true});fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error));console.error(error?.stack||error)}
  finally{if(window&&!window.isDestroyed())window.destroy();try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
