// Synthetic, frozen 12+8 corpus. Productive semantic/materialization/render path, captured provider replies.
const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const corpus = require('../../fixtures/visual-recovery-corpus-v1')

const root = path.resolve(__dirname, '../../..')
const output = __dirname
const fixture = createTestFixture('visual-recovery-acceptance')
const project = path.join(fixture, 'project')
const work = path.join(fixture, 'work')
const raw = path.join(root, '..', '_spike-runtime', 'photo-cutout-v1', 'runs',
  '2026-09-11-06-18-11-623', 'raw')
const photos = { camera: path.join(raw, 'complex-object.jpg'), woman: path.join(raw, 'person-mid.jpg'),
  protest: path.join(raw, 'busy-scene.jpg') }
const fps = 24
const nativeFetch = global.fetch; const nativeHttp = http.request; const nativeHttps = https.request
let bundle; let completed = false; let blocked = 0
const run = (program, args) => execFileSync(program, args, { stdio: 'pipe', maxBuffer: 128 * 1024 * 1024 })
const wordsFor = text => text.split(/\s+/).filter(Boolean).map((word, index, array) => ({ word,
  start: 10 + 2.6 * index / array.length, end: 10 + 2.6 * (index + .85) / array.length }))

function contextFor (row, index) {
  let seed = 260900 + index
  if (row.targetFamily) {
    const first = seed
    while (seed < first + 1000 && bundle.selectVisualPresentationV4({ sceneId: row.id,
      visualMode: 'asset-led', supportCount: row.targetSupportCount, relation: row.relation,
      density: 'media', rhythm: 'simultaneo', seed,
      allowedTypographyLooks: ['editorial-strong'] }).family !== row.targetFamily) seed++
    assert(seed < first + 1000, `No eligible ${row.targetFamily} for ${row.id}`)
  }
  const semantic = bundle.createLocalSceneSemanticV1({ sceneId: row.id, start: 10, end: 12.6,
    transcriptSegments: [{ start: 9.8, end: 12.8, text: row.text, words: wordsFor(row.text) }],
    concepts: row.concepts.map(concept => ({ ...concept, start: 10.05, end: 12.45, scope: 'scene' })),
    anchor: row.concepts[0]?.label, relation: row.relation, globalText: row.text, globalHints: [],
    globalContextRef: `synthetic:visual-recovery:${row.id}` })
  return bundle.createModernVisualGenerationContextV2({ sceneId: row.id, duration: row.duration,
    localSemantic: semantic, keywordCandidates: [{ keyword: row.keyword, source: 'scene-semantic' }],
    preferredVisualMode: row.preferredVisualMode ?? 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media',
      ritmo: 'simultaneo', semilla: seed }, videoStyleId: 'cream-editorial' })
}

function search (url) {
  const q = String(url.searchParams.get('q') ?? '').toLowerCase()
  if (/camera|c[aá]mara/.test(q)) return Promise.resolve({ hits: [{ id: 1362419,
    pageURL: 'https://pixabay.com/photos/camera-digital-photography-1362419/',
    largeImageURL: 'https://cdn.pixabay.com/photo/camera-1362419.jpg',
    tags: 'camera, digital camera, photography, photographic equipment', imageWidth: 1280,
    imageHeight: 848, type: 'photo' }] })
  if (/woman|mujer|person|persona/.test(q)) return Promise.resolve({ hits: [{ id: 1064658,
    pageURL: 'https://pixabay.com/photos/young-woman-computer-work-fatigue-1064658/',
    largeImageURL: 'https://cdn.pixabay.com/photo/woman-1064658.jpg',
    tags: 'woman, person, portrait, young woman, computer', imageWidth: 1280,
    imageHeight: 907, type: 'photo' }] })
  if (/protest|demonstration|rally|manifestaci[oó]n/.test(q)) return Promise.resolve({ hits: [{ id: 4130710,
    pageURL: 'https://pixabay.com/photos/protest-meeting-people-crowd-4130710/',
    largeImageURL: 'https://cdn.pixabay.com/photo/protest-4130710.jpg',
    tags: 'protest, demonstration, rally, meeting, people, crowd', imageWidth: 1280,
    imageHeight: 720, type: 'photo' }] })
  return Promise.resolve({ hits: [] })
}
function bytes (url) {
  const value = String(url)
  if (value.includes('1362419')) return Promise.resolve(fs.readFileSync(photos.camera))
  if (value.includes('1064658')) return Promise.resolve(fs.readFileSync(photos.woman))
  if (value.includes('4130710')) return Promise.resolve(fs.readFileSync(photos.protest))
  throw new Error('VISUAL_RECOVERY_UNRECORDED_DOWNLOAD')
}

