// LA PRUEBA DE ACEPTACION DEL 25 DE AGOSTO. En seco, sin gastar un centimo.
//
// QUE DEMUESTRA. Que la app ya no puede decir "exito, 78 de 78" mientras la mitad del video se
// degrada en silencio. Reproduce el incidente exacto -- DeepSeek devolviendo 402 por saldo
// agotado -- y enseña LITERALMENTE lo que el canal `generation-aviso` manda a la ventana,
// pintado como lo pintaria la interfaz.
//
// POR QUE NO ES UNA SUITE (todavia). Necesita Electron, un video de entrada y unos 5 minutos.
// Las suites de `npm test` son de segundos. Convertirla es otra conversacion; que EXISTA y sea
// repetible por cualquiera es esta.
//
// POR QUE NO CUESTA DINERO. `fetch` esta interceptado: ninguna llamada a api.deepseek.com sale a
// la red, y el reparto va con IA a 0, asi que tampoco se toca fal.ai. Se imprime cuantas
// llamadas se interceptaron para que se pueda comprobar.
//
// ESTE ARNES CAZO TRES DEFECTOS que ninguna suite habria visto, porque las suites no ejecutan el
// handler:
//   1. El resumen decia "Todo cuadra" sobre una generacion FALLIDA (falta del campo `completa`).
//   2. Faltaba el SEXTO motivo de respaldo: la causa principal del 25/8 no estaba en ninguno de
//      los cinco puntos de fallback, sino antes, en el reparto.
//   3. Un bug de ORDEN propio: la anotacion corria antes de la asignacion de Visuales y producia
//      un "-3" fantasma.
//
// Ver el README de al lado.

