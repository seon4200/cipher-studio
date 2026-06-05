import { contextBridge, ipcRenderer } from 'electron'

// Expose safe, structured APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
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
  generateTimelineAssets: (params: { scriptText: string; weights: number[]; aspectRatio?: string; audioDuration?: number; transcriptSegments?: any[]; videoPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal' }) => ipcRenderer.invoke('generate-timeline-assets', params),
  onGenerationProgress: (callback: (event: any, data: any) => void) => {
    const listener = (_event: any, value: any) => callback(_event, value)
    ipcRenderer.on('generation-progress', listener)
    return () => {
      ipcRenderer.removeListener('generation-progress', listener)
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
  deleteProject: (params: { projectPath: string }) => ipcRenderer.invoke('delete-project', params),
  readFileAsBlob: (params: { filePath: string }) => ipcRenderer.invoke('read-file-as-blob', params),
  onSaveBeforeClose: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('save-before-close', listener)
    return () => {
      ipcRenderer.removeListener('save-before-close', listener)
    }
  },
  readyToClose: () => ipcRenderer.send('ready-to-close'),
})
