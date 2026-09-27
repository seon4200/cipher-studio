// The real mode probes only decisions. It never represents a UI/render test.
const {app,ipcMain}=require('electron'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('editorial-decision-coherence')
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
  const quantified={...semantic,localText:'266 millones de personas sufren hambre',globalText:''}
  check('quantity survives paraphrase',()=>assert.throws(()=>b.validateEditorialMeaningV2({...meaning,
    sourceQuote:quantified.localText,framing:'assertion',headline:'Millones sufren hambre'},quantified,3),/QUANTITY_LOST/))
  const candidates=b.retrieveEditorialCandidates(catalog,semantic)
  const direction={revision,intent:'statement',family:'editorial',variant:'base',entry:'word-first',background:'ivory-clean',relations:[],reason:'Afirmación crítica.'}
  const choice={mode:'typographic',heroId:null,supportIds:[],evidence:[],reason:'Texto deliberado, no hueco supuesto.',rejected:[],
    omission:'deliberate-typography',direction,additionalTerms:[]}
  check('explicit typography has no fake edges',()=>assert.equal(b.validateEditorialSceneChoiceV2(choice,meaning,candidates,semantic).direction.relations.length,0))
  check('unknown Hero rejected',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({...choice,mode:'asset',heroId:'unoffered',omission:null},meaning,candidates,semantic),/NOT_OFFERED/))
  check('unsupported relation rejected',()=>assert.throws(()=>b.validateEditorialSceneChoiceV2({...choice,
    direction:{...direction,relations:[{fromId:'x',toId:'y',relation:'observa',quote:meaning.sourceQuote,reason:'Does not authorize generic connects.'}]}},meaning,candidates,semantic)))
  const relationText='El cromatógrafo líquido registra datos de la muestra.'
  const relationSemantic={...semantic,localText:relationText,globalText:relationText,
    concepts:[{label:'cromatógrafo líquido',scope:'scene'},{label:'datos',scope:'scene'}]}
  const offered=b.retrieveEditorialCandidates(catalog,relationSemantic)
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
  const report={checks,health,bundleSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist-electron/main/index.js'))).digest('hex')}
  fs.writeFileSync(path.join(evidence,'contracts.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify({checks:checks.length,health}))
  if(process.argv.includes('--real')){
    if(!process.env.DEEPSEEK_API_KEY)throw Error('DEEPSEEK_KEY_UNAVAILABLE')
    const cases=JSON.parse(fs.readFileSync(process.env.CIPHER_DECISION_CASES,'utf8'))
    const results=[]
    for(const item of cases){
      assert(Number.isFinite(item.duration)&&item.duration>0,'REAL_CASE_DURATION_INVALID:'+item.id)
      assert(Math.abs(item.duration-(item.semantic.end-item.semantic.start))<.001,'REAL_CASE_INTERVAL_MISMATCH:'+item.id)
      const result=await b.decideEditorialScene({catalog,semantic:item.semantic,duration:item.duration,
        orientation:item.orientation??'9:16',apiKey:process.env.DEEPSEEK_API_KEY})
      results.push({...item,...result});fs.writeFileSync(path.join(evidence,'real-decisions.json'),JSON.stringify(results,null,2))
      console.log(JSON.stringify({id:item.id,title:result.meaning?.headline,hero:result.decision?.heroId,
        supports:result.decision?.supportIds.length,family:result.decision?.direction?.family,errors:result.attempts.map(a=>a.error??null),metrics:result.metrics}))
    }
  }
  code=0
}catch(error){console.error(error.stack);fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'failure.txt'),error.stack)}finally{app.exit(code)}})
