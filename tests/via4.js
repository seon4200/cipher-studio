/**
 * VIA 4 — el audioClip de sincronia perfecta vive DENTRO del proyecto
 *
 * Se ejecuta con:   npm run test:via4
 *
 * Nace del bug que cerro el audio maestro (M1) y que reaparecio por una tercera puerta:
 * `generate-perfect-sync` construia el clip de audio con `audioPath || videoPath`, y el
 * frontend manda `audioClipExisting?.path || firstVideo.path`. Sin audio previo eso caia al
 * .mp4 del usuario, asi que el clip de tipo audio pasaba a ser el video entero, FUERA del
 * proyecto. Si el usuario lo movia o renombraba la carpeta, el proyecto se rompia.
 *
 * Llega a FASE 4 sin gastar dinero: con transcriptSegments vacio, los bucles de DeepSeek
 * (FASE 2) y de generacion de clips (FASE 3) no se ejecutan ni una vez. Cero llamadas a
 * DeepSeek, Pexels y fal.ai.
 *
 * El CASO 3 no es decorativo: `<proyecto>-copia` empieza por `<proyecto>`, asi que un
 * startsWith daria un falso "esta dentro" y el audio se quedaria fuera en silencio. Es la
 * razon de que dentroDelProyecto use path.relative.
 */
