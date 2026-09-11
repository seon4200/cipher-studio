// Visual Retrieval Engine V1: real compiled consumers, local catalogs and marked temporary
// projects only. The suite blocks network; live Pixabay is exercised separately and bounded.
const { app } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { sceneSpec, graphicFor } = require('./helpers/visual-mvp-fixture')
const { BENCHMARK_CONCEPTS_V1 } = require('./fixtures/visual-retrieval-benchmark-v1')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('visual-retrieval-engine-v1')
const CASOS_ESPERADOS = 27
let completed = 0
let finished = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

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
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'),
          crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

async function runCase (name, fn) {
  await fn()
  completed += 1
  console.log('OK ' + name)
}

function pngRgba (alpha) {
  const chunk = (type, data) => Buffer.concat([Buffer.from([0, 0, 0, data.length]), Buffer.from(type), data, Buffer.alloc(4)])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.from([0, 0x11, 0x22, 0x33, alpha])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function mockPixabayCandidate () {
  return {
    provider: 'pixabay-images', id: 'sample-1', pageUrl: 'https://pixabay.com/illustrations/sample-1/',
    downloadUrl: 'https://cdn.pixabay.com/photo/sample-1.png', tags: ['airplane', 'isolated'],
    width: 1, height: 1, imageType: 'illustration', score: 3, reason: 'FIXTURE', query: 'airplane isolated',
    transparentRequested: true, requiresDownloadValidation: true,
  }
}

function sameEmoji (left, right) {
  return String(left || '').normalize('NFC').replace(/[\uFE0E\uFE0F]/g, '') ===
    String(right || '').normalize('NFC').replace(/[\uFE0E\uFE0F]/g, '')
}

function reasonableCandidate (bundle, row, candidate) {
  if (!candidate || candidate.concept !== row.canonical) return false
  const lexicon = bundle.conceptLexiconEntryV1(row.canonical)
  if (!lexicon) return false
  if (candidate.provider === 'solar') {
    const actual = bundle.canonicalNarrativeTerm(candidate.solarBase)
    return lexicon.solarBases.some(base => {
      const expected = bundle.canonicalNarrativeTerm(base)
      return actual === expected || actual.includes(expected) || expected.includes(actual)
    })
  }
  if (candidate.provider !== 'openmoji' || !candidate.stableId) return false
  const entry = bundle.getOpenMojiEntry(candidate.stableId)
  if (!entry) return false
  if (entry.emoji && lexicon.emoji.some(emoji => sameEmoji(emoji, entry.emoji))) return true
  const expected = new Set([lexicon.canonical, ...lexicon.synonyms, ...lexicon.related])
  const values = [entry.annotation, ...entry.aliases, ...entry.tags, entry.group, entry.subgroup]
    .filter(Boolean).map(value => bundle.canonicalNarrativeTerm(value))
  return values.some(value => expected.has(value))
}

function directBaseline (bundle, row) {
  if (row.expectedMode === 'editorial') return { top1: true, top5: true, noResult: false, absurd: false }
  const lexicon = bundle.conceptLexiconEntryV1(row.canonical)
  const expected = new Set([lexicon.canonical, ...lexicon.synonyms, ...lexicon.related])
  const direct = bundle.searchOpenMoji(row.term, { limit: 5 })
  const matches = result => [result.entry.annotation, ...result.entry.aliases, ...result.entry.tags, result.entry.group, result.entry.subgroup]
    .filter(Boolean).map(value => bundle.canonicalNarrativeTerm(value)).some(value => expected.has(value))
  const solar = bundle.resolverSolarDetallado(row.term, 'bold-duotone')
  const solarMatches = solar.resultado && lexicon.solarBases.some(base => {
    const actual = bundle.canonicalNarrativeTerm(solar.resultado.replace(/-(?:bold-duotone|linear)$/, ''))
    const expected = bundle.canonicalNarrativeTerm(base)
    return actual === expected || actual.includes(expected) || expected.includes(actual)
  })
  const top1 = Boolean(direct[0] && matches(direct[0])) || Boolean(solarMatches && !direct.length)
  const top5 = direct.some(matches) || Boolean(solarMatches)
  return { top1, top5, noResult: !direct.length && !solar.resultado, absurd: Boolean(direct[0] && !matches(direct[0])) }
}

function percentile (values, fraction) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))]
}

