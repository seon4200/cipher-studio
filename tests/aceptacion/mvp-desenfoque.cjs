// Muestra de lectura: conserva la geometria y difumina etiquetas + pie del caso
// indicado. Las coordenadas son parte de la condicion del artefacto, no un filtro
// general: electron tests/aceptacion/mvp-desenfoque.cjs <prefijo> <indice-1based> <rects-json>
const { app, BrowserWindow } = require('electron')
const fs = require('fs'), path = require('path'), os = require('os')
const repo = path.resolve(__dirname, '../..')
const proyecto = path.join(repo, 'proyectos', 'video-3-1788402898964')
const salida = path.join(proyecto, 'mvp-paso7')
const prefijo = process.argv[2], indice = Number(process.argv[3]), rects = JSON.parse(process.argv[4] || '[]')
if (!prefijo || !Number.isInteger(indice) || indice < 1 || !Array.isArray(rects) || !rects.length) {
  throw Error('Uso: mvp-desenfoque.cjs <prefijo> <indice-1based> <rects-json>')
}
const noVacio = p => {
  if (!fs.existsSync(p) || !fs.statSync(p).size) throw Error(`Artefacto ausente o vacio: ${p}`)
}
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-desenfoque-')))
app.whenReady().then(async () => {
  const video = JSON.parse(fs.readFileSync(path.join(salida, `${prefijo}-video.json`), 'utf8'))
  const caso = video.casos[indice - 1]
  if (!caso) throw Error(`Caso ${indice} ausente`)
  const ventana = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await ventana.loadURL('about:blank')
  const entrada = 'data:image/png;base64,' + fs.readFileSync(caso.archivo).toString('base64')
  const b64 = await ventana.webContents.executeJavaScript(`(async () => {
    const entrada = ${JSON.stringify(entrada)}, rects = ${JSON.stringify(rects)}, escala = .45
    const im = new Image(); im.src = entrada; await im.decode()
    const c = document.createElement('canvas'); c.width = 972; c.height = 864
    const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, 486, 864); ctx.drawImage(im, 486, 0, 486, 864)
    const borroso = document.createElement('canvas'); borroso.width = im.naturalWidth; borroso.height = im.naturalHeight
    const ctxBorroso = borroso.getContext('2d'); ctxBorroso.filter = 'blur(45px)'; ctxBorroso.drawImage(im, 0, 0)
    for (const [x, y, w, h] of rects) {
      ctx.drawImage(borroso, x, y, w, h, 486 + x * escala, y * escala, w * escala, h * escala)
    }
    return c.toDataURL('image/png').split(',')[1]
  })()`)
  const destino = path.join(salida, `${prefijo}-muestra-desfoque-45pct.png`)
  fs.writeFileSync(destino, Buffer.from(b64, 'base64')); noVacio(destino)
  const condiciones = path.join(salida, `${prefijo}-muestra-desfoque-45pct.json`)
  fs.writeFileSync(condiciones, JSON.stringify({ caso: indice, hash: caso.hash, palabra: caso.graphicData.value, escala: .45, rects }, null, 2)); noVacio(condiciones)
  console.log(JSON.stringify({ destino, condiciones, caso: indice, hash: caso.hash, palabra: caso.graphicData.value, escala: .45, rects }))
  ventana.destroy(); app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
