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
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { exec } = require('child_process')

const RAIZ = path.resolve(__dirname, '..')
const PROY = path.join(RAIZ, 'proyectos')
const LOG = path.join(RAIZ, 'generation-debug.log')
const MARCA = 'zz-prueba-graficos'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-graf-'))

const ANCHO = 1080, ALTO = 1920, FPS = 30, DUR = 2
const FRAMES = FPS * DUR
const TOPE_MS = 5000   // el experimento dio ~2100 ms; holgado a proposito, es un detector

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

const limpiar = () => {
  if (!fs.existsSync(PROY)) return
  for (const d of fs.readdirSync(PROY)) {
    if (d.toLowerCase().startsWith(MARCA)) {
      fs.rmSync(path.join(PROY, d), { recursive: true, force: true })
    }
  }
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
  const { renderGraphicClip, cerrarVentanaGraficos } = bundle
  console.log('RENDER DE GRAFICOS — el MOV existe, mide lo que toca, conserva el alpha')
  console.log('               y sus frames son DISTINTOS entre si')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.\n')

  limpiar()
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

    const t1 = Date.now()
    const mov2 = await renderGraphicClip(GRAFICO,
      { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    const msSegundo = Date.now() - t1
    const tras2 = offscreens()

    ok(tras2.length === 1, 'la segunda llamada NO crea otra ventana',
      'offscreen vivas: ' + tras2.length)
    ok(tras2[0] && tras2[0].id === id1, 'es LA MISMA ventana, no una nueva',
      `id ${id1} -> ${tras2[0] && tras2[0].id}`)
    ok(mov2 && mov2 !== mov, 'el segundo render da otro fichero (todavia sin cache por hash)')

    // ── F) el tiempo ───────────────────────────────────────────────────────────────
    console.log('\n=== F) TIEMPO POR GRAFICO ===')
    ok(msPrimero < TOPE_MS, `el primero tarda menos de ${TOPE_MS} ms`,
      `${msPrimero} ms (incluye crear la ventana; el experimento dio ~2100 ms)`)
    ok(msSegundo < TOPE_MS, 'el segundo tambien',
      `${msSegundo} ms (ventana ya caliente)`)

    // ── G) fallo limpio ────────────────────────────────────────────────────────────
    console.log('\n=== G) CUANDO ALGO VA MAL ===')
    // Un graphicData que el componente no conoce NO tiene por que fallar: AnimatedGraphic
    // simplemente no pinta nada. Lo que se exige es que no reviente.
    let excepcion = null, raro = null
    try {
      raro = await renderGraphicClip({ type: 'tipo_que_no_existe', value: null },
        { ancho: ANCHO, alto: ALTO, fps: FPS, duracion: 0.2, modo: 'overlay' })
    } catch (e) { excepcion = e.message }
    ok(excepcion === null, 'un graphicData desconocido no lanza excepcion',
      excepcion ? 'EXCEPCION: ' + excepcion : `devolvio ${raro ? 'una ruta' : 'null'}, sin reventar`)

    // Y un fallo forzado: ancho 0. Por donde sale el null lo dice la linea [GRAFICO] FALLO
    // del log, mas abajo — importa saber si lo caza la guarda del tamano o revienta antes.
    const dejados = movs(cacheGraficos).length
    const nulo = await renderGraphicClip(GRAFICO,
      { ancho: 0, alto: ALTO, fps: FPS, duracion: DUR, modo: 'overlay' })
    ok(nulo === null, 'un render imposible devuelve null', 'devolvio: ' + String(nulo))
    ok(movs(cacheGraficos).length === dejados,
      'y NO deja ningun .mov a medias en cache/graficos',
      `${dejados} antes, ${movs(cacheGraficos).length} despues`)

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
    limpiar()
    try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) {}
  }
}

app.whenReady().then(async () => {
  const bundle = require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(r => setTimeout(r, 1500))
  try { await main(bundle) } catch (e) { fallos.push('excepcion'); console.log('EXCEPCION: ' + e.stack) }

  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — el MOV es real: frames distintos, alpha y medidas correctas.')
  }
  app.exit(fallos.length ? 1 : 0)
})
