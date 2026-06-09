"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  onMainMessage: (callback) => {
    const listener = (_event, value) => callback(value);
    electron.ipcRenderer.on("main-process-message", listener);
    return () => {
      electron.ipcRenderer.removeListener("main-process-message", listener);
    };
  },
  startTranscription: (filePath) => {
    electron.ipcRenderer.send("start-transcription", filePath);
  },
  onTranscriptionUpdate: (callback) => {
    electron.ipcRenderer.on("transcription-update", callback);
    return () => {
      electron.ipcRenderer.removeListener("transcription-update", callback);
    };
  },
  rewriteTranscript: (text) => electron.ipcRenderer.invoke("rewrite-transcript", text),
  generateVoice: (params) => electron.ipcRenderer.invoke("generate-voice", params),
  generateMinimaxVideo: (params) => electron.ipcRenderer.invoke("generate-minimax-video", params),
  loadBankClips: (params) => electron.ipcRenderer.invoke("load-bank-clips", params),
  generateTimelineAssets: (params) => electron.ipcRenderer.invoke("generate-timeline-assets", params),
  onGenerationProgress: (callback) => {
    const listener = (_event, value) => callback(_event, value);
    electron.ipcRenderer.on("generation-progress", listener);
    return () => {
      electron.ipcRenderer.removeListener("generation-progress", listener);
    };
  },
  cutVideoClips: (params) => electron.ipcRenderer.invoke("cut-video-clips", params),
  saveProjectState: (state) => electron.ipcRenderer.invoke("save-project-state", state),
  loadProjectState: () => electron.ipcRenderer.invoke("load-project-state"),
  saveProjectAs: (state) => electron.ipcRenderer.invoke("save-project-as", state),
  openProject: () => electron.ipcRenderer.invoke("open-project"),
  deleteBankClip: (params) => electron.ipcRenderer.invoke("delete-bank-clip", params),
  exportVideo: (params) => electron.ipcRenderer.invoke("export-video", params),
  getElevenLabsVoices: () => electron.ipcRenderer.invoke("get-elevenlabs-voices"),
  listProjects: () => electron.ipcRenderer.invoke("list-projects"),
  createProject: (params) => electron.ipcRenderer.invoke("create-project", params),
  loadProject: (params) => electron.ipcRenderer.invoke("load-project", params),
  closeProject: () => electron.ipcRenderer.invoke("close-project"),
  deleteProject: (params) => electron.ipcRenderer.invoke("delete-project", params),
  deleteAllProjects: () => electron.ipcRenderer.invoke("delete-all-projects"),
  clearGlobalStockCache: () => electron.ipcRenderer.invoke("clear-global-stock-cache"),
  readFileAsBlob: (params) => electron.ipcRenderer.invoke("read-file-as-blob", params),
  regenerateGraphics: (params) => electron.ipcRenderer.invoke("regenerate-graphics", params),
  onSaveBeforeClose: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("save-before-close", listener);
    return () => {
      electron.ipcRenderer.removeListener("save-before-close", listener);
    };
  },
  readyToClose: () => electron.ipcRenderer.send("ready-to-close")
});
//# sourceMappingURL=index.js.map
