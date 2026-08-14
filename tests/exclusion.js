/**
 * V5 — LA EXCLUSION MUTUA entre Visuales y tarjetas. Geometria pura: ni ffmpeg, ni ventanas.
 *
 * Se importa del BUNDLE COMPILADO, no se reimplementa: una prueba que copiara la regla probaria
 * su copia y seguiria verde con la regla rota.
 *
 * LOS CASOS DEGENERADOS ESTAN DESDE EL PRINCIPIO a proposito. En reparto.js se escribieron
 * despues, y entre medias la suite estuvo VERDE con un bug de NaN dentro porque sus 74.088 casos
 * usaban todos entradas bien formadas. Un test que solo prueba el camino feliz lo prueba dos
 * veces.
 */
const { app } = require('electron')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..')
const fallos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}
const T = (ini, dur, id) => ({ startSeconds: ini, durationSeconds: dur, id })

function main (bundle) {
  const { excluirSobreVisuales, solapa, SOLAPE_MINIMO_S } = bundle
  ok(typeof excluirSobreVisuales === 'function', 'excluirSobreVisuales se exporta del bundle')
  ok(typeof solapa === 'function', 'solapa se exporta del bundle')
  if (typeof excluirSobreVisuales !== 'function') return
  ok(SOLAPE_MINIMO_S === 0.15, 'el umbral es 0.15 s', String(SOLAPE_MINIMO_S))

  // ── A) EL CASO NORMAL ────────────────────────────────────────────────────────────
  console.log('\n=== A) LO NORMAL ===')
  const visuales = [T(10, 3), T(30, 3)]
  const tarjetas = [T(2, 2, 'a'), T(11, 2, 'b'), T(20, 2, 'c'), T(31, 2, 'd'), T(50, 2, 'e')]
  const r = excluirSobreVisuales(tarjetas, visuales)
  ok(r.quedan.length === 3 && r.descartadas.length === 2,
    'se descartan las 2 que caen sobre un Visual y quedan las 3 libres',
    `quedan ${r.quedan.map(x => x.id).join(',')}   descartadas ${r.descartadas.map(d => d.tarjeta.id).join(',')}`)
  ok(r.descartadas.every(d => d.visual && typeof d.visual.startSeconds === 'number'),
    'cada descartada dice SOBRE QUE Visual cayo',
    r.descartadas.map(d => `${d.tarjeta.id}->${d.visual.startSeconds}s`).join(' '))
  ok(r.quedan.length + r.descartadas.length === tarjetas.length,
    'ninguna tarjeta se pierde ni se duplica')

  // ── B) LOS DOS LADOS DEL UMBRAL ──────────────────────────────────────────────────
  // Es la unica frontera del diseño: por debajo se conserva, por encima se descarta.
  console.log('\n=== B) LOS DOS LADOS DEL UMBRAL (0.15 s) ===')
  const vis = [T(10, 2)]                     // ocupa 10.00 .. 12.00
  ok(!solapa(T(11.86, 2), vis[0]),
    'solape de 0.14 s NO descarta', 'tarjeta 11.86-13.86 contra Visual 10.00-12.00')
  ok(solapa(T(11.84, 2), vis[0]),
    'solape de 0.16 s SI descarta', 'tarjeta 11.84-13.84 contra Visual 10.00-12.00')
  ok(!solapa(T(12, 2), vis[0]),
    'la frontera EXACTA no descarta: 0 s de solape', 'tarjeta empieza donde el Visual acaba')
  ok(!solapa(T(8, 2), vis[0]),
    'y la frontera exacta por el otro lado tampoco', 'tarjeta acaba donde el Visual empieza')

  // ── C) UNA TARJETA SOBRE DOS VISUALES ────────────────────────────────────────────
  // Se cuenta UNA vez: el recuento cuenta tarjetas, no colisiones. Es el mismo error que dio
  // el "43 de 39" al componer, contando invocaciones en vez de elementos.
  console.log('\n=== C) UNA TARJETA SOBRE DOS VISUALES ===')
  const dos = excluirSobreVisuales([T(10, 6, 'larga')], [T(9, 3), T(13, 3)])
  ok(dos.descartadas.length === 1 && dos.quedan.length === 0,
    'se descarta UNA vez, no dos', `descartadas ${dos.descartadas.length}`)

  // ── D) DEGENERADOS ───────────────────────────────────────────────────────────────
  console.log('\n=== D) ENTRADAS DEGENERADAS ===')
  const sinVis = excluirSobreVisuales(tarjetas, [])
  ok(sinVis.quedan.length === tarjetas.length && sinVis.descartadas.length === 0,
    'lista de Visuales VACIA: no se descarta nada', `${sinVis.quedan.length} quedan`)
  ok(sinVis.quedan === tarjetas, 'y devuelve la MISMA lista, sin copiarla')

  const sinTar = excluirSobreVisuales([], visuales)
  ok(sinTar.quedan.length === 0 && sinTar.descartadas.length === 0, 'lista de tarjetas vacia')

  // Ante un valor no numerico se CONSERVA la tarjeta: descartarla seria destruir algo por un
  // dato que ya venia roto.
  const raros = [
    { startSeconds: NaN, durationSeconds: 2, id: 'nan' },
    { startSeconds: 10, durationSeconds: NaN, id: 'durNan' },
    { startSeconds: undefined, durationSeconds: 2, id: 'undef' },
    { startSeconds: null, durationSeconds: 2, id: 'null' },
    { startSeconds: '10', durationSeconds: 2, id: 'cadena' },
    { id: 'vacio' }
  ]
  const rr = excluirSobreVisuales(raros, [T(10, 3)])
  ok(rr.descartadas.length === 0 && rr.quedan.length === raros.length,
    'startSeconds o durationSeconds no numericos: se CONSERVAN todas',
    `quedan ${rr.quedan.map(x => x.id).join(',')}`)

  const visRaro = excluirSobreVisuales([T(10, 2, 'ok')], [{ startSeconds: NaN, durationSeconds: 3 }])
  ok(visRaro.quedan.length === 1 && visRaro.descartadas.length === 0,
    'un VISUAL con datos rotos tampoco descarta nada')

  ok(excluirSobreVisuales(null, visuales).quedan.length === 0,
    'null en vez de lista de tarjetas no lanza')
  ok(excluirSobreVisuales(tarjetas, null).quedan.length === tarjetas.length,
    'null en vez de lista de Visuales conserva todo')

  // Duracion 0 y negativa: no pueden solapar con nada.
  ok(!solapa(T(10, 0), T(10, 3)), 'una tarjeta de duracion 0 no solapa')
  ok(!solapa(T(10, -5), T(10, 3)), 'una duracion negativa tampoco')
}

app.whenReady().then(() => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  try { main(bundle) } catch (e) { fallos.push('excepcion'); console.log('EXCEPCION: ' + e.stack) }
  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — ninguna tarjeta cae sobre un Visual, y ninguna se pierde por el camino.')
  }
  app.exit(fallos.length ? 1 : 0)
})
