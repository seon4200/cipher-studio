const { app, nativeImage, session } = require('electron')
const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { PRODUCTION_RETRIEVAL_REAL_V15 } = require('./fixtures/production-retrieval-real-v15')
const { PRODUCTION_RETRIEVAL_HOLDOUT_V2 } = require('./fixtures/production-retrieval-holdout-v2')
const { VISUAL_RETRIEVAL_HOLDOUT_V15 } = require('./fixtures/visual-retrieval-holdout-v15')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('production-retrieval-final')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const EXPECTED_CASES = 18
const FROZEN_HASHES = Object.freeze({
  real: '53D88E5282EF9F66ED3C37D4AC4BBC718B08DBD518E7C5E7F347D1C06E6F0C91',
  holdoutV2: 'D4B2FE4952B4861CE95EBF705446B41F75CBCCA0B42F0D1106DAEC4257A42299',
  holdoutV15: 'AE7F2E99E716CA04AF550CA7950163D1A6C9395C11B312E2952E7B57494A9947',
})
const ORIGINAL_HOLDOUT_BEFORE = Object.freeze({ count: 72, top1: 0, top5: 5, noResult: 67, ambiguous: 2 })

const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpGet = http.get
const originalHttpsRequest = https.request
const originalHttpsGet = https.get
let completed = 0
let finished = false
let networkAttempts = 0

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
const sourceSha256 = file => sha256(Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')))
const clone = value => JSON.parse(JSON.stringify(value))

function snapshotProjectTree (root) {
  if (!fs.existsSync(root)) return []
  const rows = []
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile()) {
        const stat = fs.statSync(target)
        const relative = path.relative(root, target).replace(/\\/g, '/')
        const important = /(?:project-state(?:\.json(?:\.bak)?)?|manifest\.json)$/i.test(entry.name)
        rows.push([relative, stat.size, stat.mtimeMs, important ? sha256(fs.readFileSync(target)) : null])
      }
    }
  }
  walk(root)
  return rows.sort((a, b) => a[0].localeCompare(b[0], 'en'))
}

function snapshotRealProjects () {
  const roots = [
    path.join(REPO_ROOT, 'proyectos'),
    'C:\\Proyectos\\mi-app\\cipher-studio\\proyectos',
  ]
  return JSON.stringify(roots.map(root => [root, snapshotProjectTree(root)]))
}

function blockNetwork () {
  networkAttempts++
  throw new Error('NETWORK_FORBIDDEN_IN_PRODUCTION_RETRIEVAL_FINAL')
}

function wordsFor (text, start, end) {
  const words = String(text).trim().split(/\s+/).filter(Boolean)
  const span = Math.max(.1, end - start)
  return words.map((word, index) => ({ word,
    start: start + span * index / words.length,
    end: start + span * (index + .82) / words.length }))
}

function contextFor (bundle, row, index = 0) {
  const start = Number.isFinite(row.start) ? row.start : 10
  const end = Number.isFinite(row.end) ? row.end : 12.4
  const text = row.localText
  const concepts = (row.concepts || []).map(concept => ({ ...concept, scope: 'scene' }))
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: row.sceneId || row.id, start, end,
    transcriptSegments: [{ start, end, text, words: wordsFor(text, start, end) }],
    concepts,
    anchor: row.anchor || concepts[0]?.label,
    relation: row.relation,
    globalText: text,
    globalHints: concepts.map(concept => concept.label),
    globalContextRef: 'dfinal-fixture:' + row.id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: row.sceneId || row.id,
    duration: 1,
    localSemantic,
    keywordCandidates: [{ keyword: row.textKeyword, source: 'scene-semantic' }],
    preferredVisualMode: 'auto',
    sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media',
      ritmo: 'simultaneo', semilla: 159000 + index },
    videoStyleId: 'cream-editorial',
    lockedChoices: [],
  })
}

function providerCounts (resolved) {
  const counts = { openmoji: 0, solar: 0, pixabay: 0 }
  for (const row of resolved) for (const choice of row.resolved.choices) {
    if (choice.provider === 'openmoji') counts.openmoji++
    else if (choice.provider === 'solar') counts.solar++
    else if (choice.provider === 'pixabay-images') counts.pixabay++
  }
  return counts
}

