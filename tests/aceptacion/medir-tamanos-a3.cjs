// A.3: sondeo de tamanos sobre la caja REAL y puertas del bundle compilado.
// --aplicado comprueba el tamano elegido SIN override CSS ni mutacion del registro.
const {app,BrowserWindow,session}=require('electron')
// Tambien un fallo ANTES de app.ready (p. ej. fixture ausente) debe terminar rojo.
process.on('uncaughtException',e=>{console.error(e);app.exit(1)})
process.on('unhandledRejection',e=>{console.error(e);app.exit(1)})
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto')
const {spawnSync}=require('child_process')
const repo=path.resolve(process.argv[2]),salida=path.resolve(process.argv[3])
const aplicado=process.argv.includes('--aplicado'),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const git=spawnSync('git',['-c','safe.directory='+repo,'--no-optional-locks','rev-parse','HEAD'],{cwd:repo,encoding:'utf8',windowsHide:true})
if(git.status!==0)throw new Error('No se pudo registrar el commit de partida')
const procedencia={commitPartida:git.stdout.trim(),
  metricaFuenteSHA256:sha(fs.readFileSync(path.join(repo,'src/shared/metricas-caja.ts'))),
  arnesSHA256:sha(fs.readFileSync(__filename))}
fs.mkdirSync(salida,{recursive:true})
const perfil=fs.mkdtempSync(path.join(os.tmpdir(),'cipher-a3-'))
app.setPath('userData',perfil);process.chdir(perfil);delete process.env.VITE_DEV_SERVER_URL
global.fetch=async()=>{throw new Error('A3: sin red')}
const fixturePath=path.join(repo,'tests/aceptacion/plan-a2-impacto-20260905/etiquetas.json')
const previo=JSON.parse(fs.readFileSync(path.join(repo,'tests/aceptacion/plan-a2-20260905/medidas.json'),'utf8'))
const f=JSON.parse(fs.readFileSync(fixturePath,'utf8'))
const grupos=f.lineas.filter(l=>l.texto.includes('CONCEPTOS lote=')&&l.texto.includes('saneado=OK')).map(l=>{
  const s=l.texto.match(/saneado=OK  (.+)  frase=/)?.[1]
  if(!s)throw new Error('Formato desconocido')
  return s.split(' | ').map(c=>c.slice(c.indexOf(' ')+1))
})
const etiquetas=grupos.flat()
if(grupos.length!==107||etiquetas.length!==321||etiquetas.some(e=>e.length>=24))throw new Error('Corpus incompleto o censurado')
const base=previo.modelo.metricas.archivo700.fuenteCqmin
if(process.argv.includes('--modelo')){
  try{
    const b=require(path.join(repo,'dist-electron/main/index.js'))
    const m=b.METRICAS_ETIQUETA[b.METRICA_ETIQUETA],original=m.fuenteCqmin
    const longitudes=etiquetas.map(e=>e.length).sort((a,b)=>a-b)
    const percentil=p=>longitudes[Math.ceil(p*longitudes.length)-1]
    const histograma={};for(const n of longitudes)histograma[n]=(histograma[n]||0)+1
    const filas=[]
    try{
      for(const subida of aplicado?[null]:[0,20,35,50]){
        if(subida!==null)m.fuenteCqmin=base*(1+subida/100)
        // Barrido de la puerta real, no la formula inversa ni MAX cacheado al importar.
        let limite=0;while(limite<80&&b.cabeLaEtiqueta('@'.repeat(limite+1)))limite++
        const intervalo=e=>(b.ZONA_X_MAX-b.ZONA_X_MIN-b.anchoCaja(e,true))*10.8
        filas.push({subida,fuenteCqmin:m.fuenteCqmin,fuentePx:m.fuenteCqmin*10.8,limite,
          rechazos:etiquetas.filter(e=>!b.cabeLaEtiqueta(e)).length,
          gruposRechazados:grupos.filter(g=>g.some(e=>!b.cabeLaEtiqueta(e))).length,
          vacios:etiquetas.filter(e=>intervalo(e)<0).length,
          intervaloMinimoPx:Math.min(...etiquetas.map(intervalo)),
          referencia:{texto:'responsabilidades',caracteres:'responsabilidades'.length,
            admitida:b.cabeLaEtiqueta('responsabilidades'),intervaloPx:intervalo('responsabilidades')},
          maximoExportado:subida===null?b.MAX_CARACTERES_ETIQUETA:null,
          modelos:Object.fromEntries([...new Set([...etiquetas,'responsabilidades',...Array.from({length:28},(_,i)=>'@'.repeat(i+1)),...m.alfabeto.split('').map(c=>c.repeat(limite))])]
            .map(e=>[e,{modeloPx:b.anchoCaja(e,true)*10.8,admitida:b.cabeLaEtiqueta(e)}])),
          metricas:JSON.parse(JSON.stringify(b.METRICAS_ETIQUETA)),geometria:b.GEOMETRIA_CAJA})
      }
    }finally{m.fuenteCqmin=original}
    fs.writeFileSync(path.join(salida,'modelo.json'),JSON.stringify({base,histograma,
      distribucion:{n:321,mediana:percentil(.5),p90:percentil(.9),p99:percentil(.99),maximo:percentil(1),metodo:'nearest-rank, incluyendo repeticiones'},
      filas,zonaAnchoPx:(b.ZONA_X_MAX-b.ZONA_X_MIN)*10.8,
      bundleSHA256:sha(fs.readFileSync(path.join(repo,'dist-electron/main/index.js')))},null,2)+'\n')
    app.exit(0)
  }catch(e){console.error(e);app.exit(1)}
}else{
  const hijo=spawnSync(process.execPath,[__filename,repo,salida,'--modelo',...(aplicado?['--aplicado']:[])],{encoding:'utf8',timeout:15000,windowsHide:true})
  if(hijo.status!==0)throw new Error('Fallo modelo: '+hijo.stderr)
  const modelo=JSON.parse(fs.readFileSync(path.join(salida,'modelo.json'),'utf8'))
  let w;const reloj=setTimeout(()=>{console.error('A3 watchdog 60 s');app.exit(124)},60000)
  app.whenReady().then(async()=>{
    let codigo=1
    try{
      session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_r,cb)=>cb({cancel:true}))
      w=new BrowserWindow({show:false,width:1080,height:1928,useContentSize:true,enableLargerThanScreen:true,
        webPreferences:{offscreen:true,sandbox:true,backgroundThrottling:false}})
      await w.loadFile(path.join(repo,'dist/grafico.html'));w.setContentSize(1080,1928)
      const listo=await w.webContents.executeJavaScript('window.__listo()')
      if(listo.avisosFuentes.length)throw new Error('Fuentes no verificadas')
      const hashFuente=sha(fs.readFileSync(path.join(repo,'dist/fonts/archivo-var.woff2')))
      if(hashFuente!==previo.fuenteSHA256)throw new Error('Cambio la fuente: no usar la cota heredada')
      const graphic={...previo.graphic,extra:{...previo.graphic.extra,conceptos:[
        {emoji:'🧠',etiqueta:'recuerdo'},{emoji:'📁',etiqueta:'archivo'},{emoji:'🔗',etiqueta:'conexion'}]}}
      await w.webContents.executeJavaScript(`window.__montar(${JSON.stringify(graphic)},${JSON.stringify(previo.op)});window.__setT(2.999)`)
      const resultados=[]
      for(const fila of modelo.filas){
        const dom=await w.webContents.executeJavaScript(`(()=>{
          const el=document.querySelector('.es-etq'),caja=el.closest('.es-caja');
          if(${JSON.stringify(!aplicado)})el.style.fontSize=${JSON.stringify(fila.fuenteCqmin+'cqmin')};
          const css=getComputedStyle(el),r=[];
          for(const texto of ${JSON.stringify(Object.keys(fila.modelos))}){el.textContent=texto;const b=caja.getBoundingClientRect();r.push({texto,ancho:b.width,alto:b.height});}
          return {css:{familia:css.fontFamily,peso:css.fontWeight,fuentePx:css.fontSize,interlinea:css.lineHeight,espaciado:css.letterSpacing,kerning:css.fontKerning,ligaduras:css.fontVariantLigatures},casos:r};
        })()`)
        const casos=dom.casos.map(c=>({...c,...fila.modelos[c.texto]}))
        if(casos.some(c=>c.modeloPx+.001<c.ancho))throw new Error('La cota subestima el DOM a '+fila.subida)
        const limiteDom=Math.max(...casos.filter(c=>/^@+$/.test(c.texto)&&c.ancho<=modelo.zonaAnchoPx).map(c=>c.texto.length))
        if(limiteDom!==fila.limite)throw new Error('Puerta y frontera DOM discrepan: '+fila.subida)
        if(aplicado&&fila.limite!==fila.maximoExportado)throw new Error('MAX exportado no coincide con la puerta')
        const {modelos,...resumen}=fila
        resultados.push({...resumen,limiteDom,...dom,casos})
      }
      const informe={fechaUTC:new Date().toISOString(),procedencia,
        condiciones:{composicion:'visual_escena',ancho:1080,alto:1920,t:2.999,ciclo:3,sistema:'voltaje',
          direccion:graphic.extra.direccion,modo:aplicado?'render aplicado sin override':'sonda de tamano: override CSS y metrica SOLO en memoria',
          versiones:process.versions,fuenteSHA256:hashFuente,fixtureSHA256:sha(fs.readFileSync(fixturePath)),bundleSHA256:modelo.bundleSHA256},
        distribucion:modelo.distribucion,histograma:modelo.histograma,filas:resultados}
      fs.writeFileSync(path.join(salida,'medidas.json'),JSON.stringify(informe,null,2)+'\n')
      if(aplicado){
        const fila=resultados[0],capturas=[]
        for(const [id,etq,espera] of [['referencia-17','responsabilidades',3],['limite', '@'.repeat(fila.limite),3],['limite-mas-uno','@'.repeat(fila.limite+1),0]]){
          const d={...graphic,extra:{...graphic.extra,conceptos:[{emoji:'🧠',etiqueta:etq},...graphic.extra.conceptos.slice(1)]}}
          await w.webContents.executeJavaScript(`window.__avisosCiclo=[];window.__montar(${JSON.stringify(d)},${JSON.stringify(previo.op)});window.__setT(2.999)`)
          await w.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');w.webContents.invalidate();await new Promise(r=>setTimeout(r,150))
          const dom=await w.webContents.executeJavaScript(`({etiquetas:[...document.querySelectorAll('.es-etq')].map(e=>e.textContent),
            tipografia:Object.fromEntries(['.es-etq','.es-pie-tit','.es-mini'].map(s=>{const e=document.querySelector(s),c=e&&getComputedStyle(e);return [s,c?{fuentePx:c.fontSize,altoLinea:c.lineHeight,espaciado:c.letterSpacing}:null]})),
            cajas:[...document.querySelectorAll('.es-caja')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,ancho:r.width,alto:r.height}}),
            avisos:window.__avisosCiclo||[],texto:document.querySelector('#lienzo').innerText})`)
          if(dom.etiquetas.length!==espera||(espera===0&&!dom.avisos.length))throw new Error('Puerta real inesperada '+id)
          fs.writeFileSync(path.join(salida,id+'.png'),(await w.webContents.capturePage({x:0,y:8,width:1080,height:1920})).toPNG())
          capturas.push({id,graphicData:d,dom})
        }
        informe.capturas=capturas
        // Hoja de inspeccion: solo compone los PNG reales, no deriva ni dibuja escenas.
        // Esperar rAF/150 ms no demuestra completitud: los PNG deben MIRARSE.
        const rotulos=['17 letras reales: responsabilidades','Limite: '+fila.limite+' @','Uno mas: respaldo visible']
        const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#eee;color:#111;font:16px Arial}header{padding:16px;height:80px;box-sizing:border-box}main{display:flex;gap:12px;padding:0 12px}section{width:486px}h2{font-size:16px;margin:8px 0}img{display:block;width:486px;height:864px}footer{padding:12px;font-size:14px}</style><header>A.3 · etiquetas +${Math.round((fila.fuenteCqmin/base-1)*100)}% · Archivo 700 · ${Number(fila.fuentePx.toFixed(4))} px a 1080×1920<br>visual_escena · memoria · ondas / constelacion / quieto / media / regular / archivo · voltaje · t=2,999 s / ciclo 3 s · miniatura 45%</header><main>${capturas.map((c,i)=>'<section><h2>'+rotulos[i]+'</h2><img src="data:image/png;base64,'+fs.readFileSync(path.join(salida,c.id+'.png')).toString('base64')+'"></section>').join('')}</main><footer>Solapes entre vecinos pendientes de B. Esta hoja no certifica separacion ni completitud del compositor. Puerta y cota medidas en medidas.json.</footer>`
        w.setContentSize(1506,1050);await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html))
        await w.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))')
        await w.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');w.webContents.invalidate();await new Promise(r=>setTimeout(r,150))
        fs.writeFileSync(path.join(salida,'hoja-a3-etiquetas-mas'+Math.round((fila.fuenteCqmin/base-1)*100)+'.png'),(await w.webContents.capturePage()).toPNG())
        fs.writeFileSync(path.join(salida,'medidas.json'),JSON.stringify(informe,null,2)+'\n')
      }
      console.log(JSON.stringify({distribucion:modelo.distribucion,filas:resultados.map(({casos,metricas,geometria,...r})=>r)},null,2));codigo=0
    }catch(e){console.error(e)}finally{clearTimeout(reloj);if(w&&!w.isDestroyed())w.destroy();app.exit(codigo)}
  })
}
