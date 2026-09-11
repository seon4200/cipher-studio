const { app, BrowserWindow, nativeImage, session } = require('electron')
const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { sceneSpecV15, graphicForV15, bindingsForV15 } = require('./helpers/motion-graphics-v15-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('background-black-foundation-v1')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const HISTORICAL_BASELINE = path.join(REPO_ROOT, 'tests', 'aceptacion', 'background-black-foundation-v1', 'historical-v15-baseline.png')
const EXPECTED_CASES = 11
let completed = 0
let finished = false
let renderWindow = null
let networkAttempts = 0
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
  completed++
  console.log('OK ' + name)
}

function compareImages (leftFile, rightFile) {
  const leftImage = nativeImage.createFromPath(leftFile)
  const rightImage = nativeImage.createFromPath(rightFile)
  assert.deepEqual(leftImage.getSize(), rightImage.getSize())
  const left = leftImage.toBitmap()
  const right = rightImage.toBitmap()
  let differentPixels = 0
  for (let offset = 0; offset < left.length; offset += 4) {
    if (left[offset] !== right[offset] || left[offset + 1] !== right[offset + 1] || left[offset + 2] !== right[offset + 2])
      differentPixels++
  }
  return differentPixels
}

function frameFromVideo (video, output) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.55', '-i', video,
    '-frames:v', '1', '-vf', 'scale=540:960', output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function modernContext (bundle) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: 'black-foundation-new-scene', start: 10, end: 12.5,
    transcriptSegments: [{ start: 9.8, end: 12.8, text: 'el fútbol conecta estadio y celebración', words: [
      { word: 'fútbol', start: 10.1, end: 10.65 }, { word: 'estadio', start: 10.8, end: 11.35 },
      { word: 'celebración', start: 11.5, end: 12.15 },
    ] }],
    concepts: [
      { label: 'fútbol', emoji: '⚽', start: 10.1, end: 10.65 },
      { label: 'estadio', emoji: '🏟️', start: 10.8, end: 11.35 },
      { label: 'celebración', emoji: '🎉', start: 11.5, end: 12.15 },
    ],
    anchor: 'fútbol', relation: 'conecta', globalText: 'el fútbol conecta estadio y celebración',
    globalHints: ['fútbol', 'estadio', 'celebración'], globalContextRef: 'fixture:black-foundation',
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: 'black-foundation-new-scene', duration: 1, localSemantic,
    keywordCandidates: [{ keyword: 'fútbol', source: 'scene-semantic' }], preferredVisualMode: 'auto',
    sistema: 'editorial', direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: 91531 }, videoStyleId: 'cream-editorial', lockedChoices: [],
  })
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
    console.error(`FALLO: CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${EXPECTED_CASES}`)
    process.exitCode = 1
  }
})

