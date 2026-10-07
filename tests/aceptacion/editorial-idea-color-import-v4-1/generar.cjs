// V4.1: local catalog admission -> ProjectAsset -> SceneSpec/PixelIdentity -> V15/CSS alpha mask -> DPI-safe MP4.
const { app, session, ipcMain } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const crypto = require('node:crypto'), zlib = require('node:zlib')
const { spawnSync } = require('node:child_process')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const root = path.resolve(__dirname, '../../..')
const source = path.resolve(root, '../_cipher-idea-assembly-v3/runtime')
const catalogRoot = process.env.CIPHER_EDITORIAL_IDEA_SUPPORT_CATALOG || path.resolve(root, '../_cipher-support-catalog-v4-1')
const outputRoot = path.resolve(root, '../_cipher-support-catalog-v4-1/evidence')
const run = path.join(outputRoot, `run-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '-')}`)
const fixture = createTestFixture('editorial-idea-color-import-v4-1')
const project = path.join(fixture, 'project')
const replayProject = path.join(fixture, 'replay-without-render-cache')
const ffmpeg = process.env.CIPHER_FFMPEG_EXE || 'ffmpeg'
process.env.PATH = path.dirname(ffmpeg) + path.delimiter + process.env.PATH
const traceFile = process.env.CIPHER_V41_TRACE_FILE
const trace = value => {
  if (!traceFile) return
  fs.mkdirSync(path.dirname(traceFile), { recursive: true })
  fs.appendFileSync(traceFile, `${new Date().toISOString()} ${value}\n`)
}
trace(`module-loaded argv=${JSON.stringify(process.argv.slice(1))}`)
app.setPath('userData', path.join(fixture, 'userData'))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
process.chdir(fixture)

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const shaFile = file => sha(fs.readFileSync(file))
const write = (name, bytes) => {
  const file = path.join(run, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, bytes)
  return file
}
const ff = (args, buffer = false) => {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], {
    timeout: 300000, maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(`FFMPEG:${result.status}:${result.error?.message || result.stderr?.toString()}`)
  return buffer ? result.stdout : undefined
}
const frame = (video, seconds, name) => {
  const file = path.join(run, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  ff(['-y', '-ss', String(seconds), '-i', video, '-frames:v', '1', '-update', '1', file])
  return file
}
const rawFrame = (video, seconds) => ff([
  '-ss', String(seconds), '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
], true)
const rawPng = file => {
  const png = fs.readFileSync(file)
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'DIAGNOSTIC_CAPTURE_NOT_PNG')
  assert.equal(png.readUInt32BE(16), 720, 'DIAGNOSTIC_PNG_WIDTH')
  assert(png.readUInt32BE(20) >= 1280, 'DIAGNOSTIC_PNG_HEIGHT')
  return ff(['-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], true)
}
const rgb = hex => hex.slice(1).match(/../g).map(part => parseInt(part, 16))
// The real product path encodes these frames as yuv420p/H.264. Thin one-pixel
// strokes measured up to 28 levels of chroma deviation; 32 is bounded and
// leaves the minimum colored-pixel presence assertion intact. SceneSpec still
// asserts the exact canonical CSS HEX before encoding.
const countColor = (raw, rect, hex, tolerance = 32) => {
  const [x0, y0, x1, y1] = rect, target = rgb(hex)
  let count = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * 720 + x) * 3
    if (target.every((channel, c) => Math.abs(raw[i + c] - channel) <= tolerance)) count++
  }
  return count
}
const changedPixelsInRegion = (a, b, rect, width = 720) => {
  assert.equal(a.length, b.length, 'RAW_CAPTURE_DIMENSION_MISMATCH')
  const [x0, y0, x1, y1] = rect
  let changedPixels = 0, changedChannels = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 3
    let pixelChanged = false
    for (let c = 0; c < 3; c++) if (a[i + c] !== b[i + c]) { changedChannels++; pixelChanged = true }
    if (pixelChanged) changedPixels++
  }
  return { changedPixels, changedChannels }
}
const changedPixelsOutsideRects = (a, b, excludedRects, width = 720) => {
  assert.equal(a.length, b.length, 'RAW_CAPTURE_DIMENSION_MISMATCH')
  assert.equal(a.length % (width * 3), 0, 'RAW_CAPTURE_ROW_ALIGNMENT')
  const height = a.length / (width * 3)
  let changedPixels = 0, changedChannels = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (excludedRects.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)) continue
    const i = (y * width + x) * 3
    let pixelChanged = false
    for (let c = 0; c < 3; c++) if (a[i + c] !== b[i + c]) { changedChannels++; pixelChanged = true }
    if (pixelChanged) changedPixels++
  }
  return { changedPixels, changedChannels, comparedWidth: width, comparedHeight: height,
    excludedRects }
}
const supportsInPortrait = [
  { x: 65, y: 430, rect: [65, 430, 145, 510] },
  { x: 575, y: 425, rect: [575, 425, 660, 510] },
  { x: 65, y: 860, rect: [65, 860, 145, 960] },
  { x: 575, y: 860, rect: [575, 860, 660, 960] },
]
const catalogOrder = [
  'idea-support-personas-v1', 'idea-support-datos-v1', 'idea-support-soluciones-v1', 'idea-support-impacto-v1',
  'idea-support-camera-v1', 'idea-support-network-v1', 'idea-support-time-v1', 'idea-support-target-v1',
  'idea-support-connection-v1', 'idea-support-flow-v1',
]
const groups = [
  catalogOrder.slice(0, 4),
  catalogOrder.slice(4, 8),
  [catalogOrder[8], catalogOrder[9], catalogOrder[0], catalogOrder[1]],
]
const renderedVisualFiles = []
const colors = {
  ink: { supportSource: 'ink', heroPrimary: '#C5481E', resolved: '#11110F' },
  orange: { supportSource: 'video-primary', heroPrimary: '#C5481E', resolved: '#A83B19' },
  teal: { supportSource: 'custom', customColor: '#238C87', heroPrimary: '#C5481E', resolved: '#238C87' },
  crimson: { supportSource: 'custom', customColor: '#B8444F', heroPrimary: '#C5481E', resolved: '#B8444F' },
  custom: { supportSource: 'custom', customColor: '#7b4ea3', heroPrimary: '#c5481e', resolved: '#7B4EA3' },
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const payload = Buffer.concat([typeBytes, data])
  let crc = 0xffffffff
  for (const byte of payload) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const header = Buffer.alloc(4); header.writeUInt32BE(data.length)
  const tail = Buffer.alloc(4); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([header, typeBytes, data, tail])
}
function fixturePng({ opaque = false, greenPatch = false }) {
  const width = 1024, height = 1024, rowBytes = width * 4
  const scanlines = Buffer.alloc(height * (rowBytes + 1))
  for (let y = 0; y < height; y++) {
    const row = y * (rowBytes + 1)
    scanlines[row] = 0
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4
      const patch = greenPatch && x < 256 && y < 256
      const ink = !greenPatch && x >= 256 && x < 768 && y >= 256 && y < 768
      scanlines[i] = patch ? 0 : 0
      scanlines[i + 1] = patch ? 255 : 0
      scanlines[i + 2] = patch ? 0 : 0
      scanlines[i + 3] = opaque || patch || ink ? 255 : 0
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(scanlines)), pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function htmlCrop(frameFile, crop, caption, index) {
  const source = path.relative(run, frameFile).replace(/\\/g, '/')
  const [x0, y0, x1, y1] = crop
  const scale = 2
  return `<figure><div class="crop"><img src="${source}" alt="" style="width:1440px;height:2560px;left:-${x0 * scale}px;top:-${y0 * scale}px"></div><figcaption>${index}. ${caption}</figcaption></figure>`
}
function htmlCell(frameFile, caption, index) {
  const source = path.relative(run, frameFile).replace(/\\/g, '/')
  return `<figure><div class="full-frame"><img src="${source}" alt=""></div><figcaption>${index}. ${caption}</figcaption></figure>`
}
function saveHtml(name, title, body, style = '') {
  return write(name, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{margin:0;padding:24px;background:#f0eee8;color:#11110f;font:14px "DM Sans",Arial,sans-serif}h1{font:32px Georgia,serif}p{max-width:1000px;line-height:1.5}
main{display:grid;grid-template-columns:repeat(5,minmax(145px,1fr));gap:12px}.rowhead{grid-column:1/-1;font-weight:700;margin-top:14px;padding-top:8px;border-top:1px solid #bbb}
figure{margin:0;padding:9px;background:#faf9f6;border:1px solid #ddd;border-radius:8px;min-width:0}.crop{position:relative;overflow:hidden;width:100px;height:100px;margin:0 auto;background:#faf9f6}.crop img{position:absolute;max-width:none}.full-frame{height:260px;display:flex;align-items:center;justify-content:center;background:#ebe9e3}.full-frame img{max-width:100%;max-height:100%;object-fit:contain}.asset{display:block;text-align:center;padding:10px;background:#faf9f6;border:1px solid #ddd;border-radius:8px}
figcaption{font-size:12px;margin-top:8px;overflow-wrap:anywhere}a{color:#7a3217}
${style}</style><h1>${title}</h1>${body}`)
}

app.whenReady().then(async () => {
  let exitCode = 1
  trace('electron-ready')
  try {
    assert(fs.existsSync(source), 'V3_APPROVED_PILOT_ASSETS_MISSING')
    assert(fs.existsSync(catalogRoot), 'V41_LOCAL_CATALOG_MISSING')
    fs.mkdirSync(run, { recursive: true })
    trace(`run-created ${run}`)
    const b = require(path.join(root, 'dist-electron/main/index.js'))
    trace('main-bundle-required')
    // This acceptance owns the Electron lifecycle and exits explicitly in finally.
    // The production editor's window-all-closed handler otherwise may quit between
    // sequential offscreen renders when this fixture has no visible editor window.
    app.removeAllListeners('window-all-closed')
    app.on('before-quit', () => trace('electron-before-quit'))
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices', () => ({ success: true, voices: [] }))
    b.createProjectFiles(project, { id: 'idea-v4-1-temp', clips: [], timelineVideoClips: [], aiScript: 'synthetic V4.1 alpha support acceptance' })
    b.createProjectFiles(replayProject, { id: 'idea-v4-1-replay', clips: [], timelineVideoClips: [], aiScript: 'synthetic deterministic replay fixture' })

    let networkAttempts = 0
    global.fetch = () => { networkAttempts++; throw new Error('NETWORK_FORBIDDEN_V41') }
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) }
      else callback({ cancel: false })
    })

    const importResult = b.importEditorialIdeaSupportCatalogV41({ projectRoot: project, catalogRoot, assetIds: catalogOrder })
    trace('catalog-imported')
    assert.deepEqual(Object.keys(importResult).sort(), [...catalogOrder].sort())
    assert.equal(Object.keys(b.IDEA_SUPPORT_MANIFEST_V41).length > 0, true)
    assert.equal(b.IDEA_SUPPORT_MANIFEST_V41.assetCount, 10)
    const protectedLegacy = ['personas-v2', 'datos', 'soluciones', 'impacto']
    for (let i = 0; i < protectedLegacy.length; i++) {
      const name = protectedLegacy[i]
      const sourceBytes = fs.readFileSync(path.join(source, `${name}.png`))
      const masterBytes = fs.readFileSync(path.join(catalogRoot, 'masters', `${name}.png`))
      const runtimeBytes = fs.readFileSync(path.join(catalogRoot, 'runtime', `${name}.png`))
      assert(sourceBytes.equals(masterBytes) && sourceBytes.equals(runtimeBytes), `LEGACY_SUPPORT_NOT_BYTE_PRESERVED:${name}`)
      assert.equal(importResult[catalogOrder[i]].asset.sha256, sha(sourceBytes))
    }
    assert.equal(new Set(catalogOrder).size, 10, 'V41_CATALOG_NOT_EXACTLY_TEN')

    const baseIntent = { supportSource: 'video-primary', heroMode: 'recolorable', heroPrimary: '#C5481E' }
    trace('render-v4-portrait-start')
    const v4 = await b.generateIdeaColorPilotV4({ projectRoot: project, assetRoot: source, color: baseIntent,
      orientation: 'portrait', render: b.renderGraphicClip })
    trace('render-v4-portrait-done')
    assert(v4.file && fs.existsSync(v4.file), 'V4_REGRESSION_VERTICAL_MISSING')
    assert.equal(v4.sceneSpec.presentationProfile.revision, b.EDITORIAL_IDEA_ASSEMBLY_V4.revision)
    assert.equal(v4.sceneSpec.ideaAssembly.supports.length, 4)
    assert.equal(v4.qc?.findings.filter(item => item.level === 'error').length, 0, 'V4_REGRESSION_QC')
    const v4Portrait = write('v4-regression/idea-v4-approved-portrait.mp4', fs.readFileSync(v4.file))
    renderedVisualFiles.push(v4Portrait)
    const v4PortraitStable = frame(v4Portrait, 2.55, 'v4-regression/frames/v4-portrait-stable.png')
    const v4LandscapeResult = await b.generateIdeaColorPilotV4({ projectRoot: project, assetRoot: source, color: baseIntent,
      orientation: 'landscape', render: b.renderGraphicClip })
    trace('render-v4-landscape-done')
    assert(v4LandscapeResult.file && fs.existsSync(v4LandscapeResult.file), 'V4_REGRESSION_HORIZONTAL_MISSING')
    assert.equal(v4LandscapeResult.qc?.findings.filter(item => item.level === 'error').length, 0, 'V4_LANDSCAPE_QC')
    const v4Landscape = write('v4-regression/idea-v4-approved-landscape.mp4', fs.readFileSync(v4LandscapeResult.file))
    renderedVisualFiles.push(v4Landscape)

    // The six generated masters stay untouched; only six deterministic alpha-preserving runtime downscales are imported.
    for (const item of b.IDEA_SUPPORT_MANIFEST_V41.assets) {
      const masterPath = path.resolve(catalogRoot, ...item.masterRelativePath.split('/'))
      const runtimePath = path.resolve(catalogRoot, ...item.runtimeRelativePath.split('/'))
      assert.equal(shaFile(masterPath), item.masterSha256, `MASTER_SHA_MISMATCH:${item.assetId}`)
      assert.equal(shaFile(runtimePath), item.sha256, `RUNTIME_SHA_MISMATCH:${item.assetId}`)
      assert.equal(fs.readFileSync(runtimePath).readUInt32BE(16), item.dimensions.width)
      assert.equal(fs.readFileSync(runtimePath).readUInt32BE(20), item.dimensions.height)
    }

    const matrixRenders = Object.create(null)
    const caseResults = []
    const verticalCoverage = []
    for (const [colorName, intent] of Object.entries(colors)) {
      matrixRenders[colorName] = []
      assert.equal(b.resolveIdeaColorV41(intent).supportTint.resolvedColor, intent.resolved)
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        trace(`render-v41-start color=${colorName} group=${groupIndex + 1}`)
        const built = b.bindEditorialIdeaSupportsV41({
          template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
          imported: importResult, assetIds: groups[groupIndex], color: intent,
        })
        assert.equal(built.resolvedColor, intent.resolved)
        assert.equal(built.sceneSpec.ideaAssembly.heroPalette.mode, 'recolorable')
        assert.equal(built.sceneSpec.ideaAssembly.heroPalette.primary, '#C5481E')
        assert.equal(built.sceneSpec.text.keyword, v4.sceneSpec.text.keyword)
        assert.deepEqual(built.sceneSpec.text, v4.sceneSpec.text, 'V41_TEXT_CHANGED_WITH_SUPPORT_TINT')
        assert.equal(built.sceneSpec.ideaAssembly.supports.length, 4)
        assert.equal(built.sceneSpec.slots.filter(slot => slot.colorCapability === 'alpha-mask').length, 4)
        assert(!/[A-Z]:\\|C:\\|provenance|masterRelativePath|runtimeRelativePath/i.test(JSON.stringify(built.sceneSpec)), 'LOCAL_PATH_OR_PROVENANCE_LEAKED_IN_SCENESPEC')
        const capturedQc = []
        const rawCapturePath = `raw-captures/${colorName}-group-${groupIndex + 1}-frame-61.png`
        const rawCaptureFiles = []
        const rendered = await b.renderGraphicClip(built.graphicData, {
          ancho: 720, alto: 1280, fps: 24, duracion: 80 / 24, modo: 'pantalla', sistema: 'editorial',
          projectRoot: project, renderBindings: built.renderBindings,
          onQcReport: report => capturedQc.push(report), onQcFailure: report => capturedQc.push(report),
          diagnosticCaptureFrames: [61],
          onDiagnosticFrame: (frameIndex, seconds, png) => {
            assert.equal(frameIndex, 61)
            rawCaptureFiles.push(write(rawCapturePath, png))
          },
        })
        trace(`render-v41-done color=${colorName} group=${groupIndex + 1}`)
        assert(rendered && fs.existsSync(rendered), `V41_RENDER_FAILED:${colorName}:${groupIndex}`)
        assert.equal(capturedQc.flatMap(report => report.findings ?? []).filter(item => item.level === 'error').length, 0,
          `V41_QC_ERROR:${colorName}:${groupIndex}`)
        const output = write(`matrix-renders/${colorName}-group-${groupIndex + 1}-vertical.mp4`, fs.readFileSync(rendered))
        renderedVisualFiles.push(output)
        const stable = frame(output, 2.55, `matrix-frames/${colorName}-group-${groupIndex + 1}-stable.png`)
        const raw = rawFrame(output, 2.55)
        assert.equal(rawCaptureFiles.length, 1, `ELECTRON_LOSSLESS_CAPTURE_MISSING:${colorName}:${groupIndex}`)
        const rawCapture = rawCaptureFiles[0]
        const rawCaptureRgb = rawPng(rawCapture)
        const perAsset = groups[groupIndex].map((id, slotIndex) => {
          const actual = countColor(raw, supportsInPortrait[slotIndex].rect, intent.resolved)
          assert(actual > 18, `ALPHA_MASK_COLOR_NOT_VISIBLE:${id}:${colorName}:${actual}`)
          // Chromium's lossless NativeImage raster rounds the requested CSS sRGB triplet by
          // at most two 8-bit levels on this Windows compositor; inspect PNG before H.264.
          const rawColor = countColor(rawCaptureRgb, supportsInPortrait[slotIndex].rect, intent.resolved, 2)
          assert(rawColor > 0, `ELECTRON_ALPHA_MASK_COLOR_NOT_VISIBLE_IN_LOSSLESS_PNG:${id}:${colorName}`)
          return { assetId: id, slotId: `support-${slotIndex + 1}`,
            pixelsNearResolvedColorAfterH264: actual, pixelsWithin2LsbBeforeEncoding: rawColor }
        })
        const outputRecord = { output, stable, sceneSpec: built.sceneSpec, identity: built.pixelIdentity,
          assets: perAsset, group: groups[groupIndex], rawCapture, rawCaptureRgb }
        matrixRenders[colorName].push(outputRecord)
        caseResults.push({ color: colorName, hex: intent.resolved, group: groupIndex + 1,
          pixelIdentity: built.pixelIdentity, supportPixels: perAsset, qc: 'PASS' })
        if (colorName === 'ink') verticalCoverage.push(output)
      }
    }

    // Same lowercase user HEX and uppercase canonical HEX must freeze the same identity.
    const lower = b.bindEditorialIdeaSupportsV41({
      template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
      imported: importResult, assetIds: groups[0], color: colors.custom,
    })
    const upper = b.bindEditorialIdeaSupportsV41({
      template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
      imported: importResult, assetIds: groups[0], color: { ...colors.custom, customColor: '#7B4EA3', heroPrimary: '#C5481E' },
    })
    assert.equal(lower.sceneSpec.ideaAssembly.supportTint.resolvedColor, '#7B4EA3')
    assert.equal(lower.pixelIdentity, upper.pixelIdentity, 'HEX_CASE_CHANGED_PIXEL_IDENTITY')
    assert.throws(() => b.resolveIdeaColorV41({ ...colors.ink, heroMode: 'dual-accent' }), /IDEA_V41_HERO_COLOR_MODE_UNAVAILABLE/)
    assert.throws(() => b.resolveIdeaColorV41({ ...colors.ink, heroMode: 'fixed-spectrum' }), /IDEA_V41_HERO_COLOR_MODE_UNAVAILABLE/)
    assert.throws(() => b.resolveIdeaColorV41({ ...colors.ink, supportSource: 'hero-secondary' }), /IDEA_V41_HERO_SECONDARY_UNAVAILABLE/)

    const unauthorizedScene = structuredClone(lower.sceneSpec)
    unauthorizedScene.ideaAssembly.supports[0].catalogAssetId = 'unapproved-support-injection'
    assert.throws(() => b.validateVisualSceneSpecV2(unauthorizedScene), /IDEA_V41_SUPPORT_CATALOG_IDENTITY_INVALID/)
    const unauthorizedBindings = structuredClone(b.bindEditorialIdeaSupportsV41({
      template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
      imported: importResult, assetIds: groups[0], color: colors.ink,
    }).renderBindings)
    unauthorizedBindings.assets.find(item => item.slotId === 'support-1').assetId = 'not-the-scene-asset'
    assert.throws(() => b.validateRenderBindingsAny(unauthorizedBindings, lower.sceneSpec), /assetId lógico/)
    assert.throws(() => b.importEditorialIdeaSupportCatalogV41({ projectRoot: project, catalogRoot,
      assetIds: ['unapproved-support-injection'] }), /IDEA_V41_SUPPORT_ASSET_NOT_CURATED/)

    // Negative tests run only against isolated copies; the approved local catalog stays unchanged.
    const rejectedTests = Object.create(null)
    for (const [name, bytes, expected] of [
      ['sha-altered-same-name', Buffer.concat([fs.readFileSync(path.join(catalogRoot, 'runtime/camera.png')), Buffer.from([0])]), /IDEA_V41_SUPPORT_SHA_MISMATCH/],
      ['opaque-png', fixturePng({ opaque: true }), /IDEA_V41_SUPPORT_ALPHA_OR_DIMENSIONS_INVALID/],
      ['green-baked-background', fixturePng({ greenPatch: true }), /IDEA_V41_SUPPORT_BACKGROUND_OR_COLOR_INVALID/],
    ]) {
      const badRoot = path.join(fixture, `rejected-${name}`)
      fs.cpSync(catalogRoot, badRoot, { recursive: true })
      fs.writeFileSync(path.join(badRoot, 'runtime/camera.png'), bytes)
      assert.throws(() => b.importEditorialIdeaSupportCatalogV41({ projectRoot: project, catalogRoot: badRoot,
        assetIds: ['idea-support-camera-v1'] }), expected, `IMPORTER_ACCEPTED_${name}`)
      rejectedTests[name] = 'REJECTED'
    }
    const tamperedManifestRoot = path.join(fixture, 'rejected-manifest-path')
    fs.cpSync(catalogRoot, tamperedManifestRoot, { recursive: true })
    const alteredManifest = JSON.parse(fs.readFileSync(path.join(tamperedManifestRoot, 'manifest.json'), 'utf8'))
    alteredManifest.assets[4].runtimeRelativePath = 'runtime/../masters/camera-master.png'
    fs.writeFileSync(path.join(tamperedManifestRoot, 'manifest.json'), JSON.stringify(alteredManifest))
    assert.throws(() => b.importEditorialIdeaSupportCatalogV41({ projectRoot: project,
      catalogRoot: tamperedManifestRoot, assetIds: ['idea-support-camera-v1'] }), /IDEA_V41_SUPPORT_MANIFEST_UNTRUSTED/)
    rejectedTests['manifest-path-traversal'] = 'REJECTED'

    // Verify color-only variation leaves every neutral Hero PNG and the literal text unchanged.
    const templateBindings = new Map(v4.renderBindings.assets.map(item => [item.slotId, item]))
    const neutralSlots = ['hero', 'idea-bulb', 'idea-rear', 'idea-front', 'idea-background']
    const neutralAssets = Object.fromEntries(neutralSlots.map(slotId => {
      const binding = templateBindings.get(slotId)
      assert(binding, `MISSING_NEUTRAL_BINDING:${slotId}`)
      const file = path.join(project, ...binding.relativeFile.split('/'))
      const bytes = fs.readFileSync(file)
      return [slotId, { relativeFile: binding.relativeFile, sha256: sha(bytes), bytes: bytes.length }]
    }))
    const templateText = JSON.stringify(v4.sceneSpec.text)
    assert(matrixRenders.ink.every(render => JSON.stringify(render.sceneSpec.text) === templateText))
    assert(matrixRenders.custom.every(render => JSON.stringify(render.sceneSpec.text) === templateText))
    const blackSupportsOrangeHero = b.bindEditorialIdeaSupportsV41({
      template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
      imported: importResult, assetIds: groups[0], color: colors.ink,
    })
    const blackSupportsTealHero = b.bindEditorialIdeaSupportsV41({
      template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
      imported: importResult, assetIds: groups[0], color: { ...colors.ink, heroPrimary: '#238C87' },
    })
    assert.equal(blackSupportsOrangeHero.sceneSpec.ideaAssembly.supportTint.resolvedColor, '#11110F')
    assert.equal(blackSupportsTealHero.sceneSpec.ideaAssembly.supportTint.resolvedColor, '#11110F')
    assert.notEqual(blackSupportsOrangeHero.pixelIdentity, blackSupportsTealHero.pixelIdentity)
    const tealHeroQc = []
    const tealHeroRawCaptureFiles = []
    const tealHeroFile = await b.renderGraphicClip(blackSupportsTealHero.graphicData, {
      ancho: 720, alto: 1280, fps: 24, duracion: 80 / 24, modo: 'pantalla', sistema: 'editorial', projectRoot: project,
      renderBindings: blackSupportsTealHero.renderBindings, onQcReport: report => tealHeroQc.push(report),
      onQcFailure: report => tealHeroQc.push(report),
      diagnosticCaptureFrames: [61],
      onDiagnosticFrame: (frameIndex, seconds, png) => {
        assert.equal(frameIndex, 61)
        tealHeroRawCaptureFiles.push(write('raw-captures/hero-teal-black-supports-frame-61.png', png))
      },
    })
    assert(tealHeroFile && fs.existsSync(tealHeroFile), 'HERO_ACCENT_INDEPENDENCE_RENDER_MISSING')
    assert.equal(tealHeroQc.flatMap(report => report.findings ?? []).filter(item => item.level === 'error').length, 0)
    const tealHeroOutput = write('hero-accent/teal-hero-black-supports.mp4', fs.readFileSync(tealHeroFile))
    renderedVisualFiles.push(tealHeroOutput)
    const tealHeroFrame = frame(tealHeroOutput, 2.55, 'hero-accent/teal-hero-stable.png')
    const tealHeroRaw = rawFrame(tealHeroOutput, 2.55)
    assert.equal(tealHeroRawCaptureFiles.length, 1, 'HERO_ACCENT_ELECTRON_RAW_CAPTURE_MISSING')
    const tealHeroRawCapture = tealHeroRawCaptureFiles[0]
    const tealHeroRawCaptureRgb = rawPng(tealHeroRawCapture)
    const heroTealPixels = countColor(tealHeroRaw, [260, 700, 325, 850], '#238C87', 20)
    const blackSupportPixels = groups[0].map((id, i) => ({ assetId: id,
      pixels: countColor(tealHeroRaw, supportsInPortrait[i].rect, '#11110F', 20) }))
    assert(heroTealPixels > 40, `HERO_ACCENT_NOT_RECOLORED:${heroTealPixels}`)
    assert(blackSupportPixels.every(item => item.pixels > 18), 'HERO_ACCENT_CHANGED_SUPPORT_TINT')
    for (const slotId of neutralSlots) assert.equal(shaFile(path.join(project, ...neutralAssets[slotId].relativeFile.split('/'))),
      neutralAssets[slotId].sha256, `NEUTRAL_PROJECT_ASSET_CHANGED:${slotId}`)

    // Exact decoded RGB comparison of Electron NativeImage PNGs, before H.264/chroma subsampling.
    // Support-color comparisons must be identical outside the four icon masks; Hero-accent
    // comparison separately excludes only the documented central accent collage envelope.
    const neutralRegions = {
      background: [8, 8, 110, 90],
      headline: [180, 70, 540, 330],
      bulbGlass: [285, 445, 435, 635],
      bust: [250, 690, 485, 920],
      neutralPaper: [115, 600, 225, 760],
    }
    const baselineTintCapture = matrixRenders.ink[0].rawCaptureRgb
    const supportTintRawDiffs = Object.fromEntries(Object.keys(colors).filter(name => name !== 'ink').map(name => {
      const candidate = matrixRenders[name][0].rawCaptureRgb
      const regions = Object.fromEntries(Object.entries(neutralRegions).map(([region, rect]) =>
        [region, changedPixelsInRegion(baselineTintCapture, candidate, rect)]))
      for (const [region, diff] of Object.entries(regions))
        assert.equal(diff.changedPixels, 0, `SUPPORT_TINT_CHANGED_NEUTRAL_${region.toUpperCase()}:${name}`)
      return [name, { regions, fullFrameOutsideSupportMasks: changedPixelsOutsideRects(
        baselineTintCapture, candidate, supportsInPortrait.map(support => support.rect)) }]
    }))
    for (const [name, result] of Object.entries(supportTintRawDiffs))
      assert.equal(result.fullFrameOutsideSupportMasks.changedPixels, 0, `SUPPORT_TINT_CHANGED_NON_SUPPORT_PIXELS:${name}`)
    // Changing the Hero accent is a separate axis from Support tint. The source PNGs
    // (including stone/glass/paper and their shadows) are byte-pinned above; this proof
    // checks the intended teal accent appears while all four Support masks stay editorial ink.
    const heroAccentRawDiff = changedPixelsInRegion(matrixRenders.ink[0].rawCaptureRgb,
      tealHeroRawCaptureRgb, [260, 700, 460, 900])
    const tealHeroPixelsWithin2Lsb = countColor(tealHeroRawCaptureRgb, [260, 700, 460, 900], '#238C87', 2)
    assert(heroAccentRawDiff.changedPixels > 0 && tealHeroPixelsWithin2Lsb > 20,
      'HERO_ACCENT_LAYER_DID_NOT_CHANGE_TO_TEAL')

    // Horizontal format is independently rendered with all ten IDs covered in three real scenes.
    const horizontalCoverage = []
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const built = b.bindEditorialIdeaSupportsV41({
        template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
        imported: importResult, assetIds: groups[groupIndex], color: colors.ink,
      })
      const qc = []
      const rendered = await b.renderGraphicClip(built.graphicData, {
        ancho: 1280, alto: 720, fps: 24, duracion: 80 / 24, modo: 'pantalla', sistema: 'editorial', projectRoot: project,
        renderBindings: built.renderBindings, onQcReport: report => qc.push(report), onQcFailure: report => qc.push(report),
      })
      assert(rendered && fs.existsSync(rendered), `V41_LANDSCAPE_RENDER_FAILED:${groupIndex}`)
      assert.equal(qc.flatMap(report => report.findings ?? []).filter(item => item.level === 'error').length, 0,
        `V41_LANDSCAPE_QC:${groupIndex}`)
      horizontalCoverage.push(write(`coverage/horizontal-scene-${groupIndex + 1}.mp4`, fs.readFileSync(rendered)))
      renderedVisualFiles.push(horizontalCoverage[horizontalCoverage.length - 1])
    }
    const verticalVideo = path.join(run, 'supports-coverage-vertical-9x16.mp4')
    const horizontalVideo = path.join(run, 'supports-coverage-horizontal-16x9.mp4')
    ff(['-y', ...verticalCoverage.flatMap(file => ['-i', file]), '-filter_complex',
      `concat=n=${verticalCoverage.length}:v=1:a=0,format=yuv420p[v]`, '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '18', '-r', '24', '-movflags', '+faststart', verticalVideo])
    ff(['-y', ...horizontalCoverage.flatMap(file => ['-i', file]), '-filter_complex',
      `concat=n=${horizontalCoverage.length}:v=1:a=0,format=yuv420p[v]`, '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '18', '-r', '24', '-movflags', '+faststart', horizontalVideo])
    renderedVisualFiles.push(verticalVideo, horizontalVideo)

    // Deterministic replay on a fresh project path, with materialized ProjectAssets copied but no render cache.
    fs.mkdirSync(replayProject, { recursive: true })
    fs.cpSync(path.join(project, 'materiales'), path.join(replayProject, 'materiales'), { recursive: true })
    const replaySpec = b.bindEditorialIdeaSupportsV41({
      template: { sceneSpec: v4.sceneSpec, graphicData: v4.graphicData, renderBindings: v4.renderBindings },
      imported: importResult, assetIds: groups[0], color: colors.custom,
    })
    const replayQc = []
    const replayFile = await b.renderGraphicClip(replaySpec.graphicData, {
      ancho: 720, alto: 1280, fps: 24, duracion: 80 / 24, modo: 'pantalla', sistema: 'editorial', projectRoot: replayProject,
      renderBindings: replaySpec.renderBindings, onQcReport: report => replayQc.push(report), onQcFailure: report => replayQc.push(report),
    })
    assert(replayFile && fs.existsSync(replayFile), 'DETERMINISTIC_REPLAY_MISSING')
    renderedVisualFiles.push(replayFile)
    assert.equal(replayQc.flatMap(report => report.findings ?? []).filter(item => item.level === 'error').length, 0)
    const originalCustom = matrixRenders.custom[0]
    const repeatDiff = (() => {
      const a = rawFrame(originalCustom.output, 2.55), c = rawFrame(replayFile, 2.55)
      assert.equal(a.length, c.length)
      let changed = 0; for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) changed++
      return changed
    })()
    assert.equal(replaySpec.pixelIdentity, originalCustom.identity, 'REPLAY_PIXEL_IDENTITY_CHANGED')
    assert.equal(repeatDiff, 0, `REPLAY_PIXEL_DIFF:${repeatDiff}`)

    const originalManifest = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'manifest.json'), 'utf8'))
    const supportRows = originalManifest.assets.map(entry => {
      const groupIndex = groups.findIndex(group => group.includes(entry.assetId))
      const slotIndex = groups[groupIndex].indexOf(entry.assetId)
      const screenshots = Object.fromEntries(Object.keys(colors).map(name => {
        const item = matrixRenders[name][groupIndex]
        return [name, { frame: item.stable, crop: supportsInPortrait[slotIndex].rect }]
      }))
      return { assetId: entry.assetId, label: entry.label, screenshots }
    })
    const matrixHead = `<p>Capturas estables del compositor V15 real dentro de Electron/Chromium. Cada celda recorta el mismo slot tras pasar por ProjectAsset y AlphaMaskRasterV4 (CSS mask con modo alpha). También se guardó NativeImage PNG lossless antes de H.264: la identidad/CSS guarda el HEX canónico exacto y los píxeles RGB de Electron quedan a no más de 2 niveles de 8 bits por redondeo de su compositor. Se verificó igualdad exacta del resto del fotograma fuera de las máscaras al cambiar tintes. 24 fps; tono del Hero fijo en #C5481E.</p><div class="rowhead">Asset · ID lógico</div><div class="rowhead">${Object.entries(colors).map(([name, item]) => `${name} ${item.resolved}`).join(' · ')}</div>`
    const matrixBody = `<main>${supportRows.map((row, rowIndex) => `<div class="rowhead">${rowIndex + 1}. ${row.label}<br><small>${row.assetId}</small></div>${Object.keys(colors).map(name => {
      const shot = row.screenshots[name]
      return htmlCrop(shot.frame, shot.crop, `${name} · ${colors[name].resolved}`, rowIndex + 1)
    }).join('')}`).join('')}</main>`
    const matrixHtml = saveHtml('support-color-matrix.html', 'IDEA Support V4.1 · 10 × 5 tintes', matrixHead + matrixBody)
    const blackBody = `<p>Los diez Supports con tinta editorial negra, renderizados mediante el mismo compositor/product path usado por V4.1.</p><main>${supportRows.map((row, index) => {
      const shot = row.screenshots.ink
      return htmlCrop(shot.frame, shot.crop, `${row.label} · ${row.assetId}`, index + 1)
    }).join('')}</main>`
    const contactHtml = saveHtml('support-contact-black.html', 'IDEA Support V4.1 · Contact sheet tinta negra', blackBody,
      'main{grid-template-columns:repeat(5,minmax(145px,1fr))}')
    const v41Black = matrixRenders.ink[0].stable
    const comparisonHtml = saveHtml('v4-v4-1-regression.html', 'IDEA V4 vs V4.1 · regression check',
      `<p>V4 remains its original four-Support scene. V4.1 retains the same approved Hero/layout and changes only versioned Support identities/color fields for the explicit local catalog.</p><main>
      ${htmlCell(v4PortraitStable, 'V4 original · four approved Supports', 1)}${htmlCell(v41Black, 'V4.1 · same four Support bytes, alpha-mask ink', 2)}</main>`,
      'main{grid-template-columns:repeat(2,minmax(320px,1fr))}')

    assert.equal(networkAttempts, 0, `NETWORK_AFTER_MATERIALIZATION:${networkAttempts}`)
    const appMask = fs.readFileSync(path.join(root, 'src/renderer/src/composiciones/alpha-mask-raster-v4.tsx'), 'utf8')
    const compositor = fs.readFileSync(path.join(root, 'src/renderer/src/composiciones/editorial-idea-assembly-v1.tsx'), 'utf8')
    assert(!/hue-rotate|saturate|filter\s*:/i.test(appMask), 'ALPHA_MASK_COMPONENT_HAS_COLOR_FILTER')
    assert(compositor.includes('renderMode="css"') && compositor.includes('isV4_1 ?'), 'V41_NOT_USING_CHROMIUM_ALPHA_MASK_ROUTE')

    const visualSinFichero = renderedVisualFiles.filter(file => !fs.existsSync(file)).length
    assert.equal(visualSinFichero, 0, 'V41_VISUAL_FILE_MISSING')
    const report = {
      result: 'PASS', profile: 'editorial-idea-assembly-2026-09-v4-1', catalogRoot,
      manifestSha256: sha(fs.readFileSync(path.join(catalogRoot, 'manifest.json'))),
      catalogAssets: originalManifest.assets.map(entry => ({ assetId: entry.assetId, label: entry.label,
        sha256: entry.sha256, masterSha256: entry.masterSha256, dimensions: entry.dimensions,
        alphaValidation: entry.alphaValidation, source: entry.source, promptLiteral: entry.promptLiteral })),
      legacyBytesPreserved: protectedLegacy,
      colors: Object.fromEntries(Object.entries(colors).map(([name, value]) => [name, value.resolved])),
      renderedCases: caseResults, heroTintIndependent: { supportTint: '#11110F', heroPrimary: '#238C87', accentPixels: heroTealPixels,
        supportPixelsRemainInk: blackSupportPixels, stableFrame: tealHeroFrame },
      neutralProjectAssetsUnchanged: neutralAssets, literalTextUnchanged: true,
      rejectedTests, directSceneSpecInjectionRejected: true, renderBindingAssetIdMismatchRejected: true,
      lowercaseHexCanonicalized: true, dualAccentRejected: true, fixedSpectrumRejected: true,
      electronChromiumAlphaMask: 'PASS · actual MotionGraphicV15 render, five tints across ten imported IDs',
      losslessElectronPng: {
        capturePoint: 'NativeImage.toPNG() after exact-frame probe, before ffmpeg/H.264; 720px viewport; frame 61/80 at 24fps',
        allTintMatrixCaptures: Object.fromEntries(Object.entries(colors).map(([name]) => [name,
          matrixRenders[name].map(item => ({ png: item.rawCapture, sha256: shaFile(item.rawCapture),
            pixelsWithin2LsbOfResolvedColorByAsset: item.assets.map(asset => ({ assetId: asset.assetId,
              pixels: asset.pixelsWithin2LsbBeforeEncoding })) }))])),
        supportTintNeutralRegionDiff: supportTintRawDiffs,
        heroAccentChange: { orangeToTeal: '#C5481E -> #238C87',
          accentRegionDiff: heroAccentRawDiff, pixelsWithin2LsbOfTeal: tealHeroPixelsWithin2Lsb,
          png: tealHeroRawCapture, sha256: shaFile(tealHeroRawCapture) },
      },
      visualFilesCreated: renderedVisualFiles.length, visualSinFichero, networkAttempts,
      deterministicReplay: { identity: replaySpec.pixelIdentity, rawRgbDiff: repeatDiff },
      v4Regression: { vertical: v4Portrait, horizontal: v4Landscape, revision: v4.sceneSpec.presentationProfile.revision },
      coverage: { verticalVideo, horizontalVideo, frames: 80, fps: 24, sceneSeconds: 80 / 24, scenesPerFormat: 3 },
      evidence: { colorMatrix: matrixHtml, blackContactSheet: contactHtml, v4Comparison: comparisonHtml,
        heroAccentFrame: tealHeroFrame },
      audio: 'No se añadió voz; validación visual/motion, no sincronización con narración.',
    }
    write('evidence.json', Buffer.from(JSON.stringify(report, null, 2)))
    trace('acceptance-evidence-written')
    write('rejected-test-fixtures.json', Buffer.from(JSON.stringify({ rejectedCatalogAssets: 0,
      syntheticNegativeFixtures: rejectedTests, note: 'Los fixtures sintéticos negativos sólo prueban el importador y no son candidatos del catálogo.' }, null, 2)))
    console.log(JSON.stringify({ result: 'PASS', run, imported: catalogOrder.length, matrixCases: caseResults.length,
      verticalVideo, horizontalVideo, matrixHtml, contactHtml, v4Regression: v4Portrait,
      replayPixelDiff: repeatDiff, networkAttempts, visualSinFichero: 0 }))
    exitCode = 0
  } catch (error) {
    trace(`acceptance-error ${error?.stack || error}`)
    console.error(error?.stack || error)
  } finally {
    cleanupTestFixture(fixture)
    app.exit(exitCode)
  }
}).catch(error => {
  console.error(error?.stack || error)
  cleanupTestFixture(fixture)
  app.exit(1)
})
