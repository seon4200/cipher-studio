const { app, BrowserWindow, ipcMain, nativeImage, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const { auditTypographyLookFonts } = require('../../helpers/visual-font-audit')
const { loadForensicVisualAudit, resolveAttempt } = require('../helpers/forensic-visual-corpus.cjs')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const BASELINE_FILE = path.join(REPO_ROOT, 'tests', 'aceptacion', 'visual-variety-v1', 'baseline-v13.json')
const V13_CORPUS_FILE = path.join(REPO_ROOT, 'tests', 'aceptacion', 'visual-composition-v2', 'corpus-50.json')
const LEGACY_BASELINE = path.join(REPO_ROOT, 'tests', 'aceptacion', 'visual-asset-mvp', 'legacy-baseline-b735.png')
const EVIDENCE_FILE = path.join(OUTPUT, 'evidence.json')
const CORPUS_FILE = path.join(OUTPUT, 'corpus-50-v14.json')
const FAMILY_FILE = path.join(OUTPUT, 'family-matrix.md')
const FONT_FILE = path.join(OUTPUT, 'font-audit.md')
const SUMMARY_FILE = path.join(OUTPUT, 'README.md')
const COVERAGE_SHEET = path.join(OUTPUT, 'layout-coverage.png')
const SEQUENCE_SHEET = path.join(OUTPUT, 'sequence-sheet.png')
const AB_SHEET = path.join(OUTPUT, 'ab-v13-v14.png')
const FIXTURE_ROOT = createTestFixture('visual-layout-typography-v3-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const WIDTH = 540
const HEIGHT = 960
const FPS = 8
const REVIEW = [
  ['construir', 1], ['partidos', 5], ['fútbol', 25], ['estando', 32],
  ['iglesia', 74], ['religioso', 76], ['accidente', 37], ['indignación', 27],
]
let networkAttempts = 0
let finished = false
let bundle = null
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const json = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
const counts = values => Object.fromEntries([...values.reduce((map, value) =>
  map.set(value, (map.get(value) || 0) + 1), new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))))
const percentile = (values, fraction) => {
  const ordered = values.slice().sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))] ?? null
}

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
  if (fs.existsSync(path.join(REPO_ROOT, 'project-state.json')) || fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')))
    throw new Error('Apareció estado de proyecto en la raíz')
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
  networkAttempts += 1
  throw new Error('RED BLOQUEADA EN ACCEPTANCE V14: ' + String(value || 'request'))
}

function qcCodes (report, level) {
  return (report?.findings || []).filter(finding => !level || finding.level === level).map(finding => finding.code)
}

function providerFor (entry) {
  return entry.resolved.decision.hero?.provider || 'editorial-text'
}

function candidateFor (entry) {
  return entry.resolved.decision.hero?.stableId || entry.resolved.decision.hero?.solarName || null
}

function treatmentFor (spec) {
  return spec.slots.find(slot => slot.role === 'hero')?.tint?.treatment || 'none'
}

function v13VarietyObservation (row) {
  const heroState = row.provider === 'openmoji' ? 'present' : row.provider === 'solar' ? 'procedural' : null
  return {
    materialized: row.rendered === true,
    sceneSpec: {
      visualMode: row.visualMode,
      direccion: { estructura: row.structure },
      text: { fontPairId: row.structure === 'editorial' ? 'editorial-black' : 'technical-black',
        alignment: row.structure === 'editorial' ? 'left' : 'center' },
      slots: heroState ? [{ role: 'hero', state: heroState }] : [],
    },
  }
}

function compactRow (entry) {
  const spec = entry.resolved.compiled.sceneSpec
  const layout = bundle.effectiveSceneLayoutGeometry(spec)
  return {
    index: entry.attempt.index,
    pos: entry.attempt.pos,
    sceneId: entry.resolved.decision.sceneId,
    localText: entry.localSemantic.localText,
    keyword: entry.resolved.keywordSelection.keyword,
    provider: providerFor(entry),
    candidate: candidateFor(entry),
    treatment: treatmentFor(spec),
    visualMode: entry.resolved.decision.visualMode,
    structure: spec.direccion.estructura,
    layoutFamily: layout.family,
    heroPlacement: layout.heroPlacement,
    heroEnvelope: layout.heroEnvelope,
    textRegion: layout.textRegion,
    typographyLookId: spec.text.typographyLookId,
    keywordFamily: bundle.typographyLookForSceneSpec(spec)?.keywordFamily || null,
    background: spec.direccion.fondo,
    camera: spec.direccion.camara,
    density: spec.direccion.densidad,
    rhythm: spec.direccion.ritmo,
    qc: entry.clip ? 'accepted' : entry.report ? 'rejected' : 'render-failed',
    qcErrorCodes: qcCodes(entry.report, 'error'),
    qcNeedsReviewCodes: qcCodes(entry.report, 'needs-review'),
    rendered: Boolean(entry.clip),
    duration: entry.duration,
  }
}

