"use strict";
const electron = require("electron");
const path = require("path");
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
  if (url) {
    win.loadURL(url);
  } else {
    win.loadFile(indexHtml);
  }
}
electron.app.whenReady().then(createWindow);
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
//# sourceMappingURL=index.js.map