function retrievalMetrics (resolved) {
  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 }
  let heroes = 0; let supports = 0
  for (const item of resolved) {
    distribution[item.resolved.choices.length]++
    heroes += Number(item.resolved.choices.some(choice => choice.slotId === 'hero'))
    supports += item.resolved.choices.filter(choice => choice.slotId !== 'hero').length
  }
  return { distribution, heroes, supports, providers: providerCounts(resolved),
    badEditorial: resolved.filter(item => item.resolved.choices.length === 0).length,
    legitimateEditorial: 0 }
}

function reasonableCandidate (bundle, row, candidate) {
  if (!candidate) return false
  const expected = row.acceptableTokens.map(value => bundle.canonicalNarrativeTerm(value))
  let values = []
  if (candidate.provider === 'openmoji' && candidate.stableId) {
    const entry = bundle.getOpenMojiEntry(candidate.stableId)
    if (entry) values = [entry.annotation, ...entry.aliases, ...entry.tags, entry.group, entry.subgroup]
  } else if (candidate.provider === 'solar') values = [candidate.solarBase, candidate.solarVariant]
  return values.filter(Boolean).map(value => bundle.canonicalNarrativeTerm(value))
    .some(value => expected.some(token => value === token || value.includes(token) || token.includes(value)))
}

function runOriginalHoldout (bundle) {
  let top1 = 0; let top5 = 0; let noResult = 0; let ambiguous = 0
  const providers = { openmoji: 0, solar: 0, editorial: 0 }
  for (const row of VISUAL_RETRIEVAL_HOLDOUT_V15) {
    const intent = bundle.createAssetIntentV1({ sceneId: row.id, keyword: row.term, concepts: [row.term] })
    const result = bundle.resolveVisualRetrievalV1({ intent })
    top1 += Number(reasonableCandidate(bundle, row, result.selectedHero))
    top5 += Number(result.candidates.slice(0, 5).some(candidate => reasonableCandidate(bundle, row, candidate)))
    noResult += Number(result.candidates.length === 0)
    ambiguous += Number(result.candidates.length > 1 && result.candidates[0].score === result.candidates[1].score &&
      result.candidates[0].identity !== result.candidates[1].identity)
    if (result.selectedHero?.provider === 'openmoji') providers.openmoji++
    else if (result.selectedHero?.provider === 'solar') providers.solar++
    else providers.editorial++
  }
  return { count: VISUAL_RETRIEVAL_HOLDOUT_V15.length, top1, top5, noResult, ambiguous, providers }
}

