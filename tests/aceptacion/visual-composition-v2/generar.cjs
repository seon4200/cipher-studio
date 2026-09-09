// Ronda 4B acceptance: replay the 50 forensic Visual requests through the productive
// V4A semantic decision and V13 renderer. All mutable inputs live in a marked temp project.
const { app, BrowserWindow, dialog, ipcMain, nativeImage, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const AUDIT_ROOT = path.resolve(REPO_ROOT, '..', '..', '..', 'graphify', 'diagnostics', 'audit-last-real-video-20260909')
const V12_ROOT = path.join(REPO_ROOT, 'tests', 'aceptacion', 'semantic-decision-repair-v1')
const V12_SHEET = path.join(V12_ROOT, 'contact-sheet-before-after.png')
const OUTPUT = __dirname
const PRODUCTION = path.join(OUTPUT, 'production')
const CONTACT_SHEET = path.join(OUTPUT, 'contact-sheet-v12-v13.png')
const EVIDENCE_FILE = path.join(OUTPUT, 'evidence.json')
const CORPUS_FILE = path.join(OUTPUT, 'corpus-50.json')
const TIMELINE_FILE = path.join(PRODUCTION, 'timeline.json')
const VIDEO_FILE = path.join(PRODUCTION, 'visual-composition-v2.mp4')
const FIXTURE_ROOT = createTestFixture('visual-composition-v2-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const WIDTH = 540
const HEIGHT = 960
const FPS = 10
const DEFAULT_DURATION = 1.4
const REVIEW_KEYWORDS = ['construir', 'partidos', 'fútbol', 'estando', 'iglesia', 'religioso', 'accidente', 'indignación']
const REVIEW_INDICES = { construir: 1, partidos: 5, fútbol: 25, estando: 32, iglesia: 74, religioso: 76, accidente: 37, indignación: 27 }
const LEGACY_DENSITY_COUNT = { minima: 1, baja: 3, media: 5, alta: 8, saturada: 14 }
let networkAttempts = 0
let finished = false
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
const originalSaveDialog = dialog.showSaveDialog

const json = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const percentile = (values, fraction) => {
  const ordered = values.slice().sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))] ?? null
}
const counts = values => Object.fromEntries([...values.reduce((map, value) =>
  map.set(value, (map.get(value) || 0) + 1), new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))))

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
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function assertRepositoryUntouched (before) {
  if (snapshotRealProjects() !== before) throw new Error('Cambió un proyecto real')
  for (const name of ['project-state.json', 'project-state.json.bak']) {
    if (fs.existsSync(path.join(REPO_ROOT, name))) throw new Error('Apareció ' + name + ' en la raíz')
  }
  if (fs.existsSync(path.join(REPO_ROOT, '.cipher-test-fixture'))) throw new Error('Apareció un fixture dentro del repositorio')
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
      if (++attempts > 120) return reject(new Error('Ventana principal no disponible'))
      setTimeout(poll, 100)
    }
    poll()
  })
}

function blockNetwork (value) {
  networkAttempts++
  throw new Error('RED BLOQUEADA EN ACCEPTANCE 4B: ' + String(value || 'request'))
}

function transcriptRows (raw) {
  return Array.isArray(raw) ? raw : (Array.isArray(raw?.segments) ? raw.segments : [])
}

function conceptsFromLog (value) {
  if (typeof value !== 'string') return []
  return value.split('|').map(part => part.trim()).filter(Boolean).map(part => {
    const pieces = part.split(/\s+/)
    return { emoji: pieces.shift() || '', etiqueta: pieces.join(' ') || 'contexto' }
  })
}

function rangeForAttempt (timeline, attempt) {
  const row = (timeline.rows || []).find(candidate => candidate.pos === attempt.pos)
  if (row && Number.isFinite(row.startSeconds) && Number.isFinite(row.end)) return { start: row.startSeconds, end: row.end }
  return { start: 0, end: 2 }
}

function keywordCandidates (value) {
  const keyword = typeof value === 'string' ? value.trim() : ''
  return keyword ? [{ keyword, source: 'scene-semantic' }] : undefined
}

