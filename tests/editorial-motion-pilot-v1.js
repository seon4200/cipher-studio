const { app, session } = require('electron')
const assert = require('assert/strict')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const root = path.resolve(__dirname, '..')
const fixture = createTestFixture('editorial-motion-pilot-v1')
const project = path.join(fixture, 'project')
let bundle
let finished = false
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let networkAttempts = 0

function context (profile) {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId: 'editorial-pilot-same-assets', start: 10, end: 12.5,
    transcriptSegments: [{ start: 10, end: 12.5, text: 'el fútbol conecta estadio y celebración', words: [
      { word: 'fútbol', start: 10.1, end: 10.5 }, { word: 'estadio', start: 10.7, end: 11.2 },
      { word: 'celebración', start: 11.4, end: 12.1 },
    ] }],
    concepts: [
      { label: 'fútbol', emoji: '⚽', start: 10.1, end: 10.5 },
      { label: 'estadio', emoji: '🏟️', start: 10.7, end: 11.2 },
      { label: 'celebración', emoji: '🎉', start: 11.4, end: 12.1 },
    ],
    anchor: 'fútbol', relation: 'conecta', globalText: 'el fútbol conecta estadio y celebración',
    globalHints: [], globalContextRef: 'fixture:editorial-motion-pilot',
  })
  return bundle.createModernVisualGenerationContextV2({
    sceneId: localSemantic.sceneId, duration: 1.5, localSemantic,
    keywordCandidates: [{ keyword: 'fútbol', source: 'scene-semantic' }],
    preferredVisualMode: 'auto', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'media',
      ritmo: 'simultaneo', semilla: 151255 }, videoStyleId: 'cream-editorial',
    ...(profile ? { presentationProfile: bundle.EDITORIAL_MOTION_PROFILE_V1 } : {}),
  })
}

