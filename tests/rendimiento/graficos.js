/**
 * BANCO DE RENDIMIENTO DEL RENDER DE GRAFICOS
 *
 * Se ejecuta con: npm run bench:graficos
 * NO es una suite de correccion y NO forma parte de `npm test`. Separa arranque de regimen,
 * informa mediana/p95 y las compara con el liston historico. Solo sale rojo si el render
 * falla o se bloquea; cruzar el liston es informacion, no una asercion de correccion.
 *
 * A/B del observador: npm run bench:graficos -- --comparar-observador
 */
const { app, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture, removeFixtureFile } = require('../helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..', '..')
const FIXTURE_ROOT = createTestFixture('bench-graficos')
process.chdir(FIXTURE_ROOT)
const MARCA = 'zz-bench-graficos'
const MUESTRAS = 6
const MUESTRAS_POR_FASE = 3
const COMPARAR_OBSERVADOR = process.argv.includes('--comparar-observador')
const WATCHDOG_MS = COMPARAR_OBSERVADOR ? 180_000 : 90_000
const BASE_MS_FRAME = 50.3
const BASE_INTENTOS_FRAME = 1.30
const OPCIONES = {
  ancho: 1080,
  alto: 1920,
  fps: 30,
  // El liston versionado se midio a 3 s / 90 frames. El graphicData exacto del arnes
  // historico no quedo en Git, asi que se iguala lo demostrable y no se afirma mas.
  duracion: 3,
  modo: 'pantalla',
  sistema: 'voltaje'
}

// El fixture ES parte de la medicion y se versiona con ella. `{id}` es la unica variacion:
// evita aciertos de cache sin cambiar el contrato de entrada ni esconder palabras aleatorias.
// El benchmark historico de 2026-08-08 no conservo esto y por eso sus intentos/frame no se
// pueden comparar clip a clip con los actuales.
const FIXTURE_GRAPHIC_DATA = Object.freeze({
  type: 'visual_mapa',
  value: 'rendimiento-{id}',
  label: '',
  unit: '',
  emoji: '',
  extra: Object.freeze({
    conceptos: Object.freeze(['medida', 'control', 'muestra-{id}'])
  })
})

const llamar = (canal, arg) => {
  const h = ipcMain._invokeHandlers.get(canal)
  if (!h) throw new Error('sin handler: ' + canal)
  return h({ sender: { send: () => {} } }, arg)
}

