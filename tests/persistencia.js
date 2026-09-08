/**
 * PRUEBA DE PERSISTENCIA
 *
 * Se ejecuta con:   npm run test:persistencia
 *
 * Nace de dos fallos reales que costaron dias de busqueda:
 *
 *   - aspectRatio no se guardaba, asi que un proyecto vertical reabria en horizontal y se
 *     exportaba con el formato equivocado sin que nada lo dijera.
 *   - Los siete ajustes del export se anadieron al payload pero NO a las listas de
 *     dependencias de los useEffect que guardan. Eso compila, pasa una revision por encima,
 *     y solo falla cuando el usuario cierra la app: el guardado escribia el valor anterior.
 *
 * Por eso la prueba tiene DOS partes. La A mira el codigo y caza las dos formas de olvido.
 * La B hace el viaje de verdad —guardar, cerrar, reabrir— y compara campo a campo.
 *
 * Y una tercera garantia: si alguien anade un campo nuevo al payload (los graficos, por
 * ejemplo) y no lo cubre en la muestra de la parte B, la prueba FALLA. No se puede ampliar
 * la persistencia sin ampliar tambien lo que se comprueba.
 */
const { app, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..')
const FUENTE = path.join(RAIZ, 'src/renderer/src/main.tsx')
const FIXTURE_ROOT = createTestFixture('persistencia')
process.chdir(FIXTURE_ROOT)
const PROY = path.join(FIXTURE_ROOT, 'cipher-studio', 'proyectos')
const MARCA = 'zz-prueba-persistencia'

// Claves que NO son un estado con el mismo nombre. Se declaran aqui, a la vista, con su
// motivo: si esta lista crece sin razon es que el payload se esta ensuciando.
const ESPECIALES = {
  id: 'activeProjectId',            // se guarda con otro nombre
  name: 'activeProjectName',        // idem
  clips: 'clips',                   // se transforma con .map antes de guardar
  ajustesVideo: null                // derivado de activeCrop, zoom, panOffset e isMirrored
}
// Los estados de los que sale ajustesVideo: tienen que estar en las dependencias aunque la
// clave del payload no se llame como ellos.
const ESTADOS_DE_AJUSTES = ['activeCrop', 'zoom', 'panOffset', 'isMirrored']

const fallos = []
const avisos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}

// ───────────────────────── PARTE A — coherencia del codigo ─────────────────────────
function parteA () {
  console.log('\n=== A) EL CODIGO ES COHERENTE CONSIGO MISMO ===')
  const src = fs.readFileSync(FUENTE, 'utf8')

  // 1) Las claves del payload
  const mCons = src.match(/const construirEstadoAGuardar = \(\) => \(\{([\s\S]*?)\n  \}\)/)
  if (!mCons) {
    ok(false, 'se encuentra construirEstadoAGuardar',
      'no se pudo localizar la funcion; si se ha renombrado, actualizar esta prueba')
    return null
  }
  // Solo las claves de PRIMER NIVEL. Hay que llevar la cuenta de llaves y parentesis:
  // clips.map(c => ({ id, name, duration, ... })) anida un objeto entero, y sus claves no
  // son campos del proyecto. Sin esto, la prueba acusaba de no restaurarse a 'duration',
  // 'type', 'path' y 'size', que son del clip.
  const cuerpo = mCons[1]
  const claves = []
  let hondura = 0
  for (const linea of cuerpo.split('\n')) {
    const l = linea.trim()
    if (l && !l.startsWith('//') && hondura === 0) {
      // Puede haber VARIAS claves por linea: "timelineVideoClips, timelineVersions,".
      // Se parte por comas y se toma el identificador que abre cada trozo.
      for (const trozo of l.split(',')) {
        const m = trozo.trim().match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/)
        if (m && !claves.includes(m[1])) claves.push(m[1])
      }
    }
    for (const ch of linea) {
      if (ch === '{' || ch === '(' || ch === '[') hondura++
      else if (ch === '}' || ch === ')' || ch === ']') hondura--
    }
  }
  ok(claves.length > 15, 'el payload declara sus claves',
    `${claves.length} claves: ${claves.join(', ')}`)

  // 2) Lo que se restaura al cargar
  const restaurados = new Set()
  for (const m of src.matchAll(/loadedData\.([A-Za-z_$][\w$]*)/g)) restaurados.add(m[1])

  const sinRestaurar = claves.filter(k => !(k in ESPECIALES) && !restaurados.has(k))
  ok(sinRestaurar.length === 0,
    'todo lo que se guarda se vuelve a leer al cargar',
    sinRestaurar.length
      ? `NO se restauran: ${sinRestaurar.join(', ')}\n          ` +
        'Se guardarian y se perderian al reabrir, que es el bug del aspectRatio.'
      : `${claves.length - Object.keys(ESPECIALES).length} claves comprobadas`)

  // 3) Las listas de dependencias de los useEffect que guardan
  const deps = [...src.matchAll(/\}, \[clips, timelineVideoClips([^\]]*)\]\)/g)]
    .map(m => new Set(('clips,timelineVideoClips' + m[1]).split(',').map(s => s.trim()).filter(Boolean)))
  ok(deps.length >= 2, 'se encuentran las listas de dependencias del guardado',
    `${deps.length} listas`)

  if (deps.length >= 2) {
    const aVigilar = claves
      .filter(k => k !== 'ajustesVideo')
      .map(k => (k in ESPECIALES ? ESPECIALES[k] : k))
      .filter(Boolean)
      .concat(ESTADOS_DE_AJUSTES)

    deps.forEach((set, i) => {
      const faltan = aVigilar.filter(k => !set.has(k))
      ok(faltan.length === 0,
        `la lista de dependencias ${i + 1} esta al dia`,
        faltan.length
          ? `FALTAN: ${faltan.join(', ')}\n          ` +
            'El build NO ve esto: al cerrar la app se guardaria el valor ANTERIOR.'
          : `${aVigilar.length} estados vigilados`)
    })
  }
  return claves
}

