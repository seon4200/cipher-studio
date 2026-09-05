/**
 * LAS FUNCIONES PURAS DE LAS COMPOSICIONES: el candado del ciclo, la semilla y la palabra.
 * Aritmetica pura: ni ffmpeg, ni ventanas, ni React.
 *
 * Se importa del BUNDLE COMPILADO, no se reimplementa: una prueba que copiara la regla probaria
 * su copia y seguiria verde con la regla rota.
 *
 * POR QUE EXISTE ESTA SUITE. El log del render avisa de las duraciones ilegales que ocurren con
 * ciclos y datos REALES, pero solo cuando alguien renderiza. Esto las caza antes, sobre el
 * codigo. Ninguna de las dos capas sustituye a la otra: sin el log no se ven los ciclos que no
 * se te ocurrio probar, y sin la prueba el fallo llega a produccion y hay que estar mirando.
 *
 * LOS CASOS DEGENERADOS ESTAN DESDE EL PRINCIPIO. En reparto.js se escribieron despues y entre
 * medias la suite estuvo VERDE con un bug de NaN dentro, porque sus 74.088 casos usaban todos
 * entradas bien formadas.
 */
const { app } = require('electron')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..')
const fallos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}

function main (bundle) {
  const { fraccion, esLegal, divisoresDe, comprobarCiclo, ajustar, cicloValido } = bundle
  for (const [n, f] of Object.entries({ fraccion, esLegal, divisoresDe, comprobarCiclo, ajustar, cicloValido }))
    ok(typeof f === 'function', n + ' se exporta del bundle')
  if (typeof esLegal !== 'function' || typeof ajustar !== 'function') return

  // ── 0) cicloValido — la puerta de entrada de todo lo demas ────────────────────────
  ok(cicloValido(2.6) && cicloValido(0.001) && cicloValido(12), 'ciclos positivos finitos valen')
  ok(!cicloValido(0), 'ciclo 0 NO vale')
  ok(!cicloValido(-3), 'ciclo negativo NO vale')
  ok(!cicloValido(NaN), 'NaN NO vale')
  ok(!cicloValido(Infinity) && !cicloValido(-Infinity), 'Infinity NO vale')
  ok(!cicloValido('2.6'), 'una CADENA no vale aunque parezca un numero')
  ok(!cicloValido(null) && !cicloValido(undefined), 'null y undefined tampoco')

  // ── A) EL CASO QUE MOTIVA TODO ────────────────────────────────────────────────────
  // 1.5 s es legal con ciclo 3 y NO con 2.6, que es la mediana real de un Visual.
  ok(esLegal(3, 1.5), '1.5s ES legal con ciclo 3')
  ok(!esLegal(2.6, 1.5), '1.5s NO es legal con ciclo 2.6 — el literal que rompe el bucle')
  ok(!esLegal(2, 1.5), '1.5s tampoco con ciclo 2')
  ok(esLegal(2.6, 1.3), '1.3s si lo es con 2.6 (la mitad)')

  // ── B) fraccion() es legal SIEMPRE, por construccion ──────────────────────────────
  // Esta es la propiedad que hace del helper un candado y no una comodidad.
  const CICLOS = [0.5, 1, 1.7, 2, 2.6, 2.999, 3, 4.2, 6, 12]
  let malas = 0, total = 0
  for (const c of CICLOS) for (let n = 1; n <= 12; n++) {
    total++
    if (!esLegal(c, fraccion(c, n))) { malas++; if (malas <= 3) console.log(`          falla ciclo ${c} n ${n} -> ${fraccion(c, n)}`) }
  }
  ok(malas === 0, `fraccion(ciclo,n) es legal para los ${total} pares probados`,
    `${CICLOS.length} ciclos x 12 divisores`)

  // ── C) divisoresDe ──────────────────────────────────────────────────────────
  const L = divisoresDe(2.6)
  ok(L.length === 8, 'divisoresDe devuelve 8 por defecto', `${L.length}`)
  ok(L[0] === 2.6, 'la primera es el ciclo entero', String(L[0]))
  ok(L.every(d => esLegal(2.6, d)), 'y TODAS son legales para su ciclo')
  ok(divisoresDe(2.6, 3).length === 3, 'maxDivisor acota la lista')
  ok(L[0] > L[1] && L[1] > L[2], 'vienen de la mas larga a la mas corta')

  // ── D) comprobarCiclo: el texto que acaba en el log ───────────────────────────────
  const sinAvisos = comprobarCiclo(2.6, [
    { que: 'giro', d: 2.6 }, { que: 'respiracion', d: 1.3 }, { que: 'chispa', d: 2.6 / 6 }
  ])
  ok(sinAvisos.length === 0, 'tres duraciones derivadas del ciclo no producen ningun aviso',
    JSON.stringify(sinAvisos))

  const conAviso = comprobarCiclo(2.6, [{ que: 'respiracion', d: 1.5 }])
  ok(conAviso.length === 1, 'una duracion ilegal produce UN aviso')
  ok(conAviso[0].includes('respiracion') && conAviso[0].includes('1.5') && conAviso[0].includes('2.6'),
    'el aviso dice QUE animacion, su duracion y el ciclo', conAviso[0])
  ok(/fraccion\(ciclo, 2\)/.test(conAviso[0]),
    'y ofrece la legal mas cercana, para no obligar a dividir a mano', conAviso[0])

  // Una duracion MAYOR que el ciclo no es legal aunque la division sea limpia al reves.
  ok(!esLegal(2, 4), 'una duracion mayor que el ciclo no es legal')
  ok(comprobarCiclo(2, [{ que: 'larga', d: 4 }]).length === 1, 'y produce aviso')

  // ── E) DEGENERADOS ────────────────────────────────────────────────────────────────
  ok(!esLegal(0, 1), 'ciclo 0 no admite nada')
  ok(!esLegal(-3, 1), 'ciclo negativo tampoco')
  ok(!esLegal(2.6, 0), 'duracion 0 no es legal')
  ok(!esLegal(2.6, -1), 'duracion negativa tampoco')
  ok(!esLegal(NaN, 1) && !esLegal(2.6, NaN), 'NaN en cualquiera de los dos: no es legal')
  ok(!esLegal(Infinity, 1) && !esLegal(2.6, Infinity), 'Infinity tampoco')
  ok(divisoresDe(0).length === 0, 'divisoresDe(0) devuelve lista vacia')
  ok(divisoresDe(NaN).length === 0, 'divisoresDe(NaN) tambien')
  ok(fraccion(2.6, 0) === 2.6, 'fraccion con n<1 devuelve el ciclo entero, no Infinity',
    String(fraccion(2.6, 0)))
  ok(fraccion(2.6, NaN) === 2.6, 'fraccion con n NaN tambien', String(fraccion(2.6, NaN)))
  ok(fraccion(0, 2) === 0, 'fraccion con ciclo 0 devuelve 0, no NaN', String(fraccion(0, 2)))
  ok(comprobarCiclo(NaN, []).length === 1, 'un ciclo invalido se avisa por si mismo')
  ok(comprobarCiclo(2.6, null).length === 0, 'null en vez de lista no lanza')
  ok(comprobarCiclo(2.6, [null]).length === 1, 'una entrada null se avisa en vez de reventar')
  ok(comprobarCiclo(2.6, [{ que: 'rota', d: NaN }]).length === 1, 'una duracion NaN se avisa')

  // ── E2) ajustar — EL CANDADO QUE CORRIGE, no solo avisa ───────────────────────────
  // Avisar no basta: un aviso que nadie mira deja el bucle saltando igual. Lo que se comprueba
  // aqui es la PROPIEDAD que hace del candado un candado: pase lo que pase, sale algo legal.
  const legal = ajustar(2.6, 'ok', 1.3)
  ok(legal.d === 1.3 && legal.aviso === null, 'una duracion ya legal se devuelve intacta y sin aviso')

  const corr = ajustar(2.6, 'respira', 1.5)
  ok(esLegal(2.6, corr.d), 'una ILEGAL se corrige a una legal', `1.5 -> ${corr.d}`)
  ok(Math.abs(corr.d - 1.3) < 1e-9, 'y es la mas cercana, no una cualquiera', String(corr.d))
  ok(!!corr.aviso && corr.aviso.includes('CORREGIDO'), 'y lo dice, para que el literal se arregle')
  ok(/fraccion\(ciclo, 2\)/.test(corr.aviso), 'nombrando la llamada que habria que escribir', corr.aviso)

  // UNA DURACION MAYOR QUE EL CICLO. El caso que pediste: no se puede dividir por menos de 1.
  const larga = ajustar(2, 'demasiado', 5)
  ok(esLegal(2, larga.d) && larga.d === 2,
    'una duracion MAYOR que el ciclo se acota al ciclo entero', `5 -> ${larga.d}`)
  ok(!!larga.aviso, 'y avisa')
  const larga2 = ajustar(2.6, 'gigante', 1e9)
  ok(esLegal(2.6, larga2.d), 'aunque sea absurdamente mayor sigue saliendo algo legal',
    String(larga2.d))

  // DEGENERADOS: la propiedad tiene que aguantarlos, que es donde se rompio reparto.js.
  ok(ajustar(0, 'x', 1).d === 0, 'ciclo 0: devuelve 0 y no NaN')
  ok(!!ajustar(0, 'x', 1).aviso, 'ciclo 0: avisa')
  ok(ajustar(-3, 'x', 1).d === 0 && !!ajustar(-3, 'x', 1).aviso, 'ciclo negativo: 0 y aviso')
  ok(Number.isNaN(ajustar(NaN, 'x', 1).d) === false, 'ciclo NaN no propaga NaN a la duracion',
    String(ajustar(NaN, 'x', 1).d))
  for (const mala of [0, -1, NaN, Infinity, undefined, null, '1.3']) {
    const r = ajustar(2.6, 'mala', mala)
    if (!esLegal(2.6, r.d) || !r.aviso) {
      ok(false, `ajustar(2.6, ${JSON.stringify(mala)}) deberia dar algo legal y avisar`,
        JSON.stringify(r))
    }
  }
  ok(true, 'toda duracion basura sale corregida a algo legal Y con aviso',
    '0, -1, NaN, Infinity, undefined, null, "1.3"')

  // La propiedad, en bloque: NINGUNA combinacion produce una duracion ilegal.
  let ilegales = 0, pares = 0
  for (const c of CICLOS) for (const d of [0.1, 0.5, 1, 1.3, 1.5, 2, 2.6, 3, 7, 100]) {
    pares++
    if (!esLegal(c, ajustar(c, 'p', d).d)) ilegales++
  }
  ok(ilegales === 0, `ajustar SIEMPRE devuelve legal: ${pares} pares probados`,
    `${CICLOS.length} ciclos x 10 duraciones`)

  // ── F) COMA FLOTANTE ──────────────────────────────────────────────────────────────
  // 2.6/3*3 no da 2.6 exacto. Si la comparacion fuera === , esto fallaria.
  ok(esLegal(2.6, 2.6 / 3), 'ciclo/3 es legal pese al error de coma flotante',
    `${2.6 / 3} x3 = ${(2.6 / 3) * 3}`)
  ok(esLegal(0.1 + 0.2, (0.1 + 0.2) / 2), 'y con el clasico 0.1+0.2 tambien')
}

