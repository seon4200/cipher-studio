/*
 * Real-photo cutout feasibility acceptance.
 *
 * This script deliberately orchestrates existing Cipher V15 APIs around an
 * external local rembg worker. It does not import rembg into the product, add
 * a renderer, manufacture a final SceneSpec, or write under a real project.
 * Provider retrieval runs only while gathering eight bounded source examples;
 * all later rembg and rendering work consumes local verified bytes.
 */

const { app, session } = require('electron')
const { execFileSync, spawnSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')
const { createTestFixture, cleanupTestFixture, removeFixtureFile } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const WORKER = path.join(REPO_ROOT, 'tools', 'photo-cutout-spike', 'cutout_worker.py')
const RUNTIME_ROOT = process.env.CUTOUT_SPIKE_ROOT || 'C:\\graphify\\_spike-runtime\\photo-cutout-v1'
const PYTHON = process.env.CUTOUT_SPIKE_PYTHON || path.join(RUNTIME_ROOT, 'venv', 'Scripts', 'python.exe')
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', '')
const RUN_ROOT = path.join(RUNTIME_ROOT, 'runs', RUN_ID)
const RAW_ROOT = path.join(RUN_ROOT, 'raw')
const CUTOUT_ROOT = path.join(RUN_ROOT, 'cutouts')
const ARTIFACT_ROOT = path.join(RUN_ROOT, 'evidence')
const MODEL_CACHE = path.join(RUN_ROOT, 'model-cache')
const FIXTURE_ROOT = createTestFixture('photo-cutout-spike-v1-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const WIDTH = 540
const HEIGHT = 960
const FPS = 8
const DURATION = 1.5

const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpGet = http.get
const originalHttpsRequest = https.request
const originalHttpsGet = https.get
let networkAttemptsDuringOfflineRender = 0
let finished = false

const SOURCE_CASES = Object.freeze([
  { id: 'person-mid', label: 'persona medio cuerpo', keyword: 'MUJER', text: 'una mujer presenta un retrato', concepts: [{ label: 'mujer', emoji: '👩' }], sourceMode: 'opaque-photo' },
  { id: 'person-hair', label: 'persona con cabello difícil', keyword: 'CABELLO', text: 'una mujer mueve el cabello al viento', concepts: [{ label: 'mujer', emoji: '👩' }, { label: 'cabello' }], sourceMode: 'opaque-photo' },
  { id: 'simple-object', label: 'objeto simple', keyword: 'TAZA', text: 'una taza permanece sobre la mesa', concepts: [{ label: 'taza' }], sourceMode: 'opaque-photo' },
  { id: 'object-holes', label: 'objeto con huecos', keyword: 'BICICLETA', text: 'una bicicleta cruza la calle', concepts: [{ label: 'bicicleta' }], sourceMode: 'opaque-photo' },
  { id: 'animal-fur', label: 'animal con pelo', keyword: 'PERRO', text: 'un perro corre sobre el césped', concepts: [{ label: 'perro' }], sourceMode: 'opaque-photo' },
  { id: 'complex-object', label: 'objeto complejo', keyword: 'CÁMARA', text: 'una cámara documenta la escena', concepts: [{ label: 'cámara', emoji: '📷' }], sourceMode: 'opaque-photo' },
  { id: 'similar-background', label: 'sujeto parecido al fondo', keyword: 'SILLA', text: 'una silla clara está frente a una pared clara', concepts: [{ label: 'silla' }], sourceMode: 'opaque-photo' },
  { id: 'busy-scene', label: 'escena difícil con fondo cargado', keyword: 'PROTESTA', text: 'una protesta reúne personas en una calle', concepts: [{ label: 'protesta', emoji: '📣' }], sourceMode: 'opaque-photo' },
])

function sha256 (value) { return crypto.createHash('sha256').update(value).digest('hex') }
function sha256File (file) { return sha256(fs.readFileSync(file)) }
function mkdir (target) { fs.mkdirSync(target, { recursive: true }) }
function writeJson (target, value) { mkdir(path.dirname(target)); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n') }
function clone (value) { return JSON.parse(JSON.stringify(value)) }
function percentile (values, p) {
  const ordered = values.slice().sort((a, b) => a - b)
  return ordered[Math.max(0, Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1))] ?? null
}
function treeBytes (root) {
  let total = 0
  const walk = target => {
    if (!fs.existsSync(target)) return
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const child = path.join(target, entry.name)
      if (entry.isDirectory()) walk(child)
      else if (entry.isFile()) total += fs.statSync(child).size
    }
  }
  walk(root)
  return total
}
function q (value) { return String(value || '').replace(/'/g, "'\\''") }
function sourceWords (text, start = 10, end = 12.5) {
  const terms = String(text).split(/\s+/).filter(Boolean)
  return terms.map((word, index) => ({ word, start: start + ((end - start) * index / terms.length), end: start + ((end - start) * (index + .8) / terms.length) }))
}
function fullBounds () {
  return {
    revision: 'subject-bounds-v1', alphaBounds: { x: 0, y: 0, width: 1, height: 1 },
    visibleWidthRatio: 1, visibleHeightRatio: 1, centerOfMass: { x: .5, y: .5 }, aspectRatio: 1,
    transparentPadding: { top: 0, right: 0, bottom: 0, left: 0 },
  }
}
function snapshotRealProjects () {
  const root = path.join(REPO_ROOT, 'proyectos')
  const files = []
  const walk = directory => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile() && ['project-state.json', 'project-state.json.bak', 'manifest.json'].includes(entry.name)) {
        files.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256File(target), fs.statSync(target).size])
      }
    }
  }
  walk(root)
  return JSON.stringify(files.sort((a, b) => a[0].localeCompare(b[0])))
}
function runWorker (args) {
  if (!fs.existsSync(PYTHON)) throw new Error('CUTOUT_SPIKE_PYTHON_MISSING:' + PYTHON)
  const result = spawnSync(PYTHON, [WORKER, ...args], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('CUTOUT_WORKER_FAILED:' + (result.stderr || result.stdout || '').slice(-4000))
  const line = String(result.stdout).trim().split(/\r?\n/).reverse().find(value => value.trim().startsWith('{'))
  if (!line) throw new Error('CUTOUT_WORKER_NO_JSON:' + String(result.stdout).slice(-1000))
  return JSON.parse(line)
}
function frameFromVideo (video, output, seek = .72) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seek), '-i', video,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:${HEIGHT}`, output], { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}
function probeVideo (video) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate', '-of', 'json', video], { encoding: 'utf8' }))
}
function offlineBlock () { networkAttemptsDuringOfflineRender++; throw new Error('NETWORK_FORBIDDEN_AFTER_CUTOUT_PUBLICATION') }
function enableOfflineGate () {
  global.fetch = offlineBlock
  http.request = offlineBlock; http.get = offlineBlock
  https.request = offlineBlock; https.get = offlineBlock
}
function restoreNetwork () {
  global.fetch = originalFetch
  http.request = originalHttpRequest; http.get = originalHttpGet
  https.request = originalHttpsRequest; https.get = originalHttpsGet
}
function finish (code) {
  restoreNetwork()
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture temporal retenido:', error.message) }
  finished = true
  app.exit(code)
}

function localSemanticFor (bundle, definition, sceneId = definition.id) {
  return bundle.createLocalSceneSemanticV1({
    sceneId, start: 10, end: 12.5,
    transcriptSegments: [{ start: 9.85, end: 12.65, text: definition.text, words: sourceWords(definition.text) }],
    concepts: definition.concepts.map(concept => ({ ...concept, scope: 'scene' })),
    anchor: definition.concepts[0]?.label, relation: 'documenta', globalText: definition.text,
    globalHints: definition.concepts.map(concept => concept.label), globalContextRef: 'photo-cutout-spike:' + definition.id,
  })
}
function semanticDecisionFor (bundle, definition, sceneId = definition.id, seed = 159100) {
  const localSemantic = localSemanticFor(bundle, definition, sceneId)
  const base = bundle.resolveLocalSemanticVisualSceneV1({
    localSemantic, keywordCandidates: [{ keyword: definition.keyword, source: 'scene-semantic' }],
    preferredVisualMode: 'auto', projectRoot: PROJECT_ROOT, sistema: 'editorial',
    direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: seed },
  })
  const retrieval = bundle.resolveVisualRetrievalV1({ intent: base.decision.intent, localSemantic })
  return { localSemantic, base, retrieval }
}
function pixabayPlans (retrieval) {
  return retrieval.plans.filter(plan => plan.provider === 'pixabay-images').flatMap(plan => plan.pixabayPlans || [])
}
function opaquePhotoCorpusPlan (plan) {
  // This is deliberately a test-corpus acquisition policy, not a production SearchPlan
  // change. The local CutoutTransform must be challenged with opaque photographs rather
  // than receive only transparent Pixabay illustrations that need no background removal.
  const { colors, ...withoutTransparentPreference } = plan.parameters
  return {
    ...plan, imageType: 'photo', transparentRequested: false, reason: 'SPIKE_OPAQUE_PHOTO_CORPUS',
    parameters: { ...withoutTransparentPreference, image_type: 'photo' },
  }
}
async function retrieveOneSource (bundle, definition, apiKey, usedIds) {
  const prepared = semanticDecisionFor(bundle, definition)
  const attempts = []
  for (const rawPlan of pixabayPlans(prepared.retrieval)) {
    const plan = definition.sourceMode === 'opaque-photo' ? opaquePhotoCorpusPlan(rawPlan) : rawPlan
    try {
      const response = await bundle.searchPixabayImagesV1({ plan, apiKey })
      const available = response.candidates.filter(candidate => !usedIds.has(candidate.id))
      const selected = bundle.selectPixabayImageCandidateV1(available)
      attempts.push({ query: plan.query, outcome: response.outcome, candidates: response.candidates.length, selected: selected?.id || null })
      if (!selected) continue
      const bytes = await bundle.downloadPixabayImageBytesV1({ candidate: selected })
      const inspection = bundle.inspectPixabayRasterImageV1(bytes)
      const target = path.join(RAW_ROOT, definition.id + '.' + inspection.extension)
      fs.writeFileSync(target, bytes)
      usedIds.add(selected.id)
      return {
        id: definition.id, label: definition.label, candidate: selected, sourcePath: target,
        sourceSha256: sha256(bytes), sourceBytes: bytes.length, inspection, attempts,
        semantic: { sceneId: prepared.localSemantic.sceneId, concepts: prepared.retrieval.concepts, plans: pixabayPlans(prepared.retrieval) },
      }
    } catch (error) {
      attempts.push({ query: plan.query, outcome: error && error.code ? error.code : 'ERROR', candidates: 0, selected: null })
    }
  }
  throw new Error('PIXABAY_SOURCE_UNAVAILABLE:' + definition.id + ':' + JSON.stringify(attempts))
}
function workerManifest (sources) {
  return { version: 1, cases: sources.map(source => ({ id: source.id, label: source.label, sourcePath: source.sourcePath })) }
}
function pickModelOutput (benchmark, model, id) {
  const row = benchmark.models[model]['1024'].cases.find(value => value.id === id)
  if (!row) throw new Error('CUTOUT_OUTPUT_MISSING:' + model + ':' + id)
  return row.runs[0]
}
function lockedCutoutChoice (bundle, concept, asset, bytes) {
  return {
    slotId: 'hero', concept: concept.normalizedTerm, provider: 'pixabay-images', reason: 'SPIKE_REMBG_SELECTED_CUTOUT', score: 3,
    assetId: asset.id, relativeFile: asset.relativeFile, sha256: asset.sha256, mime: asset.mime,
    bounds: bundle.subjectBoundsFromPixabayRasterV1(bytes), kind: 'photo-cutout', alphaMode: 'useful-alpha',
  }
}
function lockedOpenMojiChoice (bundle, candidate, slotId) {
  const asset = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: candidate.stableId }).asset
  return {
    slotId, concept: candidate.concept, provider: 'openmoji', reason: 'SPIKE_RETRIEVAL_SELECTED_SUPPORT', score: candidate.score,
    assetId: asset.id, relativeFile: asset.relativeFile, sha256: asset.sha256, mime: asset.mime,
    stableId: candidate.stableId, bounds: fullBounds(), kind: 'complex-illustration', alphaMode: 'vector',
  }
}
function contextForCutout (bundle, definition, lockedChoices, seed, sceneId) {
  const localSemantic = localSemanticFor(bundle, definition, sceneId)
  return bundle.createModernVisualGenerationContextV2({
    sceneId, duration: DURATION, localSemantic,
    keywordCandidates: [{ keyword: definition.keyword, source: 'scene-semantic' }],
    preferredVisualMode: 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: seed },
    videoStyleId: 'cream-editorial', lockedChoices,
  })
}
async function resolveV15WithCutout (bundle, definition, lockedChoices, seed, sceneId) {
  const [resolved] = await bundle.resolveModernVisualGenerationBatchV2({
    contexts: [contextForCutout(bundle, definition, lockedChoices, seed, sceneId)], projectRoot: PROJECT_ROOT,
  })
  return resolved
}
async function renderOffline (bundle, resolved, name) {
  let qc = null
  const clip = await bundle.renderGraphicClip(resolved.resolved.compiled.graphicData, {
    ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla', sistema: 'editorial', projectRoot: PROJECT_ROOT,
    renderBindings: resolved.resolved.compiled.renderBindings,
    onQcReport: value => { qc = value }, onQcFailure: value => { qc = value },
  })
  if (!clip) throw new Error('CUTOUT_V15_QC_REJECTED:' + name + ':' + JSON.stringify(qc?.findings || []))
  const evidenceVideo = path.join(ARTIFACT_ROOT, name + '.mp4')
  const evidenceFrame = path.join(ARTIFACT_ROOT, name + '.png')
  fs.copyFileSync(clip, evidenceVideo)
  frameFromVideo(clip, evidenceFrame)
  return { clip, evidenceVideo, evidenceFrame, qc }
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)

app.whenReady().then(async () => {
  const realProjectsBefore = snapshotRealProjects()
  const evidence = {
    schemaVersion: 1,
    purpose: 'V15 local photo cutout feasibility spike; no production CutoutTransform dependency',
    runId: RUN_ID,
    projectType: 'temporary-.cipher-test-fixture',
    manuallyConstructedFinalSceneSpecs: 0,
    realProjectsFingerprintBefore: sha256(realProjectsBefore),
  }
  try {
    // The existing main bundle owns encrypted/.env loading. Read the key only after loading it,
    // never serialize it, and let the actual Pixabay adapter attach it to its HTTPS request.
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    const apiKey = String(process.env.PIXABAY_API_KEY || '').trim()
    if (!apiKey) throw new Error('PIXABAY_API_KEY_REQUIRED_FOR_REAL_CUTOUT_SPIKE')
    if (!fs.existsSync(WORKER)) throw new Error('CUTOUT_WORKER_MISSING:' + WORKER)
    mkdir(RAW_ROOT); mkdir(CUTOUT_ROOT); mkdir(ARTIFACT_ROOT); mkdir(FRAME_ROOT)
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'photo-cutout-spike-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal de spike' })

    // Bounded real source retrieval: exactly one selected download per semantic case. The
    // existing adapter owns SearchPlan, API transport, candidate ranking and validation.
    const usedIds = new Set()
    const sources = []
    for (const definition of SOURCE_CASES) sources.push(await retrieveOneSource(bundle, definition, apiKey, usedIds))
    const sourcesManifestPath = path.join(RUN_ROOT, 'sources-manifest.json')
    writeJson(sourcesManifestPath, workerManifest(sources))
    // Preserve the public provenance before model work starts, so an interrupted benchmark can
    // be inspected without re-querying a provider or losing the source-to-cutout relationship.
    writeJson(path.join(RUN_ROOT, 'source-records.json'), sources.map(source => ({
      id: source.id, label: source.label, candidate: source.candidate, sourcePath: source.sourcePath,
      sourceSha256: source.sourceSha256, sourceBytes: source.sourceBytes, inspection: source.inspection,
      attempts: source.attempts, semantic: source.semantic,
    })))

    // Model download, session load, and local inference stay separate by design.
    const downloads = {}
    const loads = {}
    const benchmark = { version: 1, runId: RUN_ID, models: { u2netp: {}, 'isnet-general-use': {} } }
    for (const model of ['u2netp', 'isnet-general-use']) {
      downloads[model] = runWorker(['download', '--model', model, '--cache', MODEL_CACHE])
      loads[model] = runWorker(['load', '--model', model, '--cache', MODEL_CACHE])
      for (const size of [512, 1024]) {
        benchmark.models[model][String(size)] = runWorker(['benchmark', '--model', model, '--cache', MODEL_CACHE,
          '--manifest', sourcesManifestPath, '--output-dir', CUTOUT_ROOT, '--max-dimension', String(size), '--warm-runs', '3'])
      }
    }
    const qualityBenchmarkPath = path.join(RUN_ROOT, 'quality-benchmark.json')
    writeJson(qualityBenchmarkPath, { version: 1, models: {
      u2netp: benchmark.models.u2netp['1024'], 'isnet-general-use': benchmark.models['isnet-general-use']['1024'],
    } })
    const qualitySheet = path.join(ARTIFACT_ROOT, 'contact-sheet-cutout-quality.png')
    runWorker(['quality-sheet', '--benchmark', qualityBenchmarkPath, '--output', qualitySheet])

    const selectedSource = sources.find(value => value.id === 'person-mid') || sources[0]
    const selectedModel = 'isnet-general-use'
    const selectedOutput = pickModelOutput(benchmark, selectedModel, selectedSource.id)
    const cutoutBytes = fs.readFileSync(selectedOutput.outputPath)
    const published = bundle.publishPixabayImageAssetV1({
      projectRoot: PROJECT_ROOT, candidate: selectedSource.candidate, bytes: cutoutBytes, fetchedAt: new Date().toISOString(),
    })

    // Build support choices from the existing local C retrieval for the same subclip. They are
    // optional by contract; only candidates actually selected by that retrieval become supports.
    const integrationDefinition = {
      id: 'cutout-integration', label: 'mujer con cámara y fotografía', keyword: 'FOTÓGRAFA',
      text: 'la mujer toma una fotografía con una cámara',
      concepts: [{ label: 'mujer', emoji: '👩' }, { label: 'cámara', emoji: '📷' }, { label: 'fotografía', emoji: '📸' }],
    }
    const integrationBase = semanticDecisionFor(bundle, integrationDefinition, integrationDefinition.id, 159201)
    const primary = integrationBase.retrieval.concepts.primary
    if (!primary) throw new Error('CUTOUT_INTEGRATION_PRIMARY_CONCEPT_MISSING')
    const cutoutChoice = lockedCutoutChoice(bundle, primary, published.asset, cutoutBytes)
    const supports = integrationBase.retrieval.selectedSupport
      .filter(candidate => candidate.provider === 'openmoji' && candidate.stableId)
      .slice(0, 2)
      .map((candidate, index) => lockedOpenMojiChoice(bundle, candidate, index === 0 ? 'support-1' : 'support-2'))
    const lockedChoices = [cutoutChoice, ...supports]
    const resolved = await resolveV15WithCutout(bundle, integrationDefinition, lockedChoices, 159201, 'cutout-integration')
    const hero = resolved.resolved.compiled.sceneSpec.slots.find(slot => slot.slotId === 'hero')
    if (!hero || hero.state !== 'present' || hero.kind !== 'photo-cutout' || hero.tint.treatment !== 'original-color')
      throw new Error('CUTOUT_HERO_CONTRACT_NOT_MATERIALIZED')

    // All renderer IO follows this point. Its network gate makes the offline property observable.
    enableOfflineGate()
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttemptsDuringOfflineRender++; callback({ cancel: true }) } else callback({ cancel: false })
    })
    const heroRender = await renderOffline(bundle, resolved, 'end-to-end-cutout-hero')

    // A second ordinary resolver materialization finds an existing layout whose already-certified
    // backing is halo. No slot geometry or rendering component is fabricated by the spike.
    let haloResolved = null
    for (let seed = 159202; seed < 159260; seed++) {
      const attempt = await resolveV15WithCutout(bundle, integrationDefinition, lockedChoices, seed, 'cutout-halo-' + seed)
      const layoutHero = attempt.resolved.compiled.sceneSpec.layout.slotLayouts.find(slot => slot.slotId === 'hero')
      if (layoutHero?.backing === 'halo') { haloResolved = attempt; break }
    }
    if (!haloResolved) throw new Error('CUTOUT_HALO_LAYOUT_NOT_FOUND_IN_EXISTING_V15_FAMILIES')
    const haloRender = await renderOffline(bundle, haloResolved, 'end-to-end-cutout-halo')

    // The file is removed only from the controlled temp project. Preparing the original
    // GraphicData must derive an editorial fallback with a new identity rather than reuse the
    // present-cutout output cache.
    const originalIdentity = bundle.sceneSpecPixelIdentityAny(resolved.resolved.compiled.sceneSpec)
    const originalClipSha = sha256File(heroRender.clip)
    removeFixtureFile(FIXTURE_ROOT, path.join(PROJECT_ROOT, published.asset.relativeFile))
    const missingPrepared = bundle.prepareGraphicForVisualRender({
      graphicData: resolved.resolved.compiled.graphicData, projectRoot: PROJECT_ROOT,
      renderBindings: resolved.resolved.compiled.renderBindings,
    })
    if (missingPrepared.sceneSpec.visualMode !== 'editorial-text' || missingPrepared.scenePixelIdentity === originalIdentity)
      throw new Error('CUTOUT_MISSING_FALLBACK_OR_IDENTITY_INVALID')
    let missingQc = null
    const missingClip = await bundle.renderGraphicClip(resolved.resolved.compiled.graphicData, {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla', sistema: 'editorial', projectRoot: PROJECT_ROOT,
      renderBindings: resolved.resolved.compiled.renderBindings,
      onQcReport: value => { missingQc = value }, onQcFailure: value => { missingQc = value },
    })
    if (!missingClip || sha256File(missingClip) === originalClipSha) throw new Error('CUTOUT_MISSING_CACHE_REUSE_DETECTED')
    const missingVideo = path.join(ARTIFACT_ROOT, 'missing-cutout-fallback.mp4')
    const missingFrame = path.join(ARTIFACT_ROOT, 'missing-cutout-fallback.png')
    fs.copyFileSync(missingClip, missingVideo); frameFromVideo(missingClip, missingFrame)

    const motionSheetManifest = path.join(RUN_ROOT, 'motion-sheet.json')
    writeJson(motionSheetManifest, { cells: [
      { label: 'SOURCE · Pixabay local', path: selectedSource.sourcePath },
      { label: 'CUTOUT · isnet-general-use', path: selectedOutput.outputPath },
      { label: 'CUTOUT HERO · V15 offline', path: heroRender.evidenceFrame },
      { label: 'CUTOUT + PALETTE HALO · V15 offline', path: haloRender.evidenceFrame },
    ] })
    const motionSheet = path.join(ARTIFACT_ROOT, 'contact-sheet-motion-integration.png')
    runWorker(['motion-sheet', '--manifest', motionSheetManifest, '--output', motionSheet])

    const performance = {
      schemaVersion: 1, runtime: loads.u2netp.runtime,
      environment: { pythonExecutable: PYTHON, environmentBytes: treeBytes(path.dirname(path.dirname(PYTHON))), modelCachePath: MODEL_CACHE },
      downloads, loads, benchmark,
      summary: Object.fromEntries(['u2netp', 'isnet-general-use'].map(model => [model, Object.fromEntries([512, 1024].map(size => {
        const row = benchmark.models[model][String(size)]
        return [String(size), { coldModelLoadMs: row.benchmarkSessionLoadMs, coldInferenceMs: row.coldInferenceMs,
          warmMedianMs: row.warmMedianMs, warmP95Ms: row.warmP95Ms, peakRssBytes: row.peakRssBytes,
          fileDeterministic: row.determinism.fileDeterministic, pixelDeterministic: row.determinism.pixelDeterministic }]
      }))])),
    }
    const provenance = {
      schemaVersion: 1, generatedAt: new Date().toISOString(), provider: 'pixabay-images',
      sources: sources.map(source => ({ id: source.id, label: source.label, providerAssetId: source.candidate.id,
        pageUrl: source.candidate.pageUrl, originalUrl: source.candidate.downloadUrl, query: source.candidate.query,
        downloadTimestamp: new Date().toISOString(), sourceSha256: source.sourceSha256, sourceBytes: source.sourceBytes,
        sourceInspection: source.inspection, searches: source.attempts })),
      selectedCutout: { sourceId: selectedSource.id, sourceSha256: selectedSource.sourceSha256,
        model: selectedModel, modelRevision: loads[selectedModel].runtime.rembg + ':' + selectedModel,
        cutoutSha256: sha256(cutoutBytes), cutoutPixelSha256: selectedOutput.rgbaPixelSha256,
        cutoutPath: selectedOutput.outputPath, projectAssetId: published.asset.id, projectAssetSha256: published.asset.sha256 },
    }
    const performancePath = path.join(ARTIFACT_ROOT, 'performance.json')
    const provenancePath = path.join(ARTIFACT_ROOT, 'provenance.json')
    writeJson(performancePath, performance); writeJson(provenancePath, provenance)
    const qualityTemplatePath = path.join(ARTIFACT_ROOT, 'quality-review-template.json')
    writeJson(qualityTemplatePath, { rubric: { subjectCompleteness: '0..3', edgeQuality: '0..3', hairFurQuality: '0..3', internalHoles: '0..3' },
      reviewRequired: true, cases: SOURCE_CASES.map(value => ({ id: value.id, u2netp: null, isnetGeneralUse: null })) })

    const realProjectsAfter = snapshotRealProjects()
    if (realProjectsBefore !== realProjectsAfter) throw new Error('REAL_PROJECTS_CHANGED')
    const output = {
      ...evidence, artifacts: {
        contactSheetCutoutQuality: qualitySheet, contactSheetMotionIntegration: motionSheet,
        performance: performancePath, provenance: provenancePath, qualityReviewTemplate: qualityTemplatePath,
      },
      sources: { count: sources.length, ids: sources.map(source => source.id) },
      cutout: { selectedModel, selectedSourceId: selectedSource.id, projectAsset: { id: published.asset.id, sha256: published.asset.sha256, relativeFile: published.asset.relativeFile },
        alphaUseful: bundle.inspectPixabayRasterImageV1(cutoutBytes).alphaUseful },
      integration: {
        hero: { provider: 'pixabay-images', kind: hero.kind, treatment: hero.tint.treatment },
        supportCount: supports.length, sceneSpecVersion: resolved.resolved.compiled.sceneSpec.renderSpecVersion,
        bindingsVersion: resolved.resolved.compiled.renderBindings.version,
        pixelIdentity: originalIdentity, heroVideo: { path: heroRender.evidenceVideo, sha256: sha256File(heroRender.evidenceVideo), ...probeVideo(heroRender.evidenceVideo) },
        haloVideo: { path: haloRender.evidenceVideo, sha256: sha256File(haloRender.evidenceVideo), family: haloResolved.resolved.compiled.sceneSpec.layout.family },
        offlineNetworkAttempts: networkAttemptsDuringOfflineRender,
      },
      missingAsset: { visualMode: missingPrepared.sceneSpec.visualMode, originalPixelIdentity: originalIdentity,
        fallbackPixelIdentity: missingPrepared.scenePixelIdentity, fallbackVideo: missingVideo, qc: missingQc?.findings || [] },
      realProjectsFingerprintAfter: sha256(realProjectsAfter),
    }
    writeJson(path.join(ARTIFACT_ROOT, 'evidence.json'), output)
    console.log('PHOTO_CUTOUT_SPIKE_EVIDENCE=' + path.join(ARTIFACT_ROOT, 'evidence.json'))
    console.log('PHOTO_CUTOUT_SPIKE_RUN=' + RUN_ROOT)
    finish(0)
  } catch (error) {
    const failure = { ...evidence, status: 'FAIL', error: error && error.message ? error.message : String(error), runRoot: RUN_ROOT }
    try { writeJson(path.join(ARTIFACT_ROOT, 'failure.json'), failure) } catch {}
    console.error(error && error.stack || error)
    finish(1)
  }
}).catch(error => { console.error(error && error.stack || error); finish(1) })