// ───────────────────────── PARTE B — el viaje de verdad ─────────────────────────
// Muestra con TODOS los campos en un valor distinto del defecto. Si el payload gana un
// campo y no se anade aqui, la comprobacion de cobertura falla.
const MUESTRA = {
  timelineVideoClips: [{ id: 'c1', name: 'x.mp4', type: 'video', startSeconds: 0, durationSeconds: 3 }],
  timelineVersions: [{ id: 'v1', name: 'V', timestamp: 1, timelineVideoClips: [] }],
  activeVersionId: 'v1',
  transcriptionStatus: 'success',
  transcriptSegments: [{ start: 0, end: 1, text: 'hola' }],
  newAudioSegments: [{ start: 0, end: 1, text: 'adios' }],
  aiScript: 'guion de prueba',
  originalTranscriptText: 'transcripcion de prueba',
  libraryWidth: 411, toolsWidth: 377, timelineHeight: 299,
  voiceModel: 'Modelo X', voiceSpeaker: 'Voz Y', voiceSpeed: 1.4, voiceStability: 71,
  generatedVoices: [{ id: 'g1', timestamp: 2 }],
  graphicsPercent: 33,
  timelineWeights: [11, 22, 67],
  aspectRatio: 'vertical',
  exportResolution: '4K', exportFormat: 'mov', exportQuality: 'high',
  assignedTransitions: { 'a->b': 'circlecrop' },
  transitionDuration: 0.3,
  ajustesVideo: { crop: { left: 12, top: 5, right: 8, bottom: 3 }, zoom: 1.8,
                  panXFrac: 0.15, panYFrac: -0.07, isMirrored: true, background: 'black' }
}

const llamar = (canal, arg) => {
  const h = ipcMain._invokeHandlers.get(canal)
  if (!h) throw new Error('sin handler: ' + canal)
  return h({ sender: { send: () => {} } }, arg)
}
let fixtureCleaned = false
const limpiarFixture = () => {
  if (fixtureCleaned) return
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  fixtureCleaned = true
}

async function parteB (claves) {
  console.log('\n=== B) GUARDAR -> CERRAR -> REABRIR, CAMPO A CAMPO ===')

  // Cobertura: cada clave del payload tiene que estar en la muestra
  if (claves) {
    const sinCubrir = claves.filter(k => !(k in ESPECIALES) && !(k in MUESTRA))
    ok(sinCubrir.length === 0, 'la muestra cubre todas las claves del payload',
      sinCubrir.length
        ? `sin cubrir: ${sinCubrir.join(', ')}\n          ` +
          'Se ha anadido un campo nuevo. Anadelo a MUESTRA con un valor distinto del defecto.'
        : `${Object.keys(MUESTRA).length} campos en la muestra`)
  }

  const p = await llamar('create-project', { name: MARCA })
  await llamar('save-project-state', { id: p.data.id, name: p.data.name, clips: [], ...MUESTRA })
  await llamar('close-project', {})
  const re = await llamar('load-project', { projectPath: p.projectPath })

  ok(re && re.success, 'el proyecto vuelve a abrirse', re && re.error ? re.error : '')
  const d = (re && re.data) || {}

  let iguales = 0
  const distintos = []
  for (const [k, esperado] of Object.entries(MUESTRA)) {
    const leido = d[k]
    if (JSON.stringify(leido) === JSON.stringify(esperado)) iguales++
    else distintos.push(`${k}: se guardo ${JSON.stringify(esperado)} y se leyo ${JSON.stringify(leido)}`)
  }
  ok(distintos.length === 0, 'los campos sobreviven al viaje',
    distintos.length ? distintos.join('\n          ') : `${iguales} de ${iguales} campos identicos`)

  // Un proyecto de antes de todo esto, sin ninguno de los campos nuevos
  const viejo = path.join(PROY, MARCA + '-viejo')
  fs.mkdirSync(viejo, { recursive: true })
  fs.writeFileSync(path.join(viejo, 'project-state.json'),
    JSON.stringify({ id: 'v', name: 'viejo', clips: [], timelineVideoClips: [] }), 'utf8')
  let excepcion = null, rv = null
  try { rv = await llamar('load-project', { projectPath: viejo }) } catch (e) { excepcion = e.message }
  ok(excepcion === null && rv && rv.success === true,
    'un proyecto guardado ANTES de estos campos sigue abriendose',
    excepcion ? 'EXCEPCION: ' + excepcion : 'abre sin los campos nuevos, que llegan undefined')

}

app.whenReady().then(async () => {
  require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(r => setTimeout(r, 1500))

  console.log('PRUEBA DE PERSISTENCIA')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.')

  const claves = parteA()
  await parteB(claves)

  console.log('\n' + '─'.repeat(70))
  if (fallos.length === 0) {
    console.log('TODO CORRECTO — lo que se guarda se restaura, y las dependencias estan al dia.')
    limpiarFixture()
    app.exit(0)
  } else {
    console.log(`${fallos.length} FALLO(S):`)
    for (const f of fallos) console.log(`  · ${f}`)
    console.log('\nUn campo que no sobrevive significa que el usuario pierde ese ajuste al')
    console.log('reabrir su proyecto, y en el caso de aspectRatio, que exporta con el formato')
    console.log('equivocado sin enterarse.')
    limpiarFixture()
    app.exit(1)
  }
}).catch(e => { console.error('LA PRUEBA NO PUDO EJECUTARSE:', e); app.exit(1) })
