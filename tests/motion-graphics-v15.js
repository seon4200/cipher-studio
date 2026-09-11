const { app, BrowserWindow, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { sceneSpec, graphicFor } = require('./helpers/visual-mvp-fixture')
const { sceneSpecV15, graphicForV15, bindingsForV15 } = require('./helpers/motion-graphics-v15-fixture')
const { VISUAL_RETRIEVAL_HOLDOUT_V15 } = require('./fixtures/visual-retrieval-holdout-v15')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('motion-graphics-v15')
const CASOS_ESPERADOS = 38
let completed = 0
let finished = false
let networkAttempts = 0
let renderWindow = null
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const clone = value => JSON.parse(JSON.stringify(value))
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

async function runCase (name, fn) {
  await fn()
  completed += 1
  console.log('OK ' + name)
}

function pngRgba (alpha) {
  const chunk = (type, data) => Buffer.concat([Buffer.from([0, 0, 0, data.length]), Buffer.from(type), data, Buffer.alloc(4)])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.from([0, 0x35, 0x72, 0x9b, alpha])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function mockPixabayCandidate (id, options = {}) {
  return {
    provider: 'pixabay-images', id: String(id),
    pageUrl: `https://pixabay.com/illustrations/fixture-${id}/`,
    downloadUrl: `https://cdn.pixabay.com/photo/fixture-${id}.png`,
    tags: options.tags || ['police officer', 'isolated'], width: 1200, height: 900,
    imageType: 'illustration', score: 3, reason: 'FIXTURE', query: options.query || 'police officer isolated',
    transparentRequested: options.transparentRequested !== false, requiresDownloadValidation: true,
  }
}

function createProject (bundle, name) {
  const root = path.join(FIXTURE_ROOT, name)
  bundle.createProjectFiles(root, { id: name, clips: [], timelineVideoClips: [], aiScript: 'fixture V15' })
  return root
}

function semanticContext (bundle, options = {}) {
  const sceneId = options.sceneId || 'motion-v15-context'
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId, start: 10, end: 13,
    transcriptSegments: [{ start: 9.8, end: 13.2, text: options.text || 'el fútbol conecta el estadio y la celebración', words: options.words || [
      { word: 'el', start: 9.9, end: 10.05 }, { word: options.keyword || 'fútbol', start: 10.1, end: 10.65 },
      { word: 'conecta', start: 10.7, end: 11.15 }, { word: 'estadio', start: 11.2, end: 11.8 },
      { word: 'celebración', start: 11.9, end: 12.7 },
    ] }],
    concepts: options.concepts || [
      { label: 'fútbol', emoji: '⚽', start: 10.1, end: 10.65 },
      { label: 'estadio', emoji: '🏟️', start: 11.2, end: 11.8 },
      { label: 'celebración', emoji: '🎉', start: 11.9, end: 12.7 },
    ],
    anchor: options.anchor || options.keyword || 'fútbol', relation: options.relation || 'conecta',
    globalText: options.text || 'el fútbol conecta el estadio y la celebración',
    globalHints: options.globalHints || [], globalContextRef: 'fixture:motion-v15',
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId, duration: 1, localSemantic,
    keywordCandidates: [{ keyword: options.keyword || 'fútbol', source: 'scene-semantic' }],
    preferredVisualMode: 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: options.seed || 95101 },
    videoStyleId: options.videoStyleId || 'cream-editorial', lockedChoices: options.lockedChoices || [],
  })
}

function candidateReasonable (bundle, row, candidate) {
  if (!candidate) return false
  const expected = row.acceptableTokens.map(value => bundle.canonicalNarrativeTerm(value))
  let values = []
  if (candidate.provider === 'openmoji' && candidate.stableId) {
    const entry = bundle.getOpenMojiEntry(candidate.stableId)
    if (entry) values = [entry.annotation, ...entry.aliases, ...entry.tags, entry.group, entry.subgroup]
  } else if (candidate.provider === 'solar') {
    values = [candidate.solarBase, candidate.solarVariant]
  }
  const normalized = values.filter(Boolean).map(value => bundle.canonicalNarrativeTerm(value))
  return normalized.some(value => expected.some(token => value === token || value.includes(token) || token.includes(value)))
}