const { app, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const { createTestFixture } = require('../helpers/safe-fixture')

const RAIZ = process.env.CIPHER_RAIZ || path.join(__dirname, '..', '..')
const FIXTURE_ROOT = createTestFixture('aceptacion-25-agosto')
process.chdir(FIXTURE_ROOT)
const INPUTS = path.join(FIXTURE_ROOT, 'inputs')
fs.mkdirSync(INPUTS, { recursive: true })

// ── EL VIDEO DE ENTRADA ─────────────────────────────────────────────────────────────────────
// Se genera si no se da uno. Es un fixture sintetico a proposito: lo que se mide aqui es el
// CONTABLE -- objetivo contra real por origen -- y para eso da igual lo que se vea. Un video de
// verdad haria la prueba mas lenta y menos repetible, y no probaria nada mas.
function videoDeEntrada () {
  if (process.env.CIPHER_VIDEO) return process.env.CIPHER_VIDEO
  const destino = path.join(INPUTS, 'cipher-aceptacion-original.mp4')
  if (fs.existsSync(destino)) return destino
  console.log('  Generando el video de prueba (una vez): ' + destino)
  execSync('ffmpeg -y -v error -f lavfi -i testsrc=size=1080x1920:rate=30:duration=210 ' +
    '-pix_fmt yuv420p "' + destino + '"', { stdio: 'inherit' })
  return destino
}

// ── EL 402, SIN RED ─────────────────────────────────────────────────────────────────────────
const fetchReal = global.fetch
let llamadasDeepSeek = 0
global.fetch = async (url, opts) => {
  if (String(url).includes('api.deepseek.com')) {
    llamadasDeepSeek++
    return {
      ok: false, status: 402,
      text: async () => '{"error":{"message":"Insufficient Balance","type":"unknown_error"}}',
      json: async () => ({ error: { message: 'Insufficient Balance' } })
    }
  }
  return fetchReal(url, opts)
}

// ── EL RECEPTOR: lo que la ventana recibiria ────────────────────────────────────────────────
const recibido = []
const eventoFalso = { sender: { isDestroyed: () => false, send: (canal, carga) => {
  if (canal === 'generation-aviso') recibido.push(carga)
} } }

const llamar = (canal, arg) => ipcMain._invokeHandlers.get(canal)(eventoFalso, arg)

// Un guion como el del 25/8: 57 frases de narracion.
function segmentos (n) {
  const out = []
  let t = 0
  for (let i = 0; i < n; i++) {
    const dur = 2.2 + (i % 5) * 0.4
    out.push({
      start: t, end: t + dur,
      text: 'Frase numero ' + (i + 1) + ' de la narracion, con su contenido.',
      words: [{ word: 'palabra', start: t + 0.2, end: t + 0.6 },
              { word: 'contenido', start: t + 0.8, end: t + 1.2 }]
    })
    t += dur
  }
  return out
}

const CAJA = (txt, ancho = 78) => {
  const l = String(txt)
  return l.length <= ancho ? l : l.slice(0, ancho - 1) + '…'
}

app.whenReady().then(async () => {
  const bundle = path.join(RAIZ, 'dist-electron/main/index.js')
  if (!fs.existsSync(bundle)) {
    console.log('\n  FALTA EL BUNDLE: ' + bundle + '\n  Corre `npm run build` antes.\n')
    app.exit(2); return
  }
  // SE IMPORTA DEL BUNDLE COMPILADO, no se reimplementa nada: un arnes que copiara la regla
  // probaria su propia copia. Es ley del proyecto y aqui vale igual.
  const b = require(bundle)
  await new Promise(r => setTimeout(r, 1500))
  const { textoResumen } = b
  if (!process.env.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = 'x-forzado'

  const videoPath = videoDeEntrada()

  await llamar('create-project', { name: 'zz-aceptacion' })

  const res = await llamar('generate-timeline-assets', {
    scriptText: 'Las personas jovenes adultas hoy en dia...',
    audioDuration: 200,
    transcriptSegments: [],
    videoPath,
    weights: [22, 20, 0, 31],                 // original 22, stock 20, IA 0, Visual 31
    iaStyle: '',
    aspectRatio: 'vertical',
    graphicsPercent: 0,
    newAudioSegments: segmentos(57)
  })

  console.log('\n' + '='.repeat(82))
  console.log('  LLAMADAS A DEEPSEEK INTERCEPTADAS (todas 402, ninguna salio a la red): ' + llamadasDeepSeek)
  console.log('  El handler devolvio: success=' + res.success)
  console.log('='.repeat(82))

  const ultimo = recibido[recibido.length - 1]
  const lista = (ultimo && ultimo.lista) || []
  const resumen = ultimo && ultimo.resumen

  console.log('\n  MENSAJES QUE RECIBIO LA VENTANA: ' + recibido.length +
    '   (uno por codigo nuevo, mas el resumen final)')
  console.log('  AVISOS AGREGADOS: ' + lista.length +
    '   <- ' + llamadasDeepSeek + ' fallos de DeepSeek caben en ' +
    lista.filter(a => a.origen === 'deepseek').length + ' linea(s)')

  console.log('\n' + '─'.repeat(82))
  console.log('  ESTO ES LO QUE EL USUARIO HABRIA VISTO EN LA VENTANA')
  console.log('─'.repeat(82))
  for (const a of lista) {
    const et = a.severidad === 'error' ? '[ ERROR ]' : a.severidad === 'aviso' ? '[ AVISO ]' : '[ INFO  ]'
    const cont = a.veces > 1 ? '  (x' + a.veces + ')' : ''
    console.log('\n  ' + et + '  ' + CAJA(a.mensaje) + cont)
    if (a.detalle) console.log('            ' + CAJA(a.detalle, 70))
  }
  if (resumen) {
    console.log('')
    for (const linea of textoResumen(resumen)) console.log('  ' + linea)
  } else {
    console.log('\n  (NO LLEGO RESUMEN — la fase no esta hecha)')
  }
  console.log('\n' + '─'.repeat(82))

  // LO QUE TIENE QUE PASAR PARA QUE ESTO SEA UNA PRUEBA Y NO UN VOLCADO. Sin estas
  // comprobaciones esto solo imprime cosas bonitas y siempre "pasa".
  const fallos = []
  if (llamadasDeepSeek === 0) fallos.push('no se intercepto ninguna llamada a DeepSeek')
  if (!lista.some(a => a.origen === 'deepseek' && a.severidad === 'error')) {
    fallos.push('el 402 de DeepSeek NO produjo un aviso de error')
  }
  if (lista.filter(a => a.origen === 'deepseek').length !== 1) {
    fallos.push('los ' + llamadasDeepSeek + ' fallos de DeepSeek no se agregaron en UNA linea')
  }
  if (!resumen) fallos.push('no llego resumen final')
  else {
    if (resumen.cuadra) fallos.push('el resumen dice que CUADRA sobre una generacion degradada')
    if (!resumen.completa) fallos.push('el resumen dice incompleta y el handler devolvio exito')
    if (resumen.respaldo.length === 0) {
      fallos.push('hay clips degradados y el desglose por MOTIVO sale vacio')
    }
    const visual = resumen.filas.find(f => f.origen === 'Visual')
    if (visual && visual.objetivo !== visual.real) {
      fallos.push('los Visuales no cuadran: ' + visual.objetivo + ' pedidos, ' + visual.real +
        ' salidos (era el bug de ORDEN de la anotacion)')
    }
  }

  if (fallos.length) {
    console.log('\n  FALLA:')
    for (const f of fallos) console.log('    · ' + f)
    console.log('')
  } else {
    console.log('\n  TODO CORRECTO — el 402 se ve, se agrega, y el resumen dice la verdad.\n')
  }
  app.exit(fallos.length ? 1 : 0)
})
