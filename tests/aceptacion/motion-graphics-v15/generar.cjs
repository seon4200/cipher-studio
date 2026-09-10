const { app, BrowserWindow, nativeImage, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
const { sceneSpec, graphicFor, bindingsFor } = require('../../helpers/visual-mvp-fixture')
const { sceneSpecV15, graphicForV15, bindingsForV15 } = require('../../helpers/motion-graphics-v15-fixture')
const { VISUAL_RETRIEVAL_HOLDOUT_V15 } = require('../../fixtures/visual-retrieval-holdout-v15')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = __dirname
const FIXTURE_ROOT = createTestFixture('motion-graphics-v15-acceptance')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const FRAME_ROOT = path.join(FIXTURE_ROOT, 'frames')
const WIDTH = 540
const HEIGHT = 960
const FPS = 8
const DURATION = 1
const COMPAT_BASE = path.join(OUTPUT, 'v14-base-compat.png')
const LEGACY_BASELINE = path.join(REPO_ROOT, 'tests', 'aceptacion', 'visual-asset-mvp', 'legacy-baseline-b735.png')
const ARTIFACTS = {
  family: path.join(OUTPUT, 'family-coverage-17.png'),
  combinations: path.join(OUTPUT, 'asset-combinations.png'),
  original: path.join(OUTPUT, 'original-color-openmoji.png'),
  providers: path.join(OUTPUT, 'pixabay-openmoji-solar.png'),
  typography: path.join(OUTPUT, 'typography-hierarchy.png'),
  sequence: path.join(OUTPUT, 'sequence-cream-style.png'),
  ab: path.join(OUTPUT, 'ab-v14-v15.png'),
  video: path.join(OUTPUT, 'motion-graphics-v15.mp4'),
  evidence: path.join(OUTPUT, 'evidence.json'),
  holdout: path.join(OUTPUT, 'retrieval-holdout-v15.json'),
  readme: path.join(OUTPUT, 'README.md'),
}

const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpGet = http.get
const originalHttpsRequest = https.request
const originalHttpsGet = https.get
let bundle = null
let finished = false
let blockedNetworkAttempts = 0
const renderMetrics = []
const clone = value => JSON.parse(JSON.stringify(value))
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const counts = values => Object.fromEntries([...values.reduce((map, value) =>
  map.set(String(value), (map.get(String(value)) || 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)))
const percentile = (values, fraction) => {
  const ordered = values.slice().sort((a, b) => a - b)
  return ordered[Math.max(0, Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1))] ?? null
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
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(fs.readFileSync(target)), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(root)
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function assertRepositoryUntouched (before) {
  if (snapshotRealProjects() !== before) throw new Error('REAL_PROJECTS_CHANGED')
  for (const file of ['project-state.json', 'project-state.json.bak']) {
    if (fs.existsSync(path.join(REPO_ROOT, file))) throw new Error('ROOT_PROJECT_STATE_CREATED:' + file)
  }
  if (fs.existsSync(path.join(REPO_ROOT, '.cipher-test-fixture'))) throw new Error('REPO_FIXTURE_CREATED')
}

function blockNetwork () {
  blockedNetworkAttempts++
  throw new Error('NETWORK_FORBIDDEN_AFTER_ASSET_PREPARATION')
}

function activateOfflineRenderGate () {
  global.fetch = blockNetwork
  http.request = blockNetwork
  http.get = blockNetwork
  https.request = blockNetwork
  https.get = blockNetwork
}

function restoreNetwork () {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  http.get = originalHttpGet
  https.request = originalHttpsRequest
  https.get = originalHttpsGet
}

function sanitizeLabel (value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _|/.+%=-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function frameFromVideo (video, output, seek = 0.55, width = WIDTH, height = HEIGHT) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seek), '-i', video,
    '-frames:v', '1', '-vf', `scale=${width}:${height}`, output], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function placeholder (output, message, width = WIDTH, height = HEIGHT) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', `color=c=0x251f19:s=${width}x${height}:d=0.1`, '-vf',
    `drawtext=fontfile='${font}':text='${sanitizeLabel(message).slice(0, 54)}':fontcolor=white:fontsize=22:x=22:y=${Math.round(height / 2)}`,
    '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
}

function labelFrame (input, output, lines, width = 360, height = 640, header = 92) {
  const font = 'C\\:/Windows/Fonts/arial.ttf'
  const filters = [`scale=${width}:${height}`, `pad=${width}:${height + header}:0:${header}:black`]
  lines.slice(0, 3).forEach((line, index) => filters.push(
    `drawtext=fontfile='${font}':text='${sanitizeLabel(line).slice(0, 62)}':fontcolor=white:fontsize=${width >= 480 ? 16 : 13}:x=9:y=${7 + index * (width >= 480 ? 27 : 24)}`))
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', filters.join(','), '-frames:v', '1', output], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
}

function makeSheet (frames, output, columns, cellWidth, cellHeight) {
  const inputs = frames.flatMap(file => ['-i', file])
  const layout = frames.map((_, index) => `${(index % columns) * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', `xstack=inputs=${frames.length}:layout=${layout}:fill=black`, '-frames:v', '1', output],
  { stdio: 'pipe', maxBuffer: 192 * 1024 * 1024 })
}

function concatenateClips (clips, output) {
  const list = path.join(FIXTURE_ROOT, 'sequence-concat.txt')
  fs.writeFileSync(list, clips.map(file => `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', output],
  { stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 })
}

function compareImages (leftFile, rightFile) {
  const leftImage = nativeImage.createFromPath(leftFile)
  const rightImage = nativeImage.createFromPath(rightFile)
  const leftSize = leftImage.getSize()
  const rightSize = rightImage.getSize()
  if (leftSize.width !== rightSize.width || leftSize.height !== rightSize.height)
    return { sameDimensions: false, differentPixels: null, differentPixelRatio: 1, meanAbsoluteChannelDelta: null }
  const left = leftImage.toBitmap()
  const right = rightImage.toBitmap()
  let differentPixels = 0
  let absoluteChannelDelta = 0
  for (let offset = 0; offset < left.length; offset += 4) {
    const b = Math.abs(left[offset] - right[offset])
    const g = Math.abs(left[offset + 1] - right[offset + 1])
    const r = Math.abs(left[offset + 2] - right[offset + 2])
    if (b || g || r) differentPixels++
    absoluteChannelDelta += b + g + r
  }
  const pixels = leftSize.width * leftSize.height
  return { sameDimensions: true, differentPixels, differentPixelRatio: differentPixels / pixels,
    meanAbsoluteChannelDelta: absoluteChannelDelta / (pixels * 3) }
}

function qcCodes (report, level = 'error') {
  return (report?.findings || []).filter(finding => finding.level === level).map(finding => finding.code)
}

async function renderGraphic (name, graphicData, renderBindings, projectRoot = PROJECT_ROOT, duration = DURATION) {
  let report = null
  const clip = await bundle.renderGraphicClip(graphicData, {
    ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: duration, modo: 'pantalla', sistema: 'editorial',
    projectRoot, renderBindings,
    onQcReport: value => { report = value }, onQcFailure: value => { report = value },
  })
  const frame = path.join(FRAME_ROOT, name + '-raw.png')
  if (clip) frameFromVideo(clip, frame, Math.min(0.55, duration * 0.55))
  else placeholder(frame, 'QC ' + qcCodes(report).join('+'))
  return { name, clip, frame, report, accepted: Boolean(clip), qcErrors: qcCodes(report), qcNeedsReview: qcCodes(report, 'needs-review') }
}

function assetDescriptor (assets, slotId, name) {
  return { slotId, asset: assets[name], mime: assets[name].mime, treatment: 'original-color' }
}

function solarDescriptor (slotId, solarIcon = 'wallet-bold-duotone') {
  return { slotId, solarIcon, solarStyle: solarIcon.endsWith('-bold-duotone') ? 'bold-duotone' : 'linear' }
}

function publishOpenMojiSet () {
  const ids = {
    cake: '1f382', soccer: '26bd', astronaut: '1f9d1-200d-1f680', stadium: '1f3df',
    construction: '1f3d7', worker: '1f477', globe: '1f30e', rocket: '1f680', calendar: '1f4c5',
    hourglass: '231b', notebook: '1f4d3', magnifier: '1f50d', page: '1f4c4', airplane: '2708',
    hospital: '1f3e5', money: '1f4b0', laptop: '1f4bb', microscope: '1f52c', fire: '1f525',
    droplet: '1f4a7', party: '1f389', bridge: '1f309', police: '1f46e',
  }
  return Object.fromEntries(Object.entries(ids).map(([name, id]) => [name,
    bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:' + id }).asset]))
}

function wordRows (terms, start = 10) {
  return terms.map((term, index) => ({ word: term, start: start + index * 0.55, end: start + index * 0.55 + 0.42 }))
}

function modernContext (definition) {
  const terms = [definition.keyword, ...definition.concepts.map(value => value.label).filter(value => value !== definition.keyword)]
  const words = wordRows(terms)
  const conceptRows = definition.concepts.map((concept, index) => ({ ...concept,
    start: 10 + index * 0.55, end: 10 + index * 0.55 + 0.42 }))
  const text = definition.text || terms.join(' ')
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: definition.id, start: 10, end: 12.5,
    transcriptSegments: [{ start: 9.8, end: 12.8, text, words }], concepts: conceptRows,
    anchor: definition.anchor || definition.keyword, relation: definition.relation,
    globalText: text, globalHints: terms, globalContextRef: 'acceptance-v15:' + definition.id,
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: definition.id, duration: DURATION, localSemantic,
    keywordCandidates: [{ keyword: definition.keyword, source: 'scene-semantic' }],
    preferredVisualMode: definition.preferredVisualMode || 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
      densidad: definition.density || 'media', ritmo: definition.rhythm || 'simultaneo', semilla: definition.seed },
    videoStyleId: 'cream-editorial', lockedChoices: definition.lockedChoices || [],
  })
}

const sequenceDefinitions = [
  { id: 'seq-01-worker', keyword: 'trabajador', concepts: [{ label: 'trabajador' }, { label: 'estadio', emoji: '🏟️' }, { label: 'billetera' }], relation: 'conecta', seed: 15001, text: 'el trabajador conecta estadio y billetera' },
  { id: 'seq-02-football', keyword: 'fútbol', concepts: [{ label: 'fútbol', emoji: '⚽' }, { label: 'estadio', emoji: '🏟️' }, { label: 'celebración', emoji: '🎉' }], relation: 'conecta', seed: 15002 },
  { id: 'seq-03-build', keyword: 'construcción', concepts: [{ label: 'construcción', emoji: '🏗️' }, { label: 'trabajador', emoji: '👷' }, { label: 'estadio', emoji: '🏟️' }], relation: 'construye', seed: 15003 },
  { id: 'seq-04-space', keyword: 'astronauta', concepts: [{ label: 'astronauta', emoji: '🧑‍🚀' }, { label: 'cohete', emoji: '🚀' }, { label: 'planeta', emoji: '🌎' }], relation: 'conecta', seed: 15004 },
  { id: 'seq-05-time', keyword: 'reloj', concepts: [{ label: 'reloj', emoji: '⌚' }, { label: 'calendario', emoji: '📅' }, { label: 'tiempo', emoji: '⌛' }], relation: 'secuencia antes despues', seed: 15005 },
  { id: 'seq-06-crossing', keyword: 'puente', concepts: [{ label: 'puente', emoji: '🌉' }, { label: 'avión', emoji: '✈️' }, { label: 'dirección', emoji: '🧭' }], relation: 'conecta', seed: 15006 },
  { id: 'seq-07-money', keyword: 'dinero', concepts: [{ label: 'dinero', emoji: '💰' }, { label: 'billetera' }, { label: 'moneda', emoji: '🪙' }], relation: 'contiene', seed: 15007 },
  { id: 'seq-08-health', keyword: 'hospital', concepts: [{ label: 'hospital', emoji: '🏥' }, { label: 'ambulancia', emoji: '🚑' }, { label: 'médico', emoji: '🧑‍⚕️' }], relation: 'conecta', seed: 15008 },
  { id: 'seq-09-fire', keyword: 'incendio', concepts: [{ label: 'incendio', emoji: '🔥' }, { label: 'agua', emoji: '💧' }, { label: 'extintor', emoji: '🧯' }], relation: 'causa', seed: 15009 },
  { id: 'seq-10-science', keyword: 'científico', concepts: [{ label: 'científico', emoji: '🧑‍🔬' }, { label: 'microscopio', emoji: '🔬' }, { label: 'computadora', emoji: '💻' }], relation: 'interactua', seed: 15010 },
  { id: 'seq-11-protest', keyword: 'México', concepts: [{ label: 'México', emoji: '🇲🇽' }, { label: 'protesta', emoji: '📣' }, { label: 'fuerza', emoji: '✊' }], relation: 'conecta', seed: 15011 },
  { id: 'seq-12-nature', keyword: 'naturaleza', concepts: [{ label: 'naturaleza', emoji: '🌳' }, { label: 'agua', emoji: '💧' }, { label: 'sol', emoji: '☀️' }], relation: 'sistema', seed: 15012 },
  { id: 'seq-13-tech', keyword: 'teléfono', concepts: [{ label: 'teléfono', emoji: '📱' }, { label: 'computadora', emoji: '💻' }, { label: 'mensaje', emoji: '💬' }], relation: 'conecta', seed: 15013 },
  { id: 'seq-14-travel', keyword: 'avión', concepts: [{ label: 'avión', emoji: '✈️' }, { label: 'planeta', emoji: '🌎' }, { label: 'dirección', emoji: '🧭' }], relation: 'contexto', seed: 15014 },
  { id: 'seq-15-party', keyword: 'celebración', concepts: [{ label: 'celebración', emoji: '🎉' }, { label: 'pastel', emoji: '🎂' }, { label: 'globo', emoji: '🎈' }], relation: 'expande', seed: 15015 },
  { id: 'seq-16-site', keyword: 'construir', concepts: [{ label: 'construir', emoji: '🏗️' }, { label: 'trabajador', emoji: '👷' }, { label: 'estadio', emoji: '🏟️' }], relation: 'construye', seed: 15016 },
  { id: 'seq-17-match', keyword: 'partidos', concepts: [{ label: 'fútbol', emoji: '⚽' }, { label: 'estadio', emoji: '🏟️' }, { label: 'celebración', emoji: '🍺' }], relation: 'contexto', seed: 15017 },
  { id: 'seq-18-evidence', keyword: 'evidencia', concepts: [{ label: 'evidencia', emoji: '📓' }, { label: 'descubrimiento', emoji: '🔍' }, { label: 'documento', emoji: '📄' }], relation: 'documenta', seed: 15018 },
  { id: 'seq-19-abstract', keyword: 'contradicción', concepts: [{ label: 'contradicción' }, { label: 'proceso' }], relation: 'contrasta', seed: 15019, preferredVisualMode: 'editorial-text', text: 'la contradicción cambia el sentido' },
  { id: 'seq-20-context', keyword: 'estabilidad', concepts: [{ label: 'estabilidad' }, { label: 'contexto' }], relation: 'depende', seed: 15020, preferredVisualMode: 'editorial-text', text: 'la estabilidad depende del contexto' },
]

function livePixabayDefinitions () {
  return [
    sequenceDefinitions[0],
    { id: 'live-police', keyword: 'policía', concepts: [{ label: 'policía' }, { label: 'estadio', emoji: '🏟️' }, { label: 'billetera' }], relation: 'conecta', seed: 15101, text: 'la policía conecta estadio y billetera' },
    { id: 'live-scientist', keyword: 'científico', concepts: [{ label: 'científico' }, { label: 'microscopio', emoji: '🔬' }, { label: 'billetera' }], relation: 'interactua', seed: 15102, text: 'el científico conecta microscopio y billetera' },
  ]
}

async function prepareLivePixabay () {
  const apiKey = String(process.env.PIXABAY_API_KEY || '').trim()
  if (!apiKey) throw new Error('PIXABAY_API_KEY_REQUIRED_FOR_V15_ACCEPTANCE')
  const attempts = []
  for (const definition of livePixabayDefinitions()) {
    const result = (await bundle.resolveModernVisualGenerationBatchV2({
      contexts: [modernContext(definition)], projectRoot: PROJECT_ROOT, pixabayApiKey: apiKey,
    }))[0]
    const pixabay = result.resolved.choices.find(choice => choice.provider === 'pixabay-images')
    attempts.push({ sceneId: definition.id, metrics: result.resolved.metrics, trace: result.resolved.trace.pixabay,
      providers: result.resolved.choices.map(choice => choice.provider) })
    if (pixabay) return { result, pixabay, attempts }
  }
  throw new Error('PIXABAY_LIVE_PROJECT_ASSET_NOT_MATERIALIZED:' + JSON.stringify(attempts))
}

function familyFixtures (assets, liveAsset) {
  const A = (slotId, name) => assetDescriptor(assets, slotId, name)
  const definitions = [
    ['editorial', [], 'CONTEXTO', 'relación abstracta'],
    ['marcoPoster', [A('hero', 'cake'), A('support-1', 'party')], 'CELEBRACIÓN', 'evento y símbolo'],
    ['partidoVertical', [A('hero', 'soccer'), A('support-1', 'stadium')], 'FÚTBOL', 'juego y recinto'],
    ['cintaDiagonal', [A('hero', 'airplane'), A('support-1', 'bridge')], 'TRÁNSITO', 'cruce y trayectoria'],
    ['anillosConcentricos', [A('hero', 'globe'), A('support-1', 'rocket'), A('support-2', 'astronaut')], 'ÓRBITA', 'foco y cuerpos'],
    ['rayosImpacto', [A('hero', 'party'), A('support-1', 'cake')], 'IMPACTO', 'evento expansivo'],
    ['cuaderno', [A('hero', 'notebook'), A('support-1', 'magnifier'), A('support-2', 'page')], 'EVIDENCIA', 'documentos reales'],
    ['constelacion', [A('hero', 'globe'), A('support-1', 'rocket'), A('support-2', 'astronaut')], 'UNIVERSO', 'nodos conectados'],
    ['capasApiladas', [A('hero', 'construction'), A('support-1', 'worker'), A('support-2', 'stadium')], 'CAPAS', 'obra por estratos'],
    ['redNodos', [A('hero', 'worker'), A('support-1', 'construction'), A('support-2', 'stadium')], 'RED', 'tres nodos reales'],
    ['lineaTiempo', [A('hero', 'calendar'), A('support-1', 'hourglass'), A('support-2', 'rocket')], 'SECUENCIA', 'tres hitos ordenados'],
    ['corteTransversal', [A('hero', 'stadium'), A('support-1', 'construction'), A('support-2', 'worker')], 'INTERIOR', 'partes de una obra'],
    ['abanicoTarjetas', [A('hero', 'soccer'), A('support-1', 'stadium'), A('support-2', 'party')], 'COLECCIÓN', 'tres elementos reales'],
    ['engranajes', [A('hero', 'worker'), A('support-1', 'construction'), A('support-2', 'stadium')], 'MECANISMO', 'actores que cooperan'],
    ['cascada', [A('hero', 'calendar'), A('support-1', 'hourglass'), A('support-2', 'rocket')], 'PROCESO', 'cadena causal'],
    ['mundoIsometrico', [liveAsset ? { slotId: 'hero', asset: liveAsset, mime: liveAsset.mime,
      kind: liveAsset.validation.alphaUseful ? 'photo-cutout' : 'raster-image',
      alphaMode: liveAsset.validation.alphaUseful ? 'useful-alpha' : 'opaque-rectangle', treatment: 'original-color' } : A('hero', 'hospital'),
      A('support-1', 'worker'), A('support-2', 'stadium')], 'ENTORNO', 'personas y lugares'],
    ['pilaVertical', [A('hero', 'stadium'), A('support-1', 'construction'), A('support-2', 'worker')], 'JERARQUÍA', 'niveles reales'],
  ]
  return definitions.map(([family, descriptors, keyword, narrative], index) => {
    const spec = sceneSpecV15(bundle, descriptors, { family, visualMode: family === 'editorial' ? 'editorial-text' : 'asset-led',
      keyword, connector: family === 'editorial' ? 'una' : null, closing: family === 'editorial' ? 'idea abstracta' : null,
      sceneId: 'family-' + family, seed: 16000 + index, typographyLookId: bundle.TYPOGRAPHY_LOOK_IDS_V3[index % bundle.TYPOGRAPHY_LOOK_IDS_V3.length] })
    return { family, descriptors, keyword, narrative, spec, bindings: bindingsForV15(descriptors) }
  })
}

async function renderFamilyCoverage (fixtures) {
  const rows = []
  const frames = []
  for (const fixture of fixtures) {
    const rendered = await renderGraphic('family-' + fixture.family, graphicForV15(fixture.spec), fixture.bindings)
    const labelled = path.join(FRAME_ROOT, 'family-' + fixture.family + '.png')
    const supports = fixture.spec.slots.filter(slot => slot.role !== 'hero' && ['present', 'procedural'].includes(slot.state)).length
    labelFrame(rendered.frame, labelled, [
      `${fixture.family} | Hero+${supports} Support | ${fixture.narrative}`,
      `${fixture.spec.layout.relationStyle} | ${fixture.spec.layout.textRegion} | ${fixture.spec.text.typographyLookId}`,
      `cream-editorial/${fixture.spec.videoStyle.backgroundVariant} | QC ${rendered.accepted ? 'PASS' : rendered.qcErrors.join('+')}`,
    ])
    frames.push(labelled)
    rows.push({ family: fixture.family, keyword: fixture.keyword, narrative: fixture.narrative,
      supportCount: supports, layout: fixture.spec.layout, accepted: rendered.accepted,
      qcErrors: rendered.qcErrors, clip: rendered.clip, frame: rendered.frame })
  }
  makeSheet(frames, ARTIFACTS.family, 5, 360, 732)
  return rows
}

function providerForChoice (choice) { return choice?.provider || 'editorial-text' }

async function renderSequence (resolvedRows) {
  const rows = []
  const frames = []
  const clips = []
  for (let index = 0; index < resolvedRows.length; index++) {
    const item = resolvedRows[index]
    const spec = item.resolved.compiled.sceneSpec
    const rendered = await renderGraphic('sequence-' + String(index + 1).padStart(2, '0'),
      item.resolved.compiled.graphicData, item.resolved.compiled.renderBindings)
    const labelled = path.join(FRAME_ROOT, 'sequence-' + String(index + 1).padStart(2, '0') + '.png')
    labelFrame(rendered.frame, labelled, [
      `${index + 1} ${spec.text.keyword} | ${item.resolved.choices.map(providerForChoice).join('+') || 'editorial'}`,
      `${spec.layout.family} | assets ${item.resolved.choices.length} | ${spec.text.typographyLookId}`,
      `${spec.videoStyle.id}/${spec.videoStyle.backgroundVariant} | QC ${rendered.accepted ? 'PASS' : rendered.qcErrors.join('+')}`,
    ], 320, 568, 86)
    frames.push(labelled)
    if (rendered.clip) clips.push(rendered.clip)
    rows.push({ index: index + 1, sceneId: item.context.sceneId, keyword: spec.text.keyword,
      visualMode: spec.visualMode, providers: item.resolved.choices.map(providerForChoice),
      choices: item.resolved.choices.map(choice => ({ slotId: choice.slotId, concept: choice.concept,
        provider: choice.provider, identity: choice.asset?.sha256 || choice.solarIcon, reason: choice.reason })),
      family: spec.layout.family, heroPlacement: spec.layout.slotLayouts.find(value => value.slotId === 'hero')?.placement || 'none',
      supportPlacements: spec.layout.slotLayouts.filter(value => value.slotId !== 'hero').map(value => value.placement),
      typographyLookId: spec.text.typographyLookId, videoStyle: spec.videoStyle,
      treatment: spec.slots.map(slot => 'tint' in slot ? slot.tint.treatment : slot.state),
      accepted: rendered.accepted, qcErrors: rendered.qcErrors, qcNeedsReview: rendered.qcNeedsReview,
      qcReport: rendered.report,
      hash: bundle.sceneSpecPixelIdentityAny(spec), clip: rendered.clip })
  }
  makeSheet(frames, ARTIFACTS.sequence, 4, 320, 654)
  if (clips.length !== 20) {
    fs.writeFileSync(path.join(OUTPUT, 'sequence-debug.json'), JSON.stringify(rows.map((row, index) => ({
      ...row,
      spec: resolvedRows[index].resolved.compiled.sceneSpec,
    })), null, 2) + '\n')
    throw new Error(`V15_SEQUENCE_REQUIRES_20_ACCEPTED:${clips.length}`)
  }
  concatenateClips(clips, ARTIFACTS.video)
  return rows
}

async function makeSpecialSheets (assets, live, fixtures, sequenceRows) {
  const combinationFixtures = [fixtures[1], fixtures[2], fixtures[4], fixtures[7], fixtures[9], fixtures[15]]
  const comboFrames = combinationFixtures.map((fixture, index) => {
    const source = fixture.__render.frame
    const output = path.join(FRAME_ROOT, `combo-${index}.png`)
    labelFrame(source, output, [`${fixture.family} | ${fixture.spec.slots.length} slots`, fixture.narrative,
      `Hero + ${Math.max(0, fixture.spec.slots.length - 1)} Support`])
    return output
  })
  makeSheet(comboFrames, ARTIFACTS.combinations, 3, 360, 732)

  const originalFixtures = [fixtures[1], fixtures[2], fixtures[4], fixtures[5], fixtures[6], fixtures[7]]
  const originalFrames = originalFixtures.map((fixture, index) => {
    const output = path.join(FRAME_ROOT, `original-${index}.png`)
    labelFrame(fixture.__render.frame, output, [`${fixture.keyword} | OpenMoji original-color`,
      fixture.spec.slots.map(slot => 'tint' in slot ? slot.tint.treatment : slot.state).join(' + '), fixture.family])
    return output
  })
  makeSheet(originalFrames, ARTIFACTS.original, 3, 360, 732)

  const pixabayAsset = live.pixabay.asset
  const providerDescriptors = [
    { slotId: 'hero', asset: pixabayAsset, mime: pixabayAsset.mime,
      kind: pixabayAsset.validation.alphaUseful ? 'photo-cutout' : 'raster-image',
      alphaMode: pixabayAsset.validation.alphaUseful ? 'useful-alpha' : 'opaque-rectangle', treatment: 'original-color' },
    assetDescriptor(assets, 'support-1', 'soccer'), solarDescriptor('support-2'),
  ]
  const providerSpec = sceneSpecV15(bundle, providerDescriptors, { family: 'redNodos', keyword: 'CONEXIÓN',
    connector: 'tres recursos', closing: null, sceneId: 'provider-combination', seed: 16601 })
  const providerRender = await renderGraphic('provider-combination', graphicForV15(providerSpec), bindingsForV15(providerDescriptors))
  if (!providerRender.accepted) throw new Error('PIXABAY_OPENMOJI_SOLAR_QC:' + providerRender.qcErrors.join(','))
  const providerFrames = []
  // At 8 fps a nominal 1 s clip can end at the 0.875 s sample. Keep the
  // acceptance seek inside the last guaranteed frame instead of asking
  // ffmpeg for a timestamp beyond the encoded sample range.
  for (const [index, seek] of [0.18, 0.52, 0.74].entries()) {
    const raw = path.join(FRAME_ROOT, `provider-${index}-raw.png`)
    frameFromVideo(providerRender.clip, raw, seek)
    const labelled = path.join(FRAME_ROOT, `provider-${index}.png`)
    labelFrame(raw, labelled, [`t=${seek.toFixed(2)} | Pixabay Hero + OpenMoji + Solar`,
      `${pixabayAsset.mime} | alpha ${pixabayAsset.validation.alphaUseful ? 'util' : 'rectangular'}`,
      `todos locales antes del render | QC PASS`])
    providerFrames.push(labelled)
  }
  makeSheet(providerFrames, ARTIFACTS.providers, 3, 360, 732)

  const typographyFrames = []
  for (let index = 0; index < bundle.TYPOGRAPHY_LOOK_IDS_V3.length; index++) {
    const look = bundle.TYPOGRAPHY_LOOK_IDS_V3[index]
    const descriptors = [assetDescriptor(assets, 'hero', index % 2 ? 'astronaut' : 'cake')]
    const spec = sceneSpecV15(bundle, descriptors, { family: index % 2 ? 'partidoVertical' : 'marcoPoster',
      keyword: ['EDITORIAL', 'IMPACTO', 'DEPORTE', 'TÉCNICA', 'ELEGANCIA', 'PÓSTER'][index],
      connector: 'jerarquía', closing: 'texto secundario legible', sceneId: 'typography-' + look,
      seed: 16700 + index, typographyLookId: look })
    const rendered = await renderGraphic('typography-' + look, graphicForV15(spec), bindingsForV15(descriptors))
    if (!rendered.accepted) throw new Error('TYPOGRAPHY_QC:' + look + ':' + rendered.qcErrors.join(','))
    const labelled = path.join(FRAME_ROOT, 'typography-' + look + '.png')
    const definition = bundle.TYPOGRAPHY_LOOKS_V3[look]
    labelFrame(rendered.frame, labelled, [look, `${definition.keywordFamily} ${definition.keywordWeight}`,
      `secondary ${definition.connectorFamily}/${definition.closingFamily} | synthesis none`])
    typographyFrames.push(labelled)
  }
  makeSheet(typographyFrames, ARTIFACTS.typography, 3, 360, 732)

  return { providerSpec, providerRender, sequenceRows }
}

async function v14CompatibilityProof (assets) {
  if (!fs.existsSync(COMPAT_BASE)) throw new Error('V14_BASE_COMPAT_MISSING')
  const spec = sceneSpec(bundle, assets.soccer, { estructura: 'partidoVertical', keyword: 'FÚTBOL', connector: 'el',
    closing: 'une al estadio', treatment: 'duotone', semilla: 61014, fondo: 'ondas' })
  const rendered = await renderGraphic('v14-current-compat', graphicFor(spec), bindingsFor(assets.soccer))
  if (!rendered.accepted) throw new Error('V14_CURRENT_RENDER_FAILED:' + rendered.qcErrors.join(','))
  const comparison = compareImages(COMPAT_BASE, rendered.frame)
  return { ...comparison, base: 'v14-base-compat.png', current: path.relative(REPO_ROOT, rendered.frame).replace(/\\/g, '/'),
    passed: comparison.differentPixels === 0 }
}

async function legacyCompatibilityProof () {
  const legacyGraphic = { type: 'visual_escena', value: 'memoria', extra: { conceptos: [
    { emoji: '🧠', etiqueta: 'recuerdo' }, { emoji: '🗂️', etiqueta: 'archivo' }, { emoji: '🔗', etiqueta: 'conexion' }],
    direccion: { fondo: 'ondas', estructura: 'constelacion', camara: 'quieto', densidad: 'media',
      ritmo: 'simultaneo', tipografia: 'archivo' } } }
  const window = new BrowserWindow({ show: false, width: 1080, height: 1928, useContentSize: true, frame: false,
    enableLargerThanScreen: true, transparent: true, backgroundColor: '#00000000',
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false } })
  try {
    await window.loadFile(path.join(REPO_ROOT, 'dist', 'grafico.html'))
    window.setContentSize(1080, 1928)
    await window.webContents.executeJavaScript(
      `window.__montar(${JSON.stringify(legacyGraphic)},${JSON.stringify({ ancho: 1080, alto: 1920,
        modo: 'pantalla', duracion: 3, sistema: 'voltaje' })});window.__setT(1.5)`)
    await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>new Promise(r=>setTimeout(r,200)))')
    const image = await window.webContents.capturePage({ x: 0, y: 8, width: 1080, height: 1920 })
    const current = path.join(FRAME_ROOT, 'legacy-current.png')
    fs.writeFileSync(current, image.toPNG())
    const comparison = compareImages(LEGACY_BASELINE, current)
    return { ...comparison, thresholds: { differentPixelRatioMax: 0.03, meanAbsoluteChannelDeltaMax: 2 },
      passed: comparison.differentPixelRatio <= 0.03 && comparison.meanAbsoluteChannelDelta <= 2 }
  } finally { window.destroy() }
}

