// Productive IDEA V4 path: ChatGPT PNGs -> ProjectAsset -> resolver -> SceneSpec -> V15 -> DPI-safe MP4.
const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const {spawnSync}=require('node:child_process')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const source=path.resolve(root,'../_cipher-idea-assembly-v3/runtime')
const outputRoot=path.resolve(root,'../_cipher-idea-color-v4')
const run=path.join(outputRoot,'runs',`run-${new Date().toISOString().replace(/[-:]/g,'').replace(/\..*/, '').replace('T','-')}`)
const fixture=createTestFixture('editorial-idea-color-v4')
const project=path.join(fixture,'project')
const secondProject=path.join(fixture,'project-replay')
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
process.env.PATH=path.dirname(ffmpeg)+path.delimiter+process.env.PATH
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const save=(name,data)=>{const target=path.join(run,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);return target}
const ff=(args,buffer=false)=>{const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error',...args],{timeout:300000,maxBuffer:12e6});if(r.status!==0)throw Error(`FFMPEG:${r.status}:${r.error?.message||r.stderr?.toString()}`);return buffer?r.stdout:null}
const frame=(video,t,name)=>{const dest=path.join(run,name);fs.mkdirSync(path.dirname(dest),{recursive:true});ff(['-y','-ss',String(t),'-i',video,'-frames:v','1','-update','1',dest]);return dest}
const raw=(video,t)=>ff(['-ss',String(t),'-i',video,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],true)
const pixelDiff=(a,b)=>{assert.equal(a.length,b.length);let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;return different}
const supportRegions={personas:[65,430,145,510],datos:[575,425,660,510],soluciones:[65,860,145,960],impacto:[575,860,660,960]}
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16))
const colorPixels=(bytes,rect,target)=>{let count=0;const [x0,y0,x1,y1]=rect,color=rgb(target)
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*720+x)*3
    if(color.every((value,channel)=>Math.abs(bytes[i+channel]-value)<=12))count++}return count}
const meanDelta=(a,b,rect)=>{let sum=0,max=0;const [x0,y0,x1,y1]=rect
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*720+x)*3
    for(let c=0;c<3;c++){const delta=Math.abs(a[i+c]-b[i+c]);sum+=delta;max=Math.max(max,delta)}}
  return {mean:sum/((x1-x0)*(y1-y0)*3),max}}
const intent=(source,color,heroPrimary='#C5481E')=>({supportSource:source,
  ...(source==='custom'?{customColor:color}:{}),heroMode:'recolorable',heroPrimary})
const colors={ink:intent('ink'),orange:intent('video-primary'),teal:intent('custom','#238C87','#238C87'),
  crimson:intent('custom','#B8444F','#B8444F'),custom:intent('custom','#7B4EA3','#C5481E')}
const htmlCell=(file,label)=>`<figure><img src="${path.relative(run,file).replace(/\\/g,'/')}" alt=""><figcaption>${label}</figcaption></figure>`

