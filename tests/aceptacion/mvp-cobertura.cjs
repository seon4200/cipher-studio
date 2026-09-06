// Banco REAL en Chrome; una pieza por documento, sin colisiones de keyframes.
// npm run banco -- --port 5176; node tests/aceptacion/mvp-cobertura.cjs
// No genera video ni llama APIs. Capturas 486x960, de ellas 486x864 de escena (45%).
const {chromium}=require('playwright-core')
const fs=require('fs'),path=require('path')
const salida=path.resolve(__dirname,'mvp-paso7'),origen='http://127.0.0.1:5176'
const ejes=['estructura','fondo','camara','tipografia','densidad','ritmo','sistema']
let browser,progreso=Date.now(),etapa='inicio'
const marcar=s=>{etapa=s;progreso=Date.now();console.log(s)}
const watchdog=setInterval(async()=>{if(Date.now()-progreso>45000){console.error('BLOQUEADO',etapa);await browser?.close();process.exit(124)}},1000)
const guardar=(nombre,b)=>{if(!b.length)throw Error('PNG vacio');const p=path.join(salida,nombre);fs.writeFileSync(p,b);return p}
;(async()=>{
  fs.mkdirSync(salida,{recursive:true})
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
  const context=await browser.newContext({viewport:{width:2052,height:1600},deviceScaleFactor:1})
  await context.route('**/*',route=>new URL(route.request().url()).origin===origen?route.continue():route.abort())
  const page=await context.newPage()
  const evidencia={fecha:new Date().toISOString(),navegador:browser.version(),escala:.45,t:1.5,ciclo:3,lienzo:[1080,1920],miniatura:[486,864],casos:[],imagenes:[],errores:[],
    metodo:'Cada pieza en un documento recargado. Montaje PNG sin reescalar. Emoji de Chrome no identico al de Electron: ver emoji.json.'}
  page.on('pageerror',e=>evidencia.errores.push(String(e)))
  const cargar=async url=>{await page.goto(url);await page.waitForSelector('[data-fuentes="ok"]');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
  for(const eje of ejes){
    marcar(eje+' inventario');await cargar(`${origen}/banco.html?vista=cobertura&eje=${eje}&t=1.5`)
    const lista=await page.evaluate(()=>JSON.parse(document.querySelector('[data-inventario]').dataset.inventario)),celdas=[]
    for(const c of lista){
      marcar(`${eje}:${c.id}`)
      await cargar(`${origen}/banco.html?vista=cobertura&eje=${eje}&caso=${encodeURIComponent(eje+':'+c.id)}&t=1.5`)
      const dato=await page.evaluate(()=>{const el=document.querySelector('[data-caso]'),r=el.getBoundingClientRect();return {
        caso:el.dataset.caso,puede:el.dataset.puede,direccion:JSON.parse(el.dataset.direccion),sistema:el.dataset.sistema,
        palabra:el.querySelector('.es-pie-tit')?.textContent??null,cajas:el.querySelectorAll('.es-mini').length,
        keyframes:[...el.querySelectorAll('style')].reduce((n,s)=>n+[...s.sheet.cssRules].filter(r=>r.type===CSSRule.KEYFRAMES_RULE).length,0),
        rect:{x:r.x,y:r.y,width:r.width,height:r.height}}})
      if(dato.puede!=='true'||dato.palabra!=='memoria'||dato.keyframes===0)throw Error('Pieza sin composicion: '+JSON.stringify(dato))
      if(dato.rect.width!==486||dato.rect.height!==960)throw Error('Escala/celda incorrecta: '+JSON.stringify(dato.rect))
      const png=await page.screenshot({clip:dato.rect})
      if(png.readUInt32BE(16)!==486||png.readUInt32BE(20)!==960)throw Error('PNG recortado')
      evidencia.casos.push(dato);celdas.push('data:image/png;base64,'+png.toString('base64'))
    }
    const alto=180+Math.ceil(celdas.length/4)*980
    const b64=await page.evaluate(async({eje,celdas,alto})=>{
      const c=document.createElement('canvas');c.width=2052;c.height=alto;const ctx=c.getContext('2d');
      ctx.fillStyle='#10141b';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#fff';ctx.font='bold 28px Arial';
      ctx.fillText(`MVP · ${eje} · ESCALA 45% · documento aislado por pieza`,20,40);ctx.font='20px Arial';
      ctx.fillText('1080×1920 → 486×864 · visual_escena · memoria · t=1.500 s / ciclo 3 s',20,78);
      ctx.fillText('Conceptos: recuerdo / archivo / conexion. Direccion y sistema rotulados por celda.',20,110);
      ctx.fillText('Chrome 152: emoji distinto de Electron. Montaje comprobado, no calidad ni movimiento completo.',20,143);
      for(let n=0;n<celdas.length;n++){const i=new Image();i.src=celdas[n];await i.decode();ctx.drawImage(i,20+n%4*506,180+Math.floor(n/4)*980)}
      return c.toDataURL('image/png').split(',')[1]
    },{eje,celdas,alto})
    const png=guardar(`cobertura-${eje}-45pct.png`,Buffer.from(b64,'base64'))
    evidencia.imagenes.push({eje,png,alto});marcar(eje+' completo: '+lista.length)
  }
  const partes=evidencia.imagenes.map(x=>({alto:x.alto,url:'data:image/png;base64,'+fs.readFileSync(x.png).toString('base64')}))
  const b64=await page.evaluate(async partes=>{
    const c=document.createElement('canvas');c.width=2052;c.height=partes.reduce((a,p)=>a+p.alto,0);const ctx=c.getContext('2d');let y=0;
    for(const p of partes){const i=new Image();i.src=p.url;await i.decode();ctx.drawImage(i,0,y);y+=p.alto}return c.toDataURL('image/png').split(',')[1]
  },partes)
  evidencia.completa=guardar('hoja-completa-45pct.png',Buffer.from(b64,'base64'))
  fs.writeFileSync(path.join(salida,'cobertura.json'),JSON.stringify(evidencia,null,2))
  if(evidencia.errores.length)throw Error(JSON.stringify(evidencia.errores))
  await browser.close();clearInterval(watchdog)
})().catch(async e=>{console.error(e);await browser?.close();clearInterval(watchdog);process.exitCode=1})
