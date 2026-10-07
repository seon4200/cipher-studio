// Productive acceptance: ProjectAsset -> RenderSpec/Bindings -> grafico.html -> MP4 -> export.
// Raw SVG files exist only in the marked temporary project and are removed with that fixture.
const { app, BrowserWindow, dialog, ipcMain, nativeImage, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const { sceneSpec, graphicFor, bindingsFor } = require('../../helpers/visual-mvp-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const PRODUCTION = path.join(OUTPUT, 'production')
const FIXTURE_ROOT = createTestFixture('visual-mvp-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_DIR = path.join(FIXTURE_ROOT, 'frames')
const WIDTH = 540
const HEIGHT = 960
const FPS = 15
const DURATION = 1.6
let rendererWindow
let sheetWindow
let removeObserver
let networkAttempts = 0

const blockNetwork = () => {
  networkAttempts += 1
  throw new Error('RED BLOQUEADA EN ACEPTACIÓN VISUAL MVP')
}
global.fetch = blockNetwork
http.request = blockNetwork
https.request = blockNetwork
app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)

function sha256 (file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

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

function waitForMainWindow () {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const poll = () => {
      if (BrowserWindow.getAllWindows().some(window => !window.isDestroyed() && !window.webContents.isOffscreen())) return resolve()
      if (++attempts > 60) return reject(new Error('Ventana principal no disponible'))
      setTimeout(poll, 100)
    }
    poll()
  })
}

function invoke (channel, payload) {
  const handler = ipcMain._invokeHandlers.get(channel)
  if (!handler) throw new Error('Handler ausente: ' + channel)
  return handler({ sender: { isDestroyed: () => false, send: () => {} } }, payload)
}

function ffprobe (file) {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=codec_name,width,height,pix_fmt,nb_read_frames,duration',
    '-show_entries', 'format=duration,size', '-of', 'json', file,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
}

async function rendererReady () {
  rendererWindow = new BrowserWindow({
    show: false, width: WIDTH, height: HEIGHT + 8, useContentSize: true,
    enableLargerThanScreen: true, frame: false, transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false },
  })
  await rendererWindow.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))
  rendererWindow.setContentSize(WIDTH, HEIGHT + 8)
  const ready = await rendererWindow.webContents.executeJavaScript('window.__listo()')
  if (ready.avisosFuentes.length) throw new Error('Fuentes no listas: ' + JSON.stringify(ready.avisosFuentes))
}

async function captureCase (bundle, item, index) {
  const prepared = bundle.prepareGraphicForVisualRender({
    graphicData: item.graphic,
    projectRoot: PROJECT_ROOT,
    renderBindings: item.bindings,
  })
  await rendererWindow.webContents.executeJavaScript(
    `window.__montar(${JSON.stringify(prepared.graphicData)},` +
    `${JSON.stringify({ ancho: WIDTH, alto: HEIGHT, modo: 'pantalla', duracion: DURATION, sistema: prepared.sceneSpec.sistema })},` +
    `${JSON.stringify(prepared.preparedAssets)})`,
  )
  const runtimeQc = await bundle.runVisualRuntimeQc(rendererWindow, prepared.sceneSpec, DURATION)
  await rendererWindow.webContents.executeJavaScript(`window.__setT(${item.u * DURATION})`)
  await rendererWindow.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  const qc = await rendererWindow.webContents.executeJavaScript('window.__visualQc()')
  const image = await rendererWindow.webContents.capturePage({ x: 0, y: 8, width: WIDTH, height: HEIGHT })
  const file = path.join(FRAME_DIR, `${String(index + 1).padStart(2, '0')}-${item.id}.png`)
  fs.writeFileSync(file, image.toPNG())
  return {
    id: item.id,
    title: item.title,
    asset: item.asset,
    treatment: prepared.sceneSpec.visualMode === 'asset-led' ? prepared.sceneSpec.slots[0].tint.treatment : 'n/a',
    structure: prepared.sceneSpec.direccion.estructura,
    system: prepared.sceneSpec.sistema,
    fontPair: prepared.sceneSpec.text.fontPairId,
    normalizedTime: item.u,
    effectiveMode: prepared.sceneSpec.visualMode,
    warnings: prepared.warnings,
    qc,
    runtimeQc,
    frameFile: file,
  }
}

