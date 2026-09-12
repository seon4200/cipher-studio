// Product gate for SEMANTIC ASSET RELEVANCE GATE V1.
//
// It exercises the real gate and the real V15 resolver. Provider transport is injected with
// FROZEN responses captured from the live API, so the suite is offline and deterministic while
// still judging real uploader metadata. No SceneSpec, asset or verdict is injected by hand.

const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1 } = require('./fixtures/semantic-relevance-gate-calibration-v1')
const { SEMANTIC_RELEVANCE_GATE_HOLDOUT_V1 } = require('./fixtures/semantic-relevance-gate-holdout-v1')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('semantic-relevance-gate-v1')
const CASES_EXPECTED = 16

/**
 * Declared BEFORE the holdout was ever executed. The holdout measures generalisation, so the bar
 * has to exist in advance; moving it afterwards would turn it into a second calibration set.
 */
const HOLDOUT_MIN_AGREEMENT = 0.8

let completed = 0
let finished = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function snapshotRealProjects () {
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
  walk(path.join(REPO_ROOT, 'proyectos'))
  walk(path.join(REPO_ROOT, 'cipher-studio', 'proyectos'))
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function pngRgba (alpha) {
  const crc32 = bytes => {
    let crc = 0xffffffff
    for (const value of bytes) {
      crc ^= value
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const label = Buffer.from(type)
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])))
    return Buffer.concat([length, label, data, checksum])
  }
  const width = 64; const height = 64
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4
      raw[offset] = 40; raw[offset + 1] = 90; raw[offset + 2] = 160
      raw[offset + 3] = alpha
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

/** Builds the concept side the way production does, from a bare narrated term. */
function contextFor (bundle, term, siblings = []) {
  const asConcept = value => ({ originalTerm: value, normalizedTerm: value, aliases: [value],
    subject: 'object', importance: 3, preferredRole: 'hero', evidence: 'direct-timed-token' })
  const expansion = bundle.expandConceptLexiconV1(term)[0]
  return bundle.relevanceConceptContextV1({
    concept: asConcept(term),
    ...(expansion ? { lexicon: expansion.entry } : {}),
    level: 'exact',
    siblingConcepts: siblings.map(asConcept),
  })
}

function judge (bundle, row, siblings = []) {
  const context = contextFor(bundle, row.concept, siblings)
  const tags = String(row.candidate.tags).split(',').map(value => value.trim()).filter(Boolean)
  const verdict = bundle.evaluateSemanticRelevanceV1({
    provider: 'pixabay-images', descriptors: tags, authority: 'third-party-tags',
  }, context)
  const hero = bundle.relevanceAdmitsRoleV1(verdict.relevanceClass, 'hero')
  const support = bundle.relevanceAdmitsRoleV1(verdict.relevanceClass, 'support')
  return { verdict, decision: hero ? 'hero' : support ? 'support' : 'reject' }
}

/** A row agrees when an expected rejection is rejected and an expected asset is admitted. */
function agrees (expected, decision) {
  return expected === 'reject' ? decision === 'reject' : decision !== 'reject'
}

function semanticBase (bundle, projectRoot, options) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: options.sceneId, start: 10, end: 13,
    transcriptSegments: [{ start: 9.8, end: 13.2, text: options.text, words: options.words }],
    concepts: options.concepts, anchor: options.anchor, relation: 'documenta',
    globalText: options.text, globalHints: [], globalContextRef: 'fixture:relevance-gate',
  })
  return bundle.resolveLocalSemanticVisualSceneV1({
    localSemantic, keywordCandidates: [{ keyword: options.keyword, source: 'scene-semantic' }],
    preferredVisualMode: 'auto', projectRoot, sistema: 'editorial',
    direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: 96101 },
  })
}

async function runCase (name, fn) {
  await fn()
  completed += 1
  console.log('OK ' + name)
}