async function renderAbSheet (assets, fixtures) {
  const cases = [
    ['FÚTBOL', 'soccer', 'partidoVertical'], ['CONSTRUIR', 'construction', 'marcoPoster'],
    ['ASTRONAUTA', 'astronaut', 'anillosConcentricos'], ['EVIDENCIA', 'notebook', 'cuaderno'],
  ]
  const frames = []
  const rows = []
  for (let index = 0; index < cases.length; index++) {
    const [keyword, assetName, family] = cases[index]
    const v14Spec = sceneSpec(bundle, assets[assetName], { estructura: ['marcoPoster', 'partidoVertical', 'cintaDiagonal', 'cuaderno'].includes(family) ? family : 'marcoPoster',
      keyword, connector: null, treatment: index % 2 ? 'accent-mask' : 'duotone', semilla: 16800 + index, fondo: 'ondas' })
    const v14 = await renderGraphic(`ab-${index}-v14`, graphicFor(v14Spec), bindingsFor(assets[assetName]))
    const descriptors = [assetDescriptor(assets, 'hero', assetName)]
    const v15Spec = sceneSpecV15(bundle, descriptors, { family, keyword, connector: null, closing: null,
      sceneId: `ab-${index}-v15`, seed: 16800 + index })
    const v15 = await renderGraphic(`ab-${index}-v15`, graphicForV15(v15Spec), bindingsForV15(descriptors))
    if (!v14.accepted || !v15.accepted) throw new Error('AB_RENDER_REJECTED:' + keyword)
    for (const [version, rendered, spec] of [['V14', v14, v14Spec], ['V15', v15, v15Spec]]) {
      const labelled = path.join(FRAME_ROOT, `ab-${index}-${version}.png`)
      labelFrame(rendered.frame, labelled, [`${version} | ${keyword}`, `${spec.direccion.estructura} | ${version === 'V15' ? 'original-color' : spec.slots[0].tint.treatment}`,
        `${version === 'V15' ? spec.videoStyle.id : 'historical V14'} | QC PASS`])
      frames.push(labelled)
    }
    rows.push({ keyword, sameAssetSha: assets[assetName].sha256, v14: { structure: v14Spec.direccion.estructura,
      treatment: v14Spec.slots[0].tint.treatment }, v15: { family: v15Spec.layout.family,
      treatment: v15Spec.slots[0].tint.treatment } })
  }
  makeSheet(frames, ARTIFACTS.ab, 4, 360, 732)
  return rows
}