function comparePngsWithTolerance (currentImage, expectedFile) {
  const expectedImage = nativeImage.createFromPath(expectedFile)
  const currentSize = currentImage.getSize()
  const expectedSize = expectedImage.getSize()
  if (currentSize.width !== expectedSize.width || currentSize.height !== expectedSize.height) {
    throw new Error(`Regresión legacy: dimensiones ${currentSize.width}x${currentSize.height} != ${expectedSize.width}x${expectedSize.height}`)
  }
  const current = currentImage.toBitmap()
  const expected = expectedImage.toBitmap()
  let differentPixels = 0
  let absoluteChannelDelta = 0
  for (let offset = 0; offset < current.length; offset += 4) {
    const blue = Math.abs(current[offset] - expected[offset])
    const green = Math.abs(current[offset + 1] - expected[offset + 1])
    const red = Math.abs(current[offset + 2] - expected[offset + 2])
    absoluteChannelDelta += red + green + blue
    if (Math.max(red, green, blue) > 8) differentPixels += 1
  }
  const pixels = currentSize.width * currentSize.height
  return {
    expectedFile: path.relative(REPO_ROOT, expectedFile).replace(/\\/g, '/'),
    width: currentSize.width,
    height: currentSize.height,
    differentPixelRatio: differentPixels / pixels,
    meanAbsoluteChannelDelta: absoluteChannelDelta / (pixels * 3),
  }
}

async function measureLegacyRegression () {
  const legacyGraphic = {
    type: 'visual_escena',
    value: 'memoria',
    extra: {
      conceptos: [
        { emoji: '🧠', etiqueta: 'recuerdo' },
        { emoji: '🗂️', etiqueta: 'archivo' },
        { emoji: '🔗', etiqueta: 'conexion' },
      ],
      direccion: {
        fondo: 'ondas', estructura: 'constelacion', camara: 'quieto',
        densidad: 'media', ritmo: 'simultaneo', tipografia: 'archivo',
      },
    },
  }
  rendererWindow.setContentSize(1080, 1928)
  await rendererWindow.webContents.executeJavaScript(
    `window.__montar(${JSON.stringify(legacyGraphic)},${JSON.stringify({ ancho: 1080, alto: 1920, modo: 'pantalla', duracion: 3, sistema: 'voltaje' })})`,
  )
  await rendererWindow.webContents.executeJavaScript('window.__setT(1.5)')
  await rendererWindow.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>new Promise(r=>setTimeout(r,200)))')
  const concepts = await rendererWindow.webContents.executeJavaScript(`
    [...document.querySelectorAll('.es-mini')].map(element => element.textContent)
  `)
  if (JSON.stringify(concepts) !== JSON.stringify(['🧠', '🗂️', '🔗'])) {
    throw new Error(`Regresión legacy: conceptos inesperados ${JSON.stringify(concepts)}`)
  }
  const full = await rendererWindow.webContents.capturePage({ x: 0, y: 8, width: 1080, height: 1920 })
  const comparison = comparePngsWithTolerance(
    full,
    path.join(OUTPUT, 'legacy-baseline-b735.png'),
  )
  if (comparison.differentPixelRatio > 0.03 || comparison.meanAbsoluteChannelDelta > 2) {
    throw new Error(`Regresión legacy fuera de tolerancia: ${JSON.stringify(comparison)}`)
  }
  rendererWindow.setContentSize(WIDTH, HEIGHT + 8)
  return {
    baselineCommit: 'b735f05c8c7df11a5bdc33a1fcf10f4caf4ea903',
    baseline: 'tests/aceptacion/visual-asset-mvp/legacy-baseline-b735.png',
    comparison: 'pixel tolerance; not byte equality',
    thresholds: { differentPixelRatioMax: 0.03, meanAbsoluteChannelDeltaMax: 2 },
    comparisons: [comparison],
  }
}

