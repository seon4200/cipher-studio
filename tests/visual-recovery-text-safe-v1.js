// Contract stress only: exercises every V15 family against the opt-in text renderer.
// Final acceptance uses the semantic materializer; these constructed specs test geometry in isolation.
const { app, BrowserWindow, session } = require('electron')
const assert = require('assert/strict')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const { sceneSpecV15, graphicForV15 } = require('./helpers/motion-graphics-v15-fixture')

const repo = path.resolve(__dirname, '..')
const fixture = createTestFixture('visual-recovery-text-safe-v1')
let window, bundle
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.setPath('userData', path.join(fixture, 'user-data'))
process.chdir(fixture)

const descriptors = [
  { slotId: 'hero', solarIcon: 'planet-3-linear', solarStyle: 'linear' },
  { slotId: 'support-1', solarIcon: 'clock-circle-linear', solarStyle: 'linear' },
  { slotId: 'support-2', solarIcon: 'document-linear', solarStyle: 'linear' },
]
const cases = [
  { keyword: 'INCONSTITUCIONALIDAD', connector: null, closing: null },
  { keyword: 'EXTRAORDINARIAMENTE', connector: null, closing: '¿QUÉ PASÓ REALMENTE?' },
  { keyword: 'INTELIGENCIA ARTIFICIAL', connector: 'Un científico', closing: 'en 2026' },
  { keyword: '72%', connector: 'El resultado confirmado', closing: '¿QUÉ PASÓ REALMENTE?' },
]
const clone = value => JSON.parse(JSON.stringify(value))
async function finish (code) {
  try { window?.destroy() } catch {}
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(fixture)) } catch {}
  try { cleanupTestFixture(fixture) } catch (error) { console.error('FIXTURE_RETAINED', error.message) }
  app.exit(code)
}
app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: /^https?:/i.test(details.url) }))
    bundle = require(path.join(repo, 'dist-electron', 'main', 'index.js'))
    window = new BrowserWindow({ show: false, width: 970, height: 970,
      webPreferences: { sandbox: false, contextIsolation: false } })
    await window.loadFile(path.join(repo, 'dist', 'grafico.html'))
    await window.webContents.executeJavaScript('document.fonts.ready')
    let checked = 0
    const failures = []
    for (const family of bundle.MODERN_LAYOUT_STRUCTURES_V4) {
      const mode = family === 'editorial' ? 'editorial-text' : 'asset-led'
      const rule = bundle.LAYOUT_ELIGIBILITY_V4[family]
      const counts = Array.from({ length: rule.maxSupports - rule.minSupports + 1 },
        (_, index) => rule.minSupports + index)
      for (const count of counts) {
        const slots = family === 'editorial' ? [] : descriptors.slice(0, count + 1)
        for (const example of cases) {
          const original = sceneSpecV15(bundle, slots, { family, visualMode: mode, seed: 19017,
            keyword: example.keyword, connector: example.connector, closing: example.closing })
          const spec = clone(original)
          spec.presentationProfile = bundle.VISUAL_RECOVERY_PROFILE_V1
          spec.editorialMotionCue = /^72%$/.test(example.keyword) ? 'datum' : 'protagonist'
          spec.backgroundProfile = bundle.materializeBackgroundProfileV1('solid-black-v1')
          spec.layout = bundle.createVisualRecoveryLayoutV1(family, mode, count, 19017, spec.editorialMotionCue)
          spec.text.alignment = spec.layout.textAlignment
          const validated = bundle.validateVisualSceneSpecV2(spec)
          for (const [width, height] of [[540, 960], [960, 540]]) {
            const result = await window.webContents.executeJavaScript(`(async()=>{
              await window.__montar(${JSON.stringify(graphicForV15(validated))},${JSON.stringify({
                ancho: width, alto: height, modo: 'pantalla', duracion: 2, sistema: 'editorial',
              })}); window.__setT(1.2); return window.__visualQc(); })()`)
            checked++
            const findings = bundle.evaluateVisualDomQc(validated,
              [{ normalizedTime: .6, ...result }]).filter(item => item.level === 'error')
            if (result.textFitFailed || result.textOverflow || result.keywordOverflow ||
                findings.length) failures.push({
              family, count, keyword: example.keyword, width, height,
              fit: result.textFitStage, diagnostic: result.textFitDiagnostic,
              overflow: result.textOverflow, keywordOverflow: result.keywordOverflow,
              findings: findings.map(item => item.code),
              textRect: result.text, keywordRect: result.keyword,
              frameRect: result.frame,
              assetRects: result.assets?.map(item => [item.role, item.rect]),
            })
          }
        }
      }
    }
    console.log('VISUAL_RECOVERY_TEXT_SAFE', JSON.stringify({ checked, families: 17, failures }))
    assert.equal(failures.length, 0)
    await finish(0)
  } catch (error) { console.error(error); await finish(1) }
}).catch(async error => { console.error(error); await finish(1) })
