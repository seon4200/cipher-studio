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
  if (!parsed) return parsed;
  if (parsed.clips && Array.isArray(parsed.clips)) {
    const validClips: any[] = [];
    for (const clip of parsed.clips) {
      if (clip.path && (await exists(clip.path))) {
        validClips.push(clip);
      }
    }
    parsed.clips = validClips;
  }
  if (parsed.timelineVideoClips && Array.isArray(parsed.timelineVideoClips)) {
    const validTimelineClips: any[] = [];
    for (const clip of parsed.timelineVideoClips) {
      if (!clip.path) {
        validTimelineClips.push(clip);
      } else if (clip.path === 'remotion-dynamic' || clip.path === 'hyperframes-dynamic') {
        validTimelineClips.push(clip);
      } else if (await exists(clip.path)) {
        validTimelineClips.push(clip);
      }
    }
    parsed.timelineVideoClips = validTimelineClips;
  }
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

// IPC handle for loading clips in a category folder of banco-clips
ipcMain.handle('load-bank-clips', async (_event, { category }) => {
  try {
    const isTempCategory = category === 'originales'
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
ipcMain.handle('export-video', async (_event, { clips, aspectRatio }) => {
  try {
    if (!win) return { success: false, error: 'Ventana no disponible' }

    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Exportar Video',
      defaultPath: path.join(app.getPath('downloads'), 'export.mp4'),
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    })

    if (canceled || !filePath) {
      return { success: false, error: 'Exportación cancelada por el usuario' }
    }

    if (!clips || clips.length === 0) {
      return { success: false, error: 'No hay clips en el Timeline para exportar.' }
    }

    // Determine crop filter
    let filterStr = ''
    if (aspectRatio === 'vertical') {
      filterStr = `-vf "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2'"`
    } else if (aspectRatio === 'square') {
      filterStr = `-vf "crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2'"`
    } else if (aspectRatio === 'horizontal') {
      filterStr = `-vf "crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2'"`
    }

    const escapedOut = filePath.replace(/"/g, '\\"')

    if (clips.length === 1) {
      const videoPath = clips[0].path
      if (!videoPath || !(await exists(videoPath))) {
        return { success: false, error: `El archivo original no existe o no tiene ruta: ${clips[0].name}` }
      }
      const escapedVideo = videoPath.replace(/"/g, '\\"')
      const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" ${filterStr} -c:v libx264 -preset ultrafast -crf 23 -c:a aac "${escapedOut}"`
      
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
      const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" ${filterStr} -c:v libx264 -preset ultrafast -crf 23 -c:a aac "${escapedOut}"`
      
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

function distributeCounts(weights: number[], N: number): number[] {
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = sumWeights === 0 ? [25, 25, 25, 25] : weights.map(w => (w / sumWeights) * 100);
  
  const exact = normalizedWeights.map(w => (w / 100) * N);
  const counts = exact.map(Math.floor);
  let remainder = N - counts.reduce((a, b) => a + b, 0);
  
  // Sort indices by their fractional parts in descending order
  const fracts = exact.map((val, idx) => ({ idx, fract: val - counts[idx] }));
  fracts.sort((a, b) => b.fract - a.fract);
  
  for (let i = 0; i < remainder; i++) {
    counts[fracts[i].idx]++;
  }
  return counts;
}

function solveAssignment(
  analysisResults: any[], 
  C_orig: number, 
  _C_stock: number, 
  C_remotion: number,  
  C_hyper: number
): string[] {
  const N = analysisResults.length;
  const counts: Record<string, number> = {
    original: C_orig,
    stock: _C_stock,
    remotion: C_remotion,
    hyperframes: C_hyper
  };

  const assignment: string[] = [];
  
  for (let i = 0; i < N; i++) {
    const available = Object.keys(counts).filter(type => counts[type] > 0);
    const prevType = i > 0 ? assignment[i - 1] : null;
    const candidates = available.filter(type => type !== prevType);
    
    let chosenType = '';
    if (candidates.length > 0) {
      candidates.sort((a, b) => counts[b] - counts[a]);
      chosenType = candidates[0];
      counts[chosenType]--;
    } else {
      // Force non-repetition by borrowing from any other type
      const allTypes = ['original', 'stock', 'remotion', 'hyperframes'];
      const nonPrev = allTypes.filter(type => type !== prevType);
      nonPrev.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
      chosenType = nonPrev[0];
      counts[chosenType]--;
    }
    
    assignment.push(chosenType);
  }
  
  return assignment;
}

function segmentScript(scriptText: string): string[] {
  // Split by newlines first
  const lines = scriptText.split(/\r?\n/);
  const rawFragments: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Split by periods followed by whitespace or end of string, keeping the period
    const sentences = trimmedLine.split(/(?<=\.(?=\s|$))/);
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length > 0) {
        rawFragments.push(trimmedSentence);
      }
    }
  }

  const finalFragments: string[] = [];
  
  for (const frag of rawFragments) {
    const words = frag.split(/\s+/).filter(Boolean);
    if (words.length <= 30) {
      finalFragments.push(frag);
    } else {
      // Split into chunks of maximum 30 words
      let currentChunk: string[] = [];
      for (const word of words) {
        currentChunk.push(word);
        if (currentChunk.length === 30) {
          finalFragments.push(currentChunk.join(' '));
          currentChunk = [];
        }
      }
      if (currentChunk.length > 0) {
        finalFragments.push(currentChunk.join(' '));
      }
    }
  }
  
  return finalFragments.filter(p => p.length > 2);
}

ipcMain.handle('generate-timeline-assets', async (event, { scriptText, weights, aspectRatio }) => {
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

  try {
    const startMsg = `[generate-timeline-assets] Iniciando análisis del guion para Remotion/Hyperframes con pesos: ${JSON.stringify(weights)}`;
    console.log(startMsg);
    await writeDebugLog(startMsg);
    
    // 1. Obtener la clave de API de DeepSeek
    loadEnv();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      const errMsg = 'No se configuró DEEPSEEK_API_KEY en el archivo .env';
      await writeDebugLog(errMsg);
      return { success: false, error: errMsg };
    }

    // 3. Segmentar guion en párrafos
    const paragraphs = segmentScript(scriptText);

    if (paragraphs.length === 0) {
      const errMsg = 'No se encontraron párrafos válidos en el guion.';
      await writeDebugLog(errMsg);
      return { success: false, error: errMsg };
    }

    const detectMsg = `[generate-timeline-assets] Párrafos detectados: ${paragraphs.length}`;
    console.log(detectMsg);
    await writeDebugLog(detectMsg);

    // 4. Obtener tema general del guión en una llamada rápida
    let temaGeneral = 'tecnología y digital';
    try {
      const themePrompt = `Analiza este guion de video y resume su tema principal en una frase corta de máximo 5 palabras:
      "${scriptText.substring(0, 1200)}"
      Devuelve únicamente la frase del tema.`;
      
      const themeRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Eres un programador experto y director creativo. Responde con el tema principal de forma resumida.' },
            { role: 'user', content: themePrompt }
          ],
          temperature: 0.3
        })
      });
      if (themeRes.ok) {
        const themeJson = await themeRes.json() as any;
        const themeContent = themeJson?.choices?.[0]?.message?.content || '';
        if (themeContent.trim()) {
          temaGeneral = themeContent.trim().replace(/['"“”]/g, '');
        }
      }
    } catch (errTheme) {
      console.error('Error al obtener tema general:', errTheme);
    }
    await writeDebugLog(`[generate-timeline-assets] Tema general del guion: ${temaGeneral}`);

    // 5. Iniciar bucle de llamadas individuales por párrafo
    const analysisResults: any[] = [];
    for (let idx = 0; idx < paragraphs.length; idx++) {
      const paragraph = paragraphs[idx];
      const prevParagraph = idx > 0 ? paragraphs[idx - 1] : 'Ninguno';
      const nextParagraph = idx < paragraphs.length - 1 ? paragraphs[idx + 1] : 'Ninguno';
      
      const dsPrompt = `Analiza este párrafo en contexto y determina qué escena visual de dibujo animado lo ilustra mejor.
PROHIBIDO sugerir texto, palabras o letras en la escena.
Solo figuras, formas y movimiento visual puro.

Elige UNA escena:
- neural: mente, memoria, cerebro, pensamiento, psicología
- figure: personas, acciones humanas, movimiento, cuerpo
- nodes: conexiones, redes, sociedad, sistema, relaciones
- mesh: datos, economía, ondas, patrones, flujos
- map: lugares, geografía, países, ciudades, territorio
- binary: tecnología, digital, IA, código, información

Devuelve JSON:
- sceneType: tipo elegido
- speed: slow | medium | fast según intensidad emocional
- energy: 1 al 10
- primaryColor: color hex según tono emocional
- motionDirection: inward | outward | left | right | circular

Contexto:
- Párrafo anterior: ${prevParagraph}
- Párrafo actual: ${paragraph}
- Párrafo siguiente: ${nextParagraph}
- Tema general: ${temaGeneral}`;

      let parsedResult: any = null;
      let attempt = 0;
      while (!parsedResult && attempt < 2) {
        try {
          const dsResponse = await fetch('https://api.deepseek.com/chat/completions', {
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
                  content: 'Eres un programador experto y director creativo. Responde ÚNICAMENTE con el objeto JSON solicitado, sin prefacios ni bloques markdown.'
                },
                { role: 'user', content: dsPrompt }
              ],
              temperature: 0.2
            })
          });

          if (dsResponse.ok) {
            const dsData = (await dsResponse.json()) as any;
            const content = dsData?.choices?.[0]?.message?.content || '';
            let cleanContent = content.trim();
            if (cleanContent.includes('{')) {
              cleanContent = cleanContent.substring(cleanContent.indexOf('{'), cleanContent.lastIndexOf('}') + 1);
            }
            const resObj = JSON.parse(cleanContent);
            if (resObj && resObj.sceneType) {
              parsedResult = resObj;
            }
          }
        } catch (e) {
          console.error(`Intento ${attempt + 1} falló para párrafo ${idx + 1}:`, e);
        }
        attempt++;
      }

      if (!parsedResult) {
        let sceneType = 'neural';
        if (/(tecnología|digital|código|ia|rob|web|computa)/i.test(paragraph)) sceneType = 'binary';
        else if (/(lugar|país|ciudad|mapa|mundo|territorio|geograf)/i.test(paragraph)) sceneType = 'map';
        else if (/(datos|finanzas|dinero|flujo|econom|onda|crecim)/i.test(paragraph)) sceneType = 'mesh';
        else if (/(persona|gente|sociedad|grupo|red|sistema|relac)/i.test(paragraph)) sceneType = 'nodes';
        else if (/(cuerpo|correr|caminar|acción|movimiento|humano)/i.test(paragraph)) sceneType = 'figure';
        
        parsedResult = {
          sceneType,
          speed: 'medium',
          energy: 5,
          primaryColor: '#00d4ff',
          motionDirection: 'circular'
        };
      }

      analysisResults.push({
        paragraph,
        remotionScore: parsedResult.energy || 5,
        hyperframesScore: parsedResult.energy || 5,
        sceneTheme: parsedResult.sceneType === 'neural' ? 'memory' : 
                    parsedResult.sceneType === 'figure' ? 'action' : 
                    parsedResult.sceneType === 'nodes' ? 'society' : 
                    parsedResult.sceneType === 'mesh' ? 'data' : 
                    parsedResult.sceneType === 'map' ? 'geography' : 'technology',
        sceneType: parsedResult.sceneType,
        backgroundType: parsedResult.sceneType,
        figureAnimation: parsedResult.sceneType === 'figure' ? 'consumo' : 'none',
        energy: parsedResult.energy || 5,
        speed: parsedResult.speed || 'medium',
        primaryColor: parsedResult.primaryColor || '#00d4ff',
        motionDirection: parsedResult.motionDirection || 'circular',
        hyperframesProps: {
          text: '',
          number: 0,
          unit: '',
          percentage: 0,
          isNegative: parsedResult.primaryColor === '#ef4444'
        },
        remotionProps: {
          chartType: 'none',
          title: '',
          data: [],
          metricValue: '',
          metricLabel: '',
          numberData: 0,
          unitData: '',
          percentageData: 0,
          isNegative: parsedResult.primaryColor === '#ef4444'
        }
      });
      
      await writeDebugLog(`[generate-timeline-assets] Analizado párrafo ${idx + 1}/${paragraphs.length}: type=${parsedResult.sceneType}, energy=${parsedResult.energy}, color=${parsedResult.primaryColor}`);
    }

    // Calcular las cantidades exactas por categoría en base a los pesos
    const N = paragraphs.length;
    const P = weights ? (weights[3] || 0) : 10;
    const targetCounts = distributeCounts(weights || [40, 30, 20, 10], N);
    const C_orig = targetCounts[0];
    const C_stock = targetCounts[1];
    const C_remotion = targetCounts[2];
    const C_hyper = targetCounts[3];
    
    const propMsg = `[generate-timeline-assets] Proporciones calculadas para N=${N} párrafos -> Originales: ${C_orig}, Stock: ${C_stock}, Remotion: ${C_remotion}, Hyperframes: ${C_hyper}`;
    console.log(propMsg);
    await writeDebugLog(propMsg);

    // Resolver la asignación greedy
    const assignedTypes = solveAssignment(analysisResults, C_orig, C_stock, C_remotion, C_hyper);

    // Lógica de Clips de Impacto (mitad del porcentaje): K = Math.round((P/2)/100 * N)
    const targetImpactCount = Math.round((P / 2) / 100 * N);
    const scoredIndices = analysisResults.map((item, index) => {
      const paragraph = item.paragraph || '';
      const hasNumber = /\d+/.test(paragraph);
      const energy = item.energy || 5;
      const hasKeyWords = /(revelación|secreto|clave|sorpresa|impacto|increíble|caída|colapso|peligro|alerta|alucinante|impresionante)/i.test(paragraph);
      const score = (hasNumber ? 5 : 0) + energy + (hasKeyWords ? 4 : 0);
      return { index, score };
    });
    scoredIndices.sort((a, b) => b.score - a.score);
    const impactIndices = new Set(scoredIndices.slice(0, targetImpactCount).map(item => item.index));

    const bankDir = getBancoClipsPath();
    const useActiveProj = !!activeProjectPath;
    const projectDir = useActiveProj ? activeProjectPath! : bankDir;
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

    let remotionSuccessCount = 0;
    let hyperframesSuccessCount = 0;
    let originalFallbackCount = 0;
    let emptyCount = 0;
    const generatedClips: any[] = [];
    const timestamp = Date.now();

    let remotionCounter = 0;
    let hyperframesCounter = 0;
    let transitionCounter = 0;

    for (let idx = 0; idx < analysisResults.length; idx++) {
      const item = analysisResults[idx];
      const paragraph = item.paragraph || paragraphs[idx] || '';
      
      const isImpact = impactIndices.has(idx);
      const type = isImpact ? 'hyperframes' : assignedTypes[idx];
      
      // Duración fija: 3s regular, 1s para clips de impacto
      const durationSeconds = isImpact ? 1 : 3;
      const durationInFrames = isImpact ? 30 : 90;

      // Notify progress
      event.sender.send('generation-progress', {
        index: idx,
        total: analysisResults.length,
        paragraph: paragraph.substring(0, 40) + '...',
        type: isImpact ? 'hyperframes (impacto)' : type
      });

      const procMsg = `[generate-timeline-assets] Procesando clip ${idx + 1}/${analysisResults.length} (${type}) - Duración: ${durationSeconds}s (Impacto: ${isImpact})`;
      console.log(procMsg);
      await writeDebugLog(procMsg);

      if ((type === 'original' || type === 'stock') && !isImpact) {
        generatedClips.push({
          paragraph,
          type,
          durationSeconds
        });
        
        // Agregar transición si aplica
        const transitionInterval = P >= 100 ? 1 : (P >= 50 ? 2 : (P >= 10 ? 5 : 0));
        if (transitionInterval > 0 && (idx + 1) % transitionInterval === 0 && idx < analysisResults.length - 1) {
          await renderTransitionClip();
        }
        continue;
      }

      const randHash = Math.random().toString(36).substring(2, 7);
      const clipFileName = `ai_clip_${timestamp}_${idx + 1}_${randHash}.mp4`;
      let renderSuccess = false;
      let finalType = type;

      // 2. Generación Remotion
      if (type === 'remotion' && !isImpact) {
        try {
          const remotionBgs = ['neural', 'mesh', 'binary', 'nodes', 'map', 'figure'];
          const currentBg = remotionBgs[remotionCounter % 6];
          remotionCounter++;

          const outPath = useActiveProj ? path.join(projectDir, 'temp', 'remotion', clipFileName) : path.join(bankDir, 'remotion', clipFileName);
          const tempPropsPath = path.join(tempDir, `remotion_props_${timestamp}_${idx + 1}.json`);

          const remotionProps = item.remotionProps || {};
          const propsJson = {
            text: paragraph,
            title: remotionProps.title || 'Gráfico CIPHER',
            chartType: remotionProps.chartType || 'none',
            data: remotionProps.data || [],
            metricValue: remotionProps.metricValue || '',
            metricLabel: remotionProps.metricLabel || '',
            backgroundType: currentBg,
            sceneTheme: item.sceneTheme || 'memory',
            figureAnimation: remotionProps.figureAnimation || item.figureAnimation || 'none',
            numberData: typeof remotionProps.numberData === 'number' ? remotionProps.numberData : (item.hyperframesProps && typeof item.hyperframesProps.number === 'number' ? item.hyperframesProps.number : null),
            unitData: remotionProps.unitData || (item.hyperframesProps && item.hyperframesProps.unit ? item.hyperframesProps.unit : ''),
            percentageData: typeof remotionProps.percentageData === 'number' ? remotionProps.percentageData : (item.hyperframesProps && typeof item.hyperframesProps.percentage === 'number' ? item.hyperframesProps.percentage : null),
            isNegative: typeof remotionProps.isNegative === 'boolean' ? remotionProps.isNegative : (item.hyperframesProps && typeof item.hyperframesProps.isNegative === 'boolean' ? item.hyperframesProps.isNegative : false),
            aspectRatio
          };

          await fs.promises.writeFile(tempPropsPath, JSON.stringify(propsJson, null, 2), 'utf8');

          const remotionProjectRoot = getRemotionPath();
          const entryFile = path.join(remotionProjectRoot, 'remotion', 'src', 'index.ts');
          
          let sizeFlags = '--width=1920 --height=1080';
          if (aspectRatio === 'vertical' || aspectRatio === '9:16') {
            sizeFlags = '--width=1080 --height=1920';
          } else if (aspectRatio === 'square' || aspectRatio === '1:1') {
            sizeFlags = '--width=1080 --height=1080';
          }

          await new Promise<void>((resolvePromise) => {
            const cmd = `npx remotion render "${entryFile}" MainClip "${outPath}" --props="${tempPropsPath}" --frames=0-${durationInFrames - 1} ${sizeFlags}`;
            exec(cmd, { cwd: remotionProjectRoot }, async (err, stdout, stderr) => {
              try { await fs.promises.unlink(tempPropsPath); } catch (e) {}
              if (stdout && stdout.trim()) await writeDebugLog(`  - Remotion Stdout:\n${stdout}`);
              if (stderr && stderr.trim()) await writeDebugLog(`  - Remotion Stderr:\n${stderr}`);
              if (err) {
                resolvePromise();
              } else {
                renderSuccess = true;
                resolvePromise();
              }
            });
          });

          if (renderSuccess) {
            const thumbnailName = `ai_clip_${timestamp}_${idx + 1}.jpg`;
            const thumbnailPath = useActiveProj ? path.join(projectDir, 'temp', 'thumbnails', thumbnailName) : path.join(bankDir, 'thumbnails', thumbnailName);
            let thumbnailUrl = '';
            try {
              await generateVideoThumbnail(outPath, thumbnailPath);
              if (await exists(thumbnailPath)) {
                thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString('base64')}`;
              }
            } catch (e) {}

            const stat = await fs.promises.stat(outPath);
            const clipInfo = {
              id: `bank-remotion-${clipFileName}`,
              name: clipFileName,
              path: outPath,
              url: `file:///${outPath.replace(/\\/g, '/')}`,
              duration: formatTimeMinutesSeconds(durationSeconds),
              durationSeconds,
              type: 'video',
              category: 'remotion',
              size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
              thumbnailUrl
            };

            generatedClips.push({
              paragraph,
              type: 'remotion',
              durationSeconds,
              clip: clipInfo
            });
            remotionSuccessCount++;
          }
        } catch (errRemotion: any) {
          await writeDebugLog(`[generate-timeline-assets] Excepción Remotion: ${errRemotion.message || errRemotion}`);
        }

        if (!renderSuccess) {
          finalType = 'hyperframes';
        }
      }

      // 3. Generación Hyperframes
      if (finalType === 'hyperframes' && !renderSuccess) {
        try {
          const outPath = useActiveProj ? path.join(projectDir, 'temp', 'hyperframes', clipFileName) : path.join(bankDir, 'hyperframes', clipFileName);
          const compositionHtmlPath = path.join(targetCompositionsDir, `clip_${timestamp}_${idx + 1}.html`);
          const relativeCompositionPath = `compositions/clip_${timestamp}_${idx + 1}.html`;

          const hyperframesTemplateIndex = hyperframesCounter % 5;
          hyperframesCounter++;

          const hyperframesHtml = generateHyperframesHtml({
            ...item,
            templateIndex: hyperframesTemplateIndex
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
    <div id="root" data-composition-id="main" data-start="0" data-duration="${durationSeconds}" data-width="1920" data-height="1080">
      ${hyperframesHtml}
    </div>
  </body>
</html>`;

          await fs.promises.writeFile(compositionHtmlPath, htmlTemplate, 'utf8');

          const hyperframesProjectRoot = (await exists(path.join(process.cwd(), 'hyperframes-project'))) 
            ? path.join(process.cwd(), 'hyperframes-project') 
            : path.join(process.cwd(), 'cipher-studio', 'hyperframes-project');

          await new Promise<void>((resolvePromise) => {
            const cmd = `npx hyperframes render "${hyperframesProjectRoot}" -c "${relativeCompositionPath}" -o "${outPath}"`;
            exec(cmd, { cwd: hyperframesProjectRoot }, async (err, stdout, stderr) => {
              try { await fs.promises.unlink(compositionHtmlPath); } catch (e) {}
              if (stdout && stdout.trim()) await writeDebugLog(`  - Hyperframes Stdout:\n${stdout}`);
              if (stderr && stderr.trim()) await writeDebugLog(`  - Hyperframes Stderr:\n${stderr}`);
              if (err) {
                resolvePromise();
              } else {
                renderSuccess = true;
                resolvePromise();
              }
            });
          });

          if (renderSuccess) {
            const thumbnailName = `ai_clip_${timestamp}_${idx + 1}.jpg`;
            const thumbnailPath = useActiveProj ? path.join(projectDir, 'temp', 'thumbnails', thumbnailName) : path.join(bankDir, 'thumbnails', thumbnailName);
            let thumbnailUrl = '';
            try {
              await generateVideoThumbnail(outPath, thumbnailPath);
              if (await exists(thumbnailPath)) {
                thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString('base64')}`;
              }
            } catch (e) {}

            const stat = await fs.promises.stat(outPath);
            const clipInfo = {
              id: `bank-hyperframes-${clipFileName}`,
              name: clipFileName,
              path: outPath,
              url: `file:///${outPath.replace(/\\/g, '/')}`,
              duration: formatTimeMinutesSeconds(durationSeconds),
              durationSeconds,
              type: 'video',
              category: 'hyperframes',
              size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
              thumbnailUrl
            };

            generatedClips.push({
              paragraph,
              type: 'hyperframes',
              durationSeconds,
              clip: clipInfo
            });
            hyperframesSuccessCount++;
          }
        } catch (errHyper: any) {
          await writeDebugLog(`[generate-timeline-assets] Excepción Hyperframes: ${errHyper.message || errHyper}`);
        }
      }

      if ((finalType === 'remotion' || finalType === 'hyperframes') && !renderSuccess) {
        try {
          const originalesDir = useActiveProj ? path.join(projectDir, 'temp', 'originales') : path.join(bankDir, 'originales');
          if (await exists(originalesDir)) {
            const origFiles = (await fs.promises.readdir(originalesDir)).filter(f => f.startsWith('clip_') && f.endsWith('.mp4'));
            if (origFiles.length > 0) {
              const chosenFile = origFiles[idx % origFiles.length];
              const origPath = path.join(originalesDir, chosenFile);
              
              const randHash = Math.random().toString(36).substring(2, 7);
              const uniqueClipName = `fallback_orig_${timestamp}_${idx + 1}_${randHash}.mp4`;
              const destPath = useActiveProj 
                ? path.join(projectDir, 'temp', 'originales', uniqueClipName) 
                : path.join(bankDir, 'originales', uniqueClipName);
              
              await fs.promises.copyFile(origPath, destPath);
              const durationSecondsFallback = await getVideoDuration(destPath);

              const thumbnailName = `fallback_orig_${timestamp}_${idx + 1}_${randHash}.jpg`;
              const thumbnailPath = useActiveProj ? path.join(projectDir, 'temp', 'thumbnails', thumbnailName) : path.join(bankDir, 'thumbnails', thumbnailName);
              let thumbnailUrl = '';
              try {
                await generateVideoThumbnail(destPath, thumbnailPath);
                if (await exists(thumbnailPath)) {
                  thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString('base64')}`;
                }
              } catch (e) {}

              const stat = await fs.promises.stat(destPath);
              const clipInfo = {
                id: `bank-originales-${uniqueClipName}`,
                name: uniqueClipName,
                path: destPath,
                url: `file:///${destPath.replace(/\\/g, '/')}`,
                duration: formatTimeMinutesSeconds(durationSecondsFallback),
                durationSeconds: durationSecondsFallback,
                type: 'video',
                category: 'original',
                size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
                thumbnailUrl
              };

              generatedClips.push({
                paragraph,
                type: 'original',
                durationSeconds: durationSecondsFallback,
                clip: clipInfo
              });
              renderSuccess = true;
              originalFallbackCount++;
            }
          }
        } catch (origErr: any) {
          await writeDebugLog(`[generate-timeline-assets] Fallback a original falló: ${origErr.message || origErr}`);
        }
      }

      if (!renderSuccess) {
        generatedClips.push({
          paragraph,
          type: 'empty',
          durationSeconds
        });
        emptyCount++;
      }

      // Agregar transición si aplica
      const transitionInterval = P >= 100 ? 1 : (P >= 50 ? 2 : (P >= 10 ? 5 : 0));
      if (transitionInterval > 0 && (idx + 1) % transitionInterval === 0 && idx < analysisResults.length - 1) {
        await renderTransitionClip();
      }
    }

    async function renderTransitionClip() {
      try {
        const transFileName = `ai_trans_${timestamp}_${transitionCounter + 1}.mp4`;
        const transOutPath = useActiveProj ? path.join(projectDir, 'temp', 'hyperframes', transFileName) : path.join(bankDir, 'hyperframes', transFileName);
        const transCompositionHtmlPath = path.join(targetCompositionsDir, `trans_${timestamp}_${transitionCounter + 1}.html`);
        const transRelativeCompositionPath = `compositions/trans_${timestamp}_${transitionCounter + 1}.html`;
        
        const transHtml = generateHyperframesHtml({
          isTransition: true,
          transitionIndex: transitionCounter % 5
        });
        transitionCounter++;
        
        const transHtmlTemplate = `<!doctype html>
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
    <div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="1920" data-height="1080">
      ${transHtml}
    </div>
  </body>
</html>`;

        await fs.promises.writeFile(transCompositionHtmlPath, transHtmlTemplate, 'utf8');
        
        const hyperframesProjectRoot = (await exists(path.join(process.cwd(), 'hyperframes-project'))) 
          ? path.join(process.cwd(), 'hyperframes-project') 
          : path.join(process.cwd(), 'cipher-studio', 'hyperframes-project');

        let transSuccess = false;
        await new Promise<void>((resolvePromise) => {
          const cmd = `npx hyperframes render "${hyperframesProjectRoot}" -c "${transRelativeCompositionPath}" -o "${transOutPath}"`;
          exec(cmd, { cwd: hyperframesProjectRoot }, async (err) => {
            try { await fs.promises.unlink(transCompositionHtmlPath); } catch (e) {}
            if (!err) transSuccess = true;
            resolvePromise();
          });
        });

        if (transSuccess) {
          const transThumbnailName = `ai_trans_${timestamp}_${transitionCounter}.jpg`;
          const transThumbnailPath = useActiveProj ? path.join(projectDir, 'temp', 'thumbnails', transThumbnailName) : path.join(bankDir, 'thumbnails', transThumbnailName);
          let transThumbnailUrl = '';
          try {
            await generateVideoThumbnail(transOutPath, transThumbnailPath);
            if (await exists(transThumbnailPath)) {
              transThumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(transThumbnailPath)).toString('base64')}`;
            }
          } catch (e) {}
          
          const transStat = await fs.promises.stat(transOutPath);
          generatedClips.push({
            paragraph: `Transición: ${['Flash de luz', 'Líneas barrido', 'Zoom extremo', 'Glitch distorsión', 'Onda de color'][ (transitionCounter - 1) % 5 ]}`,
            type: 'hyperframes',
            durationSeconds: 1,
            clip: {
              id: `bank-hyperframes-${transFileName}`,
              name: transFileName,
              path: transOutPath,
              url: `file:///${transOutPath.replace(/\\/g, '/')}`,
              duration: '0:01',
              durationSeconds: 1,
              type: 'video',
              category: 'hyperframes',
              size: `${(transStat.size / (1024 * 1024)).toFixed(1)} MB`,
              thumbnailUrl: transThumbnailUrl
            }
          });
          hyperframesSuccessCount++;
        }
      } catch (eTrans) {
        await writeDebugLog(`[generate-timeline-assets] Transición falló: ${eTrans}`);
      }
    }

    try { await fs.promises.rmdir(tempDir); } catch (e) {}

    const finishMsg = `[generate-timeline-assets] Generación finalizada. Resumen de Generación:
      - Remotion generados con éxito: ${remotionSuccessCount}
      - Hyperframes generados con éxito: ${hyperframesSuccessCount}
      - Fallback a original: ${originalFallbackCount}
      - Slots vacíos: ${emptyCount}`;
      
    console.log(finishMsg);
    await writeDebugLog(finishMsg);

    return { 
      success: true, 
      clips: generatedClips,
      summary: {
        remotion: remotionSuccessCount,
        hyperframes: hyperframesSuccessCount,
        originalFallback: originalFallbackCount,
        empty: emptyCount
      }
    };

  } catch (err: any) {
    const errMsg = `[generate-timeline-assets] Error: ${err.message || err}`;
    console.error(errMsg, err);
    await writeDebugLog(errMsg);
    return { success: false, error: err.message || 'Error interno al generar assets de la IA' };
  }
})

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



