import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { spawn, exec } from 'child_process'
import fs from 'fs'
import { getVideoDuration, generateVideoThumbnail, formatTimeMinutesSeconds, getVideoDimensions } from './services/ffmpeg'
import { fal } from '@fal-ai/client'

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
    '--model', 'tiny',
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

async function cleanupProjectTemp(projectPath: string) {
  const tempPath = path.join(projectPath, 'temp');
  if (await exists(tempPath)) {
    try {
      await fs.promises.rm(tempPath, { recursive: true, force: true });
      console.log(`[cleanupProjectTemp] Temporales eliminados en: ${tempPath}`);
    } catch (e) {
      console.error(`[cleanupProjectTemp] Error al eliminar temporales:`, e);
    }
  }
}

async function initProjectDirs(projectPath: string) {
  const folders = [
    'voices',
    'temp',
    'temp/originales',
    'temp/remotion',
    'temp/hyperframes',
    'temp/minimax',
    'temp/stock',
    'temp/thumbnails'
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
    
    if (activeProjectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    
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
      timelineWeights: [40, 30, 20, 10]
    };
    
    const stateFile = path.join(projectPath, 'project-state.json');
    await fs.promises.writeFile(stateFile, JSON.stringify(initialState, null, 2), 'utf8');
    
    activeProjectPath = projectPath;
    console.log(`[create-project] Proyecto creado en: ${projectPath}`);
    return { success: true, data: initialState, projectPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-project', async (_event, { projectPath }) => {
  try {
    if (activeProjectPath && activeProjectPath !== projectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    
    const stateFile = path.join(projectPath, 'project-state.json');
    if (!(await exists(stateFile))) {
      return { success: false, error: 'No se encontró el estado del proyecto en la carpeta seleccionada.' };
    }
    
    await initProjectDirs(projectPath);
    await cleanupProjectTemp(projectPath);
    await initProjectDirs(projectPath); // recreate empty temp directories
    
    const raw = await fs.promises.readFile(stateFile, 'utf8');
    const parsed = await sanitizeProjectState(JSON.parse(raw));
    
    activeProjectPath = projectPath;
    console.log(`[load-project] Proyecto cargado desde: ${projectPath}`);
    return { success: true, data: parsed, projectPath };
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

ipcMain.handle('delete-project', async (_event, { projectPath }) => {
  try {
    if (activeProjectPath === projectPath) {
      activeProjectPath = null;
    }
    if (await exists(projectPath)) {
      await fs.promises.rm(projectPath, { recursive: true, force: true });
      console.log(`[delete-project] Carpeta de proyecto eliminada: ${projectPath}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-all-projects', async () => {
  try {
    const projectsDir = await getProjectsDir();
    const items = await fs.promises.readdir(projectsDir);
    for (const item of items) {
      const projectPath = path.join(projectsDir, item);
      const stat = await fs.promises.stat(projectPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(projectPath, { recursive: true, force: true });
      }
    }
    activeProjectPath = null;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
    const sanitized = await sanitizeProjectState(state);
    sanitized.date = Date.now();
    await fs.promises.writeFile(filePath, JSON.stringify(sanitized, null, 2), 'utf8');
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
        const raw = await fs.promises.readFile(stateFile, 'utf8');
        const parsed = await sanitizeProjectState(JSON.parse(raw));
        return { success: true, data: parsed };
      }
    }
    // Backward compatibility fallback to process.cwd()
    const filePath = path.join(process.cwd(), 'project-state.json');
    if (await exists(filePath)) {
      const rawData = await fs.promises.readFile(filePath, 'utf8');
      const parsed = await sanitizeProjectState(JSON.parse(rawData));
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
    await fs.promises.writeFile(filePath, JSON.stringify(sanitized, null, 2), 'utf8');
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
    
    // Check if the directory name matches projects directory hierarchy
    if (activeProjectPath && activeProjectPath !== projectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    
    await initProjectDirs(projectPath);
    await cleanupProjectTemp(projectPath);
    await initProjectDirs(projectPath);
    
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = await sanitizeProjectState(JSON.parse(raw));
    activeProjectPath = projectPath;
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
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Eres un guionista experto. Tu única tarea es reescribir la transcripción siguiendo el estilo solicitado. IMPORTANTE: Entrega ÚNICAMENTE el texto corrido del guion final resultante que será hablado de forma continua frente a la cámara. Está estrictamente PROHIBIDO incluir títulos, encabezados, viñetas, formato markdown, saludos, introducciones, notas o comentarios adicionales. Empieza a responder directamente con el primer párrafo del guion.'
          },
          { role: 'user', content: finalPrompt }
        ],
        temperature: 0.7,
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
        ? path.join(activeProjectPath, 'voices')
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
              '--model', 'tiny',
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
      ? path.join(activeProjectPath, 'temp', 'minimax')
      : path.join(process.cwd(), 'cipher-studio', 'banco-clips', 'minimax');
      
    if (!(await exists(targetDir))) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const filename = `minimax-${Date.now()}.mp4`;
    const filePath = path.join(targetDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const durationSeconds = await getVideoDuration(filePath);

    // Generate thumbnail
    const thumbFilename = `thumb-${path.basename(filename, '.mp4')}.jpg`;
    const thumbDir = activeProjectPath
      ? path.join(activeProjectPath, 'temp', 'thumbnails')
      : path.join(process.cwd(), 'cipher-studio', 'banco-clips', 'thumbnails');

    if (!(await exists(thumbDir))) {
      await fs.promises.mkdir(thumbDir, { recursive: true });
    }

    const thumbPath = path.join(thumbDir, thumbFilename);
    let thumbnailUrl = '';
    try {
      await generateVideoThumbnail(filePath, thumbPath);
      thumbnailUrl = `file:///${thumbPath.replace(/\\/g, '/')}`;
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
    const isTempCategory = ['originales', 'minimax', 'stock'].includes(category.toLowerCase())
    const useActiveProj = !!(activeProjectPath && isTempCategory)
    const baseDir = useActiveProj ? activeProjectPath! : getBancoClipsPath()
    const dirPath = useActiveProj ? path.join(baseDir, 'temp', category) : path.join(baseDir, category)
    const thumbnailDir = useActiveProj ? path.join(baseDir, 'temp', 'thumbnails') : path.join(baseDir, 'thumbnails')

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
          url: `file:///${filePath.replace(/\\/g, '/')}`,
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
    const outDir = useActiveProj ? path.join(activeProjectPath!, 'temp', 'originales') : path.join(bankDir, 'originales')
    const thumbnailDir = useActiveProj ? path.join(activeProjectPath!, 'temp', 'thumbnails') : path.join(bankDir, 'thumbnails')
    
    if (!(await exists(outDir))) {
      await fs.promises.mkdir(outDir, { recursive: true })
    }
    if (!(await exists(thumbnailDir))) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true })
    }

    // Clean up any existing clips in outDir first to avoid mixing projects
    const existingFiles = await fs.promises.readdir(outDir)
    for (const file of existingFiles) {
      try {
        await fs.promises.unlink(path.join(outDir, file))
      } catch (e) {}
    }

    const escapedVideo = videoPath.replace(/"/g, '\\"')

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
          url: `file:///${clipPath.replace(/\\/g, '/')}`,
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

// IPC handle for deleting a clip inside a category folder of banco-clips
ipcMain.handle('delete-bank-clip', async (_event, { category, file }) => {
  try {
    const isTempCategory = ['originales', 'minimax', 'stock'].includes(category.toLowerCase())
    const useActiveProj = !!(activeProjectPath && isTempCategory)
    const baseDir = useActiveProj ? activeProjectPath! : getBancoClipsPath()
    const filePath = useActiveProj ? path.join(baseDir, 'temp', category, file) : path.join(baseDir, category, file)
    
    if (await exists(filePath)) {
      await fs.promises.unlink(filePath)
    }
    const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`
    const thumbnailPath = useActiveProj 
      ? path.join(baseDir, 'temp', 'thumbnails', thumbnailName) 
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

// IPC handle for exporting video (single clip or concatenating multiple clips) with aspect ratio crop
ipcMain.handle('export-video', async (_event, { clips, aspectRatio, resolution, format, quality }) => {
  try {
    if (!win) return { success: false, error: 'Ventana no disponible' }

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

    if (!clips || clips.length === 0) {
      return { success: false, error: 'No hay clips en el Timeline para exportar.' }
    }

    // Determine target resolution width and height
    let targetW = 1920
    let targetH = 1080
    if (aspectRatio === 'vertical') {
      if (resolution === '4K') {
        targetW = 2160; targetH = 3840;
      } else if (resolution === '720p') {
        targetW = 720; targetH = 1280;
      } else { // 1080p
        targetW = 1080; targetH = 1920;
      }
    } else if (aspectRatio === 'square') {
      if (resolution === '4K') {
        targetW = 2160; targetH = 2160;
      } else if (resolution === '720p') {
        targetW = 720; targetH = 720;
      } else { // 1080p
        targetW = 1080; targetH = 1080;
      }
    } else { // horizontal
      if (resolution === '4K') {
        targetW = 3840; targetH = 2160;
      } else if (resolution === '720p') {
        targetW = 1280; targetH = 720;
      } else { // 1080p
        targetW = 1920; targetH = 1080;
      }
    }

    // Determine crop & scale filter
    let filterStr = ''
    if (aspectRatio === 'vertical') {
      filterStr = `-vf "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`
    } else if (aspectRatio === 'square') {
      filterStr = `-vf "crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`
    } else { // horizontal
      filterStr = `-vf "crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`
    }

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
        exec(ffmpegCmd, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    } else {
      // Multiple clips concatenation
      const bankDir = getBancoClipsPath()
      const tempTxtPath = path.join(bankDir, `temp_concat_${Date.now()}.txt`)
      
      let fileContent = ''
      for (const clip of clips) {
        if (clip.path && (await exists(clip.path))) {
          // Escape single quotes and backslashes for FFmpeg concat list
          const escapedPath = clip.path.replace(/\\/g, '/').replace(/'/g, "'\\''")
          fileContent += `file '${escapedPath}'\n`
        } else {
          console.warn(`[export-video] Advertencia: clip sin ruta válida en disco: ${clip.name}`)
        }
      }

      if (!fileContent.trim()) {
        return { success: false, error: 'Ninguno de los clips del Timeline tiene un archivo de origen válido en disco.' }
      }

      await fs.promises.writeFile(tempTxtPath, fileContent, 'utf8')
      const escapedTxt = tempTxtPath.replace(/"/g, '\\"')

      // Concat and crop
      const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" ${filterStr} -c:v libx264 -preset ${preset} -crf ${crf} -pix_fmt yuv420p -c:a aac "${escapedOut}"`
      
      await new Promise<void>((resolve, reject) => {
        exec(ffmpegCmd, async (err) => {
          try { await fs.promises.unlink(tempTxtPath) } catch (e) {}
          if (err) reject(err)
          else resolve()
        })
      })
    }

    return { success: true, filePath }
  } catch (err: any) {
    console.error(`[export-video] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

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
    const pexelsApiKey = process.env.PEXELS_API_KEY;

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

    const minimaxWeight = weights ? (weights[2] ?? 0) : 0;
    const stockWeight = weights ? (weights[1] ?? 0) : 0;

    let targetIaClips = Math.round((minimaxWeight / 100) * totalVisualClipsCount);
    let targetStockClips = Math.round((stockWeight / 100) * totalVisualClipsCount);

    if (targetIaClips + targetStockClips > totalVisualClipsCount) {
      const sum = targetIaClips + targetStockClips;
      targetIaClips = Math.floor((targetIaClips / sum) * totalVisualClipsCount);
      targetStockClips = totalVisualClipsCount - targetIaClips;
    }
    const targetOriginalClips = totalVisualClipsCount - targetIaClips - targetStockClips;

    await logMessage(`[FASE 2] weights: original=${targetOriginalClips}, stock=${targetStockClips}, ia=${targetIaClips}/${totalVisualClipsCount}`);

    let flattenedClips: any[] = [];

    let sanitizedPhrases: any[] = [];

    try {
      const segmentsText = (transcriptSegments || [])
        .map((s: any, i: number) => `[${i}] ${Number(s.start).toFixed(1)}s-${Number(s.end).toFixed(1)}s: "${s.text}"`)
        .join('\n');

      // Usar directamente los textos reales de cada frase transcrita de ElevenLabs
      const fragmentosNumerados = newAudioSegments
        .map((seg: any, idx: number) => {
          const duration = seg.end - seg.start;
          const count = duration > 4.0 ? Math.ceil(duration / 3.0) : 1;
          return `[Frase ${idx + 1}] "${seg.text}" (${Number(seg.start).toFixed(1)}s - ${Number(seg.end).toFixed(1)}s, duración: ${duration.toFixed(2)}s). Requiere exactamente ${count} sub-clip(s) visual(es) de aprox ${(duration / count).toFixed(2)}s cada uno.`;
        })
        .join('\n');

      const dsPromptClips = `Eres un editor de video. Tienes la transcripción del video original con timestamps y un guión reescrito dividido en frases (con timestamps reales de la voz generada).
Para cada frase del guión, decide cómo ilustrarla. Si la duración de la frase supera los 4.0 segundos, debes dividirla en 2 o 3 sub-clips visuales (máximo 3.0s por sub-clip).
Cada sub-clip visual puede ser de tipo original del video ('original'), buscando un clip de stock ('stock') o generándolo por IA ('ia').

De un total de ${totalVisualClipsCount} sub-clips visuales a generar a lo largo de todas las frases, debes clasificar exactamente:
- ${targetIaClips} sub-clips como de tipo 'ia'
- ${targetStockClips} sub-clips como de tipo 'stock'
- ${targetOriginalClips} sub-clips como de tipo 'original'

TRANSCRIPCIÓN DEL VIDEO ORIGINAL:
${segmentsText}

FRASES DEL GUIÓN A PROCESAR:
${fragmentosNumerados}

INSTRUCCIONES DE CLIPS VISUALES:
- Para cada frase en orden, proporciona el array "visualClips" con el número exacto de sub-clips indicado.
- La suma de las duraciones de los sub-clips dentro de una frase debe ser exactamente igual a la duración total de la frase.
- Para clips tipo 'original': elige el timestamp de inicio más adecuado (rango 0 - ${Number(maxTsVal).toFixed(1)}) basándose en la transcripción del video original.
- Para clips tipo 'stock': genera una palabra clave en inglés corta (1-2 palabras, ej. "cyberpunk city", "financial chart", "nervous man") para buscar en Pexels en el campo "keyword".
- Para clips tipo 'ia': genera un prompt descriptivo en inglés y altamente visual de 1 oración en el campo "prompt".
- Distribuye los tipos de forma intercalada. Alterna entre 'original', 'stock' e 'ia' de forma variada y natural.

Responde ÚNICAMENTE con JSON en este formato sin markdown ni comentarios:
{
  "phrases": [
    {
      "phraseIndex": 1,
      "visualClips": [
        {
          "type": "stock",
          "keyword": "brain connection",
          "duration": 3.0
        },
        {
          "type": "original",
          "timestamp": 12.5,
          "duration": 1.5
        }
      ]
    },
    {
      "phraseIndex": 2,
      "visualClips": [
        {
          "type": "ia",
          "prompt": "A cinematic shot of a computer monitor showing green code scrolling down",
          "duration": 3.2
        }
      ]
    }
  ]
}`;



      let phrasesDecision: any[] = [];
      let graphicsDecision: any[] = [];

      try {
        await logMessage('[FASE 2] LLAMADA 1: Solicitando clips visuales a DeepSeek...');
        const dsResponseClips = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'Eres un editor de video experto. Responde ÚNICAMENTE con el JSON solicitado.' },
              { role: 'user', content: dsPromptClips }
            ],
            temperature: 0.2
          })
        });

        if (dsResponseClips.ok) {
          const dsData = (await dsResponseClips.json()) as any;
          let content = (dsData?.choices?.[0]?.message?.content || '').trim();
          if (content.includes('{')) {
            content = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
          }
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.phrases)) {
            phrasesDecision = parsed.phrases;
          }
        }
      } catch (err: any) {
        await logMessage(`[FASE 2] Error en llamada de clips: ${err.message}`);
      }

      // Gráficos se generan por separado con Regenerar Gráficos

      // Procesar y sanitizar con phrasesDecision y graphicsDecision
      for (let idx = 0; idx < newAudioSegments.length; idx++) {
        const seg = newAudioSegments[idx];
        const phraseDuration = seg.end - seg.start;
        const numClipsExpected = phraseDuration > 4.0 ? Math.ceil(phraseDuration / 3.0) : 1;
        
        const matchClips = phrasesDecision.find((p: any) => p && (p.phraseIndex === idx + 1 || p.index === idx + 1));
        const matchGraphics = graphicsDecision.find((p: any) => p && (p.phraseIndex === idx + 1 || p.index === idx + 1));

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

        visualClips = visualClips.map((c: any) => {
          const type = ['original', 'stock', 'ia'].includes(c.type) ? c.type : 'original';
          const effectiveTimestamp = (isOriginalAudio && type === 'original' && newAudioSegments[idx]?.start !== undefined)
            ? newAudioSegments[idx].start
            : (c.timestamp ?? parseFloat(((idx / newAudioSegments.length) * maxTsVal).toFixed(1)));
          return {
            type,
            timestamp: effectiveTimestamp,
            keyword: c.keyword || 'broll',
            prompt: c.prompt || 'cinematic video clip',
            duration: parseFloat((c.duration || (phraseDuration / numClipsExpected)).toFixed(2))
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

        let graphic = matchGraphics?.graphic;
        if (graphic && typeof graphic === 'object') {
          const type = graphic.type || 'decorativo_emoji';
          let start = parseFloat(Number(graphic.graphicStart).toFixed(2));
          let end = parseFloat(Number(graphic.graphicEnd).toFixed(2));
          
          if (isNaN(start) || start < 0) start = 0;
          if (start > phraseDuration) start = phraseDuration;
          if (isNaN(end) || end < start) end = start + 2.0;
          if (end > phraseDuration) end = phraseDuration;
          
          let dur = end - start;
          if (dur > 2.0) {
            end = parseFloat((start + 2.0).toFixed(2));
            if (end > phraseDuration) {
              end = phraseDuration;
              start = parseFloat(Math.max(0, end - 2.0).toFixed(2));
            }
          }
          if (end - start < 0.2) {
            start = parseFloat(Math.max(0, end - 1.0).toFixed(2));
            end = parseFloat(Math.min(phraseDuration, start + 1.0).toFixed(2));
          }

          graphic = {
            type,
            value: graphic.value !== undefined ? graphic.value : '📊',
            label: graphic.label || 'Concepto clave',
            unit: graphic.unit || '',
            emoji: graphic.emoji || '💡',
            graphicStart: start,
            graphicEnd: end,
            extra: graphic.extra !== undefined ? graphic.extra : null
          };
        } else {
          graphic = null;
        }

        sanitizedPhrases.push({
          phraseIndex: idx + 1,
          visualClips,
          graphic
        });
      }
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
          graphic: null
        });
        globalIdx++;
      }
    }

    clipsDecision = flattenedClips;
    totalClips = flattenedClips.length;

    await logMessage(`[FASE 2] Decisiones de clips listas. Sub-clips totales: ${clipsDecision.length}. Clips IA: ${clipsDecision.filter(c => c.type === 'ia').length}, Stock: ${clipsDecision.filter(c => c.type === 'stock').length}, Original: ${clipsDecision.filter(c => c.type === 'original').length}, Gráficos asignados: ${sanitizedPhrases.filter(p => p.graphic !== null).length}`);

    // FASE 3: FFmpeg e IA — generar clips
    await logMessage(`[FASE 3] Generando ${totalClips} clips con FFmpeg, Pexels y fal.ai (IA)...`);

    const outDir = activeProjectPath
      ? path.join(activeProjectPath, 'temp', 'originales')
      : path.join(getBancoClipsPath(), 'originales');
    if (!(await exists(outDir))) await fs.promises.mkdir(outDir, { recursive: true });

    const thumbDir = activeProjectPath
      ? path.join(activeProjectPath, 'temp', 'thumbnails')
      : path.join(getBancoClipsPath(), 'thumbnails');
    if (!(await exists(thumbDir))) await fs.promises.mkdir(thumbDir, { recursive: true });

    const results = new Array(totalClips);
    const escapedVideo = videoPath.replace(/"/g, '\\"');

    // Cola de procesamiento
    const queue = [...clipsDecision];

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
            item.type = 'original';
            item.timestamp = parseFloat((((item.index - 1) / totalClips) * maxTsVal).toFixed(1));
          }
        }

        if (item.type === 'stock') {
          try {
            if (!pexelsApiKey) throw new Error('No se configuró PEXELS_API_KEY en el archivo .env');

            const isVertical = aspectRatio === '9:16' || aspectRatio === 'vertical';
            const targetOrientation = isVertical ? 'portrait' : 'landscape';
            const pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(item.keyword || 'broll')}&per_page=5&orientation=${targetOrientation}`;
            
            await logMessage(`[FASE 3] Buscando stock en Pexels para clip ${item.index}: "${item.keyword}" (orientación: ${targetOrientation})`);
            const pexelsRes = await fetch(pexelsUrl, {
              headers: { 'Authorization': pexelsApiKey }
            });
            if (!pexelsRes.ok) {
              throw new Error(`Pexels API respondió con status ${pexelsRes.status}`);
            }
            const pexelsData = await pexelsRes.json() as any;
            const video = pexelsData?.videos?.[0];
            if (!video) throw new Error(`No se encontraron videos en Pexels para keyword: ${item.keyword}`);

            const videoFiles = video.video_files || [];
            let bestFile = videoFiles.find((f: any) => f.quality === 'hd' || f.width >= 720);
            if (!bestFile) bestFile = videoFiles[0];
            const videoDownloadUrl = bestFile?.link;
            if (!videoDownloadUrl) throw new Error('No se encontró link de descarga en el video de Pexels');

            const stockDir = path.join(getBancoClipsPath(), 'stock');
            if (!(await exists(stockDir))) {
              await fs.promises.mkdir(stockDir, { recursive: true });
            }

            const rawStockFilename = `pexels_${video.id}_raw.mp4`;
            const rawStockPath = path.join(stockDir, rawStockFilename);

            if (!(await exists(rawStockPath))) {
              await logMessage(`[FASE 3] Descargando original de stock de Pexels: ${videoDownloadUrl}`);
              const dlRes = await fetch(videoDownloadUrl);
              if (!dlRes.ok) throw new Error(`Error al descargar video de Pexels: ${dlRes.statusText}`);
              const buffer = await dlRes.arrayBuffer();
              await fs.promises.writeFile(rawStockPath, Buffer.from(buffer));
            } else {
              await logMessage(`[FASE 3] Usando original de stock de Pexels existente en caché: ${rawStockFilename}`);
            }

            let filter = '';
            try {
              const dimensions = await getVideoDimensions(rawStockPath);
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

            const escapedRawStock = rawStockPath.replace(/"/g, '\\"');
            await new Promise<void>((resolve, reject) => {
              const cmd = `ffmpeg -y -ss 0 -i "${escapedRawStock}" -vf "${filter}" -t ${item.duration} -an "${escapedClip}"`;
              exec(cmd, (err) => { if (err) reject(err); else resolve(); });
            });

            // Copiar al directorio local de stock del proyecto
            if (activeProjectPath) {
              const localStockDir = path.join(activeProjectPath, 'temp', 'stock');
              if (!(await exists(localStockDir))) {
                await fs.promises.mkdir(localStockDir, { recursive: true });
              }
              const localStockPath = path.join(localStockDir, `pexels_${video.id}.mp4`);
              await fs.promises.copyFile(clipPath, localStockPath);
            }

            success = true;
          } catch (stockErr: any) {
            await logMessage(`[FASE 3] Error Stock en clip ${item.index}: ${stockErr.message || stockErr}. Usando fallback original.`);
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
            url: `file:///${clipPath.replace(/\\/g, '/')}`,
            duration: formatTimeMinutesSeconds(durationSeconds),
            durationSeconds,
            type: 'video',
            category: item.type === 'ia' ? 'minimax' : (item.type === 'stock' ? 'stock' : 'original'),
            size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
            thumbnailUrl
          };
        }
      }
    });

    await Promise.all(workers);
    const createdClips = results.filter(c => c !== undefined);

    // FASE 4: Repetir últimos clips si FFmpeg o la IA produjeron menos de lo esperado
    if (createdClips.length < totalClips && createdClips.length > 0) {
      const before = createdClips.length;
      while (createdClips.length < totalClips) {
        const last = createdClips[createdClips.length - 1];
        createdClips.push({ ...last, id: `${last.id}-dup-${createdClips.length}` });
      }
      await logMessage(`[FASE 4] Duplicados: ${before} → ${createdClips.length} clips.`);
    }

    if (createdClips.length === 0) {
      return { success: false, error: 'No se pudo crear ningún clip. Verifica la configuración de las APIs y FFmpeg.' };
    }

    // FASE 5: Ensamblar timeline secuencial
    await logMessage('[FASE 5] Ensamblando timeline...');
    let currentStart = 0;
    const finalClips: any[] = [];
    const graphicClips: any[] = [];

    let globalClipIdx = 0;

    for (let phraseIdx = 0; phraseIdx < sanitizedPhrases.length; phraseIdx++) {
      const phrase = sanitizedPhrases[phraseIdx];
      const phraseStartSeconds = newAudioSegments[phraseIdx]?.start ?? currentStart;
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
              const thumbPath = clip.path.replace('temp/originales', 'temp/thumbnails').replace('.mp4', '.jpg').replace('banco-clips/originales', 'banco-clips/thumbnails');
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
                const thumbPath = clip.path.replace('temp/originales', 'temp/thumbnails').replace('.mp4', '.jpg').replace('banco-clips/originales', 'banco-clips/thumbnails');
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

      // Si la frase tiene gráfico asignado, creamos un clip de gráfico independiente
      if (phrase.graphic) {
        const seg = newAudioSegments[phraseIdx];
        let graphicStartOffset = phrase.graphic.graphicStart;

        if (seg && seg.words && seg.words.length > 0) {
          const segStart = seg.start || 0;
          const stopWords = ['el','la','los','las','un','una',
            'de','del','al','en','y','a','que','se','es','por',
            'con','su','sus','lo','le','les','me','te','nos',
            'para','como','pero','mas','más','si','no','ya'];
          
          const keyWord = seg.words.find((w: any) => {
            const clean = w.word.trim().toLowerCase()
              .replace(/[^a-záéíóúñ]/g, '');
            return clean.length > 2 && !stopWords.includes(clean);
          });
          
          if (keyWord) {
            const relative = Math.max(0,
              parseFloat((keyWord.start - segStart).toFixed(2)));
            const phraseDuration = seg.end - seg.start;
            graphicStartOffset = Math.min(relative, phraseDuration * 0.7);
          }
        }

        const startSec = phraseStartSeconds + graphicStartOffset;
        const durSec = phrase.graphic.graphicEnd - phrase.graphic.graphicStart;
        if (startSec < audioDuration && durSec > 0) {
          graphicClips.push({
            id: 'timeline-graphic-' + Math.random(),
            name: 'Gráfico: ' + (phrase.graphic.label || phrase.graphic.type),
            startSeconds: startSec,
            graphicStartRelative: phrase.graphic.graphicStart,
            phraseIdx: phraseIdx,
            durationSeconds: Math.min(durSec, audioDuration - startSec),
            type: 'graphic',
            graphicData: {
              type: phrase.graphic.type,
              value: phrase.graphic.value,
              label: phrase.graphic.label,
              unit: phrase.graphic.unit,
              emoji: phrase.graphic.emoji,
              extra: phrase.graphic.extra
            }
          });
        }
      }
    }

    finalClips.push(...graphicClips);

    await logMessage(`[generate-timeline-assets] Completado. Clips: ${finalClips.length} (Videos: ${finalClips.filter(c => c.type === 'video').length}, Gráficos: ${finalClips.filter(c => c.type === 'graphic').length})`);
    return { success: true, clips: finalClips };

  } catch (err: any) {
    const errMsg = `[generate-timeline-assets] Error: ${err.message || err}`;
    console.error(errMsg, err);
    await writeDebugLog(errMsg);
    return { success: false, error: err.message || 'Error interno' };
  }
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
            params.audioPath,
            '--language', 'Spanish',
            '--model', 'tiny',
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
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'Responde UNICAMENTE con JSON valido.' },
              { role: 'user', content: sectionPrompt }
            ],
            temperature: 0.3
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