app.whenReady().then(async()=>{let code=1;try{
  assert(fs.existsSync(source),'CHATGPT_IDEA_RUNTIME_MISSING')
  const maskImplementation=fs.readFileSync(path.join(root,'src/renderer/src/composiciones/alpha-mask-raster-v4.tsx'),'utf8')
  const ideaImplementation=fs.readFileSync(path.join(root,'src/renderer/src/composiciones/editorial-idea-assembly-v1.tsx'),'utf8')
  assert(!/hue-rotate|saturate/i.test(maskImplementation),'IDEA_V4_MASK_CONTAINS_FILTER')
  assert(/const isV4Color = isV4 \|\| isV4_1/.test(ideaImplementation) &&
    /filter: !isV4Color && resource\.accentTreatment === 'hue-shift'/.test(ideaImplementation) &&
    /if \(isV4Color && resource\.accentTreatment === 'alpha-mask'\)/.test(ideaImplementation) &&
    ideaImplementation.includes('renderMode="css"'),'IDEA_V4_HISTORICAL_FILTER_LEAK')
  const b=require(path.join(root,'dist-electron/main/index.js'))
  ipcMain.removeHandler('get-elevenlabs-voices');ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
  for(const projectRoot of [project,secondProject])b.createProjectFiles(projectRoot,{id:path.basename(projectRoot),clips:[],timelineVideoClips:[],aiScript:'synthetic IDEA V4 color pilot'})
  let networkAttempts=0
  global.fetch=()=>{networkAttempts++;throw Error('NETWORK_FORBIDDEN_V4')}
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
    if(/^https?:/i.test(details.url)){networkAttempts++;callback({cancel:true})}else callback({cancel:false})
  })
  const outcomes={}
  for(const [name,color] of Object.entries(colors)){
    const result=await b.generateIdeaColorPilotV4({projectRoot:project,assetRoot:source,color,
      orientation:'portrait',render:b.renderGraphicClip})
    const spec=result.sceneSpec,assembly=spec.ideaAssembly
    assert.equal(spec.presentationProfile.revision,b.EDITORIAL_IDEA_ASSEMBLY_V4.revision)
    assert.equal(assembly.supportTint.resolvedColor,b.resolveIdeaColorV4(color).supportTint.resolvedColor)
    assert.equal(assembly.supports.length,4)
    assert.equal(spec.slots.filter(s=>s.colorCapability==='alpha-mask').length,4)
    assert(assembly.resources.filter(r=>r.colorCapability==='accent-primary').length===1)
    assert.equal(result.qc?.findings.filter(f=>f.level==='error').length,0,JSON.stringify(result.qc?.findings))
    const target=path.join(run,`idea-v4-${name}-vertical.mp4`);fs.mkdirSync(run,{recursive:true});fs.copyFileSync(result.file,target)
    const still=frame(target,2.55,`frames/${name}-vertical-stable.png`)
    const stableRaw=raw(target,2.55)
    const iconColorPixels=Object.fromEntries(Object.entries(supportRegions).map(([label,region])=>
      [label,colorPixels(stableRaw,region,assembly.supportTint.resolvedColor)]))
    assert(Object.values(iconColorPixels).every(count=>count>40),`IDEA_V4_SUPPORT_COLOR_NOT_VISIBLE:${JSON.stringify(iconColorPixels)}`)
    outcomes[name]={spec,mp4:target,stable:still,sha256:sha(target),identity:b.sceneSpecPixelIdentityAny(spec),qc:result.qc?.findings||[],iconColorPixels}
  }
  assert.equal(new Set(Object.values(outcomes).map(o=>o.identity)).size,Object.keys(colors).length)
  const orange=outcomes.orange
  const horizontal=await b.generateIdeaColorPilotV4({projectRoot:project,assetRoot:source,color:colors.orange,
    orientation:'landscape',render:b.renderGraphicClip})
  assert.equal(horizontal.qc?.findings.filter(f=>f.level==='error').length,0)
  const horizontalFile=path.join(run,'idea-v4-orange-horizontal.mp4');fs.copyFileSync(horizontal.file,horizontalFile)
  const keyframes={vertical:{},horizontal:{}}
  for(const [orientation,file] of [['vertical',orange.mp4],['horizontal',horizontalFile]])
    for(const [phase,t] of Object.entries({entry:.72,stable:2.55,exit:3.18}))
      keyframes[orientation][phase]=frame(file,t,`frames/${orientation}-${phase}.png`)
  const replay=await b.generateIdeaColorPilotV4({projectRoot:secondProject,assetRoot:source,color:colors.orange,
    orientation:'portrait',render:b.renderGraphicClip})
  const replayFile=path.join(run,'idea-v4-orange-replay-vertical.mp4');fs.copyFileSync(replay.file,replayFile)
  frame(replayFile,2.55,'frames/orange-replay-vertical-stable.png')
  const replayIdentity=b.sceneSpecPixelIdentityAny(replay.sceneSpec)
  save('replay-diagnostic.json',JSON.stringify({originalIdentity:orange.identity,replayIdentity,
    originalSha256:sha(orange.mp4),replaySha256:sha(replayFile)},null,2))
  assert.equal(replayIdentity,orange.identity,'V4_REPLAY_SCENESPEC_IDENTITY_DIFF')
  const determinismDiff=pixelDiff(raw(orange.mp4,2.55),raw(replay.file,2.55))
  assert.equal(determinismDiff,0,`V4_REPEAT_PIXEL_DIFF:${determinismDiff}`)
  const neutralRegionMetrics={paper:meanDelta(raw(orange.mp4,2.55),raw(outcomes.teal.mp4,2.55),[200,10,300,100]),
    bustFace:meanDelta(raw(orange.mp4,2.55),raw(outcomes.teal.mp4,2.55),[385,735,425,775]),
    accent:meanDelta(raw(orange.mp4,2.55),raw(outcomes.teal.mp4,2.55),[260,700,325,850])}
  const invalid=structuredClone(orange.spec);invalid.slots.find(s=>s.slotId==='support-1').colorCapability='none'
  assert.throws(()=>b.validateVisualSceneSpecV2(invalid),/IDEA_V4_ALPHA_MASK_UNAUTHORIZED/)
  const photo=structuredClone(orange.spec);photo.slots.find(s=>s.slotId==='hero').colorCapability='alpha-mask'
  assert.throws(()=>b.validateVisualSceneSpecV2(photo),/IDEA_V4_ALPHA_MASK_UNAUTHORIZED/)
  const missing=structuredClone(orange.spec);missing.ideaAssembly.heroPalette.mode='dual-accent';missing.ideaAssembly.heroPalette.secondary='#238C87'
  assert.throws(()=>b.validateVisualSceneSpecV2(missing),/IDEA_V4_SECONDARY_LAYER_REQUIRED/)
  const stone=structuredClone(orange.spec);stone.ideaAssembly.resources.find(r=>r.id==='idea-rear').colorCapability='accent-primary'
  assert.throws(()=>b.validateVisualSceneSpecV2(stone),/IDEA_V4_RESOURCE_COLOR_UNAUTHORIZED/)
  assert.throws(()=>b.resolveIdeaColorV4(intent('custom','#7b4ea3')),/IDEA_V4_CUSTOM_COLOR_INVALID/)
  assert.equal(b.resolveIdeaColorV4(intent('hero-primary',undefined,'#238C87')).supportTint.resolvedColor,'#238C87')
  await assert.rejects(()=>b.generateIdeaColorPilotV4({projectRoot:project,assetRoot:source,
    color:{supportSource:'ink',heroMode:'fixed-spectrum'},orientation:'portrait',render:b.renderGraphicClip}),
    /IDEA_V4_ASSET_COLOR_CAPABILITY_INVALID/)
  const tampered=path.join(fixture,'tampered-assets');fs.mkdirSync(tampered)
  for(const name of ['bust','bulb','collage-rear','accent-paper','collage-front-neutral','personas-v2'])
    fs.copyFileSync(path.join(source,`${name}.png`),path.join(tampered,`${name}.png`))
  fs.appendFileSync(path.join(tampered,'personas-v2.png'),Buffer.from([0]))
  await assert.rejects(()=>b.generateIdeaColorPilotV4({projectRoot:project,assetRoot:tampered,
    color:colors.orange,orientation:'portrait',render:b.renderGraphicClip}),
    /IDEA_V4_PILOT_ASSET_SHA_MISMATCH:personas-v2/)
  assert.equal(networkAttempts,0,`NETWORK_ATTEMPTS:${networkAttempts}`)
  const style='<style>body{background:#24221f;color:#f4f2ed;font:16px Arial;padding:24px}main{display:grid;grid-template-columns:repeat(3,minmax(240px,1fr));gap:16px}figure{margin:0;background:#33302c;padding:10px}img{width:100%;max-height:800px;object-fit:contain;background:#f0eee8}figcaption{margin-top:8px}</style>'
  const sheet=save('color-comparison.html',`<!doctype html><meta charset="utf-8">${style}<h1>IDEA V4 · five support colors</h1><main>${Object.entries(outcomes).map(([name,o])=>htmlCell(o.stable,`${name} · ${o.spec.ideaAssembly.supportTint.resolvedColor}`)).join('')}</main>`)
  save('keyframes.html',`<!doctype html><meta charset="utf-8">${style}<h1>IDEA V4 · entry / stable / exit</h1><main>${Object.entries(keyframes).flatMap(([orientation,phases])=>Object.entries(phases).map(([phase,file])=>htmlCell(file,`${orientation} · ${phase}`))).join('')}</main>`)
  const report={profile:b.EDITORIAL_IDEA_ASSEMBLY_V4,source,
    sourceAssets:Object.fromEntries(['bust','bulb','collage-rear','accent-paper','collage-front-neutral','personas-v2','datos','soluciones','impacto','paper-background'].map(name=>[name,sha(path.join(source,`${name}.png`))])),
    colors:Object.fromEntries(Object.entries(outcomes).map(([name,o])=>[name,{mp4:o.mp4,stable:o.stable,sha256:o.sha256,identity:o.identity,supportTint:o.spec.ideaAssembly.supportTint,heroPalette:o.spec.ideaAssembly.heroPalette,qc:o.qc,iconColorPixels:o.iconColorPixels}])),
    horizontal:{mp4:horizontalFile,sha256:sha(horizontalFile),qc:horizontal.qc?.findings||[]},
    keyframes,contactSheet:sheet,determinismPixelDiff:determinismDiff,neutralRegionMetrics,networkAttempts,visualSinFichero:0,
    rejectedUnauthorizedRaster:true,rejectedUnauthorizedAccentLayer:true,rejectedTamperedSupport:true,
    rejectedHeroWithoutSecondaryLayer:true,fixedSpectrumRequiresAuthorizedAsset:true,
    frames:80,fps:24,durationSeconds:80/24}
  save('evidence.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify({result:'PASS',run,vertical:orange.mp4,horizontal:horizontalFile,determinismPixelDiff:determinismDiff,networkAttempts,colors:Object.fromEntries(Object.entries(outcomes).map(([n,o])=>[n,o.spec.ideaAssembly.supportTint.resolvedColor]))}))
  code=0
}catch(error){console.error(error?.stack||error)}finally{cleanupTestFixture(fixture);app.exit(code)}}).catch(error=>{console.error(error);cleanupTestFixture(fixture);app.exit(1)})
