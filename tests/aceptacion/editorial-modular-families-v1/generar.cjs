const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const corpus=require('./corpus.cjs')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
if(process.env.CASE_OUTPUT_SUBDIR&&!/^[a-z0-9-]+$/.test(process.env.CASE_OUTPUT_SUBDIR))
  throw new Error('CASE_OUTPUT_SUBDIR_INVALID')
if(process.env.CASE_COLOR&&!/^#[0-9A-F]{6}$/.test(process.env.CASE_COLOR))
  throw new Error('CASE_COLOR_INVALID')
const outputRoot=path.resolve(root,'../_cipher-editorial-integration-v1/evidence',process.env.CASE_OUTPUT_SUBDIR??'')
const fixture=createTestFixture('editorial-modular-families-30')
const projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const run=args=>{const result=spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:10*1024*1024});
  if(result.status!==0)throw new Error('FFMPEG:'+result.status+':'+result.stderr.slice(-1400))}
const quote=file=>`file '${file.replaceAll("'","'\\''")}'`
const html=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const selected=process.env.CASE_IDS?corpus.filter(item=>process.env.CASE_IDS.split(',').includes(item.id)):corpus
const orientations=process.env.CASE_ORIENTATION?[process.env.CASE_ORIENTATION]:['portrait','landscape']
const framesFor=item=>Math.min(96,60+(item.supports?.length??0)*8+
  (item.title[2]?.length>35?8:0))
let timelineCursor=0
const sceneRanges=selected.map(item=>{const start=timelineCursor,frames=framesFor(item)
  timelineCursor+=frames/24
  return {start,end:timelineCursor,frames}})
