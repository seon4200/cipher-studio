const {app,BrowserWindow,session}=require('electron')
const fs=require('fs'), path=require('path'), os=require('os'), crypto=require('crypto')
const {spawnSync}=require('child_process')
const repo=path.resolve(process.argv[2]||path.join(__dirname,'../..')), salida=path.resolve(process.argv[3])
fs.mkdirSync(salida,{recursive:true})
const perfil=fs.mkdtempSync(path.join(os.tmpdir(),'cipher-cajas-'))
app.setPath('userData',perfil);process.chdir(perfil);delete process.env.VITE_DEV_SERVER_URL
global.fetch=async()=>{throw new Error('A2: red bloqueada en main')}
// Las funciones puras se leen en un proceso que sale ANTES de app.ready.
// Importar el bundle despues de ready abria la app y consultaba proveedores.
if(process.argv.includes('--modelo')) {
  try {
    const b=require(path.join(repo,'dist-electron/main/index.js'))
    if(process.argv.includes('--cota-rota')) b.METRICAS_ETIQUETA.archivo700.emPorCaracter=0.58
    const p=path.join(salida,'dom.json')
    const dom=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null
    const datos={metricas:b.METRICAS_ETIQUETA,geometria:b.GEOMETRIA_CAJA,limite:b.MAX_CARACTERES_ETIQUETA,
      casos:dom?.casos.map(c=>({...c,modeloPx:b.anchoCaja(c.texto,true)*10.8,admitida:b.cabeLaEtiqueta(c.texto)}))}
    fs.writeFileSync(path.join(salida,'modelo.json'),JSON.stringify(datos,null,2)+'\n');app.exit(0)
  }catch(e){console.error(e);app.exit(1)}
}
const lectura=spawnSync(process.execPath,[__filename,repo,salida,'--modelo'],{encoding:'utf8',timeout:10000,windowsHide:true})
if(lectura.status!==0)throw new Error('No se pudo importar el modelo del bundle: '+lectura.stderr)
const registro=JSON.parse(fs.readFileSync(path.join(salida,'modelo.json'),'utf8'))
const alfabeto=registro.metricas.archivo700.alfabeto
const op={ancho:1080,alto:1920,modo:'pantalla',sistema:'voltaje',duracion:3}
const graphic={type:'visual_escena',value:'memoria',label:'',unit:'',emoji:'',extra:{
  direccion:{fondo:'ondas',estructura:'constelacion',camara:'quieto',densidad:'media',ritmo:'regular',tipografia:'archivo'},
  conceptos:[{emoji:'🧠',etiqueta:'recuerdo'},{emoji:'📁',etiqueta:'archivo'},{emoji:'🔗',etiqueta:'conexion'}]}}
