const {app}=require('electron')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('editorial-scene-corrections')
app.setPath('userData',path.join(fixture,'userData'));process.chdir(fixture)
const evidence=process.env.CIPHER_DECISION_EVIDENCE||path.resolve(root,'../_cipher-scene-corrections-20260927')
app.whenReady().then(async()=>{let code=1;const checks=[];try{
  const b=require(path.join(root,'dist-electron/main/index.js'))
  app.removeAllListeners('window-all-closed')
  const check=(name,fn)=>{fn();checks.push(name)}
  check('request/sanitizer shares next-start clock',()=>{
    const segments=[{start:0,end:3.9},{start:4.6,end:7}]
    assert.deepEqual(b.editorialPhraseWindow(segments,0,7),{start:0,end:4.6,duration:4.6,count:2})
    assert.deepEqual(b.editorialSlotWindow(0,[2.3,2.3],1),{start:2.3,end:4.6})
  })
  check('headline never promotes first residual token',()=>assert.deepEqual(
    b.editorialHeadlineForScene('de todos los documentos','mujer'),{keyword:'de todos los documentos'}))
  check('quantity and late negation remain intact',()=>{
    assert.equal(b.editorialVisibleExcerptV4('Las pruebas sugieren un resultado preliminar que no confirma la causa.',3,'resultado'),
      'Las pruebas sugieren un resultado preliminar que no confirma la causa')
    assert.match(b.editorialVisibleExcerptV4('En este informe viven sin alimentos suficientes 266 millones de personas.',3),/266 millones de personas/)
  })
  check('stock covers before crop in both formats',()=>{
    assert.match(b.stockCoverFilter('9:16'),/^scale=1080:1920:force_original_aspect_ratio=increase/)
    assert.match(b.stockCoverFilter('16:9'),/crop=1920:1080/)
  })
  const catalog=new b.CuratedModularCatalogV2(process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH||path.resolve(root,'../_cipher-editorial-catalog-v1-250'))
  const health=catalog.verifyAll();check('active files SHA valid',()=>assert.equal(health.failures.length,0))
  const semantic=b.createLocalSceneSemanticV1({sceneId:'heldout-contract',start:0,end:4,
    transcriptSegments:[{start:0,end:4,text:'La cámara registra la actividad del volcán.'}],anchor:'cámara',concepts:[{label:'cámara',scope:'scene'}]})
  const candidates=b.retrieveEditorialCandidates(catalog,semantic)
  check('bounded candidates with metadata from base and extensions',()=>{
    assert(candidates.length<=24&&candidates.length>0)
    assert(candidates.every(c=>typeof c.description==='string'&&!('runtimeRef'in c)&&!('masterRef'in c)))
  })
  const valid={mode:'typographic',heroId:null,supportIds:[],proposition:semantic.localText,
    visibleText:'La cámara registra la actividad del volcán.',emphasis:'cámara',reason:'No representar con material no pertinente.',
    evidence:[],omission:'no-suitable-material'}
  check('explicit omission is valid',()=>assert.equal(b.validateEditorialCandidateDecision(valid,candidates,semantic,4).heroId,null))
  check('context may restore a subject but not replace the timed assertion',()=>{
    const contextual={...semantic,localText:'millones de personas sufren hambre',
      globalText:'266 millones de personas sufren hambre. Los incendios destruyen bosques.'}
    const choice={...valid,proposition:'266 millones de personas sufren hambre',
      visibleText:'266 millones de personas sufren hambre',emphasis:''}
    assert.equal(b.validateEditorialCandidateDecision(choice,candidates,contextual,4).propositionSource,'neighbor-context')
    assert.throws(()=>b.validateEditorialCandidateDecision({...choice,
      proposition:'Los incendios destruyen bosques',visibleText:'Los incendios destruyen bosques'},candidates,contextual,4),/NOT_GROUNDED/)
  })
  check('optional ungrounded emphasis is omitted, never drawn',()=>assert.equal(
    b.validateEditorialCandidateDecision({...valid,emphasis:'invented'},candidates,semantic,4).emphasis,''))
  check('unoffered ID rejected',()=>assert.throws(()=>b.validateEditorialCandidateDecision({...valid,mode:'asset',heroId:'invented',omission:null},candidates,semantic,4),/NOT_OFFERED/))
  check('invented visible statement rejected',()=>assert.throws(()=>b.validateEditorialCandidateDecision({...valid,visibleText:'La cámara predice el futuro.'},candidates,semantic,4),/NOT_GROUNDED/))
  check('standalone preposition rejected by model contract',()=>assert.throws(()=>b.validateEditorialCandidateDecision({...valid,visibleText:'del'},candidates,semantic,4),/READING_BUDGET/))
  const calls=[]
  const decision=await b.decideEditorialScene({catalog,semantic,duration:4,apiKey:'fixture-not-secret',request:async(_url,options)=>{
    calls.push(JSON.parse(options.body));const reply=calls.length===1?{sourceQuote:semantic.localText,proposition:semantic.localText,
      headline:semantic.localText,secondary:'',framing:'assertion',intent:'object',concepts:['cámara','volcán'],reason:'Fixture'}:
      {...valid,direction:{revision:'editorial-scene-decision-2026-09-v2',intent:'statement',family:'editorial',variant:'base',
        entry:'word-first',background:'ivory-clean',relations:[],reason:'Fixture'}}
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(reply)}}]})}
  }})
  check('explicit omission after comprehension, no hidden literal Hero fallback',()=>{assert.equal(calls.length,2);assert.equal(decision.decision.heroId,null)})
  fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'contracts.json'),JSON.stringify({checks,health,fixture},null,2))
  console.log(JSON.stringify({passed:checks.length,health,evidence}));code=0
}catch(error){console.error(error.stack)}finally{app.exit(code)}})
