// Compone evidencia ANTES/DESPUES por la posicion real del subclip, nunca por
// el ordinal de la hoja: B1 puede descartar un Visual y desplazar los ordinales.
// electron tests/aceptacion/mvp-parejas.cjs <prefijo-antes> <prefijo-despues>
const { app, BrowserWindow } = require('electron')
const fs = require('fs'), path = require('path'), os = require('os')
const repo = path.resolve(__dirname, '../..')
const proyecto = path.join(repo, 'proyectos', 'video-3-1788402898964')
const salida = path.join(proyecto, 'mvp-paso7')
const antesPrefijo = process.argv[2], despuesPrefijo = process.argv[3]
if (!antesPrefijo || !despuesPrefijo) throw Error('Uso: mvp-parejas.cjs <antes> <despues>')
const leer = p => JSON.parse(fs.readFileSync(p, 'utf8'))
const noVacio = p => {
  if (!fs.existsSync(p) || !fs.statSync(p).size) throw Error(`Artefacto ausente o vacio: ${p}`)
}
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-parejas-')))
app.whenReady().then(async () => {
  const antes = leer(path.join(salida, `${antesPrefijo}-video.json`))
  const despues = leer(path.join(salida, `${despuesPrefijo}-video.json`))
  const estado = leer(path.join(proyecto, 'project-state.json'))
  const porPos = datos => new Map(datos.casos.map(c => [c.graphicData.extra.pos, c]))
  const a = porPos(antes), d = porPos(despues)
  const orden = p => p.split(':').map(Number)
  const comunes = [...a.keys()].filter(p => d.has(p)).sort((x, y) => {
    const [xf, xc] = orden(x), [yf, yc] = orden(y)
    return xf - yf || xc - yc
  })
  const partes = comunes.map((pos, indice) => {
    const [frase] = orden(pos), izq = a.get(pos), der = d.get(pos)
    return {
      numero: indice + 1, pos,
      frase: estado.transcriptSegments[frase]?.text?.trim() || '(frase ausente)',
      antes: { palabra: izq.graphicData.value, url: 'data:image/png;base64,' + fs.readFileSync(izq.archivo).toString('base64') },
      despues: { palabra: der.graphicData.value, url: 'data:image/png;base64,' + fs.readFileSync(der.archivo).toString('base64') }
    }
  })
  const noComunes = {
    soloAntes: [...a.keys()].filter(p => !d.has(p)).sort(),
    soloDespues: [...d.keys()].filter(p => !a.has(p)).sort()
  }
  const ventana = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await ventana.loadURL('about:blank')
  const b64 = await ventana.webContents.executeJavaScript(`(async () => {
    const partes = ${JSON.stringify(partes)}, margen = 20, ancho = 486, alto = 864, hueco = 16, paresPorFila = 2
    const c = document.createElement('canvas')
    c.width = margen * 2 + paresPorFila * (ancho * 2 + hueco) + (paresPorFila - 1) * hueco
    c.height = 142 + Math.ceil(partes.length / paresPorFila) * (alto + 96)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#10141b'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial'
    ctx.fillText('ANTES vs DESPUES · MISMO SUBCLIP · ESCALA 45%', margen, 38)
    ctx.font = '18px Arial'; ctx.fillText('Cada pareja comparte pos; las posiciones sin pareja se declaran en el JSON.', margen, 70)
    ctx.fillText('1080×1920 → 486×864 · fotograma = 60% del clip (max. 1.5 s).', margen, 100)
    const cortar = (s, n) => s.length <= n ? s : s.slice(0, n - 1) + '…'
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i], col = i % paresPorFila, fila = Math.floor(i / paresPorFila)
      const x = margen + col * (ancho * 2 + hueco * 2), y = 142 + fila * (alto + 96)
      ctx.fillStyle = '#c8d0dd'; ctx.font = 'bold 16px Arial'
      ctx.fillText('#' + p.numero + ' · pos ' + p.pos + ' · ' + cortar(p.frase, 106), x, y - 14)
      const ia = new Image(), id = new Image(); ia.src = p.antes.url; id.src = p.despues.url
      await Promise.all([ia.decode(), id.decode()]); ctx.drawImage(ia, x, y, ancho, alto); ctx.drawImage(id, x + ancho + hueco, y, ancho, alto)
      ctx.font = 'bold 18px Arial'; ctx.fillStyle = '#fff'
      ctx.fillText('ANTES · ' + cortar(p.antes.palabra, 31), x, y + alto + 24)
      ctx.fillText('DESPUES · ' + cortar(p.despues.palabra, 29), x + ancho + hueco, y + alto + 24)
    }
    return c.toDataURL('image/png').split(',')[1]
  })()`)
  const destino = path.join(salida, `${antesPrefijo}__${despuesPrefijo}-parejas-45pct.png`)
  fs.writeFileSync(destino, Buffer.from(b64, 'base64')); noVacio(destino)
  const inventario = path.join(salida, `${antesPrefijo}__${despuesPrefijo}-parejas.json`)
  fs.writeFileSync(inventario, JSON.stringify({ antes: antesPrefijo, despues: despuesPrefijo, escala: .45, comunes: partes.map(p => ({ pos: p.pos, antes: p.antes.palabra, despues: p.despues.palabra })), noComunes }, null, 2))
  noVacio(inventario)
  console.log(JSON.stringify({ destino, inventario, parejas: partes.length, ...noComunes }))
  ventana.destroy(); app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
