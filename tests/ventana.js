/**
 * LA VENTANA REUTILIZADA — que un Visual no dependa de cual se renderizo ANTES
 *
 * Se ejecuta con:   npm run test:ventana
 *
 * ES UNA PRUEBA DE INTEGRACION, y por eso es la novena y no una mas de las ocho. Las otras son
 * aritmetica pura sobre el bundle: se ejecutan en milisegundos y no abren nada. Esta necesita
 * una ventana offscreen, ffmpeg y un proyecto, y tarda ~30 s. No se puede reducir a aritmetica:
 * el defecto que vigila vive en la reconciliacion de React y en el motor de animaciones de
 * Chromium, o sea en sitios a los que solo se llega renderizando de verdad.
 *
 * ── QUE VIGILA ──────────────────────────────────────────────────────────────────────────────
 *
 * `renderGraphicClipsLote` REUTILIZA la ventana para los ~15 Visuales de un video. Hasta
 * 10 septies, la raiz de React se creaba una vez y se reutilizaba con ella, asi que React
 * reconciliaba cada clip contra el anterior en vez de construirlo. Los elementos del DOM
 * sobrevivian, y con ellos el CSSAnimation que `__setT` habia pausado y posicionado a mano.
 *
 * Resultado: el clip nuevo se pintaba con la CURVA del clip anterior. Medido antes del arreglo,
 * comparando el mismo clip renderizado solo y renderizado detras de otro:
 *   visual_extrusion  47 de 63 frames distintos
 *   visual_mapa       53 de 63 frames distintos
 *
 * ── POR QUE NO LO VIO NADIE ─────────────────────────────────────────────────────────────────
 *
 * Ninguna de las nueve guardas del export podia verlo. La sonda del lazo cerrado se pinta por
 * DOM DIRECTO, fuera de React (`sonda.style.background` en grafico.tsx), asi que valida el
 * indice del frame sin saber nada de lo que hay debajo: da por bueno un frame cuyo contenido es
 * de otro instante. El fichero existe, dura lo que debe, tiene los frames que debe y son
 * distintos entre si. Todo verde.
 *
 * Y el determinismo del §41 tampoco lo cubria: se verifico con cinco huellas del MISMO clip.
 * Una SECUENCIA de clips distintos en la misma ventana no la habia probado nadie.
 *
 * ── LA COMPROBACION ─────────────────────────────────────────────────────────────────────────
 *
 * Para cada composicion registrada:
 *   1. se renderiza el clip B en una ventana recien abierta
 *   2. se cierra la ventana, se renderiza A —otro value y otro ciclo— y despues B, en la MISMA
 *   3. los dos B tienen que ser IDENTICOS
 *
 * Se comparan los FRAMES DECODIFICADOS, no solo el fichero: es lo que de verdad se afirma, y no
 * depende de que el contenedor guarde algun metadato variable. El sha1 del fichero se informa
 * tambien, porque hoy tambien coincide y si algun dia dejara de hacerlo conviene enterarse.
 *
 * A y B cambian value Y ciclo a la vez A PROPOSITO: esta medido que hace falta que cambien LAS
 * DOS cosas para que el defecto aparezca. Con solo una, pasaba. Un caso de prueba que cambiara
 * solo el value seria verde sin vigilar nada.
 *
 * ── ⚠ HOY ESTO NO ES UNA PUERTA, ES UN DIAGNOSTICO ──────────────────────────────────────────
 *
 * NO esta en la lista de suites que hay que ver verdes antes de commitear, y no por descuido:
 * con el arreglo puesto, `visual_extrusion` sale IDENTICO byte a byte, pero `visual_mapa` deja
 * un RESIDUO que no esta explicado. Medido:
 *
 *   B detras de B (nada cambia)   0 subpixeles distintos de 391.910.400 — determinista
 *   B detras de A                 el primer frame que difiere es el 22, con 13 subpixeles y
 *                                 delta maxima 5/255, dentro de la caja de un concepto. De ahi
 *                                 en adelante el codec lo amplifica por prediccion entre frames
 *                                 hasta 21.303 subpixeles y delta 51 en el frame 58.
 *
 * O sea: el desfase estructural —cajas enteras pintadas con la curva del clip anterior— esta
 * arreglado, y lo que queda es una diferencia de rasterizado imperceptible que el h264 agranda.
 * NO es el `backdrop-filter` de `.cm-caja`: se probo quitandolo y empeora (49 frames en vez de
 * 41). La causa no esta identificada.
 *
 * NO SE HA AFLOJADO EL CRITERIO PARA QUE SALGA VERDE. Una tolerancia inventada aqui —"hasta N
 * subpixeles vale"— seria exactamente la clase de puerta que deja pasar el defecto siguiente, y
 * en este repo ya hubo que borrar una herramienta de verificacion por dar resultados que no
 * eran. El criterio se queda estricto y el script SALE EN ROJO por `visual_mapa` hasta que el
 * residuo se entienda. Lo que informa es real; lo que falta es la explicacion.
 */