function runFrozenHoldout (bundle) {
  const rows = []
  let top1 = 0; let top5 = 0; let noResult = 0; let ambiguous = 0
  const provider = { openmoji: 0, solar: 0, editorial: 0 }
  const started = performance.now()
  for (const row of VISUAL_RETRIEVAL_HOLDOUT_V15) {
    const intent = bundle.createAssetIntentV1({ sceneId: row.id, keyword: row.term, concepts: [row.term] })
    const result = bundle.resolveVisualRetrievalV1({ intent })
    const first = candidateReasonable(bundle, row, result.selectedHero)
    const five = result.candidates.slice(0, 5).some(candidate => candidateReasonable(bundle, row, candidate))
    top1 += Number(first); top5 += Number(five); noResult += Number(result.candidates.length === 0)
    ambiguous += Number(result.candidates.length > 1 && result.candidates[0].score === result.candidates[1].score &&
      result.candidates[0].identity !== result.candidates[1].identity)
    if (result.selectedHero?.provider === 'openmoji') provider.openmoji++
    else if (result.selectedHero?.provider === 'solar') provider.solar++
    else provider.editorial++
    rows.push({ id: row.id, term: row.term, selected: result.selectedHero?.identity || null,
      provider: result.selectedHero?.provider || 'editorial', top1: first, top5: five,
      candidateCount: result.candidates.length })
  }
  return { count: rows.length, top1, top5, noResult, ambiguous, provider,
    latencyMs: performance.now() - started, rows }
}

