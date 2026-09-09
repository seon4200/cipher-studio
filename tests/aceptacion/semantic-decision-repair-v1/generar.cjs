// Ronda 4A acceptance: a temporary real-generation trace plus a bounded replay of the
// historical QC slots. It never opens, writes, or copies a real project.
const { app, BrowserWindow, ipcMain, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const AUDIT_ROOT = path.resolve(REPO_ROOT, '..', '..', '..', 'graphify', 'diagnostics', 'audit-last-real-video-20260909')
const OUTPUT = __dirname
const CONTACT_SHEET = path.join(OUTPUT, 'contact-sheet-before-after.png')
const EVIDENCE_FILE = path.join(OUTPUT, 'evidence.json')
const QC_REPLAY_FILE = path.join(OUTPUT, 'qc-replay.json')
const FIXTURE_ROOT = createTestFixture('semantic-decision-acceptance')
const TRACE_PROJECT = path.join(FIXTURE_ROOT, 'trace-project')
const REPLAY_PROJECT = path.join(FIXTURE_ROOT, 'replay-project')
const FRAME_DIR = path.join(FIXTURE_ROOT, 'frames')
const WIDTH = 540
const HEIGHT = 960
const FPS = 10
const DURATION = 1.4
const FAILURE_POSITIONS = new Set([
  '0:2', '2:0', '2:1', '4:1', '11:1', '11:2', '14:4', '15:0',
  '15:2', '16:1', '16:2', '17:1', '18:0', '19:2', '21:0', '23:1',
])
const REVIEW_KEYWORDS = ['construir', 'partidos', 'fútbol', 'estando', 'iglesia', 'religioso', 'accidente', 'indignación']
let networkAttempts = 0
let deepSeekMockCalls = 0
let finished = false
let originalFetch = global.fetch
let originalHttpRequest = http.request
let originalHttpsRequest = https.request

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')

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
  if (fs.existsSync(path.join(REPO_ROOT, '.cipher-test-fixture'))) throw new Error('Apareció fixture dentro del repositorio')
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
      if (++attempts > 100) return reject(new Error('Ventana principal no disponible'))
      setTimeout(poll, 100)
    }
    poll()
  })
}

function blockedNetwork (url) {
  networkAttempts++
  throw new Error('RED BLOQUEADA: ' + String(url || 'request'))
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

function rangeForAttempt (attempt, transcript) {
  const words = transcript.flatMap(segment => Array.isArray(segment.words) ? segment.words : [])
  const phraseWords = String(attempt.phrase || '').toLocaleLowerCase('es').split(/\s+/).filter(Boolean)
  const first = phraseWords[0]
  const candidate = words.find(word => String(word.word || word.text || '').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '') === first?.replace(/[^\p{L}\p{N}]/gu, ''))
  const start = typeof candidate?.start === 'number' ? candidate.start : 0
  return { start, end: start + Math.max(1.5, Math.min(3, String(attempt.keyword || '').length / 4 + 1.5)) }
}

function directionFor (index) {
  const rows = [
    { fondo: 'tramaTejida', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo' },
    { fondo: 'circuito', camara: 'deriva', densidad: 'baja', ritmo: 'frenando' },
    { fondo: 'cristales', camara: 'acercamiento', densidad: 'alta', ritmo: 'acelerando' },
  ]
  return { ...rows[index % rows.length], semilla: 940000 + index }
}

function frameFromVideo (video, output, seekSeconds = .7) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seekSeconds), '-i', video,
    '-frames:v', '1', '-vf', 'scale=360:640', output], { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
}