function choiceIds (row) {
  return row.resolved.choices.map(value => [value.slotId, value.provider, value.asset?.sha256 ?? value.solarIcon])
}
async function render (row, label, width, height) {
  let qc
  const start = performance.now()
  const file = await bundle.renderGraphicClip(row.resolved.compiled.graphicData, {
    ancho: width, alto: height, fps, duracion: row.context.duration, modo: 'pantalla', sistema: 'editorial',
    projectRoot: project, renderBindings: row.resolved.compiled.renderBindings,
    onQcReport: value => { qc = value }, onQcFailure: value => { qc = value },
  })
  const ms = performance.now() - start
  const errors = qc?.findings?.filter(value => value.level === 'error') ?? []
  if (!file || !fs.existsSync(file)) throw new Error(`RENDER_FAILED:${label}:${JSON.stringify(errors)}:` +
    JSON.stringify(qc?.snapshots?.map(value => ({ at: value.normalizedTime,
      fit: value.textFitStage, diagnostic: value.textFitDiagnostic, overflow: value.textOverflow })) ?? []))
  const clip = path.join(work, `${label}.mp4`)
  fs.copyFileSync(file, clip)
  const frame = path.join(output, 'frames', `${label}.png`)
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(row.context.duration * .57),
    '-i', clip, '-frames:v', '1', frame])
  return { clip, frame, ms, frameMs: ms / (row.context.duration * fps), errors,
    fitStages: [...new Set(qc?.snapshots?.map(value => value.textFitStage).filter(Boolean) ?? [])],
    contrast: qc?.localTextContrast ?? null }
}
function join (files, target) {
  const labels = files.map((_, index) => `[${index}:v]`).join('')
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...files.flatMap(file => ['-i', file]),
    '-filter_complex', `${labels}concat=n=${files.length}:v=1:a=0,format=yuv420p[v]`, '-map', '[v]',
    '-c:v', 'libx264', '-movflags', '+faststart', target])
}
function html (records) {
  const card = (row, key) => row[key] ? `<figure><img src="frames/${path.basename(row[key].frame)}"><figcaption>` +
    `${row.id} · ${key} · ${row.family} · ${row.look}</figcaption></figure>` : ''
  const page = (items, keys) => '<!doctype html><meta charset="utf-8"><style>body{background:#17171a;color:white;font:16px Arial}' +
    '.grid{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:18px}figure{margin:0}img{width:100%;height:500px;object-fit:contain;background:black}' +
    'figcaption{padding:8px}</style><div class="grid">' + items.map(row => keys.map(key => card(row, key)).join('')).join('') + '</div>'
  fs.writeFileSync(path.join(output, 'ab-text-composition.html'), page(records.slice(0, 8), ['beforeV', 'afterV']))
  fs.writeFileSync(path.join(output, 'main-12.html'), page(records.slice(0, 12), ['afterV', 'afterH']))
  fs.writeFileSync(path.join(output, 'stress-8.html'), page(records.slice(12), ['afterV', 'afterH']))
}
async function finish (code) {
  global.fetch = nativeFetch; http.request = nativeHttp; https.request = nativeHttps
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(fixture)) } catch {}
  try { cleanupTestFixture(fixture) } catch (error) { console.error('Fixture retained:', error.message) }
  app.exit(code)
}