// ── G) LA SEMILLA ───────────────────────────────────────────────────────────────────
//
// Vive aqui y no en una suite aparte porque es la otra mitad de lo mismo: las dos son las
// funciones puras de las que dependen las composiciones.
//
// LO QUE SE PRUEBA Y POR QUE. La semilla sale de la PALABRA, y la palabra esta en la clave del
// hash del MOV. O sea que la clave promete describir el dibujo. Si `semillaDe` no fuera
// determinista, dos renders de la misma palabra darian dibujos distintos bajo el mismo nombre
// de fichero y la cache mentiria — el peor modo de fallo que hay aqui, porque el sistema
// afirmaria que ha acertado.
function semillas (bundle) {
  const { semillaDe, generador, entre, entero } = bundle
  for (const [n, f] of Object.entries({ semillaDe, generador, entre, entero }))
    ok(typeof f === 'function', n + ' se exporta del bundle')
  if (typeof semillaDe !== 'function') return

  // G1. DETERMINISMO. Es la propiedad de la que depende la honestidad de la cache.
  ok(semillaDe('universidades') === semillaDe('universidades'),
    'la misma palabra da SIEMPRE la misma semilla')
  const g1 = generador(semillaDe('historico'))
  const g2 = generador(semillaDe('historico'))
  const s1 = [g1(), g1(), g1(), g1()], s2 = [g2(), g2(), g2(), g2()]
  ok(JSON.stringify(s1) === JSON.stringify(s2),
    'y la secuencia completa del generador tambien')

  // G2. DISPERSION. Sin esto la variedad seria teorica.
  const PALS = ['inteligencia', 'universidades', 'historico', 'cognitivos', 'estadios',
    'persecucion', 'milagro', 'contradiccion', 'paises', 'guerra', 'agua', 'mundial']
  const vistas = new Set(PALS.map(semillaDe))
  ok(vistas.size === PALS.length, `${PALS.length} palabras reales dan ${vistas.size} semillas distintas`)
  // Y que la diferencia SE VEA: dos palabras que solo cambian en una letra.
  ok(semillaDe('casa') !== semillaDe('caso'), 'una sola letra distinta cambia la semilla')
  ok(semillaDe('agua') !== semillaDe('auga'), 'y el ORDEN de las letras tambien')

  // G3. EL CERO. Un estado 0 deja el generador multiplicativo clavado en 0 para siempre:
  // todas esas palabras darian la MISMA disposicion degenerada.
  let ceros = 0
  for (const p of PALS) if (semillaDe(p) === 0) ceros++
  ok(ceros === 0, 'ninguna palabra da semilla 0')
  const gc = generador(0)
  const v = [gc(), gc(), gc()]
  ok(v.every(x => x > 0 && x < 1) && new Set(v).size === 3,
    'y generador(0) NO se queda clavado: se protege el estado', JSON.stringify(v))

  // G4. DEGENERADOS DESDE EL PRINCIPIO.
  for (const malo of ['', null, undefined, 0, NaN, {}, []]) {
    const r = semillaDe(malo)
    if (!Number.isFinite(r) || r < 1) {
      ok(false, `semillaDe(${JSON.stringify(malo)}) deberia dar un entero >= 1`, String(r))
    }
  }
  ok(true, 'toda entrada basura da un entero >= 1', 'vacio, null, undefined, 0, NaN, {}, []')
  for (const mala of [NaN, Infinity, -5, 0, null, undefined]) {
    const g = generador(mala)
    const x = [g(), g()]
    if (!x.every(n => Number.isFinite(n) && n > 0 && n < 1)) {
      ok(false, `generador(${JSON.stringify(mala)}) produjo algo fuera de (0,1)`, JSON.stringify(x))
    }
  }
  ok(true, 'generador con semilla basura sigue dando reales en (0,1)', 'NaN, Infinity, -5, 0, null, undefined')

  // G5. entre / entero — los rangos de los que salen capas, ancho, amplitud y cabeceo.
  const g = generador(semillaDe('prueba'))
  let fuera = 0
  for (let i = 0; i < 500; i++) {
    const e = entre(g, 34, 50), n = entero(g, 28, 52)
    if (e < 34 || e >= 50) fuera++
    if (n < 28 || n > 52 || !Number.isInteger(n)) fuera++
  }
  ok(fuera === 0, '500 sorteos de entre() y entero() caen todos dentro del rango')
  ok(entre(g, 50, 34) >= 34 && entre(g, 50, 34) < 50, 'entre() con los limites al reves no da NaN')
  ok(entero(g, 52, 28) >= 28, 'entero() con los limites al reves tampoco')
  ok(entre(g, NaN, 5) === 0 && entero(g, NaN, 5) === 0, 'con limites NaN devuelven 0, no NaN')

  // G6. LA VARIEDAD SE NOTA. No basta con que las semillas difieran: lo que tiene que
  // diferir es la FORMA. Se reproduce la derivacion de extrusion.tsx y se comprueba que dos
  // palabras seguidas no dan la misma silueta.
  const forma = (pal) => {
    const r = generador(semillaDe(pal))
    return { capas: entero(r, 28, 52), ancho: +entre(r, 34, 50).toFixed(1),
             amp: +entre(r, 22, 30).toFixed(1), cab: +entre(r, -18, -8).toFixed(1) }
  }
  const formas = PALS.map(forma)
  const claves = new Set(formas.map(f => JSON.stringify(f)))
  ok(claves.size === PALS.length, `las ${PALS.length} palabras dan ${claves.size} formas distintas`)
  const anchos = formas.map(f => f.ancho)
  ok(Math.max(...anchos) - Math.min(...anchos) > 8,
    'y el ancho recorre el rango de verdad, no se apiña',
    `de ${Math.min(...anchos)} a ${Math.max(...anchos)} cqw`)
  const amps = formas.map(f => f.amp)
  ok(Math.min(...amps) >= 22 && Math.max(...amps) <= 30,
    'la amplitud del vaiven se queda en la banda contenida 22-30',
    `de ${Math.min(...amps)} a ${Math.max(...amps)} grados`)
}