function benchmark (bundle) {
  const before = { top1: 0, top5: 0, noResults: 0, absurd: 0, openMojiCoverage: 0, solarCoverage: 0, pixabayCoverage: 0 }
  const after = { top1: 0, top5: 0, noResults: 0, absurd: 0, openMojiCoverage: 0, solarCoverage: 0, pixabayCoverage: 0, combinedCoverage: 0, queryTotal: 0 }
  const rows = []
  const durations = []
  const started = performance.now()
  for (let index = 0; index < BENCHMARK_CONCEPTS_V1.length; index++) {
    const row = BENCHMARK_CONCEPTS_V1[index]
    const prior = directBaseline(bundle, row)
    before.top1 += Number(prior.top1); before.top5 += Number(prior.top5); before.noResults += Number(prior.noResult); before.absurd += Number(prior.absurd)
    const intent = bundle.createAssetIntentV1({ sceneId: 'benchmark-' + index, keyword: row.term, concepts: [row.term] })
    const sceneStarted = performance.now()
    const result = bundle.resolveVisualRetrievalV1({ intent })
    durations.push(performance.now() - sceneStarted)
    const top1 = row.expectedMode === 'editorial'
      ? result.editorialReason === 'CONCEPT_EDITORIAL_ROLE'
      : reasonableCandidate(bundle, row, result.selectedHero)
    const top5 = row.expectedMode === 'editorial'
      ? result.editorialReason !== null
      : result.candidates.some(candidate => reasonableCandidate(bundle, row, candidate))
    const selected = result.selectedHero
    const candidates = result.candidates
    after.top1 += Number(top1); after.top5 += Number(top5)
    after.noResults += Number(row.expectedMode === 'hero' && candidates.length === 0)
    after.absurd += Number(selected && !reasonableCandidate(bundle, row, selected))
    after.openMojiCoverage += Number(candidates.some(candidate => candidate.provider === 'openmoji' && reasonableCandidate(bundle, row, candidate)))
    after.solarCoverage += Number(candidates.some(candidate => candidate.provider === 'solar' && reasonableCandidate(bundle, row, candidate)))
    after.pixabayCoverage += Number(result.plans.some(plan => plan.provider === 'pixabay-images' && plan.pixabayPlans?.length))
    after.combinedCoverage += Number(top5)
    after.queryTotal += result.metrics.openMojiQueries
    rows.push({ term: row.term, canonical: row.canonical, expectedMode: row.expectedMode, selected,
      top1, top5, candidateCount: candidates.length, plans: result.plans.length })
  }
  const elapsedMs = performance.now() - started
  return {
    count: BENCHMARK_CONCEPTS_V1.length, before, after: { ...after, latencyMs: elapsedMs, averageMsPerConcept: elapsedMs / BENCHMARK_CONCEPTS_V1.length,
      resolverMedianMsPerConcept: percentile(durations, 0.5), resolverP95MsPerConcept: percentile(durations, 0.95),
      averageOpenMojiQueries: after.queryTotal / BENCHMARK_CONCEPTS_V1.length }, rows,
  }
}