function makePlaceholder (output, label) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const safe = String(label).replace(/[:'\\]/g, ' ')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x202020:s=360x640:d=0.1',
    '-vf', `drawtext=fontfile='${font}':text='${safe}':fontcolor=white:fontsize=22:x=20:y=300`, '-frames:v', '1', output],
    { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
}

function tileSheet (frames, output) {
  if (frames.length !== 16) throw new Error('La hoja requiere exactamente 16 celdas')
  const inputs = frames.flatMap(file => ['-i', file])
  const layout = Array.from({ length: 16 }, (_, index) => `${(index % 4) * 360}_${Math.floor(index / 4) * 640}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', `xstack=inputs=16:layout=${layout}:fill=black`, '-frames:v', '1', output],
    { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function makeSourceVideo () {
  const file = path.join(FIXTURE_ROOT, 'source.mp4')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=540x960:r=10:d=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file], { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
  return file
}

function deepSeekFixtureResponse () {
  return {
    phrases: [{
      phraseIndex: 1,
      visualClips: [{
        keyword: 'fútbol', timestamp: .1, duration: 2.6, prompt: 'soccer ball',
        conceptos: [
          { icono: 'star', ic: '⚽', etiqueta: 'fútbol' },
          { icono: 'flag', ic: '🚩', etiqueta: 'protesta' },
          { icono: 'users-group-rounded', ic: '👥', etiqueta: 'afición' },
        ],
        semantica: {
          relacion: 'conecta',
          ancla: { icono: 'star', ic: '⚽', etiqueta: 'fútbol' },
          terminos: [
            { icono: 'star', ic: '⚽', etiqueta: 'fútbol' },
            { icono: 'flag', ic: '🚩', etiqueta: 'protesta' },
            { icono: 'users-group-rounded', ic: '👥', etiqueta: 'afición' },
          ],
        },
      }],
    }],
  }
}

async function runRealGeneration (bundle) {
  const sourceVideo = makeSourceVideo()
  bundle.createProjectFiles(TRACE_PROJECT, {
    id: 'semantic-decision-trace-project', clips: [], timelineVideoClips: [],
    aiScript: 'Fixture temporal de traza semántica local',
  })
  const loaded = await invoke('load-project', { projectPath: TRACE_PROJECT })
  if (!loaded.success) throw new Error('No se pudo abrir el proyecto temporal de traza: ' + loaded.error)
  process.env.DEEPSEEK_API_KEY = 'fixture-no-network'
  const segment = {
    start: 0, end: 2.6, text: 'El fútbol tiene ese poder.',
    words: [
      { word: 'El', start: 0, end: .2, probability: .99 },
      { word: 'fútbol', start: .2, end: .9, probability: .99 },
      { word: 'tiene', start: .9, end: 1.25, probability: .99 },
      { word: 'ese', start: 1.25, end: 1.5, probability: .99 },
      { word: 'poder.', start: 1.5, end: 2.1, probability: .99 },
    ],
  }
  const generated = await invoke('generate-timeline-assets', {
    scriptText: segment.text, audioDuration: 2.6, transcriptSegments: [segment],
    videoPath: sourceVideo, weights: [0, 0, 0, 100], iaStyle: 'cinematic',
    aspectRatio: '9:16', graphicsPercent: 100, newAudioSegments: [segment],
  })
  if (!generated.success) throw new Error('La generación temporal falló: ' + generated.error)
  const diagnosticDir = path.join(TRACE_PROJECT, 'materiales', 'diagnostics', 'visual-decisions')
  const diagnostics = fs.existsSync(diagnosticDir)
    ? fs.readdirSync(diagnosticDir).filter(name => name.endsWith('.json')).sort() : []
  if (diagnostics.length !== 1) throw new Error('La generación temporal no persistió exactamente una traza')
  const diagnosticFile = path.join(diagnosticDir, diagnostics[0])
  const diagnostic = json(diagnosticFile)
  if (diagnostic.summary.requestedVisuals !== 1 || diagnostic.scenes.length !== 1)
    throw new Error('La traza productiva no contiene la escena temporal esperada')
  const scene = diagnostic.scenes[0]
  if (!scene.localSemantic?.localText || !scene.sceneSpecIdentity || !scene.selectedCandidate)
    throw new Error('La traza productiva no contiene contexto, candidato o identidad')
  return {
    result: generated,
    diagnostic: { file: path.relative(TRACE_PROJECT, diagnosticFile).replace(/\\/g, '/'), value: diagnostic },
  }
}

function historicalRange (timeline, attempt) {
  const row = (timeline.rows || []).find(candidate => candidate.pos === attempt.pos)
  if (row && typeof row.startSeconds === 'number' && typeof row.end === 'number') {
    return { start: row.startSeconds, end: row.end }
  }
  return rangeForAttempt(attempt, [])
}

function recordedSceneKeywordCandidate (value) {
  const keyword = typeof value === 'string' ? value.trim() : ''
  // Recorded semantic output has subclip provenance. The selector grants it priority only
  // when the timed transcript independently places that exact word in this scene.
  return keyword ? [{ keyword, source: 'scene-semantic' }] : undefined
}

async function replayHistoricalQc (bundle, audit) {
  const attempts = audit.attempts.filter(attempt => FAILURE_POSITIONS.has(attempt.pos))
  if (attempts.length !== 16) throw new Error('El corpus forense ya no contiene los 16 slots QC esperados')
  bundle.createProjectFiles(REPLAY_PROJECT, {
    id: 'semantic-decision-qc-replay', clips: [], timelineVideoClips: [],
    aiScript: 'Replay temporal de QC forense',
  })
  const loaded = await invoke('load-project', { projectPath: REPLAY_PROJECT })
  if (!loaded.success) throw new Error('No se pudo abrir el proyecto temporal de replay: ' + loaded.error)
  const sessionState = bundle.createResolverSessionV1()
  const rows = []
  const reasonCounts = new Map()
  let materialized = 0
  let qcRejected = 0
  let degraded = 0
  for (const attempt of attempts) {
    const range = historicalRange(audit.timeline, attempt)
    const concepts = conceptsFromLog(attempt.semantic?.conceptsLog)
    const semantic = bundle.createLocalSceneSemanticV1({
      sceneId: 'replay-' + attempt.pos.replace(':', '-'), start: range.start, end: range.end,
      transcriptSegments: audit.transcript, concepts, anchor: concepts[0]?.etiqueta,
      globalText: attempt.phrase, globalHints: [attempt.keyword, attempt.semantic?.queryTruncated].filter(Boolean),
      globalContextRef: 'forensic:' + attempt.pos,
    })
    const keywordCandidates = recordedSceneKeywordCandidate(attempt.keyword)
    const resolved = bundle.resolveLocalSemanticVisualSceneV1({
      localSemantic: semantic, projectRoot: REPLAY_PROJECT, sistema: 'editorial',
      direction: directionFor(attempt.index), session: sessionState,
      ...(keywordCandidates ? { keywordCandidates } : {}),
    })
    let report = null
    let rendered = null
    try {
      rendered = await bundle.renderGraphicClip(resolved.compiled.graphicData, {
        ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla',
        projectRoot: REPLAY_PROJECT, renderBindings: resolved.compiled.renderBindings,
        onQcFailure: candidate => { report = candidate },
      })
    } catch (error) {
      if (error?.report) report = error.report
      else throw error
    }
    const findingCodes = Array.isArray(report?.findings) ? report.findings.map(finding => finding.code) : []
    for (const code of findingCodes) reasonCounts.set(code, (reasonCounts.get(code) || 0) + 1)
    const outcome = rendered ? 'materialized' : report ? 'qc-rejected' : 'render-null'
    if (outcome === 'materialized') materialized++
    if (outcome === 'qc-rejected') qcRejected++
    if (resolved.inputFallback.used || resolved.decision.alerts.some(alert => alert.code === 'RESOLVER_DEGRADED')) degraded++
    rows.push({
      historical: { index: attempt.index, pos: attempt.pos, keyword: attempt.keyword, phrase: attempt.phrase,
        outcome: attempt.outcome?.text || null, conceptsSource: 'forensic-semantic.conceptsLog',
        anchorSource: concepts.length ? 'first-recorded-concept' : 'none' },
      localSemantic: { start: semantic.start, end: semantic.end, localText: semantic.localText,
        globalContextRef: semantic.globalContextRef, globalTextLength: semantic.globalText?.length || 0,
        concepts: semantic.concepts },
      keyword: resolved.keywordSelection,
      selectedMetaphor: resolved.trace.selectedMetaphor,
      selectedCandidate: resolved.trace.selectedCandidate,
      visualMode: resolved.decision.visualMode,
      structure: resolved.decision.structure,
      treatment: resolved.trace.treatment,
      reasons: resolved.trace.reasons,
      warnings: resolved.decision.alerts,
      inputFallback: resolved.inputFallback,
      render: { outcome, file: rendered ? path.relative(REPLAY_PROJECT, rendered).replace(/\\/g, '/') : null,
        qcReport: report },
    })
  }
  const diagnostic = bundle.writeVisualDecisionDiagnostic(REPLAY_PROJECT, {
    diagnosticVersion: 1,
    generationId: 'forensic-qc-replay-v1',
    createdAt: new Date().toISOString(),
    summary: {
      requestedVisuals: rows.length, materializedVisuals: materialized, qcRejectedVisuals: qcRejected,
      resolverDegradedVisuals: degraded, substitutedWithOriginal: rows.length - materialized,
      reasons: Object.fromEntries([...reasonCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    },
    scenes: rows,
  })
  return { rows, diagnostic: path.relative(REPLAY_PROJECT, diagnostic.absoluteFile).replace(/\\/g, '/') }
}

const REVIEW_INDICES = {
  construir: 1,
  partidos: 5,
  fútbol: 25,
  estando: 32,
  iglesia: 74,
  religioso: 76,
  accidente: 37,
  indignación: 27,
}

function captionImage (input, output, label) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const safe = String(label).replace(/[:'\\%]/g, ' ').replace(/\n/g, ' ').slice(0, 38)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', `scale=360:640,drawbox=x=0:y=0:w=iw:h=44:color=black@0.78:t=fill,drawtext=fontfile='${font}':text='${safe}':fontcolor=white:fontsize=21:x=12:y=12`,
    '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 })
}

function compactProvider (provider) {
  if (provider === 'openmoji') return 'OMJ'
  if (provider === 'editorial-text') return 'EDT'
  if (provider === 'Solar V1' || provider === 'solar') return 'SOL'
  return String(provider || 'N/A').slice(0, 8)
}

function compactCandidate (candidate) {
  return String(candidate || 'sin-hero').replace(/^openmoji:/i, '').slice(0, 14)
}

function historicalFrame (audit, index) {
  const row = audit.frameIndex.find(candidate => candidate.index === index)
  const middle = row?.images?.find(image => image.k === 'middle')
  if (!middle?.name) throw new Error('Frame histórico medio ausente: #' + index)
  return path.join(AUDIT_ROOT, middle.name)
}

async function renderReviewCases (bundle, audit) {
  const sessionState = bundle.createResolverSessionV1()
  const frames = []
  const rows = []
  fs.mkdirSync(FRAME_DIR, { recursive: true })
  for (let order = 0; order < REVIEW_KEYWORDS.length; order++) {
    const keyword = REVIEW_KEYWORDS[order]
    const index = REVIEW_INDICES[keyword]
    const beforeVisual = audit.visuals.find(candidate => candidate.index === index)
    if (!beforeVisual) throw new Error('Escena histórica ausente para hoja: ' + keyword)
    const before = path.join(FRAME_DIR, `${String(order + 1).padStart(2, '0')}-before.png`)
    const historicalProvider = beforeVisual.effective?.provider || 'sin-provider'
    const historicalCandidate = beforeVisual.effective?.candidate || 'sin-hero'
    captionImage(historicalFrame(audit, index), before, `B ${keyword} ${compactProvider(historicalProvider)} ${compactCandidate(historicalCandidate)}`)
    const localSemantic = bundle.createLocalSceneSemanticV1({
      sceneId: 'review-' + beforeVisual.pos.replace(':', '-'), start: beforeVisual.startSeconds, end: beforeVisual.end,
      transcriptSegments: audit.transcript, concepts: beforeVisual.concepts || [],
      anchor: beforeVisual.diagnosticInput?.anchor, globalText: beforeVisual.phrase,
      globalHints: [beforeVisual.keyword, beforeVisual.semantic?.queryTruncated].filter(Boolean),
      globalContextRef: 'forensic:' + beforeVisual.pos,
    })
    const keywordCandidates = recordedSceneKeywordCandidate(beforeVisual.diagnosticInput?.keyword || beforeVisual.keyword)
    const resolved = bundle.resolveLocalSemanticVisualSceneV1({
      localSemantic, projectRoot: REPLAY_PROJECT, sistema: 'editorial', direction: directionFor(500 + order), session: sessionState,
      ...(keywordCandidates ? { keywordCandidates } : {}),
    })
    let report = null
    let rendered = null
    try {
      rendered = await bundle.renderGraphicClip(resolved.compiled.graphicData, {
        ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla',
        projectRoot: REPLAY_PROJECT, renderBindings: resolved.compiled.renderBindings,
        onQcFailure: candidate => { report = candidate },
      })
    } catch (error) {
      if (error?.report) report = error.report
      else throw error
    }
    const after = path.join(FRAME_DIR, `${String(order + 1).padStart(2, '0')}-after.png`)
    const candidate = resolved.decision.hero?.stableId || resolved.decision.hero?.solarName || 'sin Hero'
    const currentProvider = resolved.decision.hero?.provider || 'editorial-text'
    const currentLabel = `${rendered ? 'A' : 'QC'} ${keyword} ${compactProvider(currentProvider)} ${compactCandidate(candidate)}`
    if (rendered) {
      const rawAfter = path.join(FRAME_DIR, `${String(order + 1).padStart(2, '0')}-after-raw.png`)
      frameFromVideo(rendered, rawAfter)
      captionImage(rawAfter, after, currentLabel)
    } else {
      makePlaceholder(after, currentLabel)
    }
    frames.push(before, after)
    rows.push({
      historical: { index, pos: beforeVisual.pos, keyword, provider: beforeVisual.effective?.provider || null,
        candidate: beforeVisual.effective?.candidate || null, mode: beforeVisual.effective?.mode || null },
      current: { localText: localSemantic.localText, keyword: resolved.keywordSelection.keyword,
        keywordReason: resolved.keywordSelection.reason,
        provider: currentProvider, candidate, visualMode: resolved.decision.visualMode,
        structure: resolved.decision.structure, treatment: resolved.trace.treatment, rendered: Boolean(rendered),
        qcFindingCodes: Array.isArray(report?.findings) ? report.findings.map(finding => finding.code) : [] },
    })
  }
  tileSheet(frames, CONTACT_SHEET)
  return rows
}

function restoreProcessState () {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
}

async function finish (exitCode) {
  restoreProcessState()
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch {}
  app.exit(exitCode)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => {
  if (!finished) console.error('FALLO: aceptación semántica no terminó')
})

app.whenReady().then(async () => {
  const realBefore = snapshotRealProjects()
  const audit = {
    attempts: json(path.join(AUDIT_ROOT, 'render-attempts.json')),
    timeline: json(path.join(AUDIT_ROOT, 'timeline.json')),
    transcript: transcriptRows(json(path.join(AUDIT_ROOT, 'transcript.json'))),
    frameIndex: json(path.join(AUDIT_ROOT, 'frame-index.json')),
    visuals: json(path.join(AUDIT_ROOT, 'visuals-complete.json')).visuals,
  }
  if (!Array.isArray(audit.attempts) || !Array.isArray(audit.timeline.rows) || !Array.isArray(audit.transcript) ||
      !Array.isArray(audit.frameIndex) || !Array.isArray(audit.visuals)) throw new Error('Formato de auditoría forense inesperado')
  process.env.DEEPSEEK_API_KEY = 'fixture-no-network'
  global.fetch = async (url) => {
    if (String(url).startsWith('https://api.deepseek.com/chat/completions')) {
      deepSeekMockCalls++
      return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(deepSeekFixtureResponse()) } }] }) }
    }
    return blockedNetwork(url)
  }
  http.request = (...args) => blockedNetwork(args[0])
  https.request = (...args) => blockedNetwork(args[0])
  try {
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) }
      else callback({ cancel: false })
    })
    await new Promise(resolve => setTimeout(resolve, 1200))
    const startupNetworkAttempts = networkAttempts
    await waitForMainWindow()
    const generated = await runRealGeneration(bundle)
    if (deepSeekMockCalls !== 1) throw new Error('La generación temporal no usó exactamente un mock DeepSeek')
    const replay = await replayHistoricalQc(bundle, audit)
    const review = await renderReviewCases(bundle, audit)
    if (networkAttempts !== startupNetworkAttempts) throw new Error('La aceptación intentó red fuera del mock local')
    assertRepositoryUntouched(realBefore)
    const qcCategories = replay.rows.reduce((counts, row) => {
      for (const finding of row.render.qcReport?.findings || []) counts[finding.code] = (counts[finding.code] || 0) + 1
      return counts
    }, {})
    writeJson(QC_REPLAY_FILE, {
      replayVersion: 1,
      source: 'audit-last-real-video-20260909',
      method: 'V4A local-semantic replay from preserved phrase, timed transcript and recorded conceptsLog; original discarded QC reports are not reconstructed as historical facts.',
      attempted: replay.rows.length,
      qcCategories,
      replayDiagnostic: replay.diagnostic,
      rows: replay.rows,
    })
    writeJson(EVIDENCE_FILE, {
      evidenceVersion: 1,
      source: 'audit-last-real-video-20260909',
      temporaryProjectsOnly: true,
      noNetwork: true,
      realProjectsUntouched: true,
      actualGeneration: {
        mockDeepSeekCalls: deepSeekMockCalls,
        diagnosticFile: generated.diagnostic.file,
        summary: generated.diagnostic.value.summary,
        sceneSpecIdentity: generated.diagnostic.value.scenes[0].sceneSpecIdentity,
      },
      qcReplay: { attempted: replay.rows.length, diagnosticFile: replay.diagnostic, qcCategories },
      reviewSheet: {
        file: 'contact-sheet-before-after.png',
        order: review.map(row => ({ keyword: row.historical.keyword, before: row.historical, after: row.current })),
        visualVerdict: 'pending-human-review',
      },
    })
    if (!fs.existsSync(CONTACT_SHEET) || fs.statSync(CONTACT_SHEET).size === 0) throw new Error('No se generó la hoja antes/después')
    console.log('ACTUAL_GENERATION_TRACE=OK')
    console.log('QC_REPLAY_ATTEMPTED=' + replay.rows.length)
    console.log('CONTACT_SHEET=' + path.relative(REPO_ROOT, CONTACT_SHEET).replace(/\\/g, '/'))
    console.log('REAL_PROJECTS_UNTOUCHED=YES')
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