// ── H) LA PALABRA QUE SE PINTA ─────────────────────────────────────────────────────
//
// `palabraDelTramo` devolvia `word.trim()`, asi que la coma o el punto entraban en el Visual.
// MEDIDO sobre un proyecto real: 9 de 37 palabras (24%) llevaban puntuacion pegada —
// "fallecidos.", "maneras,", "sincronizada.", "Millenium.".
//
// La limpieza que ya existia servia para COMPARAR, no para devolver: pasa a minusculas, y
// "Millenium." habria salido "millenium".
function palabras (bundle) {
  const { recortarPuntuacion, tieneSignificado, palabraDelTramo } = bundle
  for (const [n, f] of Object.entries({ recortarPuntuacion, tieneSignificado, palabraDelTramo }))
    ok(typeof f === 'function', n + ' se exporta del bundle')
  if (typeof recortarPuntuacion !== 'function') return

  const W = (word, start, end) => ({ word, start, end })

  // H1. LOS CASOS REALES que se midieron.
  const REALES = [
    ['fallecidos.', 'fallecidos'], ['maneras,', 'maneras'],
    ['sincronizada.', 'sincronizada'], ['Millenium.', 'Millenium'],
    ['espontáneo,', 'espontáneo'], ['sincronizándose.', 'sincronizándose'],
    ['ejército.', 'ejército'], ['mecanismo,', 'mecanismo'], ['distanciaban,', 'distanciaban']
  ]
  let mal = 0
  for (const [dentro, fuera] of REALES) {
    if (recortarPuntuacion(dentro) !== fuera) {
      mal++; ok(false, `recortarPuntuacion("${dentro}")`, 'dio "' + recortarPuntuacion(dentro) + '"')
    }
  }
  ok(mal === 0, `los ${REALES.length} casos medidos en el proyecto real salen limpios`,
    REALES.map(([a, b]) => a + '->' + b).join('  '))

  // H2. MAYUSCULAS Y TILDES SE CONSERVAN. Es lo que separa esto de `limpiar`.
  ok(recortarPuntuacion('Millenium.') === 'Millenium', 'la MAYUSCULA sobrevive')
  ok(recortarPuntuacion('¿Ejército?') === 'Ejército', 'tilde y mayuscula juntas, con signos a los dos lados')
  ok(recortarPuntuacion('«Ñandú»') === 'Ñandú', 'comillas latinas, eñe y tilde')
  ok(recortarPuntuacion('DÜSSELDORF,') === 'DÜSSELDORF', 'diereses en mayuscula tambien')

  // H3. SOLO LOS BORDES. Lo de dentro no se toca.
  ok(recortarPuntuacion('48.6%') === '48.6', 'el punto INTERIOR de una cifra se conserva')
  ok(recortarPuntuacion('post-guerra') === 'post-guerra', 'el guion interior tambien')
  ok(recortarPuntuacion('"post-guerra".') === 'post-guerra', 'y a la vez se limpian los extremos')

  // H4. EL CASO QUE PEDISTE: una palabra que sea SOLO puntuacion no se elige NUNCA.
  const SOLO_SIGNOS = ['...', ',', '—', '¿?', '«»', '!!!', '  ', '', '"', '-']
  let elegibles = 0
  for (const p of SOLO_SIGNOS) if (tieneSignificado(p)) elegibles++
  ok(elegibles === 0, 'ninguna cadena de SOLO puntuacion tiene significado',
    SOLO_SIGNOS.map(p => JSON.stringify(p)).join(' '))
  for (const p of SOLO_SIGNOS) if (recortarPuntuacion(p) !== '') {
    ok(false, 'recortarPuntuacion(' + JSON.stringify(p) + ') deberia dar vacio',
      JSON.stringify(recortarPuntuacion(p)))
  }
  ok(true, 'y todas se recortan a cadena vacia')

  // Y en el tramo: rodeada de signos, se elige la unica palabra de verdad.
  const conSignos = palabraDelTramo(
    [W('...', 0, 0.2), W('—', 0.2, 0.3), W('ejércitos,', 0.3, 1.0), W('¿?', 1.0, 1.1)], 0, 2)
  ok(conSignos === 'ejércitos', 'en un tramo lleno de signos se elige la palabra y sale limpia',
    JSON.stringify(conSignos))

  // Un tramo que SOLO tiene signos no devuelve nada, en vez de devolver un punto.
  ok(palabraDelTramo([W('...', 0, 0.5), W(',', 0.5, 1)], 0, 2) === null,
    'un tramo de solo signos devuelve null')

  // H5. LA SALIDA NUNCA ES VACIA. Si se eligio, es porque paso tieneSignificado (3+ limpios).
  const muestras = [
    [W('«termodinámica».', 0, 1)], [W('48.6%.', 0, 1)], [W('Millenium,', 0, 1)],
    [W('a', 0, 0.2), W('de', 0.2, 0.4), W('ONU.', 0.4, 1)]
  ]
  let vacias = 0
  for (const m of muestras) {
    const r = palabraDelTramo(m, 0, 2)
    if (r !== null && r.length === 0) vacias++
  }
  ok(vacias === 0, 'palabraDelTramo nunca devuelve cadena vacia: o una palabra o null')

  // H6. LAS CIFRAS SIGUEN VALIENDO. Era el motivo de la limpieza anterior.
  ok(tieneSignificado('48.6%'), 'una cifra con simbolo sigue teniendo significado')
  ok(palabraDelTramo([W('un', 0, 0.2), W('48.6%.', 0.2, 1)], 0, 2) === '48.6',
    'y se elige, limpia de puntuacion en los bordes')

  // H7. DEGENERADOS.
  ok(recortarPuntuacion(null) === '' && recortarPuntuacion(undefined) === '',
    'null y undefined dan cadena vacia, no "null"')
  ok(recortarPuntuacion(123) === '123', 'un numero se convierte a texto')
  ok(palabraDelTramo(null, 0, 1) === null, 'sin lista de palabras devuelve null')
  ok(palabraDelTramo([], 0, 1) === null, 'lista vacia devuelve null')
}

