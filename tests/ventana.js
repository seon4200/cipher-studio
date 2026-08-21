/**
 * LA VENTANA REUTILIZADA — que un Visual no dependa de cual se renderizo ANTES
 *
 * Se ejecuta con:   npm run test:ventana
 *
 * ════════════════════════════════════════
 *   ESTE SCRIPT SALE EN ROJO A PROPOSITO. ES UN DIAGNOSTICO DOCUMENTADO, NO UNA PUERTA:
 *   NO esta en la lista de las ocho suites que hay que ver verdes antes de commitear.
 *
 *   CAUSA DEL FALLO, IDENTIFICADA: los elementos bajo ESCALA ANIMADA. Neutralizando todos
 *   los `scale()` de los keyframes de `mapa` —sonda temporal, revertida— el residuo da 0.
 *
 *   NUMEROS DE HOY, contra el arbol arreglado (f302bb1):
 *     visual_extrusion   0 subpixeles                                        OK
 *     visual_mapa        6.602.267 subpixeles, delta 51/255, 36/63 frames    FALLO
 *                        el primero que difiere es el 27
 *
 *   LA PRUEBA SIRVE, y esto es lo que lo demuestra: corrida contra el commit 46f6f32 —el
 *   ultimo con el bloqueante de 10 septies puesto— FALLA EN LAS DOS composiciones con
 *   delta 255/255, 63/63 frames y desde el frame 0. Una prueba que no falla con el defecto
 *   puesto no vale para nada; esta falla, y el contraste separa el bloqueante (delta 255
 *   desde el frame 0) del residuo que queda (delta 51 desde el 27).
 *
 *   EL RESIDUO ES INVISIBLE. Amplificado x6 se ve solo el contorno del emoji grande, el de
 *   la palabra del pie y los anillos del halo. Las zonas planas son identicas byte a byte.
 *
 *   >>> RE-MEDIR EN EL PASO 5. <<<
 *   Lo que se rasteriza dentro de esas capas escaladas es TEXTO, y hoy se rasteriza con la
 *   SANS DEL SISTEMA: grafico.html no declara ninguna fuente. En el paso 5 entran Archivo y
 *   Anton, el rasterizado cambia, y este residuo hay que volver a medirlo ENTERO. EL UMBRAL
 *   O EL ARREGLO —will-change, promocion de capa, lo que sea— SE DECIDEN ENTONCES, NO AHORA:
 *   probarlos antes es hacer un trabajo que habra que repetir.
 * ════════════════════════════════════════
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
 * ── LA COMPROBACION ──────────────────────────────
 *
 * EL INVARIANTE ES "LA SALIDA NO DEPENDE DE QUE VENIA ANTES". Para cada composicion:
 *   1. se calienta el proceso con tres renders que se tiran
 *   2. se renderiza P1 y detras B            -> frames_1
 *   3. se renderiza P2 y detras B            -> frames_2      (P2 distinto de P1)
 *   4. frames_1 y frames_2 tienen que ser IDENTICOS
 *
 * DOS PREDECESORES DISTINTOS, no "el mismo clip solo y acompanado". El diseno anterior
 * comparaba B en ventana fresca contra B detras de P1, y eso mezclaba DOS cosas: el efecto del
 * predecesor y el de ser el primer render del proceso. Con dos predecesores distintos y las dos
 * ramas en caliente, lo unico que varia es el predecesor.
 *
 * Y NO vale comparar dos veces la MISMA secuencia (P1->B contra P1->B): con el defecto de
 * 10 septies puesto, las dos ramas saldrian mal IGUAL, coincidirian, y la prueba aprobaria
 * justo el defecto para el que existe. Medido: P1->B contra P1->B da 0 incluso con el bug.
 *
 * Comprobado que el diseno CAZA el bloqueante: corriendo esta prueba contra el commit 46f6f32
 * —el ultimo con el bug— falla. Una prueba que no falla con el defecto puesto no sirve.
 *
 * P1, P2 y B cambian value Y ciclo entre si a proposito: esta medido que el defecto solo
 * aparecia cuando cambiaban LAS DOS cosas a la vez.
 *
 * Se comparan los FRAMES DECODIFICADOS, NO el .mp4. Comparar el contenedor meteria el
 * codificador dentro de la medida: el h264 comprime por prediccion entre frames, asi que una
 * diferencia de 13 subpixeles en el frame 22 se arrastra hasta 21.303 subpixeles y delta 51 en
 * el frame 58. Eso es amplificacion del codec, no desfase del Visual.
 *
 * ── LO QUE SE APRENDIO MIDIENDO, Y VALE MAS QUE LA PRUEBA ──────────────────────────────
 *
 * EL PRIMER RENDER DE UN PROCESO NO ES COMPARABLE CON LOS SIGUIENTES. Medido:
 *
 *   la comparacion vieja, como lo PRIMERO de un proceso      7.113.608 subpixeles, delta 51
 *   la misma comparacion repetida en ese mismo proceso                0
 *   con etiquetas cortas, tambien como lo primero            7.084.438 subpixeles, delta 76
 *   con etiquetas cortas, ya no lo primero                            0
 *
 * Eso invalido toda una tanda de conclusiones: los ceros que parecian "este contenido no falla"
 * eran ceros por VENIR DESPUES. El contenido es irrelevante; lo que se estaba midiendo era la
 * posicion en la secuencia.
 *
 * PERO NO ES SOLO "ARRANQUE EN FRIO", y esto es lo importante: `visual_extrusion` como PRIMER
 * render de un proceso da 0. Si el frio ensuciara el rasterizado sin mas, extrusion lo mostraria
 * igual. Y calentar no lo arregla: con 1, 3 o 5 renders descartados sale el MISMO 7.113.608.
 *
 * LA CAUSA ESTA IDENTIFICADA: son los elementos bajo ESCALA ANIMADA. Neutralizando todos los
 * `scale()` de los keyframes de `mapa` —sonda temporal, revertida— la prueba da 0. La diferencia
 * son solo BORDES: el contorno del emoji grande, el de la palabra del pie y los anillos del
 * halo; las zonas planas son identicas. `extrusion` tambien anima transforms, pero sus capas son
 * divs de color plano con clip-path: no tiene glifos ni degradados donde un borde se note.
 *
 * ── Y ESTO CADUCA EN EL PASO 5 ──────────────────────────────
 *
 * Todo lo de arriba esta medido contra LA SANS DEL SISTEMA: `grafico.html` no carga ninguna
 * fuente, asi que Archivo y Anton no existen en la ventana de render. Cargar las fuentes locales
 * CAMBIA EL RASTERIZADO DEL TEXTO, que es parte del mecanismo. El paso 5 no es solo meter los
 * woff2: incluye RE-MEDIR esto.
 *
 * ── UNA CONSECUENCIA QUE HAY QUE DEJAR ESCRITA ──────────────────────────────
 *
 * Un mismo clip cacheado en frio NO es identico al mismo clip re-renderizado en caliente. Nada
 * del pipeline puede asumir esa identidad: en concreto, NO se puede verificar la cache
 * re-renderizando y comparando ficheros. La cache sigue siendo correcta —la clave describe el
 * dibujo— pero su verificacion tiene que ser por clave, no por bytes.
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

// EL CLIP QUE SE MIDE, y sus DOS predecesores DISTINTOS.
//
// P1 y P2 cambian value Y ciclo entre si y respecto a B: esta medido que el defecto de
// 10 septies solo aparecia cuando cambiaban LAS DOS cosas a la vez. Con predecesores que solo
// cambiaran el value, la prueba seria verde sin vigilar nada.
const P1 = { value: 'siguiente', ciclo: 3.82, conceptos: [
  { emoji: '💵', etiqueta: 'billetes' }, { emoji: '🤝', etiqueta: 'acuerdo' }, { emoji: '🏆', etiqueta: 'mundial' }] }
const P2 = { value: 'mercado', ciclo: 2.87, conceptos: [
  { emoji: '💵', etiqueta: 'oferta' }, { emoji: '🤝', etiqueta: 'demanda' }, { emoji: '🏆', etiqueta: 'precio' }] }
const B = { value: 'construir', ciclo: 2.10, conceptos: [
  { emoji: '🏟️', etiqueta: 'estadio' }, { emoji: '🏗️', etiqueta: 'construcción' }, { emoji: '🌳', etiqueta: 'selva' }] }

// Los descartados del calentamiento. No cambian el veredicto —esta medido que calentar no
// altera el residuo— pero dejan las dos ramas en el mismo estado del proceso, que es lo que
// permite atribuir una diferencia al PREDECESOR y no a la posicion en la secuencia.
const CALIENTA = ['pared', 'motor', 'rio'].map((v, i) => ({
  value: v, ciclo: 2.4 + i * 0.1,
  conceptos: [{ emoji: '💵', etiqueta: 'uno' }, { emoji: '🤝', etiqueta: 'dos' }, { emoji: '🏆', etiqueta: 'tres' }]
}))

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

const ANCHO = 1080, ALTO = 1920, TAM_FRAME = ANCHO * ALTO * 3

/**
 * Los FRAMES DECODIFICADOS, no el .mp4.
 *
 * Comparar el contenedor mete el codificador DENTRO de la medida y no es lo que se verifica
 * aqui. El h264 es determinista dada la misma entrada, pero comprime por PREDICCION ENTRE
 * FRAMES: una diferencia de 13 subpixeles en el frame 22 se arrastra y sale como 21.303
 * subpixeles y delta 51 en el frame 58. Eso es amplificacion del codec, no desfase del Visual.
 *
 * Sobre crudo, la medida es la real: cuantos subpixeles difieren y cuanto.
 */
