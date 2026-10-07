const { app, session } = require('electron')
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = path.resolve(process.env.CIPHER_HISTORICAL_V15_OUTPUT || path.join(__dirname, 'historical-v15-current.png'))
const FIXTURE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-historical-v15-'))
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
let finished = false

function blockNetwork () { throw new Error('HISTORICAL_V15_NETWORK_FORBIDDEN') }

async function finish (code) {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  try { process.chdir(os.tmpdir()) } catch {}
  try { fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true, maxRetries: 8, retryDelay: 80 }) } catch {}
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

app.whenReady().then(async () => {
  try {
    global.fetch = blockNetwork
    http.request = blockNetwork
    https.request = blockNetwork
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback(/^https?:/i.test(details.url) ? { cancel: true } : { cancel: false })
    })
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    const { sceneSpecV15, graphicForV15, bindingsForV15 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'motion-graphics-v15-fixture'))
    bundle.createProjectFiles(PROJECT_ROOT, {
      id: 'historical-v15-compat', clips: [], timelineVideoClips: [], aiScript: 'Historical V15 compatibility fixture',
    })
    const soccer = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:26bd' }).asset
    const stadium = bundle.publishOpenMojiAsset({ projectRoot: PROJECT_ROOT, stableId: 'openmoji:1f3df' }).asset
    const descriptors = [{ slotId: 'hero', asset: soccer }, { slotId: 'support-1', asset: stadium }]
    const spec = sceneSpecV15(bundle, descriptors, {
      family: 'partidoVertical', keyword: 'FÚTBOL', connector: 'el', closing: 'une al estadio',
      sceneId: 'historical-v15-black-foundation-control', seed: 91515, typographyLookId: 'sport-condensed',
    })
    if (Object.prototype.hasOwnProperty.call(spec, 'backgroundProfile')) throw new Error('HISTORICAL_V15_PROFILE_MUST_BE_ABSENT')
    const clip = await bundle.renderGraphicClip(graphicForV15(spec), {
      ancho: 540, alto: 960, fps: 8, duracion: 1, modo: 'pantalla', sistema: 'editorial',
      projectRoot: PROJECT_ROOT, renderBindings: bindingsForV15(descriptors),
    })
    if (!clip || !fs.existsSync(clip)) throw new Error('HISTORICAL_V15_RENDER_FAILED')
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.55', '-i', clip,
      '-frames:v', '1', '-vf', 'scale=540:960', OUTPUT], { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 })
    const identitySha = crypto.createHash('sha256').update(bundle.sceneSpecPixelIdentityAny(spec)).digest('hex')
    console.log(`HISTORICAL_V15_IDENTITY_SHA256=${identitySha}`)
    console.log(`HISTORICAL_V15_OUTPUT=${OUTPUT}`)
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
