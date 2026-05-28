"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");
function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    const escapedPath = filePath.replace(/"/g, '\\"');
    child_process.exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${escapedPath}"`, (err, stdout) => {
      if (err) {
        console.error(`[ffmpeg] Error de ffprobe para ${filePath}:`, err);
        resolve(5);
        return;
      }
      const dur = parseFloat(stdout.trim());
      resolve(isNaN(dur) ? 5 : dur);
    });
  });
}
function generateVideoThumbnail(videoPath, thumbnailPath) {
  return new Promise((resolve, reject) => {
    const escapedVideo = videoPath.replace(/"/g, '\\"');
    const escapedThumb = thumbnailPath.replace(/"/g, '\\"');
    child_process.exec(`ffmpeg -y -ss 0.5 -i "${escapedVideo}" -vframes 1 -f image2 "${escapedThumb}"`, (err) => {
      if (err) {
        child_process.exec(`ffmpeg -y -ss 0.0 -i "${escapedVideo}" -vframes 1 -f image2 "${escapedThumb}"`, (err2) => {
          if (err2) {
            reject(err2);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}
function formatTimeMinutesSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}
function loadEnv() {
  const possiblePaths = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "cipher-studio", ".env"),
    path.join(electron.app.getAppPath(), ".env"),
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "../..", ".env")
  ];
  let loaded = false;
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      console.log(`[loadEnv] Cargando variables de entorno desde: ${envPath}`);
      try {
        const lines = fs.readFileSync(envPath, "utf8").split("\n");
        for (const line of lines) {
          const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1].trim();
            let val = match[2] ? match[2].trim() : "";
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            } else if (val.startsWith("'") && val.endsWith("'")) {
              val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
          }
        }
        loaded = true;
        break;
      } catch (err) {
        console.error(`[loadEnv] Error al leer el archivo ${envPath}: ${err.message}`);
      }
    }
  }
  if (!loaded) {
    console.warn(`[loadEnv] Advertencia: No se pudo encontrar ningún archivo .env en las rutas buscadas.`);
  }
}
loadEnv();
process.env.DIST = path.join(__dirname, "../..");
process.env.PUBLIC = electron.app.isPackaged ? path.join(process.env.DIST, "dist") : path.join(process.env.DIST, "public");
let win = null;
const preload = path.join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = path.join(process.env.DIST, "dist/index.html");
function createWindow() {
  win = new electron.BrowserWindow({
    title: "CIPHER Studio",
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true
    },
    width: 1280,
    height: 800,
    backgroundColor: "#0f172a"
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  let isClosing = false;
  win.on("close", (e) => {
    if (!isClosing) {
      e.preventDefault();
      win == null ? void 0 : win.webContents.send("save-before-close");
      isClosing = true;
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.destroy();
        }
      }, 4e3);
    }
  });
  if (url) {
    win.loadURL(url);
  } else {
    win.loadFile(indexHtml);
  }
}
function getBancoClipsPath() {
  const cwd = process.cwd();
  if (path.basename(cwd) === "cipher-studio") {
    return path.join(cwd, "banco-clips");
  } else {
    return path.join(cwd, "cipher-studio", "banco-clips");
  }
}
function getRemotionPath() {
  const cwd = process.cwd();
  if (path.basename(cwd) === "cipher-studio") {
    return cwd;
  } else {
    return path.join(cwd, "cipher-studio");
  }
}
function initClipFolders() {
  const bankDir = getBancoClipsPath();
  const folders = [
    "",
    "originales",
    "stock",
    "remotion",
    "hyperframes",
    "veo3",
    "thumbnails"
  ];
  for (const f of folders) {
    const dirPath = path.join(bankDir, f);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[initClipFolders] Carpeta creada: ${dirPath}`);
    }
  }
}
electron.app.whenReady().then(() => {
  initClipFolders();
  createWindow();
});
electron.app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
electron.app.on("activate", () => {
  const allWindows = electron.BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
electron.ipcMain.on("start-transcription", (event, filePath) => {
  const transcriptsDir = path.join(electron.app.getPath("userData"), "transcripts");
  if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
  }
  const basename = path.basename(filePath, path.extname(filePath));
  const expectedJsonPath = path.join(transcriptsDir, basename + ".json");
  if (fs.existsSync(expectedJsonPath)) {
    try {
      fs.unlinkSync(expectedJsonPath);
    } catch (e) {
    }
  }
  event.reply("transcription-update", {
    status: "starting",
    message: "Conectando con Whisper local y cargando modelo..."
  });
  const whisperProcess = child_process.spawn("whisper", [
    `"${filePath}"`,
    "--language",
    "Spanish",
    "--output_format",
    "json",
    "--output_dir",
    `"${transcriptsDir}"`
  ], { shell: true });
  let progressBuffer = "";
  whisperProcess.stdout.on("data", (data) => {
    const chunk = data.toString();
    progressBuffer += chunk;
    const lines = progressBuffer.split("\n");
    progressBuffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        event.reply("transcription-update", {
          status: "progress",
          message: trimmed
        });
      }
    }
  });
  whisperProcess.stderr.on("data", (data) => {
    const chunk = data.toString().trim();
    if (chunk) {
      event.reply("transcription-update", {
        status: "progress",
        message: chunk
      });
    }
  });
  whisperProcess.on("close", (code) => {
    if (code === 0) {
      try {
        if (fs.existsSync(expectedJsonPath)) {
          const rawData = fs.readFileSync(expectedJsonPath, "utf8");
          const parsed = JSON.parse(rawData);
          event.reply("transcription-update", {
            status: "success",
            result: parsed
          });
          try {
            fs.unlinkSync(expectedJsonPath);
          } catch (e) {
          }
        } else {
          event.reply("transcription-update", {
            status: "error",
            error: "No se generó el archivo de transcripción JSON esperado."
          });
        }
      } catch (err) {
        event.reply("transcription-update", {
          status: "error",
          error: `Error al procesar el archivo de salida de Whisper: ${err.message}`
        });
      }
    } else {
      event.reply("transcription-update", {
        status: "error",
        error: `Whisper falló con código de salida ${code}`
      });
    }
  });
});
electron.ipcMain.handle("save-project-state", async (_event, state) => {
  try {
    const filePath = path.join(process.cwd(), "project-state.json");
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("load-project-state", async () => {
  try {
    const filePath = path.join(process.cwd(), "project-state.json");
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(rawData);
      return { success: true, data: parsed };
    }
    return { success: false, error: "No se encontró el archivo de estado del proyecto." };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.on("ready-to-close", () => {
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
});
electron.ipcMain.handle("save-project-as", async (_event, state) => {
  try {
    if (!win) return { success: false, error: "Ventana no disponible" };
    const { filePath, canceled } = await electron.dialog.showSaveDialog(win, {
      title: "Guardar Proyecto Como",
      defaultPath: path.join(process.cwd(), "project-state.json"),
      filters: [{ name: "JSON Project", extensions: ["json"] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: "Guardado cancelado por el usuario" };
    }
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("open-project", async () => {
  try {
    if (!win) return { success: false, error: "Ventana no disponible" };
    const { filePaths, canceled } = await electron.dialog.showOpenDialog(win, {
      title: "Abrir Proyecto",
      defaultPath: process.cwd(),
      filters: [{ name: "JSON Project", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: "Carga cancelada por el usuario" };
    }
    const filePath = filePaths[0];
    const rawData = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(rawData);
    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
function cleanMarkdown(text) {
  if (!text) return "";
  const lines = text.split("\n");
  const cleanedLines = [];
  const sectionKeywords = [
    "gancho",
    "enigma",
    "desarrollo",
    "aterrizaje",
    "cierre",
    "título",
    "titulo",
    "guión",
    "guion",
    "script",
    "sección",
    "seccion",
    "introducción",
    "introduccion",
    "conclusión",
    "conclusion",
    "escena",
    "paso",
    "bloque",
    "parte",
    "fase"
  ];
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;
    const lowerTrimmed = trimmed.toLowerCase();
    if (lowerTrimmed.startsWith("aquí tienes") || lowerTrimmed.startsWith("aqui tienes") || lowerTrimmed.startsWith("este guion") || lowerTrimmed.startsWith("este guió") || lowerTrimmed.startsWith("he reescrito") || lowerTrimmed.startsWith("explicación del estilo") || lowerTrimmed.startsWith("explicacion del estilo") || lowerTrimmed.startsWith("estilo utilizado") || lowerTrimmed.startsWith("espero que") || lowerTrimmed.startsWith("nota:") || lowerTrimmed.startsWith("importante:")) {
      continue;
    }
    if (trimmed.startsWith("#")) {
      const headingText = trimmed.replace(/^#+\s*/, "").trim();
      const lowerHeading = headingText.toLowerCase();
      const isStructural = sectionKeywords.some((keyword) => lowerHeading.includes(keyword)) || headingText.length < 25;
      if (isStructural) {
        continue;
      }
      trimmed = headingText;
    }
    trimmed = trimmed.replace(/^[-*+]\s+/, "");
    trimmed = trimmed.replace(/^\d+\.\s+/, "");
    trimmed = trimmed.replace(/^\*+([^*:]+)\*+:\s*/, "");
    trimmed = trimmed.replace(/\*\*|__|\*|_/g, "");
    trimmed = trimmed.replace(/\[[^\]]+\]/g, "");
    trimmed = trimmed.replace(/\([^)]+\)/g, "");
    trimmed = trimmed.replace(/\s+/g, " ").trim();
    if (trimmed.length > 0) {
      cleanedLines.push(trimmed);
    }
  }
  return cleanedLines.join("\n\n");
}
electron.ipcMain.handle("rewrite-transcript", async (_event, text) => {
  var _a, _b, _c;
  try {
    let promptPath = path.join(process.cwd(), "src/prompt-maestro.txt");
    if (!fs.existsSync(promptPath)) {
      const possiblePaths = [
        path.join(electron.app.getAppPath(), "src/prompt-maestro.txt"),
        path.join(__dirname, "../../src/prompt-maestro.txt"),
        path.join(__dirname, "../prompt-maestro.txt"),
        path.join(process.cwd(), "prompt-maestro.txt")
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          promptPath = p;
          break;
        }
      }
    }
    if (!fs.existsSync(promptPath)) {
      return { success: false, error: "No se encontró el archivo prompt-maestro.txt en cipher-studio/src" };
    }
    const promptTemplate = fs.readFileSync(promptPath, "utf8");
    const finalPrompt = promptTemplate.replace("[TRANSCRIPCIÓN]", text);
    loadEnv();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { success: false, error: "No se configuró DEEPSEEK_API_KEY en el archivo .env" };
    }
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "Eres un guionista experto. Tu única tarea es reescribir la transcripción siguiendo el estilo solicitado. IMPORTANTE: Entrega ÚNICAMENTE el texto limpio del guion final resultante que será hablado frente a la cámara. Está estrictamente PROHIBIDO incluir introducciones, prefacios, saludos, notas del autor, resúmenes, explicaciones del estilo utilizado o comentarios explicativos adicionales. Empieza a responder directamente con el primer párrafo del guion."
          },
          { role: "user", content: finalPrompt }
        ],
        temperature: 0.7,
        stream: false
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Error de API DeepSeek (${response.status}): ${errText}` };
    }
    const data = await response.json();
    const content = (_c = (_b = (_a = data == null ? void 0 : data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
    if (!content) {
      return { success: false, error: "La respuesta de DeepSeek no contiene contenido válido." };
    }
    const cleanContent = cleanMarkdown(content);
    return { success: true, data: cleanContent };
  } catch (err) {
    return { success: false, error: err.message || "Error desconocido al reescribir con DeepSeek" };
  }
});
electron.ipcMain.handle("get-elevenlabs-voices", async () => {
  try {
    loadEnv();
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { success: false, error: "ELEVENLABS_API_KEY no está configurado en el archivo .env." };
    }
    console.log("[get-elevenlabs-voices] Solicitando voces a ElevenLabs...");
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        "accept": "application/json"
      }
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Error de ElevenLabs API (${response.status}): ${errText}` };
    }
    const data = await response.json();
    let voices = data.voices || [];
    const myVoiceId = "c9cmyX6CFsCvEKNVoCZ1";
    const myVoiceIndex = voices.findIndex((v) => v.voice_id === myVoiceId);
    if (myVoiceIndex !== -1) {
      const myVoice = voices[myVoiceIndex];
      myVoice.is_my_voice = true;
      myVoice.name = `${myVoice.name} (Mi voz)`;
      voices.splice(myVoiceIndex, 1);
      voices.unshift(myVoice);
    } else {
      voices.unshift({
        voice_id: myVoiceId,
        name: "Clon de mi Voz (Mi voz)",
        preview_url: "",
        category: "cloned",
        is_my_voice: true
      });
    }
    return { success: true, voices };
  } catch (err) {
    console.error("[get-elevenlabs-voices] Error:", err);
    return { success: false, error: err.message || "Error al conectar con la API de ElevenLabs." };
  }
});
electron.ipcMain.handle("generate-voice", async (_event, { text, model, voiceId, stability }) => {
  try {
    loadEnv();
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      const errMessage = "Error: ELEVENLABS_API_KEY no está configurado en el archivo .env o no pudo ser leído.";
      console.error(`[generate-voice] ${errMessage}`);
      return { success: false, error: errMessage };
    }
    const targetVoiceId = voiceId || "c9cmyX6CFsCvEKNVoCZ1";
    let modelId = "eleven_multilingual_v2";
    if (model === "Eleven English v1") {
      modelId = "eleven_monolingual_v1";
    } else if (model === "Eleven Turbo v2") {
      modelId = "eleven_turbo_v2";
    }
    const cleanStability = typeof stability === "number" ? stability / 100 : 0.5;
    console.log(`[generate-voice] Iniciando proceso de generación de voz:`);
    console.log(`  - Texto a procesar: "${text.substring(0, 60)}${text.length > 60 ? "..." : ""}" (longitud: ${text.length} caracteres)`);
    console.log(`  - Modelo seleccionado: "${model}" => API Model ID: "${modelId}"`);
    console.log(`  - Voice ID seleccionado: "${targetVoiceId}"`);
    console.log(`  - Estabilidad: ${stability}% (procesada: ${cleanStability})`);
    const maskedKey = apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 6);
    console.log(`  - API Key de ElevenLabs: ${maskedKey} (longitud: ${apiKey.length} caracteres)`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[generate-voice] Solicitud abortada: Superó el tiempo de espera de 40 segundos.`);
      controller.abort();
    }, 4e4);
    try {
      console.log(`[generate-voice] Enviando solicitud POST a https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}...`);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: cleanStability,
            similarity_boost: 0.75
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log(`[generate-voice] Respuesta recibida de ElevenLabs. Status: ${response.status} (${response.statusText})`);
      if (!response.ok) {
        const errText = await response.text();
        const errMessage = `Error de API ElevenLabs (${response.status}): ${errText}`;
        console.error(`[generate-voice] La API retornó un error: ${errMessage}`);
        return { success: false, error: errMessage };
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`[generate-voice] Buffer de audio recibido. Tamaño: ${buffer.byteLength} bytes`);
      const voicesDir = path.join(electron.app.getPath("userData"), "generated-voices");
      if (!fs.existsSync(voicesDir)) {
        fs.mkdirSync(voicesDir, { recursive: true });
      }
      const filename = `voice-${Date.now()}.mp3`;
      const filePath = path.join(voicesDir, filename);
      fs.writeFileSync(filePath, buffer);
      console.log(`[generate-voice] Archivo de voz guardado localmente en: ${filePath}`);
      const base64Audio = buffer.toString("base64");
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      return { success: true, filePath, audioUrl };
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      let fetchErrMsg = fetchErr.message || "Error de conexión";
      if (fetchErr.name === "AbortError") {
        fetchErrMsg = "La conexión con ElevenLabs excedió el tiempo límite de espera de 40 segundos.";
      }
      console.error(`[generate-voice] Excepción durante el fetch: ${fetchErrMsg}`, fetchErr);
      return { success: false, error: `Error de red/conexión: ${fetchErrMsg}` };
    }
  } catch (err) {
    const errMessage = err.message || "Error desconocido en ElevenLabs TTS";
    console.error(`[generate-voice] Excepción general: ${errMessage}`, err);
    return { success: false, error: errMessage };
  }
});
electron.ipcMain.handle("load-bank-clips", async (_event, { category }) => {
  try {
    const bankDir = getBancoClipsPath();
    const dirPath = path.join(bankDir, category);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const files = fs.readdirSync(dirPath);
    const bankClips = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && /\.(mp4|mkv|avi|mov|webm)$/i.test(file)) {
        const durationSeconds = await getVideoDuration(filePath);
        const durationStr = formatTimeMinutesSeconds(durationSeconds);
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
        const thumbnailPath = path.join(bankDir, "thumbnails", thumbnailName);
        let thumbnailUrl = "";
        if (fs.existsSync(thumbnailPath)) {
          try {
            thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString("base64")}`;
          } catch (e) {
            console.error(`[load-bank-clips] Error al leer miniatura para ${file}:`, e);
          }
        } else {
          try {
            await generateVideoThumbnail(filePath, thumbnailPath);
            if (fs.existsSync(thumbnailPath)) {
              thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString("base64")}`;
            }
          } catch (e) {
            console.error(`[load-bank-clips] Error al generar miniatura para ${file}:`, e);
          }
        }
        bankClips.push({
          id: `bank-${category}-${file}`,
          name: file,
          path: filePath,
          url: `file:///${filePath.replace(/\\/g, "/")}`,
          duration: durationStr,
          durationSeconds,
          type: "video",
          size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          thumbnailUrl
        });
      }
    }
    return { success: true, clips: bankClips };
  } catch (err) {
    console.error(`[load-bank-clips] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("cut-video-clips", async (_event, { videoPath, segments, aspectRatio }) => {
  try {
    console.log(`[cut-video-clips] Iniciando segmentación de: ${videoPath} con formato ${aspectRatio}`);
    const bankDir = getBancoClipsPath();
    const outDir = path.join(bankDir, "originales");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const createdClips = [];
    const escapedVideo = videoPath.replace(/"/g, '\\"');
    const baseName = path.basename(videoPath, path.extname(videoPath));
    let filterStr = "";
    if (aspectRatio === "vertical") {
      filterStr = `-vf "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2'"`;
    } else if (aspectRatio === "square") {
      filterStr = `-vf "crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2'"`;
    } else if (aspectRatio === "horizontal") {
      filterStr = `-vf "crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2'"`;
    }
    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      const start = seg.start;
      const end = seg.end;
      let currentStart = start;
      let part = 1;
      while (currentStart < end) {
        const currentEnd = Math.min(currentStart + 3, end);
        const duration = currentEnd - currentStart;
        if (duration <= 0.1) break;
        const clipFileName = `${baseName}_clip_${idx + 1}_${part}.mp4`;
        const clipPath = path.join(outDir, clipFileName);
        const escapedClipPath = clipPath.replace(/"/g, '\\"');
        console.log(`  - Cortando segmentación ${idx + 1}/${segments.length} parte ${part} (${currentStart.toFixed(1)}s -> ${currentEnd.toFixed(1)}s)`);
        await new Promise((resolve, reject) => {
          const ffmpegCmd = `ffmpeg -y -ss ${currentStart} -to ${currentEnd} -i "${escapedVideo}" ${filterStr} -c:v libx264 -preset ultrafast -crf 23 -c:a aac "${escapedClipPath}"`;
          child_process.exec(ffmpegCmd, (err) => {
            if (err) {
              console.warn(`[cut-video-clips] FFmpeg re-encoding falló para clip ${idx + 1}_${part}, reintentando con -c copy:`, err.message);
              child_process.exec(`ffmpeg -y -ss ${currentStart} -to ${currentEnd} -i "${escapedVideo}" -c copy "${escapedClipPath}"`, (err2) => {
                if (err2) reject(err2);
                else resolve();
              });
            } else {
              resolve();
            }
          });
        });
        const thumbnailName = `${baseName}_clip_${idx + 1}_${part}.jpg`;
        const thumbnailPath = path.join(bankDir, "thumbnails", thumbnailName);
        let thumbnailUrl = "";
        try {
          await generateVideoThumbnail(clipPath, thumbnailPath);
          if (fs.existsSync(thumbnailPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString("base64")}`;
          }
        } catch (e) {
          console.error(`[cut-video-clips] Error al generar miniatura para clip ${idx + 1}_${part}:`, e);
        }
        const stat = fs.statSync(clipPath);
        createdClips.push({
          id: `bank-originales-${clipFileName}`,
          name: clipFileName,
          path: clipPath,
          url: `file:///${clipPath.replace(/\\/g, "/")}`,
          duration: formatTimeMinutesSeconds(duration),
          durationSeconds: duration,
          type: "video",
          size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          thumbnailUrl
        });
        currentStart = currentEnd;
        part++;
      }
    }
    console.log(`[cut-video-clips] Corte automático finalizado. Creados ${createdClips.length} clips.`);
    return { success: true, clips: createdClips };
  } catch (err) {
    console.error(`[cut-video-clips] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("delete-bank-clip", async (_event, { category, file }) => {
  try {
    const bankDir = getBancoClipsPath();
    const filePath = path.join(bankDir, category, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
    const thumbnailPath = path.join(bankDir, "thumbnails", thumbnailName);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }
    return { success: true };
  } catch (err) {
    console.error(`[delete-bank-clip] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("export-video", async (_event, { clips, aspectRatio }) => {
  try {
    if (!win) return { success: false, error: "Ventana no disponible" };
    const { filePath, canceled } = await electron.dialog.showSaveDialog(win, {
      title: "Exportar Video",
      defaultPath: path.join(electron.app.getPath("downloads"), "export.mp4"),
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: "Exportación cancelada por el usuario" };
    }
    if (!clips || clips.length === 0) {
      return { success: false, error: "No hay clips en el Timeline para exportar." };
    }
    let filterStr = "";
    if (aspectRatio === "vertical") {
      filterStr = `-vf "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2'"`;
    } else if (aspectRatio === "square") {
      filterStr = `-vf "crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2'"`;
    } else if (aspectRatio === "horizontal") {
      filterStr = `-vf "crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2'"`;
    }
    const escapedOut = filePath.replace(/"/g, '\\"');
    if (clips.length === 1) {
      const videoPath = clips[0].path;
      if (!videoPath || !fs.existsSync(videoPath)) {
        return { success: false, error: `El archivo original no existe o no tiene ruta: ${clips[0].name}` };
      }
      const escapedVideo = videoPath.replace(/"/g, '\\"');
      const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" ${filterStr} -c:v libx264 -preset ultrafast -crf 23 -c:a aac "${escapedOut}"`;
      await new Promise((resolve, reject) => {
        child_process.exec(ffmpegCmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      const bankDir = getBancoClipsPath();
      const tempTxtPath = path.join(bankDir, `temp_concat_${Date.now()}.txt`);
      let fileContent = "";
      for (const clip of clips) {
        if (clip.path && fs.existsSync(clip.path)) {
          const escapedPath = clip.path.replace(/\\/g, "/").replace(/'/g, "'\\''");
          fileContent += `file '${escapedPath}'
`;
        } else {
          console.warn(`[export-video] Advertencia: clip sin ruta válida en disco: ${clip.name}`);
        }
      }
      if (!fileContent.trim()) {
        return { success: false, error: "Ninguno de los clips del Timeline tiene un archivo de origen válido en disco." };
      }
      fs.writeFileSync(tempTxtPath, fileContent, "utf8");
      const escapedTxt = tempTxtPath.replace(/"/g, '\\"');
      const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" ${filterStr} -c:v libx264 -preset ultrafast -crf 23 -c:a aac "${escapedOut}"`;
      await new Promise((resolve, reject) => {
        child_process.exec(ffmpegCmd, (err) => {
          try {
            fs.unlinkSync(tempTxtPath);
          } catch (e) {
          }
          if (err) reject(err);
          else resolve();
        });
      });
    }
    return { success: true, filePath };
  } catch (err) {
    console.error(`[export-video] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("generate-timeline-assets", async (event, { scriptText }) => {
  var _a, _b, _c;
  try {
    console.log(`[generate-timeline-assets] Iniciando análisis del guion para Remotion/Hyperframes...`);
    loadEnv();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { success: false, error: "No se configuró DEEPSEEK_API_KEY en el archivo .env" };
    }
    let creativeUnlockContent = "";
    const creativeUnlockPath = path.join(process.cwd(), "creative-unlock.md");
    const alternativeCreativePath = path.join(process.cwd(), "cipher-studio", "creative-unlock.md");
    if (fs.existsSync(creativeUnlockPath)) {
      creativeUnlockContent = fs.readFileSync(creativeUnlockPath, "utf8");
    } else if (fs.existsSync(alternativeCreativePath)) {
      creativeUnlockContent = fs.readFileSync(alternativeCreativePath, "utf8");
    }
    const paragraphs = scriptText.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 5);
    if (paragraphs.length === 0) {
      return { success: false, error: "No se encontraron párrafos válidos en el guion." };
    }
    console.log(`[generate-timeline-assets] Párrafos detectados: ${paragraphs.length}`);
    const prompt = `
    Analiza la siguiente lista de párrafos de un guion de video.
    Para cada párrafo, debes decidir si requiere:
    - "remotion": Gráficos animados de datos, estadísticas, métricas, código, KPI, barras, líneas.
    - "hyperframes": B-roll narrativo, tipografía cinética sobre fondo oscuro, escena visual conceptual.

    Además, para cada párrafo:
    - Si es "remotion", genera las siguientes propiedades JSON en "remotionProps":
      - chartType: "bar" | "line" | "kpi"
      - title: Título descriptivo para el gráfico (relacionado con el párrafo)
      - data: (Solo si es "bar" o "line") Un array de 3 a 5 objetos { "label": "...", "value": 0-100 }
      - metricValue: (Solo si es "kpi") Un texto corto representativo como "+85%" o "1.2M"
      - metricLabel: (Solo si es "kpi") Una etiqueta explicativa como "Crecimiento" o "Usuarios Activos"
    - Si es "hyperframes", genera el fragmento HTML completo en "hyperframesHtml" para el interior del contenedor "#root". Debe cumplir con estas directivas:
      - El contenedor principal dentro de "#root" debe tener 100% de ancho/alto y usar fondo #020712.
      - Incluye estilos inline o etiquetas <style> internas para animar los elementos usando CSS keyframes. Las animaciones deben ser fluidas y elegantes.
      - Las tipografías y colores deben seguir estrictamente el archivo creative-unlock.md:
        ${creativeUnlockContent ? `Estilo de creative-unlock.md:
${creativeUnlockContent}` : `Fondo general: #020712, Primario (Indigo): #6366f1, Secundario (Púrpura): #c084fc, Verde datos: #34d399, Títulos: Sans-serif Bold, Métricas/Datos: Monospace`}
      - Distribuye el texto del párrafo en un contenedor centralizado, opcionalmente agregando palabras clave resaltadas en color #6366f1 o #c084fc.
      - Agrega animaciones CSS como fade-up elástico con retraso (animation-delay) para cada palabra o línea de texto.
      - Puedes usar círculos con brillos suaves (radial-gradients) de fondo para darle un aspecto cinematográfico y premium de "studio".

    IMPORTANTE: Entrega ÚNICAMENTE el array JSON resultante que empiece por "[" y termine por "]". No incluyas explicaciones ni bloques markdown de código adicionales.

    Lista de párrafos a analizar:
    ${JSON.stringify(paragraphs, null, 2)}
    `;
    console.log(`[generate-timeline-assets] Enviando solicitud a DeepSeek...`);
    const dsResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "Eres un programador experto y director creativo. Responde ÚNICAMENTE con el objeto JSON solicitado, sin prefacios ni comentarios."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        stream: false
      })
    });
    if (!dsResponse.ok) {
      const errText = await dsResponse.text();
      return { success: false, error: `Error de API DeepSeek (${dsResponse.status}): ${errText}` };
    }
    const dsData = await dsResponse.json();
    const content = (_c = (_b = (_a = dsData == null ? void 0 : dsData.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
    if (!content) {
      return { success: false, error: "La respuesta de DeepSeek está vacía." };
    }
    let cleanContent = content.trim();
    if (cleanContent.includes("[")) {
      cleanContent = cleanContent.substring(cleanContent.indexOf("["), cleanContent.lastIndexOf("]") + 1);
    }
    let analysisResults;
    try {
      analysisResults = JSON.parse(cleanContent);
    } catch (parseErr) {
      console.error(`[generate-timeline-assets] Error al parsear JSON de DeepSeek:`, cleanContent);
      return { success: false, error: `Error al parsear el JSON de la IA: ${parseErr.message}` };
    }
    const bankDir = getBancoClipsPath();
    const tempDir = path.join(bankDir, "temp_renders");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const compositionsDir = path.join(process.cwd(), "hyperframes-project", "compositions");
    const alternativeCompositionsDir = path.join(process.cwd(), "cipher-studio", "hyperframes-project", "compositions");
    const targetCompositionsDir = fs.existsSync(path.join(process.cwd(), "hyperframes-project")) ? compositionsDir : alternativeCompositionsDir;
    if (!fs.existsSync(targetCompositionsDir)) {
      fs.mkdirSync(targetCompositionsDir, { recursive: true });
    }
    const generatedClips = [];
    const timestamp = Date.now();
    for (let idx = 0; idx < analysisResults.length; idx++) {
      const item = analysisResults[idx];
      const paragraph = item.paragraph || paragraphs[idx] || "";
      const type = item.type || "hyperframes";
      const wordCount = paragraph.split(/\s+/).filter(Boolean).length;
      const durationSeconds = Math.max(4, Math.min(10, Math.ceil(wordCount / 2.5)));
      const durationInFrames = durationSeconds * 30;
      event.sender.send("generation-progress", {
        index: idx,
        total: analysisResults.length,
        paragraph: paragraph.substring(0, 40) + "...",
        type
      });
      console.log(`[generate-timeline-assets] Procesando clip ${idx + 1}/${analysisResults.length} (${type}) - Duración: ${durationSeconds}s`);
      const clipFileName = `ai_clip_${timestamp}_${idx + 1}.mp4`;
      if (type === "remotion") {
        const outPath = path.join(bankDir, "remotion", clipFileName);
        const tempPropsPath = path.join(tempDir, `remotion_props_${timestamp}_${idx + 1}.json`);
        const remotionProps = item.remotionProps || {};
        const propsJson = {
          text: paragraph,
          title: remotionProps.title || "Gráfico CIPHER",
          chartType: remotionProps.chartType || "bar",
          data: remotionProps.data || [],
          metricValue: remotionProps.metricValue || "",
          metricLabel: remotionProps.metricLabel || ""
        };
        fs.writeFileSync(tempPropsPath, JSON.stringify(propsJson, null, 2), "utf8");
        const remotionProjectRoot = getRemotionPath();
        const entryFile = path.join(remotionProjectRoot, "remotion", "src", "index.ts");
        await new Promise((resolve, reject) => {
          const cmd = `npx remotion render "${entryFile}" MainClip "${outPath}" --props="${tempPropsPath}" --frames=0-${durationInFrames - 1}`;
          console.log(`  - Ejecutando Remotion: ${cmd}`);
          child_process.exec(cmd, { cwd: remotionProjectRoot }, (err, _stdout, stderr) => {
            try {
              fs.unlinkSync(tempPropsPath);
            } catch (e) {
            }
            if (err) {
              console.error(`  - Remotion falló:`, stderr);
              reject(err);
            } else {
              console.log(`  - Remotion renderizado con éxito.`);
              resolve();
            }
          });
        });
        const thumbnailName = `ai_clip_${timestamp}_${idx + 1}.jpg`;
        const thumbnailPath = path.join(bankDir, "thumbnails", thumbnailName);
        let thumbnailUrl = "";
        try {
          await generateVideoThumbnail(outPath, thumbnailPath);
          if (fs.existsSync(thumbnailPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString("base64")}`;
          }
        } catch (e) {
          console.error(`  - Falló generación de miniatura Remotion:`, e);
        }
        const stat = fs.statSync(outPath);
        generatedClips.push({
          id: `bank-remotion-${clipFileName}`,
          name: clipFileName,
          path: outPath,
          url: `file:///${outPath.replace(/\\/g, "/")}`,
          duration: formatTimeMinutesSeconds(durationSeconds),
          durationSeconds,
          type: "video",
          category: "remotion",
          size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          thumbnailUrl
        });
      } else {
        const outPath = path.join(bankDir, "hyperframes", clipFileName);
        const compositionHtmlPath = path.join(targetCompositionsDir, `clip_${timestamp}_${idx + 1}.html`);
        const relativeCompositionPath = `compositions/clip_${timestamp}_${idx + 1}.html`;
        const hyperframesHtml = item.hyperframesHtml || `<div style="width:100%;height:100%;background:#020712;display:flex;justify-content:center;align-items:center;color:#ffffff;font-size:48px;font-family:sans-serif;padding:60px;text-align:center;">${paragraph}</div>`;
        const htmlTemplate = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"><\/script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #020712;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${durationSeconds}" data-width="1920" data-height="1080">
      ${hyperframesHtml}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    <\/script>
  </body>
</html>`;
        fs.writeFileSync(compositionHtmlPath, htmlTemplate, "utf8");
        const hyperframesProjectRoot = fs.existsSync(path.join(process.cwd(), "hyperframes-project")) ? path.join(process.cwd(), "hyperframes-project") : path.join(process.cwd(), "cipher-studio", "hyperframes-project");
        await new Promise((resolve, reject) => {
          const cmd = `npx hyperframes render "${hyperframesProjectRoot}" -c "${relativeCompositionPath}" -o "${outPath}"`;
          console.log(`  - Ejecutando Hyperframes: ${cmd}`);
          child_process.exec(cmd, { cwd: hyperframesProjectRoot }, (err, _stdout, stderr) => {
            try {
              fs.unlinkSync(compositionHtmlPath);
            } catch (e) {
            }
            if (err) {
              console.error(`  - Hyperframes falló:`, stderr);
              reject(err);
            } else {
              console.log(`  - Hyperframes renderizado con éxito.`);
              resolve();
            }
          });
        });
        const thumbnailName = `ai_clip_${timestamp}_${idx + 1}.jpg`;
        const thumbnailPath = path.join(bankDir, "thumbnails", thumbnailName);
        let thumbnailUrl = "";
        try {
          await generateVideoThumbnail(outPath, thumbnailPath);
          if (fs.existsSync(thumbnailPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString("base64")}`;
          }
        } catch (e) {
          console.error(`  - Falló generación de miniatura Hyperframes:`, e);
        }
        const stat = fs.statSync(outPath);
        generatedClips.push({
          id: `bank-hyperframes-${clipFileName}`,
          name: clipFileName,
          path: outPath,
          url: `file:///${outPath.replace(/\\/g, "/")}`,
          duration: formatTimeMinutesSeconds(durationSeconds),
          durationSeconds,
          type: "video",
          category: "hyperframes",
          size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          thumbnailUrl
        });
      }
    }
    try {
      fs.rmdirSync(tempDir);
    } catch (e) {
    }
    console.log(`[generate-timeline-assets] Generación finalizada. Creados ${generatedClips.length} clips.`);
    return { success: true, clips: generatedClips };
  } catch (err) {
    console.error(`[generate-timeline-assets] Error:`, err);
    return { success: false, error: err.message || "Error interno al generar assets de la IA" };
  }
});
//# sourceMappingURL=index.js.map
