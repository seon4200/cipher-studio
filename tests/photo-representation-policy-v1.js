// Contract gate for automatic photo opportunity versus explicit/persisted icon authority.

const { app, BrowserWindow, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('photo-representation-policy-v1')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let completed = 0
let finished = false

function crc32 (bytes) {
  let crc = 0xffffffff
  for (const value of bytes) {
    crc ^= value
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function rgbaFixture () {
  const width = 180; const height = 180
  const chunk = (type, data) => {
    const label = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])))
    return Buffer.concat([length, label, data, checksum])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4
      const inside = x > 20 && x < 160 && y > 24 && y < 158
      raw[offset] = 28; raw[offset + 1] = 42; raw[offset + 2] = 55; raw[offset + 3] = inside ? 255 : 0
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function wordsFor (text) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, index) => ({ word, start: index * .18, end: index * .18 + .14 }))
}

function contextFor (bundle, id, keyword, text, concepts, seed = 191000) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: id, start: 0, end: 1.4,
    transcriptSegments: [{ start: 0, end: 1.4, text, words: wordsFor(text) }],
    concepts: concepts.map((concept, index) => ({ ...concept, start: .1 + index * .2, end: .28 + index * .2, scope: 'scene' })),
    anchor: concepts[0]?.label, relation: 'relaciona', globalText: text,
    globalHints: concepts.map(concept => concept.label), globalContextRef: 'fixture:' + id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: id, duration: 1, localSemantic,
    keywordCandidates: [{ keyword, source: 'scene-semantic' }], preferredVisualMode: 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: seed },
    videoStyleId: 'cream-editorial', lockedChoices: [],
  })
}

function recordedSearch (url) {
  const query = String(url.searchParams.get('q') || 'camera')
  const canonical = /camera/i.test(query) ? 'camera' : /clock|time/i.test(query) ? 'clock' : query.split(/\s+/)[0]
  return Promise.resolve({ hits: [{
    id: crypto.createHash('sha256').update(query).digest('hex').slice(0, 10),
    pageURL: `https://pixabay.com/photos/${canonical}-fixture/`,
    largeImageURL: `https://cdn.pixabay.com/photo/${canonical}-fixture.png`,
    tags: `${canonical}, ${query}, isolated, photography`, imageWidth: 1400, imageHeight: 1200, type: 'photo',
  }] })
}

async function runCase (name, fn) {
  await fn(); completed++; console.log('OK ' + name)
}

