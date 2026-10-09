/**
 * AUDITORIA DE MATERIALES (PIEZA A, piezas 1 y 3)
 *
 * Se ejecuta con:   npm run test:materiales
 *
 * Cubre los cuatro modos de fallo, que NO son el mismo y no pueden dar el mismo mensaje:
 *
 *   FALTA         el fichero no esta. Roto AHORA.
 *   FUERA         existe pero vive fuera del proyecto. Funciona hoy, se rompe el dia que el
 *                 usuario lo mueva. El v1Clip del video importado esta aqui A PROPOSITO.
 *   SIN RUTA      el clip no tiene path. El export lo descarta sin decir nada.
 *   CATEGORIA     una categoria que el codigo no conoce. Es el mas silencioso de los cuatro:
 *                 no falla nada, el clip simplemente deja de aparecer donde deberia.
 *
 * Y la guarda del export: los medios pendientes o ausentes bloquean ANTES de abrir dialogos.
 *
 * La parte C mide el coste con un fixture sintetico de 623 clips y 28 minutos porque la
 * auditoria hace un exists() por clip en CADA carga y CADA export.
 */
const { app, ipcMain, dialog } = require('electron')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('materiales')
process.chdir(FIXTURE_ROOT)
const PROY = path.join(FIXTURE_ROOT, 'cipher-studio', 'proyectos')
const MARCA = 'zz-prueba-materiales'
const TMP = path.join(FIXTURE_ROOT, 'external')
fs.mkdirSync(TMP, { recursive: true })

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

let fixtureCleaned = false
const limpiarFixture = () => {
  if (fixtureCleaned) return
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  fixtureCleaned = true
}

const tocar = (p) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, 'x')
  return p
}