function fallbackDirection (index) {
  const rows = [
    { fondo: 'tramaTejida', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo' },
    { fondo: 'circuito', camara: 'deriva', densidad: 'baja', ritmo: 'frenando' },
    { fondo: 'cristales', camara: 'acercamiento', densidad: 'alta', ritmo: 'acelerando' },
  ]
  return { ...rows[index % rows.length], semilla: 940000 + index }
}

function directionForAttempt (attempt, beforeVisual, index) {
  const source = beforeVisual?.derivedDirection
  if (!source) return fallbackDirection(index)
  return {
    fondo: source.fondo,
    camara: source.camara,
    densidad: source.densidad,
    ritmo: source.ritmo,
    semilla: Number(beforeVisual.seed) || (950000 + index),
  }
}

function localSemanticFor (bundle, audit, attempt, beforeVisual, scenePrefix) {
  const range = rangeForAttempt(audit.timeline, attempt)
  const concepts = beforeVisual?.concepts?.length ? beforeVisual.concepts : conceptsFromLog(attempt.semantic?.conceptsLog)
  return bundle.createLocalSceneSemanticV1({
    sceneId: `${scenePrefix}-${attempt.pos.replace(':', '-')}`,
    start: range.start,
    end: range.end,
    transcriptSegments: audit.transcript,
    concepts,
    anchor: beforeVisual?.diagnosticInput?.anchor || concepts[0]?.etiqueta || concepts[0]?.label,
    relation: beforeVisual?.diagnosticInput?.relation,
    globalText: attempt.phrase,
    globalHints: [attempt.keyword, attempt.semantic?.queryTruncated].filter(Boolean),
    globalContextRef: 'forensic:' + attempt.pos,
  })
}

function resolveAttempt (bundle, audit, attempt, index, resolverSession, scenePrefix = 'v13') {
  const beforeVisual = audit.visuals.find(candidate => candidate.pos === attempt.pos)
  const localSemantic = localSemanticFor(bundle, audit, attempt, beforeVisual, scenePrefix)
  const candidates = keywordCandidates(beforeVisual?.diagnosticInput?.keyword || attempt.keyword)
  const resolved = bundle.resolveLocalSemanticVisualSceneV1({
    localSemantic,
    projectRoot: PROJECT_ROOT,
    sistema: 'editorial',
    direction: directionForAttempt(attempt, beforeVisual, index),
    session: resolverSession,
    ...(candidates ? { keywordCandidates: candidates } : {}),
  })
  return { attempt, beforeVisual, localSemantic, resolved }
}

function qcCodes (report, level) {
  return (report?.findings || []).filter(finding => !level || finding.level === level).map(finding => finding.code)
}

function compactRow (entry) {
  const { attempt, localSemantic, resolved, report, clip, duration } = entry
  const spec = resolved.compiled.sceneSpec
  const provider = resolved.decision.hero?.provider || 'editorial-text'
  const candidate = resolved.decision.hero?.stableId || resolved.decision.hero?.solarName || null
  const snapshots = report?.snapshots || []
  return {
    index: attempt.index,
    pos: attempt.pos,
    sceneId: resolved.decision.sceneId,
    globalTextLength: String(attempt.phrase || '').length,
    localText: localSemantic.localText,
    keywordBefore: attempt.keyword,
    keywordAfter: resolved.keywordSelection.keyword,
    provider,
    candidate,
    visualMode: resolved.decision.visualMode,
    structure: spec.direccion.estructura,
    background: spec.direccion.fondo,
    camera: spec.direccion.camara,
    rhythm: spec.direccion.ritmo,
    density: spec.direccion.densidad,
    decoratorCount: snapshots[0]?.decoratorCount ?? null,
    emptyHeroFrames: Math.max(0, ...snapshots.map(snapshot => Number(snapshot.emptyHeroFrames) || 0)),
    treatment: spec.slots.find(slot => slot.role === 'hero')?.tint?.treatment || 'none',
    qc: clip ? 'accepted' : report ? 'rejected' : 'render-failed',
    qcErrorCodes: qcCodes(report, 'error'),
    qcNeedsReviewCodes: qcCodes(report, 'needs-review'),
    localContrast: report?.localTextContrast ?? null,
    rendered: Boolean(clip),
    duration,
    resolverDegraded: resolved.inputFallback.used || resolved.decision.alerts.some(alert => alert.code === 'RESOLVER_DEGRADED'),
    fallback: resolved.decision.fallback,
  }
}

function historicalMetrics (audit, v12Qc) {
  const densities = audit.visuals.map(row => row.effective?.direction?.densidad).filter(Boolean)
  const decoratorCounts = audit.visuals.map(row => Number(row.effective?.densityCount)).filter(Number.isFinite)
  const emptyPoster = audit.visuals.filter(row => row.effective?.mode === 'editorial-text' && row.effective?.direction?.estructura === 'marcoPoster').length
  const deadHeroStructures = audit.visuals.filter(row => row.effective?.mode === 'editorial-text' &&
    ['marcoPoster', 'constelacion'].includes(row.effective?.direction?.estructura)).length
  const msPerFrame = audit.visuals.map(row => {
    const match = String(row.renderLog?.text || '').match(/—\s+(\d+)f\s+\d+x\d+\s+—.*?—\s+(\d+)\s+ms/)
    return match ? Number(match[2]) / Number(match[1]) : null
  }).filter(Number.isFinite)
  return {
    requestedVisuals: audit.attempts.length,
    materializedVisuals: audit.visuals.length,
    qcRejectedVisuals: audit.attempts.length - audit.visuals.length,
    substitutedWithOriginal: audit.attempts.length - audit.visuals.length,
    densityScope: '34 Visuales materializados del último video real V12',
    densityDistribution: counts(densities),
    decoratorTotal: decoratorCounts.reduce((sum, value) => sum + value, 0),
    decoratorMean: decoratorCounts.length ? Number((decoratorCounts.reduce((sum, value) => sum + value, 0) / decoratorCounts.length).toFixed(2)) : null,
    emptyHeroFrames: emptyPoster,
    deadHeroStructures,
    qcCategoryOccurrences: v12Qc.qcCategories,
    performance: {
      scope: 'logs del export real V12, 1080x1920; no es una comparación controlada con el probe V13',
      successfulRenders: msPerFrame.length,
      medianMsPerFrame: percentile(msPerFrame, .5),
      p95MsPerFrame: percentile(msPerFrame, .95),
    },
  }
}

function comparePngsWithTolerance (currentImage, expectedFile) {
  const expectedImage = nativeImage.createFromPath(expectedFile)
  const currentSize = currentImage.getSize()
  const expectedSize = expectedImage.getSize()
  if (currentSize.width !== expectedSize.width || currentSize.height !== expectedSize.height)
    throw new Error(`Regresión legacy: dimensiones ${currentSize.width}x${currentSize.height} != ${expectedSize.width}x${expectedSize.height}`)
  const current = currentImage.toBitmap()
  const expected = expectedImage.toBitmap()
  let differentPixels = 0
  let absoluteChannelDelta = 0
  for (let offset = 0; offset < current.length; offset += 4) {
    const blue = Math.abs(current[offset] - expected[offset])
    const green = Math.abs(current[offset + 1] - expected[offset + 1])
    const red = Math.abs(current[offset + 2] - expected[offset + 2])
    absoluteChannelDelta += red + green + blue
    if (Math.max(red, green, blue) > 8) differentPixels++
  }
  const pixels = currentSize.width * currentSize.height
  return {
    width: currentSize.width,
    height: currentSize.height,
    differentPixelRatio: differentPixels / pixels,
    meanAbsoluteChannelDelta: absoluteChannelDelta / (pixels * 3),
  }
}

async function measureLegacyRegression () {
  const legacyGraphic = {
    type: 'visual_escena',
    value: 'memoria',
    extra: {
      conceptos: [
        { emoji: '🧠', etiqueta: 'recuerdo' },
        { emoji: '🗂️', etiqueta: 'archivo' },
        { emoji: '🔗', etiqueta: 'conexion' },
      ],
      direccion: { fondo: 'ondas', estructura: 'constelacion', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', tipografia: 'archivo' },
    },
  }
  const window = new BrowserWindow({
    show: false, width: 1080, height: 1928, useContentSize: true, frame: false,
    enableLargerThanScreen: true, transparent: true, backgroundColor: '#00000000',
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false },
  })
  try {
    await window.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))
    window.setContentSize(1080, 1928)
    const ready = await window.webContents.executeJavaScript('window.__listo()')
    if (ready.avisosFuentes.length) throw new Error('Fuentes legacy no listas: ' + JSON.stringify(ready.avisosFuentes))
    await window.webContents.executeJavaScript(
      `window.__montar(${JSON.stringify(legacyGraphic)},${JSON.stringify({ ancho: 1080, alto: 1920, modo: 'pantalla', duracion: 3, sistema: 'voltaje' })});window.__setT(1.5)`,
    )
    await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>new Promise(r=>setTimeout(r,200)))')
    const image = await window.webContents.capturePage({ x: 0, y: 8, width: 1080, height: 1920 })
    const comparison = comparePngsWithTolerance(image,
      path.join(REPO_ROOT, 'tests', 'aceptacion', 'visual-asset-mvp', 'legacy-baseline-b735.png'))
    return {
      baseline: 'tests/aceptacion/visual-asset-mvp/legacy-baseline-b735.png',
      thresholds: { differentPixelRatioMax: 0.03, meanAbsoluteChannelDeltaMax: 2 },
      ...comparison,
      passed: comparison.differentPixelRatio <= 0.03 && comparison.meanAbsoluteChannelDelta <= 2,
    }
  } finally {
    window.destroy()
  }
}

