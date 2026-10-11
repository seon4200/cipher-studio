import { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } from 'electron'
import path from 'path'
import { spawn, exec } from 'child_process'
import { once } from 'events'
import { createHash } from 'crypto'
import fs from 'fs'
import { pathToFileURL } from 'url'
import { getVideoDuration, generateVideoThumbnail, formatTimeMinutesSeconds } from './services/ffmpeg'
import { fal } from '@fal-ai/client'
import { BuildRunner } from './build/runner'
import { createSceneDirector } from './build/director'
import { deepseekDirector } from './director/deepseek'
import { chatGPTDirector } from './director/chatgpt'
import { SiwcError, SiwcRuntime } from './siwc/runtime'
import { DEFAULT_DIRECTOR_MODEL } from '../shared/director-provider'
import { atomicJson, readJson, projectBusy, claimProject } from './build/storage'
import { ProjectLocationStore } from './project-location'
import { cutMedia, probe } from './build/media'
import { randomUUID } from 'crypto'
const buildRunner = new BuildRunner()
const siwc = new SiwcRuntime({ userDataPath: app.getPath('userData'), safeStorage, openExternal: value => shell.openExternal(value) })
const projectLocations = new ProjectLocationStore(app.getPath('userData'))

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
  const whisperProcess = spawn('whisper', [
    `"${filePath}"`,
    '--language', 'Spanish',
    '--model', MODELO_WHISPER,
    '--output_format', 'json',
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

          // Send the full results (segments) back to the renderer
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
  return projectLocations.getProjectsDirectory();
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
const SUB_MATERIALES = ['audio', 'voices', 'originales', 'stock', 'ia', 'pista-v2'];

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

// Solo cache/. materiales/ no se toca aqui jamas.
async function cleanupProjectTemp(projectPath: string) {
  buildRunner.cancel(projectPath);
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

async function sanitizeProjectState(parsed: any) {
  return parsed;
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
      timelineWeights: [30, 70, 0],
      directorProviderId: "deepseek",
      directorModelId: "deepseek-chat",
      transitionsPercent: 0
    };
    
    const stateFile = path.join(projectPath, 'project-state.json');
    await atomicJson(stateFile, initialState);
    await projectLocations.rememberProject(projectPath);

    // El anterior se limpia cuando el nuevo YA existe. Antes se limpiaba primero, asi que
    // si la creacion fallaba te quedabas sin el viejo y sin el nuevo.
    const anterior = activeProjectPath;
    activeProjectPath = projectPath;
    if (anterior && anterior !== projectPath) { buildRunner.cancel(anterior); await cleanupProjectTemp(anterior); }

    console.log(`[create-project] Proyecto creado en: ${projectPath}`);
    return { success: true, data: initialState, projectPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-project', async (_event, { projectPath }) => {
  try {
    const stateFile = path.join(projectPath, 'project-state.json');
    if (!(await exists(stateFile))) {
      return { success: false, error: 'No se encontró el estado del proyecto en la carpeta seleccionada.' };
    }

    const parsed = await sanitizeProjectState(await readJson<any>(stateFile));

    // Se crean las carpetas que falten, pero NO se limpia el temp del proyecto que se
    // ABRE: ahi viven sus clips. Antes era initProjectDirs -> cleanup -> initProjectDirs,
    // o sea borrar los clips y recrear las carpetas vacias. Por eso al reabrir un
    // proyecto no se veia nada: lo destruia el propio acto de abrirlo.
    await initProjectDirs(projectPath);
    await projectLocations.rememberProject(projectPath);

    // La limpieza del ANTERIOR va DESPUES de que el nuevo este cargado. Antes iba
    // primero, asi que una carga fallida destruia el viejo sin abrir el nuevo.
    const anterior = activeProjectPath;
    activeProjectPath = projectPath;
    if (anterior && anterior !== projectPath) { buildRunner.cancel(anterior); await cleanupProjectTemp(anterior); }

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
    return { success: true, data: parsed, projectPath, auditoria };
  } catch (err: any) {
    return { success: false, error: err.message };
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

  // -vn quita el video. Se recodifica a AAC en vez de -c:a copy porque la pista de origen
  // puede venir en un formato que el <audio> del renderer no reproduzca.
  const cmd = `ffmpeg -y -i "${videoPath.replace(/"/g, '\\"')}" -vn -c:a aac -b:a 128k ` +
    `-movflags +faststart "${destino.replace(/"/g, '\\"')}"`;
  await new Promise<void>((res, rej) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => err ? rej(err) : res());
  });
  if (!(await exists(destino))) throw new Error('ffmpeg no genero el audio.');

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
const MAX_INTENTOS_CAPTURA = 6;
const ESPERA_REINTENTO_CAPTURA_MS = 100;

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
function hashGrafico(graphicData: any, ancho: number, alto: number,
                     duracion: number, fps: number): string {
  const g = graphicData || {};
  const partes = [
    canonizar(g.type), canonizar(g.value), canonizar(g.label),
    canonizar(g.unit), canonizar(g.emoji), canonizar(g.extra),
    // La duracion SI entra: 2s y 3s son animaciones distintas, no la misma estirada.
    String(ancho), String(alto), String(duracion), String(fps)
  ];
  return createHash('sha1').update(partes.join('|')).digest('hex').slice(0, 12);
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

  await v.webContents.executeJavaScript('window.__listo()');
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


async function capturarPaginaConReintentos(webContents: BrowserWindow['webContents']) {
  let ultimoError: unknown;
  for (let intento = 1; intento <= MAX_INTENTOS_CAPTURA; intento++) {
    try {
      return await webContents.capturePage();
    } catch (error) {
      ultimoError = error;
      const mensaje = error instanceof Error ? error.message : String(error);
      if (!mensaje.includes('UnknownVizError') || intento === MAX_INTENTOS_CAPTURA) throw error;
      await writeDebugLog(`[GRAFICO] capturePage UnknownVizError; reintento ${intento}/${MAX_INTENTOS_CAPTURA - 1} en ${ESPERA_REINTENTO_CAPTURA_MS} ms`);
      await new Promise(resolve => setTimeout(resolve, ESPERA_REINTENTO_CAPTURA_MS));
    }
  }
  throw ultimoError;
}
/**
 * Renderiza un grafico a un .mov con alpha. Devuelve la ruta, o null si falla: se pierde ese
 * grafico, nunca el export.
 *
 * TODAVIA SIN CACHE POR HASH — cada llamada renderiza. Es el paso siguiente.
 */export async function renderGraphicClip(
  graphicData: any,
  opciones: {
    ancho?: number; alto?: number; fps?: number; duracion?: number;
    modo?: 'overlay' | 'pantalla';
  } = {}
): Promise<string | null> {
  const ancho = opciones.ancho ?? 1080;
  const alto = opciones.alto ?? 1920;
  const fps = opciones.fps ?? 30;
  const duracion = opciones.duracion ?? 2;
  const modo = opciones.modo ?? 'overlay';
  const totalFrames = Math.round(duracion * fps);

  if (!activeProjectPath) {
    await writeDebugLog('[GRAFICO] Sin proyecto activo: no se renderiza.');
    return null;
  }

  // initProjectDirs ya NO crea cache/graficos —salio de SUB_CACHE en 7dd9b64 para que
  // cleanupProjectTemp deje de borrarla—, asi que la crea quien la llena. Verificado.
  const destDir = dirCache(activeProjectPath, 'graficos');
  await fs.promises.mkdir(destDir, { recursive: true });

  // El nombre ES el hash: no hay indice que mantener ni que pueda desincronizarse del disco.
  const hash = hashGrafico(graphicData, ancho, alto, duracion, fps);
  const destino = path.join(destDir, `${hash}.mov`);

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
    await v.webContents.executeJavaScript(
      `window.__montar(${JSON.stringify(graphicData)}, ` +
      `${JSON.stringify({ ancho, alto, modo })})`);

    // Que el bitmap mida lo pedido NO se da por hecho: es exactamente el fallo silencioso
    // que se midio. Si no cuadra se aborta antes de escribir un MOV cortado.
    const sonda0 = await capturarPaginaConReintentos(v.webContents);
    const tam = sonda0.getSize();
    if (tam.width !== ancho || tam.height !== alto + SONDA_ALTO) {
      throw new Error(`la ventana mide ${tam.width}x${tam.height} y se pidio ` +
        `${ancho}x${alto + SONDA_ALTO}: el MOV saldria recortado`);
    }

    // Patron NUEVO en este codigo: todo lo demas invoca ffmpeg con exec y una cadena. Aqui
    // hace falta spawn porque los frames entran por stdin y exec bufferea la salida entera.
    // El bitmap es BGRA (no RGBA) y qtrle es el unico codec verificado que conserva alpha.
    ff = spawn('ffmpeg', [
      '-y',
      '-f', 'rawvideo', '-pix_fmt', 'bgra',
      '-s', `${ancho}x${alto}`, '-r', String(fps),
      '-i', 'pipe:0',
      '-an', '-c:v', 'qtrle', '-pix_fmt', 'argb',
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
        const img = await capturarPaginaConReintentos(v.webContents);
        const raw = img.toBitmap();   // Electron 43+: copia del bitmap en sRGB
        intentosTotales++;
        // Los TRES canales, no solo uno: la sonda es gris, asi que B, G y R tienen que
        // valer lo mismo Y coincidir con lo esperado. Cuesta igual y descarta ruido.
        const b = raw[offSonda], g = raw[offSonda + 1], r = raw[offSonda + 2];
        if (b === esperado && g === esperado && r === esperado) {
          // toBitmap() ya devuelve una copia propia; se conserva una vista de sus bytes estables.
          // El subarray descarta la franja de la sonda, que no viaja a ffmpeg.
          frame = raw.subarray(bytesSonda);
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
    await writeDebugLog(`[GRAFICO] RENDER ${hash} — ${graphicData?.type} — ` +
      `${totalFrames}f ${ancho}x${alto} — ${(size / 1048576).toFixed(2)} MB — ` +
      `${Date.now() - t0} ms — ${(intentosTotales / totalFrames).toFixed(2)} intentos/frame — ` +
      `${framesEnElTope} frame(s) en el tope de ${MAX_INTENTOS_FRAME}`);
    return destino;

  } catch (e: any) {
    // Se pierde ESTE grafico, no el export. Y se dice por que.
    await writeDebugLog(`[GRAFICO] FALLO (${graphicData?.type}): ${e?.stack || e?.message || String(e)}`);
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
  peticiones: { graphicData: any; duracion?: number }[],
  opciones: { aspectRatio?: string; resolution?: string;
              fps?: number; modo?: 'overlay' | 'pantalla' } = {},
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
      const hash = hashGrafico(peticiones[i].graphicData, ancho, alto, duracion, fps);
      let cacheado = false;
      try {
        const st = await fs.promises.stat(
          path.join(dirCache(proyectoDelLote!, 'graficos'), `${hash}.mov`));
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
        { ancho, alto, fps, duracion, modo });

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

  return { rutas, total, renderizados, aciertos, fallos, sinIntentar, cancelado, motivo };
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
  let release: (() => Promise<void>) | undefined;
  try {
    if (buildRunner.isRunning(projectPath) || await projectBusy(projectPath))
      throw new Error('Cancela la construcción y espera a que se detenga antes de eliminar el proyecto.');
    release = await claimProject(projectPath);
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
  } finally { await release?.(); }
});

ipcMain.handle('delete-all-projects', async () => {
  if (buildRunner.hasActiveRuns()) return { success: false, error: 'Hay una construcción activa. Cancélala antes de eliminar proyectos.' };
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
    let release: (() => Promise<void>) | undefined;
    try {
      if (!(await fs.promises.stat(projectPath)).isDirectory()) continue;
      if (await projectBusy(projectPath)) throw new Error('Otra instancia está construyendo este proyecto.');
      release = await claimProject(projectPath);
      await fs.promises.rm(projectPath, OPCIONES_BORRADO);
      borrados++;
    } catch (err: any) {
      // Un proyecto que no se deja borrar NO puede impedir que se borren los demas.
      // Antes un solo throw salia del bucle entero y dejaba el resto intacto en silencio.
      fallidos.push({ nombre: item, error: err.code || err.message });
    } finally { await release?.(); }
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
    const targetPath = state.projectPath || activeProjectPath || process.cwd();
    if (state.projectPath && state.projectPath !== activeProjectPath)
      throw new Error('No se puede guardar un estado antiguo sobre otro proyecto.');
    const existing = await readJson<any>(path.join(targetPath, 'project-state.json')).catch(() => null);
    if (existing?.id && existing.id !== state.id) throw new Error('La identidad del proyecto no coincide.');
    const filePath = path.join(targetPath, 'project-state.json');
    const sanitized = await sanitizeProjectState(state);
    sanitized.date = Date.now();
    await atomicJson(filePath, sanitized);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-project-state', async () => {
  try {
    if (activeProjectPath) {
      const stateFile = path.join(activeProjectPath, 'project-state.json');
      if (await exists(stateFile)) {
        const parsed = await sanitizeProjectState(await readJson<any>(stateFile));
        return { success: true, data: parsed };
      }
    }
    // Backward compatibility fallback to process.cwd()
    const filePath = path.join(process.cwd(), 'project-state.json');
    if (await exists(filePath)) {
      const parsed = await sanitizeProjectState(await readJson<any>(filePath));
      return { success: true, data: parsed };
    }
    return { success: false, error: 'No se encontró proyecto activo.' };
  } catch (err: any) {
    return { success: false, error: err.message };
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
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Guardar Proyecto Como',
      defaultPath: activeProjectPath ? path.join(activeProjectPath, 'project-state.json') : path.join(process.cwd(), 'project-state.json'),
      filters: [{ name: 'JSON Project', extensions: ['json'] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: 'Guardado cancelado por el usuario' };
    }
    const sanitized = await sanitizeProjectState(state);
    sanitized.date = Date.now();
    await atomicJson(filePath, sanitized);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
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
    
    const parsed = await sanitizeProjectState(await readJson<any>(filePath));

    // Mismo criterio que load-project: NO se limpia el temp del proyecto que se abre,
    // y el anterior se limpia solo cuando el nuevo ya esta cargado.
    await initProjectDirs(projectPath);
    await projectLocations.rememberProject(projectPath);

    const anterior = activeProjectPath;
    activeProjectPath = projectPath;
    if (anterior && anterior !== projectPath) { buildRunner.cancel(anterior); await cleanupProjectTemp(anterior); }

    return { success: true, data: parsed, projectPath };
  } catch (err: any) {
    return { success: false, error: err.message };
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

// Manual bank slicing is separate from the durable build outputs and never empties
// materiales/originales. Each batch gets unique names, including its thumbnails.
ipcMain.handle('cut-video-clips', async (_event, { videoPath, timestamps, aspectRatio = '16:9' }) => {
  try {
    const project = activeProjectPath;
    const bankDir = project ? dirMat(project, 'originales') : path.join(getBancoClipsPath(), 'originales');
    const batch = randomUUID();
    const source = await probe(videoPath);
    const starts: number[] = timestamps?.length ? timestamps :
      Array.from({ length: Math.ceil(source.duration / 3) }, (_, i) => i * 3);
    const clips: any[] = [];
    for (let i = 0; i < starts.length; i++) {
      if (activeProjectPath !== project) throw new Error('El proyecto cambió; los segmentos terminados se conservaron.');
      const start = starts[i];
      if (!Number.isFinite(start) || start < 0 || start >= source.duration)
        throw new Error('El intervalo de corte está fuera del vídeo fuente.');
      const frames = Math.min(90, Math.floor((source.duration - start) * 30 + 0.000001));
      if (frames < 1) continue;
      const file = path.join(bankDir, `bank-${batch}-${i}.mp4`);
      const result = await cutMedia(videoPath, file, start, frames, aspectRatio);
      clips.push({ id: `bank-${batch}-${i}`, name: path.basename(file), path: file,
        url: urlDeRuta(file), durationSeconds: result.duration,
        duration: formatTimeMinutesSeconds(result.duration), type: 'video', category: 'original',
        size: `${((await fs.promises.stat(file)).size / (1024 * 1024)).toFixed(2)} MB`, thumbnailUrl: '' });
    }
    return { success: true, clips };
  } catch (e: any) { return { success: false, error: e.message }; }
});

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
ipcMain.handle('export-video', async (event, { clips, aspectRatio, resolution, format, quality, assignedTransitions, transitionDuration, ajustesVideo, projectPath }) => {
  try {
    if (projectPath) requireBuildProject(projectPath);
    if (activeProjectPath) await buildRunner.validateExport(activeProjectPath, clips);
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
            const cmd = `ffmpeg -y -i "${escapedIn}" ${vf} -r 30 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an ${trim}"${escapedNorm}"`;
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

      await writeDebugLog(`[EXPORT] Concatenando...`);
      const concatStart = Date.now();

      let ffmpegCmd = '';
      if (audioClip && audioClip.path && (await exists(audioClip.path))) {
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
          try { await fs.promises.rmdir(normDir); } catch (e) {}
          if (err) reject(err); else resolve();
        });
      });

      await writeDebugLog(`[EXPORT] Concat: ${((Date.now() - concatStart) / 1000).toFixed(1)}s`);
    }

    event.sender.send('export-progress', { 
      step: 'done', 
      current: videoClipsOnly.length, 
      total: videoClipsOnly.length, 
      message: 'Exportacion completada' 
    });

    const exportEnd = Date.now();
    const exportSeconds = ((exportEnd - exportStart) / 1000).toFixed(1);
    const fileStats = await fs.promises.stat(filePath);
    const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(1);
    await writeDebugLog(`[EXPORT] Completado en ${exportSeconds}s — archivo: ${fileSizeMB}MB — calidad: ${quality}`);

    return { success: true, filePath }
  } catch (err: any) {
    console.error(`[export-video] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

// 1B: the renderer supplies the captured project, never an implicit mutable target.
function requireBuildProject(projectPath: string) {
  if (!activeProjectPath || path.resolve(projectPath || '') !== path.resolve(activeProjectPath))
    throw new Error('El proyecto activo cambió. Vuelve a abrir el proyecto solicitado.');
}
ipcMain.handle('get-build-state', async (_event, { projectPath }) => {
  try { requireBuildProject(projectPath); return { success: true, summary: await buildRunner.inspect(projectPath) }; }
  catch (e: any) { return { success: false, error: e.message }; }
});
ipcMain.handle('cancel-build', async (_event, { projectPath }) => {
  try { requireBuildProject(projectPath); buildRunner.cancel(projectPath); return { success: true }; }
  catch (e: any) { return { success: false, error: e.message }; }
});
function requireCipherWindow(event: Electron.IpcMainInvokeEvent) {
  if (!win || win.isDestroyed() || event.sender !== win.webContents || event.senderFrame !== event.sender.mainFrame)
    throw new Error('La solicitud no procede de la ventana principal de Cipher.');
}
function siwcErrorResult(error: any) {
  return { success: false, code: error instanceof SiwcError ? error.code : 'AUTH_FAILED',
    error: error instanceof Error ? error.message : 'No se pudo completar la operación de ChatGPT.' };
}
ipcMain.handle('director-state', async event => {
  try {
    requireCipherWindow(event); loadEnv();
    return { success: true, state: await siwc.getState(), deepseekConfigured: !!process.env.DEEPSEEK_API_KEY };
  } catch (error: any) { return siwcErrorResult(error); }
});
ipcMain.handle('director-connect', async (event, profileId?: string) => {
  try { requireCipherWindow(event); return { success: true, state: await siwc.signIn(profileId) }; }
  catch (error: any) { return { ...siwcErrorResult(error), state: await siwc.getState().catch(() => null) }; }
});
ipcMain.handle('director-cancel-login', async event => {
  try { requireCipherWindow(event); siwc.cancelSignIn(); return { success: true }; }
  catch (error: any) { return siwcErrorResult(error); }
});
ipcMain.handle('director-select-account', async (event, profileId: string) => {
  try { requireCipherWindow(event); return { success: true, state: await siwc.selectProfile(profileId) }; }
  catch (error: any) { return siwcErrorResult(error); }
});
ipcMain.handle('director-models', async (event, profileId?: string) => {
  try { requireCipherWindow(event); return { success: true, models: await siwc.listModels(profileId) }; }
  catch (error: any) { return siwcErrorResult(error); }
});
ipcMain.handle('director-disconnect', async (event, profileId?: string) => {
  try { requireCipherWindow(event); return { success: true, ...(await siwc.disconnect(profileId)) }; }
  catch (error: any) { return siwcErrorResult(error); }
});
ipcMain.handle('generate-timeline-assets', async (event, params) => {
  try {
    requireCipherWindow(event);
    requireBuildProject(params.projectPath);
    if (params.audioStartSeconds !== 0) throw new Error('El audio principal debe empezar en cero.');
    const providerId = params.director?.providerId;
    const modelId = params.director?.modelId;
    let selectedDirector: ReturnType<typeof createSceneDirector>;
    if (providerId === 'deepseek') {
      loadEnv(true);
      if (modelId !== DEFAULT_DIRECTOR_MODEL) throw new Error('El modelo de DeepSeek seleccionado no está disponible.');
      selectedDirector = createSceneDirector(deepseekDirector);
    } else if (providerId === 'chatgpt') {
      const profileId = params.director?.profileId;
      if (typeof profileId !== 'string' || !profileId || typeof modelId !== 'string' || !modelId)
        throw new SiwcError('MODEL_UNAVAILABLE', 'Selecciona una cuenta y un modelo de ChatGPT disponibles.');
      const catalog = await siwc.listModels(profileId);
      if (!catalog.some(item => item.slug === modelId))
        throw new SiwcError('MODEL_UNAVAILABLE', 'El modelo guardado ya no está disponible para esta cuenta. Elige otro.');
      selectedDirector = createSceneDirector(chatGPTDirector(siwc, profileId, modelId));
    } else {
      throw new SiwcError('MODEL_UNAVAILABLE', 'Este proveedor todavía no está conectado.');
    }
    return await buildRunner.run({ projectPath: params.projectPath, scriptText: params.scriptText,
      audioPath: params.audioPath, audioDuration: params.audioDuration, videoPath: params.videoPath || '',
      weights: params.weights, aspectRatio: params.aspectRatio,
      segments: params.newAudioSegments, originalAudio: params.originalAudio },
      params.mode === 'continue' ? 'continue' : params.mode === 'plan-only' ? 'plan-only' : 'new', params.expectedPlanId || null, progress => {
        if (!event.sender.isDestroyed() && activeProjectPath === params.projectPath)
          event.sender.send('generation-progress', { ...progress, requestId: params.requestId });
      }, selectedDirector, { providerId, requestedModelId: modelId });
  } catch (e: any) { return { success: false, code: e?.code || 'BUILD_ERROR', error: e.message }; }
});

ipcMain.handle('regenerate-graphics', async (_event, params: any) => {
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
    const stopWords = ['el','la','los','las','un','una','de','del','al','en','y','a','que','se','es','por','con','su','sus','lo','le','les','me','te','nos','para','como','pero','mas','más','si','no','ya'];
    
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
            const keyWord = seg.words.find((w: any) => {
                const clean = w.word.trim().toLowerCase().replace(/[^a-záéíóúñ]/g, '');
                return clean.length > 2 && !stopWords.includes(clean);
              });
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
