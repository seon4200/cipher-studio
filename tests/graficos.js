/**
 * RENDER DE GRAFICOS (via G, pieza 1) — que el MOV sea de verdad
 *
 * Se ejecuta con:   npm run test:graficos
 *
 * renderGraphicClip no tiene handler IPC ni llamador: se importa del bundle compilado, que
 * la exporta. Necesita un proyecto activo, asi que se crea uno con create-project.
 *
 * Lo que se comprueba aqui NO lo cubre el build: que compile no dice nada de si el MOV tiene
 * los frames que toca, si dura lo que toca, si conserva el alpha —la unica razon de usar
 * qtrle en vez de h264— ni, sobre todo, si los frames son DISTINTOS entre si.
 *
 * Esa ultima es la que decide si esto funciona. Un MOV con 60 frames identicos, o con el
 * grafico congelado en t=0, pasaria todo lo demas: existe, dura 2s, tiene 60 frames y tiene
 * alpha. Y es justo el fallo contra el que existe el lazo cerrado — medido, sin sonda solo
 * el 68% de los frames llega correcto a la primera captura.
 */
const { app, ipcMain, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { exec } = require('child_process')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('graficos')
process.chdir(FIXTURE_ROOT)
const PROY = path.join(FIXTURE_ROOT, 'cipher-studio', 'proyectos')
const LOG = path.join(FIXTURE_ROOT, 'generation-debug.log')
const MARCA = 'zz-prueba-graficos'
const TMP = path.join(FIXTURE_ROOT, 'output')
fs.mkdirSync(TMP, { recursive: true })

const ANCHO = 1080, ALTO = 1920, FPS = 30, DUR = 2
// Alto de la franja de la sonda. Copiado de SONDA_ALTO en main/index.ts y grafico.tsx: la
// prueba lee el pixel en el mismo sitio que el lazo cerrado, asi que si alli cambiara y aqui
// no, esta comprobacion pasaria a mirar el sitio equivocado.
const SONDA_ALTO_TEST = 8
const FRAMES = FPS * DUR
// Este watchdog detecta un BLOQUEO de la suite completa. No es un liston de producto: el
// rendimiento se mide con `npm run bench:graficos`, con varias muestras y percentiles.
const WATCHDOG_MS = 90_000

const GRAFICO = { type: 'decorativo_emoji', value: '🔥', label: 'Concepto' }

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
  exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) =>
    err ? reject(new Error(String(stderr || err.message).slice(-600))) : resolve(String(stdout)))
})

let fixtureCleaned = false
const limpiarFixture = () => {
  if (fixtureCleaned) return
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  fixtureCleaned = true
}

// Solo las offscreen: el bundle abre su ventana principal al arrancar.
const offscreens = () => BrowserWindow.getAllWindows().filter(w => w.webContents.isOffscreen())
const movs = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(f => f.endsWith('.mov')) : []

// -ss DESPUES de -i: seek exacto (decodifica y descarta). Con -ss delante seria rapido pero
// aproximado, y aqui la precision del instante es justo lo que se mide.
async function huellaDelFrame (mov, t, etiqueta) {
  const salida = path.join(TMP, `f_${etiqueta}.raw`)
  await ejecutar(`ffmpeg -y -i "${mov.replace(/"/g, '\\"')}" -ss ${t} -vframes 1 ` +
    `-f rawvideo -pix_fmt rgba "${salida}"`)
  const buf = fs.readFileSync(salida)
  return { hash: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12), bytes: buf.length }
}

