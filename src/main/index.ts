import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { spawn, exec } from 'child_process'
import fs from 'fs'
import { getVideoDuration, generateVideoThumbnail, formatTimeMinutesSeconds } from './services/ffmpeg'

// Helper to manually load .env file in main process from multiple potential paths
function loadEnv() {
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

function initClipFolders() {
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
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      console.log(`[initClipFolders] Carpeta creada: ${dirPath}`)
    }
  }
}

app.whenReady().then(() => {
  initClipFolders()
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
ipcMain.on('start-transcription', (event, filePath) => {
  const transcriptsDir = path.join(app.getPath('userData'), 'transcripts')
  if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true })
  }

  // The output JSON file will be named [basename].json
  const basename = path.basename(filePath, path.extname(filePath))
  const expectedJsonPath = path.join(transcriptsDir, basename + '.json')

  // Clean up any existing transcript file first
  if (fs.existsSync(expectedJsonPath)) {
    try {
      fs.unlinkSync(expectedJsonPath)
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

  whisperProcess.on('close', (code) => {
    if (code === 0) {
      try {
        if (fs.existsSync(expectedJsonPath)) {
          const rawData = fs.readFileSync(expectedJsonPath, 'utf8')
          const parsed = JSON.parse(rawData)

          // Send the full results (segments) back to the renderer
          event.reply('transcription-update', { 
            status: 'success', 
            result: parsed 
          })

          // Clean up the JSON file to keep system clean
          try {
            fs.unlinkSync(expectedJsonPath)
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

// IPC handle for saving project state to project-state.json
ipcMain.handle('save-project-state', async (_event, state) => {
  try {
    const filePath = path.join(process.cwd(), 'project-state.json')
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// IPC handle for loading project state from project-state.json
ipcMain.handle('load-project-state', async () => {
  try {
    const filePath = path.join(process.cwd(), 'project-state.json')
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(rawData)
      return { success: true, data: parsed }
    }
    return { success: false, error: 'No se encontró el archivo de estado del proyecto.' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// IPC listener for ready-to-close event from renderer
ipcMain.on('ready-to-close', () => {
  if (win && !win.isDestroyed()) {
    win.destroy()
  }
})

// IPC handle for showing save dialog and saving state as JSON file
ipcMain.handle('save-project-as', async (_event, state) => {
  try {
    if (!win) return { success: false, error: 'Ventana no disponible' }
    
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Guardar Proyecto Como',
      defaultPath: path.join(process.cwd(), 'project-state.json'),
      filters: [{ name: 'JSON Project', extensions: ['json'] }]
    })

    if (canceled || !filePath) {
      return { success: false, error: 'Guardado cancelado por el usuario' }
    }

    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// IPC handle for showing open dialog and loading state from JSON file
ipcMain.handle('open-project', async () => {
  try {
    if (!win) return { success: false, error: 'Ventana no disponible' }

    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Abrir Proyecto',
      defaultPath: process.cwd(),
      filters: [{ name: 'JSON Project', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: 'Carga cancelada por el usuario' }
    }

    const filePath = filePaths[0]
    const rawData = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(rawData)
    return { success: true, data: parsed }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})



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
    if (!fs.existsSync(promptPath)) {
      const possiblePaths = [
        path.join(app.getAppPath(), 'src/prompt-maestro.txt'),
        path.join(__dirname, '../../src/prompt-maestro.txt'),
        path.join(__dirname, '../prompt-maestro.txt'),
        path.join(process.cwd(), 'prompt-maestro.txt')
      ]
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          promptPath = p
          break
        }
      }
    }

    if (!fs.existsSync(promptPath)) {
      return { success: false, error: 'No se encontró el archivo prompt-maestro.txt en cipher-studio/src' }
    }

    const promptTemplate = fs.readFileSync(promptPath, 'utf8')
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
            content: 'Eres un guionista experto. Tu única tarea es reescribir la transcripción siguiendo el estilo solicitado. IMPORTANTE: Entrega ÚNICAMENTE el texto limpio del guion final resultante que será hablado frente a la cámara. Está estrictamente PROHIBIDO incluir introducciones, prefacios, saludos, notas del autor, resúmenes, explicaciones del estilo utilizado o comentarios explicativos adicionales. Empieza a responder directamente con el primer párrafo del guion.'
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
      const voicesDir = path.join(app.getPath('userData'), 'generated-voices')
      if (!fs.existsSync(voicesDir)) {
        fs.mkdirSync(voicesDir, { recursive: true })
      }

      // Save MP3 to local folder
      const filename = `voice-${Date.now()}.mp3`
      const filePath = path.join(voicesDir, filename)
      fs.writeFileSync(filePath, buffer)
      console.log(`[generate-voice] Archivo de voz guardado localmente en: ${filePath}`)

      // Generate base64 data URL for preview
      const base64Audio = buffer.toString('base64')
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`

      return { success: true, filePath, audioUrl }
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
    const bankDir = getBancoClipsPath()
    const dirPath = path.join(bankDir, category)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    const files = fs.readdirSync(dirPath)
    const bankClips: any[] = []

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = fs.statSync(filePath)
      
      // We only accept common video formats
      if (stat.isFile() && /\.(mp4|mkv|avi|mov|webm)$/i.test(file)) {
        const durationSeconds = await getVideoDuration(filePath)
        const durationStr = formatTimeMinutesSeconds(durationSeconds)

        // Find or generate thumbnail
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`
        const thumbnailPath = path.join(bankDir, 'thumbnails', thumbnailName)
        let thumbnailUrl = ''

        if (fs.existsSync(thumbnailPath)) {
          try {
            thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString('base64')}`
          } catch (e) {
            console.error(`[load-bank-clips] Error al leer miniatura para ${file}:`, e)
          }
        } else {
          try {
            await generateVideoThumbnail(filePath, thumbnailPath)
            if (fs.existsSync(thumbnailPath)) {
              thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString('base64')}`
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

// IPC handle to automatically slice a video into segments based on Whisper timestamps
ipcMain.handle('cut-video-clips', async (_event, { videoPath, segments, aspectRatio }) => {
  try {
    console.log(`[cut-video-clips] Iniciando segmentación de: ${videoPath} con formato ${aspectRatio}`)
    const bankDir = getBancoClipsPath()
    const outDir = path.join(bankDir, 'originales')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    const createdClips: any[] = []
    const escapedVideo = videoPath.replace(/"/g, '\\"')
    const baseName = path.basename(videoPath, path.extname(videoPath))

    // Determine crop filter based on aspectRatio
    let filterStr = ''
    if (aspectRatio === 'vertical') {
      filterStr = `-vf "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2'"`
    } else if (aspectRatio === 'square') {
      filterStr = `-vf "crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2'"`
    } else if (aspectRatio === 'horizontal') {
      filterStr = `-vf "crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2'"`
    }

    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx]
      const start = seg.start
      const end = seg.end
      
      let currentStart = start
      let part = 1
      
      while (currentStart < end) {
        const currentEnd = Math.min(currentStart + 3.0, end)
        const duration = currentEnd - currentStart
        
        if (duration <= 0.1) break
        
        const clipFileName = `${baseName}_clip_${idx + 1}_${part}.mp4`
        const clipPath = path.join(outDir, clipFileName)
        const escapedClipPath = clipPath.replace(/"/g, '\\"')
        
        console.log(`  - Cortando segmentación ${idx + 1}/${segments.length} parte ${part} (${currentStart.toFixed(1)}s -> ${currentEnd.toFixed(1)}s)`)
        
        await new Promise<void>((resolve, reject) => {
          const ffmpegCmd = `ffmpeg -y -ss ${currentStart} -to ${currentEnd} -i "${escapedVideo}" ${filterStr} -c:v libx264 -preset ultrafast -crf 23 -c:a aac "${escapedClipPath}"`
          exec(ffmpegCmd, (err) => {
            if (err) {
              console.warn(`[cut-video-clips] FFmpeg re-encoding falló para clip ${idx + 1}_${part}, reintentando con -c copy:`, err.message)
              exec(`ffmpeg -y -ss ${currentStart} -to ${currentEnd} -i "${escapedVideo}" -c copy "${escapedClipPath}"`, (err2) => {
                if (err2) reject(err2)
                else resolve()
              })
            } else {
              resolve()
            }
          })
        })

        // Extract thumbnail
        const thumbnailName = `${baseName}_clip_${idx + 1}_${part}.jpg`
        const thumbnailPath = path.join(bankDir, 'thumbnails', thumbnailName)
        let thumbnailUrl = ''
        try {
          await generateVideoThumbnail(clipPath, thumbnailPath)
          if (fs.existsSync(thumbnailPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString('base64')}`
          }
        } catch (e) {
          console.error(`[cut-video-clips] Error al generar miniatura para clip ${idx + 1}_${part}:`, e)
        }

        const stat = fs.statSync(clipPath)
        createdClips.push({
          id: `bank-originales-${clipFileName}`,
          name: clipFileName,
          path: clipPath,
          url: `file:///${clipPath.replace(/\\/g, '/')}`,
          duration: formatTimeMinutesSeconds(duration),
          durationSeconds: duration,
          type: 'video',
          size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          thumbnailUrl
        })

        currentStart = currentEnd
        part++
      }
    }

    console.log(`[cut-video-clips] Corte automático finalizado. Creados ${createdClips.length} clips.`)
    return { success: true, clips: createdClips }
  } catch (err: any) {
    console.error(`[cut-video-clips] Error: ${err.message}`)
    return { success: false, error: err.message }
  }
})

// IPC handle for deleting a clip inside a category folder of banco-clips
ipcMain.handle('delete-bank-clip', async (_event, { category, file }) => {
  try {
    const bankDir = getBancoClipsPath()
    const filePath = path.join(bankDir, category, file)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`
    const thumbnailPath = path.join(bankDir, 'thumbnails', thumbnailName)
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath)
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
      if (!videoPath || !fs.existsSync(videoPath)) {
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
        if (clip.path && fs.existsSync(clip.path)) {
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

      fs.writeFileSync(tempTxtPath, fileContent, 'utf8')
      const escapedTxt = tempTxtPath.replace(/"/g, '\\"')

      // Concat and crop
      const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" ${filterStr} -c:v libx264 -preset ultrafast -crf 23 -c:a aac "${escapedOut}"`
      
      await new Promise<void>((resolve, reject) => {
        exec(ffmpegCmd, (err) => {
          try { fs.unlinkSync(tempTxtPath) } catch (e) {}
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