// ── I) LOS TRES CONCEPTOS ───────────────────────────────────────────────────────────
//
// Vienen de DeepSeek y van dentro de `extra`, que entra en la CLAVE DEL HASH. Un campo de mas
// cambiaria el hash sin cambiar un pixel; un array de longitud variable llegaria a la
// composicion y la reventaria, y un render fallido es un Visual ausente — medido: 3.24 s de
// narracion perdidos por esa via.
function conceptos (bundle) {
  const { sanearConceptos, CUANTOS_CONCEPTOS, MAX_PALABRAS_ETIQUETA } = bundle
  ok(typeof sanearConceptos === 'function', 'sanearConceptos se exporta del bundle')
  if (typeof sanearConceptos !== 'function') return
  ok(CUANTOS_CONCEPTOS === 3, 'son 3 conceptos', String(CUANTOS_CONCEPTOS))
  ok(MAX_PALABRAS_ETIQUETA === 2, 'la etiqueta admite 2 palabras', String(MAX_PALABRAS_ETIQUETA))

  const C = (e, t) => ({ emoji: e, etiqueta: t })
  const AGUA = '\u{1F4A7}', FABRICA = '\u{1F3ED}', ESPIGA = '\u{1F33E}'
  const TRES = [C(AGUA, 'Agua'), C(FABRICA, 'Industria'), C(ESPIGA, 'Cultivo')]

  // I1. EL CAMINO BUENO.
  const r = sanearConceptos(TRES)
  ok(Array.isArray(r) && r.length === 3, 'tres bien formados salen tres')
  ok(r && r[0].etiqueta === 'Agua' && r[0].emoji === AGUA, 'y con su contenido intacto')

  // I2. LA PROYECCION A DOS CLAVES. Es lo que protege el hash: una clave de mas cambiaria la
  //     clave del MOV sin cambiar un solo pixel.
  const conRuido = TRES.map(x => ({ emoji: x.emoji, etiqueta: x.etiqueta, confianza: 0.9, id: 7 }))
  const s2 = sanearConceptos(conRuido)
  const claves = s2 ? Object.keys(s2[0]).sort().join(',') : ''
  ok(claves === 'emoji,etiqueta', 'las claves de mas se descartan: solo emoji y etiqueta',
    'quedaron: ' + claves)

  // I3. MENOS DE TRES -> null. No se rellena con una caja vacia.
  ok(sanearConceptos(TRES.slice(0, 2)) === null, 'DOS conceptos dan null, no un relleno')
  ok(sanearConceptos(TRES.slice(0, 1)) === null, 'uno tambien')
  ok(sanearConceptos([]) === null, 'lista vacia da null')

  // I4. MAS DE TRES -> los tres primeros, en orden.
  const cinco = sanearConceptos(TRES.concat([C('\u{1F525}', 'Fuego'), C('\u{1F30A}', 'Ola')]))
  ok(cinco && cinco.length === 3, 'cinco conceptos se cortan a tres')
  ok(cinco && cinco[2].etiqueta === 'Cultivo', 'y son los TRES PRIMEROS, en su orden')

  // I5. LA ETIQUETA DE DOCE PALABRAS, el caso que se pregunto.
  const larga = sanearConceptos([
    C(AGUA, 'una etiqueta absurdamente larga que no cabe en la caja pequeña'), TRES[1], TRES[2]])
  ok(larga && larga[0].etiqueta === 'una etiqueta', 'doce palabras se recortan a DOS',
    larga ? JSON.stringify(larga[0].etiqueta) : 'null')
  ok(larga && larga[0].etiqueta.split(/\s+/).length <= 2, 'y nunca mas de dos')
  // Se corta por PALABRAS: por caracteres dejaria "una etiquet", partida a mitad.
  ok(!/etiquet$/.test(larga ? larga[0].etiqueta : ''), 'el corte es por palabras, no parte la ultima')

  // I6. EL EMOJI: uno solo, y sin partir los compuestos.
  const tres = sanearConceptos([C(AGUA + FABRICA + ESPIGA, 'Agua'), TRES[1], TRES[2]])
  ok(tres && tres[0].emoji === AGUA, 'tres emojis se reducen al PRIMERO',
    tres ? JSON.stringify(tres[0].emoji) : 'null')
  // ZWJ: la agricultora son tres puntos de codigo unidos. Partirla da otro glifo.
  const zwj = '\u{1F469}‍\u{1F33E}'
  const comp = sanearConceptos([C(zwj, 'Campo'), TRES[1], TRES[2]])
  ok(comp && comp[0].emoji === zwj, 'un emoji COMPUESTO con ZWJ no se parte',
    comp ? JSON.stringify(comp[0].emoji) : 'null')

  // I7. DEGENERADOS DESDE EL PRINCIPIO.
  let colados = 0
  for (const malo of [null, undefined, 0, '', 'texto', {}, 42, NaN]) {
    if (sanearConceptos(malo) !== null) colados++
  }
  ok(colados === 0, 'toda entrada que no sea un array da null',
    'null, undefined, 0, "", "texto", {}, 42, NaN')
  ok(sanearConceptos([null, undefined, TRES[0]]) === null,
    'entradas nulas dentro del array se saltan; si no quedan tres, null')
  ok(sanearConceptos([C('', 'Agua'), TRES[1], TRES[2]]) === null, 'un concepto sin emoji no cuenta')
  ok(sanearConceptos([C(AGUA, ''), TRES[1], TRES[2]]) === null,
    'ni uno sin etiqueta: media caja no es un concepto')
  ok(sanearConceptos([C(AGUA, '   '), TRES[1], TRES[2]]) === null,
    'una etiqueta de solo espacios tampoco')
  ok(sanearConceptos([C(AGUA, null), TRES[1], TRES[2]]) === null,
    'ni una etiqueta null: no se pinta la palabra "null"')

  // I8. NUNCA LANZA. Es la propiedad que evita convertir un dato malo en un Visual ausente.
  let lanzo = false
  const hostiles = [[{}], [[]], [{ emoji: {}, etiqueta: [] }], [Object.create(null)],
    [{ get emoji () { throw new Error('trampa') } }]]
  for (const bestia of hostiles) {
    try { sanearConceptos(bestia) } catch (e) { lanzo = true }
  }
  ok(!lanzo, 'no lanza ni con objetos hostiles: un render muerto seria un Visual ausente')

  // I9. DETERMINISTA. Entra en el hash, asi que dos llamadas iguales deben dar lo mismo.
  const a = JSON.stringify(sanearConceptos(conRuido))
  let estables = 0
  for (let i = 0; i < 100; i++) if (JSON.stringify(sanearConceptos(conRuido)) === a) estables++
  ok(estables === 100, '100 llamadas con los mismos datos dan el mismo resultado')

  // ── I10) `extra` EN LA CLAVE DEL HASH ─────────────────────────────────────────────
  //
  // Los conceptos y la posicion viajan DENTRO de graphicData.extra justamente para esto: si
  // fueran por fuera, dos Visuales con dibujos distintos compartirian .mov y la cache diria
  // ACIERTO sobre un fichero que no es el suyo. Aqui se comprueba que la clave los distingue.
  const { hashGrafico } = bundle
  if (typeof hashGrafico !== 'function') { ok(false, 'hashGrafico se exporta del bundle'); return }
  const H = (extra) => hashGrafico({ type: 'visual_extrusion', value: 'agua', extra },
    1080, 1920, 2.6, 30, 'pantalla', 'voltaje')

  const CON = { pos: '3:1', conceptos: TRES }
  const SIN = { pos: '3:1', conceptos: null }

  ok(H(CON) !== H(SIN), 'con conceptos y sin conceptos dan hashes DISTINTOS',
    H(CON) + ' vs ' + H(SIN))
  ok(H(CON) === H({ pos: '3:1', conceptos: TRES }), 'dos identicos dan el MISMO hash')
  ok(H(CON) === H({ conceptos: TRES, pos: '3:1' }),
    'y el ORDEN DE CLAVES no cambia el hash: canonizar las ordena')

  // LA POSICION distingue. Es lo que arregla que 37 clips compartieran 36 ficheros.
  ok(H({ pos: '3:1', conceptos: TRES }) !== H({ pos: '4:0', conceptos: TRES }),
    'la misma palabra en POSICIONES distintas da hashes distintos')
  // Y el par no colisiona donde la suma si lo haria: 3+1 = 4+0 = 4.
  ok(H({ pos: '3:1', conceptos: null }) !== H({ pos: '4:0', conceptos: null }),
    'el par "3:1" y "4:0" no colisionan, cosa que la SUMA si haria')

  // EL ORDEN DE LOS CONCEPTOS cuenta: se pintan en sitios distintos, asi que son otro dibujo.
  const barajado = [TRES[2], TRES[0], TRES[1]]
  ok(H({ pos: '3:1', conceptos: TRES }) !== H({ pos: '3:1', conceptos: barajado }),
    'barajar los tres conceptos da otro hash: el orden es semantico')

  // UNA CLAVE DE MAS cambiaria el hash sin cambiar un pixel. Por eso `sanearConceptos`
  // proyecta a dos claves: aqui se comprueba que su salida ya viene limpia.
  ok(H({ pos: '3:1', conceptos: sanearConceptos(conRuido) }) === H(CON),
    'el ruido saneado da el mismo hash que los datos limpios: la proyeccion protege la clave')

  // DEGENERADOS: ninguno puede lanzar ni producir un hash vacio.
  let hashesMalos = 0
  for (const e of [null, undefined, {}, { pos: null, conceptos: null }, { pos: '', conceptos: [] },
    { conceptos: undefined }, [], 'texto', 0]) {
    try {
      const h = H(e)
      if (typeof h !== 'string' || h.length !== 12) hashesMalos++
    } catch (err) { hashesMalos++ }
  }
  ok(hashesMalos === 0, 'todo `extra` degenerado produce un hash valido de 12 caracteres',
    'null, undefined, {}, claves nulas, vacios, [], "texto", 0')

  // Y el caso que mas duele: null y undefined COLAPSAN a la misma clave por diseño de
  // canonizar. Se fija para que nadie lo cambie sin darse cuenta.
  ok(H({ pos: '3:1', conceptos: null }) === H({ pos: '3:1', conceptos: undefined }),
    'conceptos null y undefined dan el MISMO hash (canonizar los colapsa)')

  // ── J) EL ESPACIO DE ESTILOS, CALCULADO POR EL CODIGO ─────────────────────────────
  //
  // "Cuantos estilos tengo" no puede ser una multiplicacion escrita en un documento: el dia que
  // una regla nueva recorte el espacio, el documento seguiria diciendo el numero viejo. Aqui lo
  // calcula `combinacionesLegales` recorriendo los registros, y esta suite lo FIJA.
  //
  // SI ESTE NUMERO BAJA, NO LO ACTUALICES SIN MIRAR POR QUE. Que baje significa que una pieza
  // nueva no cumple una regla, o que una regla nueva ha recortado el espacio. Las dos cosas hay
  // que verlas; ninguna se arregla cambiando el numero de aqui.
  console.log('')
  console.log('=== J) EL REGISTRO DE PIEZAS Y EL ESPACIO DE ESTILOS ===')
  const { combinacionesLegales, FONDOS_ESCENA, ESTRUCTURAS_ESCENA, CAMARAS_ESCENA,
    TIPOGRAFIAS, direccionDe, direccionDesde, maxCaracteresPie, cabeEnElPie } = bundle
  ok(typeof combinacionesLegales === 'function', 'combinacionesLegales se exporta del bundle')
  if (typeof combinacionesLegales !== 'function') return

  // DOS NUMEROS, Y NO SE MEZCLAN.
  //   identidades = combinaciones de EJES. Impide que dos Visuales SE VEAN IGUAL.
  //   instancias  = identidades x los rangos discretizados. Impide ver ESTA ESCENA otra vez.
  // El fallo de formaDe(semilla) fue creer que las segundas sustituyen a las primeras: cuatro
  // rangos barridos y los quintiles planos. Sumarlos aqui repetiria el mismo error de lectura.
  const REP = combinacionesLegales()
  const PRU = combinacionesLegales({ incluirPruebas: true })
  ok(typeof REP === 'object' && 'identidades' in REP && 'instancias' in REP,
    'combinacionesLegales devuelve identidades E instancias, no un solo numero',
    JSON.stringify(REP))
  // A.1: deriva=1, medida contra lab-camara-2.html:90-91. Reclasifica pares,
  // no cambia el sorteo ni crea dibujos nuevos. Los pasos siguen provisionales.
  ok(REP.identidades === 48, 'el repertorio da 48 IDENTIDADES en 9:16', String(REP.identidades))
  ok(REP.instancias === 3782310, 'y 3.782.310 INSTANCIAS nominales', String(REP.instancias))
  ok(PRU.identidades === 210, 'con las piezas de prueba, 210 identidades', String(PRU.identidades))
  ok(Math.abs(bundle.MARGEN_CAMARA_PIE_Y - 9.72 / 1920 * 100) < 1e-12,
    'A.4: la reserva de cámara conserva los 9.72 px medidos')
  // El lote se inspecciona en el banco, pero NO debe cambiar el repertorio del producto.
  const lote = require('./aceptacion/fixtures/lote-estructuras-1.json')
  const nuevas = lote.estructuras.slice(3)
  for (const id of nuevas) {
    const e = ESTRUCTURAS_ESCENA[id]
    ok(e.prueba === true && e.rangos.length === 0 && e.minConceptos === 1,
      id + ': pendiente de aprobacion, sin escalones inventados')
    for (const cantidad of [0, 1, 3]) {
      for (const longitud of [1, 17, bundle.MAX_CARACTERES_ETIQUETA]) {
        const etiquetas = Array(cantidad).fill('x'.repeat(longitud))
        const pts = e.disposicion.puntos(bundle.generador(42), etiquetas, {})
        ok(pts.length === cantidad && JSON.stringify(pts) ===
          JSON.stringify(e.disposicion.puntos(bundle.generador(42), etiquetas, {})),
        `${id}: ${cantidad} conceptos de ${longitud}, determinista`)
        ok(pts.every(p => p.x - bundle.anchoCaja(etiquetas[0], true) / 2 >= bundle.ZONA_X_MIN &&
          p.x + bundle.anchoCaja(etiquetas[0], true) / 2 <= bundle.ZONA_X_MAX &&
          p.y - bundle.altoCaja(true) / 2 >= bundle.ZONA.yMin &&
          p.y + bundle.altoCaja(true) / 2 <= e.presupuestoTexto - bundle.MARGEN_CAMARA_PIE_Y),
        `${id}: bordes dentro del modelo con reserva de cámara, ${cantidad}/${longitud}`)
      }
    }
  }
  ok(Array.from({ length: 1000 }, (_, i) => direccionDe(i + 1))
    .every(d => !nuevas.includes(d.estructura)), '1000 semillas: el lote no sale en videos')
  const etiquetasHuella = ['archivo', 'memoria', 'conexion']
  const huellas = Object.values(ESTRUCTURAS_ESCENA).map(e => ({ id: e.id,
    huella: JSON.stringify(e.disposicion.puntos(bundle.generador(42), etiquetasHuella, {})) }))
  const repetidas = huellas.filter((a, i) => huellas.some((b, j) => i < j && a.huella === b.huella))
  ok(repetidas.length === 0, 'ninguna estructura comparte disposicion de cajas con la misma entrada',
    huellas.map(x => x.id + ':' + x.huella).join(' | '))
  const densidadesInvalidas = Object.values(ESTRUCTURAS_ESCENA).flatMap(e =>
    [1, 3, 5, 8, 14].filter(n => { const a = e.disposicion.adaptarDensidad(n); return a.elementos !== n || !(a.escala > 0) || !(a.separacion > 0) || a.opacidadSecundaria < 0 || a.opacidadSecundaria > 1 }).map(n => e.id + ':' + n))
  ok(densidadesInvalidas.length === 0, 'las estructuras declaran adaptacion valida para las cinco densidades',
    densidadesInvalidas.join(', '))
  ok(lote.estructuras.every(id => ESTRUCTURAS_ESCENA[id]) &&
    lote.composicion === 'visual_escena' && lote.sistema === 'voltaje' &&
    lote.escala === .45 && lote.miniatura.ancho === lote.lienzo.ancho * lote.escala &&
    lote.miniatura.alto === lote.lienzo.alto * lote.escala && lote.cicloSegundos === 3,
  'fixture del lote: seis estructuras existentes, escala y condiciones explicitas')
  ok(FONDOS_ESCENA.tramaTejida.tono === 'claro' && FONDOS_ESCENA.tramaTejida.rangos.length === 0,
    'el tejido declara tono claro y no inventa escalones de instancia')

  const medidas = require('./aceptacion/fixtures/metricas-tipografias.json')
  for (const m of medidas.tipografias) {
    const f = TIPOGRAFIAS[m.id]
    const hashFuente = require('crypto').createHash('sha256').update(require('fs').readFileSync(
      path.join(RAIZ, 'dist/fonts', m.fichero))).digest('hex')
    ok(hashFuente === m.sha256, m.id + ': el asset sigue siendo el que se midio')
    ok(f.id === m.id && !!f.descripcion && f.formatos.length > 0 &&
      !('energia' in f) && !('rangos' in f), m.id + ': contrato sin energia ni rangos')
    ok(f.familia === m.familia && f.peso === m.peso && f.transformacion === m.transformacion &&
      f.emPorCaracter === Math.max(...Object.values(m.anchosEm)) &&
      f.caracterMasAncho === m.caracterMasAncho, m.id + ': metrica igual al maximo MEDIDO')
    const n = maxCaracteresPie(m.id)
    ok(n === (m.id === 'archivo' ? 18 : 24), m.id + ': limite conservador de dos lineas', String(n))
    ok(cabeEnElPie(f.caracterMasAncho.repeat(n), m.id) &&
      !cabeEnElPie(f.caracterMasAncho.repeat(n + 1), m.id), m.id + ': acepta el limite y rechaza uno mas')
    ok(!cabeEnElPie('', m.id) && !cabeEnElPie(null, m.id), m.id + ': el vacio cae al respaldo')
    ok(direccionDesde({ tipografia: m.id }, 42).tipografia === m.id,
      m.id + ': la direccion explicita gana al sorteo')
  }
  ok(direccionDesde({ tipografia: 'inventada' }, 42).tipografia === direccionDe(42).tipografia,
    'tipografia desconocida vuelve al sorteo')
  ok(!cabeEnElPie('ß'.repeat(13), 'anton'), 'la puerta cuenta DESPUES de pasar a versal')
  // A.2: 56 era un ajuste medio que admitia 1845 px en 900 px disponibles.
  // No se congela un nuevo tope: se comprueba el borde usando la funcion del bundle.
  const limiteCaja = bundle.MAX_CARACTERES_ETIQUETA
  // A.3 queda aplazada hasta B; el registro aplicado sigue siendo la métrica A.2.
  // Se ata a la medición de base y a SU asset, sin DOM en la suite.
  const medicionA3 = require('./aceptacion/plan-a3-20260905/sondeo.json')
  const filaA3 = medicionA3.filas[0]
  const cajasMedidas = { modelo: filaA3, casos: filaA3.casos, barrido: [],
    fuenteSHA256: medicionA3.condiciones.fuenteSHA256 }
  ok(limiteCaja === cajasMedidas.modelo.limite && bundle.cabeLaEtiqueta('@'.repeat(limiteCaja)) &&
    !bundle.cabeLaEtiqueta('@'.repeat(limiteCaja + 1)), 'cota de Archivo 700: limite y siguiente')
  ok(!bundle.cabeLaEtiqueta('W'.repeat(56)) &&
    bundle.anchoCaja('W'.repeat(56), true) * 10.8 >= 1845.421875,
    'regresion 56 W: rechaza y no subestima la medida DOM original')
  ok(!bundle.cabeLaEtiqueta('漢字'), 'un caracter no medido no se presume estrecho')
  ok(bundle.cabeLaEtiqueta('ÁÉÍÓÚÜÑ - O\'Hara'), 'espacio, guion, apostrofo y acentos medidos')
  const metricaCaja = bundle.METRICAS_ETIQUETA[bundle.METRICA_ETIQUETA]
  ok(metricaCaja.emPorCaracter >= metricaCaja.emMaximoMedido,
    'cota redondeada hacia arriba, nunca promedio')
  ok(JSON.stringify(bundle.METRICAS_ETIQUETA) === JSON.stringify(cajasMedidas.modelo.metricas) &&
    JSON.stringify(bundle.GEOMETRIA_CAJA) === JSON.stringify(cajasMedidas.modelo.geometria),
    'registro y geometria coinciden con la medicion versionada')
  const hashCaja = require('crypto').createHash('sha256').update(require('fs').readFileSync(
    path.join(RAIZ, 'dist/fonts', metricaCaja.fichero))).digest('hex')
  ok(hashCaja === cajasMedidas.fuenteSHA256, 'la fuente de cajas es la que se midio')
  const acotadas = [...cajasMedidas.casos, ...cajasMedidas.barrido]
    .filter(c => c.modeloPx !== null)
  ok(acotadas.every(c => bundle.anchoCaja(c.texto, true) * 10.8 >= c.ancho),
    'la cota del bundle cubre las cajas DOM guardadas, incluido el barrido de 111 caracteres')
  ok(bundle.cabeLaEtiqueta('responsabilidades') && filaA3.referencia.intervaloPx > 0,
    'A.3: conserva la referencia real de 17 caracteres con margen positivo')
  ok(filaA3.rechazos === 0 && filaA3.vacios === 0 && filaA3.limiteDom === limiteCaja &&
    filaA3.casos.every(c => bundle.cabeLaEtiqueta(c.texto) === c.admitida),
    'A.3: puerta del bundle coincide con muestra real y frontera DOM versionadas')
  // Congelar salidas del catalogo obligaba a editar esta prueba con cada pieza nueva.
  // Una prueba que se edita para ponerse verde deja de probar. El invariante es el ORDEN
  // de consumo y tipografia ultima, no que una semilla siga eligiendo el fondo de ayer.
  require('./ayudas/orden-direccion')(bundle, path.join(RAIZ, 'dist-electron/main/index.js'), ok)

  // LAS INSTANCIAS NUNCA SON MENOS QUE LAS IDENTIDADES: cada identidad tiene al menos una.
  ok(REP.instancias >= REP.identidades, 'instancias >= identidades, siempre',
    REP.instancias + ' >= ' + REP.identidades)

  // Y UNA PIEZA SIN RANGOS APORTA x1, no x0. Si aportara cero, una sola pieza sin rangos
  // aniquilaria el recuento entero y nadie lo notaria: el numero saldria 0 y pareceria una regla.
  ok(PRU.instancias > 0, 'las piezas sin rangos multiplican por 1, no por 0',
    String(PRU.instancias))

  // LOS TRES REGISTROS EXISTEN Y TIENEN CONTRATO. Una pieza sin `descripcion` deja a la IA de
  // la Fase 7 eligiendo a ciegas, y eso no da ningun error.
  for (const [nom, reg] of [['fondos', FONDOS_ESCENA], ['estructuras', ESTRUCTURAS_ESCENA],
                            ['camaras', CAMARAS_ESCENA]]) {
    const ps = Object.values(reg)
    const malas = ps.filter(p => !p.id || !p.descripcion || typeof p.energia !== 'number' ||
      !Array.isArray(p.formatos) || p.formatos.length === 0 || !Array.isArray(p.rangos))
    ok(malas.length === 0, 'todas las piezas de ' + nom + ' declaran el contrato base',
      ps.length + ' piezas: ' + ps.map(p => p.id).join(', '))
    const fuera = ps.filter(p => p.energia < 0 || p.energia > 3)
    ok(fuera.length === 0, 'y su energia esta en 0..3')
    // CADA RANGO, COMPLETO. Un rango sin `pasos` haria que el recuento de instancias mintiera
    // sin fallar: multiplicaria por 1 y esa pieza pareceria no aportar variedad.
    const rotos = []
    for (const pi of ps) for (const r of pi.rangos) {
      if (!r.id || !r.descripcion || !(r.max > r.min) || !(r.pasos >= 1)) rotos.push(pi.id + '.' + (r.id || '?'))
    }
    ok(rotos.length === 0, 'y todos sus rangos declaran id, descripcion, min<max y pasos>=1',
      rotos.length ? rotos.join(', ') : ps.reduce((n, pi) => n + pi.rangos.length, 0) + ' rangos')
  }

  // LA REGLA DE LA ENERGIA MUERDE. Sin esto, la regla podria estar escrita y no aplicarse.
  const sinRegla = Object.values(FONDOS_ESCENA).length * Object.values(CAMARAS_ESCENA).length *
    Object.values(ESTRUCTURAS_ESCENA).length * Object.values(TIPOGRAFIAS).length
  ok(PRU.identidades <= sinRegla, 'la regla de energia nunca AMPLIA el espacio',
    PRU.identidades + ' <= ' + sinRegla)

  // minConceptos RECORTA de verdad: con 1 concepto, `constelacion` (que pide 3) no cuenta.
  const conUno = combinacionesLegales({ conceptos: 1, incluirPruebas: true })
  ok(conUno.identidades < PRU.identidades, 'con 1 concepto hay MENOS identidades que con 3',
    conUno.identidades + ' < ' + PRU.identidades)

  // Y el formato tambien: casi nada esta portado a 16:9 todavia.
  const horizontal = combinacionesLegales({ formato: '16:9', incluirPruebas: true })
  ok(horizontal.identidades < PRU.identidades, 'en 16:9 hay menos identidades que en 9:16',
    horizontal.identidades + ' < ' + PRU.identidades)
}

app.whenReady().then(() => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  try {
    main(bundle); console.log('')
    semillas(bundle); console.log('')
    palabras(bundle); console.log('')
    conceptos(bundle)
  } catch (e) { fallos.push('excepcion'); console.log('EXCEPCION: ' + e.stack) }
  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — ninguna duracion puede colarse sin dividir su ciclo.')
  }
  app.exit(fallos.length ? 1 : 0)
})
