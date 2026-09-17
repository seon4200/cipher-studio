// Fase 2A: corpus sintético congelado, materializador productivo, proyecto temporal y render offline.
// Las respuestas de Pixabay son capturas controladas de dos fotos locales previamente validadas;
// nunca se presentan como una búsqueda live ni como escenas del vídeo de un usuario.
const { app, session } = require('electron')
const assert = require('assert/strict')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const CORPUS = require('../../fixtures/editorial-motion-pilot-corpus-v1')

const REPO = path.resolve(__dirname, '../../..')
const REFINED = process.env.CIPHER_PILOT_REVISION === 'v2'
const RECHECK = process.env.CIPHER_PILOT_REVISION === 'v1-recheck'
const OUTPUT = REFINED ? path.join(__dirname, 'revision-v2')
  : RECHECK ? path.join(__dirname, 'revision-v1-recheck') : __dirname
const FIXTURE = createTestFixture('editorial-motion-pilot-acceptance')
const PROJECT = path.join(FIXTURE, 'project')
const FRAMES = path.join(FIXTURE, 'frames')
const PHOTO_ROOT = path.join(REPO, '..', '_spike-runtime', 'photo-cutout-v1', 'runs',
  '2026-09-11-06-18-11-623', 'raw')
const PHOTOS = Object.freeze({ camera: path.join(PHOTO_ROOT, 'complex-object.jpg'),
  woman: path.join(PHOTO_ROOT, 'person-mid.jpg'), protest: path.join(PHOTO_ROOT, 'busy-scene.jpg') })
const FPS = 24
const originalFetch = global.fetch
const originalHttp = http.request
const originalHttps = https.request
let bundle
let finished = false
let blockedNetwork = 0

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function run (command, args) { return execFileSync(command, args, { stdio: 'pipe', maxBuffer: 128 * 1024 * 1024 }) }
function safe (value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9 _|/.+%=-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) }

function wordsFor (text) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, index) => ({ word,
    start: 10 + 2.6 * index / words.length, end: 10 + 2.6 * (index + .85) / words.length }))
}

function contextFor (row, index) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: row.id, start: 10, end: 12.6,
    transcriptSegments: [{ start: 9.8, end: 12.8, text: row.text, words: wordsFor(row.text) }],
    concepts: row.concepts.map(concept => ({ ...concept, start: 10.05, end: 12.45, scope: 'scene' })),
    anchor: row.concepts[0]?.label, relation: row.relation,
    globalText: row.text, globalHints: [], globalContextRef: 'synthetic:editorial-pilot:' + row.id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: row.id, duration: row.duration, localSemantic,
    keywordCandidates: [{ keyword: row.keyword, source: 'scene-semantic' }],
    preferredVisualMode: row.preferredVisualMode ?? 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: 260900 + index },
    videoStyleId: 'cream-editorial',
  })
}

function recordedSearch (url) {
  const q = String(url.searchParams.get('q') ?? '').toLowerCase()
  if (/camera|c[aá]mara/.test(q)) return Promise.resolve({ hits: [{
    id: 1362419, pageURL: 'https://pixabay.com/photos/camera-digital-photography-1362419/',
    largeImageURL: 'https://cdn.pixabay.com/photo/camera-1362419.jpg',
    tags: 'camera, digital camera, photography, photographic equipment',
    imageWidth: 1280, imageHeight: 848, type: 'photo',
  }] })
  if (/woman|mujer|person|persona/.test(q)) return Promise.resolve({ hits: [{
    id: 1064658, pageURL: 'https://pixabay.com/photos/young-woman-computer-work-fatigue-1064658/',
    largeImageURL: 'https://cdn.pixabay.com/photo/woman-1064658.jpg',
    tags: 'woman, person, portrait, young woman, computer',
    imageWidth: 1280, imageHeight: 907, type: 'photo',
  }] })
  if (/protest|demonstration|rally|manifestaci[oó]n/.test(q)) return Promise.resolve({ hits: [{
    id: 4130710, pageURL: 'https://pixabay.com/photos/protest-meeting-people-crowd-4130710/',
    largeImageURL: 'https://cdn.pixabay.com/photo/protest-4130710.jpg',
    tags: 'protest, demonstration, rally, meeting, people, crowd',
    imageWidth: 1280, imageHeight: 720, type: 'photo',
  }] })
  return Promise.resolve({ hits: [] })
}
function recordedBytes (url) {
  const target = String(url)
  if (target.includes('1362419')) return Promise.resolve(fs.readFileSync(PHOTOS.camera))
  if (target.includes('1064658')) return Promise.resolve(fs.readFileSync(PHOTOS.woman))
  if (target.includes('4130710')) return Promise.resolve(fs.readFileSync(PHOTOS.protest))
  throw new Error('EDITORIAL_PILOT_UNRECORDED_DOWNLOAD')
}

