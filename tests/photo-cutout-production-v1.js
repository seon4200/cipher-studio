// Product gate for the V15 Photo Cutout Production V1 path.  It uses a marked temporary
// project, exercises the real resolver/compiler/renderer, and mocks only external transport and
// the isolated Python sidecar.  No final SceneSpec or RenderBindings is injected by the test.

const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture, removeFixtureFile } = require('./helpers/safe-fixture')
const { PHOTO_CUTOUT_PRODUCTION_CORPUS_V1 } = require('./fixtures/photo-cutout-production-corpus-v1')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('photo-cutout-production-v1')
const CASES_EXPECTED = 15
let completed = 0
let finished = false
let networkAttempts = 0
let unrelatedBackgroundNetworkAttempts = 0
let workersRun = 0
let renderWindow = null
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const clone = value => JSON.parse(JSON.stringify(value))
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

function crc32 (bytes) {
  let crc = 0xffffffff
  for (const value of bytes) {
    crc ^= value
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngRgba (red, green, blue, opaque = false) {
  const width = 160; const height = 160
  const chunk = (type, data) => {
    const label = Buffer.from(type)
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])))
    return Buffer.concat([length, label, data, checksum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4
      const inside = ((x - 80) ** 2) / 4300 + ((y - 77) ** 2) / 5100 < 1
      raw[offset] = red; raw[offset + 1] = green; raw[offset + 2] = blue
      raw[offset + 3] = opaque || inside ? 255 : 0
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function snapshotRealProjects () {
  const root = path.join(REPO_ROOT, 'proyectos')
  const entries = []
  const walk = directory => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile() && ['project-state.json', 'project-state.json.bak', 'manifest.json'].includes(entry.name)) {
        const stat = fs.statSync(target)
        entries.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(fs.readFileSync(target)), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(entries.sort((a, b) => a[0].localeCompare(b[0])))
}

function wordsFor (text, start = 10, end = 12.5) {
  const words = String(text).split(/\s+/).filter(Boolean)
  return words.map((word, index) => ({
    word,
    start: start + ((end - start) * index / words.length),
    end: start + ((end - start) * (index + .82) / words.length),
  }))
}

function contextFor (bundle, row, index) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: row.id, start: 10, end: 12.5,
    transcriptSegments: [{ start: 9.85, end: 12.65, text: row.text, words: wordsFor(row.text) }],
    concepts: row.concepts.map(concept => ({ ...concept, start: 10.05, end: 12.4, scope: 'scene' })),
    anchor: row.concepts[0]?.label, relation: 'documenta', globalText: row.text,
    globalHints: row.concepts.map(concept => concept.label), globalContextRef: 'fixture:photo-cutout-production:' + row.id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: row.id, duration: 1, localSemantic,
    keywordCandidates: [{ keyword: row.keyword, source: 'scene-semantic' }],
    preferredVisualMode: row.preferredVisualMode || 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: 160100 + index },
    videoStyleId: 'cream-editorial',
  })
}

function opaqueSourceFor (query) {
  const digest = crypto.createHash('sha256').update(query).digest()
  return pngRgba(40 + digest[0] % 180, 40 + digest[1] % 180, 40 + digest[2] % 180, true)
}

function mockPixabaySearch (url) {
  const query = String(url.searchParams.get('q') || 'object')
  const id = sha256(query).slice(0, 12)
  return Promise.resolve({ hits: [{
    id, pageURL: `https://pixabay.com/photos/fixture-${id}/`,
    largeImageURL: `https://cdn.pixabay.com/photo/fixture-${id}.png`,
    tags: query, imageWidth: 1200, imageHeight: 1200, type: 'photo',
  }] })
}

async function runCase (name, fn) {
  await fn()
  completed++
  console.log('OK ' + name)
}

function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { renderWindow?.destroy() } catch {}
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  finished = true
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => {
  if (!finished) {
    console.error(`FALLO: CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${CASES_EXPECTED}`)
    process.exitCode = 1
  }
})

