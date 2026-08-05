/**
 * AUDITORIA DE MATERIALES (PIEZA A, piezas 1 y 3)
 *
 * Se ejecuta con:   npm run test:materiales
 *
 * Cubre los cuatro modos de fallo, que NO son el mismo y no pueden dar el mismo mensaje:
 *
 *   FALTA         el fichero no esta. Roto AHORA.
 *   FUERA         existe pero vive fuera del proyecto. Funciona hoy, se rompe el dia que el
 *                 usuario lo mueva. El v1Clip del video importado esta aqui A PROPOSITO.
 *   SIN RUTA      el clip no tiene path. El export lo descarta sin decir nada.
 *   CATEGORIA     una categoria que el codigo no conoce. Es el mas silencioso de los cuatro:
 *                 no falla nada, el clip simplemente deja de aparecer donde deberia.
 *
 * Y la guarda del export, que va ANTES del dialogo de guardar: preguntar donde guardar y
 * despues decir que el video saldra incompleto es peor que no avisar.
 *
 * La parte C mide el coste con 623 clips —el proyecto real de 28 minutos de John— porque
 * la auditoria hace un exists() por clip en CADA carga y CADA export.
 */
const { app, ipcMain, dialog } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..')
const PROY = path.join(RAIZ, 'proyectos')
const MARCA = 'zz-prueba-materiales'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-mat-'))

const fallos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}

const llamar = (canal, arg) => {
  const h = ipcMain._invokeHandlers.get(canal)
  if (!h) throw new Error('sin handler: ' + canal)
  return h({ sender: { send: () => {} } }, arg)
}

const limpiar = () => {
  if (!fs.existsSync(PROY)) return
  for (const d of fs.readdirSync(PROY)) {
    if (d.toLowerCase().startsWith(MARCA)) {
      fs.rmSync(path.join(PROY, d), { recursive: true, force: true })
    }
  }
}

const tocar = (p) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, 'x')
  return p
}