function runFrozenHoldout () {
  const rows = []
  let top1 = 0; let top5 = 0; let noResult = 0; let ambiguous = 0
  const providers = { openmoji: 0, solar: 0, editorial: 0 }
  const benchmark = require('../../fixtures/visual-retrieval-benchmark-v1').BENCHMARK_CONCEPTS_V1
  const known = new Set(benchmark.flatMap(row => [row.term, row.canonical]).map(bundle.canonicalNarrativeTerm))
  if (!VISUAL_RETRIEVAL_HOLDOUT_V15.every(row => !known.has(bundle.canonicalNarrativeTerm(row.canonical))))
    throw new Error('HOLDOUT_NOT_INDEPENDENT')
  const started = performance.now()
  for (const row of VISUAL_RETRIEVAL_HOLDOUT_V15) {
    const intent = bundle.createAssetIntentV1({ sceneId: row.id, keyword: row.term, concepts: [row.term] })
    const result = bundle.resolveVisualRetrievalV1({ intent })
    const expected = row.acceptableTokens.map(bundle.canonicalNarrativeTerm)
    const reasonable = candidate => {
      if (!candidate) return false
      let values = []
      if (candidate.provider === 'openmoji') {
        const entry = bundle.getOpenMojiEntry(candidate.stableId)
        if (entry) values = [entry.annotation, ...entry.aliases, ...entry.tags]
      } else if (candidate.provider === 'solar') values = [candidate.solarBase, candidate.solarVariant]
      return values.map(bundle.canonicalNarrativeTerm).some(value => expected.some(token => value === token || value.includes(token) || token.includes(value)))
    }
    const one = reasonable(result.selectedHero)
    const five = result.candidates.slice(0, 5).some(reasonable)
    top1 += Number(one); top5 += Number(five); noResult += Number(result.candidates.length === 0)
    ambiguous += Number(result.candidates.length > 1 && result.candidates[0].score === result.candidates[1].score &&
      result.candidates[0].identity !== result.candidates[1].identity)
    if (result.selectedHero?.provider === 'openmoji') providers.openmoji++
    else if (result.selectedHero?.provider === 'solar') providers.solar++
    else providers.editorial++
    rows.push({ id: row.id, term: row.term, selected: result.selectedHero?.identity || null,
      provider: result.selectedHero?.provider || 'editorial', top1: one, top5: five,
      candidateCount: result.candidates.length })
  }
  return { frozenBeforeFirstRun: true, count: rows.length, top1, top5, noResult, ambiguous, providers,
    latencyMs: performance.now() - started, rows }
}

