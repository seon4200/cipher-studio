const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const evidence=path.resolve(root,'../_cipher-editorial-catalog-1265/evidence/first-tranche-20-v3-1')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
const fixture=createTestFixture('editorial-catalog-1265-first-tranche'),projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'));app.commandLine.appendSwitch('force-device-scale-factor','1');process.chdir(fixture)
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const cases=[
  {id:'reef',text:'El arrecife y el agua sostienen la naturaleza marina; el mapa de arrecife registra sus hábitats.',anchor:'Arrecife de coral',concepts:['Arrecife de coral','Coral','Agua','Naturaleza','Mapa de arrecife'],expectedHero:'editorial-hero-arrecife-coral-001',expectedRear:'editorial-paper-carta-ecologia-marina-001',headline:{connector:'Un',keyword:'ARRECIFE',closing:'con vida marina.'}},
  {id:'glacier',text:'El glaciar retrocede y el agua derretida cambia el clima; el sondeo glaciar mide sus estratos.',anchor:'Glaciar',concepts:['Glaciar','Estratos de hielo','Agua','Clima','Sondeo glaciar'],expectedHero:'editorial-hero-glaciar-frente-calving-001',expectedRear:'editorial-paper-sondeo-glaciar-002',headline:{connector:'El',keyword:'GLACIAR',closing:'revela sus estratos.'}},
  {id:'wildfire',text:'El incendio forestal avanza y eleva el riesgo; el registro de campo de incendio documenta su perímetro.',anchor:'Incendio forestal',concepts:['Incendio forestal','Fuego','Bosque','Alerta','Registro de campo de incendio'],expectedHero:'editorial-hero-frente-incendio-forestal-001',expectedRear:'editorial-paper-registro-incendio-001',headline:{connector:'El',keyword:'INCENDIO',closing:'avanza en el bosque.'}},
  {id:'rov',text:'Un ROV explora el fondo, registra imágenes y contrasta sus datos con una carta batimétrica.',anchor:'Vehículo ROV submarino',concepts:['Vehículo ROV submarino','Cámara','Exploración submarina','Red','Carta batimétrica'],expectedHero:'editorial-hero-rov-investigacion-submarina-001',expectedRear:'editorial-paper-carta-ecologia-marina-001',headline:{connector:'Un',keyword:'ROV',closing:'explora el fondo.'}},
  {id:'dam',text:'La compuerta regula el caudal de la presa y activa la turbina hidroeléctrica.',anchor:'Compuerta de presa',concepts:['Compuerta de presa','Agua','Caudal','Energía'],expectedHero:'editorial-hero-compuerta-presa-001',expectedRear:null,headline:{connector:'La',keyword:'COMPUERTA',closing:'regula el caudal.'}},
]
app.whenReady().then(async()=>{
  let code=1
  try{
    assert(fs.existsSync(ffmpeg),'FFMPEG_MISSING:'+ffmpeg)
    fs.mkdirSync(evidence,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)}))
    let networkAttempts=0
    global.fetch=async url=>{networkAttempts++;throw Error('NETWORK_FORBIDDEN_AFTER_MATERIALIZATION:'+String(url))}
    b.createProjectFiles(projectRoot,{id:'editorial-catalog-1265-first-tranche',clips:[],timelineVideoClips:[],aiScript:'Fixtures locales de revisión editorial.'})
    const catalog=new b.CuratedModularCatalogV2(catalogRoot)
    const catalogHealth=catalog.verifyAll()
    assert(catalogHealth.listed>=270&&catalogHealth.verified===catalogHealth.listed,
      `EDITORIAL_CATALOG_ACTIVE_SNAPSHOT_INVALID:${JSON.stringify(catalogHealth.failures)}`)
    const outputs=[]
    for(const orientation of ['portrait','landscape'])for(const item of cases){
      const semantic=b.createLocalSceneSemanticV1({sceneId:'first20-'+item.id,start:0,end:3,
        transcriptSegments:[{start:0,end:3,text:item.text}],anchor:item.anchor,
        concepts:item.concepts.map(label=>({label,scope:'scene'})).concat([{label:'Papel marfil',scope:'context'}]),
        globalText:item.text})
      const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:3,
        localSemantic:semantic,keywordCandidates:[{keyword:item.anchor.toUpperCase(),source:'scene-semantic'}],
        preferredVisualMode:'editorial-text',sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',
          camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:51721},videoStyleId:'cream-editorial'})
      const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
      const result=b.selectEditorialLocalBankV3Detailed({catalog,semantic})
      assert.equal(result.trace.outcome,'SELECTED',`${item.id}:${JSON.stringify(result.trace)}`)
      const selection=result.selection
      assert.equal(selection.heroId,item.expectedHero,`${item.id}:HERO:${JSON.stringify(selection)}`)
      assert.equal(selection.rearId??null,item.expectedRear,`${item.id}:SEMANTIC_REAR:${JSON.stringify(selection)}`)
      assert.equal(selection.backgroundId,'editorial-background-papel-marfil-fibras-001')
      assert.equal(selection.frontId,undefined)
      const ids=[selection.heroId,...selection.supportIds,selection.rearId,selection.accentId,selection.backgroundId].filter(Boolean)
      const imported=Object.fromEntries([...new Set(ids)].map(id=>[id,catalog.publish(projectRoot,id)]))
      const built=b.bindEditorialLocalBankV2({template:base,catalog,imported,selection,color:'#A83B19',
        contract:b.EDITORIAL_LOCAL_BANK_V3,headline:item.headline})
      b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,renderBindings:built.renderBindings})
      let qc=null
      const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
        alto:orientation==='portrait'?1280:720,fps:24,duracion:3,modo:'pantalla',sistema:'editorial',
        projectRoot,renderBindings:built.renderBindings,onQcReport:value=>{qc=value},onQcFailure:value=>{qc=value}})
      assert(file&&fs.existsSync(file),'VISUAL_SIN_FICHERO:'+item.id+':'+orientation+':'+JSON.stringify(qc))
      const stem=`${orientation}-${item.id}`,mp4=path.join(evidence,stem+'.mp4'),frame=path.join(evidence,stem+'-stable.png')
      fs.copyFileSync(file,mp4)
      execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss','1.8','-i',mp4,'-frames:v','1',frame])
      outputs.push({orientation,scene:item.id,heroId:selection.heroId,supportIds:selection.supportIds,
        rearId:selection.rearId??null,accentId:selection.accentId??null,backgroundId:selection.backgroundId,
        pixelIdentity:built.pixelIdentity,mp4,mp4Sha256:sha(fs.readFileSync(mp4)),frame,
        frameSha256:sha(fs.readFileSync(frame)),qc:qc?.findings??[]})
    }
    assert.equal(networkAttempts,0,'NETWORK_AFTER_MATERIALIZATION')
    const reports={passed:true,profile:'editorial-local-bank-v3',revision:'editorial-local-bank-2026-09-v3.1',catalog:{listed:catalogHealth.listed,verified:catalogHealth.verified,base250ShaPreserved:true},
      sceneCount:cases.length,orientations:['portrait','landscape'],fps:24,sceneDurationSeconds:3,
      noNetworkAfterMaterialization:true,visualSinFichero:0,outputs}
    fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(reports,null,2)+'\n')
    for(const orientation of ['portrait','landscape']){
      const clips=outputs.filter(item=>item.orientation===orientation).map(item=>`file '${item.mp4.replace(/\\/g,'/')}'`).join('\n')+'\n'
      const list=path.join(evidence,`${orientation}-concat.txt`);fs.writeFileSync(list,clips)
      execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-c','copy',path.join(evidence,`first-20-${orientation}.mp4`)])
    }
    const cards=outputs.map(item=>`<article><h3>${item.scene} · ${item.orientation}</h3><img src="${path.basename(item.frame)}"><p>Hero: ${item.heroId}<br>Paper: ${item.rearId??'none'}<br>Accent: ${item.accentId??'none'}</p><a href="${path.basename(item.mp4)}">clip 3 s</a></article>`).join('')
    fs.writeFileSync(path.join(evidence,'contact-sheet.html'),`<!doctype html><meta charset="utf-8"><title>Catalog 1265 · first 20 real-composer review</title><style>body{font:15px system-ui;background:#ece9e1;color:#171714;margin:24px}main{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:16px}article{background:#faf9f6;padding:12px;border-radius:9px}img{width:100%;height:340px;object-fit:contain;background:#ddd9d0}p{font-size:12px}</style><h1>First tranche 20 · real Cipher composer · 24 fps</h1><main>${cards}</main>`)
    console.log(JSON.stringify({passed:true,sceneCount:cases.length,orientations:['portrait','landscape'],
      mp4Vertical:path.join(evidence,'first-20-portrait.mp4'),mp4Horizontal:path.join(evidence,'first-20-landscape.mp4'),
      contactSheet:path.join(evidence,'contact-sheet.html'),networkAttempts,visualSinFichero:0}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
