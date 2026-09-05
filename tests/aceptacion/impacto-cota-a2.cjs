// Diagnostico previo a A.3. No renderiza, no modifica metricas ni genera proyectos.
// El fixture contiene solo lineas CONCEPTOS/resumen de una generacion real.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto')
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
if (process.argv[2] === '--extraer') {
  const origen = path.resolve(process.argv[3]), salida = path.resolve(process.argv[4])
  const bytes = fs.readFileSync(origen), lineas = bytes.toString('utf8').split(/\r?\n/)
  const inicio = lineas.findIndex(l => l.startsWith('[2026-09-03T02:37:47.705Z] [generate-timeline-assets]'))
  const fin = lineas.findIndex(l => l.startsWith('[2026-09-03T02:43:02.489Z] [RESUMEN]   3 —'))
  if (inicio < 0 || fin < inicio) throw new Error('No esta la generacion especificada; no sustituirla por otra')
  const seleccion = lineas.slice(inicio, fin + 1).flatMap((texto, i) =>
    /\[FASE 2\] CONCEPTOS lote=|\[FASE 2\] CONCEPTOS:|\[RESUMEN\]|3 de 55 Visuales/.test(texto)
      ? [{ linea: inicio + i + 1, texto }] : [])
  fs.writeFileSync(salida, JSON.stringify({ origen: path.basename(origen), sha256: sha(bytes),
    inicio: inicio + 1, fin: fin + 1, lineas: seleccion }, null, 2) + '\n')
  console.log(JSON.stringify({ lineas: seleccion.length, inicio: inicio + 1, fin: fin + 1 }))
} else {
  const { app } = require('electron')
  const repo = path.resolve(process.argv[2]), base = path.resolve(process.argv[3])
  const fixture = path.resolve(process.argv[4]), salida = path.resolve(process.argv[5])
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-impacto-cota-'))
  app.setPath('userData', temporal); process.chdir(temporal); delete process.env.VITE_DEV_SERVER_URL
  global.fetch = async () => { throw new Error('Diagnostico sin red') }
  // Cada bundle se importa en SU proceso ANTES de app.ready: registran IPC al importar
  // y cargarlos juntos intentaba registrar list-projects dos veces. Ninguno abre ventanas.
  try {
    const soloBase = process.argv.includes('--solo-base')
    let medidaBase
    if (!soloBase) {
      const hijo = require('child_process').spawnSync(process.execPath,
        [__filename, base, base, fixture, salida + '.base.json', '--solo-base'],
        { encoding: 'utf8', timeout: 10000, windowsHide: true })
      if (hijo.status !== 0) throw new Error('Fallo lector de base: ' + hijo.stderr)
      medidaBase = JSON.parse(fs.readFileSync(salida + '.base.json', 'utf8'))
    }
    const antesPath = path.join(base, 'dist-electron/main/index.js')
    const actualPath = path.join(repo, 'dist-electron/main/index.js')
    const actual = require(actualPath)
    const f = JSON.parse(fs.readFileSync(fixture, 'utf8'))
    const filas = f.lineas.filter(l => l.texto.includes('CONCEPTOS lote='))
    const sanos = filas.filter(l => l.texto.includes('saneado=OK'))
    const grupos = sanos.map(l => {
      const lista = l.texto.match(/saneado=OK  (.+)  frase=/)?.[1]
      if (!lista) throw new Error('Formato de log desconocido, linea ' + l.linea)
      const etiquetas = lista.split(' | ').map(c => {
        const espacio = c.indexOf(' ')
        if (espacio < 1) throw new Error('Concepto sin separador')
        return c.slice(espacio + 1)
      })
      if (etiquetas.length !== actual.CUANTOS_CONCEPTOS) throw new Error('No son tres conceptos')
      return { linea: l.linea, etiquetas }
    })
    const etiquetas = grupos.flatMap(g => g.etiquetas)
    const visuales = f.lineas.map(l => l.texto.match(/Visual: se pidieron (\d+) y salieron (\d+)/)).find(Boolean)
    const sinPalabra = f.lineas.map(l => l.texto.match(/\[RESUMEN\]   (\d+) — Visuales sin ninguna palabra/)).find(Boolean)
    if (!visuales || !sinPalabra) throw new Error('Falta la linea base en el log')
    // pintaConcepto hace slice(0,24). Una entrada de 24 estaria CENSURADA: no se
    // podria afirmar que su original tiene solo 24 caracteres. Aqui se exige <24.
    const censuradas = etiquetas.filter(e => e.length >= 24)
    if (censuradas.length) throw new Error('El log recorta etiquetas: no permite medir esta muestra')
    if (!f.lineas.some(l => /114 sub-clips \| 107 con 3 validos/.test(l.texto)) ||
        filas.length !== 114 || grupos.length !== 107 || etiquetas.length !== 321)
      throw new Error('La extraccion no cuadra con el contador del propio log')
    const contar = b => ({ limite: b.MAX_CARACTERES_ETIQUETA,
      etiquetasRechazadas: etiquetas.filter(e => !b.cabeLaEtiqueta(e)).length,
      subclipsConEtiquetaRechazada: grupos.filter(g => g.etiquetas.some(e => !b.cabeLaEtiqueta(e))).length,
      intervalosVacios: etiquetas.filter(e => b.ZONA_X_MIN + b.anchoCaja(e, true) / 2 >
        b.ZONA_X_MAX - b.anchoCaja(e, true) / 2).length,
      menorIntervaloPx: Math.min(...etiquetas.map(e =>
        (b.ZONA_X_MAX - b.ZONA_X_MIN - b.anchoCaja(e, true)) * 10.8)) })
    if (soloBase) {
      fs.writeFileSync(salida, JSON.stringify(contar(actual), null, 2) + '\n')
      app.exit(0)
      return
    }
    const medidas = JSON.parse(fs.readFileSync(path.join(repo, 'tests/aceptacion/plan-a2-20260905/medidas.json'), 'utf8'))
    const foto = medidas.degenerados.find(c => c.id === 'limite-24-arrobas')
    const solape = foto.etiquetas.map((etiqueta, i) => {
      const ancho = actual.anchoCaja(etiqueta, true), dom = foto.dom.cajas[i]
      const lo = actual.ZONA_X_MIN + ancho / 2, hi = actual.ZONA_X_MAX - ancho / 2
      // Ejercita la funcion real por ambos extremos; no copia su recorte.
      const extremos = [0, 100].map(x => actual.acotarPuntos([{ x, y: 30 }], [etiqueta], actual.FRANJA_TEXTO_Y)[0].x)
      if (lo <= hi && (Math.abs(extremos[0] - lo) > 1e-9 || Math.abs(extremos[1] - hi) > 1e-9))
        throw new Error('El recorte real no coincide con el intervalo observado')
      return { etiqueta, cotaPx: ancho * 10.8, loX: lo, hiX: hi, intervaloPx: (hi - lo) * 10.8,
        ramaDegenerada: lo > hi, extremosReales: extremos,
        centroDomPx: (dom.izquierda + dom.derecha) / 2, anchoDomPx: dom.ancho }
    })
    const resumen = { muestras: { subclips: filas.length, conConceptos: grupos.length,
      sinConceptos: filas.length - grupos.length, etiquetas: etiquetas.length,
      maxCaracteres: Math.max(...etiquetas.map(e => e.length)), censuradas: censuradas.length },
      antes: medidaBase, despues: contar(actual),
      alcance: 'Los 107 sub-clips son un SUPERCONJUNTO de los Visuales, no 107 Visuales. Cero rechazos en el conjunto implica cero rechazos nuevos por etiqueta en cualquier subconjunto.',
      lineaBase: { pedidos: +visuales[1], realizados: +visuales[2], sinPalabra: +sinPalabra[1],
        porcentaje: 100 * +sinPalabra[1] / +visuales[1] }, solape }
    const informe = { condiciones: { versionElectron: process.versions.electron, ancho: 1080, alto: 1920,
      fuenteCqmin: actual.METRICAS_ETIQUETA.archivo700.fuenteCqmin, fixtureSHA256: sha(fs.readFileSync(fixture)),
      bundleAntesSHA256: sha(fs.readFileSync(antesPath)), bundleActualSHA256: sha(fs.readFileSync(actualPath)),
      pngPreexistente: 'plan-a2-20260905/limite-24-arrobas.png', t: medidas.t,
      graphicData: foto.graphicData, sinRender: true }, resumen }
    fs.writeFileSync(salida, JSON.stringify(informe, null, 2) + '\n')
    console.log(JSON.stringify(resumen, null, 2)); app.exit(0)
  } catch (e) { console.error(e); app.exit(1) }
}