function assertSemanticsFrozen (entries, baselineRows) {
  const differences = []
  for (const entry of entries) {
    const previous = baselineRows.find(row => row.pos === entry.attempt.pos)
    if (!previous) {
      differences.push({ pos: entry.attempt.pos, field: 'baseline', before: null, after: 'present' })
      continue
    }
    const spec = entry.resolved.compiled.sceneSpec
    for (const [field, before, after] of [
      ['keyword', previous.keywordAfter, entry.resolved.keywordSelection.keyword],
      ['provider', previous.provider, providerFor(entry)],
      ['candidate', previous.candidate, candidateFor(entry)],
      ['treatment', previous.treatment, treatmentFor(spec)],
      ['background', previous.background, spec.direccion.fondo],
    ]) if (before !== after) differences.push({ pos: entry.attempt.pos, field, before, after })
  }
  return differences
}

async function renderCorpus (audit, baselineRows) {
  const resolverSession = bundle.createResolverSessionV1()
  const entries = audit.attempts.map((attempt, index) =>
    resolveAttempt(bundle, audit, attempt, index, resolverSession, PROJECT_ROOT, 'v14'))
  const semanticDifferences = assertSemanticsFrozen(entries, baselineRows)
  const renderMetrics = []
  const removeObserver = bundle.observarRendimientoGraficos(metric => renderMetrics.push(metric))
  const firstDuration = Math.max(1, Math.min(2.4, entries[0].localSemantic.end - entries[0].localSemantic.start))
  const hash13 = bundle.hashGraficoConVersionPlantillas(entries[0].resolved.compiled.graphicData,
    WIDTH, HEIGHT, firstDuration, FPS, 'pantalla', 'editorial', 13)
  const hash14 = bundle.hashGraficoConVersionPlantillas(entries[0].resolved.compiled.graphicData,
    WIDTH, HEIGHT, firstDuration, FPS, 'pantalla', 'editorial', 14)
  if (hash13 === hash14) throw new Error('V13 y V14 produjeron el mismo hash')
  const sentinelDir = path.join(PROJECT_ROOT, 'materiales', 'visual')
  fs.mkdirSync(sentinelDir, { recursive: true })
  const sentinel = path.join(sentinelDir, hash13 + '.mp4')
  fs.writeFileSync(sentinel, 'V13-CACHE-SENTINEL', { flag: 'wx' })
  try {
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]
      const duration = Math.max(1, Math.min(2.4, entry.localSemantic.end - entry.localSemantic.start))
      let report = null
      const clip = await bundle.renderGraphicClip(entry.resolved.compiled.graphicData, {
        ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: duration, modo: 'pantalla',
        projectRoot: PROJECT_ROOT, renderBindings: entry.resolved.compiled.renderBindings,
        onQcReport: value => { report = value }, onQcFailure: value => { report = value },
      })
      entry.duration = duration
      entry.report = report
      entry.clip = clip
      if (index === 0 && clip && path.basename(clip, '.mp4') !== hash14)
        throw new Error('El primer render no usó el hash V14 esperado')
    }
  } finally {
    removeObserver()
  }
  if (fs.readFileSync(sentinel, 'utf8') !== 'V13-CACHE-SENTINEL') throw new Error('La caché V13 fue tocada')
  const rows = entries.map(compactRow)
  const observations = entries.map(entry => ({
    materialized: Boolean(entry.clip), sceneSpec: entry.resolved.compiled.sceneSpec,
  }))
  const variety = bundle.measureVisualVarietyV1(observations)
  const msPerFrame = renderMetrics.map(metric => metric.ms / metric.totalFrames)
  return {
    entries, rows, variety, semanticDifferences,
    cacheProof: { versionBefore: 13, versionAfter: 14, sameSceneV13Hash: hash13,
      sameSceneV14Hash: hash14, hashesDiffer: hash13 !== hash14,
      returnedV14Hash: entries[0].clip ? path.basename(entries[0].clip, '.mp4') : null,
      v13SentinelPreserved: true },
    performance: { measuredRenders: renderMetrics.length,
      totalRenderMs: renderMetrics.reduce((sum, metric) => sum + metric.ms, 0),
      medianMsPerFrame: percentile(msPerFrame, .5), p95MsPerFrame: percentile(msPerFrame, .95) },
  }
}

