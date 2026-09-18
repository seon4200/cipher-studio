const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-typography-panel-'))
app.setPath('userData', path.join(temp, 'user-data'))
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1240, height: 940,
    webPreferences: { sandbox: true, nodeIntegration: false } })
  try {
    await window.loadFile(path.join(__dirname, 'typography-themes.html'))
    await window.webContents.executeJavaScript('document.fonts.ready')
    fs.writeFileSync(path.join(__dirname, 'typography-themes.png'), (await window.webContents.capturePage()).toPNG())
    console.log('TYPOGRAPHY_PANEL_OK')
    app.exit(0)
  } catch (error) { console.error(error); app.exit(1) }
}).catch(error => { console.error(error); app.exit(1) })
