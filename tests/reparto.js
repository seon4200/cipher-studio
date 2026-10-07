/**
 * V3 — EL CUARTO PESO. Aritmetica pura: ni ffmpeg, ni ventanas, ni proyecto.
 *
 * Se importa del BUNDLE COMPILADO, no se reimplementa: una prueba que copiara el reparto
 * probaria su copia y seguiria verde con el reparto roto.
 *
 * Corre bajo electron como las otras cuatro solo porque el bundle de main importa 'electron'.
 * Todo lo que asierta es matematica.
 */
const { app } = require('electron')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('reparto')
process.chdir(FIXTURE_ROOT)
const fallos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}

// LA FORMULA VIEJA, copiada tal cual estaba antes de los Visuales. Existe para UNA sola cosa:
// demostrar que con visual = 0 el reparto nuevo da EXACTAMENTE lo mismo. Sin este control no
// se sabria si al añadir el cuarto origen se ha roto original/stock/IA, que es lo unico que
// hoy funciona de verdad.
function repartoViejo (stock, ia, total) {
  let nIa = Math.round((ia / 100) * total)
  let nStock = Math.round((stock / 100) * total)
  if (nIa + nStock > total) {
    const sum = nIa + nStock
    nIa = Math.floor((nIa / sum) * total)
    nStock = total - nIa
  }
  return { original: total - nIa - nStock, stock: nStock, ia: nIa, visual: 0 }
}

const TOTALES = [1, 2, 7, 13, 39, 78, 220, 388]

