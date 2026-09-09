// End-to-end acceptance: existing semantics -> AssetIntent -> resolver -> ProjectAsset/SceneSpec
// -> renderGraphicClip -> timeline/export. Asset selection is never supplied by this fixture.
const { app, BrowserWindow, dialog, ipcMain, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const PRODUCTION = path.join(OUTPUT, 'production')
const CONTACT_SHEET = path.join(OUTPUT, 'contact-sheet.png')
const FIXTURE_ROOT = createTestFixture('asset-resolver-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const WIDTH = 540
const HEIGHT = 960
const FPS = 10
const DURATION = 1.4
let networkAttempts = 0
let removeObserver

const blockNetwork = () => {
  networkAttempts += 1
  throw new Error('RED BLOQUEADA EN ACEPTACIÓN DEL RESOLVER')
}
global.fetch = blockNetwork
http.request = blockNetwork
https.request = blockNetwork
app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function snapshotRealProjects () {
  const root = path.join(REPO_ROOT, 'proyectos')
  const rows = []
  const walk = dir => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile() && ['project-state.json', 'project-state.json.bak', 'manifest.json'].includes(entry.name)) {
        const stat = fs.statSync(target)
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(target), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return rows.sort((a, b) => a[0].localeCompare(b[0]))
}

function invoke (channel, payload) {
  const handler = ipcMain._invokeHandlers.get(channel)
  if (!handler) throw new Error('Handler ausente: ' + channel)
  return handler({ sender: { isDestroyed: () => false, send: () => {} } }, payload)
}

function waitForMainWindow () {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const poll = () => {
      if (BrowserWindow.getAllWindows().some(window => !window.isDestroyed() && !window.webContents.isOffscreen())) return resolve()
      if (++attempts > 80) return reject(new Error('Ventana principal no disponible'))
      setTimeout(poll, 100)
    }
    poll()
  })
}

function ffprobe (file) {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=codec_name,width,height,pix_fmt,nb_read_frames,duration',
    '-show_entries', 'format=duration,size', '-of', 'json', file,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
}

function direction (index, density = 'media') {
  const rows = [
    ['tramaTejida', 'quieto', 'simultaneo'],
    ['circuito', 'deriva', 'frenando'],
    ['cristales', 'acercamiento', 'acelerando'],
  ]
  const selected = rows[index % rows.length]
  return { fondo: selected[0], camara: selected[1], densidad: density, ritmo: selected[2], semilla: 81000 + index }
}

function intentInput (item) {
  return {
    sceneId: item.id,
    phrase: item.phrase,
    keyword: item.keyword,
    concepts: item.concepts ?? [],
    relation: item.relation,
    anchor: item.anchor,
    searchTerms: item.searchTerms ?? [item.anchor, ...(item.concepts ?? [])],
    preferredVisualMode: item.preferredVisualMode ?? 'auto',
  }
}

function percentile (values, fraction) {
  const ordered = values.slice().sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))] ?? null
}