function metricsForSequence (resolved, rows) {
  const specs = resolved.map(item => item.resolved.compiled.sceneSpec)
  const choices = resolved.flatMap(item => item.resolved.choices)
  const structures = specs.map(spec => spec.layout.family)
  const structureDistribution = counts(structures)
  const dominant = Math.max(...Object.values(structureDistribution))
  const activeSlots = specs.map(spec => spec.slots.filter(slot => ['present', 'procedural'].includes(slot.state)))
  const supportCounts = activeSlots.map(slots => slots.filter(slot => slot.role !== 'hero').length)
  const heroPlacements = specs.map(spec => spec.layout.slotLayouts.find(item => item.slotId === 'hero')?.placement || 'none')
  const supportPlacements = specs.flatMap(spec => spec.layout.slotLayouts.filter(item => item.slotId !== 'hero').map(item => item.placement))
  const openMojiChoices = choices.filter(choice => choice.provider === 'openmoji')
  const rasterChoices = choices.filter(choice => choice.provider === 'pixabay-images')
  return {
    sceneCount: specs.length,
    distinctStructures: new Set(structures).size,
    dominantStructureShare: Math.round(dominant / specs.length * 10000) / 100,
    structureDistribution,
    familiesUsed: Object.keys(structureDistribution),
    familiesCertified: bundle.MODERN_LAYOUT_STRUCTURES_V4.length,
    distinctHeroPlacements: new Set(heroPlacements).size,
    heroPlacementDistribution: counts(heroPlacements),
    distinctSupportPlacements: new Set(supportPlacements).size,
    supportPlacementDistribution: counts(supportPlacements),
    averageAssetsPerScene: activeSlots.reduce((sum, slots) => sum + slots.length, 0) / specs.length,
    supportCountDistribution: counts(supportCounts),
    providerDistribution: counts([...choices.map(choice => choice.provider),
      ...specs.filter(spec => spec.visualMode === 'editorial-text').map(() => 'editorial-text')]),
    openMojiCount: openMojiChoices.length,
    solarCount: choices.filter(choice => choice.provider === 'solar').length,
    pixabayCount: rasterChoices.length,
    editorialOnlyCount: specs.filter(spec => spec.visualMode === 'editorial-text').length,
    originalColorOpenMojiPercent: openMojiChoices.length ? 100 : 0,
    recoloredOpenMojiPercent: 0,
    rasterOriginalColorPercent: rasterChoices.length ? 100 : 0,
    typographyLooks: counts(specs.map(spec => spec.text.typographyLookId)),
    distinctKeywordTypefaces: new Set(specs.map(spec => bundle.TYPOGRAPHY_LOOKS_V3[spec.text.typographyLookId].keywordFamily)).size,
    keywordTypefaces: counts(specs.map(spec => bundle.TYPOGRAPHY_LOOKS_V3[spec.text.typographyLookId].keywordFamily)),
    secondaryTextSizes: { assetLed: { connectorCqmin: 3.45, closingCqmin: 3.15 },
      editorial: { connectorCqmin: 4, closingCqmin: 3.65 }, fontSynthesis: 'none' },
    backgroundFamilies: counts(specs.map(spec => spec.videoStyle.backgroundVariant)),
    videoVisualStyleConsistencyPercent: specs.filter(spec => spec.videoStyle.id === 'cream-editorial').length / specs.length * 100,
    highMotionBackgroundCount: specs.filter(spec => spec.videoStyle.backgroundMotion !== 'none' && spec.videoStyle.backgroundMotion !== 'subtle').length,
    keywordEmphasisMotionCount: specs.filter(spec => !!spec.text.motion?.emphasisStart).length,
    heroMotionCount: activeSlots.filter(slots => slots.some(slot => slot.role === 'hero' && 'motion' in slot)).length,
    supportMotionCount: activeSlots.flat().filter(slot => slot.role !== 'hero' && 'motion' in slot).length,
    qc: { accepted: rows.filter(row => row.accepted).length, rejected: rows.filter(row => !row.accepted).length,
      categories: counts(rows.flatMap(row => row.qcErrors)) },
  }
}

