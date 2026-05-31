import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { spawn, exec } from 'child_process'
import fs from 'fs'
import { getVideoDuration, generateVideoThumbnail, formatTimeMinutesSeconds } from './services/ffmpeg'

// Helper to manually load .env file in main process from multiple potential paths
let envLoaded = false
function loadEnv() {
  if (envLoaded) return
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

function getRemotionPath(): string {
  const cwd = process.cwd()
  if (path.basename(cwd) === 'cipher-studio') {
    return cwd
  } else {
    return path.join(cwd, 'cipher-studio')
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
    'remotion',
    'hyperframes',
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

  // Notify renderer that the Whisper process is starting
  event.reply('transcription-update', { 
    status: 'starting', 
    message: 'Conectando con Whisper local y cargando modelo...' 
  })

  // Spawn whisper command using shell: true for Windows compatibility
  const whisperProcess = spawn('whisper', [
    `"${filePath}"`,
    '--language', 'Spanish',
    '--output_format', 'json',
    '--output_dir', `"${transcriptsDir}"`
  ], { shell: true })

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

      return { success: true, filePath, audioUrl, durationSeconds }
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
    loadEnv();
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'MINIMAX_API_KEY no está configurado en el archivo .env.' };
    }

    console.log('[generate-minimax-video] Iniciando generación con prompt:', prompt);

    // 1. Submit task
    const submitResponse = await fetch('https://api.minimax.io/v1/video_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMax-Hailuo-2.3',
        prompt: prompt,
        duration: 6,
        resolution: '1080P'
      })
    });

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      return { success: false, error: `Error MiniMax Submit (${submitResponse.status}): ${errText}` };
    }

    const submitData = (await submitResponse.json()) as any;
    const taskId = submitData.task_id;
    if (!taskId) {
      return { success: false, error: `MiniMax no devolvió un task_id: ${JSON.stringify(submitData)}` };
    }

    console.log(`[generate-minimax-video] Task creado con ID: ${taskId}. Iniciando sondeo...`);

    // 2. Poll for status
    let fileId: string | null = null;
    let status = 'Preparing';
    const maxPolls = 60; // 3 minutes total
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const queryResponse = await fetch(`https://api.minimax.io/v1/query/video_generation?task_id=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!queryResponse.ok) {
        console.error(`[generate-minimax-video] Error al sondear la tarea (${queryResponse.status})`);
        continue;
      }

      const queryData = (await queryResponse.json()) as any;
      status = queryData.status || '';
      console.log(`[generate-minimax-video] Sondeo #${i+1}: status = ${status}`);

      if (status === 'Success') {
        fileId = queryData.file_id;
        break;
      } else if (status === 'Fail') {
        return { success: false, error: 'La generación de video por MiniMax falló.' };
      }
    }

    if (!fileId) {
      return { success: false, error: `El sondeo expiró o falló. Estado final: ${status}` };
    }

    console.log(`[generate-minimax-video] Tarea exitosa. Obteniendo URL para fileId: ${fileId}...`);

    // 3. Retrieve File Download URL
    const retrieveResponse = await fetch(`https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!retrieveResponse.ok) {
      const errText = await retrieveResponse.text();
      return { success: false, error: `Error al obtener URL del archivo (${retrieveResponse.status}): ${errText}` };
    }

    const retrieveData = (await retrieveResponse.json()) as any;
    const downloadUrl = retrieveData.file?.download_url || retrieveData.download_url;
    if (!downloadUrl) {
      return { success: false, error: `MiniMax no devolvió una download_url: ${JSON.stringify(retrieveData)}` };
    }

    console.log(`[generate-minimax-video] Descargando video desde: ${downloadUrl}`);

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
    return { success: false, error: err.message || 'Error desconocido al generar video con MiniMax.' };
  }
});

// IPC handle for loading clips in a category folder of banco-clips
ipcMain.handle('load-bank-clips', async (_event, { category }) => {
  try {
    const isTempCategory = ['originales', 'remotion', 'hyperframes', 'minimax'].includes(category.toLowerCase())
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
ipcMain.handle('cut-video-clips', async (_event, { videoPath }) => {
  try {
    console.log(`[cut-video-clips] Slicing video into exact 3s segments: ${videoPath}`)
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
    const isTempCategory = category === 'originales' || category === 'remotion' || category === 'hyperframes'
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



function splitScriptIntoNSegments(script: string, N: number): string[] {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return Array.from({ length: N }, () => '...');
  }
  if (words.length <= N) {
    const result = words.map(w => w);
    while (result.length < N) result.push("...");
    return result;
  }
  const wordsPerSegment = Math.floor(words.length / N);
  const remainder = words.length % N;
  const segments: string[] = [];
  let wordIdx = 0;
  for (let i = 0; i < N; i++) {
    const count = wordsPerSegment + (i < remainder ? 1 : 0);
    const segmentWords = words.slice(wordIdx, wordIdx + count);
    segments.push(segmentWords.join(" "));
    wordIdx += count;
  }
  return segments;
}

function findBestMatchingOriginalClip(paragraphText: string, originalClips: any[], transcriptSegments: any[]): any {
  if (!originalClips || originalClips.length === 0) return null;
  if (!transcriptSegments || transcriptSegments.length === 0) {
    return originalClips[0];
  }
  
  let bestScore = -1;
  let bestIndex = 0;
  const cleanWords = (text: string) => new Set(text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").split(/\s+/).filter(Boolean));
  const paraWords = cleanWords(paragraphText);
  
  transcriptSegments.forEach((seg, idx) => {
    const segWords = cleanWords(seg.text || "");
    let overlap = 0;
    paraWords.forEach(w => {
      if (segWords.has(w)) overlap++;
    });
    if (overlap > bestScore) {
      bestScore = overlap;
      bestIndex = idx;
    }
  });
  
  const targetClipName = `clip_${String(bestIndex + 1).padStart(3, '0')}.mp4`;
  const matched = originalClips.find(c => c.name === targetClipName || c.name.includes(`_${bestIndex + 1}.`));
  return matched || originalClips[bestIndex % originalClips.length];
}

async function selectBestStockClip(theme: string, paragraph: string, filenames: string[], apiKey: string): Promise<string | null> {
  if (filenames.length === 0) return null;
  try {
    const prompt = `Dado el tema general: "${theme}" y la escena de video descriptiva: "${paragraph}".
Elige el nombre del archivo de video que mejor se adapte visualmente a esta escena de la siguiente lista de archivos:
${filenames.map(f => `- ${f}`).join('\n')}

Devuelve únicamente el nombre exacto del archivo seleccionado de la lista. No agregues explicaciones ni introducciones.`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Eres un selector de contenido audiovisual experto. Responde únicamente con el nombre del archivo.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    if (response.ok) {
      const json = await response.json() as any;
      const content = (json?.choices?.[0]?.message?.content || '').trim().replace(/['"`]/g, '');
      if (filenames.includes(content)) {
        return content;
      }
      const matched = filenames.find(f => f.toLowerCase() === content.toLowerCase() || content.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(content.toLowerCase()));
      if (matched) return matched;
    }
  } catch (e) {
    console.error('Error al confirmar clip de stock con DeepSeek:', e);
  }
  return filenames[Math.floor(Math.random() * filenames.length)];
}

