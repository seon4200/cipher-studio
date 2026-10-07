const {app,ipcMain}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createTestFixture,cleanupTestFixture}=require('../../helpers/safe-fixture')
const root=path.resolve(__dirname,'../../..')
const catalogRoot=path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const fixture=createTestFixture('editorial-local-bank-v2'),projectRoot=path.join(fixture,'project')
app.setPath('userData',path.join(fixture,'userData'))
process.chdir(fixture)
app.whenReady().then(async()=>{
  let code=1
  try{
    const b=require(path.join(root,'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices',()=>({success:true,voices:[]}))
    b.createProjectFiles(projectRoot,{id:'bank-contracts',clips:[],timelineVideoClips:[]})
    const catalog=new b.CuratedModularCatalogV1(catalogRoot)
    const health=catalog.verifyAll()
    assert.equal(health.listed,250)
    assert.equal(health.verified,250,JSON.stringify(health.failures))
    const manifest=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const id=code=>manifest.entries.find(item=>item.code===code).assetId
    const chosen=[id('H001'),...['S001','S002','S003','S004','S005','S006'].map(id),
      id('L001'),id('L036'),id('L021')]
    const imported=Object.fromEntries(chosen.map(assetId=>[assetId,catalog.publish(projectRoot,assetId)]))
    const text='Una idea conecta personas datos soluciones impacto cámara y red.'
    const semantic=b.createLocalSceneSemanticV1({sceneId:'local-bank',start:0,end:3,
      transcriptSegments:[{start:0,end:3,text}],anchor:'Idea',
      concepts:['Idea','Personas','Datos','Soluciones','Impacto','Cámara','Red']
        .map(label=>({label,scope:'scene'})),globalText:text})
    const context=b.createModernVisualGenerationContextV2({sceneId:'local-bank',duration:3,
      localSemantic:semantic,keywordCandidates:[{keyword:'IDEA',source:'scene-semantic'}],
      preferredVisualMode:'editorial-text',sistema:'editorial',
      direction:{fondo:'ondas',estructura:'editorial',camara:'quieto',densidad:'media',
        ritmo:'simultaneo',semilla:95151},videoStyleId:'cream-editorial'})
    const base=(await b.resolveModernVisualGenerationBatchV2({contexts:[context],projectRoot}))[0].resolved.compiled
    const historicalIdentity=b.sceneSpecPixelIdentityAny(base.sceneSpec)
    const auto=b.selectEditorialLocalBankV2({catalog,semantic})
    assert.equal(auto.heroId,id('H001'))
    assert.equal(auto.supportIds.length,6)
    assert.equal(auto.rearId,id('L001'))
    assert.equal(auto.accentId,id('L036'))
    assert.equal(auto.frontId,id('L021'))
    const intentByFamily={
      editorial:'reflexión',marcoPoster:'anuncio',partidoVertical:'comparación',
      cintaDiagonal:'trayectoria',anillosConcentricos:'ciclo',rayosImpacto:'irradiación',
      cuaderno:'documento',constelacion:'constelación',capasApiladas:'profundidad',
      redNodos:'interconexión',lineaTiempo:'cronología',corteTransversal:'por dentro',
      abanicoTarjetas:'alternativas',engranajes:'mecanismo',cascada:'secuencia',
      mundoIsometrico:'arquitectura',pilaVertical:'jerarquía',
    }
    for(const [family,intent] of Object.entries(intentByFamily)){
      const localText=`Una idea conecta personas y datos: ${intent}.`
      const content=b.createLocalSceneSemanticV1({sceneId:`auto-${family}`,start:0,end:3,
        transcriptSegments:[{start:0,end:3,text:localText}],anchor:'Idea',
        concepts:['Idea','Personas','Datos'].map(label=>({label,scope:'scene'})),globalText:localText})
      const selected=b.selectEditorialLocalBankV2({catalog,semantic:content})
      assert.equal(selected?.family,family,`AUTOMATIC_FAMILY_UNREACHABLE:${family}`)
    }
    let passed=0
    for(const family of b.EDITORIAL_LOCAL_FAMILIES_V2){
      const selection={...auto,family,supportIds:auto.supportIds.slice(0,2)}
      const make=color=>b.bindEditorialLocalBankV2({template:base,catalog,imported,selection,
        color,headline:{connector:'Una',keyword:'IDEA',closing:'conecta personas y datos.'}})
      let first,replay
      try{first=make('#A83B19');replay=make('#A83B19')}
      catch(error){throw new Error(`FAMILY=${family}: ${error.message}`)}
      assert.equal(first.pixelIdentity,replay.pixelIdentity)
      assert.notEqual(first.pixelIdentity,make('#238C87').pixelIdentity)
      assert.equal(first.sceneSpec.layout.family,family)
      assert.notDeepEqual(first.sceneSpec.layout,first.sceneSpec.editorialBankV2.landscapeLayout)
      assert.equal(first.renderBindings.assets.length,6)
      assert(!first.pixelIdentity.includes(projectRoot)&&!first.pixelIdentity.includes(catalogRoot))
      const bad=structuredClone(first.sceneSpec)
      bad.editorialBankV2.layers[1].sha256='0'.repeat(64)
      assert.throws(()=>b.validateVisualSceneSpecV2(bad))
      passed++
    }
    const six=b.bindEditorialLocalBankV2({template:base,catalog,imported,selection:auto,
      color:'#A83B19',headline:{connector:'Una',keyword:'IDEA',closing:'conecta personas y datos.'}})
    assert.equal(six.sceneSpec.editorialBankV2.supports.length,6)
    assert.equal(six.renderBindings.assets.length,10)
    assert.equal(b.sceneSpecPixelIdentityAny(base.sceneSpec),historicalIdentity)
    console.log(JSON.stringify({passed:true,catalogVerified:health.verified,families:passed,automaticallyReachable:17,
      sixSupports:true,layerBindings:3,
      historicalIdentityPreserved:true}))
    code=0
  }catch(error){console.error(error?.stack||error)}
  finally{try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