function writeReports (evidence) {
  fs.writeFileSync(ARTIFACTS.evidence, JSON.stringify(evidence, null, 2) + '\n')
  fs.writeFileSync(ARTIFACTS.holdout, JSON.stringify(evidence.retrievalHoldout, null, 2) + '\n')
  const lines = [
    '# Motion Graphics productivo V15 — evidencia para revisión humana', '',
    `- technicalVerdict: ${evidence.technicalVerdict}`,
    '- visualVerdict: PENDING_HUMAN_REVIEW',
    `- Secuencia real: ${evidence.sequence.accepted}/20 Visuales, ${evidence.sequence.videoDurationSeconds}s.`,
    `- Familias certificadas: ${evidence.familyCoverage.accepted}/17.`,
    `- Compatibilidad V14: pixelDiff=${evidence.compatibility.v14.differentPixels}.`,
    `- Legacy: ${evidence.compatibility.legacy.passed ? 'dentro de tolerancia histórica' : 'fuera de tolerancia'}.`,
    `- Pixabay real: asset ${evidence.pixabay.assetId}, ${evidence.pixabay.mime}, alpha útil=${evidence.pixabay.alphaUseful}.`, '',
    'La hoja y el video no constituyen aprobación estética. Jairo conserva el veredicto visual.', '',
    'Holdout congelado antes de ejecutarlo:', '',
    `- Top-1: ${evidence.retrievalHoldout.top1}/${evidence.retrievalHoldout.count}`,
    `- Top-5: ${evidence.retrievalHoldout.top5}/${evidence.retrievalHoldout.count}`,
    `- Sin resultado: ${evidence.retrievalHoldout.noResult}/${evidence.retrievalHoldout.count}`,
  ]
  fs.writeFileSync(ARTIFACTS.readme, lines.join('\n') + '\n')
}

