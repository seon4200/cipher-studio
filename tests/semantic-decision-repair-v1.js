// Ronda 4A: corpus forense reducido, consumidores reales compilados y fixtures sólo bajo tmp.
// Las expectativas son puertas de seguridad semántica, no un lookup de decisiones humanas.
const { app } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('semantic-decision-repair-v1')
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'forensic-semantic-corpus-v1.json'), 'utf8'))
const CASOS_ESPERADOS = 16
let completed = 0
let finished = false
let networkAttempts = 0
let forensicResults = []
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const blockNetwork = () => {
  networkAttempts += 1
  throw Object.assign(new Error('RED BLOQUEADA EN SEMANTIC DECISION REPAIR'), { code: 'SEMANTIC_DECISION_NETWORK_BLOCKED' })
}
global.fetch = blockNetwork
http.request = blockNetwork
https.request = blockNetwork
app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)

process.once('exit', () => {
  if (!finished) {
    console.error(`FALLO: CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
    process.exitCode = 1
  }
})

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
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
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(target), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}
const realProjectsBefore = snapshotRealProjects()

function runCase (name, fn) {
  return Promise.resolve().then(fn).then(() => {
    completed += 1
    console.log('OK ' + name)
  })
}

function timedSegment (scene) {
  const explicitWords = Array.isArray(scene.timedWords) ? scene.timedWords : null
  const words = explicitWords || scene.words || []
  const span = Math.max(.1, scene.end - scene.start)
  return [{
    start: explicitWords ? Math.min(scene.start, ...words.map(word => word.start)) : scene.start,
    end: explicitWords ? Math.max(scene.end, ...words.map(word => word.end)) : scene.end,
    text: scene.globalText,
    words: explicitWords
      ? words.map(word => ({ word: word.word, start: word.start, end: word.end, probability: word.probability }))
      : words.map((word, index) => ({
          word,
          start: scene.start + span * index / Math.max(1, words.length),
          end: scene.start + span * (index + 1) / Math.max(1, words.length),
          probability: .9,
        })),
  }]
}

function direction (seed = 917) {
  return { fondo: 'tramaTejida', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: seed }
}

app.whenReady().then(async () => {
  const bundle = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  const createProject = label => {
    const root = path.join(FIXTURE_ROOT, label)
    bundle.createProjectFiles(root, { id: 'semantic-' + label, clips: [], timelineVideoClips: [], aiScript: 'fixture semántico' })
    return root
  }
  const projectRoot = createProject('main-project')
  const semanticFor = scene => bundle.createLocalSceneSemanticV1({
    sceneId: scene.sceneId,
    start: scene.start,
    end: scene.end,
    transcriptSegments: timedSegment(scene),
    concepts: scene.concepts,
    anchor: scene.anchor,
    globalText: scene.globalText,
    globalContextRef: 'forensic:' + scene.sceneId,
  })
  const keywordCandidatesFor = scene => typeof scene.sceneKeyword === 'string'
    ? [{ keyword: scene.sceneKeyword, source: 'scene-semantic' }]
    : undefined
  const resolve = (scene, root = projectRoot, session) => bundle.resolveLocalSemanticVisualSceneV1({
    localSemantic: semanticFor(scene),
    ...(keywordCandidatesFor(scene) ? { keywordCandidates: keywordCandidatesFor(scene) } : {}),
    projectRoot: root,
    sistema: 'editorial',
    direction: direction(917),
    session,
  })
  const scene = id => corpus.scenes.find(candidate => candidate.sceneId === id)
  const candidateIds = result => result.trace.providerCandidates.map(candidate => candidate.stableId || candidate.identity)

  try {
    await runCase('1 contexto local limita la frase global de 598 caracteres', () => {
      const long = { ...scene('forensic-futbol'), globalText: 'fútbol '.repeat(100) }
      const semantic = semanticFor(long)
      assert(semantic.globalText.length > 480)
      assert(semantic.localText.length <= 360)
      const selection = bundle.selectNarrativeKeywordV2(semantic)
      const intent = bundle.createAssetIntentV1({ sceneId: semantic.sceneId, phrase: semantic.localText,
        keyword: selection.keyword, concepts: semantic.concepts, anchor: semantic.anchor, searchTerms: [] })
      assert.equal(intent.phrase, semantic.localText)
    })
    await runCase('2 la keyword residual no gana frente a evidencia concreta', () => {
      const semantic = semanticFor(scene('forensic-estando'))
      const selected = bundle.selectNarrativeKeywordV2(semantic, ['estando'])
      assert.notEqual(selected.keyword.toLowerCase(), 'estando')
      assert.notEqual(selected.reason, 'EXISTING_KEYWORD_CANDIDATE')
    })
    await runCase('3 toda escena forense nueva compila sceneSpec y no legacy', () => {
      forensicResults = corpus.scenes.map(item => ({ item, result: resolve(item) }))
      for (const { item, result } of forensicResults) {
        assert(result.compiled.graphicData.extra.sceneSpec, item.sceneId)
        assert.notEqual(result.compiled.graphicData.extra.sceneSpec, undefined)
      }
      const providers = forensicResults.reduce((counts, { result }) => {
        const provider = result.decision.hero?.provider || 'editorial-text'
        counts[provider] = (counts[provider] || 0) + 1
        return counts
      }, {})
      const residualTerms = new Set(['estando', 'llevaba', 'importante', 'perfecto', 'bellísimo', 'bellisimo'])
      const residualWinners = forensicResults.filter(({ result }) => residualTerms.has(result.keywordSelection.keyword.toLocaleLowerCase('es'))).length
      const degraded = forensicResults.filter(({ result }) => result.inputFallback.used).length
      console.log(`FORENSIC_SCENES=${forensicResults.length} SCENESPEC=${forensicResults.length} LEGACY=0 OPENMOJI=${providers.openmoji || 0} SOLAR=${providers.solar || 0} EDITORIAL=${providers['editorial-text'] || 0} DEGRADED=${degraded}`)
      console.log(`FORENSIC_RESIDUAL_WINNERS=${residualWinners}`)
    })
    await runCase('4 fútbol evalúa el balón local', () => {
      const result = resolve(scene('forensic-futbol'))
      assert(candidateIds(result).includes('openmoji:26bd'))
      assert.equal(result.decision.hero?.provider, 'openmoji')
      // The old semantic response may have carried an adjacent protest concept. The timed
      // local subject still owns this subclip, so it cannot silently become a flag scene.
      const contaminated = {
        ...scene('forensic-futbol'), anchor: 'protesta',
        concepts: [{ emoji: '🚩', etiqueta: 'protesta', icono: 'flag' }],
      }
      const localized = resolve(contaminated)
      assert.equal(localized.keywordSelection.keyword.toLocaleLowerCase('es'), 'fútbol')
      assert.equal(localized.decision.hero?.stableId, 'openmoji:26bd')
    })
    await runCase('5 estadio y construcción se evalúan sin regla por escena', () => {
      const stadium = resolve(scene('forensic-construir'))
      const construction = resolve(scene('forensic-estando'))
      assert(candidateIds(stadium).includes('openmoji:1f3df'))
      assert(candidateIds(construction).includes('openmoji:1f3d7'))
    })
    await runCase('6 cerveza y trabajador se evalúan como evidencia concreta', () => {
      const beer = resolve(scene('forensic-partidos'))
      const worker = resolve(scene('forensic-trabajadores'))
      assert(candidateIds(beer).includes('openmoji:1f37a'))
      assert(candidateIds(worker).some(identity => /^openmoji:1f477/.test(identity)))
    })
    await runCase('7 México usa la evidencia de bandera local', () => {
      const result = resolve(scene('forensic-mexicanos'))
      assert(candidateIds(result).includes('openmoji:1f1f2-1f1fd'))
    })
    await runCase('8 iglesia y religioso no heredan un cronómetro global', () => {
      for (const id of ['forensic-iglesia', 'forensic-religioso']) {
        const result = resolve(scene(id))
        assert.notEqual(result.decision.metaphor?.id, 'time-stopwatch')
        assert(!result.trace.providerCandidates.some(candidate => /stopwatch/i.test(candidate.identity)))
      }
      const staleFifa = {
        ...scene('forensic-iglesia'),
        concepts: [
          { etiqueta: 'FIFA', emoji: '🏢', icono: 'buildings' },
          { etiqueta: 'iglesia', emoji: '⛪', icono: 'home' },
          { etiqueta: 'prácticas', emoji: '📄', icono: 'document' },
        ],
        anchor: 'FIFA',
      }
      const localizedSemantic = bundle.createLocalSceneSemanticV1({
        sceneId: staleFifa.sceneId, start: 2, end: 3,
        transcriptSegments: [{ start: 0, end: 3, text: 'fútbol FIFA iglesia prácticas', words: [
          { word: 'fútbol', start: 0, end: .3, probability: .9 },
          { word: 'FIFA', start: .4, end: .7, probability: .9 },
          { word: 'iglesia', start: 2.1, end: 2.5, probability: .9 },
          { word: 'prácticas', start: 2.55, end: 2.9, probability: .9 },
        ] }],
        concepts: staleFifa.concepts, anchor: staleFifa.anchor, globalText: staleFifa.globalText,
      })
      const localizedChurch = bundle.resolveLocalSemanticVisualSceneV1({
        localSemantic: localizedSemantic, projectRoot, sistema: 'editorial', direction: direction(918),
      })
      assert.equal(localizedChurch.keywordSelection.keyword.toLocaleLowerCase('es'), 'iglesia')
      assert.equal(localizedChurch.decision.hero?.stableId, 'openmoji:26ea')
    })
    await runCase('9 la keyword semántica alineada no pierde ante un vecino temporal', () => {
      const result = resolve(scene('forensic-accidente'))
      assert.notEqual(result.decision.metaphor?.id, 'calendar')
      assert(!result.trace.providerCandidates.some(candidate => /calendar/i.test(candidate.identity)))
      assert(!/calendar/i.test(result.decision.hero?.stableId || result.decision.hero?.solarName || ''), JSON.stringify(result.trace))
      const indignation = resolve(scene('forensic-indignacion'))
      assert.equal(indignation.keywordSelection.keyword.toLocaleLowerCase('es'), 'indignación')
      assert.equal(indignation.keywordSelection.reason, 'SCENE_KEYWORD_DIRECT_TIMED_MATCH')
      assert.notEqual(indignation.keywordSelection.keyword.toLocaleLowerCase('es'), 'emoción')
      assert.equal(indignation.decision.visualMode, 'editorial-text')
    })
    await runCase('10 abstracción local de tiempo conserva Solar-first sin identidad concreta', () => {
      const item = {
        sceneId: 'forensic-time-abstract', start: 120, end: 122,
        globalText: 'El tiempo y las horas importan en el contexto global.',
        words: ['El', 'tiempo', 'ordena', 'el', 'proceso'],
        concepts: [{ etiqueta: 'tiempo' }], anchor: 'tiempo', mustEvaluate: [],
      }
      const result = resolve(item)
      assert.equal(result.decision.hero?.provider, 'solar')
      assert.equal(result.decision.hero?.solarName, 'stopwatch-bold-duotone')
    })
    await runCase('11 AssetIntent inválido materializa editorial seguro y no legacy', () => {
      const semantic = { ...semanticFor(scene('forensic-futbol')), localText: 'x'.repeat(600) }
      const result = bundle.resolveLocalSemanticVisualSceneV1({ localSemantic: semantic, projectRoot, sistema: 'editorial', direction: direction(923) })
      assert.equal(result.inputFallback.used, true)
      assert.equal(result.decision.visualMode, 'editorial-text')
      assert(result.compiled.graphicData.extra.sceneSpec)
    })
    await runCase('12 opportunity hit rate registra materialización o rechazo explícito', () => {
      const opportunities = corpus.scenes.filter(item => item.mustEvaluate.length)
      let hits = 0
      const misses = []
      for (const item of opportunities) {
        const result = resolve(item)
        const evaluated = item.mustEvaluate.every(id => candidateIds(result).includes(id))
        const explicit = result.decision.hero !== null || result.decision.fallback !== null || result.trace.reasons.length > 0
        if (evaluated && explicit) hits++
        else misses.push({ sceneId: item.sceneId, expected: item.mustEvaluate, candidates: candidateIds(result) })
      }
      const rate = hits / opportunities.length
      console.log(`CONCRETE_OPPORTUNITY_HIT_RATE=${hits}/${opportunities.length}=${(rate * 100).toFixed(1)}%`)
      console.log('CONCRETE_OPPORTUNITY_MISSES=' + JSON.stringify(misses))
      assert(rate >= .8)
    })
    await runCase('13 decisión local es determinista con sesión e inventario equivalentes', () => {
      const a = createProject('determinism-a')
      const b = createProject('determinism-b')
      const input = scene('forensic-futbol')
      const one = resolve(input, a, bundle.createResolverSessionV1())
      const two = resolve(input, b, bundle.createResolverSessionV1())
      assert.equal(bundle.sceneSpecPixelIdentity(one.compiled.sceneSpec), bundle.sceneSpecPixelIdentity(two.compiled.sceneSpec))
      assert.equal(one.decision.hero?.stableId, two.decision.hero?.stableId)
    })
    await runCase('14 traza persiste fuera de project-state y de PixelIdentity', () => {
      const result = resolve(scene('forensic-futbol'))
      const diagnostic = bundle.writeVisualDecisionDiagnostic(projectRoot, {
        diagnosticVersion: 1,
        generationId: 'semantic-decision-fixture',
        createdAt: '2026-09-09T00:00:00.000Z',
        summary: { requestedVisuals: 1, materializedVisuals: 0, qcRejectedVisuals: 1, resolverDegradedVisuals: 0,
          substitutedWithOriginal: 1, reasons: { VISUAL_QC_HERO_TEXT_OVERLAP: 1 } },
        scenes: [{ sceneId: result.decision.sceneId, localText: result.localSemantic.localText,
          trace: result.trace, sceneSpecIdentity: bundle.sceneSpecPixelIdentity(result.compiled.sceneSpec),
          qcReport: { snapshots: [], localTextContrast: 1.2, findings: [{ code: 'VISUAL_QC_HERO_TEXT_OVERLAP', level: 'error', message: 'fixture' }] } }],
      })
      const persisted = JSON.parse(fs.readFileSync(diagnostic.absoluteFile, 'utf8'))
      assert.equal(persisted.scenes[0].qcReport.findings[0].code, 'VISUAL_QC_HERO_TEXT_OVERLAP')
      assert(!JSON.stringify(result.compiled.sceneSpec).includes('providerCandidates'))
      assert(!JSON.stringify(result.compiled.sceneSpec).includes('localText'))
    })
    await runCase('15 token transcrito desconocido queda low-confidence o editorial explícito', () => {
      const result = resolve(scene('forensic-sportswagen'))
      assert(result.keywordSelection.confidence === 'low' || result.decision.visualMode === 'editorial-text')
      assert(result.trace.reasons.some(reason => /LOW_CONFIDENCE|NO_CONCRETE|PROVIDER_NO_USABLE/.test(reason)))
    })
    await runCase('16 resolver opera sin red y no toca proyectos reales', () => {
      assert.equal(networkAttempts, 0)
      assert.equal(snapshotRealProjects(), realProjectsBefore)
    })

    assert.equal(completed, CASOS_ESPERADOS)
    console.log(`CASOS_COMPLETADOS=${completed}`)
    console.log(`CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
    finished = true
    global.fetch = originalFetch
    http.request = originalHttpRequest
    https.request = originalHttpsRequest
    process.chdir(path.dirname(FIXTURE_ROOT))
    cleanupTestFixture(FIXTURE_ROOT)
    app.exit(0)
  } catch (error) {
    console.error(error && error.stack || error)
    global.fetch = originalFetch
    http.request = originalHttpRequest
    https.request = originalHttpsRequest
    process.chdir(path.dirname(FIXTURE_ROOT))
    try { cleanupTestFixture(FIXTURE_ROOT) } catch {}
    app.exit(1)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  process.chdir(path.dirname(FIXTURE_ROOT))
  try { cleanupTestFixture(FIXTURE_ROOT) } catch {}
  app.exit(1)
})
