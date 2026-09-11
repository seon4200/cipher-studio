// Real, bounded V15 Photo Cutout Production V1 acceptance.
//
// It creates an isolated temporary project, obtains only the selected provider assets through
// the production resolver, runs the configured local u2netp worker, then blocks all networking
// before the real V15 renderer/QC/MP4 phase.  No SceneSpec or final asset is injected manually.

const { app, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const { PHOTO_CUTOUT_PRODUCTION_CORPUS_V1 } = require('../../fixtures/photo-cutout-production-corpus-v1')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const FIXTURE_ROOT = createTestFixture('photo-cutout-production-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const ARTIFACTS = {
  contactSheet: path.join(OUTPUT, 'contact-sheet-photo-cutout-production-v1.png'),
  video: path.join(OUTPUT, 'photo-cutout-production-v1.mp4'),
  evidence: path.join(OUTPUT, 'evidence.json'),
}
const WIDTH = 540
const HEIGHT = 960
const FPS = 12
const DURATION = 1.4
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let bundle = null
let finished = false
let networkAttemptsAfterRenderGate = 0

const sha256 = value => crypto.createHash('sha256').update(fs.readFileSync(value)).digest('hex')

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
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(target), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function wordsFor (text, start = 10, end = 12.6) {
  const terms = String(text).split(/\s+/).filter(Boolean)
  return terms.map((word, index) => ({ word,
    start: start + ((end - start) * index / terms.length),
    end: start + ((end - start) * (index + .82) / terms.length),
  }))
}

function contextFor (row, index) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: row.id, start: 10, end: 12.6,
    transcriptSegments: [{ start: 9.85, end: 12.75, text: row.text, words: wordsFor(row.text) }],
    concepts: row.concepts.map(concept => ({ ...concept, start: 10.05, end: 12.45, scope: 'scene' })),
    anchor: row.concepts[0]?.label, relation: 'documenta', globalText: row.text,
    globalHints: row.concepts.map(concept => concept.label), globalContextRef: 'acceptance:photo-cutout-production:' + row.id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: row.id, duration: DURATION, localSemantic,
    keywordCandidates: [{ keyword: row.keyword, source: 'scene-semantic' }],
    preferredVisualMode: row.preferredVisualMode || 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: 161000 + index },
    videoStyleId: 'cream-editorial',
  })
}