async function generateMiniMaxClipHelper(prompt: string, apiKey: string, activeProjectPath: string | null, bankDir: string): Promise<any> {
  const submitResponse = await fetch('https://api.minimax.io/v1/video_generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'MiniMax-Hailuo-2.3',
      prompt: prompt,
      duration: 6,
      resolution: '1080P'
    })
  });

  if (!submitResponse.ok) {
    const errText = await submitResponse.text();
    throw new Error(`MiniMax Submit error (${submitResponse.status}): ${errText}`);
  }

  const submitData = (await submitResponse.json()) as any;
  const taskId = submitData.task_id;
  if (!taskId) {
    throw new Error(`MiniMax no devolvió un task_id: ${JSON.stringify(submitData)}`);
  }

  let fileId: string | null = null;
  let status = 'Preparing';
  const maxPolls = 60;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const queryResponse = await fetch(`https://api.minimax.io/v1/query/video_generation?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!queryResponse.ok) {
      continue;
    }

    const queryData = (await queryResponse.json()) as any;
    status = queryData.status || '';

    if (status === 'Success') {
      fileId = queryData.file_id;
      break;
    } else if (status === 'Fail') {
      throw new Error('La generación de video por MiniMax falló.');
    }
  }

  if (!fileId) {
    throw new Error(`El sondeo expiró o falló. Estado final: ${status}`);
  }

  const retrieveResponse = await fetch(`https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!retrieveResponse.ok) {
    const errText = await retrieveResponse.text();
    throw new Error(`Error retrieving file download URL (${retrieveResponse.status}): ${errText}`);
  }

  const retrieveData = (await retrieveResponse.json()) as any;
  const downloadUrl = retrieveData.file?.download_url || retrieveData.download_url;
  if (!downloadUrl) {
    throw new Error(`MiniMax no devolvió una download_url: ${JSON.stringify(retrieveData)}`);
  }

  const downloadRes = await fetch(downloadUrl);
  if (!downloadRes.ok) {
    throw new Error(`Error al descargar el archivo de video: ${downloadRes.statusText}`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const targetDir = activeProjectPath
    ? path.join(activeProjectPath, 'temp', 'minimax')
    : path.join(bankDir, 'minimax');
    
  if (!(await exists(targetDir))) {
    await fs.promises.mkdir(targetDir, { recursive: true });
  }

  const filename = `minimax-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.mp4`;
  const filePath = path.join(targetDir, filename);
  await fs.promises.writeFile(filePath, buffer);

  const durationSeconds = await getVideoDuration(filePath);

  const thumbFilename = `thumb-${path.basename(filename, '.mp4')}.jpg`;
  const thumbDir = activeProjectPath
    ? path.join(activeProjectPath, 'temp', 'thumbnails')
    : path.join(bankDir, 'thumbnails');

  if (!(await exists(thumbDir))) {
    await fs.promises.mkdir(thumbDir, { recursive: true });
  }

  const thumbPath = path.join(thumbDir, thumbFilename);
  let thumbnailUrl = '';
  try {
    await generateVideoThumbnail(filePath, thumbPath);
    thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbPath)).toString('base64')}`;
  } catch (e) {
    console.error('Error generating thumbnail:', e);
  }

  return {
    id: `bank-minimax-${filename}`,
    name: filename,
    path: filePath,
    url: `file:///${filePath.replace(/\\/g, '/')}`,
    duration: formatTimeMinutesSeconds(durationSeconds),
    durationSeconds,
    type: 'video',
    category: 'minimax',
    thumbnailUrl
  };
}

async function renderTransitionClip(effect: string, counter: number, transitionIndex: number, targetCompositionsDir: string, projectDir: string, bankDir: string, useActiveProj: boolean): Promise<any> {
  const timestamp = Date.now();
  const clipFileName = `trans_${timestamp}_${counter + 1}.mp4`;
  const outPath = useActiveProj 
    ? path.join(projectDir, 'temp', 'hyperframes', clipFileName)
    : path.join(bankDir, 'hyperframes', clipFileName);
    
  const transCompositionHtmlPath = path.join(targetCompositionsDir, `trans_${timestamp}_${counter + 1}.html`);
  const transRelativeCompositionPath = `compositions/trans_${timestamp}_${counter + 1}.html`;
  
  const transHtml = generateHyperframesHtml({
    isTransition: true,
    transitionIndex
  });
  
  const htmlTemplate = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #020712; }
    </style>
  </head>
  <body>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
    <div id="root" data-composition-id="main" data-start="0" data-duration="0.3" data-width="1920" data-height="1080">
      ${transHtml}
    </div>
  </body>
</html>`;

  await fs.promises.writeFile(transCompositionHtmlPath, htmlTemplate, 'utf8');
  
  const hyperframesProjectRoot = (await exists(path.join(process.cwd(), 'hyperframes-project'))) 
    ? path.join(process.cwd(), 'hyperframes-project') 
    : path.join(process.cwd(), 'cipher-studio', 'hyperframes-project');
    
  let renderSuccess = false;
  await new Promise<void>((resolvePromise) => {
    const cmd = `npx hyperframes render "${hyperframesProjectRoot}" -c "${transRelativeCompositionPath}" -o "${outPath}"`;
    exec(cmd, { cwd: hyperframesProjectRoot }, async (err) => {
      try { await fs.promises.unlink(transCompositionHtmlPath); } catch (e) {}
      if (!err) renderSuccess = true;
      resolvePromise();
    });
  });
  
  if (renderSuccess) {
    return {
      id: `bank-hyperframes-${clipFileName}`,
      name: `Transición: ${effect.toUpperCase()}`,
      path: outPath,
      url: `file:///${outPath.replace(/\\/g, '/')}`,
      duration: '0:00',
      durationSeconds: 0.3,
      type: 'video',
      category: 'hyperframes'
    };
  }
  return null;
}