async function main () {
  fs.mkdirSync(PRODUCTION, { recursive: true })
  const realBefore = JSON.stringify(snapshotRealProjects())
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts += 1; callback({ cancel: true }) }
    else callback({ cancel: false })
  })
  await new Promise(resolve => setTimeout(resolve, 1200))
  const renderNetworkBaseline = networkAttempts
  bundle.createProjectFiles(PROJECT_ROOT, {
    id: 'fixture-asset-resolver-acceptance', clips: [], timelineVideoClips: [],
    aiScript: 'Aceptación automática del Asset Resolver V1',
  })
  const loaded = await invoke('load-project', { projectPath: PROJECT_ROOT })
  if (!loaded.success) throw new Error('No se pudo abrir el proyecto temporal: ' + loaded.error)

  const scenarios = [
    { id: '01-cake', phrase: 'El cumpleaños marca un momento', keyword: 'cumpleaños', concepts: [{ etiqueta: 'pastel' }] },
    { id: '02-astronaut', phrase: 'El universo pide exploración', keyword: 'universo', concepts: [{ etiqueta: 'astronauta' }], density: 'alta' },
    { id: '03-time', phrase: 'El tiempo ordena el proceso', keyword: 'tiempo', concepts: [{ etiqueta: 'reloj' }] },
    // Three short words select the editorial layout without introducing a text-overflow fixture.
    { id: '04-editorial-solar', phrase: 'El sol dibuja el rumbo', keyword: 'sol y mar', concepts: [{ etiqueta: 'órbita' }] },
    { id: '05-bridge', phrase: 'El puente conecta ideas', keyword: 'puente', concepts: [{ etiqueta: 'conexión' }] },
    { id: '06-thermo', phrase: 'La termodinámica explica el caos', keyword: 'termodinámica', concepts: [{ etiqueta: 'caos' }] },
    { id: '07-cake-reuse', phrase: 'El pastel vuelve como continuidad', keyword: 'pastel', concepts: [{ etiqueta: 'cumpleaños' }] },
    { id: '08-magic', phrase: 'A veces parece magia', keyword: 'magia', concepts: [{ etiqueta: 'destellos' }] },
    { id: '09-pedestrians', phrase: 'Los peatones atraviesan la ciudad', keyword: 'peatones', concepts: [{ etiqueta: 'puente' }] },
    { id: '10-discovery', phrase: 'El descubrimiento queda en notas', keyword: 'descubrió', concepts: [{ etiqueta: 'cuaderno' }] },
    { id: '11-sun', phrase: 'El sol marca la ruta', keyword: 'sol', concepts: [{ etiqueta: 'órbita' }] },
  ]
  const resolverSession = bundle.createResolverSessionV1()
  const resolved = []
  for (let index = 0; index < scenarios.length; index++) {
    const item = scenarios[index]
    const started = process.hrtime.bigint()
    const result = bundle.resolveAndCompileVisualSceneV1({
      intent: bundle.createAssetIntentV1(intentInput(item)),
      projectRoot: PROJECT_ROOT,
      sistema: index % 3 === 0 ? 'editorial' : index % 3 === 1 ? 'voltaje' : 'clinico',
      direction: direction(index, item.density ?? 'media'),
      session: resolverSession,
    })
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
    resolved.push({ item, result, elapsedMs })
  }

  const visualModes = resolved.map(row => row.result.decision.visualMode)
  if (visualModes.filter(mode => mode === 'asset-led').length < 4) throw new Error('Faltan asset-led en aceptación automática')
  if (visualModes.filter(mode => mode === 'editorial-text').length < 2) throw new Error('Faltan fallbacks editoriales en aceptación automática')
  if (!resolved.some(row => row.result.decision.hero?.provider === 'solar')) throw new Error('Falta Solar procedural')
  if (!resolved.some(row => row.result.decision.hero?.provider === 'openmoji')) throw new Error('Falta OpenMoji')
  if (!resolved.some(row => row.result.trace.reuse.reusedProjectAsset)) throw new Error('Falta reuso de ProjectAsset')
  if (!resolved.some(row => row.result.decision.structure === 'constelacion') ||
      !resolved.some(row => row.result.decision.structure === 'marcoPoster') ||
      !resolved.some(row => row.result.decision.structure === 'editorial'))
    throw new Error('No se cubrieron las tres estructuras certificadas')

  const renderMetrics = []
  removeObserver = bundle.observarRendimientoGraficos(metric => renderMetrics.push(metric))
  const timeline = []
  let start = 0
  const renderStarted = process.hrtime.bigint()
  for (const row of resolved) {
    const clip = await bundle.renderGraphicClip(row.result.compiled.graphicData, {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla',
      projectRoot: PROJECT_ROOT, renderBindings: row.result.compiled.renderBindings,
    })
    if (!clip || !fs.existsSync(clip)) throw new Error('Render nulo: ' + row.item.id)
    timeline.push({
      id: row.item.id, name: row.item.keyword, type: 'video', category: 'visual', path: clip,
      startSeconds: start, durationSeconds: DURATION,
    })
    start += DURATION
  }
  const renderElapsedMs = Number(process.hrtime.bigint() - renderStarted) / 1e6

  await waitForMainWindow()
  const video = path.join(PRODUCTION, 'asset-resolver-v1.mp4')
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: video })
  const exported = await invoke('export-video', {
    clips: timeline, aspectRatio: 'vertical', resolution: '720p', format: 'mp4', quality: 'high',
    assignedTransitions: {}, transitionDuration: .5, ajustesVideo: undefined,
  })
  if (!exported.success || !fs.existsSync(video) || fs.statSync(video).size === 0)
    throw new Error('Export automático falló: ' + JSON.stringify(exported))
  // This is an acceptance artifact made exclusively from the product video. It does not embed
  // or redistribute a raw provider asset, and lets visual review inspect the real render fast.
  // Start half way into the first clip, then sample once per clip duration. Entry frames can
  // honestly be mostly empty, whereas this sheet is meant to review the sustained product look.
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', video,
    '-vf', 'trim=start=0.7,setpts=PTS-STARTPTS,fps=1/1.4,scale=180:-1,tile=4x3', '-frames:v', '1', CONTACT_SHEET,
  ], { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
  if (!fs.existsSync(CONTACT_SHEET) || fs.statSync(CONTACT_SHEET).size === 0)
    throw new Error('No se generó la hoja de contacto de aceptación')

  if (networkAttempts !== renderNetworkBaseline)
    throw new Error(`El resolver/render intentó red: antes=${renderNetworkBaseline}, después=${networkAttempts}`)
  if (JSON.stringify(snapshotRealProjects()) !== realBefore) throw new Error('Cambió un proyecto real')
  if (fs.existsSync(path.join(REPO_ROOT, 'project-state.json')) || fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')))
    throw new Error('Apareció estado en la raíz')
  const rawAssets = []
  const walkOutput = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) walkOutput(target)
      else if (/\.(svg|png)$/i.test(entry.name)) rawAssets.push(target)
    }
  }
  walkOutput(PRODUCTION)
  if (rawAssets.length) throw new Error('El artefacto de aceptación contiene assets crudos')

  const timings = resolved.map(row => row.elapsedMs)
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    base: '9f989041478b26cd0e9681b36ef36986ce18b88f',
    renderer: 'AssetIntent -> resolver -> VisualSceneSpecV1 + RenderBindingsV1 -> renderGraphicClip -> export-video',
    temporaryProject: true,
    realProjectsUntouched: true,
    offline: { startupAttemptsBlocked: renderNetworkBaseline, resolverAndRenderAttempts: networkAttempts - renderNetworkBaseline },
    resolver: {
      version: 1,
      scenes: resolved.map(row => ({
        id: row.item.id,
        keyword: row.item.keyword,
        visualMode: row.result.decision.visualMode,
        provider: row.result.decision.hero?.provider ?? null,
        structure: row.result.decision.structure,
        treatment: row.result.decision.hero?.treatment ?? 'none',
        fallback: row.result.decision.fallback,
        trace: row.result.trace,
        metrics: row.result.metrics,
        elapsedMs: Number(row.elapsedMs.toFixed(3)),
      })),
      timing: {
        totalMs: Number(timings.reduce((sum, value) => sum + value, 0).toFixed(3)),
        medianMs: Number(percentile(timings, .5).toFixed(3)),
        p95Ms: Number(percentile(timings, .95).toFixed(3)),
        queries: resolved.reduce((sum, row) => sum + row.result.metrics.openMojiQueries, 0),
        publications: resolved.reduce((sum, row) => sum + row.result.metrics.assetsPublished, 0),
        reusedAssets: resolved.reduce((sum, row) => sum + row.result.metrics.projectAssetsReused, 0),
        manifestReads: resolved.reduce((sum, row) => sum + row.result.metrics.manifestReads, 0),
        fallbacks: resolved.filter(row => row.result.decision.visualMode === 'editorial-text').length,
        needsReview: 0,
      },
    },
    render: {
      dimensions: `${WIDTH}x${HEIGHT}`,
      fps: FPS,
      clipDurationSeconds: DURATION,
      totalPreparationAndRenderMs: Number(renderElapsedMs.toFixed(3)),
      clips: renderMetrics,
    },
    video: {
      file: 'production/asset-resolver-v1.mp4',
      sha256: sha256(video),
      durationSeconds: start,
      timelineExport: true,
      ffprobe: ffprobe(video),
    },
    contactSheet: {
      file: 'contact-sheet.png',
      sha256: sha256(CONTACT_SHEET),
      generatedFrom: 'production/asset-resolver-v1.mp4',
    },
  }
  const evidencePath = path.join(OUTPUT, 'evidence.json')
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ video, evidence: evidencePath, resolver: evidence.resolver.timing, render: evidence.render }, null, 2))
}

app.whenReady().then(main).then(() => {
  removeObserver?.()
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error(error) }
  app.exit(0)
}).catch(error => {
  console.error(error && error.stack || error)
  removeObserver?.()
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (cleanupError) { console.error(cleanupError) }
  app.exit(1)
})