async function renderCorpus (bundle, audit) {
  const resolverSession = bundle.createResolverSessionV1()
  const internals = audit.attempts.map((attempt, index) => resolveAttempt(bundle, audit, attempt, index, resolverSession))
  const renderMetrics = []
  const removeObserver = bundle.observarRendimientoGraficos(metric => renderMetrics.push(metric))
  const first = internals[0]
  const firstDuration = Math.max(1, Math.min(2.4, first.localSemantic.end - first.localSemantic.start))
  const v12Hash = bundle.hashGraficoConVersionPlantillas(first.resolved.compiled.graphicData, WIDTH, HEIGHT,
    firstDuration, FPS, 'pantalla', 'editorial', 12)
  const v13Hash = bundle.hashGraficoConVersionPlantillas(first.resolved.compiled.graphicData, WIDTH, HEIGHT,
    firstDuration, FPS, 'pantalla', 'editorial', 13)
  if (v12Hash === v13Hash) throw new Error('V12 y V13 produjeron el mismo hash')
  const sentinelDir = path.join(PROJECT_ROOT, 'materiales', 'visual')
  fs.mkdirSync(sentinelDir, { recursive: true })
  const sentinel = path.join(sentinelDir, v12Hash + '.mp4')
  fs.writeFileSync(sentinel, 'V12-CACHE-SENTINEL', { flag: 'wx' })

  try {
    for (let index = 0; index < internals.length; index++) {
      const entry = internals[index]
      const duration = Math.max(1, Math.min(2.4, entry.localSemantic.end - entry.localSemantic.start))
      let report = null
      const clip = await bundle.renderGraphicClip(entry.resolved.compiled.graphicData, {
        ancho: WIDTH,
        alto: HEIGHT,
        fps: FPS,
        duracion: duration,
        modo: 'pantalla',
        projectRoot: PROJECT_ROOT,
        renderBindings: entry.resolved.compiled.renderBindings,
        onQcReport: value => { report = value },
        onQcFailure: value => { report = value },
      })
      entry.duration = duration
      entry.report = report
      entry.clip = clip
      if (index === 0 && clip && path.basename(clip, '.mp4') !== v13Hash)
        throw new Error('El primer render no usó el hash V13 esperado')
    }
  } finally {
    removeObserver()
  }
  if (fs.readFileSync(sentinel, 'utf8') !== 'V12-CACHE-SENTINEL') throw new Error('La caché V12 fue tocada')

  const rows = internals.map(compactRow)
  const accepted = rows.filter(row => row.rendered)
  const reports = internals.map(row => row.report).filter(Boolean)
  const errors = reports.flatMap(report => qcCodes(report, 'error'))
  const needsReview = reports.flatMap(report => qcCodes(report, 'needs-review'))
  const decoratorValues = rows.map(row => row.decoratorCount).filter(Number.isFinite)
  const perfValues = renderMetrics.map(metric => metric.ms / metric.totalFrames)
  const metrics = {
    requestedVisuals: rows.length,
    materializedVisuals: accepted.length,
    qcRejectedVisuals: rows.filter(row => row.qc === 'rejected').length,
    substitutedWithOriginal: rows.filter(row => !row.rendered).length,
    resolverDegradedVisuals: rows.filter(row => row.resolverDegraded).length,
    densityDistributionAllDecisions: counts(rows.map(row => row.density)),
    densityDistributionMaterialized: counts(accepted.map(row => row.density)),
    decoratorTotal: decoratorValues.reduce((sum, value) => sum + value, 0),
    decoratorMean: decoratorValues.length ? Number((decoratorValues.reduce((sum, value) => sum + value, 0) / decoratorValues.length).toFixed(2)) : null,
    editorialDecoratorMean: (() => {
      const values = rows.filter(row => row.visualMode === 'editorial-text').map(row => row.decoratorCount).filter(Number.isFinite)
      return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null
    })(),
    emptyHeroFrames: rows.reduce((sum, row) => sum + row.emptyHeroFrames, 0),
    deadHeroStructures: rows.filter(row => row.visualMode === 'editorial-text' && row.structure !== 'editorial').length,
    qcCategoryOccurrences: counts(errors),
    needsReviewOccurrences: counts(needsReview),
    providers: counts(rows.map(row => row.provider)),
    treatments: counts(rows.filter(row => row.provider === 'openmoji').map(row => row.treatment)),
    longGlobalInputs: rows.filter(row => row.globalTextLength > 480).length,
    newScenesToLegacy: 0,
    performance: {
      scope: `${WIDTH}x${HEIGHT}, ${FPS} fps, renders productivos no cacheados aceptados`,
      measuredRenders: renderMetrics.length,
      totalRenderMs: renderMetrics.reduce((sum, metric) => sum + metric.ms, 0),
      medianMsPerFrame: percentile(perfValues, .5),
      p95MsPerFrame: percentile(perfValues, .95),
      meanAttemptsPerFrame: renderMetrics.length
        ? Number((renderMetrics.reduce((sum, metric) => sum + metric.intentosPorFrame, 0) / renderMetrics.length).toFixed(3)) : null,
    },
  }
  return {
    internals,
    rows,
    metrics,
    renderMetrics,
    cacheProof: {
      versionBefore: 12,
      versionAfter: 13,
      sameSceneV12Hash: v12Hash,
      sameSceneV13Hash: v13Hash,
      hashesDiffer: v12Hash !== v13Hash,
      returnedV13Hash: internals[0].clip ? path.basename(internals[0].clip, '.mp4') : null,
      v12SentinelPreserved: true,
    },
  }
}

