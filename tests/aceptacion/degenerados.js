// LOS CASOS DEGENERADOS DE LOS AVISOS. En seco, sin gastar un centimo.
//
// QUE DEMUESTRA. Las tres promesas del resumen que el camino feliz NO prueba:
//
//   A) CERO FALLOS  -> el resumen sale IGUAL y dice que todo cuadro. Un resumen que solo
//      apareciera cuando hay problemas entrena a no leerlo, y el dia que aparezca tampoco se lee.
//   B) LA GENERACION ABORTA -> el resumen sale igual, con lo que haya, y dice que NO termino.
//      Va en un `finally` por esto. Y aqui se ve por que hizo falta el campo `completa`: sin el,
//      cero pedidos contra cero salidos empata en todas las filas y el resumen diria "todo
//      cuadra" sobre una generacion fallida.
//   C) LA VENTANA CERRADA al emitir -> no tumba el proceso, y el aviso no se pierde en silencio
//      porque el log lo tiene igual. `send` sobre un webContents destruido revienta de verdad.
//
// Se llama al handler REAL `generate-timeline-assets` importado del bundle compilado. Ver el
// README de al lado.

const { app, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const { createTestFixture } = require('../helpers/safe-fixture')

const RAIZ = process.env.CIPHER_RAIZ || path.join(__dirname, '..', '..')
const FIXTURE_ROOT = createTestFixture('aceptacion-degenerados')
process.chdir(FIXTURE_ROOT)
const INPUTS = path.join(FIXTURE_ROOT, 'inputs')
fs.mkdirSync(INPUTS, { recursive: true })

function videoDeEntrada () {
  if (process.env.CIPHER_VIDEO) return process.env.CIPHER_VIDEO
  const destino = path.join(INPUTS, 'cipher-aceptacion-original.mp4')
  if (fs.existsSync(destino)) return destino
  console.log('  Generando el video de prueba (una vez): ' + destino)
  execSync('ffmpeg -y -v error -f lavfi -i testsrc=size=1080x1920:rate=30:duration=210 ' +
    '-pix_fmt yuv420p "' + destino + '"', { stdio: 'inherit' })
  return destino
}

// ── El doble de DeepSeek: se puede poner en 'ok' o en '402' ─────────────────────────────────
const fetchReal = global.fetch
let modo = 'ok'
function respuestaOk () {
  // Un lote de frases con keyword y conceptos: lo que DeepSeek daria si funcionara.
  const phrases = []
  for (let i = 1; i <= 60; i++) {
    phrases.push({
      phraseIndex: i,
      visualClips: [{
        keyword: 'city street', timestamp: 3 + (i % 40), duration: 2.5,
        conceptos: [{ emoji: '🏙️', etiqueta: 'ciudad' }, { emoji: '🚇', etiqueta: 'metro' },
                    { emoji: '🌃', etiqueta: 'noche' }]
      }]
    })
  }
  return { choices: [{ message: { content: JSON.stringify({ phrases }) } }] }
}
global.fetch = async (url, opts) => {
  if (String(url).includes('api.deepseek.com')) {
    if (modo === '402') return { ok: false, status: 402,
      text: async () => '{"error":{"message":"Insufficient Balance"}}', json: async () => ({}) }
    return { ok: true, status: 200, json: async () => respuestaOk(), text: async () => '' }
  }
  // Nada mas sale a la red: si algo lo intenta, falla en seco y se ve.
  if (/^https?:/i.test(String(url))) {
    return { ok: false, status: 599, text: async () => 'sin red', json: async () => ({}) }
  }
  return fetchReal(url, opts)
}

function receptor (ventanaCerrada) {
  const recibido = []
  return {
    recibido,
    ev: { sender: {
      isDestroyed: () => ventanaCerrada,
      send: (canal, carga) => {
        if (ventanaCerrada) throw new Error('Object has been destroyed')  // como Electron de verdad
        if (canal === 'generation-aviso') recibido.push(carga)
      }
    } }
  }
}
const llamar = (canal, arg, ev) => ipcMain._invokeHandlers.get(canal)(ev, arg)

function segmentos (n) {
  const out = []; let t = 0
  for (let i = 0; i < n; i++) {
    const dur = 2.2 + (i % 5) * 0.4
    out.push({ start: t, end: t + dur,
      text: 'Frase ' + (i + 1) + ' de la narracion con contenido suficiente.',
      words: [{ word: 'ciudad', start: t + 0.2, end: t + 0.6 },
              { word: 'contenido', start: t + 0.8, end: t + 1.2 }] })
    t += dur
  }
  return out
}
const args = (videoPath) => ({
  scriptText: 'guion de prueba', audioDuration: 150, transcriptSegments: [],
  videoPath, weights: [22, 20, 0, 31], iaStyle: '', aspectRatio: 'vertical',
  graphicsPercent: 0, newAudioSegments: segmentos(40)
})

app.whenReady().then(async () => {
  const rutaBundle = path.join(RAIZ, 'dist-electron/main/index.js')
  if (!fs.existsSync(rutaBundle)) {
    console.log('\n  FALTA EL BUNDLE: ' + rutaBundle + '\n  Corre `npm run build` antes.\n')
    app.exit(2); return
  }
  const bundle = require(rutaBundle)
  await new Promise(r => setTimeout(r, 1500))
  const { textoResumen } = bundle
  if (!process.env.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = 'x-forzado'
  const VIDEO = videoDeEntrada()
  await llamar('create-project', { name: 'zz-degenerados' }, receptor(false).ev)

  const fallos = []
  const pinta = (titulo, rec, res) => {
    console.log('\n' + '='.repeat(80))
    console.log('  ' + titulo)
    console.log('='.repeat(80))
    console.log('  handler: success=' + res.success + (res.error ? '  error=' + res.error : ''))
    console.log('  mensajes que recibio la ventana: ' + rec.recibido.length)
    const u = rec.recibido[rec.recibido.length - 1]
    if (!u) { console.log('\n  (la ventana no recibio NADA)'); return null }
    for (const a of (u.lista || [])) {
      const et = a.severidad === 'error' ? '[ ERROR ]' : a.severidad === 'aviso' ? '[ AVISO ]' : '[ INFO  ]'
      console.log('\n  ' + et + '  ' + a.mensaje.slice(0, 76) + (a.veces > 1 ? '  (x' + a.veces + ')' : ''))
    }
    if (u.resumen) { console.log(''); for (const l of textoResumen(u.resumen)) console.log('  ' + l) }
    else console.log('\n  (no llego resumen)')
    return u.resumen || null
  }

  // ── A) CERO FALLOS
  modo = 'ok'
  let rec = receptor(false)
  let res = await llamar('generate-timeline-assets', args(VIDEO), rec.ev)
  let r = pinta('A) CERO FALLOS — el resumen sale IGUAL aunque no haya nada que avisar', rec, res)
  if (!r) fallos.push('A: no llego resumen con cero fallos')

  // ── B) LA GENERACION ABORTA (el video no existe)
  modo = 'ok'
  rec = receptor(false)
  res = await llamar('generate-timeline-assets', args('C:/no/existe/ninguno.mp4'), rec.ev)
  r = pinta('B) LA GENERACION ABORTA — el resumen sale igual, con lo que haya', rec, res)
  if (!r) fallos.push('B: la generacion abortada NO produjo resumen (el `finally` no cumplio)')
  else {
    if (r.completa) fallos.push('B: el resumen dice `completa` sobre una generacion que aborto')
    if (r.cuadra) fallos.push('B: el resumen dice que CUADRA sobre una generacion que aborto ' +
      '-- es exactamente el fallo que el campo `completa` existe para impedir')
  }

  // ── C) LA VENTANA CERRADA al emitir
  modo = '402'
  rec = receptor(true)
  let excepcion = null
  try { res = await llamar('generate-timeline-assets', args(VIDEO), rec.ev) }
  catch (e) { excepcion = e }
  console.log('\n' + '='.repeat(80))
  console.log('  C) LA VENTANA CERRADA AL EMITIR')
  console.log('='.repeat(80))
  console.log('  excepcion que escapo del handler: ' + (excepcion ? excepcion.message : 'NINGUNA'))
  console.log('  handler devolvio: success=' + (res && res.success))
  console.log('  mensajes recibidos por la ventana: ' + rec.recibido.length + '  (cerrada, no puede recibir)')
  console.log('  -> el aviso NO se pierde en silencio: queda en generation-debug.log')
  if (excepcion) fallos.push('C: una excepcion escapo del handler con la ventana cerrada: ' + excepcion.message)
  if (rec.recibido.length !== 0) fallos.push('C: la ventana cerrada recibio mensajes')

  console.log('')
  if (fallos.length) {
    console.log('  FALLA:')
    for (const f of fallos) console.log('    · ' + f)
  } else {
    console.log('  TODO CORRECTO — el resumen sale en los tres casos y la ventana cerrada no tumba nada.')
  }
  console.log('')
  app.exit(fallos.length ? 1 : 0)
})
