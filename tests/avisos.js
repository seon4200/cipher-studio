/**
 * V9 — LOS AVISOS Y EL RESUMEN. Aritmetica y texto puros: ni ffmpeg, ni ventanas, ni React.
 *
 * Se importa del BUNDLE COMPILADO, no se reimplementa: una prueba que copiara la regla probaria
 * su copia y seguiria verde con la regla rota. Ya paso en esta misma fase -- un arnes copio
 * `anchoCaja` con otra firma y valido un tope de 56 que el codigo no tenia.
 *
 * POR QUE EXISTE ESTA SUITE. El modulo entero nace para que un fallo no pase en silencio. Si la
 * agregacion se rompe -- 200 mensajes en vez de una linea con contador -- o si el resumen vuelve
 * a decir "todo cuadra" sobre una generacion fallida, el sintoma es EXACTAMENTE el que la fase
 * existe para impedir: verde por fuera y roto por dentro. Sin suite, ese fallo no da error.
 *
 * EL TEXTO DEL 25/8 ESTA CONGELADO AQUI. Es el entregable de la fase: si cambia, que alguien
 * tenga que DECIDIRLO, no descubrirlo.
 */
const { app } = require('electron')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('avisos')
process.chdir(FIXTURE_ROOT)
const fallos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}

const A = (severidad, codigo, origen, mensaje, detalle) => ({ severidad, codigo, origen, mensaje, detalle })