async function partesAyB () {
  const p = await llamar('create-project', { name: MARCA })
  const proyecto = p.projectPath

  // Un clip de cada estado. Los que existen se crean de verdad.
  const dentro = tocar(path.join(proyecto, 'materiales', 'stock', 'bueno.mp4'))
  const externo = tocar(path.join(TMP, 'video-del-usuario.mp4'))
  const ausenteIa = path.join(proyecto, 'materiales', 'ia', 'costo-dinero.mp4')
  const ausenteOrig = path.join(proyecto, 'materiales', 'originales', 'no-vuelve.mp4')

  const clips = [
    { id: 'c1', name: 'bueno', type: 'video', category: 'stock', path: dentro },
    { id: 'c2', name: 'el video del usuario', type: 'video', category: 'original', path: externo },
    { id: 'c3', name: 'la ia que pague', type: 'video', category: 'ia', path: ausenteIa },
    { id: 'c4', name: 'mi grabacion', type: 'video', category: 'original', path: ausenteOrig },
    { id: 'c5', name: 'sin ruta ninguna', type: 'video', category: 'stock' },
    { id: 'c6', name: 'categoria inventada', type: 'video', category: 'brollicious', path: dentro },
    // Construidos como en produccion (main.tsx:2642): sin path y sin category.
    { id: 'g1', name: 'Gráfico: Concepto', type: 'graphic', startSeconds: 1,
      durationSeconds: 2, graphicData: { type: 'decorativo_emoji', emoji: '🔥' } },
    { id: 'g2', name: 'Gráfico: 87%', type: 'graphic', startSeconds: 5,
      durationSeconds: 2, graphicData: { type: 'dato_grande', value: 87 } }
  ]

  // ── A) la auditoria clasifica bien ────────────────────────────────────────────────
  console.log('\n=== A) LOS CUATRO ESTADOS ===')
  await llamar('save-project-state', {
    id: p.data.id, name: p.data.name, clips: [], timelineVideoClips: clips
  })
  const re = await llamar('load-project', { projectPath: proyecto })
  ok(re && re.success, 'el proyecto abre', re && re.error ? re.error : '')

  const a = (re && re.auditoria) || {}
  const ids = (lista) => (lista || []).map(x => x.id).sort().join(',')

  ok(ids(a.faltan) === 'c3,c4', 'FALTA: los dos que no estan en disco',
    'faltan: ' + ids(a.faltan))
  ok(ids(a.fuera) === 'c2', 'FUERA: el que existe pero vive fuera',
    'fuera: ' + ids(a.fuera))
  ok(ids(a.sinRuta) === 'c5', 'SIN RUTA: el que el export descartaria en silencio',
    'sinRuta: ' + ids(a.sinRuta))
  ok(ids(a.categorias) === 'c6' && a.categorias[0].category === 'brollicious',
    'CATEGORIA INVENTADA: se caza aunque el fichero exista',
    'el clip c6 apunta a un fichero que SI esta; el unico sintoma es la categoria')
  ok(a.hayProblema === true, 'hayProblema = true')

  // El origen es lo que decide que puede hacer el usuario.
  ok(a.porOrigen && a.porOrigen.ia && a.porOrigen.ia.faltan === 1 &&
     a.porOrigen.originales && a.porOrigen.originales.faltan === 1,
    'el desglose por origen distingue ia de originales',
    JSON.stringify(a.porOrigen))
  ok(a.fuera[0] && a.fuera[0].origen === 'externo',
    'lo de fuera se marca como externo, no como una subcarpeta')

  // ── A bis) los clips graphic no son material ausente (G0) ─────────────────────────
  console.log('\n=== A bis) LOS CLIPS GRAPHIC NO SON MATERIAL AUSENTE ===')
  ok(ids(a.graficos) === 'g1,g2', 'los graficos van a su propio bucket',
    'graficos: ' + ids(a.graficos))
  ok(!ids(a.sinRuta).includes('g1') && !ids(a.sinRuta).includes('g2'),
    'NO entran en sinRuta aunque no tengan path',
    'sinRuta sigue siendo solo: ' + ids(a.sinRuta))
  ok(!ids(a.faltan).includes('g1') && !ids(a.faltan).includes('g2'),
    'NO entran en faltan')
  ok(ids(a.categorias) === 'c6',
    'no se cuentan como categoria desconocida por no traer category')
  ok(a.total === 6 && a.totalGraficos === 2,
    'total cuenta el material; los graficos van aparte',
    `total=${a.total} totalGraficos=${a.totalGraficos} (8 clips en el timeline)`)

  // Un proyecto sano no debe dar falsos positivos.
  await llamar('save-project-state', {
    id: p.data.id, name: p.data.name, clips: [], timelineVideoClips: [clips[0]]
  })
  const sano = await llamar('load-project', { projectPath: proyecto })
  ok(sano.auditoria && sano.auditoria.hayProblema === false &&
     sano.auditoria.faltan.length === 0 && sano.auditoria.categorias.length === 0,
    'un proyecto sano no da ningun aviso')

  // Y sano CON graficos tampoco: es lo que G0 tiene que garantizar. Se comprueba sobre un
  // conjunto sano a proposito — con el fixture roto, hayProblema seria true por c3/c4/c5
  // pasara lo que pasara con los graficos, y la asercion no probaria nada.
  await llamar('save-project-state', {
    id: p.data.id, name: p.data.name, clips: [],
    timelineVideoClips: [clips[0], clips[6], clips[7]]
  })
  const sanoG = await llamar('load-project', { projectPath: proyecto })
  ok(sanoG.auditoria && sanoG.auditoria.hayProblema === false,
    'un proyecto sano CON graficos tampoco da aviso',
    'hayProblema=' + (sanoG.auditoria && sanoG.auditoria.hayProblema) +
    ' con 2 graficos sin path en el timeline')
  ok(sanoG.auditoria && sanoG.auditoria.sinRuta.length === 0 &&
     sanoG.auditoria.totalGraficos === 2 && sanoG.auditoria.total === 1,
    'los 2 graficos se contabilizan sin ensuciar sinRuta',
    `sinRuta=${sanoG.auditoria.sinRuta.length} total=${sanoG.auditoria.total} ` +
    `totalGraficos=${sanoG.auditoria.totalGraficos}`)

  // ── B) la guarda del export ───────────────────────────────────────────────────────
  console.log('\n=== B) LA GUARDA DEL EXPORT ===')
  const originalMsg = dialog.showMessageBox
  const originalSave = dialog.showSaveDialog
  let ordenLlamadas = []

  dialog.showSaveDialog = async () => {
    ordenLlamadas.push('guardar')
    return { canceled: true, filePath: undefined }
  }

  try {
    // B1 — un clip sin ruta sigue pendiente y bloquea antes de cualquier dialogo.
    ordenLlamadas = []
    dialog.showMessageBox = async () => { ordenLlamadas.push('aviso'); return { response: 0 } }
    const rPendiente = await llamar('export-video', { clips, aspectRatio: '16:9', resolution: '1080p',
      format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })

    ok(rPendiente && rPendiente.success === false && /medios pendientes/i.test(rPendiente.error || ''),
      'un clip sin ruta bloquea la exportacion como medio pendiente', 'error: ' + (rPendiente && rPendiente.error))
    ok(ordenLlamadas.length === 0,
      'un medio pendiente se bloquea antes de abrir dialogos',
      'orden: ' + (ordenLlamadas.join(' -> ') || '(ninguna)'))

    // B2 — con ruta pero fichero ausente, el IPC también bloquea antes de los diálogos.
    ordenLlamadas = []
    const clipsConRuta = clips.filter(c => c.id !== 'c5')
    const rAusente = await llamar('export-video', { clips: clipsConRuta, aspectRatio: '16:9', resolution: '1080p',
      format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
    ok(rAusente && rAusente.success === false && /BUILD_MEDIA_MISSING:c3/.test(rAusente.error || ''),
      'un fichero ausente bloquea la exportacion con su ID', 'error: ' + (rAusente && rAusente.error))
    ok(ordenLlamadas.length === 0,
      'un fichero ausente se bloquea antes de abrir dialogos',
      'orden: ' + (ordenLlamadas.join(' -> ') || '(ninguna)'))

    // B3 — un proyecto sano no molesta
    ordenLlamadas = []
    dialog.showMessageBox = async () => { ordenLlamadas.push('aviso'); return { response: 0 } }
    await llamar('export-video', { clips: [clips[0]], aspectRatio: '16:9', resolution: '1080p',
      format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
    ok(ordenLlamadas.join(' -> ') === 'guardar',
      'sin material ausente NO se muestra ningun aviso',
      'orden: ' + ordenLlamadas.join(' -> '))

    // B4 — "fuera pero existe" no bloquea: es el estado del v1Clip por diseno
    ordenLlamadas = []
    await llamar('export-video', { clips: [clips[0], clips[1]], aspectRatio: '16:9',
      resolution: '1080p', format: 'mp4', quality: 'alta', assignedTransitions: {},
      transitionDuration: 0.5 })
    ok(ordenLlamadas.join(' -> ') === 'guardar',
      'un clip FUERA pero presente no bloquea el export',
      'es el estado del v1Clip del video importado, y exporta bien')

    // B5 — el caso que motiva G0. Sin el bucket, la guarda bloquearia TODO export con
    // graficos: son clips sin path y caerian en sinRuta.
    ordenLlamadas = []
    const rG = await llamar('export-video', { clips: [clips[0], clips[6], clips[7]],
      aspectRatio: '16:9', resolution: '1080p', format: 'mp4', quality: 'alta',
      assignedTransitions: {}, transitionDuration: 0.5 })
    ok(ordenLlamadas.join(' -> ') === 'guardar',
      'un proyecto sano CON graficos NO dispara la guarda',
      'orden: ' + ordenLlamadas.join(' -> ') +
      '   (antes de G0 esto decia "faltan 2 de 3 clips")')
    ok(rG && /cancelada por el usuario/i.test(rG.error || ''),
      'llega al dialogo de guardar con normalidad')

    // B6 — export real de un MP4 sintético con video y audio; salida dentro del fixture.
    const entradaExport = tocar(path.join(proyecto, 'materiales', 'stock', 'export-smoke.mp4'))
    const salidaExport = path.join(FIXTURE_ROOT, 'export-smoke-final.mp4')
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=30:d=3',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=3',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', entradaExport,
    ], { stdio: 'ignore' })
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: salidaExport })
    const rExport = await llamar('export-video', { clips: [{ id: 'export-smoke',
      name: 'Video sintetico', type: 'video', category: 'stock', path: entradaExport,
      startSeconds: 0, durationSeconds: 3 }], aspectRatio: '16:9', resolution: '720p',
      format: 'mp4', quality: 'high', assignedTransitions: {}, transitionDuration: 0.5 })
    ok(rExport && rExport.success === true, 'export real del fixture termina',
      rExport && rExport.error ? rExport.error : '')
    ok(fs.existsSync(salidaExport) && fs.statSync(salidaExport).size > 0,
      'export escribe un MP4 no vacio')
    const exportProbe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,duration',
      '-of', 'json', salidaExport,
    ], { encoding: 'utf8' }))
    const videoExportado = exportProbe.streams.find(s => s.codec_type === 'video')
    const audioExportado = exportProbe.streams.find(s => s.codec_type === 'audio')
    const duracionExportada = Number(videoExportado && videoExportado.duration || exportProbe.format.duration)
    ok(!!videoExportado && !!audioExportado,
      'el MP4 final conserva video y audio', JSON.stringify(exportProbe.streams.map(s => s.codec_type)))
    ok(duracionExportada >= 2.9 && duracionExportada <= 3.1,
      'la duracion exportada coincide con el clip sintetico', `${duracionExportada}s`)
  } finally {
    dialog.showMessageBox = originalMsg
    dialog.showSaveDialog = originalSave
  }

  return proyecto
}

