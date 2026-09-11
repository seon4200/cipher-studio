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
const FIXTURE_ROOT = createTestFixture('v15-color-system-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const BEFORE_17 = path.join(OUTPUT, 'black-checkpoint-baseline.png')
const ARTIFACTS = {
  contactSheet: path.join(OUTPUT, 'contact-sheet-17-before-after.png'),
  after17: path.join(OUTPUT, 'contact-sheet-17-vivid.png'),
  singleTheme: path.join(OUTPUT, 'single-theme-technology.png'),
  multiTheme: path.join(OUTPUT, 'multi-theme-selection.png'),
  evidence: path.join(OUTPUT, 'evidence.json'),
}
const WIDTH = 540
const HEIGHT = 960
let bundle = null
let finished = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
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
  return JSON.stringify(rows.sort((left, right) => left[0].localeCompare(right[0])))
}

function sanitizeLabel (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _|/.+%#=-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function frameFromVideo (video, output, seek = .55) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seek), '-i', video,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:${HEIGHT}`, output], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function labelFrame (input, output, lines) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const width = 360
  const height = 640
  const header = 118
  const filters = [`scale=${width}:${height}`, `pad=${width}:${height + header}:0:${header}:black`]
  lines.slice(0, 5).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${sanitizeLabel(line).slice(0, 66)}':fontcolor=white:fontsize=12:x=9:y=${7 + index * 22}`))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', filters.join(','), '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function makeSheet (frames, output, columns) {
  const cellWidth = 360
  const cellHeight = 758
  const layout = frames.map((_, index) => `${(index % columns) * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...frames.flatMap(file => ['-i', file]),
    '-filter_complex', `xstack=inputs=${frames.length}:layout=${layout}:fill=black`, '-frames:v', '1', output],
  { stdio: 'pipe', maxBuffer: 256 * 1024 * 1024 })
}

function makeComparison (before, after, output) {
  const beforeSize = nativeImage.createFromPath(before).getSize()
  const afterSize = nativeImage.createFromPath(after).getSize()
  const targetWidth = Math.max(beforeSize.width, afterSize.width)
  const targetHeight = Math.max(beforeSize.height, afterSize.height)
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const filter = `[0:v]pad=${targetWidth}:${targetHeight + 58}:0:58:black,drawtext=fontfile='${font}':text='ANTES  BLACK CHECKPOINT':` +
    `fontcolor=white:fontsize=28:x=24:y=13[l];[1:v]pad=${targetWidth}:${targetHeight + 58}:0:58:black,drawtext=fontfile='${font}':` +
    `text='DESPUES  VIVID THEMATIC ACCENTS':fontcolor=white:fontsize=28:x=24:y=13[r];[l][r]hstack=inputs=2`
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', before, '-i', after,
    '-filter_complex', filter, '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 256 * 1024 * 1024 })
}

function publishAssets () {
  return ['26bd', '1f3df', '1f389', '1f680', '1f30e', '1f477', '1f3d7', '1f4d3']
    .map(id => bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:' + id }).asset)
}

function descriptor (slotId, asset) {
  return { slotId, asset, mime: asset.mime, treatment: 'original-color' }
}

function descriptorsForFamily (family, index, assets) {
  if (family === 'editorial') return []
  const rule = bundle.LAYOUT_ELIGIBILITY_V4[family]
  const desired = rule.minSupports === rule.maxSupports ? rule.minSupports :
    Math.max(rule.minSupports, Math.min(rule.maxSupports, index % 3))
  const descriptors = [0, 1, 2].slice(0, desired + 1)
    .map(offset => descriptor(offset === 0 ? 'hero' : `support-${offset}`, assets[(index + offset) % assets.length]))
  if (family === 'mundoIsometrico' && descriptors.length === 3)
    descriptors[2] = { slotId: 'support-2', solarIcon: 'wallet-bold-duotone', solarStyle: 'bold-duotone' }
  return descriptors
}

function materializeColor (terms, sceneId, sceneIndex, recent = []) {
  const selection = bundle.selectVideoColorPalettePlanV1({ terms, seed: 16001 })
  const color = bundle.materializeSceneColorPaletteV1({ plan: selection.plan, sceneId, sceneIndex, terms,
    recentAccentPrimaries: recent })
  return { selection, color }
}

async function renderSpec (name, spec, descriptors) {
  let report = null
  const clip = await bundle.renderGraphicClip(graphicForV15(spec), {
    ancho: WIDTH, alto: HEIGHT, fps: 6, duracion: 1, modo: 'pantalla', sistema: 'editorial',
    projectRoot: PROJECT_ROOT, renderBindings: bindingsForV15(descriptors),
    onQcReport: value => { report = value }, onQcFailure: value => { report = value },
  })
  if (!clip || !fs.existsSync(clip)) {
    const errors = (report?.findings || []).filter(value => value.level === 'error').map(value => value.code)
    throw new Error(`COLOR_ACCEPTANCE_RENDER_REJECTED:${name}:${errors.join(',')}`)
  }
  const frame = path.join(FRAME_ROOT, name + '.png')
  frameFromVideo(clip, frame)
  return { frame, report }
}

async function renderRow (name, spec, descriptors, lines) {
  const rendered = await renderSpec(name, spec, descriptors)
  const labelled = path.join(FRAME_ROOT, 'labelled-' + name + '.png')
  labelFrame(rendered.frame, labelled, lines)
  return { labelled, rendered }
}

function maxStreak (values) {
  let maximum = 0; let current = 0; let previous = null
  for (const value of values) {
    current = value === previous ? current + 1 : 1
    previous = value
    maximum = Math.max(maximum, current)
  }
  return maximum
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
  const block = () => { networkAttempts++; throw new Error('COLOR_ACCEPTANCE_NETWORK_FORBIDDEN') }
  global.fetch = block; http.request = block; https.request = block
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
  })
  try {
    fs.mkdirSync(FRAME_ROOT, { recursive: true })
    bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    await new Promise(resolve => setTimeout(resolve, 700))
    const startupNetworkBaseline = networkAttempts
    if (bundle.VERSION_PLANTILLAS !== 15) throw new Error('VERSION_PLANTILLAS_NOT_15')
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'v15-color-acceptance', clips: [], timelineVideoClips: [], aiScript: 'fixture temporal' })
    const assets = publishAssets()

    const themeGroups = [
      { theme: 'technology', terms: ['artificial intelligence', 'software', 'data'] },
      { theme: 'nature', terms: ['nature', 'forest', 'water'] },
      { theme: 'alert-conflict', terms: ['danger', 'conflict', 'warning'] },
      { theme: 'creative', terms: ['creative', 'music', 'culture'] },
      { theme: 'industrial', terms: ['industry', 'construction', 'engineering'] },
      { theme: 'education', terms: ['education', 'book', 'learning'] },
    ]
    const familyFrames = []
    const familyRows = []
    for (let index = 0; index < bundle.MODERN_LAYOUT_STRUCTURES_V4.length; index++) {
      const family = bundle.MODERN_LAYOUT_STRUCTURES_V4[index]
      const group = themeGroups[Math.floor(index / 3) % themeGroups.length]
      const { selection, color } = materializeColor(group.terms, `color-family-${family}`, index % 3)
      const descriptors = descriptorsForFamily(family, index, assets)
      const spec = sceneSpecV15(bundle, descriptors, {
        visualMode: family === 'editorial' ? 'editorial-text' : 'asset-led', family,
        keyword: family === 'editorial' ? 'CONTEXTO' : family.toUpperCase(), connector: null, closing: null,
        sceneId: `color-family-${family}`, seed: 16100 + index, backgroundProfileId: 'solid-black-v1',
        colorPalette: color, typographyLookId: bundle.TYPOGRAPHY_LOOK_IDS_V3[index % bundle.TYPOGRAPHY_LOOK_IDS_V3.length],
      })
      const result = await renderRow(`family-${family}`, spec, descriptors, [
        `${family} | ${group.theme} | QC PASS`,
        `${color.family} | ${color.variant}`,
        `${color.tokens.accentPrimary} + ${color.tokens.accentSecondary}`,
        `${spec.layout.textRegion} | ${spec.text.typographyLookId}`,
        `video ${selection.plan.primaryFamily} + ${selection.plan.compatibleFamilies.join('+')}`,
      ])
      familyFrames.push(result.labelled)
      familyRows.push({ family, theme: selection.theme, videoPlan: selection.plan, sceneColor: color,
        activeSlots: spec.slots.filter(slot => slot.state === 'present' || slot.state === 'procedural')
          .map(slot => ({ role: slot.role, state: slot.state, treatment: slot.tint.treatment })),
        qcErrors: (result.rendered.report?.findings || []).filter(value => value.level === 'error').map(value => value.code) })
    }
    if (new Set(familyRows.map(row => row.sceneColor.family)).size !== 9) throw new Error('ALL_NINE_PALETTES_NOT_VISIBLE')
    makeSheet(familyFrames, ARTIFACTS.after17, 5)
    makeComparison(BEFORE_17, ARTIFACTS.after17, ARTIFACTS.contactSheet)

    const technologyTerms = [
      ['artificial intelligence', 'software', 'data'], ['robot', 'automation', 'computer'],
      ['internet', 'network', 'mobile phone'], ['algorithm', 'data', 'server'],
      ['computer', 'software', 'digital'], ['artificial intelligence', 'robot', 'network'],
      ['cloud', 'data', 'internet'], ['technology', 'computer', 'automation'],
    ]
    const technologySelection = bundle.selectVideoColorPalettePlanV1({ terms: technologyTerms.flat(), seed: 16200 })
    const technologyRecent = []
    const technologyFrames = []
    const technologyRows = []
    const technologyFamilies = ['marcoPoster', 'partidoVertical', 'cintaDiagonal', 'anillosConcentricos',
      'rayosImpacto', 'cuaderno', 'capasApiladas', 'redNodos']
    for (let index = 0; index < technologyFamilies.length; index++) {
      const family = technologyFamilies[index]
      const descriptors = descriptorsForFamily(family, index + 2, assets)
      const color = bundle.materializeSceneColorPaletteV1({ plan: technologySelection.plan,
        sceneId: `technology-${index}`, sceneIndex: index, terms: technologyTerms[index],
        recentAccentPrimaries: technologyRecent })
      technologyRecent.push(color.tokens.accentPrimary)
      const spec = sceneSpecV15(bundle, descriptors, { family, keyword: ['IA', 'ROBOTS', 'REDES', 'DATOS', 'SOFTWARE', 'FUTURO', 'NUBE', 'AUTOMATIZAR'][index],
        connector: null, closing: null, sceneId: `technology-${index}`, seed: 16200 + index,
        backgroundProfileId: 'solid-black-v1', colorPalette: color })
      const result = await renderRow(`technology-${index}`, spec, descriptors, [
        `AI VIDEO ${index + 1}/8 | ${family} | QC PASS`, `${color.family} | ${color.variant}`,
        `${color.tokens.accentPrimary} | black #0D0D0F`, `OpenMoji original-color | ${descriptors.length} assets`,
        `plan ${technologySelection.plan.primaryFamily} + ${technologySelection.plan.compatibleFamilies.join('+')}`,
      ])
      technologyFrames.push(result.labelled)
      technologyRows.push({ family, color, keyword: spec.text.keyword, assets: descriptors.length })
    }
    makeSheet(technologyFrames, ARTIFACTS.singleTheme, 4)

    const multiDefinitions = [
      { label: 'TECHNOLOGY', terms: ['software', 'AI', 'data'], keyword: 'TECNOLOGÍA', family: 'marcoPoster' },
      { label: 'NATURE', terms: ['forest', 'water', 'growth'], keyword: 'NATURALEZA', family: 'anillosConcentricos' },
      { label: 'SPACE', terms: ['astronaut', 'planet', 'galaxy'], keyword: 'ESPACIO', family: 'rayosImpacto' },
      { label: 'ALERT / CONFLICT', terms: ['conflict', 'danger', 'emergency'], keyword: 'ALERTA', family: 'cintaDiagonal' },
      { label: 'CREATIVE', terms: ['creative', 'music', 'culture'], keyword: 'CREAR', family: 'cuaderno' },
      { label: 'EDUCATION', terms: ['education', 'book', 'learning'], keyword: 'APRENDER', family: 'partidoVertical' },
    ]
    const multiFrames = []
    const multiRows = []
    for (let index = 0; index < multiDefinitions.length; index++) {
      const row = multiDefinitions[index]
      const descriptors = descriptorsForFamily(row.family, index + 5, assets)
      const { selection, color } = materializeColor(row.terms, `theme-${row.label}`, 0)
      const spec = sceneSpecV15(bundle, descriptors, { family: row.family, keyword: row.keyword, connector: null,
        closing: null, sceneId: `theme-${row.label}`, seed: 16300 + index,
        backgroundProfileId: 'solid-black-v1', colorPalette: color })
      const result = await renderRow(`theme-${index}`, spec, descriptors, [
        `${row.label} | selected ${selection.theme}`, `video primary ${selection.plan.primaryFamily}`,
        `compatible ${selection.plan.compatibleFamilies.join(' + ')}`, `scene ${color.family} | ${color.variant}`,
        `${color.tokens.accentPrimary} | black #0D0D0F`,
      ])
      multiFrames.push(result.labelled)
      multiRows.push({ label: row.label, selectedTheme: selection.theme, plan: selection.plan, sceneColor: color })
    }
    makeSheet(multiFrames, ARTIFACTS.multiTheme, 3)

    const allSlots = [...familyRows.flatMap(row => row.activeSlots)]
    const evidence = {
      schemaVersion: 1,
      versionPlantillas: bundle.VERSION_PLANTILLAS,
      backgroundProfile: bundle.materializeBackgroundProfileV1('solid-black-v1'),
      paletteFamilies: bundle.COLOR_PALETTE_FAMILY_IDS_V1,
      familyCoverage: { rendered: familyRows.length, total: 17, palettesVisible: new Set(familyRows.map(row => row.sceneColor.family)).size,
        rows: familyRows },
      singleTheme: { theme: technologySelection.theme, plan: technologySelection.plan, rows: technologyRows,
        distinctAccents: new Set(technologyRecent).size, maxIdenticalAccentStreak: maxStreak(technologyRecent) },
      multiTheme: multiRows,
      openMojiOriginalColor: allSlots.filter(slot => slot.state === 'present').every(slot => slot.treatment === 'original-color'),
      solarSystemTint: allSlots.filter(slot => slot.state === 'procedural').every(slot => slot.treatment === 'system-tint'),
      rendererOffline: true,
      realProjectsUntouched: snapshotRealProjects() === projectsBefore,
      artifacts: Object.fromEntries(Object.entries(ARTIFACTS).map(([key, file]) => [key, path.basename(file)])),
    }
    if (!evidence.openMojiOriginalColor || !evidence.solarSystemTint || !evidence.realProjectsUntouched)
      throw new Error('COLOR_ACCEPTANCE_INVARIANT_FAILED')
    if (networkAttempts !== startupNetworkBaseline) throw new Error('NETWORK_USED_DURING_COLOR_ACCEPTANCE')
    fs.writeFileSync(ARTIFACTS.evidence, JSON.stringify(evidence, null, 2) + '\n')
    console.log('COLOR_SYSTEM_EVIDENCE=' + JSON.stringify({
      families: `${familyRows.length}/17`, palettesVisible: evidence.familyCoverage.palettesVisible,
      technologyPlan: technologySelection.plan, distinctAccents: evidence.singleTheme.distinctAccents,
      maxIdenticalAccentStreak: evidence.singleTheme.maxIdenticalAccentStreak,
      openMojiOriginalColor: evidence.openMojiOriginalColor, solarSystemTint: evidence.solarSystemTint,
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
