// Reconstruye la hoja ANTES desde los fotogramas ya extraidos de un MP4 exportado.
// No renderiza video, no llama a red y falla si falta un artefacto de evidencia.
const { app, BrowserWindow } = require('electron')
const fs = require('fs'), path = require('path'), os = require('os')

const repo = path.resolve(__dirname, '../..')
const proyecto = path.join(repo, 'proyectos', 'video-3-1788402898964')
const salida = path.join(proyecto, 'mvp-paso7')
const prefijo = process.argv[2] || 'ANTES-1f1a6cb'
const leer = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const noVacio = p => {
  if (!fs.existsSync(p) || !fs.statSync(p).size) throw Error(`Artefacto ausente o vacio: ${p}`)
  return p
}

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-antes-hoja-')))
app.whenReady().then(async () => {
  const video = leer(path.join(repo, 'tests', 'aceptacion', 'mvp-paso7', 'video.json'))
  const generacion = leer(path.join(salida, 'generar.json'))
  const estado = leer(path.join(proyecto, 'project-state.json'))
  const porId = new Map(generacion.generacion.clips.filter(c => c.category === 'visual').map(c => [c.id, c]))
  const partes = video.casos.map((caso, indice) => {
    const clip = porId.get(caso.id)
    if (!clip) throw Error(`No hay clip de generacion para ${caso.id}`)
    const frase = estado.transcriptSegments[clip.phraseIdx]?.text?.trim()
    if (!frase) throw Error(`No hay frase para phraseIdx=${clip.phraseIdx}`)
    const archivo = noVacio(caso.archivo)
    return { n: indice + 1, palabra: caso.graphicData.value, frase, archivo }
  })
  const ventana = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await ventana.loadURL('about:blank')
  const entradas = partes.map(p => ({ ...p, url: `data:image/png;base64,${fs.readFileSync(p.archivo).toString('base64')}` }))
  const b64 = await ventana.webContents.executeJavaScript(`(async () => {
    const partes = ${JSON.stringify(entradas)}
    const escala = .45, ancho = 486, alto = 864, columnas = 4, margen = 20, hueco = 18, etiqueta = 74
    const c = document.createElement('canvas')
    c.width = margen * 2 + columnas * ancho + (columnas - 1) * hueco
    c.height = 142 + Math.ceil(partes.length / columnas) * (alto + etiqueta + 16)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#10141b'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial'
    ctx.fillText(${JSON.stringify(prefijo)} + ' · VIDEO REAL · ESCALA 45%', margen, 38)
    ctx.font = '18px Arial'
    ctx.fillText('1080×1920 → 486×864 · fotogramas extraidos del MP4 exportado · t = 60% del clip (max. 1.5 s)', margen, 70)
    ctx.fillText('Cada celda: frase de Whisper y palabra que decidio el Visual de esa generacion.', margen, 100)
    const cortar = (s, n) => s.length <= n ? s : s.slice(0, n - 1) + '…'
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i], col = i % columnas, fila = Math.floor(i / columnas)
      const x = margen + col * (ancho + hueco), y = 142 + fila * (alto + etiqueta + 16)
      const im = new Image(); im.src = p.url; await im.decode(); ctx.drawImage(im, x, y, ancho, alto)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.fillText(p.n + '. ' + cortar(p.palabra, 34), x, y + alto + 22)
      ctx.fillStyle = '#c8d0dd'; ctx.font = '14px Arial'; ctx.fillText(cortar(p.frase, 62), x, y + alto + 46)
    }
    return c.toDataURL('image/png').split(',')[1]
  })()`)
  const destino = path.join(salida, `${prefijo}-hoja-45pct.png`)
  fs.writeFileSync(destino, Buffer.from(b64, 'base64'))
  noVacio(destino)
  console.log(JSON.stringify({ destino, celdas: partes.length, escala: .45, miniatura: [486, 864] }))
  ventana.destroy(); app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
