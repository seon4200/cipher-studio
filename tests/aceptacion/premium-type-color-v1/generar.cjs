// Controlled synthetic corpus; captured provider replies, no real user project or network.
const { app, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { execFileSync } = require('child_process')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const corpus = require('../../fixtures/visual-recovery-corpus-v1').slice(0, 12)
const extra = require('../../fixtures/visual-recovery-corpus-v1').slice(12, 16)
const rows = [...corpus, ...extra]
const root = path.resolve(__dirname, '../../..')
const output = path.join(root, '..', '_premium-type-color-evidence')
const fixture = createTestFixture('premium-evidence')
const project = path.join(fixture, 'project')
const work = path.join(fixture, 'clips')
const source = path.join(root, '..', '_spike-runtime', 'photo-cutout-v1', 'runs',
  '2026-09-11-06-18-11-623', 'raw')
const photos = { camera: path.join(source, 'complex-object.jpg'), woman: path.join(source, 'person-mid.jpg'),
  protest: path.join(source, 'busy-scene.jpg') }
const nativeFetch = global.fetch; const nativeHttp = http.request; const nativeHttps = https.request
let bundle, finished = false, blocked = 0
const fps = 24
const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args],
  { stdio: 'pipe', maxBuffer: 128 * 1024 * 1024 })
const words = text => text.split(/\s+/u).filter(Boolean).map((word, i, list) => ({ word,
  start: 10 + i * 2.6 / list.length, end: 10 + (i + .85) * 2.6 / list.length }))
