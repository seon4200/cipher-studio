// Bounded productive acceptance for photo representation and the configured cutout runtime.
// Provider responses are captured/local. Final SceneSpecs are produced by the production resolver,
// then rendered offline from verified ProjectAssets in an isolated temporary project.

const { app, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const FIXTURE_ROOT = createTestFixture('photo-representation-runtime-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const ARTIFACTS = {
  sheet: path.join(OUTPUT, 'contact-sheet-photo-representation-runtime-v1.png'),
  video: path.join(OUTPUT, 'photo-representation-runtime-v1.mp4'),
  evidence: path.join(OUTPUT, 'evidence.json'),
}
const WIDTH = 540
const HEIGHT = 960
const FPS = 12
const DURATION = 1.25
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let bundle = null
let finished = false
let rendererNetworkAttempts = 0
let unrelatedBackgroundNetworkAttempts = 0

const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function snapshotRealProjects () {
  const root = path.join(REPO_ROOT, 'proyectos')
  const rows = []
  const walk = directory => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile() && ['project-state.json', 'project-state.json.bak', 'manifest.json'].includes(entry.name)) {
        const stat = fs.statSync(target)
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256File(target), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function wordsFor (text) {
  const words = String(text).split(/\s+/).filter(Boolean)
  return words.map((word, index) => ({ word, start: index * .18, end: index * .18 + .14 }))
}

function contextFor (row, index) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: row.id, start: 0, end: 1.4,
    transcriptSegments: [{ start: 0, end: 1.4, text: row.text, words: wordsFor(row.text) }],
    concepts: row.concepts.map((concept, conceptIndex) => ({ ...concept,
      start: .08 + conceptIndex * .22, end: .28 + conceptIndex * .22, scope: 'scene' })),
    anchor: row.concepts[0]?.label, relation: row.relation || 'acompaña', globalText: row.text,
    globalHints: row.concepts.map(concept => concept.label), globalContextRef: 'acceptance:photo-representation:' + row.id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: row.id, duration: DURATION, localSemantic,
    keywordCandidates: [{ keyword: row.keyword, source: 'scene-semantic' }], preferredVisualMode: 'auto',
    sistema: 'editorial', direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: 192000 + index },
    videoStyleId: 'cream-editorial', lockedChoices: [],
  })
}

const SCENES = [
  { id: 'camera-photo-hero', keyword: 'CÁMARA', text: 'la cámara documenta la historia',
    concepts: [{ label: 'cámara', emoji: '📷', canonicalHint: 'camera' }] },
  { id: 'clock-icon-camera-support', keyword: 'TIEMPO', text: 'el reloj acompaña a la cámara',
    concepts: [{ label: 'reloj', emoji: '⏱️', canonicalHint: 'clock' },
      { label: 'cámara', emoji: '📷', canonicalHint: 'camera' }] },
  { id: 'cup-photo-hero', keyword: 'TAZA', text: 'la taza conserva el café caliente',
    concepts: [{ label: 'taza', emoji: '☕', canonicalHint: 'cup' }] },
  { id: 'direct-openmoji-control', keyword: '1F382', text: 'el pastel celebra el aniversario',
    concepts: [{ label: '1F382' }] },
]

function recordedHit (query, kind) {
  const isCamera = kind === 'camera'
  return {
    id: isCamera ? 192001 : 192002,
    pageURL: `https://pixabay.com/photos/${kind}-recorded-${isCamera ? 192001 : 192002}/`,
    largeImageURL: `https://cdn.pixabay.com/photo/${kind}-recorded.jpg`,
    tags: isCamera ? `camera, photography, device, ${query}` : `cup, coffee, mug, drink, ${query}`,
    imageWidth: 1600, imageHeight: 1200, type: 'photo',
  }
}

function sourceKindFor (query) {
  return /camera|camara|cámara|photography/i.test(query) ? 'camera' :
    /cup|mug|coffee|taza|cafe|café|drink/i.test(query) ? 'cup' : null
}