function safeLabel (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _|/.+%=-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function frameFromVideo (video, output) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.72', '-i', video,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:${HEIGHT}`, output], { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}

function labelFrame (input, output, lines) {
  const width = 360; const height = 640; const header = 105
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const filters = [`scale=${width}:${height}`, `pad=${width}:${height + header}:0:${header}:black`]
  lines.slice(0, 4).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${safeLabel(line).slice(0, 66)}':fontcolor=white:fontsize=13:x=9:y=${7 + index * 23}`))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', filters.join(','), '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}

function makeSheet (frames, output) {
  const columns = 3; const cellWidth = 360; const cellHeight = 745
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
    throw new Error(`PHOTO_CUTOUT_PRODUCTION_QC_REJECTED:${row.context.sceneId}:${errors.join(',')}`)
  }
  const persistedClip = path.join(FRAME_ROOT, `${String(index + 1).padStart(2, '0')}-${row.context.sceneId}.mp4`)
  const frame = path.join(FRAME_ROOT, `${String(index + 1).padStart(2, '0')}-${row.context.sceneId}.png`)
  fs.copyFileSync(clip, persistedClip)
  frameFromVideo(persistedClip, frame)
  return { persistedClip, frame, qc, renderMs: performance.now() - started }
}

function choiceSummary (choice) {
  return {
    role: choice.slotId, provider: choice.provider, representation: choice.representation,
    assetId: choice.asset?.id || null, sha256: choice.asset?.sha256 || null,
    solarIcon: choice.solarIcon || null, treatment: 'original-color',
  }
}

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture temporal retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

app.whenReady().then(async () => {
  const projectsBefore = snapshotRealProjects()
  try {
    bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    const apiKey = String(process.env.PIXABAY_API_KEY || '').trim()
    const python = String(process.env.CIPHER_CUTOUT_PYTHON || '').trim()
    const modelCache = String(process.env.CIPHER_CUTOUT_MODEL_CACHE || '').trim()
    if (!apiKey) throw new Error('PIXABAY_API_KEY_REQUIRED_FOR_PRODUCTION_ACCEPTANCE')
    if (!python || !modelCache) throw new Error('CIPHER_CUTOUT_RUNTIME_REQUIRED_FOR_PRODUCTION_ACCEPTANCE')
    if (bundle.VERSION_PLANTILLAS !== 15) throw new Error('VERSION_PLANTILLAS_NOT_15')
    fs.mkdirSync(FRAME_ROOT, { recursive: true })
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'photo-cutout-production-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })

    const selectedIds = new Set(['person-microphone', 'object-camera', 'place-hospital', 'symbol-clock', 'editorial-recovery'])
    const selected = PHOTO_CUTOUT_PRODUCTION_CORPUS_V1.filter(row => selectedIds.has(row.id))
    if (selected.length !== 5) throw new Error('PRODUCTION_ACCEPTANCE_CORPUS_SELECTION_INVALID')
    const started = performance.now()
    const resolved = await bundle.resolveModernVisualGenerationBatchV2({
      contexts: selected.map(contextFor), projectRoot: PROJECT_ROOT, pixabayApiKey: apiKey,
    })
    const materializationMs = performance.now() - started
    // This barrier proves that all provider IO and CutoutTransform work happened before
    // SceneSpec/RenderBindings reached the offline renderer.
    const block = () => { networkAttemptsAfterRenderGate++; throw new Error('NETWORK_FORBIDDEN_AFTER_PHOTO_CUTOUT_MATERIALIZATION') }
    global.fetch = block; http.request = block; https.request = block
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttemptsAfterRenderGate++; callback({ cancel: true }) } else callback({ cancel: false })
    })
    const rendered = []
    for (let index = 0; index < resolved.length; index++) rendered.push(await renderResolved(resolved[index], index))
    if (networkAttemptsAfterRenderGate !== 0) throw new Error('NETWORK_USED_DURING_OFFLINE_RENDER')
    joinClips(rendered.map(row => row.persistedClip), ARTIFACTS.video)
    const labelled = rendered.map((row, index) => {
      const current = resolved[index]
      const output = path.join(FRAME_ROOT, `labelled-${String(index + 1).padStart(2, '0')}.png`)
      const roles = current.resolved.choices.map(choice => `${choice.slotId}:${choice.provider}`).join(' + ') || 'editorial'
      const heroPlacement = current.resolved.compiled.sceneSpec.layout.slotLayouts
        .find(slot => slot.slotId === 'hero')?.placement ?? 'none'
      labelFrame(row.frame, output, [
        `${current.context.sceneId} | ${current.resolved.compiled.sceneSpec.visualMode} | QC PASS`,
        roles,
        `${current.resolved.compiled.sceneSpec.layout.family} | ${heroPlacement}`,
        `keyword ${current.resolved.compiled.sceneSpec.text.keyword} | ${current.resolved.compiled.sceneSpec.colorPalette.family}`,
      ])
      return output
    })
    makeSheet(labelled, ARTIFACTS.contactSheet)
    const metrics = bundle.summarizeMotionGraphicsVideoMetricsV2(resolved.map(row => row.resolved))
    const evidence = {
      schemaVersion: 1,
      purpose: 'Photo Cutout Production V1 real bounded acceptance; final render is offline.',
      base: { versionPlantillas: bundle.VERSION_PLANTILLAS, defaultModel: bundle.CUTOUT_DEFAULT_MODEL_V1,
        licenseDebt: bundle.CUTOUT_WEIGHT_LICENSE_GATE },
      frozenCorpus: { total: PHOTO_CUTOUT_PRODUCTION_CORPUS_V1.length, selectedSceneIds: selected.map(row => row.id) },
      manuallyConstructedFinalSceneSpecs: 0,
      materializationMs,
      metrics,
      rendererOffline: true,
      networkAttemptsAfterRenderGate,
      realProjectsUntouched: snapshotRealProjects() === projectsBefore,
      scenes: resolved.map((row, index) => ({
        sceneId: row.context.sceneId, keyword: row.resolved.compiled.sceneSpec.text.keyword,
        visualMode: row.resolved.compiled.sceneSpec.visualMode,
        choices: row.resolved.choices.map(choiceSummary),
        trace: { representation: row.resolved.trace.representation, pixabay: row.resolved.trace.pixabay },
        qcErrors: (rendered[index].qc?.findings || []).filter(finding => finding.level === 'error').map(finding => finding.code),
        renderMs: rendered[index].renderMs,
      })),
      artifacts: {
        video: { file: path.basename(ARTIFACTS.video), sha256: sha256(ARTIFACTS.video), probe: probe(ARTIFACTS.video) },
        contactSheet: { file: path.basename(ARTIFACTS.contactSheet), sha256: sha256(ARTIFACTS.contactSheet) },
      },
    }
    if (!evidence.realProjectsUntouched) throw new Error('REAL_PROJECTS_CHANGED')
    fs.writeFileSync(ARTIFACTS.evidence, JSON.stringify(evidence, null, 2) + '\n')
    console.log('PHOTO_CUTOUT_PRODUCTION_EVIDENCE=' + JSON.stringify({
      scenes: resolved.length, metrics, offline: evidence.rendererOffline,
      video: path.basename(ARTIFACTS.video), sheet: path.basename(ARTIFACTS.contactSheet),
    }))
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
