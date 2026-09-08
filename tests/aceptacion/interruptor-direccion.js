/**
 * ACEPTACION MANUAL — direccion implicita contra explicita, con ordinal igualado.
 *
 * La tercera monta de `skyline` dentro de una BrowserWindow reutilizada cambia su
 * rasterizado. Por eso cada pareja abre una ventana fresca y compara el montaje 1
 * con el 2. Los dos controles demuestran que cerrar la ventana reinicia el estado.
 *
 * Ejecutar despues de `npm run build`:
 *   npx electron tests/aceptacion/interruptor-direccion.js
 */
const { app, ipcMain, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const { createTestFixture, removeFixtureFile } = require('../helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '../..')
const FIXTURE_ROOT = createTestFixture('interruptor-direccion')
process.chdir(FIXTURE_ROOT)
const SALIDA = path.join(FIXTURE_ROOT, 'output')
fs.mkdirSync(SALIDA, { recursive: true })
const MARCA = 'zz-aceptacion-interruptor'
const FRAMES = [0, 39, 77]
const OPCIONES = {
  ancho: 1080,
  alto: 1920,
  fps: 30,
  duracion: 3,
  modo: 'pantalla',
  sistema: 'voltaje'
}
const CONCEPTOS = [
  { emoji: '🧠', etiqueta: 'recuerdo' },
  { emoji: '📁', etiqueta: 'archivo' },
  { emoji: '🔗', etiqueta: 'conexion' }
]
const PALABRAS = [
  'memoria',
  'cualitativamente',
  'sincronizadamente',
  'tecnología',
  'inteligencia',
  'generaciones'
]

const llamar = (canal, arg) => {
  const handler = ipcMain._invokeHandlers.get(canal)
  if (!handler) throw new Error(`No existe el handler ${canal}`)
  return handler({ sender: { send: () => {} } }, arg)
}

app.whenReady().then(async () => {
  global.fetch = async () => { throw new Error('RED BLOQUEADA POR INTERRUPTOR-DIRECCION') }
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  const comparador = require(path.join(RAIZ, 'tests/aceptacion/comparar-capturas.js'))
  const resultados = { controles: [], palabras: [] }
  let proyecto
  let codigo = 0
  const watchdog = setTimeout(() => {
    console.error('WATCHDOG: interruptor-direccion supero 300 s')
    app.exit(124)
  }, 300_000)

  const datos = (palabra, explicita, pos) => {
    const extra = { pos, conceptos: CONCEPTOS }
    if (explicita) extra.direccion = bundle.direccionDe(bundle.semillaDe(palabra))
    return {
      type: 'visual_escena',
      value: palabra,
      label: '',
      unit: '',
      emoji: '',
      extra
    }
  }

  const render = async (palabra, explicita, nombre, pos) => {
    const ruta = await bundle.renderGraphicClip(datos(palabra, explicita, pos), OPCIONES)
    if (!ruta) throw new Error(`${nombre}: no produjo video`)
    const copia = path.join(SALIDA, `${nombre}.mp4`)
    fs.copyFileSync(ruta, copia)
    // Obliga al siguiente montaje a recorrer el render real en vez de acertar la cache.
    removeFixtureFile(FIXTURE_ROOT, ruta)
    return copia
  }

  const compararExacto = (a, b, prefijo) => FRAMES.map(frame => {
    const rutaA = path.join(SALIDA, `${prefijo}-a-${frame}.raw`)
    const rutaB = path.join(SALIDA, `${prefijo}-b-${frame}.raw`)
    const rawA = comparador.sacarFrame(a, frame, rutaA)
    const rawB = comparador.sacarFrame(b, frame, rutaB)
    const medida = comparador.comparar(rawA, rawB)
    removeFixtureFile(FIXTURE_ROOT, rutaA)
    removeFixtureFile(FIXTURE_ROOT, rutaB)
    return {
      frame,
      pixeles: medida.pix,
      deltaMaximo: medida.maxD,
      deltaMedio: medida.media,
      veredicto: comparador.veredicto(medida)
    }
  })

  const exigirIgual = (nombre, frames) => {
    const malos = frames.filter(frame => frame.veredicto !== 'IGUAL')
    if (malos.length) throw new Error(`${nombre}: ${JSON.stringify(malos)}`)
  }

  const control = async nombre => {
    bundle.cerrarVentanaGraficos()
    const pos = `control:${nombre}`
    const a = await render('cualitativamente', false, `${nombre}-1`, pos)
    const b = await render('cualitativamente', false, `${nombre}-2`, pos)
    const frames = compararExacto(a, b, nombre)
    exigirIgual(nombre, frames)
    resultados.controles.push({ nombre, frames })
    console.log(`CONTROL ${nombre}: ${JSON.stringify(frames)}`)
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    for (const ventana of BrowserWindow.getAllWindows()) ventana.hide()
    proyecto = await llamar('create-project', { name: MARCA })

    // Control 1: montajes 1 y 2 de una ventana fresca.
    await control('ventana-1')
    // Control 2: misma comprobacion tras cerrar la ventana, pero sin reiniciar Electron.
    // Si falla, el estado es por proceso y el metodo de las parejas no sirve.
    await control('ventana-2-mismo-proceso')

    for (const palabra of PALABRAS) {
      bundle.cerrarVentanaGraficos()
      const pos = `palabra:${palabra}`
      const implicita = await render(palabra, false, `${palabra}-implicita`, pos)
      const explicita = await render(palabra, true, `${palabra}-explicita`, pos)
      const frames = compararExacto(implicita, explicita, palabra)
      exigirIgual(palabra, frames)
      const direccion = bundle.direccionDe(bundle.semillaDe(palabra))
      resultados.palabras.push({ palabra, fondo: direccion.fondo, direccion, frames })
      console.log(`PALABRA ${palabra} fondo=${direccion.fondo}: ${JSON.stringify(frames)}`)
    }

    if (!resultados.palabras.some(resultado => resultado.fondo === 'skyline')) {
      throw new Error('Ninguna palabra ejercito el fondo skyline')
    }
    fs.writeFileSync(path.join(SALIDA, 'resultado.json'), JSON.stringify({
      commit: require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: RAIZ,
        encoding: 'utf8'
      }).trim(),
      opciones: OPCIONES,
      resultados
    }, null, 2))
    console.log(`RESULTADO: 2/2 controles y ${PALABRAS.length}/${PALABRAS.length} palabras IGUAL`)
    console.log(`ARTEFACTOS: ${SALIDA}`)
  } catch (error) {
    codigo = 1
    console.error(error.stack || error)
    console.error(`ARTEFACTOS CONSERVADOS: ${SALIDA}`)
  } finally {
    clearTimeout(watchdog)
    try { bundle.cerrarVentanaGraficos() } catch {}
    try { await llamar('close-project', {}) } catch {}
    // Conserva los artefactos de aceptación en su fixture marcado bajo os.tmpdir(); no crea ni
    // borra proyectos dentro del repositorio.
  }
  app.exit(codigo)
}).catch(error => {
  console.error(error.stack || error)
  app.exit(1)
})
