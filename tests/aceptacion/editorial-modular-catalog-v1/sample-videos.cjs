const { app, session, ipcMain } = require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const pilotAssets=path.resolve(root,'../_cipher-idea-assembly-v3/runtime')
const outputRoot=path.join(catalogRoot,'evidence','sample-videos')
const fixture=createTestFixture('editorial-modular-sample-videos'),projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const cases=[
  {code:'h001',hero:'H001',supports:['S001','S002','S003','S004'],rear:'L001',accent:'L036',front:'L021',recipe:'vertical',title:['UNA','IDEA','abre nuevas posibilidades'],color:'#A83B19'},
  {code:'h011',hero:'H011',supports:['S005','S006','S025','S010'],rear:'L001',accent:'L036',recipe:'vertical',title:['LA','SEÑAL','conecta conceptos'],color:'#238C87'},
  {code:'h101',hero:'H101',supports:['S046','S049','S050','S048'],rear:'L002',accent:'L038',recipe:'compact',title:['LAS','PIEZAS','construyen el sistema'],color:'#B8444F'},
  {code:'h061',hero:'H061',supports:['S034','S033','S036','S048'],rear:'L003',accent:'L041',recipe:'organic',title:['UNA','SEMILLA','inicia el cambio'],color:'#A83B19'},
  {code:'h104',hero:'H104',supports:['S029','S030','S045','S004'],rear:'L002',accent:'L038',recipe:'wide',title:['UN','PUENTE','une dos caminos'],color:'#A83B19'},
  {code:'h020',hero:'H020',supports:['S005','S027','S026','S025'],rear:'L004',accent:'L036',recipe:'wide',title:['EL','CINE','proyecta historias'],color:'#238C87'},
  {code:'h080',hero:'H080',supports:['S026','S031','S025','S038'],rear:'L003',accent:'L043',recipe:'vertical',title:['LAS','ONDAS','se convierten en sonido'],color:'#B8444F'},
  {code:'h120',hero:'H120',supports:['S029','S020','S021','S004'],rear:'L002',accent:'L038',recipe:'vertical',title:['UNA','RUTA','necesita señales claras'],color:'#A83B19'},
]
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const run=(args)=>{const result=spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:10*1024*1024});if(result.status!==0)throw new Error('FFMPEG:'+result.status+':'+result.stderr.slice(-1600));return result}
app.whenReady().then(async()=>{
  let code=1
  try{
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'modular-samples',clips:[],timelineVideoClips:[],aiScript:'synthetic modular catalogue samples'})
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN_MODULAR')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const id=code=>{const entry=inventory.entries.find(e=>e.code===code);assert(entry,code);return entry.assetId}
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const unique=[...new Set(cases.flatMap(c=>[c.hero,...c.supports,c.rear,c.accent,c.front].filter(Boolean)))]
    const imported=Object.fromEntries(unique.map(code=>{const assetId=id(code);return [assetId,catalog.publish(projectRoot,assetId)]}))
    const template=await b.generateIdeaColorPilotV4({projectRoot,assetRoot:pilotAssets,
      color:{supportSource:'ink',heroMode:'recolorable',heroPrimary:'#A83B19'},
      orientation:'portrait',render:b.renderGraphicClip})
    assert(template.file&&fs.existsSync(template.file),'V4_TEMPLATE_MISSING')
    const results=[]
    for(const orientation of (process.env.SAMPLE_ORIENTATION?[process.env.SAMPLE_ORIENTATION]:['portrait','landscape'])){
      const playlist=[]
      for(const item of (process.env.SAMPLE_CASE?cases.filter(c=>c.code===process.env.SAMPLE_CASE):cases)){
        const built=b.bindEditorialModularCatalogV1({template,imported,heroId:id(item.hero),
          supportIds:item.supports.map(id),rearId:id(item.rear),accentId:id(item.accent),
          frontId:item.front?id(item.front):undefined,recipe:item.recipe,accentTheme:'orange',
          color:{supportSource:'hero-primary',heroMode:'recolorable',heroPrimary:item.color},
          headline:{connector:item.title[0],keyword:item.title[1],closing:item.title[2]}})
        let qc
        const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
          alto:orientation==='portrait'?1280:720,fps:24,duracion:80/24,modo:'pantalla',
          sistema:'editorial',projectRoot,renderBindings:built.renderBindings,
          onQcReport:report=>{qc=report},onQcFailure:report=>{qc=report}})
        assert(file&&fs.existsSync(file),`VISUAL_SIN_FICHERO:${item.code}:${orientation}:${JSON.stringify(qc?.findings??[])}`)
        const out=path.join(outputRoot,`${item.code}-${orientation}.mp4`)
        fs.copyFileSync(file,out)
        const frame=path.join(outputRoot,`${item.code}-${orientation}-stable.png`)
        run(['-y','-ss','2.25','-i',out,'-frames:v','1',frame])
        assert(fs.statSync(frame).size>10000,'STABLE_FRAME_EMPTY')
        playlist.push(out)
        results.push({code:item.code,orientation,file:out,frame,heroId:id(item.hero),
          supportIds:item.supports.map(id),pixelIdentitySha256:sha(Buffer.from(built.pixelIdentity)),
          findings:qc?.findings??[]})
        console.log(`SAMPLE ${orientation} ${item.code} ${results.length}/16`)
      }
      const list=path.join(outputRoot,`${orientation}-concat.txt`)
      fs.writeFileSync(list,playlist.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join('\n')+'\n')
      const montage=path.join(outputRoot,`editorial-modular-v1-${orientation}.mp4`)
      run(['-y','-f','concat','-safe','0','-i',list,'-c','copy',montage])
      assert(fs.statSync(montage).size>100000,'MONTAGE_EMPTY')
    }
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    const result={passed:true,scenes:results.length,cases:cases.length,networkAttempts,
      visualSinFichero:0,results,montages:['portrait','landscape'].map(o=>path.join(outputRoot,`editorial-modular-v1-${o}.mp4`))}
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify({passed:true,scenes:results.length,outputRoot}))
    code=0
  }catch(error){fs.mkdirSync(outputRoot,{recursive:true});fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error));console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error('cleanup',error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
