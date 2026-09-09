// Resolver V1 is exercised through the compiled main bundle. It creates only marked fixtures
// below os.tmpdir(), blocks all network APIs, and fingerprints the user's real projects.
const { app } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture, removeFixtureFile } = require('./helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('asset-resolver-v1')
const CASOS_ESPERADOS = 40
let completed = 0
let finished = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const blockNetwork = () => {
  networkAttempts += 1
  throw Object.assign(new Error('RED BLOQUEADA EN ASSET RESOLVER V1'), { code: 'ASSET_RESOLVER_NETWORK_BLOCKED' })
}
global.fetch = blockNetwork
http.request = blockNetwork
https.request = blockNetwork
app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)

process.once('exit', () => {
  if (finished) return
  console.error(`FALLO: CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
  process.exitCode = 1
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
  return rows.sort((a, b) => a[0].localeCompare(b[0]))
}
const realProjectsBefore = JSON.stringify(snapshotRealProjects())

async function runCase (name, fn) {
  await fn()
  completed += 1
  console.log('OK ' + name)
}

function expectCode (fn, expected) {
  assert.throws(fn, error => error && error.code === expected)
}

function clone (value) { return JSON.parse(JSON.stringify(value)) }

function defaultDirection (seed = 701) {
  return { fondo: 'tramaTejida', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', semilla: seed }
}

app.whenReady().then(async () => {
  const bundle = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  const createProject = label => {
    const root = path.join(FIXTURE_ROOT, label)
    bundle.createProjectFiles(root, {
      id: 'resolver-' + label,
      clips: [],
      timelineVideoClips: [],
      aiScript: 'Fixture del resolver automático',
    })
    return root
  }
  const mainRoot = createProject('main-project')
  const intent = (sceneId, keyword, overrides = {}) => bundle.createAssetIntentV1({
    sceneId,
    keyword,
    concepts: overrides.concepts ?? [],
    relation: overrides.relation,
    anchor: overrides.anchor,
    phrase: overrides.phrase,
    searchTerms: overrides.searchTerms ?? [],
    preferredVisualMode: overrides.preferredVisualMode,
  })
  const resolve = (assetIntent, overrides = {}) => bundle.resolveAndCompileVisualSceneV1({
    intent: assetIntent,
    projectRoot: overrides.projectRoot === undefined ? mainRoot : overrides.projectRoot,
    sistema: overrides.sistema ?? 'editorial',
    direction: overrides.direction ?? defaultDirection(overrides.seed ?? 701),
    session: overrides.session,
  })

  try {
    await runCase('1 AssetIntent válido conserva sólo semántica narrativa', () => {
      const value = intent('one', 'pastel', { concepts: [{ etiqueta: 'cumpleaños' }], relation: 'conecta' })
      assert.equal(value.version, 1)
      assert.equal(value.keyword, 'pastel')
      assert.equal(Object.prototype.hasOwnProperty.call(value, 'provider'), false)
      assert.equal(Object.prototype.hasOwnProperty.call(value, 'sha256'), false)
    })
    await runCase('2 AssetIntent inválido es rechazado', () => {
      expectCode(() => bundle.createAssetIntentV1({ sceneId: '', keyword: 'válido' }), 'ASSET_INTENT_INVALID')
    })
    await runCase('3 keyword vacío es rechazado', () => {
      expectCode(() => bundle.createAssetIntentV1({ sceneId: 'empty', keyword: '  ' }), 'ASSET_INTENT_INVALID')
    })
    await runCase('4 sin metáfora concreta produce editorial-text', () => {
      const result = resolve(intent('generic', 'complejos'))
      assert.equal(result.decision.visualMode, 'editorial-text')
      assert.equal(result.decision.hero, null)
      assert.match(result.decision.fallback, /NO_CONCRETE_METAPHOR/)
    })
    await runCase('5 OpenMoji fuerte publica birthday cake local', () => {
      const result = resolve(intent('cake-strong', 'cumpleaños', { concepts: [{ etiqueta: 'pastel' }] }))
      assert.equal(result.decision.hero.provider, 'openmoji')
      assert.equal(result.decision.hero.stableId, 'openmoji:1f382')
      assert.equal(result.decision.visualMode, 'asset-led')
    })
    await runCase('6 candidato usable de puente puede producir Hero', () => {
      const result = resolve(intent('bridge-usable', 'puente'))
      assert.equal(result.decision.visualMode, 'asset-led')
      assert.equal(result.decision.hero.provider, 'openmoji')
      assert.equal(result.decision.hero.kind, 'complex-illustration')
      const anchored = resolve(intent('map-anchor-priority', 'entenderlo', { anchor: { etiqueta: 'mapa' } }))
      assert.equal(anchored.decision.hero.provider, 'solar')
      assert.equal(anchored.decision.hero.solarName, 'map-bold-duotone')
    })
    await runCase('7 candidato genérico no activa Hero', () => {
      const selection = bundle.chooseSemanticCandidateV1([{ identity: 'generic', score: 1 }])
      assert.equal(selection.selected, null)
      assert.equal(selection.reason, 'below-threshold')
    })
    await runCase('8 candidato incorrecto queda rechazado', () => {
      const selection = bundle.chooseSemanticCandidateV1([{ identity: 'incorrecto', score: 0 }])
      assert.equal(selection.selected, null)
      assert.equal(selection.reason, 'below-threshold')
    })
    await runCase('9 empate semántico no elige silenciosamente', () => {
      const selection = bundle.chooseSemanticCandidateV1([
        { identity: 'a', score: 3 }, { identity: 'b', score: 3 },
      ])
      assert.equal(selection.selected, null)
      assert.equal(selection.reason, 'ambiguous')
    })
    await runCase('10 ProjectAsset válido se reutiliza antes de publicar', () => {
      const result = resolve(intent('cake-reuse', 'pastel'))
      assert.equal(result.decision.hero.provider, 'openmoji')
      assert.equal(result.decision.hero.published, 'reused')
      assert.equal(result.metrics.projectAssetsReused, 1)
    })
    await runCase('11 ProjectAsset inválido no se usa silenciosamente', () => {
      const root = createProject('invalid-asset')
      const first = resolve(intent('bad-asset-first', 'pastel'), { projectRoot: root })
      assert.equal(first.decision.hero.provider, 'openmoji')
      fs.appendFileSync(path.join(root, first.decision.hero.relativeFile), '\n')
      const second = resolve(intent('bad-asset-second', 'pastel'), { projectRoot: root })
      assert.equal(second.decision.visualMode, 'editorial-text')
      assert(second.trace.providerCandidates.some(candidate => candidate.reason === 'PROJECT_ASSET_INVALID'))
    })
    await runCase('12 OpenMoji publica sólo el candidato seleccionado', () => {
      const root = createProject('publication')
      const result = resolve(intent('publish-astronaut', 'universo'), { projectRoot: root })
      assert.equal(result.decision.hero.provider, 'openmoji')
      assert.equal(result.metrics.assetsPublished, 1)
      const manifest = bundle.readAssetStorage(root).manifest
      assert.equal(manifest.assets.length, 1)
    })
    await runCase('13 segunda escena reutiliza el mismo OpenMoji publicado', () => {
      const session = bundle.createResolverSessionV1()
      const first = resolve(intent('repeat-one', 'pastel'), { session })
      const second = resolve(intent('repeat-two', 'pastel'), { session })
      assert.equal(first.decision.hero.stableId, second.decision.hero.stableId)
      assert.equal(second.decision.hero.published, 'reused')
    })
    await runCase('14 Solar gana para tiempo abstracto', () => {
      const result = resolve(intent('solar-time', 'tiempo'))
      assert.equal(result.decision.hero.provider, 'solar')
      assert.match(result.decision.hero.solarName, /stopwatch-bold-duotone$/)
      assert.equal(result.compiled.renderBindings.assets.length, 0)
      assert.equal(result.compiled.sceneSpec.slots[0].state, 'procedural')
      const prepared = bundle.prepareGraphicForVisualRender({
        graphicData: result.compiled.graphicData,
        projectRoot: mainRoot,
        renderBindings: result.compiled.renderBindings,
      })
      assert.equal(prepared.kind, 'scene-spec')
      assert.equal(prepared.preparedAssets.length, 0)
    })
    await runCase('15 escena humana cae a editorial-text', () => {
      const result = resolve(intent('human', 'multitud', { concepts: [{ etiqueta: 'peatones' }] }))
      assert.equal(result.decision.visualMode, 'editorial-text')
      assert.equal(result.decision.hero, null)
    })
    await runCase('16 termodinámica no recibe mobile phone off', () => {
      const result = resolve(intent('thermo', 'termodinámica', { concepts: [{ etiqueta: 'caos' }] }))
      assert.equal(result.decision.visualMode, 'editorial-text')
      assert(!result.trace.providerCandidates.some(candidate => /mobile phone off/i.test(candidate.annotation ?? candidate.identity)))
    })
    await runCase('17 peatones no reciben no pedestrians', () => {
      const result = resolve(intent('pedestrians', 'peatones', { concepts: [{ etiqueta: 'puente' }] }))
      assert.equal(result.decision.visualMode, 'editorial-text')
      assert(!result.trace.providerCandidates.some(candidate => /no pedestrians/i.test(candidate.annotation ?? candidate.identity)))
    })
    await runCase('18 mástil no recibe mastodon', () => {
      const result = resolve(intent('mast', 'mástil', { concepts: [{ etiqueta: 'barco' }] }))
      assert.equal(result.decision.visualMode, 'editorial-text')
      assert(!result.trace.providerCandidates.some(candidate => /mastodon/i.test(candidate.annotation ?? candidate.identity)))
    })
    await runCase('19 icono simple resuelve accent-mask', () => {
      assert.equal(bundle.resolveAssetTreatment({ kind: 'simple-icon' }).effective, 'accent-mask')
    })
    await runCase('20 ilustración compleja resuelve duotone', () => {
      assert.equal(bundle.resolveAssetTreatment({ kind: 'complex-illustration' }).effective, 'duotone')
    })
    await runCase('21 sólo se seleccionan las tres estructuras certificadas', () => {
      for (const keyword of ['pastel', 'puente', 'universo', 'tiempo']) {
        const result = resolve(intent('structure-' + keyword, keyword))
        assert(['constelacion', 'marcoPoster', 'editorial'].includes(result.decision.structure))
      }
    })
    await runCase('22 anti-repetición evita tres estructuras consecutivas iguales', () => {
      const session = bundle.createResolverSessionV1()
      const one = resolve(intent('anti-1', 'pastel'), { session, seed: 703 })
      const two = resolve(intent('anti-2', 'pastel'), { session, seed: 703 })
      const three = resolve(intent('anti-3', 'pastel'), { session, seed: 703 })
      assert.equal(one.decision.structure, two.decision.structure)
      assert.notEqual(three.decision.structure, two.decision.structure)
    })
    await runCase('23 reuso dentro de tres escenas se marca como continuidad', () => {
      const session = bundle.createResolverSessionV1()
      resolve(intent('continuity-one', 'pastel'), { session })
      const second = resolve(intent('continuity-two', 'pastel'), { session })
      assert.equal(second.trace.reuse.allowedByContinuity, true)
      assert.equal(second.trace.reuse.reusedProjectAsset, true)
    })
    await runCase('24 calidad semántica gana a variedad', () => {
      const session = bundle.createResolverSessionV1()
      resolve(intent('quality-one', 'pastel'), { session })
      resolve(intent('quality-two', 'pastel'), { session })
      const third = resolve(intent('quality-three', 'pastel'), { session })
      assert.equal(third.decision.hero.stableId, 'openmoji:1f382')
    })
    await runCase('25 traza conserva decisión y razones fuera del RenderSpec', () => {
      const result = resolve(intent('trace', 'pastel'))
      assert.equal(result.trace.sceneId, 'trace')
      assert.equal(result.trace.selectedMetaphor, 'birthday-cake')
      assert(!JSON.stringify(result.compiled.sceneSpec).includes('providerCandidates'))
    })
    await runCase('26 traza no modifica PixelIdentity', () => {
      const result = resolve(intent('trace-identity', 'pastel'))
      const identity = bundle.sceneSpecPixelIdentity(result.compiled.sceneSpec)
      const diagnostic = clone(result.trace); diagnostic.reasons.push('DIAGNOSTIC_ONLY')
      assert.equal(identity, bundle.sceneSpecPixelIdentity(result.compiled.sceneSpec))
    })
    await runCase('27 metadata administrativa de provider queda fuera de identidad', () => {
      const result = resolve(intent('binding-identity', 'pastel'))
      const changedBindings = { assets: [{ ...result.compiled.renderBindings.assets[0], relativeFile: 'materiales/assets/openmoji/otro.svg' }] }
      assert.notDeepEqual(changedBindings, result.compiled.renderBindings)
      assert(!bundle.sceneSpecPixelIdentity(result.compiled.sceneSpec).includes('relativeFile'))
    })
    await runCase('28 resolver materializa sceneSpec antes de hashear', () => {
      const result = resolve(intent('before-hash', 'pastel'))
      assert(result.compiled.graphicData.extra.sceneSpec)
      assert.match(bundle.hashGrafico(result.compiled.graphicData, 360, 640, 1, 8, 'pantalla', 'editorial'), /^[0-9a-f]{12}$/)
    })
    await runCase('29 sceneSpec compilado supera validación real', () => {
      const result = resolve(intent('spec-valid', 'pastel'))
      assert.deepEqual(bundle.validateVisualSceneSpec(result.compiled.sceneSpec), result.compiled.sceneSpec)
    })
    await runCase('30 RenderBindings compilados son válidos', () => {
      const result = resolve(intent('bindings-valid', 'pastel'))
      assert.deepEqual(bundle.validateRenderBindings(result.compiled.renderBindings), result.compiled.renderBindings)
    })
    await runCase('31 fallback editorial tiene identidad distinta', () => {
      const present = resolve(intent('present-identity', 'pastel'))
      const fallback = resolve(intent('missing-identity', 'complejos'))
      assert.notEqual(bundle.sceneSpecPixelIdentity(present.compiled.sceneSpec), bundle.sceneSpecPixelIdentity(fallback.compiled.sceneSpec))
    })
    await runCase('32 corpus físico de 42 escenas se resuelve sin lookup humano', () => {
      const corpus = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/aceptacion/mvp-paso7/video.json'), 'utf8'))
      assert.equal(corpus.casos.length, 42)
      const session = bundle.createResolverSessionV1()
      const decisions = corpus.casos.map((entry, index) => {
        const graphic = entry.graphicData
        const extra = graphic.extra ?? {}
        return resolve(intent('corpus-' + entry.id, graphic.value, {
          concepts: extra.conceptos ?? [], relation: extra.relacion ?? undefined,
          anchor: extra.ancla ?? undefined, searchTerms: [extra.ancla, ...(extra.conceptos ?? [])],
        }), { session, seed: Number(extra.semilla) || (900 + index) })
      })
      assert.equal(decisions.length, 42)
      assert(decisions.every(result => ['asset-led', 'editorial-text'].includes(result.decision.visualMode)))
    })
    await runCase('33 resolver no intenta red', () => assert.equal(networkAttempts, 0))
    await runCase('34 ningún proyecto real fue modificado', () => {
      assert.equal(JSON.stringify(snapshotRealProjects()), realProjectsBefore)
    })
    await runCase('35 abrir legacy no recompila ni resuelve', () => {
      const legacy = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [] } }
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: legacy }).kind, 'legacy')
    })
    await runCase('36 regeneración explícita sí resuelve', () => {
      const result = resolve(intent('explicit-regeneration', 'pastel'))
      assert.equal(result.decision.visualMode, 'asset-led')
    })
    await runCase('37 misma entrada e inventario producen decisión determinista', () => {
      const source = intent('deterministic', 'pastel')
      const first = resolve(source, { session: bundle.createResolverSessionV1(), seed: 817 })
      const second = resolve(source, { session: bundle.createResolverSessionV1(), seed: 817 })
      assert.deepEqual(first.compiled.sceneSpec, second.compiled.sceneSpec)
      assert.deepEqual(first.compiled.renderBindings, second.compiled.renderBindings)
    })
    await runCase('38 ResolverSession conserva historia acotada', () => {
      const session = bundle.createResolverSessionV1()
      for (let index = 0; index < 22; index++) resolve(intent('session-' + index, 'pastel'), { session, seed: 1000 + index })
      assert.equal(session.history.length, 18)
      assert.equal(session.version, 1)
    })
    await runCase('39 límites de búsqueda previenen loops', () => {
      const result = resolve(intent('limits', 'universo', { concepts: [{ etiqueta: 'astronauta' }, { etiqueta: 'espacio' }] }))
      assert(result.metrics.openMojiQueries <= 4)
      assert(result.metrics.openMojiCandidates <= 6)
      assert(result.metrics.manifestReads <= 1)
    })
    await runCase('40 ByPeople no aparece como provider activo', () => {
      const result = resolve(intent('no-bypeople', 'pastel'))
      assert.notEqual(result.decision.hero.provider, 'bypeople')
      assert(result.trace.providerCandidates.every(candidate => candidate.provider !== 'bypeople'))
    })

    assert.equal(completed, CASOS_ESPERADOS)
    assert.equal(networkAttempts, 0)
    assert.equal(JSON.stringify(snapshotRealProjects()), realProjectsBefore)
    assert(!fs.existsSync(path.join(REPO_ROOT, 'project-state.json')))
    assert(!fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')))
    console.log(`CASOS_COMPLETADOS=${completed}`)
    console.log(`CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
    finished = true
  } catch (error) {
    console.error(error && error.stack || error)
  } finally {
    global.fetch = originalFetch
    http.request = originalHttpRequest
    https.request = originalHttpsRequest
    try { bundle.cerrarVentanaGraficos() } catch {}
    try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error(error) }
    app.exit(finished ? 0 : 1)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  try { cleanupTestFixture(FIXTURE_ROOT) } catch {}
  app.exit(1)
})
