// The real mode probes only decisions. It never represents a UI/render test.
const {app,ipcMain}=require('electron'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('editorial-decision-coherence')
// These contract tests do not render. Disable hardware acceleration before
// Electron readiness so a headless GPU-process failure cannot truncate them.
app.disableHardwareAcceleration()
const evidence=process.env.CIPHER_DECISION_EVIDENCE
if(!evidence)throw Error('CIPHER_DECISION_EVIDENCE_REQUIRED')
app.setPath('userData',path.join(fixture,'userData'));process.chdir(fixture)
const handle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(channel,fn)=>handle(channel,channel==='get-elevenlabs-voices'?async()=>({success:true,voices:[]}):fn)
app.on('browser-window-created',(_,window)=>{window.hide();window.on('ready-to-show',()=>window.hide())})
app.whenReady().then(async()=>{let code=1;const checks=[];try{
  const b=require(path.join(root,'dist-electron/main/index.js'));app.removeAllListeners('window-all-closed')
  fs.mkdirSync(evidence,{recursive:true})
  const catalog=new b.CuratedModularCatalogV2(process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH)
  const health=catalog.verifyAll();assert.equal(health.failures.length,0)
  const check=(name,fn)=>{fn();checks.push(name)}
  const revision='editorial-scene-decision-2026-09-v2'
  const semantic=b.createLocalSceneSemanticV1({sceneId:'critique',start:2,end:5,
    transcriptSegments:[{start:2,end:5,text:'el potencial es suficiente'}],
    globalText:'El error es creer que el potencial es suficiente para progresar.',globalContextRef:'fixture:clause'})
  semantic.neighborBefore='El error es creer que'
  semantic.neighborAfter='para progresar.'
  const meaning={sourceQuote:'El error es creer que el potencial es suficiente',proposition:'Creer que el potencial basta es un error.',
    headline:'El potencial no basta',secondary:'',framing:'critique',concepts:['potencial','progreso'],intent:'statement',reason:'Preserva la crítica.'}
  check('faithful paraphrase retains questioned assertion',()=>assert.equal(b.validateEditorialMeaningV2(meaning,semantic,3).headline,meaning.headline))
  check('literal substring is not necessarily faithful',()=>assert.throws(()=>b.validateEditorialMeaningV2({...meaning,
    headline:'El potencial es suficiente',framing:'assertion'},semantic,3),/SCOPE_LOST/))
  check('metadata critique cannot hide affirmative visible text',()=>assert.throws(()=>b.validateEditorialMeaningV2({...meaning,
    headline:'El potencial es suficiente'},semantic,3),/SCOPE_LOST/))
  check('affirmative paraphrase cannot masquerade as critique',()=>assert.throws(()=>b.validateEditorialMeaningV2({...meaning,
    headline:'El potencial basta'},semantic,3),/SCOPE_LOST/))
  check('neighbor assertion cannot replace timed proposition',()=>assert.throws(()=>b.validateEditorialMeaningV2({...meaning,
    sourceQuote:'La lluvia interrumpe los vuelos.'},{...semantic,globalText:semantic.globalText+' La lluvia interrumpe los vuelos.'},3),/WRONG_INTERVAL/))
  const critiqueInterval='Su problema es querer que con el potencial es suficiente, como tú, que te la pasas planeando, aprendiendo, estudiando,'
  const critiqueScope=b.createLocalSceneSemanticV1({sceneId:'saved-critique-potential',start:19.16,end:24.54,
    transcriptSegments:[{start:19.16,end:24.54,text:critiqueInterval}],
    globalText:critiqueInterval+' Te lo dices aquí misma para poder sentirte cómoda con la persona que podrías llegar a ser.'})
  critiqueScope.neighborAfter='Te lo dices aquí misma para poder sentirte cómoda con la persona que podrías llegar a ser.'
  const clarifiedReferent={...meaning,sourceQuote:critiqueInterval,
    proposition:'La persona a la que habla cree que el potencial basta y se queda planeando, aprendiendo y estudiando.',
    headline:'El problema de creer que basta',secondary:'',framing:'critique',intent:'statement'}
  check('generic subject clarification does not falsely import the next assertion',()=>assert.equal(
    b.validateEditorialMeaningV2(clarifiedReferent,critiqueScope,5.38,{phase1:true}).headline,
    clarifiedReferent.headline))
  const incompleteCut='cómoda con la persona que podrías llegar a ser. Pero lo que tú y'
  const cutScope=b.createLocalSceneSemanticV1({sceneId:'saved-cut-29-31',start:29,end:31.49,
    transcriptSegments:[{start:29,end:31.49,text:incompleteCut}],
    globalText:incompleteCut+' Mejumi entienden que el mundo se basa en la acción.'})
  cutScope.neighborAfter='Mejumi entienden que el mundo se basa en la acción.'
  check('future predicate cluster cannot complete a cut adversative from the next phrase',()=>assert.throws(()=>
    b.validateEditorialMeaningV2({...meaning,sourceQuote:incompleteCut,
      proposition:'La persona se siente cómoda con quien podría ser, pero ella y otros entienden que el mundo se basa en actuar.',
      headline:'Cómoda con quien podría ser',framing:'critique',intent:'statement'},cutScope,3,{phase1:true}),
    /FUTURE_CLAIM_NOT_IN_INTERVAL/))
  check('unspoken contrast is rejected while critique itself can remain',()=>assert.throws(()=>
    b.validateEditorialMeaningV2({...meaning,sourceQuote:meaning.sourceQuote,
      proposition:'Es un error creer que el potencial basta en lugar de actuar.',
      headline:'El error de creer que el potencial basta',framing:'critique'},semantic,4),
    /UNSUPPORTED_CONTRAST/))
  const correctionQuote='La mayor portaleza de yuyuy no es el potencial que tiene, que es llevarse al límite una y otra vez con lo que ya es.'
  const correctionSemantic=b.createLocalSceneSemanticV1({sceneId:'negation-correction',start:0,end:8,
    transcriptSegments:[{start:0,end:8,text:correctionQuote}],globalText:correctionQuote})
  check('paraphrase may express an explicitly grounded negative correction with sino',()=>assert.equal(
    b.validateEditorialMeaningV2({...meaning,sourceQuote:correctionQuote,
      proposition:'La fortaleza no es el potencial, sino llevarse al límite.',
      headline:'No es potencial: es llevarse al límite',secondary:'',framing:'negation',intent:'statement'},
      correctionSemantic,8).headline,'No es potencial: es llevarse al límite'))
  check('repair prompt explains the failed temporal-scope rule',()=>assert.match(
    b.editorialMeaningPromptV2(cutScope,3,'EDITORIAL_FUTURE_CLAIM_NOT_IN_INTERVAL'),
    /contexto posterior NO puede aportar predicados/u))
  const quantified={...semantic,localText:'266 millones de personas sufren hambre',globalText:''}
  check('quantity survives paraphrase',()=>assert.throws(()=>b.validateEditorialMeaningV2({...meaning,
    sourceQuote:quantified.localText,framing:'assertion',headline:'Millones sufren hambre'},quantified,3),/QUANTITY_LOST/))
  const candidates=b.retrieveEditorialCandidates(catalog,semantic)
  const candidatePrompt=b.editorialSceneChoicePromptV2(meaning,candidates,
    b.retrieveEditorialLayerCandidates(catalog,semantic,'9:16',candidates),'9:16',3,[],
    b.editorialCandidateCoverageV1(catalog,semantic))
  check('model receives only canonical IDs and compact matched coverage',()=>{
    assert(candidatePrompt.includes('Lista cerrada de IDs permitidos por rol'))
    assert(candidatePrompt.includes(`"assetId":"${candidates[0].assetId}"`))
    assert(!candidatePrompt.includes('"code":'))
    const coverage=b.editorialCandidateCoverageV1(catalog,semantic)
    assert(coverage.length<=10&&coverage.every(item=>item.matchedTerms>0))
  })
  const direction={revision,intent:'statement',family:'editorial',variant:'base',entry:'word-first',background:'ivory-clean',relations:[],reason:'Afirmación crítica.'}
  const choice={mode:'typographic',heroId:null,supportIds:[],evidence:[],reason:'Texto deliberado, no hueco supuesto.',rejected:[],
    omission:'deliberate-typography',direction,additionalTerms:[],layerChoices:{
      'rear-collage':{assetId:null,reason:'No aporta a una escena tipográfica.'},
      'accent-mask':{assetId:null,reason:'No hay Hero que acompañar.'},
      background:{assetId:null,reason:'Se conserva el fondo editorial base.'}}}
  check('explicit typography has no fake edges',()=>assert.equal(b.validateEditorialSceneChoiceV2(choice,meaning,candidates,semantic).direction.relations.length,0))
  check('unknown Hero rejected',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({...choice,mode:'asset',heroId:'unoffered',omission:null},meaning,candidates,semantic),/NOT_OFFERED/))
  check('unsupported relation rejected',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({...choice,
    direction:{...direction,relations:[{fromId:'x',toId:'y',relation:'observa',quote:meaning.sourceQuote,reason:'Does not authorize generic connects.'}]}},meaning,candidates,semantic)))
  const relationText='El cromatógrafo líquido registra datos de la muestra.'
  const relationSemantic={...semantic,localText:relationText,globalText:relationText,
    concepts:[{label:'cromatógrafo líquido',scope:'scene'},{label:'datos',scope:'scene'}]}
  const offered=b.retrieveEditorialCandidates(catalog,relationSemantic)
  const layerOffered=b.retrieveEditorialLayerCandidates(catalog,relationSemantic,'16:9')
  const chemistrySemantic=b.createLocalSceneSemanticV1({sceneId:'chemistry-layer-recall',start:0,end:3,
    transcriptSegments:[{start:0,end:3,text:'El cromatógrafo líquido analiza una muestra.'}],
    concepts:[{label:'cromatógrafo líquido',scope:'scene'},{label:'muestra',scope:'scene'}],
    globalText:'El cromatógrafo líquido analiza una muestra.'})
  const chemistryCandidates=b.retrieveEditorialCandidates(catalog,chemistrySemantic)
  const chemistryLayers=b.retrieveEditorialLayerCandidates(catalog,chemistrySemantic,'16:9',chemistryCandidates)
  check('layer shortlist is bounded and role-safe',()=>{
    assert(layerOffered.length<=12)
    assert(layerOffered.every(c=>c.role==='rear-collage'?c.surfaceProfile==='continuous-filled-v1':
      c.role==='accent-mask'?c.surfaceProfile==='continuous-filled-v1'&&c.surfaceUse==='hero-backing-accent-v1':
      c.role==='background'&&c.compatibleRelations.includes('neutral-background')&&
        c.compatibleRelations.includes('editorial-reading')))
  })
  check('selected chemistry candidate retrieves its explicitly related rear layer',()=>{
    assert(!chemistryCandidates.some(item=>item.assetId==='editorial-hero-acordeon-cromatico-001'),
      'A shared five-letter prefix is not evidence that chromatic and chromatographic mean the same thing.')
    assert(chemistryLayers.some(item=>item.role==='rear-collage'&&
      item.assetId==='editorial-paper-registro-analisis-quimico-001'&&
      item.retrievalEvidence.includes('selected-candidate-affinity')&&
      item.compatibleParticipantIds.includes('editorial-hero-cromatografo-liquido-001')),
      'A metadata-compatible layer must be recoverable through the chosen candidate, not a fixture word.')
    const soil=chemistryLayers.find(item=>item.assetId==='editorial-paper-muestreo-suelo-001')
    assert(soil&&!soil.compatibleParticipantIds.includes('editorial-hero-cromatografo-liquido-001'),
      'The soil paper may be considered only through a soil participant; the generic word does not pair it with chromatography.')
  })
  check('generic rear requires the exact neutral family and certified fill',()=>{
    assert.equal(b.editorialGenericRearV1({role:'rear-collage',semanticFamily:'editorial-collage',
      compatibleRelations:['editorial-collage'],surfaceProfile:'continuous-filled-v1'}),true)
    assert.equal(b.editorialGenericRearV1({role:'rear-collage',semanticFamily:'soil-field-paper',
      compatibleRelations:['editorial-collage'],surfaceProfile:'continuous-filled-v1'}),false)
    assert.equal(b.editorialGenericRearV1({role:'rear-collage',semanticFamily:'editorial-collage',
      surfaceProfile:undefined}),false)
  })
  check('layer affinity rejects single broad overlap and accepts explicit technical phrase',()=>{
    assert.equal(b.editorialMetadataAffinityV1({semanticFamily:'soil-field-paper',
      compatibleRelations:['soil-science']},{semanticFamily:'chemical-separation',
      compatibleRelations:['sample-purification']}),false)
    assert.equal(b.editorialMetadataAffinityV1({semanticFamily:'chemical-analysis-paper'},
      {semanticFamily:'chemical-separation',compatibleRelations:['chemical-analysis']}),true)
    assert.equal(b.editorialMetadataAffinityV1({role:'rear-collage',semanticFamily:'soil-field-paper',
      compatibleRelations:['editorial-collage']},{semanticFamily:'music-theory'}),false)
    assert.equal(b.editorialLayerConceptAffinityV1({compatibleRelations:['soil-science']},['muestra']),false)
    assert.equal(b.editorialLayerConceptAffinityV1({compatibleRelations:['chromatography']},['chromatography']),true)
  })
  check('expanded retrieval retains core and adds rather than replaces candidates',()=>{
    const initial=b.retrieveEditorialCandidates(catalog,relationSemantic)
    const expansion=b.retrieveEditorialCandidates(catalog,relationSemantic,['motor eléctrico','experiencia'])
    const union=b.mergeEditorialCandidateSets(initial,expansion)
    const ids=new Set(union.map(item=>item.assetId))
    assert([...initial].every(item=>ids.has(item.assetId)))
    assert(union.length<=48)
    assert(expansion.every(item=>['hero-core','support'].includes(item.role)))
  })
  check('expanded layer retrieval retains prior role candidates and stays bounded',()=>{
    const initial=b.retrieveEditorialLayerCandidates(catalog,chemistrySemantic,'16:9',chemistryCandidates)
    const expandedSemantic={...chemistrySemantic,concepts:[...chemistrySemantic.concepts,
      {label:'laboratory notes',scope:'scene'}]}
    const expanded=b.retrieveEditorialLayerCandidates(catalog,expandedSemantic,'16:9',chemistryCandidates)
    const merged=b.mergeEditorialLayerCandidateSets(initial,expanded)
    assert([...initial].every(item=>merged.some(candidate=>candidate.assetId===item.assetId)))
    assert(merged.length<=30)
    assert(merged.filter(item=>item.role==='rear-collage').length<=10)
  })
  const hero=offered.find(c=>c.role==='hero-core'&&c.primaryWordEs.toLowerCase()==='cromatógrafo líquido')
  const support=offered.find(c=>c.role==='support'&&c.primaryWordEs.toLowerCase()==='datos')
  assert(hero&&support,'CONTRACT_FIXTURE_CANDIDATES_MISSING')
  const relationMeaning={...meaning,sourceQuote:relationText,framing:'assertion',intent:'relation'}
  const assetChoice={...choice,mode:'asset',heroId:hero.assetId,supportIds:[support.assetId],omission:null,
    evidence:[hero,support].map(c=>({assetId:c.assetId,quote:relationText,reason:'Directed contract fixture.'})),
    direction:{...direction,intent:'relation',family:'marcoPoster',entry:'hero-first',relations:[{
      fromId:hero.assetId,toId:support.assetId,relation:'informa',quote:relationText,reason:'Instrument records data.'}]}}
  check('one support and explicit information edge accepted',()=>assert.equal(
    b.validateEditorialSceneChoiceV2(assetChoice,relationMeaning,offered,relationSemantic).supportIds.length,1))
  const duplicateConceptCandidates=offered.map(candidate=>candidate.assetId===support.assetId
    ?{...candidate,primaryWordEs:hero.primaryWordEs}:candidate)
  check('duplicate catalogue word alone does not reject an otherwise valid composition',()=>assert.equal(
    b.validateEditorialSceneChoiceV2(assetChoice,relationMeaning,duplicateConceptCandidates,relationSemantic).supportIds.length,1))
  const distinctGroundedSupport={...support,assetId:'test-support-personas',primaryWordEs:'Personas',
    retrievalEvidence:['concept:personas']}
  const duplicateMeaning={...relationMeaning,concepts:['personas']}
  const duplicateChoice={...assetChoice,direction:{...assetChoice.direction,relations:[]}}
  const distinctChoice={...assetChoice,supportIds:[distinctGroundedSupport.assetId],
    evidence:[{assetId:hero.assetId,quote:relationText,reason:'Central subject.'},
      {assetId:distinctGroundedSupport.assetId,quote:relationText,reason:'Distinct narrated participant.'}],
    direction:{...assetChoice.direction,relations:[]}}
  const groundedSlate=[...duplicateConceptCandidates,distinctGroundedSupport]
  check('redundant participant triggers repair only when a distinct directly grounded candidate is offered',()=>assert.throws(()=>
    b.validateEditorialSceneChoiceV2(duplicateChoice,duplicateMeaning,groundedSlate,relationSemantic),
    /REDUNDANT_SUPPORT_WITH_GROUNDED_ALTERNATIVE/))
  const rescued=b.validateEditorialSceneChoiceWithAlternativeV1({...duplicateChoice,alternative:distinctChoice},
    duplicateMeaning,groundedSlate,relationSemantic)
  check('complete valid alternative rescues one rejected primary without relaxing IDs or relation rules',()=>{
    assert.equal(rescued.heroId,hero.assetId)
    assert.deepEqual(rescued.supportIds,[distinctGroundedSupport.assetId])
    assert.equal(rescued.choiceAudit.selected,'alternative')
    assert.match(rescued.choiceAudit.primaryRejection,/REDUNDANT_SUPPORT_WITH_GROUNDED_ALTERNATIVE/)
  })
  const primaryWins=b.validateEditorialSceneChoiceWithAlternativeV1({...assetChoice,alternative:{...distinctChoice,
    heroId:'not-offered'}},relationMeaning,offered,relationSemantic)
  check('invalid optional alternative does not invalidate a sound primary',()=>{
    assert.equal(primaryWins.heroId,hero.assetId)
    assert.equal(primaryWins.choiceAudit.selected,'primary')
    assert.equal(primaryWins.choiceAudit.alternativeStatus,'invalid')
    assert.match(primaryWins.choiceAudit.alternativeRejection,/NOT_OFFERED/)
  })
  check('unoffered layer IDs are rejected',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({...assetChoice,
    layerChoices:{...choice.layerChoices,'rear-collage':{assetId:'invented-paper',reason:'Seems relevant.'}}},
    relationMeaning,offered,relationSemantic,layerOffered),/LAYER_NOT_OFFERED/))
  const chemistryHero=chemistryCandidates.find(c=>c.role==='hero-core'&&c.assetId==='editorial-hero-cromatografo-liquido-001')
  const soilPaper=catalog.selectionMetadata('editorial-paper-muestreo-suelo-001')
  if(chemistryHero&&soilPaper)check('selected rear is revalidated against chosen Hero metadata',()=>{
    const selected={...choice,mode:'asset',heroId:chemistryHero.assetId,omission:null,
      evidence:[{assetId:chemistryHero.assetId,quote:chemistryHero.primaryWordEs,
        reason:'Directed structural fixture for an offered candidate.'}]}
    const injected=[...chemistryLayers,{...soilPaper,retrievalScore:0,retrievalEvidence:['test-only-injected']}]
    assert.throws(()=>b.validateEditorialSceneChoiceV2({...selected,layerChoices:{...choice.layerChoices,
      'rear-collage':{assetId:soilPaper.assetId,reason:'Only shares the word sample.'}}},
      {...meaning,sourceQuote:'El cromatógrafo líquido analiza una muestra.',concepts:['cromatógrafo líquido','muestra']},
      chemistryCandidates,{...chemistrySemantic,localText:'El cromatógrafo líquido analiza una muestra.'},injected),
      /LAYER_AFFINITY_INVALID:rear-collage/)
  })
  const safeBackground=layerOffered.find(item=>item.role==='background')
  if(safeBackground)check('selected neutral background persists as a role-bound layer decision',()=>{
    const decided=b.validateEditorialSceneChoiceV2({...assetChoice,layerChoices:{...choice.layerChoices,
      background:{assetId:safeBackground.assetId,reason:'Neutral editorial reading surface; aspect fits.'}}},
      relationMeaning,offered,relationSemantic,layerOffered)
    assert.equal(decided.layerChoices.background.assetId,safeBackground.assetId)
  })
  check('observa rejected with otherwise valid endpoints',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({
    ...assetChoice,direction:{...assetChoice.direction,relations:[{...assetChoice.direction.relations[0],relation:'observa'}]}},
    relationMeaning,offered,relationSemantic),/RELATION_INVALID/))
  check('valid enum cannot invent causation from measurement',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({
    ...assetChoice,direction:{...assetChoice.direction,relations:[{...assetChoice.direction.relations[0],relation:'causa'}]}},
    relationMeaning,offered,relationSemantic),/EVIDENCE_INSUFFICIENT/))
  check('family cannot force extra supports',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({
    ...assetChoice,direction:{...assetChoice.direction,family:'constelacion'}},relationMeaning,offered,relationSemantic),/NOT_ELIGIBLE/))
  let count=0
  const bounded=await b.decideEditorialScene({catalog,semantic,duration:3,apiKey:'not-a-key',request:async()=>({ok:true,
    json:async()=>({choices:[{message:{content:JSON.stringify(count++===0?meaning:choice)}}]})})})
  check('two bounded stages preserve deliberate omission',()=>{assert.equal(count,2);assert.equal(bounded.decision.heroId,null);assert.equal(bounded.metrics.retries,0)})
  let emptyCalls=0
  const empty=await b.decideEditorialScene({catalog:{entries:()=>[],selectionMetadata:()=>null},semantic,
    duration:3,apiKey:'not-a-key',request:async()=>({ok:true,json:async()=>({choices:[{message:{
      content:JSON.stringify(emptyCalls++===0?meaning:{...choice,omission:'no-suitable-material'})}}]})})})
  check('empty shortlist is not proof of absent catalogue material',()=>assert.equal(empty.fallbackReason,'RETRIEVAL_INSUFFICIENT'))
  let failed=0
  const rejected=await b.decideEditorialScene({catalog,semantic,duration:3,apiKey:'not-a-key',request:async()=>{
    failed++;return {ok:true,json:async()=>({choices:[{message:{content:'{"headline":"fabricated"}'}}]})}}
  })
  check('three bounded meaning attempts retain failure without a literal Hero',()=>{assert.equal(failed,3);assert.equal(rejected.decision,undefined);assert.equal(rejected.fallbackReason,'MEANING_VALIDATION_FAILED')})
  const overlong={...meaning,headline:'El potencial no basta por sí solo para avanzar de verdad',secondary:''}
  let phase1Calls=0
  const staged=await b.decideEditorialScene({catalog,semantic,duration:3,apiKey:'not-a-key',request:async()=>({ok:true,
    json:async()=>({choices:[{message:{content:JSON.stringify([overlong,meaning,choice][phase1Calls++])}}]})})})
  check('overlong title preserves meaning and proceeds to retrieval',()=>{
    assert.equal(phase1Calls,3)
    assert.equal(staged.meaning.proposition,meaning.proposition)
    assert(Array.isArray(staged.candidates))
    assert.equal(staged.decision.omission,'deliberate-typography')
    assert(staged.presentationAdjustments.includes('PRESENTATION_MODEL_REDUCED'))
    assert.deepEqual(staged.attempts.map(a=>a.stage),['meaning','presentation','scene'])
  })
  let unresolvedCalls=0
  const unresolved=await b.decideEditorialScene({catalog,semantic,duration:3,apiKey:'not-a-key',request:async()=>({ok:true,
    json:async()=>({choices:[{message:{content:JSON.stringify([overlong,overlong,overlong,choice][unresolvedCalls++])}}]})})})
  check('failed shortening retains valid meaning, candidates, and scene choice',()=>{
    assert.equal(unresolvedCalls,4)
    assert.equal(unresolved.meaning.headline,overlong.headline)
    assert(unresolved.candidates.length>0)
    assert.equal(unresolved.decision.omission,'deliberate-typography')
    assert(unresolved.presentationAdjustments.includes('PRESENTATION_UNRESOLVED'))
    assert.equal(unresolved.attempts.filter(item=>item.stage==='presentation').length,2)
    assert.match(unresolved.attempts[2].prompt,/titular tenía \d+ palabras y su secondary \d+; total \d+/u)
    assert.match(unresolved.attempts[2].prompt,/puedes dejarlo vacío/u)
  })
  const report={checks,health,bundleSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist-electron/main/index.js'))).digest('hex')}
  fs.writeFileSync(path.join(evidence,'contracts.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify({checks:checks.length,health}))
  if(process.argv.includes('--real')){
    if(!process.env.DEEPSEEK_API_KEY)throw Error('DEEPSEEK_KEY_UNAVAILABLE')
    const cases=JSON.parse(fs.readFileSync(process.env.CIPHER_DECISION_CASES,'utf8'))
    const results=[]
    for(const item of cases){
      const semantic=item.semantic??b.createLocalSceneSemanticV1({sceneId:item.id,start:item.start,end:item.end,
        transcriptSegments:item.transcriptSegments??[{start:item.start,end:item.end,text:item.text}],
        globalText:item.globalText??item.text,globalHints:[],globalContextRef:item.globalContextRef??`case:${item.id}`})
      if(item.text)semantic.localText=item.text
      semantic.neighborBefore=item.neighborBefore??''
      semantic.neighborAfter=item.neighborAfter??''
      const duration=item.duration??semantic.end-semantic.start
      assert(Number.isFinite(duration)&&duration>0,'REAL_CASE_DURATION_INVALID:'+item.id)
      assert(Math.abs(duration-(semantic.end-semantic.start))<.001,'REAL_CASE_INTERVAL_MISMATCH:'+item.id)
      const result=await b.decideEditorialScene({catalog,semantic,duration,
        orientation:item.orientation??'9:16',apiKey:process.env.DEEPSEEK_API_KEY})
      results.push({...item,semantic,...result});fs.writeFileSync(path.join(evidence,'real-decisions.json'),JSON.stringify(results,null,2))
      console.log(JSON.stringify({id:item.id,title:result.meaning?.headline,hero:result.decision?.heroId,
        supports:result.decision?.supportIds.length,family:result.decision?.direction?.family,errors:result.attempts.map(a=>a.error??null),metrics:result.metrics}))
    }
  }
  code=0
}catch(error){console.error(error.stack);fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'failure.txt'),error.stack)}finally{app.exit(code)}})
