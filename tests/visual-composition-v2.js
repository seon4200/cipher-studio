const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { sceneSpec, graphicFor, bindingsFor } = require('./helpers/visual-mvp-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('visual-composition-v2')
const CASOS_ESPERADOS = 24
let completed = 0
let finished = false
let networkAttempts = 0
let visualNetworkBaseline = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
const blockNetwork = () => {
  networkAttempts += 1
  throw Object.assign(new Error('RED BLOQUEADA EN COMPOSITION V2'), { code: 'VISUAL_COMPOSITION_NETWORK_BLOCKED' })
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
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}
const realProjectsBefore = snapshotRealProjects()

async function runCase (name, fn) {
  await fn()
  completed += 1
  console.log('OK ' + name)
}

function direction (seed = 42001, overrides = {}) {
  return { fondo: 'tramaTejida', camara: 'quieto', densidad: 'saturada', ritmo: 'simultaneo', semilla: seed, ...overrides }
}

function intent (bundle, sceneId, phrase, keyword, concepts = []) {
  return bundle.createAssetIntentV1({
    sceneId, phrase, keyword, concepts, anchor: concepts[0], searchTerms: concepts,
  })
}

app.whenReady().then(async () => {
  const bundle = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) {
      networkAttempts += 1
      callback({ cancel: true })
    } else callback({ cancel: false })
  })
  await new Promise(resolve => setTimeout(resolve, 1200))
  visualNetworkBaseline = networkAttempts
  const projectRoot = path.join(FIXTURE_ROOT, 'project')
  bundle.createProjectFiles(projectRoot, {
    id: 'visual-composition-v2', clips: [], timelineVideoClips: [], aiScript: 'fixture Composition V2',
  })
  const cake = bundle.publishOpenMojiAsset({ projectRoot, stableId: 'openmoji:1f382' }).asset
  const soccer = bundle.publishOpenMojiAsset({ projectRoot, stableId: 'openmoji:26bd' }).asset

  try {
    await runCase('1 VERSION_PLANTILLAS es exactamente 14', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 14)
    })
    await runCase('2 V14 invalida el hash V13 para la misma sceneSpec', () => {
      const spec = sceneSpec(bundle, cake)
      const graphic = graphicFor(spec)
      const v12 = bundle.hashGraficoConVersionPlantillas(graphic, 540, 960, 1, 8, 'pantalla', 'editorial', 12)
      const v13 = bundle.hashGraficoConVersionPlantillas(graphic, 540, 960, 1, 8, 'pantalla', 'editorial', 13)
      const v14 = bundle.hashGrafico(graphic, 540, 960, 1, 8, 'pantalla', 'editorial')
      assert.notEqual(v12, v13)
      assert.notEqual(v13, v14)
    })
    await runCase('3 clave React conserva la autoridad PixelIdentity', () => {
      const spec = sceneSpec(bundle, cake)
      assert.equal(bundle.sceneSpecReactKey(spec), 'scene-v1|' + bundle.sceneSpecPixelIdentity(spec))
    })
    await runCase('4 sceneSpec persistida con revisiones V1 sigue siendo válida', () => {
      const spec = sceneSpec(bundle, cake, { version13: true, estructura: 'constelacion' })
      spec.revisions = bundle.legacyVisualMvpRevisions()
      assert.deepEqual(bundle.validateVisualSceneSpec(spec).revisions, bundle.legacyVisualMvpRevisions())
    })
    await runCase('5 nuevas sceneSpec declaran layout/text/font V14', () => {
      const revisions = bundle.visualMvpRevisions()
      assert.equal(revisions.layoutRevision, 'visual-asset-layout-v3')
      assert.equal(revisions.textRevision, 'editorial-text-v3')
      assert.equal(revisions.fontRevision, 'cipher-typography-looks-v2')
      assert.equal(revisions.treatmentRevision, 'asset-treatment-v2')
    })
    await runCase('6 editorial local simple resuelve densidad baja', () => {
      assert.equal(bundle.resolveSceneDensityV2({ localText: 'la indignación crece', visualMode: 'editorial-text',
        heroState: 'none', actualElementCount: 2, visibleWordCount: 3, lineCount: 2,
        rhythm: 'simultaneo', structure: 'editorial', supportCount: 0 }), 'baja')
    })
    await runCase('7 editorial local rica resuelve media sin heredar párrafo global', () => {
      assert.equal(bundle.resolveSceneDensityV2({ localText: 'la emoción por una cosa y la indignación por la otra',
        visualMode: 'editorial-text', heroState: 'none', actualElementCount: 3, visibleWordCount: 7,
        lineCount: 3, rhythm: 'regular', structure: 'editorial', supportCount: 0 }), 'media')
    })
    await runCase('8 Hero y keyword simples resuelven densidad media', () => {
      assert.equal(bundle.resolveSceneDensityV2({ localText: 'el fútbol tiene poder', visualMode: 'asset-led',
        heroState: 'present', actualElementCount: 3, visibleWordCount: 3, lineCount: 2,
        rhythm: 'simultaneo', structure: 'constelacion', supportCount: 0 }), 'media')
    })
    await runCase('9 saturada exige una escena realmente poblada', () => {
      const value = bundle.resolveSceneDensityV2({ localText: 'una escena local con muchos elementos relacionados',
        visualMode: 'asset-led', heroState: 'present', actualElementCount: 6, visibleWordCount: 8,
        lineCount: 3, rhythm: 'golpeSeco', structure: 'marcoPoster', supportCount: 2 })
      assert.equal(value, 'saturada')
    })
    await runCase('10 presupuesto editorial reduce decoradores', () => {
      assert.equal(bundle.decoratorBudgetV2('editorial-text', 'baja', false), 0)
      assert.equal(bundle.decoratorBudgetV2('editorial-text', 'media', false), 1)
      assert.equal(bundle.decoratorBudgetV2('editorial-text', 'saturada', false), 3)
    })
    await runCase('11 presupuesto asset-led queda subordinado al Hero', () => {
      assert.equal(bundle.decoratorBudgetV2('asset-led', 'media', true), 2)
      assert.equal(bundle.decoratorBudgetV2('asset-led', 'alta', true), 3)
      assert.equal(bundle.decoratorBudgetV2('asset-led', 'saturada', true), 4)
    })
    await runCase('12 Editorial V2 deriva copia literal y acotada del contexto local', () => {
      const text = bundle.deriveEditorialTextV2({
        localText: 'fútbol no la fifa, no el país, el fútbol tiene ese poder y se',
        keyword: 'fútbol', visualMode: 'editorial-text', structure: 'editorial',
      })
      assert.equal(text.connector.toLowerCase(), 'el')
      assert.equal(text.closing.toLowerCase(), 'tiene ese poder y')
      assert.equal([text.connector, text.keyword, text.closing].join(' ').split(/\s+/).length, 6)
      assert.equal(text.maxLines, 3)
    })
    await runCase('13 asset-led conserva texto subordinado de dos líneas', () => {
      const text = bundle.deriveEditorialTextV2({
        localText: 'el fútbol tiene ese poder', keyword: 'fútbol', visualMode: 'asset-led', structure: 'constelacion',
      })
      assert.equal(text.connector.toLowerCase(), 'el')
      assert(!Object.prototype.hasOwnProperty.call(text, 'closing'))
      assert.equal(text.maxLines, 2)
    })
    await runCase('14 fallback editorial usa una familia text-only certificada', () => {
      const result = bundle.resolveAndCompileVisualSceneV1({
        intent: intent(bundle, 'editorial-structure', 'la indignación por la otra', 'indignación'),
        projectRoot, sistema: 'editorial', direction: direction(42014),
      })
      assert.equal(result.decision.visualMode, 'editorial-text')
      assert(['editorial', 'cintaDiagonal', 'rayosImpacto', 'cuaderno'].includes(result.decision.structure))
      assert.equal(result.compiled.sceneSpec.layout.heroPlacement, 'none')
    })
    await runCase('15 detalle interno exige duotono aunque el icono sea simple', () => {
      const treatment = bundle.resolveAssetTreatment({ kind: 'simple-icon', detailReliance: 'interior-detail' })
      assert.equal(treatment.effective, 'duotone')
      assert.equal(treatment.reason, 'INTERIOR_DETAIL_DUOTONE')
    })
    await runCase('16 silueta simple conserva accent-mask', () => {
      assert.equal(bundle.resolveAssetTreatment({ kind: 'simple-icon' }).effective, 'accent-mask')
    })
    const football = bundle.resolveAndCompileVisualSceneV1({
      intent: intent(bundle, 'football-v2', 'el fútbol tiene ese poder', 'fútbol', ['fútbol']),
      projectRoot, sistema: 'editorial', direction: direction(42016),
    })
    await runCase('17 fútbol conserva 26BD y cambia sólo representación', () => {
      assert.equal(football.decision.hero.stableId, 'openmoji:26bd')
      assert.equal(football.decision.hero.treatment, 'duotone')
      assert.equal(football.compiled.sceneSpec.slots[0].tint.treatment, 'duotone')
    })
    let footballQc = null
    await runCase('18 fútbol renderiza por la vía productiva con QC', async () => {
      const output = await bundle.renderGraphicClip(football.compiled.graphicData, {
        ancho: 540, alto: 960, fps: 8, duracion: 1, modo: 'pantalla', projectRoot,
        renderBindings: football.compiled.renderBindings,
        onQcReport: report => { footballQc = report }, onQcFailure: report => { footballQc = report },
      })
      assert(output && fs.existsSync(output))
      assert(footballQc && footballQc.findings.every(finding => finding.level !== 'error'))
    })
    await runCase('19 asset-led respeta el presupuesto real de decoradores', () => {
      assert(footballQc.snapshots.every(snapshot => snapshot.decoratorCount === 2))
      assert(footballQc.snapshots.every(snapshot => snapshot.emptyHeroFrames === 0))
    })
    let editorialQc = null
    await runCase('20 editorial V2 renderiza sin Hero ni marco muerto', async () => {
      const result = bundle.resolveAndCompileVisualSceneV1({
        intent: intent(bundle, 'editorial-render', 'la emoción por una cosa y la indignación por la otra', 'indignación'),
        projectRoot, sistema: 'editorial', direction: direction(42020, { fondo: 'causticas' }),
      })
      const output = await bundle.renderGraphicClip(result.compiled.graphicData, {
        ancho: 540, alto: 960, fps: 8, duracion: 1, modo: 'pantalla', projectRoot,
        renderBindings: result.compiled.renderBindings, onQcReport: report => { editorialQc = report },
      })
      assert(output && fs.existsSync(output))
      assert(editorialQc.snapshots.every(snapshot => snapshot.hero === null))
      assert(editorialQc.snapshots.every(snapshot => snapshot.emptyHeroFrames === 0))
    })
    await runCase('21 editorial V2 pasa bounds overflow y contraste local', () => {
      assert(!editorialQc.findings.some(finding => ['VISUAL_QC_TEXT_BOUNDS', 'VISUAL_QC_TEXT_OVERFLOW', 'VISUAL_QC_CONTRAST_LOCAL'].includes(finding.code) && finding.level === 'error'))
      assert(editorialQc.localTextContrast >= 3)
      assert(editorialQc.snapshots.every(snapshot => snapshot.keywordOverflow === false))
    })
    await runCase('22 QC conserva rechazo real para texto fuera de safe zone', () => {
      const spec = sceneSpec(bundle, null, { visualMode: 'editorial-text', estructura: 'editorial' })
      const frame = { left: 0, top: 8, right: 540, bottom: 968, width: 540, height: 960 }
      const bad = { normalizedTime: .5, frame, hero: null,
        text: { left: 0, top: 700, right: 540, bottom: 960, width: 540, height: 260 },
        keyword: { left: 0, top: 760, right: 540, bottom: 840, width: 540, height: 80 },
        heroOpacity: 0, keywordOpacity: 1, textColor: 'rgb(242,244,247)', textOverflow: true,
        maxLines: '2', visibleWords: 2, decoratorCount: 0, emptyHeroFrames: 0 }
      const codes = bundle.evaluateVisualDomQc(spec, [bad]).map(finding => finding.code)
      assert(codes.includes('VISUAL_QC_TEXT_BOUNDS'))
      assert(codes.includes('VISUAL_QC_TEXT_OVERFLOW'))
    })
    await runCase('23 vía sin sceneSpec permanece legacy', () => {
      const legacy = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [] } }
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: legacy }).kind, 'legacy')
    })
    await runCase('24 cero red y proyectos reales intactos', () => {
      assert.equal(networkAttempts, visualNetworkBaseline)
      assert.equal(snapshotRealProjects(), realProjectsBefore)
      assert(!fs.existsSync(path.join(REPO_ROOT, 'project-state.json')))
      assert(!fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')))
    })

    assert.equal(completed, CASOS_ESPERADOS)
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