app.whenReady().then(async () => {
  const projectsBefore = snapshotRealProjects()
  const block = () => { networkAttempts++; throw new Error('BLACK_FOUNDATION_NETWORK_FORBIDDEN') }
  global.fetch = block
  http.request = block
  https.request = block
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  await new Promise(resolve => setTimeout(resolve, 700))
  const startupNetworkBaseline = networkAttempts
  bundle.createProjectFiles(PROJECT_ROOT, { id: 'black-foundation-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })
  const soccer = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:26bd' }).asset
  const stadium = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f3df' }).asset
  const party = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f389' }).asset
  const three = [{ slotId: 'hero', asset: soccer }, { slotId: 'support-1', asset: stadium }, { slotId: 'support-2', asset: party }]
  const historicalSpec = sceneSpecV15(bundle, three.slice(0, 2), {
    family: 'partidoVertical', keyword: 'FÚTBOL', connector: 'el', closing: 'une al estadio',
    sceneId: 'historical-v15-black-foundation-control', seed: 91515, typographyLookId: 'sport-condensed',
  })
  const blackSpec = sceneSpecV15(bundle, three, {
    family: 'redNodos', keyword: 'CONEXIÓN', connector: 'tres recursos', closing: null,
    sceneId: 'black-v15-three-assets', seed: 91532, backgroundProfileId: 'solid-black-v1',
  })

  try {
    await runCase('1 VERSION_PLANTILLAS permanece exactamente en 15', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
    })
    await runCase('2 registro contiene un único perfil negro editorial extensible', () => {
      assert.deepEqual(bundle.BACKGROUND_PROFILE_IDS_V1, ['solid-black-v1'])
      const profile = bundle.materializeBackgroundProfileV1('solid-black-v1')
      assert.equal(profile.revision, 'background-profile-v1')
      assert.equal(bundle.BACKGROUND_PROFILES_V1[profile.id].baseColor, '#0D0D0F')
    })
    await runCase('3 SceneSpec histórica valida sin perfil y conserva paleta exacta', () => {
      assert.equal(Object.prototype.hasOwnProperty.call(historicalSpec, 'backgroundProfile'), false)
      const palette = bundle.videoVisualStylePaletteV1(historicalSpec.videoStyle)
      assert.strictEqual(bundle.applyBackgroundProfileV1(palette, historicalSpec.backgroundProfile), palette)
    })
    let generated = null
    await runCase('4 generación moderna nueva materializa solid-black-v1 explícito', async () => {
      generated = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [modernContext(bundle)], projectRoot: PROJECT_ROOT }))[0]
      assert.equal(generated.resolved.compiled.sceneSpec.backgroundProfile.id, 'solid-black-v1')
      assert.equal(generated.resolved.compiled.sceneSpec.videoStyle.id, 'cream-editorial')
      assert.equal(generated.resolved.compiled.sceneSpec.slots.some(slot => slot.role === 'hero' && slot.state === 'present'), true)
    })
    await runCase('5 BackgroundProfile participa en PixelIdentity y React key', () => {
      const historicalIdentity = bundle.sceneSpecPixelIdentityAny(historicalSpec)
      const changed = JSON.parse(JSON.stringify(historicalSpec))
      changed.backgroundProfile = bundle.materializeBackgroundProfileV1('solid-black-v1')
      const blackIdentity = bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(changed))
      assert.notEqual(blackIdentity, historicalIdentity)
      assert.equal(bundle.sceneSpecReactKeyAny(blackSpec), 'scene-v2|' + bundle.sceneSpecPixelIdentityAny(blackSpec))
    })
    await runCase('6 mismo SceneSpec mantiene identidad determinista', () => {
      const copy = bundle.validateVisualSceneSpecV2(JSON.parse(JSON.stringify(blackSpec)))
      assert.equal(bundle.sceneSpecPixelIdentityAny(copy), bundle.sceneSpecPixelIdentityAny(blackSpec))
      assert.equal(bundle.sceneSpecReactKeyAny(copy), bundle.sceneSpecReactKeyAny(blackSpec))
    })
    await runCase('7 SceneSpec V15 histórica conserva pixelDiff cero', async () => {
      const clip = await bundle.renderGraphicClip(graphicForV15(historicalSpec), {
        ancho: 540, alto: 960, fps: 8, duracion: 1, modo: 'pantalla', sistema: 'editorial',
        projectRoot: PROJECT_ROOT, renderBindings: bindingsForV15(three.slice(0, 2)),
      })
      assert(clip && fs.existsSync(clip))
      const current = path.join(FIXTURE_ROOT, 'historical-current.png')
      frameFromVideo(clip, current)
      assert.equal(compareImages(HISTORICAL_BASELINE, current), 0)
    })
    await runCase('8 las 17 familias montan sobre negro con slots reales', async () => {
      renderWindow = new BrowserWindow({ show: false, width: 540, height: 968,
        webPreferences: { sandbox: false, contextIsolation: false } })
      await renderWindow.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))
      for (let index = 0; index < bundle.MODERN_LAYOUT_STRUCTURES_V4.length; index++) {
        const family = bundle.MODERN_LAYOUT_STRUCTURES_V4[index]
        const supportCount = bundle.LAYOUT_ELIGIBILITY_V4[family].minSupports
        const descriptors = family === 'editorial' ? [] : three.slice(0, supportCount + 1)
        const spec = sceneSpecV15(bundle, descriptors, {
          visualMode: family === 'editorial' ? 'editorial-text' : 'asset-led', family,
          keyword: family.toUpperCase(), connector: null, closing: null,
          sceneId: 'black-family-' + family, seed: 91600 + index, backgroundProfileId: 'solid-black-v1',
        })
        const prepared = bundle.prepareGraphicForVisualRender({ graphicData: graphicForV15(spec), projectRoot: PROJECT_ROOT,
          renderBindings: bindingsForV15(descriptors) })
        const snapshot = await renderWindow.webContents.executeJavaScript(`(async()=>{
          await window.__montar(${JSON.stringify(prepared.graphicData)},${JSON.stringify({ ancho: 540, alto: 960,
            modo: 'pantalla', duracion: 1, sistema: 'editorial' })},${JSON.stringify(prepared.preparedAssets)});
          window.__setT(.55); return window.__visualQc();
        })()`)
        assert.equal(snapshot.backgroundProfile, 'solid-black-v1', family)
        assert.equal(snapshot.backgroundColor, 'rgb(13, 13, 15)', family)
        assert.equal(snapshot.assets.length, descriptors.length, family)
        const structure = await renderWindow.webContents.executeJavaScript("document.querySelector('[data-qc-structure-mark]')?.dataset.qcStructureMark")
        assert.equal(structure, family)
      }
    })
    await runCase('9 OpenMoji original-color y Hero/Supports permanecen intactos', async () => {
      const prepared = bundle.prepareGraphicForVisualRender({ graphicData: graphicForV15(blackSpec), projectRoot: PROJECT_ROOT,
        renderBindings: bindingsForV15(three) })
      await renderWindow.webContents.executeJavaScript(`window.__montar(${JSON.stringify(prepared.graphicData)},` +
        `${JSON.stringify({ ancho: 540, alto: 960, modo: 'pantalla', duracion: 1, sistema: 'editorial' })},` +
        `${JSON.stringify(prepared.preparedAssets)})`)
      const rows = await renderWindow.webContents.executeJavaScript("Array.from(document.querySelectorAll('[data-qc-asset]')).map(x=>[x.dataset.qcRole,x.dataset.qcTreatment])")
      assert.deepEqual(rows, [['hero', 'original-color'], ['support-1', 'original-color'], ['support-2', 'original-color']])
    })
    await runCase('10 renderer produce MP4 negro real sin red', async () => {
      const clip = await bundle.renderGraphicClip(graphicForV15(blackSpec), {
        ancho: 540, alto: 960, fps: 8, duracion: 1, modo: 'pantalla', sistema: 'editorial',
        projectRoot: PROJECT_ROOT, renderBindings: bindingsForV15(three),
      })
      assert(clip && fs.existsSync(clip) && fs.statSync(clip).size > 0)
      assert.equal(networkAttempts, startupNetworkBaseline)
    })
    await runCase('11 proyectos reales permanecen intactos', () => {
      assert.equal(snapshotRealProjects(), projectsBefore)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json')), false)
    })
    assert.equal(completed, EXPECTED_CASES)
    console.log(`HISTORICAL_PIXEL_DIFF=0`)
    console.log(`FAMILIES_RENDERED=${bundle.MODERN_LAYOUT_STRUCTURES_V4.length}/17`)
    console.log(`BACKGROUND_PROFILE=solid-black-v1`)
    console.log(`CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${EXPECTED_CASES}`)
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
