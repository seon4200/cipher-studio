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

  // ── E) colocarYFiltrarTarjetas: LAS DOS PROTECCIONES JUNTAS ──────────────────────────────
  //
  // Estos casos existen porque la suite estuvo VERDE con el bug dentro. `excluirSobreVisuales`
  // hacia bien su trabajo y todos sus casos pasaban; lo que fallaba era que un camino no la
  // llamaba, y ademas emparejaba contra una lista que incluia los Visuales, de modo que el
  // respaldo colocaba tarjetas EXACTAMENTE encima. Probar la pieza no probaba la proteccion.
  const { colocarYFiltrarTarjetas, avisoDeExclusion } = bundle
  ok(typeof colocarYFiltrarTarjetas === 'function', 'colocarYFiltrarTarjetas se exporta del bundle')
  ok(typeof avisoDeExclusion === 'function', 'avisoDeExclusion se exporta del bundle')

  if (typeof colocarYFiltrarTarjetas === 'function') {
    const V = (ini, dur, id) => ({ startSeconds: ini, durationSeconds: dur, id, category: 'visual' })
    const O = (ini, dur, id) => ({ startSeconds: ini, durationSeconds: dur, id, category: 'original' })

    // E1. EL BUG EXACTO: sin graphicAbsoluteStart, y el unico clip con ese id es un Visual.
    // Antes el respaldo la clavaba en 48.16 y la exclusion tenia que deshacerlo. Ahora el
    // Visual no es candidato, asi que no hay a donde emparejar y no acaba encima.
    const soloVisual = colocarYFiltrarTarjetas(
      [{ id: 'c1', graphicData: { type: 'donut' } }],
      [V(48.16, 3.82, 'c1'), O(0, 5, 'otro')])
    ok(soloVisual.quedan.length === 1 && soloVisual.quedan[0].startSeconds !== 48.16,
      'el respaldo NO empareja con un Visual aunque el id coincida',
      `startSeconds ${soloVisual.quedan[0] && soloVisual.quedan[0].startSeconds}`)
    ok(soloVisual.conRespaldo === 1, 'y queda contado como colocada por respaldo')

    // E2. Con graphicAbsoluteStart encima de un Visual: se coloca donde dice y SE DESCARTA.
    const encima = colocarYFiltrarTarjetas(
      [{ id: 'x', graphicData: { type: 'contador' }, graphicAbsoluteStart: 10.0, graphicDuration: 2 }],
      [V(9.5, 3, 'v1'), O(0, 5, 'x')])
    ok(encima.quedan.length === 0 && encima.descartadas.length === 1,
      'una tarjeta con inicio absoluto sobre un Visual se descarta')
    ok(encima.aviso.includes('1 de 1'), 'y el aviso lleva el recuento', encima.aviso)

    // E3. El emparejamiento normal sigue funcionando: sin absoluto, con un clip original.
    const normal = colocarYFiltrarTarjetas(
      [{ id: 'k', graphicData: { type: 'donut' } }],
      [O(31.5, 4, 'k'), V(80, 3, 'v')])
    ok(normal.quedan.length === 1 && normal.quedan[0].startSeconds === 31.5,
      'sin inicio absoluto se usa el clip emparejado, si no es Visual',
      `startSeconds ${normal.quedan[0] && normal.quedan[0].startSeconds}`)

    // E4. Sin descartadas el aviso es CADENA VACIA, no un texto de cero. El renderer pinta con
    // `{avisoGraficos && …}`, asi que un "0 de 3" saldria en pantalla como si algo fallara.
    ok(normal.aviso === '', 'sin descartadas el aviso es cadena vacia', JSON.stringify(normal.aviso))
    ok(avisoDeExclusion(0, 5) === '' && avisoDeExclusion(-1, 5) === '',
      'avisoDeExclusion no redacta nada con cero o negativo')

    // E5. Las que no traen graphicData no cuentan: ni se colocan ni entran en el total.
    const conBasura = colocarYFiltrarTarjetas(
      [{ id: 'a', graphicData: { type: 'donut' } }, { id: 'b' }, null],
      [O(1, 2, 'a')])
    ok(conBasura.total === 1 && conBasura.quedan.length === 1,
      'las entradas sin graphicData se ignoran y no inflan el total',
      `total ${conBasura.total}`)

    // E6. DEGENERADOS desde el principio, como el resto de la suite.
    ok(colocarYFiltrarTarjetas(null, null).quedan.length === 0, 'null en las dos listas no lanza')
    ok(colocarYFiltrarTarjetas([{ id: 'z', graphicData: {} }], []).quedan.length === 1,
      'sin ningun clip en el timeline la tarjeta sobrevive, colocada en 0')
    const nanAbs = colocarYFiltrarTarjetas(
      [{ id: 'n', graphicData: {}, graphicAbsoluteStart: NaN, graphicDuration: NaN }],
      [O(7, 3, 'n')])
    ok(Number.isFinite(nanAbs.quedan[0].startSeconds) && Number.isFinite(nanAbs.quedan[0].durationSeconds),
      'un graphicAbsoluteStart NaN no se cuela: cae al respaldo',
      `start ${nanAbs.quedan[0].startSeconds} dur ${nanAbs.quedan[0].durationSeconds}`)

    // E7. La categoria se compara sin distinguir mayusculas, como en el resto del codigo.
    const mayus = colocarYFiltrarTarjetas(
      [{ id: 'm', graphicData: {} }],
      [{ startSeconds: 5, durationSeconds: 3, id: 'm', category: 'Visual' }])
    ok(mayus.quedan[0].startSeconds !== 5, "category 'Visual' con mayuscula tambien excluye")

    // ── E8) LAS TRES COSAS, EN UNA SOLA LLAMADA ────────────────────────────────────
    //
    // Los casos de arriba miran una pieza cada uno, y esa es exactamente la forma de test que
    // dejo pasar el bug: `excluirSobreVisuales` tenia sus casos en verde mientras un camino la
    // colocaba encima por el respaldo y otro ni la llamaba. Aqui se hace UNA llamada, como la
    // hace el renderer, y se comprueban las TRES salidas a la vez:
    //
    //   1) los Visuales fuera del emparejamiento
    //   2) las que solapan, descartadas
    //   3) el recuento que alimenta el aviso
    //
    // Si alguna de las tres se cae, este caso lo dice aunque las otras sigan bien.
    //
    // El escenario reproduce el export real: tarjetas de 2 s, Visuales de 2.5-3.8 s
    // intercalados, y una mezcla de tarjetas con inicio absoluto y sin el.
    const timeline = [
      O(0.0, 2.5, 'a'), V(2.48, 3.30, 'b'), O(5.8, 4.0, 'c'),
      O(9.8, 3.0, 'd'), V(48.16, 3.82, 'e'), O(52.0, 3.0, 'f')
    ]
    const crudas = [
      // (i) absoluta, en terreno despejado -> sobrevive donde dice
      { id: 'a', graphicData: { type: 'donut' }, graphicAbsoluteStart: 0.12, graphicDuration: 2 },
      // (ii) absoluta, encima del Visual 'b' -> descartada
      { id: 'c', graphicData: { type: 'contador' }, graphicAbsoluteStart: 2.46, graphicDuration: 2 },
      // (iii) SIN absoluta y con el id de un VISUAL -> el respaldo no puede emparejar con el,
      //       asi que no acaba clavada en 48.16 (que es como salieron dos en el export real)
      { id: 'e', graphicData: { type: 'frase_clave' } },
      // (iv) SIN absoluta, con el id de un clip normal -> se coloca donde ese clip
      { id: 'f', graphicData: { type: 'dato_grande' } }
    ]
    const r8 = colocarYFiltrarTarjetas(crudas, timeline)

    // 1) EL EMPAREJAMIENTO no ve los Visuales.
    const laDelVisual = r8.quedan.find(t => t.cruda.id === 'e')
    ok(laDelVisual && laDelVisual.startSeconds !== 48.16,
      '1/3 emparejamiento: la que lleva el id de un Visual NO se coloca sobre el',
      `startSeconds ${laDelVisual && laDelVisual.startSeconds}`)
    const laNormal = r8.quedan.find(t => t.cruda.id === 'f')
    ok(laNormal && laNormal.startSeconds === 52.0,
      '     y el emparejamiento con un clip normal SIGUE funcionando',
      `startSeconds ${laNormal && laNormal.startSeconds}`)

    // 2) EL DESCARTE de la que solapa, y solo de esa.
    ok(r8.descartadas.length === 1 && r8.descartadas[0].tarjeta.cruda.id === 'c',
      '2/3 descarte: solo se descarta la que cae sobre un Visual',
      `descartadas ${r8.descartadas.map(d => d.tarjeta.cruda.id).join(',') || 'ninguna'}`)
    ok(r8.descartadas[0] && r8.descartadas[0].visual.startSeconds === 2.48,
      '     y viene con el Visual que la tapaba, no solo el numero')
    ok(r8.quedan.length === 3, '     las otras tres sobreviven', `quedan ${r8.quedan.length}`)
    const sobrevive = r8.quedan.find(t => t.cruda.id === 'a')
    ok(sobrevive && sobrevive.startSeconds === 0.12,
      '     y la que estaba despejada conserva su inicio absoluto')

    // 3) EL RECUENTO que alimenta el aviso.
    ok(r8.total === 4 && r8.conRespaldo === 2,
      '3/3 recuento: total y cuantas se colocaron por respaldo',
      `total ${r8.total} conRespaldo ${r8.conRespaldo}`)
    ok(r8.aviso === avisoDeExclusion(1, 4) && r8.aviso.includes('1 de 4'),
      '     y el aviso sale del mismo redactor que usan los tres caminos', r8.aviso)
  }
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