function crc32 (bytes) {
  let crc = 0xffffffff
  for (const value of bytes) {
    crc ^= value
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngRgbaFixture (width = 128, height = 128) {
  const chunk = (type, data) => {
    const name = Buffer.from(type)
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
    return Buffer.concat([length, name, data, checksum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 4 + 1) + 1 + x * 4
    const visible = x > 15 && x < width - 16 && y > 9 && y < height - 10
    raw[offset] = 55; raw[offset + 1] = 105; raw[offset + 2] = 178; raw[offset + 3] = visible ? 255 : 0
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function frameFromVideo (video, output) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.5', '-i', video,
    '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function pixelDifference (left, right) {
  const a = nativeImage.createFromPath(left); const b = nativeImage.createFromPath(right)
  assert.deepEqual(a.getSize(), b.getSize())
  const x = a.toBitmap(); const y = b.toBitmap()
  let differentPixels = 0
  for (let offset = 0; offset < x.length; offset += 4) {
    if (x[offset] !== y[offset] || x[offset + 1] !== y[offset + 1] || x[offset + 2] !== y[offset + 2]) differentPixels++
  }
  return differentPixels
}

async function runCase (name, callback) {
  await callback()
  completed++
  console.log('OK ' + name)
}

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest; http.get = originalHttpGet
  https.request = originalHttpsRequest; https.get = originalHttpsGet
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => {
  if (!finished) {
    console.error(`FALLO: CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${EXPECTED_CASES}`)
    process.exitCode = 1
  }
})

app.whenReady().then(async () => {
  const realProjectsBefore = snapshotRealProjects()
  global.fetch = blockNetwork
  http.request = blockNetwork; http.get = blockNetwork
  https.request = blockNetwork; https.get = blockNetwork
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  await new Promise(resolve => setTimeout(resolve, 800))
  const startupNetworkBaseline = networkAttempts
  bundle.createProjectFiles(PROJECT_ROOT, { id: 'production-retrieval-final', clips: [], timelineVideoClips: [], aiScript: 'fixture D-Final' })

  try {
    await runCase('1 corpus y holdouts permanecen congelados antes de medir', () => {
      assert.equal(sourceSha256(path.join(REPO_ROOT, 'tests/fixtures/production-retrieval-real-v15.js')), FROZEN_HASHES.real)
      assert.equal(sourceSha256(path.join(REPO_ROOT, 'tests/fixtures/production-retrieval-holdout-v2.js')), FROZEN_HASHES.holdoutV2)
      assert.equal(sourceSha256(path.join(REPO_ROOT, 'tests/fixtures/visual-retrieval-holdout-v15.js')), FROZEN_HASHES.holdoutV15)
    })
    await runCase('2 stopwords y términos funcionales no forman conceptos visuales', () => {
      for (const term of ['las', 'que', 'tú', 'en', 'o', 'de']) assert.equal(bundle.isSpanishVisualStopwordV1(term), true)
      for (const term of ['hacer', 'está', 'vas']) assert(bundle.visualNarrativeTermStrengthV1(term) <= 1)
      assert.equal(bundle.visualNarrativeTermStrengthV1('redes sociales'), 3)
    })
    const realContexts = PRODUCTION_RETRIEVAL_REAL_V15.map((row, index) => contextFor(bundle, row, index))
    const realResolved = await bundle.resolveModernVisualGenerationBatchV2({ contexts: realContexts, projectRoot: PROJECT_ROOT })
    await runCase('3 keyword textual queda separada del concepto visual estructurado', () => {
      const social = realResolved.find(item => item.context.sceneId === 'visual-0:1')
      assert.equal(social.resolved.compiled.sceneSpec.text.keyword.toLocaleLowerCase('es'), 'redes')
      assert.equal(social.resolved.trace.concepts[0].concept, 'mobile phone')
      assert(!['las', 'que', 'tu', 'en', 'o', 'de'].includes(social.resolved.trace.concepts[0].concept))
    })
    await runCase('4 conceptos DeepSeek del mismo subclip preceden tokens pronunciados residuales', () => {
      const social = realResolved.find(item => item.context.sceneId === 'visual-0:1')
      const writing = realResolved.find(item => item.context.sceneId === 'visual-8:1')
      assert.deepEqual(social.resolved.trace.concepts.map(value => value.concept), ['mobile phone', 'viral', 'popular'])
      assert.deepEqual(writing.resolved.trace.concepts.map(value => value.concept), ['writing', 'texto', 'pantalla'])
    })
    await runCase('5 personas concretas pueden producir ancla visual', () => {
      const personRows = ['visual-8:0', 'visual-18:1', 'visual-2:1']
      for (const sceneId of personRows) {
        const result = realResolved.find(item => item.context.sceneId === sceneId).resolved
        assert(result.choices.some(choice => choice.slotId === 'hero'), sceneId)
      }
    })
    await runCase('6 un concepto secundario defendible puede ascender a Hero', async () => {
      const row = { id: 'promotion', localText: 'el proceso abre paso al cohete y la estrella', textKeyword: 'proceso',
        concepts: [{ label: 'proceso' }, { label: 'cohete', emoji: '🚀' }, { label: 'estrella', emoji: '⭐' }], relation: 'conecta' }
      const result = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [contextFor(bundle, row, 40)], projectRoot: PROJECT_ROOT }))[0].resolved
      assert.equal(result.choices[0].slotId, 'hero')
      assert.equal(result.choices[0].concept, 'rocket')
      assert.match(result.choices[0].reason, /HERO_PROMOTED/)
    })
    await runCase('7 OpenMoji directo conserva literalidad y original-color', () => {
      const social = realResolved.find(item => item.context.sceneId === 'visual-0:1').resolved
      assert.equal(social.choices[0].provider, 'openmoji')
      assert.match(social.base.trace.retrieval.selectedHero.reason, /OPENMOJI_DIRECT_EMOJI/)
      assert(social.compiled.sceneSpec.slots.filter(slot => slot.state === 'present' && slot.mime === 'image/svg+xml')
        .every(slot => slot.tint.treatment === 'original-color'))
    })
    await runCase('8 Solar débil no desplaza OpenMoji literal', () => {
      const social = realResolved.find(item => item.context.sceneId === 'visual-0:1').resolved
      assert.equal(social.choices.find(choice => choice.slotId === 'hero').provider, 'openmoji')
      assert(!social.trace.roleDecisions.some(value => value.role === 'hero' && value.provider === 'solar'))
    })
    await runCase('9 SearchPlan Pixabay traduce por ConceptLexicon y no confunde ASCII con inglés', () => {
      const woman = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'woman', keyword: 'mujer', concepts: ['mujer'] }) })
      const ai = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'ai', keyword: 'inteligencia artificial', concepts: ['inteligencia artificial'] }) })
      const womanPlans = woman.plans.filter(plan => plan.provider === 'pixabay-images').flatMap(plan => plan.pixabayPlans || [])
      const aiPlans = ai.plans.filter(plan => plan.provider === 'pixabay-images').flatMap(plan => plan.pixabayPlans || [])
      assert.deepEqual(womanPlans.slice(0, 3).map(plan => plan.query), ['woman isolated', 'woman portrait isolated', 'woman transparent'])
      assert(aiPlans.some(plan => /artificial intelligence|ai technology|brain technology/i.test(plan.query)))
      assert(womanPlans.every(plan => plan.language === 'en') && aiPlans.every(plan => plan.language === 'en'))
      const unknown = bundle.buildPixabayImageSearchPlansV1({ concept: { originalTerm: 'fotógrafa', normalizedTerm: 'fotografa', aliases: [],
        subject: 'person', importance: 3, preferredRole: 'hero', evidence: 'direct-timed-concept' }, level: 'exact' })
      assert(unknown.every(plan => plan.language === 'es'))
    })
    await runCase('10 transporte Pixabay envía User-Agent y respeta 429 con backoff acotado', async () => {
      const woman = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'retry', keyword: 'mujer', concepts: ['mujer'] }) })
      const plan = woman.plans.find(value => value.provider === 'pixabay-images').pixabayPlans[0]
      const contexts = []; const waits = []; let attempts = 0
      const result = await bundle.searchPixabayImagesV1({ plan, apiKey: 'fixture',
        requestJson: async (url, context) => {
          contexts.push(context); attempts++
          if (attempts < 3) throw new bundle.PixabayImageError('HTTP_429', 'rate', { retryAfterMs: 0 })
          return { hits: [] }
        }, wait: async milliseconds => { waits.push(milliseconds) } })
      assert.equal(result.outcome, 'NO_RESULTS'); assert.equal(attempts, 3)
      assert.deepEqual(waits, [0, 0])
      assert(contexts.every(context => context.headers['User-Agent'] === bundle.PIXABAY_USER_AGENT))
      await assert.rejects(() => bundle.searchPixabayImagesV1({ plan, apiKey: 'fixture',
        requestJson: async () => { throw new bundle.PixabayImageError('HTTP_429', 'rate', { retryAfterMs: 5000 }) } }),
      error => error.code === 'HTTP_429' && error.details.retryDeferred === true)
    })
    await runCase('11 Pixabay distingue timeout, red, respuesta inválida y sin resultado útil', async () => {
      const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'typed', keyword: 'mujer', concepts: ['mujer'] }) })
      const plan = result.plans.find(value => value.provider === 'pixabay-images').pixabayPlans[0]
      await assert.rejects(() => bundle.searchPixabayImagesV1({ plan, apiKey: 'x', requestJson: async () => { throw { code: 'ETIMEDOUT' } } }), error => error.code === 'TIMEOUT')
      await assert.rejects(() => bundle.searchPixabayImagesV1({ plan, apiKey: 'x', requestJson: async () => { throw new Error('offline') } }), error => error.code === 'NETWORK_ERROR')
      await assert.rejects(() => bundle.searchPixabayImagesV1({ plan, apiKey: 'x', requestJson: async () => ({ total: 1 }) }), error => error.code === 'INVALID_RESPONSE')
      const noResults = await bundle.searchPixabayImagesV1({ plan, apiKey: 'x', requestJson: async () => ({ hits: [] }) })
      const noUsable = await bundle.searchPixabayImagesV1({ plan, apiKey: 'x', requestJson: async () => ({ hits: [{}] }) })
      assert.equal(noResults.outcome, 'NO_RESULTS'); assert.equal(noUsable.outcome, 'NO_USABLE_RESULT')
    })
    await runCase('12 Pixabay limita a dos peticiones concurrentes', async () => {
      const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'concurrency', keyword: 'mujer', concepts: ['mujer'] }) })
      const plan = result.plans.find(value => value.provider === 'pixabay-images').pixabayPlans[0]
      let active = 0; let maximum = 0
      await Promise.all(Array.from({ length: 6 }, () => bundle.searchPixabayImagesV1({ plan, apiKey: 'x', requestJson: async () => {
        active++; maximum = Math.max(maximum, active)
        await new Promise(resolve => setTimeout(resolve, 12)); active--
        return { hits: [] }
      } })))
      assert.equal(maximum, 2)
    })
    await runCase('13 corpus real mejora assets y reduce editorial no deseado', () => {
      const before = { distribution: { 0: 10, 1: 1, 2: 1, 3: 0 }, badEditorial: 10,
        heroes: 2, supports: 1, providers: { openmoji: 3, solar: 0, pixabay: 0 } }
      const after = retrievalMetrics(realResolved)
      console.log('PRODUCTION_REAL_BEFORE_AFTER=' + JSON.stringify({ before, after,
        rows: realResolved.map(item => ({ sceneId: item.context.sceneId, textKeyword: item.resolved.compiled.sceneSpec.text.keyword,
          concepts: item.resolved.trace.concepts.map(value => value.concept), assets: item.resolved.choices.length,
          providers: item.resolved.choices.map(value => value.provider), hero: item.resolved.choices.find(value => value.slotId === 'hero')?.concept || null })) }))
      assert(after.badEditorial < before.badEditorial)
      assert(after.heroes > before.heroes)
    })
    await runCase('14 holdout original de 72 permanece sin editar y se mide antes/después', () => {
      const after = runOriginalHoldout(bundle)
      console.log('ORIGINAL_HOLDOUT_72_BEFORE_AFTER=' + JSON.stringify({ before: ORIGINAL_HOLDOUT_BEFORE, after }))
      assert.equal(after.count, 72)
    })
    await runCase('15 segundo holdout congelado se ejecuta sin reajustar producción', async () => {
      const contexts = PRODUCTION_RETRIEVAL_HOLDOUT_V2.map((row, index) => contextFor(bundle, row, 100 + index))
      const resolved = await bundle.resolveModernVisualGenerationBatchV2({ contexts, projectRoot: PROJECT_ROOT })
      const visualRows = resolved.filter((_, index) => PRODUCTION_RETRIEVAL_HOLDOUT_V2[index].requiresVisualAnchor)
      const editorialRows = resolved.filter((_, index) => !PRODUCTION_RETRIEVAL_HOLDOUT_V2[index].requiresVisualAnchor)
      const anchors = visualRows.filter(item => item.resolved.choices.some(choice => choice.slotId === 'hero')).length
      const legitimateEditorial = editorialRows.filter(item => item.resolved.choices.length === 0).length
      const metrics = { count: resolved.length, visualExpected: visualRows.length, heroAnchors: anchors,
        visualMisses: visualRows.length - anchors, editorialExpected: editorialRows.length, legitimateEditorial,
        providers: providerCounts(resolved), distribution: retrievalMetrics(resolved).distribution }
      console.log('SECOND_HOLDOUT_FIRST_RUN=' + JSON.stringify(metrics))
      assert(anchors >= 18)
      assert(legitimateEditorial >= 3)
    })
    let endToEnd
    await runCase('16 ruta productiva semántica a ProjectAsset, SceneSpec, QC y MP4', async () => {
      const row = { id: 'e2e-photographer', localText: 'la fotógrafa documenta el retrato', textKeyword: 'fotógrafa',
        concepts: [{ label: 'fotógrafa' }], relation: 'documenta' }
      const contexts = [contextFor(bundle, row, 200)]
      const png = pngRgbaFixture()
      const result = (await bundle.resolveModernVisualGenerationBatchV2({ contexts, projectRoot: PROJECT_ROOT,
        pixabayApiKey: 'fixture', hooks: {
          searchRequestJson: async url => /fotografa/i.test(url.searchParams.get('q') || '') ? { hits: [{ id: 9915,
            pageURL: 'https://pixabay.com/illustrations/photographer-9915/',
            largeImageURL: 'https://cdn.pixabay.com/photographer-9915.png', imageWidth: 128, imageHeight: 128,
            type: 'illustration', tags: 'fotografa, retrato, aislada' }] } : { hits: [] },
          downloadRequestBytes: async () => png,
        } }))[0].resolved
      assert.equal(result.choices[0].provider, 'pixabay-images')
      assert.equal(result.compiled.sceneSpec.renderSpecVersion, 2)
      assert.equal(result.compiled.renderBindings.version, 2)
      assert.equal(result.compiled.sceneSpec.slots[0].tint.treatment, 'original-color')
      let qc = null
      const clip = await bundle.renderGraphicClip(result.compiled.graphicData, { ancho: 360, alto: 640, fps: 8, duracion: 1,
        modo: 'pantalla', sistema: 'editorial', projectRoot: PROJECT_ROOT, renderBindings: result.compiled.renderBindings,
        onQcReport: report => { qc = report }, onQcFailure: report => { qc = report } })
      assert(clip && fs.existsSync(clip))
      assert(qc && qc.findings.every(finding => finding.level !== 'error'))
      endToEnd = { result, clip }
      console.log('PRODUCTION_E2E=' + JSON.stringify({ provider: result.choices[0].provider,
        assetId: result.choices[0].asset.id, sha256: result.choices[0].asset.sha256,
        sceneSpecVersion: result.compiled.sceneSpec.renderSpecVersion, bindingsVersion: result.compiled.renderBindings.version,
        qc: 'PASS', mp4Bytes: fs.statSync(clip).size }))
    })
    await runCase('17 mismo SceneSpec conserva identidad, hash y píxeles exactos', async () => {
      const spec = endToEnd.result.compiled.sceneSpec
      const identityA = bundle.sceneSpecPixelIdentityAny(spec)
      const identityB = bundle.sceneSpecPixelIdentityAny(clone(spec))
      assert.equal(identityA, identityB)
      const second = await bundle.renderGraphicClip(endToEnd.result.compiled.graphicData, { ancho: 360, alto: 640, fps: 8, duracion: 1,
        modo: 'pantalla', sistema: 'editorial', projectRoot: PROJECT_ROOT,
        renderBindings: clone(endToEnd.result.compiled.renderBindings) })
      const firstFrame = path.join(FIXTURE_ROOT, 'first.png'); const secondFrame = path.join(FIXTURE_ROOT, 'second.png')
      frameFromVideo(endToEnd.clip, firstFrame); frameFromVideo(second, secondFrame)
      const differentPixels = pixelDifference(firstFrame, secondFrame)
      console.log('SCENESPEC_PIXEL_PARITY=' + JSON.stringify({ pixelIdentityBefore: identityA,
        pixelIdentityAfter: identityB, differentPixels }))
      assert.equal(differentPixels, 0)
    })
    await runCase('18 versión, fondos, renderer y proyectos reales quedan intactos', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
      assert.equal(snapshotRealProjects(), realProjectsBefore)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json')), false)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, '.cipher-test-fixture')), false)
      assert.equal(networkAttempts, startupNetworkBaseline)
    })
    assert.equal(completed, EXPECTED_CASES)
    console.log(`CASOS_COMPLETADOS=${completed}`)
    console.log(`CASOS_ESPERADOS=${EXPECTED_CASES}`)
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
