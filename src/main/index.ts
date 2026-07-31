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
ipcMain.handle('export-video', async (event, { clips, aspectRatio, resolution, format, quality, assignedTransitions, transitionDuration }) => {
  try {
    // Mapeo de nombres internos de transiciones a nombres de FFmpeg xfade
    const XFADE_MAP: Record<string, string> = {
      'fade': 'fade', 'dissolve': 'dissolve', 'morph': 'smoothup',
      'CrossZoom': 'circleopen', 'pixelize': 'pixelize', 'GlitchDisplace': 'diagtl',
      'ripple': 'smoothleft', 'crosswarp': 'diagtr', 'fadegrayscale': 'fadegrays',
      'fadecolor': 'fadeblack', 'burn': 'fadewhite', 'luma': 'dissolve',
      'flyeye': 'circleclose', 'randomsquares': 'pixelize', 'wipeUp': 'wipeup',
      'LinearBlur': 'hblur', 'colorphase': 'fadegrays', 'rotate_scale_fade': 'circleopen',
      'multiply_blend': 'dissolve', 'kaleidoscope': 'circleopen', 'powerKaleido': 'circleclose',
      'TVStatic': 'pixelize', 'static_wipe': 'wipeleft', 'SimpleZoom': 'circleopen',
      'SimpleZoomOut': 'circleclose', 'zoomInOut': 'circleopen', 'StereoViewer': 'slideright',
      'displacement': 'slidedown', 'DirectionalScaled': 'slideleft', 'HSVfade': 'fadegrays',
      'StaticFade': 'fade', 'parametric_glitch': 'diagbl', 'mosaic_transition': 'pixelize',
      'ButterflyWaveScrawler': 'smoothright', 'old_tv_lost_signal': 'hblur', 'DefocusBlur': 'hblur',
      'directionalwipe': 'wipeleft', 'Revolve_Left': 'radial'
    };
    const mapTransition = (name: string): string => XFADE_MAP[name] || 'fade';
    const trDuration = typeof transitionDuration === 'number' ? transitionDuration : 0.5;
    const hasTransitions = assignedTransitions && Object.keys(assignedTransitions).length > 0;
    await writeDebugLog(`[EXPORT] Transiciones asignadas: ${hasTransitions ? Object.keys(assignedTransitions).length : 0}, duracion: ${trDuration}s, primer mapa de test: ${mapTransition('fade')}`);
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

    const exportStart = Date.now();
    const videoClipsOnly = clips.filter((c: any) => c.path && c.type !== 'graphic' && c.type !== 'audio');
    await writeDebugLog(`[EXPORT] Iniciando exportacion: ${videoClipsOnly.length} clips de video, aspect=${aspectRatio}, res=${resolution}, quality=${quality}`);

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
        exec(ffmpegCmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    } else {
      const videoOnly = clips.filter((c: any) =>
        c.path && c.type !== 'audio' && c.type !== 'graphic' && c.category !== 'v2_overlay'
      );

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
      const normBase = filterStr.slice(0, -1) + ',setsar=1"';
      const normFilterStr = filterStr.slice(0, -1) +
        `,tpad=stop_mode=clone:stop_duration=${MAX_CLONADO},setsar=1"`;

      const normalizedPaths: string[] = [];
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
            const vf = frames > 0 ? normFilterStr : normBase;
            const trim = frames > 0 ? `-frames:v ${frames} ` : '';
            const cmd = `ffmpeg -y -i "${escapedIn}" ${vf} -r 30 -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an ${trim}"${escapedNorm}"`;
            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err) => {
              if (err) reject(err); else resolve();
            });
          });
          normalizedPaths.push(normPath);
        } catch (normErr: any) {
          await writeDebugLog(`[EXPORT] Error normalizando clip ${i}: ${normErr.message}`);
        }
      }

      await writeDebugLog(`[EXPORT] Normalizacion: ${((Date.now() - normStart) / 1000).toFixed(1)}s — ${normalizedPaths.length} clips`);

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

      if (hasTransitions && Object.keys(transitionByIndex).length > 0) {
        const trStart = Date.now();
        // Se reconstruye la ruta desde el indice i, no desde normalizedPaths[i]: ese array
        // se compacta si algun clip falla (P3) y desalinearia los pares.
        const normPathFor = (i: number) => path.join(normDir, `norm_${String(i).padStart(4, '0')}.mp4`);

        const buildSegment = async (i: number, kind: 'tail' | 'head') => {
          const src = normPathFor(i);
          if (!(await exists(src))) return null;
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
      }

      const tempTxtPath = path.join(bankDir, `temp_concat_${Date.now()}.txt`);
      let fileContent = '';
      for (const np of normalizedPaths) {
        fileContent += `file '${np.replace(/\\/g, '/').replace(/'/g, "'\\''")}'\n`;
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



      const BATCH_SIZE = 25;
      let phrasesDecision: any[] = [];
      let graphicsDecision: any[] = [];

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
        const batchIa = minimaxWeight > 0
          ? Math.round((targetIaClips / totalVisualClipsCount) * batchVisualCount)
          : 0;
        const lineaTipos = minimaxWeight > 0
          ? 'De ' + batchVisualCount + ' sub-clips marca exactamente ' + batchIa +
            ' con "type":"ia" y dales ademas un prompt descriptivo en ingles. El resto NO lleva campo type.\n'
          : 'NO asignes tipos de clip. Eso se decide despues; tu unica tarea es describir cada sub-clip.\n';

        const batchPrompt = 'Eres un editor de video experto.\n' +
          'Para cada frase decide como ilustrarla visualmente. Si dura mas de 4.0s divide en 2-3 sub-clips (maximo 3.0s cada uno).\n' +
          'Para CADA sub-clip da SIEMPRE estos dos campos:\n' +
          '- keyword: en ingles, corta y concreta, algo filmable que ilustre ESE trozo. Nunca abstracta: evita palabras como "consequences", "awareness" o "meaning".\n' +
          '- timestamp: el segundo del video original (0-' + Number(maxTsVal).toFixed(1) + ') que mejor acompana ese trozo.\n' +
          lineaTipos +
          'FRASES:\n' + batchFragmentos + '\n' +
          'Responde SOLO JSON:\n' +
          '{"phrases":[{"phraseIndex":' + (batchStart+1) + ',"visualClips":[{"keyword":"protest march","timestamp":12.3,"duration":2.5}]},' +
          '{"phraseIndex":' + (batchStart+2) + ',"visualClips":[{"keyword":"empty stadium","timestamp":45.0,"duration":2.5}]}]}';

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
              phrasesDecision.push(...parsed.phrases);
            }
          } else {
            const errBody = await dsResp.text().catch(() => '');
            await logMessage(`[FASE 2] DeepSeek HTTP ${dsResp.status}: ${errBody.slice(0, 300)}`);
          }
        } catch (err: any) {
          await logMessage('[FASE 2] Error lote: ' + err.message);
        }
      }

      // Gráficos se generan por separado con Regenerar Gráficos

      // Procesar y sanitizar con phrasesDecision y graphicsDecision
      for (let idx = 0; idx < newAudioSegments.length; idx++) {
        const seg = newAudioSegments[idx];
        const nextSegStart = newAudioSegments[idx + 1]?.start;
        const phraseDuration = (typeof nextSegStart === 'number' && nextSegStart > seg.start)
          ? (nextSegStart - seg.start)
          : (seg.end - seg.start);
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
      let objIa = Math.round((minimaxWeight / 100) * totalReal);
      let objStock = Math.round((stockWeight / 100) * totalReal);
      if (objIa + objStock > totalReal) {
        const sum = objIa + objStock;
        objIa = Math.floor((objIa / sum) * totalReal);
        objStock = totalReal - objIa;
      }
      const objOriginal = totalReal - objIa - objStock;

      const antesStock = cuotaLista.filter(x => x.clip.type === 'stock').length;
      const antesOriginal = cuotaLista.filter(x => x.clip.type === 'original').length;

      // Los 'ia' no se tocan: generarlos cuesta dinero y no se pueden inventar. Pero un 'ia'
      // entrante solo se respeta si el usuario pidio IA de verdad: ahora que el prompt ya no
      // fija cuotas de tipo, un 'ia' espontaneo del modelo dispararia llamadas de pago a
      // fal.ai que nadie solicito.
      const respetarIa = minimaxWeight > 0;
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

      const finStock = cuotaLista.filter(x => x.clip.type === 'stock').length;
      const finOriginal = cuotaLista.filter(x => x.clip.type === 'original').length;
      await logMessage(`[FASE 2] Cuota: objetivo original=${objOriginal} stock=${objStock} ia=${objIa} | ` +
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
                const localStockDir = path.join(activeProjectPath, 'temp', 'stock');
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
    const graphicClips: any[] = [];

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
      ? path.join(projPath, 'temp', 'sync-perfecta')
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
            url: 'file:///' + clipPath.replace(/\\/g, '/'),
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
      url: 'file:///' + videoPath.replace(/\\/g, '/')
    };

    const audioClip = {
      id: 'audio-sync-' + Date.now(),
      name: 'Voz - Audio Original',
      startSeconds: 0,
      durationSeconds: duracionTotal,
      type: 'audio',
      path: audioPath || videoPath,
      url: 'file:///' + (audioPath || videoPath).replace(/\\/g, '/')
    };

    await logMessage('[generate-perfect-sync] Completado. v2Clips: ' + v2Clips.length);

    return {
      success: true,
      v1Clip,
      v2Clips,
      audioClip
    };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