function main (bundle) {
  const { coleccionDeAvisos, armarResumen, textoResumen, describirMotivo, totalRespaldo, MOTIVOS } = bundle
  for (const [n, f] of Object.entries({ coleccionDeAvisos, armarResumen, textoResumen, describirMotivo, totalRespaldo }))
    ok(typeof f === 'function', n + ' se exporta del bundle')
  ok(MOTIVOS && typeof MOTIVOS === 'object', 'MOTIVOS se exporta del bundle')
  if (typeof coleccionDeAvisos !== 'function') return

  // ── A) LA AGREGACION ─────────────────────────────────────────────────────────────
  //
  // Es la razon de ser del modulo. Sin ella la fase EMPEORA la app: enterrar el 402 bajo
  // doscientas lineas es otra forma de esconderlo.
  console.log('\n=== A) AGREGACION ===')
  let c = coleccionDeAvisos()
  let nuevos = 0
  for (let i = 0; i < 200; i++) if (c.anadir(A('error', 'http-402', 'deepseek', 'saldo agotado'))) nuevos++
  ok(c.lista().length === 1, '200 avisos del MISMO codigo son UNA entrada', String(c.lista().length))
  ok(c.lista()[0].veces === 200, 'y su contador vale 200', String(c.lista()[0].veces))
  ok(nuevos === 1, 'solo el PRIMERO se anuncia como nuevo: es lo que evita 200 emisiones',
    nuevos + ' de 200')

  // EL MISMO CODIGO DESDE DOS ORIGENES SON DOS PROBLEMAS. Un 402 de DeepSeek y un 402 de Pexels
  // tienen arreglos distintos; juntarlos perderia justo lo que hace falta para actuar.
  c = coleccionDeAvisos()
  c.anadir(A('error', 'http-402', 'deepseek', 'saldo de DeepSeek'))
  c.anadir(A('error', 'http-402', 'pexels', 'saldo de Pexels'))
  ok(c.lista().length === 2, 'el mismo codigo desde DOS origenes son DOS entradas, no una',
    c.lista().map(a => a.origen + '|' + a.codigo).join('  '))

  // ── B) EL PRIMER MENSAJE GANA ────────────────────────────────────────────────────
  //
  // Sobrescribir haria que el texto cambiara bajo los pies del usuario mientras mira la pantalla.
  console.log('\n=== B) EL PRIMER MENSAJE GANA ===')
  c = coleccionDeAvisos()
  c.anadir(A('error', 'http-402', 'deepseek', 'PRIMERO', 'detalle primero'))
  c.anadir(A('error', 'http-402', 'deepseek', 'SEGUNDO', 'detalle segundo'))
  ok(c.lista()[0].mensaje === 'PRIMERO', 'el mensaje NO se reescribe', c.lista()[0].mensaje)
  ok(c.lista()[0].detalle === 'detalle primero', 'ni el detalle', String(c.lista()[0].detalle))
  ok(c.lista()[0].veces === 2, 'pero el contador SI sube', String(c.lista()[0].veces))

  // ── C) EL ORDEN ──────────────────────────────────────────────────────────────────
  //
  // Errores primero -- lo urgente arriba -- y dentro de cada grupo POR ORDEN DE APARICION: el
  // orden en que ocurrieron es informacion, y reordenar por contador la perderia.
  console.log('\n=== C) ORDEN ===')
  c = coleccionDeAvisos()
  c.anadir(A('info', 'i1', 'lote', 'info primera'))
  c.anadir(A('aviso', 'a1', 'reparto', 'aviso primero'))
  c.anadir(A('error', 'e1', 'deepseek', 'error primero'))
  c.anadir(A('error', 'e2', 'pexels', 'error segundo'))
  c.anadir(A('aviso', 'a2', 'render', 'aviso segundo'))
  const cods = c.lista().map(a => a.codigo)
  ok(JSON.stringify(cods) === JSON.stringify(['e1', 'e2', 'a1', 'a2', 'i1']),
    'errores primero, luego avisos, luego info; dentro de cada grupo por aparicion',
    cods.join(' '))

  c = coleccionDeAvisos()
  c.anadir(A('aviso', 'poco', 'x', 'uno solo'))
  c.anadir(A('error', 'mucho', 'y', 'repetido'))
  for (let i = 0; i < 50; i++) c.anadir(A('error', 'mucho', 'y', 'repetido'))
  ok(c.lista()[0].codigo === 'mucho', 'un error con contador alto NO desplaza el orden por severidad')

  // DEGENERADOS: nada de esto puede lanzar ni corromper el recuento.
  c = coleccionDeAvisos()
  let lanzo = null
  try {
    c.anadir(A('error', 'x', 'y', 'z'), 0)
    c.anadir(A('error', 'x', 'y', 'z'), -5)
    c.anadir(A('error', 'x', 'y', 'z'), NaN)
    c.anadir(A('error', 'x', 'y', 'z'), 2.7)
  } catch (e) { lanzo = e.message }
  ok(!lanzo, 'contadores degenerados no lanzan: 0, negativo, NaN, decimal', lanzo || '')
  ok(c.lista()[0].veces >= 1, 'y el contador nunca baja de 1', String(c.lista()[0].veces))
  c.limpiar()
  ok(c.lista().length === 0 && c.cuantos() === 0, 'limpiar() vacia la coleccion')

  // ── D) `completa`: EL DEFECTO QUE ENCONTRO LA PRUEBA DE ACEPTACION ───────────────
  //
  // Con el resumen en un `finally`, una generacion que aborta ANTES de decidir nada produce cero
  // en todas las filas... y "0 pedidos, 0 salidos" CUADRA en todas. El resumen decia "Todo
  // cuadra" sobre una generacion FALLIDA: la misma mentira que "exito, 78 de 78".
  console.log('\n=== D) UNA GENERACION QUE NO TERMINO NUNCA CUADRA ===')
  const CEROS = [
    { origen: 'original', objetivo: 0, real: 0 }, { origen: 'stock', objetivo: 0, real: 0 },
    { origen: 'IA', objetivo: 0, real: 0 }, { origen: 'Visual', objetivo: 0, real: 0 }
  ]
  const abortada = armarResumen(CEROS, [], 0, false)
  ok(abortada.cuadra === false, 'con TODAS las filas a cero pero incompleta, cuadra = false')
  const tAb = textoResumen(abortada)
  ok(/NO lleg./.test(tAb[0]), 'y el texto EMPIEZA diciendo que no llego a terminar', tAb[0])
  ok(!tAb.some(l => /Todo cuadra/.test(l)), 'y NUNCA dice que todo cuadra',
    tAb[tAb.length - 1])

  // ── E) CERO FALLOS: EL RESUMEN SALE IGUAL ────────────────────────────────────────
  //
  // Un resumen que solo aparece cuando hay problemas entrena al usuario a no leerlo, y el dia
  // que aparezca tampoco lo leera.
  console.log('\n=== E) CON CERO FALLOS EL RESUMEN SALE IGUAL ===')
  const bien = armarResumen([
    { origen: 'original', objetivo: 20, real: 20 }, { origen: 'stock', objetivo: 8, real: 8 },
    { origen: 'IA', objetivo: 0, real: 0 }, { origen: 'Visual', objetivo: 12, real: 12 }
  ], [], 40, true)
  const tBien = textoResumen(bien)
  ok(bien.cuadra === true, 'sin desviacion y sin respaldo, cuadra = true')
  ok(tBien.length > 0, 'el resumen SALE aunque no haya nada que avisar', tBien.length + ' lineas')
  ok(/Todo cuadra/.test(tBien[tBien.length - 1]), 'y lo dice explicitamente', tBien[tBien.length - 1])
  ok(totalRespaldo(bien) === 0, 'y el respaldo suma cero')

  // Basta UNA fila desviada para que deje de cuadrar. Tolerar "casi cuadra" seria volver al
  // "exito, 78 de 78".
  const casi = armarResumen([
    { origen: 'original', objetivo: 20, real: 21 }, { origen: 'stock', objetivo: 8, real: 7 }
  ], [], 28, true)
  ok(casi.cuadra === false, 'UNA sola fila desviada basta para que no cuadre')
  const conResp = armarResumen([{ origen: 'original', objetivo: 1, real: 1 }],
    [{ motivo: 'ia-fallida', descripcion: describirMotivo('ia-fallida'), veces: 1 }], 1, true)
  ok(conResp.cuadra === false, 'y UN solo respaldo tambien, aunque las filas empaten')

  // ── F) LOS SEIS MOTIVOS ──────────────────────────────────────────────────────────
  //
  // Seis porque son seis SITIOS distintos donde un clip cambia de origen, y cada uno tiene un
  // arreglo distinto. "10 clips cayeron" no es accionable.
  console.log('\n=== F) LOS SEIS MOTIVOS ===')
  const ESPERADOS = ['visual-sin-palabra', 'visual-sin-fichero', 'ia-fallida',
                     'stock-sin-keyword', 'stock-sin-resultados', 'stock-error']
  const claves = Object.keys(MOTIVOS)
  ok(claves.length === 6, 'hay SEIS motivos', claves.length + ': ' + claves.join(', '))
  const faltan = ESPERADOS.filter(k => !claves.includes(k))
  ok(faltan.length === 0, 'y son exactamente los seis esperados', faltan.join(', ') || 'ninguno falta')
  const descs = claves.map(k => describirMotivo(k))
  ok(new Set(descs).size === descs.length, 'cada motivo tiene una descripcion DISTINTA')
  ok(descs.every(d => d && d.length > 10), 'y ninguna esta vacia ni es un codigo crudo')
  ok(/desconocido|reemplazados/.test(describirMotivo('inventado-que-no-existe')),
    'un codigo desconocido no rompe el resumen: se describe igual',
    describirMotivo('inventado-que-no-existe'))

  // ── G) EL 25/8, CONGELADO ────────────────────────────────────────────────────────
  //
  // ESTE TEXTO ES EL ENTREGABLE DE LA FASE. Son los numeros reales del incidente: 57 clips, 11
  // slots de stock degradados porque DeepSeek devolvio 402 cinco veces y sin el no hay keyword.
  //
  // SI ESTE BLOQUE FALLA, NO LO ACTUALICES SIN LEERLO. Que cambie significa que el usuario va a
  // leer otra cosa el dia que esto vuelva a pasar, y eso es una decision, no un detalle.
  console.log('\n=== G) EL 25/8, CONGELADO ===')
  const r258 = armarResumen([
    { origen: 'original', objetivo: 28, real: 28 },
    { origen: 'stock', objetivo: 11, real: 0 },
    { origen: 'IA', objetivo: 0, real: 0 },
    { origen: 'Visual', objetivo: 18, real: 18 }
  ], [{ motivo: 'stock-sin-keyword', descripcion: describirMotivo('stock-sin-keyword'), veces: 11 }],
    57, true)
  const ESPERADO = [
    'Resumen de la generación: 57 clips.',
    '  original: se pidieron 28 y salieron 28',
    '  stock: se pidieron 11 y salieron 0  (-11)',
    '  IA: se pidieron 0 y salieron 0',
    '  Visual: se pidieron 18 y salieron 18',
    '11 clips no salieron como se pidió y se rellenaron con otra cosa:',
    '  11 — clips de stock que se quedaron sin palabra clave y se dejaron como vídeo original',
    'El vídeo NO salió como se pidió. Revisa los avisos de arriba antes de exportar.'
  ]
  const real = textoResumen(r258)
  for (const l of real) console.log('          | ' + l)
  ok(JSON.stringify(real) === JSON.stringify(ESPERADO),
    'el texto del 25/8 es EXACTAMENTE el congelado',
    real.length === ESPERADO.length ? 'mismas lineas' : real.length + ' lineas vs ' + ESPERADO.length)
  ok(totalRespaldo(r258) === 11, 'y el respaldo suma los 11 clips degradados')
}

app.whenReady().then(async () => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(r => setTimeout(r, 1200))
  console.log('LOS AVISOS Y EL RESUMEN — agregacion, orden, motivos y el texto del 25/8')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.\n')
  try { main(bundle) } catch (e) { fallos.push('excepcion'); console.log('EXCEPCION: ' + e.stack) }

  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — un fallo repetido es una linea, y el resumen no miente.')
  }
  const exitCode = fallos.length ? 1 : 0
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  app.exit(exitCode)
})
