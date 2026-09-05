const {app,BrowserWindow,session}=require('electron')
app.on('window-all-closed',()=>{})
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto')
process.on('uncaughtException',e=>{console.error(e);app.exit(1)})
process.on('unhandledRejection',e=>{console.error(e);app.exit(1)})
const repo=path.resolve(process.argv[2]),out=path.resolve(process.argv[3])
const corpus=JSON.parse(fs.readFileSync(path.join(out,'corpus-posiciones.json')))
if(corpus.casos.length!==107||corpus.casos.some(c=>c.conceptos.length!==3))throw Error('Corpus incompleto')
const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'cipher-a3-solapes-'))
app.setPath('userData',path.join(runtime,'perfil'));process.chdir(runtime);delete process.env.VITE_DEV_SERVER_URL
global.fetch=async()=>{throw Error('Sin red')}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex')
const reloj=setTimeout(()=>{console.error('Watchdog 600s');app.exit(124)},600000)
let w
app.whenReady().then(async()=>{
 let exit=1
 try{
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_r,cb)=>cb({cancel:true}))
  const resultados=[]
  for(const [subida,tamano]of [[0,2.9],[20,3.48],[35,3.915]]){
   const dist=path.join(runtime,'dist-'+subida);fs.cpSync(path.join(repo,'dist'),dist,{recursive:true})
   // Sondeo controlado: solo el literal de la metrica del bundle generado. CSS Y layout
   // siguen consumiendo el MISMO registro; no se cambia solamente el CSS ni la derivacion.
   const chunks=fs.readdirSync(path.join(dist,'assets')).filter(n=>n.endsWith('.js'))
   let cambios=0,chunkSHA
   for(const n of chunks){const p=path.join(dist,'assets',n),s=fs.readFileSync(p,'utf8');const matches=[...s.matchAll(/fuenteCqmin:(\d+(?:\.\d+)?)/g)];if(matches.length){if(matches.length!==1)throw Error('Literal ambiguo');const nuevo=s.replace(matches[0][0],'fuenteCqmin:'+tamano);fs.writeFileSync(p,nuevo);cambios++;chunkSHA={antes:sha(s),despues:sha(nuevo),literalOriginal:matches[0][0]}}}
   if(cambios!==1)throw Error('No hay exactamente una metrica en el bundle')
   w=new BrowserWindow({show:false,width:1080,height:1928,useContentSize:true,enableLargerThanScreen:true,webPreferences:{offscreen:true,sandbox:true,backgroundThrottling:false}})
   await w.loadFile(path.join(dist,'grafico.html'));w.setContentSize(1080,1928)
   const fuentes=await w.webContents.executeJavaScript('window.__listo()');if(fuentes.avisosFuentes.length)throw Error('Fuentes ausentes')
   const casos=[]
   for(const [ordinal,c]of corpus.casos.entries()){
    const gd={type:'visual_escena',value:c.value,extra:{conceptos:c.conceptos,direccion:c.direccion}}
    await w.webContents.executeJavaScript(`window.__montar(${JSON.stringify(gd)},{ancho:1080,alto:1920,duracion:3,fps:30,modo:'pantalla',sistema:'voltaje'});window.__setT(2.999)`)
    let d,peor=-1;const frames=[];
    for(const t of [...Array.from({length:90},(_,i)=>i/30),2.999]){
    await w.webContents.executeJavaScript('window.__setT('+t+')');
    const actual=await w.webContents.executeJavaScript(`(()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
      const area=r=>r.w*r.h;
      const inter=(a,b)=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-x),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-y);return {x,y,w,h}};
      const els=[...document.querySelectorAll('.es-caja')];
      const cajas=els.map(e=>{const t=e.querySelector('.es-etq');let opacidad=1;for(let p=e;p;p=p.parentElement)opacidad*=Number(getComputedStyle(p).opacity);return {rect:rect(e),texto:rect(t),etiqueta:t.textContent,fontSize:getComputedStyle(t).fontSize,opacidad}});
      const pares=[];for(let i=0;i<cajas.length;i++)for(let j=i+1;j<cajas.length;j++){
        const visibles=cajas[i].opacidad>0&&cajas[j].opacidad>0;
        const r=inter(cajas[i].rect,cajas[j].rect),a=visibles?area(r):0;
        pares.push({i,j,interseccion:r,area:a,fraccion:a/(Math.min(area(cajas[i].rect),area(cajas[j].rect))||1),textoIntersecado:visibles?area(inter(cajas[i].texto,cajas[j].rect)):0});
      }
      return {cajas,pares};
    })()`)
    const max=Math.max(...actual.pares.map(p=>p.fraccion));frames.push({t,pares:actual.pares.filter(p=>p.area>0||p.textoIntersecado>0)});
    if(max>=peor){d={...actual,t};peor=max}
    }
    if(d.cajas.length!==3||d.cajas.some(x=>Math.abs(parseFloat(x.fontSize)-tamano*10.8)>.001))throw Error('Puerta o tamano distinto, linea '+c.linea)
    const dato={linea:c.linea,value:c.value,direccion:c.direccion,...d,frames};casos.push(dato)
    if(d.pares.some(p=>p.area>0)){
      await w.webContents.executeJavaScript('window.__setT('+d.t+')');
      await w.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');w.webContents.invalidate();await new Promise(r=>setTimeout(r,100))
      const nombre='solape-'+subida+'-'+c.linea+'.png';fs.writeFileSync(path.join(out,nombre),(await w.webContents.capturePage({x:0,y:8,width:1080,height:1920})).toPNG());dato.captura=nombre
    }
    if(ordinal%20===0)console.log('Progreso '+subida+': '+(ordinal+1)+'/107')
   }
   w.destroy();w=null
   const fila={subida,tamano,chunkSHA,conSolape:casos.filter(c=>c.pares.some(p=>p.area>0)).length,
     conTextoIntersecado:casos.filter(c=>c.frames.some(f=>f.pares.some(p=>p.textoIntersecado>0))).length,
     fraccionMaxima:Math.max(...casos.flatMap(c=>c.pares.map(p=>p.fraccion))),casos}
   resultados.push(fila);fs.writeFileSync(path.join(out,'solapes.json'),JSON.stringify({condiciones:{composicion:'visual_escena',tiempos:'0..89/30 mas 2.999; 91 instantes, no continuidad entre frames',ciclo:3,ancho:1080,alto:1920,sistema:'voltaje',metodo:'interseccion DOM AABB; solo cajas con opacidad ancestral >0; textoIntersecado es rectangulo del span inferior contra caja posterior, NO mascara de tinta; esquinas redondeadas pueden reducir interseccion pintada',variacion:'copias temporales del bundle; unico literal fuenteCqmin; mantiene acoplados CSS y layout',versiones:process.versions,runtime,arnesSHA256:sha(fs.readFileSync(__filename))},corpusSHA256:sha(fs.readFileSync(path.join(out,'corpus-posiciones.json'))),resultados},null,2)+'\n')
   console.log(JSON.stringify({subida,conSolape:fila.conSolape,conTextoIntersecado:fila.conTextoIntersecado,fraccionMaxima:fila.fraccionMaxima}))
  }
  exit=0
 }catch(e){console.error(e)}finally{clearTimeout(reloj);if(w&&!w.isDestroyed())w.destroy();app.exit(exit)}
})
