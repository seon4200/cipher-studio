const { app, BrowserWindow, nativeImage, session } = require('electron')
const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { sceneSpecV15, graphicForV15, bindingsForV15 } = require('./helpers/motion-graphics-v15-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('v15-color-system-v1')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const D_FINAL_BASELINE = path.join(REPO_ROOT, 'tests', 'aceptacion', 'v15-color-system-v1', 'd-final-historical-baseline.png')
const EXPECTED_CASES = 16
let completed = 0
let finished = false
let renderWindow = null
let networkAttempts = 0
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
  return JSON.stringify(rows.sort((left, right) => left[0].localeCompare(right[0])))
}

async function runCase (name, fn) {
  await fn()
  completed++
  console.log('OK ' + name)
}

function maxStreak (values) {
  let current = 0
  let maximum = 0
  let previous = null
  for (const value of values) {
    current = value === previous ? current + 1 : 1
    previous = value
    maximum = Math.max(maximum, current)
  }
  return maximum
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

function pngRgba (alpha) {
  const chunk = (type, data) => Buffer.concat([Buffer.from([0, 0, 0, data.length]), Buffer.from(type), data, Buffer.alloc(4)])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.from([0, 0x35, 0x72, 0x9b, alpha])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function paletteFor (bundle, terms, sceneId, sceneIndex, recent = []) {
  const selection = bundle.selectVideoColorPalettePlanV1({ terms, seed: 15001 })
  return bundle.materializeSceneColorPaletteV1({ plan: selection.plan, sceneId, sceneIndex, terms,
    recentAccentPrimaries: recent })
}

function modernContext (bundle, index) {
  const sceneId = `color-tech-${index}`
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId, start: index * 2, end: index * 2 + 1.8,
    transcriptSegments: [{ start: index * 2, end: index * 2 + 1.8,
      text: 'la inteligencia artificial conecta datos y robots', words: [
        { word: 'inteligencia artificial', start: index * 2 + .1, end: index * 2 + .5 },
        { word: 'datos', start: index * 2 + .7, end: index * 2 + 1.0 },
        { word: 'robots', start: index * 2 + 1.2, end: index * 2 + 1.6 },
      ] }],
    concepts: [
      { label: 'inteligencia artificial', emoji: '🧠', start: index * 2 + .1, end: index * 2 + .5 },
      { label: 'datos', emoji: '💾', start: index * 2 + .7, end: index * 2 + 1.0 },
      { label: 'robot', emoji: '🤖', start: index * 2 + 1.2, end: index * 2 + 1.6 },
    ],
    anchor: 'inteligencia artificial', relation: 'conecta',
    globalText: 'la inteligencia artificial conecta datos y robots',
    globalHints: ['software', 'tecnología'], globalContextRef: 'fixture:color-system',
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId, duration: 1, localSemantic,
    keywordCandidates: [{ keyword: index % 2 ? 'DATOS' : 'INTELIGENCIA', source: 'scene-semantic' }],
    preferredVisualMode: 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media',
      ritmo: 'simultaneo', semilla: 15100 + index },
    videoStyleId: 'cream-editorial', lockedChoices: [],
  })
}