let ventana
const reloj=setTimeout(()=>{console.error('watchdog 45s');app.exit(124)},45000)
app.whenReady().then(async()=>{
  let codigo=1
  try {
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_r,cb)=>cb({cancel:true}))
    ventana=new BrowserWindow({show:false,width:1080,height:1928,useContentSize:true,enableLargerThanScreen:true,webPreferences:{offscreen:true,sandbox:true,backgroundThrottling:false}})
    await ventana.loadFile(path.join(repo,'dist/grafico.html'))
    ventana.setContentSize(1080,1928)
    const listo=await ventana.webContents.executeJavaScript('window.__listo()')
    if(listo.avisosFuentes.length)throw new Error(JSON.stringify(listo))
    await ventana.webContents.executeJavaScript(`window.__montar(${JSON.stringify(graphic)},${JSON.stringify(op)});window.__setT(2.999)`)
    const medicion=await ventana.webContents.executeJavaScript(`(async()=>{
      const el=document.querySelector('.es-etq'), caja=el.closest('.es-caja'), emoji=caja.querySelector('.es-mini')
      if(!el||!caja)throw new Error('No se monto la escena real')
      const estilo=getComputedStyle(el), cs=getComputedStyle(caja), es=getComputedStyle(emoji)
      const css={familia:estilo.fontFamily,peso:estilo.fontWeight,fuentePx:estilo.fontSize,interlinea:estilo.lineHeight,kerning:estilo.fontKerning,ligaduras:estilo.fontVariantLigatures,
        espaciado:estilo.letterSpacing,paddingX:cs.paddingLeft,borde:cs.borderLeftWidth,gap:cs.columnGap,
        emojiPx:es.fontSize,emojiAncho:emoji.getBoundingClientRect().width,emojiAlto:emoji.getBoundingClientRect().height}
      const s=document.createElement('span');s.style.cssText='position:absolute;white-space:pre;font:700 1000px Archivo;letter-spacing:normal;font-kerning:'+estilo.fontKerning+';font-variant-ligatures:'+estilo.fontVariantLigatures;document.body.append(s)
      let anchos={};try{for(const c of ${JSON.stringify(alfabeto)}){s.textContent=c;anchos[c]=s.getBoundingClientRect().width/1000}}finally{s.remove()}
      const casos=[]
      for(const texto of ['W'.repeat(56),'W'.repeat(24),'@'.repeat(24),'@'.repeat(25),'M'.repeat(24),'i'.repeat(24),'responsabilidades','transcripcion','ÁÉÍÓÚÜÑ','WWW WWW','W-W',"O'Hara",'AVATAR','漢字','👨‍👩‍👧‍👦']){
        el.textContent=texto;const r=caja.getBoundingClientRect(),t=el.getBoundingClientRect();casos.push({texto,ancho:r.width,alto:r.height,textoAncho:t.width})
      }
      const barrido=[]
      for(const c of ${JSON.stringify(alfabeto)}){
        el.textContent=c.repeat(24);barrido.push({texto:c.repeat(24),ancho:caja.getBoundingClientRect().width})
      }
      el.textContent='W'.repeat(56)
      return {css,anchosEm:anchos,maximo:Math.max(...Object.values(anchos)),casos,barrido}
    })()`)
    const casosManuales=medicion.casos.length
    fs.writeFileSync(path.join(salida,'dom.json'),JSON.stringify({...medicion,casos:[...medicion.casos,...medicion.barrido]},null,2)+'\n')
    const hijo=spawnSync(process.execPath,[__filename,repo,salida,'--modelo',...(process.argv.includes('--cota-rota')?['--cota-rota']:[])],{encoding:'utf8',timeout:10000,windowsHide:true})
    if(hijo.status!==0)throw new Error('Fallo lector puro: '+hijo.stderr)
    const modelo=JSON.parse(fs.readFileSync(path.join(salida,'modelo.json'),'utf8'))
    medicion.casos=modelo.casos.slice(0,casosManuales)
    medicion.barrido=modelo.casos.slice(casosManuales)
    const informe={fechaUTC:new Date().toISOString(),repo,versiones:process.versions,op,graphic,t:2.999,alfabeto,
      arnesSHA256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
      modelo:{metricas:modelo.metricas,geometria:modelo.geometria,limite:modelo.limite},
      fuenteSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'dist/fonts/archivo-var.woff2'))).digest('hex'),listo,...medicion}
    if(medicion.casos.some(c=>c.modeloPx!==null&&c.modeloPx+0.0001<c.ancho))throw new Error('La cota subestima una caja real')
    if(medicion.barrido.some(c=>c.modeloPx<c.ancho))throw new Error('La cota subestima el barrido del alfabeto')
    informe.degenerados=[]
    const casosReales=[
      {id:'limite-24-arrobas',etiquetas:['@'.repeat(24),'archivo','conexion'],estructura:'constelacion',espera:3},
      {id:'56w-respaldo',etiquetas:['W'.repeat(56),'archivo','conexion'],estructura:'constelacion',espera:0},
      {id:'25-arrobas-respaldo',etiquetas:['@'.repeat(25),'archivo','conexion'],estructura:'constelacion',espera:0},
      {id:'cero-conceptos',etiquetas:[],estructura:'constelacion',espera:0},
      {id:'uno-capaspiladas',etiquetas:['responsabilidades'],estructura:'capasApiladas',espera:1},
      {id:'texto-no-medido',etiquetas:['漢字','archivo','conexion'],estructura:'constelacion',espera:0}
    ]
    for(const caso of casosReales){
      const d={...graphic,extra:{...graphic.extra,direccion:{...graphic.extra.direccion,estructura:caso.estructura},
        conceptos:caso.etiquetas.map((etiqueta,i)=>({emoji:graphic.extra.conceptos[i].emoji,etiqueta}))}}
      await ventana.webContents.executeJavaScript(`window.__avisosCiclo=[];window.__montar(${JSON.stringify(d)},${JSON.stringify(op)});window.__setT(2.999)`)
      const dom=await ventana.webContents.executeJavaScript(`({etiquetas:[...document.querySelectorAll('.es-etq')].map(e=>e.textContent),
        cajas:[...document.querySelectorAll('.es-caja')].map(e=>{const r=e.getBoundingClientRect();return{izquierda:r.left,derecha:r.right,ancho:r.width}}),
        texto:document.querySelector('#lienzo').innerText,avisos:window.__avisosCiclo||[]})`)
      if(dom.etiquetas.length!==caso.espera || !dom.texto.includes('memoria'))throw new Error('Camino real inesperado: '+caso.id)
      if(dom.cajas.some(c=>c.izquierda<1080*.0833-.02||c.derecha>1080*.9167+.02))throw new Error('Caja fuera de X: '+caso.id)
      if(caso.espera===0&&!dom.avisos.length)throw new Error('Respaldo sin aviso: '+caso.id)
      // El DOM comprometido no implica que Chromium ya haya pintado. Antes de esta espera
      // la primera captura conservaba las 56 W del sondeo anterior. Camara quieta y t fijo.
      await ventana.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
      ventana.webContents.invalidate()
      await new Promise(r=>setTimeout(r,100))
      const img=await ventana.webContents.capturePage({x:0,y:8,width:1080,height:1920})
      if(img.getSize().width!==1080||img.getSize().height!==1920)throw new Error('Captura no mide 1080x1920')
      fs.writeFileSync(path.join(salida,caso.id+'.png'),img.toPNG())
      informe.degenerados.push({...caso,graphicData:d,dom})
    }
    fs.writeFileSync(path.join(salida,'medidas.json'),JSON.stringify(informe,null,2)+'\n')
    // Hoja de evidencia: imagenes del unico renderer, sin volver a dibujar la composicion.
    // No sustituye las capturas 1080x1920: solo las coloca al 45% con sus condiciones.
    const html='<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#eee;color:#111;font:18px Arial}h1{font-size:25px}main{display:grid;grid-template-columns:repeat(3,486px);gap:16px}figure{margin:0}img{width:486px;height:864px}figcaption{height:84px;font-size:17px;overflow-wrap:anywhere}</style>'+
      '<h1>A.2 · Cajas: cota y puerta · escala 45%</h1><p>1080×1920 → 486×864 · t=2.999 s / ciclo 3 s · ondas · quieto · media · regular · Archivo · voltaje · palabra: memoria</p><main>'+
      informe.degenerados.map(c=>'<figure><figcaption>'+c.id+' · '+c.estructura+'<br>conceptos: '+c.etiquetas.join(' | ')+'</figcaption><img src="data:image/png;base64,'+fs.readFileSync(path.join(salida,c.id+'.png')).toString('base64')+'"></figure>').join('')+'</main>'
    await ventana.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html))
    ventana.setContentSize(1540,2090)
    await ventana.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))')
    await new Promise(r=>setTimeout(r,150))
    const hoja=await ventana.webContents.capturePage()
    if(hoja.getSize().width!==1540||hoja.getSize().height!==2090)throw new Error('Hoja de dimensiones inesperadas')
    fs.writeFileSync(path.join(salida,'hoja-a2-cota-y-degenerados-45pct.png'),hoja.toPNG())
    console.log(JSON.stringify({maximo:informe.maximo,limite:modelo.limite,
      casos:informe.casos,degenerados:informe.degenerados.map(c=>({id:c.id,...c.dom}))},null,2));codigo=0
  }catch(e){console.error(e)}finally{clearTimeout(reloj);if(ventana&&!ventana.isDestroyed())ventana.destroy();app.exit(codigo)}
})
