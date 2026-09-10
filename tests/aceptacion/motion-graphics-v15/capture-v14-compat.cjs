const { app, session } = require('electron')
const { execFileSync } = require('child_process')
const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')

const SCRIPT_REPO_ROOT = path.resolve(__dirname, '../../..')
const TARGET_REPO_ROOT = path.resolve(process.env.CIPHER_COMPAT_REPO_ROOT || SCRIPT_REPO_ROOT)
const OUTPUT = path.resolve(process.env.CIPHER_COMPAT_OUTPUT || path.join(__dirname, 'v14-compat.png'))
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-v14-compat-'))
const projectRoot = path.join(fixtureRoot, 'project')
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let finished = false

function blockNetwork () { throw new Error('V14_COMPAT_NETWORK_FORBIDDEN') }

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { process.chdir(os.tmpdir()) } catch {}
  try { fs.rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 80 }) } catch {}
  app.exit(code)
}

app.setPath('userData', path.join(fixtureRoot, 'electron-user-data'))
process.chdir(fixtureRoot)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

app.whenReady().then(async () => {
  try {
    global.fetch = blockNetwork
    http.request = blockNetwork
    https.request = blockNetwork
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback(/^https?:/i.test(details.url) ? { cancel: true } : { cancel: false })
    })
    const bundle = require(path.join(TARGET_REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    const { sceneSpec, graphicFor, bindingsFor } = require(path.join(SCRIPT_REPO_ROOT, 'tests', 'helpers', 'visual-mvp-fixture.js'))
    bundle.createProjectFiles(projectRoot, { id: 'v14-compat', clips: [], timelineVideoClips: [], aiScript: 'V14 compatibility fixture' })
    const asset = bundle.publishOpenMojiAsset({ projectRoot, stableId: 'openmoji:26bd' }).asset
    const spec = sceneSpec(bundle, asset, {
      estructura: 'partidoVertical',
      keyword: 'FÚTBOL',
      connector: 'el',
      closing: 'une al estadio',
      treatment: 'duotone',
      semilla: 61014,
      fondo: 'ondas',
    })
    const clip = await bundle.renderGraphicClip(graphicFor(spec), {
      ancho: 540,
      alto: 960,
      fps: 8,
      duracion: 1,
      modo: 'pantalla',
      sistema: 'editorial',
      projectRoot,
      renderBindings: bindingsFor(asset),
    })
    if (!clip || !fs.existsSync(clip)) throw new Error('V14_COMPAT_RENDER_FAILED')
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.55', '-i', clip,
      '-frames:v', '1', '-vf', 'scale=540:960', OUTPUT], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
    console.log(`V14_COMPAT_VERSION=${bundle.VERSION_PLANTILLAS}`)
    console.log(`V14_COMPAT_OUTPUT=${OUTPUT}`)
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