async function mount (bundle, spec, descriptors) {
  const prepared = bundle.prepareGraphicForVisualRender({ graphicData: graphicForV15(spec), projectRoot: PROJECT_ROOT,
    renderBindings: bindingsForV15(descriptors) })
  await renderWindow.webContents.executeJavaScript(`(async()=>{
    await window.__montar(${JSON.stringify(prepared.graphicData)},${JSON.stringify({ ancho: 540, alto: 960,
      modo: 'pantalla', duracion: 1, sistema: 'editorial' })},${JSON.stringify(prepared.preparedAssets)});
    window.__setT(.55); return true;
  })()`)
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
  const block = () => { networkAttempts++; throw new Error('COLOR_SYSTEM_NETWORK_FORBIDDEN') }
  global.fetch = block; http.request = block; https.request = block
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  await new Promise(resolve => setTimeout(resolve, 700))
  const startupNetworkBaseline = networkAttempts
  bundle.createProjectFiles(PROJECT_ROOT, { id: 'color-system-v1', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })
  const soccer = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:26bd' }).asset
  const stadium = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f3df' }).asset
  const party = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f389' }).asset
  const assets = [soccer, stadium, party]
  const three = assets.map((asset, index) => ({ slotId: index === 0 ? 'hero' : `support-${index}`, asset }))
  renderWindow = new BrowserWindow({ show: false, width: 540, height: 968,
    webPreferences: { sandbox: false, contextIsolation: false } })
  await renderWindow.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))

  try {
    await runCase('1 VERSION_PLANTILLAS permanece exactamente en 15', () => {
      assert.equal(bundle.VERSION_PLANTILLAS, 15)
    })
    await runCase('2 existen nueve familias con seis tokens vivos válidos', () => {
      assert.equal(bundle.COLOR_PALETTE_FAMILY_IDS_V1.length, 9)
      for (const family of bundle.COLOR_PALETTE_FAMILY_IDS_V1) {
        const tokens = bundle.COLOR_PALETTE_FAMILIES_V1[family].tokens
        assert.equal(Object.keys(tokens).length, 6)
        for (const role of ['accentPrimary', 'accentSecondary', 'accentBright', 'accentSoft'])
          assert(bundle.backgroundContrastRatioV1(tokens[role], '#0D0D0F') >= 3, `${family}:${role}`)
      }
    })
    await runCase('3 tema selecciona una gama compatible y no random', () => {
      const cases = [
        [['software', 'inteligencia artificial', 'datos'], 'technology', 'blue-tech'],
        [['bosque', 'agua', 'crecimiento'], 'nature', 'green-nature'],
        [['astronauta', 'planeta', 'galaxia'], 'space', 'purple-cosmic'],
        [['conflicto', 'peligro', 'emergencia'], 'alert-conflict', 'red-alert'],
        [['cultura', 'música', 'creatividad'], 'creative', 'magenta-creative'],
        [['escuela', 'libro', 'aprendizaje'], 'education', 'yellow-energy'],
      ]
      for (const [terms, theme, family] of cases) {
        const one = bundle.selectVideoColorPalettePlanV1({ terms, seed: 12 })
        const two = bundle.selectVideoColorPalettePlanV1({ terms, seed: 12 })
        assert.deepEqual(one, two)
        assert.equal(one.theme, theme)
        assert.equal(one.plan.primaryFamily, family)
        assert.equal(one.plan.compatibleFamilies.length, 2)
      }
    })
    await runCase('4 variación por Visual es estable y limita streak a dos', () => {
      const plan = bundle.selectVideoColorPalettePlanV1({ terms: ['AI', 'software', 'data'], seed: 13 }).plan
      const run = () => {
        const recent = []
        const rows = Array.from({ length: 18 }, (_, index) => {
          const value = bundle.materializeSceneColorPaletteV1({ plan, sceneId: `tech-${index}`, sceneIndex: index,
            terms: ['artificial intelligence', 'software', 'data'], recentAccentPrimaries: recent })
          recent.push(value.tokens.accentPrimary)
          return value
        })
        return rows
      }
      const one = run(); const two = run()
      assert.deepEqual(one, two)
      assert(maxStreak(one.map(value => value.tokens.accentPrimary)) <= 2)
      assert(new Set(one.map(value => value.tokens.accentPrimary)).size >= 3)
      assert(one.every(value => [plan.primaryFamily, ...plan.compatibleFamilies].includes(value.family)))
    })
    const color = paletteFor(bundle, ['technology', 'software', 'data'], 'identity-color', 0)
    const coloredSpec = sceneSpecV15(bundle, three, { family: 'redNodos', sceneId: 'identity-color', seed: 15190,
      backgroundProfileId: 'solid-black-v1', colorPalette: color })
    await runCase('5 ColorPalette materializada participa en PixelIdentity', () => {
      const historical = clone(coloredSpec); delete historical.colorPalette
      const altered = clone(coloredSpec); altered.colorPalette.tokens.accentPrimary = '#39E75F'
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(coloredSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(historical)))
      assert.notEqual(bundle.sceneSpecPixelIdentityAny(coloredSpec), bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(altered)))
      assert.equal(bundle.sceneSpecReactKeyAny(coloredSpec), 'scene-v2|' + bundle.sceneSpecPixelIdentityAny(coloredSpec))
    })
    await runCase('6 SceneSpec histórico omite color y conserva su paleta por referencia', () => {
      const historical = clone(coloredSpec); delete historical.colorPalette
      const valid = bundle.validateVisualSceneSpecV2(historical)
      const base = bundle.applyBackgroundProfileV1(bundle.videoVisualStylePaletteV1(valid.videoStyle), valid.backgroundProfile)
      assert.strictEqual(bundle.applySceneColorPaletteV1(base, valid.colorPalette), base)
    })
    let generated = null
    const contexts = Array.from({ length: 8 }, (_, index) => modernContext(bundle, index))
    await runCase('7 generación nueva materializa gama de vídeo y color por escena', async () => {
      generated = await bundle.resolveModernVisualGenerationBatchV2({ contexts, projectRoot: PROJECT_ROOT })
      assert.equal(generated.length, 8)
      assert(generated.every(row => row.resolved.compiled.sceneSpec.backgroundProfile.id === 'solid-black-v1'))
      assert(generated.every(row => row.resolved.compiled.sceneSpec.colorPalette.videoPrimaryFamily === 'blue-tech'))
      assert(generated.every(row => row.context.lockedColorPalette && row.context.colorPalettePlan))
    })
    await runCase('8 generación y regeneración conservan SceneSpec e identidad', async () => {
      const regenerated = await bundle.resolveModernVisualGenerationBatchV2({
        contexts: generated.map(row => row.context), projectRoot: PROJECT_ROOT,
      })
      for (let index = 0; index < generated.length; index++) {
        assert.deepEqual(regenerated[index].resolved.compiled.sceneSpec, generated[index].resolved.compiled.sceneSpec)
        assert.equal(bundle.sceneSpecPixelIdentityAny(regenerated[index].resolved.compiled.sceneSpec),
          bundle.sceneSpecPixelIdentityAny(generated[index].resolved.compiled.sceneSpec))
      }
    })
    await runCase('9 batch real mantiene variación compatible y anti-repeat', () => {
      const palettes = generated.map(row => row.resolved.compiled.sceneSpec.colorPalette)
      assert(maxStreak(palettes.map(value => value.tokens.accentPrimary)) <= 2)
      assert(new Set(palettes.map(value => value.tokens.accentPrimary)).size >= 3)
      assert(palettes.every(value => ['blue-tech', 'cyan-digital', 'purple-cosmic'].includes(value.family)))
    })
    await runCase('10 OpenMoji y raster permanecen original-color; Solar usa system-tint', () => {
      const candidate = { provider: 'pixabay-images', id: 'color-raster', pageUrl: 'https://pixabay.com/fixture/',
        downloadUrl: 'https://cdn.pixabay.com/fixture.png', tags: ['fixture'], width: 1200, height: 900,
        imageType: 'illustration', score: 3, reason: 'FIXTURE', query: 'fixture', transparentRequested: true,
        requiresDownloadValidation: true }
      const raster = bundle.publishPixabayImageAssetV1({ projectRoot: PROJECT_ROOT, candidate, bytes: pngRgba(72) }).asset
      const rasterSpec = sceneSpecV15(bundle, [{ slotId: 'hero', asset: raster, mime: 'image/png',
        kind: 'photo-cutout', alphaMode: 'useful-alpha' }], { family: 'marcoPoster', sceneId: 'raster-color', seed: 15201,
        backgroundProfileId: 'solid-black-v1', colorPalette: color })
      assert.equal(rasterSpec.slots[0].tint.treatment, 'original-color')
      assert(coloredSpec.slots.filter(slot => slot.state === 'present').every(slot => slot.tint.treatment === 'original-color'))
      const solarSpec = sceneSpecV15(bundle, [{ slotId: 'hero', asset: soccer },
        { slotId: 'support-1', solarIcon: 'wallet-bold-duotone', solarStyle: 'bold-duotone' }], {
        family: 'partidoVertical', sceneId: 'solar-color', seed: 15202,
        backgroundProfileId: 'solid-black-v1', colorPalette: color,
      })
      assert.equal(solarSpec.slots[1].tint.treatment, 'system-tint')
    })
    await runCase('11 Solar renderizado consume el token de system-tint correcto', async () => {
      const descriptors = [{ slotId: 'hero', asset: soccer },
        { slotId: 'support-1', solarIcon: 'wallet-bold-duotone', solarStyle: 'bold-duotone' }]
      const spec = sceneSpecV15(bundle, descriptors, { family: 'partidoVertical', sceneId: 'solar-dom', seed: 15203,
        backgroundProfileId: 'solid-black-v1', colorPalette: color })
      await mount(bundle, spec, descriptors)
      const tint = await renderWindow.webContents.executeJavaScript("document.querySelector('[data-qc-solar-tint]')?.dataset.qcSolarTint")
      assert.equal(tint, color.tokens.accentPrimary)
    })
    await runCase('12 las 17 familias consumen las nueve paletas sin cambiar layout', async () => {
      const themeGroups = [
        ['technology', 'software', 'data'], ['nature', 'forest', 'water'], ['danger', 'conflict', 'warning'],
        ['creative', 'music', 'culture'], ['industry', 'construction', 'engineering'], ['education', 'book', 'learning'],
      ]
      const used = new Set()
      for (let index = 0; index < bundle.MODERN_LAYOUT_STRUCTURES_V4.length; index++) {
        const family = bundle.MODERN_LAYOUT_STRUCTURES_V4[index]
        const rule = bundle.LAYOUT_ELIGIBILITY_V4[family]
        const descriptors = family === 'editorial' ? [] : three.slice(0, rule.minSupports + 1)
        const terms = themeGroups[Math.floor(index / 3) % themeGroups.length]
        const plan = bundle.selectVideoColorPalettePlanV1({ terms, seed: 15300 + index }).plan
        const palette = bundle.materializeSceneColorPaletteV1({ plan, sceneId: `family-${family}`, sceneIndex: index % 3, terms })
        const spec = sceneSpecV15(bundle, descriptors, { visualMode: family === 'editorial' ? 'editorial-text' : 'asset-led',
          family, keyword: family.toUpperCase(), connector: null, closing: null, sceneId: `family-${family}`,
          seed: 15300 + index, backgroundProfileId: 'solid-black-v1', colorPalette: palette })
        assert.equal(bundle.evaluateVisualStructuralQcV2(spec).filter(value => value.level === 'error').length, 0)
        await mount(bundle, spec, descriptors)
        const snapshot = await renderWindow.webContents.executeJavaScript(`({
          family: document.querySelector('[data-qc-layout-family]')?.dataset.qcLayoutFamily,
          palette: document.querySelector('[data-qc-color-palette]')?.dataset.qcColorPalette,
          background: getComputedStyle(document.querySelector('[data-qc-background-profile]')).backgroundColor
        })`)
        assert.equal(snapshot.family, family)
        assert.equal(snapshot.palette, palette.family)
        assert.equal(snapshot.background, 'rgb(13, 13, 15)')
        used.add(palette.family)
      }
      assert.equal(used.size, 9)
    })
    await runCase('13 OpenMoji original-color se conserva en DOM', async () => {
      await mount(bundle, coloredSpec, three)
      const treatments = await renderWindow.webContents.executeJavaScript("Array.from(document.querySelectorAll('[data-qc-asset]')).map(x=>x.dataset.qcTreatment)")
      assert.deepEqual(treatments, ['original-color', 'original-color', 'original-color'])
    })
    await runCase('14 mismo SceneSpec produce el mismo frame', async () => {
      const options = { ancho: 540, alto: 960, fps: 8, duracion: 1, modo: 'pantalla', sistema: 'editorial',
        projectRoot: PROJECT_ROOT, renderBindings: bindingsForV15(three) }
      const firstClip = await bundle.renderGraphicClip(graphicForV15(coloredSpec), options)
      const secondClip = await bundle.renderGraphicClip(graphicForV15(clone(coloredSpec)), options)
      assert.equal(firstClip, secondClip)
      const first = path.join(FIXTURE_ROOT, 'same-spec-first.png')
      const second = path.join(FIXTURE_ROOT, 'same-spec-second.png')
      frameFromVideo(firstClip, first); frameFromVideo(secondClip, second)
      assert.equal(compareImages(first, second), 0)
    })
    await runCase('15 D-Final histórico mantiene pixelDiff cero', async () => {
      const historicalDescriptors = three.slice(0, 2)
      const historicalSpec = sceneSpecV15(bundle, historicalDescriptors, { family: 'partidoVertical', keyword: 'FÚTBOL',
        connector: 'el', closing: 'une al estadio', sceneId: 'historical-v15-black-foundation-control', seed: 91515,
        typographyLookId: 'sport-condensed' })
      const clip = await bundle.renderGraphicClip(graphicForV15(historicalSpec), {
        ancho: 540, alto: 960, fps: 8, duracion: 1, modo: 'pantalla', sistema: 'editorial',
        projectRoot: PROJECT_ROOT, renderBindings: bindingsForV15(historicalDescriptors),
      })
      const current = path.join(FIXTURE_ROOT, 'historical-current.png')
      frameFromVideo(clip, current)
      assert.equal(compareImages(D_FINAL_BASELINE, current), 0)
    })
    await runCase('16 cero red y proyectos reales intactos', () => {
      assert.equal(networkAttempts, startupNetworkBaseline)
      assert.equal(snapshotRealProjects(), projectsBefore)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json')), false)
    })
    assert.equal(completed, EXPECTED_CASES)
    console.log('COLOR_PALETTE_FAMILIES=9')
    console.log('FAMILIES_TESTED=17/17')
    console.log('MAX_IDENTICAL_ACCENT_STREAK=' + maxStreak(generated.map(row => row.resolved.compiled.sceneSpec.colorPalette.tokens.accentPrimary)))
    console.log('HISTORICAL_PIXEL_DIFF=0')
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
