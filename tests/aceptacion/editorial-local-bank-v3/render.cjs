const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto'),{execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const evidence=process.env.CIPHER_V3_EVIDENCE_DIR||path.resolve(root,'../_cipher-editorial-catalog-1265/evidence/contextual-v3-sample')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
const fixture=createTestFixture('editorial-local-bank-v3-render'),projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'));app.commandLine.appendSwitch('force-device-scale-factor','1');process.chdir(fixture)
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
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
    b.createProjectFiles(projectRoot,{id:'contextual-v3-sample',clips:[],timelineVideoClips:[],aiScript:'Fixture sintético local.'})
    const catalog=new b.CuratedModularCatalogV2(catalogRoot)
    const semantic=b.createLocalSceneSemanticV1({sceneId:'v3-context-render',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'La turbina hidroeléctrica transforma el flujo de agua en energía.'}],
      anchor:'Turbina hidroeléctrica',concepts:['Turbina hidroeléctrica','Agua','Energía','Flujo'].map(label=>({label,scope:'scene'}))
        .concat([{label:'Papel editorial',scope:'context'}]),
      globalText:'Contexto de prueba independiente.'})
    const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:3,
      localSemantic:semantic,keywordCandidates:[{keyword:'CLIMA',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',
        camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:51721},videoStyleId:'cream-editorial'})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const result=b.selectEditorialLocalBankV3Detailed({catalog,semantic})
    assert.equal(result.trace.outcome,'SELECTED',JSON.stringify(result.trace))
    const selection=process.env.CIPHER_V3_HISTORICAL_PARITY==='1'
      ?{...result.selection,rearId:'editorial-paper-laboratorio-temperatura-002'}
      :result.selection
    assert.equal(selection.heroId,'editorial-hero-turbina-hidroelectrica-001',
      'NEW_HERO_NOT_CONTEXTUALLY_SELECTED:'+JSON.stringify(selection))
    assert(selection.supportIds.includes('editorial-support-s033-v1')||selection.supportIds.includes('editorial-support-agua-001'),
      'WATER_SUPPORT_NOT_CONTEXTUALLY_SELECTED:'+JSON.stringify(selection.supportIds))
    assert(selection.supportIds.includes('editorial-support-s031-v1')||selection.supportIds.includes('idea-support-flow-v1'),
      'ENERGY_OR_FLOW_SUPPORT_NOT_CONTEXTUALLY_SELECTED:'+JSON.stringify(selection.supportIds))
    assert.equal(selection.backgroundId,'editorial-background-papel-marfil-fibras-001')
    assert.equal(selection.frontId,undefined,'V3_DEFAULT_FRONT_LAYER_MUST_BE_ABSENT')
    const ids=[selection.heroId,...selection.supportIds,selection.rearId,selection.accentId,selection.frontId,selection.backgroundId].filter(Boolean)
    const imported=Object.fromEntries([...new Set(ids)].map(id=>[id,catalog.publish(projectRoot,id)]))
    const built=b.bindEditorialLocalBankV2({template:base,catalog,imported,selection,color:'#A83B19',
      contract:process.env.CIPHER_V3_HISTORICAL_PARITY==='1'
        ?{id:'editorial-local-bank-v3',revision:'editorial-local-bank-2026-09-v3'}:b.EDITORIAL_LOCAL_BANK_V3,
      headline:{connector:'La',keyword:'TURBINA',closing:'Agua produce energía.'}})
    b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,renderBindings:built.renderBindings})
    const outputs=[]
    for(const orientation of ['portrait','landscape']){
      let qc=null
      const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
        alto:orientation==='portrait'?1280:720,fps:24,duracion:3,modo:'pantalla',sistema:'editorial',
        projectRoot,renderBindings:built.renderBindings,onQcReport:value=>{qc=value},onQcFailure:value=>{qc=value}})
      assert(file&&fs.existsSync(file),'VISUAL_SIN_FICHERO:'+orientation+':'+JSON.stringify(qc))
      const mp4=path.join(evidence,`contextual-v3-${orientation}.mp4`),frame=path.join(evidence,`contextual-v3-${orientation}-stable.png`)
      fs.copyFileSync(file,mp4)
      execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss','2.2','-i',mp4,'-frames:v','1',frame])
      outputs.push({orientation,mp4,mp4Sha256:sha(fs.readFileSync(mp4)),frame,frameSha256:sha(fs.readFileSync(frame)),qc:qc?.findings??[]})
    }
    assert.equal(networkAttempts,0)
    const report={passed:true,profile:built.sceneSpec.presentationProfile,revision:built.sceneSpec.editorialBankV2.revision,
      family:selection.family,heroId:selection.heroId,supportIds:selection.supportIds,backgroundId:selection.backgroundId,
      layerIds:[selection.rearId,selection.accentId],
      pixelIdentity:built.pixelIdentity,networkAttempts,visualSinFichero:0,outputs}
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(report,null,2)+'\n')
    const cards=outputs.map(item=>`<article><h2>${item.orientation}</h2><img src="${path.basename(item.frame)}"><p><a href="${path.basename(item.mp4)}">MP4 (3s)</a></p><code>${item.mp4Sha256}</code></article>`).join('')
    fs.writeFileSync(path.join(evidence,'contact-sheet.html'),`<!doctype html><meta charset="utf-8"><title>V3 contextual compositor sample</title><style>body{font:16px system-ui;background:#ede9df;color:#111;margin:24px}main{display:flex;gap:24px;align-items:start}article{width:48%;background:#faf9f6;padding:16px;border-radius:12px}img{width:100%;max-height:600px;object-fit:contain}code{font-size:10px;overflow-wrap:anywhere}</style><h1>Local V3 contextual sample · ${selection.family}</h1><main>${cards}</main>`)
    console.log(JSON.stringify({passed:true,profile:'editorial-local-bank-v3',family:selection.family,
      visualSinFichero:0,networkAttempts,outputs,evidence}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
