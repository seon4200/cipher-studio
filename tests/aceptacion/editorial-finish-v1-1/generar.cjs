const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const corpus=require('./corpus.cjs')
const root=path.resolve(__dirname,'../../..')
const evidenceRoot=path.resolve(root,'../_cipher-editorial-finish-v1-1/evidence')
const variant=process.env.CASE_VARIANT_DIR
if(variant&&!/^[a-z0-9-]+$/.test(variant))throw new Error('CASE_VARIANT_DIR_INVALID')
const outputRoot=variant?path.join(evidenceRoot,'comparisons',variant):evidenceRoot
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const fixture=createTestFixture('editorial-finish-12'),projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
const selected=process.env.CASE_IDS?corpus.filter(item=>process.env.CASE_IDS.split(',').includes(item.id)):corpus
const orientations=process.env.CASE_ORIENTATION?[process.env.CASE_ORIENTATION]:['portrait','landscape']
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const html=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const run=args=>{const result=spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:16*1024*1024})
  if(result.status!==0)throw new Error('FFMPEG:'+result.status+':'+result.stderr.slice(-1500))}
const quote=file=>`file '${file.replaceAll("'","'\\''")}'`
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'finish-12-fixture',clips:[],timelineVideoClips:[],
      aiScript:'Corpus sintético: no se afirma sincronización con voz.'})
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN_FINISH')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}else callback({cancel:false})
    })
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    assert.equal(inventory.entries.length,250)
    const id=code=>{const entry=inventory.entries.find(item=>item.code===code)
      assert(entry,'CODE_MISSING:'+code);return entry.assetId}
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const duration=96/24
    const contexts=selected.map(item=>{
      const index=corpus.indexOf(item)
      const words=[item.hero,...(item.supports??[])].filter(Boolean)
        .map(code=>inventory.entries.find(e=>e.code===code).primaryWordEs)
      const text=item.title.join(' ')
      const semantic=b.createLocalSceneSemanticV1({sceneId:item.id,start:index*duration,end:(index+1)*duration,
        transcriptSegments:[{start:index*duration,end:(index+1)*duration,text}],
        concepts:words.map(label=>({label,canonicalHint:label,start:index*duration,end:(index+1)*duration,scope:'scene'})),
        anchor:words[0]??item.title[1],globalText:corpus.map(c=>c.title.join(' ')).join('. '),
        globalHints:[],globalContextRef:'synthetic:editorial-finish-12'})
      return b.createModernVisualGenerationContextV2({sceneId:item.id,duration,localSemantic:semantic,
        keywordCandidates:[{keyword:item.title[1],source:'scene-semantic'}],preferredVisualMode:'editorial-text',
        sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',
          densidad:'media',ritmo:'simultaneo',semilla:98101+index},videoStyleId:'cream-editorial'})
    })
    const compiled=await b.resolveModernVisualGenerationBatchV2({contexts,projectRoot})
    assert.equal(compiled.length,selected.length)
    const codes=[...new Set(selected.flatMap(item=>[item.hero,...(item.supports??[]),
      ...(item.id==='F01'?['L001','L036']:[])].filter(Boolean)))]
    const imported=Object.fromEntries(codes.map(code=>{const assetId=id(code)
      return [assetId,catalog.publish(projectRoot,assetId)]}))
    const results=[]
    for(let i=0;i<selected.length;i++){
      const item=selected[i]
      const input={template:compiled[i].resolved.compiled,catalog,imported,
        family:item.family,layoutVariant:'base',heroId:item.hero?id(item.hero):undefined,
        supportIds:(item.supports??[]).map(id),
        rearId:item.id==='F01'?id('L001'):undefined,
        accentId:item.id==='F01'?id('L036'):undefined,
        background:item.family==='cuaderno'?'white-soft-paper':
          ['constelacion','cascada','partidoVertical'].includes(item.family)?'ivory-subtle-grid':'ivory-clean',
        entry:item.family==='constelacion'?'supports-first':item.family==='editorial'?'word-first':'text-first',
        supportTreatment:item.family==='partidoVertical'?'ink-badge':
          item.family==='cascada'?'naked-label':item.family==='cuaderno'?'accent-tile':'paper-card',
        camera:'fixed',particles:'none',color:item.color,
        headline:{connector:item.title[0],keyword:item.title[1],closing:item.title[2]},
        relations:(item.relations??[]).map(([from,to,meaning])=>({from,to,meaning})),
        finish:{display:process.env.CASE_DISPLAY||item.display,composition:item.composition,
          local:process.env.CASE_LOCAL||'discreto',ambient:process.env.CASE_AMBIENT||item.ambient,
          representation:process.env.CASE_REPRESENTATION||item.recipe||'auto',
          response:process.env.CASE_RESPONSE||item.response||'auto'},
      }
      const built=b.bindEditorialModularFinishV11(input)
      assert.equal(built.sceneSpec.presentationProfile.revision,b.EDITORIAL_FINISH_V1_1.revision)
      assert.equal(built.sceneSpec.editorialFinish.relations.length,(item.relations??[]).length)
      assert(!built.pixelIdentity.includes(projectRoot)&&!built.pixelIdentity.includes(catalogRoot))
      for(const orientation of orientations){
        const stem=`${item.id}-${orientation}`
        const destination=path.join(outputRoot,stem+'.mp4')
        const recordFile=path.join(outputRoot,stem+'.json')
        const identitySha256=sha(Buffer.from(built.pixelIdentity))
        const existing=fs.existsSync(recordFile)?JSON.parse(fs.readFileSync(recordFile,'utf8')):null
        let qc=existing?.qc??[],rendered=false
        if(process.env.CASE_FORCE_RENDER==='1'||!existing||existing.identitySha256!==identitySha256||!fs.existsSync(destination)||
           sha(fs.readFileSync(destination))!==existing.fileSha256){
          let report
          const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
            alto:orientation==='portrait'?1280:720,fps:24,duracion:duration,modo:'pantalla',
            sistema:'editorial',projectRoot,renderBindings:built.renderBindings,
            onQcReport:r=>{report=r},onQcFailure:r=>{report=r}})
          assert(file&&fs.existsSync(file),`VISUAL_SIN_FICHERO:${stem}:${JSON.stringify(report?.findings??[])}`)
          fs.copyFileSync(file,destination);qc=report?.findings??[];rendered=true
        }
        const firstArrival=built.sceneSpec.editorialFinish.events.find(e=>e.kind==='arrival')
        const times={entry:Math.min(.85,(built.sceneSpec.editorialFamily.supports[0]?.enter??.10)+.075),
          arrival:built.sceneSpec.editorialFinish.relations[0]?.arrival??.38,
          peak:firstArrival?firstArrival.start+firstArrival.duration*.5:
            Math.min(.8,(built.sceneSpec.editorialFinish.relations[0]?.arrival??.325)+.075),stable:.82}
        for(const [phase,value] of Object.entries(times)){
          const out=path.join(outputRoot,`${stem}-${phase}.png`)
          if(rendered||process.env.CASE_FORCE_FRAMES==='1'||!fs.existsSync(out))run(['-hide_banner','-loglevel','error','-y','-ss',String(value*duration),
            '-i',destination,'-frames:v','1',out])
        }
        const record={id:item.id,orientation,family:item.family,composition:item.composition,
          title:item.title,hero:item.hero??null,supports:item.supports??[],relations:item.relations??[],
          display:process.env.CASE_DISPLAY||item.display,color:item.color,
          representation:process.env.CASE_REPRESENTATION||item.recipe||'auto',
          response:process.env.CASE_RESPONSE||item.response||'auto',
          local:process.env.CASE_LOCAL||'discreto',ambient:process.env.CASE_AMBIENT||item.ambient,
          identitySha256,fileSha256:sha(fs.readFileSync(destination)),
          qc,duration,networkAttempts,source:'CIPHER_V15_RENDER',file:destination,
          events:built.sceneSpec.editorialFinish.events.map(e=>({id:e.id,start:e.start,end:e.start+e.duration,
            count:e.count,size:e.size,intensity:e.intensity})),
          relationTimeline:built.sceneSpec.editorialFinish.relations.map(r=>({from:r.from,to:r.to,
            meaning:r.meaning,start:r.start,arrival:r.arrival,end:r.end,
            representation:r.representation,response:r.response})),
          routes:built.sceneSpec.editorialFinish.relations.map(r=>({portrait:r.portrait,landscape:r.landscape}))}
        fs.writeFileSync(recordFile,JSON.stringify(record,null,2)+'\n')
        results.push(record)
        console.log(`FINISH ${stem} ${results.length}/${selected.length*orientations.length}`)
      }
    }
    if(selected.length===12&&orientations.length===2){
      for(const orientation of orientations){
        const orientationResults=results.filter(r=>r.orientation===orientation)
        const files=orientationResults.map(r=>r.file)
        const list=path.join(outputRoot,`montage-${orientation}.txt`)
        fs.writeFileSync(list,files.map(quote).join('\n')+'\n')
        run(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,
          '-c','copy',path.join(outputRoot,`editorial-finish-v1-1-${orientation}.mp4`)])
        const cell=orientation==='portrait'?{w:216,h:384}:{w:320,h:180}
        const inputArgs=orientationResults.flatMap(r=>['-i',path.join(outputRoot,
          `${r.id}-${orientation}-stable.png`)])
        const scaled=orientationResults.map((_,index)=>`[${index}:v]scale=${cell.w}:${cell.h}:flags=lanczos[s${index}]`)
        const positions=orientationResults.map((_,index)=>`${index%4*cell.w}_${Math.floor(index/4)*cell.h}`)
        const stack=orientationResults.map((_,index)=>`[s${index}]`).join('')+
          `xstack=inputs=12:layout=${positions.join('|')}[v]`
        run(['-hide_banner','-loglevel','error','-y',...inputArgs,'-filter_complex',
          [...scaled,stack].join(';'),'-map','[v]','-frames:v','1',
          path.join(outputRoot,`contact-${orientation}.png`)])
      }
    }
    const cards=results.map(r=>{const stem=`${r.id}-${r.orientation}`
      return `<article><h2>${html(r.id)} · ${html(r.family)} · ${html(r.orientation)}</h2>`+
        `<p>${html(r.title.join(' '))}</p><img src="${stem}-arrival.png" alt="Llegada">`+
        `<p>${html(r.composition)} · ${html(r.display)} · ${html(r.color)} · ${html(r.representation)} / ${html(r.response)}</p>`+
        `<p><a href="${stem}-peak.png">Pico del efecto</a> · <a href="${stem}-stable.png">Lectura limpia</a></p>`+
        `<p><a href="${stem}.mp4">Clip real</a> · <a href="${stem}-entry.png">Entrada</a> · `+
        `<a href="${stem}-stable.png">Estable</a> · <a href="${stem}.json">Contrato</a></p></article>`}).join('\n')
    fs.writeFileSync(path.join(outputRoot,'gallery.html'),`<!doctype html><html lang="es"><meta charset="utf-8">`+
      `<title>Editorial Finish V1.1 · 12 escenas</title><style>body{font-family:system-ui;background:#1b1b1b;color:#eee;margin:20px}`+
      `main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px}`+
      `article{background:#2a2a2a;padding:12px;border-radius:9px}img{width:100%;height:330px;object-fit:contain;background:#f0eee8}`+
      `a{color:#e5aa84}</style><h1>V1.1 · entrada / llegada / lectura</h1><main>${cards}</main></html>`)
    assert.equal(networkAttempts,0)
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify({passed:true,scenes:results.length,
      networkAttempts,visualSinFichero:0,results},null,2)+'\n')
    console.log(JSON.stringify({passed:true,scenes:results.length,outputRoot,networkAttempts}))
    code=0
  }catch(error){console.error(error?.stack||error);fs.mkdirSync(outputRoot,{recursive:true})
    fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error))}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
