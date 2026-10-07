const { app, BrowserWindow, dialog, ipcMain, session, screen } = require('electron')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const repo = path.resolve(__dirname, '../../..')
const fixture = createTestFixture('dpi-safe-production')
const project = path.join(fixture, 'project')
const evidence = path.resolve(process.env.CIPHER_DPI_EVIDENCE_DIR || path.join(repo, '..', '_dpi-safe-probe'))
const exported = path.join(fixture, 'final.mp4')
const beforeFetch = global.fetch
const beforeHttp = http.request
const beforeHttps = https.request
const beforeDeepSeek = process.env.DEEPSEEK_API_KEY
let deepSeekCalls = 0

app.setPath('userData', path.join(fixture, 'electron-user-data'))
process.chdir(fixture)

const segments = [
  { start: 0, end: 2, text: 'Cámara y robot.', words: [
    { word: 'Cámara', start: 0.1, end: 0.7 }, { word: 'y', start: 0.8, end: 0.9 },
    { word: 'robot.', start: 1.0, end: 1.7 },
  ] },
  { start: 2, end: 4, text: 'Resultado y peligro.', words: [
    { word: 'Resultado', start: 2.1, end: 2.8 }, { word: 'y', start: 2.9, end: 3.0 },
    { word: 'peligro.', start: 3.1, end: 3.8 },
  ] },
  { start: 4, end: 6, text: 'Ciudad.', words: [
    { word: 'Ciudad.', start: 4.1, end: 5.5 },
  ] },
]

const concepts = [
  [{ label: 'cámara', emoji: '📷' }, { label: 'robot', emoji: '🤖' }],
  [{ label: 'resultado', emoji: '📊' }, { label: 'peligro', emoji: '⚠️' }],
  [{ label: 'ciudad', emoji: '🏙️' }],
]

function semanticResponse () {
  return { phrases: segments.map((segment, index) => ({
    phraseIndex: index + 1,
    visualClips: [{
      keyword: ['cámara', 'resultado', 'ciudad'][index],
      timestamp: segment.start + 0.1, duration: 2,
      prompt: segment.text, conceptos: concepts[index].map(concept => ({
        icono: 'semantic-hint', ic: concept.emoji, etiqueta: concept.label,
      })),
      semantica: { relacion: 'asociación', ancla: {
        icono: 'semantic-hint', ic: concepts[index][0].emoji, etiqueta: concepts[index][0].label,
      }, terminos: concepts[index].map(concept => ({
        icono: 'semantic-hint', ic: concept.emoji, etiqueta: concept.label,
      })) },
    }],
  })) }
}

async function invoke (channel, payload) {
  const handler = ipcMain._invokeHandlers.get(channel)
  assert(handler, `IPC missing: ${channel}`)
  return handler({ sender: { isDestroyed: () => false, send: () => {} } }, payload)
}

