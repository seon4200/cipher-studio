// Generates the legacy visual baseline from an explicitly selected, already-built checkout.
// Usage: electron capturar-legacy-baseline.cjs CHECKOUT_ROOT OUTPUT_PNG
const { app, BrowserWindow, session } = require('electron')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const checkoutRoot = path.resolve(process.argv[2] || '')
const outputFile = path.resolve(process.argv[3] || '')
const fixtureRoot = createTestFixture('visual-mvp-legacy-baseline')
app.setPath('userData', path.join(fixtureRoot, 'electron-user-data'))
app.on('window-all-closed', () => {})

const graphic = {
  type: 'visual_escena',
  value: 'memoria',
  extra: {
    conceptos: [
      { emoji: '🧠', etiqueta: 'recuerdo' },
      { emoji: '🗂️', etiqueta: 'archivo' },
      { emoji: '🔗', etiqueta: 'conexion' },
    ],
    direccion: {
      fondo: 'ondas', estructura: 'constelacion', camara: 'quieto',
      densidad: 'media', ritmo: 'simultaneo', tipografia: 'archivo',
    },
  },
}

let window
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: /^https?:/i.test(details.url) })
  })
  window = new BrowserWindow({
    show: false, width: 1080, height: 1928, useContentSize: true, frame: false,
    enableLargerThanScreen: true, transparent: true, backgroundColor: '#00000000',
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false },
  })
  await window.loadFile(path.join(checkoutRoot, 'dist', 'grafico.html'))
  window.setContentSize(1080, 1928)
  const ready = await window.webContents.executeJavaScript('window.__listo()')
  if (ready.avisosFuentes.length) throw new Error('Fuentes no listas: ' + JSON.stringify(ready.avisosFuentes))
  await window.webContents.executeJavaScript(
    `window.__montar(${JSON.stringify(graphic)},${JSON.stringify({ ancho: 1080, alto: 1920, modo: 'pantalla', duracion: 3, sistema: 'voltaje' })});window.__setT(1.5)`,
  )
  await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>new Promise(r=>setTimeout(r,200)))')
  const image = await window.webContents.capturePage({ x: 0, y: 8, width: 1080, height: 1920 })
  if (image.getSize().width !== 1080 || image.getSize().height !== 1920) throw new Error('Captura legacy incompleta')
  fs.writeFileSync(outputFile, image.toPNG())
  console.log(JSON.stringify({ checkoutRoot, outputFile, bytes: fs.statSync(outputFile).size }))
}).then(() => {
  window?.destroy()
  try { cleanupTestFixture(fixtureRoot) } catch (error) { console.error(error) }
  app.exit(0)
}).catch(error => {
  console.error(error && error.stack || error)
  try { window?.destroy() } catch {}
  try { cleanupTestFixture(fixtureRoot) } catch (cleanupError) { console.error(cleanupError) }
  app.exit(1)
})