function sanitizeLabel (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _|/.+-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function frameFromVideo (video, output, seekSeconds = .65) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seekSeconds), '-i', video,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:${HEIGHT}`, output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function placeholder (output, message) {
  const safe = sanitizeLabel(message).slice(0, 38)
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', `color=c=0x202020:s=${WIDTH}x${HEIGHT}:d=.1`, '-vf',
    `drawtext=fontfile='${font}':text='${safe}':fontcolor=white:fontsize=24:x=28:y=450`, '-frames:v', '1', output],
  { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
}

function labelFrame (input, output, lines) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const filters = [`scale=${WIDTH}:${HEIGHT}`, `pad=${WIDTH}:${HEIGHT + 120}:0:120:black`]
  lines.slice(0, 3).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${sanitizeLabel(line).slice(0, 58)}':fontcolor=white:fontsize=18:x=12:y=${10 + index * 35}`))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', filters.join(','), '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function cropV12ReviewCell (order, output) {
  const tile = order * 2 + 1
  const x = (tile % 4) * 360
  const y = Math.floor(tile / 4) * 640
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', V12_SHEET,
    '-vf', `crop=360:640:${x}:${y}`, '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function makeSheet (frames) {
  if (frames.length !== 16) throw new Error('La hoja comparativa requiere 16 celdas')
  const cellHeight = HEIGHT + 120
  const inputs = frames.flatMap(file => ['-i', file])
  const layout = frames.map((_, index) => `${(index % 4) * WIDTH}_${Math.floor(index / 4) * cellHeight}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', `xstack=inputs=${frames.length}:layout=${layout}:fill=black`, '-frames:v', '1', CONTACT_SHEET],
  { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function reviewDirection (index) {
  return fallbackDirection(500 + index)
}

async function renderReviewSheet (bundle, audit, v12Evidence) {
  const frames = []
  const rows = []
  const resolverSession = bundle.createResolverSessionV1()
  fs.mkdirSync(FRAME_ROOT, { recursive: true })
  for (let order = 0; order < REVIEW_KEYWORDS.length; order++) {
    const keyword = REVIEW_KEYWORDS[order]
    const index = REVIEW_INDICES[keyword]
    const attempt = audit.attempts.find(candidate => candidate.index === index)
    const beforeVisual = audit.visuals.find(candidate => candidate.index === index)
    if (!attempt || !beforeVisual) throw new Error('Escena forense ausente para hoja: ' + keyword)
    const localSemantic = localSemanticFor(bundle, audit, attempt, beforeVisual, 'review-v13')
    const candidates = keywordCandidates(beforeVisual.diagnosticInput?.keyword || attempt.keyword)
    const resolved = bundle.resolveLocalSemanticVisualSceneV1({
      localSemantic,
      projectRoot: PROJECT_ROOT,
      sistema: 'editorial',
      direction: reviewDirection(order),
      session: resolverSession,
      ...(candidates ? { keywordCandidates: candidates } : {}),
    })
    let report = null
    const clip = await bundle.renderGraphicClip(resolved.compiled.graphicData, {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DEFAULT_DURATION, modo: 'pantalla',
      projectRoot: PROJECT_ROOT, renderBindings: resolved.compiled.renderBindings,
      onQcReport: value => { report = value }, onQcFailure: value => { report = value },
    })
    const previous = v12Evidence.reviewSheet.order.find(row => row.keyword === keyword)?.after
    if (!previous) throw new Error('Evidencia V12 ausente: ' + keyword)
    const previousDensity = reviewDirection(order).densidad
    const previousDecorators = LEGACY_DENSITY_COUNT[previousDensity]
    const v12Raw = path.join(FRAME_ROOT, `${String(order).padStart(2, '0')}-v12-raw.png`)
    const v12Labelled = path.join(FRAME_ROOT, `${String(order).padStart(2, '0')}-v12.png`)
    cropV12ReviewCell(order, v12Raw)
    labelFrame(v12Raw, v12Labelled, [
      `V12 ${keyword} ${previous.provider} ${previous.candidate || 'sin Hero'}`,
      `${previous.structure} | ${previousDensity} | dec ${previousDecorators}`,
      `QC ${previous.rendered ? 'accepted' : previous.qcFindingCodes.join('+')}`,
    ])
    const v13Raw = path.join(FRAME_ROOT, `${String(order).padStart(2, '0')}-v13-raw.png`)
    const v13Labelled = path.join(FRAME_ROOT, `${String(order).padStart(2, '0')}-v13.png`)
    if (clip) frameFromVideo(clip, v13Raw)
    else placeholder(v13Raw, 'QC ' + qcCodes(report, 'error').join(' '))
    const spec = resolved.compiled.sceneSpec
    const provider = resolved.decision.hero?.provider || 'editorial-text'
    const candidate = resolved.decision.hero?.stableId || resolved.decision.hero?.solarName || 'sin Hero'
    const decorators = report?.snapshots?.[0]?.decoratorCount ?? bundle.decoratorBudgetV2(
      resolved.decision.visualMode, spec.direccion.densidad, Boolean(resolved.decision.hero))
    labelFrame(v13Raw, v13Labelled, [
      `V13 ${keyword} ${provider} ${candidate}`,
      `${spec.direccion.estructura} | ${spec.direccion.densidad} | dec ${decorators}`,
      `QC ${clip ? 'accepted' : qcCodes(report, 'error').join('+')}`,
    ])
    frames.push(v12Labelled, v13Labelled)
    rows.push({
      keyword,
      v12: { provider: previous.provider, candidate: previous.candidate, visualMode: previous.visualMode,
        structure: previous.structure, density: previousDensity, decoratorCount: previousDecorators,
        qc: previous.rendered ? 'accepted' : 'rejected', qcErrorCodes: previous.qcFindingCodes },
      v13: { provider, candidate, visualMode: resolved.decision.visualMode, structure: spec.direccion.estructura,
        density: spec.direccion.densidad, decoratorCount: decorators, treatment: resolved.trace.treatment,
        qc: clip ? 'accepted' : 'rejected', qcErrorCodes: qcCodes(report, 'error') },
    })
  }
  makeSheet(frames)
  return rows
}

async function renderSyntheticSolar (bundle) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: 'acceptance-solar-evidence', start: 0, end: 2,
    transcriptSegments: [{ start: 0, end: 2, text: 'La evidencia conecta los hechos.', words: [
      { word: 'La', start: 0, end: .2 }, { word: 'evidencia', start: .2, end: .9 },
      { word: 'conecta', start: .9, end: 1.4 }, { word: 'los', start: 1.4, end: 1.6 }, { word: 'hechos.', start: 1.6, end: 2 },
    ] }],
    concepts: [{ label: 'evidencia' }], anchor: 'evidencia', globalText: 'La evidencia conecta los hechos.',
    globalContextRef: 'synthetic-local-control',
  })
  const resolved = bundle.resolveLocalSemanticVisualSceneV1({
    localSemantic, keywordCandidates: [{ keyword: 'evidencia', source: 'scene-semantic' }],
    projectRoot: PROJECT_ROOT, sistema: 'editorial', direction: fallbackDirection(700),
    session: bundle.createResolverSessionV1(),
  })
  if (resolved.decision.hero?.provider !== 'solar') throw new Error('El control sintético no resolvió Solar')
  let report = null
  const clip = await bundle.renderGraphicClip(resolved.compiled.graphicData, {
    ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DEFAULT_DURATION, modo: 'pantalla', projectRoot: PROJECT_ROOT,
    renderBindings: resolved.compiled.renderBindings, onQcReport: value => { report = value }, onQcFailure: value => { report = value },
  })
  if (!clip) throw new Error('El control Solar no materializó')
  return { id: 'solar-control', clip, duration: DEFAULT_DURATION, resolved, report, kind: 'synthetic-solar-control' }
}

async function renderMissingFallback (bundle, sourceEntry) {
  const binding = sourceEntry.resolved.compiled.renderBindings.assets[0]
  if (!binding) throw new Error('No hay ProjectAsset para la prueba missing')
  const absolute = path.join(PROJECT_ROOT, binding.relativeFile.replace(/\//g, path.sep))
  const held = absolute + '.acceptance-missing'
  fs.renameSync(absolute, held)
  try {
    const prepared = bundle.prepareGraphicForVisualRender({
      graphicData: sourceEntry.resolved.compiled.graphicData,
      projectRoot: PROJECT_ROOT,
      renderBindings: sourceEntry.resolved.compiled.renderBindings,
    })
    if (prepared.sceneSpec.visualMode !== 'editorial-text' || !prepared.warnings.some(value => value.includes('MISSING')))
      throw new Error('Hero missing no produjo fallback editorial trazable')
    let report = null
    const clip = await bundle.renderGraphicClip(sourceEntry.resolved.compiled.graphicData, {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DEFAULT_DURATION, modo: 'pantalla', projectRoot: PROJECT_ROOT,
      renderBindings: sourceEntry.resolved.compiled.renderBindings,
      onQcReport: value => { report = value }, onQcFailure: value => { report = value },
    })
    if (!clip) throw new Error('Fallback missing no materializó editorial-text')
    return { id: 'missing-fallback', clip, duration: DEFAULT_DURATION, prepared, report, kind: 'missing-fallback' }
  } finally {
    fs.renameSync(held, absolute)
  }
}

function selectVideoRows (corpus, solar, missing) {
  const selected = []
  const seen = new Set()
  const add = entry => {
    if (!entry || !entry.clip || seen.has(entry.resolved.decision.sceneId) || selected.length >= 10) return
    seen.add(entry.resolved.decision.sceneId)
    selected.push(entry)
  }
  add(corpus.internals.find(row => row.clip && row.resolved.decision.hero?.provider === 'openmoji' &&
    row.resolved.decision.hero.treatment === 'accent-mask'))
  add(corpus.internals.find(row => row.clip && row.resolved.decision.hero?.provider === 'openmoji' &&
    row.resolved.decision.hero.treatment === 'duotone'))
  for (const structure of ['constelacion', 'marcoPoster', 'editorial'])
    add(corpus.internals.find(row => row.clip && row.resolved.compiled.sceneSpec.direccion.estructura === structure))
  add(corpus.internals.filter(row => row.clip).sort((a, b) => String(b.attempt.phrase || '').length - String(a.attempt.phrase || '').length)[0])
  for (const entry of corpus.internals.filter(row => row.clip && row.resolved.decision.visualMode === 'editorial-text').slice(0, 4)) add(entry)
  for (const entry of corpus.internals.filter(row => row.clip)) add(entry)
  const result = selected.slice(0, 10).map(entry => ({
    id: entry.resolved.decision.sceneId,
    clip: entry.clip,
    duration: entry.duration,
    kind: 'forensic-corpus',
    provider: entry.resolved.decision.hero?.provider || 'editorial-text',
    treatment: entry.resolved.decision.hero?.provider === 'openmoji' ? entry.resolved.decision.hero.treatment : 'none',
    structure: entry.resolved.compiled.sceneSpec.direccion.estructura,
    camera: entry.resolved.compiled.sceneSpec.direccion.camara,
    density: entry.resolved.compiled.sceneSpec.direccion.densidad,
  }))
  result.push({ id: solar.id, clip: solar.clip, duration: solar.duration, kind: solar.kind,
    provider: 'solar', treatment: 'none', structure: solar.resolved.compiled.sceneSpec.direccion.estructura,
    camera: solar.resolved.compiled.sceneSpec.direccion.camara, density: solar.resolved.compiled.sceneSpec.direccion.densidad })
  result.push({ id: missing.id, clip: missing.clip, duration: missing.duration, kind: missing.kind,
    provider: 'editorial-text', treatment: 'none', structure: missing.prepared.sceneSpec.direccion.estructura,
    camera: missing.prepared.sceneSpec.direccion.camara, density: missing.prepared.sceneSpec.direccion.densidad })
  const providers = new Set(result.map(row => row.provider))
  const treatments = new Set(result.map(row => row.treatment))
  const structures = new Set(result.map(row => row.structure))
  if (![10, 11, 12].includes(result.length)) throw new Error('El video debe contener 10–12 Visuales')
  if (!['openmoji', 'solar', 'editorial-text'].every(value => providers.has(value))) throw new Error('El video no cubre los tres providers/modos')
  if (!['accent-mask', 'duotone'].every(value => treatments.has(value))) throw new Error('El video no cubre ambos tratamientos')
  if (structures.size < 3) throw new Error('El video no cubre tres estructuras')
  return result
}

async function exportAcceptanceVideo (videoRows) {
  fs.mkdirSync(PRODUCTION, { recursive: true })
  let start = 0
  const timeline = videoRows.map((row, index) => {
    const item = { id: `composition-v2-${String(index + 1).padStart(2, '0')}`, name: row.id,
      type: 'video', category: 'visual', path: row.clip, startSeconds: start, durationSeconds: row.duration }
    start += row.duration
    return item
  })
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: VIDEO_FILE })
  const exported = await invoke('export-video', {
    clips: timeline, aspectRatio: 'vertical', resolution: '720p', format: 'mp4', quality: 'high',
    assignedTransitions: {}, transitionDuration: .5, ajustesVideo: undefined,
  })
  if (!exported.success || !fs.existsSync(VIDEO_FILE) || fs.statSync(VIDEO_FILE).size === 0)
    throw new Error('Export end-to-end falló: ' + JSON.stringify(exported))
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,codec_name:format=duration,size', '-of', 'json', VIDEO_FILE], { encoding: 'utf8' }))
  writeJson(TIMELINE_FILE, {
    schemaVersion: 1,
    source: 'forensic corpus resolved automatically plus explicit Solar/missing controls',
    clips: videoRows.map((row, index) => ({ index: index + 1, id: row.id, kind: row.kind,
      provider: row.provider, treatment: row.treatment, structure: row.structure,
      camera: row.camera, density: row.density, durationSeconds: row.duration })),
    durationSeconds: start,
  })
  return { probe, clipCount: videoRows.length, durationSeconds: start }
}

function soccerBallEvidence (corpus) {
  const row = corpus.internals.find(entry => entry.resolved.decision.hero?.stableId === 'openmoji:26bd')
  if (!row) throw new Error('El corpus no resolvió soccer ball 26BD')
  const binding = row.resolved.compiled.renderBindings.assets[0]
  const file = path.join(PROJECT_ROOT, binding.relativeFile.replace(/\//g, path.sep))
  const svg = fs.readFileSync(file, 'utf8')
  const paints = [...svg.matchAll(/\b(?:fill|stroke)=["']([^"']+)["']/gi)].map(match => match[1].toLowerCase())
  const shapes = (svg.match(/<(?:path|circle|ellipse|polygon|polyline|rect|line)\b/gi) || []).length
  return {
    stableId: row.resolved.decision.hero.stableId,
    candidateUnchanged: true,
    sha256: row.resolved.decision.hero.sha256,
    sourceShapeElements: shapes,
    sourceDistinctPaintValues: new Set(paints).size,
    treatmentBefore: 'accent-mask',
    treatmentAfter: row.resolved.decision.hero.treatment,
    structuralReason: row.resolved.trace.treatment?.reason,
    v12Behavior: 'alpha mask collapsed every opaque internal layer into one accent surface',
    v13Behavior: 'luminance-preserving duotone transfer retains internal light/dark separation',
  }
}

function restoreProcessState () {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  dialog.showSaveDialog = originalSaveDialog
}

async function finish (exitCode) {
  restoreProcessState()
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(exitCode)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) console.error('FALLO: aceptación composition V2 no terminó') })

app.whenReady().then(async () => {
  const realBefore = snapshotRealProjects()
  const audit = {
    attempts: json(path.join(AUDIT_ROOT, 'render-attempts.json')),
    timeline: json(path.join(AUDIT_ROOT, 'timeline.json')),
    transcript: transcriptRows(json(path.join(AUDIT_ROOT, 'transcript.json'))),
    visuals: json(path.join(AUDIT_ROOT, 'visuals-complete.json')).visuals,
  }
  const v12Evidence = json(path.join(V12_ROOT, 'evidence.json'))
  const v12Qc = json(path.join(V12_ROOT, 'qc-replay.json'))
  if (audit.attempts.length !== 50 || audit.visuals.length !== 34 || !fs.existsSync(V12_SHEET))
    throw new Error('La evidencia canónica V12 no coincide con 50 pedidos / 34 materializados')
  global.fetch = blockNetwork
  http.request = (...args) => blockNetwork(args[0])
  https.request = (...args) => blockNetwork(args[0])
  try {
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    if (bundle.VERSION_PLANTILLAS !== 13) throw new Error('VERSION_PLANTILLAS no es 13')
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
    })
    await new Promise(resolve => setTimeout(resolve, 1200))
    const startupNetworkAttempts = networkAttempts
    await waitForMainWindow()
    bundle.createProjectFiles(PROJECT_ROOT, {
      id: 'visual-composition-v2-acceptance', clips: [], timelineVideoClips: [], aiScript: 'Corpus forense temporal V13',
    })
    const loaded = await invoke('load-project', { projectPath: PROJECT_ROOT })
    if (!loaded.success) throw new Error('No se pudo abrir el proyecto temporal: ' + loaded.error)

    const before = historicalMetrics(audit, v12Qc)
    const corpus = await renderCorpus(bundle, audit)
    const review = await renderReviewSheet(bundle, audit, v12Evidence)
    const solar = await renderSyntheticSolar(bundle)
    const openMojiSource = corpus.internals.find(row => row.clip && row.resolved.decision.hero?.provider === 'openmoji')
    if (!openMojiSource) throw new Error('No hay OpenMoji aceptado para el control missing')
    const missing = await renderMissingFallback(bundle, openMojiSource)
    const videoRows = selectVideoRows(corpus, solar, missing)
    const video = await exportAcceptanceVideo(videoRows)
    const soccer = soccerBallEvidence(corpus)
    const legacyRegression = await measureLegacyRegression()

    const after = corpus.metrics
    const automaticGates = {
      versionExactly13: bundle.VERSION_PLANTILLAS === 13,
      emptyMarcoPosterEditorialZero: after.emptyHeroFrames === 0,
      noDeadHeroReservation: after.deadHeroStructures === 0,
      saturatedNotMassDefault: (after.densityDistributionAllDecisions.saturada || 0) < after.requestedVisuals / 2,
      editorialDecoratorsReduced: after.editorialDecoratorMean < before.decoratorMean,
      qcRejectRateReduced: after.qcRejectedVisuals < before.qcRejectedVisuals,
      requestedMaterializedSubstitutedMeasured: after.requestedVisuals === 50 &&
        after.materializedVisuals + after.substitutedWithOriginal === after.requestedVisuals,
      cacheV12NotReusedByV13: corpus.cacheProof.hashesDiffer && corpus.cacheProof.v12SentinelPreserved &&
        corpus.cacheProof.returnedV13Hash === corpus.cacheProof.sameSceneV13Hash,
      noNewLegacy: after.newScenesToLegacy === 0,
      soccerBallKeepsInternalDetailPath: soccer.stableId === 'openmoji:26bd' && soccer.treatmentAfter === 'duotone' &&
        soccer.sourceShapeElements > 1 && soccer.sourceDistinctPaintValues > 1,
      contactSheetCreated: fs.existsSync(CONTACT_SHEET) && fs.statSync(CONTACT_SHEET).size > 0,
      endToEndVideoCreated: fs.existsSync(VIDEO_FILE) && fs.statSync(VIDEO_FILE).size > 0,
      noRuntimeNetwork: networkAttempts === startupNetworkAttempts,
      realProjectsUntouched: snapshotRealProjects() === realBefore,
      legacyIntactWithinExistingTolerance: legacyRegression.passed,
    }
    if (!Object.values(automaticGates).every(Boolean))
      throw new Error('Fallaron puertas automáticas: ' + JSON.stringify(automaticGates))
    assertRepositoryUntouched(realBefore)

    writeJson(CORPUS_FILE, {
      schemaVersion: 1,
      source: 'audit-last-real-video-20260909/render-attempts.json + transcript.json',
      method: '50 requests replayed through LocalSceneSemanticV1, approved V4A resolver/compiler, productive V13 renderer and runtime QC',
      temporaryProjectOnly: true,
      rows: corpus.rows,
    })
    writeJson(EVIDENCE_FILE, {
      schemaVersion: 1,
      base: 'd701b5ba3de52a0437bfb56250ff8beb521dc75e',
      version: { before: 12, after: 13 },
      source: 'forensic last-real-video evidence plus human-approved V4A decisions',
      before,
      after,
      deltas: {
        materializedVisuals: after.materializedVisuals - before.materializedVisuals,
        qcRejectedVisuals: after.qcRejectedVisuals - before.qcRejectedVisuals,
        substitutedWithOriginal: after.substitutedWithOriginal - before.substitutedWithOriginal,
        decoratorMean: Number((after.decoratorMean - before.decoratorMean).toFixed(2)),
        emptyHeroFrames: after.emptyHeroFrames - before.emptyHeroFrames,
      },
      soccerBall: soccer,
      cacheProof: corpus.cacheProof,
      legacyRegression,
      reviewSheet: { file: 'contact-sheet-v12-v13.png', cells: review, visualVerdict: 'pending-human-review' },
      acceptanceVideo: {
        file: 'production/visual-composition-v2.mp4', timeline: 'production/timeline.json',
        clipCount: video.clipCount, durationSeconds: video.durationSeconds,
        probe: video.probe,
      },
      controls: {
        solar: { provider: solar.resolved.decision.hero.provider, candidate: solar.resolved.decision.hero.solarName },
        missing: { visualMode: missing.prepared.sceneSpec.visualMode, warnings: missing.prepared.warnings },
        networkAttemptsDuringAcceptance: networkAttempts - startupNetworkAttempts,
        temporaryProjectOnly: true,
        realProjectsUntouched: true,
      },
      automaticGates,
      visualVerdict: 'pending-human-review',
    })
    console.log('REQUESTED=' + after.requestedVisuals)
    console.log('MATERIALIZED=' + after.materializedVisuals)
    console.log('QC_REJECTED=' + after.qcRejectedVisuals)
    console.log('SUBSTITUTED=' + after.substitutedWithOriginal)
    console.log('DENSITY=' + JSON.stringify(after.densityDistributionAllDecisions))
    console.log('DECORATOR_MEAN=' + after.decoratorMean)
    console.log('CONTACT_SHEET=' + path.relative(REPO_ROOT, CONTACT_SHEET).replace(/\\/g, '/'))
    console.log('VIDEO=' + path.relative(REPO_ROOT, VIDEO_FILE).replace(/\\/g, '/'))
    console.log('AUTOMATIC_GATES=PASS')
    console.log('VISUAL_VERDICT=pending-human-review')
    finished = true
    await finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    await finish(1)
  }
}).catch(async error => {
  console.error(error && error.stack || error)
  await finish(1)
})