async function finish (code) {
  global.fetch = beforeFetch
  http.request = beforeHttp
  https.request = beforeHttps
  if (beforeDeepSeek === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = beforeDeepSeek
  process.chdir(path.dirname(fixture))
  try { cleanupTestFixture(fixture) } catch (error) { console.error('Temporary fixture retained:', error.message) }
  app.exit(code)
}

app.whenReady().then(async () => {
  try {
    const scaleLabel = String(screen.getPrimaryDisplay().scaleFactor)
    process.env.DEEPSEEK_API_KEY = 'offline-dpi-fixture'
    global.fetch = async url => {
      if (String(url).startsWith('https://api.deepseek.com/chat/completions')) {
        deepSeekCalls++
        return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: {
          content: JSON.stringify(semanticResponse()),
        } }] }) }
      }
      throw new Error('DPI_ACCEPTANCE_NETWORK_FORBIDDEN')
    }
    http.request = () => { throw new Error('DPI_ACCEPTANCE_NETWORK_FORBIDDEN') }
    https.request = () => { throw new Error('DPI_ACCEPTANCE_NETWORK_FORBIDDEN') }
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: /^https?:/i.test(details.url) }))

    const bundle = require(path.join(repo, 'dist-electron/main/index.js'))
    bundle.createProjectFiles(project, { id: 'dpi-safe-temporary', clips: [], timelineVideoClips: [],
      aiScript: 'Cámara, robot, resultado, peligro y ciudad.' })
    const loaded = await invoke('load-project', { projectPath: project })
    assert.equal(loaded.success, true, loaded.error)
    const source = path.join(fixture, 'source.mp4')
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
      'color=c=black:s=540x960:r=10:d=6.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source])

    const generated = await invoke('generate-timeline-assets', {
      scriptText: 'Cámara, robot, resultado, peligro y ciudad.', audioDuration: 6,
      transcriptSegments: segments, videoPath: source,
      weights: [0, 0, 0, 100], iaStyle: 'editorial', aspectRatio: 'vertical',
      graphicsPercent: 100, newAudioSegments: segments,
    })
    assert.equal(generated.success, true, generated.error)
    const visualClips = generated.clips.filter(clip => clip.category === 'visual')
    const diagnosticDir = path.join(project, 'materiales', 'diagnostics', 'visual-decisions')
    const diagnosticFile = fs.readdirSync(diagnosticDir).filter(file => file.endsWith('.json')).sort().at(-1)
    const diagnostic = JSON.parse(fs.readFileSync(path.join(diagnosticDir, diagnosticFile), 'utf8'))
    assert(diagnostic.summary.requestedVisuals >= 3, 'at least 3 visuals planned')
    assert(diagnostic.scenes.filter(scene => scene.sceneSpecIdentity).length >= 3, 'at least 3 SceneSpecs')
    assert(visualClips.length >= 3, 'at least 3 timeline visuals')
    assert(visualClips.every(clip => fs.existsSync(clip.path) && fs.statSync(clip.path).size > 0),
      'all visual files exist')
    for (const clip of visualClips) {
      const dimensions = JSON.parse(execFileSync('ffprobe', [
        '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
        '-of', 'json', clip.path,
      ], { encoding: 'utf8' }))
      assert.equal(dimensions.streams[0].width, 1080)
      assert.equal(dimensions.streams[0].height, 1920)
    }
    assert.equal(diagnostic.summary.reasons?.['visual-sin-fichero'] || 0, 0)
    assert.equal(deepSeekCalls, 1)

    fs.mkdirSync(evidence, { recursive: true })
    const clipEvidence = visualClips.map((clip, index) => {
      const destination = path.join(evidence, `raw-visual-${scaleLabel}-${index + 1}.mp4`)
      fs.copyFileSync(clip.path, destination)
      return { index: index + 1, name: clip.name, startSeconds: clip.startSeconds,
        durationSeconds: clip.durationSeconds, bytes: fs.statSync(destination).size, file: destination }
    })

    for (let attempt = 0; attempt < 50 && !BrowserWindow.getAllWindows().some(win => !win.isDestroyed()); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: exported })
    const exportResult = await invoke('export-video', {
      clips: generated.clips, aspectRatio: 'vertical', resolution: '720p',
      format: 'mp4', quality: 'medium', assignedTransitions: {}, transitionDuration: 0.5,
      ajustesVideo: {},
    })
    assert.equal(exportResult.success, true, exportResult.error)
    assert(fs.statSync(exported).size > 0)
    const output = path.join(evidence, `acceptance-dpi-${scaleLabel}.mp4`)
    fs.copyFileSync(exported, output)
    const report = {
      scale: screen.getPrimaryDisplay().scaleFactor,
      planned: diagnostic.summary.requestedVisuals,
      sceneSpecs: diagnostic.scenes.filter(scene => scene.sceneSpecIdentity).length,
      visualFiles: visualClips.length, timelineVisualClips: visualClips.length,
      visualSinFichero: diagnostic.summary.reasons?.['visual-sin-fichero'] || 0,
      sceneIdentities: diagnostic.scenes.map(scene => scene.sceneSpecIdentity).filter(Boolean),
      clips: clipEvidence,
      finalMp4: output, finalMp4Bytes: fs.statSync(output).size,
    }
    fs.writeFileSync(path.join(evidence, `acceptance-dpi-${scaleLabel}.json`), JSON.stringify(report, null, 2))
    console.log('DPI_PRODUCTION_ACCEPTANCE=' + JSON.stringify(report))
    bundle.cerrarVentanaGraficos()
    await finish(0)
  } catch (error) {
    console.error(error && error.stack || error)
    await finish(1)
  }
})
