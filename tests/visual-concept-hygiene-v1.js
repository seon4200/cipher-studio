// Product gate for Visual Concept Hygiene V1.
//
// Hygiene judges only raw lexical fallback before retrieval. Structured same-subclip semantics
// and explicit emoji/hex/hint evidence deliberately bypass it and retain their pre-Hygiene route.

const { app } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1 } = require('./fixtures/visual-concept-hygiene-calibration-v1')
const { VISUAL_CONCEPT_HYGIENE_HOLDOUT_V1 } = require('./fixtures/visual-concept-hygiene-holdout-v1')
const { VISUAL_CONCEPT_HYGIENE_HOLDOUT_V2 } = require('./fixtures/visual-concept-hygiene-holdout-v2')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('visual-concept-hygiene-v1')
const CASES_EXPECTED = 15
const FORENSIC_CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'forensic-semantic-corpus-v1.json'), 'utf8'))
const HOLDOUT_V2_SHA256 = 'DEAA6C66FC7D04636B612B24BA85A73565398A19775D72519C03E52DD4F539DA'
let completed = 0
let finished = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex').toUpperCase()
const canonical = (bundle, value) => bundle.canonicalNarrativeTerm(String(value || ''))

function snapshotRealProjects () {
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
  walk(path.join(REPO_ROOT, 'proyectos'))
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function semanticFor (bundle, row) {
  const end = Math.max(1, ...row.tokens.map(token => token.end + .1))
  return bundle.createLocalSceneSemanticV1({
    sceneId: row.id, start: 0, end,
    transcriptSegments: [{ start: 0, end, text: row.text, words: row.tokens }],
    concepts: row.concepts,
    globalText: row.text,
    globalHints: [],
    globalContextRef: 'fixture:visual-concept-hygiene:' + row.id,
  })
}

function expectedAuthority (row) {
  return row.expected.authority || (row.concepts.length ? 'structured-semantic' : 'lexical-fallback')
}

function evaluateRow (bundle, row) {
  const localSemantic = semanticFor(bundle, row)
  const intent = bundle.createAssetIntentV1({
    sceneId: row.id,
    keyword: row.keyword,
    concepts: row.concepts.map(concept => concept.label),
    preferredVisualMode: 'auto',
  })
  const concepts = bundle.createVisualConceptSetV1({ intent, localSemantic })
  const expectedTerm = canonical(bundle, row.expected.term)
  const authority = expectedAuthority(row)
  const records = concepts.hygiene.candidates.filter(candidate => canonical(bundle, candidate.originalTerm) === expectedTerm)
  const hygiene = records.find(candidate => candidate.authority === authority) || records[0]
  assert(hygiene, `sin registro para ${row.id}:${expectedTerm}`)
  const concept = [concepts.primary, concepts.secondary, concepts.tertiary].find(value => value &&
    canonical(bundle, value.originalTerm) === expectedTerm && value.hygieneAuthority === hygiene.authority) || null
  const prepared = bundle.buildVisualSearchPlansV1({ intent, localSemantic })
  const enriched = prepared.enriched.find(value => canonical(bundle, value.concept.originalTerm) === expectedTerm ||
    canonical(bundle, value.concept.normalizedTerm) === expectedTerm)
  const pixabay = !!enriched && prepared.plans.some(plan => plan.provider === 'pixabay-images' &&
    plan.concept === enriched.concept.normalizedTerm)
  return { localSemantic, intent, concepts, hygiene, concept, prepared, pixabay }
}

function assertLexicalRow (bundle, row) {
  const result = evaluateRow(bundle, row)
  assert.equal(result.hygiene.authority, 'lexical-fallback', row.id)
  assert.equal(result.hygiene.hygieneEvaluated, true, row.id)
  assert(result.hygiene.decision, row.id)
  assert.equal(result.hygiene.decision.visuality, row.expected.visuality, row.id)
  assert.equal(result.hygiene.decision.eligibility, row.expected.eligibility, row.id)
  assert.equal(result.hygiene.emitted, row.expected.emitted, row.id)
  assert.equal(result.pixabay, row.expected.pixabay, row.id)
  if (result.concept) assert.equal(result.concept.hygiene?.normalizedTerm, canonical(bundle, row.expected.term), row.id)
  return result
}

function assertBypassRow (bundle, row) {
  const result = evaluateRow(bundle, row)
  assert.equal(result.hygiene.authority, expectedAuthority(row), row.id)
  assert.equal(result.hygiene.hygieneEvaluated, false, row.id)
  assert.equal(result.hygiene.decision, undefined, row.id)
  assert.equal(result.hygiene.emitted, row.expected.emitted, row.id)
  assert(result.concept, row.id)
  assert.equal(result.concept.hygiene, undefined, row.id)
  return result
}

/**
 * Definition frozen before repair execution: BAD_CONCEPT_RATE is the fraction of evaluated
 * lexical fallback terms that are not concrete visual subjects but could previously reach
 * physical/Pixabay routing through the old implicit object fallback.
 */
function oldFallbackWouldStartRaster (bundle, term) {
  return !bundle.isSpanishVisualStopwordV1(term) && bundle.visualNarrativeTermStrengthV1(term) >= 2
}

function matchesExpected (value) {
  const expected = value.row.expected
  const record = value.result.hygiene
  if (record.authority === 'lexical-fallback') return record.decision?.visuality === expected.visuality &&
    record.decision?.eligibility === expected.eligibility && record.emitted === expected.emitted && value.result.pixabay === expected.pixabay
  // Provider plans are not downloads or materialized photos. Structured inputs retain their
  // BASE plan, including an on-demand Pixabay fallback, so only lexical fallback rows assert
  // plan suppression. The frozen fixtures keep their original narrative evidence unchanged.
  const authorityMatches = record.authority === expectedAuthority(value.row) ||
    (record.authority === 'structured-semantic' && value.row.concepts.length > 0)
  return authorityMatches && !record.hygieneEvaluated && record.emitted === expected.emitted
}

function metricsFor (bundle, rows) {
  const evaluated = rows.map(row => ({ row, result: evaluateRow(bundle, row) }))
  const lexical = evaluated.filter(value => value.result.hygiene.authority === 'lexical-fallback' && value.result.hygiene.hygieneEvaluated)
  const bad = lexical.filter(value => value.result.hygiene.decision.visuality !== 'concrete-visual')
  const before = lexical.length ? bad.filter(value => oldFallbackWouldStartRaster(bundle, value.row.expected.term)).length / lexical.length : 0
  const after = lexical.length ? bad.filter(value => value.result.pixabay).length / lexical.length : 0
  const mismatches = evaluated.filter(value => !matchesExpected(value)).map(value => ({
    id: value.row.id,
    authority: value.result.hygiene.authority,
    actual: value.result.hygiene.decision?.visuality ?? 'bypassed',
    pixabay: value.result.pixabay,
  }))
  const agreement = (evaluated.length - mismatches.length) / evaluated.length
  const hygiene = evaluated.reduce((sum, value) => ({
    fallbackTokensEvaluated: sum.fallbackTokensEvaluated + value.result.concepts.hygiene.metrics.fallbackTokensEvaluated,
    structuredConceptsBypassedHygiene: sum.structuredConceptsBypassedHygiene + value.result.concepts.hygiene.metrics.structuredConceptsBypassedHygiene,
    explicitVisualEvidenceBypassedHygiene: sum.explicitVisualEvidenceBypassedHygiene + value.result.concepts.hygiene.metrics.explicitVisualEvidenceBypassedHygiene,
    lexicalFallbackConceptsHygieneEvaluated: sum.lexicalFallbackConceptsHygieneEvaluated + value.result.concepts.hygiene.metrics.lexicalFallbackConceptsHygieneEvaluated,
  }), { fallbackTokensEvaluated: 0, structuredConceptsBypassedHygiene: 0, explicitVisualEvidenceBypassedHygiene: 0, lexicalFallbackConceptsHygieneEvaluated: 0 })
  return {
    total: evaluated.length,
    lexicalFallback: lexical.length,
    concreteVisual: lexical.filter(value => value.result.hygiene.decision.visuality === 'concrete-visual').length,
    visualActionWithContext: lexical.filter(value => value.result.hygiene.decision.visuality === 'visual-action-with-context').length,
    abstractSymbolic: lexical.filter(value => value.result.hygiene.decision.visuality === 'abstract-symbolic').length,
    nonVisual: lexical.filter(value => value.result.hygiene.decision.visuality === 'non-visual').length,
    unknown: lexical.filter(value => value.result.hygiene.decision.visuality === 'unknown').length,
    tokensRejected: lexical.filter(value => !value.result.hygiene.emitted).length,
    photoQueriesPrevented: bad.filter(value => oldFallbackWouldStartRaster(bundle, value.row.expected.term) && !value.result.pixabay).length,
    heroEligible: lexical.filter(value => value.result.hygiene.decision.eligibility === 'hero-eligible').length,
    supportOnly: lexical.filter(value => value.result.hygiene.decision.eligibility === 'support-only').length,
    badConceptRateBefore: Number(before.toFixed(3)),
    badConceptRateAfter: Number(after.toFixed(3)),
    agreement,
    mismatches,
    hygiene,
  }
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
  const projectsBefore = snapshotRealProjects()
  const block = () => { networkAttempts++; throw new Error('RED BLOQUEADA EN VISUAL CONCEPT HYGIENE') }
  global.fetch = block; http.request = block; https.request = block
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  const projectRoot = path.join(FIXTURE_ROOT, 'project')
  bundle.createProjectFiles(projectRoot, { id: 'visual-concept-hygiene-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })

  try {
    await runCase('1 VERSION_PLANTILLAS permanece 15 y Hygiene permanece fuera del pixel contract', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
      assert.equal(bundle.VISUAL_CONCEPT_HYGIENE_VERSION, 1)
    })

    await runCase('2 calibration: sólo el fallback léxico es clasificado por Hygiene', () => {
      for (const row of VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.filter(row => !row.concepts.length)) assertLexicalRow(bundle, row)
    })

    await runCase('3 tokens no visuales no llegan a conceptos ni proveedores', () => {
      for (const id of ['fallback-bastante', 'fallback-resulta']) {
        const row = VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === id)
        const result = assertLexicalRow(bundle, row)
        assert.equal(result.concept, null)
        assert.equal(result.prepared.plans.length, 0)
      }
    })

    await runCase('4 objetos, personas y lugares léxicos concretos mantienen OpenMoji/Solar/Pixabay', () => {
      for (const id of ['concrete-persona', 'concrete-camara', 'concrete-hospital']) {
        const row = VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === id)
        const result = assertLexicalRow(bundle, row)
        assert(result.concept)
        assert.equal(result.hygiene.decision.eligibility, 'hero-eligible')
      }
    })

    await runCase('5 una acción lexical sólo sobrevive con contexto local y no abre Pixabay', () => {
      const alone = assertLexicalRow(bundle, VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === 'fallback-trabajar-alone'))
      const contextual = assertLexicalRow(bundle, VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === 'action-trabajar-with-context'))
      assert.equal(alone.concept, null)
      assert(contextual.concept)
      assert.equal(bundle.resolveAssetRepresentationPreferenceV1({ concept: contextual.concept, role: 'support-1' }).cutoutEligible, false)
    })

    await runCase('6 abstractos lexicales se enrutan a símbolo/editorial y no a raster', () => {
      const row = VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === 'fallback-desesperanza')
      const result = assertLexicalRow(bundle, row)
      assert(result.concept)
      assert.equal(bundle.resolveAssetRepresentationPreferenceV1({ concept: result.concept, role: 'hero' }).preference, 'editorial')
      assert.equal(bundle.resolveAssetRepresentationPreferenceV1({ concept: result.concept, role: 'support-1' }).preference, 'symbolic')
    })

    await runCase('7 conceptos estructurados mantienen la ruta histórica sin clasificación lexical', () => {
      const footballRow = VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === 'structured-football')
      const footballResult = assertBypassRow(bundle, footballRow)
      assert(footballResult.prepared.plans.some(plan => plan.provider === 'openmoji' || plan.provider === 'solar'))
      const abstractRow = VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === 'structured-abstract')
      const abstractResult = assertBypassRow(bundle, abstractRow)
      // BASE already treats this same-subclip process as editorial. Preservation means no
      // fabricated icon plan, not forcing an abstract structured term into a physical route.
      assert.equal(abstractResult.prepared.plans.length, 0)
      assert.equal(bundle.resolveAssetRepresentationPreferenceV1({ concept: abstractResult.concept, role: 'hero' }).preference, 'editorial')
      const football = evaluateRow(bundle, VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === 'structured-football'))
      assert.equal(football.concept.originalTerm, 'fútbol')
      assert.equal(football.concept.emoji, '⚽')
    })

    await runCase('8 evidencia explícita conserva el contrato BASE de conceptos estructurados y hexcode directo', () => {
      const message = evaluateRow(bundle, VISUAL_CONCEPT_HYGIENE_HOLDOUT_V1.find(value => value.id === 'hold-structured-message'))
      assert.equal(message.hygiene.authority, 'structured-semantic')
      assert.equal(message.hygiene.hygieneEvaluated, false)
      assert.equal(message.hygiene.decision, undefined)
      assert.equal(message.hygiene.explicitVisualEvidence.iconSymbolicOnly, true)
      assert.equal(message.concept.subject, 'object')
      assert.equal(message.concept.hygiene, undefined)
      assert.equal(message.pixabay, true) // plan only; no request or photo selection occurs here.
      const messageRepresentation = bundle.resolveAssetRepresentationPreferenceV1({ concept: message.concept, role: 'hero' })
      assert.equal(messageRepresentation.preference, 'icon')
      assert.deepEqual(messageRepresentation.attemptOrder, ['icon', 'photo-cutout', 'symbolic', 'full-raster', 'editorial'])
      const messageResolution = bundle.resolveVisualRetrievalV1({ intent: message.intent, localSemantic: message.localSemantic })
      assert.equal(messageResolution.selectedHero?.provider, 'solar')
      const hex = bundle.resolveVisualRetrievalV1({ intent: bundle.createAssetIntentV1({ sceneId: 'cake-hex', keyword: '1F382', concepts: ['1F382'] }) })
      assert.equal(hex.selectedHero?.stableId, 'openmoji:1f382')
      assert.equal(hex.metrics.openMojiQueries, 0)
      assert.equal(hex.plans.some(plan => plan.provider === 'pixabay-images'), true)
      const hexRepresentation = bundle.resolveAssetRepresentationPreferenceV1({ concept: hex.concepts.primary, role: 'hero' })
      assert.deepEqual(hexRepresentation.attemptOrder, ['photo-cutout', 'icon', 'symbolic', 'full-raster', 'editorial'])
    })

    await runCase('9 AssetIntent estructurado conserva su QueryPlan y representación histórica', () => {
      const intent = bundle.createAssetIntentV1({ sceneId: 'ai-structured', keyword: 'inteligencia', concepts: ['inteligencia artificial'] })
      const plans = bundle.buildVisualSearchPlansV1({ intent })
      const pixabay = plans.plans.find(plan => plan.provider === 'pixabay-images' && plan.concept === 'artificial intelligence')
      assert(pixabay)
      assert(pixabay.queries.some(query => /artificial intelligence|ai technology|brain technology/i.test(query.text)))
      const ai = plans.enriched.find(value => value.concept.normalizedTerm === 'artificial intelligence')
      assert(ai)
      assert.equal(ai.concept.hygiene, undefined)
      assert.equal(ai.concept.hygieneAuthority, 'structured-semantic')
      const representation = bundle.resolveAssetRepresentationPreferenceV1({ concept: ai.concept, role: 'hero' })
      assert.equal(representation.preference, 'symbolic')
      assert.deepEqual(representation.attemptOrder, ['symbolic', 'icon', 'editorial'])
    })

    await runCase('10 una escena mixta mantiene el concepto estructurado y sanea cada fallback por separado', () => {
      const localSemantic = bundle.createLocalSceneSemanticV1({
        sceneId: 'mixed-authority', start: 0, end: 1,
        transcriptSegments: [{ start: 0, end: 1, text: 'el robot es bastante útil', words: [
          { word: 'el', start: 0, end: .1 }, { word: 'robot', start: .2, end: .35 },
          { word: 'es', start: .4, end: .5 }, { word: 'bastante', start: .6, end: .8 }, { word: 'útil', start: .82, end: .98 },
        ] }],
        concepts: [{ label: 'robot', emoji: '🤖', start: .2, end: .35, scope: 'scene' }],
        globalText: 'el robot es bastante útil', globalHints: [], globalContextRef: 'fixture:mixed-authority',
      })
      const intent = bundle.createAssetIntentV1({ sceneId: 'mixed-authority', keyword: 'bastante', concepts: ['robot'] })
      const concepts = bundle.createVisualConceptSetV1({ intent, localSemantic })
      const robot = [concepts.primary, concepts.secondary, concepts.tertiary].find(value => value?.originalTerm === 'robot')
      const bastante = concepts.hygiene.candidates.find(value => canonical(bundle, value.originalTerm) === 'bastante')
      assert(robot)
      assert.equal(robot.hygiene, undefined)
      assert.equal(robot.hygieneAuthority, 'structured-semantic')
      assert(bastante)
      assert.equal(bastante.hygieneEvaluated, true)
      assert.equal(bastante.decision?.visuality, 'non-visual')
      assert.equal(bastante.emitted, false)
      const prepared = bundle.buildVisualSearchPlansV1({ intent, localSemantic })
      assert(prepared.plans.some(plan => plan.concept === 'robot'))
      assert.equal(prepared.plans.some(plan => plan.concept === 'bastante'), false)
    })

    await runCase('11 V15 no llama Pixabay para una acción genérica sin Hero elegible', async () => {
      const row = VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.find(value => value.id === 'fallback-trabajar-alone')
      const localSemantic = semanticFor(bundle, row)
      const base = bundle.resolveLocalSemanticVisualSceneV1({ localSemantic,
        keywordCandidates: [{ keyword: row.keyword, source: 'scene-semantic' }], preferredVisualMode: 'auto',
        projectRoot, sistema: 'editorial', direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: 170001 } })
      let searches = 0
      const resolution = await bundle.resolveMotionGraphicsSceneV2({ base, projectRoot, videoStyleId: 'cream-editorial', pixabayApiKey: 'fixture-key',
        hooks: { searchRequestJson: async () => { searches++; return { hits: [] } } } })
      assert.equal(searches, 0)
      assert.equal(resolution.choices.length, 0)
      assert.equal(resolution.compiled.sceneSpec.visualMode, 'editorial-text')
    })

    await runCase('12 Semantic Relevance Gate sigue independiente y admite EXACT|STRONG', () => {
      const concept = { originalTerm: 'perro', normalizedTerm: 'perro', aliases: ['perro'], subject: 'object', importance: 3,
        preferredRole: 'hero', evidence: 'direct-timed-token' }
      const relevance = bundle.evaluateSemanticRelevanceV1({ provider: 'openmoji', descriptors: ['dog face', 'pet', 'animal', 'perro'],
        authority: 'curated-local' }, bundle.relevanceConceptContextV1({ concept, level: 'exact' }))
      assert.equal(relevance.relevanceClass, 'EXACT')
      assert.equal(bundle.relevanceAdmitsRoleV1(relevance.relevanceClass, 'hero'), true)
    })

    await runCase('13 Holdout V1 pasa como corpus de regresión y mide before/after', () => {
      const calibration = metricsFor(bundle, VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1)
      const holdout = metricsFor(bundle, VISUAL_CONCEPT_HYGIENE_HOLDOUT_V1)
      console.log('CALIBRATION_RESULT=' + JSON.stringify(calibration))
      console.log('HOLDOUT_V1_REGRESSION_RESULT=' + JSON.stringify(holdout))
      assert.equal(calibration.agreement, 1)
      assert.equal(holdout.agreement, 1)
      assert.equal(calibration.badConceptRateAfter, 0)
      assert.equal(holdout.badConceptRateAfter, 0)
      assert(calibration.photoQueriesPrevented > 0)
      assert(holdout.photoQueriesPrevented > 0)
    })

    await runCase('14 Holdout V2 congelado antes del run final generaliza sin ajuste posterior', () => {
      const fixture = path.join(REPO_ROOT, 'tests', 'fixtures', 'visual-concept-hygiene-holdout-v2.js')
      assert.equal(sha256(fs.readFileSync(fixture)), HOLDOUT_V2_SHA256)
      const holdout = metricsFor(bundle, VISUAL_CONCEPT_HYGIENE_HOLDOUT_V2)
      console.log('HOLDOUT_V2_RESULT=' + JSON.stringify(holdout))
      assert.equal(holdout.agreement, 1)
      assert.equal(holdout.badConceptRateAfter, 0)
      const email = evaluateRow(bundle, VISUAL_CONCEPT_HYGIENE_HOLDOUT_V2.find(value => value.id === 'v2-explicit-symbol-email'))
      assert.equal(email.hygiene.authority, 'structured-semantic')
      assert.equal(email.pixabay, true)
      const dog = evaluateRow(bundle, VISUAL_CONCEPT_HYGIENE_HOLDOUT_V2.find(value => value.id === 'v2-explicit-physical-dog'))
      assert.equal(dog.hygiene.authority, 'structured-semantic')
      assert.equal(dog.pixabay, true)
    })

    await runCase('15 un fallback rechazado no libera un cupo para promover contexto semántico ajeno', () => {
      const scene = FORENSIC_CORPUS.scenes.find(value => value.sceneId === 'forensic-indignacion')
      assert(scene)
      const words = scene.timedWords.map(word => ({ word: word.word, start: word.start, end: word.end, probability: word.probability }))
      const localSemantic = bundle.createLocalSceneSemanticV1({
        sceneId: scene.sceneId, start: scene.start, end: scene.end,
        transcriptSegments: [{ start: Math.min(scene.start, ...words.map(word => word.start)),
          end: Math.max(scene.end, ...words.map(word => word.end)), text: scene.globalText, words }],
        concepts: scene.concepts, anchor: scene.anchor, globalText: scene.globalText,
        globalHints: [], globalContextRef: 'fixture:forensic-indignacion',
      })
      const intent = bundle.createAssetIntentV1({ sceneId: scene.sceneId, keyword: scene.sceneKeyword,
        concepts: scene.concepts.map(concept => concept.etiqueta || concept.label).filter(Boolean), preferredVisualMode: 'auto' })
      const concepts = bundle.createVisualConceptSetV1({ intent, localSemantic })
      const selected = [concepts.primary, concepts.secondary, concepts.tertiary].filter(Boolean)
        .map(concept => canonical(bundle, concept.originalTerm))
      assert.deepEqual(selected, ['indignacion', 'emocion'])
      assert.equal(selected.includes('fifa'), false)
      const rejected = concepts.hygiene.candidates.find(candidate => canonical(bundle, candidate.originalTerm) === 'cosa')
      assert.equal(rejected?.emitted, false)
    })

    assert.equal(completed, CASES_EXPECTED)
    assert.equal(networkAttempts, 0)
    assert.equal(snapshotRealProjects(), projectsBefore)
    finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    finish(1)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  finish(1)
})
