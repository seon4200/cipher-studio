const {app,session,ipcMain}=require('electron')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {createTestFixture,cleanupTestFixture}=require('./helpers/safe-fixture')
const {rows,context}=require('./fixtures/modern-visual-pack-v1')
const {familyCases,narrativeCases,stressCases}=require('./fixtures/families-motion-v2-corpus')
const repo=path.resolve(__dirname,'..'),fixture=createTestFixture('families-motion-v2')
const project=path.join(fixture,'project'),evidence=path.resolve(repo,'../_families-motion-v2-evidence')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','2.25')
process.chdir(fixture)
let bundle
app.whenReady().then(async()=>{let code=1;try{
  global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/i.test(d.url)}))
  bundle=require(path.join(repo,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  bundle.createProjectFiles(project,{id:'families-v2-temp',clips:[],timelineVideoClips:[],aiScript:'synthetic controlled test'})
  assert.equal(bundle.MODERN_LAYOUT_STRUCTURES_V4.length,17)
  assert.deepEqual(bundle.MODERN_LAYOUT_STRUCTURES_V4,familyCases.map(row=>row.targetFamily))
  assert.equal(narrativeCases.length,12);assert.equal(stressCases.length,8)
  assert.equal(bundle.COMPOSITION_VARIANTS_V2.length,12)
  assert.equal(bundle.BACKGROUND_VARIANTS_V2.length,8)
  assert.equal(bundle.MOTION_PRIMITIVES_V2.length,9)
  const reachable=new Set()
  for(const palette of ['blue-tech','cyan-digital','green-nature','sunset-energy','purple-cosmic',
    'red-alert','magenta-creative','silver-industrial','yellow-energy'])
    for(let index=0;index<80;index++)reachable.add(bundle.selectCompositionV2({family:'marcoPoster',
      mode:'asset-led',supportCount:0,seed:41001,sceneId:`background-${index}`,cue:'protagonist',
      heroKind:'simple-icon',videoPaletteFamily:palette}).backgroundVariant)
  assert.deepEqual([...reachable].sort(),[...bundle.BACKGROUND_VARIANTS_V2].sort())
  for(const family of bundle.MODERN_LAYOUT_STRUCTURES_V4){
    const eligibility=bundle.LAYOUT_ELIGIBILITY_V4[family]
    const mode=family==='editorial'?'editorial-text':'asset-led'
    const count=eligibility.minSupports
    for(const supportCount of new Set([eligibility.minSupports,eligibility.maxSupports])){
    for(const orientation of ['portrait','landscape']){
      const layout=bundle.createCompositionLayoutV2(family,mode,supportCount,41001,'protagonist',
        family==='editorial'?undefined:'simple-icon',orientation)
      assert.equal(layout.family,family)
      assert.equal(layout.slotLayouts.length,family==='editorial'?0:supportCount+1)
      for(const box of [layout.textBounds,...layout.slotLayouts.map(slot=>slot.envelope)]){
        assert(box.x>=0&&box.y>=0&&box.x+box.width<=100&&box.y+box.height<=100,
          `${family}:${orientation}:${JSON.stringify(box)}`)
      }
      const hero=layout.slotLayouts.find(slot=>slot.slotId==='hero')?.envelope
      if(hero){
        const heroArea=hero.width*hero.height
        assert(heroArea>=1100,`${family}:${orientation}:Hero too small`)
        for(const support of layout.slotLayouts.filter(slot=>slot.slotId!=='hero')){
          const area=support.envelope.width*support.envelope.height
          assert(area>=220,`${family}:${orientation}:${support.slotId}:Support too small`)
          assert(area<=heroArea*.78,`${family}:${orientation}:${support.slotId}:Support dominates`)
        }
      }
    }
    }
    const input={family,mode,supportCount:count,seed:41001,sceneId:`check-${family}`,
      cue:'protagonist',heroKind:family==='editorial'?undefined:'simple-icon',videoPaletteFamily:'blue-tech'}
    assert.deepEqual(bundle.selectCompositionV2(input),bundle.selectCompositionV2(input))
    const selected=bundle.selectCompositionV2(input)
    if(selected.backgroundVariant!=='solid-deep'){
      const next=bundle.selectCompositionV2({...input,recentBackgrounds:[selected.backgroundVariant]})
      assert.notEqual(next.backgroundVariant,selected.backgroundVariant)
    }
  }
  const cases=[rows[0],rows[21]]
  for(let i=0;i<cases.length;i++){
    const base=context(bundle,cases[i],i,true)
    const result=(await bundle.resolveModernVisualGenerationBatchV2({contexts:[{...base,
      presentationProfile:bundle.FAMILIES_MOTION_PROFILE_V2}],projectRoot:project}))[0]
    const spec=result.resolved.compiled.sceneSpec
    assert.equal(spec.presentationProfile.revision,bundle.FAMILIES_MOTION_PROFILE_V2.revision)
    assert(spec.compositionV2)
    assert.notDeepEqual(spec.layout,spec.compositionV2.landscapeLayout)
    const identity=bundle.sceneSpecPixelIdentityAny(spec)
    assert.equal(bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(JSON.parse(JSON.stringify(spec)))),identity)
    const altered={...spec,compositionV2:{...spec.compositionV2,
      backgroundVariant:spec.compositionV2.backgroundVariant==='solid-deep'?'soft-vignette':'solid-deep'}}
    assert.notEqual(bundle.sceneSpecPixelIdentityAny(altered),identity)
    let qc
    const file=await bundle.renderGraphicClip(result.resolved.compiled.graphicData,{ancho:540,alto:960,fps:24,
      duracion:2,modo:'pantalla',sistema:'editorial',projectRoot:project,
      renderBindings:result.resolved.compiled.renderBindings,onQcReport:v=>qc=v,onQcFailure:v=>qc=v})
    assert(file&&fs.existsSync(file),JSON.stringify(qc?.findings))
    assert.equal(qc.findings.filter(f=>f.level==='error').length,0,JSON.stringify(qc.findings))
    fs.mkdirSync(evidence,{recursive:true});fs.copyFileSync(file,path.join(evidence,`smoke-${i}.mp4`))
    let wideQc
    const wide=await bundle.renderGraphicClip(result.resolved.compiled.graphicData,{ancho:960,alto:540,fps:24,
      duracion:2,modo:'pantalla',sistema:'editorial',projectRoot:project,
      renderBindings:result.resolved.compiled.renderBindings,onQcReport:v=>wideQc=v,onQcFailure:v=>wideQc=v})
    assert(wide&&fs.existsSync(wide),JSON.stringify(wideQc?.findings))
    assert.equal(wideQc.findings.filter(f=>f.level==='error').length,0,JSON.stringify(wideQc.findings))
    fs.copyFileSync(wide,path.join(evidence,`smoke-wide-${i}.mp4`))
    console.log('FAMILIES_V2_SMOKE',JSON.stringify({family:spec.layout.family,variant:spec.compositionV2.layoutVariant,
      background:spec.compositionV2.backgroundVariant,motion:spec.compositionV2.motionVariant,
      slots:spec.slots.map(s=>s.slotId),bytes:fs.statSync(file).size}))
  }
  for(const [id,provider] of [['symbol-clock','solar'],['direct-openmoji','openmoji']]){
    const index=rows.findIndex(row=>row.id===id)
    const legacy=context(bundle,rows[index],index,true)
    const modern={...legacy,presentationProfile:bundle.FAMILIES_MOTION_PROFILE_V2}
    const [resolved]=(await bundle.resolveModernVisualGenerationBatchV2({contexts:[modern],projectRoot:project}))
    assert(resolved.resolved.choices.some(choice=>choice.provider===provider),`${id}:${provider} preserved`)
    assert.equal(resolved.resolved.compiled.sceneSpec.presentationProfile.revision,
      bundle.FAMILIES_MOTION_PROFILE_V2.revision)
    console.log('FAMILIES_V2_PROVIDER_PRESERVED',id,provider)
  }
  code=0
}catch(e){console.error(e)}finally{
  try{bundle?.cerrarVentanaGraficos();process.chdir(path.dirname(fixture));cleanupTestFixture(fixture)}catch(e){console.error(e);code=1}
  app.exit(code)
}})