function choices (row) {
  return row.resolved.choices.map(choice => [choice.slotId, choice.provider,
    choice.asset?.sha256 ?? choice.solarIcon]).sort((a, b) => a[0].localeCompare(b[0]))
}

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(fixture)) } catch {}
  try { cleanupTestFixture(fixture) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

// The user's TV currently reports 300% DPI. Keep this isolated test at the renderer's
// historical 1:1 capture scale; this is not an app/global display-setting change.
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.setPath('userData', path.join(fixture, 'electron-user-data'))
process.chdir(fixture)
process.once('exit', () => { if (!finished) process.exitCode = 1 })
app.whenReady().then(async () => {
  try {
    const blockNetwork = () => { networkAttempts++; throw new Error('EDITORIAL_PILOT_NETWORK_FORBIDDEN') }
    global.fetch = blockNetwork
    http.request = blockNetwork
    https.request = blockNetwork
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      { if (/^https?:/i.test(details.url)) networkAttempts++; callback({ cancel: /^https?:/i.test(details.url) }) })
    bundle = require(path.join(root, 'dist-electron', 'main', 'index.js'))
    bundle.createProjectFiles(project, { id: 'editorial-pilot-temp', clips: [], timelineVideoClips: [], aiScript: 'fixture sintético' })
    assert.equal(bundle.VERSION_PLANTILLAS, 15)
    const standard = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context(false)], projectRoot: project }))[0]
    const pilot = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context(true)], projectRoot: project }))[0]
    assert.deepEqual(choices(pilot), choices(standard), 'El perfil no puede cambiar recursos ni roles')
    assert.equal(standard.resolved.compiled.sceneSpec.presentationProfile, undefined)
    assert.deepEqual(pilot.resolved.compiled.sceneSpec.presentationProfile, bundle.EDITORIAL_MOTION_PROFILE_V1)
    assert.notEqual(bundle.sceneSpecPixelIdentityAny(standard.resolved.compiled.sceneSpec),
      bundle.sceneSpecPixelIdentityAny(pilot.resolved.compiled.sceneSpec))
    assert.equal(bundle.sceneSpecPixelIdentityAny(pilot.resolved.compiled.sceneSpec),
      bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(JSON.parse(JSON.stringify(pilot.resolved.compiled.sceneSpec)))))
    assert.equal(bundle.sceneSpecReactKeyAny(pilot.resolved.compiled.sceneSpec),
      'scene-v2|' + bundle.sceneSpecPixelIdentityAny(pilot.resolved.compiled.sceneSpec))
    const dataSpec = JSON.parse(JSON.stringify(pilot.resolved.compiled.sceneSpec))
    dataSpec.editorialData = { revision: 'editorial-data-callout-v1', value: '72%', percent: 72 }
    assert.notEqual(bundle.sceneSpecPixelIdentityAny(bundle.validateVisualSceneSpecV2(dataSpec)),
      bundle.sceneSpecPixelIdentityAny(pilot.resolved.compiled.sceneSpec))
    const illegalHistoricalData = JSON.parse(JSON.stringify(standard.resolved.compiled.sceneSpec))
    illegalHistoricalData.editorialData = dataSpec.editorialData
    assert.throws(() => bundle.validateVisualSceneSpecV2(illegalHistoricalData))
    console.log('OK mismos assets, perfil explícito y PixelIdentity distinto')

    const regenerated = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [pilot.context], projectRoot: project }))[0]
    assert.equal(bundle.sceneSpecPixelIdentityAny(regenerated.resolved.compiled.sceneSpec),
      bundle.sceneSpecPixelIdentityAny(pilot.resolved.compiled.sceneSpec))
    console.log('OK generación y regeneración deterministas')

    for (const family of bundle.EDITORIAL_PILOT_FAMILIES) {
      const mode = family === 'editorial' ? 'editorial-text' : 'asset-led'
      const count = family === 'editorial' ? 0 : family === 'lineaTiempo' ? 2 : 1
      const layout = bundle.createEditorialPilotLayoutV1(family, mode, count, 151255)
      assert.equal(layout.family, family)
      assert.equal(layout.slotLayouts.length, family === 'editorial' ? 0 : count + 1)
      assert.notDeepEqual(layout, bundle.createVisualLayoutV4(family, mode, count, 151255))
    }
    assert.equal(bundle.selectEditorialPilotFamilyV1({ sceneId: 'comparison', visualMode: 'asset-led',
      supportCount: 1, relation: 'compara', seed: 151255 }), 'partidoVertical')
    assert.equal(bundle.selectEditorialPilotFamilyV1({ sceneId: 'process', visualMode: 'asset-led',
      supportCount: 2, relation: 'secuencia', seed: 151255 }), 'lineaTiempo')
    assert.notEqual(bundle.selectEditorialPilotFamilyV1({ sceneId: 'incomplete-process', visualMode: 'asset-led',
      supportCount: 1, relation: 'secuencia', seed: 151255 }), 'lineaTiempo')
    console.log('OK seis gramáticas distintas y slots reales')

    const render = await bundle.renderGraphicClip(pilot.resolved.compiled.graphicData, {
      ancho: 540, alto: 960, fps: 24, duracion: 1.5, modo: 'pantalla', sistema: 'editorial',
      projectRoot: project, renderBindings: pilot.resolved.compiled.renderBindings,
      onQcReport: report => console.log('PILOT_QC', JSON.stringify(report.findings?.filter(item => item.level === 'error') ?? [])),
      onQcFailure: report => console.log('PILOT_QC_FAILED', JSON.stringify(report.findings?.filter(item => item.level === 'error') ?? [])),
    })
    if (!render) {
      for (const candidate of [path.join(fixture, 'generation-debug.log'), path.join(fixture, 'cipher-studio', 'generation-debug.log')]) {
        if (fs.existsSync(candidate)) console.error(fs.readFileSync(candidate, 'utf8').split(/\r?\n/)
          .filter(line => line.includes('[GRAFICO]')).slice(-8).join('\n'))
      }
    }
    assert(render && fs.existsSync(render) && fs.statSync(render).size > 0)
    console.log('OK renderer productivo/QC/MP4 offline')
    console.log(`NETWORK_ATTEMPTS_BLOCKED=${networkAttempts}`)
    finished = true
    await finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    await finish(1)
  }
}).catch(async error => { console.error(error && error.stack || error); await finish(1) })
