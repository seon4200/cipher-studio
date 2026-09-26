const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const fixture=createTestFixture('editorial-local-bank-v4-controlled')
const projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    const b=require(path.join(root,'dist-electron/main/index.js'))
    const rejectedRelation={relacion:'separa',ancla:{icono:'water',ic:'💧',etiqueta:'líquido'},
      terminos:[{icono:'water',ic:'💧',etiqueta:'líquido'},
        {icono:'document',ic:'📄',etiqueta:'muestra'},
        {icono:'chart',ic:'📊',etiqueta:'componentes'}]}
    assert.equal(b.diagnosticarSemanticaVisual(rejectedRelation),'RELACION_FUERA_DE_ENUM')
    assert.equal(b.sanearSemanticaVisual(rejectedRelation),null,'UNKNOWN_RELATION_STILL_REJECTED')
    assert.equal(b.diagnosticarSemanticaVisual({...rejectedRelation,relacion:'estratifica'}),null)
    assert.equal(b.editorialVisibleExcerptV4(
      'Cromatógrafo líquido analiza vial de muestra y micropipeta automática; hoja de registro conserva datos.',3),
      'Cromatógrafo líquido analiza vial de muestra')
    assert.equal(b.editorialVisibleExcerptV4('No desaparece el peligro ni se conocen las causas.',3),
      'No desaparece el peligro')
    assert.equal(b.editorialVisibleExcerptV4(
      'Las pruebas sugieren un resultado preliminar que no confirma la causa.',3,'resultado'),
      'resultado','LATE_NEGATION_MUST_NOT_BECOME_POSITIVE_CLAIM')
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)}))
    let networkAttempts=0
    global.fetch=async url=>{networkAttempts++;throw Error('NETWORK_FORBIDDEN_AFTER_MATERIALIZATION:'+String(url))}
    b.createProjectFiles(projectRoot,{id:'v4-controlled',clips:[],timelineVideoClips:[],aiScript:'Prueba temporal.'})
    const catalog=new b.CuratedModularCatalogV2(catalogRoot)
    const health=catalog.verifyAll()
    assert.equal(health.failures.length,0,JSON.stringify(health.failures))
    assert.equal(b.preflightEditorialLocalCatalogV3(undefined,0),null,'ZERO_VISUAL_QUOTA_NEEDS_NO_CATALOG')
    const semantic=b.createLocalSceneSemanticV1({sceneId:'v4-controlled',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'El cromatógrafo líquido analiza una muestra.'}],
      anchor:'cromatógrafo líquido',concepts:[{label:'cromatógrafo líquido',scope:'scene'}],
      globalText:'El cromatógrafo líquido analiza una muestra.'})
    const selectionResult=b.selectEditorialLocalBankV4Detailed({catalog,semantic})
    assert.equal(selectionResult.trace.outcome,'SELECTED',JSON.stringify(selectionResult.trace))
    const selection=selectionResult.selection
    assert(selection.heroId&&selection.supportIds.length<2,'HERO_MUST_NOT_REQUIRE_TWO_SUPPORTS')
    assert(selection.backgroundId,'HERO_METADATA_MUST_SELECT_COMPATIBLE_BACKGROUND_WITHOUT_PAPER_IN_SCRIPT')
    assert(selection.accentId,'HERO_OR_BACKGROUND_METADATA_MUST_SELECT_COMPATIBLE_ACCENT')
    assert.equal(selection.rearId,undefined,'INCOMPATIBLE_REAR_MUST_BE_OMITTED')
    assert(selectionResult.trace.layerDecisions?.some(item=>item.role==='rear-collage'&&
      item.reason==='NO_COMPATIBLE_REAR'),'REAR_OMISSION_MUST_HAVE_EXPLICIT_REASON')
    assert(!catalogRoot.includes(selection.heroId),'NO_PHYSICAL_PATH_AS_ASSET_ID')
    const active=JSON.parse(fs.readFileSync(path.join(catalogRoot,'extension-v2','active.json'),'utf8'))
    const activeIds=new Set(active.batches.flatMap(batch=>JSON.parse(fs.readFileSync(
      path.join(catalogRoot,'extension-v2','batches',batch.id,'manifest.json'),'utf8')).entries.map(item=>item.assetId)))
    assert(activeIds.has(selection.heroId),'SCRIPT_DID_NOT_FIX_AN_ASSET_ID_BUT_MUST_REACH_ACTIVE_EXTENSION')
    const missingSemantic=b.createLocalSceneSemanticV1({sceneId:'v4-literal-recovery',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'Un cromatógrafo líquido analiza una muestra.'}],
      anchor:'líquido',concepts:[{label:'muestra',scope:'scene'}]})
    const recovered=b.selectEditorialLocalBankV4Detailed({catalog,semantic:missingSemantic})
    assert.equal(recovered.selection?.heroId,selection.heroId,'LITERAL_TRANSCRIPT_HERO_RECOVERY')
    assert(recovered.trace.literalTerms?.length,'LITERAL_EVIDENCE_RECORDED')
    const semanticMotor=b.createLocalSceneSemanticV1({sceneId:'v4-semantic-before-literal',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'Un mecánico escucha un motor y documenta qué pieza vibra.'}],
      anchor:'mecánico',concepts:[{label:'mecánico',scope:'scene'},
        {label:'motor',scope:'scene'},{label:'registro',scope:'scene'}]})
    const motorDecision=b.selectEditorialLocalBankV4Detailed({catalog,semantic:semanticMotor})
    assert.equal(catalog.getById(motorDecision.selection.heroId).primaryWordEs,'Motor',
      'LITERAL_RECOVERY_MUST_NOT_BEAT_VALIDATED_SCENE_CONCEPT')
    assert.equal(motorDecision.trace.heroSelectionMechanism,'semantic-concept')
    const abstractSemantic=b.createLocalSceneSemanticV1({sceneId:'v4-abstract',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'Ninguna certeza basta para responder.'}],
      anchor:'certeza',concepts:[{label:'certeza',scope:'scene'}]})
    const abstract=b.selectEditorialLocalBankV4Detailed({catalog,semantic:abstractSemantic})
    assert.equal(abstract.trace.outcome,'NO_HERO','ABSTRACT_MUST_NOT_INVENT_ASSET')
    const unmatchedLayerSemantic=b.createLocalSceneSemanticV1({sceneId:'v4-unmatched-accent',start:0,end:4,
      transcriptSegments:[{start:0,end:4,text:'Una científica observa el agua del río y revisa los datos.'}],
      anchor:'científica',concepts:[{label:'agua',scope:'scene'},{label:'datos',scope:'scene'}]})
    const unmatchedLayer=b.selectEditorialLocalBankV4Detailed({catalog,semantic:unmatchedLayerSemantic})
    assert(unmatchedLayer.selection?.heroId,'MATCHED_HERO_MUST_SURVIVE_MISSING_ACCENT')
    if(unmatchedLayer.trace.layerDecisions?.some(item=>item.reason==='NO_COMPATIBLE_ACCENT'))
      assert.equal(unmatchedLayer.selection.accentId,undefined,'INCOMPATIBLE_ACCENT_MUST_BE_OMITTED')
    const context=b.createModernVisualGenerationContextV2({sceneId:semantic.sceneId,duration:3,
      localSemantic:semantic,keywordCandidates:[{keyword:'cromatógrafo',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',
        camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:51721},videoStyleId:'cream-editorial'})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const ids=[selection.heroId,...selection.supportIds,selection.rearId,selection.accentId,selection.backgroundId].filter(Boolean)
    const imported=Object.fromEntries([...new Set(ids)].map(id=>[id,catalog.publish(projectRoot,id)]))
    const bind=(color='#A83B19',colorMode='auto',semanticRelation,localText=semantic.localText,template=base)=>b.bindEditorialLocalBankV2({template,catalog,imported,selection,color,
      contract:b.EDITORIAL_LOCAL_BANK_V4,
      semanticRelation,
      sceneDecision:{sceneId:semantic.sceneId,localText,anchor:semantic.anchor??'',
        evidence:semantic.directEvidence.map(item=>item.query),durationSeconds:3,
        selectionReason:selection.reason,familyReason:selection.reason,missingTerms:selection.missingTerms,
        colorMode,seed:51721},
      headline:{connector:'El',keyword:'CROMATÓGRAFO',closing:'analiza una muestra.'}})
    const built=bind(),replayed=bind(),recolored=bind('#238C87','manual')
    const noClosingTimingTemplate=structuredClone(base)
    delete noClosingTimingTemplate.sceneSpec.text.closing
    delete noClosingTimingTemplate.sceneSpec.text.timing.closingStart
    const restoredClosing=bind('#A83B19','auto',undefined,semantic.localText,noClosingTimingTemplate)
    assert.equal(restoredClosing.sceneSpec.text.closing,'analiza una muestra.')
    assert(restoredClosing.sceneSpec.text.timing.closingStart>=
      restoredClosing.sceneSpec.text.timing.keywordStart,'V4_CLOSING_REQUIRES_PERSISTED_BEAT')
    assert.deepEqual(built.sceneSpec.editorialBankV2.relations,[],
      'REJECTED_OR_MISSING_SEMANTIC_RELATION_MUST_NOT_DRAW_GENERIC_CONNECTS')
    assert.deepEqual(built.sceneSpec.editorialBankV2.relationDecision,
      {status:'omitted',reason:selection.supportIds.length?'NO_VALID_RELATION':'NO_SUPPORTS'})
    const invalid=bind('#A83B19','auto','observa')
    assert.deepEqual(invalid.sceneSpec.editorialBankV2.relations,[])
    assert.equal(invalid.sceneSpec.editorialBankV2.relationDecision.reason,
      selection.supportIds.length?'UNSUPPORTED_RELATION':'NO_SUPPORTS')
    const unsupportedScript=bind('#A83B19','auto','conecta')
    assert.equal(unsupportedScript.sceneSpec.editorialBankV2.relationDecision.reason,
      selection.supportIds.length?'NO_SCRIPT_EVIDENCE':'NO_SUPPORTS')
    assert(unmatchedLayer.selection?.supportIds.length>0,'VALID_RELATION_NEEDS_REAL_SUPPORT')
    const relationSemantic=b.createLocalSceneSemanticV1({sceneId:'v4-valid-connection',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text:'Una científica conecta los datos con el agua del río.'}],
      anchor:'agua',concepts:[{label:'agua',scope:'scene'},{label:'datos',scope:'scene'}]})
    const related=b.selectEditorialLocalBankV4Detailed({catalog,semantic:relationSemantic}).selection
    assert(related?.supportIds.length>0,'VALID_RELATION_CATALOG_SUPPORT_MISSING')
    const relationContext=b.createModernVisualGenerationContextV2({sceneId:relationSemantic.sceneId,duration:3,
      localSemantic:relationSemantic,keywordCandidates:[],preferredVisualMode:'editorial-text',
      sistema:'editorial',direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',
        densidad:'media',ritmo:'simultaneo',semilla:51722},videoStyleId:'cream-editorial'})
    const relationBase=(await b.resolveModernVisualGenerationBatchV2({contexts:[relationContext],projectRoot}))[0].resolved.compiled
    const relationIds=[related.heroId,...related.supportIds,related.rearId,related.accentId,
      related.frontId,related.backgroundId].filter(Boolean)
    const relationImported=Object.fromEntries([...new Set(relationIds)].map(id=>[id,catalog.publish(projectRoot,id)]))
    const relationInput={template:relationBase,catalog,imported:relationImported,
      selection:related,color:'#A83B19',contract:b.EDITORIAL_LOCAL_BANK_V4,
      sceneDecision:{sceneId:relationSemantic.sceneId,
        localText:relationSemantic.localText,anchor:relationSemantic.anchor??'',evidence:[],
        durationSeconds:3,selectionReason:related.reason,familyReason:related.reason,
        missingTerms:related.missingTerms,colorMode:'auto',seed:51722},
      headline:{connector:'Una',keyword:'CIENTÍFICA',closing:'conecta datos y agua.'}}
    const valid=b.bindEditorialLocalBankV2({...relationInput,semanticRelation:'conecta'})
    const withoutRelation=b.bindEditorialLocalBankV2(relationInput)
    const rejected=b.bindEditorialLocalBankV2({...relationInput,semanticRelation:'observa'})
    assert.deepEqual(rejected.sceneSpec.editorialBankV2.relations,[])
    assert.equal(rejected.sceneSpec.editorialBankV2.relationDecision.reason,'UNSUPPORTED_RELATION')
    assert.deepEqual(withoutRelation.sceneSpec.editorialBankV2.relations,[])
    assert.deepEqual(withoutRelation.sceneSpec.editorialBankV2.relationDecision,
      {status:'omitted',reason:'NO_VALID_RELATION'})
    assert.notEqual(valid.pixelIdentity,withoutRelation.pixelIdentity,
      'VISIBLE_RELATION_MUST_CHANGE_PIXEL_IDENTITY')
    assert.equal(valid.sceneSpec.editorialBankV2.relationDecision.reason,'SCRIPT_CONNECTS')
    assert(valid.sceneSpec.editorialBankV2.relations.length>0,'VALID_RELATION_MUST_DRAW')
    const within=(v,r)=>v>r.x&&v<r.x+r.width
    for(const relation of valid.sceneSpec.editorialBankV2.relations){
      assert.equal(relation.meaning,'connects')
      for(const [orientation,layout] of [['portrait',valid.sceneSpec.editorialBankV2.portraitLayout],
        ['landscape',valid.sceneSpec.editorialBankV2.landscapeLayout]]){
        const route=relation[orientation]
        assert(route.points.length>=2,'RELATION_ROUTE_MISSING:'+orientation)
        const text=layout.textBounds
        const sampled=route.points.flatMap((point,index)=>{
          const next=route.points[index+1]
          if(!next)return [point]
          const steps=Math.max(1,Math.ceil(Math.hypot(next.x-point.x,next.y-point.y)*2))
          return Array.from({length:steps+1},(_,step)=>({x:point.x+(next.x-point.x)*step/steps,
            y:point.y+(next.y-point.y)*step/steps}))
        })
        for(const point of sampled){
          assert(point.x>=2&&point.x<=98&&point.y>=2&&point.y<=98,'RELATION_OUT_OF_CANVAS')
          assert(!(within(point.x,text)&&within(point.y,{x:text.y,width:text.height})),
            'RELATION_CROSSES_TEXT:'+orientation)
        }
        const hero=layout.slotLayouts.find(slot=>slot.slotId==='hero').envelope
        // The catalogue has no per-asset face mask. This central core is a
        // conservative layout proxy, not a claim of semantic focal detection.
        const inner={x:hero.x+hero.width*.35,y:hero.y+hero.height*.35,
          width:hero.width*.3,height:hero.height*.3}
        for(const point of sampled)assert(!(within(point.x,inner)&&
          within(point.y,{x:inner.y,width:inner.height})),
          'RELATION_CROSSES_HERO_INNER_REGION:'+orientation)
      }
    }
    const forged=structuredClone(valid.sceneSpec)
    forged.editorialBankV2.relationDecision={status:'omitted',reason:'NO_VALID_RELATION'}
    assert.throws(()=>b.validateVisualSceneSpecV2(forged),/EDITORIAL_LOCAL_V4_RELATION_DECISION_INVALID/)
    const relationEvidence=path.resolve(root,'../_cipher-editorial-product-route-v1/evidence/relation-integrity')
    fs.mkdirSync(relationEvidence,{recursive:true})
    for(const [name,rendered] of [['valid',valid],['omitted',withoutRelation]]){
      fs.writeFileSync(path.join(relationEvidence,`${name}-scene-spec.json`),
        JSON.stringify(rendered.sceneSpec,null,2)+'\n')
      b.prepareGraphicForVisualRender({graphicData:rendered.graphicData,projectRoot,
        renderBindings:rendered.renderBindings})
      for(const orientation of ['portrait','landscape']){
        const clip=await b.renderGraphicClip(rendered.graphicData,{ancho:orientation==='portrait'?720:1280,
          alto:orientation==='portrait'?1280:720,fps:24,duracion:3,modo:'pantalla',sistema:'editorial',
          projectRoot,renderBindings:rendered.renderBindings})
        assert(clip&&fs.existsSync(clip),'RELATION_AB_VISUAL_SIN_FICHERO:'+name+':'+orientation)
        fs.copyFileSync(clip,path.join(relationEvidence,`${orientation}-${name}.mp4`))
      }
    }
    assert.equal(built.pixelIdentity,replayed.pixelIdentity)
    assert.notEqual(built.pixelIdentity,recolored.pixelIdentity,'VISIBLE_COLOR_MUST_CHANGE_IDENTITY')
    assert.equal(built.sceneSpec.presentationProfile.revision,b.EDITORIAL_LOCAL_BANK_V4.revision)
    assert.equal(built.sceneSpec.editorialBankV2.supportLabelSize,'mobile-readable-v1')
    const priorV4Spec=structuredClone(built.sceneSpec)
    delete priorV4Spec.editorialBankV2.supportLabelSize
    delete priorV4Spec.editorialBankV2.relationDecision
    b.validateVisualSceneSpecV2(priorV4Spec)
    assert.notEqual(b.sceneSpecPixelIdentityAny(priorV4Spec),b.sceneSpecPixelIdentityAny(built.sceneSpec),
      'MOBILE_LABEL_DECISION_MUST_CHANGE_IDENTITY_WITHOUT_REWRITING_OLDER_V4')
    assert(!built.pixelIdentity.includes(catalogRoot)&&!built.pixelIdentity.includes(projectRoot))
    b.validateVisualSceneSpecV2(built.sceneSpec)
    b.validateRenderBindingsAny(built.renderBindings,built.sceneSpec)
    b.prepareGraphicForVisualRender({graphicData:built.graphicData,projectRoot,renderBindings:built.renderBindings})
    const outputs=[]
    for(const orientation of ['portrait','landscape']){
      let qc=null
      const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
        alto:orientation==='portrait'?1280:720,fps:24,duracion:3,modo:'pantalla',sistema:'editorial',
        projectRoot,renderBindings:built.renderBindings,onQcReport:value=>{qc=value},onQcFailure:value=>{qc=value}})
      assert(file&&fs.existsSync(file),'VISUAL_SIN_FICHERO:'+orientation+':'+JSON.stringify(qc))
      outputs.push({orientation,file,qc:qc?.findings??[]})
    }
    assert.equal(networkAttempts,0)
    console.log(JSON.stringify({passed:true,profile:built.sceneSpec.presentationProfile,
      catalogAssets:health.verified,heroId:selection.heroId,supportIds:selection.supportIds,
      family:selection.family,layerDecisions:selectionResult.trace.layerDecisions,
      identitySha256:crypto.createHash('sha256').update(built.pixelIdentity).digest('hex'),
      networkAttempts,outputs}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