function expectCode (fn, code) {
  assert.throws(fn, error => error && error.code === code, `Se esperaba ${code}`)
}

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { if (renderWindow && !renderWindow.isDestroyed()) renderWindow.destroy() } catch {}
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
  const block = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA EN MOTION GRAPHICS V15') }
  global.fetch = block; http.request = block; https.request = block
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts += 1; callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  await new Promise(resolve => setTimeout(resolve, 800))
  const startupNetworkBaseline = networkAttempts
  const projectRoot = createProject(bundle, 'project')
  const cake = bundle.publishOpenMojiAsset({ projectRoot, stableId: 'openmoji:1f382' }).asset
  const soccer = bundle.publishOpenMojiAsset({ projectRoot, stableId: 'openmoji:26bd' }).asset
  const astronaut = bundle.publishOpenMojiAsset({ projectRoot, stableId: 'openmoji:1f9d1-200d-1f680' }).asset
  const three = [
    { slotId: 'hero', asset: astronaut }, { slotId: 'support-1', asset: soccer }, { slotId: 'support-2', asset: cake },
  ]
  const fullSpec = sceneSpecV15(bundle, three, { family: 'redNodos', sceneId: 'three-assets', seed: 95111 })
  const fullGraphic = graphicForV15(fullSpec)
  const fullBindings = bindingsForV15(three)

  try {
    await runCase('1 VERSION_PLANTILLAS sube exactamente a 15', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
    })
    await runCase('2 V15 es schema aditivo y V14 sigue validando por dispatch histórico', () => {
      const old = sceneSpec(bundle, cake, { estructura: 'marcoPoster', keyword: 'HISTORIA', connector: null, semilla: 95102 })
      assert.equal(bundle.validateVisualSceneSpecAny(old).renderSpecVersion, 1)
      assert.equal(bundle.sceneSpecPixelIdentityAny(old), bundle.sceneSpecPixelIdentity(old))
      assert.equal(bundle.sceneSpecReactKeyAny(old), bundle.sceneSpecReactKey(old))
    })
    await runCase('3 contrato V15 permite exactamente Hero más dos Supports', () => {
      assert.equal(bundle.activeSlotsV2(fullSpec).length, 3)
      assert.deepEqual(bundle.activeSlotsV2(fullSpec).map(slot => slot.role), ['hero', 'support-1', 'support-2'])
      const invalid = clone(fullSpec); invalid.slots.push({ slotId: 'support-3', role: 'support-3', state: 'omitted' })
      expectCode(() => bundle.validateVisualSceneSpecV2(invalid), 'VISUAL_SCENE_SPEC_V2_INVALID')
    })
    await runCase('4 asset-led exige Hero y editorial acepta cero assets', () => {
      const editorial = sceneSpecV15(bundle, [], { visualMode: 'editorial-text', family: 'editorial', keyword: 'CONTEXTO' })
      assert.equal(editorial.slots.length, 0)
      const invalid = clone(editorial); invalid.visualMode = 'asset-led'
      expectCode(() => bundle.validateVisualSceneSpecV2(invalid), 'VISUAL_SCENE_V2_HERO_REQUIRED')
    })
    await runCase('5 slots e identidades semánticas duplicadas se rechazan', () => {
      const duplicateSlot = clone(fullSpec); duplicateSlot.slots[2].slotId = 'support-1'; duplicateSlot.slots[2].role = 'support-1'
      expectCode(() => bundle.validateVisualSceneSpecV2(duplicateSlot), 'VISUAL_SCENE_SPEC_V2_INVALID')
      const duplicateAsset = clone(fullSpec); duplicateAsset.slots[2].sha256 = duplicateAsset.slots[1].sha256
      expectCode(() => bundle.validateVisualSceneSpecV2(duplicateAsset), 'VISUAL_SCENE_SPEC_V2_INVALID')
    })
    await runCase('6 RenderBindings exige slot y assetId únicos', () => {
      assert.equal(bundle.validateRenderBindingsV2(fullBindings).assets.length, 3)
      const duplicate = clone(fullBindings); duplicate.assets[2].assetId = duplicate.assets[1].assetId
      expectCode(() => bundle.validateRenderBindingsV2(duplicate), 'VISUAL_RENDER_BINDINGS_V2_INVALID')
    })
    await runCase('7 Hero SHA forma parte de PixelIdentity', () => {
      const changed = clone(fullSpec); changed.slots[0].sha256 = 'a'.repeat(64)
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(fullSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(changed)))
    })
    await runCase('8 Support SHA forma parte de PixelIdentity', () => {
      const changed = clone(fullSpec); changed.slots[1].sha256 = 'b'.repeat(64)
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(fullSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(changed)))
    })
    await runCase('9 present y missing producen identidad distinta y layout compatible', () => {
      const degraded = bundle.degradedVisualSceneSpecV2(fullSpec, ['support-1'])
      assert.equal(degraded.slots.find(slot => slot.slotId === 'support-1').state, 'missing')
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(fullSpec), bundle.sceneSpecPixelIdentityAny(degraded))
    })
    await runCase('10 intercambiar Support 1 y Support 2 cambia identidad', () => {
      const swapped = clone(fullSpec)
      const first = swapped.slots[1].sha256; swapped.slots[1].sha256 = swapped.slots[2].sha256; swapped.slots[2].sha256 = first
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(fullSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(swapped)))
    })
    await runCase('11 original-color y duotone cambian identidad', () => {
      const changed = clone(fullSpec); changed.slots[0].tint.treatment = 'duotone'
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(fullSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(changed)))
    })
    await runCase('12 VideoVisualStyle efectivo cambia identidad', () => {
      const changed = clone(fullSpec)
      changed.videoStyle = bundle.materializeVideoVisualStyleV1({ videoStyleId: 'ink-technical', sceneId: 'three-assets', seed: 95111 })
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(fullSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(changed)))
    })
    await runCase('13 motion por slot cambia identidad', () => {
      const changed = clone(fullSpec); changed.slots[1].motion.sustain.cycleDivisor += 1
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(fullSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(changed)))
    })
    await runCase('14 provider path URL licencia y trace permanecen fuera del hash', () => {
      const left = graphicForV15(fullSpec, { provider: 'pixabay', sourceUrl: 'https://one.invalid',
        renderBindings: { version: 2, assets: [{ slotId: 'hero', assetId: 'a', relativeFile: 'a.png' }] } })
      const right = graphicForV15(fullSpec, { provider: 'bypeople', license: 'other', sourceUrl: 'https://two.invalid',
        renderBindings: { version: 2, assets: [{ slotId: 'hero', assetId: 'b', relativeFile: 'b.png' }] } })
      assert.equal(bundle.hashGrafico(left, 540, 960, 1, 8, 'pantalla', 'editorial'),
        bundle.hashGrafico(right, 540, 960, 1, 8, 'pantalla', 'editorial'))
    })
    await runCase('15 V14 cache no puede satisfacer V15', () => {
      const v14 = bundle.hashGraficoConVersionPlantillas(fullGraphic, 540, 960, 1, 8, 'pantalla', 'editorial', 14)
      const v15 = bundle.hashGrafico(fullGraphic, 540, 960, 1, 8, 'pantalla', 'editorial')
      assert.notEqual(v14, v15)
    })
    await runCase('16 React key usa la misma PixelIdentity que archivo', () => {
      assert.equal(bundle.sceneSpecReactKeyAny(fullSpec), 'scene-v2|' + bundle.sceneSpecPixelIdentityAny(fullSpec))
    })
    await runCase('17 OpenMoji nuevo conserva original-color por defecto', () => {
      assert(fullSpec.slots.filter(slot => slot.state === 'present').every(slot => slot.tint.treatment === 'original-color'))
    })
    await runCase('18 Solar usa system-tint explícito sin ProjectAsset paralelo', () => {
      const solarName = 'planet-3-linear'
      const spec = sceneSpecV15(bundle, [{ slotId: 'hero', solarIcon: solarName, solarStyle: 'linear' }],
        { family: 'marcoPoster', keyword: 'TIEMPO', connector: null, closing: null })
      assert.equal(spec.slots[0].state, 'procedural')
      assert.equal(spec.slots[0].tint.treatment, 'system-tint')
    })
    await runCase('19 Pixabay publica raster local original-color y SubjectBounds', () => {
      const candidate = mockPixabayCandidate('transparent')
      const published = bundle.publishPixabayImageAssetV1({ projectRoot, candidate, bytes: pngRgba(0), fetchedAt: '2026-09-10T00:00:00.000Z' })
      const descriptor = { slotId: 'hero', asset: published.asset, mime: 'image/png', alphaMode: 'useful-alpha',
        bounds: bundle.subjectBoundsFromPixabayRasterV1(pngRgba(0)) }
      const spec = sceneSpecV15(bundle, [descriptor], { family: 'marcoPoster', keyword: 'PERSONA' })
      assert.equal(spec.slots[0].tint.treatment, 'original-color')
      assert.equal(spec.slots[0].bounds.revision, 'subject-bounds-v1')
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: graphicForV15(spec), projectRoot,
        renderBindings: bindingsForV15([descriptor]) })
      assert.equal(prepared.preparedAssets.length, 1)
      assert.equal(prepared.preparedAssets[0].mime, 'image/png')
    })
    await runCase('20 renderer raster es provider-neutral después de ProjectAsset verificado', () => {
      assert.equal(typeof bundle.readVerifiedRasterProjectAssetContentV1, 'function')
      assert.equal(JSON.stringify(fullSpec).includes('provider'), false)
      assert.equal(JSON.stringify(fullBindings).includes('provider'), false)
    })
    await runCase('21 alpha útil exigida se verifica sobre bytes reales', () => {
      const candidate = mockPixabayCandidate('opaque', { transparentRequested: false })
      const published = bundle.publishPixabayImageAssetV1({ projectRoot, candidate, bytes: pngRgba(255), fetchedAt: '2026-09-10T00:00:00.000Z' })
      const descriptor = { slotId: 'hero', asset: published.asset, mime: 'image/png', alphaMode: 'useful-alpha' }
      const spec = sceneSpecV15(bundle, [descriptor], { family: 'marcoPoster', keyword: 'OPACO' })
      expectCode(() => bundle.prepareGraphicForVisualRender({ graphicData: graphicForV15(spec), projectRoot,
        renderBindings: bindingsForV15([descriptor]) }), 'VISUAL_ASSET_ALPHA_MISMATCH')
    })
    await runCase('22 preparación multiasset verifica y transporta exactamente tres assets', () => {
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: fullGraphic, projectRoot, renderBindings: fullBindings })
      assert.equal(prepared.preparedAssets.length, 3)
      for (const item of prepared.preparedAssets) {
        const expected = fullSpec.slots.find(slot => slot.slotId === item.slotId)
        assert.equal(crypto.createHash('sha256').update(Buffer.from(item.bytesBase64, 'base64')).digest('hex'), expected.sha256)
      }
    })
    await runCase('23 Hero desaparecido degrada a editorial con identidad nueva', () => {
      const original = path.join(projectRoot, astronaut.relativeFile)
      const held = original + '.held'; fs.renameSync(original, held)
      try {
        const prepared = bundle.prepareGraphicForVisualRender({ graphicData: fullGraphic, projectRoot, renderBindings: fullBindings })
        assert.equal(prepared.sceneSpec.visualMode, 'editorial-text')
        assert.equal(prepared.preparedAssets.length, 0)
        assert.notEqual(prepared.scenePixelIdentity, bundle.sceneSpecPixelIdentityAny(fullSpec))
      } finally { fs.renameSync(held, original) }
    })
    await runCase('24 Support desaparecido no derriba Hero y recompila familia compatible', () => {
      const original = path.join(projectRoot, soccer.relativeFile)
      const held = original + '.held'; fs.renameSync(original, held)
      try {
        const prepared = bundle.prepareGraphicForVisualRender({ graphicData: fullGraphic, projectRoot, renderBindings: fullBindings })
        assert.equal(prepared.sceneSpec.visualMode, 'asset-led')
        assert.equal(prepared.sceneSpec.slots.find(slot => slot.slotId === 'support-1').state, 'missing')
        assert.equal(prepared.sceneSpec.slots.find(slot => slot.slotId === 'support-2').state, 'missing')
        assert.equal(prepared.preparedAssets.length, 1)
      } finally { fs.renameSync(held, original) }
    })
    await runCase('25 matriz contiene y certifica las 17 familias con eligibility explícita', () => {
      assert.equal(bundle.MODERN_LAYOUT_STRUCTURES_V4.length, 17)
      assert.equal(Object.keys(bundle.LAYOUT_ELIGIBILITY_V4).length, 17)
      assert(Object.values(bundle.LAYOUT_ELIGIBILITY_V4).every(rule => rule.certified && rule.reason.length > 20))
    })
    await runCase('26 familias relacionales no son elegibles sin Supports reales ni relación', () => {
      assert.equal(bundle.isLayoutEligibleV4({ family: 'redNodos', visualMode: 'asset-led', supportCount: 0, relation: 'conecta' }), false)
      assert.equal(bundle.isLayoutEligibleV4({ family: 'redNodos', visualMode: 'asset-led', supportCount: 2 }), false)
      assert.equal(bundle.isLayoutEligibleV4({ family: 'redNodos', visualMode: 'asset-led', supportCount: 2, relation: 'conecta' }), true)
      assert.equal(bundle.isLayoutEligibleV4({ family: 'lineaTiempo', visualMode: 'asset-led', supportCount: 2, relation: 'antes y después' }), true)
    })
    await runCase('27 las 17 familias pasan QC estructural con fixtures semánticamente elegibles', () => {
      const supportsFor = family => bundle.LAYOUT_ELIGIBILITY_V4[family].minSupports
      for (let index = 0; index < bundle.MODERN_LAYOUT_STRUCTURES_V4.length; index++) {
        const family = bundle.MODERN_LAYOUT_STRUCTURES_V4[index]
        const count = supportsFor(family)
        const descriptors = family === 'editorial' ? [] : three.slice(0, count + 1)
        const spec = sceneSpecV15(bundle, descriptors, { visualMode: family === 'editorial' ? 'editorial-text' : 'asset-led',
          family, seed: 95200 + index, sceneId: 'family-' + family })
        assert.deepEqual(bundle.evaluateVisualStructuralQcV2(spec).filter(issue => issue.level === 'error'), [], family)
      }
    })
    await runCase('28 MotionPlan escalona Hero y Supports y reserva emphasis al Hero', () => {
      const [hero, one, two] = fullSpec.slots
      assert(hero.motion.entry.start < one.motion.entry.start && one.motion.entry.start < two.motion.entry.start)
      assert(hero.motion.emphasis && one.motion.emphasis === null && two.motion.emphasis === null)
      assert(hero.motion.exit.start >= hero.motion.sustain.end)
    })
    await runCase('29 VideoVisualStyle se materializa coherente por vídeo y varía sólo dentro de su familia', () => {
      const styles = Array.from({ length: 12 }, (_, index) => bundle.materializeVideoVisualStyleV1({
        videoStyleId: 'cream-editorial', sceneId: 'style-' + index, seed: 95300 + index,
      }))
      assert(styles.every(style => style.id === 'cream-editorial'))
      assert(styles.every(style => ['ivory', 'warm-cream', 'paper', 'soft-sand'].includes(style.backgroundVariant)))
      assert(styles.every(style => style.backgroundMotion === 'none'))
    })
    await runCase('30 generación y regeneración moderna comparten SceneSpec, choices e identidad', async () => {
      const context = semanticContext(bundle)
      const normal = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot }))[0]
      const regenerated = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [clone(normal.context)], projectRoot }))[0]
      assert.deepEqual(regenerated.resolved.compiled.sceneSpec, normal.resolved.compiled.sceneSpec)
      assert.deepEqual(regenerated.resolved.lockedChoices, normal.resolved.lockedChoices)
      assert.equal(bundle.sceneSpecPixelIdentityAny(regenerated.resolved.compiled.sceneSpec),
        bundle.sceneSpecPixelIdentityAny(normal.resolved.compiled.sceneSpec))
      assert.equal(regenerated.resolved.trace.roleDecisions.length, regenerated.resolved.choices.length)
    })
    await runCase('31 Pixabay se busca y descarga antes del SceneSpec; render sólo recibe ProjectAsset', async () => {
      const context = semanticContext(bundle, { sceneId: 'pixabay-person', keyword: 'fotógrafa', anchor: 'fotógrafa',
        text: 'la fotógrafa prepara el retrato', relation: 'documenta',
        words: [{ word: 'la', start: 9.9, end: 10.05 }, { word: 'fotógrafa', start: 10.1, end: 10.65 },
          { word: 'prepara', start: 10.7, end: 11.15 }, { word: 'el', start: 11.2, end: 11.35 },
          { word: 'retrato', start: 11.4, end: 12.1 }],
        concepts: [{ label: 'fotógrafa', start: 10.1, end: 10.65 }] })
      let searches = 0; let downloads = 0
      const result = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot,
        pixabayApiKey: 'fixture-key',
        hooks: {
          searchRequestJson: async url => { searches++; return /fotografa/i.test(url.searchParams.get('q') || '') ? { hits: [{ id: 7001,
            pageURL: 'https://pixabay.com/illustrations/photographer-7001/',
            largeImageURL: 'https://cdn.pixabay.com/photographer-7001.png', imageWidth: 1200, imageHeight: 900,
            type: 'illustration', tags: 'fotografa, aislada, retrato' }] } : { hits: [] } },
          downloadRequestBytes: async () => { downloads++; return pngRgba(0) },
        } }))[0].resolved
      console.log('PIXABAY_MATERIALIZATION_PROBE=' + JSON.stringify({ searches, downloads,
        baseMode: result.base.decision.visualMode, concepts: result.trace.concepts,
        decisions: result.trace.roleDecisions, pixabay: result.trace.pixabay }))
      assert.equal(searches > 0, true); assert.equal(downloads, 1)
      assert.equal(result.choices[0].provider, 'pixabay-images')
      assert.equal(result.compiled.sceneSpec.slots[0].tint.treatment, 'original-color')
      assert.equal(JSON.stringify(result.compiled.sceneSpec).includes('pixabay'), false)
      assert.equal(JSON.stringify(result.compiled.renderBindings).includes('https://'), false)
    })
    await runCase('32 presupuesto productivo impide tres rasters incluso en choices bloqueadas', async () => {
      const local = bundle.createLocalSceneSemanticV1({ sceneId: 'raster-budget', start: 0, end: 3,
        transcriptSegments: [{ start: 0, end: 3, text: 'policía científico protesta' }],
        concepts: [{ label: 'policía' }, { label: 'científico' }, { label: 'protesta' }], anchor: 'policía', relation: 'conecta' })
      const base = bundle.resolveLocalSemanticVisualSceneV1({ localSemantic: local,
        keywordCandidates: [{ keyword: 'policía', source: 'scene-semantic' }], preferredVisualMode: 'auto',
        projectRoot, sistema: 'editorial', direction: { fondo: 'ondas', camara: 'quieto', densidad: 'media',
          ritmo: 'simultaneo', semilla: 95401 } })
      const concepts = [base.trace.retrieval.concepts.primary, base.trace.retrieval.concepts.secondary,
        base.trace.retrieval.concepts.tertiary].filter(Boolean)
      assert.equal(concepts.length, 3)
      const lockedChoices = concepts.map((concept, index) => {
        const candidate = mockPixabayCandidate('budget-' + index)
        const asset = bundle.publishPixabayImageAssetV1({ projectRoot, candidate, bytes: pngRgba(index * 60),
          fetchedAt: '2026-09-10T00:00:00.000Z' }).asset
        return { slotId: index === 0 ? 'hero' : `support-${index}`, concept: concept.normalizedTerm,
          provider: 'pixabay-images', reason: 'LOCKED_FIXTURE', score: 3, assetId: asset.id,
          relativeFile: asset.relativeFile, sha256: asset.sha256, mime: asset.mime,
          bounds: bundle.fullSubjectBounds(), kind: 'photo-cutout', alphaMode: 'useful-alpha' }
      })
      await assert.rejects(() => bundle.resolveMotionGraphicsSceneV2({ base, projectRoot,
        videoStyleId: 'cream-editorial', lockedChoices }), error => error && error.code === 'MOTION_GRAPHICS_RASTER_BUDGET_EXCEEDED')
    })
    await runCase('33 DOM real monta tres slots, jerarquía textual y fondo quieto', async () => {
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: fullGraphic, projectRoot, renderBindings: fullBindings })
      renderWindow = new BrowserWindow({ show: false, width: 540, height: 968,
        webPreferences: { sandbox: false, contextIsolation: false } })
      await renderWindow.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))
      const snapshot = await renderWindow.webContents.executeJavaScript(`(async()=>{
        await window.__montar(${JSON.stringify(prepared.graphicData)},${JSON.stringify({ ancho: 540, alto: 960,
          modo: 'pantalla', duracion: 1, sistema: 'editorial' })},${JSON.stringify(prepared.preparedAssets)});
        window.__setT(.55); return window.__visualQc();
      })()`)
      assert.equal(snapshot.assets.length, 3)
      assert.equal(snapshot.backgroundMotion, 'none')
      assert.equal(snapshot.decoratorCount, 0)
      assert.equal(snapshot.keywordOverflow, false)
      const treatments = await renderWindow.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-qc-asset]')).map(x=>x.dataset.qcTreatment)`)
      assert.deepEqual(treatments, ['original-color', 'original-color', 'original-color'])
    })
    await runCase('34 QC runtime acepta una composición multiasset representativa', async () => {
      const report = await bundle.runVisualRuntimeQc(renderWindow, fullSpec, 1)
      assert.equal(report.findings.some(finding => finding.level === 'error'), false)
      assert(report.snapshots.every(snapshot => snapshot.assets.length === 3))

      const longKeyword = sceneSpecV15(bundle, three, { family: 'rayosImpacto', keyword: 'CONSTRUCCIÓN',
        connector: null, closing: 'trabajador estadio', typographyLookId: 'sport-condensed', sceneId: 'safe-punch' })
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: graphicForV15(longKeyword), projectRoot,
        renderBindings: fullBindings })
      await renderWindow.webContents.executeJavaScript(`window.__montar(${JSON.stringify(prepared.graphicData)},` +
        `${JSON.stringify({ ancho: 540, alto: 960, modo: 'pantalla', duracion: 1, sistema: 'editorial' })},` +
        `${JSON.stringify(prepared.preparedAssets)})`)
      const punchReport = await bundle.runVisualRuntimeQc(renderWindow, longKeyword, 1)
      assert.equal(punchReport.findings.some(finding => finding.level === 'error'), false)
    })
    await runCase('35 renderGraphicClip produce MP4 V15 por visual_escena', async () => {
      let qc = null
      const output = await bundle.renderGraphicClip(fullGraphic, { ancho: 360, alto: 640, fps: 8, duracion: 1,
        modo: 'pantalla', sistema: 'editorial', projectRoot, renderBindings: fullBindings,
        onQcReport: report => { qc = report }, onQcFailure: report => { qc = report } })
      assert(output && fs.existsSync(output))
      assert(qc && qc.findings.every(finding => finding.level !== 'error'))
    })
    await runCase('36 holdout congelado contiene conceptos inéditos y produce métricas honestas', () => {
      assert(VISUAL_RETRIEVAL_HOLDOUT_V15.length >= 50)
      const benchmark = require('./fixtures/visual-retrieval-benchmark-v1').BENCHMARK_CONCEPTS_V1
      const known = new Set(benchmark.flatMap(row => [row.term, row.canonical]).map(value => bundle.canonicalNarrativeTerm(value)))
      assert(VISUAL_RETRIEVAL_HOLDOUT_V15.every(row => !known.has(bundle.canonicalNarrativeTerm(row.canonical))))
      const result = runFrozenHoldout(bundle)
      assert.equal(result.count, VISUAL_RETRIEVAL_HOLDOUT_V15.length)
      console.log('RETRIEVAL_HOLDOUT_V15=' + JSON.stringify({ ...result, rows: undefined }))
      console.log('RETRIEVAL_HOLDOUT_V15_ERRORS=' + JSON.stringify(result.rows.filter(row => !row.top5)))
    })
    await runCase('37 holdout y compositor son deterministas y no hacen red', () => {
      const first = runFrozenHoldout(bundle); const second = runFrozenHoldout(bundle)
      assert.deepEqual(first.rows, second.rows)
      assert.equal(networkAttempts, startupNetworkBaseline)
    })
    await runCase('38 legacy y proyectos reales permanecen intactos', () => {
      const legacy = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [] } }
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: legacy }).kind, 'legacy')
      assert.equal(snapshotRealProjects(), projectsBefore)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json')), false)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')), false)
      assert.equal(networkAttempts, startupNetworkBaseline)
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
