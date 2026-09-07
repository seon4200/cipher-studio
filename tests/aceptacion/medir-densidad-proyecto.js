/** Mide densidad sobre una traza de Visuales y el project-state que aporta sus frases reales. */
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const [estadoPath, trazaPath] = process.argv.slice(2)
if (!estadoPath || !trazaPath) throw new Error('Uso: electron medir-densidad-proyecto.js <project-state.json> <video.json>')
const raiz = path.resolve(__dirname, '..', '..')

app.whenReady().then(() => {
  try {
    const bundle = require(path.join(raiz, 'dist-electron', 'main', 'index.js'))
    const estado = JSON.parse(fs.readFileSync(path.resolve(estadoPath), 'utf8'))
    const traza = JSON.parse(fs.readFileSync(path.resolve(trazaPath), 'utf8'))
    const reparto = {}
    const previas = {}
    for (const caso of traza.casos ?? []) {
      const extra = caso.graphicData?.extra ?? {}
      const indice = Number(String(extra.pos ?? '').split(':')[0])
      const frase = estado.transcriptSegments?.[indice]?.text ?? ''
      const contenido = { texto: caso.graphicData?.value ?? '', frase, conceptos: extra.conceptos ?? [] }
      const carga = bundle.cargaDensidad(contenido)
      const densidad = bundle.densidadDesdeContenido(contenido)
      reparto[densidad] = (reparto[densidad] ?? 0) + 1
      reparto['carga-' + carga] = (reparto['carga-' + carga] ?? 0) + 1
      const previa = extra.direccion?.densidad ?? 'sin-direccion'
      previas[previa] = (previas[previa] ?? 0) + 1
    }
    console.log(JSON.stringify({ casos: traza.casos?.length ?? 0, direccionGrabada: previas, recalculada: reparto }, null, 2))
  } catch (error) {
    console.error(error.stack)
    process.exitCode = 1
  } finally {
    app.exit(process.exitCode ?? 0)
  }
})
