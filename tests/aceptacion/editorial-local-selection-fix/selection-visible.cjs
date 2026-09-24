const {app,ipcMain,session}=require('electron')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {execFileSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')

const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const evidence=path.resolve(root,'../_cipher-editorial-selection-fix/evidence')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||
  path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
const fixture=createTestFixture('editorial-selection-bindings')
const bindingRoot=path.join(fixture,'bindings')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')

app.whenReady().then(async()=>{
  let code=1,networkAttempts=0
  try{
    fs.mkdirSync(evidence,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    assert.equal(b.preflightEditorialLocalCatalogV2(undefined,0),null)
    assert.throws(()=>b.preflightEditorialLocalCatalogV2('',1),/Biblioteca editorial sin configurar/)
    assert.throws(()=>b.preflightEditorialLocalCatalogV2(path.join(fixture,'missing'),1),
      /Biblioteca editorial no disponible/)
    const catalog=b.preflightEditorialLocalCatalogV2(catalogRoot,1)
    assert(catalog)
    const cases=[
      {id:'idea',text:'Una idea conecta personas y datos.',anchor:'Idea',terms:['Idea','Personas','Datos'],
        expected:'SELECTED'},
      {id:'plural',text:'Una señal enlaza redes, cámaras y datos.',anchor:'Señal',
        terms:['Señal','redes','cámaras','datos'],expected:'SELECTED'},
      {id:'session-derived',text:'Los incendios forestales extremos aumentan.',
        anchor:'forest fire raging',terms:['bosque','incendio','temperatura'],
        expected:'INSUFFICIENT_SUPPORTS'},
      {id:'absent',text:'La quimera salta.',anchor:'quimera',terms:['quimera','salto'],
        expected:'NO_HERO'},
    ]
    const selected=[]
    for(const item of cases){
      const semantic=b.createLocalSceneSemanticV1({sceneId:item.id,start:0,end:3,
        transcriptSegments:[{start:0,end:3,text:item.text}],anchor:item.anchor,
        concepts:item.terms.map(label=>({label})),globalText:item.text})
      const decision=b.selectEditorialLocalBankV2Detailed({catalog,semantic})
      assert.equal(decision.trace.outcome,item.expected,item.id)
      selected.push({...item,semantic,decision})
    }
    assert(selected[1].decision.trace.supportCandidates.some(c=>c.term==='cámaras'&&
      c.assetId==='idea-support-camera-v1'&&c.match==='inflection'))
    assert.equal(catalog.search(['cámaras'],'support').length,0,'V1 search is unchanged')
    assert(selected[2].decision.trace.heroCandidates.some(c=>c.assetId==='editorial-hero-h063-v1'))
    assert(!selected[2].decision.selection,'a Hero alone must not fabricate Supports')
    const {semantic,decision}=selected[0]
    const selection=decision.selection
    const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:3,
      localSemantic:semantic,keywordCandidates:[{keyword:'IDEA',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',
      direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',
        ritmo:'simultaneo',semilla:95151},videoStyleId:'cream-editorial'})
    // ProjectAsset requires its minimal state contract. This lives only inside
    // the isolated binding fixture, never in the user's projects directory.
    b.createProjectFiles(bindingRoot,{id:'selection-bindings-only',clips:[],timelineVideoClips:[]})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot:bindingRoot}))[0].resolved.compiled
    const ids=[selection.heroId,...selection.supportIds,selection.rearId,selection.accentId,selection.frontId]
    const imported=Object.fromEntries(ids.map(id=>[id,catalog.publish(bindingRoot,id)]))
    for(const id of ids)assert.equal(imported[id].asset.sha256,sha(catalog.resolveAsset(id)))
    const built=b.bindEditorialLocalBankV2({template:base,catalog,imported,selection,
      color:'#A83B19',headline:{connector:'Una',keyword:'IDEA',closing:'conecta personas y datos.'}})
    b.validateRenderBindingsAny(built.renderBindings,built.sceneSpec)
    b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot:bindingRoot,
      renderBindings:built.renderBindings})
    const persisted=JSON.parse(JSON.stringify({sceneSpec:built.sceneSpec,renderBindings:built.renderBindings}))
    assert.equal(b.sceneSpecPixelIdentityAny(persisted.sceneSpec),built.pixelIdentity)
    b.validateRenderBindingsAny(persisted.renderBindings,persisted.sceneSpec)
    global.fetch=()=>{networkAttempts++;throw new Error('NETWORK_FORBIDDEN_AFTER_MATERIALIZATION')}
    session.defaultSession.webRequest.onBeforeRequest((request,callback)=>{
      if(/^https?:/i.test(request.url))networkAttempts++
      callback({cancel:/^https?:/i.test(request.url)})
    })
    let qc
    const file=await b.renderGraphicClip(built.graphicData,{ancho:720,alto:1280,fps:24,duracion:3,
      modo:'pantalla',sistema:'editorial',projectRoot:bindingRoot,renderBindings:built.renderBindings,
      onQcReport:report=>{qc=report}})
    assert(file&&fs.statSync(file).size>0,'VISUAL_SIN_FICHERO')
    const clip=path.join(evidence,'selection-visible.mp4')
    const frame=path.join(evidence,'selection-visible-stable.png')
    fs.copyFileSync(file,clip)
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss','2.2','-i',clip,
      '-frames:v','1',frame])
    assert(fs.statSync(frame).size>0)
    assert.equal(networkAttempts,0)
    const result={passed:true,source:'ISOLATED_SCENE_BINDINGS_NOT_USER_PROJECT',
      cases:selected.map(({id,decision})=>({id,selection:decision.selection,
        trace:decision.trace})),bindings:built.renderBindings.assets.map(({slotId,assetId})=>({slotId,assetId})),
      identitySha256:sha(Buffer.from(built.pixelIdentity)),clip,frame,networkAttempts,
      qc:qc?.findings??[],visualSinFichero:0}
    fs.writeFileSync(path.join(evidence,'selection-result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify({passed:true,cases:result.cases.map(c=>({id:c.id,outcome:c.trace.outcome})),
      bindings:result.bindings.length,networkAttempts,visualSinFichero:0,clip,frame}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