ipcMain.handle('generate-timeline-assets', async (event, { scriptText, weights, aspectRatio, audioDuration, transcriptSegments, hyperframesFrequency }) => {
  // Clear old log file
  try {
    const cwd = process.cwd();
    let targetPath = '';
    if (path.basename(cwd) === 'cipher-studio') {
      targetPath = path.join(cwd, 'generation-debug.log');
    } else {
      targetPath = path.join(cwd, 'cipher-studio', 'generation-debug.log');
    }
    if (await exists(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  } catch (e) {}

  const logMessage = async (msg: string) => {
    console.log(msg);
    await writeDebugLog(msg);
  };

  try {
    await logMessage(`[generate-timeline-assets] Iniciando nuevo flujo en 6 fases...`);

    // 1. Obtener la clave de API de DeepSeek
    loadEnv();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      const errMsg = 'No se configuró DEEPSEEK_API_KEY en el archivo .env';
      await writeDebugLog(errMsg);
      return { success: false, error: errMsg };
    }

    // FASE 1: Análisis y Cálculo Base
    await logMessage(`[FASE 1] Iniciando análisis del guion y cálculo de clips...`);
    const duration = audioDuration && audioDuration > 0 ? audioDuration : Math.max(15, Math.round(scriptText.split(/\s+/).filter(Boolean).length * 60 / 130));
    const totalClips = Math.max(1, Math.round(duration / 3));
    
    // Mix weights: [Original, Stock, Remotion, MiniMax]
    const w = weights || [40, 30, 20, 10];
    let clips_originales = Math.round(totalClips * (w[0] / 100));
    let clips_stock = Math.round(totalClips * (w[1] / 100));
    let clips_remotion = Math.round(totalClips * (w[2] / 100));
    let clips_minimax = totalClips - (clips_originales + clips_stock + clips_remotion);

    if (clips_minimax < 0) {
      const counts = [clips_originales, clips_stock, clips_remotion];
      const maxIdx = counts.indexOf(Math.max(...counts));
      if (maxIdx === 0) clips_originales += clips_minimax;
      else if (maxIdx === 1) clips_stock += clips_minimax;
      else clips_remotion += clips_minimax;
      clips_minimax = 0;
    }

    await logMessage(`[FASE 1] Duración del audio de voz: ${duration.toFixed(1)}s -> Clips totales: ${totalClips}`);
    await logMessage(`[FASE 1] Distribución Mix calculada -> Originales: ${clips_originales}, Stock: ${clips_stock}, Remotion: ${clips_remotion}, MiniMax: ${clips_minimax}`);

    const segments = splitScriptIntoNSegments(scriptText, totalClips);
    await logMessage(`[FASE 1] Segmentos generados: ${segments.length}`);

    let parsedData: any = null;
    try {
      const dsPrompt = `Aquí tienes un guion de video dividido en exactamente N=${totalClips} segmentos secuenciales.
El tema general del guion se puede derivar de todo el texto.

REGLAS DE GENERACIÓN CREATIVA:
1. Cada clip debe ser completamente único, impactante y visualmente diferente al anterior. Evita repetir temas o fondos de forma consecutiva.
2. Para cada segmento (de 0 a N-1), analiza en conjunto: el párrafo anterior (si existe), el párrafo actual, el párrafo siguiente (si existe) y el tema general del guion.
3. Tienes libertad total y dirección creativa ilimitada para diseñar el visual más descriptivo e interesante posible para ese momento del guion. No hay límite de tipos de escena ni combinaciones.
4. El espectador debe poder entender claramente el tema/concepto de ese momento con solo ver el clip de 3 segundos, sin audio.

Por favor, decide a qué categoría de clip pertenece cada segmento de forma secuencial, respetando estrictamente estas cantidades calculadas del Mix (la suma total debe ser exactamente N=${totalClips}):
- original: ${clips_originales} clips (escenas del video original)
- stock: ${clips_stock} clips (clips de banco ilustrativos)
- remotion: ${clips_remotion} clips (gráficos/conceptos de datos/números)
- minimax: ${clips_minimax} clips (animaciones/escenas generadas por IA)

Para los clips asignados a 'remotion':
Escribe en "keyword" UNA sola palabra clave (1 a 3 palabras como máximo) que describa el concepto visual central del párrafo. El motor procedural tiene libertad total para crear la animación más impactante a partir de esa palabra, así que la palabra debe ser concreta y evocadora.
- Si el párrafo menciona una cifra o porcentaje relevante, inclúyela dentro del keyword para que se visualice (ej: "crecimiento 45%", "caída 30%", "10 millones").
- Si el concepto es de pérdida, declive, peligro o algo negativo, refléjalo en la palabra (ej: "caída", "crisis", "riesgo").
- REGLA OBLIGATORIA DE NO-REPETICIÓN: el "keyword" de cada clip 'remotion' DEBE ser diferente al del clip 'remotion' anterior. Está prohibido repetir la misma palabra clave dos veces seguidas; varía el concepto en cada clip.

Para los clips asignados a 'minimax':
Escribe en "minimaxPrompt" un prompt altamente detallado, cinematográfico, descriptivo y en inglés para generación de video por IA. Debe describir la acción física, el entorno, el sujeto y la iluminación de forma que transmita perfectamente el concepto del segmento analizado con su contexto, sin incluir texto o marcas de agua.

Aquí están los párrafos:
${segments.map((s, idx) => `Segmento ${idx}: "${s}"`).join('\n')}

Devuelve la respuesta ÚNICAMENTE como un objeto JSON válido con la siguiente estructura (no envíes bloques markdown, no agregues explicaciones):
{
  "theme": "tema del guion en 3 a 5 palabras",
  "assignments": [
    {
      "index": number,
      "category": "original" | "stock" | "remotion" | "minimax",
      "remotionProps": {
        "keyword": "palabra clave del concepto (distinta a la del clip remotion anterior)"
      },
      "minimaxPrompt": "prompt descriptivo en inglés"
    }
  ]
}`;

      event.sender.send('generation-progress', {
        index: 0,
        total: totalClips,
        paragraph: 'Analizando guion completo con DeepSeek...',
        type: 'DeepSeek'
      });

      const dsResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Eres un programador experto y director creativo. Responde ÚNICAMENTE con el objeto JSON solicitado, sin prefacios ni bloques markdown.' },
            { role: 'user', content: dsPrompt }
          ],
          temperature: 0.2
        })
      });

      if (dsResponse.ok) {
        const dsData = (await dsResponse.json()) as any;
        const dsContent = dsData?.choices?.[0]?.message?.content || '';
        let cleanContent = dsContent.trim();
        if (cleanContent.includes('{')) {
          cleanContent = cleanContent.substring(cleanContent.indexOf('{'), cleanContent.lastIndexOf('}') + 1);
        }
        parsedData = JSON.parse(cleanContent);
      }
    } catch (e) {
      console.error('Error al invocar DeepSeek en Fase 1:', e);
    }

    if (!parsedData || !parsedData.assignments || parsedData.assignments.length !== totalClips) {
      await logMessage(`[FASE 1] Fallback de asignación local aplicado por falta de respuesta válida de DeepSeek.`);
      parsedData = {
        theme: 'tecnología y digital',
        assignments: []
      };

      const distributedTypes: string[] = [];
      const tempCounts = [clips_originales, clips_stock, clips_remotion, clips_minimax];
      const categories = ['original', 'stock', 'remotion', 'minimax'];
      for (let i = 0; i < totalClips; i++) {
        let picked = false;
        for (let c = 0; c < 4; c++) {
          const idx = (i + c) % 4;
          if (tempCounts[idx] > 0) {
            distributedTypes.push(categories[idx]);
            tempCounts[idx]--;
            picked = true;
            break;
          }
        }
        if (!picked) distributedTypes.push('original');
      }

      const fallbackKeywords = ['memoria', 'energía', 'datos', 'conexión', 'tecnología', 'futuro', 'red', 'crecimiento', 'velocidad', 'mente', 'sociedad', 'mundo'];
      for (let i = 0; i < totalClips; i++) {
        const cat = distributedTypes[i];
        parsedData.assignments.push({
          index: i,
          category: cat,
          remotionProps: {
            keyword: fallbackKeywords[i % fallbackKeywords.length]
          },
          minimaxPrompt: `Cinematic footage demonstrating theme related to ${segments[i]}`
        });
      }
    }

    const temaGeneral = parsedData.theme || 'tecnología';
    await logMessage(`[FASE 1] Tema general identificado: ${temaGeneral}`);

    // FASE 2: Mapeo de Posiciones
    await logMessage(`[FASE 2] Iniciando mapeo de clips en segundos...`);
    const bankDir = getBancoClipsPath();
    const useActiveProj = !!activeProjectPath;
    const projectDir = useActiveProj ? activeProjectPath! : bankDir;

    const originalesDir = useActiveProj ? path.join(projectDir, 'temp', 'originales') : path.join(bankDir, 'originales');
    let originalClips: any[] = [];
    if (await exists(originalesDir)) {
      const origFiles = await fs.promises.readdir(originalesDir);
      for (const file of origFiles) {
        if (file.startsWith('clip_') && file.endsWith('.mp4')) {
          const filePath = path.join(originalesDir, file);
          const durationSeconds = await getVideoDuration(filePath);
          originalClips.push({
            name: file,
            path: filePath,
            url: `file:///${filePath.replace(/\\/g, '/')}`,
            durationSeconds
          });
        }
      }
    }

    const stockBaseDir = path.join(bankDir, 'stock');
    let subdirs: string[] = [];
    if (await exists(stockBaseDir)) {
      const items = await fs.promises.readdir(stockBaseDir, { withFileTypes: true });
      subdirs = items.filter(item => item.isDirectory()).map(item => item.name);
    }

    let targetStockDir = stockBaseDir;
    if (subdirs.length > 0) {
      const themeLower = temaGeneral.toLowerCase();
      const bestSubdir = subdirs.find(d => themeLower.includes(d.toLowerCase()) || d.toLowerCase().includes(themeLower));
      if (bestSubdir) {
        targetStockDir = path.join(stockBaseDir, bestSubdir);
      } else {
        targetStockDir = path.join(stockBaseDir, subdirs[0]);
      }
    }

    let stockFiles: string[] = [];
    if (await exists(targetStockDir)) {
      const files = await fs.promises.readdir(targetStockDir);
      stockFiles = files.filter(f => /\.(mp4|mov|avi|mkv|webm)$/i.test(f));
    }

    const mappedSlots: any[] = [];
    const usedOriginalPaths = new Set<string>();
    const usedStockPaths = new Set<string>();

    for (let i = 0; i < totalClips; i++) {
      const assignment = parsedData.assignments.find((a: any) => a.index === i) || parsedData.assignments[i];
      const paragraph = segments[i];
      const category = assignment.category;
      let mappedClip: any = null;

      if (category === 'original') {
        let matched = findBestMatchingOriginalClip(paragraph, originalClips, transcriptSegments || []);
        if (matched) {
          if (usedOriginalPaths.has(matched.path)) {
            const unused = originalClips.find(c => !usedOriginalPaths.has(c.path));
            if (unused) matched = unused;
          }
          usedOriginalPaths.add(matched.path);
          mappedClip = {
            id: `bank-originales-${matched.name}`,
            name: matched.name,
            path: matched.path,
            url: matched.url,
            duration: formatTimeMinutesSeconds(matched.durationSeconds),
            durationSeconds: matched.durationSeconds,
            type: 'video',
            category: 'original'
          };
        }
      } else if (category === 'stock') {
        if (stockFiles.length > 0) {
          let selectedFile = await selectBestStockClip(temaGeneral, paragraph, stockFiles, apiKey);
          let filePath = selectedFile ? path.join(targetStockDir, selectedFile) : '';
          
          if (filePath && usedStockPaths.has(filePath)) {
            const unusedFile = stockFiles.find(f => !usedStockPaths.has(path.join(targetStockDir, f)));
            if (unusedFile) {
              selectedFile = unusedFile;
              filePath = path.join(targetStockDir, selectedFile);
            }
          }

          if (filePath && selectedFile) {
            usedStockPaths.add(filePath);
            const dur = await getVideoDuration(filePath);
            mappedClip = {
              id: `bank-stock-${selectedFile}`,
              name: selectedFile,
              path: filePath,
              url: `file:///${filePath.replace(/\\/g, '/')}`,
              duration: formatTimeMinutesSeconds(dur),
              durationSeconds: dur,
              type: 'video',
              category: 'stock'
            };
          }
        }
      }

      mappedSlots.push({
        index: i,
        paragraph,
        category,
        clip: mappedClip,
        remotionProps: assignment.remotionProps,
        minimaxPrompt: assignment.minimaxPrompt,
        startSeconds: i * 3,
        durationSeconds: 3
      });
    }

    // FASE 3: Verificación Previa Obligatoria
    await logMessage(`[FASE 3] Iniciando verificación previa en disco...`);
    const tempDir = useActiveProj ? path.join(projectDir, 'temp', 'temp_renders') : path.join(bankDir, 'temp_renders');
    if (!(await exists(tempDir))) {
      await fs.promises.mkdir(tempDir, { recursive: true });
    }

    const compositionsDir = path.join(process.cwd(), 'hyperframes-project', 'compositions');
    const alternativeCompositionsDir = path.join(process.cwd(), 'cipher-studio', 'hyperframes-project', 'compositions');
    const targetCompositionsDir = (await exists(path.join(process.cwd(), 'hyperframes-project'))) ? compositionsDir : alternativeCompositionsDir;
    if (!(await exists(targetCompositionsDir))) {
      await fs.promises.mkdir(targetCompositionsDir, { recursive: true });
    }

    for (let i = 0; i < totalClips; i++) {
      const slot = mappedSlots[i];
      if (slot.category === 'original' || slot.category === 'stock') {
        let fileExists = false;
        if (slot.clip && slot.clip.path) {
          fileExists = await exists(slot.clip.path);
        }
        
        if (!fileExists) {
          await logMessage(`[FASE 3] Falta clip para slot ${i} (${slot.category}). Buscando fallback...`);
          if (slot.category === 'original' && originalClips.length > 0) {
            const fallbackClip = originalClips[i % originalClips.length];
            slot.clip = {
              id: `bank-originales-${fallbackClip.name}`,
              name: fallbackClip.name,
              path: fallbackClip.path,
              url: fallbackClip.url,
              duration: formatTimeMinutesSeconds(fallbackClip.durationSeconds),
              durationSeconds: fallbackClip.durationSeconds,
              type: 'video',
              category: 'original'
            };
          } else if (slot.category === 'stock' && stockFiles.length > 0) {
            const fallbackFile = stockFiles[i % stockFiles.length];
            const fallbackPath = path.join(targetStockDir, fallbackFile);
            const dur = await getVideoDuration(fallbackPath);
            slot.clip = {
              id: `bank-stock-${fallbackFile}`,
              name: fallbackFile,
              path: fallbackPath,
              url: `file:///${fallbackPath.replace(/\\/g, '/')}`,
              duration: formatTimeMinutesSeconds(dur),
              durationSeconds: dur,
              type: 'video',
              category: 'stock'
            };
          } else {
            await logMessage(`[FASE 3] No hay archivos en disco de ${slot.category}. Reemplazando slot por Remotion.`);
            slot.category = 'remotion';
            slot.remotionProps = {
              keyword: ['memoria', 'energía', 'datos', 'conexión', 'tecnología', 'futuro'][i % 6]
            };
          }
        }
      }
    }
    await logMessage(`[FASE 3] Verificación completada. Todos los clips confirmados.`);

    // FASE 4: Creación de Clips (Remotion y MiniMax)
    await logMessage(`[FASE 4] Iniciando renderizado/generación de clips IA...`);
    const timestamp = Date.now();

    for (let i = 0; i < totalClips; i++) {
      const slot = mappedSlots[i];
      event.sender.send('generation-progress', {
        index: i,
        total: totalClips,
        paragraph: slot.paragraph.substring(0, 45) + '...',
        type: slot.category.toUpperCase()
      });

      if (slot.category === 'remotion') {
        const randHash = Math.random().toString(36).substring(2, 7);
        const clipFileName = `remotion_${timestamp}_${i + 1}_${randHash}.mp4`;
        const outPath = useActiveProj 
          ? path.join(projectDir, 'temp', 'remotion', clipFileName) 
          : path.join(bankDir, 'remotion', clipFileName);
          
        const tempPropsPath = path.join(tempDir, `remotion_props_${timestamp}_${i + 1}.json`);
        const propsJson = {
          keyword: slot.remotionProps?.keyword || slot.paragraph?.split(' ').slice(0, 3).join(' ') || 'concepto',
          aspectRatio
        };
        
        await fs.promises.writeFile(tempPropsPath, JSON.stringify(propsJson, null, 2), 'utf8');
        
        const remotionProjectRoot = getRemotionPath();
        const entryFile = path.join(remotionProjectRoot, 'remotion', 'src', 'index.ts');
        
        let sizeFlags = '--width=1920 --height=1080';
        if (aspectRatio === 'vertical' || aspectRatio === '9:16') {
          sizeFlags = '--width=1080 --height=1920';
        }

        await new Promise<void>((resolvePromise) => {
          const cmd = `npx remotion render "${entryFile}" MainClip "${outPath}" --props="${tempPropsPath}" --frames=0-89 ${sizeFlags}`;
          exec(cmd, { cwd: remotionProjectRoot }, async (_err) => {
            try { await fs.promises.unlink(tempPropsPath); } catch (e) {}
            resolvePromise();
          });
        });

        if (await exists(outPath)) {
          const dur = await getVideoDuration(outPath);
          slot.clip = {
            id: `bank-remotion-${clipFileName}`,
            name: clipFileName,
            path: outPath,
            url: `file:///${outPath.replace(/\\/g, '/')}`,
            duration: formatTimeMinutesSeconds(dur),
            durationSeconds: dur,
            type: 'video',
            category: 'remotion'
          };
        } else {
          await logMessage(`[FASE 4] Remotion falló para slot ${i}. Aplicando fallback...`);
          if (originalClips.length > 0) {
            const fallbackClip = originalClips[i % originalClips.length];
            slot.clip = {
              id: `bank-originales-${fallbackClip.name}`,
              name: fallbackClip.name,
              path: fallbackClip.path,
              url: fallbackClip.url,
              duration: formatTimeMinutesSeconds(fallbackClip.durationSeconds),
              durationSeconds: fallbackClip.durationSeconds,
              type: 'video',
              category: 'original'
            };
          }
        }
      } else if (slot.category === 'minimax') {
        try {
          await logMessage(`[FASE 4] Solicitando video MiniMax para slot ${i}...`);
          const minimaxApiKey = process.env.MINIMAX_API_KEY;
          if (!minimaxApiKey) throw new Error('MINIMAX_API_KEY no configurado');
          
          const clipInfo = await generateMiniMaxClipHelper(slot.minimaxPrompt, minimaxApiKey, activeProjectPath, bankDir);
          if (clipInfo) {
            slot.clip = clipInfo;
          }
        } catch (errMini: any) {
          await logMessage(`[FASE 4] MiniMax falló para slot ${i}: ${errMini.message || errMini}`);
        }
        
        if (!slot.clip) {
          await logMessage(`[FASE 4] Aplicando fallback Remotion para MiniMax en slot ${i}...`);
          const randHash = Math.random().toString(36).substring(2, 7);
          const clipFileName = `remotion_fallback_${timestamp}_${i + 1}_${randHash}.mp4`;
          const outPath = useActiveProj 
            ? path.join(projectDir, 'temp', 'remotion', clipFileName) 
            : path.join(bankDir, 'remotion', clipFileName);
            
          const tempPropsPath = path.join(tempDir, `remotion_props_fb_${timestamp}_${i + 1}.json`);
          const propsJson = {
            keyword: slot.remotionProps?.keyword || slot.paragraph?.split(' ').slice(0, 3).join(' ') || 'tecnología',
            aspectRatio
          };
          
          await fs.promises.writeFile(tempPropsPath, JSON.stringify(propsJson, null, 2), 'utf8');
          const remotionProjectRoot = getRemotionPath();
          const entryFile = path.join(remotionProjectRoot, 'remotion', 'src', 'index.ts');
          
          let sizeFlags = '--width=1920 --height=1080';
          if (aspectRatio === 'vertical' || aspectRatio === '9:16') {
            sizeFlags = '--width=1080 --height=1920';
          }

          await new Promise<void>((resolvePromise) => {
            const cmd = `npx remotion render "${entryFile}" MainClip "${outPath}" --props="${tempPropsPath}" --frames=0-89 ${sizeFlags}`;
            exec(cmd, { cwd: remotionProjectRoot }, async (_err) => {
              try { await fs.promises.unlink(tempPropsPath); } catch (e) {}
              resolvePromise();
            });
          });

          if (await exists(outPath)) {
            const dur = await getVideoDuration(outPath);
            slot.clip = {
              id: `bank-remotion-${clipFileName}`,
              name: clipFileName,
              path: outPath,
              url: `file:///${outPath.replace(/\\/g, '/')}`,
              duration: formatTimeMinutesSeconds(dur),
              durationSeconds: dur,
              type: 'video',
              category: 'remotion'
            };
          }
        }
      }
    }

    // FASE 5: Verificación Final y Ensamblaje
    await logMessage(`[FASE 5] Ensamblando timeline secuencial sin huecos (gaps)...`);
    const assembledClips: any[] = [];
    let currentStart = 0;

    for (let i = 0; i < totalClips; i++) {
      const slot = mappedSlots[i];
      if (slot.clip) {
        slot.clip.startSeconds = currentStart;
        assembledClips.push(slot.clip);
        currentStart += slot.clip.durationSeconds;
      }
    }

    // FASE 6: Insertar transiciones Hyperframes al final
    const finalClips: any[] = [];
    const sliderPercentage = typeof hyperframesFrequency === 'number' ? hyperframesFrequency : 30;
    
    if (sliderPercentage > 0) {
      const N_trans = Math.round(10 / (sliderPercentage / 10));
      await logMessage(`[FASE 6] Insertando transiciones Hyperframes cada N=${N_trans} clips...`);
      let transCounter = 0;
      const effects = ['flash', 'sweep', 'zoom', 'glitch', 'onda'];
      let lastTransIndex = -1;

      for (let k = 0; k < assembledClips.length; k++) {
        finalClips.push(assembledClips[k]);

        if (k < assembledClips.length - 1 && (k + 1) % N_trans === 0) {
          // Elegimos una transición al azar pero distinta a la anterior.
          let transIndex = Math.floor(Math.random() * 5);
          if (transIndex === lastTransIndex) transIndex = (transIndex + 1) % 5;
          lastTransIndex = transIndex;
          const effect = effects[transIndex];
          await logMessage(`[FASE 6] Renderizando transición Hyperframes (${effect})...`);

          const transClip = await renderTransitionClip(
            effect,
            transCounter,
            transIndex,
            targetCompositionsDir,
            projectDir,
            bankDir,
            useActiveProj
          );
          
          if (transClip) {
            finalClips.push(transClip);
            transCounter++;
          }
        }
      }
    } else {
      await logMessage(`[FASE 6] Slider de transiciones en 0%. No se insertan transiciones.`);
      finalClips.push(...assembledClips);
    }

    let runningStart = 0;
    for (let k = 0; k < finalClips.length; k++) {
      finalClips[k].startSeconds = runningStart;
      runningStart += finalClips[k].durationSeconds;
    }

    try { await fs.promises.rmdir(tempDir); } catch (e) {}

    await logMessage(`[Construir Timeline] Completado con éxito. Clips totales en timeline: ${finalClips.length}`);

    return {
      success: true,
      clips: finalClips
    };

  } catch (err: any) {
    const errMsg = `[generate-timeline-assets] Error: ${err.message || err}`;
    console.error(errMsg, err);
    await writeDebugLog(errMsg);
    return { success: false, error: err.message || 'Error interno al generar assets de la IA' };
  }
});

