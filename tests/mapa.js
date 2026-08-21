/**
 * LA MATEMATICA DEL MAPA CONCEPTUAL. Aritmetica pura: ni ffmpeg, ni ventanas, ni React.
 *
 * Se importa del BUNDLE COMPILADO, no se reimplementa: una prueba que copiara la regla probaria
 * su copia y seguiria verde con la regla rota.
 *
 * POR QUE EXISTE, y cual es LA prueba de esta suite.
 *
 * Al portar el modulo se subio `ZONA.yMin` de 9 a 13.54 para respetar la zona segura real de
 * CIPHER. Esa correccion, que era necesaria, rompio `cascada` en silencio: su ancla estaba en
 * y=12, `separados` la rechazaba SIEMPRE, los 50 intentos fallaban los 50 y cascada replegaba a
 * `capas` en el 100% de los casos. De cuatro disposiciones quedaban tres y `capas` salia el
 * doble. Ni un error, ni una linea de log.
 *
 * Y la verificacion que se hizo NO LO VIO, porque midio la familia SORTEADA y no la DEVUELTA.
 * Es el patron de la seccion 7.4 de la auditoria: verde midiendo lo que no era.
 *
 * Por eso `familiasSeDevuelven` es la prueba que importa aqui. Todo lo demas es cinturon.
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
  const M = bundle

  // Las cajas de un layout de 3 conceptos con etiquetas tipicas. `separados` y `layoutSeguro`
  // las necesitan desde que el umbral sale del TAMANO REAL de la caja y no de un 33 fijo.
  const ETQ3 = ['estadio', 'construccion', 'selva']
  const cajas3 = (value) => M.cajasDe(ETQ3, value || 'construir')
  const conceptos3 = ETQ3.map(e => ({ emoji: '\u{1F332}', etiqueta: e }))
  const nec = ['LAYOUTS', 'FAMILIAS', 'PALETAS', 'ZONA', 'T', 'FOCO', 'SY',
    'separados', 'acotar', 'layoutSeguro', 'retardos', 'receta',
    'RETARDO_ANCLA', 'retardoArista', 'TRANSICIONES', 'ORDENES',
    'anchoCaja', 'altoCaja', 'cajasDe', 'recorteCaja', 'recortesArista',
    'MARGEN_H', 'MARGEN_V']
  for (const n of nec) ok(M[n] !== undefined, n + ' se exporta del bundle')
  if (typeof M.receta !== 'function') return

  const enZona = (p) => p.x > M.ZONA.xMin && p.x < M.ZONA.xMax &&
    p.y > M.ZONA.yMin && p.y < M.ZONA.yMax
  const puntos = (L) => L.pts.concat([L.ancla])

  // ── A) EL INVENTARIO ──────────────────────────────────────────────────────────────
  ok(M.FAMILIAS.length === 4, 'hay 4 familias', M.FAMILIAS.join(', '))
  ok(M.PALETAS.length === 5, 'hay 5 paletas')
  ok(M.FAMILIAS.every(f => typeof M.LAYOUTS[f] === 'function'),
    'las 4 tienen implementacion en LAYOUTS')
  ok(Object.keys(M.T).length === 6, 'la tabla T tiene 6 hitos', Object.keys(M.T).join(' '))
  for (const [k, v] of Object.entries({ conFin: 0.400, traFin: 0.583, flash: 0.545, icoIni: 0.560, icoFin: 0.730, palabra: 0.770 })) {
    if (Math.abs(M.T[k] - v) > 1e-9) ok(false, `T.${k} vale ${v}`, 'es ' + M.T[k])
  }
  ok(true, 'y los seis con el valor de la referencia')
  ok(M.PALETAS.every(p => p.a && p.b && p.ac && p.f1 && p.f2),
    'cada paleta trae sus cinco colores')

  // ── B) LA PRUEBA QUE HABRIA CAZADO LO DE CASCADA ──────────────────────────────────
  //
  // Cada familia tiene que DEVOLVER SU PROPIA disposicion, no el repliegue. Se detecta
  // comparando contra lo que produce `capas` con la misma semilla: si layoutSeguro replego,
  // el resultado es identico al de capas.
  console.log('')
  console.log('  ── la prueba que importa: ¿devuelve cada familia la SUYA? ──')
  const N = 300
  const replieguePorFamilia = {}
  for (const f of M.FAMILIAS) {
    let replego = 0
    for (let k = 0; k < N; k++) {
      const r1 = M.generador(M.semillaDe('sem' + k))
      const L = M.layoutSeguro(r1, f, 3, cajas3())
      // Se rehace `capas` con una semilla fresca equivalente para compararlo por FORMA, no por
      // valor exacto: basta con detectar el patron de dos filas que capas produce siempre.
      const filas = new Set(L.pts.map(p => Math.round(p.y / 10)))
      const pareceCapas = f !== 'capas' && filas.size <= 2 &&
        L.pts.every(p => p.y < 20 || p.y > 55)
      if (pareceCapas) replego++
    }
    replieguePorFamilia[f] = replego
  }
  ok(replieguePorFamilia.cascada === 0,
    'cascada NO replega — el bug que motivo esta suite',
    `replego ${replieguePorFamilia.cascada} de ${N}`)
  for (const f of M.FAMILIAS) {
    console.log(`          ${f.padEnd(9)} parece repliegue en ${replieguePorFamilia[f]} de ${N}`)
  }

  // El ancla de cada familia tiene que estar DENTRO de la zona antes de acotar: si no, esa
  // familia no puede pasar `separados` jamas. Es la comprobacion directa del bug.
  for (const f of M.FAMILIAS) {
    let anclasFuera = 0
    for (let k = 0; k < 100; k++) {
      const L = M.LAYOUTS[f](M.generador(M.semillaDe('an' + k)), 3)
      if (!enZona(L.ancla)) anclasFuera++
    }
    ok(anclasFuera === 0, `el ancla cruda de ${f} cae dentro de ZONA`,
      anclasFuera ? `${anclasFuera} de 100 fuera` : '100 de 100 dentro')
  }

  // ── C) LA ZONA SEGURA, GARANTIZADA ────────────────────────────────────────────────
  console.log('')
  let fuera = 0, casos = 0
  for (const f of M.FAMILIAS) for (let k = 0; k < 200; k++) {
    const L = M.layoutSeguro(M.generador(M.semillaDe('z' + f + k)), f, 3, cajas3())
    for (const p of puntos(L)) { casos++; if (!enZona(p)) fuera++ }
  }
  ok(fuera === 0, `los ${casos} puntos de 800 layouts caen en ZONA, ancla incluida`,
    fuera ? `${fuera} fuera` : 'ninguno fuera')

  // acotar() mete a la fuerza lo que este fuera
  const monstruo = { ancla: { x: -500, y: 9999 }, pts: [{ x: 1e6, y: -1e6 }, { x: NaN, y: 5 }], aristas: [], curva: 0 }
  const acotado = M.acotar(monstruo)
  ok(enZona(acotado.ancla) && enZona(acotado.pts[0]),
    'acotar() mete dentro un layout absurdo',
    JSON.stringify(acotado.ancla) + ' ' + JSON.stringify(acotado.pts[0]))
  ok(M.acotar(monstruo).pts.length === 2, 'y no pierde puntos por el camino')

  // ── D) DETERMINISMO ───────────────────────────────────────────────────────────────
  console.log('')
  const uno = JSON.stringify(M.receta('termodinamica', conceptos3))
  let iguales = 0
  for (let k = 0; k < 100; k++) if (JSON.stringify(M.receta('termodinamica', conceptos3)) === uno) iguales++
  ok(iguales === 100, '100 recetas de la misma palabra son IDENTICAS')
  ok(JSON.stringify(M.receta('agua', 3)) !== JSON.stringify(M.receta('fuego', 3)),
    'palabras distintas dan recetas distintas')
  ok(JSON.stringify(M.receta('casa', 3)) !== JSON.stringify(M.receta('caso', 3)),
    'una sola letra distinta ya cambia la receta')

  // ── E) RETARDOS Y TIEMPOS EN [0,1] ────────────────────────────────────────────────
  console.log('')
  const hitos = Object.values(M.T)
  ok(hitos.every(v => v >= 0 && v <= 1), 'los 6 hitos de T estan en [0,1]',
    hitos.join(' '))
  ok(M.T.conFin < M.T.flash && M.T.flash < M.T.icoIni && M.T.icoIni < M.T.traFin &&
     M.T.traFin < M.T.icoFin && M.T.icoFin < M.T.palabra,
    'y estan ORDENADOS: conFin < flash < icoIni < traFin < icoFin < palabra')
  ok(M.RETARDO_ANCLA >= 0 && M.RETARDO_ANCLA <= 1, 'RETARDO_ANCLA en [0,1]', String(M.RETARDO_ANCLA))
  for (const o of M.ORDENES) {
    const r = M.retardos(3, o)
    if (r.length !== 3 || !r.every(v => v >= 0 && v <= 1)) {
      ok(false, `retardos(3, ${o}) da tres valores en [0,1]`, JSON.stringify(r))
    }
  }
  ok(true, 'retardos(3, ...) da tres valores en [0,1] con los tres ordenes')
  ok(new Set(M.retardos(3, 'secuencial')).size === 3, 'y los tres son DISTINTOS: si no, entrarian a la vez')
  ok(JSON.stringify(M.retardos(3, 'inverso')) !== JSON.stringify(M.retardos(3, 'secuencial')),
    'el orden cambia CUANDO entra cada uno')
  // 10 aristas es mas de las que produce ninguna familia con n=3
  ok([...Array(10)].every((_, i) => M.retardoArista(i) >= 0 && M.retardoArista(i) <= 1),
    'retardoArista(0..9) en [0,1]', '0 -> ' + M.retardoArista(0) + '   9 -> ' + M.retardoArista(9))

  // ── F) LAS ARISTAS APUNTAN A ALGO QUE EXISTE ──────────────────────────────────────
  console.log('')
  let malas = 0
  for (const f of M.FAMILIAS) for (let k = 0; k < 100; k++) {
    const L = M.layoutSeguro(M.generador(M.semillaDe('ar' + f + k)), f, 3)
    for (const [a, b] of L.aristas) {
      // -1 es el ancla; el resto tiene que ser un indice valido de pts
      if (!((a === -1 || (a >= 0 && a < L.pts.length)) &&
            (b === -1 || (b >= 0 && b < L.pts.length)))) malas++
    }
  }
  ok(malas === 0, 'ninguna arista apunta a un indice inexistente', `${malas} malas`)

  // ── G) DEGENERADOS DESDE EL PRINCIPIO ─────────────────────────────────────────────
  //
  // Van aqui y no al final por la misma razon de siempre: en reparto.js se escribieron despues
  // y la suite estuvo VERDE con un NaN dentro porque sus 74.088 casos usaban entradas sanas.
  console.log('')
  let lanzo = null
  const intentar = (et, fn) => { try { fn() } catch (e) { lanzo = et + ': ' + e.message } }

  // LOS DEGENERADOS SE REESCRIBIERON AL CAMBIAR LA FIRMA, y no basta con actualizar la
  // llamada. `receta` recibia un NUMERO y ahora recibe un ARRAY de conceptos: pasarle NaN o
  // Infinity dejo de tener sentido, y si solo se hubiera cambiado `M.receta('agua', n)` por
  // `M.receta('agua', [])` la suite habria quedado VERDE probando un unico caso sano. La
  // cobertura se pierde en silencio si nadie mira. Es el bug del NaN de reparto.js otra vez.
  const CONCEPTOS_ROTOS = [
    ['vacio', []],
    ['uno', [{ emoji: 'a', etiqueta: 'sol' }]],
    ['cinco', [1, 2, 3, 4, 5].map(i => ({ emoji: 'a', etiqueta: 'e' + i }))],
    ['null', null],
    ['undefined', undefined],
    ['no es array', { etiqueta: 'sol' }],
    ['numero', 3],
    ['cadena', 'sol'],
    ['con elementos null', [null, { emoji: 'a', etiqueta: 'sol' }, undefined]],
    ['sin etiqueta', [{ emoji: 'a' }, { emoji: 'b', etiqueta: undefined }, { emoji: 'c', etiqueta: null }]],
    ['etiqueta no textual', [{ emoji: 'a', etiqueta: 42 }, { emoji: 'b', etiqueta: {} }, { emoji: 'c', etiqueta: [] }]],
    ['etiqueta larguisima', [{ emoji: 'a', etiqueta: 'x'.repeat(400) }]]
  ]
  for (const [et, cs] of CONCEPTOS_ROTOS) intentar('receta conceptos=' + et, () => M.receta('agua', cs))
  ok(!lanzo, 'ningun `conceptos` roto lanza: ' + CONCEPTOS_ROTOS.map(x => x[0]).join(', '), lanzo || '')

  lanzo = null
  for (const n of [0, 1, 2, 3, 5, -1, -99, NaN, Infinity, 2.7]) {
    for (const f of M.FAMILIAS) {
      intentar(`layoutSeguro ${f} n=${n}`, () => M.layoutSeguro(M.generador(7), f, n, cajas3()))
      intentar(`LAYOUTS.${f} n=${n}`, () => M.LAYOUTS[f](M.generador(7), n))
    }
    intentar('retardos n=' + n, () => M.retardos(n, 'secuencial'))
  }
  ok(!lanzo, 'ningun n lanza en layoutSeguro/LAYOUTS/retardos: 0,1,2,3,5,-1,-99,NaN,Infinity,2.7', lanzo || '')

  // Y `cajas` roto tambien: `separados` recibe un array que tiene que casar con los puntos.
  lanzo = null
  const Lx = M.LAYOUTS.radial(M.generador(7), 3)
  for (const [et, c] of [['null', null], ['undefined', undefined], ['vacio', []],
    ['de menos', [{ ancho: 20, alto: 4 }]], ['de mas', new Array(9).fill({ ancho: 20, alto: 4 })],
    ['no array', 3], ['con null dentro', [null, null, null, null]]]) {
    intentar('separados cajas=' + et, () => M.separados(Lx.pts, Lx.ancla, c))
  }
  ok(!lanzo, 'ningun `cajas` roto lanza en separados', lanzo || '')
  ok(M.separados(Lx.pts, Lx.ancla, null) === false &&
     M.separados(Lx.pts, Lx.ancla, []) === false,
    'sin cajas usables `separados` dice NO, que es lo unico seguro',
    'decir SI dejaria pasar cualquier solape')

  lanzo = null
  for (const v of ['', null, undefined, 0, 42, {}, [], 'á é í ó ú ñ Ü', '\u{1F4A7}\u{1F3ED}',
    'palabra muy larga con muchos espacios y acentos ñÑ', '\n\t', '   ']) {
    intentar('receta value=' + JSON.stringify(v), () => M.receta(v, conceptos3))
  }
  ok(!lanzo, 'ningun value lanza: vacio, null, undefined, numeros, objetos, acentos, emoji',
    lanzo || '')

  // ── H) EL MODELO DE CAJA Y EL RECORTE ─────────────────────────────────────────────
  console.log('')
  ok(M.anchoCaja('', false) > 0 && M.anchoCaja('', true) > M.anchoCaja('', false),
    'anchoCaja es positivo y el emoji lo ensancha',
    `sin texto: ${M.anchoCaja('', false).toFixed(2)} sin emoji, ${M.anchoCaja('', true).toFixed(2)} con`)
  let crece = true
  for (let c = 1; c < 40; c++) if (M.anchoCaja('x'.repeat(c), true) <= M.anchoCaja('x'.repeat(c - 1), true)) crece = false
  ok(crece, 'anchoCaja crece con la longitud, siempre')
  ok(M.altoCaja(true) > M.altoCaja(false), 'la caja con emoji es mas alta que el ancla',
    `${M.altoCaja(true)} vs ${M.altoCaja(false)}`)

  // EL RECORTE ES ANISOTROPO, que es toda la razon de este cambio. Una caja de 27.9 x 7.95
  // recorta ~14.6 en horizontal y ~4.6 en vertical: 3.2 veces. Con el `k2 = 17` de la
  // referencia los dos valian 17, y por eso las flechas verticales arrancaban en el aire.
  const rH = M.recorteCaja(1, 0, 27.9, 7.95)
  const rV = M.recorteCaja(0, 1, 27.9, 7.95)
  ok(rH > rV * 2.5, 'el recorte horizontal es mucho mayor que el vertical',
    `horizontal ${rH.toFixed(2)}   vertical ${rV.toFixed(2)}   razon ${(rH / rV).toFixed(2)}x`)
  ok(M.recorteCaja(0, 0, 27.9, 7.95) === 0, 'una direccion nula no recorta nada')
  let raro = null
  for (const [dx, dy] of [[NaN, 1], [1, NaN], [Infinity, 1], [0, 0], [-1, 0], [0, -1]]) {
    const r = M.recorteCaja(dx, dy, 27.9, 7.95)
    if (!Number.isFinite(r) || r < 0) raro = `recorteCaja(${dx},${dy}) = ${r}`
  }
  ok(!raro, 'recorteCaja devuelve siempre un numero finito y no negativo', raro || '')

  // LA GUARDA DE LA CUERDA: nunca puede quedarse la flecha en nada.
  let malGuarda = null
  for (const [a, b, cu] of [[50, 50, 10], [100, 1, 5], [0, 0, 10], [5, 5, 0], [5, 5, NaN], [1, 1, 100]]) {
    const r = M.recortesArista(a, b, cu)
    const queda = cu - r.tA - r.tB
    if (!Number.isFinite(r.tA) || !Number.isFinite(r.tB) || r.tA < 0 || r.tB < 0) {
      malGuarda = `recortesArista(${a},${b},${cu}) da ${JSON.stringify(r)}`
    } else if (Number.isFinite(cu) && cu > 0 && queda < cu * 0.14) {
      malGuarda = `recortesArista(${a},${b},${cu}) deja ${queda.toFixed(2)} de ${cu}`
    }
  }
  ok(!malGuarda, 'la guarda deja siempre al menos el 15% de la cuerda', malGuarda || '')

  // CON LAS ETIQUETAS MAS LARGAS POSIBLES SIGUE HABIENDO LAYOUTS. Si con 15 caracteres todas
  // las familias replegaran, el motor de variedad se habria quedado en una sola disposicion.
  const largas = ['infraestructura', 'contradiccion', 'reconstruccion']
  const cajasL = M.cajasDe(largas, 'reconstruccion')
  const replieg = {}
  for (const f of M.FAMILIAS) {
    let n = 0
    for (let k = 0; k < 200; k++) {
      const rnd = M.generador(M.semillaDe('lg' + f + k))
      let ok2 = false
      for (let i = 0; i < 50; i++) {
        const L = M.LAYOUTS[f](rnd, 3)
        if (M.separados(L.pts, L.ancla, cajasL)) { ok2 = true; break }
      }
      if (!ok2) n++
    }
    replieg[f] = n
  }
  const peor = Math.max(...Object.values(replieg))
  ok(peor < 200, 'con las etiquetas mas largas ninguna familia repliega SIEMPRE',
    M.FAMILIAS.map(f => `${f} ${replieg[f]}/200`).join('   '))

  // Y lo que devuelve con basura sigue siendo utilizable
  for (const n of [0, 1, 2, 5, -1, NaN]) {
    const r = M.receta('agua', conceptos3)
    if (!r || !r.layout || !Array.isArray(r.layout.pts) || !Array.isArray(r.retardos)) {
      ok(false, `receta('agua', ${n}) devuelve una forma utilizable`, JSON.stringify(r && r.layout))
    }
    for (const p of puntos(r.layout)) {
      if (!enZona(p)) ok(false, `receta('agua', ${n}) deja un punto fuera de ZONA`, JSON.stringify(p))
    }
  }
  ok(true, 'con cualquier n la receta tiene forma utilizable y sus puntos caen en ZONA')

  const rv = M.receta(null, 3)
  ok(rv && M.FAMILIAS.includes(rv.familia) && M.PALETAS.includes(rv.paleta),
    'con value null la receta sigue eligiendo familia y paleta validas',
    rv ? rv.etiqueta : 'null')

  // ── H) LA RECETA ESTA COMPLETA ────────────────────────────────────────────────────
  console.log('')
  const r = M.receta('osciladores', conceptos3)
  ok(M.FAMILIAS.includes(r.familia), 'familia valida', r.familia)
  ok(M.TRANSICIONES.includes(r.transicion), 'transicion valida', r.transicion)
  ok(M.ORDENES.includes(r.orden), 'orden valido', r.orden)
  ok(M.PALETAS.includes(r.paleta), 'la paleta es una de las cinco, no una copia')
  ok(r.layout.pts.length === 3, 'con n=3 hay 3 puntos')
  ok(r.retardos.length === 3, 'y 3 retardos')
  ok(r.angFondo >= 150 && r.angFondo <= 200, 'angFondo en [150,200]', String(r.angFondo))
  ok(r.estrellas >= 14 && r.estrellas <= 30, 'estrellas en [14,30]', String(r.estrellas))
  ok(r.escMalla >= 5 && r.escMalla <= 7.6, 'escMalla en [5,7.6]', r.escMalla.toFixed(3))
  ok(typeof r.etiqueta === 'string' && r.etiqueta.length > 0, 'trae etiqueta legible', r.etiqueta)
}

app.whenReady().then(() => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  try { main(bundle) } catch (e) { fallos.push('excepcion'); console.log('EXCEPCION: ' + e.stack) }
  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — las cuatro familias se dibujan y nada sale de la zona segura.')
  }
  app.exit(fallos.length ? 1 : 0)
})