async function main (bundle) {
  const { renderGraphicClip, renderGraphicClipsLote, cerrarVentanaGraficos } = bundle
  console.log('RENDER DE GRAFICOS — el MOV existe, mide lo que toca, conserva el alpha')
  console.log('               y sus frames son DISTINTOS entre si')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.\n')

  // ── 0) LAS NUEVE DIMENSIONES ─────────────────────────────────────────────────────
  // Esta tabla NO es una suposicion: esta transcrita literalmente del bloque en linea que
  // vivia en index.ts:2102-2128 ANTES de extraerlo a dimensionesDeExport. El refactor no
  // puede cambiar ni un pixel, y git conserva el original por si hay que re-comprobarlo.
  // Importa mas de lo que parece: el WxH entra en el hash del MOV, asi que una discrepancia
  // entre el export y el lote seria un fallo de cache permanente y sin sintoma.
  console.log('=== 0) LAS NUEVE DIMENSIONES DE EXPORT ===')
  const NUEVE = [
    ['vertical',   '4K',    2160, 3840],
    ['vertical',   '1080p', 1080, 1920],
    ['vertical',   '720p',   720, 1280],
    ['square',     '4K',    2160, 2160],
    ['square',     '1080p', 1080, 1080],
    ['square',     '720p',   720,  720],
    ['horizontal', '4K',    3840, 2160],
    ['horizontal', '1080p', 1920, 1080],
    ['horizontal', '720p',  1280,  720]
  ]
  const malas = []
  for (const [ar, res, w, h] of NUEVE) {
    const d = bundle.dimensionesDeExport(ar, res)
    if (d.ancho !== w || d.alto !== h) malas.push(`${ar}/${res}: ${d.ancho}x${d.alto} != ${w}x${h}`)
  }
  ok(malas.length === 0, 'las 9 combinaciones dan lo mismo que el bloque en linea',
    malas.length ? malas.join('\n          ')
                 : NUEVE.map(([a, r, w, h]) => `${a}/${r}=${w}x${h}`).join('  '))

  // Los dos `else` del bloque original no comprobaban nada, asi que un valor desconocido caia
  // en horizontal / 1080p. Se conserva a proposito: cambiarlo seria cambiar el export.
  const raro = bundle.dimensionesDeExport('loquesea', 'tampoco')
  ok(raro.ancho === 1920 && raro.alto === 1080,
    'un formato o resolucion desconocidos caen en horizontal 1080p, como antes',
    `${raro.ancho}x${raro.alto}`)
  const sinNada = bundle.dimensionesDeExport(undefined, undefined)
  ok(sinNada.ancho === 1920 && sinNada.alto === 1080, 'y sin argumentos, igual')

  const p = await llamar('create-project', { name: MARCA })
  const cacheGraficos = path.join(p.projectPath, 'cache', 'graficos')
  const logAntes = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0

  try {
    // ── A) el fichero ──────────────────────────────────────────────────────────────
    console.log('=== A) EL FICHERO ===')
    const t0 = Date.now()
    const mov = await renderGraphicClip(GRAFICO,
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    const msPrimero = Date.now() - t0

    ok(typeof mov === 'string' && mov.length > 0, 'devuelve una ruta', String(mov))
    if (!mov) { console.log('\n  Sin MOV no hay nada mas que comprobar.'); return }

    ok(fs.existsSync(mov), 'el .mov existe en disco', mov)
    const bytes = fs.statSync(mov).size
    ok(bytes > 0, 'pesa mas de cero', `${(bytes / 1048576).toFixed(2)} MB`)
    ok(path.dirname(mov) === cacheGraficos,
      'vive en cache/graficos del proyecto', path.dirname(mov))

    // ── B) ffprobe: frames, duracion y dimensiones ─────────────────────────────────
    console.log('\n=== B) LO QUE DICE FFPROBE ===')
    const crudo = await ejecutar(`ffprobe -v error -select_streams v:0 -count_frames ` +
      `-show_entries stream=nb_read_frames,width,height,pix_fmt ` +
      `-show_entries format=duration -of json "${mov.replace(/"/g, '\\"')}"`)
    const info = JSON.parse(crudo)
    const s = (info.streams && info.streams[0]) || {}
    const dur = parseFloat((info.format || {}).duration)

    ok(Number(s.nb_read_frames) === FRAMES, `tiene ${FRAMES} frames contados`,
      'nb_read_frames = ' + s.nb_read_frames)
    ok(Math.abs(dur - DUR) < 0.05, `dura ${DUR}s`, dur + 's')
    ok(s.width === ANCHO && s.height === ALTO, `mide ${ANCHO}x${ALTO}`,
      `${s.width}x${s.height}  (la franja de la sonda NO viaja al MOV)`)

    // ── C) el alpha, que es la razon de usar qtrle ─────────────────────────────────
    console.log('\n=== C) EL ALPHA ===')
    ok(/a/.test(String(s.pix_fmt)), 'el pix_fmt declara alpha', 'pix_fmt = ' + s.pix_fmt)

    // Declararlo no es tenerlo: se extrae el plano alfa y se miran los valores. Tiene que
    // haber zona transparente Y zona opaca; si saliera todo opaco, el alpha se habria
    // perdido aunque el contenedor lo declare.
    const rawAlpha = path.join(TMP, 'alpha.raw')
    await ejecutar(`ffmpeg -y -i "${mov.replace(/"/g, '\\"')}" -ss 1 -vf alphaextract ` +
      `-vframes 1 -f rawvideo -pix_fmt gray "${rawAlpha}"`)
    const a = fs.readFileSync(rawAlpha)
    let transparentes = 0, opacos = 0
    for (let i = 0; i < a.length; i++) {
      if (a[i] === 0) transparentes++
      else if (a[i] === 255) opacos++
    }
    const pct = (n) => ((n / a.length) * 100).toFixed(1) + '%'
    ok(a.length === ANCHO * ALTO, 'el plano alfa tiene un byte por pixel',
      `${a.length} bytes para ${ANCHO}x${ALTO}`)
    ok(transparentes > 0 && opacos > 0,
      'hay pixeles transparentes Y opacos: el alpha es real',
      `transparentes ${pct(transparentes)} · opacos ${pct(opacos)}`)
    // Si este falla, mira el FIXTURE antes que el codec: un grafico que ocupe mas cuadro
    // hace bajar el porcentaje sin que el alpha tenga nada malo. El que decide es el de
    // arriba (transparentes>0 Y opacos>0).
    ok(transparentes > a.length * 0.5,
      'la mayor parte del cuadro es transparente, como debe ser un overlay',
      pct(transparentes) + '  (si falla: revisa el fixture, no el codec)')

    // ── D) LOS FRAMES SON DISTINTOS ────────────────────────────────────────────────
    // La comprobacion que decide si esto funciona. Todo lo anterior lo pasaria igual un MOV
    // con 60 frames identicos o congelado en t=0.
    console.log('\n=== D) LOS FRAMES SON DISTINTOS ENTRE SI ===')
    // 0.1, 0.5 y 1.0 -> fases 5%, 25% y 50% de graphic-gentle-zoom, que dura 2s y es
    // SIMETRICA respecto al 50% (globals.css:75). Con t=0.2 y t=1.8 —fases 10% y 90%— los
    // frames salen identicos POR DISENO DE LA ANIMACION, no por un fallo del render. Elegir
    // parejas simetricas como puntos de muestreo era un fallo del test, no del codigo.
    const h1 = await huellaDelFrame(mov, 0.1, 'a')
    const h2 = await huellaDelFrame(mov, 0.5, 'b')
    const h3 = await huellaDelFrame(mov, 1.0, 'c')
    const unicos = new Set([h1.hash, h2.hash, h3.hash]).size
    ok(h1.bytes === ANCHO * ALTO * 4, 'cada frame extraido es un cuadro completo',
      `${h1.bytes} bytes`)
    ok(unicos === 3, 'los frames de t=0.1, t=0.5 y t=1.0 son los TRES distintos',
      `sha1: ${h1.hash} · ${h2.hash} · ${h3.hash}` +
      (unicos < 3 ? '\n          FRAMES REPETIDOS: el lazo cerrado no esta avanzando el reloj'
                  : '\n          (no prueba que sean los correctos, pero descarta el congelado)'))

    // ── E) la ventana se REUTILIZA ─────────────────────────────────────────────────
    console.log('\n=== E) UNA SOLA VENTANA (requisito 2) ===')
    const tras1 = offscreens()
    ok(tras1.length === 1, 'tras el primer render hay UNA ventana offscreen',
      'offscreen vivas: ' + tras1.length)
    const id1 = tras1[0] && tras1[0].id

    // Con cache, repetir el MISMO grafico no tocaria la ventana: seria un acierto y no
    // probaria nada. Para que haya render de verdad hace falta otro graphicData.
    const t1 = Date.now()
    const mov2 = await renderGraphicClip({ ...GRAFICO, value: '💡' },
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    const msSegundo = Date.now() - t1
    const tras2 = offscreens()

    ok(tras2.length === 1, 'la segunda llamada NO crea otra ventana',
      'offscreen vivas: ' + tras2.length)
    ok(tras2[0] && tras2[0].id === id1, 'es LA MISMA ventana, no una nueva',
      `id ${id1} -> ${tras2[0] && tras2[0].id}`)
    ok(mov2 && mov2 !== mov, 'un graphicData distinto da otro fichero')

    // ── F) el tiempo, SOLO MEDIDA ─────────────────────────────────────────────────
    console.log('\n=== F) TIEMPO POR GRAFICO (informa; no decide el verde) ===')
    console.log(`  MEDIDA primer render: ${msPrimero} ms (incluye crear la ventana)`)
    console.log(`  MEDIDA segundo render: ${msSegundo} ms (ventana reutilizada)`)

    // ── H) LA CACHE POR HASH ───────────────────────────────────────────────────────
    console.log('\n=== H) LA CACHE POR HASH ===')
    const hashDe = (p) => path.basename(p, '.mov')

    // 1) mismo graphicData -> misma ruta, y sin renderizar
    const tCache = Date.now()
    const repetido = await renderGraphicClip(GRAFICO,
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    const msCache = Date.now() - tCache
    ok(repetido === mov, 'el mismo graphicData devuelve LA MISMA ruta', hashDe(mov))
    console.log(`  MEDIDA acierto de cache: ${msCache} ms (no decide el verde)`)
    console.log('          La prueba autoritativa de que se uso la cache esta en I: ' +
      'aciertos y renderizados son contadores del lote, no una inferencia temporal.')

    // 2) cambiar `value` cambia el hash
    const otroValor = await renderGraphicClip({ ...GRAFICO, value: '🎯' },
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    ok(hashDe(otroValor) !== hashDe(mov), 'cambiar value CAMBIA el hash',
      `${hashDe(mov)} -> ${hashDe(otroValor)}`)

    // 3) cambiar graphicStart NO lo cambia. Es la decision cerrada y este assert la fija:
    //    si alguien mete el tiempo de inicio en la clave, esto se pone rojo.
    const conOtroInicio = await renderGraphicClip(
      { ...GRAFICO, graphicStart: 7.5, graphicEnd: 9.5 },
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    ok(conOtroInicio === mov, 'cambiar graphicStart NO cambia el hash',
      'mover un clip no puede re-renderizar un fichero identico')

    // 4) las mismas seis claves en distinto orden -> mismo hash. unit y emoji van como
    //    undefined a proposito: GRAFICO no los trae, asi que solo coincide si canonizar()
    //    colapsa undefined y ausente a la misma cadena.
    const alReves = { extra: null, emoji: undefined, unit: undefined,
      label: 'Concepto', value: '🔥', type: 'decorativo_emoji' }
    const mismoDistintoOrden = await renderGraphicClip(alReves,
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    ok(mismoDistintoOrden === mov,
      'las seis claves en distinto orden dan el MISMO hash',
      'el objeto nace de tres formas distintas en el backend')

    // 5) un .mov de 0 bytes NO es un acierto. Con graphicData PROPIO: si se vaciara el
    //    fichero de los casos de arriba, esos asserts pasarian a mirar un fichero vacio.
    const GRAFICO_CERO = { ...GRAFICO, value: '🧪' }
    const paraVaciar = await renderGraphicClip(GRAFICO_CERO,
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    fs.writeFileSync(paraVaciar, '')
    ok(fs.statSync(paraVaciar).size === 0, 'se deja un .mov propio a 0 bytes a proposito',
      hashDe(paraVaciar))
    const rehecho = await renderGraphicClip(GRAFICO_CERO,
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    ok(rehecho === paraVaciar && fs.statSync(paraVaciar).size > 0,
      'un .mov de 0 bytes se re-renderiza en vez de contar como acierto',
      `${(fs.statSync(paraVaciar).size / 1048576).toFixed(2)} MB tras rehacerlo`)

    // ── G) fallo limpio ────────────────────────────────────────────────────────────
    console.log('\n=== G) CUANDO ALGO VA MAL ===')
    // Un tipo desconocido es un fallo del programa: avisa y cae a texto, nunca pinta el
    // diagnostico dentro del video. El render sigue sin lanzar al llamador.
    let excepcion = null, raro = null
    try {
      raro = await renderGraphicClip({ type: 'tipo_que_no_existe', value: null },
        { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: 0.2, modo: 'overlay' })
    } catch (e) { excepcion = e.message }
    ok(excepcion === null, 'un graphicData desconocido no lanza excepcion',
      excepcion ? 'EXCEPCION: ' + excepcion : `devolvio ${raro ? 'una ruta' : 'null'}, sin reventar`)

    // LA PUERTA TIENE QUE CAMBIAR EL TIPO EFECTIVO, no limitarse a anunciarlo. El defecto
    // previo escribia "cae a visual_texto" y despues llamaba renderContent() con visual_mapa:
    // log verde y un cartel "Tipo no soportado" dentro del video.
    const ventana = offscreens()[0]
    const estadoDesconocido = await ventana.webContents.executeJavaScript(`({
      texto: document.body.innerText,
      avisos: window.__avisosCiclo || []
    })`)
    ok(!estadoDesconocido.texto.includes('Tipo no soportado'),
      'un tipo desconocido no pinta el diagnostico dentro del video')
    ok(estadoDesconocido.avisos.some(a => a.includes('TIPO NO SOPORTADO:')),
      'un tipo desconocido deja un aviso en el canal que recoge main')
    const respaldo = {
      type: 'visual_mapa',
      value: 'memoria',
      label: '',
      unit: '',
      emoji: '',
      extra: { pos: 'test:respaldo', conceptos: [] }
    }
    await ventana.webContents.executeJavaScript(
      `window.__montar(${JSON.stringify(respaldo)}, ${JSON.stringify({
        ancho: ANCHO, alto: ALTO, modo: 'pantalla', sistema: 'voltaje', duracion: DUR
      })})`)
    const estadoRespaldo = await ventana.webContents.executeJavaScript(`({
      texto: document.body.innerText,
      tieneMapa: !!document.querySelector('[class*="cm-"]'),
      avisos: window.__avisosCiclo || []
    })`)
    ok(estadoRespaldo.texto.includes('memoria') &&
       !estadoRespaldo.texto.includes('Tipo no soportado'),
      'puedeDibujar=false pinta el Visual de texto real, no un cartel de error',
      estadoRespaldo.texto)
    ok(!estadoRespaldo.tieneMapa,
      'el respaldo no deja una composicion parcial debajo')
    ok(estadoRespaldo.avisos.some(a => a.includes('[mapa] RESPALDO:')),
      'y deposita el aviso de respaldo en el canal que recoge main')

    // Y un fallo forzado: ancho 0. Por donde sale el null lo dice la linea [GRAFICO] FALLO
    // del log, mas abajo — importa saber si lo caza la guarda del tamano o revienta antes.
    const dejados = movs(cacheGraficos).length
    const nulo = await renderGraphicClip(GRAFICO,
      { ancho: 0, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    ok(nulo === null, 'un render imposible devuelve null', 'devolvio: ' + String(nulo))
    ok(movs(cacheGraficos).length === dejados,
      'y NO deja ningun .mov a medias en cache/graficos',
      `${dejados} antes, ${movs(cacheGraficos).length} despues`)

    // ── I) EL LOTE (PIEZA 2) ───────────────────────────────────────────────────────
    // VA LA ULTIMA a proposito: su prueba de cancelacion cierra el proyecto, y cualquier
    // seccion posterior se quedaria sin activeProjectPath. renderGraphicClip devolveria null
    // de inmediato y los asserts de la seccion G pasarian por el motivo equivocado — verdes
    // sin haber probado nada.
    console.log('\n=== I) EL LOTE ===')
    const G1 = { type: 'decorativo_emoji', value: '1️⃣', label: 'Uno' }
    const G2 = { type: 'decorativo_emoji', value: '2️⃣', label: 'Dos' }
    const G3 = { type: 'decorativo_emoji', value: '3️⃣', label: 'Tres' }
    // El lote ya no recibe pixeles, recibe formato y resolucion. square/720p son 720x720 =
    // 518400 pixeles, EXACTAMENTE los mismos que los 540x960 que habia antes aqui, asi que el
    // lote sigue tardando lo mismo. El tamano real ya lo cubre la seccion A.
    const OPC_LOTE = { aspectRatio: 'square', resolution: '720p', fps: FPS, modo: 'overlay' }
    const DUR_LOTE = 0.5
    // renderGraphicClip sigue siendo la primitiva de bajo nivel y toma PIXELES; quien traduce
    // es el lote. Los renders sueltos de esta seccion tienen que usar exactamente el mismo
    // tamano que el lote o no habria aciertos de cache, asi que se derivan de la MISMA
    // funcion en vez de escribirlos a mano.
    const DIM = bundle.dimensionesDeExport(OPC_LOTE.aspectRatio, OPC_LOTE.resolution)
    const OPC_SUELTO = { ancho: DIM.ancho, alto: DIM.alto, fps: FPS, modo: 'overlay' }

    // G2 se pre-renderiza suelto para que dentro del lote sea un ACIERTO y los otros dos no.
    const previo = await renderGraphicClip(G2, { ...OPC_SUELTO, duracion: DUR_LOTE })
    ok(previo && fs.existsSync(previo), 'se pre-renderiza uno para que el lote lo acierte')

    const llamadas = []
    const lote = await renderGraphicClipsLote(
      [{ graphicData: G1, duracion: DUR_LOTE },
       { graphicData: G2, duracion: DUR_LOTE },
       { graphicData: G3, duracion: DUR_LOTE }],
      OPC_LOTE,
      (p) => llamadas.push(p))

    ok(lote.total === 3 && lote.aciertos === 1 && lote.renderizados === 2 && lote.fallos === 0,
      'lote de 3 con uno cacheado: 2 renderizados, 1 de cache',
      JSON.stringify({ t: lote.total, r: lote.renderizados, a: lote.aciertos, f: lote.fallos }))

    // Los sumandos SIEMPRE cuadran con el total. Si alguien añade un estado nuevo y se olvida
    // de contarlo, esto se pone rojo.
    ok(lote.renderizados + lote.aciertos + lote.fallos + lote.sinIntentar === lote.total,
      'renderizados + aciertos + fallos + sinIntentar === total',
      `${lote.renderizados}+${lote.aciertos}+${lote.fallos}+${lote.sinIntentar} = ${lote.total}`)

    // Correspondencia posicional: pedir cada uno suelto da un ACIERTO con la misma ruta, asi
    // que si el array estuviera cruzado se veria aqui.
    const sueltas = []
    for (const g of [G1, G2, G3]) {
      sueltas.push(await renderGraphicClip(g, { ...OPC_SUELTO, duracion: DUR_LOTE }))
    }
    ok(lote.rutas.length === 3 && lote.rutas.every((r, i) => r === sueltas[i]),
      'rutas[i] es el grafico de peticiones[i], en su sitio')

    // El progreso manda index en BASE 0. Es el candado del off-by-one: el frontend hace
    // data.index + 1, asi que mandar base 1 pintaria "4 de 3" al final.
    ok(llamadas.length === 3 && llamadas[0].index === 0 && llamadas[2].index === 2,
      'el progreso emite index en BASE 0',
      'indices: ' + llamadas.map(l => l.index).join(', '))
    ok(llamadas.every(l => l.total === 3 && l.type === 'Gráficos'),
      'y total y type son consistentes en las tres')

    // EL QUE MAS IMPORTA. Si alguien simplifica el mensaje a "Renderizando i de n", la barra
    // sigue avanzando y el lote sigue funcionando: no lo detectaria NADA salvo esto.
    ok(/cach/i.test(llamadas[1].paragraph),
      'el texto del progreso DICE que fue acierto de cache', `"${llamadas[1].paragraph}"`)
    ok(!/cach/i.test(llamadas[0].paragraph),
      'y el del que si se renderiza NO lo dice', `"${llamadas[0].paragraph}"`)

    // La punta suelta de la PIEZA 1: el lote cierra la ventana en su finally.
    ok(offscreens().length === 0, 'el lote deja la ventana offscreen CERRADA')

    // ── Dos lotes solapados ────────────────────────────────────────────────────────
    // NO hay carrera y no hacen falta temporizadores: renderGraphicClipsLote pone la bandera
    // de forma SINCRONA —todo lo que hay antes es aritmetica— asi que llamar al segundo en el
    // mismo tick garantiza que la ve. JS es de un solo hilo: el orden esta determinado.
    const G4 = { type: 'decorativo_emoji', value: '4️⃣', label: 'Cuatro' }
    const G5 = { type: 'decorativo_emoji', value: '5️⃣', label: 'Cinco' }

    // Se calienta la ventana antes: asi el "no toca la ventana del primero" mira algo que ya
    // existe. Sin esto la ventana aun no estaria creada cuando el segundo es rechazado —el
    // primero no ha llegado todavia a renderGraphicClip— y el assert no probaria nada.
    // OPC_SUELTO sale de dimensionesDeExport(OPC_LOTE...), asi que el tamano coincide por
    // construccion y obtenerVentanaGraficos no redimensiona nada.
    await renderGraphicClip(G4, { ...OPC_SUELTO, duracion: DUR_LOTE })
    ok(offscreens().length === 1, 'la ventana esta viva antes de solapar')

    const loteA = renderGraphicClipsLote(          // SIN await: se queda en vuelo
      [{ graphicData: G5, duracion: DUR_LOTE }], OPC_LOTE)
    const loteB = await renderGraphicClipsLote(    // mismo tick: ve la bandera
      [{ graphicData: G4, duracion: DUR_LOTE }], OPC_LOTE)

    ok(loteB.cancelado === true && /en curso/.test(loteB.motivo),
      'el segundo lote se RECHAZA mientras el primero corre', loteB.motivo)
    ok(loteB.sinIntentar === 1 && loteB.rutas.length === 1 && loteB.rutas[0] === null,
      'el rechazado no intenta nada y devuelve el array completo a null')
    ok(offscreens().length === 1,
      'el rechazo NO toca la ventana del primero: sigue viva',
      'si el rechazado hubiera entrado en el try, su finally la habria destruido')

    const resA = await loteA
    // ESTE es el que prueba el punto: si el rechazado hubiera ejecutado su finally, habria
    // destruido la ventana, los capturePage del primero habrian fallado y este terminaria con
    // rutas [null] y fallos 1. Que termine limpio es la prueba de que el rechazo no toco nada.
    ok(resA.cancelado === false && resA.fallos === 0 && resA.rutas[0] !== null,
      'el primero termina con normalidad, sin nulls',
      JSON.stringify({ cancelado: resA.cancelado, r: resA.renderizados,
                       a: resA.aciertos, f: resA.fallos }))
    ok(offscreens().length === 0, 'y al terminar el primero, la ventana queda cerrada')

    // ── J) LA CLAVE DISTINGUE EL MODO Y EL CODEC (V0) ──────────────────────────────
    // Se prueba la funcion DIRECTAMENTE y no a traves del nombre del fichero: lo que importa
    // de un hash es que entradas distintas den claves distintas, y eso se afirma mejor sobre
    // la funcion. Ademas 'pantalla' todavia no renderiza, asi que por fichero no habria forma.
    console.log('\n=== J) LA CLAVE DISTINGUE EL MODO Y EL CODEC ===')
    const { hashGrafico } = bundle
    ok(typeof hashGrafico === 'function', 'hashGrafico se exporta del bundle')

    const gClave = { type: 'decorativo_emoji', value: '🔥', label: 'Concepto', emoji: '🔥' }
    const hOverlay  = hashGrafico(gClave, 1080, 1920, 2, 30, 'overlay')
    const hPantalla = hashGrafico(gClave, 1080, 1920, 2, 30, 'pantalla')

    ok(hOverlay !== hPantalla,
      'el MISMO grafico da claves distintas en overlay y en pantalla',
      `${hOverlay} != ${hPantalla}`)
    ok(hashGrafico(gClave, 1080, 1920, 2, 30, 'overlay') === hOverlay,
      'la clave es estable entre llamadas', hOverlay)

    // La clave VIEJA se reconstruye aqui para demostrar que la forma cambio DE VERDAD. Sin
    // esto, "las dos nuevas son distintas entre si" no dice nada sobre si los MOV anteriores
    // quedan invalidados, que es la consecuencia que importa.
    const canon = (v) => v === null || v === undefined ? 'null'
      : Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
      : typeof v === 'object'
        ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
        : JSON.stringify(v)
    const claveVieja = crypto.createHash('sha1').update([
      canon(gClave.type), canon(gClave.value), canon(gClave.label),
      canon(gClave.unit), canon(gClave.emoji), canon(gClave.extra),
      '1080', '1920', '2', '30', 'plantillas=1'
    ].join('|')).digest('hex').slice(0, 12)
    ok(hOverlay !== claveVieja,
      'la clave cambio de FORMA: los MOV anteriores quedan invalidados',
      `vieja ${claveVieja} -> nueva ${hOverlay}`)

    // ── K) EL VISUAL A PANTALLA COMPLETA (V2) ──────────────────────────────────────
    // VA AQUI, ANTES del close-project de abajo, a proposito: sin proyecto activo
    // renderGraphicClip devuelve null por OTRA razon y el test pasaria por el motivo
    // equivocado, que es peor que fallar.
    console.log('\n=== K) EL VISUAL A PANTALLA COMPLETA ===')
    const G_VIS = { type: 'donut', value: 87, label: 'Cuota', unit: '%' }
    const DUR_VIS = 3
    const FRAMES_VIS = DUR_VIS * FPS

    const mp4 = await renderGraphicClip(G_VIS,
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR_VIS, modo: 'pantalla', sistema: 'voltaje' })
    ok(mp4 !== null, 'modo=pantalla YA renderiza', String(mp4))
    ok(!!mp4 && mp4.endsWith('.mp4'), 'el fichero es .mp4, no .mov',
      mp4 ? path.basename(mp4) : '(null)')

    // Donde vive, y la asimetria importa: un Visual que falta rompe la aritmetica del export
    // y el -shortest se come el audio; una tarjeta que falta no rompe nada.
    const dirVisual = path.join(p.projectPath, 'materiales', 'visual')
    ok(!!mp4 && path.dirname(mp4) === dirVisual,
      'cae en materiales/visual, NO en cache', mp4 ? path.dirname(mp4) : '(null)')

    const crudoVis = await ejecutar(`ffprobe -v error -select_streams v:0 -count_frames ` +
      `-show_entries stream=nb_read_frames,width,height,pix_fmt,codec_name ` +
      `-show_entries format=duration -of json "${String(mp4).replace(/"/g, '\\"')}"`)
    const iv = JSON.parse(crudoVis)
    const sv = (iv.streams && iv.streams[0]) || {}
    ok(sv.codec_name === 'h264', 'el codec es h264', String(sv.codec_name))
    ok(sv.pix_fmt === 'yuv420p', 'el pix_fmt es yuv420p', String(sv.pix_fmt))
    ok(Number(sv.nb_read_frames) === FRAMES_VIS, `tiene ${FRAMES_VIS} frames exactos`,
      'nb_read_frames = ' + sv.nb_read_frames)
    ok(sv.width === ANCHO && sv.height === ALTO, `mide ${ANCHO}x${ALTO}`,
      `${sv.width}x${sv.height}  (la franja de la sonda NO viaja al MP4)`)

    // Los tres frames distintos: el reloj sigue vivo. Si el Visual se congelara, los tres
    // saldrian identicos y el video mostraria una imagen fija durante 3 segundos.
    // Se reutiliza huellaDelFrame, que ya existe y se usa en la seccion D).
    const v1 = await huellaDelFrame(mp4, 0.1, 'vis1')
    const v2 = await huellaDelFrame(mp4, 0.5, 'vis2')
    const v3 = await huellaDelFrame(mp4, 1.0, 'vis3')
    ok(new Set([v1.hash, v2.hash, v3.hash]).size === 3,
      'los frames de t=0.1, 0.5 y 1.0 son los TRES distintos',
      `${v1.hash} · ${v2.hash} · ${v3.hash}`)

    // 0 frames completamente negros. Es el sintoma del fallo del alpha AL REVES: si el
    // componente no pintara su fondo, yuv420p descartaria el alfa y saldria todo negro.
    // blackdetect con pix_th=0.10 marca los tramos cuyos frames son casi todos oscuros; se
    // cuenta cuanta DURACION cae ahi, que es mas robusto que mirar un frame suelto.
    const bd = await ejecutar(`ffmpeg -hide_banner -nostats -i "${String(mp4).replace(/"/g, '\\"')}" ` +
      `-vf blackdetect=d=0.05:pix_th=0.10 -an -f null - 2>&1 || true`)
    const tramosNegros = (String(bd).match(/black_duration:(\d+(\.\d+)?)/g) || [])
      .map(m => parseFloat(m.split(':')[1]))
    const segNegros = tramosNegros.reduce((a, b) => a + b, 0)
    ok(segNegros === 0, 'ningun tramo completamente negro',
      tramosNegros.length ? `${segNegros.toFixed(2)}s en ${tramosNegros.length} tramo(s)` : '0.00s')

    // ── L) LA SONDA SIGUE LEGIBLE BAJO EL FONDO OPACO ──────────────────────────────
    // Si el fondo del Visual cubriera los 1928 en vez de los 1920 del lienzo, el lazo cerrado
    // no podria leer la franja y TODOS los frames agotarian los 5 intentos.
    // Se comprueba el PIXEL y no la media de intentos: con voltaje el fondo es #0A0A0A, casi
    // negro, asi que un fallo podria colarse por parecido; con clinico —fondo #F7F6F3— seria
    // imposible confundirlos. Por eso van los dos.
    console.log('\n=== L) LA SONDA SIGUE LEGIBLE BAJO EL FONDO ===')
    const leerPixelSonda = async (sistema, tSonda) => {
      const v = offscreens()[0]
      if (!v) return null
      await v.webContents.executeJavaScript(
        `window.__montar(${JSON.stringify(G_VIS)}, ${JSON.stringify(
          { ancho: ANCHO, alto: ALTO, modo: 'pantalla', sistema })})`)
      await v.webContents.executeJavaScript(`window.__setT(${tSonda})`)
      // Mismo offset que usa renderGraphicClip: centro horizontal, mitad de la franja.
      const off = (Math.floor(SONDA_ALTO_TEST / 2) * ANCHO + Math.floor(ANCHO / 2)) * 4
      for (let k = 0; k < 20; k++) {
        const raw = (await v.webContents.capturePage()).getBitmap()
        if (raw[off] === Math.round((tSonda * 30) % 255)) {
          // El pixel de DEBAJO de la franja: tiene que ser el fondo del sistema, no la sonda.
          const offFondo = ((SONDA_ALTO_TEST + 4) * ANCHO + 4) * 4
          return { intentos: k + 1, sonda: raw[off],
                   fondo: [raw[offFondo + 2], raw[offFondo + 1], raw[offFondo]] }
        }
      }
      return { intentos: 21, sonda: -1, fondo: null }
    }

    // La ventana sigue viva del render anterior; si no, se abre montando.
    await renderGraphicClip({ ...G_VIS, value: 1 },
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: 1, modo: 'pantalla', sistema: 'voltaje' })

    for (const [sis, fondoEsperado] of [['voltaje', [10, 10, 10]], ['clinico', [247, 246, 243]]]) {
      const t = sis === 'voltaje' ? 1.0 : 1.1
      const r = await leerPixelSonda(sis, t)
      const esperado = Math.round((t * 30) % 255)
      ok(!!r && r.sonda === esperado,
        `sistema ${sis}: el pixel de la sonda vale lo que se fijo`,
        r ? `esperado ${esperado}, leido ${r.sonda}` : '(sin ventana)')
      ok(!!r && !!r.fondo && r.fondo.every((c, i) => Math.abs(c - fondoEsperado[i]) <= 6),
        `sistema ${sis}: y justo debajo esta el fondo del sistema, no la sonda`,
        r && r.fondo ? `rgb(${r.fondo.join(',')}) contra rgb(${fondoEsperado.join(',')})` : '(sin dato)')
      console.log(`  MEDIDA sistema ${sis}: ${r ? r.intentos : '-'} intento(s) para leer la sonda`)
    }

    // Cancelacion: sin proyecto activo. Recorre la MISMA rama que un cambio de proyecto a
    // mitad, entrando por la puerta de arriba en vez de por la de en medio. La comparacion
    // dentro del bucle no tiene test: no hay forma determinista de mover activeProjectPath a
    // mitad, y un test con carrera envenena la suite. Anotado en docs/deuda-graficos.md.
    await llamar('close-project', {})
    const cancelado = await renderGraphicClipsLote(
      [{ graphicData: G1 }, { graphicData: G2 }, { graphicData: G3 }], OPC_LOTE)
    ok(cancelado.cancelado === true && /proyecto activo/.test(cancelado.motivo),
      'sin proyecto activo el lote se cancela y dice por que', cancelado.motivo)
    ok(cancelado.sinIntentar === 3 && cancelado.rutas.length === 3 &&
       cancelado.rutas.every(r => r === null),
      'un lote cancelado devuelve el array COMPLETO a null, no uno vacio',
      'con push seria length 0; posicional conserva los huecos')
    ok(cancelado.renderizados + cancelado.aciertos + cancelado.fallos +
       cancelado.sinIntentar === cancelado.total, 'y los sumandos siguen cuadrando')

    // ── El log, para MIRAR, no para asertar ────────────────────────────────────────
    console.log('\n=== LO QUE DICE EL LOG (no se aserta, se mira) ===')
    // Por BYTES y no por caracteres: statSync da bytes y el log tiene acentos y emoji, asi
    // que un slice() sobre la cadena se pasa de largo y devuelve vacio. Paso de verdad.
    const nuevo = fs.existsSync(LOG)
      ? fs.readFileSync(LOG).subarray(logAntes).toString('utf8') : ''
    const lineas = nuevo.split('\n').filter(l => l.includes('[GRAFICO]'))
    if (!lineas.length) console.log('          (ninguna linea [GRAFICO] en el log)')
    for (const l of lineas) console.log('          ' + l.trim())
    console.log('          El experimento dio 1.30 intentos/frame. Si esto se aleja mucho,')
    console.log('          este codigo no es equivalente al que se midio.')

    cerrarVentanaGraficos()
    ok(offscreens().length === 0, 'cerrarVentanaGraficos deja cero ventanas offscreen')

  } finally {
    // En un finally a proposito: si el test muere a mitad, los MOV de 8 MB se quedarian en
    // cache/graficos, que desde 7dd9b64 ya no la borra nadie. Y sin cerrar la ventana el
    // proceso de test se queda colgado.
    try { bundle.cerrarVentanaGraficos() } catch (e) {}
    try { await llamar('close-project', {}) } catch (e) {}
    limpiarFixture()
  }
}

app.whenReady().then(async () => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(r => setTimeout(r, 1500))
  let watchdog
  try {
    await Promise.race([
      main(bundle),
      new Promise((_, reject) => {
        watchdog = setTimeout(() => reject(new Error(
          `WATCHDOG: test:graficos no termino en ${WATCHDOG_MS / 1000}s; probable bloqueo`)),
        WATCHDOG_MS)
      })
    ])
  } catch (e) {
    fallos.push('excepcion')
    console.log('EXCEPCION: ' + e.stack)
  } finally {
    clearTimeout(watchdog)
    // Respaldo del finally interno: si el watchdog gana, main sigue pendiente y no puede
    // dejar una ventana Electron viva esperando para siempre.
    try { bundle.cerrarVentanaGraficos() } catch (e) {}
    try { await llamar('close-project', {}) } catch (e) {}
    limpiarFixture()
  }

  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — el MOV es real: frames distintos, alpha y medidas correctas.')
  }
  app.exit(fallos.length ? 1 : 0)
})