app.commandLine.appendSwitch('force-device-scale-factor', process.env.CIPHER_RECOVERY_SCALE ?? '1')
app.setPath('userData', path.join(fixture, 'user-data'))
process.chdir(fixture)
process.once('exit', () => { if (!completed) process.exitCode = 1 })
app.whenReady().then(async () => {
  try {
    const deny = () => { blocked++; throw new Error('VISUAL_RECOVERY_NETWORK_BLOCKED') }
    global.fetch = deny; http.request = deny; https.request = deny
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) blocked++
      callback({ cancel: /^https?:/i.test(details.url) })
    })
    bundle = require(path.join(root, 'dist-electron', 'main', 'index.js'))
    for (const file of Object.values(photos)) assert(fs.existsSync(file), `Missing local source ${file}`)
    fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(path.join(output, 'frames'), { recursive: true })
    bundle.createProjectFiles(project, { id: 'visual-recovery-acceptance-temp', clips: [],
      timelineVideoClips: [], aiScript: 'synthetic corpus' })
    const hooks = { searchRequestJson: search, downloadRequestBytes: bytes }
    const inputs = corpus.map(contextFor)
    const baseline = await bundle.resolveModernVisualGenerationBatchV2({ contexts: inputs,
      projectRoot: project, pixabayApiKey: 'captured-offline-response', hooks })
    const recovery = await bundle.resolveModernVisualGenerationBatchV2({ contexts: baseline.map(row => ({
      ...row.context, presentationProfile: bundle.VISUAL_RECOVERY_PROFILE_V1 })), projectRoot: project, hooks })
    assert.equal(baseline.length, 20); assert.equal(recovery.length, 20)
    const records = []
    for (let i = 0; i < 20; i++) {
      assert.deepEqual(choiceIds(baseline[i]), choiceIds(recovery[i]), `Same assets/roles ${corpus[i].id}`)
      const spec = recovery[i].resolved.compiled.sceneSpec
      const structural = bundle.evaluateVisualStructuralQcV2(spec).filter(value => value.level === 'error')
      assert.equal(structural.length, 0, `${corpus[i].id}: ${JSON.stringify(structural)}`)
      records.push({ id: corpus[i].id, kind: corpus[i].kind, text: corpus[i].text,
        family: spec.layout.family, look: spec.text.typographyLookId,
        keyword: spec.text.keyword, data: spec.editorialData?.value ?? null,
        choices: choiceIds(recovery[i]),
        beforeIdentitySha256: crypto.createHash('sha256').update(
          bundle.sceneSpecPixelIdentityAny(baseline[i].resolved.compiled.sceneSpec)).digest('hex'),
        afterIdentitySha256: crypto.createHash('sha256').update(bundle.sceneSpecPixelIdentityAny(spec)).digest('hex') })
    }
    if (process.env.CIPHER_RECOVERY_PREFLIGHT === '1') {
      console.log('VISUAL_RECOVERY_PREFLIGHT_OK', JSON.stringify(records.map(row => [row.id, row.family, row.look, row.keyword])))
      completed = true; await finish(0); return
    }
    for (let i = 0; i < 8; i++) records[i].beforeV = await render(baseline[i], `${corpus[i].id}-before-v`, 540, 960)
    for (let i = 0; i < 20; i++) records[i].afterV = await render(recovery[i], `${corpus[i].id}-after-v`, 540, 960)
    for (let i = 0; i < 20; i++) records[i].afterH = await render(recovery[i], `${corpus[i].id}-after-h`, 960, 540)
    join(records.slice(0, 12).map(row => row.afterV.clip), path.join(output, 'visual-recovery-12-vertical.mp4'))
    join(records.slice(0, 12).map(row => row.afterH.clip), path.join(output, 'visual-recovery-12-horizontal.mp4'))
    html(records)
    const evidence = { source: 'controlled-synthetic-12-plus-8', fps, blockedNetwork: blocked,
      scale: process.env.CIPHER_RECOVERY_SCALE ?? '1', records: records.map(row => ({ ...row,
        beforeV: row.beforeV ? { ...row.beforeV, clip: undefined, frame: undefined } : undefined,
        afterV: { ...row.afterV, clip: undefined, frame: undefined },
        afterH: { ...row.afterH, clip: undefined, frame: undefined } })) }
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2))
    console.log('VISUAL_RECOVERY_ACCEPTANCE_OK', JSON.stringify({ scenes: records.length, fps, blocked }))
    completed = true; await finish(0)
  } catch (error) { console.error(error); completed = true; await finish(1) }
}).catch(async error => { console.error(error); completed = true; await finish(1) })