async function framesDe (mp4, etiqueta) {
  const crudo = path.join(TMP, etiqueta + '.raw')
  await ejecutar(`ffmpeg -y -v error -i "${mp4.replace(/"/g, '\\"')}" -f rawvideo -pix_fmt rgb24 "${crudo}"`)
  const b = fs.readFileSync(crudo)
  return { buf: b, h: sha1(b), frames: Math.round(b.length / TAM_FRAME) }
}

/**
 * El residuo entre dos clips, en crudo.
 *
 * Se descartan primero los frames identicos con Buffer.compare, que es nativo, y solo se
 * recorren subpixel a subpixel los que difieren: sin eso son 390 millones de comparaciones en
 * JS por cada par.
 *
 * La TASA va en ppm y no en recuento absoluto a proposito: un recuento fijo envejece mal —otro
 * `value` con etiquetas mas largas daria mas pixeles y la prueba fallaria sin que nada haya
 * empeorado—. La tasa es comparable entre clips de duraciones distintas.
 */
function residuo (X, Y) {
  const n = Math.min(X.length, Y.length) / TAM_FRAME
  let tocados = 0, primero = -1, sub = 0, maxD = 0, peorFrame = 0
  for (let f = 0; f < n; f++) {
    const a = X.subarray(f * TAM_FRAME, (f + 1) * TAM_FRAME)
    const b = Y.subarray(f * TAM_FRAME, (f + 1) * TAM_FRAME)
    if (Buffer.compare(a, b) === 0) continue
    tocados++
    if (primero < 0) primero = f
    let c = 0
    for (let o = 0; o < TAM_FRAME; o++) {
      const d = a[o] - b[o]
      if (d) { c++; const ad = d < 0 ? -d : d; if (ad > maxD) maxD = ad }
    }
    sub += c
    if (c > peorFrame) peorFrame = c
  }
  return { n, tocados, primero, sub, maxD, peorFrame, ppm: sub / (n * TAM_FRAME) * 1e6 }
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
  console.log('LA VENTANA REUTILIZADA - un Visual no puede depender de cual se renderizo antes')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.\n')

  limpiar()
  await llamar('create-project', { name: MARCA })

  const nombres = composicionesRegistradas()
  ok(nombres !== null && nombres.length >= 2,
    'se leen las composiciones registradas del fuente',
    nombres ? `${nombres.length}: ${nombres.join(', ')}`
            : 'NO se pudo leer COMPOSICIONES de composiciones/index.ts')
  if (!nombres) return

  const render = (nombre, c) => renderGraphicClip(
    { type: 'visual_' + nombre, value: c.value, extra: { pos: '0:0', conceptos: c.conceptos } },
    { ancho: ANCHO, alto: ALTO, fps: 30, duracion: c.ciclo, modo: 'pantalla', sistema: 'voltaje' })

  /** Renderiza y devuelve los frames crudos. Borra el .mp4 para que no haya acierto de cache:
   *  el hash de B es el mismo en las dos ramas, que es justo lo que hace peligroso el defecto. */
  const capturar = async (nombre, c, etq) => {
    const r = await render(nombre, c)
    if (!r || !fs.existsSync(r)) throw new Error('el render no devolvio fichero')
    const copia = path.join(TMP, etq + '.mp4')
    fs.copyFileSync(r, copia)
    fs.unlinkSync(r)
    const f = await framesDe(copia, etq)
    fs.unlinkSync(copia)
    return f
  }
  const tirar = async (nombre, c) => { const r = await render(nombre, c); if (r) fs.unlinkSync(r) }

  for (const nombre of nombres) {
    console.log('')
    console.log('  -- visual_' + nombre + ' --')

    for (const c of CALIENTA) { await cerrarVentanaGraficos(); await tirar(nombre, c) }

    // B detras de P1, y B detras de P2. PREDECESORES DISTINTOS, las dos ramas en caliente.
    await cerrarVentanaGraficos(); await tirar(nombre, P1)
    const f1 = await capturar(nombre, B, nombre + '_1')
    await cerrarVentanaGraficos(); await tirar(nombre, P2)
    const f2 = await capturar(nombre, B, nombre + '_2')

    const R = residuo(f1.buf, f2.buf)

    // SE IMPRIME SIEMPRE, pase o falle. El dia que el residuo pase de 0 a 13 o de 13 a 1.300 hay
    // que verlo aunque siguiera por debajo de cualquier umbral: un numero que solo se enseña
    // cuando ya es tarde no sirve de aviso.
    console.log('          residuo: ' + R.sub + ' subpixeles de ' + (R.n * TAM_FRAME) +
      ' (' + R.ppm.toFixed(1) + ' ppm)   delta max ' + R.maxD + '/255   ' +
      'frames tocados ' + R.tocados + '/' + R.n + (R.primero >= 0 ? '   primero ' + R.primero : ''))

    ok(R.sub === 0, 'visual_' + nombre + ': el mismo clip detras de dos predecesores distintos',
      R.sub === 0
        ? R.n + ' frames identicos, ' + f1.h
        : 'la salida depende de que venia antes: ver 10 septies de docs/AUDITORIA.md')
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