async function finish (code) {
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
  const projectsBefore = snapshotRealProjects()
  const block = () => { networkAttempts++; throw new Error('RED BLOQUEADA EN VISUAL RETRIEVAL V1') }
  global.fetch = block; http.request = block; https.request = block
  const bundle = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  const createProject = label => {
    const root = path.join(FIXTURE_ROOT, label)
    bundle.createProjectFiles(root, { id: label, clips: [], timelineVideoClips: [], aiScript: 'fixture' })
    return root
  }
  try {
    await runCase('1 ConceptSet conserva como máximo primary, secondary y tertiary', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'concepts', keyword: 'puente', concepts: ['puente', 'avión', 'reloj', 'bosque'] })
      const concepts = bundle.createVisualConceptSetV1({ intent })
      assert.equal(concepts.version, 1)
      assert.equal([concepts.primary, concepts.secondary, concepts.tertiary].filter(Boolean).length, 3)
      assert.equal(concepts.primary.originalTerm, 'puente')
    })
    await runCase('2 evidencia directa temporal tiene prioridad sobre contexto vecino', () => {
      const semantic = bundle.createLocalSceneSemanticV1({ sceneId: 'timed', start: 4, end: 5,
        transcriptSegments: [{ start: 2, end: 7, words: [{ word: 'emoción', start: 2, end: 3 }, { word: 'fútbol', start: 4.1, end: 4.8 }, { word: 'poder', start: 5.1, end: 5.8 }] }],
        concepts: [{ label: 'emoción', start: 2, end: 3 }, { label: 'fútbol', emoji: '⚽', start: 4.1, end: 4.8 }], anchor: 'emoción' })
      const intent = bundle.createAssetIntentV1({ sceneId: 'timed', keyword: 'fútbol', concepts: ['emoción', 'fútbol'] })
      const concepts = bundle.createVisualConceptSetV1({ intent, localSemantic: semantic })
      assert.equal(concepts.primary.originalTerm, 'fútbol')
      assert.equal(concepts.primary.emoji, '⚽')
    })
    await runCase('3 ConceptLexicon distingue exact, synonym, related y context', () => {
      const levelFor = (term, canonical) => bundle.expandConceptLexiconV1(term)
        .find(expansion => expansion.entry.canonical === canonical)?.level
      assert.equal(bundle.expandConceptLexiconV1('⚽')[0].level, 'exact')
      assert.equal(bundle.expandConceptLexiconV1('avión')[0].entry.canonical, 'airplane')
      assert.equal(bundle.expandConceptLexiconV1('avión')[0].level, 'synonym')
      assert.equal(levelFor('estadios', 'stadium'), 'synonym')
      assert.equal(levelFor('protestas', 'protest'), 'synonym')
      assert.equal(levelFor('jet', 'airplane'), 'related')
      assert.equal(levelFor('flight', 'airplane'), 'context')
    })
    await runCase('4 OpenMoji directo por emoji evita búsqueda incierta', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'football', keyword: 'fútbol', concepts: ['fútbol'] })
      const result = bundle.resolveVisualRetrievalV1({ intent, localSemantic: { version: 1, sceneId: 'football', start: 0, end: 1,
        localText: 'fútbol', localTokens: [], concepts: [{ label: 'fútbol', emoji: '⚽', start: 0, end: 1 }], globalHints: [], directEvidence: [] } })
      assert.equal(result.selectedHero.provider, 'openmoji')
      assert.equal(result.selectedHero.stableId, 'openmoji:26bd')
      assert.equal(result.selectedHero.score, 3)
      assert.equal(result.metrics.openMojiQueries, 0)
      const hex = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'cake-hex', keyword: '1F382', concepts: ['1F382'] }) })
      assert.equal(hex.selectedHero.stableId, 'openmoji:1f382')
      assert.equal(hex.metrics.openMojiQueries, 0)
    })
    await runCase('5 búsqueda ES/EN resuelve avión, puente, fútbol y construcción', () => {
      for (const [keyword, stableId] of [['avión', 'openmoji:2708'], ['puente', 'openmoji:1f309'], ['fútbol', 'openmoji:26bd'], ['construcción', 'openmoji:1f3d7']]) {
        const intent = bundle.createAssetIntentV1({ sceneId: keyword, keyword, concepts: [keyword] })
        const result = bundle.resolveVisualRetrievalV1({ intent })
        assert.equal(result.selectedHero.provider, 'openmoji', keyword)
        assert.equal(result.selectedHero.stableId, stableId, keyword)
      }
    })
    await runCase('6 consulta rica usa annotation, tags, grupo y subgroup sin leer SVG', () => {
      const original = fs.readFileSync
      let svgReads = 0
      fs.readFileSync = function (...args) {
        if (String(args[0]).replace(/\\/g, '/').includes('/color/svg/')) svgReads++
        return original.apply(this, args)
      }
      try {
        const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'hospital', keyword: 'hospital', concepts: ['hospital'] }) })
        assert.equal(result.selectedHero.stableId, 'openmoji:1f3e5')
      } finally { fs.readFileSync = original }
      assert.equal(svgReads, 0)
    })
    await runCase('7 índice Solar cubre el catálogo completo y separa base de variante', () => {
      const index = bundle.loadSolarAssetIndexV1()
      assert(index.totalVariantNames >= 7_700)
      const wallet = index.bases.find(value => value.base === 'wallet')
      assert(wallet.variants.includes('wallet-outline'))
      assert(wallet.renderableVariants.includes('wallet-bold-duotone'))
      const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'wallet', keyword: 'billetera', concepts: ['billetera'] }) })
      assert.equal(result.selectedHero.provider, 'solar')
      assert.equal(result.selectedHero.solarBase, 'wallet')
      assert.equal(result.selectedHero.solarVariant, 'wallet-bold-duotone')
    })
    await runCase('8 Solar no desplaza un OpenMoji concreto por coincidencia débil', () => {
      const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'mexico', keyword: 'México', concepts: ['México'] }) })
      assert.equal(result.selectedHero.provider, 'openmoji')
      assert.equal(result.selectedHero.stableId, 'openmoji:1f1f2-1f1fd')
    })
    await runCase('9 SearchPlan habla el idioma de cada proveedor', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'airplane', keyword: 'avión', concepts: ['avión'] })
      const plans = bundle.buildVisualSearchPlansV1({ intent }).plans
      const openmoji = plans.find(plan => plan.provider === 'openmoji')
      const solar = plans.find(plan => plan.provider === 'solar')
      const pixabay = plans.find(plan => plan.provider === 'pixabay-images')
      assert(openmoji.queries.some(query => query.text === 'airplane'))
      assert(solar.queries.some(query => query.text === 'airplane'))
      assert.equal(pixabay.pixabayPlans[0].parameters.colors, 'transparent')
      assert.match(pixabay.pixabayPlans[0].query, /airplane isolated/)
    })
    await runCase('10 primary, secondary y tertiary quedan listos como Hero y Support sin alterar renderer', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'multi', keyword: 'fútbol', concepts: ['fútbol', 'estadio', 'cerveza'] })
      const result = bundle.resolveVisualRetrievalV1({ intent })
      assert.equal(result.concepts.primary.normalizedTerm, 'football')
      assert.equal(result.concepts.secondary.preferredRole, 'support')
      assert.equal(result.concepts.tertiary.preferredRole, 'support')
      assert(result.selectedSupport.every(candidate => candidate.role === 'support'))
      assert(result.deferredCandidates.every(candidate => candidate.deferredUntilRendererSupport))
    })
    await runCase('11 una persona concreta puede producir Hero defendible', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'police', keyword: 'policía', concepts: ['policía'] })
      const result = bundle.resolveVisualRetrievalV1({ intent })
      assert.equal(result.selectedHero.provider, 'openmoji')
      assert.match(result.selectedHero.stableId, /^openmoji:1f46e/)
      assert.equal(result.editorialReason, null)
    })
    await runCase('12 errores históricos no entran como Hero', () => {
      for (const keyword of ['termodinámica', 'peatones', 'mástil']) {
        const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: keyword, keyword, concepts: [keyword] }) })
        assert(!result.selectedHero || !/mobile phone off|no pedestrians|mastodon/i.test(result.selectedHero.identity))
      }
    })
    await runCase('13 selección es determinista con mismo input e inventario', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'repeat', keyword: 'microscopio', concepts: ['microscopio', 'laboratorio'] })
      assert.deepEqual(bundle.resolveVisualRetrievalV1({ intent }), bundle.resolveVisualRetrievalV1({ intent }))
    })
    await runCase('14 Pixabay usa parámetros oficiales y nunca guarda la clave en plan o resultado', async () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'pixabay', keyword: 'avión', concepts: ['avión'] })
      const plan = bundle.buildVisualSearchPlansV1({ intent }).plans.find(value => value.provider === 'pixabay-images').pixabayPlans[0]
      let requested = null
      const result = await bundle.searchPixabayImagesV1({ plan, apiKey: 'secret-test-key', requestJson: async url => {
        requested = url
        return { hits: [{ id: 7, pageURL: 'https://pixabay.com/illustrations/airplane/', largeImageURL: 'https://cdn.pixabay.com/airplane.png',
          imageWidth: 1000, imageHeight: 600, type: 'illustration', tags: 'airplane, isolated, aircraft' }] }
      } })
      assert.equal(requested.searchParams.get('colors'), 'transparent')
      assert.equal(requested.searchParams.get('safesearch'), 'true')
      assert.equal(result.candidates[0].requiresDownloadValidation, true)
      assert.equal(result.candidates[0].ranking.transparency, 'requested-unverified')
      assert.equal(bundle.selectPixabayImageCandidateV1(result.candidates).id, '7')
      assert.equal(JSON.stringify(result).includes('secret-test-key'), false)
    })
    await runCase('15 colors=transparent no equivale a alpha: JPEG/PNG se inspeccionan por bytes', () => {
      const opaque = bundle.inspectPixabayRasterImageV1(pngRgba(255))
      const transparent = bundle.inspectPixabayRasterImageV1(pngRgba(0))
      assert.equal(opaque.hasAlpha, true)
      assert.equal(opaque.alphaUseful, false)
      assert.equal(transparent.hasAlpha, true)
      assert.equal(transparent.alphaUseful, true)
      const candidate = mockPixabayCandidate()
      candidate.ranking = { semantic: 3, lexicalLevel: 'exact', subject: 'object', role: 'hero', heroSuitability: 3,
        supportSuitability: 2, resolution: 'usable', transparency: 'requested-unverified', composition: 'unverified',
        providerConfidence: 1, previousSuccess: false, total: 321, reasons: [] }
      assert.equal(bundle.validatePixabayImageCandidateRankingV1(candidate, transparent).transparency, 'verified-useful')
      const root = createProject('pixabay-opaque')
      assert.throws(() => bundle.publishPixabayImageAssetV1({ projectRoot: root, candidate, bytes: pngRgba(255) }),
        error => error && error.code === 'PIXABAY_IMAGE_ALPHA_REQUIRED')
    })
    await runCase('16 Pixabay publica sólo bytes validados en un proyecto temporal y es idempotente', () => {
      const root = createProject('pixabay-publish')
      const first = bundle.publishPixabayImageAssetV1({ projectRoot: root, candidate: mockPixabayCandidate(), bytes: pngRgba(0), fetchedAt: '2026-09-10T00:00:00.000Z' })
      const second = bundle.publishPixabayImageAssetV1({ projectRoot: root, candidate: mockPixabayCandidate(), bytes: pngRgba(0), fetchedAt: '2026-09-10T00:00:00.000Z' })
      assert.equal(first.status, 'created')
      assert.equal(second.status, 'reused')
      assert.equal(bundle.findReusablePixabayImageAssetV1(root, mockPixabayCandidate()).asset.id, first.asset.id)
      assert.equal(bundle.readAssetStorage(root).manifest.assets.length, 1)
      assert.equal(bundle.verifyPixabayImageAssetContentV1(root, first.asset).alphaUseful, true)
      assert.match(first.asset.relativeFile, /^materiales\/assets\/pixabay\/[a-f0-9]{64}\.png$/)
    })
    await runCase('17 Pixabay rechaza repoRoot y no publica sin ProjectRoot explícito', () => {
      assert.throws(() => bundle.publishPixabayImageAssetV1({ projectRoot: REPO_ROOT, candidate: mockPixabayCandidate(), bytes: pngRgba(0) }),
        error => error && error.code === 'ASSET_PROJECT_ROOT_IS_REPOSITORY')
    })
    await runCase('18 la preparación normal no descarga ni publica Pixabay automáticamente', () => {
      const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'no-download', keyword: 'avión', concepts: ['avión'] }) })
      assert(result.deferredCandidates.some(candidate => candidate.provider === 'pixabay-images'))
      assert.equal(fs.existsSync(path.join(FIXTURE_ROOT, 'materiales', 'assets', 'pixabay')), false)
    })
    await runCase('19 resolver productivo conserva ProjectAsset first para OpenMoji', () => {
      const root = createProject('resolver-project')
      const intent = bundle.createAssetIntentV1({ sceneId: 'render-airplane', keyword: 'avión', concepts: ['avión'] })
      const first = bundle.resolveAndCompileVisualSceneV1({ intent, projectRoot: root, sistema: 'editorial', direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: 881 } })
      const second = bundle.resolveAndCompileVisualSceneV1({ intent: { ...intent, sceneId: 'render-airplane-two' }, projectRoot: root, sistema: 'editorial', direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: 882 } })
      assert.equal(first.decision.hero.provider, 'openmoji')
      assert.equal(second.decision.hero.published, 'reused')
      assert.equal(first.trace.retrieval.concepts.primary.normalizedTerm, 'airplane')
    })
    await runCase('20 trace conserva conceptos, planes, candidatos y fallback fuera de SceneSpec', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'trace', keyword: 'mapa', concepts: ['mapa', 'brújula'] })
      const result = bundle.resolveAndCompileVisualSceneV1({ intent, sistema: 'editorial', direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: 883 } })
      assert(result.trace.retrieval.plans.length > 0)
      assert.equal(JSON.stringify(result.compiled.sceneSpec).includes('pixabay-images'), false)
      assert.equal(JSON.stringify(result.compiled.sceneSpec).includes('searchPlans'), false)
      const root = createProject('trace-diagnostic')
      const persisted = bundle.writeVisualDecisionDiagnostic(root, {
        diagnosticVersion: 1, generationId: 'retrieval-trace', createdAt: '2026-09-10T00:00:00.000Z',
        summary: { requestedVisuals: 1, materializedVisuals: 1, qcRejectedVisuals: 0, resolverDegradedVisuals: 0, substitutedWithOriginal: 0, reasons: {} },
        scenes: [{ visualConcepts: result.trace.retrieval.concepts, searchPlans: result.trace.retrieval.plans,
          retrievalCandidates: result.trace.retrieval.candidates, selectedSupport: result.trace.retrieval.selectedSupport,
          deferredCandidates: result.trace.retrieval.deferredCandidates, editorialReason: result.trace.retrieval.editorialReason }],
      })
      const onDisk = JSON.parse(fs.readFileSync(persisted.absoluteFile, 'utf8'))
      assert.equal(onDisk.scenes[0].visualConcepts.primary.normalizedTerm, 'map')
      assert.equal(onDisk.scenes[0].searchPlans.some(plan => plan.provider === 'pixabay-images'), true)
    })
    await runCase('21 provider URL, trace y plans no alteran PixelIdentity ni hash', () => {
      const root = createProject('identity')
      const asset = bundle.publishOpenMojiAsset({ projectRoot: root, stableId: 'openmoji:1f382' }).asset
      const spec = sceneSpec(bundle, asset, { estructura: 'marcoPoster', keyword: 'PRUEBA', connector: null, semilla: 884 })
      const left = { type: 'visual_escena', extra: { sceneSpec: spec, trace: { query: 'airplane' }, renderBindings: { assets: [{ slotId: 'hero', assetId: 'one', relativeFile: 'a.svg' }] } } }
      const right = { type: 'visual_escena', extra: { sceneSpec: spec, trace: { query: 'bridge' }, renderBindings: { assets: [{ slotId: 'hero', assetId: 'two', relativeFile: 'b.svg' }] } } }
      assert.equal(bundle.sceneSpecPixelIdentity(spec), bundle.sceneSpecPixelIdentity(spec))
      assert.equal(bundle.hashGrafico(left, 540, 960, 1, 8, 'pantalla', 'editorial'), bundle.hashGrafico(right, 540, 960, 1, 8, 'pantalla', 'editorial'))
      assert.equal(bundle.sceneSpecReactKey(spec), 'scene-v1|' + bundle.sceneSpecPixelIdentity(spec))
    })
    await runCase('22 misma SceneSpec V14 conserva identidad y hash de caché', () => {
      const root = createProject('parity')
      const asset = bundle.publishOpenMojiAsset({ projectRoot: root, stableId: 'openmoji:1f382' }).asset
      const spec = sceneSpec(bundle, asset, { estructura: 'marcoPoster', keyword: 'PARIDAD', connector: null, semilla: 885 })
      const graphic = graphicFor(spec)
      const first = bundle.hashGrafico(graphic, 540, 960, 1, 8, 'pantalla', 'editorial')
      const second = bundle.hashGrafico(JSON.parse(JSON.stringify(graphic)), 540, 960, 1, 8, 'pantalla', 'editorial')
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
      assert.equal(first, second)
    })
    await runCase('23 benchmark fijo tiene al menos 100 conceptos y mejora recuperación directa anterior', () => {
      const result = benchmark(bundle)
      assert(result.count >= 100)
      assert(result.after.top1 >= 80, JSON.stringify(result.after))
      assert(result.after.top5 >= 90, JSON.stringify(result.after))
      assert(result.after.top1 > result.before.top1, JSON.stringify({ before: result.before, after: result.after }))
      assert.equal(result.after.absurd, 0, JSON.stringify(result.rows.filter(row => row.selected && !row.top1)))
      console.log('RETRIEVAL_BENCHMARK=' + JSON.stringify({ count: result.count, before: result.before, after: result.after }))
      console.log('RETRIEVAL_BENCHMARK_TOP1_MISSES=' + JSON.stringify(result.rows.filter(row => !row.top1)
        .map(row => ({ term: row.term, canonical: row.canonical, selected: row.selected?.identity ?? null, top5: row.top5 }))))
    })
    await runCase('24 benchmark mide cobertura por proveedor y Pixabay como plan, no como scraping', () => {
      const result = benchmark(bundle)
      assert(result.after.openMojiCoverage > 0)
      assert(result.after.solarCoverage > 0)
      assert(result.after.pixabayCoverage > 0)
      assert.equal(result.before.pixabayCoverage, 0)
      console.log('PIXABAY_BENCHMARK_MODE=search-plan-only; live API calls=0')
    })
    await runCase('25 ByPeople permanece ausente de proveedores activos', () => {
      const result = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'providers', keyword: 'puente', concepts: ['puente'] }) })
      assert.equal(JSON.stringify(result).toLowerCase().includes('bypeople'), false)
      assert.equal(bundle.VISUAL_RETRIEVAL_PROVIDER_REGISTRY_V1.bypeople.status, 'planned-not-audited')
    })
    await runCase('26 no hubo red durante toda la suite y el catálogo sigue local', () => {
      assert.equal(networkAttempts, 0)
      assert.equal(bundle.loadOpenMojiCatalog().entries.length, 4495)
    })
    await runCase('27 proyectos reales, estados raíz y fixture permanecen aislados', () => {
      assert.equal(snapshotRealProjects(), projectsBefore)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json')), false)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')), false)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'proyectos', '.cipher-test-fixture')), false)
    })
    assert.equal(completed, CASOS_ESPERADOS)
    console.log(`CASOS_COMPLETADOS=${completed}`)
    console.log(`CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
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