function safeLabel (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _|/.+%=-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function frameFromVideo (video, output) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.68', '-i', video,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:${HEIGHT}`, output], { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}

function labelFrame (input, output, lines) {
  const width = 360; const height = 640; const header = 110
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const filters = [`scale=${width}:${height}`, `pad=${width}:${height + header}:0:${header}:black`]
  lines.slice(0, 4).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${safeLabel(line).slice(0, 66)}':fontcolor=white:fontsize=13:x=9:y=${7 + index * 24}`))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', filters.join(','), '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}

function makeSheet (frames, output) {
  const columns = 2; const cellWidth = 360; const cellHeight = 750
  const layout = frames.map((_, index) => `${(index % columns) * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...frames.flatMap(file => ['-i', file]),
    '-filter_complex', `xstack=inputs=${frames.length}:layout=${layout}:fill=black`, '-frames:v', '1', output],
  { stdio: 'pipe', maxBuffer: 192 * 1024 * 1024 })
}

function joinClips (clips, output) {
  const labels = clips.map((_, index) => `[${index}:v]`).join('')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...clips.flatMap(file => ['-i', file]),
    '-filter_complex', `${labels}concat=n=${clips.length}:v=1:a=0,format=yuv420p[v]`, '-map', '[v]',
    '-c:v', 'libx264', '-movflags', '+faststart', output], { stdio: 'pipe', maxBuffer: 256 * 1024 * 1024 })
}

function probe (file) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration,size:stream=codec_name,width,height,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' }))
}

async function renderResolved (row, index) {
  let qc = null
  const started = performance.now()
  const clip = await bundle.renderGraphicClip(row.resolved.compiled.graphicData, {
    ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla', sistema: 'editorial',
    projectRoot: PROJECT_ROOT, renderBindings: row.resolved.compiled.renderBindings,
    onQcReport: report => { qc = report }, onQcFailure: report => { qc = report },
  })
  if (!clip || !fs.existsSync(clip)) {
    const errors = (qc?.findings || []).filter(finding => finding.level === 'error').map(finding => finding.code)
    throw new Error(`PHOTO_REPRESENTATION_QC_REJECTED:${row.context.sceneId}:${errors.join(',')}`)
  }
  const persistedClip = path.join(FRAME_ROOT, `${String(index + 1).padStart(2, '0')}-${row.context.sceneId}.mp4`)
  const frame = path.join(FRAME_ROOT, `${String(index + 1).padStart(2, '0')}-${row.context.sceneId}.png`)
  fs.copyFileSync(clip, persistedClip)
  frameFromVideo(persistedClip, frame)
  return { persistedClip, frame, qc, renderMs: performance.now() - started }
}

function choiceSummary (choice) {
  return { role: choice.slotId, provider: choice.provider, representation: choice.representation,
    assetId: choice.asset?.id || null, sha256: choice.asset?.sha256 || null, solarIcon: choice.solarIcon || null }
}

async function finish (code) {
  global.fetch = originalFetch; http.request = originalHttpRequest; https.request = originalHttpsRequest
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture temporal retenido:', error.message) }
  finished = true; app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

app.whenReady().then(async () => {
  const projectsBefore = snapshotRealProjects()
  try {
    bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    await new Promise(resolve => setTimeout(resolve, 250))
    const sourceFiles = {
      camera: String(process.env.CIPHER_CUTOUT_TEST_OBJECT_SOURCE || '').trim(),
      cup: String(process.env.CIPHER_CUTOUT_TEST_CUP_SOURCE || '').trim(),
    }
    for (const [kind, file] of Object.entries(sourceFiles)) {
      if (!file || !fs.existsSync(file)) throw new Error(`CIPHER_CUTOUT_TEST_${kind.toUpperCase()}_SOURCE_REQUIRED`)
      const inspection = bundle.inspectPixabayRasterImageV1(fs.readFileSync(file))
      if (inspection.alphaUseful) throw new Error(`ACCEPTANCE_SOURCE_MUST_BE_OPAQUE:${kind}`)
    }
    const runtime = bundle.diagnoseCutoutRuntimeV1()
    if (!runtime.ready) throw new Error(`CUTOUT_RUNTIME_NOT_READY:${runtime.code}`)
    if (bundle.VERSION_PLANTILLAS !== 15) throw new Error('VERSION_PLANTILLAS_NOT_15')
    fs.mkdirSync(FRAME_ROOT, { recursive: true })
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'photo-representation-runtime-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })

    let providerRequests = 0; let providerDownloads = 0; let providerRetries = 0
    const hooks = {
      searchRequestJson: async url => {
        providerRequests++
        const query = String(url.searchParams.get('q') || '')
        const kind = sourceKindFor(query)
        return { hits: kind ? [recordedHit(query, kind)] : [] }
      },
      downloadRequestBytes: async url => {
        providerDownloads++
        const kind = /camera-recorded/i.test(String(url)) ? 'camera' : /cup-recorded/i.test(String(url)) ? 'cup' : null
        if (!kind) throw new Error('UNEXPECTED_RECORDED_DOWNLOAD:' + url)
        return fs.readFileSync(sourceFiles[kind])
      },
    }

    const resolved = []
    const materializationStarted = performance.now()
    for (let index = 0; index < SCENES.length; index++) {
      const context = contextFor(SCENES[index], index)
      const row = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot: PROJECT_ROOT,
        pixabayApiKey: 'recorded-response', hooks }))[0]
      resolved.push(row)
    }
    const materializationMs = performance.now() - materializationStarted

    const block = value => {
      const url = String(value?.url || value?.href || value || '')
      if (/elevenlabs\.io/i.test(url)) unrelatedBackgroundNetworkAttempts++
      else rendererNetworkAttempts++
      throw new Error('NETWORK_FORBIDDEN_AFTER_MATERIALIZATION')
    }
    global.fetch = block; http.request = block; https.request = block
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) {
        if (/elevenlabs\.io/i.test(details.url)) unrelatedBackgroundNetworkAttempts++
        else rendererNetworkAttempts++
        callback({ cancel: true })
      } else callback({ cancel: false })
    })

    const rendered = []
    for (let index = 0; index < resolved.length; index++) rendered.push(await renderResolved(resolved[index], index))
    if (rendererNetworkAttempts !== 0) throw new Error('RENDERER_USED_NETWORK')
    joinClips(rendered.map(row => row.persistedClip), ARTIFACTS.video)

    const labelled = rendered.map((row, index) => {
      const current = resolved[index]
      const output = path.join(FRAME_ROOT, `labelled-${String(index + 1).padStart(2, '0')}.png`)
      const roles = current.resolved.choices.map(choice => `${choice.slotId}:${choice.provider}`).join(' + ') || 'editorial'
      labelFrame(row.frame, output, [
        `${current.context.sceneId} | QC PASS`, roles,
        `inference ${current.resolved.metrics.cutoutInferenceExecuted} | cache ${current.resolved.metrics.cutoutCacheHit}`,
        `${current.resolved.compiled.sceneSpec.layout.family} | ${current.resolved.compiled.sceneSpec.text.keyword}`,
      ])
      return output
    })
    makeSheet(labelled, ARTIFACTS.sheet)

    const metrics = bundle.summarizeMotionGraphicsVideoMetricsV2(resolved.map(row => row.resolved))
    const photoChoices = resolved.flatMap(row => row.resolved.choices).filter(choice => ['photo-cutout', 'pixabay-images'].includes(choice.provider))
    const evidence = {
      schemaVersion: 1,
      purpose: 'Small productive object-photo acceptance with captured provider responses and offline V15 render.',
      versionPlantillas: bundle.VERSION_PLANTILLAS,
      runtime: { ready: runtime.ready, code: runtime.code, model: runtime.model },
      sceneBudget: bundle.PHOTO_SCENE_BUDGET_V1,
      capturedProvider: { requests: providerRequests, retries: providerRetries, downloads: providerDownloads },
      metrics,
      reconciliation: {
        photoOpportunities: metrics.photoOpportunities,
        photoPlans: metrics.photoPlans,
        photoRequests: metrics.photoRequests,
        candidatesEvaluated: metrics.candidatesEvaluated,
        candidatesRejected: metrics.relevanceRejected,
        downloads: metrics.photoDownloads,
        existingAlphaAccepted: metrics.cutoutSourceAlphaReused,
        opaquePhotoInferences: metrics.cutoutInferenceExecuted,
        cacheHits: metrics.cutoutCacheHit,
        runtimeErrors: metrics.cutoutRuntimeErrors,
        photoHero: metrics.photoCutoutHero + metrics.fullRasterHero,
        photoSupport: metrics.photoCutoutSupport + metrics.fullRasterSupport,
        uniquePhotoAssets: metrics.uniquePhotoAssets,
        reusedPhotoAssets: metrics.reusedPhotoAssets,
      },
      timings: { materializationMs, averagePhotoNetworkMs: metrics.averagePhotoNetworkMs,
        averageCutoutMs: metrics.averageCutoutMs, p95CutoutMs: metrics.p95CutoutMs,
        renderMs: rendered.map(row => row.renderMs) },
      finalPhotoAssets: photoChoices.map(choice => ({ slotId: choice.slotId, provider: choice.provider,
        sha256: choice.asset?.sha256 || null })),
      rendererOffline: rendererNetworkAttempts === 0,
      unrelatedBackgroundNetworkAttempts,
      realProjectsUntouched: snapshotRealProjects() === projectsBefore,
      scenes: resolved.map((row, index) => ({
        sceneId: row.context.sceneId, keyword: row.resolved.compiled.sceneSpec.text.keyword,
        choices: row.resolved.choices.map(choiceSummary), metrics: row.resolved.metrics,
        representationTrace: row.resolved.trace.representation,
        pixabayTrace: row.resolved.trace.pixabay,
        qcErrors: (rendered[index].qc?.findings || []).filter(finding => finding.level === 'error').map(finding => finding.code),
      })),
      artifacts: {
        video: { file: path.basename(ARTIFACTS.video), sha256: sha256File(ARTIFACTS.video), probe: probe(ARTIFACTS.video) },
        contactSheet: { file: path.basename(ARTIFACTS.sheet), sha256: sha256File(ARTIFACTS.sheet) },
      },
    }
    console.log('PHOTO_REPRESENTATION_RECONCILIATION=' + JSON.stringify(evidence.reconciliation))
    if (!evidence.realProjectsUntouched) throw new Error('REAL_PROJECTS_CHANGED')
    if (metrics.cutoutInferenceExecuted < 1) throw new Error('OPAQUE_OBJECT_INFERENCE_NOT_DEMONSTRATED')
    if (metrics.cutoutCacheHit < 1) throw new Error('CUTOUT_CACHE_REUSE_NOT_DEMONSTRATED')
    if (evidence.reconciliation.photoHero < 1) throw new Error('PHOTO_HERO_CAPABILITY_NOT_DEMONSTRATED')
    if (evidence.reconciliation.photoSupport < 1) throw new Error('PHOTO_SUPPORT_CAPABILITY_NOT_DEMONSTRATED')
    if (!resolved.some(row => row.resolved.choices.some(choice => choice.provider === 'openmoji'))) throw new Error('ICON_CONTROL_NOT_PRESERVED')
    fs.writeFileSync(ARTIFACTS.evidence, JSON.stringify(evidence, null, 2) + '\n')
    console.log('PHOTO_REPRESENTATION_ACCEPTANCE=' + JSON.stringify({
      scenes: resolved.length, reconciliation: evidence.reconciliation,
      video: path.basename(ARTIFACTS.video), sheet: path.basename(ARTIFACTS.sheet),
    }))
    await finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    await finish(1)
  }
}).catch(async error => { console.error(error && error.stack || error); await finish(1) })
