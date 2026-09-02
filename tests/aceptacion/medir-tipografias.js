const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('fs')
const { createHash } = require('crypto')
const path = require('path')

const raiz = path.resolve(__dirname, '../..')
const destino = path.join(__dirname, 'fixtures/metricas-tipografias.json')
const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑabcdefghijklmnopqrstuvwxyzáéíóúüñ0123456789'
const caras = [
  { id: 'archivo', familia: 'Archivo', peso: 800, transformacion: 'none', fichero: 'archivo-var.woff2' },
  { id: 'anton', familia: 'Anton', peso: 400, transformacion: 'uppercase', fichero: 'anton-400.woff2' }
]
let ventana
const vigilancia = setTimeout(() => {
  console.error('FALLO: medicion bloqueada durante 30 segundos')
  app.exit(1)
}, 30000)

app.whenReady().then(async () => {
  let codigo = 0
  try {
    ventana = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    ventana.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (_peticion, responder) => responder({ cancel: true })
    )
    await ventana.loadFile(path.join(raiz, 'dist/grafico.html'))
    const listo = await ventana.webContents.executeJavaScript('window.__listo()')
    if (listo.avisosFuentes.length) throw new Error(listo.avisosFuentes.join('\n'))
    const medidas = await ventana.webContents.executeJavaScript(`(async () => {
      const caras = ${JSON.stringify(caras)}
      const alfabeto = ${JSON.stringify(alfabeto)}
      const resultado = []
      for (const cara of caras) {
        const caracteres = [...new Set(cara.transformacion === 'uppercase'
          ? alfabeto.toUpperCase() : alfabeto)]
        await document.fonts.load(cara.peso + ' 1000px "' + cara.familia + '"', caracteres.join(''))
        await document.fonts.ready
        const span = document.createElement('span')
        span.style.cssText = 'position:absolute;white-space:nowrap;letter-spacing:normal;' +
          'font:' + cara.peso + ' 1000px "' + cara.familia + '",sans-serif'
        document.body.appendChild(span)
        try {
          const anchosEm = {}
          for (const caracter of caracteres) {
            span.textContent = caracter
            anchosEm[caracter] = span.getBoundingClientRect().width / 1000
          }
          const emPorCaracter = Math.max(...Object.values(anchosEm))
          resultado.push({ ...cara, anchosEm, emPorCaracter,
            caracterMasAncho: caracteres.find(c => anchosEm[c] === emPorCaracter) })
        } finally { span.remove() }
      }
      return resultado
    })()`)
    const resultado = {
      condiciones: { alfabeto, fuentePx: 1000, electron: process.versions.electron,
        chromium: process.versions.chrome, plataforma: process.platform,
        guarda: 'grafico.__listo: carga real y comparacion de anchos contra respaldo' },
      tipografias: medidas.map(m => ({ ...m, sha256: createHash('sha256')
        .update(readFileSync(path.join(raiz, 'dist/fonts', m.fichero))).digest('hex') }))
    }
    if (process.argv.includes('--guardar')) {
      writeFileSync(destino, JSON.stringify(resultado, null, 2) + '\n')
    }
    console.log(JSON.stringify(resultado, null, 2))
  } catch (error) {
    codigo = 1
    console.error('FALLO: ' + error.message)
  } finally {
    clearTimeout(vigilancia)
    if (ventana && !ventana.isDestroyed()) ventana.destroy()
    app.exit(codigo)
  }
})
