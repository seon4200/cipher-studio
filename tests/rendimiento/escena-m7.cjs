/**
 * M7: seis renders locales del MISMO Visual, sin servicios externos.
 * Uso (tras build): npx electron tests/rendimiento/escena-m7.cjs [repo-compilado] [salida]
 * No pertenece a npm test: el coste no es una asercion de correccion.
 * Exit 0: seis clips completos; margenes y coste se informan, no se confunden con perdida.
 * Exit 1: error de arnes/render (incluido agotar intentos); 124: watchdog.
 * Las tres primeras muestras y las tres ultimas se informan por separado.
 */
const { app, ipcMain, session, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '../..'))
const SALIDA = path.resolve(process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-m7-')))
fs.mkdirSync(SALIDA, { recursive: true })
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-m7-runtime-'))
app.setPath('userData', TEMP)
process.chdir(TEMP) // create-project nunca escribe en un proyecto del usuario.
delete process.env.VITE_DEV_SERVER_URL
const OPCIONES = { ancho: 1080, alto: 1920, fps: 30, duracion: 3, modo: 'pantalla', sistema: 'voltaje' }
const BASE = {
  type: 'visual_escena', value: 'memoria', label: '', unit: '', emoji: '',
  extra: { conceptos: [
    { emoji: '\uD83E\uDDE0', etiqueta: 'recuerdo' },
    { emoji: '\uD83D\uDCC1', etiqueta: 'archivo' },
    { emoji: '\uD83D\uDD17', etiqueta: 'conexion' }
  ] }
}
const { BASE_M7, evaluarM7 } = require('./criterios-m7.cjs')
const bundlePath = path.join(RAIZ, 'dist-electron/main/index.js')
const git = ref => execFileSync('git', ['-C', RAIZ, 'rev-parse', ref], { encoding: 'utf8' }).trim()
const sha = archivo => crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex')
const resultado = {
  fechaUTC: new Date().toISOString(), commit: git('HEAD'), arbol: git('HEAD^{tree}'),
  bundleSHA256: sha(bundlePath), arnesSHA256: sha(__filename),
  entorno: { plataforma: process.platform, release: os.release(), arquitectura: process.arch,
    cpu: os.cpus()[0].model, hilos: os.cpus().length, versiones: process.versions },
  opciones: OPCIONES, graphicData: BASE, referenciasM7: BASE_M7, muestrasPrevistas: 6,
  metodo: 'Una ventana reutilizada; 3 muestras de arranque + 3 de regimen. Solo extra.pos cambia para evitar cache; no participa en el dibujo.',
  red: 'fetch y HTTP(S) bloqueados', runtime: TEMP, muestras: []
}
const guardar = () => fs.writeFileSync(path.join(SALIDA, 'resultado.json'), JSON.stringify(resultado, null, 2) + '\n')
const llamar = (canal, argumento) => {
  const handler = ipcMain._invokeHandlers.get(canal)
  if (!handler) throw new Error('Falta handler: ' + canal)
  return handler({ sender: { send() {} } }, argumento)
}
const mediana = xs => [...xs].sort((a, b) => a - b)[1] // Grupos EXACTAMENTE de tres.
const resumen = ms => ({
  medianaMsClip: mediana(ms.map(m => m.ms)),
  medianaMsFrame: mediana(ms.map(m => m.ms / m.totalFrames)),
  medianaIntentosFrame: mediana(ms.map(m => m.intentosPorFrame)),
  intentos: ms.reduce((n, m) => n + m.intentosTotales, 0),
  frames: ms.reduce((n, m) => n + m.totalFrames, 0),
  framesEnElTope: ms.reduce((n, m) => n + m.framesEnElTope, 0)
})
app.whenReady().then(async () => {
  global.fetch = async () => { throw new Error('M7: red bloqueada') }
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] }, (_peticion, responder) => responder({ cancel: true }))
  let bundle
  let codigo = 1
  const watchdog = setTimeout(() => {
    resultado.error = 'WATCHDOG: 120 segundos'; guardar(); app.exit(124)
  }, 120_000)
  try {
    bundle = require(bundlePath)
    await new Promise(resolve => setTimeout(resolve, 1500))
    // El arranque del bundle crea la ventana principal: no se usa para la prueba.
    for (const ventana of BrowserWindow.getAllWindows()) ventana.hide()
    const proyecto = await llamar('create-project', { name: 'zz-m7-local' })
    if (!proyecto.success) throw new Error('No se pudo crear el proyecto aislado')
    resultado.proyecto = proyecto.projectPath
    resultado.direccion = bundle.direccionDe(bundle.semillaDe(BASE.value))
    for (let i = 0; i < 6; i++) {
      const graphicData = { ...BASE, extra: { ...BASE.extra, direccion: resultado.direccion, pos: `m7:${i}` } }
      const recibidas = []
      const quitar = bundle.observarRendimientoGraficos(m => recibidas.push(m))
      let ruta
      try { ruta = await bundle.renderGraphicClip(graphicData, OPCIONES) } finally { quitar() }
      if (!ruta || !fs.statSync(ruta).size || recibidas.length !== 1) {
        throw new Error(`M${i + 1}: no produjo un clip y UNA medicion (cache no valida)`)
      }
      const ventana = BrowserWindow.getAllWindows().find(v => /grafico\.html/.test(v.webContents.getURL()))
      if (!ventana) throw new Error('Falta ventana de graficos')
      // Se comprueba el arbol REAL, no solo el type solicitado: el respaldo tambien produce MP4.
      const dibujo = await ventana.webContents.executeJavaScript(`({
        pie: document.querySelector('.es-pie-tit')?.textContent,
        conceptos: [...document.querySelectorAll('.es-etq')].map(e => e.textContent),
        avisos: window.__avisosCiclo || []
      })`)
      if (dibujo.pie !== BASE.value || JSON.stringify(dibujo.conceptos) !==
          JSON.stringify(BASE.extra.conceptos.map(c => c.etiqueta))) {
        throw new Error('Se midio un respaldo o una escena incompleta: ' + JSON.stringify(dibujo))
      }
      const m = { muestra: i + 1, fase: i < 3 ? 'arranque' : 'regimen',
        graphicData, ...recibidas[0], bytes: fs.statSync(ruta).size, ruta, dibujo }
      resultado.muestras.push(m)
      console.log('MUESTRA ' + JSON.stringify(m))
      guardar()
      if (i === 5) {
        // Fuera de la ventana medida. Artefacto para MIRAR que se midio escena, no texto.
        const png = await ventana.webContents.capturePage({ x: 0, y: 0, width: 1080, height: 1920 })
        fs.writeFileSync(path.join(SALIDA, 'escena-memoria-frame89.png'), png.toPNG())
      }
    }
    resultado.arranque = resumen(resultado.muestras.slice(0, 3))
    resultado.regimen = resumen(resultado.muestras.slice(3))
    resultado.criteriosM7 = evaluarM7(resultado)
    codigo = 0
    console.log('ARRANQUE ' + JSON.stringify(resultado.arranque))
    console.log('REGIMEN ' + JSON.stringify(resultado.regimen))
    console.log('M7 ' + JSON.stringify(resultado.criteriosM7))
  } catch (e) {
    resultado.error = e.stack || String(e)
    console.error(resultado.error)
  } finally {
    clearTimeout(watchdog)
    resultado.exitCode = codigo
    guardar()
    try { bundle?.cerrarVentanaGraficos() } catch {}
    try { await llamar('close-project', {}) } catch {}
    console.log('EVIDENCIA ' + SALIDA)
    app.exit(codigo)
  }
}).catch(e => { console.error(e); app.exit(1) })