function generateHyperframesHtml(item: any): string {
  const isTransition = !!item.isTransition;
  const transitionIndex = typeof item.transitionIndex === 'number' ? item.transitionIndex : 0;
  const templateIndex = typeof item.templateIndex === 'number' ? item.templateIndex : 0;
  
  const coreStyles = `
    <style>
      body {
        background-color: #020712;
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
      }
      .hf-container {
        width: 1920px;
        height: 1080px;
        position: relative;
        overflow: hidden;
      }
    </style>
  `;

  let bodyHtml = '';
  let gsapScript = '';

  if (isTransition) {
    switch (transitionIndex % 5) {
      case 0: // 1. Flash de luz que borra y revela
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; justify-content: center; align-items: center;">
            <div id="trans-flash" style="position: absolute; inset: 0; background: #ffffff; opacity: 0; z-index: 999;"></div>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          tl.to("#trans-flash", { opacity: 1, duration: 0.25, ease: "power2.in" }, 0);
          tl.to("#trans-flash", { opacity: 0, duration: 0.75, ease: "power2.out" }, 0.25);
        `;
        break;

      case 1: // 2. Líneas barriendo de izquierda a derecha
        bodyHtml = `
          <div class="hf-container" style="background: #020712; position: relative;">
            <div class="sweep-bar" style="position: absolute; top: 0; bottom: 0; left: -25%; width: 25%; background: #00d4ff; opacity: 0.8; box-shadow: 0 0 30px #00d4ff;"></div>
            <div class="sweep-bar" style="position: absolute; top: 0; bottom: 0; left: -25%; width: 25%; background: #fbbf24; opacity: 0.8; box-shadow: 0 0 30px #fbbf24;"></div>
            <div class="sweep-bar" style="position: absolute; top: 0; bottom: 0; left: -25%; width: 25%; background: #f472b6; opacity: 0.8; box-shadow: 0 0 30px #f472b6;"></div>
            <div class="sweep-bar" style="position: absolute; top: 0; bottom: 0; left: -25%; width: 25%; background: #6366f1; opacity: 0.8; box-shadow: 0 0 30px #6366f1;"></div>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          const bars = document.querySelectorAll(".sweep-bar");
          bars.forEach((bar, idx) => {
            tl.to(bar, { left: "100%", duration: 0.6, ease: "power2.inOut" }, idx * 0.08);
          });
        `;
        break;

      case 2: // 3. Zoom extremo hacia adentro
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; justify-content: center; align-items: center; position: relative;">
            <div id="zoom-circle-1" style="position: absolute; border: 8px solid #00d4ff; border-radius: 50%; width: 100px; height: 100px; opacity: 0; box-shadow: 0 0 20px #00d4ff;"></div>
            <div id="zoom-circle-2" style="position: absolute; border: 8px solid #fbbf24; border-radius: 50%; width: 200px; height: 200px; opacity: 0; box-shadow: 0 0 20px #fbbf24;"></div>
            <div id="zoom-circle-3" style="position: absolute; border: 8px solid #f472b6; border-radius: 50%; width: 300px; height: 300px; opacity: 0; box-shadow: 0 0 20px #f472b6;"></div>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          tl.to("#zoom-circle-1", { scale: 18, opacity: 1, duration: 0.5, ease: "power2.in" }, 0);
          tl.to("#zoom-circle-2", { scale: 14, opacity: 1, duration: 0.6, ease: "power2.in" }, 0.1);
          tl.to("#zoom-circle-3", { scale: 10, opacity: 1, duration: 0.7, ease: "power2.in" }, 0.2);
        `;
        break;

      case 3: // 4. Glitch que distorsiona y corta
        bodyHtml = `
          <div class="hf-container" style="background: #020712; position: relative;">
            ${Array.from({ length: 15 }).map((_, idx) => `
              <div class="glitch-block" style="position: absolute; width: ${200 + Math.random() * 400}px; height: ${80 + Math.random() * 200}px; background: ${idx % 4 === 0 ? '#00d4ff' : idx % 4 === 1 ? '#fbbf24' : idx % 4 === 2 ? '#f472b6' : '#6366f1'}; opacity: 0; left: ${Math.random() * 100}%; top: ${Math.random() * 100}%; transform: translate(-50%, -50%); box-shadow: 0 0 15px rgba(255,255,255,0.2);"></div>
            `).join('')}
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          const blocks = document.querySelectorAll(".glitch-block");
          blocks.forEach((block) => {
            const showTime = Math.random() * 0.5;
            tl.to(block, { opacity: 0.85, duration: 0.08, yoyo: true, repeat: 3, ease: "none" }, showTime);
          });
        `;
        break;

      case 4: // 5. Onda de color expandiéndose
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; justify-content: center; align-items: center; position: relative;">
            <svg width="100%" height="100%" viewBox="0 0 1000 1000" style="position: absolute; inset: 0;">
              <circle id="wave-circle" cx="500" cy="500" r="0" fill="none" stroke="#6366f1" stroke-width="40" opacity="0" />
            </svg>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          tl.to("#wave-circle", { attr: { r: 800 }, strokeWidth: 150, opacity: 1, duration: 0.7, ease: "power2.out" }, 0);
          tl.to("#wave-circle", { opacity: 0, duration: 0.2 }, 0.55);
        `;
        break;
    }
  } else {
    switch (templateIndex % 5) {
      case 0: // Rotating progress dial
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; justify-content: center; align-items: center; position: relative;">
            <svg width="600" height="600" viewBox="0 0 400 400" style="filter: drop-shadow(0 0 15px #00d4ff);">
              <circle cx="200" cy="200" r="120" fill="none" stroke="#6366f1" stroke-width="6" opacity="0.2" />
              <circle id="dial-progress" cx="200" cy="200" r="120" fill="none" stroke="#00d4ff" stroke-width="12" stroke-linecap="round" stroke-dasharray="754" stroke-dashoffset="754" transform="rotate(-90 200 200)" />
              <circle id="dial-outer" cx="200" cy="200" r="150" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="10 15" opacity="0.5" />
            </svg>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          tl.to("#dial-progress", { strokeDashoffset: 200, duration: 1.5, ease: "power2.out" }, 0);
          tl.to("#dial-outer", { rotation: 360, transformOrigin: "center center", duration: 3.0, ease: "none" }, 0);
        `;
        break;

      case 1: // Progress Bar and explosion
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 120px;">
            <div style="width: 1000px; height: 40px; background: #110e2e; border-radius: 20px; border: 3px solid #6366f1; overflow: hidden; position: relative;">
              <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #6366f1, #f472b6, #fbbf24); border-radius: 20px; box-shadow: 0 0 20px #f472b6;"></div>
            </div>
            <div style="position: absolute; inset: 0; pointer-events: none; z-index: 5;">
              ${Array.from({ length: 25 }).map((_, idx) => `
                <div class="hf-p" style="position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: ${idx % 3 === 0 ? '#00d4ff' : idx % 3 === 1 ? '#f472b6' : '#fbbf24'}; opacity: 0; transform: translate(-50%, -50%);"></div>
              `).join('')}
            </div>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          tl.to("#progress-bar", { width: "80%", duration: 1.8, ease: "power2.inOut" }, 0);
          const ps = document.querySelectorAll(".hf-p");
          ps.forEach((p, idx) => {
            const angle = (idx / ps.length) * 2 * Math.PI + Math.random() * 0.3;
            const dist = 150 + Math.random() * 250;
            tl.to(p, { opacity: 1, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: 0, duration: 1.2, ease: "power3.out" }, 0.9);
          });
        `;
        break;

      case 2: // Glitch geometric shapes
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; justify-content: center; align-items: center; position: relative;">
            <div id="sh-rect" style="position: absolute; border: 4px solid #f472b6; width: 250px; height: 250px; opacity: 0; box-shadow: 0 0 15px #f472b6;"></div>
            <div id="sh-circ" style="position: absolute; border: 4px solid #00d4ff; border-radius: 50%; width: 300px; height: 300px; opacity: 0; box-shadow: 0 0 15px #00d4ff;"></div>
            <div id="sh-tri" style="position: absolute; width: 0; height: 0; border-left: 150px solid transparent; border-right: 150px solid transparent; border-bottom: 260px solid #fbbf24; opacity: 0; filter: drop-shadow(0 0 15px #fbbf24);"></div>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          tl.to("#sh-rect", { opacity: 0.8, scale: 1.3, rotation: 45, duration: 0.8, ease: "back.out" }, 0.1);
          tl.to("#sh-circ", { opacity: 0.8, scale: 0.9, duration: 1.0, ease: "back.out" }, 0.3);
          tl.to("#sh-tri", { opacity: 0.5, scale: 0.7, rotation: -20, duration: 1.2, ease: "back.out" }, 0.5);
          
          for (let t = 1.0; t < 3.0; t += 0.2) {
            tl.to("#sh-rect", { x: (Math.random() - 0.5) * 20, duration: 0.08 }, t);
            tl.to("#sh-circ", { y: (Math.random() - 0.5) * 20, duration: 0.08 }, t + 0.05);
          }
        `;
        break;

      case 3: // Speed Lines and concentric rings pulsing
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; justify-content: center; align-items: center; position: relative;">
            <div style="position: absolute; inset: 0; overflow: hidden;">
              ${Array.from({ length: 20 }).map((_, idx) => `
                <div class="hf-sl" style="position: absolute; left: -100%; top: ${5 + idx * 4.5}%; width: 70%; height: 3px; background: linear-gradient(90deg, transparent, #6366f1, transparent); opacity: 0.6;"></div>
              `).join('')}
            </div>
            <div id="pulsing-shield" style="width: 200px; height: 200px; border: 8px solid #fbbf24; border-radius: 50%; opacity: 0; box-shadow: 0 0 30px #fbbf24; z-index: 10;"></div>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          tl.to("#pulsing-shield", { opacity: 1, scale: 1.5, duration: 0.6, ease: "back.out" }, 0.1);
          tl.to("#pulsing-shield", { scale: 1.3, duration: 0.4, yoyo: true, repeat: -1, ease: "sine.inOut" }, 0.7);
          
          const sls = document.querySelectorAll(".hf-sl");
          sls.forEach((sl, idx) => {
            tl.to(sl, { left: "100%", duration: 0.4 + Math.random() * 0.2, repeat: 7, ease: "none" }, (idx * 0.05) % 0.5);
          });
        `;
        break;

      case 4: // Heatmap waves / dots grid
        bodyHtml = `
          <div class="hf-container" style="background: #020712; display: flex; justify-content: center; align-items: center; position: relative;">
            <div style="position: absolute; inset: 0; background: radial-gradient(circle, transparent 20%, #020712 95%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 100% 100%, 40px 40px;"></div>
            <div class="heat-node" style="position: absolute; width: 300px; height: 300px; border-radius: 50%; background: radial-gradient(circle, rgba(0, 212, 255, 0.4) 0%, transparent 70%); left: 30%; top: 40%; transform: scale(0.1); opacity: 0;"></div>
            <div class="heat-node" style="position: absolute; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 114, 182, 0.4) 0%, transparent 70%); left: 70%; top: 60%; transform: scale(0.1); opacity: 0;"></div>
          </div>
        `;
        gsapScript = `
          const tl = window.__timelines["main"];
          const nodes = document.querySelectorAll(".heat-node");
          nodes.forEach((node, idx) => {
            tl.to(node, { opacity: 1, scale: 1.4, duration: 1.0, ease: "power2.out" }, idx * 0.3);
            tl.to(node, { scale: 1.1, opacity: 0.6, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }, idx * 0.3 + 1.0);
          });
        `;
        break;
    }
  }

  return `
    ${coreStyles}
    ${bodyHtml}
    <script>
      (function() {
        ${gsapScript}
      })();
    </script>
  `;
}



