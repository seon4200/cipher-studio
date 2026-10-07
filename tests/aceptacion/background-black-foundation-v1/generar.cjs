const { app, nativeImage, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const { sceneSpecV15, graphicForV15, bindingsForV15 } = require('../../helpers/motion-graphics-v15-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const FIXTURE_ROOT = createTestFixture('background-black-foundation-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const BASELINE = path.join(OUTPUT, 'historical-v15-baseline.png')
const ARTIFACTS = {
  contactSheet: path.join(OUTPUT, 'contact-sheet-black-foundation.png'),
  historicalCurrent: path.join(OUTPUT, 'historical-v15-current.png'),
  evidence: path.join(OUTPUT, 'evidence.json'),
}
const WIDTH = 540
const HEIGHT = 960
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let bundle = null
let finished = false
let networkAttempts = 0

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

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
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(fs.readFileSync(target)), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function sanitizeLabel (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _|/.+%=-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function frameFromVideo (video, output, seek = 0.55) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seek), '-i', video,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:${HEIGHT}`, output], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function labelFrame (input, output, lines) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const width = 360
  const height = 640
  const header = 104
  const filters = [`scale=${width}:${height}`, `pad=${width}:${height + header}:0:${header}:black`]
  lines.slice(0, 4).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${sanitizeLabel(line).slice(0, 64)}':fontcolor=white:fontsize=13:x=9:y=${7 + index * 23}`))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', filters.join(','), '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function makeSheet (frames, output) {
  const columns = 5
  const cellWidth = 360
  const cellHeight = 744
  const layout = frames.map((_, index) => `${(index % columns) * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...frames.flatMap(file => ['-i', file]),
    '-filter_complex', `xstack=inputs=${frames.length}:layout=${layout}:fill=black`, '-frames:v', '1', output],
  { stdio: 'pipe', maxBuffer: 192 * 1024 * 1024 })
}

function compareImages (leftFile, rightFile) {
  const leftImage = nativeImage.createFromPath(leftFile)
  const rightImage = nativeImage.createFromPath(rightFile)
  const leftSize = leftImage.getSize()
  const rightSize = rightImage.getSize()
  if (leftSize.width !== rightSize.width || leftSize.height !== rightSize.height)
    return { sameDimensions: false, differentPixels: null }
  const left = leftImage.toBitmap()
  const right = rightImage.toBitmap()
  let differentPixels = 0
  for (let offset = 0; offset < left.length; offset += 4) {
    if (left[offset] !== right[offset] || left[offset + 1] !== right[offset + 1] || left[offset + 2] !== right[offset + 2])
      differentPixels++
  }
  return { sameDimensions: true, differentPixels }
}

function publishAssets () {
  const ids = ['26bd', '1f3df', '1f389', '1f680', '1f30e', '1f477', '1f3d7', '1f4d3']
  return ids.map(id => bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:' + id }).asset)
}

function assetDescriptor (slotId, asset) {
  return { slotId, asset, mime: asset.mime, treatment: 'original-color' }
}

function descriptorsForFamily (family, index, assets) {
  if (family === 'editorial') return []
  const rule = bundle.LAYOUT_ELIGIBILITY_V4[family]
  const optionalPattern = [0, 1, 2]
  const desired = rule.minSupports === rule.maxSupports
    ? rule.minSupports
    : Math.max(rule.minSupports, Math.min(rule.maxSupports, optionalPattern[index % optionalPattern.length]))
  const selected = [0, 1, 2].slice(0, desired + 1).map(offset => assets[(index + offset) % assets.length])
  const descriptors = selected.map((asset, slotIndex) => assetDescriptor(slotIndex === 0 ? 'hero' : `support-${slotIndex}`, asset))
  if (family === 'mundoIsometrico' && descriptors.length === 3) {
    descriptors[2] = { slotId: 'support-2', solarIcon: 'wallet-bold-duotone', solarStyle: 'bold-duotone' }
  }
  return descriptors
}

async function renderSpec (name, spec, descriptors, fps = 6) {
  let report = null
  const started = performance.now()
  const clip = await bundle.renderGraphicClip(graphicForV15(spec), {
    ancho: WIDTH, alto: HEIGHT, fps, duracion: 1, modo: 'pantalla', sistema: 'editorial',
    projectRoot: PROJECT_ROOT, renderBindings: bindingsForV15(descriptors),
    onQcReport: value => { report = value }, onQcFailure: value => { report = value },
  })
  const elapsedMs = performance.now() - started
  if (!clip || !fs.existsSync(clip)) {
    const errors = (report?.findings || []).filter(value => value.level === 'error').map(value => value.code)
    throw new Error(`BLACK_FOUNDATION_RENDER_REJECTED:${name}:${errors.join(',')}`)
  }
  const frame = path.join(FRAME_ROOT, name + '.png')
  frameFromVideo(clip, frame)
  return { clip, frame, elapsedMs, report }
}

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

app.whenReady().then(async () => {
  const projectsBefore = snapshotRealProjects()
  const block = () => { networkAttempts++; throw new Error('BLACK_FOUNDATION_ACCEPTANCE_NETWORK_FORBIDDEN') }
  global.fetch = block
  http.request = block
  https.request = block
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
  })
  try {
    fs.mkdirSync(FRAME_ROOT, { recursive: true })
    bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    await new Promise(resolve => setTimeout(resolve, 700))
    const startupNetworkBaseline = networkAttempts
    if (bundle.VERSION_PLANTILLAS !== 15) throw new Error('VERSION_PLANTILLAS_NOT_15')
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'black-foundation-acceptance', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })
    const assets = publishAssets()
    const frames = []
    const familyRows = []
    for (let index = 0; index < bundle.MODERN_LAYOUT_STRUCTURES_V4.length; index++) {
      const family = bundle.MODERN_LAYOUT_STRUCTURES_V4[index]
      const descriptors = descriptorsForFamily(family, index, assets)
      const spec = sceneSpecV15(bundle, descriptors, {
        visualMode: family === 'editorial' ? 'editorial-text' : 'asset-led', family,
        keyword: family === 'editorial' ? 'CONTEXTO' : family.toUpperCase(),
        connector: family === 'editorial' ? 'una idea' : null,
        closing: family === 'editorial' ? 'sin recurso forzado' : null,
        sceneId: 'black-family-' + family, seed: 91800 + index,
        backgroundProfileId: 'solid-black-v1', typographyLookId: bundle.TYPOGRAPHY_LOOK_IDS_V3[index % bundle.TYPOGRAPHY_LOOK_IDS_V3.length],
      })
      const rendered = await renderSpec('family-' + family, spec, descriptors)
      const labelled = path.join(FRAME_ROOT, 'labelled-' + family + '.png')
      const active = spec.slots.filter(slot => slot.state === 'present' || slot.state === 'procedural')
      const treatments = active.map(slot => slot.tint.treatment).join('+') || 'none'
      labelFrame(rendered.frame, labelled, [
        `${family} | solid-black-v1 | QC PASS`,
        `${active.map(slot => slot.role).join('+') || 'editorial'} | ${treatments}`,
        `${spec.layout.textRegion} | ${spec.text.typographyLookId}`,
        `Hero ${active[0]?.motion.entry.preset || 'none'} / ${active[0]?.motion.sustain.preset || 'none'} | bg ${spec.videoStyle.backgroundMotion}`,
      ])
      frames.push(labelled)
      familyRows.push({ family, visualMode: spec.visualMode, activeSlots: active.map(slot => ({ role: slot.role,
        state: slot.state, treatment: slot.tint.treatment })), backgroundProfile: spec.backgroundProfile,
        backgroundMotion: spec.videoStyle.backgroundMotion, textRegion: spec.layout.textRegion,
        typographyLookId: spec.text.typographyLookId,
        qcErrors: (rendered.report?.findings || []).filter(value => value.level === 'error').map(value => value.code) })
    }
    makeSheet(frames, ARTIFACTS.contactSheet)

    const historicalDescriptors = [assetDescriptor('hero', assets[0]), assetDescriptor('support-1', assets[1])]
    const historicalSpec = sceneSpecV15(bundle, historicalDescriptors, {
      family: 'partidoVertical', keyword: 'FÚTBOL', connector: 'el', closing: 'une al estadio',
      sceneId: 'historical-v15-black-foundation-control', seed: 91515, typographyLookId: 'sport-condensed',
    })
    if (Object.prototype.hasOwnProperty.call(historicalSpec, 'backgroundProfile')) throw new Error('HISTORICAL_PROFILE_PRESENT')
    const historical = await renderSpec('historical-v15-current', historicalSpec, historicalDescriptors, 8)
    fs.copyFileSync(historical.frame, ARTIFACTS.historicalCurrent)
    const compatibility = compareImages(BASELINE, ARTIFACTS.historicalCurrent)
    if (!compatibility.sameDimensions || compatibility.differentPixels !== 0)
      throw new Error('HISTORICAL_V15_PIXEL_DIFF:' + JSON.stringify(compatibility))
    if (snapshotRealProjects() !== projectsBefore) throw new Error('REAL_PROJECTS_CHANGED')
    if (networkAttempts !== startupNetworkBaseline) throw new Error('NETWORK_USED_DURING_ACCEPTANCE')

    const evidence = {
      schemaVersion: 1,
      baseHead: 'a9542545d17b4ebd29724a71e7a50be08ed48d25',
      versionPlantillas: bundle.VERSION_PLANTILLAS,
      backgroundProfile: bundle.materializeBackgroundProfileV1('solid-black-v1'),
      definition: bundle.BACKGROUND_PROFILES_V1['solid-black-v1'],
      historicalCompatibility: compatibility,
      families: { rendered: familyRows.length, total: 17, rows: familyRows },
      slots: {
        heroOnly: familyRows.filter(row => row.activeSlots.length === 1).length,
        heroSupport: familyRows.filter(row => row.activeSlots.length === 2).length,
        heroTwoSupports: familyRows.filter(row => row.activeSlots.length === 3).length,
      },
      originalColorOpenMoji: familyRows.flatMap(row => row.activeSlots)
        .filter(slot => slot.state === 'present').every(slot => slot.treatment === 'original-color'),
      rendererOffline: true,
      realProjectsUntouched: true,
      artifacts: Object.fromEntries(Object.entries(ARTIFACTS).map(([key, file]) => [key, path.basename(file)])),
    }
    fs.writeFileSync(ARTIFACTS.evidence, JSON.stringify(evidence, null, 2) + '\n')
    console.log('BLACK_FOUNDATION_EVIDENCE=' + JSON.stringify({
      families: `${familyRows.length}/17`, historicalPixelDiff: compatibility.differentPixels,
      profile: evidence.backgroundProfile.id, originalColorOpenMoji: evidence.originalColorOpenMoji,
      slots: evidence.slots,
    }))
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
