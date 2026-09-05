/** A.5: evidencia visual del banco. No interpreta ni puntua los cuatro pares. */
const { app, BrowserWindow, session } = require('electron')
const fs = require('fs'), path = require('path'), os = require('os')
const raiz = path.resolve(process.argv[2] || path.join(__dirname, '../..'))
const salida = path.resolve(process.argv[3] || path.join(raiz, 'tests/aceptacion/plan-a5-20260905'))
const rangos = ['dispersionX', 'dispersionY', 'curva', 'escalaHero']
app.on('window-all-closed', () => {})
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-a5-perfil-')))
const comprobarArtefacto = archivo => {
  if (!fs.existsSync(archivo) || fs.statSync(archivo).size === 0)
    throw new Error(`Artefacto ausente o vacio: ${archivo}`)
}
app.whenReady().then(async () => {
  let codigo = 1, ventana
  try {
    fs.mkdirSync(salida, { recursive: true })
    session.defaultSession.webRequest.onBeforeRequest((_r, cb) => {
      const u = new URL(_r.url)
      cb({ cancel: !(['file:', 'data:', 'devtools:'].includes(u.protocol) ||
        ((u.protocol === 'http:' || u.protocol === 'ws:') && u.hostname === '127.0.0.1' && u.port === '5174')) })
    })
    ventana = new BrowserWindow({ show: false, width: 2520, height: 1600, useContentSize: true,
      webPreferences: { sandbox: true, backgroundThrottling: false } })
    for (const rango of rangos) {
      await ventana.loadURL(`http://127.0.0.1:5174/banco.html?vista=pareja&estructura=constelacion&rango=${rango}&t=1.500`)
      await ventana.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const inicio = performance.now(); const comprobar = () => {
          if (document.querySelector('.pareja-rejilla') && !document.querySelector('.hoja-fixture.miente')) resolve(true)
          else if (performance.now() - inicio > 10_000) reject(new Error('Banco no listo: ${rango}'))
          else setTimeout(comprobar, 50)
        }; comprobar()
      })`)
      // PAREJA no publica guarda de fuentes: espera de inspeccion, no prueba de completitud.
      await ventana.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => new Promise(r => setTimeout(r, 100)))')
      const archivo = path.join(salida, `pareja-${rango}-45pct-t1.500.png`)
      fs.writeFileSync(archivo, (await ventana.webContents.capturePage()).toPNG())
      comprobarArtefacto(archivo)
      console.log(`${rango}: ${fs.statSync(archivo).size} bytes`)
    }
    codigo = 0
  } catch (e) { console.error(e.stack || String(e)) }
  finally {
    if (ventana && !ventana.isDestroyed()) ventana.destroy()
    app.exit(codigo)
  }
})
