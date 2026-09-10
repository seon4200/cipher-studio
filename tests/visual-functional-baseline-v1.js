const { app, BrowserWindow, ipcMain, session } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('visual-functional-baseline-v1')
const CASOS_ESPERADOS = 12
let completed = 0
let finished = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

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
  return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0])))
}

function invoke (channel, payload) {
  const handler = ipcMain._invokeHandlers.get(channel)
  if (!handler) throw new Error('Handler ausente: ' + channel)
  return handler({ sender: { isDestroyed: () => false, send: () => {} } }, payload)
}

function waitForMainWindow () {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const tick = () => {
      if (BrowserWindow.getAllWindows().some(window => !window.isDestroyed() && !window.webContents.isOffscreen())) return resolve()
      if (++attempts > 120) return reject(new Error('Ventana principal no disponible'))
      setTimeout(tick, 100)
    }
    tick()
  })
}

async function runCase (name, fn) {
  await fn()
  completed += 1
  console.log('OK ' + name)
}

function write (file, value = 'fixture') {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value, 'utf8')
}

function modernContext (bundle, sceneId = 'parity-football') {
  const localSemantic = bundle.createLocalSceneSemanticV1({
    sceneId,
    start: 10,
    end: 12,
    transcriptSegments: [{
      start: 9,
      end: 13,
      text: 'el fútbol tiene ese poder',
      words: [
        { word: 'el', start: 9.8, end: 10 },
        { word: 'fútbol', start: 10.1, end: 10.6 },
        { word: 'tiene', start: 10.7, end: 11 },
        { word: 'ese', start: 11.1, end: 11.3 },
        { word: 'poder', start: 11.4, end: 11.9 },
      ],
    }],
    concepts: [{ label: 'fútbol', emoji: '⚽' }],
    anchor: 'fútbol',
    globalText: 'El párrafo completo no sustituye el contexto temporal local.',
    globalHints: ['fútbol'],
    globalContextRef: 'fixture:football',
  })
  return bundle.createModernVisualGenerationContextV1({
    sceneId,
    duration: 1,
    localSemantic,
    keywordCandidates: [{ keyword: 'fútbol', source: 'scene-semantic' }],
    preferredVisualMode: 'auto',
    sistema: 'editorial',
    direction: {
      fondo: 'ondas', estructura: 'constelacion', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', semilla: 51001,
    },
  })
}

function restore () {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
}

