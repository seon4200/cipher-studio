const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const corpus=require('./corpus.cjs')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const outputRoot=path.resolve(root,'../_cipher-editorial-local-bank-v2/evidence')
const selected=process.env.CASE_IDS?corpus.filter(item=>process.env.CASE_IDS.split(',').includes(item.id)):corpus
const orientations=process.env.CASE_ORIENTATION?[process.env.CASE_ORIENTATION]:['portrait','landscape']
const fixture=createTestFixture('editorial-local-bank-evidence'),projectRoot=path.join(fixture,'project')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const run=args=>{const result=spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:10*1024*1024})
  if(result.status!==0)throw new Error('FFMPEG:'+result.status+':'+String(result.stderr).slice(-1400))}
const quote=file=>`file '${file.replaceAll("'","'\\''")}'`
const html=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
app.whenReady().then(async()=>{
  let exitCode=1
  try{
    fs.mkdirSync(outputRoot,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'editorial-local-bank-fixture',clips:[],timelineVideoClips:[],
      aiScript:'Corpus sintético sin narración. No se certifica sincronía de voz.'})
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const id=code=>{const entry=inventory.entries.find(item=>item.code===code);assert(entry,code);return entry.assetId}
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const contexts=selected.map((item,index)=>{
      const terms=[item.hero,...item.supports].map(code=>inventory.entries.find(e=>e.code===code).primaryWordEs)
      const text=item.title.join(' ')
      const semantic=b.createLocalSceneSemanticV1({sceneId:item.id,start:index*3,end:index*3+3,
        transcriptSegments:[{start:index*3,end:index*3+3,text}],anchor:terms[0],
        concepts:terms.map(label=>({label,scope:'scene'})),globalText:text})
      return b.createModernVisualGenerationContextV2({sceneId:item.id,duration:3,localSemantic:semantic,
        keywordCandidates:[{keyword:item.title[1],source:'scene-semantic'}],
        preferredVisualMode:'editorial-text',sistema:'editorial',
        direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',
          ritmo:'simultaneo',semilla:95151+index},videoStyleId:'cream-editorial'})
    })
    const base=await b.resolveModernVisualGenerationBatchV2({contexts,projectRoot})
    let networkAttempts=0
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN_EDITORIAL_LOCAL')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    const results=[]
    for(let index=0;index<selected.length;index++){
      const item=selected[index]
      const heroId=id(item.hero)
      const supportIds=item.supports.map(id)
      const aspect=catalog.aspectClass(heroId)
      const layerCodes=aspect==='wide'?['L002','L037','L022']:
        aspect==='compact'?['L003','L038','L023']:['L001','L036','L021']
      const [rearId,accentId,frontId]=layerCodes.map(id)
      const assetIds=[heroId,...supportIds,rearId,accentId,frontId]
      const imported=Object.fromEntries(assetIds.map(assetId=>[assetId,catalog.publish(projectRoot,assetId)]))
      const selection={family:item.family,variant:aspect==='wide'?'inverse':'base',heroId,
        supportIds,rearId,accentId,frontId,reason:'DIRECTED_CORPUS',missingTerms:[]}
      const built=b.bindEditorialLocalBankV2({template:base[index].resolved.compiled,catalog,imported,
        selection,color:'#A83B19',headline:{connector:item.title[0],keyword:item.title[1],closing:item.title[2]}})
      assert.equal(built.sceneSpec.editorialBankV2.family,item.family)
      assert.equal(built.sceneSpec.editorialBankV2.layers.length,3)
      try{b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,
        renderBindings:built.renderBindings})}
      catch(error){throw new Error(`PREFLIGHT:${item.id}:${error.code??error.message}:${JSON.stringify(error.details??error.context??{})}`)}
      for(const orientation of orientations){
        const frames=72,destination=path.join(outputRoot,`${item.id}-${orientation}.mp4`)
        const recordPath=path.join(outputRoot,`${item.id}-${orientation}.json`)
        const keyframe=path.join(outputRoot,`${item.id}-${orientation}-stable.png`)
        const identitySha256=sha(Buffer.from(built.pixelIdentity))
        const previous=fs.existsSync(recordPath)?JSON.parse(fs.readFileSync(recordPath,'utf8')):null
        if(previous?.identitySha256===identitySha256&&fs.existsSync(destination)&&
            sha(fs.readFileSync(destination))===previous.fileSha256&&fs.existsSync(keyframe)){
          results.push(previous)
          console.log(`EDITORIAL_LOCAL ${item.id} ${orientation} verified-cache ${results.length}/${selected.length*orientations.length}`)
          continue
        }
        let report
        const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
          alto:orientation==='portrait'?1280:720,fps:24,duracion:frames/24,modo:'pantalla',
          sistema:'editorial',projectRoot,renderBindings:built.renderBindings,
          onQcReport:r=>{report=r},onQcFailure:r=>{report=r;
            fs.writeFileSync(path.join(outputRoot,`${item.id}-${orientation}-qc-failure.json`),JSON.stringify(r,null,2))}})
        assert(file&&fs.existsSync(file),`VISUAL_SIN_FICHERO:${item.id}:${orientation}:${JSON.stringify(report?.findings??[])}`)
        fs.copyFileSync(file,destination)
        run(['-hide_banner','-loglevel','error','-y','-ss','2.25','-i',destination,'-frames:v','1',keyframe])
        const record={id:item.id,family:item.family,orientation,heroId,supportIds,
          layerIds:[rearId,accentId,frontId],title:item.title,
          layoutVariant:selection.variant,background:built.sceneSpec.editorialBankV2.background,
          accent:built.sceneSpec.editorialBankV2.accent,relations:built.sceneSpec.editorialBankV2.relations.length,
          beats:built.sceneSpec.editorialBankV2.beats,selectionReason:selection.reason,
          identitySha256,fileSha256:sha(fs.readFileSync(destination)),
          qc:report?.findings??[],fps:24,frames,duration:3,file:destination,keyframe}
        fs.writeFileSync(recordPath,JSON.stringify(record,null,2)+'\n')
        results.push(record)
        console.log(`EDITORIAL_LOCAL ${item.id} ${orientation} ${results.length}/${selected.length*orientations.length}`)
      }
    }
    for(const orientation of orientations){
      const files=results.filter(item=>item.orientation===orientation).map(item=>item.file)
      if(!files.length)continue
      const list=path.join(outputRoot,`montage-${orientation}.txt`)
      fs.writeFileSync(list,files.map(quote).join('\n')+'\n')
      run(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,
        '-c','copy',path.join(outputRoot,`editorial-local-bank-v2-${orientation}.mp4`)])
    }
    const cards=results.map(item=>`<article><a href="${path.basename(item.file)}"><img src="${path.basename(item.keyframe)}"></a><h2>${html(item.id)} · ${html(item.family)} · ${html(item.orientation)}</h2><p>${html(item.title.join(' '))}</p><p>Hero ${html(item.heroId)} · Supports ${html(item.supportIds.join(', '))}</p><p>Capas ${html(item.layerIds.join(', '))}</p><p><a href="${path.basename(item.file)}">Clip MP4</a> · <a href="${item.id}-${item.orientation}.json">SHA/QC</a></p></article>`).join('\n')
    fs.writeFileSync(path.join(outputRoot,'editorial-local-bank-v2-gallery.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><title>Editorial local · 17 familias</title><style>body{font-family:system-ui;background:#171717;color:#eee;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}article{background:#272727;padding:12px;border-radius:10px}img{width:100%;height:300px;object-fit:contain;background:#e9e6df}h2{font-size:16px}p{font-size:12px}</style><h1>17 familias · dos formatos · renderer real</h1><main>${cards}</main></html>`)
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify({passed:true,scenes:results.length,
      catalogAssets:catalog.entries().length,networkAttempts,visualSinFichero:0,results},null,2)+'\n')
    console.log(JSON.stringify({passed:true,scenes:results.length,outputRoot,networkAttempts}))
    exitCode=0
  }catch(error){fs.mkdirSync(outputRoot,{recursive:true})
    fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error))
    const debug=path.join(fixture,'cipher-studio','generation-debug.log')
    if(fs.existsSync(debug))fs.writeFileSync(path.join(outputRoot,'failure-debug.log'),fs.readFileSync(debug))
    console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(exitCode)}
}).catch(error=>{console.error(error);app.exit(1)})
