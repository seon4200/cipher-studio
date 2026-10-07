/**
 * Corpus Solar reproducible. No reimplementa el resolvedor: mide el bundle compilado
 * sobre las 42 decisiones versionadas del vídeo MVP. `baseline` debe ejecutarse antes
 * de reconstruir el bundle y `after`, después; así ambas cifras salen del código real.
 */
const { app } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const raiz = path.resolve(__dirname, '..', '..', '..')
const salida = __dirname
const fuente = path.join(raiz, 'tests', 'aceptacion', 'mvp-paso7', 'video.json')
const fase = process.argv[2]
if (!['baseline', 'after'].includes(fase)) throw new Error('Uso: electron medir.js baseline|after')

function solicitudesDesdeVideo (video) {
  const solicitudes = []
  for (const visual of video.casos) {
    const extra = visual.graphicData?.extra ?? {}
    const piezas = [
      ['ancla', extra.ancla],
      ...((extra.conceptos ?? []).map((concepto, indice) => [`concepto-${indice + 1}`, concepto]))
    ]
    for (const [papel, concepto] of piezas) {
      if (!concepto) continue
      solicitudes.push({
        visual: visual.id,
        palabra: visual.graphicData?.value ?? '',
        papel,
        estilo: papel === 'ancla' ? 'bold-duotone' : 'linear',
        solicitado: concepto.icono ?? '',
        etiqueta: concepto.etiqueta ?? '',
        emojiRespaldo: concepto.ic ?? concepto.emoji ?? ''
      })
    }
  }
  return solicitudes
}

app.whenReady().then(() => {
  try {
    const bundle = require(path.join(raiz, 'dist-electron', 'main', 'index.js'))
    const bruto = fs.readFileSync(fuente)
    const video = JSON.parse(bruto)
    const solicitudes = solicitudesDesdeVideo(video)
    const detallado = typeof bundle.resolverSolarDetallado === 'function'
    const resultados = solicitudes.map(solicitud => {
      // El bundle previo al cambio aún no exportaba el detalle: su propia función pública
      // sigue siendo la autoridad para el baseline; candidatos/motivo se incorporan después.
      const detalle = detallado
        ? bundle.resolverSolarDetallado(solicitud.solicitado, solicitud.estilo)
        : {
            solicitado: solicitud.solicitado,
            normalizado: typeof bundle.normalizarNombreSolar === 'function'
              ? bundle.normalizarNombreSolar(solicitud.solicitado) : solicitud.solicitado,
            candidatoCanonico: '',
            candidatos: [],
            resultado: bundle.resolverNombreSolar(solicitud.solicitado, solicitud.estilo),
            motivo: 'bundle-previo-sin-traza'
          }
      return { ...solicitud, ...detalle, fallback: detalle.resultado ? null : solicitud.emojiRespaldo }
    })
    const resueltas = resultados.filter(resultado => resultado.resultado).length
    const resumen = {
      solicitudes: resultados.length,
      resueltas,
      fallbackEmoji: resultados.length - resueltas,
      porcentaje: Number((100 * resueltas / resultados.length).toFixed(2)),
      fuente: path.relative(raiz, fuente).replaceAll('\\', '/'),
      sha256Fuente: crypto.createHash('sha256').update(bruto).digest('hex')
    }
    fs.writeFileSync(path.join(salida, 'requests.json'), JSON.stringify({ ...resumen, solicitudes }, null, 2) + '\n')
    fs.writeFileSync(path.join(salida, fase + '.json'), JSON.stringify({ ...resumen, resultados }, null, 2) + '\n')
    console.log(`${fase}: ${resumen.resueltas}/${resumen.solicitudes} (${resumen.porcentaje}%)`)
  } catch (error) {
    console.error(error.stack)
    process.exitCode = 1
  } finally {
    app.exit(process.exitCode ?? 0)
  }
})