let fixtureCleaned = false
const limpiarFixture = () => {
  if (fixtureCleaned) return
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  fixtureCleaned = true
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

const sustituirId = (texto, id) => texto.replace('{id}', String(id))
const graphicDataDe = (id) => ({
  type: FIXTURE_GRAPHIC_DATA.type,
  value: sustituirId(FIXTURE_GRAPHIC_DATA.value, id),
  label: FIXTURE_GRAPHIC_DATA.label,
  unit: FIXTURE_GRAPHIC_DATA.unit,
  emoji: FIXTURE_GRAPHIC_DATA.emoji,
  extra: {
    conceptos: FIXTURE_GRAPHIC_DATA.extra.conceptos.map(c => sustituirId(c, id))
  }
})

async function renderMuestra (bundle, id, conObservador) {
  const recibidas = []
  const dejarDeObservar = conObservador
    ? bundle.observarRendimientoGraficos(m => recibidas.push(m))
    : () => {}
  const inicio = process.hrtime.bigint()
  let ruta
  try {
    ruta = await bundle.renderGraphicClip(graphicDataDe(id), OPCIONES)
  } finally {
    dejarDeObservar()
  }
  const wallMs = Number(process.hrtime.bigint() - inicio) / 1e6
  if (!ruta) throw new Error(`la muestra ${id} no produjo fichero`)
  if (conObservador && recibidas.length !== 1) {
    throw new Error(`la muestra ${id} produjo ${recibidas.length} mediciones; se esperaba UNA`)
  }
  return { ruta, wallMs, medicion: recibidas[0] }
}

const imprimirResumen = (titulo, medidas) => {
  const msFrame = medidas.map(m => m.ms / m.totalFrames)
  const intentos = medidas.map(m => m.intentosPorFrame)
  const framesTope = medidas.reduce((n, m) => n + m.framesEnElTope, 0)
  const medMs = mediana(msFrame)
  const medInt = mediana(intentos)
  console.log(`\n${titulo}`)
  console.log(`ms/frame       mediana ${medMs.toFixed(2)} · p95 ${percentil(msFrame, 0.95).toFixed(2)} · ` +
    `liston ${BASE_MS_FRAME.toFixed(2)} · x${(medMs / BASE_MS_FRAME).toFixed(2)}`)
  console.log(`intentos/frame mediana ${medInt.toFixed(2)} · p95 ${percentil(intentos, 0.95).toFixed(2)} · ` +
    `liston ${BASE_INTENTOS_FRAME.toFixed(2)} · x${(medInt / BASE_INTENTOS_FRAME).toFixed(2)}`)
  console.log(`frames en MAX_INTENTOS_FRAME: ${framesTope}`)
}

async function ejecutarNormal (bundle) {
  console.log('BANCO DE RENDIMIENTO — seis muestras medidas por el lazo real')
  console.log(`Condicion: visual_mapa · ${OPCIONES.duracion}s · ` +
    `${OPCIONES.duracion * OPCIONES.fps} frames · ${OPCIONES.sistema}`)
  console.log('Fixture versionado: ' + JSON.stringify(FIXTURE_GRAPHIC_DATA))
  console.log('El liston usa esa composicion, duracion, frames y sistema; el graphicData historico no se versiono.')
  console.log(`Liston historico: ${BASE_MS_FRAME} ms/frame · ${BASE_INTENTOS_FRAME} intentos/frame`)
  console.log('Cruzar el liston se informa; no convierte este banco en una suite de correccion.\n')

  const medidas = []
  for (let i = 0; i < MUESTRAS; i++) {
    const r = await renderMuestra(bundle, i + 1, true)
    const m = r.medicion
    medidas.push(m)
    const fase = i < MUESTRAS_POR_FASE ? 'ARRANQUE' : 'ASENTADO'
    console.log(`M${i + 1} ${fase.padEnd(8)} ${m.ms} ms · ` +
      `${(m.ms / m.totalFrames).toFixed(2)} ms/frame · ` +
      `${m.intentosPorFrame.toFixed(2)} intentos/frame · ${m.framesEnElTope} en el tope`)
  }

  imprimirResumen('ARRANQUE — primeras tres muestras', medidas.slice(0, MUESTRAS_POR_FASE))
  imprimirResumen('ASENTADO — ultimas tres muestras', medidas.slice(MUESTRAS_POR_FASE))
}

const resumenWall = (titulo, muestras) => {
  const porFrame = muestras.map(m => m.wallMs / (OPCIONES.duracion * OPCIONES.fps))
  const med = mediana(porFrame)
  console.log(`${titulo}: mediana ${med.toFixed(3)} ms/frame · ` +
    `p95 ${percentil(porFrame, 0.95).toFixed(3)} ms/frame`)
  return med
}

async function compararObservador (bundle) {
  console.log('A/B DEL OBSERVADOR — seis muestras activas y seis desactivadas')
  console.log(`Condicion: visual_mapa · ${OPCIONES.duracion}s · ` +
    `${OPCIONES.duracion * OPCIONES.fps} frames · misma semilla dentro de cada par`)
  console.log('Se alterna cual corre primero para no regalar todo el calentamiento a un lado.\n')

  const activas = []
  const inactivas = []
  for (let i = 0; i < MUESTRAS; i++) {
    const orden = i % 2 === 0 ? [true, false] : [false, true]
    for (const activo of orden) {
      const r = await renderMuestra(bundle, `ab-${i + 1}`, activo)
      const destino = activo ? activas : inactivas
      destino.push(r)
      console.log(`PAR ${i + 1} ${activo ? 'ACTIVO   ' : 'INACTIVO '} ` +
        `${r.wallMs.toFixed(1)} ms · ` +
        `${(r.wallMs / (OPCIONES.duracion * OPCIONES.fps)).toFixed(3)} ms/frame` +
        (activo ? ` · interno ${r.medicion.ms} ms` : ''))
      // El segundo lado del par usa exactamente el mismo arbol y semilla; se borra el fichero
      // para evitar que la cache convierta la comparacion en 1 ms contra un render real.
      try { removeFixtureFile(FIXTURE_ROOT, r.ruta) } catch (e) {}
    }
  }

  console.log('\nTODAS LAS MUESTRAS (tiempo exterior, comparable con el observador apagado)')
  const medActivo = resumenWall('ACTIVO  ', activas)
  const medInactivo = resumenWall('INACTIVO', inactivas)
  console.log(`DELTA ACTIVO-INACTIVO: ${(medActivo - medInactivo).toFixed(3)} ms/frame`)

  console.log('\nREGIMEN ASENTADO — ultimos tres pares')
  const asentadoActivo = resumenWall('ACTIVO  ', activas.slice(MUESTRAS_POR_FASE))
  const asentadoInactivo = resumenWall('INACTIVO', inactivas.slice(MUESTRAS_POR_FASE))
  console.log(`DELTA ASENTADO: ${(asentadoActivo - asentadoInactivo).toFixed(3)} ms/frame`)
  console.log('Los intentos del lado inactivo son N/D por definicion: leerlos exigiria volver a observar.')
}

async function main (bundle) {
  const proyecto = await llamar('create-project', { name: MARCA })

  try {
    if (COMPARAR_OBSERVADOR) await compararObservador(bundle)
    else await ejecutarNormal(bundle)
  } finally {
    try { bundle.cerrarVentanaGraficos() } catch (e) {}
    try { await llamar('close-project', {}) } catch (e) {}
    // El proyecto entero queda bajo el fixture marcado de esta ejecución y se elimina sólo al
    // cerrar esa raíz exacta; nunca se barre por prefijo dentro del repositorio.
  }
}

app.whenReady().then(async () => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(resolve => setTimeout(resolve, 1500))
  let watchdog
  let code = 1
  try {
    await Promise.race([
      main(bundle),
      new Promise((_, reject) => {
        watchdog = setTimeout(() => reject(new Error(
          `WATCHDOG: bench:graficos no termino en ${WATCHDOG_MS / 1000}s`)), WATCHDOG_MS)
      })
    ])
    code = 0
  } catch (e) {
    console.error('FALLO DEL BANCO: ' + (e.stack || e.message || e))
  } finally {
    clearTimeout(watchdog)
    limpiarFixture()
  }
  app.exit(code)
})
