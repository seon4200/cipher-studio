// Contract-only gate for the isolated local photo-cutout spike.
//
// rembg itself remains outside the product/runtime and is exercised by the
// acceptance harness. This suite proves that a verified transparent raster can
// travel through the existing V15 ProjectAsset -> SceneSpec -> bindings -> QC
// -> offline renderer path without a second renderer or cache ambiguity.

const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture, removeFixtureFile } = require('./helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('photo-cutout-spike-v1')
const CASOS_ESPERADOS = 10
let completed = 0
let finished = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const clone = value => JSON.parse(JSON.stringify(value))

function sha256 (value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function crc32 (bytes) {
  let crc = 0xffffffff
  for (const value of bytes) {
    crc ^= value
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngRgba (red, green, blue, opaque = false) {
  const width = 128; const height = 128
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
      const inside = ((x - 64) ** 2) / 2500 + ((y - 62) ** 2) / 3400 < 1
      raw[offset] = red; raw[offset + 1] = green; raw[offset + 2] = blue; raw[offset + 3] = opaque || inside ? 255 : 0
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function candidate (id) {
  return {
    provider: 'pixabay-images', id,
    pageUrl: `https://pixabay.com/photos/spike-${id}/`,
    downloadUrl: `https://cdn.pixabay.com/spike-${id}.png`,
    tags: ['woman', 'portrait'], width: 1200, height: 900,
    imageType: 'photo', score: 3, reason: 'CUTOUT_SPIKE_FIXTURE', query: 'woman portrait',
    transparentRequested: true, requiresDownloadValidation: true,
  }
}

function baseDecision (bundle, projectRoot, sceneId, seed) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId, start: 0, end: 2,
    transcriptSegments: [{ start: 0, end: 2, text: 'la mujer toma una fotografía', words: [
      { word: 'la', start: 0.02, end: 0.1 }, { word: 'mujer', start: 0.12, end: 0.58 },
      { word: 'toma', start: 0.6, end: 0.9 }, { word: 'una', start: 0.92, end: 1.0 },
      { word: 'fotografía', start: 1.02, end: 1.78 },
    ] }],
    concepts: [{ label: 'mujer', emoji: '👩', start: 0.12, end: 0.58, scope: 'scene' }],
    anchor: 'mujer', relation: 'documenta', globalText: 'la mujer toma una fotografía',
    globalHints: ['mujer', 'fotografía'], globalContextRef: 'fixture:photo-cutout-spike',
  })
  return bundle.resolveLocalSemanticVisualSceneV1({
    localSemantic,
    keywordCandidates: [{ keyword: 'MUJER', source: 'scene-semantic' }],
    preferredVisualMode: 'auto', projectRoot, sistema: 'editorial',
    direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: seed },
  })
}

function lockedCutout (bundle, base, asset, bytes) {
  const concept = base.trace.retrieval.concepts.primary
  assert(concept, 'la semántica moderna debe conservar concepto primario')
  return {
    slotId: 'hero', concept: concept.normalizedTerm, provider: 'pixabay-images',
    reason: 'SPIKE_CUTOUT_LOCAL_TRANSFORM', score: 3,
    assetId: asset.id, relativeFile: asset.relativeFile, sha256: asset.sha256, mime: asset.mime,
    bounds: bundle.subjectBoundsFromPixabayRasterV1(bytes), kind: 'photo-cutout', alphaMode: 'useful-alpha',
  }
}

async function runCase (name, fn) {
  await fn()
  completed += 1
  console.log('OK ' + name)
}

function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => {
  if (!finished) {
    console.error(`FALLO: CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
    process.exitCode = 1
  }
})

app.whenReady().then(async () => {
  const block = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA EN PHOTO CUTOUT SPIKE') }
  global.fetch = block; http.request = block; https.request = block
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts += 1; callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  // Electron bootstraps pre-existing application services (including a legacy voice refresh)
  // before this fixture owns rendering. It is blocked, then excluded as startup noise; every
  // request after this barrier would belong to the V15 cutout render being tested.
  await new Promise(resolve => setTimeout(resolve, 800))
  const networkAttemptsAtRenderGate = networkAttempts
  const projectRoot = path.join(FIXTURE_ROOT, 'project')
  bundle.createProjectFiles(projectRoot, { id: 'photo-cutout-spike', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })
  const bytes = pngRgba(44, 156, 235)
  const published = bundle.publishPixabayImageAssetV1({ projectRoot, candidate: candidate('cutout-a'), bytes,
    fetchedAt: '2026-09-11T00:00:00.000Z' })
  const base = baseDecision(bundle, projectRoot, 'cutout-scene', 151501)
  const locked = lockedCutout(bundle, base, published.asset, bytes)
  const result = await bundle.resolveMotionGraphicsSceneV2({ base, projectRoot, videoStyleId: 'cream-editorial', lockedChoices: [locked] })

  try {
    await runCase('1 VERSION_PLANTILLAS permanece 15', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
    })
    await runCase('2 el contrato existente admite photo-cutout RGBA sin schema nuevo', () => {
      const slot = result.compiled.sceneSpec.slots.find(value => value.slotId === 'hero')
      assert.equal(slot.state, 'present')
      assert.equal(slot.kind, 'photo-cutout')
      assert.equal(slot.alphaMode, 'useful-alpha')
      assert.equal(slot.tint.treatment, 'original-color')
      assert.equal(result.compiled.renderBindings.version, 2)
      assert.equal(result.compiled.renderBindings.assets.length, 1)
    })
    await runCase('3 ProjectAsset verifica bytes alpha y SubjectBounds antes de render', () => {
      const verified = bundle.readVerifiedRasterProjectAssetContentV1(projectRoot, published.asset)
      assert.equal(verified.inspection.alphaUseful, true)
      assert.equal(sha256(verified.bytes), published.asset.sha256)
      assert.equal(result.compiled.sceneSpec.slots[0].bounds.revision, 'subject-bounds-v1')
    })
    await runCase('4 la compilación V15 real produce SceneSpec y bindings sin provider en PixelIdentity', () => {
      assert.equal(JSON.stringify(result.compiled.sceneSpec).includes('pixabay'), false)
      assert.equal(JSON.stringify(result.compiled.renderBindings).includes('https://'), false)
      assert.match(bundle.sceneSpecReactKeyAny(result.compiled.sceneSpec), /^scene-v2\|/)
    })
    await runCase('5 mismo cutout y misma semántica producen identidad y hash estables', async () => {
      const repeated = await bundle.resolveMotionGraphicsSceneV2({ base: clone(base), projectRoot,
        videoStyleId: 'cream-editorial', lockedChoices: [clone(locked)] })
      assert.equal(bundle.sceneSpecPixelIdentityAny(repeated.compiled.sceneSpec),
        bundle.sceneSpecPixelIdentityAny(result.compiled.sceneSpec))
      assert.equal(bundle.hashGrafico(repeated.compiled.graphicData, 360, 640, 1, 8, 'pantalla', 'editorial'),
        bundle.hashGrafico(result.compiled.graphicData, 360, 640, 1, 8, 'pantalla', 'editorial'))
    })
    await runCase('6 bytes de cutout distintos cambian PixelIdentity sin depender de provider o path', async () => {
      const alternativeBytes = pngRgba(245, 80, 88)
      const alternativeAsset = bundle.publishPixabayImageAssetV1({ projectRoot, candidate: candidate('cutout-b'), bytes: alternativeBytes,
        fetchedAt: '2026-09-11T00:00:00.000Z' }).asset
      const alternative = await bundle.resolveMotionGraphicsSceneV2({ base: clone(base), projectRoot,
        videoStyleId: 'cream-editorial', lockedChoices: [lockedCutout(bundle, base, alternativeAsset, alternativeBytes)] })
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(alternative.compiled.sceneSpec),
        bundle.sceneSpecPixelIdentityAny(result.compiled.sceneSpec))
    })
    await runCase('7 colors=transparent no se presume: bytes opacos se rechazan antes de ProjectAsset', () => {
      assert.throws(() => bundle.publishPixabayImageAssetV1({ projectRoot, candidate: candidate('opaque-rejected'),
        bytes: pngRgba(20, 30, 40, true), fetchedAt: '2026-09-11T00:00:00.000Z' }), error => error?.code === 'PIXABAY_IMAGE_ALPHA_REQUIRED')
    })
    await runCase('8 render V15 offline acepta el cutout como Hero y pasa QC', async () => {
      let qc = null
      const clip = await bundle.renderGraphicClip(result.compiled.graphicData, { ancho: 360, alto: 640, fps: 8, duracion: 1,
        modo: 'pantalla', projectRoot, renderBindings: result.compiled.renderBindings,
        onQcReport: report => { qc = report }, onQcFailure: report => { qc = report } })
      assert(clip && fs.existsSync(clip))
      assert(qc && qc.findings.every(finding => finding.level !== 'error'))
    })
    await runCase('9 borrar el cutout temporal produce fallback con identidad distinta, no cache previa', async () => {
      const target = path.join(projectRoot, published.asset.relativeFile)
      removeFixtureFile(FIXTURE_ROOT, target)
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: result.compiled.graphicData, projectRoot,
        renderBindings: result.compiled.renderBindings })
      assert.equal(prepared.sceneSpec.visualMode, 'editorial-text')
      assert.equal(prepared.preparedAssets.length, 0)
      assert.notEqual(prepared.scenePixelIdentity, bundle.sceneSpecPixelIdentityAny(result.compiled.sceneSpec))
      const fallback = await bundle.renderGraphicClip(result.compiled.graphicData, { ancho: 360, alto: 640, fps: 8, duracion: 1,
        modo: 'pantalla', projectRoot, renderBindings: result.compiled.renderBindings })
      assert(fallback && fs.existsSync(fallback))
    })
    await runCase('10 no hubo red, no se creó segundo renderer y el fixture permanece aislado', () => {
      assert.equal(networkAttempts - networkAttemptsAtRenderGate, 0)
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: { type: 'visual_escena', value: 'legacy', extra: {} } }).kind, 'legacy')
    })
    assert.equal(completed, CASOS_ESPERADOS)
    finished = true
    finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    finish(1)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  finish(1)
})