function context (row, i) {
  const semantic = bundle.createLocalSceneSemanticV1({ sceneId: row.id, start: 10, end: 12.6,
    transcriptSegments: [{ start: 9.8, end: 12.8, text: row.text, words: words(row.text) }],
    concepts: row.concepts.map(c => ({ ...c, start: 10.05, end: 12.45, scope: 'scene' })),
    anchor: row.concepts[0]?.label, relation: row.relation, globalText: row.text,
    globalHints: [], globalContextRef: `synthetic:premium:${row.id}` })
  return bundle.createModernVisualGenerationContextV2({ sceneId: row.id, duration: row.duration,
    localSemantic: semantic, keywordCandidates: [{ keyword: row.keyword, source: 'scene-semantic' }],
    preferredVisualMode: row.preferredVisualMode ?? 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: 260900 + i }, videoStyleId: 'cream-editorial' })
}
function search (url) {
  const q = String(url.searchParams.get('q') ?? '').toLowerCase()
  const hits = /camera|c[aá]mara/u.test(q) ? [{ id: 1362419, pageURL: 'https://pixabay.com/photos/camera/',
    largeImageURL: 'https://cdn.pixabay.com/camera-1362419.jpg', tags: 'camera, digital camera, photography',
    imageWidth: 1280, imageHeight: 848, type: 'photo' }]
    : /woman|mujer|person|persona/u.test(q) ? [{ id: 1064658,
      pageURL: 'https://pixabay.com/photos/young-woman/',
      largeImageURL: 'https://cdn.pixabay.com/woman-1064658.jpg',
      tags: 'woman, person, portrait, young woman, computer', imageWidth: 1280,
      imageHeight: 907, type: 'photo' }]
      : /protest|demonstration|rally|manifestaci[oó]n/u.test(q) ? [{ id: 4130710,
        pageURL: 'https://pixabay.com/photos/protest/',
        largeImageURL: 'https://cdn.pixabay.com/protest-4130710.jpg',
        tags: 'protest, demonstration, rally, meeting, people, crowd',
        imageWidth: 1280, imageHeight: 720, type: 'photo' }] : []
  return Promise.resolve({ hits })
}
function bytes (url) {
  const key = String(url)
  if (key.includes('1362419')) return Promise.resolve(fs.readFileSync(photos.camera))
  if (key.includes('1064658')) return Promise.resolve(fs.readFileSync(photos.woman))
  if (key.includes('4130710')) return Promise.resolve(fs.readFileSync(photos.protest))
  throw Error('UNRECORDED_DOWNLOAD')
}
const choice = row => row.resolved.choices.map(c => [c.slotId, c.asset?.sha256 ?? c.solarIcon])
async function render (row, label, width, height) {
  let qc; const start = performance.now()
  const file = await bundle.renderGraphicClip(row.resolved.compiled.graphicData, {
    ancho: width, alto: height, fps, duracion: row.context.duration, modo: 'pantalla',
    sistema: 'editorial', projectRoot: project, renderBindings: row.resolved.compiled.renderBindings,
    onQcReport: value => { qc = value }, onQcFailure: value => { qc = value },
  })
  assert(file && fs.existsSync(file), `${label}: ${JSON.stringify(qc?.findings ?? [])}:` +
    JSON.stringify(qc?.snapshots?.map(x => ({ at: x.normalizedTime, textContrast: x.textContrast,
      localContrast: x.localContrast, textFitStage: x.textFitStage })) ?? []))
  // An identical SceneSpec may reuse the byte-verified render cache, which does not
  // emit a fresh QC callback. The first render in this corpus already passed QC.
  if (qc) {
    assert.equal(qc.findings.filter(x => x.level === 'error').length, 0, label)
    assert(qc.snapshots.every(x => !x.textOverflow && !x.keywordOverflow && !x.textFitFailed), label)
  }
  const clip = path.join(work, `${label}.mp4`)
  fs.copyFileSync(file, clip)
  const frame = path.join(output, 'frames', `${label}.png`)
  ffmpeg(['-ss', String(row.context.duration * .58), '-i', clip, '-frames:v', '1', frame])
  return { clip, frame, msPerFrame: (performance.now() - start) / (row.context.duration * fps),
    findings: qc?.findings.length ?? null, cacheHit: !qc }
}
function join (files, name) {
  ffmpeg([...files.flatMap(file => ['-i', file]), '-filter_complex',
    `${files.map((_, i) => `[${i}:v]`).join('')}concat=n=${files.length}:v=1:a=0,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-movflags', '+faststart', path.join(output, name)])
}
function sheet (items, name) {
  const frames = items.map(x => x.frame)
  if (frames.length === 1) {
    ffmpeg(['-i', frames[0], '-vf', 'scale=540:960:force_original_aspect_ratio=decrease,format=rgba',
      '-frames:v', '1', path.join(output, name)])
    return
  }
  ffmpeg([...frames.flatMap(file => ['-i', file]), '-filter_complex',
    `${frames.map((_, i) => `[${i}:v]scale=320:568:force_original_aspect_ratio=decrease,` +
      `pad=320:568:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`).join(';')};` +
      `${frames.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${frames.length}[out]`,
    '-map', '[out]', '-frames:v', '1', path.join(output, name)])
}
async function finish (code) {
  global.fetch = nativeFetch; http.request = nativeHttp; https.request = nativeHttps
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(fixture)); cleanupTestFixture(fixture) } catch (err) {
    console.error('Fixture retained', err.message)
  }
  app.exit(code)
}
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.setPath('userData', path.join(fixture, 'user-data'))
process.chdir(fixture)
process.once('exit', () => { if (!finished) process.exitCode = 1 })
app.whenReady().then(async () => {
  try {
    const deny = () => { blocked++; throw Error('NETWORK_BLOCKED') }
    global.fetch = deny; http.request = deny; https.request = deny
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) blocked++
      callback({ cancel: /^https?:/i.test(details.url) })
    })
    bundle = require(path.join(root, 'dist-electron', 'main', 'index.js'))
    for (const file of Object.values(photos)) assert(fs.existsSync(file), `Missing source: ${file}`)
    fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(path.join(output, 'frames'), { recursive: true })
    bundle.createProjectFiles(project, { id: 'premium-acceptance-temp', clips: [],
      timelineVideoClips: [], aiScript: 'controlled synthetic corpus' })
    const hooks = { searchRequestJson: search, downloadRequestBytes: bytes }
    const inputs = rows.map(context)
    const recovery = await bundle.resolveModernVisualGenerationBatchV2({ contexts: inputs,
      projectRoot: project, pixabayApiKey: 'captured-offline-response', hooks })
    const old = await bundle.resolveModernVisualGenerationBatchV2({ contexts: recovery.map(row => ({
      ...row.context, presentationProfile: bundle.VISUAL_RECOVERY_PROFILE_V1 })), projectRoot: project, hooks })
    const premium = await bundle.resolveModernVisualGenerationBatchV2({ contexts: recovery.map(row => ({
      ...row.context, presentationProfile: bundle.PREMIUM_TYPE_COLOR_PROFILE_V1 })), projectRoot: project, hooks })
    const variantOnly = process.env.CIPHER_PREMIUM_VARIANTS_ONLY === '1'
    const results = []
    for (let i = 0; i < rows.length; i++) {
      if (variantOnly) break
      assert.deepEqual(choice(old[i]), choice(premium[i]), `asset lock ${rows[i].id}`)
      const spec = premium[i].resolved.compiled.sceneSpec
      assert.deepEqual(old[i].resolved.compiled.sceneSpec.slots, spec.slots, `roles ${rows[i].id}`)
      const result = { id: rows[i].id, text: rows[i].text, family: spec.layout.family,
        palette: spec.premiumStyle.porcelainPalette, theme: spec.premiumStyle.typographyTheme,
        treatment: spec.premiumStyle.keywordTreatment, assets: choice(premium[i]),
        beforeIdentity: crypto.createHash('sha256').update(bundle.sceneSpecPixelIdentityAny(old[i].resolved.compiled.sceneSpec)).digest('hex'),
        afterIdentity: crypto.createHash('sha256').update(bundle.sceneSpecPixelIdentityAny(spec)).digest('hex') }
      if (i < 8) result.before = await render(old[i], `${rows[i].id}-before-v`, 540, 960)
      result.vertical = await render(premium[i], `${rows[i].id}-premium-v`, 540, 960)
      result.horizontal = await render(premium[i], `${rows[i].id}-premium-h`, 960, 540)
      results.push(result)
      console.log('PREMIUM_SCENE', i + 1, rows[i].id, result.theme, result.palette)
    }
    if (!variantOnly) {
      join(results.slice(0, 12).map(r => r.vertical.clip), 'premium-12-vertical.mp4')
      join(results.slice(0, 12).map(r => r.horizontal.clip), 'premium-12-horizontal.mp4')
    }
    const styles = ['blue-tech', 'sunset-energy', 'magenta-creative', 'silver-industrial', 'green-nature']
    const variants = []
    for (const family of styles) {
      const signatureRow = family === 'green-nature'
        ? (await bundle.resolveModernVisualGenerationBatchV2({
          contexts: [context(require('../../fixtures/visual-recovery-corpus-v1')[19], 19)],
          projectRoot: project, hooks }))[0] : recovery[0]
      const plan = { version: 1, primaryFamily: family, compatibleFamilies: [], revision: recovery[0].context.colorPalettePlan.revision }
      for (const [index, sourceRow] of [signatureRow, family === 'green-nature' ? recovery[0] : recovery[5]].entries()) {
        const controlled = await bundle.resolveModernVisualGenerationBatchV2({ contexts: [{
          ...sourceRow.context, colorPalettePlan: plan, colorSceneIndex: index,
          lockedColorPalette: undefined, presentationProfile: bundle.PREMIUM_TYPE_COLOR_PROFILE_V1 }],
          projectRoot: project, hooks })
        assert.deepEqual(choice(controlled[0]), choice(sourceRow))
        const vertical = await render(controlled[0], `${family}-style-${index}-v`, 540, 960)
        const horizontal = await render(controlled[0], `${family}-style-${index}-h`, 960, 540)
        const spec = controlled[0].resolved.compiled.sceneSpec
        variants.push({ family, theme: spec.premiumStyle.typographyTheme,
          palette: spec.premiumStyle.porcelainPalette, frame: vertical.frame, vertical, horizontal })
      }
      sheet(variants.filter(x => x.family === family), `${variants.at(-1).theme}.png`)
    }
    join(variants.map(x => x.vertical.clip), 'premium-style-gallery-vertical.mp4')
    join(variants.map(x => x.horizontal.clip), 'premium-style-gallery-horizontal.mp4')
    for (const name of Object.keys(bundle.PORCELAIN_PALETTES)) {
      const items = variants.filter(x => x.palette === name)
      if (items.length) sheet(items, `porcelain-${name}.png`)
    }
    // A compact HTML gallery keeps full-sized A/B and stress frames accessible.
    const cards = results.map(r => `<section><h2>${r.id} · ${r.theme} · ${r.palette}</h2>` +
      [r.before, r.vertical, r.horizontal].filter(Boolean).map(item =>
        `<img src="frames/${path.basename(item.frame)}" alt="${r.id}">`).join('') + '</section>').join('')
    fs.writeFileSync(path.join(output, 'all-type-color-combinations.html'),
      '<!doctype html><meta charset="utf-8"><style>body{background:#17171b;color:#F4F2ED;font:16px sans-serif}' +
      'section{margin:30px 0}img{height:500px;max-width:30%;object-fit:contain;margin:8px;background:#0B0B0D}</style>' + cards)
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({ source: 'controlled-synthetic', fps,
      networkBlocked: blocked, results: results.map(r => ({ ...r, before: r.before && { msPerFrame: r.before.msPerFrame },
        vertical: { msPerFrame: r.vertical.msPerFrame }, horizontal: { msPerFrame: r.horizontal.msPerFrame } })),
      variants: variants.map(({ vertical, horizontal, ...v }) => ({ ...v,
        verticalMsPerFrame: vertical.msPerFrame, horizontalMsPerFrame: horizontal.msPerFrame })) }, null, 2))
    console.log('PREMIUM_ACCEPTANCE_OK', JSON.stringify({ main: 12, stress: extra.length, fps, output }))
    finished = true; await finish(0)
  } catch (error) { console.error(error); finished = true; await finish(1) }
}).catch(async error => { console.error(error); finished = true; await finish(1) })
