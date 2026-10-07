const { app, BrowserWindow, session } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const root = path.resolve(__dirname,'../../..')
const catalogRoot = process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH || path.resolve(root,'../_cipher-editorial-catalog-v1-250')
const outputRoot = path.join(catalogRoot,'evidence','color-matrix')
const fixture = createTestFixture('editorial-modular-color-matrix')
app.setPath('userData',path.join(fixture,'userData'))
app.commandLine.appendSwitch('force-device-scale-factor','1')
process.chdir(fixture)
const colors=['#11110F','#A83B19','#238C87','#B8444F','#7B4EA3']
app.whenReady().then(async()=>{
  let code=1,win
  try {
    fs.mkdirSync(outputRoot,{recursive:true})
    const inventory=JSON.parse(fs.readFileSync(path.join(catalogRoot,'inventory.json'),'utf8'))
    const entries=inventory.entries.filter(e=>e.role==='support'||e.role==='accent-mask')
    assert.equal(entries.length,65)
    let networkAttempts=0
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if (/^https?:/i.test(details.url)) {networkAttempts++;callback({cancel:true})}
      else callback({cancel:false})
    })
    win=new BrowserWindow({width:1320,height:1680,show:false,webPreferences:{offscreen:{deviceScaleFactor:1},
      contextIsolation:true,sandbox:true}})
    await win.loadFile(path.join(root,'dist','catalog-matrix.html'))
    const files=[]
    for(let start=0;start<entries.length;start+=10){
      const group=entries.slice(start,start+10)
      const data={title:`Catálogo modular · ${start+1}–${start+group.length} de 65`,colors,
        entries:group.map(e=>({code:e.code,word:e.primaryWordEs,role:e.role,
          url:pathToFileURL(path.join(catalogRoot,e.runtimeRef)).href}))}
      await win.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('catalog-matrix-input',{detail:${JSON.stringify(data)}}))`)
      await win.webContents.executeJavaScript(`new Promise(resolve=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)),300))`)
      const image=await win.webContents.capturePage()
      assert(image.getSize().width>=1200 && image.getSize().height>=1500)
      const file=path.join(outputRoot,`${String(start+1).padStart(2,'0')}-${String(start+group.length).padStart(2,'0')}.png`)
      fs.writeFileSync(file,image.toPNG())
      files.push({file,entries:group.map(e=>e.code)})
    }
    assert.equal(networkAttempts,0)
    const result={passed:true,component:'AlphaMaskRasterV4',entries:entries.length,colors,files,networkAttempts}
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify(result,null,2)+'\n')
    console.log(JSON.stringify({passed:true,files:files.length,entries:entries.length,outputRoot}))
    code=0
  } catch(error){fs.mkdirSync(outputRoot,{recursive:true});fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error));console.error(error?.stack||error)}
  finally{if(win&&!win.isDestroyed())win.destroy();try{cleanupTestFixture(fixture)}catch(error){console.error(error)}app.exit(code)}
}).catch(error=>{console.error(error);app.exit(1)})
