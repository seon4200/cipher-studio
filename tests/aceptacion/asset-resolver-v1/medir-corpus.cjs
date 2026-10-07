/* Real 42-scene evidence: physical trace -> compiled resolver, never human lookup. */
const { app } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const SOURCE = path.join(REPO_ROOT, 'tests', 'aceptacion', 'mvp-paso7', 'video.json')
const OUTPUT = path.join(__dirname, 'corpus-42.json')
const FIXTURE_ROOT = createTestFixture('asset-resolver-corpus')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let networkAttempts = 0

const blockNetwork = () => {
  networkAttempts += 1
  throw new Error('RED BLOQUEADA EN MEDICIÓN DEL CORPUS DEL RESOLVER')
}
global.fetch = blockNetwork
http.request = blockNetwork
https.request = blockNetwork
app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const text = value => typeof value === 'string' ? value.trim() : ''
const label = value => value && typeof value === 'object'
  ? text(value.etiqueta ?? value.label ?? value.name) : text(value)

function percentile (values, fraction) {
  const ordered = values.slice().sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))] ?? null
}

function directionFor (extra, index) {
  const source = extra?.direccion ?? {}
  return {
    fondo: source.fondo ?? 'tramaTejida', camara: source.camara ?? 'quieto',
    densidad: source.densidad ?? 'media', ritmo: source.ritmo ?? 'simultaneo',
    semilla: Number(extra?.semilla) || (91000 + index),
  }
}

function intentFor (entry, index) {
  const graphic = entry.graphicData ?? {}
  const extra = graphic.extra ?? {}
  const concepts = Array.isArray(extra.conceptos) ? extra.conceptos : []
  return {
    sceneId: `mvp-paso7-${entry.id ?? index + 1}`,
    keyword: text(graphic.value), concepts,
    relation: text(extra.relacion) || undefined, anchor: extra.ancla ?? undefined,
    searchTerms: [extra.ancla, ...concepts], preferredVisualMode: 'auto',
  }
}

function familyFor (decision) {
  if (decision.visualMode === 'editorial-text') return 'editorial-text'
  if (decision.hero?.provider === 'solar') return 'icon-monochrome'
  return decision.hero?.kind ?? 'unknown'
}

function main () {
  const sourceBytes = fs.readFileSync(SOURCE)
  const corpus = JSON.parse(sourceBytes)
  if (!Array.isArray(corpus.casos) || corpus.casos.length !== 42)
    throw new Error(`Se esperaban 42 casos físicos; llegaron ${corpus.casos?.length}`)
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  bundle.createProjectFiles(PROJECT_ROOT, {
    id: 'fixture-asset-resolver-corpus', clips: [], timelineVideoClips: [],
    aiScript: 'Medición offline del corpus físico mvp-paso7',
  })
  const session = bundle.createResolverSessionV1()
  const rows = corpus.casos.map((entry, index) => {
    const extra = entry.graphicData?.extra ?? {}
    const started = process.hrtime.bigint()
    const result = bundle.resolveAndCompileVisualSceneV1({
      intent: bundle.createAssetIntentV1(intentFor(entry, index)), projectRoot: PROJECT_ROOT,
      sistema: index % 2 === 0 ? 'editorial' : 'voltaje', direction: directionFor(extra, index), session,
    })
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
    return {
      sceneIndex: index + 1, id: entry.id, keyword: text(entry.graphicData?.value), anchor: label(extra.ancla),
      relation: text(extra.relacion) || null, visualMode: result.decision.visualMode,
      family: familyFor(result.decision), provider: result.decision.hero?.provider ?? null,
      metaphor: result.decision.metaphor?.id ?? null, candidate: result.trace.selectedCandidate?.identity ?? null,
      treatment: result.decision.hero?.provider === 'openmoji' ? result.decision.hero.treatment : 'none',
      structure: result.decision.structure, fallback: result.decision.fallback,
      alerts: result.decision.alerts.map(alert => alert.code), trace: result.trace, metrics: result.metrics,
      elapsedMs: Number(elapsedMs.toFixed(3)),
    }
  })
  const timings = rows.map(row => row.elapsedMs)
  const metrics = {
    sceneCount: rows.length,
    assetLed: rows.filter(row => row.visualMode === 'asset-led').length,
    editorialText: rows.filter(row => row.visualMode === 'editorial-text').length,
    providers: Object.fromEntries(['openmoji', 'solar', 'editorial-text']
      .map(provider => [provider, rows.filter(row => (row.provider ?? 'editorial-text') === provider).length])),
    families: Object.fromEntries(['icon-monochrome', 'simple-icon', 'complex-illustration', 'editorial-text']
      .map(family => [family, rows.filter(row => row.family === family).length])),
    ambiguous: rows.filter(row => row.fallback === 'AMBIGUOUS_ASSET_CANDIDATES').length,
    fallbacks: rows.filter(row => row.visualMode === 'editorial-text').length,
    falsePositiveGuards: {
      thermodynamics: rows[0]?.visualMode === 'editorial-text',
      pedestrians: rows[19]?.visualMode === 'editorial-text',
      mast: rows[30]?.visualMode === 'editorial-text',
    },
    totalMs: Number(timings.reduce((sum, value) => sum + value, 0).toFixed(3)),
    medianMs: Number(percentile(timings, .5).toFixed(3)),
    p95Ms: Number(percentile(timings, .95).toFixed(3)),
    openMojiQueries: rows.reduce((sum, row) => sum + row.metrics.openMojiQueries, 0),
    publications: rows.reduce((sum, row) => sum + row.metrics.assetsPublished, 0),
    reusedAssets: rows.reduce((sum, row) => sum + row.metrics.projectAssetsReused, 0),
    manifestReads: rows.reduce((sum, row) => sum + row.metrics.manifestReads, 0),
  }
  if (networkAttempts !== 0) throw new Error(`La medición intentó red: ${networkAttempts}`)
  if (!Object.values(metrics.falsePositiveGuards).every(Boolean))
    throw new Error('Falló una barrera crítica de falso positivo')
  const output = {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    source: {
      trace: 'tests/aceptacion/mvp-paso7/video.json', sha256: sha256(sourceBytes),
      sceneCount: corpus.casos.length, phraseStatus: 'not-stored-in-physical-trace',
    },
    method: 'AssetIntentV1 + resolveAndCompileVisualSceneV1 del main compilado; sin lookup de decisiones humanas experimentales.',
    offline: { networkAttempts }, metrics, scenes: rows,
  }
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ output: path.relative(REPO_ROOT, OUTPUT), metrics }, null, 2))
}

app.whenReady().then(main).catch(error => {
  console.error(error && error.stack || error)
  process.exitCode = 1
}).finally(() => {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error(error) }
  app.exit(process.exitCode ?? 0)
})
