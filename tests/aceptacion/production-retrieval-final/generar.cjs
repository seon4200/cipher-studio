const { app, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const zlib = require('zlib')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const { PRODUCTION_RETRIEVAL_REAL_V15 } = require('../../fixtures/production-retrieval-real-v15')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const VIDEO = path.join(OUTPUT, 'production-retrieval-final.mp4')
const SHEET = path.join(OUTPUT, 'production-retrieval-final.png')
const EVIDENCE = path.join(OUTPUT, 'evidence.json')
const FIXTURE_ROOT = createTestFixture('production-retrieval-final-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAMES = path.join(FIXTURE_ROOT, 'frames')

const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpGet = http.get
const originalHttpsRequest = https.request
const originalHttpsGet = https.get
let networkAttempts = 0

function blockNetwork () { networkAttempts++; throw new Error('NETWORK_FORBIDDEN_DURING_ACCEPTANCE_RENDER') }
function wordsFor (text, start, end) {
  const words = String(text).trim().split(/\s+/).filter(Boolean)
  return words.map((word, index) => ({ word, start: start + (end - start) * index / words.length,
    end: start + (end - start) * (index + .82) / words.length }))
}
function contextFor (bundle, row, index) {
  const start = Number.isFinite(row.start) ? row.start : 10
  const end = Number.isFinite(row.end) ? row.end : 12.5
  const concepts = (row.concepts || []).map(concept => ({ ...concept, scope: 'scene' }))
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: row.sceneId || row.id, start, end,
    transcriptSegments: [{ start, end, text: row.localText, words: wordsFor(row.localText, start, end) }],
    concepts, anchor: row.anchor || concepts[0]?.label, relation: row.relation,
    globalText: row.localText, globalHints: concepts.map(concept => concept.label),
    globalContextRef: 'dfinal-acceptance:' + row.id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: row.sceneId || row.id, duration: 1, localSemantic,
    keywordCandidates: [{ keyword: row.textKeyword, source: 'scene-semantic' }],
    preferredVisualMode: 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media',
      ritmo: 'simultaneo', semilla: 159500 + index },
    videoStyleId: 'cream-editorial', lockedChoices: [],
  })
}
function crc32 (bytes) {
  let crc = 0xffffffff
  for (const value of bytes) {
    crc ^= value
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function pngFixture (width = 160, height = 160) {
  const chunk = (type, data) => {
    const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
    return Buffer.concat([length, name, data, checksum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 4 + 1) + 1 + x * 4
    const visible = ((x - width / 2) ** 2) / 2600 + ((y - height / 2) ** 2) / 4300 < 1
    raw[offset] = 42; raw[offset + 1] = 105; raw[offset + 2] = 172; raw[offset + 3] = visible ? 255 : 0
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
function sanitize (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 _|+/.-]/g, ' ')
}
function frame (video, output, label) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.5', '-i', video,
    '-frames:v', '1', '-vf', `scale=360:640,pad=360:710:0:70:black,drawtext=fontfile='${font}':text='${sanitize(label).slice(0, 70)}':fontcolor=white:fontsize=15:x=10:y=18`, output],
  { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}
function concat (clips, output) {
  const list = path.join(FIXTURE_ROOT, 'clips.txt')
  fs.writeFileSync(list, clips.map(file => `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', output],
  { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}
function sheet (frames, output) {
  const columns = 3; const cellWidth = 360; const cellHeight = 710
  const layout = frames.map((_, index) => `${(index % columns) * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...frames.flatMap(file => ['-i', file]),
    '-filter_complex', `xstack=inputs=${frames.length}:layout=${layout}:fill=black`, '-frames:v', '1', output],
  { stdio: 'pipe', maxBuffer: 192 * 1024 * 1024 })
}
function probe (file) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate',
    '-of', 'json', file], { encoding: 'utf8' }))
}
function fileSha (file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }
function sourceFileSha (file) { return crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex') }
function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest; http.get = originalHttpGet
  https.request = originalHttpsRequest; https.get = originalHttpsGet
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
app.whenReady().then(async () => {
  global.fetch = blockNetwork
  http.request = blockNetwork; http.get = blockNetwork
  https.request = blockNetwork; https.get = blockNetwork
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
  })
  const bundle = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  await new Promise(resolve => setTimeout(resolve, 800))
  const startupNetworkBaseline = networkAttempts
  bundle.createProjectFiles(PROJECT_ROOT, { id: 'dfinal-acceptance', clips: [], timelineVideoClips: [], aiScript: 'fixture D-Final' })
  fs.mkdirSync(OUTPUT, { recursive: true }); fs.mkdirSync(FRAMES, { recursive: true })
  try {
    const selectedIds = new Set(['video-a-potencial', 'video-b-redes-sociales', 'video-b-mujer-presa',
      'video-b-inteligencia-artificial', 'video-b-chatgpt-escritura', 'video-b-hambre'])
    const rows = PRODUCTION_RETRIEVAL_REAL_V15.filter(row => selectedIds.has(row.id))
    rows.push({ id: 'acceptance-photographer', sceneId: 'acceptance-photographer', start: 10, end: 12,
      localText: 'la fotógrafa documenta el retrato', textKeyword: 'fotógrafa', relation: 'documenta',
      concepts: [{ label: 'fotógrafa' }] })
    const png = pngFixture()
    const resolved = await bundle.resolveModernVisualGenerationBatchV2({
      contexts: rows.map((row, index) => contextFor(bundle, row, index)), projectRoot: PROJECT_ROOT,
      pixabayApiKey: 'fixture-key', hooks: {
        searchRequestJson: async url => /fotografa/i.test(url.searchParams.get('q') || '') ? { hits: [{ id: 15915,
          pageURL: 'https://pixabay.com/illustrations/photographer-15915/',
          largeImageURL: 'https://cdn.pixabay.com/photographer-15915.png', imageWidth: 160, imageHeight: 160,
          type: 'illustration', tags: 'fotografa, retrato, aislada' }] } : { hits: [] },
        downloadRequestBytes: async () => png,
      },
    })
    const clips = []; const frameFiles = []; const evidenceRows = []
    for (let index = 0; index < resolved.length; index++) {
      const item = resolved[index]
      let qc = null
      const clip = await bundle.renderGraphicClip(item.resolved.compiled.graphicData, { ancho: 360, alto: 640, fps: 8, duracion: 1,
        modo: 'pantalla', sistema: 'editorial', projectRoot: PROJECT_ROOT,
        renderBindings: item.resolved.compiled.renderBindings,
        onQcReport: value => { qc = value }, onQcFailure: value => { qc = value } })
      if (!clip) throw new Error('QC rechazó acceptance: ' + item.context.sceneId + ' ' + JSON.stringify(qc?.findings || []))
      clips.push(clip)
      const outputFrame = path.join(FRAMES, String(index).padStart(2, '0') + '.png')
      const choices = item.resolved.choices
      frame(clip, outputFrame, `${item.context.sceneId} | ${item.resolved.compiled.sceneSpec.text.keyword} | ${choices.map(value => value.provider).join('+') || 'editorial'}`)
      frameFiles.push(outputFrame)
      evidenceRows.push({ sceneId: item.context.sceneId, keyword: item.resolved.compiled.sceneSpec.text.keyword,
        concepts: item.resolved.trace.concepts.map(value => value.concept),
        choices: choices.map(value => ({ slotId: value.slotId, concept: value.concept, provider: value.provider,
          stableId: value.stableId || null, assetId: value.asset?.id || null, reason: value.reason })),
        sceneSpecVersion: item.resolved.compiled.sceneSpec.renderSpecVersion,
        bindingsVersion: item.resolved.compiled.renderBindings.version,
        treatments: item.resolved.compiled.sceneSpec.slots.map(slot => slot.tint?.treatment || null),
        qc: qc.findings.filter(value => value.level === 'error').map(value => value.code),
        pixelIdentity: bundle.sceneSpecPixelIdentityAny(item.resolved.compiled.sceneSpec) })
    }
    concat(clips, VIDEO); sheet(frameFiles, SHEET)
    const output = {
      schemaVersion: 1,
      base: 'e6aae78e399419417e029eca0d35490d9effd961',
      sourceFixtureSha256: sourceFileSha(path.join(REPO_ROOT, 'tests/fixtures/production-retrieval-real-v15.js')),
      projectType: 'temporary-.cipher-test-fixture',
      manuallyConstructedSceneSpecs: 0,
      manuallyPublishedAssets: 0,
      scenes: evidenceRows,
      summary: {
        scenes: evidenceRows.length,
        withHero: evidenceRows.filter(row => row.choices.some(value => value.slotId === 'hero')).length,
        editorialOnly: evidenceRows.filter(row => row.choices.length === 0).length,
        providers: evidenceRows.flatMap(row => row.choices).reduce((counts, value) => ({ ...counts,
          [value.provider]: (counts[value.provider] || 0) + 1 }), {}),
        originalColorOpenMoji: evidenceRows.reduce((total, row) => total + row.choices.filter((choice, index) =>
          choice.provider === 'openmoji' && row.treatments[index] === 'original-color').length, 0),
        originalColorRaster: evidenceRows.reduce((total, row) => total + row.choices.filter((choice, index) =>
          choice.provider === 'pixabay-images' && row.treatments[index] === 'original-color').length, 0),
        qcRejected: evidenceRows.filter(row => row.qc.length).length,
      },
      video: { file: path.basename(VIDEO), sha256: fileSha(VIDEO), ...probe(VIDEO) },
      sheet: { file: path.basename(SHEET), sha256: fileSha(SHEET) },
      forbiddenRenderNetworkAttempts: networkAttempts - startupNetworkBaseline,
    }
    fs.writeFileSync(EVIDENCE, JSON.stringify(output, null, 2) + '\n')
    console.log('D_FINAL_ACCEPTANCE=' + JSON.stringify(output.summary))
    console.log('D_FINAL_VIDEO=' + VIDEO)
    console.log('D_FINAL_SHEET=' + SHEET)
    finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    finish(1)
  }
}).catch(error => { console.error(error && error.stack || error); finish(1) })