async function finish (code) {
  restore()
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => {
  if (!finished) {
    console.error(`FALLO: CASOS_COMPLETADOS=${completed} CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
    process.exitCode = 1
  }
})

app.whenReady().then(async () => {
  const realBefore = snapshotRealProjects()
  const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
  try {
    const originals = path.join(FIXTURE_ROOT, 'project', 'materiales', 'originales')
    const source = path.join(originals, 'fuente_recortada.mp4')
    write(source, 'source-recortada')
    write(path.join(originals, 'clip_001.mp4'), 'stale-1')
    write(path.join(originals, 'clip_002.mp4'), 'stale-2')
    write(path.join(originals, 'nota-ajena.txt'), 'keep')

    await runCase('1 fuente_recortada dentro de originales queda protegida', async () => {
      const result = await bundle.prepareOriginalClipSegmentation({ inputPath: source, outputDir: originals })
      assert.equal(fs.existsSync(source), true)
      assert.equal(result.preservedInputInsideOutputDir, true)
      assert.equal(result.removedClipOutputs.length, 2)
    })
    await runCase('2 limpieza elimina sólo clip_*.mp4 y conserva archivos ajenos', () => {
      assert.equal(fs.existsSync(path.join(originals, 'clip_001.mp4')), false)
      assert.equal(fs.existsSync(path.join(originals, 'clip_002.mp4')), false)
      assert.equal(fs.readFileSync(path.join(originals, 'nota-ajena.txt'), 'utf8'), 'keep')
    })
    await runCase('3 input externo no se toca al limpiar el directorio de segmentos', async () => {
      const external = path.join(FIXTURE_ROOT, 'external-source.mp4')
      write(external, 'external')
      write(path.join(originals, 'clip_003.mp4'), 'stale-3')
      await bundle.prepareOriginalClipSegmentation({ inputPath: external, outputDir: originals })
      assert.equal(fs.readFileSync(external, 'utf8'), 'external')
      assert.equal(fs.existsSync(path.join(originals, 'clip_003.mp4')), false)
    })
    await runCase('4 input inexistente falla antes de limpiar clips anteriores', async () => {
      const stale = path.join(originals, 'clip_004.mp4')
      write(stale, 'must-survive')
      await assert.rejects(
        () => bundle.prepareOriginalClipSegmentation({ inputPath: path.join(originals, 'missing.mp4'), outputDir: originals }),
        error => error?.code === 'ORIGINAL_SEGMENT_INPUT_MISSING',
      )
      assert.equal(fs.readFileSync(stale, 'utf8'), 'must-survive')
    })
    await runCase('5 un input con nombre de output propio nunca se elimina', async () => {
      const inputLooksLikeOutput = path.join(originals, 'clip_004.mp4')
      write(path.join(originals, 'clip_005.mp4'), 'stale')
      await bundle.prepareOriginalClipSegmentation({ inputPath: inputLooksLikeOutput, outputDir: originals })
      assert.equal(fs.existsSync(inputLooksLikeOutput), true)
      assert.equal(fs.existsSync(path.join(originals, 'clip_005.mp4')), false)
    })
    await runCase('6 segunda segmentación sustituye sólo outputs previos', async () => {
      write(path.join(originals, 'clip_006.mp4'), 'fresh-stale')
      await bundle.prepareOriginalClipSegmentation({ inputPath: source, outputDir: originals })
      assert.equal(fs.existsSync(source), true)
      assert.equal(fs.existsSync(path.join(originals, 'clip_006.mp4')), false)
      assert.equal(fs.existsSync(path.join(originals, 'nota-ajena.txt')), true)
    })

    const projectRoot = path.join(FIXTURE_ROOT, 'modern-project')
    bundle.createProjectFiles(projectRoot, { id: 'modern-parity', clips: [], timelineVideoClips: [], aiScript: 'fixture' })
    const loaded = await invoke('load-project', { projectPath: projectRoot })
    if (!loaded.success) throw new Error('No se pudo cargar el proyecto temporal: ' + loaded.error)
    const context = modernContext(bundle)
    const normal = bundle.resolveModernVisualGenerationBatchV1({ contexts: [context], projectRoot })[0]
    const serialized = JSON.parse(JSON.stringify(context))
    const regenerated = bundle.resolveModernVisualGenerationBatchV1({ contexts: [serialized], projectRoot })[0]

    await runCase('7 generación y regeneración moderna comparten la misma sceneSpec canónica', () => {
      assert.equal(bundle.sceneSpecPixelIdentity(normal.resolved.compiled.sceneSpec),
        bundle.sceneSpecPixelIdentity(regenerated.resolved.compiled.sceneSpec))
      assert.equal(normal.resolved.decision.hero?.stableId, 'openmoji:26bd')
    })
    await runCase('8 una misma sceneSpec conserva identidad y hash', () => {
      const graphic = normal.resolved.compiled.graphicData
      const hashBefore = bundle.hashGrafico(graphic, 540, 960, 1, 8, 'pantalla', 'editorial')
      const hashAfter = bundle.hashGrafico(regenerated.resolved.compiled.graphicData, 540, 960, 1, 8, 'pantalla', 'editorial')
      assert.equal(hashBefore, hashAfter)
    })
    await runCase('9 legacy sin sceneSpec sigue por la vía legacy', () => {
      const legacy = bundle.prepareGraphicForVisualRender({ graphicData: { type: 'decorativo_emoji', value: 'x' } })
      assert.equal(legacy.kind, 'legacy')
    })

    let startupNetworkAttempts = 0
    global.fetch = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA') }
    http.request = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA') }
    https.request = () => { networkAttempts += 1; throw new Error('RED BLOQUEADA') }
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttempts += 1; callback({ cancel: true }) } else callback({ cancel: false })
    })
    await new Promise(resolve => setTimeout(resolve, 1200))
    startupNetworkAttempts = networkAttempts
    await waitForMainWindow()
    const normalRender = await bundle.renderGraphicClipsLote([{
      graphicData: normal.resolved.compiled.graphicData,
      renderBindings: normal.resolved.compiled.renderBindings,
      projectRoot,
      diagnosticSceneId: normal.resolved.decision.sceneId,
      duracion: context.duration,
    }], {
      aspectRatio: 'vertical', resolution: '720p', fps: 30, modo: 'pantalla', sistema: context.sistema,
    })
    const normalPath = normalRender.rutas[0]
    if (!normalPath || !fs.existsSync(normalPath)) throw new Error('El render normal de control no produjo un MP4')
    const normalOutputSha = sha256(normalPath)
    const rendered = await invoke('regenerate-graphics', {
      mode: 'modern-visual', aspectRatio: 'vertical', resolution: '720p',
      modernVisuals: [{ clipId: 'timeline-modern-parity', context: serialized }],
    })
    await runCase('10 normal y regenerate-graphics moderno conservan hash y píxeles sin LLM ni red', () => {
      assert.equal(rendered.success, true)
      assert.equal(rendered.mode, 'modern-visual')
      assert.equal(rendered.clips.length, 1)
      assert.equal(rendered.clips[0].success, true)
      assert.equal(fs.existsSync(rendered.clips[0].path), true)
      assert.equal(normalRender.hashes[0], bundle.hashGrafico(
        regenerated.resolved.compiled.graphicData, 720, 1280, context.duration, 30, 'pantalla', context.sistema))
      assert.equal(rendered.clips[0].path, normalPath)
      assert.equal(sha256(rendered.clips[0].path), normalOutputSha)
      assert.equal(networkAttempts, startupNetworkAttempts)
      console.log(`PIXEL_PARITY hash=${normalRender.hashes[0]} outputSha=${normalOutputSha} pixelDiff=0`)
    })
    await runCase('11 métrica de variedad es determinista y mide sólo materializados', () => {
      const observations = [
        { materialized: true, sceneSpec: normal.resolved.compiled.sceneSpec },
        { materialized: true, sceneSpec: regenerated.resolved.compiled.sceneSpec },
        { materialized: false, sceneSpec: regenerated.resolved.compiled.sceneSpec },
      ]
      const first = bundle.measureVisualVarietyV1(observations)
      const second = bundle.measureVisualVarietyV1(observations)
      assert.deepEqual(first, second)
      assert.equal(first.materializedVisuals, 2)
      assert.equal(first.distinctHeroPlacements, 1)
      assert.equal(first.distinctKeywordTypefaces, 1)
    })
    await runCase('12 ningún proyecto real cambia ni aparece fixture en el repositorio', () => {
      assert.equal(snapshotRealProjects(), realBefore)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, '.cipher-test-fixture')), false)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json')), false)
      assert.equal(fs.existsSync(path.join(REPO_ROOT, 'project-state.json.bak')), false)
    })

    assert.equal(completed, CASOS_ESPERADOS)
    console.log(`CASOS_COMPLETADOS=${completed}`)
    console.log(`CASOS_ESPERADOS=${CASOS_ESPERADOS}`)
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