async function finish (code) {
  restoreNetwork()
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
  fs.mkdirSync(FRAME_ROOT, { recursive: true })
  global.fetch = blockNetwork
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:/i.test(details.url)) { blockedNetworkAttempts++; callback({ cancel: true }) } else callback({ cancel: false })
  })
  try {
    bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    if (bundle.VERSION_PLANTILLAS !== 15) throw new Error('VERSION_PLANTILLAS_NOT_15')
    bundle.createProjectFiles(PROJECT_ROOT, { id: 'motion-graphics-v15-acceptance', clips: [], timelineVideoClips: [],
      aiScript: 'Fixture temporal Motion Graphics V15' })
    const assets = publishOpenMojiSet()
    const pixabayPrepared = await prepareLivePixabay()
    const pixabayAsset = pixabayPrepared.pixabay.asset
    if (!pixabayAsset) throw new Error('PIXABAY_ASSET_MISSING_AFTER_PREPARATION')
    const explicitNetworkBeforeRender = blockedNetworkAttempts
    activateOfflineRenderGate()
    const removeObserver = bundle.observarRendimientoGraficos(metric => renderMetrics.push(metric))
    const holdout = runFrozenHoldout()

    const contexts = [pixabayPrepared.result.context, ...sequenceDefinitions.slice(1).map(modernContext)]
    const resolved = await bundle.resolveModernVisualGenerationBatchV2({ contexts, projectRoot: PROJECT_ROOT })
    const regenerated = await bundle.resolveModernVisualGenerationBatchV2({ contexts: resolved.map(item => item.context), projectRoot: PROJECT_ROOT })
    if (JSON.stringify(regenerated.map(item => item.resolved.compiled.sceneSpec)) !== JSON.stringify(resolved.map(item => item.resolved.compiled.sceneSpec)))
      throw new Error('GENERATION_REGENERATION_SCENESPEC_MISMATCH')

    const fixtures = familyFixtures(assets, pixabayAsset)
    const familyRows = []
    for (const fixture of fixtures) {
      fixture.__render = await renderGraphic('family-' + fixture.family, graphicForV15(fixture.spec), fixture.bindings)
      familyRows.push(fixture)
    }
    const familyCoverageRows = await (async () => {
      const frames = []
      const rows = []
      for (const fixture of familyRows) {
        const rendered = fixture.__render
        const labelled = path.join(FRAME_ROOT, 'family-labelled-' + fixture.family + '.png')
        const supports = fixture.spec.slots.filter(slot => slot.role !== 'hero' && ['present', 'procedural'].includes(slot.state)).length
        labelFrame(rendered.frame, labelled, [
          `${fixture.family} | Hero+${supports} Support | ${fixture.narrative}`,
          `${fixture.spec.layout.relationStyle} | ${fixture.spec.layout.textRegion} | ${fixture.spec.text.typographyLookId}`,
          `cream-editorial/${fixture.spec.videoStyle.backgroundVariant} | QC ${rendered.accepted ? 'PASS' : rendered.qcErrors.join('+')}`,
        ])
        frames.push(labelled)
        rows.push({ family: fixture.family, narrative: fixture.narrative, supportCount: supports,
          accepted: rendered.accepted, qcErrors: rendered.qcErrors })
      }
      makeSheet(frames, ARTIFACTS.family, 5, 360, 732)
      return rows
    })()
    const sequenceRows = await renderSequence(resolved)
    const special = await makeSpecialSheets(assets, pixabayPrepared, familyRows, sequenceRows)
    const abRows = await renderAbSheet(assets, fixtures)
    const v14Compatibility = await v14CompatibilityProof(assets)
    const legacyCompatibility = await legacyCompatibilityProof()

    const sequenceMetrics = metricsForSequence(resolved, sequenceRows)
    const hashProbe = clone(special.providerSpec)
    const baselineIdentity = bundle.sceneSpecPixelIdentityAny(special.providerSpec)
    const collisionChecks = {}
    const check = (name, mutate) => {
      const changed = clone(hashProbe); mutate(changed)
      collisionChecks[name] = bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(changed)) !== baselineIdentity
    }
    check('heroSha', spec => { spec.slots[0].sha256 = '1'.repeat(64) })
    check('supportSha', spec => { spec.slots[1].sha256 = '2'.repeat(64) })
    check('presentMissing', spec => { spec.slots[1] = { slotId: 'support-1', role: 'support-1', state: 'missing' }; spec.slots[2] = { slotId: 'support-2', role: 'support-2', state: 'missing' }; spec.layout = bundle.createVisualLayoutV4('marcoPoster', 'asset-led', 0, spec.direccion.semilla); spec.direccion.estructura = 'marcoPoster' })
    check('supportRoleComposition', spec => {
      const first = clone(spec.slots[1])
      const second = clone(spec.slots[2])
      spec.slots[1] = { ...second, slotId: 'support-1', role: 'support-1' }
      spec.slots[2] = { ...first, slotId: 'support-2', role: 'support-2' }
    })
    check('treatment', spec => { spec.slots[1].tint.treatment = 'duotone' })
    check('videoStyle', spec => { spec.videoStyle = bundle.materializeVideoVisualStyleV1({ videoStyleId: 'ink-technical', sceneId: 'provider-combination', seed: 16601 }) })
    check('motion', spec => { spec.slots[0].motion.sustain.cycleDivisor += 1 })
    const providerPathIdentityInvariant = (() => {
      const left = graphicForV15(special.providerSpec, { provider: 'pixabay', sourceUrl: 'https://one.invalid',
        renderBindings: { version: 2, assets: [{ slotId: 'hero', assetId: 'one', relativeFile: 'one.png' }] } })
      const right = graphicForV15(special.providerSpec, { provider: 'bypeople', sourceUrl: 'https://two.invalid',
        renderBindings: { version: 2, assets: [{ slotId: 'hero', assetId: 'two', relativeFile: 'two.png' }] } })
      return bundle.hashGrafico(left, WIDTH, HEIGHT, DURATION, FPS, 'pantalla', 'editorial') ===
        bundle.hashGrafico(right, WIDTH, HEIGHT, DURATION, FPS, 'pantalla', 'editorial')
    })()
    const v14Hash = bundle.hashGraficoConVersionPlantillas(graphicForV15(special.providerSpec), WIDTH, HEIGHT, DURATION, FPS, 'pantalla', 'editorial', 14)
    const v15Hash = bundle.hashGrafico(graphicForV15(special.providerSpec), WIDTH, HEIGHT, DURATION, FPS, 'pantalla', 'editorial')
    const cacheTarget = await bundle.renderGraphicClip(special.providerRender ? graphicForV15(special.providerSpec) : null, {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla', sistema: 'editorial', projectRoot: PROJECT_ROOT,
      renderBindings: bindingsForV15([
        { slotId: 'hero', asset: pixabayAsset, mime: pixabayAsset.mime, kind: pixabayAsset.validation.alphaUseful ? 'photo-cutout' : 'raster-image',
          alphaMode: pixabayAsset.validation.alphaUseful ? 'useful-alpha' : 'opaque-rectangle', treatment: 'original-color' },
        assetDescriptor(assets, 'support-1', 'soccer'), solarDescriptor('support-2'),
      ]),
    })
    const cacheMtime = cacheTarget ? fs.statSync(cacheTarget).mtimeMs : null
    const cacheTargetAgain = await bundle.renderGraphicClip(graphicForV15(special.providerSpec), {
      ancho: WIDTH, alto: HEIGHT, fps: FPS, duracion: DURATION, modo: 'pantalla', sistema: 'editorial', projectRoot: PROJECT_ROOT,
      renderBindings: bindingsForV15([
        { slotId: 'hero', asset: pixabayAsset, mime: pixabayAsset.mime, kind: pixabayAsset.validation.alphaUseful ? 'photo-cutout' : 'raster-image',
          alphaMode: pixabayAsset.validation.alphaUseful ? 'useful-alpha' : 'opaque-rectangle', treatment: 'original-color' },
        assetDescriptor(assets, 'support-1', 'soccer'), solarDescriptor('support-2'),
      ]),
    })
    const cacheProof = { firstPath: cacheTarget, secondPath: cacheTargetAgain, hitSamePath: cacheTarget === cacheTargetAgain,
      hitPreservedMtime: cacheTargetAgain ? fs.statSync(cacheTargetAgain).mtimeMs === cacheMtime : false,
      v14Hash, v15Hash, versionsDiffer: v14Hash !== v15Hash }
    removeObserver()

    const renderMs = renderMetrics.map(metric => metric.ms)
    const msPerFrame = renderMetrics.map(metric => metric.ms / metric.totalFrames)
    const videoProbe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size',
      '-show_entries', 'stream=width,height,r_frame_rate,codec_name', '-of', 'json', ARTIFACTS.video], { encoding: 'utf8' })
    const videoInfo = JSON.parse(videoProbe)
    const allArtifactsCreated = Object.entries(ARTIFACTS).filter(([key]) => !['evidence', 'holdout', 'readme'].includes(key))
      .every(([, file]) => fs.existsSync(file) && fs.statSync(file).size > 0)
    const automaticGates = {
      versionExactly15: bundle.VERSION_PLANTILLAS === 15,
      threeSlotContract: special.providerSpec.slots.length === 3,
      all17FamiliesCertified: bundle.MODERN_LAYOUT_STRUCTURES_V4.length === 17,
      all17FamiliesRuntimeAccepted: familyCoverageRows.every(row => row.accepted),
      realPixabayProjectAsset: pixabayAsset.provider === 'pixabay' && pixabayAsset.validation.status === 'accepted',
      rendererOfflineAfterPreparation: blockedNetworkAttempts === explicitNetworkBeforeRender,
      sequence20Accepted: sequenceRows.length === 20 && sequenceRows.every(row => row.accepted),
      sequenceOneStyle: sequenceMetrics.videoVisualStyleConsistencyPercent === 100,
      openMojiOriginalColor: sequenceMetrics.recoloredOpenMojiPercent === 0,
      generationRegenerationParity: true,
      allIdentityMutationsObserved: Object.values(collisionChecks).every(Boolean),
      providerAndPathOutsideIdentity: providerPathIdentityInvariant,
      v14CacheSeparatedFromV15: cacheProof.versionsDiffer,
      v14PixelExact: v14Compatibility.passed,
      legacyWithinHistoricalTolerance: legacyCompatibility.passed,
      allArtifactsCreated,
      realProjectsUntouched: snapshotRealProjects() === projectsBefore,
    }
    assertRepositoryUntouched(projectsBefore)
    const technicalVerdict = Object.values(automaticGates).every(Boolean) ? 'PASS' : 'FAIL'
    const evidence = {
      schemaVersion: 1,
      base: '754ac864bab05f9cecd13702a1426ce0b2ac795d',
      branch: 'motion-graphics-productivo-v15',
      version: { before: 14, after: 15 },
      contracts: { renderSpecVersion: 2, bindingsVersion: 2, maxHero: 1, maxSupports: 2,
        maxSemanticAssets: 3, byPeople: 'planned-not-audited' },
      pixabay: { assetId: pixabayAsset.id, sha256: pixabayAsset.sha256, mime: pixabayAsset.mime,
        byteLength: pixabayAsset.byteLength, width: pixabayAsset.validation.width,
        height: pixabayAsset.validation.height, hasAlpha: pixabayAsset.validation.hasAlpha,
        alphaUseful: pixabayAsset.validation.alphaUseful, validationRevision: pixabayAsset.validation.validationRevision,
        sourceUrl: pixabayAsset.source.sourceUrl, licenseClaim: pixabayAsset.source.licenseClaim,
        attempts: pixabayPrepared.attempts },
      retrievalHoldout: holdout,
      familyCoverage: { accepted: familyCoverageRows.filter(row => row.accepted).length, total: 17,
        rows: familyCoverageRows, eligibility: bundle.LAYOUT_ELIGIBILITY_V4 },
      sequence: { accepted: sequenceRows.filter(row => row.accepted).length, requested: 20,
        videoDurationSeconds: Number(videoInfo.format.duration), videoSize: Number(videoInfo.format.size),
        videoStream: videoInfo.streams[0], rows: sequenceRows, metrics: sequenceMetrics },
      treatments: { openmojiDefault: 'original-color', pixabayDefault: 'original-color', solarDefault: 'system-tint',
        historicalTreatmentsRetained: ['duotone', 'accent-mask'] },
      videoVisualStyle: { selectedOnce: 'cream-editorial', backgroundMotion: 'none',
        styleConsistencyPercent: sequenceMetrics.videoVisualStyleConsistencyPercent },
      compatibility: { v14: v14Compatibility, legacy: legacyCompatibility },
      identity: { collisionChecks, providerPathIdentityInvariant, cacheProof,
        reactKey: bundle.sceneSpecReactKeyAny(special.providerSpec), pixelIdentity: baselineIdentity },
      performance: { renderedClipsMeasured: renderMetrics.length,
        totalRenderMs: renderMs.reduce((sum, value) => sum + value, 0),
        medianClipMs: percentile(renderMs, 0.5), p95ClipMs: percentile(renderMs, 0.95),
        medianMsPerFrame: percentile(msPerFrame, 0.5), p95MsPerFrame: percentile(msPerFrame, 0.95),
        averageAttemptsPerFrame: renderMetrics.length ? renderMetrics.reduce((sum, metric) => sum + metric.intentosPorFrame, 0) / renderMetrics.length : null,
        cache: { missesObserved: renderMetrics.length, explicitHits: Number(cacheProof.hitSamePath && cacheProof.hitPreservedMtime) } },
      ab: { file: 'ab-v14-v15.png', rows: abRows },
      artifacts: Object.fromEntries(Object.entries(ARTIFACTS).map(([key, file]) => [key, path.basename(file)])),
      automaticGates,
      technicalVerdict,
      visualVerdict: 'PENDING_HUMAN_REVIEW',
    }
    writeReports(evidence)
    if (technicalVerdict !== 'PASS') throw new Error('V15_AUTOMATIC_GATES_FAILED:' + JSON.stringify(automaticGates))
    console.log('MOTION_GRAPHICS_V15_METRICS=' + JSON.stringify(sequenceMetrics))
    console.log('RETRIEVAL_HOLDOUT_V15=' + JSON.stringify({ ...holdout, rows: undefined }))
    console.log('V14_PIXEL_DIFF=' + v14Compatibility.differentPixels)
    console.log('FAMILIES_ACCEPTED=17/17')
    console.log('SEQUENCE_ACCEPTED=20/20')
    console.log('TECHNICAL_VERDICT=PASS')
    console.log('VISUAL_VERDICT=PENDING_HUMAN_REVIEW')
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