function sanitizeLabel (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _|/.+%=-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function frameFromVideo (video, output, seekSeconds = .65) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seekSeconds), '-i', video,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:${HEIGHT}`, output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function placeholder (output, message) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', `color=c=0x202020:s=${WIDTH}x${HEIGHT}:d=.1`, '-vf',
    `drawtext=fontfile='${font}':text='${sanitizeLabel(message).slice(0, 42)}':fontcolor=white:fontsize=24:x=28:y=450`,
    '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
}

function labelFrame (input, output, lines, width, height, header = 104) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const filters = [`scale=${width}:${height}`, `pad=${width}:${height + header}:0:${header}:black`]
  lines.slice(0, 3).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${sanitizeLabel(line).slice(0, 72)}':fontcolor=white:fontsize=${width >= 500 ? 17 : 13}:x=10:y=${8 + index * (width >= 500 ? 29 : 25)}`))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', filters.join(','), '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function makeSheet (frames, output, columns, cellWidth, cellHeight) {
  const inputs = frames.flatMap(file => ['-i', file])
  const layout = frames.map((_, index) => `${(index % columns) * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', `xstack=inputs=${frames.length}:layout=${layout}:fill=black`, '-frames:v', '1', output],
  { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}

function rawFrameFor (entry, name) {
  const output = path.join(FRAME_ROOT, name + '-raw.png')
  if (entry.clip) frameFromVideo(entry.clip, output, Math.min(.65, entry.duration * .5))
  else placeholder(output, 'QC ' + qcCodes(entry.report, 'error').join('+'))
  return output
}

function renderCoverageSheet (corpus) {
  const frames = []
  const rows = []
  for (const family of bundle.LAYOUT_FAMILIES_V3) {
    const entry = corpus.entries.find(candidate => candidate.clip &&
      candidate.resolved.compiled.sceneSpec.layout?.family === family)
    if (!entry) continue
    const row = compactRow(entry)
    const raw = rawFrameFor(entry, 'coverage-' + family)
    const labelled = path.join(FRAME_ROOT, 'coverage-' + family + '.png')
    const envelope = row.heroEnvelope
      ? `${row.heroEnvelope.x},${row.heroEnvelope.y} ${row.heroEnvelope.width}x${row.heroEnvelope.height}` : 'none'
    labelFrame(raw, labelled, [
      `${row.layoutFamily} | ${row.heroPlacement} | ${row.textRegion}`,
      `Hero ${envelope} | ${row.typographyLookId}`,
      `${row.keywordFamily} | ${row.background} | QC ${row.qc}`,
    ], 540, 960)
    frames.push(labelled)
    rows.push(row)
  }
  if (frames.length) makeSheet(frames, COVERAGE_SHEET, 4, 540, 1064)
  return rows
}

function renderSequenceSheet (corpus) {
  const frames = []
  const rows = corpus.entries.slice(0, 25).map((entry, index) => {
    const row = compactRow(entry)
    const raw = rawFrameFor(entry, `sequence-${String(index + 1).padStart(2, '0')}`)
    const labelled = path.join(FRAME_ROOT, `sequence-${String(index + 1).padStart(2, '0')}.png`)
    labelFrame(raw, labelled, [
      `${index + 1} ${row.keyword} | ${row.provider}`,
      `${row.layoutFamily} | ${row.heroPlacement} | ${row.textRegion}`,
      `${row.typographyLookId} | QC ${row.qc}`,
    ], 360, 640, 90)
    frames.push(labelled)
    return row
  })
  makeSheet(frames, SEQUENCE_SHEET, 5, 360, 730)
  return rows
}

function v13SpecFor (entry, previous) {
  const current = entry.resolved.compiled.sceneSpec
  const text = { ...current.text,
    alignment: previous.structure === 'editorial' ? 'left' : 'center',
    fontPairId: previous.structure === 'editorial' ? 'editorial-black' : 'technical-black' }
  delete text.typographyLookId
  const raw = { ...current,
    direccion: { ...current.direccion, estructura: previous.structure },
    text,
    revisions: bundle.visualCompositionV2Revisions() }
  delete raw.layout
  return bundle.validateVisualSceneSpec(raw)
}

async function renderAbSheet (corpus, baselineRows) {
  const frames = []
  const rows = []
  for (let order = 0; order < REVIEW.length; order++) {
    const [label, forensicIndex] = REVIEW[order]
    const entry = corpus.entries.find(candidate => candidate.attempt.index === forensicIndex)
    const previous = baselineRows.find(row => row.index === forensicIndex)
    if (!entry || !previous) throw new Error('Escena ausente para A/B: ' + label)
    const v13Spec = v13SpecFor(entry, previous)
    const graphic = { ...entry.resolved.compiled.graphicData,
      extra: { ...entry.resolved.compiled.graphicData.extra, sceneSpec: v13Spec } }
    let v13Report = null
    const v13Clip = await bundle.renderGraphicClip(graphic, {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: entry.duration, modo: 'pantalla',
      projectRoot: PROJECT_ROOT, renderBindings: entry.resolved.compiled.renderBindings,
      onQcReport: value => { v13Report = value }, onQcFailure: value => { v13Report = value },
    })
    const v13Raw = path.join(FRAME_ROOT, `ab-${order}-v13-raw.png`)
    if (v13Clip) frameFromVideo(v13Clip, v13Raw, Math.min(.65, entry.duration * .5))
    else placeholder(v13Raw, 'V13 QC ' + qcCodes(v13Report, 'error').join('+'))
    const v13Labelled = path.join(FRAME_ROOT, `ab-${order}-v13.png`)
    const oldGeometry = bundle.effectiveSceneLayoutGeometry(v13Spec)
    labelFrame(v13Raw, v13Labelled, [
      `V13 ${label} | ${previous.provider} | ${previous.candidate || 'sin Hero'}`,
      `${previous.structure} | ${oldGeometry.heroPlacement} | ${oldGeometry.textRegion}`,
      `Archivo Black | QC ${v13Clip ? 'accepted' : qcCodes(v13Report, 'error').join('+')}`,
    ], 360, 640, 90)
    const current = compactRow(entry)
    const v14Raw = rawFrameFor(entry, `ab-${order}-v14`)
    const v14Labelled = path.join(FRAME_ROOT, `ab-${order}-v14.png`)
    labelFrame(v14Raw, v14Labelled, [
      `V14 ${label} | ${current.provider} | ${current.candidate || 'sin Hero'}`,
      `${current.layoutFamily} | ${current.heroPlacement} | ${current.textRegion}`,
      `${current.keywordFamily} | QC ${current.qc}`,
    ], 360, 640, 90)
    frames.push(v13Labelled, v14Labelled)
    rows.push({ label, forensicIndex,
      frozen: { keyword: current.keyword, provider: current.provider, candidate: current.candidate,
        treatment: current.treatment, background: current.background },
      v13: { structure: previous.structure, heroPlacement: oldGeometry.heroPlacement,
        textRegion: oldGeometry.textRegion, keywordFamily: 'Archivo Black', qc: v13Clip ? 'accepted' : 'rejected' },
      v14: { structure: current.structure, layoutFamily: current.layoutFamily,
        heroPlacement: current.heroPlacement, textRegion: current.textRegion,
        typographyLookId: current.typographyLookId, keywordFamily: current.keywordFamily, qc: current.qc },
    })
  }
  makeSheet(frames, AB_SHEET, 4, 360, 730)
  return rows
}

function comparePngsWithTolerance (currentImage, expectedFile) {
  const expectedImage = nativeImage.createFromPath(expectedFile)
  const currentSize = currentImage.getSize()
  const expectedSize = expectedImage.getSize()
  if (currentSize.width !== expectedSize.width || currentSize.height !== expectedSize.height)
    throw new Error(`Regresión legacy: ${currentSize.width}x${currentSize.height} != ${expectedSize.width}x${expectedSize.height}`)
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
  return { width: currentSize.width, height: currentSize.height,
    differentPixelRatio: differentPixels / pixels,
    meanAbsoluteChannelDelta: absoluteChannelDelta / (pixels * 3) }
}

async function measureLegacyRegression () {
  const legacyGraphic = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [
    { emoji: '🧠', etiqueta: 'recuerdo' }, { emoji: '🗂️', etiqueta: 'archivo' },
    { emoji: '🔗', etiqueta: 'conexion' }],
    direccion: { fondo: 'ondas', estructura: 'constelacion', camara: 'quieto', densidad: 'media',
      ritmo: 'simultaneo', tipografia: 'archivo' } } }
  const window = new BrowserWindow({ show: false, width: 1080, height: 1928, useContentSize: true,
    frame: false, enableLargerThanScreen: true, transparent: true, backgroundColor: '#00000000',
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false } })
  try {
    await window.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))
    window.setContentSize(1080, 1928)
    const ready = await window.webContents.executeJavaScript('window.__listo()')
    if (ready.avisosFuentes.length) throw new Error('Fuentes legacy no listas: ' + JSON.stringify(ready.avisosFuentes))
    await window.webContents.executeJavaScript(
      `window.__montar(${JSON.stringify(legacyGraphic)},${JSON.stringify({ ancho: 1080, alto: 1920,
        modo: 'pantalla', duracion: 3, sistema: 'voltaje' })});window.__setT(1.5)`)
    await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>new Promise(r=>setTimeout(r,200)))')
    const image = await window.webContents.capturePage({ x: 0, y: 8, width: 1080, height: 1920 })
    const comparison = comparePngsWithTolerance(image, LEGACY_BASELINE)
    return { baseline: 'tests/aceptacion/visual-asset-mvp/legacy-baseline-b735.png',
      thresholds: { differentPixelRatioMax: .03, meanAbsoluteChannelDeltaMax: 2 }, ...comparison,
      passed: comparison.differentPixelRatio <= .03 && comparison.meanAbsoluteChannelDelta <= 2 }
  } finally { window.destroy() }
}

function writeReports (evidence, fontAudit) {
  const familyLines = ['# Matriz de familias históricas — V14', '',
    '| Estructura | Estado | Certificada | Razón |', '| --- | --- | --- | --- |']
  for (const [id, assessment] of Object.entries(bundle.HISTORICAL_LAYOUT_MATRIX_V3))
    familyLines.push(`| ${id} | ${assessment.status} | ${assessment.certified ? 'sí' : 'no'} | ${assessment.reason} |`)
  familyLines.push('')
  fs.writeFileSync(FAMILY_FILE, familyLines.join('\n'), 'utf8')

  const fontLines = ['# Auditoría física de fuentes — V14', '',
    '| Familia | Archivo | Peso físico/rango | Peso solicitado | Síntesis | Certificable |',
    '| --- | --- | --- | ---: | --- | --- |']
  for (const row of fontAudit) {
    const physical = row.physical?.weightRange
      ? `${row.physical.weightRange.min}–${row.physical.weightRange.max} (default ${row.physical.weightRange.default})`
      : String(row.physical?.os2Weight ?? 'ausente')
    fontLines.push(`| ${row.family} | ${row.file || '—'} | ${physical} | ${row.requestedWeight} | ${row.synthesisRequired ? 'sí' : 'no'} | ${row.certificable ? 'sí' : 'no'} |`)
  }
  fontLines.push('')
  fs.writeFileSync(FONT_FILE, fontLines.join('\n'), 'utf8')

  const before = evidence.variety.before
  const after = evidence.variety.after
  const summary = [
    '# Recuperación de familias, geometría Hero y tipografía — evidencia V14', '',
    'Corpus: los mismos 50 pedidos Visuales usados por la línea base oficial V13.', '',
    '| Métrica | V13 | V14 |', '| --- | ---: | ---: |',
    `| distinctStructures | ${before.distinctStructures} | ${after.distinctStructures} |`,
    `| dominantStructureShare | ${before.dominantStructureShare}% | ${after.dominantStructureShare}% |`,
    `| distinctHeroPlacements | ${before.distinctHeroPlacements} | ${after.distinctHeroPlacements} |`,
    `| distinctKeywordTypefaces | ${before.distinctKeywordTypefaces} | ${after.distinctKeywordTypefaces} |`,
    `| consecutiveSameStructure | ${before.consecutiveSameStructure} | ${after.consecutiveSameStructure} |`,
    `| consecutiveSameHeroPlacement | ${before.consecutiveSameHeroPlacement} | ${after.consecutiveSameHeroPlacement} |`,
    `| consecutiveSameKeywordTypeface | ${before.consecutiveSameKeywordTypeface} | ${after.consecutiveSameKeywordTypeface} |`, '',
    `Visuales materializados: ${after.materializedVisuals}/50.`,
    `QC rechazados: ${evidence.qc.rejected}.`,
    `Regresión legacy: ${evidence.legacyRegression.passed ? 'dentro de tolerancia' : 'fuera de tolerancia'}.`, '',
    'La evidencia no constituye aprobación estética. visualVerdict = pending-human-review.', '',
  ]
  fs.writeFileSync(SUMMARY_FILE, summary.join('\n'), 'utf8')
}

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) console.error('FALLO: aceptación layout/typography V3 no terminó') })

app.whenReady().then(async () => {
  const projectsBefore = snapshotRealProjects()
  fs.mkdirSync(FRAME_ROOT, { recursive: true })
  try {
    const audit = loadForensicVisualAudit(REPO_ROOT)
    const baseline = json(BASELINE_FILE)
    const v13Corpus = json(V13_CORPUS_FILE)
    const expectedBefore = { distinctStructures: 3, dominantStructureShare: 60,
      distinctHeroPlacements: 2, distinctKeywordTypefaces: 1 }
    for (const [field, expected] of Object.entries(expectedBefore)) {
      if (baseline.metric[field] !== expected) throw new Error(`BASELINE_V13_CHANGED:${field}:${baseline.metric[field]}`)
    }
    if (!Array.isArray(v13Corpus.rows) || v13Corpus.rows.length !== 50) throw new Error('V13_CORPUS_NOT_50')
    global.fetch = blockNetwork
    http.request = (...args) => blockNetwork(args[0])
    https.request = (...args) => blockNetwork(args[0])
    bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    if (bundle.VERSION_PLANTILLAS !== 14) throw new Error('VERSION_PLANTILLAS no es 14')
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttempts += 1; callback({ cancel: true }) } else callback({ cancel: false })
    })
    await new Promise(resolve => setTimeout(resolve, 1200))
    const startupNetworkBaseline = networkAttempts
    await waitForMainWindow()
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'layout-typography-v14', clips: [],
      timelineVideoClips: [], aiScript: 'Corpus forense temporal V14' })
    const loaded = await invoke('load-project', { projectPath: PROJECT_ROOT })
    if (!loaded.success) throw new Error('No se pudo abrir el proyecto temporal: ' + loaded.error)

    const beforeMetrics = bundle.measureVisualVarietyV1(v13Corpus.rows.map(v13VarietyObservation))
    for (const [field, expected] of Object.entries(expectedBefore)) {
      if (beforeMetrics[field] !== expected) throw new Error(`RECALCULATED_BASELINE_V13_CHANGED:${field}:${beforeMetrics[field]}`)
    }
    const corpus = await renderCorpus(audit, v13Corpus.rows)
    const coverage = renderCoverageSheet(corpus)
    const sequence = renderSequenceSheet(corpus)
    const comparison = await renderAbSheet(corpus, v13Corpus.rows)
    const legacyRegression = await measureLegacyRegression()
    const fontAudit = auditTypographyLookFonts(REPO_ROOT, bundle.TYPOGRAPHY_LOOKS_V3)
    const rejected = corpus.rows.filter(row => !row.rendered)
    const automaticGates = {
      versionExactly14: bundle.VERSION_PLANTILLAS === 14,
      sameOfficialCorpus50: corpus.rows.length === 50,
      all50Materialized: corpus.variety.materializedVisuals === 50,
      semanticsResourcesTreatmentsAndBackgroundsFrozen: corpus.semanticDifferences.length === 0,
      distinctStructuresAtLeast6: corpus.variety.distinctStructures >= 6,
      dominantStructureShareAtMost50: corpus.variety.dominantStructureShare <= 50,
      distinctHeroPlacementsAtLeast4: corpus.variety.distinctHeroPlacements >= 4,
      distinctKeywordTypefacesAtLeast4: corpus.variety.distinctKeywordTypefaces >= 4,
      atLeast5TypographyLooksMaterialized: Object.keys(counts(corpus.rows.map(row => row.typographyLookId))).length >= 5,
      all7CertifiedFamiliesCovered: coverage.length === bundle.LAYOUT_FAMILIES_V3.length,
      physicalFontWeightsCertified: fontAudit.every(row => row.certificable && !row.synthesisRequired),
      cacheV13NotReusedByV14: corpus.cacheProof.hashesDiffer && corpus.cacheProof.v13SentinelPreserved &&
        corpus.cacheProof.returnedV14Hash === corpus.cacheProof.sameSceneV14Hash,
      legacyIntactWithinExistingTolerance: legacyRegression.passed,
      sheetsCreated: [COVERAGE_SHEET, SEQUENCE_SHEET, AB_SHEET].every(file => fs.existsSync(file) && fs.statSync(file).size > 0),
      noRuntimeNetwork: networkAttempts === startupNetworkBaseline,
      realProjectsUntouched: snapshotRealProjects() === projectsBefore,
    }
    assertRepositoryUntouched(projectsBefore)
    const evidence = {
      schemaVersion: 1,
      base: 'a4e08db43746c17f3a408590f049173c9100c32b',
      branch: 'visual-layout-typography-v3',
      version: { before: 13, after: 14 },
      corpus: { source: 'tests/aceptacion/visual-composition-v2/corpus-50.json', requested: 50,
        materialized: corpus.variety.materializedVisuals },
      familyMatrix: bundle.HISTORICAL_LAYOUT_MATRIX_V3,
      certifiedFamilies: bundle.MODERN_LAYOUT_STRUCTURES_V3,
      typographyLooks: bundle.TYPOGRAPHY_LOOKS_V3,
      fontAudit,
      variety: { before: beforeMetrics, after: corpus.variety,
        distributions: { structures: corpus.variety.effectiveStructureDistribution,
          heroPlacements: corpus.variety.heroPlacementDistribution,
          keywordTypefaces: corpus.variety.keywordTypefaceDistribution,
          typographyLooks: counts(corpus.rows.map(row => row.typographyLookId)) } },
      semanticFreeze: { differences: corpus.semanticDifferences },
      qc: { accepted: corpus.rows.length - rejected.length, rejected: rejected.length,
        categories: counts(rejected.flatMap(row => row.qcErrorCodes)), rows: rejected },
      performance: corpus.performance,
      cacheProof: corpus.cacheProof,
      legacyRegression,
      coverage: { file: 'layout-coverage.png', rows: coverage },
      sequence: { file: 'sequence-sheet.png', rows: sequence },
      comparison: { file: 'ab-v13-v14.png', rows: comparison,
        controlled: ['provider', 'candidate', 'asset SHA', 'treatment', 'background', 'keyword', 'semantic input'] },
      automaticGates,
      visualVerdict: 'pending-human-review',
    }
    writeJson(CORPUS_FILE, { schemaVersion: 1, source: 'same 50 V13 requests resolved through V14', rows: corpus.rows })
    writeJson(EVIDENCE_FILE, evidence)
    writeReports(evidence, fontAudit)
    if (!Object.values(automaticGates).every(Boolean))
      throw new Error('Fallaron puertas automáticas: ' + JSON.stringify(automaticGates))
    console.log('VARIETY_V13=' + JSON.stringify(expectedBefore))
    console.log('VARIETY_V14=' + JSON.stringify(corpus.variety))
    console.log('QC_REJECTED=' + rejected.length)
    console.log('SEMANTIC_DIFFERENCES=' + corpus.semanticDifferences.length)
    console.log('COVERAGE_SHEET=' + path.relative(REPO_ROOT, COVERAGE_SHEET).replace(/\\/g, '/'))
    console.log('SEQUENCE_SHEET=' + path.relative(REPO_ROOT, SEQUENCE_SHEET).replace(/\\/g, '/'))
    console.log('AB_SHEET=' + path.relative(REPO_ROOT, AB_SHEET).replace(/\\/g, '/'))
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