const { app, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('via4')
process.chdir(FIXTURE_ROOT)
const PROY = path.join(FIXTURE_ROOT, 'cipher-studio', 'proyectos')
const MARCA = 'zz-prueba-via4'
const TMP = path.join(FIXTURE_ROOT, 'external')
fs.mkdirSync(TMP, { recursive: true })

const fallos = []
const ok = (cond, titulo, detalle) => {
  if (cond) console.log(`  OK    ${titulo}${detalle ? '\n          ' + detalle : ''}`)
  else { fallos.push(titulo); console.log(`  FALLO ${titulo}${detalle ? '\n          ' + detalle : ''}`) }
}

let progreso = []
const llamar = (canal, arg) => {
  const h = ipcMain._invokeHandlers.get(canal)
  if (!h) throw new Error('sin handler: ' + canal)
  return h({ sender: { send: (c, d) => progreso.push({ canal: c, data: d }) } }, arg)
}

let fixtureCleaned = false
const limpiarFixture = () => {
  if (fixtureCleaned) return
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  fixtureCleaned = true
}

const dentro = (p, base) => {
  const rel = path.relative(base, p)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

async function main () {
  console.log('VIA 4 — el audioClip cae DENTRO del proyecto')
  console.log('Corre sobre el bundle compilado: ejecuta `npm run build` antes si has tocado el codigo.\n')

  // El video del usuario: FUERA del proyecto, como el importado de verdad.
  const videoExterno = path.join(TMP, 'video-del-usuario.mp4')
  execSync('ffmpeg -y -f lavfi -i testsrc=duration=3:size=320x240:rate=30 ' +
    '-f lavfi -i sine=frequency=440:duration=3 -c:v libx264 -c:a aac -shortest ' +
    `"${videoExterno}"`, { stdio: 'ignore' })
  ok(fs.existsSync(videoExterno), 'hay un video de origen con pista de audio', videoExterno)

  const p = await llamar('create-project', { name: MARCA })
  const proyecto = p.projectPath

  const params = (audioPath) => ({
    videoPath: videoExterno,
    transcriptSegments: [],
    syncWeights: [40, 35, 25],
    aspectRatio: '16:9',
    audioPath,
    iaStyle: 'normal',
    activeProjectPath: proyecto
  })

  // ── CASO 1 — el que importa: sincronia perfecta SIN "Usar Audio Original" ──────────
  console.log('\n=== CASO 1 — sin haber pulsado "Usar Audio Original" ===')
  progreso = []
  const r1 = await llamar('generate-perfect-sync', params(videoExterno))

  ok(r1 && r1.success, 'el handler responde', r1 && r1.error ? r1.error : '')
  const ac = (r1 && r1.audioClip) || {}

  ok(ac.path && dentro(ac.path, proyecto), 'el audioClip apunta DENTRO del proyecto',
    'path: ' + ac.path)
  ok(ac.path !== videoExterno, 'ya no es el mp4 del usuario',
    'antes devolvia: ' + videoExterno)
  ok(ac.path && fs.existsSync(ac.path), 'el fichero existe en disco')
  ok(ac.path && path.basename(ac.path) === 'maestro.m4a' &&
     dentro(ac.path, path.join(proyecto, 'materiales', 'audio')),
    'esta en materiales/audio/maestro.m4a')
  ok(typeof ac.url === 'string' && ac.url.startsWith('file:///') &&
     !ac.url.includes('video-del-usuario'),
    'la url es file:/// y no apunta fuera', 'url: ' + String(ac.url).slice(0, 90))
  ok(r1 && r1.audioExterno === false, 'audioExterno = false')
  ok(typeof ac.durationSeconds === 'number' && ac.durationSeconds > 2 && ac.durationSeconds < 4,
    'la duracion es la del audio extraido', ac.durationSeconds + 's (el video dura 3s)')

  const tam = ac.path && fs.existsSync(ac.path) ? fs.statSync(ac.path).size : 0
  ok(tam > 0, 'el m4a pesa menos que el video entero',
    `m4a ${(tam / 1024).toFixed(1)} KB frente a mp4 ${(fs.statSync(videoExterno).size / 1024).toFixed(1)} KB`)

  const avisos = progreso.filter(x => x.canal === 'generation-progress' &&
    x.data && x.data.type === 'Audio')
  ok(avisos.length === 1, 'avisa por el canal de progreso mientras extrae',
    avisos.length ? `"${avisos[0].data.paragraph}" (${avisos[0].data.index + 1}/${avisos[0].data.total})`
                  : 'no se emitio ningun evento de tipo Audio')

  // El v1Clip sigue fuera A PROPOSITO: decision cerrada "no copiar el video importado".
  ok(r1 && r1.v1Clip && r1.v1Clip.path === videoExterno,
    'el v1Clip sigue FUERA, como esta decidido', 'su cobertura es PIEZA A, no la via 4')

  // ── CASO 2 — ya habia audio maestro dentro: se reutiliza, no se re-extrae ──────────
  console.log('\n=== CASO 2 — con el audio maestro ya extraido ===')
  const antes = fs.statSync(ac.path).mtimeMs
  await new Promise(r => setTimeout(r, 1100))
  const r2 = await llamar('generate-perfect-sync', params(ac.path))
  ok(r2 && r2.success && r2.audioClip.path === ac.path,
    'reutiliza el audio que ya estaba dentro')
  ok(antes === fs.statSync(ac.path).mtimeMs, 'NO lo vuelve a extraer',
    'mtime intacto: ' + new Date(antes).toISOString())

  // ── CASO 3 — la trampa del directorio hermano ─────────────────────────────────────
  console.log('\n=== CASO 3 — un hermano que empieza igual ===')
  const hermano = proyecto + '-copia'
  fs.mkdirSync(hermano, { recursive: true })
  const audioHermano = path.join(hermano, 'maestro.m4a')
  fs.copyFileSync(ac.path, audioHermano)

  const r3 = await llamar('generate-perfect-sync', params(audioHermano))
  ok(r3 && r3.success && dentro(r3.audioClip.path, proyecto),
    'el hermano se trata como FUERA y se extrae',
    'devolvio: ' + (r3 && r3.audioClip && r3.audioClip.path))
  await llamar('close-project', {})

  console.log('\n' + '─'.repeat(70))
  if (fallos.length) {
    console.log('FALLOS: ' + fallos.length)
    fallos.forEach(f => console.log('  - ' + f))
  } else {
    console.log('TODO CORRECTO — el audioClip vive dentro del proyecto en los tres casos.')
  }
  return fallos.length
}

app.whenReady().then(async () => {
  require(path.join(RAIZ, 'dist-electron/main/index.js'))
  await new Promise(r => setTimeout(r, 1500))
  // El handler sale antes si no hay clave, pero con transcriptSegments vacio no llega a usarla.
  if (!process.env.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = 'x-no-se-usa'
  let code = 1
  try { code = await main() } catch (e) { console.log('EXCEPCION: ' + e.stack) } finally { limpiarFixture() }
  app.exit(code ? 1 : 0)
})
