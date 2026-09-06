// Banco en Chrome instalado vs grafico.html empaquetado en Electron offscreen.
// No hay video ni FFmpeg; se inspeccionan los glifos realmente usados via CDP.
const {app,BrowserWindow,session,nativeImage}=require('electron')
const {chromium}=require('playwright-core')
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto')
const repo=path.resolve(__dirname,'../..'),salida=path.join(__dirname,'mvp-paso7')
const origen='http://127.0.0.1:5176'
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cipher-emoji-')))
app.on('window-all-closed',()=>{})
const direccion={fondo:'ondas',estructura:'constelacion',camara:'quieto',densidad:'media',ritmo:'simultaneo',tipografia:'archivo'}
const graphic={type:'visual_escena',value:'memoria',extra:{conceptos:[{emoji:'🧠',etiqueta:'recuerdo'},{emoji:'🗂️',etiqueta:'archivo'},{emoji:'🔗',etiqueta:'conexion'}],direccion}}
const rects=`[...document.querySelectorAll('.es-mini')].map(e=>{const r=e.getBoundingClientRect();return {texto:e.textContent,x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width)+1,height:Math.ceil(r.height)+1}})`
async function fuentes(send){
  await send('DOM.enable');await send('CSS.enable');const d=await send('DOM.getDocument',{depth:-1})
  const q=await send('DOM.querySelectorAll',{nodeId:d.root.nodeId,selector:'.es-mini'})
  return Promise.all(q.nodeIds.map(nodeId=>send('CSS.getPlatformFontsForNode',{nodeId})))
}
let chrome,w
app.whenReady().then(async()=>{
  fs.mkdirSync(salida,{recursive:true})
  session.defaultSession.webRequest.onBeforeRequest((r,cb)=>cb({cancel:/^https?:/.test(r.url)}))
  w=new BrowserWindow({show:false,width:1080,height:1928,useContentSize:true,frame:false,transparent:true,backgroundColor:'#00000000',
    webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:false}})
  await w.loadFile(path.join(repo,'dist/grafico.html'))
  w.setContentSize(1080,1928) // Igual que obtenerVentanaGraficos: Windows recorta al CREAR, no al ajustar.
  const guarda=await w.webContents.executeJavaScript('window.__listo()')
  if(guarda.avisosFuentes.length)throw Error(JSON.stringify(guarda))
  await w.webContents.executeJavaScript(`window.__montar(${JSON.stringify(graphic)},{ancho:1080,alto:1920,modo:'pantalla',sistema:'voltaje',duracion:3});window.__setT(1.5)`)
  await w.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>new Promise(r=>setTimeout(r,200)))')
  w.webContents.debugger.attach('1.3')
  const fuentesRender=await fuentes((m,p)=>w.webContents.debugger.sendCommand(m,p))
  const r=await w.webContents.executeJavaScript(rects)
  const completa=await w.webContents.capturePage()
  if(completa.getSize().width!==1080||completa.getSize().height!==1928)throw Error('Viewport de render recortado')
  chrome=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
  const context=await chrome.newContext({viewport:{width:2052,height:2600},deviceScaleFactor:1})
  await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origen?route.continue():route.abort()})
  const page=await context.newPage()
  await page.goto(`${origen}/banco.html?vista=cobertura&eje=estructura&caso=estructura:constelacion&escala=1&t=1.5`)
  await page.waitForSelector('[data-fuentes="ok"]')
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  const cdp=await context.newCDPSession(page),fuentesBanco=await fuentes((m,p)=>cdp.send(m,p))
  const rectBanco=await page.evaluate(rects)
  const pares=[]
  for(let i=0;i<r.length;i++){
    const off=completa.crop(r[i]).toPNG(),bank=await page.screenshot({clip:rectBanco[i]})
    if(!off.length||!bank.length)throw Error('Captura de emoji vacia')
    const aa=nativeImage.createFromBuffer(off),bb=nativeImage.createFromBuffer(bank)
    if(JSON.stringify(aa.getSize())!==JSON.stringify(bb.getSize()))throw Error('Recortes de tamanos distintos')
    const ab=aa.toBitmap(),ba=bb.toBitmap();let pixeles=0,max=0,suma=0
    for(let p=0;p<ab.length;p+=4){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(ab[p+k]-ba[p+k]));if(d){pixeles++;suma+=d;max=Math.max(max,d)}}
    const a=path.join(salida,`emoji-${i+1}-render.png`),b=path.join(salida,`emoji-${i+1}-banco.png`)
    fs.writeFileSync(a,off);fs.writeFileSync(b,bank)
    pares.push({emoji:r[i].texto,render:a,banco:b,rectRender:r[i],rectBanco:rectBanco[i],pngIdentico:off.equals(bank),
      pixelesDistintos:pixeles,deltaMax:max,deltaMedio:pixeles?suma/pixeles:0,
      shaRender:crypto.createHash('sha256').update(off).digest('hex'),shaBanco:crypto.createHash('sha256').update(bank).digest('hex')})
  }
  const resultado={versionRender:process.versions,versionBanco:chrome.version(),guarda,fuentesRender,fuentesBanco,pares,
    nota:'PNG recortado en documentos y motores distintos; igualdad del fichero no es requisito. Se comprueba fuente efectiva y se miran los glifos.'}
  fs.writeFileSync(path.join(salida,'emoji.json'),JSON.stringify(resultado,null,2));console.log(JSON.stringify({fuentesRender,fuentesBanco}))
  await chrome.close();w.destroy();app.exit(0)
}).catch(async e=>{console.error(e);if(chrome)await chrome.close();if(w&&!w.isDestroyed())w.destroy();app.exit(1)})
