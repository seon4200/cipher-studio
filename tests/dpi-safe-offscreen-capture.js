const { app, ipcMain } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const root = path.resolve(__dirname, '..')
const fixture = createTestFixture('dpi-safe-capture')
app.setPath('userData', path.join(fixture, 'userData'))
process.chdir(fixture)

app.whenReady().then(async () => {
  try {
    const bundle = require(path.join(root, 'dist-electron/main/index.js'))
    const classify = bundle.classifyGraphicsCapture
    assert.equal(classify(1080, 1928, 1080, 1928, 1).code, 'CAPTURE_EXACT_SIZE')
    assert.equal(classify(1080, 1928, 2430, 4338, 2.25).code, 'CAPTURE_UNIFORM_DPI_SCALE')
    assert.equal(classify(1080, 1928, 2430, 4000, 2.25).code, 'CAPTURE_ASPECT_MISMATCH')
    assert.equal(classify(1080, 1928, 2429, 4338, 2.25).code, 'CAPTURE_NON_UNIFORM_SCALE')
    assert.equal(classify(1080, 1928, 900, 1928, 1).code, 'CAPTURE_UNDERSIZED')
    assert.equal(classify(1080, 1928, 0, 0, 1, true).code, 'CAPTURE_EMPTY')
    assert.throws(() => bundle.requireExactGraphicsCapture(classify(1080, 1928, 2430, 4338, 2.25)),
      /CAPTURE_UNIFORM_DPI_SCALE/)

    const project = await ipcMain._invokeHandlers.get('create-project')(
      { sender: { send: () => {} } }, { name: 'dpi-safe-temp' })
    const clip = await bundle.renderGraphicClip(
      { type: 'decorativo_emoji', value: '📷', label: 'CÁMARA' },
      { ancho: 360, alto: 640, fps: 8, duracion: 0.75, modo: 'overlay' },
    )
    assert(clip && fs.statSync(clip).size > 0)
    assert(path.resolve(clip).startsWith(path.resolve(project.projectPath) + path.sep))
    console.log('DPI_SAFE_CAPTURE_PASS scale=' + require('electron').screen.getPrimaryDisplay().scaleFactor)
    bundle.cerrarVentanaGraficos()
    process.chdir(path.dirname(fixture))
    cleanupTestFixture(fixture)
    app.exit(0)
  } catch (error) {
    console.error(error)
    process.chdir(path.dirname(fixture))
    try { cleanupTestFixture(fixture) } catch {}
    app.exit(1)
  }
})
