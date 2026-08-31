import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Expose safe, structured APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Ruta real en disco de un fichero arrastrado. webUtils.getPathForFile es el reemplazo
  // oficial de File.path, que Electron retiro en la 32. Medido en 31.7.7: las dos formas
  // existen y devuelven la MISMA ruta, asi que se usa esta primero para que actualizar
  // Electron no rompa la importacion. webUtils viene del modulo 'electron' y SI esta
  // disponible en el preload aunque vaya en sandbox — al contrario que los modulos de Node.
  rutaDeFichero: (f: File) => { try { return webUtils.getPathForFile(f) } catch { return '' } },
  onMainMessage: (callback: (message: string) => void) => {
    const listener = (_event: any, value: string) => callback(value)
    ipcRenderer.on('main-process-message', listener)
    return () => {
      ipcRenderer.removeListener('main-process-message', listener)
    }
  },
  startTranscription: (filePath: string) => {
    ipcRenderer.send('start-transcription', filePath)
  },
  onTranscriptionUpdate: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('transcription-update', callback)
    return () => {
      ipcRenderer.removeListener('transcription-update', callback)
    }
  },
  rewriteTranscript: (text: string) => ipcRenderer.invoke('rewrite-transcript', text),
  generateVoice: (params: any) => ipcRenderer.invoke('generate-voice', params),
  generateMinimaxVideo: (params: { prompt: string }) => ipcRenderer.invoke('generate-minimax-video', params),
  loadBankClips: (params: { category: string }) => ipcRenderer.invoke('load-bank-clips', params),
  generateTimelineAssets: (params: { scriptText: string; weights: number[]; aspectRatio?: string; audioDuration?: number; transcriptSegments?: any[]; videoPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal'; graphicsPercent?: number; hasVideoV2?: boolean }) => ipcRenderer.invoke('generate-timeline-assets', params),
  generatePerfectSync: (params: any) => ipcRenderer.invoke('generate-perfect-sync', params),
  renderGraphicsBatch: (params: any) => ipcRenderer.invoke('render-graphics-batch', params),
  // CANAL PROPIO, no un campo mas en `generation-progress`. La barra de progreso es lo unico
  // que el usuario mira durante media hora de generacion; meterle un discriminador para poder
  // avisar de fallos, y arriesgarse a romperla, seria ironico.
  onGenerationAviso: (callback: (event: any, data: any) => void) => {
    const listener = (_event: any, value: any) => callback(_event, value)
    ipcRenderer.on('generation-aviso', listener)
    return () => {
      ipcRenderer.removeListener('generation-aviso', listener)
    }
  },
  onGenerationProgress: (callback: (event: any, data: any) => void) => {
    const listener = (_event: any, value: any) => callback(_event, value)
    ipcRenderer.on('generation-progress', listener)
    return () => {
      ipcRenderer.removeListener('generation-progress', listener)
    }
  },
  onExportProgress: (callback: (event: any, data: any) => void) => {
    const listener = (_event: any, value: any) => callback(_event, value)
    ipcRenderer.on('export-progress', listener)
    return () => {
      ipcRenderer.removeListener('export-progress', listener)
    }
  },
  cutVideoClips: (params: { videoPath: string, timestamps?: number[], aspectRatio?: string }) => ipcRenderer.invoke('cut-video-clips', params),
  saveProjectState: (state: any) => ipcRenderer.invoke('save-project-state', state),
  loadProjectState: () => ipcRenderer.invoke('load-project-state'),
  saveProjectAs: (state: any) => ipcRenderer.invoke('save-project-as', state),
  openProject: () => ipcRenderer.invoke('open-project'),
  deleteBankClip: (params: { category: string, file: string }) => ipcRenderer.invoke('delete-bank-clip', params),
  exportVideo: (params: any) => ipcRenderer.invoke('export-video', params),
  getElevenLabsVoices: () => ipcRenderer.invoke('get-elevenlabs-voices'),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  createProject: (params: { name: string }) => ipcRenderer.invoke('create-project', params),
  loadProject: (params: { projectPath: string }) => ipcRenderer.invoke('load-project', params),
  closeProject: () => ipcRenderer.invoke('close-project'),
  extractMasterAudio: (params: { videoPath: string }) => ipcRenderer.invoke('extract-master-audio', params),
  recortarFuente: (params: { videoPath: string; duracion: number }) =>
    ipcRenderer.invoke('recortar-fuente', params),
  deleteProject: (params: { projectPath: string }) => ipcRenderer.invoke('delete-project', params),
  deleteAllProjects: () => ipcRenderer.invoke('delete-all-projects'),
  clearGlobalStockCache: () => ipcRenderer.invoke('clear-global-stock-cache'),
  readFileAsBlob: (params: { filePath: string }) => ipcRenderer.invoke('read-file-as-blob', params),
  generateThumbnail: (videoPath: string) => ipcRenderer.invoke('generate-thumbnail', videoPath),
  regenerateGraphics: (params: any) => ipcRenderer.invoke('regenerate-graphics', params),
  onSaveBeforeClose: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('save-before-close', listener)
    return () => {
      ipcRenderer.removeListener('save-before-close', listener)
    }
  },
  readyToClose: () => ipcRenderer.send('ready-to-close'),
})