// ── C) el coste con el proyecto real de 623 clips ───────────────────────────────────
async function parteC (proyecto) {
  console.log('\n=== C) COSTE CON 623 CLIPS (fixture sintetico de 28 minutos) ===')
  const N = 623
  const dir = path.join(proyecto, 'materiales', 'stock')
  fs.mkdirSync(dir, { recursive: true })

  const muchos = []
  for (let i = 0; i < N; i++) {
    const f = path.join(dir, `carga_${i}.mp4`)
    fs.writeFileSync(f, 'x')
    muchos.push({ id: 'g' + i, name: 'clip ' + i, type: 'video', category: 'stock', path: f })
  }
  // Con graficos dentro, que es como sera de verdad: el fixture original no tenia ninguno y
  // por eso G0 no se caso aqui.
  muchos.push(
    { id: 'gCarga1', name: 'Gráfico carga 1', type: 'graphic', durationSeconds: 2,
      graphicData: { type: 'decorativo_emoji', emoji: '🔥' } },
    { id: 'gCarga2', name: 'Gráfico carga 2', type: 'graphic', durationSeconds: 2,
      graphicData: { type: 'frase_clave', value: 'x' } })
  await llamar('save-project-state', {
    id: 'carga', name: MARCA, clips: [], timelineVideoClips: muchos
  })

  const medir = async () => {
    const t = process.hrtime.bigint()
    const r = await llamar('load-project', { projectPath: proyecto })
    return { ms: Number(process.hrtime.bigint() - t) / 1e6, r }
  }
  await medir()   // calentar: la primera lectura paga el cache del sistema de ficheros
  const tiempos = []
  for (let i = 0; i < 5; i++) tiempos.push((await medir()).ms)
  tiempos.sort((x, y) => x - y)
  const mediana = tiempos[2]

  const ultima = await medir()
  ok(ultima.r.auditoria && ultima.r.auditoria.total === N &&
     ultima.r.auditoria.totalGraficos === 2 && ultima.r.auditoria.hayProblema === false,
    `la auditoria recorre los ${N} clips y los 2 graficos sin dar aviso`,
    `total=${ultima.r.auditoria.total} totalGraficos=${ultima.r.auditoria.totalGraficos} ` +
    `hayProblema=${ultima.r.auditoria.hayProblema}`)

  // El numero de arriba es load-project ENTERO: leer el json, parsearlo, crear carpetas y
  // auditar. Para saber que parte es la auditoria se acota por los dos lados.
  //   - suelo: el exists() pelado sobre las mismas 623 rutas, que es su trabajo real.
  //   - techo: export-video con todos los ficheros presentes, cancelado en el dialogo de guardar;
  //     ejecuta auditarClips y poco mas sin abrir un dialogo real.
  const tSuelo = process.hrtime.bigint()
  for (const c of muchos) fs.existsSync(c.path)
  const suelo = Number(process.hrtime.bigint() - tSuelo) / 1e6

  const originalMsg = dialog.showMessageBox
  const originalSave = dialog.showSaveDialog
  dialog.showMessageBox = async () => ({ response: 0 })
  dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined })
  await llamar('export-video', { clips: muchos, aspectRatio: '16:9', resolution: '1080p',
    format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
  const tiemposExport = []
  for (let i = 0; i < 5; i++) {
    const t = process.hrtime.bigint()
    await llamar('export-video', { clips: muchos, aspectRatio: '16:9', resolution: '1080p',
      format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
    tiemposExport.push(Number(process.hrtime.bigint() - t) / 1e6)
  }
  tiemposExport.sort((a, b) => a - b)
  const medianaExport = tiemposExport[2]
  dialog.showMessageBox = originalMsg
  dialog.showSaveDialog = originalSave

  console.log(`          load-project entero:      ${mediana.toFixed(1)} ms  ` +
    `(min ${tiempos[0].toFixed(1)} / max ${tiempos[4].toFixed(1)})`)
  console.log(`          export + auditoria:       ${medianaExport.toFixed(1)} ms mediana ` +
    `(min ${tiemposExport[0].toFixed(1)} / max ${tiemposExport[4].toFixed(1)}; ` +
    `exists pelado ${suelo.toFixed(1)} ms)`)
  console.log(`          por clip (mediana):       ${(medianaExport / N).toFixed(3)} ms`)

  ok(medianaExport < 250, 'la auditoria de 623 clips es imperceptible al abrir',
    medianaExport < 250 ? `${medianaExport.toFixed(1)} ms mediana; maximo observado ` +
      `${tiemposExport[4].toFixed(1)} ms`
      : `${medianaExport.toFixed(1)} ms mediana: supera los 250 ms`)
}

async function main () {
  console.log('AUDITORIA DE MATERIALES — los cuatro estados y la guarda del export')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.')
  const proyecto = await partesAyB()
  await parteC(proyecto)
  await llamar('close-project', {})

  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — los cuatro estados se distinguen y el export para a tiempo.')
  }
  return fallos.length
}

app.whenReady().then(async () => {
  require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(r => setTimeout(r, 1500))
  let code = 1
  try { code = await main() } catch (e) { console.log('EXCEPCION: ' + e.stack) } finally { limpiarFixture() }
  app.exit(code ? 1 : 0)
})
