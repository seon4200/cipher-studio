/**
 * BANCO DE RENDIMIENTO DEL RENDER DE GRAFICOS
 *
 * Se ejecuta con: npm run bench:graficos
 * NO es una suite de correccion y NO forma parte de `npm test`. Mide varias muestras,
 * informa mediana/p95 y las compara con el liston historico. Solo sale rojo si el render
 * falla o se bloquea; cruzar el liston es informacion, no una asercion de correccion.
 */
const { app, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..', '..')
const PROY = path.join(RAIZ, 'proyectos')
const MARCA = 'zz-bench-graficos'
const MUESTRAS = 5
const WATCHDOG_MS = 90_000
const BASE_MS_FRAME = 50.3
const BASE_INTENTOS_FRAME = 1.30
const OPCIONES = {
  ancho: 1080,
  alto: 1920,
  fps: 30,
  duracion: 1,
  modo: 'pantalla',
  sistema: 'voltaje'
}

const llamar = (canal, arg) => {
  const h = ipcMain._invokeHandlers.get(canal)
  if (!h) throw new Error('sin handler: ' + canal)
  return h({ sender: { send: () => {} } }, arg)
}

const limpiar = () => {
  if (!fs.existsSync(PROY)) return
  for (const d of fs.readdirSync(PROY)) {
    if (d.toLowerCase().startsWith(MARCA)) {
      fs.rmSync(path.join(PROY, d), { recursive: true, force: true })
    }
  }
}

const percentil = (valores, p) => {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.ceil(p * ordenados.length) - 1]
}

const mediana = (valores) => {
  const ordenados = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(ordenados.length / 2)
  return ordenados.length % 2
    ? ordenados[mitad]
    : (ordenados[mitad - 1] + ordenados[mitad]) / 2
}

async function main (bundle) {
  const mediciones = []
  const dejarDeObservar = bundle.observarRendimientoGraficos(m => mediciones.push(m))
  limpiar()
  await llamar('create-project', { name: MARCA })

  try {
    console.log('BANCO DE RENDIMIENTO — cinco muestras medidas por el lazo real')
    console.log(`Liston historico: ${BASE_MS_FRAME} ms/frame · ${BASE_INTENTOS_FRAME} intentos/frame`)
    console.log('Cruzar el liston se informa; no convierte este banco en una suite de correccion.\n')

    // Una muestra de calentamiento separada. No entra en mediana/p95 porque incluye la
    // creacion de la ventana, pero se imprime: esconder el frio tambien seria mentir.
    const antesFrio = mediciones.length
    const frio = await bundle.renderGraphicClip(
      { type: 'visual_mapa', value: 'rendimiento-frio', label: '', unit: '', emoji: '',
        extra: { conceptos: ['medida', 'control', 'arranque'] } },
      OPCIONES)
    if (!frio || mediciones.length !== antesFrio + 1) {
      throw new Error('el render frio no produjo fichero y UNA medicion')
    }
    const mFrio = mediciones.at(-1)
    console.log(`FRIO  ${mFrio.ms} ms · ${(mFrio.ms / mFrio.totalFrames).toFixed(2)} ms/frame · ` +
      `${mFrio.intentosPorFrame.toFixed(2)} intentos/frame · ${mFrio.framesEnElTope} en el tope`)

    const medidas = []
    for (let i = 0; i < MUESTRAS; i++) {
      const antes = mediciones.length
      const ruta = await bundle.renderGraphicClip(
        { type: 'visual_mapa', value: `rendimiento-${i}`, label: '', unit: '', emoji: '',
          extra: { conceptos: ['medida', 'control', `muestra-${i}`] } },
        OPCIONES)
      if (!ruta || mediciones.length !== antes + 1) {
        throw new Error(`la muestra ${i + 1} no produjo fichero y UNA medicion`)
      }
      const m = mediciones.at(-1)
      medidas.push(m)
      console.log(`M${i + 1}    ${m.ms} ms · ${(m.ms / m.totalFrames).toFixed(2)} ms/frame · ` +
        `${m.intentosPorFrame.toFixed(2)} intentos/frame · ${m.framesEnElTope} en el tope`)
    }

    const msFrame = medidas.map(m => m.ms / m.totalFrames)
    const intentos = medidas.map(m => m.intentosPorFrame)
    const medMs = mediana(msFrame)
    const p95Ms = percentil(msFrame, 0.95)
    const medInt = mediana(intentos)
    const p95Int = percentil(intentos, 0.95)
    const framesTope = medidas.reduce((n, m) => n + m.framesEnElTope, 0)

    console.log('\nRESUMEN')
    console.log(`ms/frame       mediana ${medMs.toFixed(2)} · p95 ${p95Ms.toFixed(2)} · ` +
      `liston ${BASE_MS_FRAME.toFixed(2)}`)
    console.log(`intentos/frame mediana ${medInt.toFixed(2)} · p95 ${p95Int.toFixed(2)} · ` +
      `liston ${BASE_INTENTOS_FRAME.toFixed(2)}`)
    console.log(`frames en MAX_INTENTOS_FRAME: ${framesTope}`)
    console.log(`RELACION mediana/liston: ms x${(medMs / BASE_MS_FRAME).toFixed(2)} · ` +
      `intentos x${(medInt / BASE_INTENTOS_FRAME).toFixed(2)}`)
  } finally {
    dejarDeObservar()
    try { bundle.cerrarVentanaGraficos() } catch (e) {}
    try { await llamar('close-project', {}) } catch (e) {}
    limpiar()
  }
}

app.whenReady().then(async () => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(resolve => setTimeout(resolve, 1500))
  let watchdog
  try {
    await Promise.race([
      main(bundle),
      new Promise((_, reject) => {
        watchdog = setTimeout(() => reject(new Error(
          `WATCHDOG: bench:graficos no termino en ${WATCHDOG_MS / 1000}s`)), WATCHDOG_MS)
      })
    ])
    app.exit(0)
  } catch (e) {
    console.error('FALLO DEL BANCO: ' + (e.stack || e.message || e))
    app.exit(1)
  } finally {
    clearTimeout(watchdog)
  }
})
