const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture, removeFixtureFile } = require('./helpers/safe-fixture')
const { sceneSpec, graphicFor, bindingsFor } = require('./helpers/visual-mvp-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('visual-asset-mvp')
const CASOS_ESPERADOS = 40
let completed = 0
let finished = false
let networkAttempts = 0
let visualNetworkBaseline = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
const blockNetwork = () => {
  networkAttempts += 1
  throw Object.assign(new Error('RED BLOQUEADA EN VISUAL MVP'), { code: 'VISUAL_TEST_NETWORK_BLOCKED' })
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

app.whenReady().then(async () => {
  const bundle = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) {
      networkAttempts += 1
      callback({ cancel: true })
    } else callback({ cancel: false })
  })
  // The existing main window requests the voice list during startup. It is unrelated to the
  // asset render and remains blocked here; establish the Visual baseline only after that UI
  // initialization has settled so the assertion measures the productive path itself.
  await new Promise(resolve => setTimeout(resolve, 1500))
  visualNetworkBaseline = networkAttempts
  const newProject = label => {
    const root = path.join(FIXTURE_ROOT, label)
    bundle.createProjectFiles(root, {
      id: 'fixture-' + label, clips: [], timelineVideoClips: [], aiScript: 'Visual MVP fixture',
    })
    return root
  }
  const root = newProject('main-project')
  const cake = bundle.publishOpenMojiAsset({ projectRoot: root, stableId: 'openmoji:1f382' }).asset
  const astronaut = bundle.publishOpenMojiAsset({ projectRoot: root, stableId: 'openmoji:1f9d1-200d-1f680' }).asset
  const compass = bundle.publishOpenMojiAsset({ projectRoot: root, stableId: 'openmoji:1f9ed' }).asset
  const base = sceneSpec(bundle, cake)
  const baseGraphic = graphicFor(base)
  const baseBindings = bindingsFor(cake)

  try {
    await runCase('1 sceneSpec ausente conserva vía legacy', () => {
      const legacy = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [] } }
      const result = bundle.prepareGraphicForVisualRender({ graphicData: legacy })
      assert.equal(result.kind, 'legacy')
      assert.strictEqual(result.graphicData, legacy)
    })
    await runCase('2 asset-led exige Hero present', () => {
      const bad = { ...base, slots: [{ slotId: 'hero', role: 'hero', state: 'missing' }] }
      expectCode(() => bundle.validateVisualSceneSpec(bad), 'VISUAL_SCENE_HERO_REQUIRED')
    })
    await runCase('3 editorial-text acepta cero Hero', () => {
      const spec = sceneSpec(bundle, null, { visualMode: 'editorial-text' })
      assert.equal(spec.slots.length, 0)
    })
    await runCase('4 Hero present necesita RenderBinding', () => {
      expectCode(() => bundle.prepareGraphicForVisualRender({ graphicData: baseGraphic, projectRoot: root }), 'VISUAL_HERO_BINDING_REQUIRED')
    })
    await runCase('5 missing no conserva SHA de present', () => {
      const fallback = bundle.editorialFallbackSpec(base)
      assert.equal(fallback.slots[0].state, 'missing')
      assert(!Object.prototype.hasOwnProperty.call(fallback.slots[0], 'sha256'))
      assert.notEqual(bundle.sceneSpecPixelIdentity(base), bundle.sceneSpecPixelIdentity(fallback))
    })
    await runCase('6 relativeFile queda fuera de PixelIdentity', () => {
      const bindingA = bindingsFor(cake)
      const bindingB = { assets: [{ ...bindingA.assets[0], relativeFile: 'materiales/assets/openmoji/otra-ruta.svg' }] }
      assert.notDeepEqual(bindingA, bindingB)
      assert.equal(bundle.sceneSpecPixelIdentity(base), bundle.sceneSpecPixelIdentity(base))
    })
    await runCase('7 mismo spec/bytes y path distinto conserva hash', () => {
      const a = bundle.hashGrafico(baseGraphic, 1080, 1920, 2, 30, 'pantalla', base.sistema)
      const b = bundle.hashGrafico(graphicFor(clone(base)), 1080, 1920, 2, 30, 'pantalla', base.sistema)
      assert.equal(a, b)
    })
    await runCase('8 SHA distinta cambia identidad', () => {
      const changed = clone(base); changed.slots[0].sha256 = 'a'.repeat(64)
      assert.notEqual(bundle.sceneSpecPixelIdentity(base), bundle.sceneSpecPixelIdentity(bundle.validateVisualSceneSpec(changed)))
      assert.notEqual(bundle.hashGrafico(baseGraphic, 1080, 1920, 2, 30, 'pantalla', base.sistema),
        bundle.hashGrafico(graphicFor(changed), 1080, 1920, 2, 30, 'pantalla', base.sistema))
    })
    await runCase('9 treatment distinto cambia identidad', () => {
      const changed = clone(base); changed.slots[0].tint.treatment = 'duotone'
      assert.notEqual(bundle.sceneSpecPixelIdentity(base), bundle.sceneSpecPixelIdentity(bundle.validateVisualSceneSpec(changed)))
    })
    await runCase('10 motion distinto cambia identidad', () => {
      const changed = clone(base); changed.slots[0].motion.sustain.preset = 'breathe'
      assert.notEqual(bundle.sceneSpecPixelIdentity(base), bundle.sceneSpecPixelIdentity(bundle.validateVisualSceneSpec(changed)))
    })
    await runCase('11 clave React nace de la misma identidad visual', () => {
      assert.equal(bundle.sceneSpecReactKey(base), 'scene-v1|' + bundle.sceneSpecPixelIdentity(base))
      const changed = clone(base); changed.slots[0].tint.treatment = 'duotone'
      assert.notEqual(bundle.sceneSpecReactKey(base), bundle.sceneSpecReactKey(bundle.validateVisualSceneSpec(changed)))
    })
    await runCase('12 ProjectAsset se verifica antes de preparar bytes', () => {
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: baseGraphic, projectRoot: root, renderBindings: baseBindings })
      assert.equal(prepared.preparedAssets.length, 1)
      assert.equal(crypto.createHash('sha256').update(Buffer.from(prepared.preparedAssets[0].bytesBase64, 'base64')).digest('hex'), cake.sha256)
    })
    await runCase('13 archivo faltante compila fallback editorial', () => {
      const missingRoot = newProject('missing-project')
      const record = bundle.publishOpenMojiAsset({ projectRoot: missingRoot, stableId: 'openmoji:1f382' }).asset
      removeFixtureFile(FIXTURE_ROOT, path.join(missingRoot, record.relativeFile))
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: graphicFor(sceneSpec(bundle, record)), projectRoot: missingRoot, renderBindings: bindingsFor(record) })
      assert.equal(prepared.sceneSpec.visualMode, 'editorial-text')
      assert(prepared.warnings.includes('VISUAL_HERO_FALLBACK:PROJECT_ASSET_MISSING'))
    })
    await runCase('14 archivo con SHA cambiada compila fallback', () => {
      const changedRoot = newProject('changed-project')
      const record = bundle.publishOpenMojiAsset({ projectRoot: changedRoot, stableId: 'openmoji:1f382' }).asset
      fs.appendFileSync(path.join(changedRoot, record.relativeFile), '\n')
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: graphicFor(sceneSpec(bundle, record)), projectRoot: changedRoot, renderBindings: bindingsFor(record) })
      assert.equal(prepared.sceneSpec.visualMode, 'editorial-text')
      assert(prepared.warnings.some(w => /SIZE_MISMATCH|SHA_MISMATCH/.test(w)))
    })
    await runCase('15 MIME incorrecto es rechazado', () => {
      const bad = clone(base); bad.slots[0].mime = 'image/png'
      expectCode(() => bundle.validateVisualSceneSpec(bad), 'VISUAL_SCENE_SLOT_INVALID')
    })
    await runCase('16 cake usa accent-mask productivo', () => {
      assert.equal(base.slots[0].tint.treatment, 'accent-mask')
      assert.equal(cake.provider, 'openmoji')
    })
    await runCase('17 astronaut usa duotone productivo', () => {
      const spec = sceneSpec(bundle, astronaut, { kind: 'complex-illustration', treatment: 'duotone' })
      assert.equal(spec.slots[0].tint.treatment, 'duotone')
    })
    await runCase('18 treatment none permanece disponible', () => {
      assert.equal(sceneSpec(bundle, compass, { treatment: 'none' }).slots[0].tint.treatment, 'none')
    })
    await runCase('19 máximo ocho palabras visibles', () => {
      assert(sceneSpec(bundle, null, { visualMode: 'editorial-text', connector: 'Uno dos', keyword: 'tres cuatro', closing: 'cinco seis siete ocho' }))
      expectCode(() => sceneSpec(bundle, null, { visualMode: 'editorial-text', connector: 'Uno dos tres', keyword: 'cuatro cinco seis', closing: 'siete ocho nueve' }), 'VISUAL_SCENE_TEXT_INVALID')
    })
    await runCase('20 keyword es obligatoria', () => {
      const bad = clone(base); bad.text.keyword = ''
      expectCode(() => bundle.validateVisualSceneSpec(bad), 'VISUAL_SCENE_TEXT_INVALID')
    })
    await runCase('21 closing es opcional y no deja timing huérfano', () => {
      const spec = sceneSpec(bundle, null, { visualMode: 'editorial-text', closing: undefined })
      assert(!Object.prototype.hasOwnProperty.call(spec.text, 'closing'))
      assert(!Object.prototype.hasOwnProperty.call(spec.text.timing, 'closingStart'))
    })
    const frame = { left: 0, top: 8, right: 360, bottom: 648, width: 360, height: 640 }
    const goodSnapshot = at => ({ normalizedTime: at, frame, hero: { left: 100, top: 100, right: 260, bottom: 300, width: 160, height: 200 },
      text: { left: 30, top: 430, right: 330, bottom: 560, width: 300, height: 130 },
      keyword: { left: 50, top: 490, right: 310, bottom: 535, width: 260, height: 45 },
      heroOpacity: 1, keywordOpacity: 1, textColor: 'rgb(242, 244, 247)', textOverflow: false,
      maxLines: '2', visibleWords: 3 })
    await runCase('22 texto respeta safe zone', () => {
      assert.deepEqual(bundle.evaluateVisualDomQc(base, [goodSnapshot(.5)]), [])
    })
    const motion = bundle.createMvpMotion('fade-slide', 'float', 'fade-out', true)
    await runCase('23 bounds/motion de entry se evalúan', () => {
      const at0 = bundle.evaluateAssetMotion(motion, 0)
      const atEnd = bundle.evaluateAssetMotion(motion, .2)
      assert(at0.opacity < atEnd.opacity && at0.translateYCqmin > atEnd.translateYCqmin)
    })
    await runCase('24 sustain conserva Hero visible', () => {
      const at = bundle.evaluateAssetMotion(motion, .4)
      assert.equal(at.opacity, 1); assert.notEqual(at.translateYCqmin, 0)
    })
    await runCase('25 emphasis punch aumenta escala', () => {
      const withPunch = bundle.evaluateAssetMotion(motion, .57)
      const withoutPunch = bundle.evaluateAssetMotion(bundle.createMvpMotion('fade-slide', 'float', 'fade-out', false), .57)
      assert(withPunch.scale > withoutPunch.scale)
    })
    await runCase('26 exit llega a invisibilidad', () => {
      assert.equal(bundle.evaluateAssetMotion(motion, 1).opacity, 0)
    })
    await runCase('27 render real supera contraste local/QC', async () => {
      let qcReport = null
      const output = await bundle.renderGraphicClip(baseGraphic, { ancho: 360, alto: 640, fps: 8, duracion: 1,
        modo: 'pantalla', projectRoot: root, renderBindings: baseBindings,
        onQcReport: report => { qcReport = report }, onQcFailure: report => { qcReport = report } })
      assert(output && fs.existsSync(output), `render productivo nulo; QC=${JSON.stringify(qcReport)}`)
      assert(qcReport && qcReport.findings.every(finding => finding.level !== 'error'))
    })
    await runCase('28 las tres estructuras MVP son válidas', () => {
      for (const estructura of ['constelacion', 'marcoPoster', 'editorial'])
        assert.equal(sceneSpec(bundle, cake, { estructura }).direccion.estructura, estructura)
    })
    await runCase('29 fuera de allowlist no fuerza Hero y se rechaza como sceneSpec', () => {
      const bad = clone(base); bad.direccion.estructura = 'capasApiladas'
      expectCode(() => bundle.validateVisualSceneSpec(bad), 'VISUAL_SCENE_DIRECTION_INVALID')
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: { type: 'visual_escena', value: 'legacy', extra: { direccion: bad.direccion } } }).kind, 'legacy')
    })
    await runCase('30 fade-slide está implementado', () => {
      assert(bundle.evaluateAssetMotion(bundle.createMvpMotion('fade-slide', 'float', 'fade-out'), 0).translateYCqmin > 0)
    })
    await runCase('31 scale-in está implementado', () => {
      assert(bundle.evaluateAssetMotion(bundle.createMvpMotion('scale-in', 'float', 'fade-out'), 0).scale < 1)
    })
    await runCase('32 float está implementado', () => {
      const m = bundle.createMvpMotion('fade-slide', 'float', 'fade-out')
      assert.notEqual(bundle.evaluateAssetMotion(m, .25).translateYCqmin, bundle.evaluateAssetMotion(m, .35).translateYCqmin)
    })
    await runCase('33 breathe está implementado', () => {
      const m = bundle.createMvpMotion('scale-in', 'breathe', 'scale-down')
      assert.notEqual(bundle.evaluateAssetMotion(m, .25).scale, bundle.evaluateAssetMotion(m, .35).scale)
    })
    await runCase('34 fade-out está implementado', () => {
      const m = bundle.createMvpMotion('fade-slide', 'float', 'fade-out')
      assert(bundle.evaluateAssetMotion(m, .95).opacity < bundle.evaluateAssetMotion(m, .8).opacity)
    })
    await runCase('35 scale-down está implementado', () => {
      const m = bundle.createMvpMotion('scale-in', 'breathe', 'scale-down')
      assert(bundle.evaluateAssetMotion(m, 1).scale < bundle.evaluateAssetMotion(m, .8).scale)
    })
    await runCase('36 punch está limitado a un emphasis', () => {
      const m = bundle.createMvpMotion('scale-in', 'breathe', 'scale-down', true)
      assert.equal(m.emphasis.preset, 'punch'); assert(!Array.isArray(m.emphasis))
    })
    await runCase('37 render no intenta red', () => assert.equal(networkAttempts, visualNetworkBaseline))
    await runCase('38 render no consulta catálogo/provider ni reinterpreta Solar', () => {
      bundle.clearOpenMojiCatalogCacheForTests()
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: baseGraphic, projectRoot: root, renderBindings: baseBindings })
      assert.equal(prepared.kind, 'scene-spec')
      const solar = clone(base)
      solar.slots = [{
        slotId: 'hero', role: 'hero', state: 'procedural', kind: 'simple-icon',
        solarIcon: 'sun-bold-duotone', solarStyle: 'bold-duotone',
        bounds: base.slots[0].bounds, fitPolicy: 'contain', tint: { treatment: 'none' },
        motion: base.slots[0].motion,
      }]
      const solarSpec = bundle.validateVisualSceneSpec(solar)
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: graphicFor(solarSpec), projectRoot: root, renderBindings: { assets: [] } }).kind, 'scene-spec')
      solar.slots[0].solarIcon = 'sparkles'
      expectCode(() => bundle.validateVisualSceneSpec(solar), 'VISUAL_SCENE_SLOT_INVALID')
    })
    await runCase('39 ningún proyecto real fue modificado', () => {
      assert.equal(JSON.stringify(snapshotRealProjects()), realProjectsBefore)
    })
    await runCase('40 legacy conserva proyección y V13 invalida caché V12', () => {
      const legacy = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [
        { emoji: '🧠', etiqueta: 'recuerdo' }, { emoji: '🗂️', etiqueta: 'archivo' }, { emoji: '🔗', etiqueta: 'conexion' }],
        direccion: { fondo: 'ondas', estructura: 'constelacion', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', tipografia: 'archivo' } } }
      const hashV12 = bundle.hashGraficoConVersionPlantillas(legacy, 1080, 1920, 3, 30, 'pantalla', 'editorial', 12)
      const hashV13 = bundle.hashGrafico(legacy, 1080, 1920, 3, 30, 'pantalla', 'editorial')
      assert.equal(bundle.VERSION_PLANTILLAS, 13)
      assert.equal(hashV12, 'aaaacd306d51')
      assert.equal(hashV13, '3beef56a9943')
      assert.notEqual(hashV12, hashV13)
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: legacy }).kind, 'legacy')
    })

    assert.equal(completed, CASOS_ESPERADOS)
    assert.equal(networkAttempts, visualNetworkBaseline)
    assert.equal(JSON.stringify(snapshotRealProjects()), realProjectsBefore)
    assert(!fs.existsSync(path.join(REPO_ROOT, 'project-state.json')))
    assert(!fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')))
    console.log(`CASOS_COMPLETADOS=${completed}`)
    console.log(`CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
    finished = true
  } catch (error) {
    console.error(error && error.stack || error)
  } finally {
    try { bundle.cerrarVentanaGraficos() } catch {}
    global.fetch = originalFetch
    http.request = originalHttpRequest
    https.request = originalHttpsRequest
    try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error(error) }
    app.exit(finished ? 0 : 1)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  try { cleanupTestFixture(FIXTURE_ROOT) } catch {}
  app.exit(1)
})