const { app, ipcMain } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { exec } = require('child_process')

const RAIZ = path.resolve(__dirname, '..')
const PROY = path.join(RAIZ, 'proyectos')
const MARCA = 'zz-prueba-ventana'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-ventana-'))

// Los dos clips. Distinto value y distinto ciclo: los dos extremos medidos en este repo.
const A = { value: 'siguiente', ciclo: 3.82, conceptos: [
  { emoji: '💵', etiqueta: 'billetes' }, { emoji: '🤝', etiqueta: 'acuerdo' }, { emoji: '🏆', etiqueta: 'mundial' }] }
const B = { value: 'construir', ciclo: 2.10, conceptos: [
  { emoji: '🏟️', etiqueta: 'estadio' }, { emoji: '🏗️', etiqueta: 'construcción' }, { emoji: '🌳', etiqueta: 'selva' }] }

const fallos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}

const llamar = (canal, arg) => {
  const h = ipcMain._invokeHandlers.get(canal)
  if (!h) throw new Error('sin handler: ' + canal)
  return h({ sender: { send: () => {} } }, arg)
}

const ejecutar = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) =>
    err ? reject(new Error(String(stderr || err.message).slice(-600))) : resolve(String(stdout)))
})

const limpiar = () => {
  if (!fs.existsSync(PROY)) return
  for (const d of fs.readdirSync(PROY)) {
    if (d.toLowerCase().startsWith(MARCA)) fs.rmSync(path.join(PROY, d), { recursive: true, force: true })
  }
}

const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex').slice(0, 12)

/** El sha1 de los FRAMES, no del contenedor. */
async function huellaDeFrames (mp4, etiqueta) {
  const crudo = path.join(TMP, etiqueta + '.raw')
  await ejecutar(`ffmpeg -y -v error -i "${mp4.replace(/"/g, '\\"')}" -f rawvideo -pix_fmt rgb24 "${crudo}"`)
  const b = fs.readFileSync(crudo)
  const h = sha1(b)
  return { h, bytes: b.length, ruta: crudo }
}

/** Cuantos frames difieren, para que el fallo diga CUANTO y no solo QUE. */
function framesDistintos (r1, r2) {
  const A1 = fs.readFileSync(r1), B1 = fs.readFileSync(r2)
  const tam = 1080 * 1920 * 3
  const n = Math.min(A1.length, B1.length) / tam
  let d = 0, primero = -1
  for (let f = 0; f < n; f++) {
    let dif = 0
    for (let o = f * tam; o < (f + 1) * tam; o += 331) dif += Math.abs(A1[o] - B1[o])
    if (dif / (tam / 331) > 0.5) { d++; if (primero < 0) primero = f }
  }
  return { d, n, primero }
}

/**
 * Las composiciones registradas, leidas del FUENTE.
 *
 * `COMPOSICIONES` vive en el renderer y no esta en el bundle del proceso principal, asi que no
 * se puede importar. Se lee de `composiciones/index.ts` en vez de escribir una lista aqui: el
 * dia que entre la tercera, esta prueba la cubre sin que nadie se acuerde de añadirla.
 *
 * Si el fuente cambia de forma y esto deja de reconocerlo, DEVUELVE NULL y la prueba falla. Una
 * deteccion rota que cae a una lista por defecto probaria lo que ella misma se inventa — y en
 * este repo ya hubo que borrar una herramienta de verificacion por eso mismo.
 */