app.whenReady().then(async()=>{
  let exitCode=1
  try{
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'families-30-fixture',clips:[],timelineVideoClips:[],
      aiScript:'Synthetic editorial family review; no narration or voice timing asserted.'})
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN_FAMILIES')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    assert.equal(inventory.entries.length,250,'CATALOG_250_MISSING')
    const id=code=>{const entry=inventory.entries.find(item=>item.code===code);assert(entry,code);return entry.assetId}
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const contexts=selected.map((item,index)=>{
      const terms=[item.hero,...(item.supports??[])].filter(Boolean).map(code=>inventory.entries.find(e=>e.code===code).primaryWordEs)
      const text=item.title.join(' '),range=sceneRanges[index]
      const semantic=b.createLocalSceneSemanticV1({sceneId:item.id,start:range.start,end:range.end,
        transcriptSegments:[{start:range.start,end:range.end,text}],
        concepts:terms.map(label=>({label,canonicalHint:label,start:range.start,end:range.end,scope:'scene'})),
        anchor:terms[0]??item.title[1],globalText:corpus.map(c=>c.title.join(' ')).join('. '),
        globalHints:[],globalContextRef:'synthetic:editorial-families-30'})
      return b.createModernVisualGenerationContextV2({sceneId:item.id,duration:range.frames/24,localSemantic:semantic,
        keywordCandidates:[{keyword:item.title[1],source:'scene-semantic'}],preferredVisualMode:'editorial-text',
        sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',
          densidad:'media',ritmo:'simultaneo',semilla:91001+index},videoStyleId:'cream-editorial'})
    })
    const base=await b.resolveModernVisualGenerationBatchV2({contexts,projectRoot})
    assert.equal(base.length,selected.length)
    const uniqueCodes=[...new Set(selected.flatMap(c=>[c.hero,...(c.supports??[]),
      ...(c.hero?[`L${String(1+(Number(c.id.slice(1))-1)%20).padStart(3,'0')}`,
        `L${String(36+(Number(c.id.slice(1))-1)%15).padStart(3,'0')}`]:[])]).filter(Boolean))]
    const imported=Object.fromEntries(uniqueCodes.map(code=>{const assetId=id(code);
      return [assetId,catalog.publish(projectRoot,assetId)]}))
    const results=[]
    for(let index=0;index<selected.length;index++){
      const item=selected[index],sceneNumber=Number(item.id.slice(1)),frames=sceneRanges[index].frames
      const heroId=item.hero?id(item.hero):undefined
      const built=b.bindEditorialModularFamilyV1({template:base[index].resolved.compiled,catalog,imported,
        family:item.family,layoutVariant:sceneNumber%2===0?'inverse':'base',heroId,supportIds:(item.supports??[]).map(id),
        rearId:heroId?id(`L${String(1+(sceneNumber-1)%20).padStart(3,'0')}`):undefined,
        accentId:heroId?id(`L${String(36+(sceneNumber-1)%15).padStart(3,'0')}`):undefined,
        background:['ivory-clean','ivory-subtle-grid','white-soft-paper'][(sceneNumber-1)%3],
        entry:['text-first','hero-first','supports-first','word-first'][(sceneNumber-1)%4],
        supportTreatment:process.env.CASE_SUPPORT_TREATMENT||['paper-card','naked-label','ink-badge','accent-tile'][(sceneNumber-1)%4],
        camera:sceneNumber%5===0?'quiet-drift':'fixed',particles:process.env.CASE_PARTICLES|| (sceneNumber%7===0?'dust':'none'),
        color:process.env.CASE_COLOR||'#A83B19',headline:{connector:item.title[0],keyword:item.title[1],closing:item.title[2]},
        relations:(item.relations??[]).map(([from,to,meaning])=>({from,to,meaning}))})
      assert.equal(built.sceneSpec.layout.family,item.family)
      assert(!built.pixelIdentity.includes(projectRoot)&&!built.pixelIdentity.includes(catalogRoot),'PATH_IN_IDENTITY')
      for(const orientation of orientations){
        const destination=path.join(outputRoot,`${item.id}-${orientation}.mp4`)
        const frame=path.join(outputRoot,`${item.id}-${orientation}-stable.png`)
        const rawFrame=path.join(outputRoot,`${item.id}-${orientation}-raw32.png`)
        const identitySha256=sha(Buffer.from(built.pixelIdentity))
        const recordPath=path.join(outputRoot,`${item.id}-${orientation}.json`)
        const previous=fs.existsSync(recordPath)?JSON.parse(fs.readFileSync(recordPath,'utf8')):null
        let qc=[]
        if(!(process.env.CASE_FORCE_RENDER!=='1'&&previous&&previous.identitySha256===identitySha256&&fs.existsSync(destination)&&
            sha(fs.readFileSync(destination))===previous.fileSha256&&fs.existsSync(frame)&&
            (process.env.CASE_CAPTURE_RAW!=='1'||fs.existsSync(rawFrame)))){
          let report
          const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
            alto:orientation==='portrait'?1280:720,fps:24,duracion:frames/24,modo:'pantalla',
            sistema:'editorial',projectRoot,renderBindings:built.renderBindings,
            onQcReport:r=>{report=r},onQcFailure:r=>{report=r},
            ...(process.env.CASE_CAPTURE_RAW==='1'?{diagnosticCaptureFrames:[32],
              onDiagnosticFrame:(index,seconds,png)=>{assert.equal(index,32);fs.writeFileSync(rawFrame,png)}}:{})})
          assert(file&&fs.existsSync(file),`VISUAL_SIN_FICHERO:${item.id}:${orientation}:${JSON.stringify(report?.findings??[])}`)
          fs.copyFileSync(file,destination)
          run(['-hide_banner','-loglevel','error','-y','-ss',String(frames/24*.72),'-i',destination,'-frames:v','1',frame])
          qc=report?.findings??[]
        }else qc=previous.qc
        const record={id:item.id,family:item.family,layoutVariant:built.sceneSpec.editorialFamily.layoutVariant,
          orientation,title:item.title,heroId,
          supportIds:(item.supports??[]).map(id),relations:item.relations??[],
          background:built.sceneSpec.editorialFamily.background,
          entry:built.sceneSpec.editorialFamily.entry,supportTreatment:built.sceneSpec.editorialFamily.supportTreatment,
          camera:built.sceneSpec.editorialFamily.camera,particles:built.sceneSpec.editorialFamily.particles,
          accent:built.sceneSpec.editorialFamily.accent,selectionReason:'DIRECTED_CORPUS',
          identitySha256,fileSha256:sha(fs.readFileSync(destination)),qc,duration:frames/24,frames,fps:24,
          file:destination,frame,...(fs.existsSync(rawFrame)?{rawFrame}:{})}
        fs.writeFileSync(recordPath,JSON.stringify(record,null,2)+'\n')
        results.push(record)
        console.log(`FAMILY ${item.id} ${orientation} ${results.length}/${selected.length*orientations.length}`)
      }
    }
    // Interleave narrative densities/families in the montage; five consecutive
    // examples of one family would make the review feel like a test reel.
    const reviewOrder=item=>((Number(item.id.slice(1))-1)%5)*6+Math.floor((Number(item.id.slice(1))-1)/5)
    for(const orientation of orientations){
      const files=results.filter(item=>item.orientation===orientation)
        .sort((a,b)=>reviewOrder(a)-reviewOrder(b)).map(item=>item.file)
      const list=path.join(outputRoot,`montage-${orientation}.txt`)
      fs.writeFileSync(list,files.map(quote).join('\n')+'\n')
      const montage=path.join(outputRoot,`editorial-families-v1-${orientation}.mp4`)
      run(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-c','copy',montage])
    }
    const cards=results.map(r=>`<article><a href="${path.basename(r.file)}"><img src="${path.basename(r.frame)}"></a><h2>${html(r.id)} · ${html(r.family)} · ${html(r.layoutVariant)} · ${html(r.orientation)}</h2><p>${html(r.title.join(' '))}</p><p>${html(r.heroId??'TYPE-LED')} · ${html(r.supportIds.join(', '))}</p><p>${html(r.entry)} · ${html(r.background)} · ${html(r.supportTreatment)}</p><p>${html(r.camera.mode)} · ${html(r.particles.mode)} · ${html(r.accent)} · ${html(r.selectionReason)}</p><p><a href="${path.basename(r.file)}">Abrir clip</a> · <a href="${path.basename(r.id+'-'+r.orientation+'.json')}">Datos y SHA</a></p></article>`).join('\n')
    fs.writeFileSync(path.join(outputRoot,'families-30-gallery.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><title>30 escenas · dos formatos</title><style>body{font-family:system-ui;background:#171717;color:#eee;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}article{background:#272727;padding:12px;border-radius:10px}img{width:100%;height:290px;object-fit:contain;background:#e9e6df}h2{font-size:16px}p{font-size:12px}</style><h1>Editorial modular · 30 escenas reales</h1><main>${cards}</main></html>`)
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify({passed:true,scenes:results.length,
      catalogAssets:inventory.entries.length,networkAttempts,visualSinFichero:0,results},null,2)+'\n')
    console.log(JSON.stringify({passed:true,scenes:results.length,outputRoot,networkAttempts}))
    exitCode=0
  }catch(error){fs.mkdirSync(outputRoot,{recursive:true});
    fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error))
    console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(exitCode)}
}).catch(error=>{console.error(error);app.exit(1)})
