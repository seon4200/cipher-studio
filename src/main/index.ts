import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { spawn, exec } from 'child_process'
import { once } from 'events'
import { createHash, randomUUID } from 'crypto'
import fs from 'fs'
import { createProjectFiles, loadProjectFile, saveProjectFile } from './services/project-persistence'
// Tests exercise the real compiled consumers, never copies of migration or IO.
export * from './services/project-persistence'
// 3.4B exposes the real local catalog from the compiled main bundle. It does not
// resolve or copy assets to projects, and has no renderer/IPC side effect.
export * from './assets/openmoji/catalog'
// 3.4C sigue siendo una API interna sin IPC: esta reexportación permite que la
// suite ejecute el consumidor compilado real, no una copia de publicación/IO.
export * from './assets/openmoji/publish'
// Resolver V1 consumes already-sanitized generation semantics and materializes a SceneSpec
// before hashing/rendering. It never runs inside the renderer.
export * from '../shared/asset-intent'
export * from './assets/asset-resolver'
export * from '../shared/local-scene-semantic'
export * from './assets/semantic-decision'
export * from './assets/modern-visual-generation'
export * from './services/visual-decision-diagnostics'
export * from './services/original-clip-segmentation'
export * from './services/visual-variety-metrics'
// Productive Visual MVP: the shared scene projection is the single authority for both the
// file hash and the React tree; filesystem bindings remain a separate main-process concern.
export * from '../shared/visual-scene-spec'
export * from './assets/visual-render'
import { sceneSpecFromGraphicData, sceneSpecPixelIdentity, type RenderBindingsV1 } from '../shared/visual-scene-spec'
import { createLocalSceneSemanticV1, selectNarrativeKeywordV2 } from '../shared/local-scene-semantic'
import {
  createModernVisualGenerationContextV1,
  resolveModernVisualGenerationBatchV1,
} from './assets/modern-visual-generation'
import { writeVisualDecisionDiagnostic } from './services/visual-decision-diagnostics'
import { prepareOriginalClipSegmentation } from './services/original-clip-segmentation'
import { prepareGraphicForVisualRender, visualRenderRoot } from './assets/visual-render'
import { runVisualRuntimeQc, VisualRuntimeQcError, type VisualRuntimeQcReport } from './assets/visual-qc'
export * from './assets/visual-qc'
import { pathToFileURL } from 'url'
import { getVideoDuration, generateVideoThumbnail, formatTimeMinutesSeconds, getVideoDimensions } from './services/ffmpeg'
import { fal } from '@fal-ai/client'
// Re-exportado ademas de importado para que tests/reparto.js alcance la implementacion REAL
// desde el bundle: una prueba que reimplementara el reparto probaria su copia, no el reparto.
import { repartoObjetivos, repartirPesos, normalizarPesos, PESOS_POR_DEFECTO } from '../shared/reparto'
import { palabraDelTramo, palabraIlustrableDelTramo, tieneSignificado, recortarPuntuacion,
  PALABRAS_VACIAS, hayTiemposPorPalabra } from '../shared/palabra'
// Se re-exportan para que la suite pueda ejercitarlas sobre el BUNDLE COMPILADO en vez de
// reimplementarlas: una prueba que copiara la regla probaria su copia.
export { palabraDelTramo, palabraIlustrableDelTramo, tieneSignificado, recortarPuntuacion, PALABRAS_VACIAS,
  hayTiemposPorPalabra }
// Re-exportado para que tests/exclusion.js alcance la implementacion REAL desde el bundle.
import { excluirSobreVisuales, solapa, SOLAPE_MINIMO_S,
  colocarYFiltrarTarjetas, avisoDeExclusion } from '../shared/exclusion'
export { excluirSobreVisuales, solapa, SOLAPE_MINIMO_S, colocarYFiltrarTarjetas, avisoDeExclusion }
import { fraccion, esLegal, divisoresDe, comprobarCiclo, ajustar, cicloValido,
  TOLERANCIA_S } from '../shared/ciclo'
export { fraccion, esLegal, divisoresDe, comprobarCiclo, ajustar, cicloValido, TOLERANCIA_S }
import { semillaDe, semillaVisual, generador, entre, entero } from '../shared/semilla'
export { semillaDe, semillaVisual, generador, entre, entero }
import { sanearConceptos, CUANTOS_CONCEPTOS, MAX_PALABRAS_ETIQUETA } from '../shared/conceptos'
import { sanearSemanticaVisual } from '../shared/semantica'
export { sanearSemanticaVisual } from '../shared/semantica'
import { resolverSolarDetallado, NOMBRES_SOLAR_CURADOS } from '../shared/iconos-solar'
export { resolverNombreSolar, resolverSolarDetallado, normalizarNombreSolar, NOMBRES_SOLAR_CURADOS } from '../shared/iconos-solar'
import { SISTEMAS, type NombreSistema } from '../shared/sistemas'
export { sanearConceptos, CUANTOS_CONCEPTOS, MAX_PALABRAS_ETIQUETA }
export { SISTEMAS, contraste, coloresCaja, coloresEscena, contrasteTextoEscena,
  CONTRASTE_MINIMO_CAJA, CONTRASTE_MINIMO_ESCENA } from '../shared/sistemas'
// SOLO RE-EXPORTACION, para que tests/mapa.js pueda ejercitar el modulo sobre el BUNDLE
// COMPILADO en vez de reimplementarlo. NADIE lo llama todavia: `mapa.ts` es matematica pura y
// el paso 3 sera quien la use. Sin estas dos lineas la octava suite no tendria como alcanzarlo
// —el bundler no incluye lo que nadie importa— y la unica alternativa seria copiar la logica
// dentro de la prueba, que es exactamente lo que las otras siete evitan.
export { anchoCaja, METRICAS_ETIQUETA, METRICA_ETIQUETA, GEOMETRIA_CAJA } from '../shared/metricas-caja'
import * as mapa from '../shared/mapa'
export const {
  SY, FOCO, ZONA, T, cl, ent, elige, jit, PALETAS, LAYOUTS, FAMILIAS,
  separados, acotar, layoutSeguro, retardos, RETARDO_ANCLA, retardoArista,
  TRANSICIONES, ORDENES, receta, nSeguro, N_MAX,
  anchoCaja: anchoCajaMapa, altoCaja, cajasDe, recorteCaja, recortesArista, MARGEN_H, MARGEN_V,
  FRACCION_MAXIMA_RECORTE
} = mapa
// SOLO RE-EXPORTACION, para que la suite ejercite el registro de piezas sobre el BUNDLE
// COMPILADO en vez de reimplementarlo. `combinacionesLegales` tiene que poder comprobarse sin
// montar React: es lo que hace que el numero de estilos lo calcule el codigo y no un documento.
import * as escenaShared from '../shared/escena'
export const {
  FONDOS: FONDOS_ESCENA, ESTRUCTURAS: ESTRUCTURAS_ESCENA, CAMARAS: CAMARAS_ESCENA,
  TIPOGRAFIAS, direccionDesde, combinacionesLegales, direccionDe, cargaDensidad, densidadDesdeContenido, entradaRitmo,
  DENSIDAD_A_N, RITMOS, acotarPuntos, cabeEnElPie, cabeLaEtiqueta,
  maxCaracteresPie, MAX_CARACTERES_ETIQUETA, FRANJA_TEXTO_Y, MARGEN_CAMARA_PIE_Y, ZONA_X_MIN, ZONA_X_MAX,
  parametrosDe, instanciasDe, esParFondoCamaraLegal, paresFondoCamaraLegales,
  catalogoRelaciones, estructurasParaRelacion, direccionParaRelacion
} = escenaShared
// SOLO RE-EXPORTACION, para que la suite ejercite el modulo sobre el BUNDLE COMPILADO en vez
// de reimplementarlo. `avisos.ts` es puro -- sin Electron, sin React, sin fs -- justamente para
// poder probarlo entero, que es lo que hace utiles a reparto.ts, exclusion.ts y ciclo.ts.
import {
  coleccionDeAvisos, armarResumen, textoResumen, describirMotivo, totalRespaldo, MOTIVOS,
  type Aviso, type Resumen, type FilaResumen, type MotivoRespaldo
} from '../shared/avisos'
export { coleccionDeAvisos, armarResumen, textoResumen, describirMotivo, totalRespaldo, MOTIVOS }
import { recortarTexto } from '../shared/texto'
export { repartoObjetivos, repartirPesos, normalizarPesos, PESOS_POR_DEFECTO }

// Construir "file:///" concatenando la ruta FALLA con espacios, acentos y '#'. Medido en un
// Chromium real con webSecurity:false, cargando un video desde
// ".../prueba url/acentuacion nandu/video de prueba #1.mp4":
//   file:///<ruta>          -> MEDIA_ELEMENT_ERROR: Format error
//   file:///encodeURI(...)  -> MEDIA_ELEMENT_ERROR (no escapa '#', que corta la URL como ancla)
//   pathToFileURL(...)      -> CARGA
// Hoy no se nota porque el proyecto vive en C:\Proyectos\mi-app\cipher-studio, sin espacios
// ni acentos. En C:\Users\Jose\... o "Archivos de programa" no se reproduciria NADA.
// Hace el replace de barras por dentro, asi que las llamadas ya no lo necesitan.
const urlDeRuta = (p: string) => pathToFileURL(p).href

// Helper to manually load .env file in main process from multiple potential paths
let envLoaded = false
function loadEnv(force = false) {
  if (envLoaded && !force) return
  const possiblePaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'cipher-studio', '.env'),
    path.join(app.getAppPath(), '.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '../..', '.env'),
  ]
  
  let loaded = false
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      console.log(`[loadEnv] Cargando variables de entorno desde: ${envPath}`)
      try {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n')
        for (const line of lines) {
          const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)?\s*$/)
          if (match) {
            const key = match[1].trim()
            let val = match[2] ? match[2].trim() : ''
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1)
            } else if (val.startsWith("'") && val.endsWith("'")) {
              val = val.substring(1, val.length - 1)
            }
            process.env[key] = val
          }
        }
        loaded = true
        break // Stop at the first found .env file
      } catch (err: any) {
        console.error(`[loadEnv] Error al leer el archivo ${envPath}: ${err.message}`)
      }
    }
  }
  if (!loaded) {
    console.warn(`[loadEnv] Advertencia: No se pudo encontrar ningún archivo .env en las rutas buscadas.`)
  }
  envLoaded = true
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

// Load env variables at startup
loadEnv()

process.env.DIST = path.join(__dirname, '../..')
process.env.PUBLIC = app.isPackaged ? path.join(process.env.DIST, 'dist') : path.join(process.env.DIST, 'public')

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = path.join(process.env.DIST, 'dist/index.html')

function createWindow() {
  win = new BrowserWindow({
    title: 'CIPHER Studio',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    width: 1280,
    height: 800,
    backgroundColor: '#0f172a',
  })

  // Test send message from Main to Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  let isClosing = false
  win.on('close', (e) => {
    if (!isClosing) {
      e.preventDefault()
      if (activeProjectPath) {
        cleanupProjectTemp(activeProjectPath);
      }
      win?.webContents.send('save-before-close')
      isClosing = true
      
      // Fallback timeout: if renderer doesn't reply in 4 seconds, destroy window anyway
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.destroy()
        }
      }, 4000)
    }
  })

  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(indexHtml)
  }
}

function getBancoClipsPath(): string {
  const cwd = process.cwd()
  if (path.basename(cwd) === 'cipher-studio') {
    return path.join(cwd, 'banco-clips')
  } else {
    return path.join(cwd, 'cipher-studio', 'banco-clips')
  }
}

async function writeDebugLog(message: string) {
  try {
    const cwd = process.cwd();
    let targetPath = '';
    if (path.basename(cwd) === 'cipher-studio') {
      targetPath = path.join(cwd, 'generation-debug.log');
    } else {
      targetPath = path.join(cwd, 'cipher-studio', 'generation-debug.log');
    }
    const dir = path.dirname(targetPath);
    if (!(await exists(dir))) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    const time = new Date().toISOString();
    await fs.promises.appendFile(targetPath, `[${time}] ${message}\n`, 'utf8');
  } catch (e) {
    console.error('Error writing to debug log:', e);
  }
}

async function initClipFolders() {
  const bankDir = getBancoClipsPath()
  const folders = [
    '',
    'originales',
    'stock',
    'veo3',
    'thumbnails'
  ]
  for (const f of folders) {
    const dirPath = path.join(bankDir, f)
    if (!(await exists(dirPath))) {
      await fs.promises.mkdir(dirPath, { recursive: true })
      console.log(`[initClipFolders] Carpeta creada: ${dirPath}`)
    }
  }
}

app.whenReady().then(async () => {
  await initClipFolders()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  // Si hay un lote de graficos en curso, la ventana offscreen puede ser la ULTIMA viva y
  // destruirla dispara esto en mitad del render. Medido en el experimento: la app se cerro
  // sola y el proceso salio con codigo 0, como si todo hubiera ido bien.
  if (loteGraficosActivo) return
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// El modelo de Whisper, en UN solo sitio. Estaba escrito a mano en los TRES sitios que lo
// invocan —start-transcription, generate-voice y regenerate-graphics— y cambiarlo eran tres
// ediciones. Olvidar una no rompe nada visible: la app seguiria funcionando y transcribiendo
// con dos modelos distintos segun el camino, y el sintoma seria una calidad inconsistente que
// nadie podria atribuir a esto. Es el mismo patron que ya mordio con los dos botones de "Usar
// Audio Original" y con las dos vias de carga de proyecto.
//
// 'base' esta elegido POR MEDICION sobre maestro.m4a (286s), no por intuicion. Con umbral
// fijo de -10.8 dB de max_volume para los tres, derivado del segmento transcrito mas flojo:
//
//   tiny             45.6s   70 segmentos   33.02s de voz perdida (11.5%)   9 huecos >1s
//   base             77.6s   46 segmentos    8.26s (2.9%)                   2 huecos >1s
//   large-v3-turbo  272.1s   59 segmentos   12.52s (4.4%)                   3 huecos >1s
//
// large-v3-turbo esta DESCARTADO POR DATOS, no por coste: pierde MAS voz que base y tarda
// 3.5x mas. No es un intercambio, es peor en las dos dimensiones. Que nadie lo reproponga
// pensando que mas grande es mejor.
const MODELO_WHISPER = 'base';

// IPC listener for Whisper local transcription
ipcMain.on('start-transcription', async (event, filePath) => {
  const transcriptsDir = path.join(app.getPath('userData'), 'transcripts')
  if (!(await exists(transcriptsDir))) {
    await fs.promises.mkdir(transcriptsDir, { recursive: true })
  }

  // The output JSON file will be named [basename].json
  const basename = path.basename(filePath, path.extname(filePath))
  const expectedJsonPath = path.join(transcriptsDir, basename + '.json')

  // Clean up any existing transcript file first
  if (await exists(expectedJsonPath)) {
    try {
      await fs.promises.unlink(expectedJsonPath)
    } catch (e) {}
  }

  if (!(await exists(filePath))) {
    event.reply('transcription-update', {
      status: 'error',
      error: `El archivo de audio no existe en la ruta: ${filePath}`
    })
    return
  }

  // Notify renderer that the Whisper process is starting
  event.reply('transcription-update', {
    status: 'starting',
    message: 'Conectando con Whisper local y cargando modelo...'
  })

  // Spawn whisper command using shell: true for Windows compatibility
  // --word_timestamps: es lo que hace que cada segmento traiga sus palabras con `start` y
  // `end`. Sin el, elegir "la palabra que suena en este instante" es imposible — y es
  // exactamente lo que necesitan los Visuales.
  //
  // COSTE MEDIDO sobre 199 s de audio real, tres pasadas de cada: 57.7 s de mediana sin el y
  // 65.2 s con el. +9%. No es el problema.
  //
  // OJO, LA SEGMENTACION CAMBIA, y esto no es ruido: activa el alineamiento por atencion y
  // Whisper reancla las palabras. Medido, con las tres pasadas de cada grupo IDENTICAS al
  // milisegundo entre si —o sea que la diferencia la causa el flag, no la varianza—:
  //   sin: 80 segmentos, ultimo end 200.32   con: 79 segmentos, ultimo end 199.22
  //   77 de 79 `start` distintos (hasta 3.86 s), 79 `end` distintos, 48 textos distintos.
  // Cambia A MEJOR: "el data se enterce a cabo el agua" pasa a "el data center se acaba el
  // agua". Y el ultimo `end` deja de pasarse del audio (199.25 s reales).
  //
  // LOS PROYECTOS YA TRANSCRITOS NO SE TOCAN. Su transcripcion sigue en project-state.json tal
  // como se guardo. Solo los que se transcriban a partir de ahora saldran con otro reparto de
  // frases —mejor, pero distinto—, y con el reparto cambia el guion, los cortes, los graficos
  // y la sincronia de ESE proyecto.
  const whisperProcess = spawn('whisper', [
    `"${filePath}"`,
    '--language', 'Spanish',
    '--model', MODELO_WHISPER,
    '--output_format', 'json',
    '--word_timestamps', 'True',
    '--output_dir', `"${transcriptsDir}"`
  ], { shell: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })

  let progressBuffer = ''

  whisperProcess.stdout.on('data', (data) => {
    const chunk = data.toString()
    progressBuffer += chunk
    
    // Split lines and stream the lines that contain transcription timestamps
    const lines = progressBuffer.split('\n')
    progressBuffer = lines.pop() || '' // keep last unfinished line

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) {
        event.reply('transcription-update', { 
          status: 'progress', 
          message: trimmed 
        })
      }
    }
  })

  whisperProcess.stderr.on('data', (data) => {
    const chunk = data.toString().trim()
    if (chunk) {
      // Whisper prints loading models and device information to stderr.
      event.reply('transcription-update', { 
        status: 'progress', 
        message: chunk 
      })
    }
  })

  whisperProcess.on('close', async (code) => {
    if (code === 0) {
      try {
        if (await exists(expectedJsonPath)) {
          const rawData = await fs.promises.readFile(expectedJsonPath, 'utf8')
          const parsed = JSON.parse(rawData)

          // La `probability` de cada palabra viene con 16 decimales
          // (0.2687504291534424) y era LA MITAD del peso que añaden los words: +54.9 KB sobre
          // 31.5 en un audio de 199 s, medido. Se redondea a dos aqui, en el UNICO punto por
          // el que pasa la transcripcion antes de llegar al renderer, que la guarda entera en
          // project-state.json.
          // Se redondea y NO se borra: si algun dia hace falta mas precision se sube el numero;
          // quitar el campo del todo seria mas dificil de deshacer.
          for (const seg of (parsed?.segments || [])) {
            for (const w of (seg?.words || [])) {
              if (typeof w.probability === 'number') w.probability = Math.round(w.probability * 100) / 100;
            }
          }

          // Send the full results (segments) back to the renderer. Van ENTEROS, con sus
          // `words`: el renderer hace setTranscriptSegments(data.result.segments) sin filtrar
          // campos, asi que lo que llegue aqui es lo que acaba en project-state.json.
          event.reply('transcription-update', { 
            status: 'success', 
            result: parsed 
          })

          // Clean up the JSON file to keep system clean
          try {
            await fs.promises.unlink(expectedJsonPath)
          } catch (e) {}
        } else {
          event.reply('transcription-update', { 
            status: 'error', 
            error: 'No se generó el archivo de transcripción JSON esperado.' 
          })
        }
      } catch (err: any) {
        event.reply('transcription-update', { 
          status: 'error', 
          error: `Error al procesar el archivo de salida de Whisper: ${err.message}` 
        })
      }
    } else {
      event.reply('transcription-update', { 
        status: 'error', 
        error: `Whisper falló con código de salida ${code}` 
      })
    }
  })
})

let activeProjectPath: string | null = null;
// Keeps unknown persisted fields even when open-project selected a non-default JSON name.
let activeProjectStateFile: string | null = null;

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '')             // Trim - from end
}

async function getProjectsDir(): Promise<string> {
  const cwd = process.cwd();
  let baseDir = cwd;
  if (path.basename(cwd) !== 'cipher-studio') {
    baseDir = path.join(cwd, 'cipher-studio');
  }
  const dir = path.join(baseDir, 'proyectos');
  if (!(await exists(dir))) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  return dir;
}

// ── Estructura de un proyecto ────────────────────────────────────────────────────
// MATERIALES: lo que el proyecto NECESITA para funcionar. No se borra NUNCA de forma
//   automatica. originales/ no se recupera sin reimportar el video (banco-clips/
//   originales esta vacio); ia/ y pista-v2/ costaron dinero; stock/ es re-cortable pero
//   lo referencia el timeline.
// CACHE: lo que se regenera solo. Es lo unico que caduca.
// La carpeta `temp/` desaparece como concepto: su nombre invitaba a borrarla, y el
// propio codigo lo hacia — destruia los clips del usuario al abrir el proyecto.
//
// Los nombres describen el CONTENIDO, no el proveedor ni la funcion que los pidio:
//   ia/       era 'minimax', nombre de proveedor, y el proveedor ya cambio una vez.
//   pista-v2/ era 'sync-perfecta', nombre de funcion. Guarda una MEZCLA de stock e IA
//             cortada para la pista secundaria, asi que no puede colgar de ia/.
const SUB_MATERIALES = ['audio', 'voices', 'originales', 'stock', 'ia', 'pista-v2', 'visual'];

// 'graficos' SALIO de SUB_CACHE a proposito y no debe volver. Los MOV de los graficos son
// regenerables, si — pero caros: 1.65 MB y ~1.6s de render cada uno, 31s para los 19 de un
// proyecto tipico. Estando aqui, cleanupProjectTemp los borraba al cerrar el proyecto, y el
// valor de esa cache es justo el RE-EXPORT: borrarla al cerrar la anulaba entera.
// No sube a materiales/ porque no es irreemplazable, solo caro de regenerar.
// La carpeta la crea quien la llena: renderGraphicClip, con su propio mkdir recursive, igual
// que hace extraerAudioMaestro. initProjectDirs ya NO la crea.
// Consecuencia asumida: desde aqui NADA borra cache/graficos salvo borrar el proyecto
// entero. La caducidad es la PIEZA B; el barrido de huerfanos por hash, la pieza 5.
const SUB_CACHE = ['thumbnails'];

const dirMat = (proj: string, sub?: string) =>
  sub ? path.join(proj, 'materiales', sub) : path.join(proj, 'materiales');
const dirCache = (proj: string, sub?: string) =>
  sub ? path.join(proj, 'cache', sub) : path.join(proj, 'cache');

// path.relative en vez de startsWith: `C:\p\proyecto-copia` empieza por `C:\p\proyecto`
// y daria un falso "esta dentro".
const dentroDelProyecto = (p: string, proj: string) => {
  const rel = path.relative(proj, p);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
};

// Las que el codigo usa hoy. Una categoria fuera de esta lista no es una errata inocua: el
// clip deja de aparecer en la vista que le toca y no lo dice nadie.
const CATEGORIAS_CONOCIDAS = new Set([
  'original', 'stock', 'ia', 'vacio', 'v2_overlay', 'v2_base', 'cloned'
]);

// De que subcarpeta de materiales/ viene. Decide que puede hacer el usuario: originales no
// vuelve (banco-clips/originales esta vacio), stock es re-cortable, ia y pista-v2 costaron
// dinero.
const origenDe = (p: string, projPath: string | null) => {
  if (!p) return 'sin ruta';
  if (!projPath || !dentroDelProyecto(p, projPath)) return 'externo';
  const rel = path.relative(dirMat(projPath), p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return 'otro';
  const sub = rel.split(path.sep)[0];
  return SUB_MATERIALES.includes(sub) ? sub : 'otro';
};

// Tres estados, porque "falta" y "esta fuera pero existe" no son lo mismo y no pueden dar el
// mismo mensaje: lo primero esta roto AHORA, lo segundo funciona hoy y se rompe el dia que el
// usuario mueva el fichero. El v1Clip del video importado vive en el segundo estado a
// proposito (decision cerrada: no se copia, se avisa).
async function auditarClips(clips: any[], projPath: string | null) {
  const faltan: any[] = [], fuera: any[] = [], sinRuta: any[] = [], categorias: any[] = [];
  const graficos: any[] = [];

  for (const c of clips || []) {
    // G0: los clips 'graphic' NO son material de video y se resuelven ANTES que nada. No
    // tienen path —se construyen sin el en main.tsx:2642 y :2489— asi que sin esta rama
    // caerian en sinRuta, hayProblema se volveria true y la guarda bloquearia el export
    // diciendo "faltan 19 de N clips" con los 19 perfectamente correctos.
    //
    // Vive AQUI y no en la guarda del export porque auditarClips tiene DOS llamadores: la
    // guarda y load-project. Arreglarlo en la guarda dejaria el mismo falso positivo
    // esperando en el aviso al abrir (pieza 2). Es el patron de las dos vias de carga otra
    // vez: cerrar una puerta y dejar la otra abierta.
    //
    // El bucket solo lleva identidad. Cuando la pieza 1 renderice los MOV, la pregunta
    // "¿tengo los 19?" nace en la COBERTURA 2 de la pieza 3, que es donde esta la
    // informacion para contestarla. Fijar aqui la forma de ese dato seria adivinar.
    if (c && c.type === 'graphic') {
      graficos.push({ id: c && c.id, name: (c && c.name) || '(sin nombre)' });
      continue;
    }

    if (c && c.category && !CATEGORIAS_CONOCIDAS.has(c.category)) {
      categorias.push({ id: c.id, name: c.name, category: c.category });
    }
    const ficha = {
      id: c && c.id, name: (c && c.name) || '(sin nombre)', path: c && c.path,
      tipo: c && c.type, origen: origenDe(c && c.path, projPath)
    };
    // Un clip de timeline sin ruta se descarta en el export sin decir nada: el DIAG de A1 ya
    // los contaba como "sin path excluidos". Cuenta como ausencia, no como caso aparte.
    if (!c || !c.path) { sinRuta.push(ficha); continue; }
    if (!(await exists(c.path))) faltan.push(ficha);
    else if (projPath && !dentroDelProyecto(c.path, projPath)) fuera.push(ficha);
  }

  const porOrigen: Record<string, { faltan: number; fuera: number }> = {};
  const anotar = (o: string, campo: 'faltan' | 'fuera') => {
    if (!porOrigen[o]) porOrigen[o] = { faltan: 0, fuera: 0 };
    porOrigen[o][campo]++;
  };
  for (const f of faltan) anotar(f.origen, 'faltan');
  for (const f of fuera) anotar(f.origen, 'fuera');

  return {
    faltan, fuera, sinRuta, categorias, porOrigen, graficos,
    // total es lo AUDITADO como material. Si contase los graficos, el mensaje de la guarda
    // mentiria: "faltan 3 de 25" en un proyecto de 6 videos y 19 graficos.
    total: (clips || []).length - graficos.length,
    totalGraficos: graficos.length,
    hayProblema: faltan.length > 0 || sinRuta.length > 0
  };
}

// Miniatura de un clip: mismo nombre base con extension .jpg, en cache/thumbnails.
// Sustituye a los replace() de cadena, que asumian separador '/' y que el fragmento
// aparecia exactamente una vez.
const rutaMiniatura = (clipPath: string) => {
  const nombre = path.basename(clipPath, path.extname(clipPath)) + '.jpg';
  return activeProjectPath && clipPath.toLowerCase().startsWith(activeProjectPath.toLowerCase())
    ? path.join(dirCache(activeProjectPath, 'thumbnails'), nombre)
    : path.join(getBancoClipsPath(), 'thumbnails', nombre);
};

// Solo cache/. materiales/ no se toca aqui jamas.
async function cleanupProjectTemp(projectPath: string) {
  const base = dirCache(projectPath);
  if (!(await exists(base))) return;
  let n = 0;
  for (const sub of SUB_CACHE) {
    const p = path.join(base, sub);
    if (await exists(p)) {
      try { await fs.promises.rm(p, { recursive: true, force: true }); n++; }
      catch (e) { console.error(`[cleanupProjectTemp] no se pudo borrar ${p}:`, e); }
    }
  }
  console.log(`[cleanupProjectTemp] ${n} carpeta(s) de cache en ${base}. materiales/ intacto.`);
}

async function initProjectDirs(projectPath: string) {
  const folders = [
    'materiales', ...SUB_MATERIALES.map(s => path.join('materiales', s)),
    'cache', ...SUB_CACHE.map(s => path.join('cache', s))
  ];
  for (const f of folders) {
    const dir = path.join(projectPath, f);
    if (!(await exists(dir))) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }
}

// Project Management Handlers
ipcMain.handle('list-projects', async () => {
  try {
    const projectsDir = await getProjectsDir();
    const items = await fs.promises.readdir(projectsDir);
    const projectsList: any[] = [];
    
    for (const item of items) {
      const projectPath = path.join(projectsDir, item);
      const stat = await fs.promises.stat(projectPath);
      if (stat.isDirectory()) {
        const stateFile = path.join(projectPath, 'project-state.json');
        if (await exists(stateFile)) {
          try {
            const raw = await fs.promises.readFile(stateFile, 'utf8');
            const data = JSON.parse(raw);
            projectsList.push({
              id: data.id || item,
              name: data.name || item,
              durationSeconds: data.durationSeconds || 0,
              date: data.date || stat.mtimeMs,
              projectPath: projectPath,
              thumbnailUrl: data.thumbnailUrl || ''
            });
          } catch (e) {
            console.error(`Error al leer project-state.json en ${item}:`, e);
          }
        }
      }
    }
    
    projectsList.sort((a, b) => b.date - a.date);
    return { success: true, projects: projectsList };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('create-project', async (_event, { name }) => {
  try {
    const projectsDir = await getProjectsDir();
    const id = `${slugify(name || 'Nuevo Proyecto')}-${Date.now()}`;
    const projectPath = path.join(projectsDir, id);

    await initProjectDirs(projectPath);
    
    const initialState = {
      id,
      name,
      date: Date.now(),
      durationSeconds: 0,
      clips: [],
      timelineVideoClips: [],
      transcriptionStatus: '',
      transcriptSegments: [],
      aiScript: '',
      originalTranscriptText: '',
      voiceModel: 'Eleven English v1',
      voiceSpeaker: 'Rachel',
      voiceSpeed: 1.0,
      voiceStability: 50,
      generatedVoices: [],
      timelineWeights: [...PESOS_POR_DEFECTO]
    };
    
    const persistedState = createProjectFiles(projectPath, initialState);

    // El anterior se limpia cuando el nuevo YA existe. Antes se limpiaba primero, asi que
    // si la creacion fallaba te quedabas sin el viejo y sin el nuevo.
    const anterior = activeProjectPath;
    activeProjectPath = projectPath;
    activeProjectStateFile = path.join(projectPath, 'project-state.json');
    if (anterior && anterior !== projectPath) await cleanupProjectTemp(anterior);

    console.log(`[create-project] Proyecto creado en: ${projectPath}`);
    return { success: true, data: persistedState, projectPath };
  } catch (err: any) {
    return { success: false, error: err.message, code: err.code, details: err.details };
  }
});

ipcMain.handle('load-project', async (_event, { projectPath }) => {
  try {
    const stateFile = path.join(projectPath, 'project-state.json');
    if (!(await exists(stateFile)) && !(await exists(stateFile + '.bak'))) {
      return { success: false, error: 'No se encontró el estado del proyecto en la carpeta seleccionada.' };
    }

    const persistence = loadProjectFile(stateFile);
    const parsed = persistence.state;

    // Se crean las carpetas que falten, pero NO se limpia el temp del proyecto que se
    // ABRE: ahi viven sus clips. Antes era initProjectDirs -> cleanup -> initProjectDirs,
    // o sea borrar los clips y recrear las carpetas vacias. Por eso al reabrir un
    // proyecto no se veia nada: lo destruia el propio acto de abrirlo.
    await initProjectDirs(projectPath);

    // La limpieza del ANTERIOR va DESPUES de que el nuevo este cargado. Antes iba
    // primero, asi que una carga fallida destruia el viejo sin abrir el nuevo.
    const anterior = activeProjectPath;
    activeProjectPath = projectPath;
    activeProjectStateFile = stateFile;
    if (anterior && anterior !== projectPath) await cleanupProjectTemp(anterior);

    // La auditoria se calcula AQUI, en el backend, y no en el frontend: hay dos caminos de
    // carga en main.tsx y es el patron que ya mordio una vez —arreglar uno y dejar el otro
    // vivo. Se devuelve; la PIEZA 2 sera quien la muestre.
    const auditoria = await auditarClips(
      [...(parsed.clips || []), ...(parsed.timelineVideoClips || [])], projectPath);
    if (auditoria.hayProblema || auditoria.categorias.length) {
      await writeDebugLog(`[LOAD-AUDIT] ${projectPath}: faltan=${auditoria.faltan.length} ` +
        `fuera=${auditoria.fuera.length} sinRuta=${auditoria.sinRuta.length} ` +
        `categoriasRaras=${auditoria.categorias.length}`);
    }

    console.log(`[load-project] Proyecto cargado desde: ${projectPath}`);
    return { success: true, data: parsed, projectPath, auditoria, persistence };
  } catch (err: any) {
    return { success: false, error: err.message, code: err.code, details: err.details };
  }
});

ipcMain.handle('close-project', async () => {
  try {
    if (activeProjectPath) {
      await cleanupProjectTemp(activeProjectPath);
      console.log(`[close-project] Proyecto cerrado y temporales limpiados: ${activeProjectPath}`);
      activeProjectPath = null;
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// En Windows el antivirus o el indexador retienen un handle un instante y rm devuelve
// EPERM. Reintentar lo resuelve: medido aqui, una carpeta que fallo con EPERM se borro sin
// problema al reintentarla despues. NO es el atributo ReadOnly ni la ACL heredada — ambos
// estan presentes en carpetas que se borran a la primera.
const OPCIONES_BORRADO = { recursive: true, force: true, maxRetries: 10, retryDelay: 150 };

// Extrae la pista de audio del video fuente a materiales/audio/, para que el proyecto no
// dependa de un fichero de FUERA de su carpeta. Medido: los ficheros externos que
// referenciaban los proyectos pesaban 45.9 MB de media; la pista sola de un video de 286 s
// son ~4.4 MB. Se extrae el audio, no se copia el video.
// Extrae la pista de audio a materiales/audio/maestro.m4a. Vive en UNA funcion porque tiene
// DOS llamadores: el boton "Usar Audio Original" y la sincronia perfecta. Cuando el codigo
// solo estaba en el handler, la sincronia perfecta abrio una tercera puerta al mismo bug.
async function extraerAudioMaestro(videoPath: string, projPath: string) {
  const destDir = dirMat(projPath, 'audio');
  if (!(await exists(destDir))) await fs.promises.mkdir(destDir, { recursive: true });
  const destino = path.join(destDir, 'maestro.m4a');

  // Se escribe a un temporal y se RENOMBRA. El rename es atomico dentro del mismo volumen,
  // asi que si ffmpeg muere a mitad —o se cierra la app— el maestro.m4a ANTERIOR sigue
  // entero. Escribiendo directo sobre el destino quedaba un fichero truncado que PARECE
  // bueno: existe, pesa, y el fallo solo aparece al reproducirlo.
  // Importa desde que esto se re-ejecuta sobre un maestro que ya existe (el recorte previo a
  // transcribir), no solo la primera vez.
  // La extension del temporal acaba en .m4a a proposito: ffmpeg elige el muxer por ella.
  const temporal = destino + '.tmp.m4a';

  // -vn quita el video. Se recodifica a AAC en vez de -c:a copy porque la pista de origen
  // puede venir en un formato que el <audio> del renderer no reproduzca.
  const cmd = `ffmpeg -y -i "${videoPath.replace(/"/g, '\\"')}" -vn -c:a aac -b:a 128k ` +
    `-movflags +faststart "${temporal.replace(/"/g, '\\"')}"`;
  try {
    await new Promise<void>((res, rej) => {
      exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => err ? rej(err) : res());
    });
    if (!(await exists(temporal))) throw new Error('ffmpeg no genero el audio.');
    await fs.promises.rename(temporal, destino);
  } catch (e) {
    try { await fs.promises.unlink(temporal); } catch (_e) {}
    throw e;
  }

  const durationSeconds = await getVideoDuration(destino);
  const { size } = await fs.promises.stat(destino);
  await writeDebugLog(`[AUDIO-MAESTRO] ${(size / 1048576).toFixed(1)} MB, ` +
    `${durationSeconds.toFixed(2)}s extraidos de ${videoPath}`);

  return { path: destino, durationSeconds, url: urlDeRuta(destino) };
}

ipcMain.handle('extract-master-audio', async (_event, { videoPath }) => {
  try {
    if (!activeProjectPath) return { success: false, error: 'No hay proyecto activo.' };
    if (!videoPath || !(await exists(videoPath))) {
      return { success: false, error: `El video no existe: ${videoPath}` };
    }
    // url file:/// en vez del blob: del renderer, que muere con la pagina que lo creo.
    const r = await extraerAudioMaestro(videoPath, activeProjectPath);
    return { success: true, path: r.path, durationSeconds: r.durationSeconds, url: r.url };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Un frame a 30 fps = 33 ms. Por debajo de eso NO hay recorte que materializar: el numero
// llega de un arrastre de raton —pixeles convertidos a segundos en main.tsx:739— y no cae
// nunca en un valor exacto. Sin este margen se copiarian 26 MB para no recortar nada.
const TOLERANCIA_RECORTE_S = 1 / 30;

// Materializa el recorte del usuario ANTES de transcribir. Sin esto el recorte solo vivia en
// dos numeros del clip de la linea de tiempo y los SEIS procesos que leen el video seguian
// usando el fichero entero: Whisper transcribia 1048s de un video recortado a 580s, y FASE 5
// acababa generando 388 sub-clips para borrar 168 con sus ficheros. Medido en un proyecto
// real: el video final salio a la mitad de lo que duraba el guion.
ipcMain.handle('recortar-fuente', async (_event, { videoPath, duracion }) => {
  try {
    if (!activeProjectPath) return { success: false, error: 'No hay proyecto activo.' };
    if (!videoPath || !(await exists(videoPath))) {
      return { success: false, error: `El video no existe: ${videoPath}` };
    }

    const durOriginal = await getVideoDuration(videoPath);
    const dur = Number(duracion);

    // Ante un numero que no se entiende NO se inventa un recorte: se sigue con el fichero tal
    // cual. Degradar a "no recortar" es seguro; degradar a "recortar por un valor raro"
    // destruiria material del usuario.
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(durOriginal) || durOriginal <= 0) {
      await writeDebugLog(`[RECORTE] Duracion no utilizable (pedida=${duracion}, ` +
        `fichero=${durOriginal}). Se transcribe el original.`);
      return { success: true, recortado: false, path: videoPath, durationSeconds: durOriginal || 0 };
    }

    let fuenteFinal = videoPath;
    let durFinal = durOriginal;
    let recortado = false;

    if (durOriginal - dur <= TOLERANCIA_RECORTE_S) {
      // Se pide la duracion completa: no hay nada que cortar, pero SI hay que rehacer el
      // audio. Es el caso de deshacer un recorte anterior: el video vuelve a durar lo que
      // duraba y el maestro se habria quedado con la duracion del recorte viejo.
      await writeDebugLog(`[RECORTE] Sin corte (pedido ${dur.toFixed(3)}s de ` +
        `${durOriginal.toFixed(3)}s, diferencia < 1 frame): se rehace el audio desde el original.`);
    } else {
    const destino = path.join(dirMat(activeProjectPath, 'originales'), 'fuente_recortada.mp4');
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    const temporal = destino + '.tmp.mp4';

    // SOLO -t. Ni crop, ni zoom, ni pan, ni espejo: esos viven en ajustesVideo y se aplican en
    // la normalizacion del export (construirVF). Aplicarlos AQUI los aplicaria DOS VECES —un
    // zoom de 1.5 saldria 2.25— porque los clips que salgan de este fichero son de categoria
    // 'original', que es justo la que los recibe alli.
    //
    // Tampoco hay -ss: hoy NO existe punto de entrada. trim-left mueve startSeconds, que es la
    // POSICION en la linea de tiempo y no el segundo del fichero por el que empezar. Un -ss
    // aqui se inventaria un dato que nadie ha fijado.
    //
    // -c copy: 146 ms medidos sobre un video de 17 min, sin recodificar y sin segunda
    // generacion de compresion. El corte es EXACTO aunque los keyframes vayan cada ~5s:
    // comprobado por CONTENIDO —el hash del primer frame del recorte coincide con el del
    // original en ese segundo— y no por los metadatos.
    const cmd = `ffmpeg -y -i "${videoPath.replace(/"/g, '\\"')}" -t ${dur} -c copy ` +
      `-movflags +faststart "${temporal.replace(/"/g, '\\"')}"`;
    try {
      await new Promise<void>((res, rej) => {
        exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => err ? rej(err) : res());
      });
      if (!(await exists(temporal))) throw new Error('ffmpeg no genero el recorte.');
      await fs.promises.rename(temporal, destino);
    } catch (e) {
      try { await fs.promises.unlink(temporal); } catch (_e) {}
      throw e;
    }

    fuenteFinal = destino;
    durFinal = await getVideoDuration(destino);
    recortado = true;
    const { size } = await fs.promises.stat(destino);
    await writeDebugLog(`[RECORTE] ${durOriginal.toFixed(2)}s -> ${durFinal.toFixed(2)}s ` +
      `(${(size / 1048576).toFixed(1)} MB) desde ${videoPath}`);
    }

    // EL AUDIO SIGUE AL VIDEO, siempre y desde el MISMO fichero, se haya cortado o no. Nunca
    // uno de una duracion y otro de otra: ese desajuste —579.77s en el registro contra
    // 1048.31s en el fichero— es el que hizo que la generacion produjera 388 sub-clips para
    // borrar 168 con sus ficheros, y que el video final saliera a la mitad del guion.
    try {
      const audio = await extraerAudioMaestro(fuenteFinal, activeProjectPath);
      return {
        success: true, recortado,
        path: fuenteFinal, url: urlDeRuta(fuenteFinal), durationSeconds: durFinal,
        audioPath: audio.path, audioUrl: audio.url, audioDurationSeconds: audio.durationSeconds
      };
    } catch (audioErr: any) {
      // El video quedo preparado y el maestro NO. Se dice con todas las letras que puede haber
      // quedado un fichero suelto y con que maestro se queda el proyecto: nada apunta todavia
      // al recorte —el frontend solo mueve la biblioteca si esto sale bien— asi que el estado
      // es coherente, pero quien lea el log tiene que poder entender el fichero huerfano sin
      // reconstruir la historia.
      await writeDebugLog(`[RECORTE] El video quedo preparado (${fuenteFinal}) pero la ` +
        `re-extraccion del audio maestro FALLO: ${audioErr.message}. El proyecto sigue con el ` +
        `maestro anterior, intacto, y con la biblioteca apuntando a lo de antes. Si se creo un ` +
        `fuente_recortada.mp4 queda en disco sin que nadie lo use: se puede borrar a mano o se ` +
        `sobrescribira al reintentar.`);
      return { success: false, error: `El vídeo se preparó pero no se pudo rehacer el audio: ${audioErr.message}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Las NUEVE combinaciones de formato y resolucion, en UN SOLO SITIO. Estaban en linea dentro
// de export-video y ahora las comparte con el lote de graficos.
//
// No es cosmetico: el WxH entra en el hash del MOV. Si el lote y el export calcularan el
// tamano por separado y alguien tocara uno de los dos, la cache fallaria SIEMPRE y sin
// sintoma — se re-renderizarian los 19 graficos en cada export y nada lo diria. Peor todavia
// seria acertar con el tamano equivocado: un MOV de 1080 escalado a 4K.
export function dimensionesDeExport(aspectRatio?: string, resolution?: string):
    { ancho: number; alto: number } {
  if (aspectRatio === 'vertical') {
    if (resolution === '4K') return { ancho: 2160, alto: 3840 };
    if (resolution === '720p') return { ancho: 720, alto: 1280 };
    return { ancho: 1080, alto: 1920 };
  }
  if (aspectRatio === 'square') {
    if (resolution === '4K') return { ancho: 2160, alto: 2160 };
    if (resolution === '720p') return { ancho: 720, alto: 720 };
    return { ancho: 1080, alto: 1080 };
  }
  // horizontal, y tambien CUALQUIER valor desconocido: es el comportamiento del bloque
  // original, cuyo ultimo `else` no comprobaba nada. Igual con la resolucion: el ultimo
  // `else` era 1080p, asi que un valor raro cae ahi y no revienta.
  if (resolution === '4K') return { ancho: 3840, alto: 2160 };
  if (resolution === '720p') return { ancho: 1280, alto: 720 };
  return { ancho: 1920, alto: 1080 };
}

// ── Render de graficos (via G) ──────────────────────────────────────────────────────
// La pagina (dist/grafico.html) ya expone __montar, __setT y __listo desde 993de27. Esto es
// la mitad que faltaba: la ventana offscreen, el lazo cerrado y el pipe a ffmpeg.

// ACOPLADO a grafico.tsx. Las dos constantes de aqui abajo son copias de valores que vive
// en la pagina, y no hay nada que las mantenga sincronizadas: si cambia una, HAY QUE
// CAMBIAR LA OTRA A MANO o el lazo cerrado deja de cuadrar y todos los frames agotan los
// intentos.
//   SONDA_ALTO  <->  const SONDA_ALTO de grafico.tsx
//   SONDA_FPS   <->  el 30 FIJO de `Math.round((t * 30) % 255)` en __setT
// SONDA_FPS NO es el fps del render: la pagina codifica la sonda con 30 fijo, asi que a
// 60 fps la sonda sigue avanzando de 30 en 30 por segundo. Usar el fps real aqui era un
// bug: coincidian solo cuando fps valia 30.
const SONDA_ALTO = 8;
const SONDA_FPS = 30;
const MAX_INTENTOS_FRAME = 5;  // medido: nunca hicieron falta mas de 2

let ventanaGraficos: BrowserWindow | null = null;

// DOS banderas, y no una, porque responden a preguntas distintas:
//   loteGraficosActivo — "¿hay trabajo de graficos vivo, para que window-all-closed no mate la
//                         app?". Se ANIDA: renderGraphicClip la guarda y la restaura porque
//                         corre dentro del lote, y esta en true tambien durante un render
//                         suelto.
//   loteEnCurso        — "¿hay ya un LOTE?". Es exclusion mutua plana: o hay lote o no lo hay,
//                         nunca anidada.
// Colapsarlas obligaria a que una de las dos mintiera: usar loteGraficosActivo como exclusion
// haria que un renderGraphicClip individual bloqueara un lote entero.
let loteGraficosActivo = false;
let loteEnCurso = false;

// Canoniza un valor a una cadena estable: claves ordenadas alfabeticamente en TODOS los
// niveles, y null/undefined colapsan a la misma cadena. Sin esto, `extra` —un objeto libre
// que viene del modelo— cambiaria la clave segun el orden en que llegaran sus claves, y el
// mismo grafico daria dos hashes.
const canonizar = (v: any): string => {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return '[' + v.map(canonizar).join(',') + ']';
  if (typeof v === 'object') {
    return '{' + Object.keys(v).sort()
      .map(k => JSON.stringify(k) + ':' + canonizar(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
};

// NUNCA JSON.stringify(graphicData). Ese objeto nace de TRES formas distintas —el objeto
// crudo de DeepSeek con el orden que traiga (:3847), un literal de ocho claves (:2774) y uno
// de seis (:3611)— asi que el mismo grafico daria hashes distintos segun por donde entrase.
//
// Se proyectan SOLO las seis claves que lee AnimatedGraphic (AnimatedGraphic.tsx:78), en un
// orden fijo escrito AQUI. graphicStart y graphicEnd viven dentro de graphicData en dos de
// las tres formas, pero el componente NO las lee: quedan fuera POR CONSTRUCCION, sin un
// delete que se pueda olvidar. Es la decision cerrada de que el tiempo de inicio no entra en
// la clave — si entrara, mover un clip 0.1s re-renderizaria un fichero byte a byte identico.
// SUBIR AL TOCAR AnimatedGraphic.tsx, su CSS, o el layout de grafico.tsx —la escala o el
// margen inferior—. El CSS no puede entrar en el hash, asi que sin esta constante un cambio de
// diseño deja el hash IDENTICO: la cache devuelve el MOV viejo, el log dice ACIERTO y el export
// dice "39 de 39". Todo verde con el diseño antiguo. Es el peor modo de fallo que hay, porque
// el sistema afirma activamente que ha funcionado.
//
// 8 -- la pasada de pulido del mapa. Se quita el PIE de la composicion (la palabra grande y su
// barra): un Visual de mapa ya dice su palabra en el NODO ANCLA del centro, y repetirla abajo a
// pantalla completa era decirla dos veces. `value` no desaparece de ningun sitio -- sigue
// sembrando el dibujo y sigue siendo el ancla -- y las 17 tarjetas conservan SU pie, porque
// `extrusion` declara pintaPie:false.
//
// Con el pie fuera, el mapa se reparte en mas alto: ZONA.yMax 68 -> 77, y las cuatro familias
// estiran sus posiciones base. Y eso arrastra el remate: FOCO 38 -> 45 y los tres `top` de
// .cm-destello, .cm-halo y .cm-icono con el, porque el foco es donde COLAPSA el mapa y donde
// NACE el icono; dejarlo en 38 con el mapa hasta el 77 habria tirado el colapso hacia arriba y
// el icono habria aparecido descentrado. El glifo pasa de 30cqw a 38cqw, que es lo que permite
// el cuadro entero disponible.
//
// Y sube la luz: glow en DOS capas en las cajas -- una cercana e intensa que define el canto y
// otra amplia y tenue que tine el aire-- porque una sola sombra da borde duro y no luz.
//
// 7 -- las cuatro constantes de `mapa` salen del TAMANO REAL de la caja, no del laboratorio.
// `separados` compara la semisuma de los dos anchos mas un margen en vez del `dx < 33` fijo, y
// el `dy < 9.5` pasa a la semisuma de los altos, que son 4.47 y 3.77 y no 9.5. `flecha` recorta
// por interseccion rayo-rectangulo con la tangente de la Bezier en vez del `k1 = 10 / k2 = 17`
// isotropo, que en una flecha vertical recortaba mas de tres veces de mas y la dejaba
// arrancando en el aire.
//
// LAS CONSTANTES NO ESTAN EN LA CLAVE, y ese es el motivo de subir esto AHORA y no agruparlo
// con nada: cambiarlas sin subir la version haria que cualquier render de prueba devolviera el
// .mp4 VIEJO desde la cache, y se estarian mirando frames que no corresponden al codigo. El
// dibujo cambia en todos los Visuales de mapa; cuesta ~1 minuto re-renderizar un video.
//
// 6 -- se arregla el desfase por reutilizacion de la raiz de React entre clips (10 septies de
// docs/AUDITORIA.md). `__montar` desmonta y vuelve a montar, asi que una animacion ya no puede
// aplicar la curva del clip anterior. NO cambia ningun diseño: cambia que lo renderizado SEA lo
// que la composicion dice.
//
// Y por eso justamente hay que subir esto. Los .mp4 que hay en disco tienen el hash CORRECTO
// para su entrada, pero dentro llevan pixeles del clip que se renderizo antes. Con las MISMAS
// entradas el arreglo produce pixeles distintos, asi que sin esta subida la cache devolveria
// para siempre los ficheros malos diciendo ACIERTO — que es exactamente el modo de fallo que
// esta constante existe para evitar. Afecta a las DOS composiciones y a todos los Visuales ya
// renderizados. Cuesta re-renderizar ~15 Visuales por proyecto, ~1 minuto.
//
// 5 — los tres conceptos y la posicion entran en `extra`, o sea en la CLAVE. Dos Visuales de
// la misma palabra en posiciones distintas dejan de compartir .mov: antes colisionaban —medido,
// 37 clips y 36 ficheros— y con la posicion dentro cada uno es unico. Se acepta perder el
// reaprovechamiento a cambio de que la clave describa el dibujo.
//
// 4 — la palabra del Visual sale SIN la puntuacion de los bordes. Antes se pintaba
// "fallecidos." con el punto y "maneras," con la coma: 9 de 37 (24%) medido. Cambia lo que se
// ve en el 24% de los Visuales, asi que los .mp4 de la version 3 ya no valen.
//
// 3 — la semilla sale de la PALABRA, asi que cada Visual tiene su propia disposicion: cambian
// las capas, el ancho, la amplitud del vaiven y el cabeceo. Ademas la escena se ajusta hacia
// mas autoridad: fuera el anillo de chispas, y el vaiven baja de +-52 grados a la banda 22-30.
// Todo lo ya renderizado cambia de pixeles, asi que sin subir esto la cache devolveria los
// .mov de la version anterior diciendo ACIERTO.
//
// 2 — entra el registro de composiciones. AnimatedGraphic tiene ahora una rama nueva en modo
// pantalla: si el `type` nombra una composicion registrada, se pinta esa en vez del Visual de
// texto. Los .mov de `visual_texto` ya renderizados siguen siendo correctos byte a byte, pero
// sin subir esto el hash de un Visual seria identico al de antes y la cache devolveria el
// fichero viejo diciendo ACIERTO: se veria exactamente lo mismo y pareceria que la composicion
// no funciona. Es el modo de fallo que esta constante existe para evitar, y cuesta re-renderizar
// lo que haya en cache (~2.7 s por grafico).
// Encargo 2: iconos, héroe, semilla por posición y relación cambian píxeles. Esta subida entra
// en el MISMO merge para que ninguna generación sirva caché vieja entre ambos commits.
// También invalida tarjetas sin cambios: coste aceptado de la versión global compartida.
// El contraste efectivo y el resolvedor Solar pueden cambiar píxeles sin modificar el
// graphicData ya cacheado; esta subida impide servirlo con apariencia antigua. También
// invalida tarjetas: coste aceptado para mantener una sola clave de versión global.
export const VERSION_PLANTILLAS = 13;

// EL FORMATO LO DECIDE EL MODO, y se dice AQUI una sola vez. Las tres cosas —codec, pix_fmt y
// extension— tienen que ir juntas o el fichero sale mintiendo sobre si mismo: un .mp4 con
// qtrle dentro, o un yuv420p con el alfa ya descartado en un contenedor que promete
// transparencia. Vive en un solo sitio para que en V2 no haya dos lugares decidiendo la
// extension y uno se quede atras.
//
// overlay:  la tarjeta va ENCIMA del video, asi que necesita alfa. qtrle es el unico codec
//           verificado que lo conserva sobre este bitmap BGRA (medido: sin el, 100% opaco).
// pantalla: el Visual SUSTITUYE al plano y ocupa el cuadro entero, asi que no hay nada debajo
//           y el alfa sobra. h264/yuv420p, que es lo que el resto del pipeline ya normaliza.
// `codec` es la IDENTIDAD y es lo que entra en la clave del hash. `encoder` es lo que recibe
// ffmpeg, que no siempre se llama igual: el codec h264 lo produce libx264. Separarlos evita
// tener que elegir entre una clave que miente y un comando ambiguo.
const FORMATO_POR_MODO = {
  overlay:  { codec: 'qtrle', encoder: 'qtrle',   pixFmt: 'argb',    ext: '.mov' },
  pantalla: { codec: 'h264',  encoder: 'libx264', pixFmt: 'yuv420p', ext: '.mp4' }
} as const;

// DONDE VIVE CADA COSA, y no es simetrico:
//   overlay  -> cache/graficos. Una tarjeta que falta NO rompe nada: el export compone las que
//               hay y el video sale igual de largo.
//   pantalla -> materiales/visual. Un Visual que falta SI rompe: es un clip normal del
//               timeline, su hueco ya esta contado en framesAcum, y el -shortest del mux
//               recorta el AUDIO. Medido por esa via: 3.24s de narracion perdidos.
// Un fichero regenerable cuya ausencia CORROMPE el resultado no es cache, es material. Por eso
// visual no entra en SUB_CACHE, que es lo que cleanupProjectTemp borra al cerrar el proyecto.
const dirDeModo = (proj: string, modo: 'overlay' | 'pantalla') =>
  modo === 'pantalla' ? dirMat(proj, 'visual') : dirCache(proj, 'graficos');

// Los NOMBRES de los sistemas de color. Los valores viven en renderer/src/sistemas.ts; aqui
// solo hacen falta los nombres, que son lo que entra en la clave del hash. Estan repetidos
// porque main y renderer se compilan por separado y hoy no comparten ningun modulo.
// LA ESCALA DE TIEMPO DEL PIPELINE, en un solo sitio.
//
// 30000 = fps * 1000: exactamente 1000 tics por frame a 30 fps, sin redondeos.
//
// TIENE que ser la MISMA en la normalizacion y en la composicion de tarjetas, y no es una
// preferencia: el concat final va con -c:v copy y NO puede mezclar escalas. Medido, cuatro
// trozos de 3 s con 360 frames en total:
//   30000+30000             -> 6.000s   correcto
//   15360+15360             -> 6.000s   correcto
//   30000+30000+15360+15360 -> 6.127s de 12.000 esperados: los frames se COMPRIMEN
//   15360+15360+30000+30000 -> 23.44s de 12.000: se ESTIRAN, y aparece un pts no monotono
// Los frames estan TODOS en los cuatro casos. Lo que se rompe son los TIEMPOS.
//
// Y se fija en la NORMALIZACION, no en el troceado, porque `-f segment` con `-c copy` IGNORA
// -video_track_timescale: medido, los segmentos salen con la escala del fichero de entrada
// pidiera lo que pidiera. El troceado no puede fijarla, la HEREDA. Asi que la fija quien
// recodifica y por donde pasan todos los clips.
// SE APLICA EN TODO comando que produzca un fichero destinado a un concat con -c:v copy, no
// solo en la normalizacion: los ficheros normalizados NO son los que se concatenan. Entre medias
// esta A4, que recorta los bodies y renderiza las transiciones, y esos tres comandos la
// necesitan igual. Medido tras arreglar solo la normalizacion: el video base seguia saliendo a
// 1/15360 y el derrumbe se repitio en el mismo frame.
//   :normalizacion   norm_*.mp4        -> alimenta a A4
//   :transiciones    transition_*.mp4  -> entra en el concat del base
//   :xfade           transition_*.mp4  -> entra en el concat del base
//   :bodies          body_*.mp4        -> entra en el concat del base
//   :composicion     comp_*.mp4        -> entra en el concat final
// Los concat y el mux van con -c:v copy y NO fijan escala: heredan la de sus entradas, asi que
// basta con que todas las entradas coincidan.
const TIMESCALE = 30000;

const SISTEMAS_VALIDOS = Object.keys(SISTEMAS) as NombreSistema[];

/** Una paleta por vídeo/proyecto: se resuelve una vez antes del lote, nunca por sub-clip. */
export function sistemaDeGeneracion(idEstable: string): NombreSistema {
  const digest = createHash('sha256').update(String(idEstable)).digest();
  return SISTEMAS_VALIDOS[digest[0] % SISTEMAS_VALIDOS.length];
}

// Se EXPORTA para que la prueba pueda comprobar la clave directamente, sin renderizar. Las
// propiedades que importan de un hash —que dos entradas distintas den claves distintas, que
// sea estable— se verifican mejor sobre la funcion que a traves del nombre de un fichero.
export function hashGraficoConVersionPlantillas(
  graphicData: any,
  ancho: number,
  alto: number,
  duracion: number,
  fps: number,
  modo: 'overlay' | 'pantalla',
  sistema: NombreSistema,
  versionPlantillas: number,
): string {
  if (!Number.isSafeInteger(versionPlantillas) || versionPlantillas < 1)
    throw new Error('VERSION_PLANTILLAS inválida para identidad de caché');
  const g = graphicData || {};
  const sceneSpec = sceneSpecFromGraphicData(g);
  // Legacy keeps its byte-for-byte identity projection. The productive scene path ignores
  // value/label/emoji and unrelated extra fields because it paints only sceneSpec. This is the
  // explicit PixelIdentity boundary: adding a path or provider beside sceneSpec cannot poison
  // the cache, and changing a visual field cannot evade it.
  const contenido = sceneSpec
    ? [canonizar(g.type), 'sceneSpec=' + sceneSpecPixelIdentity(sceneSpec)]
    : [canonizar(g.type), canonizar(g.value), canonizar(g.label),
        canonizar(g.unit), canonizar(g.emoji), canonizar(g.extra)];
  const partes = [
    ...contenido,
    // La duracion SI entra: 2s y 3s son animaciones distintas, no la misma estirada.
    String(ancho), String(alto), String(duracion), String(fps),
    'plantillas=' + versionPlantillas,
    // EL MODO Y EL CODEC ENTRAN, y esto arregla un fallo que YA EXISTE hoy: el modo cambia el
    // layout —'pantalla' centra y quita el margen inferior, 'overlay' lo pega abajo— y sin el
    // en la clave la misma tarjeta en los dos modos devolveria el fichero del OTRO, con el log
    // diciendo ACIERTO. Nadie lo ha disparado solo porque nadie pasa 'pantalla' todavia.
    // El codec entra ademas porque un MOV con alfa y un MP4 opaco del MISMO contenido son
    // ficheros distintos que no pueden compartir clave.
    'modo=' + modo,
    'codec=' + FORMATO_POR_MODO[modo].codec,
    // El sistema de color cambia TODOS los pixeles sin cambiar un solo dato. Mismo argumento
    // que modo y codec: el CSS no puede entrar en el hash, asi que lo que lo altere necesita
    // su propio campo. Un donut al 87% en editorial y el mismo en voltaje son dos ficheros.
    'sistema=' + sistema
  ];
  return createHash('sha1').update(partes.join('|')).digest('hex').slice(0, 12);
}

export function hashGrafico(graphicData: any, ancho: number, alto: number,
                            duracion: number, fps: number,
                            modo: 'overlay' | 'pantalla',
                            sistema: NombreSistema = 'voltaje'): string {
  return hashGraficoConVersionPlantillas(
    graphicData, ancho, alto, duracion, fps, modo, sistema, VERSION_PLANTILLAS,
  );
}

async function obtenerVentanaGraficos(ancho: number, alto: number): Promise<BrowserWindow> {
  const altoTotal = alto + SONDA_ALTO;

  if (ventanaGraficos && !ventanaGraficos.isDestroyed()) {
    const [w, h] = ventanaGraficos.getContentSize();
    if (w !== ancho || h !== altoTotal) ventanaGraficos.setContentSize(ancho, altoTotal);
    return ventanaGraficos;
  }

  const v = new BrowserWindow({
    show: false,
    width: ancho, height: altoTotal,
    useContentSize: true, frame: false,
    // transparent + backgroundColor con alfa 0: sin esto la ventana compone sobre un fondo
    // OPACO y el bitmap sale con alfa 255 en todas partes. El pix_fmt del MOV seguiria
    // diciendo 'argb' —el contenedor lo declara igual— pero el alpha estaria PERDIDO, que es
    // la unica razon de usar qtrle. Medido con el test: 100% de pixeles opacos sin esto.
    // Que la pagina ponga `background: transparent` NO basta: eso es el contenido, no la
    // ventana.
    transparent: true,
    backgroundColor: '#00000000',
    // contextIsolation:false es la configuracion MEDIDA en el experimento: executeJavaScript
    // ve las __montar/__setT que define la propia pagina. No hay preload ni node aqui.
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: false }
  });

  const urlDev = process.env.VITE_DEV_SERVER_URL;
  if (urlDev) await v.loadURL(new URL('grafico.html', urlDev).toString());
  else await v.loadFile(path.join(process.env.DIST!, 'dist/grafico.html'));

  // OBLIGATORIO y no cosmetico: al CREARLA, Windows recorta la ventana al area de trabajo.
  // Medido: pedir 1080x1928 daba 1080x1032 y los MOV salian cortados por la mitad sin que
  // nada lo dijera. setContentSize DESPUES de cargar si lo aplica. enableLargerThanScreen
  // no sirve — es solo macOS, tambien medido.
  v.setContentSize(ancho, altoTotal);

  // __listo NO solo espera: FUERZA la carga de Outfit, Archivo y Anton con fonts.load() y
  // comprueba que estan de verdad. Espera aqui, UNA vez por ventana, y no en cada __montar:
  // asi el montaje de los graficos sigue siendo sincrono.
  const listo: any = await v.webContents.executeJavaScript('window.__listo()');

  // LAS FUENTES QUE FALTAN SE GRITAN. Sin esto, un woff2 que no llegue deja la ventana
  // pintando con la sans del sistema y no lo dice nadie: el MOV existe, dura lo que debe, sus
  // frames son distintos entre si y las nueve guardas dan verde. Es el mismo modo de fallo del
  // 10 septies —el sistema afirma que ha funcionado— y por eso se registra al crear la ventana
  // y no al primer sintoma raro.
  for (const a of (listo?.avisosFuentes ?? [])) {
    await writeDebugLog(`[GRAFICO] ${a}`);
  }

  ventanaGraficos = v;
  return v;
}

// El lote lo cierra quien lo abrio. Una sola ventana para todos los graficos: medido sobre
// 19 ciclos seguidos, no se degrada (reintentos 1.32 al principio y 1.32 al final), asi que
// reciclarla periodicamente no compra nada.
//
// PUNTA SUELTA hasta que exista la PIEZA 2: hoy no la llama NADIE, asi que la ventana queda
// viva despues del render. Si en ese estado el usuario cierra la ventana principal,
// 'window-all-closed' NO se dispara —la offscreen sigue contando como ventana— y la app NO
// se cierra: se queda como proceso huerfano sin interfaz. La pieza 2 tiene que llamar a
// esto en su finally.
// export: todavia no la llama nadie y sin el `export` tsc la rechaza con TS6133. Es ademas
// la superficie que consumira la PIEZA 2.
export function cerrarVentanaGraficos() {
  if (ventanaGraficos && !ventanaGraficos.isDestroyed()) ventanaGraficos.destroy();
  ventanaGraficos = null;
}

export type MedicionRenderGrafico = {
  hash: string;
  type: string;
  totalFrames: number;
  ancho: number;
  alto: number;
  ms: number;
  intentosTotales: number;
  intentosPorFrame: number;
  framesEnElTope: number;
  maxIntentosFrame: number;
};

const observadoresRendimientoGraficos = new Set<(m: MedicionRenderGrafico) => void>();

/**
 * Instrumentacion de medida, independiente de la cola del log. No decide si un render
 * es correcto ni participa en sus pixeles: solo publica los contadores que el lazo ya
 * calculaba. Devuelve una funcion para retirar el observador y no dejar estado entre pruebas.
 */
export function observarRendimientoGraficos(
  observador: (m: MedicionRenderGrafico) => void
): () => void {
  observadoresRendimientoGraficos.add(observador);
  return () => observadoresRendimientoGraficos.delete(observador);
}

function emitirMedicionRenderGrafico(medicion: MedicionRenderGrafico) {
  for (const observador of observadoresRendimientoGraficos) {
    try { observador(medicion); } catch { /* medir nunca puede romper el render */ }
  }
}

/**
 * Renderiza un grafico a un .mov con alpha. Devuelve la ruta, o null si falla: se pierde ese
 * grafico, nunca el export.
 *
 * TODAVIA SIN CACHE POR HASH — cada llamada renderiza. Es el paso siguiente.
 */
export async function renderGraphicClip(
  graphicData: any,
  opciones: {
    ancho?: number; alto?: number; fps?: number; duracion?: number;
    modo?: 'overlay' | 'pantalla';
    sistema?: string;
    /** Mandatory for extra.sceneSpec; legacy deliberately retains its current active project. */
    projectRoot?: string;
    /** Locator-only bindings. Never included in hashGrafico or graphicData. */
    renderBindings?: RenderBindingsV1;
    /** Diagnostics only: a QC rejection remains a rejected render and never changes pixels. */
    onQcFailure?: (report: VisualRuntimeQcReport) => void | Promise<void>;
    /** Diagnostics only: exposes the measured successful report without changing acceptance. */
    onQcReport?: (report: VisualRuntimeQcReport) => void | Promise<void>;
  } = {}
): Promise<string | null> {
  const ancho = opciones.ancho ?? 1080;
  const alto = opciones.alto ?? 1920;
  const fps = opciones.fps ?? 30;
  const duracion = opciones.duracion ?? 2;
  const modo = opciones.modo ?? 'overlay';
  const totalFrames = Math.round(duracion * fps);

  let preparado: ReturnType<typeof prepareGraphicForVisualRender>;
  try {
    preparado = prepareGraphicForVisualRender({
      graphicData,
      projectRoot: opciones.projectRoot,
      renderBindings: opciones.renderBindings,
    });
  } catch (e: any) {
    await writeDebugLog(`[GRAFICO] RenderSpec/binding rechazado: ${e.code || e.message}`);
    return null;
  }
  const graphicDataEfectivo = preparado.graphicData as any;
  if (preparado.kind === 'scene-spec' && modo !== 'pantalla') {
    await writeDebugLog('[GRAFICO] RenderSpec rechazado: la vía productiva sólo admite modo=pantalla.');
    return null;
  }
  const proyectoRender = visualRenderRoot(preparado, activeProjectPath);

  if (!proyectoRender) {
    await writeDebugLog('[GRAFICO] Sin proyecto activo: no se renderiza.');
    return null;
  }
  for (const warning of preparado.warnings) {
    await writeDebugLog(`[GRAFICO] SCENE-SPEC: ${warning}`);
  }

  // La carpeta la crea quien la llena, con su propio mkdir recursive. Hacen falta las dos
  // razones: cache/graficos salio de SUB_CACHE en 7dd9b64 para que cleanupProjectTemp dejara
  // de borrarla, asi que initProjectDirs no la crea; y materiales/visual SI esta en
  // SUB_MATERIALES, pero un proyecto anterior a este cambio no la tiene hasta que se abra.
  const destDir = dirDeModo(proyectoRender, modo);
  await fs.promises.mkdir(destDir, { recursive: true });

  // El nombre ES el hash: no hay indice que mantener ni que pueda desincronizarse del disco.
  // La extension sale de FORMATO_POR_MODO y no se escribe a mano: es el mismo sitio que decide
  // el codec, asi que no pueden discrepar.
  // El sistema se RESUELVE antes de hashear. Si se hasheara el nombre pedido y se pintara
  // otro, la clave describiria un fichero que no es el que hay en disco: la cache devolveria
  // colores distintos de los que su nombre promete.
  const sistemaPedido = preparado.kind === 'scene-spec'
    ? preparado.sceneSpec.sistema
    : opciones.sistema ?? 'voltaje';
  const sistema: NombreSistema = (SISTEMAS_VALIDOS as readonly string[]).includes(sistemaPedido)
    ? sistemaPedido as NombreSistema
    : 'voltaje';
  if (sistema !== sistemaPedido) {
    await writeDebugLog(`[GRAFICO] sistema desconocido "${sistemaPedido}": se usa voltaje.`);
  }

  const hash = hashGrafico(graphicDataEfectivo, ancho, alto, duracion, fps, modo, sistema);
  const destino = path.join(destDir, hash + FORMATO_POR_MODO[modo].ext);

  // ACIERTO. Se exige tamano > 0: un MOV de 0 bytes de un render interrumpido existe pero no
  // es un acierto, seria un hueco en el video.
  try {
    const st = await fs.promises.stat(destino);
    if (st.size > 0) {
      await writeDebugLog(`[GRAFICO] ACIERTO ${hash} — ${graphicData?.type} — ` +
        `${(st.size / 1048576).toFixed(2)} MB — sin renderizar`);
      return destino;
    }
    await writeDebugLog(`[GRAFICO] ${hash} estaba a 0 bytes: no cuenta, se re-renderiza.`);
  } catch (e) { /* no existe: se renderiza */ }

  const yaHabiaLote = loteGraficosActivo;
  loteGraficosActivo = true;

  let ff: ReturnType<typeof spawn> | null = null;
  const t0 = Date.now();
  let intentosTotales = 0;
  let framesEnElTope = 0;

  try {
    const v = await obtenerVentanaGraficos(ancho, alto);
    // `duracion` viaja a la pagina: es el CICLO, y de el derivan todas las duraciones de
    // animacion de una composicion. Ya estaba en la clave del hash desde el principio, asi que
    // dos Visuales con el mismo texto y distinta duracion ya eran ficheros distintos: pasarla
    // no cambia la cache ni invalida nada de lo renderizado.
    await v.webContents.executeJavaScript(
      `window.__montar(${JSON.stringify(graphicDataEfectivo)}, ` +
      `${JSON.stringify({ ancho, alto, modo, duracion, sistema })}, ` +
      `${JSON.stringify(preparado.preparedAssets)})`);

    // EL CANDADO DEL CICLO, recogido AQUI y no en la consola de la pagina. Esta ventana es
    // offscreen y su consola no la abre nadie: un console.warn ahi seria un aviso que nadie
    // puede leer. Medido en este mismo repo — un console.log puesto en el renderer para
    // diagnosticar la colocacion de las tarjetas nunca llego a generation-debug.log.
    // Cuesta un executeJavaScript (~1 ms) contra los ~2700 ms que cuesta el render.
    try {
      const avisos: string[] = await v.webContents.executeJavaScript(
        `(window.__avisosCiclo || [])`);
      for (const a of avisos) {
        await writeDebugLog(`[GRAFICO] CICLO: ${a}`);
      }
    } catch (e) { /* si no se pueden leer, no se bloquea el render por ello */ }

    // Que el bitmap mida lo pedido NO se da por hecho: es exactamente el fallo silencioso
    // que se midio. Si no cuadra se aborta antes de escribir un MOV cortado.
    const sonda0 = await v.webContents.capturePage();
    const tam = sonda0.getSize();
    if (tam.width !== ancho || tam.height !== alto + SONDA_ALTO) {
      throw new Error(`la ventana mide ${tam.width}x${tam.height} y se pidio ` +
        `${ancho}x${alto + SONDA_ALTO}: el MOV saldria recortado`);
    }

    if (preparado.kind === 'scene-spec') {
      const qc = await runVisualRuntimeQc(v, preparado.sceneSpec, duracion);
      if (opciones.onQcReport) await opciones.onQcReport(qc);
      for (const finding of qc.findings.filter(finding => finding.level === 'needs-review')) {
        await writeDebugLog(`[GRAFICO] QC NEEDS-REVIEW: ${finding.code} — ${finding.message}`);
      }
      await writeDebugLog(`[GRAFICO] QC OK — ${qc.snapshots.length} instantes — ` +
        `contraste local=${qc.localTextContrast?.toFixed(2) ?? 'no medido'}`);
    }

    // Patron NUEVO en este codigo: todo lo demas invoca ffmpeg con exec y una cadena. Aqui
    // hace falta spawn porque los frames entran por stdin y exec bufferea la salida entera.
    // El bitmap es BGRA (no RGBA). El codec y el pix_fmt salen de FORMATO_POR_MODO, el mismo
    // sitio que decide la extension y lo que entra en la clave: no pueden discrepar.
    //   overlay:  qtrle/argb, el unico codec verificado que conserva alpha sobre este bitmap.
    //   pantalla: libx264/yuv420p, que es lo que el resto del pipeline ya normaliza.
    const fmt = FORMATO_POR_MODO[modo];
    ff = spawn('ffmpeg', [
      '-y',
      '-f', 'rawvideo', '-pix_fmt', 'bgra',
      '-s', `${ancho}x${alto}`, '-r', String(fps),
      '-i', 'pipe:0',
      '-an', '-c:v', fmt.encoder, '-pix_fmt', fmt.pixFmt,
      // Calidad alta a proposito y SOLO para h264: este MP4 es un INTERMEDIO. El Visual entra
      // en el timeline como un clip mas, asi que la normalizacion del export lo vuelve a
      // codificar a crf 23; guardarlo ya a 23 apilaria dos generaciones de perdida sobre la
      // misma imagen. veryfast porque es intermedio, no el entregable.
      // NO esta medido: es el mismo criterio que usa la normalizacion, no un numero probado.
      //
      // COSTE, MEDIDO. 5 repeticiones por caso, cada una con un `value` distinto para que no
      // haya acierto de cache, y una tarjeta de CONTROL en la MISMA tirada — que es lo unico
      // que hace comparable el numero, porque la maquina cambia de estado entre tiradas:
      //
      //   caliente   Visual voltaje 3s   90f   4500 ms   50.3 ms/frame   0.08 MB
      //   caliente   Visual clinico 3s   90f   4471 ms   49.2 ms/frame   0.13 MB
      //   caliente   tarjeta 2s          60f   3036 ms   50.1 ms/frame   2.14 MB
      //
      // UN VISUAL CUESTA LO MISMO POR FRAME QUE UNA TARJETA: 50.3 contra 50.1, x1.00. El
      // Visual de 3s tarda mas solo porque tiene un 50% mas de frames.
      // EL SISTEMA DE COLOR NO INFLUYE: clinico, con fondo casi blanco, sale un 2.3% MAS
      // RAPIDO que voltaje. Dentro del ruido.
      // EL COSTE ESTA EN EL LAZO DE CAPTURA —capturePage mas los reintentos de la sonda—, NO
      // en el encoder: el MP4 pesa 0.06-0.13 MB contra los 2.1 MB del MOV, asi que codificar
      // es la parte barata. Por eso da igual el contenido y da igual el codec.
      // Frio y caliente apenas se distinguen (~50 ms/frame en ambos): crear la ventana son
      // ~150 ms que se diluyen en un render de 4.5 s.
      //
      // Para un video de 9 min (220 sub-clips, 17400 frames) al 25% con batching de 25 frases
      // por llamada, el NETO son +1.6 min: un Visual SUSTITUYE a un sub-clip, asi que quita su
      // descarga de stock o su corte de original en vez de sumarse. Al 100% son +6.5 min netos
      // sobre los ~8 min que hoy tarda FASE 3.
      //
      // LO QUE NO ESTA MEDIDO: los 14 s/lote de DeepSeek salen de FASE 2 pidiendo KEYWORDS, no
      // de pedir el contenido de un Visual — ese prompt todavia no existe. Si resulta mas largo
      // o el modelo tarda mas en componer, ese numero sube y el reparto de arriba cambia.
      // (Un dato anterior decia 54 contra 37 ms/frame y esta RETIRADO: los 37 venian de
      // tarjetas medidas en otra tirada, con la maquina en otro estado.)
      ...(modo === 'pantalla' ? ['-preset', 'veryfast', '-crf', '18'] : []),
      destino
    ]);

    // stderr es donde ffmpeg dice POR QUE murio. Ninguna llamada del proyecto lo lee hoy;
    // sin esto un fallo seria "codigo 1" y nada mas. Se acota para no crecer sin limite.
    let stderr = '';
    ff.stderr!.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 64000) stderr = stderr.slice(-64000);
    });

    const salida = new Promise<void>((resolve, reject) => {
      ff!.on('error', (e) => reject(new Error('no se pudo lanzar ffmpeg: ' + e.message)));
      ff!.on('close', (code) => code === 0
        ? resolve()
        : reject(new Error(`ffmpeg salio con codigo ${code}. stderr:\n` + stderr.slice(-1500))));
    });

    const bytesSonda = SONDA_ALTO * ancho * 4;
    const offSonda = (Math.floor(SONDA_ALTO / 2) * ancho + Math.floor(ancho / 2)) * 4;

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      // SONDA_FPS y no fps: la pagina codifica con 30 fijo. Ver el comentario del acoplado.
      const esperado = Math.round((t * SONDA_FPS) % 255);
      await v.webContents.executeJavaScript(`window.__setT(${t})`);

      // LAZO CERRADO. Medido: solo ~68% de los frames llega correcto a la primera captura;
      // sin esta comprobacion uno de cada tres MOV llevaria el frame equivocado.
      let frame: Buffer | null = null;
      for (let intento = 1; intento <= MAX_INTENTOS_FRAME; intento++) {
        const img = await v.webContents.capturePage();
        const raw = img.getBitmap();   // NO copia
        intentosTotales++;
        // Los TRES canales, no solo uno: la sonda es gris, asi que B, G y R tienen que
        // valer lo mismo Y coincidir con lo esperado. Cuesta igual y descarta ruido.
        const b = raw[offSonda], g = raw[offSonda + 1], r = raw[offSonda + 2];
        if (b === esperado && g === esperado && r === esperado) {
          // Buffer.from en el MISMO tick, antes de cualquier await. No se pudo demostrar que
          // haga falta (0 corrupciones en 12 muestras), pero getBitmap() no copia segun la
          // documentacion y eso es una carrera: 3 ms sobre 33 compran determinismo.
          // El subarray descarta la franja de la sonda, que no viaja a ffmpeg.
          frame = Buffer.from(raw.subarray(bytesSonda));
          if (intento === MAX_INTENTOS_FRAME) framesEnElTope++;
          break;
        }
      }
      if (!frame) {
        throw new Error(`el frame ${i} no llego tras ${MAX_INTENTOS_FRAME} intentos ` +
          `(se esperaba sonda=${esperado})`);
      }

      // Backpressure: si el pipe se llena, write devuelve false y hay que esperar a 'drain'.
      if (!ff.stdin!.write(frame)) await once(ff.stdin!, 'drain');
    }

    ff.stdin!.end();
    await salida;

    const { size } = await fs.promises.stat(destino);
    // framesEnElTope aparte de la media: un maximo de 5 suelto es ruido, pero veinte frames
    // rozando el tope es un tipo de grafico a punto de fallar entero.
    const ms = Date.now() - t0;
    const medicion: MedicionRenderGrafico = {
      hash,
      type: String(graphicDataEfectivo?.type ?? ''),
      totalFrames,
      ancho,
      alto,
      ms,
      intentosTotales,
      intentosPorFrame: intentosTotales / totalFrames,
      framesEnElTope,
      maxIntentosFrame: MAX_INTENTOS_FRAME
    };
    // Antes del await del log: la medida no depende de que su cola avance o llegue a disco.
    emitirMedicionRenderGrafico(medicion);
    await writeDebugLog(`[GRAFICO] RENDER ${hash} — ${graphicDataEfectivo?.type} — ` +
      `${totalFrames}f ${ancho}x${alto} — ${(size / 1048576).toFixed(2)} MB — ` +
      `${ms} ms — ${medicion.intentosPorFrame.toFixed(2)} intentos/frame — ` +
      `${framesEnElTope} frame(s) en el tope de ${MAX_INTENTOS_FRAME}`);
    return destino;

  } catch (e: any) {
    // Se pierde ESTE grafico, no el export. Y se dice por que.
    if (e instanceof VisualRuntimeQcError && opciones.onQcFailure) {
      try {
        await opciones.onQcFailure(e.report);
      } catch (diagnosticError: any) {
        await writeDebugLog(`[GRAFICO] No se pudo persistir diagnóstico QC: ${diagnosticError?.message ?? diagnosticError}`);
      }
    }
    await writeDebugLog(`[GRAFICO] FALLO (${graphicDataEfectivo?.type}): ${e.message}`);
    try { ff?.kill(); } catch {}
    try { await fs.promises.unlink(destino); } catch {}
    return null;
  } finally {
    loteGraficosActivo = yaHabiaLote;
  }
}

/**
 * Renderiza una lista de graficos con UNA sola ventana offscreen. Devuelve un array
 * POSICIONAL: rutas[i] es null si ese grafico falto, y los huecos NO desplazan a los demas.
 * La PIEZA 3 necesita saber CUAL falto para poder decir "esperaba 19, compuse 17".
 */
export async function renderGraphicClipsLote(
  peticiones: { graphicData: any; duracion?: number; projectRoot?: string; renderBindings?: RenderBindingsV1;
    diagnosticSceneId?: string }[],
  opciones: { aspectRatio?: string; resolution?: string;
              fps?: number; modo?: 'overlay' | 'pantalla';
              // Sin esto, un lote de Visuales los renderizaria TODOS con el sistema por
              // defecto y el usuario no podria elegir el color. Estaba anotado como pendiente.
              sistema?: string;
              onQcFailure?: (context: { index: number; sceneId?: string; hash: string }, report: VisualRuntimeQcReport) => void | Promise<void>;
              onQcReport?: (context: { index: number; sceneId?: string; hash: string }, report: VisualRuntimeQcReport) => void | Promise<void> } = {},
  emitirProgreso?: (p: { index: number; total: number; paragraph: string; type: string }) => void
) {
  // El lote no sabe de pixeles: recibe lo mismo que el export —formato y resolucion, que el
  // frontend ya tiene como estado persistido— y el tamano lo decide la funcion compartida.
  const { ancho, alto } = dimensionesDeExport(opciones.aspectRatio, opciones.resolution);
  const fps = opciones.fps ?? 30;
  const modo = opciones.modo ?? 'overlay';
  const total = peticiones.length;

  // Guarda de exclusion mutua. VA ANTES DEL try, y eso es lo que la hace correcta: si
  // estuviera dentro, el `finally` del lote rechazado llamaria a cerrarVentanaGraficos() y
  // DESTRUIRIA la ventana del lote que si esta trabajando — justo el destrozo que se quiere
  // evitar. El que llega tarde no toca nada.
  // Se rechaza en el acto, sin esperar ni encolar, y con la misma forma que la cancelacion por
  // falta de proyecto: asi quien lo consuma no necesita distinguir casos.
  if (loteEnCurso) {
    await writeDebugLog(`[GRAFICOS-LOTE] RECHAZADO: ya hay un lote en curso (${total} pedidos).`);
    return {
      rutas: new Array(total).fill(null) as (string | null)[], total,
      renderizados: 0, aciertos: 0, fallos: 0, sinIntentar: total,
      cancelado: true, motivo: 'ya hay un lote en curso'
    };
  }

  // Se captura AL EMPEZAR y en local. renderGraphicClip lee activeProjectPath en CADA
  // llamada, asi que sin esto un cambio de proyecto a mitad de un lote de 19 mandaria los MOV
  // restantes a cache/graficos del proyecto NUEVO, mezclando dos proyectos en disco.
  // Se CANCELA y no se bloquea: bloquear el cambio de proyecto 50 s se siente como que la app
  // se rompio, y cancelar no pierde trabajo — los MOV ya escritos siguen en cache/graficos y
  // la siguiente generacion los reutiliza en ~2 ms por el hash.
  const proyectoDelLote = activeProjectPath;

  const rutas: (string | null)[] = new Array(total).fill(null);
  const hashes: (string | null)[] = new Array(total).fill(null);
  let aciertos = 0, renderizados = 0, fallos = 0, intentados = 0;
  let cancelado = false, motivo = '';

  loteGraficosActivo = true;
  loteEnCurso = true;
  const t0 = Date.now();

  try {
    if (!proyectoDelLote) {
      cancelado = true;
      motivo = 'no hay proyecto activo';
    }

    for (let i = 0; i < total && !cancelado; i++) {
      if (activeProjectPath !== proyectoDelLote) {
        cancelado = true;
        motivo = `el proyecto cambio a mitad: ${path.basename(proyectoDelLote!)} -> ` +
          `${activeProjectPath ? path.basename(activeProjectPath) : '(ninguno)'}`;
        break;
      }

      const duracion = peticiones[i].duracion ?? 2;

      // SOLO para el texto del progreso. Un acierto de cache tarda ~2 ms, asi que anunciar
      // "renderizando" seria mentira y la barra saltaria sin explicacion. La AUTORIDAD sobre
      // si hay acierto es renderGraphicClip: si esto se equivocara, lo unico erroneo seria
      // una palabra en un mensaje.
      const hash = hashGrafico(peticiones[i].graphicData, ancho, alto, duracion, fps, modo,
        (SISTEMAS_VALIDOS as readonly string[]).includes(opciones.sistema ?? '')
          ? opciones.sistema as NombreSistema : 'voltaje');
      hashes[i] = hash;
      let cacheado = false;
      try {
        // dirDeModo y no dirCache: un lote en modo pantalla buscaria los .mp4 en cache y
        // diria "renderizando" en TODOS aunque fueran aciertos. Solo es el texto del progreso
        // —la autoridad es renderGraphicClip— pero seria un mensaje que miente.
        // `sistema` forma parte de esta misma vista previa y del render real: una paleta por
        // vídeo no puede reutilizar un MOV de otra aunque texto, dirección y duración coincidan.
        const st = await fs.promises.stat(
          path.join(dirDeModo(proyectoDelLote!, modo), hash + FORMATO_POR_MODO[modo].ext));
        cacheado = st.size > 0;
      } catch (e) { /* no esta: se renderiza */ }

      // index en BASE 0: el frontend hace `data.index + 1` (main.tsx:1403). Es el patron de
      // :3135 (`index: item.index - 1`), NO el de :4121, que manda base 1 y produce el
      // off-by-one anotado como deuda BAJA. Copiado del que esta bien.
      emitirProgreso?.({
        index: i, total,
        paragraph: cacheado
          ? `Gráfico ${i + 1} de ${total}: reutilizado de la caché`
          : `Renderizando gráfico ${i + 1} de ${total}...`,
        type: 'Gráficos'
      });

      intentados++;
      const ruta = await renderGraphicClip(peticiones[i].graphicData,
        {
          ancho, alto, fps, duracion, modo, sistema: opciones.sistema,
          projectRoot: peticiones[i].projectRoot,
          renderBindings: peticiones[i].renderBindings,
          onQcFailure: report => opciones.onQcFailure?.({ index: i, sceneId: peticiones[i].diagnosticSceneId, hash }, report),
          onQcReport: report => opciones.onQcReport?.({ index: i, sceneId: peticiones[i].diagnosticSceneId, hash }, report),
        });

      rutas[i] = ruta;                      // POSICIONAL: el hueco se queda en su sitio
      if (!ruta) fallos++;
      else if (cacheado) aciertos++;
      else renderizados++;
    }
  } finally {
    // Cierra la punta suelta de la PIEZA 1: la ventana offscreen no la cerraba nadie y quedaba
    // viva tras el render. Va ANTES de bajar la bandera a proposito: destruirla con
    // loteGraficosActivo todavia en true es lo que evita que window-all-closed mate la app si
    // resultara ser la ultima ventana viva.
    cerrarVentanaGraficos();
    loteGraficosActivo = false;
    loteEnCurso = false;
  }

  // Los "sin intentar" se dicen SIEMPRE que los haya: sin ese numero, un lote cancelado deja
  // "19 pedidos — 3 renderizados, 2 de cache, 0 fallidos" y faltan 14 sin explicar. Con el,
  // los sumandos cuadran con el total.
  const sinIntentar = total - intentados;
  await writeDebugLog(`[GRAFICOS-LOTE] ${total} pedidos — ${renderizados} renderizados, ` +
    `${aciertos} de cache, ${fallos} fallidos` +
    (sinIntentar > 0 ? `, ${sinIntentar} sin intentar` : '') +
    ` — ${((Date.now() - t0) / 1000).toFixed(1)}s` +
    (cancelado ? ` — CANCELADO: ${motivo}` : ''));

  return { rutas, hashes, total, renderizados, aciertos, fallos, sinIntentar, cancelado, motivo };
}

ipcMain.handle('render-graphics-batch', async (event,
    { graficos, aspectRatio, resolution, fps, modo }) => {
  try {
    const r = await renderGraphicClipsLote(graficos || [],
      { aspectRatio, resolution, fps, modo },
      (p) => event.sender.send('generation-progress', p));
    return { success: true, ...r };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-project', async (_event, { projectPath }) => {
  try {
    if (activeProjectPath === projectPath) {
      activeProjectPath = null;
    }
    if (await exists(projectPath)) {
      await fs.promises.rm(projectPath, OPCIONES_BORRADO);
      console.log(`[delete-project] Carpeta de proyecto eliminada: ${projectPath}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-all-projects', async () => {
  const projectsDir = await getProjectsDir();
  let items: string[] = [];
  try {
    items = await fs.promises.readdir(projectsDir);
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  const fallidos: { nombre: string; error: string }[] = [];
  let borrados = 0;
  for (const item of items) {
    const projectPath = path.join(projectsDir, item);
    try {
      if (!(await fs.promises.stat(projectPath)).isDirectory()) continue;
      await fs.promises.rm(projectPath, OPCIONES_BORRADO);
      borrados++;
    } catch (err: any) {
      // Un proyecto que no se deja borrar NO puede impedir que se borren los demas.
      // Antes un solo throw salia del bucle entero y dejaba el resto intacto en silencio.
      fallidos.push({ nombre: item, error: err.code || err.message });
    }
  }
  // Se limpia SIEMPRE, tambien con fallos: los que si se borraron ya no existen.
  activeProjectPath = null;
  console.log(`[delete-all-projects] ${borrados} borrados, ${fallidos.length} fallidos`);

  if (fallidos.length === 0) return { success: true, borrados };
  return {
    success: false, borrados, fallidos,
    error: `Se borraron ${borrados} proyecto(s). ${fallidos.length} no se pudieron borrar: ` +
      fallidos.map(f => `${f.nombre} (${f.error})`).join(', ')
  };
});

ipcMain.handle('clear-global-stock-cache', async () => {
  try {
    const stockDir = path.join(getBancoClipsPath(), 'stock');
    if (await exists(stockDir)) {
      await fs.promises.rm(stockDir, { recursive: true, force: true });
      await fs.promises.mkdir(stockDir, { recursive: true });
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-project-state', async (_event, state) => {
  try {
    const targetPath = activeProjectPath || process.cwd();
    const filePath = path.join(targetPath, 'project-state.json');
    saveProjectFile(filePath, state, activeProjectPath && activeProjectStateFile ? activeProjectStateFile : filePath);
    if (activeProjectPath) activeProjectStateFile = filePath;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message, code: err.code, details: err.details };
  }
});

ipcMain.handle('load-project-state', async () => {
  try {
    if (activeProjectPath) {
      const stateFile = path.join(activeProjectPath, 'project-state.json');
      if ((await exists(stateFile)) || (await exists(stateFile + '.bak'))) {
        const persistence = loadProjectFile(stateFile);
        return { success: true, data: persistence.state, persistence };
      }
    }
    // Backward compatibility fallback to process.cwd()
    const filePath = path.join(process.cwd(), 'project-state.json');
    if ((await exists(filePath)) || (await exists(filePath + '.bak'))) {
      const persistence = loadProjectFile(filePath);
      return { success: true, data: persistence.state, persistence };
    }
    return { success: false, error: 'No se encontró proyecto activo.' };
  } catch (err: any) {
    return { success: false, error: err.message, code: err.code, details: err.details };
  }
});

ipcMain.on('ready-to-close', () => {
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
});

ipcMain.handle('save-project-as', async (_event, state) => {
  try {
    if (!win) return { success: false, error: 'Ventana no disponible' };
    // Capture the source before the dialog yields: project switching must not mix substrates.
    const sourceStateFile = activeProjectPath && activeProjectStateFile ? activeProjectStateFile : null;
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Guardar Proyecto Como',
      defaultPath: activeProjectPath ? path.join(activeProjectPath, 'project-state.json') : path.join(process.cwd(), 'project-state.json'),
      filters: [{ name: 'JSON Project', extensions: ['json'] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: 'Guardado cancelado por el usuario' };
    }
    saveProjectFile(filePath, state, sourceStateFile || filePath);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message, code: err.code, details: err.details };
  }
});

ipcMain.handle('open-project', async () => {
  try {
    if (!win) return { success: false, error: 'Ventana no disponible' };
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Abrir Proyecto',
      defaultPath: await getProjectsDir(),
      filters: [{ name: 'JSON Project', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: 'Carga cancelada' };
    }
    const filePath = filePaths[0];
    const projectPath = path.dirname(filePath);
    
    const persistence = loadProjectFile(filePath);
    const parsed = persistence.state;

    // Mismo criterio que load-project: NO se limpia el temp del proyecto que se abre,
    // y el anterior se limpia solo cuando el nuevo ya esta cargado.
    await initProjectDirs(projectPath);

    const anterior = activeProjectPath;
    activeProjectPath = projectPath;
    activeProjectStateFile = filePath;
    if (anterior && anterior !== projectPath) await cleanupProjectTemp(anterior);

    return { success: true, data: parsed, projectPath, persistence };
  } catch (err: any) {
    return { success: false, error: err.message, code: err.code, details: err.details };
  }
});



function cleanMarkdown(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  const sectionKeywords = [
    'gancho', 'enigma', 'desarrollo', 'aterrizaje', 'cierre', 
    'título', 'titulo', 'guión', 'guion', 'script', 'sección', 'seccion', 
    'introducción', 'introduccion', 'conclusión', 'conclusion', 
    'escena', 'paso', 'bloque', 'parte', 'fase'
  ];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Skip lines that are conversational filler from the assistant
    const lowerTrimmed = trimmed.toLowerCase();
    if (
      lowerTrimmed.startsWith('aquí tienes') ||
      lowerTrimmed.startsWith('aqui tienes') ||
      lowerTrimmed.startsWith('este guion') ||
      lowerTrimmed.startsWith('este guió') ||
      lowerTrimmed.startsWith('he reescrito') ||
      lowerTrimmed.startsWith('explicación del estilo') ||
      lowerTrimmed.startsWith('explicacion del estilo') ||
      lowerTrimmed.startsWith('estilo utilizado') ||
      lowerTrimmed.startsWith('espero que') ||
      lowerTrimmed.startsWith('nota:') ||
      lowerTrimmed.startsWith('importante:')
    ) {
      continue;
    }

    // 1. Remove markdown headings
    if (trimmed.startsWith('#')) {
      const headingText = trimmed.replace(/^#+\s*/, '').trim();
      const lowerHeading = headingText.toLowerCase();
      const isStructural = sectionKeywords.some(keyword => lowerHeading.includes(keyword)) || headingText.length < 25;
      if (isStructural) {
        continue;
      }
      trimmed = headingText;
    }

    // 2. Remove list bullets at start (e.g. "- ", "* ", "+ ")
    trimmed = trimmed.replace(/^[-*+]\s+/, '');

    // 3. Remove numbered list prefixes (e.g. "1. ", "12. ")
    trimmed = trimmed.replace(/^\d+\.\s+/, '');

    // 4. Remove bold/italic label prefixes like "**Gancho:**" or "**Desarrollo:**"
    trimmed = trimmed.replace(/^\*+([^*:]+)\*+:\s*/, '');

    // 5. Remove bold/italic markup anywhere
    trimmed = trimmed.replace(/\*\*|__|\*|_/g, '');

    // 6. Remove bracketed text/directions like [Música], (Risas)
    trimmed = trimmed.replace(/\[[^\]]+\]/g, '');
    trimmed = trimmed.replace(/\([^)]+\)/g, '');

    // Clean up spaces
    trimmed = trimmed.replace(/\s+/g, ' ').trim();

    if (trimmed.length > 0) {
      cleanedLines.push(trimmed);
    }
  }

  return cleanedLines.join('\n\n');
}

// IPC handle for rewriting transcription using DeepSeek API
ipcMain.handle('rewrite-transcript', async (_event, text) => {
  try {
    let promptPath = path.join(process.cwd(), 'src/prompt-maestro.txt')
    if (!(await exists(promptPath))) {
      const possiblePaths = [
        path.join(app.getAppPath(), 'src/prompt-maestro.txt'),
        path.join(__dirname, '../../src/prompt-maestro.txt'),
        path.join(__dirname, '../prompt-maestro.txt'),
        path.join(process.cwd(), 'prompt-maestro.txt')
      ]
      for (const p of possiblePaths) {
        if (await exists(p)) {
          promptPath = p
          break
        }
      }
    }

    if (!(await exists(promptPath))) {
      return { success: false, error: 'No se encontró el archivo prompt-maestro.txt en cipher-studio/src' }
    }

    const promptTemplate = await fs.promises.readFile(promptPath, 'utf8')
    const finalPrompt = promptTemplate.replace('[TRANSCRIPCIÓN]', text)

    loadEnv() // Refresh env
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return { success: false, error: 'No se configuró DEEPSEEK_API_KEY en el archivo .env' }
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [
          {
            role: 'system',
            content: 'Eres un guionista experto. Tu única tarea es reescribir la transcripción siguiendo el estilo solicitado. IMPORTANTE: Entrega ÚNICAMENTE el texto corrido del guion final resultante que será hablado de forma continua frente a la cámara. Está estrictamente PROHIBIDO incluir títulos, encabezados, viñetas, formato markdown, saludos, introducciones, notas o comentarios adicionales. Empieza a responder directamente con el primer párrafo del guion.'
          },
          { role: 'user', content: finalPrompt }
        ],
        temperature: 0.7,
        max_tokens: 8000,
        thinking: { type: 'disabled' },
        stream: false
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      return { success: false, error: `Error de API DeepSeek (${response.status}): ${errText}` }
    }

    const data = (await response.json()) as any
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      return { success: false, error: 'La respuesta de DeepSeek no contiene contenido válido.' }
    }

    const cleanContent = cleanMarkdown(content)
    return { success: true, data: cleanContent }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error desconocido al reescribir con DeepSeek' }
  }
})

// IPC handle to get all voices from ElevenLabs API
ipcMain.handle('get-elevenlabs-voices', async () => {
  try {
    loadEnv();
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'ELEVENLABS_API_KEY no está configurado en el archivo .env.' };
    }

    console.log('[get-elevenlabs-voices] Solicitando voces a ElevenLabs...');
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Error de ElevenLabs API (${response.status}): ${errText}` };
    }

    const data = await response.json();
    let voices = data.voices || [];

    // Prioritize Voice ID 'c9cmyX6CFsCvEKNVoCZ1' as first item marked "Mi voz"
    const myVoiceId = 'c9cmyX6CFsCvEKNVoCZ1';
    const myVoiceIndex = voices.findIndex((v: any) => v.voice_id === myVoiceId);
    if (myVoiceIndex !== -1) {
      const myVoice = voices[myVoiceIndex];
      myVoice.is_my_voice = true;
      myVoice.name = `${myVoice.name} (Mi voz)`;
      voices.splice(myVoiceIndex, 1);
      voices.unshift(myVoice);
    } else {
      voices.unshift({
        voice_id: myVoiceId,
        name: 'Clon de mi Voz (Mi voz)',
        preview_url: '',
        category: 'cloned',
        is_my_voice: true
      });
    }

    return { success: true, voices };
  } catch (err: any) {
    console.error('[get-elevenlabs-voices] Error:', err);
    return { success: false, error: err.message || 'Error al conectar con la API de ElevenLabs.' };
  }
});

// IPC handle for ElevenLabs voice generation
ipcMain.handle('generate-voice', async (_event, { text, model, voiceId, stability }) => {
  try {
    loadEnv() // ensure env variables are loaded
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      const errMessage = 'Error: ELEVENLABS_API_KEY no está configurado en el archivo .env o no pudo ser leído.'
      console.error(`[generate-voice] ${errMessage}`)
      return { success: false, error: errMessage }
    }

    const targetVoiceId = voiceId || 'c9cmyX6CFsCvEKNVoCZ1';

    // Map model selection to model_id
    let modelId = 'eleven_multilingual_v2'
    if (model === 'Eleven English v1') {
      modelId = 'eleven_monolingual_v1'
    } else if (model === 'Eleven Turbo v2') {
      modelId = 'eleven_turbo_v2'
    }

    const cleanStability = typeof stability === 'number' ? stability / 100 : 0.5

    console.log(`[generate-voice] Iniciando proceso de generación de voz:`)
    console.log(`  - Texto a procesar: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}" (longitud: ${text.length} caracteres)`)
    console.log(`  - Modelo seleccionado: "${model}" => API Model ID: "${modelId}"`)
    console.log(`  - Voice ID seleccionado: "${targetVoiceId}"`)
    console.log(`  - Estabilidad: ${stability}% (procesada: ${cleanStability})`)
    const maskedKey = apiKey.substring(0, 6) + '...' + apiKey.substring(apiKey.length - 6)
    console.log(`  - API Key de ElevenLabs: ${maskedKey} (longitud: ${apiKey.length} caracteres)`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.error(`[generate-voice] Solicitud abortada: Superó el tiempo de espera de 40 segundos.`)
      controller.abort()
    }, 40000)

    try {
      console.log(`[generate-voice] Enviando solicitud POST a https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}...`)
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId,
          voice_settings: {
            stability: cleanStability,
            similarity_boost: 0.75
          }
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      console.log(`[generate-voice] Respuesta recibida de ElevenLabs. Status: ${response.status} (${response.statusText})`)

      if (!response.ok) {
        const errText = await response.text()
        const errMessage = `Error de API ElevenLabs (${response.status}): ${errText}`
        console.error(`[generate-voice] La API retornó un error: ${errMessage}`)
        return { success: false, error: errMessage }
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      console.log(`[generate-voice] Buffer de audio recibido. Tamaño: ${buffer.byteLength} bytes`)

      // Ensure directory exists
      const voicesDir = activeProjectPath 
        ? dirMat(activeProjectPath, 'voices')
        : path.join(app.getPath('userData'), 'generated-voices')
      if (!(await exists(voicesDir))) {
        await fs.promises.mkdir(voicesDir, { recursive: true })
      }

      // Save MP3 to local folder
      const filename = `voice-${Date.now()}.mp3`
      const filePath = path.join(voicesDir, filename)
      await fs.promises.writeFile(filePath, buffer)
      console.log(`[generate-voice] Archivo de voz guardado localmente en: ${filePath}`)

      // Get exact duration of the generated audio
      const durationSeconds = await getVideoDuration(filePath)

      // Generate base64 data URL for preview
      const base64Audio = buffer.toString('base64')
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`

      console.log(`[generate-voice] Transcribiendo el audio generado con Whisper (hasta 3 intentos)...`)
      const transcriptsDir = path.join(app.getPath('userData'), 'transcripts')
      if (!(await exists(transcriptsDir))) {
        await fs.promises.mkdir(transcriptsDir, { recursive: true })
      }
      const basename = path.basename(filePath, path.extname(filePath))
      const expectedJsonPath = path.join(transcriptsDir, basename + '.json')

      let newAudioSegments: any[] = []
      let whisperSuccess = false
      let whisperErrorMsg = ''

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[generate-voice] Intento de transcripción ${attempt}/3...`)
          
          // Clean up any existing transcript file first
          if (await exists(expectedJsonPath)) {
            try { await fs.promises.unlink(expectedJsonPath); } catch (e) {}
          }

          await new Promise<void>((resolve, reject) => {
            const whisperProcess = spawn('whisper', [
              `"${filePath}"`,
              '--language', 'Spanish',
              '--model', MODELO_WHISPER,
              '--output_format', 'json',
              '--output_dir', `"${transcriptsDir}"`,
              '--word_timestamps', 'True'
            ], { shell: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })

            whisperProcess.on('close', async (code) => {
              if (code === 0) {
                try {
                  if (await exists(expectedJsonPath)) {
                    const rawData = await fs.promises.readFile(expectedJsonPath, 'utf8')
                    const parsed = JSON.parse(rawData)
                    if (parsed && Array.isArray(parsed.segments)) {
                      newAudioSegments = parsed.segments.map((seg: any) => ({
                        start: seg.start,
                        end: seg.end,
                        text: seg.text,
                        words: (seg.words || []).map((w: any) => ({
                          word: w.word,
                          start: w.start,
                          end: w.end
                        }))
                      }))
                      whisperSuccess = true
                    } else {
                      throw new Error('La respuesta de Whisper no contiene la lista de segmentos esperada.')
                    }
                    // Clean up the JSON file to keep system clean
                    try {
                      await fs.promises.unlink(expectedJsonPath)
                    } catch (e) {}
                    resolve()
                  } else {
                    reject(new Error('No se generó el archivo de transcripción JSON esperado de Whisper.'))
                  }
                } catch (err: any) {
                  reject(err)
                }
              } else {
                reject(new Error(`Whisper falló con código de salida ${code}`))
              }
            })
          })

          if (whisperSuccess) {
            console.log(`[generate-voice] Transcripción Whisper exitosa en el intento ${attempt}.`)
            break
          }
        } catch (err: any) {
          whisperErrorMsg = err.message || 'Error desconocido'
          console.error(`[generate-voice] Intento ${attempt} fallido: ${whisperErrorMsg}`)
          if (attempt < 3) {
            console.log(`[generate-voice] Esperando 2 segundos antes del siguiente intento...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }

      if (!whisperSuccess) {
        const fullErrMsg = `No se pudo transcribir el audio. Verifica que Whisper esté instalado correctamente. (Detalle: ${whisperErrorMsg})`
        console.error(`[generate-voice] ${fullErrMsg}`)
        return { success: false, error: fullErrMsg }
      }

      return { success: true, filePath, audioUrl, durationSeconds, newAudioSegments }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId)
      let fetchErrMsg = fetchErr.message || 'Error de conexión'
      if (fetchErr.name === 'AbortError') {
        fetchErrMsg = 'La conexión con ElevenLabs excedió el tiempo límite de espera de 40 segundos.'
      }
      console.error(`[generate-voice] Excepción durante el fetch: ${fetchErrMsg}`, fetchErr)
      return { success: false, error: `Error de red/conexión: ${fetchErrMsg}` }
    }
  } catch (err: any) {
    const errMessage = err.message || 'Error desconocido en ElevenLabs TTS'
    console.error(`[generate-voice] Excepción general: ${errMessage}`, err)
    return { success: false, error: errMessage }
  }
})

ipcMain.handle('generate-minimax-video', async (_event, { prompt }) => {
  try {
    loadEnv(true);
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      return { success: false, error: 'FAL_KEY no está configurado en el archivo .env.' };
    }

    console.log('[generate-minimax-video] Iniciando generación en fal.ai con prompt:', prompt);
    process.env.FAL_KEY = apiKey;

    const result = await fal.subscribe("fal-ai/minimax/video-01", {
      input: {
        prompt: prompt
      }
    }) as any;

    const downloadUrl = result?.video?.url || result?.data?.video?.url;
    if (!downloadUrl) {
      return { success: false, error: `fal.ai no devolvió una URL de video: ${JSON.stringify(result)}` };
    }

    console.log(`[generate-minimax-video] Descargando video desde fal.ai: ${downloadUrl}`);

    // 4. Download file
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      return { success: false, error: `Error al descargar el archivo de video: ${downloadRes.statusText}` };
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to temp folder
    const targetDir = activeProjectPath
      ? dirMat(activeProjectPath, 'ia')
      : path.join(process.cwd(), 'cipher-studio', 'banco-clips', 'ia');
      
    if (!(await exists(targetDir))) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const filename = `ia-${Date.now()}.mp4`;
    const filePath = path.join(targetDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const durationSeconds = await getVideoDuration(filePath);

    // Generate thumbnail
    const thumbFilename = `thumb-${path.basename(filename, '.mp4')}.jpg`;
    const thumbDir = activeProjectPath
      ? dirCache(activeProjectPath, 'thumbnails')
      : path.join(process.cwd(), 'cipher-studio', 'banco-clips', 'thumbnails');

    if (!(await exists(thumbDir))) {
      await fs.promises.mkdir(thumbDir, { recursive: true });
    }

    const thumbPath = path.join(thumbDir, thumbFilename);
    let thumbnailUrl = '';
    try {
      await generateVideoThumbnail(filePath, thumbPath);
      thumbnailUrl = urlDeRuta(thumbPath);
    } catch (e) {
      console.error('[generate-minimax-video] Error generating thumbnail:', e);
    }

    return {
      success: true,
      filePath,
      durationSeconds,
      thumbnailUrl,
      name: filename
    };
  } catch (err: any) {
    console.error('[generate-minimax-video] Excepción:', err);
    return { success: false, error: err.message || 'Error desconocido al generar video con fal.ai/MiniMax.' };
  }
});

// IPC handle for loading clips in a category folder of banco-clips
ipcMain.handle('load-bank-clips', async (_event, { category }) => {
  try {
    const isTempCategory = ['originales', 'ia', 'stock'].includes(category.toLowerCase())
    const useActiveProj = !!(activeProjectPath && isTempCategory)
    const baseDir = useActiveProj ? activeProjectPath! : getBancoClipsPath()
    const dirPath = useActiveProj ? dirMat(baseDir, category) : path.join(baseDir, category)
    const thumbnailDir = useActiveProj ? dirCache(baseDir, 'thumbnails') : path.join(baseDir, 'thumbnails')

    if (!(await exists(dirPath))) {
      await fs.promises.mkdir(dirPath, { recursive: true })
    }
    if (!(await exists(thumbnailDir))) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true })
    }

    const files = await fs.promises.readdir(dirPath)
    const bankClips: any[] = []

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = await fs.promises.stat(filePath)
      
      // We only accept common video formats
      if (stat.isFile() && /\.(mp4|mkv|avi|mov|webm)$/i.test(file)) {
        const durationSeconds = await getVideoDuration(filePath)
        const durationStr = formatTimeMinutesSeconds(durationSeconds)

        // Find or generate thumbnail
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`
        const thumbnailPath = path.join(thumbnailDir, thumbnailName)
        let thumbnailUrl = ''

        if (await exists(thumbnailPath)) {
          try {
            thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString('base64')}`
          } catch (e) {
            console.error(`[load-bank-clips] Error al leer miniatura para ${file}:`, e)
          }
        } else {
          try {
            await generateVideoThumbnail(filePath, thumbnailPath)
            if (await exists(thumbnailPath)) {
              thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString('base64')}`
            }
          } catch (e) {
            console.error(`[load-bank-clips] Error al generar miniatura para ${file}:`, e)
          }
        }

        bankClips.push({
          id: `bank-${category}-${file}`,
          name: file,
          path: filePath,
          url: urlDeRuta(filePath),
          duration: durationStr,
          durationSeconds,
          type: 'video',
          size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          thumbnailUrl
        })
      }
    }

    return { success: true, clips: bankClips }
  } catch (err: any) {
    console.error(`[load-bank-clips] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

// IPC handle to automatically slice a video into segments of exactly 3 seconds using segment muxer
ipcMain.handle('cut-video-clips', async (_event, { videoPath, timestamps }) => {
  try {
    console.log(`[cut-video-clips] Slicing video: ${videoPath}, timestamps length: ${timestamps?.length || 0}`)
    const bankDir = getBancoClipsPath()
    const useActiveProj = !!activeProjectPath
    const outDir = useActiveProj ? dirMat(activeProjectPath!, 'originales') : path.join(bankDir, 'originales')
    const thumbnailDir = useActiveProj ? dirCache(activeProjectPath!, 'thumbnails') : path.join(bankDir, 'thumbnails')

    // The input can be the user's persisted `fuente_recortada.mp4` inside
    // materiales/originales. Verify it before cleanup and remove only stale
    // segment outputs; broad directory cleanup would delete the input itself.
    const segmentacion = await prepareOriginalClipSegmentation({ inputPath: videoPath, outputDir: outDir })
    if (!(await exists(thumbnailDir))) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true })
    }
    await writeDebugLog(`[cut-video-clips] Limpieza segura: ${segmentacion.removedClipOutputs.length} clip(s) previos; ` +
      `input protegido=${segmentacion.preservedInputInsideOutputDir}.`)

    const escapedVideo = segmentacion.inputPath.replace(/"/g, '\\"')

    if (timestamps && Array.isArray(timestamps) && timestamps.length > 0) {
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const clipNum = String(i + 1).padStart(3, '0');
        const clipFileName = `clip_${clipNum}.mp4`;
        const clipPath = path.join(outDir, clipFileName);
        const escapedClipPath = clipPath.replace(/"/g, '\\"');
        
        await new Promise<void>((resolve, reject) => {
          // Cut exactly 3 seconds starting from timestamp
          const ffmpegCmd = `ffmpeg -y -ss ${ts} -i "${escapedVideo}" -t 3 -c copy "${escapedClipPath}"`;
          console.log(`[cut-video-clips] Executing FFmpeg: ${ffmpegCmd}`);
          exec(ffmpegCmd, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } else {
      const outputPattern = path.join(outDir, 'clip_%03d.mp4').replace(/\\/g, '/')
      const escapedOutputPattern = outputPattern.replace(/"/g, '\\"')

      await new Promise<void>((resolve, reject) => {
        const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" -c copy -segment_time 3 -segment_start_number 1 -f segment "${escapedOutputPattern}"`
        console.log(`[cut-video-clips] Executing FFmpeg: ${ffmpegCmd}`)
        exec(ffmpegCmd, (err, _stdout, _stderr) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    // Read generated files to build clips info
    const files = await fs.promises.readdir(outDir)
    const createdClips: any[] = []

    for (const file of files) {
      if (file.startsWith('clip_') && file.endsWith('.mp4')) {
        const clipPath = path.join(outDir, file)
        const durationSeconds = await getVideoDuration(clipPath)
        
        // Extract thumbnail
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`
        const thumbnailPath = path.join(thumbnailDir, thumbnailName)
        let thumbnailUrl = ''
        try {
          await generateVideoThumbnail(clipPath, thumbnailPath)
          if (await exists(thumbnailPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString('base64')}`
          }
        } catch (e) {
          console.error(`[cut-video-clips] Error generating thumbnail for ${file}:`, e)
        }

        const stat = await fs.promises.stat(clipPath)
        createdClips.push({
          id: `bank-originales-${file}`,
          name: file,
          path: clipPath,
          url: urlDeRuta(clipPath),
          duration: formatTimeMinutesSeconds(durationSeconds),
          durationSeconds,
          type: 'video',
          size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          thumbnailUrl
        })
      }
    }

    console.log(`[cut-video-clips] Slicing finished. Created ${createdClips.length} clips.`)
    return { success: true, clips: createdClips }
  } catch (err: any) {
    console.error(`[cut-video-clips] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

// IPC handle to read a local file and return its buffer/bytes (used to bypass Electron local file security policies)
ipcMain.handle('read-file-as-blob', async (_event, { filePath }) => {
  try {
    if (!(await exists(filePath))) {
      return { success: false, error: `File not found at: ${filePath}` }
    }
    const buffer = await fs.promises.readFile(filePath)
    return { success: true, buffer }
  } catch (err: any) {
    console.error(`[read-file-as-blob] Error reading file ${filePath}:`, err.message)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('generate-thumbnail', async (_event, videoPath: string) => {
  try {
    const thumbDir = path.join(getBancoClipsPath(), 'thumbnails');
    if (!(await exists(thumbDir))) {
      await fs.promises.mkdir(thumbDir, { recursive: true });
    }
    const thumbName = `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const thumbPath = path.join(thumbDir, thumbName);
    await generateVideoThumbnail(videoPath, thumbPath);
    if (await exists(thumbPath)) {
      const base64 = (await fs.promises.readFile(thumbPath)).toString('base64');
      return { success: true, thumbnail: `data:image/jpeg;base64,${base64}` };
    }
    return { success: false };
  } catch (e) {
    console.error('[generate-thumbnail] Error:', e);
    return { success: false };
  }
});

// IPC handle for deleting a clip inside a category folder of banco-clips
ipcMain.handle('delete-bank-clip', async (_event, { category, file }) => {
  try {
    const isTempCategory = ['originales', 'ia', 'stock'].includes(category.toLowerCase())
    const useActiveProj = !!(activeProjectPath && isTempCategory)
    const baseDir = useActiveProj ? activeProjectPath! : getBancoClipsPath()
    const filePath = useActiveProj ? path.join(dirMat(baseDir, category), file) : path.join(baseDir, category, file)
    
    if (await exists(filePath)) {
      await fs.promises.unlink(filePath)
    }
    const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`
    const thumbnailPath = useActiveProj 
      ? path.join(dirCache(baseDir, 'thumbnails'), thumbnailName) 
      : path.join(baseDir, 'thumbnails', thumbnailName)
    if (await exists(thumbnailPath)) {
      await fs.promises.unlink(thumbnailPath)
    }
    return { success: true }
  } catch (err: any) {
    console.error(`[delete-bank-clip] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

// Ajustes de encuadre que el usuario aplica sobre SU video en el preview. Viajan desde el
// frontend a partir del paso 3; hasta entonces llegan undefined y construirAjustes devuelve
// '', de modo que el -vf sale identico al de hoy.
type AjustesVideo = {
  crop?: { left: number; top: number; right: number; bottom: number } | null  // PORCENTAJE 0-100
  zoom?: number
  panXFrac?: number   // fraccion del ancho, NO pixeles de pantalla
  panYFrac?: number
  isMirrored?: boolean
  background?: 'blur' | 'black'
}

// Devuelve el TRAMO que se engancha detras de baseVF (que ya termina en scale=W:H), o ''
// si no hay nada que aplicar. Reproduce la cadena del preview en su mismo orden:
// object-cover -> recorte -> espejo -> zoom -> overlay sobre el fondo.
// El overlay sustituye al pad: recorta lo que se sale y deja ver el fondo donde no llega,
// asi que la salida conserva W×H y el concat sigue cuadrando.
function construirAjustes(a: AjustesVideo | undefined, W: number, H: number): string {
  if (!a) return ''

  // h264 con yuv420p exige dimensiones pares; crop/overlay/scale exigen enteros.
  const par = (n: number) => Math.max(2, Math.round(n / 2) * 2)

  const cl = Math.max(0, (a.crop?.left ?? 0) / 100)
  const cr = Math.max(0, (a.crop?.right ?? 0) / 100)
  const ct = Math.max(0, (a.crop?.top ?? 0) / 100)
  const cb = Math.max(0, (a.crop?.bottom ?? 0) / 100)
  // Un recorte que no deja area visible se ignora en vez de tumbar el export entero.
  if (cl + cr >= 1 || ct + cb >= 1) return ''

  // El zoom del preview se acumula con la rueda (prev + delta) y puede quedarse en
  // 1.0000001 al volver al minimo. Sin esta guarda ese residuo invisible construiria el
  // grafo entero de split/overlay para no mover nada, y activaria el bloqueo por categoria.
  const zBruto = Math.max(1, Math.min(4, Number(a.zoom) || 1))
  const z = zBruto < 1.001 ? 1 : zBruto
  const mirror = !!a.isMirrored
  // Identidad: nada que componer, se devuelve la cadena de siempre.
  if (cl === 0 && cr === 0 && ct === 0 && cb === 0 && z === 1 && !mirror) return ''

  // Con z=1 el pan es 0 por definicion.
  const panX = z <= 1 ? 0 : (Number(a.panXFrac) || 0) * W
  const panY = z <= 1 ? 0 : (Number(a.panYFrac) || 0) * H

  const wc = Math.min(par(W * (1 - cl - cr)), W)
  const hc = Math.min(par(H * (1 - ct - cb)), H)
  // El redondeo a par puede empujar el recorte fuera del borde: clamp.
  const cx = Math.min(Math.round(W * cl), W - wc)
  const cy = Math.min(Math.round(H * ct), H - hc)

  // Con espejo, la esquina que queda a la IZQUIERDA en pantalla es la del borde DERECHO
  // del recorte, de ahi lef = cr.
  const lef = mirror ? cr : cl
  const x0 = Math.round(W / 2 + z * (W * lef - W / 2) + panX)
  const y0 = Math.round(H / 2 + z * (H * ct - H / 2) + panY)
  const zw = par(z * wc)
  const zh = par(z * hc)

  // El negro se deriva del propio stream con drawbox y no de una fuente color=: una fuente
  // sintetica impondria SU framerate al overlay y cambiaria el conteo de frames, que es
  // justo lo unico que no puede moverse.
  const ramaFondo = a.background === 'black'
    ? `[bg]drawbox=x=0:y=0:w=iw:h=ih:color=black@1:t=fill[fondo]`
    : `[bg]scale=${par(W * 1.2)}:${par(H * 1.2)},crop=${W}:${H},boxblur=24:2[fondo]`

  const ramaRecorte =
    `[fg]crop=${wc}:${hc}:${cx}:${cy}${mirror ? ',hflip' : ''},scale=${zw}:${zh}[rec]`

  return `,split=2[bg][fg];${ramaFondo};${ramaRecorte};` +
    `[fondo][rec]overlay=x=${x0}:y=${y0}:shortest=1`
}

// IPC handle for exporting video (single clip or concatenating multiple clips) with aspect ratio crop
/**
 * PIEZA 3 — compone las TARJETAS sobre el video ya concatenado, SIN recodificarlo entero.
 *
 * ESTO COMPONE TARJETAS: overlays con alpha que van ENCIMA de un plano que se sigue viendo
 * detras. Los graficos de PANTALLA COMPLETA, cuando existan, NO pasaran por aqui: esos
 * SUSTITUYEN al plano, van sin alpha y entran por el pipeline de video normal como un clip
 * mas. Por eso el filtro `c.type === 'graphic'` de videoOnly es CORRECTO y no hay que
 * "arreglarlo" para incluirlos — los de pantalla completa llevaran otro type precisamente
 * para no caer aqui.
 *
 * Trocea por keyframes con el muxer `segment` —que da recuentos de frame exactos, al
 * contrario que cortar con -ss/-to— recodifica SOLO los tramos que llevan tarjeta, y
 * reconcatena. En un video de 28 min con 148 tarjetas de 2 s eso deja ~95% del metraje sin
 * tocar: el video se recodifica UNA vez y solo en ese 5%.
 *
 * Si el recuento de frames no cuadra en cualquiera de las tres comprobaciones, DESCARTA la
 * pasada y deja el video sin tarjetas. Mejor un video correcto sin graficos que uno
 * desincronizado.
 */
/**
 * Que los TIEMPOS del fichero sean coherentes, no solo los frames.
 *
 * La guarda que ya existe cuenta FRAMES, y por eso dio verde con un video roto: los 8581
 * frames estaban todos. Lo que se habia derrumbado era CUANDO se muestra cada uno —el ultimo
 * pts marcaba 201.748s sobre 286.018s esperados— y el -shortest del mux recorto el audio ahi.
 * Se perdieron 84 segundos de narracion y nada lo dijo.
 *
 * Devuelve tambien el tiempo que tardo: se ejecuta dos veces por export y conviene saber si
 * leer todos los pts sale caro antes de plantearse acotarlo.
 */
async function verificarTiempos(fichero: string, framesEsperados: number, fps: number) {
  const t0 = Date.now();
  const crudo = await new Promise<string>((res) => exec(
    `ffprobe -v error -select_streams v:0 -show_entries frame=pts_time -of csv=p=0 ` +
    `"${fichero.replace(/"/g, '\\"')}"`, { maxBuffer: 1024 * 1024 * 40 },
    (e, out) => res(e ? '' : String(out))));
  const pts = crudo.trim().split(/\s+/).map(x => parseFloat(x)).filter(x => Number.isFinite(x));

  const durCrudo = await new Promise<string>((res) => exec(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${fichero.replace(/"/g, '\\"')}"`,
    (e, out) => res(e ? '' : String(out).trim())));
  const duracion = parseFloat(durCrudo);
  const fallos: string[] = [];

  if (!pts.length) {
    fallos.push('no se pudo leer ni un solo pts del fichero');
    return { ok: false, fallos, frames: 0, ultimo: NaN, duracion, ms: Date.now() - t0 };
  }

  // 1) MONOTONOS. Lo mas barato que hay, y ya aparecio una vez al mezclar escalas de tiempo.
  let noMonotonos = 0, primero = -1;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i] <= pts[i - 1]) { noMonotonos++; if (primero < 0) primero = i; }
  }
  if (noMonotonos > 0) {
    fallos.push(`${noMonotonos} pts no monotonos, el primero en el frame ${primero} ` +
      `(${pts[primero - 1].toFixed(3)} -> ${pts[primero].toFixed(3)})`);
  }

  // 2) EL ULTIMO PTS CUADRA CON LO QUE SE PIDIO. Es la que habria cazado el fallo: 201.748
  //    contra 286.018. Tolerancia de UN frame.
  const esperado = (framesEsperados - 1) / fps;
  const ultimo = pts[pts.length - 1];
  if (Math.abs(ultimo - esperado) > (1 / fps)) {
    fallos.push(`el ultimo pts es ${ultimo.toFixed(3)}s y se esperaba ${esperado.toFixed(3)}s ` +
      `(${framesEsperados} frames a ${fps} fps)`);
  }

  // 3) EL FICHERO ES COHERENTE CONSIGO MISMO, sin mirar el objetivo. Sigue valiendo el dia que
  //    el objetivo se calcule mal: 8581 frames son 286.03s y el contenedor decia 201.765s.
  const segunFrames = pts.length / fps;
  if (Number.isFinite(duracion) && Math.abs(duracion - segunFrames) > (2 / fps)) {
    fallos.push(`el contenedor dice ${duracion.toFixed(3)}s pero tiene ${pts.length} frames, ` +
      `que a ${fps} fps son ${segunFrames.toFixed(3)}s`);
  }

  return { ok: fallos.length === 0, fallos, frames: pts.length, ultimo, duracion, ms: Date.now() - t0 };
}

async function componerTarjetas(
  videoBase: string, destino: string, tarjetas: { ini: number; dur: number; mov: string }[],
  fps: number, crf: number, preset: string, dir: string,
  log: (s: string) => Promise<void>
): Promise<{ ok: boolean; compuestas: number; sinComponer: number; motivo?: string; segDir: string; aCaballo: number }> {
  const framesDe = async (f: string) => {
    const r = await new Promise<string>((res) => exec(
      `ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames ` +
      `-of csv=p=0 "${f.replace(/"/g, '\\"')}"`, (e, out) => res(e ? '' : String(out).trim())));
    return parseInt(r, 10) || 0;
  };

  // Primeros y ultimos instantes de un fichero. Se usa SOLO al detectar un descuadre: en ese
  // momento los dos ficheros estan delante, asi que volcarlos aqui ahorra tener que
  // reproducir el fallo despues — y reproducirlo puede ser imposible, porque el video base es
  // temporal y las condiciones exactas no vuelven.
  const ptsDe = async (f: string) => {
    const r = await new Promise<string>((res) => exec(
      `ffprobe -v error -select_streams v:0 -show_entries frame=pts_time -of csv=p=0 ` +
      `"${f.replace(/"/g, '\\"')}"`, { maxBuffer: 1024 * 1024 * 20 },
      (e, out) => res(e ? '' : String(out).trim())));
    const t = r.split('\n').map(x => x.trim()).filter(Boolean);
    return { primeros: t.slice(0, 3).join('  '), ultimos: t.slice(-3).join('  ') };
  };

  const framesOriginal = await framesDe(videoBase);
  const segDir = path.join(dir, 'segmentos');

  // SE VACIA ANTES DE TROCEAR, no solo se crea. `mkdir` con `recursive` sobre un directorio que
  // ya existe no hace NADA, y el recuento de mas abajo es un `readdir`: lo que quede de una
  // pasada anterior CUENTA COMO SI FUERA DE ESTA.
  //
  // Paso de verdad, y descarto una pasada que estaba bien. Un export fallido dejo 29 segmentos
  // conservados "para diagnostico". El siguiente troceo un video mas corto en 20 segmentos, que
  // sobrescribieron seg_00000..seg_00019 —correctos, 5979 frames, justo los del original— pero
  // seg_00020..seg_00028 sobrevivieron con 2528 frames mas. La guarda leyo 8507 contra 5979 y
  // tiro la pasada. Sin esto, UN export fallido envenena TODOS los siguientes hasta que alguien
  // borre la carpeta a mano, y el sintoma —"el troceado dio N frames"— apunta al troceado, que
  // es justo la parte que funcionaba.
  //
  // Se dice cuantos se borran en vez de hacerlo en silencio: los ficheros conservados son
  // evidencia de un fallo anterior, y si desaparecen tiene que quedar escrito quien se los
  // llevo. El contrato de "conservado para diagnostico" sigue en pie, acotado: sobreviven
  // hasta el export siguiente.
  const restos = await fs.promises.readdir(segDir).catch(() => [] as string[]);
  if (restos.length) {
    await fs.promises.rm(segDir, { recursive: true, force: true });
    await log(`[EXPORT-G3] ${restos.length} fichero(s) de una pasada anterior borrados de ` +
      `${segDir} antes de trocear`);
  }
  await fs.promises.mkdir(segDir, { recursive: true });

  // Trocear. -c copy: aqui NO se recodifica nada, solo se parte por keyframes. El video base
  // viene sin audio (-an en el concat), asi que -map 0:v:0 evita arrastrar cualquier stream
  // de datos o portada que descuadraria el recuento.
  await new Promise<void>((res, rej) => exec(
    `ffmpeg -y -i "${videoBase.replace(/"/g, '\\"')}" -map 0:v:0 -c copy -f segment ` +
    `-segment_time 10 -reset_timestamps 1 "${path.join(segDir, 'seg_%05d.mp4').replace(/"/g, '\\"')}"`,
    { maxBuffer: 1024 * 1024 * 50 }, (e) => e ? rej(e) : res()));

  const segs = (await fs.promises.readdir(segDir)).filter(f => /^seg_\d+\.mp4$/.test(f)).sort();
  if (!segs.length) return { ok: false, compuestas: 0, sinComponer: tarjetas.length, segDir, aCaballo: 0, motivo: "el troceado no produjo segmentos" };

  // Donde empieza cada segmento, contando FRAMES: no se fia de -segment_time, porque el corte
  // real cae en el keyframe mas cercano y no donde se pidio.
  const inicioSeg: number[] = [];
  let acc = 0;
  for (const s of segs) { inicioSeg.push(acc / fps); acc += await framesDe(path.join(segDir, s)); }
  if (acc !== framesOriginal) {
    return { ok: false, compuestas: 0, sinComponer: tarjetas.length, segDir, aCaballo: 0,
      motivo: `el troceado dio ${acc} frames y el original tenia ${framesOriginal}` };
  }

  // Se cuenta ANTES del bucle, no dentro: asi el numero es completo aunque se falle a mitad,
  // que es justo cuando hace falta saberlo.
  const limites = (i: number) => ({
    ini: inicioSeg[i], fin: i + 1 < segs.length ? inicioSeg[i + 1] : Number.POSITIVE_INFINITY
  });
  // Devuelve INDICES, no objetos: contar tarjetas distintas exige poder identificarlas, y una
  // tarjeta a caballo aparece en dos segmentos.
  const enSegmento = (i: number): number[] => {
    const { ini, fin } = limites(i);
    const r: number[] = [];
    tarjetas.forEach((t, k) => { if (t.ini < fin && (t.ini + t.dur) > ini) r.push(k); });
    return r;
  };
  const estaACaballo = (t: { ini: number; dur: number }, i: number) => {
    const { ini, fin } = limites(i);
    return t.ini < ini || (t.ini + t.dur) > fin;
  };
  // TARJETAS distintas, no apariciones: una que cruza un corte esta "a caballo" en los DOS
  // segmentos, asi que sumar apariciones la contaria dos veces y diria 8 donde hay 4.
  const aCaballoSet = new Set<number>();
  for (let i = 0; i < segs.length; i++) {
    for (const k of enSegmento(i)) if (estaACaballo(tarjetas[k], i)) aCaballoSet.add(k);
  }
  const aCaballo = aCaballoSet.size;

  const finales: string[] = [];
  // Un Set y no un contador: `compuestas += dentro.length` sumaba una vez por invocacion de
  // overlay, asi que las tarjetas partidas contaban doble y el resultado era "43 de 39".
  // La COBERTURA 2 no pregunta cuantas operaciones se hicieron sino cuantos graficos han
  // salido, y un contador que puede pasarse del total no sirve para detectar que faltan.
  const compuestasSet = new Set<number>();

  // Segmentos que necesitaron mas de un intento, anotados como "indice:intentos". Se vuelca
  // ANTES de cada return y no solo al final: si la pasada acaba descartandose, saber cuantas
  // veces peleo cada segmento es justo lo que hace falta para decidir si 3 intentos bastan.
  const reintentos: string[] = [];
  const logReintentos = async () => {
    if (!reintentos.length) return;
    await log(`[EXPORT-G3] MITIGACION: ${reintentos.length} de ${segs.length} segmento(s) ` +
      `necesitaron reintento (segmento:intentos) — ${reintentos.join(', ')}`);
  };

  for (let i = 0; i < segs.length; i++) {
    const ruta = path.join(segDir, segs[i]);
    const { ini, fin } = limites(i);
    // Una tarjeta de 2 s con cortes cada 10 s cruza el corte tarde o temprano: entonces entra
    // en LOS DOS segmentos y se compone dos veces, cada uno con su mitad. El desfase relativo
    // sale negativo en el segundo, y overlay descarta lo anterior a cero, asi que las dos
    // mitades encajan sin solaparse ni dejar hueco.
    const dentro = enSegmento(i);
    if (!dentro.length) { finales.push(ruta); continue; }

    // spawn con ARRAY, no exec: exec pasa por cmd.exe y topa entre 35 y 40 overlays (~8191
    // caracteres). spawn llega a 148 (~32767). Medido. Aqui caben pocas por tramo, pero el 1%
    // de margen que deja exec no es margen.
    const args = ['-y', '-i', ruta];
    for (const k of dentro) args.push('-i', tarjetas[k].mov);
    const partes: string[] = [];
    dentro.forEach((k, n) => {
      partes.push(`[${n + 1}:v]format=rgba,setpts=PTS-STARTPTS+${(tarjetas[k].ini - ini).toFixed(3)}/TB[g${n}]`);
    });
    let prev = '0:v';
    dentro.forEach((_, n) => {
      partes.push(`[${prev}][g${n}]overlay=x=0:y=0:alpha=premultiplied:eof_action=pass[v${n}]`);
      prev = `v${n}`;
    });
    const salida = path.join(segDir, `comp_${String(i).padStart(5, '0')}.mp4`);
    // crf y preset se HEREDAN del export, no se fijan: el 26% de las tarjetas cae encima de
    // una transicion, y recodificar ese tramo a otra calidad se veria justo ahi.
    args.push('-filter_complex', partes.join(';'), '-map', `[${prev}]`,
      '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
      // La MISMA escala que la normalizacion. Mezclarlas derrumba los pts en el concat final.
      '-video_track_timescale', String(TIMESCALE), salida);

    // ─── REINTENTO: ESTO ES UNA MITIGACION, NO EL ARREGLO ────────────────────────────────
    // La causa NO esta aqui. El video base mezcla espacios de color: los 78 clips de origen no
    // vienen todos iguales y el concat deja tramos bt709 alternando con tramos bt2020nc. Cada
    // cambio obliga a ffmpeg a reconstruir el grafo de filtros a mitad del stream —
    //   [fc#0] Reconfiguring filter graph because video parameters changed to yuv420p(tv, bt2020nc)
    // — y en esa reconfiguracion se pierden los frames que iban EN VUELO por la cadena. Medido
    // sobre el segmento que fallo: el hueco es unico, los 3 frames perdidos son los 3 justo
    // anteriores al cambio de color, y ese cambio cae en 2.800s exactos.
    //
    // POR QUE UN REINTENTO SIRVE: es una carrera, no un fallo determinista. 30 pasadas del
    // mismo comando sobre los mismos ficheros dieron 5 fallos (16.7%) en las posiciones 2, 4,
    // 8, 11 y 16 — REPARTIDOS, con racha maxima de UNO. Nunca dos seguidos. Si vinieran en
    // racha esto no valdria de nada y habria que atacar la causa directamente.
    //
    // Lo que NO es, tambien medido, para que nadie lo vuelva a buscar ahi:
    //   sin filtros           0 de 10 fallos  -> sin cadena no hay nada que reconfigurar
    //   un overlay            2 de 10         -> es del overlay
    //   dos overlays          3 de 10         -> no es del encadenado
    //   dos overlays PEQUEÑOS 2 de 10         -> el tamaño de la tarjeta NO influye
    //
    // ARREGLO DE RAIZ, PENDIENTE: que la normalizacion de los clips fuerce UN solo espacio de
    // color, para que no haya reconfiguracion ninguna. Esto de aqui baja la probabilidad de
    // descartar la pasada; no la elimina.
    const MAX_INTENTOS_SEG = 3;
    let okSeg = false, fOrig = 0, fComp = 0, intentos = 0;
    while (intentos < MAX_INTENTOS_SEG) {
      intentos++;
      okSeg = await new Promise<boolean>((res) => {
        const p = spawn('ffmpeg', args);
        let err = '';
        p.stderr!.on('data', d => { err += d.toString(); if (err.length > 32000) err = err.slice(-32000); });
        p.on('error', () => res(false));
        p.on('close', (code) => {
          if (code !== 0) log(`[EXPORT-G3] segmento ${i}: ffmpeg salio ${code} — ${err.slice(-300)}`);
          res(code === 0);
        });
      });
      // Un ffmpeg que sale con codigo != 0 NO se reintenta. Eso no es la carrera de la
      // reconfiguracion sino un error de verdad —un .mov ilegible, disco lleno—, y repetirlo
      // tres veces solo retrasaria el diagnostico y taparia el motivo.
      if (!okSeg) break;
      // El fichero de salida se sobrescribe en cada intento: args ya lleva -y.
      fOrig = await framesDe(ruta); fComp = await framesDe(salida);
      if (fOrig === fComp) break;
    }
    if (intentos > 1) reintentos.push(`${i}:${intentos}`);

    if (!okSeg) {
      await logReintentos();
      return { ok: false, compuestas: compuestasSet.size, sinComponer: tarjetas.length - compuestasSet.size, segDir, aCaballo, motivo: `fallo el segmento ${i}` };
    }

    if (fOrig !== fComp) {
      await logReintentos();
      // Se vuelca AQUI, con los dos ficheros delante. Reproducir esto despues puede ser
      // imposible: el video base es temporal y sus keyframes no vuelven a caer igual.
      const po = await ptsDe(ruta), pc = await ptsDe(salida);
      await log(`[EXPORT-G3] DESCUADRE en el segmento ${i} (${segs[i]}) tras ${intentos} ` +
        `intento(s): ${fComp} frames tras componer, eran ${fOrig}. Dura ` +
        `${(fOrig / fps).toFixed(3)}s, tramo ` +
        `${ini.toFixed(2)}-${(fin === Number.POSITIVE_INFINITY ? -1 : fin).toFixed(2)}s`);
      await log(`[EXPORT-G3]   original  primeros: ${po.primeros}   ultimos: ${po.ultimos}`);
      await log(`[EXPORT-G3]   compuesto primeros: ${pc.primeros}   ultimos: ${pc.ultimos}`);
      await log(`[EXPORT-G3]   tarjetas dentro (${dentro.length}): ` + dentro.map(k =>
        `${tarjetas[k].ini.toFixed(2)}-${(tarjetas[k].ini + tarjetas[k].dur).toFixed(2)}s ` +
        `desfase ${(tarjetas[k].ini - ini).toFixed(3)}s` +
        (estaACaballo(tarjetas[k], i) ? ' A CABALLO' : '')).join(' | '));
      return { ok: false, compuestas: compuestasSet.size, sinComponer: tarjetas.length - compuestasSet.size,
        segDir, aCaballo,
        motivo: `segmento ${i}: ${fComp} frames tras componer, eran ${fOrig} (${intentos} intentos)` };
    }
    finales.push(salida);
    for (const k of dentro) compuestasSet.add(k);
  }
  await logReintentos();

  const txt = path.join(segDir, 'lista.txt');
  await fs.promises.writeFile(txt,
    finales.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'\n`).join(''), 'utf8');
  await new Promise<void>((res, rej) => exec(
    `ffmpeg -y -f concat -safe 0 -i "${txt.replace(/"/g, '\\"')}" -c:v copy -an "${destino.replace(/"/g, '\\"')}"`,
    { maxBuffer: 1024 * 1024 * 50 }, (e) => e ? rej(e) : res()));

  const framesFinal = await framesDe(destino);
  if (framesFinal !== framesOriginal) {
    return { ok: false, compuestas: compuestasSet.size, sinComponer: tarjetas.length - compuestasSet.size,
      segDir, aCaballo, motivo: `el resultado tiene ${framesFinal} frames y el original ${framesOriginal}` };
  }
  // LOS TIEMPOS, ademas de los frames. La guarda de arriba cuenta frames y por eso dio verde
  // con un video cuyos pts se habian derrumbado: los 8581 estaban todos.
  // Aqui SI se descarta la pasada, igual que con el descuadre de frames y por la misma razon:
  // en este punto todavia se puede caer al video sin tarjetas, y el derrumbe nace justo de la
  // composicion. Descartar aqui SALVA el video; en el fichero final ya no habria salida.
  const tiempos = await verificarTiempos(destino, framesOriginal, fps);
  // El coste se registra SIEMPRE, antes de decidir. La primera vez que esto fallo no supimos
  // cuanto habia tardado porque el ms solo se escribia en la rama de exito.
  await log(`[EXPORT-G3] Comprobacion de tiempos: ${tiempos.frames} frames leidos en ${tiempos.ms} ms`);
  if (!tiempos.ok) {
    for (const f of tiempos.fallos) await log(`[EXPORT-G3] TIEMPOS: ${f}`);
    return { ok: false, compuestas: compuestasSet.size,
      sinComponer: tarjetas.length - compuestasSet.size, segDir, aCaballo,
      motivo: `los tiempos del compuesto no cuadran: ${tiempos.fallos[0]}` };
  }

  await log(`[EXPORT-G3] ${segs.length} segmentos, ${aCaballo} tarjeta(s) partida(s) entre dos ` +
    `segmentos — frames ${framesFinal} = original OK — tiempos OK ` +
    `(ultimo pts ${tiempos.ultimo.toFixed(3)}s)`);
  return { ok: true, compuestas: compuestasSet.size,
    sinComponer: tarjetas.length - compuestasSet.size, segDir, aCaballo };
}

ipcMain.handle('export-video', async (event, { clips, aspectRatio, resolution, format, quality, assignedTransitions, transitionDuration, ajustesVideo }) => {
  // Viaja al frontend para que el aviso llegue al usuario y no solo al log.
  let avisoTiempos = '';
  // El objetivo de frames se calcula DENTRO de la rama del export normal (P0) y la
  // comprobacion del fichero final vive fuera de ella. Se expone aqui en vez de mover P0:
  // 0 significa "no hay objetivo", y entonces la comprobacion 2 no se puede hacer.
  let framesObjetivo = 0;
  try {
    // Mapeo de nombres internos de transiciones a nombres de FFmpeg xfade.
    // Los 38 nombres internos apuntan a 38 destinos DISTINTOS. Antes colapsaban en 21
    // (circleopen salia 5 veces, pixelize 4), asi que un video con las 38 asignadas
    // mostraba solo 21 efectos. El sorteo del frontend siempre fue correcto: el colapso
    // estaba aqui. Los nombres internos NO se pueden renombrar: hay previews CSS y dos
    // paneles del frontend que dependen de ellos; solo cambia el destino.
    // Los 38 destinos se probaron ejecutando xfade de verdad sobre un tail/head reales:
    // 38 de 38 dan 15 frames exactos en este build (ffmpeg 8.1.1).
    // Nota: algunas asignaciones son aproximaciones, no equivalencias. xfade tiene un solo
    // desenfoque (hblur) y una sola rotacion (radial), pero el mapa tiene dos nombres de
    // blur y cuatro rotacionales. Ya pasaba antes: estos nombres vienen de transiciones GL
    // que xfade no reproduce. Quedan 20 destinos sin usar por si hay que afinar alguno:
    // coverleft/right/up/down, revealleft/right/up/down, wipedown, wipetl/tr/bl/br,
    // slideup, horzopen/close, diagbr, hrslice, vuslice, vdwind.
    const XFADE_MAP: Record<string, string> = {
      'fade': 'fade', 'dissolve': 'dissolve', 'morph': 'smoothup',
      'CrossZoom': 'circleopen', 'pixelize': 'pixelize', 'GlitchDisplace': 'diagtl',
      'ripple': 'smoothleft', 'crosswarp': 'diagtr', 'fadegrayscale': 'fadegrays',
      'fadecolor': 'fadeblack', 'burn': 'fadewhite', 'luma': 'distance',
      'flyeye': 'hlslice', 'randomsquares': 'rectcrop', 'wipeUp': 'wipeup',
      'LinearBlur': 'hblur', 'colorphase': 'fadefast', 'rotate_scale_fade': 'zoomin',
      'multiply_blend': 'vertclose', 'kaleidoscope': 'circlecrop', 'powerKaleido': 'circleclose',
      'TVStatic': 'hrwind', 'static_wipe': 'wipeleft', 'SimpleZoom': 'vertopen',
      'SimpleZoomOut': 'squeezev', 'zoomInOut': 'squeezeh', 'StereoViewer': 'slideright',
      'displacement': 'slidedown', 'DirectionalScaled': 'slideleft', 'HSVfade': 'smoothdown',
      'StaticFade': 'hlwind', 'parametric_glitch': 'diagbl', 'mosaic_transition': 'vdslice',
      'ButterflyWaveScrawler': 'smoothright', 'old_tv_lost_signal': 'vuwind', 'DefocusBlur': 'fadeslow',
      'directionalwipe': 'wiperight', 'Revolve_Left': 'radial'
    };
    const mapTransition = (name: string): string => XFADE_MAP[name] || 'fade';
    const trDuration = typeof transitionDuration === 'number' ? transitionDuration : 0.5;
    const hasTransitions = assignedTransitions && Object.keys(assignedTransitions).length > 0;
    await writeDebugLog(`[EXPORT] Transiciones asignadas: ${hasTransitions ? Object.keys(assignedTransitions).length : 0}, duracion: ${trDuration}s, primer mapa de test: ${mapTransition('fade')}`);
    if (!win) return { success: false, error: 'Ventana no disponible' }

    // ANTES del dialogo de guardar: preguntar donde guardar y despues decir que el video
    // saldra incompleto es peor que no avisar. Hoy los clips cuyo fichero no esta se
    // descartan en silencio y el video sale mas corto sin que nada lo diga.
    const auditoria = await auditarClips(clips, activeProjectPath);
    if (auditoria.hayProblema) {
      const ausentes = [...auditoria.faltan, ...auditoria.sinRuta];
      const lista = ausentes.slice(0, 6)
        .map((c: any) => `  - ${c.name} [${c.origen}]`).join('\n');
      const resto = ausentes.length > 6 ? `\n  ...y ${ausentes.length - 6} mas` : '';
      const irrecuperable = auditoria.porOrigen['originales'] || auditoria.porOrigen['ia'] ||
                            auditoria.porOrigen['pista-v2'];

      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Faltan materiales',
        message: `Faltan ${ausentes.length} de ${auditoria.total} clips. El video saldra incompleto.`,
        detail: lista + resto +
          '\n\nLos clips que faltan se descartan al exportar: el video durara menos de lo que ' +
          'marca el timeline.' +
          (irrecuperable ? '\n\nHay material de originales/ia/pista-v2, que no se regenera solo.' : ''),
        buttons: ['Cancelar', 'Exportar de todas formas'],
        defaultId: 0,
        cancelId: 0
      });

      await writeDebugLog(`[EXPORT-AUDIT] faltan=${auditoria.faltan.length} ` +
        `sinRuta=${auditoria.sinRuta.length} fuera=${auditoria.fuera.length} ` +
        `categoriasRaras=${auditoria.categorias.length} ` +
        `respuesta=${response === 1 ? 'continuar' : 'cancelar'}`);

      if (response !== 1) {
        return { success: false, error: 'Exportacion cancelada: faltan materiales.' };
      }
    } else if (auditoria.fuera.length) {
      // FUERA pero existe NO bloquea: hoy exporta perfectamente. Solo queda dicho.
      await writeDebugLog(`[EXPORT-AUDIT] ${auditoria.fuera.length} clip(s) fuera del ` +
        `proyecto pero presentes: se exporta con normalidad.`);
    }

    const ext = format === 'mov' ? 'mov' : 'mp4';
    const filterName = format === 'mov' ? 'QuickTime Movie' : 'MP4 Video';

    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Exportar Video',
      defaultPath: path.join(app.getPath('downloads'), `export.${ext}`),
      filters: [{ name: filterName, extensions: [ext] }]
    })

    if (canceled || !filePath) {
      return { success: false, error: 'Exportación cancelada por el usuario' }
    }

    const exportStart = Date.now();
    const videoClipsOnly = clips.filter((c: any) => c.path && c.type !== 'graphic' && c.type !== 'audio');
    await writeDebugLog(`[EXPORT] Iniciando exportacion: ${videoClipsOnly.length} clips de video, aspect=${aspectRatio}, res=${resolution}, quality=${quality}`);

    if (!clips || clips.length === 0) {
      return { success: false, error: 'No hay clips en el Timeline para exportar.' }
    }

    // Determine target resolution width and height
    const { ancho: targetW, alto: targetH } = dimensionesDeExport(aspectRatio, resolution);

    // Determine crop & scale filter. Se guarda SIN el envoltorio -vf "..." para poder
    // componer sobre la cadena sin cirugia de strings.
    let baseVF = ''
    if (aspectRatio === 'vertical') {
      baseVF = `crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}`
    } else if (aspectRatio === 'square') {
      baseVF = `crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}`
    } else { // horizontal
      baseVF = `crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}`
    }

    // Se calcula UNA vez: la geometria depende del formato de salida, no del clip.
    const cadenaAjustes = construirAjustes(ajustesVideo as AjustesVideo | undefined, targetW, targetH)

    // Antes esto se hacia con filterStr.slice(0, -1) + ',algo"', que asume que la cadena
    // termina en un filtro simple: con el overlay etiquetado de cadenaAjustes esa cirugia
    // dejaria de ser fiable.
    const construirVF = (extra = '', conAjustes = false) =>
      `-vf "${baseVF}${conAjustes ? cadenaAjustes : ''}${extra}"`
    const filterStr = construirVF()

    // Determine quality options
    let crf = 23
    let preset = 'fast'
    if (quality === 'high') {
      crf = 18
      preset = 'medium'
    } else if (quality === 'low') {
      crf = 28
      preset = 'ultrafast'
    }

    const escapedOut = filePath.replace(/"/g, '\\"')

    if (clips.length === 1) {
      const videoPath = clips[0].path
      if (!videoPath || !(await exists(videoPath))) {
        return { success: false, error: `El archivo original no existe o no tiene ruta: ${clips[0].name}` }
      }
      const escapedVideo = videoPath.replace(/"/g, '\\"')
      const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" ${filterStr} -c:v libx264 -preset ${preset} -crf ${crf} -pix_fmt yuv420p -c:a aac "${escapedOut}"`
      
      await new Promise<void>((resolve, reject) => {
        exec(ffmpegCmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    } else {
      const videoOnly = clips.filter((c: any) =>
        c.path && c.type !== 'audio' && c.type !== 'graphic' && c.category !== 'v2_overlay'
      );

      // Se comprueba ANTES de normalizar nada: si el ajuste no va a aplicarse a ningun clip,
      // exportar seria gastar minutos en un video que sale sin el, y en silencio.
      if (cadenaAjustes) {
        const nOrig = videoOnly.filter((c: any) =>
          (c.category || '').toLowerCase().startsWith('original')).length;
        if (nOrig === 0) {
          await writeDebugLog(`[EXPORT] BLOQUEADO: hay ajustes de encuadre pero 0 de ${videoOnly.length} clips son 'original'`);
          return { success: false, error: 'Has aplicado recorte, zoom o espejo, pero el timeline no tiene ningun clip tuyo (categoria "original"): el ajuste no se aplicaria a nada. Quita el ajuste o anade tus clips.' };
        }
        await writeDebugLog(`[EXPORT] Ajustes de encuadre activos en ${nOrig} de ${videoOnly.length} clips (solo 'original')`);
      }

      // A1: mapear transiciones asignadas a pares de indices consecutivos de videoOnly (solo lectura + logs)
      const transitionByIndex: Record<number, string> = {};
      if (hasTransitions) {
        const consumedKeys = new Set<string>();
        for (let i = 0; i < videoOnly.length - 1; i++) {
          const key = `${videoOnly[i].id}->${videoOnly[i + 1].id}`;
          const assigned = assignedTransitions[key];
          if (assigned) {
            transitionByIndex[i] = mapTransition(assigned);
            consumedKeys.add(key);
          }
        }
        await writeDebugLog(`[EXPORT-TR] Pares con transicion: ${Object.keys(transitionByIndex).length} de ${videoOnly.length - 1} cortes. Detalle: ${Object.entries(transitionByIndex).slice(0, 10).map(([i, t]) => `${i}:${t}`).join(', ')}`);

        // Diagnostico: distingue los 3 modos de fallo posibles del mapeo
        const totalKeys = Object.keys(assignedTransitions);
        const orphanKeys = totalKeys.filter((k) => !consumedKeys.has(k));
        const isSorted = videoOnly.every((c: any, i: number) =>
          i === 0 || (c.startSeconds ?? 0) >= (videoOnly[i - 1].startSeconds ?? 0)
        );
        const overlayCount = clips.filter((c: any) => c.category === 'v2_overlay').length;
        const noPathCount = clips.filter((c: any) => !c.path && c.type !== 'audio' && c.type !== 'graphic').length;
        await writeDebugLog(`[EXPORT-TR] DIAG huerfanas: ${orphanKeys.length}/${totalKeys.length} | ordenado por startSeconds: ${isSorted} | v2_overlay excluidos: ${overlayCount} | sin path excluidos: ${noPathCount}`);
        if (orphanKeys.length > 0) {
          await writeDebugLog(`[EXPORT-TR] DIAG primeras huerfanas: ${orphanKeys.slice(0, 4).join(' | ')}`);
          await writeDebugLog(`[EXPORT-TR] DIAG primeros ids videoOnly: ${videoOnly.slice(0, 5).map((c: any) => c.id).join(' | ')}`);
        }
      }

      const audioClip = clips.find((c: any) => c.type === 'audio' && c.path);

      if (videoOnly.length === 0) {
        return { success: false, error: 'No hay clips de video validos para exportar.' };
      }

      await writeDebugLog(`[EXPORT] Normalizando ${videoOnly.length} clips a ${targetW}x${targetH}...`);
      const normStart = Date.now();

      const bankDir = getBancoClipsPath();
      const normDir = path.join(bankDir, 'temp_export');
      if (!(await exists(normDir))) {
        await fs.promises.mkdir(normDir, { recursive: true });
      }

      // P0: cada clip normalizado debe durar EXACTAMENTE su slot del timeline.
      // Los archivos en disco duran mas que su slot (los 'original' hasta +0.167s por el
      // -ss/-t con -c copy de FASE 3, que no corta en puntos arbitrarios), y al concatenar
      // el error se acumula: medido, 2.758s de deriva del video respecto al audio maestro.
      // Se calcula en frames enteros arrastrando el error acumulado, para que la suma total
      // cuadre con el timeline en vez de que cada clip redondee por su cuenta.
      const FPS = 30;
      const frameTargets: number[] = [];
      let idealAcum = 0;
      let framesAcum = 0;
      for (let i = 0; i < videoOnly.length; i++) {
        const slot = Number(videoOnly[i].durationSeconds);
        if (!Number.isFinite(slot) || slot <= 0) {
          frameTargets.push(0); // 0 = sin recorte, se usa el comando de siempre (degradacion elegante)
          continue;
        }
        idealAcum += slot;
        const frames = Math.round(idealAcum * FPS) - framesAcum;
        frameTargets.push(frames > 0 ? frames : 1);
        framesAcum += frameTargets[i];
      }
      framesObjetivo = framesAcum;
      const sinSlot = frameTargets.filter(f => f === 0).length;
      await writeDebugLog(`[EXPORT] P0 recorte por slot: ${framesAcum} frames = ${(framesAcum / FPS).toFixed(3)}s (suma de slots: ${idealAcum.toFixed(3)}s, clips sin slot valido: ${sinSlot})`);

      // El tpad sostiene el ultimo frame por si el archivo es MAS CORTO que su slot
      // (medido: 1 de 79 clips, -0.018s). El -frames:v recorta despues al valor exacto.
      // setsar=1 es obligatorio antes de cualquier xfade: si un clip trae SAR != 1:1 el
      // filtro falla o da artefactos aunque las dimensiones coincidan.
      //
      // B1: el clonado del ultimo frame cubre el desfase entre el slot y el metraje real.
      // Estaba en 1s, y con desfases mayores el clip salia corto, el video se acortaba y el
      // -shortest del concat recortaba el AUDIO. Medido: 3.24s de narracion perdidos.
      // Subir el tope no cuesta nada porque tpad solo genera los frames que -frames:v llega
      // a consumir: con un desfase de 3s, un tope de 10s produce lo mismo que uno de 5s.
      // El desfase es el silencio tras la ultima palabra transcrita, una propiedad de la
      // GRABACION y no de su duracion: medido en 26 proyectos, tres videos fuente distintos
      // dan -0.07s, +0.06s y +3.11s con independencia de que duren 199s o 286s. El maximo
      // conocido es 4.09s, asi que 10s deja un margen de 2.4x.
      // El tope existe porque ante un desfase enorme (medido: 645s, por segmentos de
      // transcripcion obsoletos) clonar un frame 11 minutos seria peor que el fallo.
      const MAX_CLONADO = 10; // segundos de frame congelado, como maximo

      // P3: se indexa POR POSICION, no se compacta. Si un clip falla, su hueco queda vacio
      // en vez de desplazar a todos los siguientes. Es el mismo error que ya se corrigio en
      // FASE 4 de la generacion (results[item.index - 1] posicional): compactar rompe la
      // correspondencia con transitionByIndex, que se indexa contra videoOnly. A4 tendra que
      // intercalar body_i con transition_i, asi que necesita esa correspondencia intacta.
      const normPorIndice: (string | undefined)[] = new Array(videoOnly.length);
      for (let i = 0; i < videoOnly.length; i++) {
        const clip = videoOnly[i];
        if (!(await exists(clip.path))) continue;

        // B1: si el slot supera al tope de clonado, comprobar que hay metraje para llenarlo.
        // Un desfase mayor que MAX_CLONADO exige, por definicion, un slot mayor que
        // MAX_CLONADO, asi que esta condicion es completa. Los clips normales duran 2-4s,
        // de modo que en un export sano esto son CERO ffprobe.
        const slotSeg = frameTargets[i] > 0 ? frameTargets[i] / FPS : 0;
        if (slotSeg > MAX_CLONADO) {
          const real = await new Promise<number>((resolve) => {
            exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${clip.path.replace(/"/g, '\\"')}"`,
              (err, stdout) => resolve(err ? 0 : (parseFloat(String(stdout).trim().replace(',', '.')) || 0)));
          });
          const desfase = slotSeg - real;
          if (real > 0 && desfase > MAX_CLONADO) {
            await writeDebugLog(`[EXPORT] AVISO B1: clip ${i} (${path.basename(clip.path)}) tiene un slot de ` +
              `${slotSeg.toFixed(1)}s pero solo ${real.toFixed(1)}s de metraje. Faltan ${desfase.toFixed(1)}s que NO ` +
              `se clonan (tope ${MAX_CLONADO}s): el video quedara mas corto que el audio y el -shortest recortara ` +
              `el final. Causa tipica: los segmentos de la transcripcion no cubren todo el audio (deuda A).`);
          }
        }

        event.sender.send('export-progress', {
          step: 'normalizing', 
          current: i + 1, 
          total: videoOnly.length, 
          message: `Normalizando clip ${i + 1} de ${videoOnly.length}...` 
        });
        const normPath = path.join(normDir, `norm_${String(i).padStart(4, '0')}.mp4`);
        const escapedIn = clip.path.replace(/"/g, '\\"');
        const escapedNorm = normPath.replace(/"/g, '\\"');
        try {
          await new Promise<void>((resolve, reject) => {
            const frames = frameTargets[i];
            // Los ajustes solo tocan los clips del usuario: cuando aplica el crop, el stock
            // y la IA todavia NO existen (se descargan al construir). Es ademas lo que ya
            // hace el preview, asi que preview y archivo coinciden por construccion.
            const conAjustes = (clip.category || '').toLowerCase().startsWith('original');
            const vf = frames > 0
              ? construirVF(`,tpad=stop_mode=clone:stop_duration=${MAX_CLONADO},setsar=1`, conAjustes)
              : construirVF(',setsar=1', conAjustes);
            const trim = frames > 0 ? `-frames:v ${frames} ` : '';
            // -colorspace bt709: UNIFICA LA MATRIZ DE COLOR. No es cosmetico, arregla un bug
            // que descartaba TODOS los graficos del export.
            //
            // ffmpeg copia las etiquetas de color de la fuente aunque recodifique —medido:
            // clip_006 entra bt2020nc y salia bt2020nc—, asi que el concat con -c:v copy
            // heredaba la mezcla y el video base alternaba bt709 con bt2020nc. Cada cambio de
            // matriz obliga a reconstruir el grafo de filtros a mitad del stream:
            //   [fc#0] Reconfiguring filter graph because video parameters changed to ...
            // y en esa reconfiguracion se pierden los frames que van EN VUELO por la cadena de
            // overlay de PIEZA 3. Como la guarda exige que el recuento cuadre al frame, la
            // pasada se descartaba entera y el video salia sin ninguna tarjeta.
            //
            // MEDIDO sobre el seg_00003.mp4 de un export que fallo, 30 composiciones de cada:
            //   segmento tal cual (1 cambio de matriz dentro):  30 de 30 FALLOS
            //   el mismo con la matriz unificada:                0 de 30 fallos
            // El caso determinista, no una carrera: por eso el reintento por segmento no lo
            // salvaba nunca.
            //
            // Se aplica a TODOS los clips, no solo a los pocos que vienen en bt2020nc. Para uno
            // que ya es bt709 no cambia nada, y asi no hace falta detectar cuales lo necesitan:
            // una deteccion que fallara volveria a colar un clip suelto y el bug volveria.
            // Coste medido sobre los dos clips HDR reales: 430 -> 419 ms y 425 -> 436 ms. Cero.
            //
            // OJO, NO ARREGLA LAS OTRAS DOS ETIQUETAS: color_primaries y color_transfer se
            // siguen heredando de la fuente (medido: la salida se queda en bt2020/arib-std-b67).
            // Ver la deuda del plan maestro.
            const cmd = `ffmpeg -y -i "${escapedIn}" ${vf} -r 30 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -colorspace bt709 -video_track_timescale ${TIMESCALE} -an ${trim}"${escapedNorm}"`;
            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => {
              if (err) reject(err); else resolve();
            });
          });
          normPorIndice[i] = normPath;
        } catch (normErr: any) {
          await writeDebugLog(`[EXPORT] Error normalizando clip ${i}: ${normErr.message}`);
        }
      }

      // Aplanar SI es correcto aqui: esta lista solo se recorre en orden (concat y limpieza),
      // nadie indexa dentro de ella. La correspondencia por posicion vive en normPorIndice.
      const normalizedPaths = normPorIndice.filter((p): p is string => !!p);
      const huecos = videoOnly.length - normalizedPaths.length;
      await writeDebugLog(`[EXPORT] Normalizacion: ${((Date.now() - normStart) / 1000).toFixed(1)}s — ` +
        `${normalizedPaths.length} clips` +
        (huecos > 0 ? ` | ${huecos} huecos: esos cortes van secos y sus transiciones se descartan` : ''));

      if (normalizedPaths.length === 0) {
        return { success: false, error: 'No se pudo normalizar ningun clip.' };
      }

      // ═══ A2: material para las transiciones (tails/heads) ═══
      // Por cada par con transicion se generan dos ficheros de 15 frames (0.5s a 30fps):
      //   tail_i = ultimos 7 frames reales del clip i + 8 clonados
      //   head_j = 7 clonados + primeros 8 frames reales del clip j
      // El reparto 7+8 sale de que 0.25s son 7.5 frames y no puede ser fraccionario.
      // Se conserva la aritmetica: (frames_A - 7) + 15 + (frames_B - 8) = frames_A + frames_B
      // A2 SOLO genera estos ficheros. El recorte de bodies y el intercalado son de A4, para
      // que entre fase y fase el export siga saliendo exactamente igual que hoy.
      const FRAMES_TR = 15, FRAMES_TAIL = 7, FRAMES_HEAD = 8;
      const MIN_FRAMES_TR = 30; // clips de menos de 1s: corte seco, sin transicion
      const tempExtraPaths: string[] = [];

      // A4: bodies (por defecto, el norm entero sin recortar) y transiciones que A3 dejo
      // realmente en disco, ambos POR INDICE (P3). transicionPorIndice es la UNICA fuente
      // de verdad para recortar y para insertar: se rellena solo si el render de A3
      // termino bien, asi que nunca se recorta un body para una transicion que no existe.
      const bodyPorIndice: (string | undefined)[] = normPorIndice.slice();
      const transicionPorIndice: (string | undefined)[] = new Array(videoOnly.length);

      // Interruptor de emergencia: CIPHER_SIN_TRANSICIONES=1 en el .env apaga TODO el
      // pipeline (A2, A3 y A4) sin revertir nada: no se generan tails/heads ni transiciones
      // y el concat sale con los norms enteros, como antes del Proyecto A.
      // loadEnv(true) relee el .env en cada export: para alternar basta editar el valor
      // (1 = apagado, 0 = encendido), sin reabrir la app.
      loadEnv(true);
      const transicionesActivas = process.env.CIPHER_SIN_TRANSICIONES !== '1';
      if (!transicionesActivas) {
        await writeDebugLog('[EXPORT] Pipeline de transiciones DESACTIVADO por CIPHER_SIN_TRANSICIONES=1');
      }

      if (transicionesActivas && hasTransitions && Object.keys(transitionByIndex).length > 0) {
        const trStart = Date.now();

        const buildSegment = async (i: number, kind: 'tail' | 'head') => {
          // normPorIndice es la fuente de verdad: si ese clip fallo, su hueco esta vacio y
          // no hay tail/head que generar. Evita ademas 2 consultas al disco por par.
          const src = normPorIndice[i];
          if (!src) return null;
          const F = frameTargets[i];
          if (!F || F < MIN_FRAMES_TR) return null;
          const out = path.join(normDir, `${kind}_${String(i).padStart(4, '0')}.mp4`);
          const chain = kind === 'tail'
            ? `trim=start_frame=${F - FRAMES_TAIL},setpts=PTS-STARTPTS,tpad=stop=${FRAMES_HEAD}:stop_mode=clone,setsar=1`
            : `trim=end_frame=${FRAMES_HEAD},setpts=PTS-STARTPTS,tpad=start=${FRAMES_TAIL}:start_mode=clone,setsar=1`;
          const cmd = `ffmpeg -y -i "${src.replace(/"/g, '\\"')}" -vf "${chain}" -r 30 ` +
            `-c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an -frames:v ${FRAMES_TR} ` +
            `-video_track_timescale ${TIMESCALE} ` +
            `"${out.replace(/"/g, '\\"')}"`;
          try {
            await new Promise<void>((resolve, reject) => {
              exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => { if (err) reject(err); else resolve(); });
            });
            tempExtraPaths.push(out);
            return out;
          } catch (e: any) {
            await writeDebugLog(`[EXPORT-A2] Error generando ${kind}_${i}: ${e.message}`);
            return null;
          }
        };

        let pares = 0, descartados = 0;
        for (const key of Object.keys(transitionByIndex)) {
          const i = Number(key);
          const tail = await buildSegment(i, 'tail');
          const head = await buildSegment(i + 1, 'head');
          if (tail && head) pares++; else descartados++;
        }
        await writeDebugLog(`[EXPORT-A2] Tails/heads: ${pares} pares listos, ${descartados} descartados ` +
          `(clip corto o error) — ${tempExtraPaths.length} ficheros en ${((Date.now() - trStart) / 1000).toFixed(1)}s`);

        // ═══ A3: mini-renders xfade ═══
        // Cada par produce un transition_i.mp4 de 15 frames: xfade da
        // durA + durB - duracion = 0.5 + 0.5 - 0.5 = 0.5s exactos, justo lo que A4 insertara.
        // offset=0 SIEMPRE: ambos inputs duran ya exactamente la transicion, asi que no hay
        // error que se pueda acumular de un par al siguiente.
        // Igual que A2, esto SOLO genera ficheros: la lista de concat no se toca hasta A4.
        // Verificado antes de escribirlo, sobre clips reales: los 21 nombres destino del
        // XFADE_MAP existen en el build de ffmpeg, y la cadena norm -> tail/head -> xfade
        // da 15 frames exactos con SAR 1:1 y el mismo pix_fmt que los bodies (~0.26s/render).
        const a3Start = Date.now();
        const fallosPorNombre: Record<string, number> = {};
        let trOk = 0, trFallidas = 0;
        const clavesTr = Object.keys(transitionByIndex);

        for (let n = 0; n < clavesTr.length; n++) {
          const i = Number(clavesTr[n]);
          const tail = path.join(normDir, `tail_${String(i).padStart(4, '0')}.mp4`);
          const head = path.join(normDir, `head_${String(i + 1).padStart(4, '0')}.mp4`);
          // A2 pudo descartar el par por clip corto o por error; ese corte ira seco.
          if (!(await exists(tail)) || !(await exists(head))) { trFallidas++; continue; }

          const nombre = transitionByIndex[i];
          const out = path.join(normDir, `transition_${String(i).padStart(4, '0')}.mp4`);

          event.sender.send('export-progress', {
            step: 'transitions',
            current: n + 1,
            total: clavesTr.length,
            message: `Generando transicion ${n + 1} de ${clavesTr.length}...`
          });

          const cmd = `ffmpeg -y -i "${tail.replace(/"/g, '\\"')}" -i "${head.replace(/"/g, '\\"')}" ` +
            `-filter_complex "[0][1]xfade=transition=${nombre}:duration=${(FRAMES_TR / 30).toFixed(3)}:offset=0" ` +
            `-r 30 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an ` +
            `-video_track_timescale ${TIMESCALE} ` +
            `-frames:v ${FRAMES_TR} "${out.replace(/"/g, '\\"')}"`;
          try {
            await new Promise<void>((resolve, reject) => {
              exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => { if (err) reject(err); else resolve(); });
            });
            tempExtraPaths.push(out);
            transicionPorIndice[i] = out; // A4: registra la transicion por indice
            trOk++;
          } catch (e: any) {
            // Un xfade puede fallar si este build no soporta ese nombre. Se agrupa POR NOMBRE
            // para poder corregir el XFADE_MAP en vez de perder el corte en silencio.
            fallosPorNombre[nombre] = (fallosPorNombre[nombre] ?? 0) + 1;
            trFallidas++;
          }
        }

        const detalleFallos = Object.entries(fallosPorNombre)
          .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
        await writeDebugLog(`[EXPORT-A3] Transiciones renderizadas: ${trOk} de ${clavesTr.length} ` +
          `(${trFallidas} sin render, esos cortes quedaran secos) en ` +
          `${((Date.now() - a3Start) / 1000).toFixed(1)}s` +
          (detalleFallos ? ` | fallos por nombre: ${detalleFallos}` : ''));

        // ═══ A4: recortar los bodies e intercalar ═══
        // Aritmetica que conserva la duracion, par a par:
        //   con transicion: (f_i − 7) + 15 + (f_{i+1} − 8) = f_i + f_{i+1}
        //   corte seco:      f_i            +  f_{i+1}     = f_i + f_{i+1}
        // MIN_FRAMES_TR = 30 garantiza que un body nunca queda por debajo de 15 frames.
        const a4Start = Date.now();
        let recortados = 0;
        let a4Fallo = false;
        for (let i = 0; i < videoOnly.length && !a4Fallo; i++) {
          const src = normPorIndice[i];
          if (!src) continue;
          const F = frameTargets[i];
          const quitaFin = transicionPorIndice[i] ? FRAMES_TAIL : 0;                // transicion DESPUES
          const quitaIni = (i > 0 && transicionPorIndice[i - 1]) ? FRAMES_HEAD : 0; // transicion ANTES
          if (quitaIni + quitaFin === 0) continue; // sin vecinas: el norm va tal cual, sin re-encode
          const bodyFrames = F - quitaIni - quitaFin;
          const out = path.join(normDir, `body_${String(i).padStart(4, '0')}.mp4`);
          const cmd = `ffmpeg -y -i "${src.replace(/"/g, '\\"')}" ` +
            `-vf "trim=start_frame=${quitaIni}:end_frame=${F - quitaFin},setpts=PTS-STARTPTS,setsar=1" ` +
            `-r 30 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an -frames:v ${bodyFrames} ` +
            `-video_track_timescale ${TIMESCALE} ` +
            `"${out.replace(/"/g, '\\"')}"`;
          try {
            await new Promise<void>((resolve, reject) => {
              exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => { if (err) reject(err); else resolve(); });
            });
            tempExtraPaths.push(out);
            bodyPorIndice[i] = out;
            recortados++;
          } catch (e: any) {
            await writeDebugLog(`[EXPORT-A4] Error recortando body ${i}: ${e.message}`);
            a4Fallo = true;
          }
        }

        // Contabilidad ANTES de concatenar: si no cuadra, ni hace falta abrir el video.
        let framesBodies = 0, framesTr = 0, nTr = 0, sinSlot = 0, acumF = 0;
        const puntos: string[] = [];
        for (let i = 0; i < videoOnly.length; i++) {
          const F = frameTargets[i];
          if (bodyPorIndice[i]) {
            if (F > 0) {
              const qF = transicionPorIndice[i] ? FRAMES_TAIL : 0;
              const qI = (i > 0 && transicionPorIndice[i - 1]) ? FRAMES_HEAD : 0;
              framesBodies += F - qI - qF;
            } else sinSlot++;
          }
          acumF += F;
          if (transicionPorIndice[i]) {
            framesTr += FRAMES_TR; nTr++;
            // [indice] segundo nombre — el indice es el mismo de EXPORT-TR y del timeline
            puntos.push(`[${i}] ${((acumF - FRAMES_TAIL) / FPS).toFixed(1)}s ${transitionByIndex[i]}`);
          }
        }
        const totalA4 = framesBodies + framesTr;
        const cuadra = totalA4 === framesAcum;

        if (a4Fallo || !cuadra) {
          // Degradacion todo-o-nada: recorte e insercion son inseparables (un body sin
          // recortar junto a una transicion insertada sumaria frames y desincronizaria el
          // audio, que es lo unico intocable). Se vuelve al export clasico: norms enteros,
          // cero transiciones. El video sale correcto, sin fundidos.
          for (let k = 0; k < videoOnly.length; k++) {
            bodyPorIndice[k] = normPorIndice[k];
            transicionPorIndice[k] = undefined;
          }
          await writeDebugLog(`[EXPORT-A4] AVISO: ${a4Fallo ? 'fallo un recorte' : `DESCUADRE (${totalA4} vs ${framesAcum})`} — se exporta SIN transiciones (corte seco en todos los cortes)`);
        } else {
          await writeDebugLog(`[EXPORT-A4] bodies: ${bodyPorIndice.filter(b => !!b).length} (${recortados} recortados) = ${framesBodies} frames | ` +
            `transiciones: ${nTr} = ${framesTr} frames | TOTAL ${totalA4} = objetivo P0 ${framesAcum} OK` +
            (sinSlot > 0 ? ` | ${sinSlot} clips sin slot fuera de la cuenta` : '') +
            ` — ${((Date.now() - a4Start) / 1000).toFixed(1)}s`);
          if (puntos.length > 0) {
            await writeDebugLog(`[EXPORT-A4] transiciones en: ${puntos.join(', ')}`);
          }
        }
      }

      const tempTxtPath = path.join(bankDir, `temp_concat_${Date.now()}.txt`);
      const lineaConcat = (p: string) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'\n`;
      // A4: se intercala body_i + transition_i recorriendo INDICES (P3): un clip fallido es
      // un hueco y no desplaza nada. Con el interruptor apagado, sin transiciones asignadas
      // o tras una degradacion, bodyPorIndice contiene los norms enteros y transicionPorIndice
      // esta vacio, asi que esto es identico al export de siempre.
      let fileContent = '';
      for (let i = 0; i < videoOnly.length; i++) {
        const body = bodyPorIndice[i];
        if (!body) continue;
        fileContent += lineaConcat(body);
        const tr = transicionPorIndice[i];
        if (tr) fileContent += lineaConcat(tr);
      }
      await fs.promises.writeFile(tempTxtPath, fileContent, 'utf8');
      const escapedTxt = tempTxtPath.replace(/"/g, '\\"');

      event.sender.send('export-progress', { 
        step: 'concatenating', 
        current: videoOnly.length, 
        total: videoOnly.length, 
        message: 'Concatenando clips y mezclando audio...' 
      });

      // PIEZA 3 — las TARJETAS se recogen APARTE. videoOnly las sigue excluyendo y la
      // aritmetica de frames no se entera: nada de lo anterior cambia.
      //
      // Son overlays con alpha que van ENCIMA del plano. Los graficos de PANTALLA COMPLETA,
      // cuando existan, no vienen por aqui: sustituyen al plano, van sin alpha y entraran por
      // el pipeline de video como un clip mas.
      //
      // El inicio y la duracion se leen DEL CLIP, aqui y ahora, nunca de algo guardado junto
      // al MOV: es lo que hace que mover un clip sea correcto sin invalidar la cache.
      const tarjetas: { hash: string; ini: number; dur: number; mov: string }[] = [];
      let tarjetasSinFichero = 0;
      const clipsGrafico = (clips || []).filter((c: any) => c.type === 'graphic');
      for (const c of clipsGrafico) {
        if (!c.graphicMovHash || !activeProjectPath) { tarjetasSinFichero++; continue; }
        const mov = path.join(dirCache(activeProjectPath, 'graficos'), `${c.graphicMovHash}.mov`);
        // Tener el hash NO garantiza que el MOV siga en disco: se comprueba el fichero, igual
        // que hace auditarClips con los materiales. Y VARIOS clips pueden compartir el mismo
        // .mov —la cache deduplica graphicData identicos— asi que esto no asume uno por clip.
        if (!(await exists(mov))) { tarjetasSinFichero++; continue; }
        tarjetas.push({
          hash: c.graphicMovHash,
          ini: Number(c.startSeconds) || 0,
          dur: Number(c.durationSeconds) || 2,
          mov
        });
      }
      tarjetas.sort((a, b) => a.ini - b.ini);
      const hayTarjetas = tarjetas.length > 0;

      // ─────────────────────────────────────────────────────────────────────────────────
      // TEMPORAL — DIAGNOSTICO DE LOS FRAMES QUE FALTAN AL FINAL. QUITAR AL CERRARLO.
      //
      // Un export salio con el ultimo pts en 285.887s contra los 286.000s pedidos: 0.113s,
      // 3.4 frames a 30 fps. No es un numero entero de frames, asi que no es "se perdio un
      // frame". Hay dos causas posibles y hasta ahora no se sabia separarlas:
      //
      //   a) el -shortest del mux, que corta por la pista MAS CORTA de las dos
      //   b) el redondeo del concat al empalmar segmentos
      //
      // Se separan con tres duraciones medidas en el unico momento en que las tres existen
      // a la vez —antes de que la limpieza se lleve los temporales—, sin conservar nada:
      //
      //   audio < objetivo  y  video = objetivo  ->  (a): corta el -shortest, por el audio
      //   video < objetivo                       ->  (b): el video ya llego corto al mux
      //   los dos = objetivo y el final corto    ->  ni (a) ni (b): es el propio mux
      //
      // NO hace falta preservar intermedios, y preservarlos seria peor: el unico numero que
      // aportarian —la duracion del base— es el que esta linea ya mide, y lo mide en el
      // instante correcto en vez de despues. Ademas dejaria gigas en disco en cada export de
      // un producto que se vende.
      //
      // Ya hay medio dato, medido sin exportar nada: el audio de kl-1786725625006 dura
      // 285.955s, y al video se le pedian 8581 frames, que a 30 fps son 286.033s de DURACION
      // (su ultimo frame arranca en 286.000s, que es contra lo que compara verificarTiempos —
      // son dos numeros distintos separados por un frame, y confundirlos descuadra todo).
      // El audio es 0.078s = 2.35 frames MAS CORTO que el video, asi que -shortest tiene que
      // cortar por fuerza: del orden de 2 frames de los 3.4 observados. Quedan ~1.4 sin
      // explicar. El "del orden de" es a proposito: donde corta exactamente -shortest depende
      // de su semantica, y deducirlo en vez de medirlo es justo lo que estamos evitando.
      const durDe = async (f: string) => {
        const r = await new Promise<string>((res) => exec(
          `ffprobe -v error -show_entries format=duration -of csv=p=0 "${f.replace(/"/g, '\\"')}"`,
          (e, out) => res(e ? '' : String(out).trim())));
        const d = parseFloat(r);
        return Number.isFinite(d) ? d : NaN;
      };
      const fmt = (x: number) => Number.isFinite(x) ? `${x.toFixed(3)}s` : '(no medido)';
      const hayAudio = !!(audioClip && audioClip.path && (await exists(audioClip.path)));
      const durAudio = hayAudio ? await durDe(audioClip.path) : NaN;
      // framesObjetivo frames ocupan framesObjetivo/FPS segundos de duracion. Ojo: no es el
      // mismo numero que el `esperado` de verificarTiempos, que es el pts del ULTIMO frame,
      // o sea (framesObjetivo-1)/FPS. Un frame de diferencia, y confundirlos aqui haria que
      // todo pareciera descuadrar en 1 frame.
      const objetivoS = framesObjetivo > 0 ? framesObjetivo / FPS : NaN;
      await writeDebugLog(`[EXPORT-MUX] TEMPORAL diagnostico de frames — audio que entra: ` +
        `${fmt(durAudio)}   objetivo del video: ${fmt(objetivoS)} (${framesObjetivo} frames ` +
        `a ${FPS} fps)` + (hayTarjetas ? '' : ' — sin tarjetas: concat y mux van en el mismo ' +
        'comando, asi que no hay video intermedio que medir'));
      // ─────────────────────────────────────────────────────────────────────────────────

      await writeDebugLog(`[EXPORT] Concatenando...`);
      const concatStart = Date.now();

      // Con tarjetas el concat va a un TEMPORAL sin audio: la pasada de graficos necesita un
      // video sobre el que componer, y `-c:v copy` es incompatible con filter_complex — meter
      // el overlay en este mismo comando obligaria a recodificar los 28 minutos enteros.
      // Sin tarjetas, el camino es exactamente el de siempre.
      const videoBase = path.join(normDir, 'base_sin_graficos.mp4');

      let ffmpegCmd = '';
      if (hayTarjetas) {
        ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" -c:v copy -an "${videoBase.replace(/"/g, '\\"')}"`;
      } else if (audioClip && audioClip.path && (await exists(audioClip.path))) {
        const escapedAudio = audioClip.path.replace(/"/g, '\\"');
        ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" -i "${escapedAudio}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart "${escapedOut}"`;
      } else {
        ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" -c:v copy -an -movflags +faststart "${escapedOut}"`;
      }

      await new Promise<void>((resolve, reject) => {
        exec(ffmpegCmd, { maxBuffer: 1024 * 1024 * 50 }, async (err) => {
          try { await fs.promises.unlink(tempTxtPath); } catch (e) {}
          for (const np of normalizedPaths) {
            try { await fs.promises.unlink(np); } catch (e) {}
          }
          // A2: tails/heads. Sin esto se acumulan Y ademas impiden el rmdir de normDir.
          for (const tp of tempExtraPaths) {
            try { await fs.promises.unlink(tp); } catch (e) {}
          }
          // Con tarjetas, normDir todavia guarda el video base sobre el que hay que componer:
          // se limpia al final de la pasada de graficos, no aqui.
          if (!hayTarjetas) { try { await fs.promises.rmdir(normDir); } catch (e) {} }
          if (err) reject(err); else resolve();
        });
      });

      await writeDebugLog(`[EXPORT] Concat: ${((Date.now() - concatStart) / 1000).toFixed(1)}s`);

      if (hayTarjetas) {
        event.sender.send('export-progress', {
          step: 'graphics', current: 0, total: tarjetas.length,
          message: `Componiendo ${tarjetas.length} graficos...`
        });
        const g3Start = Date.now();
        const conGraficos = path.join(normDir, 'con_graficos.mp4');
        const r = await componerTarjetas(videoBase, conGraficos, tarjetas, FPS, crf, preset,
          normDir, (s) => writeDebugLog(s));

        // COBERTURA 2: se cuenta lo ESPERADO contra lo COMPUESTO y se dice. Nunca 17 de 19 en
        // silencio. `esperadas` cuenta todos los clips de grafico del timeline, incluidos los
        // que no tienen MOV en disco — que es justo lo que se perderia sin avisar.
        const esperadas = clipsGrafico.length;
        if (!r.ok) {
          await writeDebugLog(`[EXPORT-G3] PASADA DESCARTADA: ${r.motivo}. El video sale SIN ` +
            `las ${esperadas} tarjetas, pero correcto y sincronizado.`);
          await writeDebugLog(`[EXPORT-G3] Contexto: ${tarjetas.length} tarjetas con MOV de ` +
            `${esperadas} clips de grafico` +
            (tarjetasSinFichero ? ` (${tarjetasSinFichero} sin fichero)` : '') +
            `, ${r.aCaballo} a caballo entre dos segmentos, ${((Date.now() - g3Start) / 1000).toFixed(1)}s.`);
          // NO se borra nada al descartar: el video base y los segmentos son lo unico con lo
          // que se puede averiguar por que fallo, y son temporales que no se pueden
          // reconstruir despues — el exportado ya paso por el mux con -shortest y tiene otros
          // frames y otros keyframes.
          await writeDebugLog(`[EXPORT-G3] CONSERVADO para diagnostico: ${videoBase}`);
          await writeDebugLog(`[EXPORT-G3] CONSERVADO para diagnostico: ${r.segDir}`);
        } else {
          // TARJETAS distintas, no invocaciones de overlay. Y se dice explicitamente cuantas
          // NO salen, para que el numero no cuadre por casualidad: si algun dia son 37 de 39,
          // esta linea tiene que decirlo en vez de disimularlo.
          const perdidas = esperadas - r.compuestas;
          await writeDebugLog(`[EXPORT-G3] ${r.compuestas} de ${esperadas} tarjetas compuestas` +
            (perdidas > 0 ? `, ${perdidas} NO salen en el video` : '') +
            (tarjetasSinFichero ? ` (${tarjetasSinFichero} sin MOV en disco)` : '') +
            (r.sinComponer > 0 ? `, ${r.sinComponer} con MOV pero fuera de todo segmento` : '') +
            ` — ${r.aCaballo} partida(s) entre dos segmentos` +
            ` — ${((Date.now() - g3Start) / 1000).toFixed(1)}s`);
        }

        // El audio se mezcla al final, sobre lo que haya salido. -c:v copy: no recodifica.
        const fuente = r.ok ? conGraficos : videoBase;

        // TEMPORAL — la otra mitad del diagnostico. QUITAR CON EL BLOQUE DE ARRIBA.
        // Esta es la medicion que no se habia hecho nunca: cuanto dura el video JUSTO ANTES
        // de entrar al mux. Despues del mux ya no se puede saber, porque -shortest habra
        // recortado y el fichero final no distingue lo que llego corto de lo que se corto.
        const durVideo = await durDe(fuente);
        await writeDebugLog(`[EXPORT-MUX] TEMPORAL video que entra al mux: ${fmt(durVideo)} ` +
          `(${r.ok ? 'con' : 'SIN'} tarjetas)   audio: ${fmt(durAudio)}   ` +
          `objetivo: ${fmt(objetivoS)}`);
        if (Number.isFinite(durVideo) && Number.isFinite(durAudio)) {
          const dif = durVideo - durAudio;
          await writeDebugLog(`[EXPORT-MUX] TEMPORAL -shortest cortara por ` +
            `${dif > 0 ? 'el AUDIO, que es mas corto' : dif < 0 ? 'el VIDEO, que es mas corto' :
              'ninguno: duran igual'} — diferencia ${Math.abs(dif).toFixed(3)}s = ` +
            `${(Math.abs(dif) * FPS).toFixed(2)} frames`);
        }
        if (Number.isFinite(durVideo) && Number.isFinite(objetivoS)) {
          const falta = objetivoS - durVideo;
          await writeDebugLog(`[EXPORT-MUX] TEMPORAL al video le ` +
            `${falta > 0 ? 'FALTAN' : 'SOBRAN'} ${Math.abs(falta * FPS).toFixed(2)} frames ` +
            `respecto al objetivo ANTES del mux — si esto es ~0, el recorte del final es ` +
            `del -shortest; si no, viene del concat`);
        }

        let mux = '';
        if (audioClip && audioClip.path && (await exists(audioClip.path))) {
          mux = `ffmpeg -y -i "${fuente.replace(/"/g, '\\"')}" -i "${audioClip.path.replace(/"/g, '\\"')}" ` +
            `-map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart "${escapedOut}"`;
        } else {
          mux = `ffmpeg -y -i "${fuente.replace(/"/g, '\\"')}" -c:v copy -an -movflags +faststart "${escapedOut}"`;
        }
        await new Promise<void>((res, rej) => exec(mux, { maxBuffer: 1024 * 1024 * 50 },
          (e) => e ? rej(e) : res()));

        // Limpieza SOLO si la pasada salio bien. Si se descarto, el base y los segmentos se
        // quedan a proposito: son la unica evidencia del fallo.
        if (r.ok) {
          try {
            if (await exists(r.segDir)) await fs.promises.rm(r.segDir, { recursive: true, force: true });
          } catch (e) {}
          try { await fs.promises.unlink(videoBase); } catch (e) {}
          try { await fs.promises.unlink(conGraficos); } catch (e) {}
          try { await fs.promises.rmdir(normDir); } catch (e) {}
        }
      }
    }

    event.sender.send('export-progress', { 
      step: 'done', 
      current: videoClipsOnly.length, 
      total: videoClipsOnly.length, 
      message: 'Exportacion completada' 
    });

    // LOS TIEMPOS DEL FICHERO QUE RECIBE EL USUARIO. La comprobacion del intermedio no basta:
    // el -shortest del mux es una decision POSTERIOR, y es justo lo que recorto el audio a
    // 201.7s cuando el video decia durar 286.
    // Aqui se AVISA y NO se descarta: el fichero ya esta escrito, y borrarlo dejaria al
    // usuario sin nada a cambio de nada. Lo que hace falta es que sepa que paso.
    // Sin objetivo —la rama de sincronia perfecta no pasa por P0— la comprobacion 2 no aplica,
    // pero la 1 y la 3 si: los pts monotonos y la coherencia interna del fichero no necesitan
    // saber cuanto se pedia.
    const tiemposFinal = framesObjetivo > 0
      ? await verificarTiempos(filePath, framesObjetivo, 30)
      : null;
    if (tiemposFinal) {
      await writeDebugLog(`[EXPORT] Comprobacion de tiempos del final: ${tiemposFinal.frames} ` +
        `frames leidos en ${tiemposFinal.ms} ms`);
    }
    if (tiemposFinal && !tiemposFinal.ok) {
      for (const f of tiemposFinal.fallos) await writeDebugLog(`[EXPORT] TIEMPOS DEL FINAL: ${f}`);
      avisoTiempos = `El vídeo se ha exportado, pero sus tiempos no cuadran: ` +
        `${tiemposFinal.fallos.join('; ')}. Revísalo antes de publicarlo.`;
    } else if (tiemposFinal) {
      await writeDebugLog(`[EXPORT] Tiempos del final OK: ${tiemposFinal.frames} frames, ` +
        `ultimo pts ${tiemposFinal.ultimo.toFixed(3)}s, duracion ` +
        `${tiemposFinal.duracion.toFixed(3)}s`);
    }

    const exportEnd = Date.now();
    const exportSeconds = ((exportEnd - exportStart) / 1000).toFixed(1);
    const fileStats = await fs.promises.stat(filePath);
    const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(1);
    await writeDebugLog(`[EXPORT] Completado en ${exportSeconds}s — archivo: ${fileSizeMB}MB — calidad: ${quality}`);

    return { success: true, filePath, avisoTiempos }
  } catch (err: any) {
    console.error(`[export-video] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

/**
 * EL CANAL DE AVISOS: propio, y no un campo mas en `generation-progress`.
 *
 * La barra de progreso es lo UNICO que el usuario mira durante media hora de generacion, y su
 * consumidor hace `setGenerationProgress` sobre un objeto unico. Meterle un discriminador para
 * poder avisar de fallos, y arriesgarse a romperla, seria ironico.
 *
 * NO LANZA NUNCA. Con la ventana cerrada, `send` sobre un webContents destruido revienta -- y un
 * aviso no puede tumbar el proceso. Se traga la excepcion, y el aviso NO se pierde en silencio
 * porque el log lo tiene igual.
 */
function enviarAviso(event: any, carga: unknown): void {
  try {
    const wc = event?.sender;
    if (wc && !wc.isDestroyed?.()) wc.send('generation-aviso', carga);
  } catch (e) { /* ventana cerrada: el log ya lo tiene */ }
}

ipcMain.handle('generate-timeline-assets', async (event, { scriptText, audioDuration, transcriptSegments, videoPath, weights, iaStyle, aspectRatio, graphicsPercent: _graphicsPercent, newAudioSegments }) => {
  const isOriginalAudio = transcriptSegments && newAudioSegments && 
    transcriptSegments.length === newAudioSegments.length &&
    transcriptSegments[0]?.start === newAudioSegments[0]?.start;

  // Fusionar segmentos cortos (<2.0s) para que los clips duren 2-3s
  // Se hace DESPUÉS de calcular isOriginalAudio y ANTES de usar los segmentos
  if (isOriginalAudio && newAudioSegments && Array.isArray(newAudioSegments) && newAudioSegments.length > 0) {
    const merged: any[] = [];
    let i = 0;
    while (i < newAudioSegments.length) {
      const seg = { ...newAudioSegments[i] };
      while (
        i + 1 < newAudioSegments.length &&
        (seg.end - seg.start) < 2.0
      ) {
        i++;
        seg.end = newAudioSegments[i].end;
        seg.text = (seg.text || '') + ' ' + (newAudioSegments[i].text || '');
      }
      merged.push(seg);
      i++;
    }
    if (merged.length < newAudioSegments.length) {
      console.log(`[MERGE] Segmentos: ${newAudioSegments.length} → ${merged.length}`);
    }
    newAudioSegments = merged;
  }

  // LOS AVISOS DE ESTA GENERACION. Se crean AQUI, o sea que se vacian al empezar cada una: un
  // aviso viejo colgado de una generacion previa miente igual que no avisar. Es el mismo
  // razonamiento que ya justifica `anunciarExclusion` en el renderer, y no se reinventa.
  const avisos = coleccionDeAvisos();
  // Ver el comentario de `decisiones = clipsDecision`: existe para que el resumen del `finally`
  // pueda contar aunque la generacion no llegue al final.
  let decisiones: any[] = [];
  let completa = false;

  /**
   * Anade un aviso y lo emite. SINCRONO a proposito: no espera al log.
   *
   * `writeDebugLog` es asincrono y va en cola -- medido: leyendo el log justo despues de un
   * lote se recogian 2 de 3 tiradas porque la ultima no habia bajado a disco. Si el aviso
   * esperara a esa cola, un log atascado se llevaria el aviso por delante, que es exactamente
   * el fallo que esta fase existe para impedir.
   *
   * SOLO EMITE CUANDO EL CODIGO ES NUEVO. Eso ES la agregacion: el mismo codigo 200 veces es
   * UNA linea con contador, no 200 mensajes. El contador definitivo viaja en el resumen final.
   */
  const avisar = (a: Omit<Aviso, 'veces'>): void => {
    if (avisos.anadir(a)) enviarAviso(event, { tipo: 'avisos', lista: avisos.lista() });
    writeDebugLog(`[AVISO] ${a.severidad} ${a.origen}/${a.codigo}: ${a.mensaje}` +
      (a.detalle ? ` | ${a.detalle}` : '')).catch(() => {});
  };

  const logMessage = async (msg: string) => {
    console.log(msg);
    await writeDebugLog(msg);
  };

  try {
    await logMessage(`[generate-timeline-assets] Iniciando... Guión a procesar: "${scriptText ? scriptText.substring(0, 60) + '...' : ''}"`);

    // FASE 1: Calcular clips necesarios
    let totalClips = 0;
    if (newAudioSegments && Array.isArray(newAudioSegments) && newAudioSegments.length > 0) {
      totalClips = newAudioSegments.length;
      await logMessage(`[FASE 1] Usando newAudioSegments con timestamps reales. Total clips: ${totalClips}`);
    } else {
      const errMsg = 'No se encontraron los segmentos de audio transcritos de ElevenLabs (newAudioSegments). Por favor, genera la voz primero.';
      await logMessage(`[FASE 1] Error: ${errMsg}`);
      return { success: false, error: errMsg };
    }

    if (!videoPath || !(await exists(videoPath))) {
      return { success: false, error: `No se encontró el video original: ${videoPath}` };
    }

    // FASE 2: DeepSeek → timestamps & tipos de clip
    await logMessage('[FASE 2] Solicitando timestamps y tipos de clip a DeepSeek...');
    loadEnv(true);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { success: false, error: 'No se configuró DEEPSEEK_API_KEY en el archivo .env' };

    // Asegurar que FAL_KEY y PEXELS_API_KEY estén en el entorno
    const falApiKey = process.env.FAL_KEY;
    if (falApiKey) {
      process.env.FAL_KEY = falApiKey;
    }
    let clipsDecision: any[] = [];

    event.sender.send('generation-progress', {
      index: 0, total: totalClips,
      paragraph: 'Consultando DeepSeek para seleccionar fragmentos e IA...',
      type: 'DeepSeek'
    });

    const maxTsVal = transcriptSegments?.length > 0
      ? (transcriptSegments[transcriptSegments.length - 1]?.end ?? audioDuration)
      : audioDuration;

    // Calcular cuántos sub-clips totales se requieren
    let totalVisualClipsCount = 0;
    if (newAudioSegments && Array.isArray(newAudioSegments)) {
      newAudioSegments.forEach((seg: any) => {
        const duration = seg.end - seg.start;
        totalVisualClipsCount += duration > 4.0 ? Math.ceil(duration / 3.0) : 1;
      });
    }

    // pesoIa se conserva porque TRES sitios preguntan `pesoIa > 0` para decidir si se respeta
    // un 'ia' que venga del modelo y si se le piden cuotas de IA en el prompt: eso es una
    // condicion sobre el PESO, no sobre el conteo. stockWeight desaparece: solo servia para la
    // aritmetica que ahora vive en repartoObjetivos.
    const pesoIa = weights ? (weights[2] ?? 0) : 0;

    // La aritmetica vive en shared/reparto.ts, en UNA funcion. Estaba duplicada aqui y en la
    // cuota de mas abajo, y añadir un origen en uno solo era el error facil de cometer y
    // dificil de ver: el reparto salia distinto segun el sitio y nada lo decia.
    const obj1 = repartoObjetivos(weights, totalVisualClipsCount);
    const targetIaClips = obj1.ia;
    const targetStockClips = obj1.stock;
    const targetVisualClips = obj1.visual;
    const targetOriginalClips = obj1.original;

    await logMessage(`[FASE 2] weights: original=${targetOriginalClips}, stock=${targetStockClips}, ` +
      `ia=${targetIaClips}, visual=${targetVisualClips}/${totalVisualClipsCount}`);

    let flattenedClips: any[] = [];

    let sanitizedPhrases: any[] = [];

    try {



      // Seis y no doce, por el TRUNCADO. El contrato actual devuelve conceptos de respaldo Y
      // semantica: doce frases agotaron `max_tokens: 8000` en una generacion real. Seis reduce
      // a la mitad el peor lote sin quitar ninguna capa ni convertir una respuesta truncada en
      // clips originales.
      //
      // Y un lote truncado NO se degrada: se pierde ENTERO. El propio codigo lo dice mas abajo:
      // "AVISO: respuesta truncada (finish_reason=length). El lote se perdera y esas frases
      // caeran a original". Con 25 se perderian 25 frases de golpe; con seis, seis.
      // El precio es mas llamadas, que a este tamaño es ruido frente a perder un lote.
      const BATCH_SIZE = 6;
      let phrasesDecision: any[] = [];
      let respuestasSemanticasRechazadas = 0;
      const causasSemantica = new Map<string, number>();

      for (let batchStart = 0; batchStart < newAudioSegments.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, newAudioSegments.length);
        const batchSegs = newAudioSegments.slice(batchStart, batchEnd);
        
        const batchFragmentos = batchSegs.map((seg: any, idx: number) => {
          const phraseNum = batchStart + idx + 1;
          const duration = seg.end - seg.start;
          const count = duration > 4.0 ? Math.ceil(duration / 3.0) : 1;
          return '[Frase ' + phraseNum + '] \"' + seg.text + '\" (' + 
            Number(seg.start).toFixed(1) + 's - ' + Number(seg.end).toFixed(1) + 
            's, duración: ' + duration.toFixed(2) + 's). Requiere exactamente ' + 
            count + ' sub-clip(s) visual(es) de aprox ' + 
            (duration / count).toFixed(2) + 's cada uno.';
        }).join('\n');

        const batchVisualCount = batchSegs.reduce((acc: number, seg: any) => {
          const duration = seg.end - seg.start;
          return acc + (duration > 4.0 ? Math.ceil(duration / 3.0) : 1);
        }, 0);
        
        // Ya no se piden cuotas de tipo: los tipos se asignan en codigo, por posicion, para
        // garantizar los conteos y el intercalado. Pedirlas aqui era lo que limitaba el
        // reparto: DeepSeek solo daba keyword a los que el marcaba como stock (66% de los
        // clips), y el 34% restante quedaba como original forzado, creando rachas de hasta
        // 16 clips seguidos que ningun algoritmo podia romper.
        // La unica excepcion es la IA: generar un clip de IA cuesta dinero y no se puede
        // inventar desde el codigo, asi que su cuota se sigue pidiendo, pero solo cuando el
        // usuario la ha pedido de verdad.
        const batchIa = pesoIa > 0
          ? Math.round((targetIaClips / totalVisualClipsCount) * batchVisualCount)
          : 0;
        const lineaTipos = pesoIa > 0
          ? 'De ' + batchVisualCount + ' sub-clips marca exactamente ' + batchIa +
            ' con "type":"ia" y dales ademas un prompt descriptivo en ingles. El resto NO lleva campo type.\n'
          : 'NO asignes tipos de clip. Eso se decide despues; tu unica tarea es describir cada sub-clip.\n';

        // LOS CONCEPTOS son para los Visuales, y se piden AQUI y no en una segunda llamada por
        // dos razones. La barata: ahorrar la segunda llamada son ~2400 tokens, menos de una
        // milesima de dolar, a cambio de otro punto de fallo y ~14 s de espera por lote. La que
        // de verdad decide: aqui DeepSeek tiene delante el keyword que acaba de escribir para
        // ese mismo trozo, asi que los conceptos salen coherentes con el. Pedidos aparte serian
        // a ciegas.
        //
        // Se piden para TODOS los sub-clips aunque solo los Visuales los usen —hoy el 32%—
        // porque cuando esta llamada ocurre la cuota TODAVIA no ha decidido quien es Visual:
        // los tipos se asignan despues, en codigo. Se tira el 68% a proposito.
        // ── LA LINEA DE LOS CONCEPTOS, reescrita con dos medidas delante ──────────────
        //
        // (a) "Nunca banderas ni caras" NO FUNCIONABA: 18 de 243 conceptos (7.4%) las traian
        //     igual. Era una prohibicion en negativo, corta y enterrada al final de una linea
        //     que ya decia otras tres cosas. Se sustituye por una regla EN POSITIVO -- que sea
        //     un objeto fotografiable -- con la lista de lo excluido aparte y con la salida
        //     por defecto dicha ("si dudas, un objeto"), que es lo que evita que el modelo
        //     resuelva la duda inventando.
        //
        //     Y no es cosmetico: las banderas salen TOFU. Medido, la 🇷🇺 se pinta como las
        //     letras "RU" en gris, porque Windows no trae glifos de bandera. No se puede
        //     arreglar en el render -- cambiar el glifo moveria los pixeles bajo el MISMO
        //     hash-- asi que el unico sitio donde se arregla es aqui. Ver 10 quinquies y
        //     10 octies de docs/AUDITORIA.md.
        //
        // (b) CON FRASES DE IDEA devolvia ideas: "crisis", "union", "problema", "confusion".
        //     El patron esta medido: con frases de escena acierta -- estadio, protesta,
        //     bufanda -- y con frases abstractas no tiene de donde agarrar. La instruccion
        //     nueva no le pide que evite lo abstracto otra vez; le da un METODO: mirar la
        //     escena de la que habla la frase y sacar de ahi lo que se veria en pantalla.
        //
        // EL EJEMPLO ANCLA, y se acepta a sabiendas. En el prompt de graficos, el unico
        // ejemplo del FORMATO hizo que `decorativo_emoji` saliera el 78.8% de las veces. Aqui
        // el ejemplo es de METODO y no de FORMATO, y va con tres objetos distintos para no
        // sugerir uno; aun asi, si la proxima generacion trae calendarios y maletas de mas,
        // la causa es esta linea.
        // Se derivan en cada llamada del registro real. El modelo recibe enums, no los nombres
        // ni descripciones internas de las estructuras: decide significado, el motor decide forma.
        const relacionesPrompt = Object.keys(catalogoRelaciones()).sort().join(', ');
        const lineaConceptos =
          // `conceptos` es el contrato historico que mantiene el video util si la capa
          // semantica completa se rechaza. No se deriva de `semantica`: una relacion
          // invalida no puede convertir un lote entero en clips sin Visual.
          '- conceptos: EXACTAMENTE 3 objetos {icono:"nombre Solar de la lista permitida", ic:"emoji respaldo", etiqueta:"1-2 palabras"}. Son el respaldo compatible con el motor anterior.\n' +
          '- semantica: UNA relacion y EXACTAMENTE 3 terminos de una misma idea visual.\n' +
          '    relacion: usa exactamente uno de estos enums: ' + relacionesPrompt + '.\n' +
          '    ancla: {icono:"nombre Solar de la lista permitida", ic:"emoji respaldo", etiqueta:"1-2 palabras"}.\n' +
          '    terminos: EXACTAMENTE 3 objetos {icono:"nombre Solar de la lista permitida", ic:"emoji respaldo", etiqueta:"1-2 palabras"}.\n' +
          '  icono DEBE ser exactamente uno de estos nombres Solar reales: ' + NOMBRES_SOLAR_CURADOS.join(', ') + '.\n' +
          '  Si ninguno representa el objeto sin forzarlo, usa icono:"" y deja que ic sea el respaldo.\n' +
          '  Los tres terminos deben expresar LA RELACION, no ser tres ideas independientes.\n' +
          '  Dos terminos iguales solo se permiten si la relacion los compara o encaja.\n' +
          '  Si el trozo no tiene sujeto ilustrable ni relacion visual, devuelve semantica:null.\n';

        const batchPrompt = 'Eres un editor de video experto.\n' +
          'Para cada frase decide como ilustrarla visualmente. Si dura mas de 4.0s divide en 2-3 sub-clips (maximo 3.0s cada uno).\n' +
          'Para CADA sub-clip da SIEMPRE estos tres campos:\n' +
          '- keyword: en ingles, corta y concreta, algo filmable que ilustre ESE trozo. Nunca abstracta: evita palabras como "consequences", "awareness" o "meaning".\n' +
          '- timestamp: el segundo del video original (0-' + Number(maxTsVal).toFixed(1) + ') que mejor acompana ese trozo.\n' +
          lineaConceptos +
          lineaTipos +
          'FRASES:\n' + batchFragmentos + '\n' +
          'Responde SOLO JSON:\n' +
          // EL FORMATO VA SIN EMOJIS CONCRETOS, y no es un descuido de redaccion. El unico
          // ejemplo del FORMATO del prompt de graficos es `decorativo_emoji`, y es la causa
          // MEDIDA de que ese tipo salga el 78.8% de las veces sobre 250 graficos reales: el
          // modelo copia el ejemplo. Poner aqui tres emojis concretos los anclaria igual.
          // Se describe la forma con marcadores y se deja que el modelo elija el contenido.
          '{"phrases":[{"phraseIndex":' + (batchStart+1) + ',"visualClips":[{"keyword":"protest march","timestamp":12.3,"duration":2.5,' +
          '"conceptos":[{"icono":"megaphone","ic":"📣","etiqueta":"voz"},{"icono":"people-nearby","ic":"👥","etiqueta":"marcha"},{"icono":"flag","ic":"🚩","etiqueta":"plaza"}],' +
          '"semantica":{"relacion":"conecta","ancla":{"icono":"megaphone","ic":"📣","etiqueta":"voz"},' +
          '"terminos":[{"icono":"megaphone","ic":"📣","etiqueta":"voz"},{"icono":"people-nearby","ic":"👥","etiqueta":"marcha"},{"icono":"flag","ic":"🚩","etiqueta":"plaza"}]}}]}]}';

        try {
          await logMessage('[FASE 2] Lote ' + Math.ceil((batchStart+1)/BATCH_SIZE) + 
            ' frases ' + (batchStart+1) + '-' + batchEnd);
          const dsResp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'deepseek-v4-pro',
              messages: [
                { role: 'system', content: 'Responde UNICAMENTE con JSON valido.' },
                { role: 'user', content: batchPrompt }
              ],
              temperature: 0.2,
              max_tokens: 8000,
              thinking: { type: 'disabled' }
            })
          });
          if (dsResp.ok) {
            const dsData = (await dsResp.json()) as any;
            const finishReason = dsData?.choices?.[0]?.finish_reason;
            if (finishReason === 'length') {
              await logMessage(`[FASE 2] AVISO: respuesta truncada (finish_reason=length). El lote se perdera y esas frases caeran a original.`);
            }
            let content = (dsData?.choices?.[0]?.message?.content || '').trim();
            if (content.includes('{')) {
              content = content.substring(content.indexOf('{'), content.lastIndexOf('}')+1);
            }
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.phrases)) {
              const candidatas = parsed.phrases.flatMap((p: any) => p?.visualClips ?? p?.clips ?? []);
              // Una respuesta semantica es atomica: no se mezcla media capa nueva con media
              // capa vieja. Si una relacion/forma no valida, se descarta ESA capa completa;
              // keywords y cuotas siguen vivos y el motor vuelve a direccionDe determinista.
              const invalida = candidatas.find((c: any) => c?.semantica !== null && !sanearSemanticaVisual(c?.semantica));
              if (invalida) {
                respuestasSemanticasRechazadas++;
                const causa = !invalida?.semantica ? 'sin-semantica' : 'semantica-invalida';
                causasSemantica.set(causa, (causasSemantica.get(causa) ?? 0) + 1);
                for (const frase of parsed.phrases) {
                  for (const clip of frase?.visualClips ?? frase?.clips ?? []) delete clip.semantica;
                }
                await logMessage(`[FASE 2] SEMANTICA RECHAZADA lote=${Math.ceil((batchStart + 1) / BATCH_SIZE)} causa=${causa}; se usa sorteo determinista.`);
              }
              phrasesDecision.push(...parsed.phrases);
            }
          } else {
            const errBody = await dsResp.text().catch(() => '');
            await logMessage(`[FASE 2] DeepSeek HTTP ${dsResp.status}: ${errBody.slice(0, 300)}`);
            // EL 402 DEL 25/8 TENIA QUE HABERSE VISTO A LA PRIMERA. El log lo dijo cinco veces
            // y nadie lo vio: `logMessage` solo escribe a disco. El codigo lleva el HTTP dentro
            // para que 402 -- saldo -- y 401 -- clave rechazada -- no se confundan: son dos
            // problemas con dos arreglos distintos.
            avisar({
              severidad: 'error',
              codigo: `http-${dsResp.status}`,
              origen: 'deepseek',
              mensaje: dsResp.status === 402
                ? 'DeepSeek rechazó la petición por saldo agotado. Sin él no hay palabras clave, así que los clips de stock y los Visuales se rellenan con el vídeo original.'
                : `DeepSeek respondió con error ${dsResp.status}. Los clips de stock y los Visuales se rellenan con el vídeo original.`,
              detalle: errBody.slice(0, 200)
            });
          }
        } catch (err: any) {
          await logMessage('[FASE 2] Error lote: ' + err.message);
        }
      }

      // Gráficos se generan por separado con Regenerar Gráficos
      if (respuestasSemanticasRechazadas) {
        await logMessage(`[FASE 2] SEMANTICA: ${respuestasSemanticasRechazadas} respuestas rechazadas | ` +
          Array.from(causasSemantica, ([causa, n]) => `${causa}=${n}`).join(' | '));
      }

      // ── OBSERVABILIDAD DE LOS CONCEPTOS ────────────────────────────────────────────
      //
      // SOLO MIRA Y ESCRIBE. No toca `extra`, ni la clave del hash, ni sanearConceptos, ni
      // VERSION_PLANTILLAS: si tocara cualquiera de esas cosas la cache se invalidaria y los
      // Visuales se re-renderizarian para nada.
      //
      // Existe porque una auditoria real no pudo medir los conceptos: llegan bien —15 de 15
      // Visuales los llevaban, verificado por fuerza bruta contra el hash— pero NO son
      // observables. Viajan de DeepSeek a graphicData.extra y de ahi a los pixeles, sin pasar
      // por el project-state.json ni por el log. Y el hash no es reversible, asi que no hay
      // forma de saber CUALES son ni por que alguno salio null.
      //
      // SE REGISTRAN LOS DOS LADOS DEL SANEO. Un log solo del resultado no distingue "el campo
      // no vino" de "vinieron dos y la regla los anulo", y las dos se arreglan distinto: la
      // primera es que el prompt no se entendio, la segunda que se entendio y no cumplio.
      const cLineas: string[] = [];
      let cTotal = 0, cOK = 0, cSinCampo = 0, cInsuficiente = 0;
      let iconosSolarPedidos = 0, iconosSolarResueltos = 0, iconosSolarRespaldo = 0;

      // Pinta un concepto sin fiarse de el. El objeto viene del modelo y puede traer getters
      // hostiles — ya paso con sanearConceptos, que lanzaba hasta que se envolvio la LECTURA.
      const pintaConcepto = (x: any): string => {
        try {
          const e = String(x?.emoji ?? '?').slice(0, 8);
          const t = String(x?.etiqueta ?? '?').slice(0, 24);
          return e + ' ' + t;
        } catch (err) { return '(ilegible)'; }
      };

      // Procesar y sanitizar con phrasesDecision
      for (let idx = 0; idx < newAudioSegments.length; idx++) {
        const seg = newAudioSegments[idx];
        const nextSegStart = newAudioSegments[idx + 1]?.start;
        const phraseDuration = (typeof nextSegStart === 'number' && nextSegStart > seg.start)
          ? (nextSegStart - seg.start)
          : (seg.end - seg.start);
        const numClipsExpected = phraseDuration > 4.0 ? Math.ceil(phraseDuration / 3.0) : 1;
        
        const matchClips = phrasesDecision.find((p: any) => p && (p.phraseIndex === idx + 1 || p.index === idx + 1));

        let visualClips = matchClips?.visualClips || matchClips?.clips;
        if (!Array.isArray(visualClips) || visualClips.length === 0) {
          visualClips = [];
          for (let c = 0; c < numClipsExpected; c++) {
            visualClips.push({
              type: 'original',
              timestamp: parseFloat((newAudioSegments[idx]?.start ?? ((idx / newAudioSegments.length) * maxTsVal)).toFixed(1)),
              keyword: 'broll',
              prompt: 'cinematic video clip',
              duration: phraseDuration / numClipsExpected
            });
          }
        }

        if (visualClips.length !== numClipsExpected) {
          if (visualClips.length < numClipsExpected) {
            while (visualClips.length < numClipsExpected) {
              visualClips.push({
                type: 'original',
                timestamp: parseFloat((newAudioSegments[idx]?.start ?? ((idx / newAudioSegments.length) * maxTsVal)).toFixed(1)),
                keyword: 'broll',
                prompt: 'cinematic video clip',
                duration: phraseDuration / numClipsExpected
              });
            }
          } else {
            visualClips = visualClips.slice(0, numClipsExpected);
          }
        }

        visualClips = visualClips.map((c: any, ci: number) => {
          const type = ['original', 'stock', 'ia'].includes(c.type) ? c.type : 'original';
          const effectiveTimestamp = (isOriginalAudio && type === 'original' && newAudioSegments[idx]?.start !== undefined)
            ? newAudioSegments[idx].start
            : (c.timestamp ?? parseFloat(((idx / newAudioSegments.length) * maxTsVal).toFixed(1)));

          // EL LOG DE LOS CONCEPTOS. Va ANTES del return y no altera nada de lo que se devuelve.
          // El try envuelve TODO —incluida la lectura de `c.conceptos`, que puede ejecutar un
          // getter— porque una excepcion aqui mataria FASE 2 entera: 78 sub-clips perdidos por
          // una linea de log seria un intercambio absurdo.
          const sinIlustracion = c.semantica === null;
          const semantica = sinIlustracion ? null : sanearSemanticaVisual(c.semantica);
          // Una capa semantica valida proyecta los mismos conceptos que ve escena. Si no viene
          // o fue rechazada, conserva el contrato historico para que el video siga generando.
          const saneados = semantica?.terminos ?? sanearConceptos(c.conceptos);
          // La traza cubre tanto la semántica nueva como el contrato histórico: si solo se
          // midiera la primera, un fallback de conceptos podría volver a inventar nombres sin
          // dejar evidencia de la petición ni del emoji usado.
          const iconosTrazables = semantica ? [semantica.ancla, ...semantica.terminos] : (saneados ?? []);
          for (const [indiceIcono, icono] of iconosTrazables.entries()) {
            iconosSolarPedidos++;
            const esAncla = Boolean(semantica) && indiceIcono === 0;
            const estilo = esAncla ? 'bold-duotone' : 'linear';
            const resolucion = resolverSolarDetallado(icono.icono, estilo);
            if (resolucion.resultado) {
              iconosSolarResueltos++;
            } else {
              iconosSolarRespaldo++;
            }
            cLineas.push(`[FASE 2] SOLAR pos=${idx}:${ci} papel=${esAncla ? 'ancla' : semantica ? 'termino' : 'concepto-respaldo'} ` +
              `solicitado=${JSON.stringify(resolucion.solicitado)} canonico=${JSON.stringify(resolucion.candidatoCanonico)} ` +
              `candidatos=${JSON.stringify(resolucion.candidatos)} decision=${resolucion.resultado ?? 'emoji'} ` +
              `motivo=${resolucion.motivo}`);
          }
          try {
            cTotal++;
            let crudo: any;
            try { crudo = c.conceptos; } catch (err) { crudo = undefined; }
            const esArray = Array.isArray(crudo);
            const nCrudo = esArray ? crudo.length : -1;    // -1 = el campo no vino como array
            if (saneados) cOK++;
            else if (!esArray) cSinCampo++;                // causa (a): no vino el campo
            else cInsuficiente++;                          // causa (b): vino con <3 validos
            // Con NULL se imprime lo CRUDO igualmente, aunque sean dos o esten malformados: es
            // el unico modo de ver POR QUE se anulo. Omitir la linea dejaria el mismo agujero
            // que se esta cerrando.
            const lista = saneados || (esArray ? crudo : []);
            const pintados = lista.length
              ? lista.map(pintaConcepto).join(' | ')
              : '(sin conceptos)';
            const frase = String(seg?.text ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
            // EL LOTE, derivado del indice de frase con el MISMO BATCH_SIZE que uso el bucle de
            // las llamadas. Va aqui porque en la auditoria no se pudo sacar el keyword propio
            // POR LOTE: el log solo emitia el agregado `73/78`, y un lote perdido entero se
            // disuelve en ese promedio y parece degradacion suave. Con `lote=` y `kw=` en la
            // misma linea, ese desglose queda derivable del log sin tocar nada mas.
            const lote = Math.floor(idx / BATCH_SIZE) + 1;
            cLineas.push(
              `[FASE 2] CONCEPTOS lote=${lote} pos=${idx}:${ci} ` +
              `kw=${String(c.keyword ?? 'broll').slice(0, 28)} ` +
              `crudo=${semantica ? 'SEMANTICA' : (nCrudo < 0 ? 'SIN-CAMPO' : nCrudo)} saneado=${saneados ? 'OK' : 'NULL'}  ` +
              `${pintados}  frase="${frase}"`);
          } catch (err) { /* el log jamas puede tumbar FASE 2 */ }

          return {
            type,
            timestamp: effectiveTimestamp,
            keyword: c.keyword || 'broll',
            prompt: c.prompt || 'cinematic video clip',
            duration: parseFloat((c.duration || (phraseDuration / numClipsExpected)).toFixed(2)),
            // AÑADIDO A MANO, y tiene que estarlo: este `map` PROYECTA, no copia. Lo que no se
            // nombre aqui, DeepSeek lo devuelve y el codigo lo tira sin error y sin log — el
            // mismo "lo que no se añade a mano queda fuera por construccion" del hash, que alli
            // protege y aqui jugaria en contra.
            //
            // Se reutiliza `saneados`, calculado arriba para el log. Es la MISMA llamada, no una
            // segunda: sanearConceptos es puro, pero llamarlo dos veces pondria la duda de si el
            // log describe lo que de verdad se guarda.
            conceptos: saneados,
            relacion: semantica?.relacion ?? null,
            ancla: semantica?.ancla ?? null,
            sinVisual: sinIlustracion
          };
        });

        // Ajustar duraciones proporcionalmente para que sumen la duración exacta de la frase
        const sumProposed = visualClips.reduce((acc: number, c: any) => acc + (c.duration || 0), 0);
        if (sumProposed <= 0.05 || visualClips.some((c: any) => c.duration <= 0.05)) {
          let runningSum = 0;
          for (let i = 0; i < visualClips.length; i++) {
            if (i === visualClips.length - 1) {
              visualClips[i].duration = parseFloat((phraseDuration - runningSum).toFixed(2));
            } else {
              const val = parseFloat((phraseDuration / visualClips.length).toFixed(2));
              visualClips[i].duration = val;
              runningSum += val;
            }
          }
        } else {
          let runningSum = 0;
          for (let i = 0; i < visualClips.length; i++) {
            if (i === visualClips.length - 1) {
              visualClips[i].duration = parseFloat((phraseDuration - runningSum).toFixed(2));
            } else {
              const scaled = (visualClips[i].duration / sumProposed) * phraseDuration;
              visualClips[i].duration = parseFloat(scaled.toFixed(2));
              runningSum += visualClips[i].duration;
            }
          }
        }

        // NUNCA HUBO GRAFICO POR ESTA VIA, y el codigo fingia que si. `graphicsDecision` se
        // declaraba vacio y nadie le hacia push ni se lo reasignaba, o sea que su `.find`
        // devolvia `undefined` SIEMPRE: las 35 lineas que saneaban `graphicStart`, recortaban
        // a 2 segundos y montaban el objeto no se ejecutaron una sola vez. Peor que inutiles:
        // se leian como si el camino existiera, y buscar por que "no salen los graficos"
        // llevaba derecho a un saneo impecable de un valor que no llegaba nunca.
        //
        // Los graficos de verdad salen por `regenerate-graphics`, que parsea su propia
        // respuesta de DeepSeek: ese camino esta vivo y no se toca. Y los Visuales son otra
        // cosa distinta, con su composicion y su hash.
        const graphic = null;

        sanitizedPhrases.push({
          phraseIndex: idx + 1,
          visualClips,
          graphic
        });
      }

      // VOLCADO. Se acumula en el bucle y se escribe aqui porque `map` no es async: hacerlo
      // async por una linea de log obligaria a convertir el bucle entero en secuencial.
      try {
        for (const l of cLineas) await logMessage(l);
        await logMessage(
          `[FASE 2] CONCEPTOS: ${cTotal} sub-clips | ${cOK} con 3 validos | ` +
          `${cSinCampo} NULL causa (a): no vino contenido util | ` +
          `${cInsuficiente} NULL causa (b): venia con <3 validos tras saneo`);
        await logMessage(`[FASE 2] ICONOS SOLAR: ${iconosSolarResueltos}/${iconosSolarPedidos} resueltos | ` +
          `${iconosSolarRespaldo} al emoji de respaldo.`);
        // LAS CASILLAS TIENEN QUE CUADRAR. Hoy cuadran por construccion —el if/else de arriba
        // incrementa exactamente un contador en cada camino— pero eso es una propiedad del
        // codigo actual, no una garantia. El dia que alguien añada una cuarta categoria y
        // olvide contarla, ese caso desapareceria sin ruido: ni en OK, ni en (a), ni en (b),
        // y el resumen seguiria pareciendo correcto porque nadie suma las casillas.
        // Es el mismo modo de fallo que persigue toda la seccion 7.4 de la auditoria.
        const suma = cOK + cSinCampo + cInsuficiente;
        if (suma !== cTotal) {
          await logMessage(`[FASE 2] CONCEPTOS DESCUADRE: ${cTotal} vs ${suma}`);
        }
      } catch (err) { /* ni el volcado puede tumbar FASE 2 */ }
    } catch (e: any) {
      await logMessage(`[FASE 2] DeepSeek error: ${e.message}. Usando fallback.`);
    }

    if (sanitizedPhrases.length === 0) {
      for (let idx = 0; idx < newAudioSegments.length; idx++) {
        const seg = newAudioSegments[idx];
        const phraseDuration = seg.end - seg.start;
        const numClipsExpected = phraseDuration > 4.0 ? Math.ceil(phraseDuration / 3.0) : 1;
        const visualClips: any[] = [];
        let runningSum = 0;
        for (let c = 0; c < numClipsExpected; c++) {
          let dur = 0;
          if (c === numClipsExpected - 1) {
            dur = parseFloat((phraseDuration - runningSum).toFixed(2));
          } else {
            dur = parseFloat((phraseDuration / numClipsExpected).toFixed(2));
            runningSum += dur;
          }
          visualClips.push({
            type: 'original',
            timestamp: parseFloat((newAudioSegments[idx]?.start ?? ((idx / newAudioSegments.length) * maxTsVal)).toFixed(1)),
            keyword: 'broll',
            prompt: 'cinematic video clip',
            duration: dur
          });
        }
        sanitizedPhrases.push({
          phraseIndex: idx + 1,
          visualClips,
          graphic: null
        });
      }
      await logMessage(`[FASE 2] Fallback: ${newAudioSegments.length} frases procesadas uniformemente.`);
    }

    // Filtro anti-repetición y relleno uniforme a nivel de frases
    let consecutiveType = '';
    let consecutiveCount = 0;
    for (let i = 0; i < sanitizedPhrases.length; i++) {
      const g = sanitizedPhrases[i].graphic;
      if (g && g.type) {
        if (g.type === consecutiveType) {
          consecutiveCount++;
          if (consecutiveCount >= 3) {
            g.type = 'decorativo_emoji';
            g.value = g.emoji || '📊';
            consecutiveType = 'decorativo_emoji';
            consecutiveCount = 1;
          }
        } else {
          consecutiveType = g.type;
          consecutiveCount = 1;
        }
      } else {
        consecutiveType = '';
        consecutiveCount = 0;
      }
    }



    // ═══ CUOTA Y REPARTO: conteos exactos + distribucion uniforme ═══
    // Dos garantias, en este orden de prioridad:
    //  1. Contenido valido: solo se pone 'stock' donde hay keyword propio de esa frase.
    //     Sin keyword la busqueda seria generica ('broll') y el clip no ilustraria nada.
    //     'original' se puede poner en cualquier sitio: solo necesita timestamp, y la
    //     pasada de escalonado que corre justo despues lo deja correcto.
    //  2. Conteos de los sliders y reparto uniforme, dentro de lo que permita el punto 1.
    // Medido: v4-pro desvia la cuota de forma erratica (+17, +12, +1, +19 en 4 runs) y
    // amontona (una racha de 28 clips 'original', 70s sin un solo plano de stock, mientras
    // las rachas de stock no pasaban de 4).
    // Un intento previo de pedirlo en el prompt colapso el reparto a 76 stock / 0 original:
    // el prompt es sensible y la correccion tiene que ser determinista, en codigo.
    const cuotaLista: { phraseIdx: number; clip: any }[] = [];
    for (let p = 0; p < sanitizedPhrases.length; p++) {
      for (const c of sanitizedPhrases[p].visualClips) cuotaLista.push({ phraseIdx: p, clip: c });
    }
    const totalReal = cuotaLista.length;

    if (totalReal > 0) {
      // Objetivos directos desde los pesos contra el total REAL de sub-clips. No se
      // reescalan los target* previos: si totalVisualClipsCount fuese 0 daria NaN.
      // Misma normalizacion que L1767-1772, que garantiza objOriginal >= 0.
      const obj2 = repartoObjetivos(weights, totalReal);
      const objIa = obj2.ia;
      const objStock = obj2.stock;
      const objVisual = obj2.visual;
      const objOriginal = obj2.original;

      const antesStock = cuotaLista.filter(x => x.clip.type === 'stock').length;
      const antesOriginal = cuotaLista.filter(x => x.clip.type === 'original').length;

      // Los 'ia' no se tocan: generarlos cuesta dinero y no se pueden inventar. Pero un 'ia'
      // entrante solo se respeta si el usuario pidio IA de verdad: ahora que el prompt ya no
      // fija cuotas de tipo, un 'ia' espontaneo del modelo dispararia llamadas de pago a
      // fal.ai que nadie solicito.
      const respetarIa = pesoIa > 0;
      const reasignables: number[] = [];
      for (let j = 0; j < totalReal; j++) {
        const t = cuotaLista[j].clip.type;
        if (t === 'stock' || t === 'original' || (t === 'ia' && !respetarIa)) reasignables.push(j);
      }
      const conKeyword = reasignables.filter(
        j => cuotaLista[j].clip.keyword && cuotaLista[j].clip.keyword !== 'broll'
      );

      const objStockReal = Math.min(objStock, reasignables.length);
      const cuantosStock = Math.min(objStockReal, conKeyword.length);
      const sinKeyword = objStockReal - cuantosStock;

      // Colocacion optima: en vez de repartir uniformemente sobre la lista de clips con
      // keyword (que amontona si los keywords estan agrupados), se eligen las posiciones
      // que MINIMIZAN la racha maxima de stock. Los clips sin keyword son originales
      // forzados y parten la secuencia en tramos; los cortes van dentro de cada tramo.
      const cortesDisp = conKeyword.length - cuantosStock;
      const esCandidato = new Set(conKeyword);

      // Tramos maximales de candidatos consecutivos (indices dentro de reasignables)
      const tramos: { ini: number; len: number }[] = [];
      let t = 0;
      while (t < reasignables.length) {
        if (!esCandidato.has(reasignables[t])) { t++; continue; }
        const ini = t;
        while (t < reasignables.length && esCandidato.has(reasignables[t])) t++;
        tramos.push({ ini, len: t - ini });
      }

      // Cortes minimos para que un tramo de longitud L no deje rachas mayores que r:
      //   L - f <= r*(f+1)   ->   f >= (L - r)/(r + 1)
      const cortesPara = (L: number, r: number) => Math.max(0, Math.ceil((L - r) / (r + 1)));
      const cabe = (r: number) => tramos.reduce((s, x) => s + cortesPara(x.len, r), 0) <= cortesDisp;

      // Busqueda binaria de la racha minima alcanzable con los cortes disponibles. O(n log n).
      const maxTramo = tramos.reduce((m, x) => Math.max(m, x.len), 0);
      let lo = 1, hi = Math.max(1, maxTramo);
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (cabe(mid)) hi = mid; else lo = mid + 1;
      }
      const rachaAlcanzada = cuantosStock > 0 ? lo : 0;
      // Minimo teorico si TODOS los clips tuvieran keyword: el ratio puro (67/33 -> 2).
      const nOriginal = reasignables.length - cuantosStock;
      const rachaIdeal = (cuantosStock > 0 && nOriginal > 0)
        ? Math.max(1, Math.ceil(cuantosStock / nOriginal)) : cuantosStock;

      // Reparto por tramo: el minimo para alcanzar r, y los sobrantes al tramo que peor
      // este en cada momento. Hay que gastarlos todos: los conteos son exactos.
      const alloc = tramos.map(x => Math.min(x.len, cortesPara(x.len, rachaAlcanzada)));
      let sobran = cortesDisp - alloc.reduce((s, a) => s + a, 0);
      while (sobran > 0) {
        let peor = -1, peorVal = -1;
        for (let i = 0; i < tramos.length; i++) {
          if (alloc[i] >= tramos[i].len) continue;
          const val = Math.ceil((tramos[i].len - alloc[i]) / (alloc[i] + 1));
          if (val > peorVal) { peorVal = val; peor = i; }
        }
        if (peor < 0) break;
        alloc[peor]++; sobran--;
      }

      // Todos los candidatos son stock salvo los cortes, repartidos dentro de su tramo.
      // Los offsets son estrictamente crecientes, asi que no se borra dos veces el mismo
      // clip y el conteo se mantiene exacto.
      const elegidos = new Set<number>(cuantosStock > 0 ? conKeyword : []);
      if (cuantosStock > 0) {
        for (let i = 0; i < tramos.length; i++) {
          const { ini, len } = tramos[i];
          const f = alloc[i];
          for (let j = 0; j < f; j++) {
            const off = Math.min(len - 1, Math.floor(((j + 1) * len) / (f + 1)));
            elegidos.delete(reasignables[ini + off]);
          }
        }
      }

      for (const j of reasignables) {
        cuotaLista[j].clip.type = elegidos.has(j) ? 'stock' : 'original';
      }

      // LOS VISUALES SE SACAN DE LOS 'original', no de los 'stock', y a proposito: el reparto
      // de rachas de arriba coloco el stock donde minimiza la racha maxima, y robarle de ahi
      // desharia ese trabajo. Los 'original' no tienen esa restriccion —solo necesitan un
      // timestamp— asi que ceder algunos no rompe nada.
      // Se eligen REPARTIDOS de punta a punta con la misma formula que las transiciones
      // ((k+0.5)*total/cantidad), no los primeros: amontonarlos al principio dejaria la
      // segunda mitad del video sin un solo Visual.
      if (objVisual > 0) {
        // La IA puede declarar `semantica:null`: no se fuerza un Visual decorativo sobre un
        // conector. Ese slot sigue siendo original, que es el respaldo correcto del producto.
        const originales = reasignables.filter(j =>
          cuotaLista[j].clip.type === 'original' && !cuotaLista[j].clip.sinVisual);
        const cuantos = Math.min(objVisual, originales.length);
        for (let k = 0; k < cuantos; k++) {
          const pos = Math.min(originales.length - 1,
            Math.floor(((k + 0.5) * originales.length) / cuantos));
          cuotaLista[originales[pos]].clip.type = 'visual';
        }
        if (cuantos < objVisual) {
          await logMessage(`[FASE 2] Visuales: se pidieron ${objVisual} pero solo habia ` +
            `${originales.length} slots de 'original' que ceder. Se hacen ${cuantos}.`);
        }
      }

      // ── LOS SLOTS DE STOCK QUE SE DEGRADARON, ANOTADOS ── Y VA AQUI, NO ARRIBA.
      //
      // No pasan por ninguno de los cinco puntos de respaldo: caen ANTES, en el reparto, porque
      // sin keyword propio una busqueda de stock seria generica y no ilustraria nada. Sin esta
      // anotacion el resumen decia 'stock: se pidieron 11 y salieron 0' con el desglose VACIO --
      // enseñaba el sintoma y escondia la causa, que es la principal del 25/8.
      //
      // ANOTARLO ANTES DE ESTE BLOQUE ERA UN ERROR, y lo cazo la prueba de aceptacion: la
      // asignacion de Visuales de arriba PROMUEVE clips que estan en 'original', asi que tres de
      // los marcados como 'stock caido' acababan siendo Visuales de verdad. Contaban como
      // respaldo sin serlo, y el resumen decia 'Visual: se pidieron 18 y salieron 15' sin que
      // hubiera caido ningun Visual. Se anota DESPUES y solo sobre los que siguen en 'original':
      // esos si se quedaron sin ser nada de lo que se pidio.
      if (sinKeyword > 0) {
        const conKw = new Set(conKeyword);
        const degradados = reasignables
          .filter(j => !conKw.has(j) && cuotaLista[j].clip.type === 'original')
          .slice(0, sinKeyword);
        for (const j of degradados) {
          const c = cuotaLista[j].clip as any;
          c.origenPedido ??= 'stock';
          c.motivoRespaldo ??= 'stock-sin-keyword';
        }
      }

      const finStock = cuotaLista.filter(x => x.clip.type === 'stock').length;
      const finOriginal = cuotaLista.filter(x => x.clip.type === 'original').length;
      await logMessage(`[FASE 2] Cuota: objetivo original=${objOriginal} stock=${objStock} ` +
        `ia=${objIa} visual=${objVisual} | ` +
        `antes original=${antesOriginal} stock=${antesStock} | ahora original=${finOriginal} stock=${finStock} | ` +
        `con keyword propio=${conKeyword.length}/${reasignables.length} | ` +
        `racha stock: alcanzada=${rachaAlcanzada} ideal=${rachaIdeal} ` +
        `(${rachaAlcanzada > rachaIdeal ? 'limite del material: faltan keywords' : 'optimo'})` +
        (sinKeyword > 0
          ? ` | AVISO: ${sinKeyword} slots de stock van como original por falta de keyword propio (evita b-roll generico)`
          : ''));
    }

    // ═══ TIMESTAMPS ESCALONADOS PARA LOS CLIPS 'original' ═══
    // Hasta ahora todos los sub-clips de una frase recibian el mismo timestamp (el inicio
    // de la frase), asi que una frase partida en 3 mostraba el mismo trozo del video fuente
    // 3 veces seguidas, y con los labios desincronizados en el 2o y el 3o.
    // Se recalcula aqui, ya con las duraciones definitivas (se ajustan en el bucle de
    // sanitizado), avanzando el timestamp por la duracion de los sub-clips anteriores.
    if (isOriginalAudio) {
      let escalonados = 0;
      for (let p = 0; p < sanitizedPhrases.length; p++) {
        const base = newAudioSegments[p]?.start;
        if (base === undefined) continue;
        let offset = 0;
        for (const c of sanitizedPhrases[p].visualClips) {
          if (c.type === 'original') {
            if (offset > 0) escalonados++;
            c.timestamp = parseFloat(Math.min(base + offset, maxTsVal).toFixed(2));
          }
          // El offset avanza con TODOS los sub-clips, no solo los 'original': la posicion
          // dentro de la frase progresa sea cual sea el tipo del sub-clip anterior.
          offset += c.duration || 0;
        }
      }
      await logMessage(`[FASE 2] Timestamps escalonados: ${escalonados} sub-clips 'original' movidos dentro de su frase`);
    }

    // Aplanar la lista de sub-clips para alimentar la cola de trabajadores
    flattenedClips = [];
    let globalIdx = 1;
    for (let phraseIdx = 0; phraseIdx < sanitizedPhrases.length; phraseIdx++) {
      const phrase = sanitizedPhrases[phraseIdx];
      for (let clipIdx = 0; clipIdx < phrase.visualClips.length; clipIdx++) {
        const subClip = phrase.visualClips[clipIdx];
        flattenedClips.push({
          index: globalIdx,
          phraseIndex: phraseIdx,
          clipIndexInPhrase: clipIdx,
          type: subClip.type,
          timestamp: subClip.timestamp,
          keyword: subClip.keyword,
          prompt: subClip.prompt,
          duration: subClip.duration,
          // NOMBRADO A MANO, como todo lo demas de este push. Es la PRIMERA reproyeccion
          // despues del mapeo que los añade, y sin esta linea `conceptos` moria aqui: veinte
          // lineas mas arriba se sanean y aqui se tiraban, sin error y sin log. El mismo patron
          // que obligo a nombrarlos alli.
          conceptos: subClip.conceptos,
          relacion: subClip.relacion,
          ancla: subClip.ancla,
          sinVisual: subClip.sinVisual,
          // EL ORIGEN PEDIDO Y EL MOTIVO CRUZAN EL APLANADO, y hay que nombrarlos igual que
          // `conceptos`. Es LA MISMA TRAMPA que documenta el comentario de aqui arriba: este
          // push construye objetos NUEVOS con claves a mano, asi que lo anotado sobre el
          // sub-clip -- y la degradacion por falta de keyword se anota alli -- se tiraba aqui
          // sin error y sin log. La advertencia ya estaba escrita en este mismo sitio y volvio
          // a pasar. Lo cazo la prueba de aceptacion: el resumen decia 'stock: se pidieron 11 y
          // salieron 0' con el desglose de motivos VACIO.
          origenPedido: subClip.origenPedido,
          motivoRespaldo: subClip.motivoRespaldo,
          graphic: null
        });
        globalIdx++;
      }
    }

    clipsDecision = flattenedClips;
    // La MISMA referencia, expuesta al `finally` del resumen: `clipsDecision` se declara dentro
    // del `try` y el resumen tiene que salir tambien cuando la generacion aborta. Si aborta
    // antes de esta linea, `decisiones` sigue vacio y el resumen dice 0 clips, que es la verdad.
    decisiones = clipsDecision;
    totalClips = flattenedClips.length;

    await logMessage(`[FASE 2] Decisiones de clips listas. Sub-clips totales: ${clipsDecision.length}. Clips IA: ${clipsDecision.filter(c => c.type === 'ia').length}, Stock: ${clipsDecision.filter(c => c.type === 'stock').length}, Original: ${clipsDecision.filter(c => c.type === 'original').length}, Visuales asignados: ${clipsDecision.filter(c => c.type === 'visual').length}`);

    // FASE 3: FFmpeg e IA — generar clips
    await logMessage(`[FASE 3] Generando ${totalClips} clips con FFmpeg, Pexels y fal.ai (IA)...`);

    const outDir = activeProjectPath
      ? dirMat(activeProjectPath, 'originales')
      : path.join(getBancoClipsPath(), 'originales');
    if (!(await exists(outDir))) await fs.promises.mkdir(outDir, { recursive: true });

    const thumbDir = activeProjectPath
      ? dirCache(activeProjectPath, 'thumbnails')
      : path.join(getBancoClipsPath(), 'thumbnails');
    if (!(await exists(thumbDir))) await fs.promises.mkdir(thumbDir, { recursive: true });

    const results = new Array(totalClips);
    // Evidencia de aceptacion separada del timeline: `finalClips` borra `graphic` a proposito
    // porque el MP4 ya sustituye la especificacion. Esta traza conserva la entrada exacta que
    // produjo cada hash sin reintroducir graphicData en el estado persistido del proyecto.
    const trazasGraficos: Array<{ id: string, graphicData: any, resolverTrace?: unknown }> = [];
    // Fuentes de stock ya usadas en esta generacion (provider_id, la misma identidad que el
    // fichero de cache) y cuantas veces. Keywords distintas pueden rankear el mismo video
    // generico: medido, uno llego a aparecer 4 veces en el mismo montaje.
    const usosPorFuente = new Map<string, number>();
    // Inversa radical en base 2 (van der Corput): 0, 1/2, 1/4, 3/4, 1/8, 5/8...
    // Coloca puntos incrementalmente sin saber cuantos vendran, cada uno en el hueco mas
    // grande que queda. Se usa para que dos usos de la misma fuente nunca arranquen en el
    // mismo segundo. Un simple (avance % margen) SI colisiona: con consumo 2.5 y margen 5,
    // el uso 1 cae en 2.5 y el uso 3 en 7.5%5 = 2.5.
    const vdc = (n: number) => {
      let r = 0, denom = 1;
      while (n > 0) { denom *= 2; r += (n % 2) / denom; n = Math.floor(n / 2); }
      return r; // en [0, 1)
    };
    const escapedVideo = videoPath.replace(/"/g, '\\"');

    // ─── LOS VISUALES, EN LOTE APARTE Y SECUENCIAL ───────────────────────────────────
    // NO entran en el pool de 3 workers de abajo: el render usa UNA ventana offscreen y
    // renderGraphicClipsLote se protege con `loteEnCurso`, asi que tres workers pidiendo
    // Visuales a la vez chocarian con esa guarda y dos de cada tres fallarian.
    // Va ANTES del pool para que un fallo se vea antes de descargar stock y gastar IA.
    //
    // Una paleta POR VÍDEO. `activeProjectPath` identifica establemente al proyecto que se
    // está generando y se captura antes del lote; todos sus sub-clips reciben el mismo sistema.
    // Va al hash mediante el parámetro `sistema` de renderGraphicClipsLote, así que una paleta
    // distinta nunca puede reutilizar un MP4 coloreado para otro vídeo.
    // Capture the authorized project once. New SceneSpecs never infer a root from cwd.
    const PROYECTO_VISUAL = activeProjectPath;
    const SISTEMA_VISUAL = sistemaDeGeneracion(PROYECTO_VISUAL ?? scriptText ?? 'sin-proyecto');
    // TEMPORAL, igual que el de arriba: la composicion va fija. El tipo decide QUE se pinta
    // —AnimatedGraphic busca en el registro quitandole el prefijo `visual_`— y hasta ahora
    // estaba cableado a 'visual_texto', asi que por muchas composiciones que se registraran
    // NUNCA se habria pintado ninguna: se habria generado, se habria visto texto plano, y
    // pareceria que el registro no funciona.
    //
    // Quien deberia elegirla es el guion, no esta constante: una frase sobre una represa pide
    // otra cosa que una sobre un desierto (regla 12 del manual — solo palabras con imagen). Eso
    // es una decision de producto que no esta tomada, y meterla en el prompt de DeepSeek es lo
    // que ya colapso el reparto una vez. Mientras tanto, fija y en un solo sitio.
    // ENCENDIDO. El despacho es por `type`: esta es la unica linea que decide que composicion
    // de pantalla completa sale en una generacion normal. El cambio de `visual_mapa` a
    // `visual_escena` ya invalida la cache de Visuales porque `type` entra en hashGrafico; NO se
    // sube VERSION_PLANTILLAS, porque eso invalidaria tambien las tarjetas que no han cambiado.
    //
    // `puedeDibujar` protege el caso que falta: un Visual sin los tres conceptos -- 1 de 82 en
    // la ultima generacion -- cae al Visual de texto de siempre y lo dice en el log.
    const COMPOSICION_VISUAL = 'visual_escena';
    const visuales = clipsDecision.filter((c: any) => c.type === 'visual');
    if (visuales.length) {
      // La unidad semántica del Visual es su ventana temporal real, no el párrafo completo.
      // `newAudioSegments` puede haberse fusionado para duración; `transcriptSegments` conserva
      // las palabras/timestamps originales y es la autoridad para localizar el subclip.
      const transcriptForLocalSemantics = Array.isArray(transcriptSegments) && transcriptSegments.length
        ? transcriptSegments : newAudioSegments;
      const conPalabra = visuales.map((item: any) => {
        const seg = newAudioSegments[item.phraseIndex];
        const dur = seg ? (seg.end - seg.start) : 0;
        const n = dur > 4.0 ? Math.ceil(dur / 3.0) : 1;
        const ini = seg ? seg.start + dur * item.clipIndexInPhrase / n : 0;
        const fin = seg ? seg.start + dur * (item.clipIndexInPhrase + 1) / n : 0;
        const pos = `${item.phraseIndex}:${item.clipIndexInPhrase}`;
        const legacyKeywordCandidate = seg ? palabraIlustrableDelTramo(seg.words, ini, fin) : null;
        // `item.keyword` belongs to this semantic subclip. It can resolve a tie only when the
        // transcript confirms that same word inside the exact time range; the legacy helper is
        // still useful evidence, but never gets that scene-specific priority.
        const keywordCandidates = [
          ...(typeof item.keyword === 'string' ? [{ keyword: item.keyword, source: 'scene-semantic' as const }] : []),
          ...(typeof legacyKeywordCandidate === 'string' ? [{ keyword: legacyKeywordCandidate, source: 'legacy-timed' as const }] : []),
        ];
        const localSemantic = createLocalSceneSemanticV1({
          sceneId: `visual-${pos}`,
          start: ini,
          end: fin,
          transcriptSegments: transcriptForLocalSemantics,
          concepts: item.conceptos ?? [],
          anchor: item.ancla ?? undefined,
          relation: item.relacion ?? undefined,
          globalText: seg?.text ?? '',
          globalHints: [item.keyword, item.prompt].filter((value): value is string => typeof value === 'string'),
          globalContextRef: `phrase:${item.phraseIndex}`,
        });
        const keywordSelection = selectNarrativeKeywordV2(localSemantic, keywordCandidates);
        return {
          item,
          frase: seg?.text ?? '',
          pos,
          localSemantic,
          keywordSelection,
          keywordCandidates,
        };
      });

      // Una palabra incierta no vuelve al pipeline legacy ni al original por omisión. La
      // selección V2 la deja como low-confidence y el compilador materializa editorial-text.
      const aRenderizar = conPalabra;
      if (aRenderizar.length) {
        // Capture the reproducible semantic input before resolving. The same
        // context is persisted with a new Visual and is the only input accepted
        // by explicit modern regeneration; neither path asks an LLM again.
        const contextosModernos = aRenderizar.map(x => {
          const value = recortarTexto(x.keywordSelection.keyword);
          const pos = x.pos;
          const semilla = semillaVisual(value, pos);
          const direccion = x.item.relacion
            ? direccionParaRelacion(semilla, x.item.relacion,
              { texto: value, frase: x.frase, conceptos: x.item.conceptos ?? [] })
            : direccionDe(semilla,
              { texto: value, frase: x.frase, conceptos: x.item.conceptos ?? [] });
          return createModernVisualGenerationContextV1({
            sceneId: x.localSemantic.sceneId,
            duration: x.item.duration,
            localSemantic: x.localSemantic,
            keywordCandidates: x.keywordCandidates,
            preferredVisualMode: x.item.sinVisual ? 'editorial-text' : 'auto',
            sistema: SISTEMA_VISUAL,
            direction: { ...direccion, semilla },
          });
        });
        // All semantic work completes before hashing/rendering. Renderer gets only the
        // materialized SceneSpec and its locator-only bindings; its trace remains diagnostic.
        const resueltosModernos = resolveModernVisualGenerationBatchV1({
          contexts: contextosModernos,
          projectRoot: PROYECTO_VISUAL ?? undefined,
        });
        const solicitudesGraficas = resueltosModernos.map(({ context, resolved }) => {
          if (resolved.compiled.graphicData.type !== COMPOSICION_VISUAL)
            throw new Error('El compilador semántico produjo una composición visual no autorizada');
          for (const alert of resolved.decision.alerts) {
            avisar({
              severidad: alert.severity === 'warning' ? 'aviso' : 'info',
              codigo: alert.code,
              origen: 'asset-resolver',
              mensaje: alert.message,
              detalle: `scene=${resolved.decision.sceneId}`,
            });
          }
          return {
            graphicData: resolved.compiled.graphicData,
            renderBindings: resolved.compiled.renderBindings,
            projectRoot: PROYECTO_VISUAL ?? undefined,
            diagnosticSceneId: resolved.decision.sceneId,
            resolverTrace: resolved.trace,
            localSemantic: resolved.localSemantic,
            keywordSelection: resolved.keywordSelection,
            resolverDecision: resolved.decision,
            inputFallback: resolved.inputFallback,
            // Diagnostic/state-only context. It stays outside sceneSpec, hash and renderer.
            visualRegeneration: context,
            duracion: context.duration,
          };
        });
        const qcReports = new Map<number, { hash: string; report: VisualRuntimeQcReport }>();
        const resVis = await renderGraphicClipsLote(
          solicitudesGraficas,
          {
            aspectRatio, fps: 30, modo: 'pantalla', sistema: SISTEMA_VISUAL,
            onQcFailure: ({ index, hash }, report) => { qcReports.set(index, { hash, report }); },
          },
          (p) => event.sender.send('generation-progress',
            { index: p.index, total: p.total, paragraph: p.paragraph, type: 'Visual' })
        );

        // EL CONTRATO DEL RELLENO, igual que las otras tres ramas: se escribe en
        // results[index-1] SOLO si el fichero existe. Si no, el hueco se queda y FASE 4 lo
        // rellena duplicando el vecino — un plano repetido, no un clip sin fichero que rompa
        // la aritmetica de frames y se coma el audio por el -shortest del mux.
        const diagnosticScenes: any[] = [];
        const diagnosticReasons = new Map<string, number>();
        let materializedVisuals = 0;
        let qcRejectedVisuals = 0;
        let resolverDegradedVisuals = 0;
        let substitutedWithOriginal = 0;
        const countDiagnosticReason = (reason: string) =>
          diagnosticReasons.set(reason, (diagnosticReasons.get(reason) ?? 0) + 1);
        for (let i = 0; i < aRenderizar.length; i++) {
          const ruta = resVis.rutas?.[i];
          const item = aRenderizar[i].item;
          const request = solicitudesGraficas[i];
          const qc = qcReports.get(i);
          const spec = sceneSpecFromGraphicData(request.graphicData);
          const sceneSpecIdentity = spec
            ? createHash('sha256').update(sceneSpecPixelIdentity(spec)).digest('hex') : null;
          const degraded = request.inputFallback.used ||
            request.resolverDecision.alerts.some((alert: any) => alert.code === 'RESOLVER_DEGRADED');
          if (degraded) resolverDegradedVisuals++;
          if (!ruta || !(await exists(ruta))) {
            item.origenPedido ??= item.type;
            item.motivoRespaldo ??= qc ? 'visual-qc-rechazado' : 'visual-sin-fichero';
            item.type = 'original';
            substitutedWithOriginal++;
            if (qc) {
              qcRejectedVisuals++;
              for (const finding of qc.report.findings) countDiagnosticReason(finding.code);
            } else {
              countDiagnosticReason(item.motivoRespaldo);
            }
            diagnosticScenes.push({
              sceneId: request.diagnosticSceneId,
              localSemantic: {
                start: request.localSemantic.start,
                end: request.localSemantic.end,
                localText: request.localSemantic.localText,
                localTokens: request.localSemantic.localTokens,
                concepts: request.localSemantic.concepts,
                ...(request.localSemantic.globalContextRef ? { globalContextRef: request.localSemantic.globalContextRef } : {}),
                globalTextLength: request.localSemantic.globalText?.length ?? 0,
                globalHints: request.localSemantic.globalHints,
              },
              keyword: request.keywordSelection,
              metaphorCandidates: request.resolverTrace.metaphorCandidates,
              selectedMetaphor: request.resolverTrace.selectedMetaphor,
              providerCandidates: request.resolverTrace.providerCandidates,
              selectedCandidate: request.resolverTrace.selectedCandidate,
              visualMode: request.resolverDecision.visualMode,
              treatment: request.resolverTrace.treatment,
              structure: request.resolverTrace.structure,
              fallback: request.resolverTrace.fallback,
              reasons: request.resolverTrace.reasons,
              warnings: request.resolverDecision.alerts,
              inputFallback: request.inputFallback,
              sceneSpecIdentity,
              render: {
                outcome: qc ? 'qc-rejected' : 'render-failed',
                hash: qc?.hash ?? resVis.hashes?.[i] ?? null,
                ...(qc ? { qcReport: qc.report } : {}),
                substitutedWithOriginal: true,
              },
            });
            continue;
          }
          materializedVisuals++;
          const durReal = await getVideoDuration(ruta);
          const id = `visual-${item.index}`;
          trazasGraficos.push({ id, graphicData: solicitudesGraficas[i].graphicData,
            resolverTrace: solicitudesGraficas[i].resolverTrace });
          results[item.index - 1] = {
            id,
            name: path.basename(ruta),
            path: ruta,
            url: urlDeRuta(ruta),
            duration: formatTimeMinutesSeconds(durReal),
            durationSeconds: durReal,
            // 'video' + category 'visual': entra en videoOnly y en la aritmetica de frames sin
            // tocar una sola linea del export. Y category lo hace contable en la auditoria.
            type: 'video',
            category: 'visual',
            // Minimum persisted context for deterministic explicit regeneration.
            // It is administrative/semantic input only and never reaches extra.sceneSpec.
            visualRegeneration: request.visualRegeneration,
            thumbnailUrl: ''
          };
          diagnosticScenes.push({
            sceneId: request.diagnosticSceneId,
            localSemantic: {
              start: request.localSemantic.start,
              end: request.localSemantic.end,
              localText: request.localSemantic.localText,
              localTokens: request.localSemantic.localTokens,
              concepts: request.localSemantic.concepts,
              ...(request.localSemantic.globalContextRef ? { globalContextRef: request.localSemantic.globalContextRef } : {}),
              globalTextLength: request.localSemantic.globalText?.length ?? 0,
              globalHints: request.localSemantic.globalHints,
            },
            keyword: request.keywordSelection,
            metaphorCandidates: request.resolverTrace.metaphorCandidates,
            selectedMetaphor: request.resolverTrace.selectedMetaphor,
            providerCandidates: request.resolverTrace.providerCandidates,
            selectedCandidate: request.resolverTrace.selectedCandidate,
            visualMode: request.resolverDecision.visualMode,
            treatment: request.resolverTrace.treatment,
            structure: request.resolverTrace.structure,
            fallback: request.resolverTrace.fallback,
            reasons: request.resolverTrace.reasons,
            warnings: request.resolverDecision.alerts,
            inputFallback: request.inputFallback,
            sceneSpecIdentity,
            visualRegeneration: request.visualRegeneration,
            render: {
              outcome: 'materialized',
              hash: resVis.hashes?.[i] ?? null,
              durationSeconds: durReal,
              substitutedWithOriginal: false,
            },
          });
        }
        if (PROYECTO_VISUAL) {
          const generationId = `visual-decisions-${Date.now()}-${randomUUID()}`;
          try {
            const diagnostic = writeVisualDecisionDiagnostic(PROYECTO_VISUAL, {
              diagnosticVersion: 1,
              generationId,
              createdAt: new Date().toISOString(),
              summary: {
                requestedVisuals: aRenderizar.length,
                materializedVisuals,
                qcRejectedVisuals,
                resolverDegradedVisuals,
                substitutedWithOriginal,
                reasons: Object.fromEntries([...diagnosticReasons.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'))),
              },
              scenes: diagnosticScenes,
            });
            await logMessage(`[FASE 3] Diagnóstico visual persistido: ${diagnostic.relativeFile} (${diagnostic.sha256.slice(0, 12)}).`);
          } catch (diagnosticError: any) {
            avisar({
              severidad: 'aviso', codigo: 'RESOLVER_DEGRADED', origen: 'asset-resolver',
              mensaje: 'No se pudo persistir el diagnóstico de decisiones visuales.',
              detalle: diagnosticError?.code ?? diagnosticError?.message ?? 'UNKNOWN',
            });
            await logMessage(`[FASE 3] Diagnóstico visual no persistido: ${diagnosticError?.code ?? diagnosticError?.message ?? diagnosticError}`);
          }
        }
        await logMessage(`[FASE 3] Visuales: ${aRenderizar.length} pedidos, ` +
          `${resVis.renderizados} renderizados, ${resVis.aciertos} de cache, ` +
          `${resVis.fallos} fallidos` + (resVis.cancelado ? ` — CANCELADO: ${resVis.motivo}` : ''));
      }
    }

    // Cola de procesamiento. Los 'visual' que salieron bien ya tienen su results[] puesto y los
    // que no, volvieron a 'original': ninguno llega al pool con type 'visual'.
    const queue = [...clipsDecision].filter((c: any) => c.type !== 'visual');

    // Procesamiento paralelo con límite de 3 workers simultáneos
    const workers = Array(3).fill(null).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        const clipNum = String(item.index).padStart(3, '0');
        const clipPath = path.join(outDir, `clip_${clipNum}.mp4`);
        const escapedClip = clipPath.replace(/"/g, '\\"');
        const thumbPath = path.join(thumbDir, `clip_${clipNum}.jpg`);

        event.sender.send('generation-progress', {
          index: item.index - 1, total: totalClips,
          paragraph: `Procesando clip ${item.index}/${totalClips} [${item.type}]`,
          type: item.type === 'ia' ? 'IA' : (item.type === 'stock' ? 'Stock' : 'FFmpeg')
        });

        let success = false;

        if (item.type === 'ia') {
          try {
            let promptFinal = item.prompt || 'cinematic video clip';
            if (iaStyle === 'cartoon') {
              promptFinal += ', 3D cartoon style, vibrant colors, Pixar animation movie style';
            } else if (iaStyle === 'bw') {
              promptFinal += ', black and white, classic film noir movie style, moody lighting';
            }

            // Llamada a fal.ai
            const result = await fal.subscribe("fal-ai/minimax/video-01", {
              input: { prompt: promptFinal }
            }) as any;

            const downloadUrl = result?.video?.url || result?.data?.video?.url;
            if (!downloadUrl) throw new Error('No se recibió la URL de video de fal.ai');

            // Descargar el clip temporalmente
            const downloadRes = await fetch(downloadUrl);
            if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.statusText}`);
            
            const arrayBuffer = await downloadRes.arrayBuffer();
            const tempVideoPath = path.join(outDir, `temp_ia_${clipNum}.mp4`);
            await fs.promises.writeFile(tempVideoPath, Buffer.from(arrayBuffer));

            // Recortar el video de IA (6s) a su duración real con re-codificación h264/aac
            await new Promise<void>((resolve, reject) => {
              const cmd = `ffmpeg -y -ss 0 -i "${tempVideoPath}" -t ${item.duration} -c:v libx264 -c:a aac "${escapedClip}"`;
              exec(cmd, (err) => { if (err) reject(err); else resolve(); });
            });

            try { await fs.promises.unlink(tempVideoPath); } catch (e) {}
            success = true;
          } catch (iaErr: any) {
            await logMessage(`[FASE 3] Error IA en clip ${item.index}: ${iaErr.message || iaErr}. Usando fallback original.`);
            // Caída de seguridad: convertimos el clip a tipo original y le asignamos un timestamp proporcional
            item.origenPedido ??= item.type;
            item.motivoRespaldo ??= 'ia-fallida';
            item.type = 'original';
            item.timestamp = parseFloat((((item.index - 1) / totalClips) * maxTsVal).toFixed(1));
          }
        }

        if (item.type === 'stock') {
          try {
            // ═══ BÚSQUEDA PARALELA EN MÚLTIPLES PROVEEDORES ═══
            const pexelsApiKey = process.env.PEXELS_API_KEY;
            const pixabayApiKey = process.env.PIXABAY_API_KEY || '';
            const coverrApiKey = process.env.COVERR_API_KEY || '';
            const isVertical = aspectRatio === '9:16' || aspectRatio === 'vertical';
            const targetOrientation = isVertical ? 'portrait' : 'landscape';
            const stockDir = path.join(getBancoClipsPath(), 'stock');
            if (!(await exists(stockDir))) {
              await fs.promises.mkdir(stockDir, { recursive: true });
            }
            
            type StockResult = { provider: string; id: string; downloadUrl: string; width: number; height: number; duration?: number };
            const stockResults: StockResult[] = [];
            const keyword = item.keyword || 'broll';

            // Buscar en Pexels
            if (pexelsApiKey) {
              try {
                const pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=5&orientation=${targetOrientation}`;
                await logMessage(`[FASE 3] Buscando stock en Pexels para: "${keyword}"`);
                const pexelsRes = await fetch(pexelsUrl, { headers: { 'Authorization': pexelsApiKey } });
                if (pexelsRes.ok) {
                  const pexelsData = await pexelsRes.json() as any;
                  const videos = pexelsData?.videos || [];
                  for (const video of videos.slice(0, 3)) {
                    const videoFiles = video.video_files || [];
                    let bestFile = videoFiles.find((f: any) => f.quality === 'hd' || f.width >= 720);
                    if (!bestFile) bestFile = videoFiles[0];
                    if (bestFile?.link) {
                      stockResults.push({
                        provider: 'pexels',
                        id: String(video.id),
                        downloadUrl: bestFile.link,
                        width: bestFile.width || 0,
                        height: bestFile.height || 0,
                        duration: video.duration
                      });
                    }
                  }
                  await logMessage(`[FASE 3] Pexels devolvió ${stockResults.length} resultados para: "${keyword}"`);
                }
              } catch (pexErr) {
                await logMessage(`[FASE 3] Error en Pexels: ${pexErr}`);
              }
            }

            // Buscar en Pixabay
            if (pixabayApiKey) {
              try {
                const pixabayUrl = `https://pixabay.com/api/videos/?key=${pixabayApiKey}&q=${encodeURIComponent(keyword)}&per_page=5&safesearch=true`;
                await logMessage(`[FASE 3] Buscando stock en Pixabay para: "${keyword}"`);
                const pixRes = await fetch(pixabayUrl);
                if (pixRes.ok) {
                  const pixData = await pixRes.json() as any;
                  const hits = pixData?.hits || [];
                  const prevCount = stockResults.length;
                  for (const hit of hits.slice(0, 3)) {
                    const videoUrl = hit.videos?.large?.url || hit.videos?.medium?.url;
                    if (videoUrl) {
                      stockResults.push({
                        provider: 'pixabay',
                        id: String(hit.id),
                        downloadUrl: videoUrl,
                        width: hit.videos?.large?.width || hit.videos?.medium?.width || 0,
                        height: hit.videos?.large?.height || hit.videos?.medium?.height || 0,
                        duration: hit.duration
                      });
                    }
                  }
                  await logMessage(`[FASE 3] Pixabay devolvió ${stockResults.length - prevCount} resultados para: "${keyword}"`);
                }
              } catch (pixErr) {
                await logMessage(`[FASE 3] Error en Pixabay: ${pixErr}`);
              }
            }

            // Buscar en Coverr
            if (coverrApiKey) {
              try {
                const coverrUrl = `https://api.coverr.co/videos?query=${encodeURIComponent(keyword)}&page_size=5`;
                await logMessage(`[FASE 3] Buscando stock en Coverr para: "${keyword}"`);
                const coverrRes = await fetch(coverrUrl, { headers: { 'Authorization': `Bearer ${coverrApiKey}` } });
                if (coverrRes.ok) {
                  const coverrData = await coverrRes.json() as any;
                  const hits = coverrData?.hits || [];
                  const prevCount = stockResults.length;
                  for (const hit of hits.slice(0, 3)) {
                    const mp4 = hit?.urls?.mp4_download || hit?.urls?.mp4 || '';
                    if (mp4) {
                      stockResults.push({
                        provider: 'coverr',
                        id: String(hit.id || hit.slug || Math.random()),
                        downloadUrl: mp4,
                        width: hit.width || 1920,
                        height: hit.height || 1080,
                        duration: hit.duration || undefined
                      });
                    }
                  }
                  await logMessage(`[FASE 3] Coverr devolvió ${stockResults.length - prevCount} resultados para: "${keyword}"`);
                }
              } catch (coverrErr) {
                await logMessage(`[FASE 3] Error en Coverr: ${coverrErr}`);
              }
            }

            // Buscar en NASA Images (sin API key, público)
            try {
              const nasaUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(keyword)}&media_type=video&page_size=3`;
              await logMessage(`[FASE 3] Buscando stock en NASA para: "${keyword}"`);
              const nasaRes = await fetch(nasaUrl);
              if (nasaRes.ok) {
                const nasaData = await nasaRes.json() as any;
                const nasaItems = nasaData?.collection?.items || [];
                // Filtrar solo videos cortos (menos de 120 segundos)
                const shortNasaItems = nasaItems.filter((item: any) => {
                  const desc = item?.data?.[0]?.description || '';
                  // Excluir conferencias de prensa, webinars, y videos muy largos
                  const isLong = desc.toLowerCase().includes('conference') || 
                                 desc.toLowerCase().includes('briefing') || 
                                 desc.toLowerCase().includes('webinar') ||
                                 desc.toLowerCase().includes('full length');
                  return !isLong;
                });
                const prevCount = stockResults.length;
                for (const item of shortNasaItems.slice(0, 2)) {
                  const nasaId = item?.data?.[0]?.nasa_id;
                  if (!nasaId) continue;
                  try {
                    const assetRes = await fetch(`https://images-api.nasa.gov/asset/${nasaId}`);
                    if (assetRes.ok) {
                      const assetData = await assetRes.json() as any;
                      const mp4Files = (assetData?.collection?.items || [])
                        .filter((f: any) => f.href && f.href.endsWith('.mp4'))
                        .sort((a: any, b: any) => (b.href.includes('large') ? 1 : 0) - (a.href.includes('large') ? 1 : 0));
                      if (mp4Files.length > 0) {
                        stockResults.push({
                          provider: 'nasa',
                          id: nasaId,
                          downloadUrl: mp4Files[0].href,
                          width: 1920,
                          height: 1080,
                          duration: undefined
                        });
                      }
                    }
                  } catch (assetErr) {
                    await logMessage(`[FASE 3] Error obteniendo asset NASA ${nasaId}: ${assetErr}`);
                  }
                }
                await logMessage(`[FASE 3] NASA devolvió ${stockResults.length - prevCount} resultados para: "${keyword}"`);
              }
            } catch (nasaErr) {
              await logMessage(`[FASE 3] Error en NASA: ${nasaErr}`);
            }

            // TODO: Agregar más proveedores aquí

            await logMessage(`[FASE 3] Pool total: ${stockResults.length} clips de stock para: "${keyword}"`);

            // Seleccionar el mejor clip del pool
            let stockClipPath = '';
            let stockOffset = 0; // segundo de inicio del recorte; varia si la fuente se reutiliza
            if (stockResults.length > 0) {
              // Rankear: preferir orientación correcta, resolución HD, duración 3-10s
              const ranked = stockResults.sort((a, b) => {
                let scoreA = 0, scoreB = 0;
                // Orientación correcta
                const aVertical = a.height > a.width;
                const bVertical = b.height > b.width;
                if (aVertical === isVertical) scoreA += 3;
                if (bVertical === isVertical) scoreB += 3;
                // Resolución HD
                if (a.width >= 1280 || a.height >= 1280) scoreA += 2;
                if (b.width >= 1280 || b.height >= 1280) scoreB += 2;
                // Duración ideal 3-10s
                if (a.duration && a.duration >= 3 && a.duration <= 10) scoreA += 1;
                if (b.duration && b.duration >= 3 && b.duration <= 10) scoreB += 1;
                // Diversidad: alternar proveedores (aleatorio leve)
                scoreA += Math.random() * 0.5;
                scoreB += Math.random() * 0.5;
                return scoreB - scoreA;
              });

              // Preferir la mejor candidata que no se haya usado ya en este video.
              let best = ranked.find((r: any) => !usosPorFuente.has(`${r.provider}_${r.id}`));
              let repetido = false;
              if (!best) { best = ranked[0]; repetido = true; } // pool agotado: mejor repetir que no tener clip
              const claveFuente = `${best.provider}_${best.id}`;
              const usosPrevios = usosPorFuente.get(claveFuente) ?? 0;
              // Se marca ANTES de cualquier await: con 3 workers en paralelo, marcarlo
              // despues de la descarga dejaria que dos frases eligieran la misma fuente.
              usosPorFuente.set(claveFuente, usosPrevios + 1);

              // Al reutilizar una fuente se corta desde otro segundo, para que no se vea el
              // mismo fragmento exacto. El filtro aplica setpts=0.8*PTS, asi que cada clip
              // consume duracion/0.8 de metraje. vdc(0)=0, asi que el primer uso arranca en 0
              // sin necesidad de caso especial. No garantiza que no se solapen (haria falta
              // (usos-1)*consumo de margen), pero si que el arranque sea siempre distinto.
              const consumo = item.duration / 0.8;
              const margen = Math.max(0, (Number(best.duration) || 0) - consumo);
              if (margen > 0.2) {
                stockOffset = Math.round(margen * vdc(usosPrevios) * 100) / 100;
              }

              const rawStockFilename = `${claveFuente}_raw.mp4`;
              const rawStockPath = path.join(stockDir, rawStockFilename);

              if (!(await exists(rawStockPath))) {
                await logMessage(`[FASE 3] Descargando de ${best.provider}: ${best.downloadUrl.substring(0, 80)}...`);
                try {
                  const dlRes = await fetch(best.downloadUrl);
                  if (dlRes.ok) {
                    const buffer = await dlRes.arrayBuffer();
                    await fs.promises.writeFile(rawStockPath, Buffer.from(buffer));
                  }
                } catch (dlErr) {
                  await logMessage(`[FASE 3] Error descargando de ${best.provider}: ${dlErr}`);
                }
              } else {
                await logMessage(`[FASE 3] Usando caché de ${best.provider}: ${rawStockFilename}`);
              }

              if (await exists(rawStockPath)) {
                stockClipPath = rawStockPath;
                await logMessage(`[FASE 3] ✓ Stock seleccionado de ${best.provider} (${best.width}x${best.height}) para: "${keyword}"` +
                  (repetido ? ` [REPETIDO uso #${usosPrevios + 1}, corte desde ${stockOffset}s]` : ''));
              }
            }

            // Si no se encontró stock en ningún proveedor, usar clip original como fallback
            if (!stockClipPath) {
              await logMessage(`[FASE 3] Sin stock disponible para: "${keyword}". Usando fallback original.`);
              item.origenPedido ??= item.type;
              item.motivoRespaldo ??= 'stock-sin-resultados';
              item.type = 'original';
              item.timestamp = parseFloat((((item.index - 1) / totalClips) * maxTsVal).toFixed(1));
            } else {
              let filter = '';
              try {
                const dimensions = await getVideoDimensions(stockClipPath);
                const isVerticalOutput = aspectRatio === '9:16' || aspectRatio === 'vertical';
                if (isVerticalOutput) {
                  if (dimensions.width > dimensions.height) {
                    filter = 'crop=ih*9/16:ih,scale=1080:1920,setpts=0.8*PTS';
                  } else {
                    filter = 'crop=iw:iw*16/9,scale=1080:1920,setpts=0.8*PTS';
                  }
                } else {
                  if (dimensions.width > dimensions.height) {
                    filter = 'crop=iw:iw*9/16,scale=1920:1080,setpts=0.8*PTS';
                  } else {
                    filter = 'crop=iw:iw*9/16,scale=1920:1080,setpts=0.8*PTS';
                  }
                }
              } catch (dimErr) {
                const isVertical = aspectRatio === '9:16' || aspectRatio === 'vertical';
                filter = isVertical
                  ? 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setpts=0.8*PTS'
                  : 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=0.8*PTS';
              }

              const escapedRawStock = stockClipPath.replace(/"/g, '\\"');
              await new Promise<void>((resolve, reject) => {
                const cmd = `ffmpeg -y -ss ${stockOffset} -i "${escapedRawStock}" -vf "${filter}" -t ${item.duration} -an "${escapedClip}"`;
                exec(cmd, (err) => { if (err) reject(err); else resolve(); });
              });

              if (activeProjectPath) {
                const localStockDir = dirMat(activeProjectPath, 'stock');
                if (!(await exists(localStockDir))) {
                  await fs.promises.mkdir(localStockDir, { recursive: true });
                }
                const localStockPath = path.join(localStockDir, path.basename(stockClipPath).replace('_raw', ''));
                await fs.promises.copyFile(clipPath, localStockPath);
              }

              success = true;
            }
          } catch (stockErr: any) {
            await logMessage(`[FASE 3] Error Stock en clip ${item.index}: ${stockErr.message || stockErr}. Usando fallback original.`);
            // El origen pedido y el motivo, ANTES de reasignar. Ver el bloque de sinPalabra.
            item.origenPedido ??= item.type;
            item.motivoRespaldo ??= 'stock-error';
            item.type = 'original';
            item.timestamp = parseFloat((((item.index - 1) / totalClips) * maxTsVal).toFixed(1));
          }
        }

        if (item.type === 'original') {
          const ts = item.timestamp ?? 0;
          await logMessage(`[DEBUG_ORIG] clip ${item.index} ts=${ts} duration=${item.duration}`);
          try {
            await new Promise<void>((resolve, reject) => {
              const cmd = `ffmpeg -y -ss ${ts} -i "${escapedVideo}" -t ${item.duration} -c copy "${escapedClip}"`;
              exec(cmd, (err) => { if (err) reject(err); else resolve(); });
            });
            success = true;
          } catch (ffErr: any) {
            await logMessage(`[FASE 3] FFmpeg error clip ${item.index}: ${ffErr.message}`);
          }
        }

        if (success && await exists(clipPath)) {
          const durationSeconds = await getVideoDuration(clipPath);
          let thumbnailUrl = '';
          try {
            await generateVideoThumbnail(clipPath, thumbPath);
            if (await exists(thumbPath)) {
              thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbPath)).toString('base64')}`;
            }
          } catch (e) {}
          const stat = await fs.promises.stat(clipPath);
          results[item.index - 1] = {
            id: `bank-originales-clip_${clipNum}.mp4`,
            name: `clip_${clipNum}.mp4`,
            path: clipPath,
            url: urlDeRuta(clipPath),
            duration: formatTimeMinutesSeconds(durationSeconds),
            durationSeconds,
            type: 'video',
            category: item.type === 'ia' ? 'ia' : (item.type === 'stock' ? 'stock' : 'original'),
            size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
            thumbnailUrl
          };
        }
      }
    });

    await Promise.all(workers);
        // ═══ FASE 4: Rellenar slots fallidos SIN compactar ═══
        // CRÍTICO: results es posicional (results[item.index - 1]).
        // Filtrar y compactar desplaza todos los clips siguientes y rompe
        // la correspondencia frase → clip. Se rellena en el lugar.
        const validCount = results.filter((c: any) => c !== undefined).length;
        if (validCount === 0) {
          return { success: false, error: 'No se pudo crear ningun clip. Verifica la configuracion de las APIs y FFmpeg.' };
        }

        let filled = 0;
        for (let i = 0; i < results.length; i++) {
          if (results[i] !== undefined) continue;
          // Buscar el clip valido anterior mas cercano
          let donor: any = undefined;
          for (let b = i - 1; b >= 0; b--) {
            if (results[b] !== undefined) { donor = results[b]; break; }
          }
          // Si no hay anterior, buscar el siguiente valido
          if (!donor) {
            for (let f = i + 1; f < results.length; f++) {
              if (results[f] !== undefined) { donor = results[f]; break; }
            }
          }
          if (donor) {
            results[i] = { ...donor, id: `${donor.id}-fill-${i}` };
            filled++;
          }
        }

        const createdClips = results;
        await logMessage(`[FASE 4] Slots rellenados en posicion: ${filled}. Total: ${createdClips.length} (validos originales: ${validCount})`);

    // FASE 5: Ensamblar timeline secuencial
    await logMessage('[FASE 5] Ensamblando timeline...');
    let currentStart = 0;
    const finalClips: any[] = [];

    let globalClipIdx = 0;
        await logMessage(`[DIAG] sanitizedPhrases=${sanitizedPhrases.length} newAudioSegments=${newAudioSegments.length}`);

    for (let phraseIdx = 0; phraseIdx < sanitizedPhrases.length; phraseIdx++) {
      const phrase = sanitizedPhrases[phraseIdx];
      const phraseStartSeconds = newAudioSegments[phraseIdx]?.start ?? currentStart;
          await logMessage(`[DIAG] phraseIdx=${phraseIdx} phraseIndex=${phrase.phraseIndex} segStart=${newAudioSegments[phraseIdx]?.start} segEnd=${newAudioSegments[phraseIdx]?.end} clips=${phrase.visualClips.length} tieneGrafico=${!!phrase.graphic}`);
      await logMessage(`[DEBUG3] phraseIdx=${phraseIdx} phraseStartSeconds=${phraseStartSeconds} currentStart=${currentStart}`);

      for (let clipIdx = 0; clipIdx < phrase.visualClips.length; clipIdx++) {
        const clip = createdClips[globalClipIdx];
        globalClipIdx++;
        if (!clip) continue;

        clip.startSeconds = phraseStartSeconds + (clipIdx > 0 ? 
          sanitizedPhrases[phraseIdx].visualClips
            .slice(0, clipIdx)
            .reduce((sum: number, c: any) => sum + (c.duration ?? 2), 0) 
          : 0);
        clip.phraseIdx = phraseIdx;
        clip.graphic = null; // ya no va anidado en el video clip

        if (clip.startSeconds >= audioDuration) {
          // Eliminar el archivo físico si empieza después del audio
          try {
            if (await exists(clip.path)) {
              await fs.promises.unlink(clip.path);
              const thumbPath = rutaMiniatura(clip.path);
              if (await exists(thumbPath)) await fs.promises.unlink(thumbPath);
            }
          } catch (e) {}
          continue;
        }

        if (clip.startSeconds + clip.durationSeconds > audioDuration) {
          const targetDuration = parseFloat((audioDuration - clip.startSeconds).toFixed(2));
          if (targetDuration > 0) {
            const tempTrimPath = clip.path.replace('.mp4', '_trimmed.mp4');
            const escapedClip = clip.path.replace(/"/g, '\\"');
            const escapedTemp = tempTrimPath.replace(/"/g, '\\"');

            try {
              await new Promise<void>((resolve, reject) => {
                const cmd = `ffmpeg -y -i "${escapedClip}" -t ${targetDuration} -c:v libx264 -c:a aac "${escapedTemp}"`;
                exec(cmd, (err) => { if (err) reject(err); else resolve(); });
              });

              if (await exists(tempTrimPath)) {
                try { await fs.promises.unlink(clip.path); } catch (e) {}
                await fs.promises.rename(tempTrimPath, clip.path);

                clip.durationSeconds = targetDuration;
                clip.duration = formatTimeMinutesSeconds(targetDuration);
                const stat = await fs.promises.stat(clip.path);
                clip.size = `${(stat.size / (1024 * 1024)).toFixed(2)} MB`;

                // Regenerar miniatura
                const thumbPath = rutaMiniatura(clip.path);
                try {
                  await generateVideoThumbnail(clip.path, thumbPath);
                  if (await exists(thumbPath)) {
                    clip.thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbPath)).toString('base64')}`;
                  }
                } catch (e) {}
              }
            } catch (trimErr: any) {
              await logMessage(`[FASE 5] Error al recortar clip final ${clip.name}: ${trimErr.message}`);
            }
          }
        }

        finalClips.push(clip);
        currentStart += clip.durationSeconds;
      }

    }

        // ═══ NORMALIZACIÓN: cada clip llena hasta el inicio del siguiente ═══
        // Evita huecos por diferencia entre duración planificada y duración real de FFmpeg
        finalClips.sort((a: any, b: any) => a.startSeconds - b.startSeconds);
        const voiceClipRef = ((globalThis as any).timelineVideoClips as any[])?.find((c: any) => c.type === 'audio') || null;
        const audioTotal = voiceClipRef?.durationSeconds || audioDuration || currentStart;
        let normalized = 0;
        for (let i = 0; i < finalClips.length; i++) {
          const isLast = i === finalClips.length - 1;
          const slotEnd = isLast ? audioTotal : finalClips[i + 1].startSeconds;
          const slotDuration = slotEnd - finalClips[i].startSeconds;
          if (slotDuration > 0 && Math.abs(slotDuration - finalClips[i].durationSeconds) > 0.01) {
            finalClips[i].durationSeconds = slotDuration;
            normalized++;
          }
        }
        await logMessage(`[FASE 5] Normalización: ${normalized} de ${finalClips.length} clips ajustados para cobertura continua (audio: ${audioTotal.toFixed(2)}s)`);
        currentStart = audioTotal;

    // Los Visuales son vídeos de pantalla completa con `category: 'visual'`: entran en el
    // montaje como vídeo, no como el tipo legado `graphic`. Contar ese tipo daba cero aun
    // después de renderizar y montar los Visuales, una salida verde con un resumen falso.
    await logMessage(`[generate-timeline-assets] Completado. Clips: ${finalClips.length} (Videos: ${finalClips.filter(c => c.type === 'video').length}, Visuales: ${finalClips.filter(c => c.category === 'visual').length})`);
    // La generacion llego al final. Si algo lanza antes, esto no se ejecuta y el resumen dira
    // que quedo incompleta -- que es lo que hay que decir.
    completa = true;
    const trazabilidadGraficos = trazasGraficos.filter(t =>
      finalClips.some(c => c.id === t.id && c.category === 'visual'));
    return { success: true, clips: finalClips, trazabilidadGraficos };

  } catch (err: any) {
    const errMsg = `[generate-timeline-assets] Error: ${err.message || err}`;
    console.error(errMsg, err);
    await writeDebugLog(errMsg);
    return { success: false, error: err.message || 'Error interno' };
  } finally {
    // ═══ EL RESUMEN SALE SIEMPRE, TAMBIEN SI LA GENERACION ABORTA O LANZA ═══════════════
    //
    // Va en `finally` a proposito: EL CAMINO FELIZ ES JUSTO EL QUE MINTIO EL 25/8. La app dijo
    // "exito, 78 de 78" y era verdad -- salieron 78 clips; lo que no dijo es que 31 se habian
    // degradado por el camino. Un resumen que solo apareciera en el camino feliz no serviria.
    //
    // NADA DE AQUI PUEDE LANZAR: una excepcion en un `finally` se comeria el return o el error
    // original, y el usuario se quedaria sin las dos cosas.
    try {
      const objetivo = repartoObjetivos(weights, decisiones.length);
      // EL `real` DE CADA ORIGEN. Un clip que cayo NO cuenta para el origen al que cayo: un
      // Visual que acabo en "original" es un Visual perdido, no un original legitimo.
      const legitimos = (t: string) =>
        decisiones.filter((c: any) => c.type === t && !c.origenPedido).length;
      const filas: FilaResumen[] = [
        { origen: 'original', objetivo: objetivo.original, real: legitimos('original') },
        { origen: 'stock',    objetivo: objetivo.stock,    real: legitimos('stock') },
        { origen: 'IA',       objetivo: objetivo.ia,       real: legitimos('ia') },
        { origen: 'Visual',   objetivo: objetivo.visual,   real: legitimos('visual') }
      ];
      const porMotivo = new Map<string, number>();
      for (const c of decisiones as any[]) {
        if (!c.motivoRespaldo) continue;
        porMotivo.set(c.motivoRespaldo, (porMotivo.get(c.motivoRespaldo) ?? 0) + 1);
      }
      const respaldo: MotivoRespaldo[] = [...porMotivo.entries()].map(([motivo, veces]) => ({
        motivo, descripcion: describirMotivo(motivo), veces
      })).sort((a, b) => b.veces - a.veces);

      const resumen: Resumen = armarResumen(filas, respaldo, decisiones.length, completa);

      // A LA INTERFAZ **Y** AL FICHERO. Lo primero para verlo ahora; lo segundo para poder
      // recuperarlo despues de cerrar la app, que es cuando uno se pregunta que paso.
      enviarAviso(event, { tipo: 'resumen', resumen, lista: avisos.lista() });
      for (const linea of textoResumen(resumen)) {
        writeDebugLog('[RESUMEN] ' + linea).catch(() => {});
      }
    } catch (e) { /* el resumen nunca puede tumbar la generacion */ }
  }
});

/**
 * Explicit regeneration for modern full-screen Visuals. This intentionally
 * bypasses the historical DeepSeek/card path: a modern clip already stores the
 * bounded semantic context that originally produced its SceneSpec.
 */
async function regenerateModernVisuals(event: any, params: any) {
  if (!activeProjectPath) return { success: false, error: 'No hay proyecto activo para regenerar Visuales modernos.' }
  if (!Array.isArray(params?.modernVisuals) || params.modernVisuals.length === 0)
    return { success: false, error: 'No se recibió contexto de Visuales modernos.' }

  try {
    const requested: Array<{ clipId: string; context: unknown }> = params.modernVisuals.map((entry: any, index: number) => ({
      clipId: typeof entry?.clipId === 'string' && entry.clipId
        ? entry.clipId : `modern-visual-${index + 1}`,
      context: entry?.context ?? entry?.visualRegeneration ?? entry,
    }))
    const resolved = resolveModernVisualGenerationBatchV1({
      contexts: requested.map(entry => entry.context),
      projectRoot: activeProjectPath,
    })
    const outputs: any[] = new Array(resolved.length)
    const groups = new Map<string, Array<{ index: number; context: any; resolved: any }>>()
    for (let index = 0; index < resolved.length; index++) {
      const entry = resolved[index]
      const key = entry.context.sistema
      const group = groups.get(key) ?? []
      group.push({ index, ...entry })
      groups.set(key, group)
    }

    for (const [sistema, group] of groups) {
      const rendered = await renderGraphicClipsLote(
        group.map(entry => ({
          graphicData: entry.resolved.compiled.graphicData,
          renderBindings: entry.resolved.compiled.renderBindings,
          projectRoot: activeProjectPath!,
          diagnosticSceneId: entry.resolved.decision.sceneId,
          duracion: entry.context.duration,
        })),
        { aspectRatio: params.aspectRatio, resolution: params.resolution, fps: 30, modo: 'pantalla', sistema },
        (progress) => event.sender?.send?.('generation-progress', {
          ...progress,
          type: 'Visual regenerado',
        }),
      )
      for (let offset = 0; offset < group.length; offset++) {
        const entry = group[offset]
        const ruta = rendered.rutas?.[offset] ?? null
        if (!ruta || !(await exists(ruta))) {
          outputs[entry.index] = {
            id: requested[entry.index].clipId,
            success: false,
            sceneId: entry.resolved.decision.sceneId,
            error: 'VISUAL_REGENERATION_RENDER_FAILED',
            visualRegeneration: entry.context,
          }
          continue
        }
        outputs[entry.index] = {
          id: requested[entry.index].clipId,
          success: true,
          sceneId: entry.resolved.decision.sceneId,
          name: path.basename(ruta),
          path: ruta,
          url: urlDeRuta(ruta),
          durationSeconds: await getVideoDuration(ruta),
          type: 'video',
          category: 'visual',
          visualRegeneration: entry.context,
        }
      }
    }
    await writeDebugLog(`[regenerate-graphics] Modernos: ${outputs.filter(entry => entry?.success).length}/${outputs.length} regenerados sin LLM.`)
    return { success: true, mode: 'modern-visual', clips: outputs }
  } catch (error: any) {
    await writeDebugLog(`[regenerate-graphics] Modernos fallaron: ${error?.code ?? error?.message ?? error}`)
    return { success: false, error: error?.message ?? 'No se pudo regenerar el Visual moderno.', code: error?.code }
  }
}

ipcMain.handle('regenerate-graphics', async (event, params: any) => {
  if (params?.mode === 'modern-visual') return regenerateModernVisuals(event, params)
  const { clips, graphicsPercent } = params;
  const logMessage = async (msg: string) => {
    console.log(msg);
    await writeDebugLog(msg);
  };
  try {
    await logMessage('[regenerate-graphics] Iniciando...');
    loadEnv(true);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { success: false, error: 'No se configuró DEEPSEEK_API_KEY en el archivo .env' };

    const totalClips = clips.length;
    let audioSegs = params.audioSegments || [];

    if (params.audioPath && params.audioPath.length > 0) {
      try {
        await logMessage('[REGEN] Re-transcribiendo audio con word_timestamps...');
        const transcriptsDir = path.join(
          path.dirname(params.audioPath), 'transcripts');
        await fs.promises.mkdir(transcriptsDir, { recursive: true });
        const audioFileName = path.basename(
          params.audioPath, path.extname(params.audioPath));
        const expectedJson = path.join(
          transcriptsDir, audioFileName + '.json');
        
        await new Promise<void>((resolve) => {
          const whisper = spawn('whisper', [
            // Entrecomillado: con shell:true, una ruta con espacios —C:\Mis Videos\...— se
            // partiria en varios argumentos y whisper no encontraria el fichero. Los otros
            // dos sitios ya lo hacian; este era el unico que no.
            `"${params.audioPath}"`,
            '--language', 'Spanish',
            '--model', MODELO_WHISPER,
            '--output_format', 'json',
            '--output_dir', transcriptsDir,
            '--word_timestamps', 'True'
          ], { shell: true, env: { 
            ...process.env, PYTHONIOENCODING: 'utf-8' 
          }});
          whisper.on('close', () => resolve());
          whisper.on('error', () => resolve());
        });
        
        if (await exists(expectedJson)) {
          const raw = await fs.promises.readFile(expectedJson, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.segments)) {
            audioSegs = parsed.segments.map((seg: any) => ({
              start: seg.start,
              end: seg.end,
              text: seg.text,
              words: (seg.words || []).map((w: any) => ({
                word: w.word,
                start: w.start,
                end: w.end
              }))
            }));
            await logMessage('[REGEN] Re-transcripcion exitosa: ' + 
              audioSegs.length + ' segmentos con word_timestamps');
          }
        }
      } catch (err: any) {
        await logMessage('[REGEN] Error re-transcribiendo: ' + err.message);
      }
    }
    const totalPhrases = audioSegs.length > 0 ? audioSegs.length : totalClips;
    const targetGraphicsCount = Math.min(
      totalPhrases,
      Math.round((graphicsPercent / 100) * totalPhrases)
    );
    console.log('[DEBUG_REGEN] clips.length:', clips.length,
      'audioSegs.length:', audioSegs.length,
      'graphicsPercent:', graphicsPercent,
      'primer clip phraseIdx:', clips[0]?.phraseIdx,
      'targetGraphicsCount:', targetGraphicsCount);
    console.log(`[regenerate-graphics] Clips totales: ${totalClips}, Gráficos a generar: ${targetGraphicsCount}`);

    let generatedClips = clips.map((c: any) => ({ ...c }));
    const clipsRef = generatedClips;

    if (targetGraphicsCount <= 0) {
      return { success: true, clips: generatedClips };
    }

    // Usar audioSegments para contexto de frases
    // La lista de palabras vacias vive en shared/palabra.ts, no aqui.
    
    // Procesar en secciones para distribucion uniforme
    const allPhrases: any[] = [];
    const sectionSize = Math.ceil(audioSegs.length / targetGraphicsCount);
    
    for (let s = 0; s < targetGraphicsCount; s++) {
      const sStart = s * sectionSize;
      const sEnd = Math.min(sStart + sectionSize, audioSegs.length);
      if (sStart >= audioSegs.length) break;
      const sectionSegs = audioSegs.slice(sStart, sEnd);
      
      const sectionFragmentos = sectionSegs.map((seg: any, idx: number) => {
        const phraseNum = sStart + idx + 1;
        const duration = (seg.end - seg.start).toFixed(2);
        const wordsStr = seg.words && seg.words.length > 0
          ? seg.words.slice(0, 5).map((w: any) => {
              const rel = Math.max(0, parseFloat((w.start - seg.start).toFixed(2)));
              return w.word.trim() + '=' + rel + 's';
            }).join(', ')
          : '';
        return '[Frase ' + phraseNum + '] "' + seg.text + '" (dur:' + duration + 
          's' + (wordsStr ? ', palabras:' + wordsStr : '') + ')';
      }).join('\n');

      const sectionPrompt = 'Eres un motion designer.\nElige EXACTAMENTE 1 frase de esta seccion para un grafico impactante.\n' +
        'TIPO A si hay datos: contador, barra_horizontal, flecha_crecimiento, barras_comparativas, ranking_top3, lista_numerada, pasos_proceso.\n' +
        'TIPO B si no hay datos: decorativo_emoji con emoji especifico y label, o frase_clave con texto impactante.\n' +
        'graphicStart: timestamp de la palabra clave (relativo al inicio de la frase). graphicEnd = graphicStart + 2.0\n' +
        'Responde SOLO JSON.\nFRASES:\n' + sectionFragmentos + '\n' +
        'FORMATO: {"phrases":[{"phraseIndex":' + (sStart+1) + ',"graphic":{"type":"decorativo_emoji","value":null,"label":"Concepto","unit":"","emoji":"🔥","extra":null,"graphicStart":0.5,"graphicEnd":2.5}},{"phraseIndex":' + (sStart+2) + ',"graphic":null}]}';

      try {
        const dsResp = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'deepseek-v4-pro',
            messages: [
              { role: 'system', content: 'Responde UNICAMENTE con JSON valido.' },
              { role: 'user', content: sectionPrompt }
            ],
            temperature: 0.3,
            max_tokens: 8000,
            thinking: { type: 'disabled' }
          })
        });
        if (dsResp.ok) {
          const dsData = (await dsResp.json()) as any;
          let content = (dsData?.choices?.[0]?.message?.content || '').trim();
          if (content.includes('{')) content = content.substring(content.indexOf('{'), content.lastIndexOf('}')+1);
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.phrases)) {
            allPhrases.push(...parsed.phrases);
          }
        } else {
          const errBody = await dsResp.text().catch(() => '');
          await logMessage('[REGEN] DeepSeek HTTP ' + dsResp.status + ': ' + errBody.slice(0, 300));
        }
      } catch (err: any) {
        await logMessage('[REGEN] Error seccion ' + s + ': ' + err.message);
      }
    }

    if (allPhrases.length > 0) {
      const parsed = { phrases: allPhrases };
      if (Array.isArray(parsed.phrases)) {
        // Limitar al numero exacto pedido
        let gCount = 0;
        const limitedPhrases = parsed.phrases.map((p: any) => {
          if (p.graphic !== null && p.graphic !== undefined) {
            gCount++;
            if (gCount > targetGraphicsCount) return { ...p, graphic: null };
          }
          return p;
        });
        
        // Asignar graficos a clips usando phraseIdx
        limitedPhrases.forEach((p: any) => {
          if (!p.graphic) return;
          const phraseIdx = p.phraseIndex - 1;
          const seg = audioSegs[phraseIdx];
          
          // Calcular graphicStart con word_timestamps
          let graphicStart = p.graphic.graphicStart || 0.3;
          if (seg && seg.words && seg.words.length > 0) {
            const segStart = seg.start || 0;
            const keyWord = seg.words.find((w: any) => tieneSignificado(w.word));
            if (keyWord) {
              const relative = Math.max(0, parseFloat((keyWord.start - segStart).toFixed(2)));
              const phraseDuration = seg.end - seg.start;
              graphicStart = Math.min(relative, phraseDuration * 0.7);
            }
          }
          
          const absoluteStart = seg ? seg.start + graphicStart : graphicStart;
          const durSec = Math.min(2.0, (p.graphic.graphicEnd || graphicStart + 2) - (p.graphic.graphicStart || 0));
          
          // Encontrar clips de esta frase por phraseIdx
          const phraseClips = clipsRef.filter((c: any) => c.phraseIdx === phraseIdx);
          const targetClip = phraseClips[0] || clipsRef.find((c: any) => {
            const clipStart = c.startSeconds || 0;
            return seg && clipStart >= seg.start - 0.5 && clipStart <= seg.end;
          });
          
          if (targetClip) {
            targetClip.graphicData = p.graphic;
            targetClip.graphicData.graphicStart = graphicStart;
            targetClip.graphicData.graphicEnd = graphicStart + durSec;
            targetClip.graphicAbsoluteStart = absoluteStart;
            targetClip.graphicDuration = durSec;
          }
        });
      }
    }
    return { success: true, clips: generatedClips };
  } catch (err: any) {
    console.error('Error en regenerate-graphics:', err);
    // Fallback: asignar gráficos simulados en base al porcentaje
    const targetGraphicsCount = Math.round((graphicsPercent / 100) * clips.length);
    const generatedClips = clips.map((c: any, idx: number) => {
      const copy = { ...c };
      if (idx < targetGraphicsCount) {
        copy.graphicData = {
          type: 'frase_clave',
          value: 'CLAVE ' + (idx + 1),
          label: 'Concepto clave'
        };
      }
      return copy;
    });
    return { success: true, clips: generatedClips };
  }
});

ipcMain.handle('generate-perfect-sync', async (event, {
  videoPath,
  transcriptSegments,
  syncWeights,
  aspectRatio,
  audioPath,
  iaStyle,
  activeProjectPath: projPath
}) => {
  const logMessage = async (msg: string) => {
    console.log(msg);
    await writeDebugLog(msg);
  };

  try {
    await logMessage('[generate-perfect-sync] Iniciando...');
    loadEnv(true);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { success: false, error: 'No DEEPSEEK_API_KEY' };
    const pexelsApiKey = process.env.PEXELS_API_KEY;
    const falApiKey = process.env.FAL_KEY;
    if (falApiKey) process.env.FAL_KEY = falApiKey;

    if (!videoPath || !(await exists(videoPath))) {
      return { success: false, error: 'No se encontró el video: ' + videoPath };
    }

    const duracionTotal = await getVideoDuration(videoPath);
    await logMessage('[FASE 1] Duración total: ' + duracionTotal + 's');

    const stockWeight = syncWeights[1] ?? 35;
    const iaWeight = syncWeights[2] ?? 25;
    const segs = transcriptSegments || [];
    const BATCH_SIZE = 25;

    let totalVisualClipsCount = 0;
    segs.forEach((seg: any) => {
      const dur = seg.end - seg.start;
      totalVisualClipsCount += dur > 4.0 ? Math.ceil(dur / 3.0) : 1;
    });

    let targetStockClips = Math.round((stockWeight / 100) * totalVisualClipsCount);
    let targetIaClips = Math.round((iaWeight / 100) * totalVisualClipsCount);
    if (targetStockClips + targetIaClips > totalVisualClipsCount) {
      const sum = targetStockClips + targetIaClips;
      targetStockClips = Math.floor((targetStockClips / sum) * totalVisualClipsCount);
      targetIaClips = totalVisualClipsCount - targetStockClips;
    }
    const targetVacioSlots = totalVisualClipsCount - targetStockClips - targetIaClips;

    await logMessage('[FASE 1] Total: ' + totalVisualClipsCount +
      ' Stock: ' + targetStockClips + ' IA: ' + targetIaClips +
      ' Vacíos: ' + targetVacioSlots);

    // FASE 2 — DeepSeek en lotes
    let phrasesDecision: any[] = [];

    for (let batchStart = 0; batchStart < segs.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, segs.length);
      const batchSegs = segs.slice(batchStart, batchEnd);

      const batchVisualCount = batchSegs.reduce((acc: number, seg: any) => {
        const dur = seg.end - seg.start;
        return acc + (dur > 4.0 ? Math.ceil(dur / 3.0) : 1);
      }, 0);

      const batchStock = Math.round((targetStockClips / totalVisualClipsCount) * batchVisualCount);
      const batchIa = Math.round((targetIaClips / totalVisualClipsCount) * batchVisualCount);
      const batchVacio = batchVisualCount - batchStock - batchIa;

      const batchFragmentos = batchSegs.map((seg: any, idx: number) => {
        const phraseNum = batchStart + idx + 1;
        const dur = seg.end - seg.start;
        const count = dur > 4.0 ? Math.ceil(dur / 3.0) : 1;
        return '[Frase ' + phraseNum + '] "' + seg.text + '" (' +
          Number(seg.start).toFixed(1) + 's-' + Number(seg.end).toFixed(1) +
          's, ' + dur.toFixed(2) + 's). Requiere ' + count + ' sub-clip(s).';
      }).join('\n');

      const batchPrompt = 'Eres un editor de video experto.\n' +
        'El video original corre en v1. Los clips de stock e IA van en v2 como overlay.\n' +
        'Para cada frase decide si poner un clip encima del video original o dejarlo solo.\n' +
        'SOLO usa tipos: stock, ia, vacio.\n' +
        'vacio = se ve solo el video original sin overlay.\n' +
        'De ' + batchVisualCount + ' sub-clips asigna exactamente:\n' +
        '- ' + batchStock + ' de tipo stock\n' +
        '- ' + batchIa + ' de tipo ia\n' +
        '- ' + batchVacio + ' de tipo vacio\n' +
        'Para stock: keyword en inglés corta para Pexels.\n' +
        'Para ia: prompt descriptivo en inglés.\n' +
        'Para vacio: no necesita keyword ni prompt.\n' +
        'FRASES:\n' + batchFragmentos + '\n' +
        'Responde SOLO JSON:\n' +
        '{"phrases":[{"phraseIndex":1,"visualClips":[{"type":"stock","keyword":"example","duration":2.5}]}]}';

      event.sender.send('generation-progress', {
        index: batchStart,
        total: segs.length,
        paragraph: 'Analizando frases ' + (batchStart+1) + '-' + batchEnd + '...',
        type: 'DeepSeek'
      });

      try {
        await logMessage('[FASE 2] Lote ' + (Math.floor(batchStart/BATCH_SIZE)+1));
        const dsResp = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({
            model: 'deepseek-v4-pro',
            messages: [
              { role: 'system', content: 'Responde UNICAMENTE con JSON valido.' },
              { role: 'user', content: batchPrompt }
            ],
            temperature: 0.2,
            max_tokens: 8000,
            thinking: { type: 'disabled' }
          })
        });
        if (dsResp.ok) {
          const dsData = (await dsResp.json()) as any;
          let content = (dsData?.choices?.[0]?.message?.content || '').trim();
          if (content.includes('{')) {
            content = content.substring(content.indexOf('{'), content.lastIndexOf('}')+1);
          }
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.phrases)) {
            phrasesDecision.push(...parsed.phrases);
          }
        } else {
          const errBody = await dsResp.text().catch(() => '');
          await logMessage('[FASE 2] DeepSeek HTTP ' + dsResp.status + ': ' + errBody.slice(0, 300));
        }
      } catch (err: any) {
        await logMessage('[FASE 2] Error lote: ' + err.message);
      }
    }

    // Forzar porcentajes post-DeepSeek
    const allDecided: any[] = [];
    phrasesDecision.forEach((p: any) => {
      (p.visualClips || p.clips || []).forEach((vc: any) => allDecided.push(vc));
    });
    const currentVacio = allDecided.filter((c: any) => c.type === 'vacio').length;
    if (currentVacio < targetVacioSlots * 0.8) {
      const deficit = targetVacioSlots - currentVacio;
      const step = Math.floor(allDecided.length / (deficit + 1)) || 1;
      let converted = 0;
      phrasesDecision.forEach((p: any) => {
        (p.visualClips || p.clips || []).forEach((vc: any, idx: number) => {
          if (converted < deficit && vc.type === 'stock') {
            const gi = phrasesDecision.indexOf(p) * 3 + idx;
            if (gi % step === 0) { vc.type = 'vacio'; converted++; }
          }
        });
      });
      await logMessage('[POST-DS] Vacíos forzados: ' + converted);
    }

    // FASE 3 — Generar clips físicos para v2
    const outDir = projPath
      ? dirMat(projPath, 'pista-v2')
      : path.join(getBancoClipsPath(), 'sync-perfecta');
    if (!(await exists(outDir))) {
      await fs.promises.mkdir(outDir, { recursive: true });
    }

    const v2Clips: any[] = [];
    let globalClipIdx = 0;

    for (let phraseIdx = 0; phraseIdx < segs.length; phraseIdx++) {
      const seg = segs[phraseIdx];
      const phraseDuration = seg.end - seg.start;
      const phraseStart = seg.start;
      const numClips = phraseDuration > 4.0 ? Math.ceil(phraseDuration / 3.0) : 1;

      const match = phrasesDecision.find((p: any) =>
        p && (p.phraseIndex === phraseIdx + 1 || p.index === phraseIdx + 1));
      let visualClips = match?.visualClips || match?.clips;

      if (!Array.isArray(visualClips) || visualClips.length === 0) {
        visualClips = Array(numClips).fill(null).map(() => ({
          type: 'vacio', duration: phraseDuration / numClips
        }));
      }

      let clipOffset = 0;
      for (let ci = 0; ci < visualClips.length; ci++) {
        const vc = visualClips[ci];
        const clipStart = phraseStart + clipOffset;
        const clipDur = parseFloat((vc.duration || (phraseDuration / numClips)).toFixed(2));
        clipOffset += clipDur;

        if (vc.type === 'vacio' || vc.type === 'original') continue;

        const clipNum = ++globalClipIdx;
        event.sender.send('generation-progress', {
          index: clipNum,
          total: targetStockClips + targetIaClips,
          paragraph: 'Generando clip ' + clipNum + ' de ' + (targetStockClips + targetIaClips) + '...',
          type: vc.type === 'ia' ? 'IA' : 'Stock'
        });

        const clipName = 'sync_clip_' + clipNum + '.mp4';
        const clipPath = path.join(outDir, clipName);
        const escapedClip = clipPath.replace(/"/g, '\\"');
        let success = false;

        if (vc.type === 'ia') {
          try {
            let promptFinal = vc.prompt || 'cinematic video clip';
            if (iaStyle === 'cartoon') promptFinal += ', 3D cartoon Pixar style';
            else if (iaStyle === 'bw') promptFinal += ', black and white film noir';
            const result = await fal.subscribe('fal-ai/minimax/video-01', {
              input: { prompt: promptFinal }
            }) as any;
            const dlUrl = result?.video?.url || result?.data?.video?.url;
            if (!dlUrl) throw new Error('No URL fal.ai');
            const dlRes = await fetch(dlUrl);
            const buf = await dlRes.arrayBuffer();
            const tempPath = path.join(outDir, 'temp_ia_' + clipNum + '.mp4');
            await fs.promises.writeFile(tempPath, Buffer.from(buf));
            await new Promise<void>((resolve, reject) => {
              const cmd = 'ffmpeg -y -ss 0 -i "' + tempPath + '" -t ' + clipDur + ' -c:v libx264 -c:a aac "' + escapedClip + '"';
              exec(cmd, (err) => { if (err) reject(err); else resolve(); });
            });
            try { await fs.promises.unlink(tempPath); } catch(e) {}
            success = true;
          } catch (e: any) {
            await logMessage('[FASE 3] Error IA clip ' + clipNum + ': ' + e.message);
          }
        }

        if (vc.type === 'stock' || (!success && vc.type !== 'ia')) {
          try {
            if (!pexelsApiKey) throw new Error('No PEXELS_API_KEY');
            const isVert = aspectRatio === '9:16' || aspectRatio === 'vertical';
            const orient = isVert ? 'portrait' : 'landscape';
            const pUrl = 'https://api.pexels.com/videos/search?query=' +
              encodeURIComponent(vc.keyword || 'broll') + '&per_page=5&orientation=' + orient;
            const pRes = await fetch(pUrl, { headers: { 'Authorization': pexelsApiKey } });
            const pData = await pRes.json() as any;
            const vid = pData?.videos?.[0];
            if (!vid) throw new Error('No video Pexels');
            const files = vid.video_files || [];
            const best = files.find((f: any) => f.quality === 'hd' || f.width >= 720) || files[0];
            const dlUrl = best?.link;
            if (!dlUrl) throw new Error('No link Pexels');
            const stockDir = path.join(getBancoClipsPath(), 'stock');
            if (!(await exists(stockDir))) await fs.promises.mkdir(stockDir, { recursive: true });
            const rawPath = path.join(stockDir, 'pexels_' + vid.id + '_raw.mp4');
            if (!(await exists(rawPath))) {
              const dlRes = await fetch(dlUrl);
              const buf = await dlRes.arrayBuffer();
              await fs.promises.writeFile(rawPath, Buffer.from(buf));
            }
            const filter = isVert
              ? 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setpts=0.8*PTS'
              : 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=0.8*PTS';
            const escapedRaw = rawPath.replace(/"/g, '\\"');
            await new Promise<void>((resolve, reject) => {
              const cmd = 'ffmpeg -y -ss 0 -i "' + escapedRaw + '" -vf "' + filter + '" -t ' + clipDur + ' -an "' + escapedClip + '"';
              exec(cmd, (err) => { if (err) reject(err); else resolve(); });
            });
            success = true;
          } catch (e: any) {
            await logMessage('[FASE 3] Error Stock clip ' + clipNum + ': ' + e.message);
          }
        }

        if (success && await exists(clipPath)) {
          const duration = await getVideoDuration(clipPath);
          const thumbPath = clipPath.replace('.mp4', '.jpg');
          let thumbnailUrl = '';
          try {
            await generateVideoThumbnail(clipPath, thumbPath);
            if (await exists(thumbPath)) {
              thumbnailUrl = 'data:image/jpeg;base64,' +
                (await fs.promises.readFile(thumbPath)).toString('base64');
            }
          } catch(e) {}
          v2Clips.push({
            id: 'sync-v2-' + clipNum,
            name: clipName,
            startSeconds: clipStart,
            durationSeconds: duration || clipDur,
            type: 'video',
            category: vc.type,
            path: clipPath,
            url: urlDeRuta(clipPath),
            thumbnailUrl
          });
        }
      }
    }

    // FASE 4 — Ensamblar
    const v1Clip = {
      id: 'v1-original-' + Date.now(),
      name: path.basename(videoPath),
      startSeconds: 0,
      durationSeconds: duracionTotal,
      type: 'video',
      category: 'original',
      path: videoPath,
      url: urlDeRuta(videoPath)
    };

    // El clip de audio tiene que vivir DENTRO del proyecto. Si el frontend ya mando el audio
    // maestro extraido se reutiliza; si mando el video del usuario —lo que pasa cuando no se
    // ha pulsado "Usar Audio Original"— se extrae aqui. Sin esto el clip de tipo audio era el
    // .mp4 entero del usuario y el proyecto volvia a depender de un fichero externo.
    let audioFinal = audioPath;
    let audioDuracion = duracionTotal;
    let audioExterno = false;

    if (!projPath) {
      audioExterno = true;
      await logMessage('[FASE 4] Sin proyecto activo: el audio se queda fuera.');
    } else if (!audioFinal || !dentroDelProyecto(audioFinal, projPath)) {
      event.sender.send('generation-progress', {
        index: 0, total: 1,
        paragraph: 'Extrayendo el audio del proyecto...',
        type: 'Audio'
      });
      try {
        const extraido = await extraerAudioMaestro(audioFinal || videoPath, projPath);
        audioFinal = extraido.path;
        audioDuracion = extraido.durationSeconds || duracionTotal;
      } catch (e: any) {
        // No se aborta: a estas alturas ya se han generado los clips y gastado dinero en IA.
        // Se sigue con el audio externo, pero se dice. Avisarlo en la UI es cosa de PIEZA A.
        audioExterno = true;
        await logMessage('[FASE 4] No se pudo extraer el audio, queda fuera: ' + e.message);
      }
    }

    const audioClip = {
      id: 'audio-sync-' + Date.now(),
      name: 'Voz - Audio Original',
      startSeconds: 0,
      durationSeconds: audioDuracion,
      type: 'audio',
      path: audioFinal || videoPath,
      url: urlDeRuta(audioFinal || videoPath)
    };

    await logMessage('[generate-perfect-sync] Completado. v2Clips: ' + v2Clips.length);

    return {
      success: true,
      v1Clip,
      v2Clips,
      audioClip,
      // Para PIEZA A: el audio no se pudo meter dentro y el proyecto depende de un externo.
      audioExterno
    };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