function composicionesRegistradas () {
  const f = path.join(RAIZ, 'src/renderer/src/composiciones/index.ts')
  if (!fs.existsSync(f)) return null
  const m = fs.readFileSync(f, 'utf8')
    .match(/COMPOSICIONES\s*:\s*Record<[^>]*>\s*=\s*\{([^}]*)\}/)
  if (!m) return null
  const nombres = m[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean)
  return nombres.length ? nombres : null
}

async function main (bundle) {
  const { renderGraphicClip, cerrarVentanaGraficos } = bundle
  console.log('LA VENTANA REUTILIZADA — un Visual no puede depender de cual se renderizo antes')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.\n')

  limpiar()
  const p = await llamar('create-project', { name: MARCA })

  const nombres = composicionesRegistradas()
  ok(nombres !== null && nombres.length >= 2,
    'se leen las composiciones registradas del fuente',
    nombres ? `${nombres.length}: ${nombres.join(', ')}`
            : 'NO se pudo leer COMPOSICIONES de composiciones/index.ts')
  if (!nombres) return

  const render = (nombre, c) => renderGraphicClip(
    { type: 'visual_' + nombre, value: c.value, extra: { pos: '0:0', conceptos: c.conceptos } },
    { ancho: 1080, alto: 1920, fps: 30, duracion: c.ciclo, modo: 'pantalla', sistema: 'voltaje' })

  for (const nombre of nombres) {
    console.log('')
    console.log(`  ── visual_${nombre} ──`)

    // 1) B en ventana recien abierta
    await cerrarVentanaGraficos()
    const r1 = await render(nombre, B)
    if (!r1 || !fs.existsSync(r1)) { ok(false, `visual_${nombre}: el render devolvio fichero`); continue }
    const solo = path.join(TMP, nombre + '_solo.mp4')
    fs.copyFileSync(r1, solo)
    const hSoloFichero = sha1(fs.readFileSync(solo))
    const fSolo = await huellaDeFrames(solo, nombre + '_solo')

    // 2) A y despues B, en la MISMA ventana. Se borra el fichero para que no haya acierto de
    //    cache: el hash de B es el mismo en los dos casos, que es justo lo que hace peligroso
    //    este defecto.
    await cerrarVentanaGraficos()
    fs.unlinkSync(r1)
    await render(nombre, A)
    const r2 = await render(nombre, B)
    if (!r2 || !fs.existsSync(r2)) { ok(false, `visual_${nombre}: el segundo render devolvio fichero`); continue }
    const tras = path.join(TMP, nombre + '_tras.mp4')
    fs.copyFileSync(r2, tras)
    const hTrasFichero = sha1(fs.readFileSync(tras))
    const fTras = await huellaDeFrames(tras, nombre + '_tras')

    // 3) LA COMPROBACION
    const iguales = fSolo.h === fTras.h
    let detalle = `frames ${fSolo.h} vs ${fTras.h}   fichero ${hSoloFichero} vs ${hTrasFichero}`
    if (!iguales) {
      const x = framesDistintos(fSolo.ruta, fTras.ruta)
      detalle += `\n          ${x.d} de ${x.n} frames distintos, el primero es el ${x.primero}` +
        '\n          el clip depende de cual se renderizo antes: ver 10 septies de docs/AUDITORIA.md'
    }
    ok(iguales, `visual_${nombre}: identico solo y detras de otro clip`, detalle)
    ok(hSoloFichero === hTrasFichero,
      `visual_${nombre}: y el .mp4 tambien es identico byte a byte`,
      hSoloFichero === hTrasFichero ? '' : 'los frames pueden coincidir y el contenedor no: mirar metadatos')
  }

  await cerrarVentanaGraficos()
  limpiar()
}

app.whenReady().then(async () => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  try { await main(bundle) } catch (e) { fallos.push('excepcion'); console.log('EXCEPCION: ' + e.stack) }
  try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) { }
  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — un Visual sale igual solo que en mitad de una tanda.')
  }
  app.exit(fallos.length ? 1 : 0)
})
