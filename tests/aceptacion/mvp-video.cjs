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
  const log=fs.readFileSync(path.join(repo,'generation-debug.log'),'utf8').split('\n').filter(l=>l.slice(1,25)>=datos.inicio)
  const sistema=b.sistemaDeGeneracion(proyecto),casos=[],porFrase={}
  fs.mkdirSync(framesDir,{recursive:true})
  for(const clip of datos.generacion.clips){
    const indice=porFrase[clip.phraseIdx]||0;porFrase[clip.phraseIdx]=indice+1
    if(clip.category!=='visual')continue
    const seg=estado.transcriptSegments[clip.phraseIdx],dur=seg.end-seg.start,n=dur>4?Math.ceil(dur/3):1
    const palabra=b.palabraDelTramo(seg.words,seg.start+dur*indice/n,seg.start+dur*(indice+1)/n)
    const pos=`${clip.phraseIdx}:${indice}`
    const linea=log.find(l=>l.includes(` pos=${pos} `)&&l.includes('saneado=OK'))
    const conceptos=linea?linea.split('saneado=OK  ')[1].split('  frase=')[0].split(' | ').map(s=>{
      const espacio=s.indexOf(' ');return {emoji:s.slice(0,espacio),etiqueta:s.slice(espacio+1)}
    }):null
    const graphicData={type:'visual_escena',value:palabra,extra:{pos,conceptos,direccion:b.direccionDe(b.semillaDe(palabra),{texto:palabra,conceptos:conceptos||[]})}}
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