app.whenReady().then(async () => {
  const projectFingerprintBefore = snapshotRealProjects()
  const recordBlockedNetwork = value => {
    const url = String(value?.url || value?.href || value || '')
    if (/elevenlabs\.io/i.test(url)) unrelatedBackgroundNetworkAttempts++
    else networkAttempts++
  }
  const block = value => { recordBlockedNetwork(value); throw new Error('RED BLOQUEADA EN PHOTO CUTOUT PRODUCTION') }
  global.fetch = block; http.request = block; https.request = block
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { recordBlockedNetwork(details.url); callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  await new Promise(resolve => setTimeout(resolve, 650))
  const networkAttemptsAtGate = networkAttempts
  const projectRoot = path.join(FIXTURE_ROOT, 'project')
  const modelCache = path.join(FIXTURE_ROOT, 'cutout-runtime')
  const modelFile = path.join(modelCache, 'models', 'u2netp', 'u2netp.onnx')
  fs.mkdirSync(path.dirname(modelFile), { recursive: true })
  const modelBytes = Buffer.from('fixture-u2netp-production-v1')
  fs.writeFileSync(modelFile, modelBytes)
  const modelRevision = 'sha256:' + sha256(modelBytes)
  const runtime = {
    pythonExecutable: process.execPath,
    workerFile: path.join(REPO_ROOT, 'tools', 'photo-cutout-production', 'cutout_worker.py'),
    modelCache,
    maxDimension: 1024,
  }
  const cutoutWorker = async request => {
    workersRun++
    const source = fs.readFileSync(request.inputFile)
    const digest = crypto.createHash('sha256').update(source).digest()
    const output = pngRgba(55 + digest[0] % 160, 55 + digest[1] % 160, 55 + digest[2] % 160, false)
    fs.writeFileSync(request.outputFile, output)
    return {
      status: 'OK', action: 'transform', model: request.model, modelRevision,
      sourceSha256: sha256(source), outputSha256: sha256(output), outputBytes: output.length,
      modelLoadMs: 4, processingMs: 154, width: 160, height: 160, alphaPresent: true, alphaUseful: true,
      transparentPixelPercent: 42, alphaBoundingBox: { x: 18, y: 12, width: 124, height: 138 },
    }
  }
  const hooks = {
    searchRequestJson: mockPixabaySearch,
    downloadRequestBytes: async url => opaqueSourceFor(url.toString()),
    cutout: { runWorker: cutoutWorker }, cutoutRuntime: runtime,
  }
  bundle.createProjectFiles(projectRoot, { id: 'photo-cutout-production-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })

  try {
    await runCase('1 VERSION_PLANTILLAS permanece 15 y el modelo provisional es u2netp', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
      assert.equal(bundle.CUTOUT_DEFAULT_MODEL_V1, 'u2netp')
      assert.equal(bundle.CUTOUT_WEIGHT_LICENSE_GATE, 'PENDING_BEFORE_COMMERCIAL_DISTRIBUTION')
    })
    await runCase('2 las preferencias de representación son puras y no son una cuota de assets', () => {
      const person = { normalizedTerm: 'persona', originalTerm: 'persona', aliases: [], emoji: '🧑', subject: 'person', importance: 3, preferredRole: 'hero', evidence: 'direct-timed-concept' }
      const symbol = { normalizedTerm: 'reloj', originalTerm: 'reloj', aliases: [], emoji: '⏱️', subject: 'symbol', importance: 3, preferredRole: 'hero', evidence: 'direct-timed-concept' }
      const abstractNominal = { normalizedTerm: 'decision', originalTerm: 'decisión', aliases: ['decisión', 'lightbulb'], subject: 'object', importance: 2, preferredRole: 'hero', evidence: 'direct-timed-concept' }
      assert.equal(bundle.resolveAssetRepresentationPreferenceV1({ concept: person, role: 'hero' }).preference, 'photo-cutout')
      assert.equal(bundle.resolveAssetRepresentationPreferenceV1({ concept: symbol, role: 'hero' }).preference, 'symbolic')
      assert.equal(bundle.resolveAssetRepresentationPreferenceV1({ concept: abstractNominal, role: 'support-1' }).preference, 'symbolic')
    })
    const opaque = opaqueSourceFor('manual-source')
    const sourceCandidate = {
      provider: 'pixabay-images', id: 'manual-source', pageUrl: 'https://pixabay.com/photos/manual-source/',
      downloadUrl: 'https://cdn.pixabay.com/photo/manual-source.png', tags: ['person'], width: 1200, height: 1200,
      imageType: 'photo', score: 3, reason: 'FIXTURE', query: 'person', transparentRequested: false, requiresDownloadValidation: true,
    }
    const sourceAsset = bundle.publishPixabayImageAssetV1({ projectRoot, candidate: sourceCandidate, bytes: opaque,
      fetchedAt: '2026-09-11T00:00:00.000Z' }).asset
    const firstCutout = await bundle.materializePhotoCutoutV1({ projectRoot, sourceAsset, runtime, hooks: { runWorker: cutoutWorker } })
    await runCase('3 CutoutTransform publica un ProjectAsset derivado RGBA verificable', () => {
      assert.equal(firstCutout.status, 'usable')
      assert.equal(firstCutout.quality, 'CUTOUT_USABLE')
      assert(firstCutout.asset)
      const verified = bundle.readVerifiedRasterProjectAssetContentV1(projectRoot, firstCutout.asset)
      assert.equal(verified.inspection.alphaUseful, true)
      assert.equal(firstCutout.asset.provider, 'cutout')
      assert.equal(firstCutout.cacheHit, false)
    })
    const workersAfterFirst = workersRun
    const cachedCutout = await bundle.materializePhotoCutoutV1({ projectRoot, sourceAsset, runtime, hooks: { runWorker: cutoutWorker } })
    await runCase('4 source SHA + modelo + revisión reutilizan el cutout sin volver a invocar rembg', () => {
      assert.equal(cachedCutout.status, 'usable')
      assert.equal(cachedCutout.cacheHit, true)
      assert.equal(cachedCutout.asset.sha256, firstCutout.asset.sha256)
      assert.equal(workersRun, workersAfterFirst)
    })
    await runCase('5 un alpha no usable se clasifica y el siguiente candidato puede recuperar el cutout', async () => {
      const badSourceAsset = bundle.publishPixabayImageAssetV1({ projectRoot, candidate: {
        ...sourceCandidate, id: 'manual-source-bad', pageUrl: 'https://pixabay.com/photos/manual-source-bad/',
        downloadUrl: 'https://cdn.pixabay.com/photo/manual-source-bad.png',
      }, bytes: opaqueSourceFor('manual-source-bad'), fetchedAt: '2026-09-11T00:00:00.000Z' }).asset
      const suspicious = await bundle.materializePhotoCutoutV1({ projectRoot, sourceAsset: badSourceAsset, runtime, hooks: { runWorker: async request => {
        const output = pngRgba(30, 30, 30, true); fs.writeFileSync(request.outputFile, output)
        return { status: 'OK', action: 'transform', model: request.model, modelRevision,
          sourceSha256: badSourceAsset.sha256, outputSha256: sha256(output), outputBytes: output.length,
          modelLoadMs: 1, processingMs: 1, width: 160, height: 160, alphaPresent: true, alphaUseful: false,
          transparentPixelPercent: 0, alphaBoundingBox: null }
      } } })
      assert.equal(suspicious.status, 'failed')
      assert.equal(suspicious.quality, 'CUTOUT_FAILED')
      assert.equal(suspicious.asset, undefined)
      let retryWorkerCalls = 0
      const retryContext = contextFor(bundle, {
        id: 'retry-person-candidate', keyword: 'PERSONA', text: 'una persona comparte su experiencia',
        concepts: [{ label: 'persona', emoji: '🧑', canonicalHint: 'user' }],
      }, 99)
      const retryHooks = {
        searchRequestJson: async url => {
          const query = String(url.searchParams.get('q') || 'person')
          return { hits: [
            { id: 990001, pageURL: 'https://pixabay.com/photos/retry-first/', largeImageURL: 'https://cdn.pixabay.com/photo/retry-first.png', tags: query, imageWidth: 1200, imageHeight: 1200, type: 'photo' },
            { id: 990002, pageURL: 'https://pixabay.com/photos/retry-second/', largeImageURL: 'https://cdn.pixabay.com/photo/retry-second.png', tags: query, imageWidth: 1200, imageHeight: 1200, type: 'photo' },
          ] }
        },
        downloadRequestBytes: async url => opaqueSourceFor(url.toString()),
        cutoutRuntime: runtime,
        cutout: { runWorker: async request => {
          retryWorkerCalls++
          const output = pngRgba(40, 120, 180, retryWorkerCalls === 1)
          fs.writeFileSync(request.outputFile, output)
          return { status: 'OK', action: 'transform', model: request.model, modelRevision,
            sourceSha256: sha256(fs.readFileSync(request.inputFile)), outputSha256: sha256(output), outputBytes: output.length,
            modelLoadMs: 1, processingMs: 2, width: 160, height: 160, alphaPresent: true,
            alphaUseful: retryWorkerCalls !== 1, transparentPixelPercent: retryWorkerCalls === 1 ? 0 : 42,
            alphaBoundingBox: retryWorkerCalls === 1 ? null : { x: 18, y: 12, width: 124, height: 138 } }
        } },
      }
      const retried = await bundle.resolveModernVisualGenerationBatchV2({ contexts: [retryContext], projectRoot,
        pixabayApiKey: 'fixture-key', hooks: retryHooks })
      assert.equal(retried[0].resolved.choices.find(choice => choice.slotId === 'hero')?.provider, 'photo-cutout')
      assert(retried[0].resolved.trace.pixabay.some(item => String(item.outcome).startsWith('PHOTO_CUTOUT_FALLBACK_FULL_RASTER:')))
      assert(retryWorkerCalls >= 2)
    })
    const acceptanceIds = new Set(['person-microphone', 'object-camera', 'place-hospital', 'symbol-clock', 'editorial-recovery'])
    const contexts = PHOTO_CUTOUT_PRODUCTION_CORPUS_V1
      .filter(row => acceptanceIds.has(row.id)).map((row, index) => contextFor(bundle, row, index))
    // Direct provider evidence remains an icon contract even though automatic physical concepts
    // now receive a bounded photo opportunity before their semantic emoji fallback.
    contexts.push(contextFor(bundle, { id: 'direct-openmoji-cake', keyword: '1F382',
      text: '1F382 identifica directamente el icono elegido', concepts: [{ label: '1F382' }] }, contexts.length))
    contexts.push(contextFor(bundle, { id: 'symbol-hero-object-support', keyword: 'TIEMPO',
      text: 'el reloj acompaña a la cámara', concepts: [
        { label: 'reloj', emoji: '⏱️', canonicalHint: 'clock' },
        { label: 'cámara', emoji: '📷', canonicalHint: 'camera' },
      ] }, contexts.length))
    const resolved = await bundle.resolveModernVisualGenerationBatchV2({ contexts, projectRoot, pixabayApiKey: 'fixture-key', hooks })
    await runCase('6 el corpus congelado tiene veinte escenas y la muestra recorre la ruta moderna real', () => {
      assert.equal(PHOTO_CUTOUT_PRODUCTION_CORPUS_V1.length, 20)
      assert.equal(resolved.length, 7)
      assert(resolved.every(row => row.resolved.compiled.sceneSpec.renderSpecVersion === 2))
      assert(resolved.every(row => row.resolved.compiled.renderBindings.version === 2))
    })
    const summary = bundle.summarizeMotionGraphicsVideoMetricsV2(resolved.map(row => row.resolved))
    await runCase('7 la mezcla se mide por recurso materializado, sin convertir editoriales en éxito', () => {
      assert(summary.photoCutoutHero + summary.photoCutoutSupport > 0)
      assert(summary.fullRasterHero + summary.fullRasterSupport > 0)
      assert(summary.openMojiHero + summary.openMojiSupport > 0)
      assert(summary.solarHero + summary.solarSupport > 0)
      assert(summary.editorialOnly >= 1)
      assert(summary.cutoutAttempted >= 1)
      assert(summary.cutoutUsable >= 1)
      assert.equal(summary.cutoutFailed, 0)
    })
    const cutoutHero = resolved.find(row => row.resolved.choices.some(choice => choice.provider === 'photo-cutout' && choice.slotId === 'hero'))
    await runCase('8 persona u objeto físico puede materializarse como Hero cutout con Support semántico', () => {
      assert(cutoutHero)
      const choices = cutoutHero.resolved.choices
      assert(choices.some(choice => choice.provider === 'photo-cutout' && choice.slotId === 'hero'))
      assert(choices.some(choice => choice.slotId !== 'hero' && ['openmoji', 'solar', 'pixabay-images', 'photo-cutout'].includes(choice.provider)))
    })
    const iconHeroCutoutSupport = resolved.find(row => row.resolved.choices.some(choice => ['openmoji', 'solar'].includes(choice.provider) && choice.slotId === 'hero') &&
      row.resolved.choices.some(choice => choice.provider === 'photo-cutout' && choice.slotId !== 'hero'))
    await runCase('9 Hero y Support compiten: icono Hero + cutout Support sigue siendo una composición válida', () => {
      assert(iconHeroCutoutSupport)
    })
    await runCase('10 full raster conserva contexto para lugar/evento y Solar permanece simbólico', () => {
      assert(resolved.some(row => row.resolved.choices.some(choice => choice.provider === 'pixabay-images' && choice.representation === 'full-raster')))
      assert(resolved.some(row => row.resolved.choices.some(choice => choice.provider === 'solar')))
    })
    const editorial = resolved.find(row => row.context.sceneId === 'editorial-recovery')
    await runCase('11 editorial sigue disponible sólo cuando no aparece un recurso defendible', () => {
      assert(editorial)
      assert.equal(editorial.resolved.compiled.sceneSpec.visualMode, 'editorial-text')
      assert.equal(editorial.resolved.metrics.editorialOnly, 1)
    })
    const regenerated = await bundle.resolveModernVisualGenerationBatchV2({ contexts: resolved.map(row => clone(row.context)),
      projectRoot, pixabayApiKey: 'fixture-key', hooks })
    await runCase('12 generación y regeneración restauran la misma SceneSpec y PixelIdentity', () => {
      for (let index = 0; index < resolved.length; index++) {
        assert.equal(bundle.sceneSpecPixelIdentityAny(regenerated[index].resolved.compiled.sceneSpec),
          bundle.sceneSpecPixelIdentityAny(resolved[index].resolved.compiled.sceneSpec))
      }
    })
    let qc = null
    const renderTarget = cutoutHero.resolved
    const clip = await bundle.renderGraphicClip(renderTarget.compiled.graphicData, {
      ancho: 360, alto: 640, fps: 8, duracion: 1, modo: 'pantalla', sistema: 'editorial', projectRoot,
      renderBindings: renderTarget.compiled.renderBindings,
      onQcReport: report => { qc = report }, onQcFailure: report => { qc = report },
    })
    await runCase('13 el render offline V15 consume el cutout por bindings y pasa QC', () => {
      assert(clip && fs.existsSync(clip))
      assert(qc && qc.findings.every(finding => finding.level !== 'error'))
      assert.equal(networkAttempts - networkAttemptsAtGate, 0)
    })
    await runCase('14 el missing asset no devuelve el cache del cutout presente', () => {
      const cutoutChoice = renderTarget.choices.find(choice => choice.provider === 'photo-cutout')
      assert(cutoutChoice?.asset)
      removeFixtureFile(FIXTURE_ROOT, path.join(projectRoot, cutoutChoice.asset.relativeFile))
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: renderTarget.compiled.graphicData, projectRoot,
        renderBindings: renderTarget.compiled.renderBindings })
      assert.equal(prepared.sceneSpec.visualMode, 'editorial-text')
      assert.notEqual(prepared.scenePixelIdentity, bundle.sceneSpecPixelIdentityAny(renderTarget.compiled.sceneSpec))
    })
    await runCase('15 no se tocó un proyecto real y el renderer no recibió provider, URL ni rutas absolutas', () => {
      assert.equal(snapshotRealProjects(), projectFingerprintBefore)
      assert.equal(JSON.stringify(renderTarget.compiled.sceneSpec).includes('https://'), false)
      assert.equal(JSON.stringify(renderTarget.compiled.sceneSpec).includes('cutout-runtime'), false)
    })
    assert.equal(completed, CASES_EXPECTED)
    finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    finish(1)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  finish(1)
})
