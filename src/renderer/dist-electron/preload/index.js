"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  onMainMessage: (callback) => {
    const listener = (_event, value) => callback(value);
    electron.ipcRenderer.on("main-process-message", listener);
    return () => {
      electron.ipcRenderer.removeListener("main-process-message", listener);
    };
  }
});
//# sourceMappingURL=index.js.map