async function main () {
  const projectsBefore = snapshotRealProjects()
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  const projectRoot = path.join(FIXTURE_ROOT, 'project')
  fs.mkdirSync(projectRoot, { recursive: true })
  bundle.createProjectFiles(projectRoot, { id: 'semantic-relevance-gate-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })

  const production = SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1.filter(row => row.id.startsWith('prod-'))
  assert.equal(production.length, 2)

  await runCase('01 el caso real de produccion queda rechazado', async () => {
    for (const row of production) {
      const { verdict, decision } = judge(bundle, row)
      console.log('REAL_CASE=' + JSON.stringify({ id: row.id, concept: row.concept,
        pixabayId: row.candidate.id, class: verdict.relevanceClass, focus: verdict.relevanceFocus,
        matchLevel: verdict.matchLevel, rejectionReason: verdict.rejectionReason }))
      assert.equal(decision, 'reject')
      assert.equal(verdict.relevanceClass, 'UNRELATED')
    }
  })

  await runCase('02 la decoracion de busqueda nunca crea pertenencia', async () => {
    // Both production assets carried the tag "aislado", which is exactly what the old
    // query-word-versus-tag comparison matched on. It must now contribute nothing.
    const context = contextFor(bundle, 'desperanza')
    const onlyDecoration = bundle.evaluateSemanticRelevanceV1({
      provider: 'pixabay-images', descriptors: ['aislado', 'transparente', 'png', 'recorte'],
      authority: 'third-party-tags',
    }, context)
    assert.equal(onlyDecoration.relevanceClass, 'UNRELATED')
    assert.equal(onlyDecoration.descriptorsConsidered, 0)
    assert.equal(bundle.RELEVANCE_NEUTRAL_DESCRIPTORS_V1.includes('aislado'), true)
  })

  await runCase('03 camara para TECNOLOGIA sobrevive como Support y no como Hero', async () => {
    const row = SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1.find(value => value.id === 'meta-tecnologia-camara')
    const { verdict, decision } = judge(bundle, row)
    console.log('PRODUCT_EXAMPLE=' + JSON.stringify({ class: verdict.relevanceClass, focus: verdict.relevanceFocus }))
    assert.equal(decision, 'support')
    assert.equal(bundle.relevanceAdmitsRoleV1(verdict.relevanceClass, 'support'), true)
    assert.equal(bundle.relevanceAdmitsRoleV1(verdict.relevanceClass, 'hero'), false)
  })

  await runCase('04 Hero y Support se evaluan de forma independiente', async () => {
    for (const value of ['EXACT', 'STRONG']) {
      assert.equal(bundle.relevanceAdmitsRoleV1(value, 'hero'), true)
      assert.equal(bundle.relevanceAdmitsRoleV1(value, 'support'), true)
    }
    assert.equal(bundle.relevanceAdmitsRoleV1('RELATED', 'hero'), false)
    assert.equal(bundle.relevanceAdmitsRoleV1('RELATED', 'support'), true)
    for (const value of ['WEAK', 'UNRELATED']) {
      assert.equal(bundle.relevanceAdmitsRoleV1(value, 'hero'), false)
      assert.equal(bundle.relevanceAdmitsRoleV1(value, 'support'), false)
    }
  })

  await runCase('05 solo EXACT|STRONG pueden ascender a Hero por promocion', async () => {
    assert.equal(bundle.relevanceAllowsHeroPromotionV1('EXACT'), true)
    assert.equal(bundle.relevanceAllowsHeroPromotionV1('STRONG'), true)
    assert.equal(bundle.relevanceAllowsHeroPromotionV1('RELATED'), false)
    assert.equal(bundle.relevanceAllowsHeroPromotionV1('WEAK'), false)
    assert.equal(bundle.relevanceAllowsHeroPromotionV1('UNRELATED'), false)
    // A choice with no verdict comes from a path that verifies itself; it keeps prior behaviour.
    assert.equal(bundle.relevanceAllowsHeroPromotionV1(undefined), true)
  })

  await runCase('06 un concepto sin entrada de lexicon sigue discriminando', async () => {
    assert.equal(bundle.expandConceptLexiconV1('tecnologia').length, 0)
    const good = judge(bundle, SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1.find(v => v.id === 'meta-tecnologia-brazo-robotico'))
    const bad = judge(bundle, SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1.find(v => v.id === 'prod-desperanza-arbol'))
    assert.notEqual(good.decision, 'reject')
    assert.equal(bad.decision, 'reject')
  })

  await runCase('07 los hermanos de escena rescatan una metafora defendible', async () => {
    const alone = bundle.evaluateSemanticRelevanceV1({ provider: 'pixabay-images',
      descriptors: ['cohete', 'lanzamiento', 'despegue'], authority: 'third-party-tags' },
    contextFor(bundle, 'potencial'))
    const withSiblings = bundle.evaluateSemanticRelevanceV1({ provider: 'pixabay-images',
      descriptors: ['cohete', 'lanzamiento', 'despegue'], authority: 'third-party-tags' },
    contextFor(bundle, 'potencial', ['cohete', 'crecimiento']))
    assert.equal(alone.relevanceClass, 'UNRELATED')
    assert.equal(withSiblings.matchLevel, 'sibling')
    assert.notEqual(withSiblings.relevanceClass, 'UNRELATED')
  })

  await runCase('08 un catalogo curado no queda sujeto al tope de concentracion', async () => {
    const context = contextFor(bundle, 'perro')
    const curated = bundle.evaluateSemanticRelevanceV1({ provider: 'openmoji',
      descriptors: ['dog face', 'pet', 'animal', 'perro'], authority: 'curated-local' }, context)
    const thirdParty = bundle.evaluateSemanticRelevanceV1({ provider: 'pixabay-images',
      descriptors: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10', 'perro'],
      authority: 'third-party-tags' }, context)
    assert.equal(curated.relevanceClass, 'EXACT')
    assert.equal(bundle.relevanceAdmitsRoleV1(thirdParty.relevanceClass, 'hero'), false)
  })

  await runCase('09 una identidad declarada por el sistema es evidencia de primera clase', async () => {
    const context = contextFor(bundle, 'reloj')
    const declared = bundle.evaluateSemanticRelevanceV1({ provider: 'solar',
      descriptors: ['clock'], declaredIdentity: 'clock', authority: 'curated-local' }, context)
    assert.equal(declared.declaredBelongs, true)
    assert.equal(bundle.relevanceAdmitsRoleV1(declared.relevanceClass, 'hero'), true)
  })

  await runCase('10 CALIBRATION: el corpus congelado no tiene fallos estrictos', async () => {
    const rows = SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1.map(row => ({ row, ...judge(bundle, row) }))
    const misses = rows.filter(value => !agrees(value.row.expected, value.decision))
    const buckets = { EXACT: 0, STRONG: 0, RELATED: 0, WEAK: 0, UNRELATED: 0 }
    for (const value of rows) buckets[value.verdict.relevanceClass]++
    console.log('CALIBRATION_RESULT=' + JSON.stringify({
      total: rows.length, agreed: rows.length - misses.length,
      agreement: Number(((rows.length - misses.length) / rows.length).toFixed(3)),
      buckets, rejected: rows.filter(v => v.decision === 'reject').length,
      misses: misses.map(v => ({ id: v.row.id, expected: v.row.expected, got: v.decision })),
    }))
    assert.equal(misses.length, 0)
  })

  await runCase('11 HOLDOUT: el corpus congelado generaliza sin reajustar nada', async () => {
    const rows = SEMANTIC_RELEVANCE_GATE_HOLDOUT_V1.map(row => ({ row, ...judge(bundle, row) }))
    const agreed = rows.filter(value => agrees(value.row.expected, value.decision))
    const buckets = { EXACT: 0, STRONG: 0, RELATED: 0, WEAK: 0, UNRELATED: 0 }
    for (const value of rows) buckets[value.verdict.relevanceClass]++
    const agreement = agreed.length / rows.length
    console.log('HOLDOUT_RESULT=' + JSON.stringify({
      total: rows.length, agreed: agreed.length, agreement: Number(agreement.toFixed(3)),
      minimumDeclaredBeforeRunning: HOLDOUT_MIN_AGREEMENT, buckets,
      rows: rows.map(v => ({ id: v.row.id, expected: v.row.expected, got: v.decision,
        class: v.verdict.relevanceClass, focus: v.verdict.relevanceFocus })),
    }))
    assert.equal(agreement >= HOLDOUT_MIN_AGREEMENT, true)
  })

  await runCase('12 una foto irrelevante se rechaza ANTES de descargar y de rembg', async () => {
    const base = semanticBase(bundle, projectRoot, { sceneId: 'gate-reject-before-cutout',
      keyword: 'fotógrafa', anchor: 'fotógrafa', text: 'la fotógrafa prepara el retrato',
      words: [{ word: 'la', start: 9.9, end: 10.05 }, { word: 'fotógrafa', start: 10.1, end: 10.65 },
        { word: 'prepara', start: 10.7, end: 11.15 }, { word: 'retrato', start: 11.4, end: 12.1 }],
      concepts: [{ label: 'fotógrafa', start: 10.1, end: 10.65 }] })
    let downloads = 0; let workers = 0
    const resolution = await bundle.resolveMotionGraphicsSceneV2({ base, projectRoot,
      videoStyleId: 'cream-editorial', pixabayApiKey: 'fixture-key',
      hooks: {
        // The frozen irrelevant answer from production: it only shares the decoration.
        searchRequestJson: async () => ({ hits: [{ id: 1511604,
          pageURL: 'https://pixabay.com/es/illustrations/arbol-1511604/',
          largeImageURL: 'https://cdn.pixabay.com/arbol-1511604.png', imageWidth: 1280, imageHeight: 960,
          type: 'illustration',
          tags: 'árbol, fantasía, escalera de caracol, cuento de hadas, sin hojas, deshojado, arte digital, aislado, treehouse' }] }),
        downloadRequestBytes: async () => { downloads++; return pngRgba(0) },
        cutout: { runWorker: async () => { workers++; return { status: 'ok' } } },
      } })
    console.log('REJECT_BEFORE_CUTOUT=' + JSON.stringify({ downloads, workers,
      photoRejectedBeforeCutout: resolution.metrics.photoRejectedBeforeCutout,
      photoCutoutAttempted: resolution.metrics.photoCutoutAttempted,
      candidatesEvaluated: resolution.metrics.candidatesEvaluated,
      pixabay: resolution.trace.pixabay }))
    assert.equal(downloads, 0)
    assert.equal(workers, 0)
    assert.equal(resolution.metrics.photoCutoutAttempted, 0)
    assert.equal(resolution.metrics.photoRejectedBeforeCutout > 0, true)
    assert.equal(resolution.choices.some(choice => choice.provider === 'pixabay-images'), false)
  })

  await runCase('13 una foto relevante sigue materializandose', async () => {
    const base = semanticBase(bundle, projectRoot, { sceneId: 'gate-accept-relevant',
      keyword: 'fotógrafa', anchor: 'fotógrafa', text: 'la fotógrafa prepara el retrato',
      words: [{ word: 'la', start: 9.9, end: 10.05 }, { word: 'fotógrafa', start: 10.1, end: 10.65 },
        { word: 'prepara', start: 10.7, end: 11.15 }, { word: 'retrato', start: 11.4, end: 12.1 }],
      concepts: [{ label: 'fotógrafa', start: 10.1, end: 10.65 }] })
    let downloads = 0
    const resolution = await bundle.resolveMotionGraphicsSceneV2({ base, projectRoot,
      videoStyleId: 'cream-editorial', pixabayApiKey: 'fixture-key',
      hooks: {
        searchRequestJson: async () => ({ hits: [{ id: 7001,
          pageURL: 'https://pixabay.com/illustrations/fotografa-7001/',
          largeImageURL: 'https://cdn.pixabay.com/fotografa-7001.png', imageWidth: 1200, imageHeight: 900,
          type: 'photo', tags: 'fotógrafa, retrato, cámara, aislado' }] }),
        downloadRequestBytes: async () => { downloads++; return pngRgba(0) },
      } })
    const raster = resolution.choices.filter(choice => choice.provider === 'pixabay-images' || choice.provider === 'photo-cutout')
    console.log('ACCEPT_RELEVANT=' + JSON.stringify({ downloads,
      decisions: resolution.trace.roleDecisions.map(value => ({ role: value.role, provider: value.provider,
        relevanceClass: value.relevanceClass, relevanceFocus: value.relevanceFocus })) }))
    assert.equal(downloads, 1)
    assert.equal(raster.length > 0, true)
    assert.equal(raster.every(choice => !!choice.relevance), true)
  })

  await runCase('14 el diagnostico no llega a SceneSpec ni a RenderBindings', async () => {
    const base = semanticBase(bundle, projectRoot, { sceneId: 'gate-no-leak',
      keyword: 'fútbol', anchor: 'fútbol', text: 'el fútbol conecta el estadio',
      words: [{ word: 'el', start: 9.9, end: 10.05 }, { word: 'fútbol', start: 10.1, end: 10.65 },
        { word: 'conecta', start: 10.7, end: 11.15 }, { word: 'estadio', start: 11.2, end: 11.8 }],
      concepts: [{ label: 'fútbol', emoji: '⚽', start: 10.1, end: 10.65 },
        { label: 'estadio', emoji: '🏟️', start: 11.2, end: 11.8 }] })
    const resolution = await bundle.resolveMotionGraphicsSceneV2({ base, projectRoot, videoStyleId: 'cream-editorial' })
    const spec = JSON.stringify(resolution.compiled.sceneSpec)
    const bindings = JSON.stringify(resolution.compiled.renderBindings)
    const locked = JSON.stringify(resolution.lockedChoices)
    for (const needle of ['relevance', 'relevanceClass', 'relevanceFocus', 'rejectionReason', 'EXACT_CONCEPT', 'UNRELATED']) {
      assert.equal(spec.includes(needle), false)
      assert.equal(bindings.includes(needle), false)
      assert.equal(locked.includes(needle), false)
    }
    console.log('NO_LEAK=' + JSON.stringify({ specBytes: spec.length, lockedBytes: locked.length,
      identity: bundle.sceneSpecPixelIdentityAny(resolution.compiled.sceneSpec).slice(0, 16) }))
  })

  await runCase('15 el gate filtra pero no reordena', async () => {
    // Ranking order must be a function of the existing ranker alone; the verdict never enters it.
    const plans = bundle.buildPixabayImageSearchPlansV1({
      concept: { originalTerm: 'perro', normalizedTerm: 'perro', aliases: ['perro'], subject: 'object',
        importance: 3, preferredRole: 'hero', evidence: 'direct-timed-token' },
      level: 'exact', role: 'hero', representation: 'full-raster', maxPlans: 1 })
    const searched = await bundle.searchPixabayImagesV1({ plan: plans[0], apiKey: 'fixture',
      requestJson: async () => ({ hits: [
        { id: 1, pageURL: 'https://pixabay.com/a-1/', largeImageURL: 'https://cdn.pixabay.com/a.png',
          imageWidth: 400, imageHeight: 300, type: 'photo', tags: 'perro, mascota' },
        { id: 2, pageURL: 'https://pixabay.com/b-2/', largeImageURL: 'https://cdn.pixabay.com/b.png',
          imageWidth: 2000, imageHeight: 1500, type: 'photo', tags: 'perro, animal, mascota' },
        { id: 3, pageURL: 'https://pixabay.com/c-3/', largeImageURL: 'https://cdn.pixabay.com/c.png',
          imageWidth: 2000, imageHeight: 1500, type: 'photo', tags: 'ladrillo, muro, cemento' },
      ] }) })
    const ranked = bundle.rankPixabayImageCandidatesV1(searched.candidates)
    const admitted = ranked.filter(bundle.pixabayCandidateAdmissibleV1)
    assert.equal(JSON.stringify(admitted.map(v => v.id)),
      JSON.stringify(ranked.filter(v => admitted.includes(v)).map(v => v.id)))
    assert.equal(admitted.some(value => value.id === '3'), false)
    for (const candidate of searched.candidates) {
      const withoutRelevance = { ...candidate.ranking }
      delete withoutRelevance.relevance
      assert.equal(typeof withoutRelevance.total, 'number')
    }
    console.log('FILTER_NOT_RERANK=' + JSON.stringify({ ranked: ranked.map(v => v.id), admitted: admitted.map(v => v.id) }))
  })

  await runCase('16 los proyectos reales no se han tocado', async () => {
    assert.equal(snapshotRealProjects(), projectsBefore)
    assert.equal(networkAttempts, 0)
  })
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    networkAttempts += 1
    callback({ cancel: true })
  })
  global.fetch = async () => { networkAttempts += 1; throw new Error('RED_BLOQUEADA') }
  http.request = () => { networkAttempts += 1; throw new Error('RED_BLOQUEADA') }
  https.request = () => { networkAttempts += 1; throw new Error('RED_BLOQUEADA') }
  try {
    await main()
    assert.equal(completed, CASES_EXPECTED)
    finished = true
    console.log(`\nSEMANTIC_RELEVANCE_GATE_V1 OK (${completed}/${CASES_EXPECTED})`)
  } catch (error) {
    console.error('\nFALLO', error && error.stack ? error.stack : error)
  } finally {
    global.fetch = originalFetch
    http.request = originalHttpRequest
    https.request = originalHttpsRequest
    cleanupTestFixture(FIXTURE_ROOT)
    app.exit(finished ? 0 : 1)
  }
})
