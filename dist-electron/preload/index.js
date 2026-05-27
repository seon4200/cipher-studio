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
  loadBankClips: (params) => electron.ipcRenderer.invoke("load-bank-clips", params),
  cutVideoClips: (params) => electron.ipcRenderer.invoke("cut-video-clips", params),
  saveProjectState: (state) => electron.ipcRenderer.invoke("save-project-state", state),
  loadProjectState: () => electron.ipcRenderer.invoke("load-project-state"),
  saveProjectAs: (state) => electron.ipcRenderer.invoke("save-project-as", state),
  openProject: () => electron.ipcRenderer.invoke("open-project"),
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
