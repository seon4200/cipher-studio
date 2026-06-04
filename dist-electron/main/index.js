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
let envLoaded = false;
function loadEnv() {
  if (envLoaded) return;
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
  envLoaded = true;
}
async function exists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
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
      contextIsolation: true,
      webSecurity: false
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
      if (activeProjectPath) {
        cleanupProjectTemp(activeProjectPath);
      }
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
async function writeDebugLog(message) {
  try {
    const cwd = process.cwd();
    let targetPath = "";
    if (path.basename(cwd) === "cipher-studio") {
      targetPath = path.join(cwd, "generation-debug.log");
    } else {
      targetPath = path.join(cwd, "cipher-studio", "generation-debug.log");
    }
    const dir = path.dirname(targetPath);
    if (!await exists(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    const time = (/* @__PURE__ */ new Date()).toISOString();
    await fs.promises.appendFile(targetPath, `[${time}] ${message}
`, "utf8");
  } catch (e) {
    console.error("Error writing to debug log:", e);
  }
}
async function initClipFolders() {
  const bankDir = getBancoClipsPath();
  const folders = [
    "",
    "originales",
    "stock",
    "veo3",
    "thumbnails"
  ];
  for (const f of folders) {
    const dirPath = path.join(bankDir, f);
    if (!await exists(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`[initClipFolders] Carpeta creada: ${dirPath}`);
    }
  }
}
electron.app.whenReady().then(async () => {
  await initClipFolders();
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
electron.ipcMain.on("start-transcription", async (event, filePath) => {
  const transcriptsDir = path.join(electron.app.getPath("userData"), "transcripts");
  if (!await exists(transcriptsDir)) {
    await fs.promises.mkdir(transcriptsDir, { recursive: true });
  }
  const basename = path.basename(filePath, path.extname(filePath));
  const expectedJsonPath = path.join(transcriptsDir, basename + ".json");
  if (await exists(expectedJsonPath)) {
    try {
      await fs.promises.unlink(expectedJsonPath);
    } catch (e) {
    }
  }
  if (!await exists(filePath)) {
    event.reply("transcription-update", {
      status: "error",
      error: `El archivo de audio no existe en la ruta: ${filePath}`
    });
    return;
  }
  event.reply("transcription-update", {
    status: "starting",
    message: "Conectando con Whisper local y cargando modelo..."
  });
  const whisperProcess = child_process.spawn("whisper", [
    `"${filePath}"`,
    "--language",
    "Spanish",
    "--model",
    "tiny",
    "--output_format",
    "json",
    "--output_dir",
    `"${transcriptsDir}"`
  ], { shell: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
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
  whisperProcess.on("close", async (code) => {
    if (code === 0) {
      try {
        if (await exists(expectedJsonPath)) {
          const rawData = await fs.promises.readFile(expectedJsonPath, "utf8");
          const parsed = JSON.parse(rawData);
          event.reply("transcription-update", {
            status: "success",
            result: parsed
          });
          try {
            await fs.promises.unlink(expectedJsonPath);
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
let activeProjectPath = null;
function slugify(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
}
async function getProjectsDir() {
  const cwd = process.cwd();
  let baseDir = cwd;
  if (path.basename(cwd) !== "cipher-studio") {
    baseDir = path.join(cwd, "cipher-studio");
  }
  const dir = path.join(baseDir, "proyectos");
  if (!await exists(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  return dir;
}
async function cleanupProjectTemp(projectPath) {
  const tempPath = path.join(projectPath, "temp");
  if (await exists(tempPath)) {
    try {
      await fs.promises.rm(tempPath, { recursive: true, force: true });
      console.log(`[cleanupProjectTemp] Temporales eliminados en: ${tempPath}`);
    } catch (e) {
      console.error(`[cleanupProjectTemp] Error al eliminar temporales:`, e);
    }
  }
}
async function initProjectDirs(projectPath) {
  const folders = [
    "voices",
    "temp",
    "temp/originales",
    "temp/remotion",
    "temp/hyperframes",
    "temp/minimax",
    "temp/thumbnails"
  ];
  for (const f of folders) {
    const dir = path.join(projectPath, f);
    if (!await exists(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }
}
async function sanitizeProjectState(parsed) {
  return parsed;
}
electron.ipcMain.handle("list-projects", async () => {
  try {
    const projectsDir = await getProjectsDir();
    const items = await fs.promises.readdir(projectsDir);
    const projectsList = [];
    for (const item of items) {
      const projectPath = path.join(projectsDir, item);
      const stat = await fs.promises.stat(projectPath);
      if (stat.isDirectory()) {
        const stateFile = path.join(projectPath, "project-state.json");
        if (await exists(stateFile)) {
          try {
            const raw = await fs.promises.readFile(stateFile, "utf8");
            const data = JSON.parse(raw);
            projectsList.push({
              id: data.id || item,
              name: data.name || item,
              durationSeconds: data.durationSeconds || 0,
              date: data.date || stat.mtimeMs,
              projectPath,
              thumbnailUrl: data.thumbnailUrl || ""
            });
          } catch (e) {
            console.error(`Error al leer project-state.json en ${item}:`, e);
          }
        }
      }
    }
    projectsList.sort((a, b) => b.date - a.date);
    return { success: true, projects: projectsList };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("create-project", async (_event, { name }) => {
  try {
    const projectsDir = await getProjectsDir();
    const id = `${slugify(name || "Nuevo Proyecto")}-${Date.now()}`;
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
      transcriptionStatus: "",
      transcriptSegments: [],
      aiScript: "",
      originalTranscriptText: "",
      voiceModel: "Eleven English v1",
      voiceSpeaker: "Rachel",
      voiceSpeed: 1,
      voiceStability: 50,
      generatedVoices: [],
      timelineWeights: [40, 30, 20, 10]
    };
    const stateFile = path.join(projectPath, "project-state.json");
    await fs.promises.writeFile(stateFile, JSON.stringify(initialState, null, 2), "utf8");
    activeProjectPath = projectPath;
    console.log(`[create-project] Proyecto creado en: ${projectPath}`);
    return { success: true, data: initialState, projectPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("load-project", async (_event, { projectPath }) => {
  try {
    if (activeProjectPath && activeProjectPath !== projectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    const stateFile = path.join(projectPath, "project-state.json");
    if (!await exists(stateFile)) {
      return { success: false, error: "No se encontró el estado del proyecto en la carpeta seleccionada." };
    }
    await initProjectDirs(projectPath);
    await cleanupProjectTemp(projectPath);
    await initProjectDirs(projectPath);
    const raw = await fs.promises.readFile(stateFile, "utf8");
    const parsed = await sanitizeProjectState(JSON.parse(raw));
    activeProjectPath = projectPath;
    console.log(`[load-project] Proyecto cargado desde: ${projectPath}`);
    return { success: true, data: parsed, projectPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("close-project", async () => {
  try {
    if (activeProjectPath) {
      await cleanupProjectTemp(activeProjectPath);
      console.log(`[close-project] Proyecto cerrado y temporales limpiados: ${activeProjectPath}`);
      activeProjectPath = null;
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("delete-project", async (_event, { projectPath }) => {
  try {
    if (activeProjectPath === projectPath) {
      activeProjectPath = null;
    }
    if (await exists(projectPath)) {
      await fs.promises.rm(projectPath, { recursive: true, force: true });
      console.log(`[delete-project] Carpeta de proyecto eliminada: ${projectPath}`);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("save-project-state", async (_event, state) => {
  try {
    const targetPath = activeProjectPath || process.cwd();
    const filePath = path.join(targetPath, "project-state.json");
    const sanitized = await sanitizeProjectState(state);
    sanitized.date = Date.now();
    await fs.promises.writeFile(filePath, JSON.stringify(sanitized, null, 2), "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("load-project-state", async () => {
  try {
    if (activeProjectPath) {
      const stateFile = path.join(activeProjectPath, "project-state.json");
      if (await exists(stateFile)) {
        const raw = await fs.promises.readFile(stateFile, "utf8");
        const parsed = await sanitizeProjectState(JSON.parse(raw));
        return { success: true, data: parsed };
      }
    }
    const filePath = path.join(process.cwd(), "project-state.json");
    if (await exists(filePath)) {
      const rawData = await fs.promises.readFile(filePath, "utf8");
      const parsed = await sanitizeProjectState(JSON.parse(rawData));
      return { success: true, data: parsed };
    }
    return { success: false, error: "No se encontró proyecto activo." };
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
      defaultPath: activeProjectPath ? path.join(activeProjectPath, "project-state.json") : path.join(process.cwd(), "project-state.json"),
      filters: [{ name: "JSON Project", extensions: ["json"] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: "Guardado cancelado por el usuario" };
    }
    const sanitized = await sanitizeProjectState(state);
    sanitized.date = Date.now();
    await fs.promises.writeFile(filePath, JSON.stringify(sanitized, null, 2), "utf8");
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
      defaultPath: await getProjectsDir(),
      filters: [{ name: "JSON Project", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: "Carga cancelada" };
    }
    const filePath = filePaths[0];
    const projectPath = path.dirname(filePath);
    if (activeProjectPath && activeProjectPath !== projectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    await initProjectDirs(projectPath);
    await cleanupProjectTemp(projectPath);
    await initProjectDirs(projectPath);
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = await sanitizeProjectState(JSON.parse(raw));
    activeProjectPath = projectPath;
    return { success: true, data: parsed, projectPath };
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
    if (!await exists(promptPath)) {
      const possiblePaths = [
        path.join(electron.app.getAppPath(), "src/prompt-maestro.txt"),
        path.join(__dirname, "../../src/prompt-maestro.txt"),
        path.join(__dirname, "../prompt-maestro.txt"),
        path.join(process.cwd(), "prompt-maestro.txt")
      ];
      for (const p of possiblePaths) {
        if (await exists(p)) {
          promptPath = p;
          break;
        }
      }
    }
    if (!await exists(promptPath)) {
      return { success: false, error: "No se encontró el archivo prompt-maestro.txt en cipher-studio/src" };
    }
    const promptTemplate = await fs.promises.readFile(promptPath, "utf8");
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
            content: "Eres un guionista experto. Tu única tarea es reescribir la transcripción siguiendo el estilo solicitado. IMPORTANTE: Entrega ÚNICAMENTE el texto corrido del guion final resultante que será hablado de forma continua frente a la cámara. Está estrictamente PROHIBIDO incluir títulos, encabezados, viñetas, formato markdown, saludos, introducciones, notas o comentarios adicionales. Empieza a responder directamente con el primer párrafo del guion."
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
      const voicesDir = activeProjectPath ? path.join(activeProjectPath, "voices") : path.join(electron.app.getPath("userData"), "generated-voices");
      if (!await exists(voicesDir)) {
        await fs.promises.mkdir(voicesDir, { recursive: true });
      }
      const filename = `voice-${Date.now()}.mp3`;
      const filePath = path.join(voicesDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      console.log(`[generate-voice] Archivo de voz guardado localmente en: ${filePath}`);
      const durationSeconds = await getVideoDuration(filePath);
      const base64Audio = buffer.toString("base64");
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      return { success: true, filePath, audioUrl, durationSeconds };
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
electron.ipcMain.handle("generate-minimax-video", async (_event, { prompt }) => {
  var _a;
  try {
    loadEnv();
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return { success: false, error: "MINIMAX_API_KEY no está configurado en el archivo .env." };
    }
    console.log("[generate-minimax-video] Iniciando generación con prompt:", prompt);
    const submitResponse = await fetch("https://api.minimax.io/v1/video_generation", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "MiniMax-Hailuo-2.3",
        prompt,
        duration: 6,
        resolution: "1080P"
      })
    });
    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      return { success: false, error: `Error MiniMax Submit (${submitResponse.status}): ${errText}` };
    }
    const submitData = await submitResponse.json();
    const taskId = submitData.task_id;
    if (!taskId) {
      return { success: false, error: `MiniMax no devolvió un task_id: ${JSON.stringify(submitData)}` };
    }
    console.log(`[generate-minimax-video] Task creado con ID: ${taskId}. Iniciando sondeo...`);
    let fileId = null;
    let status = "Preparing";
    const maxPolls = 60;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3e3));
      const queryResponse = await fetch(`https://api.minimax.io/v1/query/video_generation?task_id=${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      if (!queryResponse.ok) {
        console.error(`[generate-minimax-video] Error al sondear la tarea (${queryResponse.status})`);
        continue;
      }
      const queryData = await queryResponse.json();
      status = queryData.status || "";
      console.log(`[generate-minimax-video] Sondeo #${i + 1}: status = ${status}`);
      if (status === "Success") {
        fileId = queryData.file_id;
        break;
      } else if (status === "Fail") {
        return { success: false, error: "La generación de video por MiniMax falló." };
      }
    }
    if (!fileId) {
      return { success: false, error: `El sondeo expiró o falló. Estado final: ${status}` };
    }
    console.log(`[generate-minimax-video] Tarea exitosa. Obteniendo URL para fileId: ${fileId}...`);
    const retrieveResponse = await fetch(`https://api.minimax.io/v1/files/retrieve?file_id=${fileId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (!retrieveResponse.ok) {
      const errText = await retrieveResponse.text();
      return { success: false, error: `Error al obtener URL del archivo (${retrieveResponse.status}): ${errText}` };
    }
    const retrieveData = await retrieveResponse.json();
    const downloadUrl = ((_a = retrieveData.file) == null ? void 0 : _a.download_url) || retrieveData.download_url;
    if (!downloadUrl) {
      return { success: false, error: `MiniMax no devolvió una download_url: ${JSON.stringify(retrieveData)}` };
    }
    console.log(`[generate-minimax-video] Descargando video desde: ${downloadUrl}`);
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      return { success: false, error: `Error al descargar el archivo de video: ${downloadRes.statusText}` };
    }
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const targetDir = activeProjectPath ? path.join(activeProjectPath, "temp", "minimax") : path.join(process.cwd(), "cipher-studio", "banco-clips", "minimax");
    if (!await exists(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    const filename = `minimax-${Date.now()}.mp4`;
    const filePath = path.join(targetDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    const durationSeconds = await getVideoDuration(filePath);
    const thumbFilename = `thumb-${path.basename(filename, ".mp4")}.jpg`;
    const thumbDir = activeProjectPath ? path.join(activeProjectPath, "temp", "thumbnails") : path.join(process.cwd(), "cipher-studio", "banco-clips", "thumbnails");
    if (!await exists(thumbDir)) {
      await fs.promises.mkdir(thumbDir, { recursive: true });
    }
    const thumbPath = path.join(thumbDir, thumbFilename);
    let thumbnailUrl = "";
    try {
      await generateVideoThumbnail(filePath, thumbPath);
      thumbnailUrl = `file:///${thumbPath.replace(/\\/g, "/")}`;
    } catch (e) {
      console.error("[generate-minimax-video] Error generating thumbnail:", e);
    }
    return {
      success: true,
      filePath,
      durationSeconds,
      thumbnailUrl,
      name: filename
    };
  } catch (err) {
    console.error("[generate-minimax-video] Excepción:", err);
    return { success: false, error: err.message || "Error desconocido al generar video con MiniMax." };
  }
});
electron.ipcMain.handle("load-bank-clips", async (_event, { category }) => {
  try {
    const isTempCategory = ["originales", "minimax"].includes(category.toLowerCase());
    const useActiveProj = !!(activeProjectPath && isTempCategory);
    const baseDir = useActiveProj ? activeProjectPath : getBancoClipsPath();
    const dirPath = useActiveProj ? path.join(baseDir, "temp", category) : path.join(baseDir, category);
    const thumbnailDir = useActiveProj ? path.join(baseDir, "temp", "thumbnails") : path.join(baseDir, "thumbnails");
    if (!await exists(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
    if (!await exists(thumbnailDir)) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true });
    }
    const files = await fs.promises.readdir(dirPath);
    const bankClips = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.promises.stat(filePath);
      if (stat.isFile() && /\.(mp4|mkv|avi|mov|webm)$/i.test(file)) {
        const durationSeconds = await getVideoDuration(filePath);
        const durationStr = formatTimeMinutesSeconds(durationSeconds);
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailName);
        let thumbnailUrl = "";
        if (await exists(thumbnailPath)) {
          try {
            thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString("base64")}`;
          } catch (e) {
            console.error(`[load-bank-clips] Error al leer miniatura para ${file}:`, e);
          }
        } else {
          try {
            await generateVideoThumbnail(filePath, thumbnailPath);
            if (await exists(thumbnailPath)) {
              thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString("base64")}`;
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
electron.ipcMain.handle("cut-video-clips", async (_event, { videoPath, timestamps }) => {
  try {
    console.log(`[cut-video-clips] Slicing video: ${videoPath}, timestamps length: ${(timestamps == null ? void 0 : timestamps.length) || 0}`);
    const bankDir = getBancoClipsPath();
    const useActiveProj = !!activeProjectPath;
    const outDir = useActiveProj ? path.join(activeProjectPath, "temp", "originales") : path.join(bankDir, "originales");
    const thumbnailDir = useActiveProj ? path.join(activeProjectPath, "temp", "thumbnails") : path.join(bankDir, "thumbnails");
    if (!await exists(outDir)) {
      await fs.promises.mkdir(outDir, { recursive: true });
    }
    if (!await exists(thumbnailDir)) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true });
    }
    const existingFiles = await fs.promises.readdir(outDir);
    for (const file of existingFiles) {
      try {
        await fs.promises.unlink(path.join(outDir, file));
      } catch (e) {
      }
    }
    const escapedVideo = videoPath.replace(/"/g, '\\"');
    if (timestamps && Array.isArray(timestamps) && timestamps.length > 0) {
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const clipNum = String(i + 1).padStart(3, "0");
        const clipFileName = `clip_${clipNum}.mp4`;
        const clipPath = path.join(outDir, clipFileName);
        const escapedClipPath = clipPath.replace(/"/g, '\\"');
        await new Promise((resolve, reject) => {
          const ffmpegCmd = `ffmpeg -y -ss ${ts} -i "${escapedVideo}" -t 3 -c copy "${escapedClipPath}"`;
          console.log(`[cut-video-clips] Executing FFmpeg: ${ffmpegCmd}`);
          child_process.exec(ffmpegCmd, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } else {
      const outputPattern = path.join(outDir, "clip_%03d.mp4").replace(/\\/g, "/");
      const escapedOutputPattern = outputPattern.replace(/"/g, '\\"');
      await new Promise((resolve, reject) => {
        const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" -c copy -segment_time 3 -segment_start_number 1 -f segment "${escapedOutputPattern}"`;
        console.log(`[cut-video-clips] Executing FFmpeg: ${ffmpegCmd}`);
        child_process.exec(ffmpegCmd, (err, _stdout, _stderr) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    const files = await fs.promises.readdir(outDir);
    const createdClips = [];
    for (const file of files) {
      if (file.startsWith("clip_") && file.endsWith(".mp4")) {
        const clipPath = path.join(outDir, file);
        const durationSeconds = await getVideoDuration(clipPath);
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailName);
        let thumbnailUrl = "";
        try {
          await generateVideoThumbnail(clipPath, thumbnailPath);
          if (await exists(thumbnailPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString("base64")}`;
          }
        } catch (e) {
          console.error(`[cut-video-clips] Error generating thumbnail for ${file}:`, e);
        }
        const stat = await fs.promises.stat(clipPath);
        createdClips.push({
          id: `bank-originales-${file}`,
          name: file,
          path: clipPath,
          url: `file:///${clipPath.replace(/\\/g, "/")}`,
          duration: formatTimeMinutesSeconds(durationSeconds),
          durationSeconds,
          type: "video",
          size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          thumbnailUrl
        });
      }
    }
    console.log(`[cut-video-clips] Slicing finished. Created ${createdClips.length} clips.`);
    return { success: true, clips: createdClips };
  } catch (err) {
    console.error(`[cut-video-clips] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("read-file-as-blob", async (_event, { filePath }) => {
  try {
    if (!await exists(filePath)) {
      return { success: false, error: `File not found at: ${filePath}` };
    }
    const buffer = await fs.promises.readFile(filePath);
    return { success: true, buffer };
  } catch (err) {
    console.error(`[read-file-as-blob] Error reading file ${filePath}:`, err.message);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("delete-bank-clip", async (_event, { category, file }) => {
  try {
    const isTempCategory = category === "originales" || category === "minimax";
    const useActiveProj = !!(activeProjectPath && isTempCategory);
    const baseDir = useActiveProj ? activeProjectPath : getBancoClipsPath();
    const filePath = useActiveProj ? path.join(baseDir, "temp", category, file) : path.join(baseDir, category, file);
    if (await exists(filePath)) {
      await fs.promises.unlink(filePath);
    }
    const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
    const thumbnailPath = useActiveProj ? path.join(baseDir, "temp", "thumbnails", thumbnailName) : path.join(baseDir, "thumbnails", thumbnailName);
    if (await exists(thumbnailPath)) {
      await fs.promises.unlink(thumbnailPath);
    }
    return { success: true };
  } catch (err) {
    console.error(`[delete-bank-clip] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("export-video", async (_event, { clips, aspectRatio, resolution, format, quality }) => {
  try {
    if (!win) return { success: false, error: "Ventana no disponible" };
    const ext = format === "mov" ? "mov" : "mp4";
    const filterName = format === "mov" ? "QuickTime Movie" : "MP4 Video";
    const { filePath, canceled } = await electron.dialog.showSaveDialog(win, {
      title: "Exportar Video",
      defaultPath: path.join(electron.app.getPath("downloads"), `export.${ext}`),
      filters: [{ name: filterName, extensions: [ext] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: "Exportación cancelada por el usuario" };
    }
    if (!clips || clips.length === 0) {
      return { success: false, error: "No hay clips en el Timeline para exportar." };
    }
    let targetW = 1920;
    let targetH = 1080;
    if (aspectRatio === "vertical") {
      if (resolution === "4K") {
        targetW = 2160;
        targetH = 3840;
      } else if (resolution === "720p") {
        targetW = 720;
        targetH = 1280;
      } else {
        targetW = 1080;
        targetH = 1920;
      }
    } else if (aspectRatio === "square") {
      if (resolution === "4K") {
        targetW = 2160;
        targetH = 2160;
      } else if (resolution === "720p") {
        targetW = 720;
        targetH = 720;
      } else {
        targetW = 1080;
        targetH = 1080;
      }
    } else {
      if (resolution === "4K") {
        targetW = 3840;
        targetH = 2160;
      } else if (resolution === "720p") {
        targetW = 1280;
        targetH = 720;
      } else {
        targetW = 1920;
        targetH = 1080;
      }
    }
    let filterStr = "";
    if (aspectRatio === "vertical") {
      filterStr = `-vf "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`;
    } else if (aspectRatio === "square") {
      filterStr = `-vf "crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`;
    } else {
      filterStr = `-vf "crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`;
    }
    let crf = 23;
    let preset = "fast";
    if (quality === "high") {
      crf = 18;
      preset = "medium";
    } else if (quality === "low") {
      crf = 28;
      preset = "ultrafast";
    }
    const escapedOut = filePath.replace(/"/g, '\\"');
    if (clips.length === 1) {
      const videoPath = clips[0].path;
      if (!videoPath || !await exists(videoPath)) {
        return { success: false, error: `El archivo original no existe o no tiene ruta: ${clips[0].name}` };
      }
      const escapedVideo = videoPath.replace(/"/g, '\\"');
      const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" ${filterStr} -c:v libx264 -preset ${preset} -crf ${crf} -pix_fmt yuv420p -c:a aac "${escapedOut}"`;
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
        if (clip.path && await exists(clip.path)) {
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
      await fs.promises.writeFile(tempTxtPath, fileContent, "utf8");
      const escapedTxt = tempTxtPath.replace(/"/g, '\\"');
      const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" ${filterStr} -c:v libx264 -preset ${preset} -crf ${crf} -pix_fmt yuv420p -c:a aac "${escapedOut}"`;
      await new Promise((resolve, reject) => {
        child_process.exec(ffmpegCmd, async (err) => {
          try {
            await fs.promises.unlink(tempTxtPath);
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
electron.ipcMain.handle("generate-timeline-assets", async (event, { scriptText, audioDuration, transcriptSegments, videoPath }) => {
  var _a, _b, _c, _d;
  const logMessage = async (msg) => {
    console.log(msg);
    await writeDebugLog(msg);
  };
  try {
    await logMessage("[generate-timeline-assets] Iniciando...");
    const totalClips = Math.ceil((audioDuration || 0) / 3);
    if (totalClips <= 0) return { success: false, error: "audioDuration inválido o cero." };
    await logMessage(`[FASE 1] audioDuration=${audioDuration}s → totalClips=${totalClips}`);
    if (!videoPath || !await exists(videoPath)) {
      return { success: false, error: `No se encontró el video original: ${videoPath}` };
    }
    await logMessage("[FASE 2] Solicitando timestamps a DeepSeek...");
    loadEnv();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { success: false, error: "No se configuró DEEPSEEK_API_KEY en el archivo .env" };
    let timestamps = [];
    event.sender.send("generation-progress", {
      index: 0,
      total: totalClips,
      paragraph: "Consultando DeepSeek para seleccionar timestamps...",
      type: "DeepSeek"
    });
    const maxTsVal = (transcriptSegments == null ? void 0 : transcriptSegments.length) > 0 ? ((_a = transcriptSegments[transcriptSegments.length - 1]) == null ? void 0 : _a.end) ?? audioDuration : audioDuration;
    try {
      const segmentsText = (transcriptSegments || []).map((s, i) => `[${i}] ${Number(s.start).toFixed(1)}s-${Number(s.end).toFixed(1)}s: "${s.text}"`).join("\n");
      const sentences = (scriptText || "").split(new RegExp("(?<=[.!?])\\s+")).filter((s) => s.trim().length > 0);
      const fragments = [];
      if (sentences.length <= totalClips) {
        for (let i = 0; i < totalClips; i++) {
          fragments.push(sentences[i] || sentences[sentences.length - 1] || "");
        }
      } else {
        const k = sentences.length / totalClips;
        for (let i = 0; i < totalClips; i++) {
          const start = Math.floor(i * k);
          const end = Math.floor((i + 1) * k);
          fragments.push(sentences.slice(start, end).join(" "));
        }
      }
      const fragmentosNumerados = fragments.map((frag, idx) => `[${idx + 1}] "${frag}"`).join("\n");
      const dsPrompt = `Eres un editor de video. Para cada fragmento del guión narrado, elige el timestamp del video original que mejor lo ilustre visualmente.

TRANSCRIPCIÓN DEL VIDEO ORIGINAL:
${segmentsText}

FRAGMENTOS DEL GUIÓN (cada fragmento = 1 clip de 3 segundos):
${fragmentosNumerados}

INSTRUCCIONES:
- Devuelve exactamente ${totalClips} timestamps, uno por fragmento en orden
- Cada timestamp debe ilustrar el contenido de ese fragmento específico
- Los timestamps deben estar dentro del rango 0 - ${Number(maxTsVal).toFixed(1)}
- Evita repetir el mismo timestamp

Responde ÚNICAMENTE con JSON: {"timestamps": [t0, t1, t2, ...]}`;
      const dsResponse = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Eres un editor de video experto. Responde ÚNICAMENTE con el JSON solicitado." },
            { role: "user", content: dsPrompt }
          ],
          temperature: 0.2
        })
      });
      if (dsResponse.ok) {
        const dsData = await dsResponse.json();
        let content = (((_d = (_c = (_b = dsData == null ? void 0 : dsData.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) || "").trim();
        if (content.includes("{")) {
          content = content.substring(content.indexOf("{"), content.lastIndexOf("}") + 1);
        }
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.timestamps)) {
          timestamps = parsed.timestamps.map((t) => Number(t)).filter((t) => !isNaN(t));
        }
      }
    } catch (e) {
      await logMessage(`[FASE 2] DeepSeek error: ${e.message}. Usando fallback.`);
    }
    if (timestamps.length === 0) {
      for (let i = 0; i < totalClips; i++) {
        timestamps.push(parseFloat((i / totalClips * maxTsVal).toFixed(1)));
      }
      await logMessage(`[FASE 2] Fallback: ${totalClips} timestamps uniformes.`);
    }
    while (timestamps.length < totalClips) {
      timestamps.push(timestamps[timestamps.length - 1] ?? 0);
    }
    await logMessage(`[FASE 2] Timestamps: ${timestamps.slice(0, 5).join(", ")}${totalClips > 5 ? "..." : ""}`);
    await logMessage(`[FASE 3] Cortando ${totalClips} clips con FFmpeg...`);
    const outDir = activeProjectPath ? path.join(activeProjectPath, "temp", "originales") : path.join(getBancoClipsPath(), "originales");
    if (!await exists(outDir)) await fs.promises.mkdir(outDir, { recursive: true });
    const existingFiles = await fs.promises.readdir(outDir);
    for (const f of existingFiles) {
      try {
        await fs.promises.unlink(path.join(outDir, f));
      } catch (e) {
      }
    }
    const thumbDir = activeProjectPath ? path.join(activeProjectPath, "temp", "thumbnails") : path.join(getBancoClipsPath(), "thumbnails");
    if (!await exists(thumbDir)) await fs.promises.mkdir(thumbDir, { recursive: true });
    const createdClips = [];
    const escapedVideo = videoPath.replace(/"/g, '\\"');
    for (let i = 0; i < totalClips; i++) {
      const ts = timestamps[i] ?? 0;
      const clipNum = String(i + 1).padStart(3, "0");
      const clipPath = path.join(outDir, `clip_${clipNum}.mp4`);
      const escapedClip = clipPath.replace(/"/g, '\\"');
      event.sender.send("generation-progress", {
        index: i,
        total: totalClips,
        paragraph: `Clip ${i + 1}/${totalClips} — t=${ts}s`,
        type: "FFmpeg"
      });
      try {
        await new Promise((resolve, reject) => {
          const cmd = `ffmpeg -y -ss ${ts} -i "${escapedVideo}" -t 3 -c copy "${escapedClip}"`;
          child_process.exec(cmd, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (ffErr) {
        await logMessage(`[FASE 3] FFmpeg error clip ${i + 1}: ${ffErr.message}`);
      }
      if (await exists(clipPath)) {
        const durationSeconds = await getVideoDuration(clipPath);
        const thumbPath = path.join(thumbDir, `clip_${clipNum}.jpg`);
        let thumbnailUrl = "";
        try {
          await generateVideoThumbnail(clipPath, thumbPath);
          if (await exists(thumbPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbPath)).toString("base64")}`;
          }
        } catch (e) {
        }
        const stat = await fs.promises.stat(clipPath);
        createdClips.push({
          id: `bank-originales-clip_${clipNum}.mp4`,
          name: `clip_${clipNum}.mp4`,
          path: clipPath,
          url: `file:///${clipPath.replace(/\\/g, "/")}`,
          duration: formatTimeMinutesSeconds(durationSeconds),
          durationSeconds,
          type: "video",
          category: "original",
          size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          thumbnailUrl
        });
      }
    }
    if (createdClips.length < totalClips && createdClips.length > 0) {
      const before = createdClips.length;
      while (createdClips.length < totalClips) {
        const last = createdClips[createdClips.length - 1];
        createdClips.push({ ...last, id: `${last.id}-dup-${createdClips.length}` });
      }
      await logMessage(`[FASE 4] Duplicados: ${before} → ${createdClips.length} clips.`);
    }
    if (createdClips.length === 0) {
      return { success: false, error: "No se pudo crear ningún clip. Verifica el video y FFmpeg." };
    }
    await logMessage("[FASE 5] Ensamblando timeline...");
    let currentStart = 0;
    for (const clip of createdClips) {
      clip.startSeconds = currentStart;
      currentStart += clip.durationSeconds;
    }
    await logMessage(`[generate-timeline-assets] Completado. Clips: ${createdClips.length}`);
    return { success: true, clips: createdClips };
  } catch (err) {
    const errMsg = `[generate-timeline-assets] Error: ${err.message || err}`;
    console.error(errMsg, err);
    await writeDebugLog(errMsg);
    return { success: false, error: err.message || "Error interno" };
  }
});
//# sourceMappingURL=index.js.map