function frameAt (video, output, duration, width, height) {
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(duration * .62), '-i', video,
    '-frames:v', '1', '-vf', `scale=${width}:${height}`, output])
}
function motionFrame (video, output, second) {
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(second), '-i', video,
    '-frames:v', '1', output])
}
function labeled (input, output, width, height, lines) {
  const scaledWidth = width === 540 ? 360 : 480
  const scaledHeight = height === 960 ? 640 : 270
  const header = 72
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const filters = [`scale=${scaledWidth}:${scaledHeight}`, `pad=${scaledWidth}:${scaledHeight + header}:0:${header}:black`]
  lines.slice(0, 3).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${safe(line)}':fontcolor=white:fontsize=14:x=9:y=${6 + index * 21}`))
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-vf', filters.join(','),
    '-frames:v', '1', output])
}
function sheet (images, output, width, height) {
  assert.equal(images.length, 4)
  const layout = `0_0|${width}_0|0_${height}|${width}_${height}`
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...images.flatMap(file => ['-i', file]),
    '-filter_complex', `xstack=inputs=4:layout=${layout}:fill=black`, '-frames:v', '1', output])
}
function join (clips, output) {
  const labels = clips.map((_, index) => `[${index}:v]`).join('')
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...clips.flatMap(file => ['-i', file]),
    '-filter_complex', `${labels}concat=n=${clips.length}:v=1:a=0,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-movflags', '+faststart', output])
}
function choices (row) { return row.resolved.choices.map(choice => ({ role: choice.slotId,
  provider: choice.provider, sha: choice.asset?.sha256 ?? null, solar: choice.solarIcon ?? null })) }

async function render (row, label, width, height) {
  const started = performance.now()
  const mainRssBefore = process.memoryUsage().rss
  let qc = null
  const clip = await bundle.renderGraphicClip(row.resolved.compiled.graphicData, {
    ancho: width, alto: height, fps: FPS, duracion: row.context.duration, modo: 'pantalla', sistema: 'editorial',
    projectRoot: PROJECT, renderBindings: row.resolved.compiled.renderBindings,
    onQcFailure: report => { qc = report }, onQcReport: report => { qc = report },
  })
  const ms = performance.now() - started
  const mainRssAfter = process.memoryUsage().rss
  if (!clip || !fs.existsSync(clip)) {
    const structural = bundle.evaluateVisualStructuralQcV2(row.resolved.compiled.sceneSpec)
    const errors = qc?.findings?.filter(item => item.level === 'error').map(item => item.code) ?? []
    const measurements = qc?.snapshots?.map(item => ({ at: item.normalizedTime,
      textOverflow: item.textOverflow, keywordOverflow: item.keywordOverflow,
      text: item.text, keyword: item.keyword })) ?? []
    const logs = [path.join(FIXTURE, 'generation-debug.log'), path.join(FIXTURE, 'cipher-studio', 'generation-debug.log')]
      .filter(file => fs.existsSync(file)).flatMap(file => fs.readFileSync(file, 'utf8').split(/\r?\n/)
        .filter(line => /GRAFICO|QC|ERROR/.test(line)).slice(-12))
    throw new Error(`PILOT_RENDER_FAILED:${label}:${JSON.stringify(structural)}:${errors.join(',')}:${JSON.stringify(measurements)}:${logs.join(' | ')}`)
  }
  const copied = path.join(FRAMES, `${label}.mp4`)
  const frame = path.join(FRAMES, `${label}.png`)
  fs.copyFileSync(clip, copied)
  frameAt(copied, frame, row.context.duration, width, height)
  return { clip: copied, frame, renderMs: ms, frameMs: ms / Math.max(1, Math.round(row.context.duration * FPS)),
    mainRssBefore, mainRssAfter,
    qcErrors: qc?.findings?.filter(item => item.level === 'error').map(item => item.code) ?? [],
    sha: sha(copied) }
}

async function finish (code) {
  global.fetch = originalFetch; http.request = originalHttp; https.request = originalHttps
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(FIXTURE)) } catch {}
  try { cleanupTestFixture(FIXTURE) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.setPath('userData', path.join(FIXTURE, 'electron-user-data'))
process.chdir(FIXTURE)
process.once('exit', () => { if (!finished) process.exitCode = 1 })
app.whenReady().then(async () => {
  try {
    const block = () => { blockedNetwork++; throw new Error('EDITORIAL_PILOT_NETWORK_FORBIDDEN') }
    global.fetch = block; http.request = block; https.request = block
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) blockedNetwork++
      callback({ cancel: /^https?:/i.test(details.url) })
    })
    bundle = require(path.join(REPO, 'dist-electron', 'main', 'index.js'))
    fs.mkdirSync(OUTPUT, { recursive: true })
    const profile = REFINED ? bundle.EDITORIAL_MOTION_PROFILE_V2 : bundle.EDITORIAL_MOTION_PROFILE_V1
    for (const file of Object.values(PHOTOS)) assert(fs.existsSync(file), 'Falta foto local de aceptación: ' + file)
    fs.mkdirSync(FRAMES, { recursive: true })
    bundle.createProjectFiles(PROJECT, { id: 'editorial-motion-pilot-temp', clips: [],
      timelineVideoClips: [], aiScript: 'corpus sintético 2A' })
    const hooks = { searchRequestJson: recordedSearch, downloadRequestBytes: recordedBytes }
    const contexts = CORPUS.map(contextFor)
    const baseline = await bundle.resolveModernVisualGenerationBatchV2({
      contexts, projectRoot: PROJECT, pixabayApiKey: 'captured-offline-response', hooks,
    })
    const pilot = await bundle.resolveModernVisualGenerationBatchV2({
      contexts: baseline.map(row => ({ ...row.context, presentationProfile: profile })),
      projectRoot: PROJECT, hooks,
    })
    // Supplemental capability probe, explicitly outside the frozen 12+4 corpus.
    // It checks whether a contextual event can retain its full photographic frame.
    const contextualInput = { id: 'supplemental-contextual-protest', source: 'synthetic-supplemental',
      kind: 'contextual-full-raster-probe', text: 'la protesta reunió a una multitud en la plaza',
      keyword: 'PROTESTA', duration: 1.7, concepts: [{ label: 'protesta', emoji: '✊' },
        { label: 'multitud', emoji: '👥' }] }
    const contextual = (await bundle.resolveModernVisualGenerationBatchV2({
      contexts: [{ ...contextFor(contextualInput, 16), presentationProfile: profile }],
      projectRoot: PROJECT, pixabayApiKey: 'captured-offline-response', hooks,
    }))[0]
    assert.equal(baseline.length, 16); assert.equal(pilot.length, 16)
    for (const [index, row] of pilot.entries()) {
      const errors = bundle.evaluateVisualStructuralQcV2(row.resolved.compiled.sceneSpec)
        .filter(item => item.level === 'error')
      if (errors.length) throw new Error(`QC_STRUCTURAL:${CORPUS[index].id}:${JSON.stringify(errors)}`)
    }
    if (process.env.CIPHER_PILOT_PREFLIGHT_ONLY === '1') {
      console.log('EDITORIAL_PILOT_PREFLIGHT_OK scenes=16')
      finished = true
      await finish(0)
      return
    }
    const records = []
    for (let i = 0; i < 16; i++) {
      const before = baseline[i]; const after = pilot[i]; const source = CORPUS[i]
      const oldText = before.resolved.compiled.sceneSpec.text
      const newText = after.resolved.compiled.sceneSpec.text
      assert.deepEqual(choices(before), choices(after), `Mismos roles/assets: ${source.id}`)
      const sameText = JSON.stringify([oldText.connector, oldText.keyword, oldText.closing]) ===
        JSON.stringify([newText.connector, newText.keyword, newText.closing])
      if (i < 8) assert(sameText, `Texto idéntico en comparación controlada: ${source.id}`)
      assert.equal(before.context.duration, after.context.duration)
      records.push({ id: source.id, source: source.source, kind: source.kind, localText: source.text,
        duration: source.duration, baselineFamily: before.resolved.compiled.sceneSpec.layout.family,
        pilotFamily: after.resolved.compiled.sceneSpec.layout.family,
        text: { connector: newText.connector ?? null, keyword: newText.keyword, closing: newText.closing ?? null },
        choices: choices(after), profile: after.resolved.compiled.sceneSpec.presentationProfile,
        sameAssets: true, substitutions: [], sameText,
        ...(!sameText ? { textDifferenceReason: 'V2 recupera literalmente una cola truncada de la narración local; fuera del A/B controlado' } : {}),
        beforeIdentity: bundle.sceneSpecPixelIdentityAny(before.resolved.compiled.sceneSpec),
        afterIdentity: bundle.sceneSpecPixelIdentityAny(after.resolved.compiled.sceneSpec) })
    }
    // Render exactly eight locked-resource A/Bs; remaining cases use the same materializer.
    for (let i = 0; i < 8; i++) {
      records[i].before = await render(baseline[i], `${CORPUS[i].id}-before-vertical`, 540, 960)
    }
    for (let i = 0; i < 16; i++) {
      records[i].vertical = await render(pilot[i], `${CORPUS[i].id}-after-vertical`, 540, 960)
    }
    for (const i of [0, 2, 4, 5, 8, 11, 12, 13, 14, 15]) {
      records[i].horizontal = await render(pilot[i], `${CORPUS[i].id}-after-horizontal`, 960, 540)
    }
    const label = (record, variant, orientation) => {
      const key = variant === 'before' ? 'before' : orientation
      const renderResult = record[key]
      const output = path.join(FRAMES, `${record.id}-${variant}-${orientation}-labeled.png`)
      labeled(renderResult.frame, output, orientation === 'horizontal' ? 960 : 540,
        orientation === 'horizontal' ? 540 : 960,
        [record.kind, variant.toUpperCase() + ' | ' + (variant === 'before' ? record.baselineFamily : record.pilotFamily),
          record.text.keyword])
      return output
    }
    for (let page = 0; page < 4; page++) {
      const a = records[page * 2]; const b = records[page * 2 + 1]
      sheet([label(a, 'before', 'vertical'), label(a, 'after', 'vertical'),
        label(b, 'before', 'vertical'), label(b, 'after', 'vertical')],
      path.join(OUTPUT, `ab-same-assets-${page + 1}.png`), 360, 712)
    }
    for (let page = 0; page < 3; page++) {
      sheet(records.slice(page * 4, page * 4 + 4).map(value => label(value, 'after', 'vertical')),
        path.join(OUTPUT, `main-scenes-${page + 1}.png`), 360, 712)
    }
    sheet(records.slice(12).map(value => label(value, 'after', 'vertical')),
      path.join(OUTPUT, 'stress-vertical.png'), 360, 712)
    sheet(records.slice(12).map(value => label(value, 'after', 'horizontal')),
      path.join(OUTPUT, 'stress-horizontal.png'), 480, 342)
    const vertical = path.join(OUTPUT, 'editorial-pilot-12-vertical.mp4')
    const horizontal = path.join(OUTPUT, 'editorial-pilot-6-horizontal.mp4')
    join(records.slice(0, 12).map(value => value.vertical.clip), vertical)
    join([0, 2, 4, 5, 8, 11].map(i => records[i].horizontal.clip), horizontal)
    let readingSample = null
    if (REFINED) {
      // Same materialized scenes, deliberately longer playback only. No audio/word timing is claimed.
      const indices = [0, 5, 6, 7, 11]
      const clips = []
      for (const index of indices) {
        const longRow = { ...pilot[index], context: { ...pilot[index].context, duration: 3.8 } }
        clips.push((await render(longRow, `${CORPUS[index].id}-reading-sample`, 540, 960)).clip)
      }
      readingSample = path.join(OUTPUT, 'editorial-pilot-reading-5-vertical.mp4')
      join(clips, readingSample)
      motionFrame(readingSample, path.join(OUTPUT, 'reading-entry.png'), .4)
      motionFrame(readingSample, path.join(OUTPUT, 'reading-stable.png'), 2.1)
      motionFrame(readingSample, path.join(OUTPUT, 'reading-exit.png'), 3.6)
    }
    motionFrame(vertical, path.join(OUTPUT, 'motion-entry.png'), CORPUS[0].duration * .12)
    motionFrame(vertical, path.join(OUTPUT, 'motion-stable.png'), CORPUS[0].duration * .55)
    motionFrame(vertical, path.join(OUTPUT, 'motion-exit.png'), CORPUS[0].duration * .93)
    const contextualResult = { providers: choices(contextual).map(item => item.provider),
      fullRasterMaterialized: contextual.resolved.choices.some(choice => choice.representation === 'full-raster' && !!choice.asset) }
    if (contextualResult.fullRasterMaterialized) {
      const extra = await render(contextual, 'supplemental-contextual-full-raster', 540, 960)
      contextualResult.frame = path.basename(extra.frame)
      fs.copyFileSync(extra.frame, path.join(OUTPUT, 'contextual-full-raster.png'))
    }
    const portableRender = value => value && ({ ...value,
      clip: path.basename(value.clip), frame: path.basename(value.frame) })
    const evidenceRows = records.map(value => ({ ...value,
      before: portableRender(value.before), vertical: portableRender(value.vertical),
      horizontal: portableRender(value.horizontal) }))
    const evidence = { version: REFINED ? 2 : 1, corpus: 'synthetic-curated-12-plus-4', fps: FPS,
      providerMode: 'three-recorded-photos-plus-local-openmoji-solar; network blocked',
      photoSources: Object.fromEntries(Object.entries(PHOTOS).map(([key, file]) => [key, { sha256: sha(file), bytes: fs.statSync(file).size }])),
      blockedNetwork, rows: evidenceRows, supplementalContextualProbe: contextualResult,
      performance: { baseline8Ms: records.slice(0, 8).reduce((sum, row) => sum + row.before.renderMs, 0),
        pilot8Ms: records.slice(0, 8).reduce((sum, row) => sum + row.vertical.renderMs, 0),
        baseline8MsPerFrame: records.slice(0, 8).reduce((sum, row) => sum + row.before.frameMs, 0) / 8,
        pilot8MsPerFrame: records.slice(0, 8).reduce((sum, row) => sum + row.vertical.frameMs, 0) / 8,
        baseline8MaxMainRssBytes: Math.max(...records.slice(0, 8).map(row => row.before.mainRssAfter)),
        pilot8MaxMainRssBytes: Math.max(...records.slice(0, 8).map(row => row.vertical.mainRssAfter)) },
      outputs: { vertical: path.basename(vertical), horizontal: path.basename(horizontal),
        ...(readingSample ? { readingSample: path.basename(readingSample), readingSampleHasAudio: false } : {}) } }
    fs.writeFileSync(path.join(OUTPUT, 'evidence.json'), JSON.stringify(evidence, null, 2))
    console.log('EDITORIAL_PILOT_ACCEPTANCE_OK scenes=12 stress=4 ab=8 fps=' + FPS)
    console.log('BLOCKED_NETWORK=' + blockedNetwork)
    finished = true
    await finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    await finish(1)
  }
}).catch(async error => { console.error(error && error.stack || error); await finish(1) })
