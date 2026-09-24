const {app,session,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const focus=process.env.CASE_FOCUS==='1'
const output=path.resolve(root,`../_cipher-editorial-finish-v1-1/${focus?'focus':'smoke'}`)
const fixture=createTestFixture('editorial-finish-smoke')
const projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    fs.mkdirSync(output,{recursive:true})
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'finish-smoke',clips:[],timelineVideoClips:[],aiScript:''})
    let network=0
    global.fetch=()=>{network++;throw new Error('NETWORK_FORBIDDEN_FINISH')}
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/i.test(details.url)){network++;callback({cancel:true})}else callback({cancel:false})
    })
    const catalog=new b.CuratedModularCatalogV1(path.resolve(root,'../_cipher-editorial-catalog-v1-250'))
    const ids=['editorial-hero-h001-v1','idea-support-personas-v1','idea-support-datos-v1',
      'editorial-layer-l001-v1','editorial-layer-l036-v1']
    const imported=Object.fromEntries(ids.map(id=>[id,catalog.publish(projectRoot,id)]))
    const template=await b.generateIdeaColorPilotV4({projectRoot,
      assetRoot:path.resolve(root,'../_cipher-idea-assembly-v3/runtime'),
      color:{supportSource:'ink',heroMode:'recolorable',heroPrimary:'#A83B19'},
      orientation:'portrait',render:b.renderGraphicClip})
    const built=b.bindEditorialModularFinishV11({template,catalog,imported,
      family:'constelacion',heroId:ids[0],supportIds:ids.slice(1,3),
      rearId:ids[3],accentId:ids[4],background:'ivory-subtle-grid',
      entry:'supports-first',supportTreatment:'paper-card',camera:'fixed',particles:'none',
      color:'#A83B19',headline:{connector:'UNA',keyword:'IDEA',closing:'conecta personas y datos'},
      relations:[{from:'support-1',to:'hero',meaning:'informs'},
        {from:'hero',to:'support-2',meaning:'transfers'}],
      finish:{display:'Fraunces',local:'discreto',ambient:'discreto',representation:'auto',response:'auto',
        composition:focus?'focus':'base'}})
    assert.equal(built.sceneSpec.presentationProfile.revision,b.EDITORIAL_FINISH_V1_1.revision)
    assert.equal(built.sceneSpec.editorialFinish.relations.length,2)
    assert(!built.pixelIdentity.includes(projectRoot))
    const files=[]
    for(const orientation of ['portrait','landscape']){
      let qc
      const file=await b.renderGraphicClip(built.graphicData,{ancho:orientation==='portrait'?720:1280,
        alto:orientation==='portrait'?1280:720,fps:24,duracion:80/24,modo:'pantalla',sistema:'editorial',
        projectRoot,renderBindings:built.renderBindings,onQcReport:r=>{qc=r},onQcFailure:r=>{qc=r}})
      assert(file&&fs.existsSync(file),`VISUAL_SIN_FICHERO:${orientation}:${JSON.stringify(qc?.findings??[])}`)
      const dest=path.join(output,`finish-${orientation}.mp4`)
      fs.copyFileSync(file,dest);files.push(dest)
    }
    assert.equal(network,0)
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({files,network,
      pixelIdentity:built.pixelIdentity,plan:built.sceneSpec.editorialFinish},null,2))
    console.log(JSON.stringify({passed:true,files,network}))
    code=0
  }catch(error){console.error(error?.stack||error);fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'failure.txt'),String(error?.stack||error))}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