function finish (code) {
  global.fetch = originalFetch; http.request = originalHttpRequest; https.request = originalHttpsRequest
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture temporal retenido:', error.message) }
  finished = true
  // Only windows owned by this isolated Electron fixture are destroyed. This closes utility
  // children cleanly so npm's serial runner is not held by main bootstrap after the verdict.
  for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.destroy()
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

app.whenReady().then(async () => {
  try {
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    await new Promise(resolve => setTimeout(resolve, 250))
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'photo-representation-policy-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })
    const cameraContext = contextFor(bundle, 'camera-hint', 'CÁMARA', 'la cámara documenta la historia',
      [{ label: 'cámara', emoji: '📷', canonicalHint: 'camera' }])
    const cameraPlans = bundle.buildVisualSearchPlansV1({
      intent: bundle.createAssetIntentV1({ sceneId: 'camera-hint', keyword: 'CÁMARA', concepts: ['cámara'] }),
      localSemantic: cameraContext.localSemantic,
    })
    const camera = cameraPlans.concepts.primary

    await runCase('1 objeto físico con emoji semántico obtiene oportunidad fotográfica antes del icono', () => {
      const decision = bundle.resolveAssetRepresentationPreferenceV1({ concept: camera, role: 'hero' })
      assert.equal(decision.reason, 'REPRESENTATION_PHYSICAL_CONCEPT_WITH_SEMANTIC_EMOJI_HINT')
      assert.deepEqual(decision.attemptOrder, ['photo-cutout', 'icon', 'symbolic', 'full-raster', 'editorial'])
    })

    const hex = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'cake-direct', keyword: '1F382', concepts: ['1F382'] }) })
    await runCase('2 evidencia OpenMoji directa conserva la vía iconográfica sin abrir fotografía', () => {
      assert.equal(hex.selectedHero?.stableId, 'openmoji:1f382')
      const decision = bundle.resolveAssetRepresentationPreferenceV1({ concept: hex.concepts.primary, role: 'hero' })
      assert.deepEqual(decision.attemptOrder, ['icon', 'symbolic', 'editorial'])
      assert.equal(decision.cutoutEligible, false)
    })

    const iconOnly = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [cameraContext], projectRoot: PROJECT_ROOT }))[0]
    assert(iconOnly.resolved.choices.some(choice => choice.provider === 'openmoji'))
    let lockedSearches = 0
    const locked = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [iconOnly.context], projectRoot: PROJECT_ROOT,
      pixabayApiKey: 'recorded', hooks: { searchRequestJson: async url => { lockedSearches++; return recordedSearch(url) },
        downloadRequestBytes: async () => rgbaFixture() } }))[0].resolved
    await runCase('3 una elección persistida de icono se restaura y no consulta fotografías', () => {
      assert.equal(lockedSearches, 0)
      assert.equal(locked.choices.some(choice => choice.provider === 'openmoji'), true)
      assert(locked.trace.representation.every(row => row.outcome === 'LOCKED_RESTORED'))
    })

    let heroSearches = 0
    const hero = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [cameraContext], projectRoot: PROJECT_ROOT,
      pixabayApiKey: 'recorded', hooks: { searchRequestJson: async url => { heroSearches++; return recordedSearch(url) },
        downloadRequestBytes: async () => rgbaFixture() } }))[0].resolved
    await runCase('4 un objeto físico puede materializar fotografía como Hero', () => {
      assert.equal(hero.choices.some(choice => choice.provider === 'photo-cutout' && choice.slotId === 'hero'), true)
      assert(heroSearches > 0)
      assert.equal(hero.metrics.photoOpportunities, 1)
      assert.equal(hero.metrics.cutoutSourceAlphaReused, 1)
    })

    const supportContext = contextFor(bundle, 'clock-camera', 'TIEMPO', 'el reloj acompaña a la cámara', [
      { label: 'reloj', emoji: '⏱️', canonicalHint: 'clock' },
      { label: 'cámara', emoji: '📷', canonicalHint: 'camera' },
    ], 191001)
    const support = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [supportContext], projectRoot: PROJECT_ROOT,
      pixabayApiKey: 'recorded', hooks: { searchRequestJson: recordedSearch, downloadRequestBytes: async () => rgbaFixture() } }))[0].resolved
    await runCase('5 un objeto físico puede entrar como Support junto a Hero simbólico', () => {
      assert.equal(support.choices.some(choice => choice.provider === 'solar' && choice.slotId === 'hero'), true)
      assert.equal(support.choices.some(choice => choice.provider === 'photo-cutout' && choice.slotId !== 'hero'), true)
    })

    let abstractSearches = 0
    const abstractContext = contextFor(bundle, 'ai-symbolic', 'IA', 'la inteligencia artificial procesa datos',
      [{ label: 'inteligencia artificial', emoji: '🧠', canonicalHint: 'brain' }], 191002)
    const abstract = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [abstractContext], projectRoot: PROJECT_ROOT,
      pixabayApiKey: 'recorded', hooks: { searchRequestJson: async url => { abstractSearches++; return recordedSearch(url) } } }))[0].resolved
    await runCase('6 un concepto simbólico no abre fotografía arbitraria', () => {
      assert.equal(abstractSearches, 0)
      assert.equal(abstract.metrics.photoOpportunities, 0)
      assert.equal(abstract.choices.some(choice => choice.provider === 'solar' || choice.provider === 'openmoji'), true)
    })

    await runCase('7 el presupuesto fotográfico compartido permanece acotado por escena', () => {
      for (const resolved of [hero, support, abstract]) {
        assert(resolved.metrics.photoRequests <= bundle.PHOTO_SCENE_BUDGET_V1.requests)
        assert(resolved.metrics.photoDownloads <= bundle.PHOTO_SCENE_BUDGET_V1.downloads)
        assert(resolved.metrics.photoTransformCalls <= bundle.PHOTO_SCENE_BUDGET_V1.transforms)
      }
      assert.deepEqual(bundle.PHOTO_SCENE_BUDGET_V1, { requests: 4, downloads: 4, transforms: 2 })
    })

    assert.equal(completed, 7)
    console.log('PHOTO_POLICY_METRICS=' + JSON.stringify(bundle.summarizeMotionGraphicsVideoMetricsV2([hero, support, abstract])))
    finish(0)
  } catch (error) {
    console.error(error && error.stack || error); finish(1)
  }
}).catch(error => { console.error(error && error.stack || error); finish(1) })