function escapeHtml (value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

async function makeSheet (rows) {
  const cardWidth = 252
  const cardHeight = 520
  const gap = 14
  const columns = 4
  const sheetWidth = 24 + columns * cardWidth + (columns - 1) * gap
  const sheetHeight = 92 + Math.ceil(rows.length / columns) * cardHeight + (Math.ceil(rows.length / columns) - 1) * gap + 24
  const cards = rows.map(row => `<article><img src="${pathToFileURL(row.frameFile).href}"><div class="meta"><b>${escapeHtml(row.title)}</b><span>${escapeHtml(row.structure)} · ${escapeHtml(row.treatment)}</span><span>${escapeHtml(row.system)} · ${escapeHtml(row.fontPair)} · u=${row.normalizedTime}</span></div></article>`).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;background:#080e14;color:#f2f4f7;font:14px/1.3 Arial,sans-serif}
    body{width:${sheetWidth}px;padding:20px 12px 24px}h1{margin:0 0 16px 4px;font:800 24px/1 Arial,sans-serif;letter-spacing:.02em}
    main{display:grid;grid-template-columns:repeat(${columns},${cardWidth}px);gap:${gap}px}
    article{height:${cardHeight}px;background:#161c26;border:1px solid #313b4c;border-radius:8px;overflow:hidden;box-shadow:0 4px 18px #0008}
    img{display:block;width:252px;height:448px;object-fit:cover;background:#000}.meta{height:72px;padding:7px 9px;display:flex;flex-direction:column;gap:2px}
    b{color:#ffd400;font-size:13px}span{font-size:11px;color:#aab3c2}
  </style><body><h1>VISUAL MVP PRODUCTIVO · PROJECTASSET + RENDERSPEC</h1><main>${cards}</main></body>`
  const htmlPath = path.join(FRAME_DIR, 'contact-sheet.html')
  fs.writeFileSync(htmlPath, html, 'utf8')
  sheetWindow = new BrowserWindow({ show: false, width: sheetWidth, height: sheetHeight, useContentSize: true,
    enableLargerThanScreen: true, frame: false, webPreferences: { offscreen: true, sandbox: true } })
  await sheetWindow.loadFile(htmlPath)
  sheetWindow.setContentSize(sheetWidth, sheetHeight)
  await sheetWindow.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode())).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))')
  const image = await sheetWindow.webContents.capturePage()
  const file = path.join(OUTPUT, 'contact-sheet.png')
  fs.writeFileSync(file, image.toPNG())
  return file
}

function item (id, title, assetName, spec, bindings, u = .5) {
  return { id, title, asset: assetName, graphic: graphicFor(spec), bindings, u }
}

async function main () {
  fs.mkdirSync(OUTPUT, { recursive: true })
  fs.mkdirSync(PRODUCTION, { recursive: true })
  fs.mkdirSync(FRAME_DIR, { recursive: true })
  const realBefore = JSON.stringify(snapshotRealProjects())
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts += 1; callback({ cancel: true }) }
    else callback({ cancel: false })
  })
  await new Promise(resolve => setTimeout(resolve, 1500))
  const renderNetworkBaseline = networkAttempts
  bundle.createProjectFiles(PROJECT_ROOT, {
    id: 'fixture-visual-mvp-acceptance', clips: [], timelineVideoClips: [], aiScript: 'Visual MVP acceptance',
  })
  const cake = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f382' }).asset
  const astronaut = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f9d1-200d-1f680' }).asset
  const compass = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f9ed' }).asset
  const assets = { cake, astronaut, compass }
  const bind = { cake: bindingsFor(cake), astronaut: bindingsFor(astronaut), compass: bindingsFor(compass) }
  const specs = {
    cakeConst: sceneSpec(bundle, cake, { keyword: 'CELEBRAR', connector: 'Una razón para', estructura: 'constelacion', treatment: 'accent-mask', semilla: 10101 }),
    cakePoster: sceneSpec(bundle, cake, { keyword: 'MOMENTO', connector: 'Todo cambia en un', estructura: 'marcoPoster', treatment: 'accent-mask', sistema: 'voltaje', fontPairId: 'editorial-black', semilla: 10102 }),
    cakeEditorial: sceneSpec(bundle, cake, { keyword: 'SEÑAL', connector: 'Esto también es una', estructura: 'editorial', treatment: 'none', sistema: 'clinico', semilla: 10103 }),
    astroConst: sceneSpec(bundle, astronaut, { keyword: 'EXPLORAR', connector: 'Nacimos para', estructura: 'constelacion', kind: 'complex-illustration', treatment: 'duotone', fontPairId: 'editorial-black', semilla: 20201 }),
    astroPoster: sceneSpec(bundle, astronaut, { keyword: 'UNIVERSO', connector: 'Más allá del', estructura: 'marcoPoster', kind: 'complex-illustration', treatment: 'duotone', sistema: 'voltaje', semilla: 20202, entry: 'scale-in', sustain: 'breathe', exit: 'scale-down' }),
    astroEditorial: sceneSpec(bundle, astronaut, { keyword: 'DESCUBRIR', connector: 'La misión es', estructura: 'editorial', kind: 'complex-illustration', treatment: 'duotone', sistema: 'editorial', fontPairId: 'editorial-black', semilla: 20203 }),
    compassConst: sceneSpec(bundle, compass, { keyword: 'DIRECCIÓN', connector: 'Primero encuentra la', estructura: 'constelacion', kind: 'complex-illustration', treatment: 'duotone', sistema: 'clinico', semilla: 30301 }),
    compassPoster: sceneSpec(bundle, compass, { keyword: 'DECIDIR', connector: 'Ahora toca', estructura: 'marcoPoster', kind: 'complex-illustration', treatment: 'duotone', sistema: 'editorial', emphasis: true, semilla: 30302 }),
    compassEditorial: sceneSpec(bundle, compass, { keyword: 'RUMBO', connector: 'No pierdas el', estructura: 'editorial', kind: 'complex-illustration', treatment: 'none', sistema: 'voltaje', fontPairId: 'editorial-black', semilla: 30303 }),
    editorialA: sceneSpec(bundle, null, { visualMode: 'editorial-text', keyword: 'EVIDENCIA', connector: 'Cuando sólo importa la', estructura: 'constelacion', sistema: 'editorial', semilla: 40401 }),
    editorialB: sceneSpec(bundle, null, { visualMode: 'editorial-text', keyword: 'SIN ATAJOS', connector: 'Pensar bien significa', estructura: 'marcoPoster', sistema: 'clinico', fontPairId: 'editorial-black', semilla: 40402 }),
  }
  const missingSpec = sceneSpec(bundle, cake, { keyword: 'CONTINÚA', connector: 'Si el archivo falta', estructura: 'editorial', sistema: 'voltaje', semilla: 50501 })
  const missingBinding = { assets: [{ slotId: 'hero', assetId: 'openmoji-no-presente', relativeFile: cake.relativeFile }] }
  const sheetCases = [
    item('cake-const-entry', 'Cake · entrada', 'cake', specs.cakeConst, bind.cake, .12),
    item('cake-poster-sustain', 'Cake · sustain', 'cake', specs.cakePoster, bind.cake, .50),
    item('cake-editorial-none', 'Cake · color original', 'cake', specs.cakeEditorial, bind.cake, .55),
    item('astronaut-const-entry', 'Astronaut · entrada', 'astronaut', specs.astroConst, bind.astronaut, .18),
    item('astronaut-poster-sustain', 'Astronaut · sustain', 'astronaut', specs.astroPoster, bind.astronaut, .50),
    item('astronaut-editorial-exit', 'Astronaut · salida', 'astronaut', specs.astroEditorial, bind.astronaut, .88),
    item('compass-const', 'Compass · duotone clínico', 'compass', specs.compassConst, bind.compass, .50),
    item('compass-poster-punch', 'Compass · duotone punch', 'compass', specs.compassPoster, bind.compass, .57),
    item('compass-editorial-none', 'Compass · original', 'compass', specs.compassEditorial, bind.compass, .50),
    item('editorial-only-a', 'Editorial sin Hero', 'none', specs.editorialA, undefined, .50),
    item('editorial-only-b', 'Editorial claro', 'none', specs.editorialB, undefined, .50),
    item('missing-fallback', 'Missing → editorial', 'missing', missingSpec, missingBinding, .50),
  ]

  await rendererReady()
  const legacyRegression = await measureLegacyRegression()
  const captured = []
  for (let index = 0; index < sheetCases.length; index++) captured.push(await captureCase(bundle, sheetCases[index], index))
  const sheet = await makeSheet(captured)

  const loaded = await invoke('load-project', { projectPath: PROJECT_ROOT })
  if (!loaded.success) throw new Error('No se pudo abrir el proyecto temporal: ' + loaded.error)
  const metrics = []
  removeObserver = bundle.observarRendimientoGraficos(metric => metrics.push(metric))
  const productionCases = [
    item('01-cake', 'Cake accent-mask', 'cake', specs.cakeConst, bind.cake),
    item('02-astronaut', 'Astronaut duotone', 'astronaut', specs.astroPoster, bind.astronaut),
    item('03-editorial', 'Editorial text', 'none', specs.editorialA, undefined),
    item('04-compass', 'Compass original', 'compass', specs.compassEditorial, bind.compass),
    item('05-punch', 'Cake punch', 'cake', sceneSpec(bundle, cake, { keyword: 'IMPACTO', connector: 'El dato causa', estructura: 'marcoPoster', treatment: 'accent-mask', sistema: 'calido', fontPairId: 'editorial-black', emphasis: true, semilla: 60601 }), bind.cake),
    item('06-missing', 'Fallback missing', 'missing', missingSpec, missingBinding),
    item('07-astronaut-exit', 'Astronaut scale-down', 'astronaut', specs.astroEditorial, bind.astronaut),
  ]
  const timeline = []
  let start = 0
  for (const visual of productionCases) {
    const clip = await bundle.renderGraphicClip(visual.graphic, {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla',
      projectRoot: PROJECT_ROOT, renderBindings: visual.bindings,
    })
    if (!clip || !fs.existsSync(clip)) throw new Error('Render nulo: ' + visual.id)
    timeline.push({ id: visual.id, name: visual.title, type: 'video', category: 'visual',
      path: clip, startSeconds: start, durationSeconds: DURATION })
    start += DURATION
  }

  const legacyGraphic = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [
    { emoji: '🧠', etiqueta: 'recuerdo' }, { emoji: '🗂️', etiqueta: 'archivo' }, { emoji: '🔗', etiqueta: 'conexion' }],
    direccion: { fondo: 'ondas', estructura: 'constelacion', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo', tipografia: 'archivo' },
    semilla: 99001,
  } }
  const legacyClip = await bundle.renderGraphicClip(legacyGraphic, {
    ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla', sistema: 'editorial',
  })
  if (!legacyClip) throw new Error('No se pudo medir el control legacy')

  await waitForMainWindow()
  const video = path.join(PRODUCTION, 'visual-asset-mvp-v1.mp4')
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: video })
  const exported = await invoke('export-video', {
    clips: timeline, aspectRatio: 'vertical', resolution: '720p', format: 'mp4', quality: 'high',
    assignedTransitions: {}, transitionDuration: .5, ajustesVideo: undefined,
  })
  if (!exported.success || !fs.existsSync(video) || fs.statSync(video).size === 0)
    throw new Error('Export productivo falló: ' + JSON.stringify(exported))

  if (networkAttempts !== renderNetworkBaseline)
    throw new Error(`La vía visual intentó red: antes=${renderNetworkBaseline}, después=${networkAttempts}`)
  if (JSON.stringify(snapshotRealProjects()) !== realBefore) throw new Error('Cambió un proyecto real')
  if (fs.existsSync(path.join(REPO_ROOT, 'project-state.json')) || fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')))
    throw new Error('Apareció estado en la raíz')
  const rawAssetsInOutput = []
  const walkOutput = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) walkOutput(target)
      else if (/\.svg$/i.test(entry.name)) rawAssetsInOutput.push(target)
    }
  }
  walkOutput(OUTPUT)
  if (rawAssetsInOutput.length) throw new Error('SVG crudo dentro del artefacto de aceptación')

  const legacyMetric = metrics.find(metric => metric.hash === path.basename(legacyClip, '.mp4'))
  const assetMetrics = metrics.filter(metric => productionCases.some(item => path.basename(timeline.find(clip => clip.id === item.id).path, '.mp4') === metric.hash))
  const assetMsPerFrame = assetMetrics.map(metric => metric.ms / metric.totalFrames)
  const legacyMsPerFrame = legacyMetric ? legacyMetric.ms / legacyMetric.totalFrames : null
  const medianAssetMsPerFrame = assetMsPerFrame.slice().sort((a, b) => a - b)[Math.floor(assetMsPerFrame.length / 2)]
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    base: 'b735f05c8c7df11a5bdc33a1fcf10f4caf4ea903',
    renderer: 'productive grafico.html / AnimatedGraphic / visual_escena',
    project: { temporary: true, realProjectsUntouched: true },
    assets: Object.fromEntries(Object.entries(assets).map(([name, record]) => [name, {
      stableId: { cake: 'openmoji:1f382', astronaut: 'openmoji:1f9d1-200d-1f680', compass: 'openmoji:1f9ed' }[name],
      provider: record.provider,
      providerVersion: record.source.providerVersion,
      sha256: record.sha256,
      mime: record.mime,
      byteLength: record.byteLength,
      sourceUrl: record.source.sourceUrl,
      fileUrl: record.source.fileUrl,
      licenseClaim: record.source.licenseClaim,
      licenseUrl: record.source.licenseUrl,
      attribution: record.source.attribution,
    }])),
    contactSheet: {
      file: 'contact-sheet.png', sha256: sha256(sheet), cells: captured.map(row => ({
        id: row.id, title: row.title, asset: row.asset, treatment: row.treatment,
        structure: row.structure, system: row.system, fontPair: row.fontPair,
        normalizedTime: row.normalizedTime, effectiveMode: row.effectiveMode, warnings: row.warnings,
        qc: row.qc,
        runtimeQc: row.runtimeQc,
      })),
    },
    video: {
      file: 'production/visual-asset-mvp-v1.mp4', sha256: sha256(video),
      scenes: productionCases.map((item, index) => ({ index, id: item.id, title: item.title, asset: item.asset,
        visualMode: timeline[index] ? bundle.prepareGraphicForVisualRender({ graphicData: item.graphic, projectRoot: PROJECT_ROOT, renderBindings: item.bindings }).sceneSpec.visualMode : null,
        durationSeconds: DURATION })),
      timelineExport: true,
      ffprobe: ffprobe(video),
    },
    performance: {
      dimensions: `${WIDTH}x${HEIGHT}`,
      fps: FPS,
      durationSeconds: DURATION,
      legacy: legacyMetric || null,
      assetLed: assetMetrics,
      legacyMsPerFrame,
      medianAssetMsPerFrame,
      deltaPercent: legacyMsPerFrame ? (medianAssetMsPerFrame / legacyMsPerFrame - 1) * 100 : null,
    },
    legacyRegression,
    network: { startupAttemptsBlocked: renderNetworkBaseline, visualAndExportAttempts: networkAttempts - renderNetworkBaseline },
  }
  const evidencePath = path.join(OUTPUT, 'evidence.json')
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ sheet, video, evidence: evidencePath, performance: evidence.performance, network: evidence.network }, null, 2))
}

app.whenReady().then(main).then(() => {
  removeObserver?.()
  try { rendererWindow?.destroy() } catch {}
  try { sheetWindow?.destroy() } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error(error) }
  app.exit(0)
}).catch(error => {
  console.error(error && error.stack || error)
  removeObserver?.()
  try { rendererWindow?.destroy() } catch {}
  try { sheetWindow?.destroy() } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (cleanupError) { console.error(cleanupError) }
  app.exit(1)
})
