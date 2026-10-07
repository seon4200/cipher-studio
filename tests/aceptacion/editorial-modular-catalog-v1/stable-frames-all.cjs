const {app,BrowserWindow,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const pilotAssets=path.resolve(root,'../_cipher-idea-assembly-v3/runtime')
const outputRoot=path.join(catalogRoot,'evidence','stable-renderer-frames')
const fixture=createTestFixture('editorial-modular-all-stills'),projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
app.whenReady().then(async()=>{
  let code=1,window
  try{
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'modular-still-fixture',clips:[],timelineVideoClips:[],aiScript:''})
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const entries=inventory.entries.filter(e=>!(e.role==='support' && Number(e.code.slice(1))<=10))
    assert.equal(entries.length,240)
    const byCode=new Map(inventory.entries.map(e=>[e.code,e.assetId]))
    const id=code=>{const value=byCode.get(code);assert(value,code);return value}
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const imported={}
    const template=await b.generateIdeaColorPilotV4({projectRoot,assetRoot:pilotAssets,
      color:{supportSource:'ink',heroMode:'recolorable',heroPrimary:'#A83B19'},
      orientation:'portrait',render:b.renderGraphicClip})
    assert(template.file&&fs.existsSync(template.file),'V4_TEMPLATE_MISSING')
    window=new BrowserWindow({show:false,width:720,height:1288,useContentSize:true,frame:false,
      transparent:true,backgroundColor:'#00000000',webPreferences:{offscreen:{deviceScaleFactor:1},
        nodeIntegration:false,contextIsolation:false}})
    await window.loadFile(path.join(root,'dist','grafico.html'))
    const ready=await window.webContents.executeJavaScript('window.__listo()')
    assert(!ready?.avisos?.some?.(a=>a.includes('FUENTE AUSENTE')),'FONT_MISSING')
    const result=[]
    for(const entry of entries.slice(0,process.env.STILL_LIMIT?Number(process.env.STILL_LIMIT):undefined)){
      const heroId=entry.role==='hero-core'?entry.assetId:id('H001')
      const supportIds=[entry.role==='support'?entry.assetId:id('S001'),id('S002'),id('S003'),id('S004')]
      const rearId=entry.role==='rear-collage'?entry.assetId:id('L001')
      const accentId=entry.role==='accent-mask'?entry.assetId:id('L036')
      const frontId=entry.role==='front-collage'?entry.assetId:undefined
      const recipe=entry.role==='hero-core'
        ? entry.aspectClass==='wide'?'wide':entry.aspectClass==='compact'?'compact':'vertical'
        : 'vertical'
      for(const selectedId of [heroId,...supportIds,rearId,accentId,frontId].filter(Boolean))
        if(!imported[selectedId]) imported[selectedId]=catalog.publish(projectRoot,selectedId)
      const built=b.bindEditorialModularCatalogV1({template,imported,heroId,supportIds,
        rearId,accentId,frontId,recipe,accentTheme:'orange',
        color:{supportSource:'ink',heroMode:'recolorable',heroPrimary:'#A83B19'},
        headline:{connector:'VISTA',keyword:entry.code,closing:'RENDER DE CIPHER'}})
      const prepared=b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,
        renderBindings:built.renderBindings})
      assert.equal(prepared.kind,'scene-spec')
      assert(prepared.preparedAssets.length>=7,'PREPARED_ASSETS_MISSING')
      await window.webContents.executeJavaScript(`window.__montar(${JSON.stringify(prepared.graphicData)},`+
        `${JSON.stringify({ancho:720,alto:1280,modo:'pantalla',duracion:80/24,sistema:'editorial'})},`+
        `${JSON.stringify(prepared.preparedAssets)})`)
      await window.webContents.executeJavaScript(`window.__setT(2.25);new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      const qc=await window.webContents.executeJavaScript('window.__visualQc()')
      if(qc.keywordOverflow||qc.textOverflow||!qc.hero||qc.heroOpacity<.99)
        throw new Error('STABLE_RENDERER_QC:'+entry.code+':'+JSON.stringify(qc))
      const capture=await window.webContents.capturePage()
      const size=capture.getSize()
      assert(size.width===720&&size.height===1288,'CAPTURE_SIZE_MISMATCH:'+entry.code+':'+JSON.stringify(size))
      const frame=capture.crop({x:0,y:0,width:720,height:1280})
      const destination=path.join(outputRoot,entry.code.toLowerCase()+'.jpg')
      fs.writeFileSync(destination,frame.toJPEG(86))
      result.push({code:entry.code,assetId:entry.assetId,role:entry.role,word:entry.primaryWordEs,
        frame:destination,frameSha256:sha(fs.readFileSync(destination)),pixelIdentitySha256:sha(Buffer.from(built.pixelIdentity))})
      if(result.length%10===0) console.log(`STABLE_RENDERER ${result.length}/${entries.length}`)
      fs.writeFileSync(path.join(outputRoot,'checkpoint.json'),JSON.stringify({done:result.length,assets:result},null,2)+'\n')
    }
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    const summary={passed:result.length===240,rendered:result.length,expected:240,
      networkAttempts,frames:result}
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify(summary,null,2)+'\n')
    console.log(JSON.stringify({passed:summary.passed,rendered:result.length,outputRoot}))
    code=0
  }catch(error){fs.mkdirSync(outputRoot,{recursive:true});fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error));console.error(error?.stack||error)}
  finally{if(window&&!window.isDestroyed())window.destroy();try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