function main (bundle) {
  const { repartoObjetivos, repartirPesos } = bundle
  ok(typeof repartoObjetivos === 'function', 'repartoObjetivos se exporta del bundle')
  ok(typeof repartirPesos === 'function', 'repartirPesos se exporta del bundle')
  if (typeof repartoObjetivos !== 'function' || typeof repartirPesos !== 'function') return

  // ── A) EL CONTROL: con visual = 0, IDENTICO a antes ────────────────────────────────
  console.log('\n=== A) CON visual = 0, EL REPARTO ES EL DE ANTES ===')
  let casos = 0, malos = []
  for (let stock = 0; stock <= 100; stock++) {
    for (let ia = 0; ia + stock <= 100; ia++) {
      for (const total of TOTALES) {
        const v = repartoViejo(stock, ia, total)
        const n = repartoObjetivos([100 - stock - ia, stock, ia, 0], total)
        casos++
        if (v.original !== n.original || v.stock !== n.stock || v.ia !== n.ia || n.visual !== 0) {
          if (malos.length < 4) malos.push(
            `stock=${stock} ia=${ia} total=${total}: viejo ${JSON.stringify(v)} nuevo ${JSON.stringify(n)}`)
        }
      }
    }
  }
  ok(malos.length === 0,
    `los ${casos} casos con visual=0 dan lo mismo que la formula anterior`,
    malos.length ? malos.join('\n          ') : 'barrido stock 0..100 x ia 0..100-stock x 8 totales')

  // ── B) CON LOS CUATRO: la suma cuadra y nadie sale negativo ───────────────────────
  console.log('\n=== B) CON LOS CUATRO, LOS CONTEOS CUADRAN ===')
  let casosB = 0, sumaMal = [], negativos = []
  for (let stock = 0; stock <= 100; stock += 5) {
    for (let ia = 0; ia <= 100; ia += 5) {
      for (let vis = 0; vis <= 100; vis += 5) {
        for (const total of TOTALES) {
          // Se barren TAMBIEN las combinaciones que suman mas de 100: el usuario no puede
          // producirlas con los sliders, pero un estado guardado a mano o un peso corrupto si,
          // y ahi es donde `original` salia negativo con el reescalado de dos terminos.
          const r = repartoObjetivos([Math.max(0, 100 - stock - ia - vis), stock, ia, vis], total)
          casosB++
          if (r.original + r.stock + r.ia + r.visual !== total && sumaMal.length < 4)
            sumaMal.push(`stock=${stock} ia=${ia} vis=${vis} total=${total} -> ${JSON.stringify(r)}`)
          if ((r.original < 0 || r.stock < 0 || r.ia < 0 || r.visual < 0) && negativos.length < 4)
            negativos.push(`stock=${stock} ia=${ia} vis=${vis} total=${total} -> ${JSON.stringify(r)}`)
        }
      }
    }
  }
  ok(sumaMal.length === 0, `los ${casosB} casos suman EXACTAMENTE el total`,
    sumaMal.length ? sumaMal.join('\n          ') : 'incluidas las combinaciones que pasan de 100')
  ok(negativos.length === 0, 'y ninguno sale negativo',
    negativos.length ? negativos.join('\n          ') : 'incluida original, que es el residuo')

  // ── C) weights[3] SE LEE, no se ignora ────────────────────────────────────────────
  // Esto es lo que prueba que el cuarto peso llega hasta la aritmetica. Sin ello, todo lo
  // demas seguiria verde con un repartoObjetivos que ignorase el indice 3.
  console.log('\n=== C) weights[3] SE LEE ===')
  const soloVisual = repartoObjetivos([0, 0, 0, 100], 40)
  ok(soloVisual.visual === 40 && soloVisual.original === 0 && soloVisual.stock === 0 && soloVisual.ia === 0,
    'con weights=[0,0,0,100] TODO va a visual', JSON.stringify(soloVisual))

  // Quien absorbe los Visuales es `original`, que es el residuo — NO stock, que sigue con su
  // 40% intacto. Es la propiedad que define el diseño: los tres pesos explicitos se respetan y
  // el residuo se ajusta.
  const sin = repartoObjetivos([60, 40, 0, 0], 100)
  const con = repartoObjetivos([60, 40, 0, 25], 100)
  ok(sin.visual === 0 && con.visual === 25,
    'mover SOLO el indice 3 cambia lo que va a visual', `${sin.visual} -> ${con.visual}`)
  ok(con.original === sin.original - 25 && con.stock === sin.stock,
    'y lo absorbe original, el residuo, sin tocar stock',
    `original ${sin.original} -> ${con.original}   stock ${sin.stock} -> ${con.stock}`)

  // Un array de tres, que es lo que llegaria si el frontend no mandara el cuarto: no debe
  // producir NaN. Es defensa, no compatibilidad.
  const corto = repartoObjetivos([40, 30, 30], 100)
  ok(Object.values(corto).every(v => Number.isFinite(v)) &&
     corto.original + corto.stock + corto.ia + corto.visual === 100 && corto.visual === 0,
    'un array de TRES pesos no produce NaN: visual cae a 0', JSON.stringify(corto))

  // ── D) repartirPesos: la suma sigue siendo 100 ────────────────────────────────────
  console.log('\n=== D) MOVER CUALQUIER SLIDER DEJA LA SUMA EN 100 ===')
  const PARTIDAS = [
    [40, 30, 30, 0], [25, 25, 25, 25], [100, 0, 0, 0], [0, 0, 0, 100],
    [97, 1, 1, 1], [0, 50, 50, 0]
  ]
  let casosD = 0, malD = [], negD = []
  for (const inicial of PARTIDAS) {
    for (let idx = 0; idx < 4; idx++) {
      for (let v = 0; v <= 100; v++) {
        const r = repartirPesos(inicial, idx, v)
        casosD++
        const suma = r.reduce((a, b) => a + b, 0)
        if (suma !== 100 && malD.length < 6)
          malD.push(`[${inicial}] mover ${idx} a ${v} -> [${r}] suma ${suma}`)
        if (r.some(x => x < 0) && negD.length < 4)
          negD.push(`[${inicial}] mover ${idx} a ${v} -> [${r}]`)
        if (r.length !== 4 && malD.length < 6)
          malD.push(`[${inicial}] mover ${idx} a ${v} -> longitud ${r.length}`)
      }
    }
  }
  ok(malD.length === 0, `los ${casosD} movimientos dejan la suma en 100 exacto`,
    malD.length ? malD.join('\n          ') : '6 puntos de partida x 4 sliders x 0..100')
  ok(negD.length === 0, 'y ningun peso queda negativo',
    negD.length ? negD.join('\n          ') : '')

  // El valor pedido se respeta salvo que sea imposible. Si al mover un slider el valor que se
  // pidio no acabara ahi, el slider "se movería solo" bajo el dedo del usuario.
  let respetados = 0, noRespetados = []
  for (const inicial of PARTIDAS) {
    for (let idx = 0; idx < 4; idx++) {
      for (let v = 0; v <= 100; v++) {
        const r = repartirPesos(inicial, idx, v)
        if (r[idx] === v) respetados++
        else if (noRespetados.length < 6) noRespetados.push(`[${inicial}] mover ${idx} a ${v} -> ${r[idx]}`)
      }
    }
  }
  ok(noRespetados.length === 0, 'el slider movido se queda en el valor pedido',
    noRespetados.length ? noRespetados.join('\n          ') : `${respetados} movimientos`)

  // ── E) ENTRADAS ROTAS: lo que el barrido NO cubria ────────────────────────────────
  // Los 74.088 casos de arriba usaban TODOS arrays de cuatro numeros validos, asi que la
  // suite estaba verde con el bug dentro: un proyecto guardado antes del cuarto peso trae TRES
  // posiciones, y mover el slider de Visuales hacia `nuevo - undefined` = NaN, que contaminaba
  // los cuatro y se guardaba como [null,null,null,null]. Le paso a tres proyectos reales.
  console.log('\n=== E) ENTRADAS ROTAS: array corto, nulls, indice fuera de rango ===')
  const { normalizarPesos, PESOS_POR_DEFECTO } = bundle
  ok(typeof normalizarPesos === 'function', 'normalizarPesos se exporta del bundle')

  const sano = (r, etiqueta) => {
    const cuatro = Array.isArray(r) && r.length === 4
    const finitos = cuatro && r.every(v => typeof v === 'number' && Number.isFinite(v))
    const suma = finitos ? r.reduce((a, b) => a + b, 0) : NaN
    ok(cuatro && finitos && suma === 100,
      etiqueta, `-> [${r}]  suma ${suma}` + (finitos ? '' : '   HAY NaN/undefined'))
  }

  // EL CASO QUE FALTABA, el que ocurrio de verdad.
  sano(repartirPesos([40, 30, 30], 3, 20), 'array de TRES, moviendo el indice 3')
  sano(repartirPesos([40, 30, 30], 3, 100), 'array de TRES, indice 3 al 100')
  sano(repartirPesos([40, 60, 0], 3, 25), 'array de TRES de otro proyecto real')

  // Los ya corrompidos: `null` es lo que JSON.stringify escribe para un NaN.
  sano(repartirPesos([null, null, null, null], 3, 20), 'array con NULLS (proyecto corrompido)')
  sano(repartirPesos([null, null, null, null], 0, 50), 'array con nulls, moviendo el indice 0')
  sano(repartirPesos([40, null, 30, 0], 1, 25), 'array con UN null en medio')

  // Fuera de rango y valores no numericos: no deben propagar basura.
  sano(repartirPesos([40, 30, 30, 0], 9, 20), 'indice fuera de rango (9)')
  sano(repartirPesos([40, 30, 30, 0], -1, 20), 'indice negativo')
  sano(repartirPesos([40, 30, 30, 0], 3, NaN), 'valor NaN (parseInt de vacio)')
  sano(repartirPesos([], 3, 20), 'array VACIO')
  sano(repartirPesos(null, 3, 20), 'null en vez de array')

  // normalizarPesos por si misma: lo que decide si los proyectos se recuperan al abrirlos.
  const n3 = normalizarPesos([40, 30, 30])
  ok(n3.length === 4 && n3[3] === 0 && n3.reduce((a, b) => a + b, 0) === 100,
    'normalizarPesos rellena un array de tres con visual=0', `[${n3}]`)
  const nn = normalizarPesos([null, null, null, null])
  ok(nn.length === 4 && nn.every(v => Number.isFinite(v)) && nn.join() === PESOS_POR_DEFECTO.join(),
    'y un array de nulls cae al reparto por defecto', `[${nn}]`)
}

app.whenReady().then(() => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  try { main(bundle) } catch (e) { fallos.push('excepcion'); console.log('EXCEPCION: ' + e.stack) }

  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — el reparto cuadra con cuatro origenes y con visual=0 es el de antes.')
  }
  const exitCode = fallos.length ? 1 : 0
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  app.exit(exitCode)
})