async function partesAyB () {
  const p = await llamar('create-project', { name: MARCA })
  const proyecto = p.projectPath

  // Un clip de cada estado. Los que existen se crean de verdad.
  const dentro = tocar(path.join(proyecto, 'materiales', 'stock', 'bueno.mp4'))
  const externo = tocar(path.join(TMP, 'video-del-usuario.mp4'))
  const ausenteIa = path.join(proyecto, 'materiales', 'ia', 'costo-dinero.mp4')
  const ausenteOrig = path.join(proyecto, 'materiales', 'originales', 'no-vuelve.mp4')

  const clips = [
    { id: 'c1', name: 'bueno', type: 'video', category: 'stock', path: dentro },
    { id: 'c2', name: 'el video del usuario', type: 'video', category: 'original', path: externo },
    { id: 'c3', name: 'la ia que pague', type: 'video', category: 'ia', path: ausenteIa },
    { id: 'c4', name: 'mi grabacion', type: 'video', category: 'original', path: ausenteOrig },
    { id: 'c5', name: 'sin ruta ninguna', type: 'video', category: 'stock' },
    { id: 'c6', name: 'categoria inventada', type: 'video', category: 'brollicious', path: dentro }
  ]

  // ── A) la auditoria clasifica bien ────────────────────────────────────────────────
  console.log('\n=== A) LOS CUATRO ESTADOS ===')
  await llamar('save-project-state', {
    id: p.data.id, name: p.data.name, clips: [], timelineVideoClips: clips
  })
  const re = await llamar('load-project', { projectPath: proyecto })
  ok(re && re.success, 'el proyecto abre', re && re.error ? re.error : '')

  const a = (re && re.auditoria) || {}
  const ids = (lista) => (lista || []).map(x => x.id).sort().join(',')

  ok(ids(a.faltan) === 'c3,c4', 'FALTA: los dos que no estan en disco',
    'faltan: ' + ids(a.faltan))
  ok(ids(a.fuera) === 'c2', 'FUERA: el que existe pero vive fuera',
    'fuera: ' + ids(a.fuera))
  ok(ids(a.sinRuta) === 'c5', 'SIN RUTA: el que el export descartaria en silencio',
    'sinRuta: ' + ids(a.sinRuta))
  ok(ids(a.categorias) === 'c6' && a.categorias[0].category === 'brollicious',
    'CATEGORIA INVENTADA: se caza aunque el fichero exista',
    'el clip c6 apunta a un fichero que SI esta; el unico sintoma es la categoria')
  ok(a.hayProblema === true, 'hayProblema = true')

  // El origen es lo que decide que puede hacer el usuario.
  ok(a.porOrigen && a.porOrigen.ia && a.porOrigen.ia.faltan === 1 &&
     a.porOrigen.originales && a.porOrigen.originales.faltan === 1,
    'el desglose por origen distingue ia de originales',
    JSON.stringify(a.porOrigen))
  ok(a.fuera[0] && a.fuera[0].origen === 'externo',
    'lo de fuera se marca como externo, no como una subcarpeta')

  // Un proyecto sano no debe dar falsos positivos.
  await llamar('save-project-state', {
    id: p.data.id, name: p.data.name, clips: [], timelineVideoClips: [clips[0]]
  })
  const sano = await llamar('load-project', { projectPath: proyecto })
  ok(sano.auditoria && sano.auditoria.hayProblema === false &&
     sano.auditoria.faltan.length === 0 && sano.auditoria.categorias.length === 0,
    'un proyecto sano no da ningun aviso')

  // ── B) la guarda del export ───────────────────────────────────────────────────────
  console.log('\n=== B) LA GUARDA DEL EXPORT ===')
  const originalMsg = dialog.showMessageBox
  const originalSave = dialog.showSaveDialog
  let vistoMensaje = null
  let ordenLlamadas = []

  dialog.showSaveDialog = async () => {
    ordenLlamadas.push('guardar')
    return { canceled: true, filePath: undefined }
  }

  try {
    // B1 — con material ausente y el usuario cancelando
    ordenLlamadas = []
    dialog.showMessageBox = async (_w, opciones) => {
      ordenLlamadas.push('aviso')
      vistoMensaje = opciones
      return { response: 0 }   // Cancelar
    }
    const r1 = await llamar('export-video', { clips, aspectRatio: '16:9', resolution: '1080p',
      format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })

    ok(r1 && r1.success === false && /faltan materiales/i.test(r1.error || ''),
      'cancelar en el aviso aborta el export', 'error: ' + (r1 && r1.error))
    ok(ordenLlamadas[0] === 'aviso' && !ordenLlamadas.includes('guardar'),
      'el aviso sale ANTES del dialogo de guardar',
      'orden: ' + (ordenLlamadas.join(' -> ') || '(ninguna)'))
    ok(vistoMensaje && /3 de 6/.test(vistoMensaje.message || ''),
      'cuenta los ausentes: 3 de 6 (dos que faltan + uno sin ruta)',
      vistoMensaje && vistoMensaje.message)
    ok(vistoMensaje && vistoMensaje.defaultId === 0 && vistoMensaje.cancelId === 0,
      'el boton por defecto es Cancelar')
    ok(vistoMensaje && /originales\/ia\/pista-v2/.test(vistoMensaje.detail || ''),
      'avisa de que hay material que no se regenera solo')

    // B2 — el usuario decide exportar igualmente: pasa la guarda
    ordenLlamadas = []
    dialog.showMessageBox = async () => { ordenLlamadas.push('aviso'); return { response: 1 } }
    const r2 = await llamar('export-video', { clips, aspectRatio: '16:9', resolution: '1080p',
      format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
    ok(ordenLlamadas.join(' -> ') === 'aviso -> guardar',
      '"Exportar de todas formas" deja pasar al dialogo de guardar',
      'orden: ' + ordenLlamadas.join(' -> '))
    ok(r2 && r2.success === false && /cancelada por el usuario/i.test(r2.error || ''),
      'y a partir de ahi el export sigue su curso normal')

    // B3 — un proyecto sano no molesta
    ordenLlamadas = []
    dialog.showMessageBox = async () => { ordenLlamadas.push('aviso'); return { response: 0 } }
    await llamar('export-video', { clips: [clips[0]], aspectRatio: '16:9', resolution: '1080p',
      format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
    ok(ordenLlamadas.join(' -> ') === 'guardar',
      'sin material ausente NO se muestra ningun aviso',
      'orden: ' + ordenLlamadas.join(' -> '))

    // B4 — "fuera pero existe" no bloquea: es el estado del v1Clip por diseno
    ordenLlamadas = []
    await llamar('export-video', { clips: [clips[0], clips[1]], aspectRatio: '16:9',
      resolution: '1080p', format: 'mp4', quality: 'alta', assignedTransitions: {},
      transitionDuration: 0.5 })
    ok(ordenLlamadas.join(' -> ') === 'guardar',
      'un clip FUERA pero presente no bloquea el export',
      'es el estado del v1Clip del video importado, y exporta bien')
  } finally {
    dialog.showMessageBox = originalMsg
    dialog.showSaveDialog = originalSave
  }

  return proyecto
}

// ── C) el coste con el proyecto real de 623 clips ───────────────────────────────────
async function parteC (proyecto) {
  console.log('\n=== C) COSTE CON 623 CLIPS (el proyecto de 28 minutos) ===')
  const N = 623
  const dir = path.join(proyecto, 'materiales', 'stock')
  fs.mkdirSync(dir, { recursive: true })

  const muchos = []
  for (let i = 0; i < N; i++) {
    const f = path.join(dir, `carga_${i}.mp4`)
    fs.writeFileSync(f, 'x')
    muchos.push({ id: 'g' + i, name: 'clip ' + i, type: 'video', category: 'stock', path: f })
  }
  await llamar('save-project-state', {
    id: 'carga', name: MARCA, clips: [], timelineVideoClips: muchos
  })

  const medir = async () => {
    const t = process.hrtime.bigint()
    const r = await llamar('load-project', { projectPath: proyecto })
    return { ms: Number(process.hrtime.bigint() - t) / 1e6, r }
  }
  await medir()   // calentar: la primera lectura paga el cache del sistema de ficheros
  const tiempos = []
  for (let i = 0; i < 5; i++) tiempos.push((await medir()).ms)
  tiempos.sort((x, y) => x - y)
  const mediana = tiempos[2]

  const ultima = await medir()
  ok(ultima.r.auditoria && ultima.r.auditoria.total === N,
    `la auditoria recorre los ${N} clips`, 'total: ' + ultima.r.auditoria.total)

  // El numero de arriba es load-project ENTERO: leer el json, parsearlo, crear carpetas y
  // auditar. Para saber que parte es la auditoria se acota por los dos lados.
  //   - suelo: el exists() pelado sobre las mismas 623 rutas, que es su trabajo real.
  //   - techo: export-video cancelando EN la guarda, que ejecuta auditarClips y poco mas.
  const tSuelo = process.hrtime.bigint()
  for (const c of muchos) fs.existsSync(c.path)
  const suelo = Number(process.hrtime.bigint() - tSuelo) / 1e6

  const originalMsg = dialog.showMessageBox
  dialog.showMessageBox = async () => ({ response: 0 })
  const conFalta = [...muchos, { id: 'roto', name: 'roto', type: 'video', category: 'stock',
    path: path.join(dir, 'no-existe.mp4') }]
  await llamar('export-video', { clips: conFalta, aspectRatio: '16:9', resolution: '1080p',
    format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
  const tTecho = process.hrtime.bigint()
  await llamar('export-video', { clips: conFalta, aspectRatio: '16:9', resolution: '1080p',
    format: 'mp4', quality: 'alta', assignedTransitions: {}, transitionDuration: 0.5 })
  const techo = Number(process.hrtime.bigint() - tTecho) / 1e6
  dialog.showMessageBox = originalMsg

  console.log(`          load-project entero:      ${mediana.toFixed(1)} ms  ` +
    `(min ${tiempos[0].toFixed(1)} / max ${tiempos[4].toFixed(1)})`)
  console.log(`          la auditoria, entre:      ${suelo.toFixed(1)} ms (exists pelado)  y  ` +
    `${techo.toFixed(1)} ms (export hasta la guarda)`)
  console.log(`          por clip:                 ${(techo / N).toFixed(3)} ms`)

  ok(techo < 250, 'la auditoria de 623 clips es imperceptible al abrir',
    techo < 250 ? `${techo.toFixed(1)} ms, muy por debajo de los "cientos de ms" que se notarian`
                : `${techo.toFixed(1)} ms: SE NOTA, hay que paralelizar o cachear`)
}

async function main () {
  console.log('AUDITORIA DE MATERIALES — los cuatro estados y la guarda del export')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.')
  limpiar()
  const proyecto = await partesAyB()
  await parteC(proyecto)
  await llamar('close-project', {})
  limpiar()
  fs.rmSync(TMP, { recursive: true, force: true })

  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — los cuatro estados se distinguen y el export para a tiempo.')
  }
  return fallos.length
}

app.whenReady().then(async () => {
  require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(r => setTimeout(r, 1500))
  let code = 1
  try { code = await main() } catch (e) { console.log('EXCEPCION: ' + e.stack) }
  app.exit(code ? 1 : 0)
})
