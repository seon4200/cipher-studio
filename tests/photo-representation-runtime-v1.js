// Productive cutout runtime gate. External provider transport is recorded/local, but runtime
// configuration follows the exact .env -> main-process -> CutoutTransform path used by Cipher.

const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('photo-representation-runtime-v1')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let finished = false
let completed = 0

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

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
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(fs.readFileSync(target)), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function wordsFor (text) {
  const values = text.split(/\s+/).filter(Boolean)
  return values.map((word, index) => ({ word, start: index * .2, end: index * .2 + .16 }))
}

function contextFor (bundle) {
  const text = 'una mujer explica el proyecto'
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: 'runtime-person', start: 0, end: 1.2,
    transcriptSegments: [{ start: 0, end: 1.2, text, words: wordsFor(text) }],
    concepts: [{ label: 'mujer', emoji: '👩', canonicalHint: 'woman', start: .15, end: .55, scope: 'scene' }],
    anchor: 'mujer', relation: 'explica', globalText: text, globalHints: ['mujer'],
    globalContextRef: 'fixture:photo-representation-runtime-v1',
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: 'runtime-person', duration: 1, localSemantic,
    keywordCandidates: [{ keyword: 'MUJER', source: 'scene-semantic' }], preferredVisualMode: 'auto',
    sistema: 'editorial', direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: 190101 },
    videoStyleId: 'cream-editorial', lockedChoices: [],
  })
}

function recordedSearch (url) {
  const query = String(url.searchParams.get('q') || 'woman')
  return Promise.resolve({ hits: [{
    id: 190101, pageURL: 'https://pixabay.com/photos/runtime-person-190101/',
    largeImageURL: 'https://cdn.pixabay.com/photo/runtime-person-190101.png',
    tags: `woman, person, portrait, ${query}`, imageWidth: 1600, imageHeight: 1200, type: 'photo',
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
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture temporal retenido:', error.message) }
  finished = true
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

app.whenReady().then(async () => {
  const projectsBefore = snapshotRealProjects()
  try {
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    await new Promise(resolve => setTimeout(resolve, 250))
    const sourceFile = String(process.env.CIPHER_CUTOUT_TEST_SOURCE || '').trim()
    assert(sourceFile && fs.existsSync(sourceFile), 'CIPHER_CUTOUT_TEST_SOURCE debe apuntar a la foto opaca local ya provisionada')
    const sourceBytes = fs.readFileSync(sourceFile)
    const sourceInspection = bundle.inspectPixabayRasterImageV1(sourceBytes)
    assert.equal(sourceInspection.alphaUseful, false)
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'photo-representation-runtime-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })

    const diagnostic = bundle.diagnoseCutoutRuntimeV1()
    await runCase('1 la configuración productiva resuelve intérprete, worker y modelo local', () => {
      assert.equal(diagnostic.configured, true)
      assert.equal(diagnostic.interpreterExecutable, true)
      assert.equal(diagnostic.workerAvailable, true)
      assert.equal(diagnostic.modelAvailable, true)
      assert.equal(diagnostic.code, 'CUTOUT_RUNTIME_READY')
      assert.equal(diagnostic.ready, true)
    })

    let searches = 0; let downloads = 0
    const hooks = {
      searchRequestJson: async url => { searches++; return recordedSearch(url) },
      downloadRequestBytes: async () => { downloads++; return sourceBytes },
    }
    const context = contextFor(bundle)
    const first = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot: PROJECT_ROOT,
      pixabayApiKey: 'recorded-response', hooks }))[0].resolved
    const firstCutout = first.choices.find(choice => choice.provider === 'photo-cutout')
    await runCase('2 la misma entrada productiva ejecuta una inferencia real sobre foto opaca', () => {
      assert(firstCutout?.asset)
      assert.equal(first.metrics.cutoutInferenceExecuted, 1)
      assert.equal(first.metrics.cutoutCacheHit, 0)
      assert.equal(first.trace.pixabay.some(row => row.outcome === 'PHOTO_CUTOUT_USABLE'), true)
      assert(searches > 0 && downloads > 0)
    })
    await runCase('3 el ProjectAsset derivado verifica bytes y transparencia útil', () => {
      const verified = bundle.readVerifiedRasterProjectAssetContentV1(PROJECT_ROOT, firstCutout.asset)
      assert.equal(verified.inspection.hasAlpha, true)
      assert.equal(verified.inspection.alphaUseful, true)
      assert.equal(firstCutout.asset.provider, 'cutout')
    })

    const second = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot: PROJECT_ROOT,
      pixabayApiKey: 'recorded-response', hooks }))[0].resolved
    await runCase('4 la segunda solicitud reutiliza el cutout derivado sin nueva inferencia', () => {
      assert.equal(second.metrics.cutoutCacheHit, 1)
      assert.equal(second.metrics.cutoutInferenceExecuted, 0)
      assert.equal(second.choices.find(choice => choice.provider === 'photo-cutout')?.asset?.sha256, firstCutout.asset.sha256)
    })

    const sourceAsset = bundle.publishPixabayImageAssetV1({ projectRoot: PROJECT_ROOT, candidate: {
      provider: 'pixabay-images', id: 'runtime-missing', pageUrl: 'https://pixabay.com/photos/runtime-missing/',
      downloadUrl: 'https://cdn.pixabay.com/photo/runtime-missing.png', tags: ['woman'], width: 1600, height: 1200,
      imageType: 'photo', score: 3, reason: 'RECORDED_FIXTURE', query: 'woman', transparentRequested: false,
      requiresDownloadValidation: true,
    }, bytes: sourceBytes, fetchedAt: '2026-09-15T00:00:00.000Z' }).asset
    const unavailable = await bundle.materializePhotoCutoutV1({ projectRoot: PROJECT_ROOT, sourceAsset, runtime: null })
    await runCase('5 runtime ausente produce diagnóstico concreto y fallback no destructivo', () => {
      assert.equal(unavailable.status, 'failed')
      assert.equal(unavailable.attempted, false)
      assert.equal(unavailable.inferenceExecuted, false)
      assert.equal(unavailable.reason, 'CUTOUT_RUNTIME_UNAVAILABLE')
      assert(unavailable.warnings.includes('CUTOUT_RUNTIME_NOT_CONFIGURED'))
      assert.equal(fs.existsSync(bundle.resolveProjectRelativePath(PROJECT_ROOT, sourceAsset.relativeFile)), true)
    })

    await runCase('6 la prueba no tocó proyectos reales', () => assert.equal(snapshotRealProjects(), projectsBefore))
    assert.equal(completed, 6)
    console.log('RUNTIME_DIAGNOSTIC=' + JSON.stringify(diagnostic))
    console.log('REAL_OPAQUE_PHOTO_INFERENCES=' + first.metrics.cutoutInferenceExecuted)
    console.log('CUTOUT_CACHE_REUSE=' + second.metrics.cutoutCacheHit)
    finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    finish(1)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  finish(1)
})
