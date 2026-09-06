// Inspeccion de un export YA GENERADO. No vuelve a generar ni llama a una API.
// Reconstruye las condiciones y las acepta SOLO si hashGrafico coincide con el MP4 real.
const {app,BrowserWindow,session}=require('electron')
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto')
const {execFileSync}=require('child_process')
const repo=path.resolve(__dirname,'../..'),salida=path.join(__dirname,'mvp-paso7')
const proyecto=path.join(repo,'proyectos/video-3-1788402898964'),datos=JSON.parse(fs.readFileSync(path.join(proyecto,'mvp-paso7/generar.json'),'utf8'))
const estado=JSON.parse(fs.readFileSync(path.join(proyecto,'project-state.json'),'utf8'))
const video=datos.exportacion.filePath,framesDir=path.join(proyecto,'mvp-paso7/fotogramas')
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cipher-video-inspeccion-')))
global.fetch=async()=>{throw Error('Inspeccion sin red')}
app.whenReady().then(async()=>{
  session.defaultSession.webRequest.onBeforeRequest((r,cb)=>cb({cancel:/^https?:/.test(r.url)}))
  const b=require(path.join(repo,'dist-electron/main/index.js'))
  const sistema=b.sistemaDeGeneracion(proyecto),casos=[]
  const trazas=new Map((datos.generacion.trazabilidadGraficos||[]).map(t=>[t.id,t.graphicData]))
  fs.mkdirSync(framesDir,{recursive:true})
  for(const clip of datos.generacion.clips){
    if(clip.category!=='visual')continue
    // Se exige la entrada exacta que produjo el MP4. Reconstruirla desde el log pierde
    // `ancla` y `relacion`, ambas hashables, y convierte una hoja de evidencia en conjetura.
    const graphicData=trazas.get(clip.id)
    if(!graphicData)throw Error('El clip visual no conserva graphicData: '+clip.id)
    const palabra=graphicData.value
    const hash=path.basename(clip.path,'.mp4'),metrica=datos.metricas.find(m=>m.hash===hash)
    let duracionHash=null
    if(metrica)for(let centesima=Math.floor(metrica.totalFrames/30*100)-2;centesima<=Math.ceil(metrica.totalFrames/30*100)+2;centesima++){
      const d=centesima/100
      if(b.hashGrafico(graphicData,1080,1920,d,30,'pantalla',sistema)===hash)duracionHash=d
    }
    if(duracionHash===null)throw Error('No se pudo verificar condiciones por hash: '+hash)
    const instante=clip.startSeconds+Math.min(clip.durationSeconds*.6,1.5)
    const png=path.join(framesDir,`${String(casos.length+1).padStart(2,'0')}-${hash}.png`)
    execFileSync('ffmpeg',['-v','error','-y','-ss',String(instante),'-i',video,'-frames:v','1',png],{timeout:30000})
    if(!fs.existsSync(png)||!fs.statSync(png).size)throw Error('Fotograma ausente')
    casos.push({id:clip.id,hash,graphicData,duracionHash,instante,archivo:png,sha256:crypto.createHash('sha256').update(fs.readFileSync(png)).digest('hex')})
    console.log('fotograma',casos.length,palabra,hash)
  }
  const ffprobe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',video],{encoding:'utf8'}))
  const total=k=>datos.metricas.reduce((a,m)=>a+m[k],0)
  const resultado={video,sistema,ffprobe,casos,visuales:casos.length,
    palabrasDistintas:new Set(casos.map(c=>c.graphicData.value)).size,
    identidadesDistintas:new Set(casos.map(c=>JSON.stringify(c.graphicData.extra.direccion))).size,
    fotogramasDistintos:new Set(casos.map(c=>c.sha256)).size,
    coste:{renders:datos.metricas.length,frames:total('totalFrames'),ms:total('ms'),msPorFrame:total('ms')/total('totalFrames'),intentosPorFrame:total('intentosTotales')/total('totalFrames'),framesEnElTope:total('framesEnElTope')},
    resumen:datos.avisos.findLast(a=>a.tipo==='resumen'),
    energiaExcesiva:casos.filter(c=>b.FONDOS_ESCENA[c.graphicData.extra.direccion.fondo].energia+b.CAMARAS_ESCENA[c.graphicData.extra.direccion.camara].energia>3).map(c=>({palabra:c.graphicData.value,direccion:c.graphicData.extra.direccion}))}
  fs.writeFileSync(path.join(salida,'video.json'),JSON.stringify(resultado,null,2))
  const w=new BrowserWindow({show:false,webPreferences:{sandbox:true}});await w.loadURL('about:blank')
  const partes=casos.map(c=>({palabra:c.graphicData.value,t:c.instante.toFixed(3),url:'data:image/png;base64,'+fs.readFileSync(c.archivo).toString('base64')}))
  const png=await w.webContents.executeJavaScript(`(async()=>{
    const partes=${JSON.stringify(partes)},c=document.createElement('canvas');c.width=4*344+20;c.height=130+Math.ceil(partes.length/4)*636;
    const ctx=c.getContext('2d');ctx.fillStyle='#10141b';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='white';ctx.font='24px Arial';
    ctx.fillText('VIDEO REAL · fotograma al 60% del clip (max 1.5 s) · escala 30%',20,40);
    ctx.font='20px Arial';ctx.fillText('1080×1920 → 324×576. Extraidos del MP4 exportado, no del banco.',20,80);
    for(let n=0;n<partes.length;n++){const p=partes[n],x=20+n%4*344,y=130+Math.floor(n/4)*636;
      ctx.fillText((n+1)+'. '+p.palabra+' · '+p.t+' s',x,y-12);const i=new Image();i.src=p.url;await i.decode();ctx.drawImage(i,x,y,324,576)}return c.toDataURL('image/png').split(',')[1]
  })()`)
  fs.writeFileSync(path.join(salida,'video-fotogramas-30pct.png'),Buffer.from(png,'base64'))
  console.log(JSON.stringify({...resultado,casos:casos.length,ffprobe:undefined}))
  w.destroy();app.exit(0)
}).catch(e=>{console.error(e);app.exit(1)})
