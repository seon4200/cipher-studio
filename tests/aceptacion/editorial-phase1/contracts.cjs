// Imports the production bundle. Historical private diagnostics are supplied by path,
// never copied into this repository or asserted as a universal prompt fixture.
const {app,ipcMain}=require('electron')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..')
const fixture=createTestFixture('editorial-phase1')
app.setPath('userData',path.join(fixture,'userData'))
process.chdir(fixture)
const handle=ipcMain.handle.bind(ipcMain)
ipcMain.handle=(channel,fn)=>handle(channel,channel==='get-elevenlabs-voices'?async()=>({success:true,voices:[]}):fn)
app.on('browser-window-created',(_,window)=>{window.hide();window.on('ready-to-show',()=>window.hide())})
app.whenReady().then(()=>{
  let code=1
  try{
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    const checks=[]
    const check=(name,fn)=>{fn();checks.push(name)}
    const semantic={version:1,sceneId:'whitespace',start:1,end:4,
      localText:'La idea crece. La acción importa.',globalText:'La idea crece.  La acción importa.',
      neighborBefore:'',neighborAfter:'Después viene otra afirmación.',localTokens:[],concepts:[],
      globalHints:[],directEvidence:[]}
    const valid={sourceQuote:'La idea crece. La acción importa.',
      proposition:'La idea crece y la acción importa.',headline:'La idea crece con acción',secondary:'',
      framing:'assertion',intent:'statement',concepts:['idea','acción'],reason:'Paráfrasis del intervalo.'}
    check('whitespace-normalized quote is accepted in new contract',()=>
      assert.equal(b.validateEditorialMeaningV2(valid,semantic,3,{phase1:true}).headline,valid.headline))
    check('old exact quote contract remains unchanged',()=>
      assert.throws(()=>b.validateEditorialMeaningV2(valid,{...semantic,localText:'La idea crece.  La acción importa.'},3),
        /SOURCE_QUOTE_NOT_FOUND/))
    check('future source quote cannot move backward',()=>assert.throws(()=>b.validateEditorialMeaningV2(
      {...valid,sourceQuote:'Después viene otra afirmación.'},
      {...semantic,globalText:semantic.globalText+' Después viene otra afirmación.'},3,
      {phase1:true}),/OUTSIDE_INTERVAL_OR_PRIOR_CONTEXT|WRONG_INTERVAL/))
    check('future-only claim cannot become headline',()=>assert.throws(()=>b.validateEditorialMeaningV2(
      {...valid,proposition:valid.proposition+' Después viene otra afirmación.',headline:'Después viene otra afirmación'},
      semantic,3,{phase1:true}),/FUTURE_CLAIM/))
    const long={...valid,headline:'La idea crece cuando la acción realmente importa',secondary:'y mantiene su sentido'}
    check('valid meaning survives overlong presentation',()=>assert.equal(
      b.validateEditorialMeaningV2(long,semantic,2,{phase1:true,allowOverBudget:true}).proposition,long.proposition))
    check('presentation guard still rejects overlong display',()=>assert.throws(()=>
      b.validateEditorialMeaningV2(long,semantic,2,{phase1:true}),/READING_BUDGET/))
    check('safe fallback drops an unfinished following sentence',()=>assert.equal(
      b.editorialFallbackTextV3('Una idea se completa. Pero lo que tú y',2.8),'Una idea se completa'))
    check('safe fallback declines a bare fragment',()=>assert.equal(
      b.editorialFallbackTextV3('Pero lo que tú y',2.8),null))
    check('safe fallback does not erase prior critical framing',()=>assert.equal(
      b.editorialFallbackTextV3('El potencial es suficiente.',2.8,'El error es creer que'),null))
    let historical=null
    if(process.env.CIPHER_PHASE1_DIAGNOSTIC){
      const diagnostic=JSON.parse(fs.readFileSync(process.env.CIPHER_PHASE1_DIAGNOSTIC,'utf8'))
      const selected=new Set(['visual-8:0','visual-14:0','visual-16:0','visual-20:0'])
      historical=diagnostic.scenes.filter(scene=>selected.has(scene.sceneId)).map(scene=>{
        const attempts=scene.catalogDecision.contextualDecision?.attempts??[]
        const prompt=attempts[0]?.prompt??''
        const match=prompt.match(/Contexto \([^\n]*?\): ("(?:\\.|[^"\\])*")/u)
        const context=match?JSON.parse(match[1]):''
        const local=scene.localSemantic.localText
        const normalized=context.replace(/\s+/gu,' '),at=normalized.indexOf(local.replace(/\s+/gu,' '))
        const semanticCase={...semantic,sceneId:scene.sceneId,start:scene.localSemantic.start,
          end:scene.localSemantic.end,localText:local,globalText:context,
          neighborBefore:at<0?'':normalized.slice(0,at).trim(),
          neighborAfter:at<0?'':normalized.slice(at+local.replace(/\s+/gu,' ').length).trim()}
        const results=attempts.filter(a=>a.stage==='meaning').map(a=>{
          try{b.validateEditorialMeaningV2(a.response,semanticCase,semanticCase.end-semanticCase.start,
            {phase1:true,allowOverBudget:true});return 'ACCEPTED'}
          catch(error){return error.message}
        })
        return {sceneId:scene.sceneId,previous:attempts.filter(a=>a.stage==='meaning').map(a=>a.error),
          phase1:results,safeFallback:b.editorialFallbackTextV3(local,semanticCase.end-semanticCase.start)}
      })
      assert.equal(historical.length,4)
    }
    const report={checks,historical}
    if(process.env.CIPHER_PHASE1_EVIDENCE){fs.mkdirSync(process.env.CIPHER_PHASE1_EVIDENCE,{recursive:true})
      fs.writeFileSync(path.join(process.env.CIPHER_PHASE1_EVIDENCE,'contracts.json'),JSON.stringify(report,null,2))}
    console.log(JSON.stringify({checks:checks.length,historical}))
    code=0
  }catch(error){console.error(error.stack)}finally{app.exit(code)}
})
