const { app, BrowserWindow, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { auditTypographyLookFonts } = require('./helpers/visual-font-audit')
const { sceneSpec, graphicFor, bindingsFor } = require('./helpers/visual-mvp-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('visual-layout-typography-v3')
const CASOS_ESPERADOS = 24
let completed = 0
let finished = false
let networkAttempts = 0
let fontWindow = null
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

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

function findSplitLayouts (bundle) {
  const found = new Map()
  for (let seed = 1; seed < 100 && found.size < 2; seed++) {
    const layout = bundle.createVisualLayoutV3('partidoVertical', 'asset-led', seed)
    found.set(layout.heroPlacement, { seed, layout })
  }
  return found
}

function modernContext (bundle, sceneId = 'layout-v14-parity') {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId, start: 10, end: 12,
    transcriptSegments: [{ start: 9, end: 13, text: 'el fútbol tiene ese poder', words: [
      { word: 'el', start: 9.8, end: 10 }, { word: 'fútbol', start: 10.1, end: 10.6 },
      { word: 'tiene', start: 10.7, end: 11 }, { word: 'ese', start: 11.1, end: 11.3 },
      { word: 'poder', start: 11.4, end: 11.9 },
    ] }],
    concepts: [{ label: 'fútbol', emoji: '⚽' }], anchor: 'fútbol',
    globalText: 'El contexto global no sustituye la evidencia temporal local.',
    globalHints: ['fútbol'], globalContextRef: 'fixture:layout-v14',
  })
  return bundle.createModernVisualGenerationContextV1({
    sceneId, duration: 1, localSemantic,
    keywordCandidates: [{ keyword: 'fútbol', source: 'scene-semantic' }],
    preferredVisualMode: 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'constelacion', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: 61001 },
  })
}

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { if (fontWindow && !fontWindow.isDestroyed()) fontWindow.destroy() } catch {}
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
  global.fetch = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA EN LAYOUT V3') }
  http.request = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA EN LAYOUT V3') }
  https.request = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA EN LAYOUT V3') }
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts += 1; callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  await new Promise(resolve => setTimeout(resolve, 800))
  const startupNetworkBaseline = networkAttempts
  try {
    await runCase('1 matriz clasifica las 17 familias históricas exactamente una vez', () => {
      assert.equal(Object.keys(bundle.HISTORICAL_LAYOUT_MATRIX_V3).length, 17)
      assert.equal(new Set(Object.keys(bundle.HISTORICAL_LAYOUT_MATRIX_V3)).size, 17)
    })
    await runCase('2 siete familias modernas están certificadas para un Hero máximo más texto', () => {
      const certified = Object.entries(bundle.HISTORICAL_LAYOUT_MATRIX_V3).filter(([, value]) => value.certified)
      assert.deepEqual(certified.map(([id]) => id).sort(), [...bundle.MODERN_LAYOUT_STRUCTURES_V3].sort())
      assert.equal(certified.length, 7)
    })
    await runCase('3 cada familia diferida conserva razón y dependencia explícitas', () => {
      const deferred = Object.values(bundle.HISTORICAL_LAYOUT_MATRIX_V3).filter(value => !value.certified)
      assert.equal(deferred.length, 10)
      assert(deferred.every(value => value.reason.length >= 20))
      assert(deferred.every(value => ['REQUIRES_SUPPORT', 'REQUIRES_MULTI_ASSET', 'LEGACY_ONLY_FOR_NOW', 'REJECTED_WITH_REASON'].includes(value.status)))
    })
    await runCase('4 constelación no se certifica sin nodos reales', () => {
      assert.equal(bundle.HISTORICAL_LAYOUT_MATRIX_V3.constelacion.status, 'REQUIRES_SUPPORT')
      assert.equal(bundle.MODERN_LAYOUT_STRUCTURES_V3.includes('constelacion'), false)
    })
    await runCase('5 modos incompatibles se rechazan antes de render', () => {
      assert.throws(() => bundle.createVisualLayoutV3('editorial', 'asset-led', 1), /INCOMPATIBLE/)
      assert.throws(() => bundle.createVisualLayoutV3('marcoPoster', 'editorial-text', 1), /INCOMPATIBLE/)
    })
    await runCase('6 selector de presentación es determinista', () => {
      const input = { sceneId: 'deterministic', visualMode: 'asset-led', heroKind: 'simple-icon',
        visibleWordCount: 3, keywordLength: 7, density: 'media', rhythm: 'simultaneo', seed: 9191 }
      assert.deepEqual(bundle.selectVisualPresentationV3(input), bundle.selectVisualPresentationV3(input))
    })
    await runCase('7 anti-repetición evita tres estructuras consecutivas cuando hay alternativa compatible', () => {
      const input = { sceneId: 'anti-repeat', visualMode: 'asset-led', heroKind: 'simple-icon',
        visibleWordCount: 3, keywordLength: 7, density: 'media', rhythm: 'simultaneo', seed: 9192,
        recentStructures: ['marcoPoster', 'marcoPoster'] }
      const result = bundle.selectVisualPresentationV3(input)
      if (result.structure === 'marcoPoster') {
        const forced = bundle.selectVisualPresentationV3({ ...input, sceneId: 'anti-repeat-b', seed: 9193,
          recentStructures: [result.structure, result.structure] })
        assert.notEqual(forced.structure, result.structure)
      } else assert.notEqual(result.structure, 'marcoPoster')
    })
    await runCase('8 layouts certificados materializan siete gramáticas perceptuales', () => {
      assert.deepEqual(new Set(bundle.MODERN_LAYOUT_STRUCTURES_V3.map(id => bundle.STRUCTURE_FAMILY_V3[id])).size, 7)
    })
    await runCase('9 seis placements asset-led tienen envelopes materialmente distintos', () => {
      const layouts = bundle.MODERN_LAYOUT_STRUCTURES_V3.filter(id => id !== 'editorial')
        .map((id, index) => bundle.createVisualLayoutV3(id, 'asset-led', index + 1))
      assert.equal(new Set(layouts.map(layout => layout.heroPlacement)).size >= 5, true)
      assert.equal(new Set(layouts.map(layout => JSON.stringify(layout.heroEnvelope))).size, 6)
      assert(layouts.every(layout => layout.heroEnvelope.width >= 35 && layout.heroEnvelope.height >= 32))
    })
    await runCase('10 split liga izquierda y derecha del Hero a la región opuesta del texto', () => {
      const layouts = findSplitLayouts(bundle)
      assert.equal(layouts.size, 2)
      assert.equal(layouts.get('left-dominant').layout.textRegion, 'right')
      assert.equal(layouts.get('right-dominant').layout.textRegion, 'left')
    })
    await runCase('11 las regiones de texto modernas se mantienen confinadas al frame', () => {
      for (const structure of bundle.MODERN_LAYOUT_STRUCTURES_V3) {
        const mode = structure === 'editorial' ? 'editorial-text' : 'asset-led'
        const { textBounds } = bundle.createVisualLayoutV3(structure, mode, 31415)
        assert(textBounds.x >= 0 && textBounds.y >= 0)
        assert(textBounds.x + textBounds.width <= 100)
        assert(textBounds.y + textBounds.height <= 100)
      }
    })
    await runCase('12 existen seis TypographyLooks y seis familias keyword efectivas', () => {
      assert.equal(bundle.TYPOGRAPHY_LOOK_IDS_V3.length, 6)
      assert.equal(new Set(Object.values(bundle.TYPOGRAPHY_LOOKS_V3).map(look => look.keywordFamily)).size, 6)
    })
    const auditedFonts = auditTypographyLookFonts(REPO_ROOT, bundle.TYPOGRAPHY_LOOKS_V3)
    await runCase('13 todos los pesos pedidos existen físicamente sin síntesis', () => {
      assert(auditedFonts.length >= 8)
      assert.deepEqual(auditedFonts.filter(row => !row.certificable || row.synthesisRequired), [])
      console.log('FONT_AUDIT=' + JSON.stringify(auditedFonts))
    })
    await runCase('14 Chromium carga todas las caras registradas sin fallback geométrico', async () => {
      fontWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: false, contextIsolation: false } })
      await fontWindow.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))
      const ready = await fontWindow.webContents.executeJavaScript('window.__listo()')
      assert.deepEqual(ready.avisosFuentes, [])
    })
    const projectRoot = path.join(FIXTURE_ROOT, 'project')
    bundle.createProjectFiles(projectRoot, { id: 'layout-v3', clips: [], timelineVideoClips: [], aiScript: 'fixture' })
    const published = bundle.publishOpenMojiAsset({ projectRoot, stableId: 'openmoji:1f382' })
    const v14Editorial = sceneSpec(bundle, null, { visualMode: 'editorial-text', estructura: 'editorial',
      keyword: 'EVIDENCIA', connector: null, semilla: 73041, typographyLookId: 'elegant-serif' })
    await runCase('15 renderer V14 aplica font-synthesis none y el look materializado', async () => {
      await fontWindow.webContents.executeJavaScript(`window.__montar(${JSON.stringify(graphicFor(v14Editorial))},${JSON.stringify({
        ancho: 540, alto: 960, modo: 'pantalla', duracion: 1, sistema: 'editorial',
      })});window.__setT(.5)`)
      const computed = await fontWindow.webContents.executeJavaScript(`(() => {
        const keyword=document.querySelector('[data-qc-keyword="true"]');
        return { family:getComputedStyle(keyword).fontFamily, synthesis:getComputedStyle(keyword).fontSynthesis,
          familyMark:document.querySelector('[data-qc-layout-family]')?.getAttribute('data-qc-layout-family') };
      })()`)
      assert(computed.family.includes('Playfair Display'))
      assert.equal(computed.synthesis, 'none')
      assert.equal(computed.familyMark, 'editorial')
    })
    const poster = sceneSpec(bundle, published.asset, { estructura: 'marcoPoster', keyword: 'LUZ', connector: null,
      semilla: 81001, typographyLookId: 'poster-condensed' })
    const focus = sceneSpec(bundle, published.asset, { estructura: 'anillosConcentricos', keyword: 'LUZ', connector: null,
      semilla: 81002, typographyLookId: 'elegant-serif' })
    await runCase('16 LayoutFamily y geometría forman parte de PixelIdentity', () => {
      assert.notEqual(bundle.sceneSpecPixelIdentity(poster), bundle.sceneSpecPixelIdentity(focus))
    })
    await runCase('17 placement izquierda y derecha producen identidades distintas', () => {
      const split = findSplitLayouts(bundle)
      const left = sceneSpec(bundle, published.asset, { estructura: 'partidoVertical', keyword: 'LUZ', connector: null,
        semilla: split.get('left-dominant').seed, typographyLookId: 'technical-condensed' })
      const right = sceneSpec(bundle, published.asset, { estructura: 'partidoVertical', keyword: 'LUZ', connector: null,
        semilla: split.get('right-dominant').seed, typographyLookId: 'technical-condensed' })
      assert.notEqual(bundle.sceneSpecPixelIdentity(left), bundle.sceneSpecPixelIdentity(right))
    })
    await runCase('18 TypographyLook distinto produce identidad distinta', () => {
      const alternative = bundle.validateVisualSceneSpec({ ...poster,
        text: { ...poster.text, typographyLookId: 'sport-condensed' } })
      assert.notEqual(bundle.sceneSpecPixelIdentity(poster), bundle.sceneSpecPixelIdentity(alternative))
    })
    await runCase('19 rutas y diagnóstico siguen fuera de PixelIdentity y hash', () => {
      const left = { type: 'visual_escena', extra: { sceneSpec: poster,
        renderBindings: { assets: [{ slotId: 'hero', assetId: 'a', relativeFile: 'one.svg' }] }, trace: { providerUrl: 'one' } } }
      const right = { type: 'visual_escena', extra: { sceneSpec: poster,
        renderBindings: { assets: [{ slotId: 'hero', assetId: 'b', relativeFile: 'two.svg' }] }, trace: { providerUrl: 'two' } } }
      assert.equal(bundle.hashGrafico(left, 540, 960, 1, 8, 'pantalla', 'editorial'),
        bundle.hashGrafico(right, 540, 960, 1, 8, 'pantalla', 'editorial'))
    })
    await runCase('20 hash V13 no puede satisfacer caché V14 y React conserva la misma autoridad', () => {
      const v13 = sceneSpec(bundle, published.asset, { version13: true, estructura: 'marcoPoster', keyword: 'LUZ', connector: null })
      const graphic13 = graphicFor(v13)
      const hash13 = bundle.hashGraficoConVersionPlantillas(graphic13, 540, 960, 1, 8, 'pantalla', 'editorial', 13)
      const hash14 = bundle.hashGraficoConVersionPlantillas(graphicFor(poster), 540, 960, 1, 8, 'pantalla', 'editorial', 14)
      assert.notEqual(hash13, hash14)
      assert.equal(bundle.sceneSpecReactKey(poster), 'scene-v1|' + bundle.sceneSpecPixelIdentity(poster))
    })
    await runCase('21 las siete familias pasan QC estático con geometría certificada', () => {
      for (const structure of bundle.MODERN_LAYOUT_STRUCTURES_V3) {
        const spec = structure === 'editorial'
          ? sceneSpec(bundle, null, { visualMode: 'editorial-text', estructura: structure, keyword: 'LUZ', connector: null, semilla: 91001 })
          : sceneSpec(bundle, published.asset, { estructura: structure, keyword: 'LUZ', connector: null, semilla: 91001 })
        assert.deepEqual(bundle.evaluateVisualMvpQc(spec).filter(issue => issue.level === 'error'), [], structure)
      }
    })
    await runCase('22 generación y regeneración moderna conservan SceneSpec V14 canónica', () => {
      const context = modernContext(bundle)
      const normal = bundle.resolveModernVisualGenerationBatchV1({ contexts: [context], projectRoot })[0]
      const regenerated = bundle.resolveModernVisualGenerationBatchV1({
        contexts: [JSON.parse(JSON.stringify(context))], projectRoot,
      })[0]
      assert(normal.resolved.compiled.sceneSpec.layout)
      assert.equal(bundle.sceneSpecPixelIdentity(normal.resolved.compiled.sceneSpec),
        bundle.sceneSpecPixelIdentity(regenerated.resolved.compiled.sceneSpec))
    })
    await runCase('23 vía legacy sin sceneSpec conserva su autoridad separada', () => {
      const legacy = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [] } }
      assert.equal(bundle.sceneSpecFromGraphicData(legacy), null)
      assert.equal(bundle.prepareGraphicForVisualRender({ graphicData: legacy }).kind, 'legacy')
    })
    await runCase('24 cero red y proyectos reales intactos', () => {
      assert.equal(networkAttempts, startupNetworkBaseline)
      assert.equal(snapshotRealProjects(), projectsBefore)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json')), false)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')), false)
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
