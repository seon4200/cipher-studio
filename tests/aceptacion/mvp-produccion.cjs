// Aceptacion EXPLICITA de produccion: usa guion/voz existentes, APIs reales y cache real.
// electron tests/aceptacion/mvp-produccion.cjs <proyecto> mix|generar
// Conserva el estado anterior antes de guardar; no cambia ningun otro proyecto.
const {app, ipcMain, dialog, BrowserWindow} = require('electron')
const fs = require('fs')
const path = require('path')
const repo = path.resolve(__dirname, '../..')
const proyecto = path.resolve(process.argv[2] || '')
const modo = process.argv[3]
const resultado = {proyecto, modo, inicio: new Date().toISOString(), avisos: [], metricas: []}
let quitarObservador
let latido = Date.now()
const logPath = path.join(repo,'generation-debug.log')
let offsetLog = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0
const watchdog = setInterval(() => {
  if(fs.existsSync(logPath)) {
    const size=fs.statSync(logPath).size
    if(size>offsetLog) {
      const fd=fs.openSync(logPath,'r'), data=Buffer.alloc(size-offsetLog)
      fs.readSync(fd,data,0,data.length,offsetLog);fs.closeSync(fd);offsetLog=size;latido=Date.now()
      if(/el frame \d+ no llego tras 5 intentos/.test(data.toString('utf8'))) {
        console.error('PARADA: perdida real de un frame, ver generation-debug.log');app.exit(3)
      }
    }
  }
  if (Date.now() - latido > 240000) { console.error('Sin progreso durante 4 minutos'); app.exit(2) }
}, 10000)
const evento = {sender:{isDestroyed:()=>false,send:(canal,carga)=>{
  latido=Date.now()
  if(canal==='generation-aviso') resultado.avisos.push(carga)
  if(canal==='generation-progress' || canal==='export-progress') console.log(canal,JSON.stringify(carga))
}}}
const llamar=(canal,arg)=>ipcMain._invokeHandlers.get(canal)(evento,arg)
async function esperarVentanaPrincipal() {
  // El modulo principal se carga DESPUES de app.whenReady() en este arnes. Esperar su
  // ventana evita invocar export-video antes de que su `win` privado exista; sin ella el
  // arnes declaraba fallida una generacion cuyos assets ya se habian creado correctamente.
  for (let intento = 0; intento < 50; intento++) {
    if (BrowserWindow.getAllWindows().some(w => !w.isDestroyed())) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error('Ventana principal no disponible tras 5s')
}
app.whenReady().then(async()=>{
  if(!['mix','generar'].includes(modo)) throw Error('Modo requerido: mix o generar')
  const estadoPath=path.join(proyecto,'project-state.json')
  const previo=JSON.parse(fs.readFileSync(estadoPath,'utf8'))
  const salida=path.join(proyecto,'mvp-paso7')
  fs.mkdirSync(salida,{recursive:true})
  fs.copyFileSync(estadoPath,path.join(salida,`estado-antes-${modo}-${Date.now()}.json`))
  const b=require(path.join(repo,'dist-electron/main/index.js'))
  const carga=await llamar('load-project',{projectPath:proyecto})
  if(!carga.success) throw Error(carga.error)
  const estado=carga.data
  estado.timelineWeights=[...b.PESOS_POR_DEFECTO]
  resultado.mix=estado.timelineWeights
  if(modo==='generar') {
    const fuente=estado.clips.find(c=>c.type==='video'||c.type==='audio')
    const voz=estado.timelineVideoClips.find(c=>c.type==='audio')
    if(!fuente || !voz || !fs.existsSync(fuente.path) || !fs.existsSync(voz.path)) throw Error('Proyecto sin fuente/voz utilizables')
    quitarObservador=b.observarRendimientoGraficos(m=>{resultado.metricas.push(m);latido=Date.now()})
    const corte=await llamar('cut-video-clips',{videoPath:fuente.path})
    if(!corte.success) throw Error(corte.error)
    const generado=await llamar('generate-timeline-assets',{
      scriptText:estado.aiScript, audioDuration:voz.durationSeconds,
      transcriptSegments:estado.transcriptSegments, videoPath:fuente.path,
      weights:estado.timelineWeights, iaStyle:'', aspectRatio:'vertical', graphicsPercent:0,
      newAudioSegments:estado.newAudioSegments?.length?estado.newAudioSegments:estado.transcriptSegments
    })
    resultado.generacion=generado
    fs.writeFileSync(path.join(salida,'generacion.json'),JSON.stringify(resultado,null,2))
    if(!generado.success) throw Error(generado.error)
    estado.timelineVideoClips=[voz,...generado.clips]
    const id=`mvp-${Date.now()}`
    estado.timelineVersions=[...(estado.timelineVersions||[]),{id,name:'MVP motor completo',timestamp:Date.now(),timelineVideoClips:estado.timelineVideoClips}]
    estado.activeVersionId=id
    estado.assignedTransitions={}
    const guardar=await llamar('save-project-state',estado)
    if(!guardar.success) throw Error(guardar.error)
    const fichero=path.join(salida,`cipher-mvp-${Date.now()}.mp4`)
    dialog.showSaveDialog=async()=>({canceled:false,filePath:fichero})
    await esperarVentanaPrincipal()
    resultado.exportacion=await llamar('export-video',{
      clips:estado.timelineVideoClips,aspectRatio:'vertical',resolution:'1080p',format:'mp4',quality:'medium',
      assignedTransitions:{},transitionDuration:0.5,ajustesVideo:estado.ajustesVideo
    })
    if(!resultado.exportacion.success) throw Error(resultado.exportacion.error)
    if(!fs.existsSync(fichero)||!fs.statSync(fichero).size) throw Error('Export sin artefacto')
  } else {
    const guardar=await llamar('save-project-state',estado)
    if(!guardar.success) throw Error(guardar.error)
    const leido=JSON.parse(fs.readFileSync(estadoPath,'utf8'))
    if(JSON.stringify(leido.timelineWeights)!==JSON.stringify(estado.timelineWeights)) throw Error('Mix no persistido')
  }
  resultado.fin=new Date().toISOString()
  fs.writeFileSync(path.join(salida,`${modo}.json`),JSON.stringify(resultado,null,2))
  console.log('RESULTADO',JSON.stringify({mix:resultado.mix,exportacion:resultado.exportacion,salida}))
  quitarObservador?.();clearInterval(watchdog);app.exit(0)
}).catch(e=>{console.error(e);quitarObservador?.();clearInterval(watchdog);app.exit(1)})
