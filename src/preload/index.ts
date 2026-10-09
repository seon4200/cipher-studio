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
  inspectBuildMedia: (params: any) => ipcRenderer.invoke('inspect-build-media', params),
  retryTimelineAsset: (params: any) => ipcRenderer.invoke('retry-timeline-asset', params),
  generateTimelineAssets: (params: any) => ipcRenderer.invoke('generate-timeline-assets', params),
  animationConnectionStatus: () => ipcRenderer.invoke('animation:connection-status'),
  animationLoadProject: () => ipcRenderer.invoke('animation:load-project'),
  animationLoadDraft: (draftId: string) => ipcRenderer.invoke('animation:load-draft', draftId),
  animationListDrafts: (timelineClipId: string) => ipcRenderer.invoke('animation:list-drafts', timelineClipId),
  animationSaveProject: (state: any) => ipcRenderer.invoke('animation:save-project', state),
  animationSaveBuildState: (params: { projectPath: string; projectState: any; animationState: any }) => ipcRenderer.invoke('animation:save-build-state', params),
  animationProjectJobs: () => ipcRenderer.invoke('animation:project-jobs'),
  animationAddReference: (filePath: string) => ipcRenderer.invoke('animation:add-reference', filePath),
  animationGenerateDraft: (params: any) => ipcRenderer.invoke('animation:generate-draft', params),
  animationAdjustDraftStyle: (params: { draftId: string; jobId: string; patch: Record<string, unknown>; instruction?: string }) => ipcRenderer.invoke('animation:adjust-style', params),
  animationReviewDraft: (params: { draftId: string; jobId: string; threadId?: string | null; userMessage: string }) => ipcRenderer.invoke('animation:review-draft', params),
  animationReplayDraft: (params: { draftId: string; jobId: string; clipId?: string; projectPath?: string; parameters?: Record<string, unknown> }) => ipcRenderer.invoke('animation:replay-draft', params),
  animationSaveTemplate: (params: { draftId: string; title: string; kind: 'component' | 'recipe' | 'sequence'; componentId?: string }) => ipcRenderer.invoke('animation:save-template', params),
  animationListTemplates: () => ipcRenderer.invoke('animation:list-templates'),
  animationCancel: (jobId: string) => ipcRenderer.invoke('animation:cancel', jobId),
  onAnimationProgress: (callback: (data: any) => void) => {
    const listener = (_event: any, value: any) => callback(value)
    ipcRenderer.on('animation:progress', listener)
    return () => ipcRenderer.removeListener('animation:progress', listener)
  },
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
  vibesLoad: () => ipcRenderer.invoke('vibes:load'),
  vibesCreateSlots: (input: any) => ipcRenderer.invoke('vibes:create-slots', input),
  vibesPlan: () => ipcRenderer.invoke('vibes:plan'),
  vibesReviewPlan: (input: { notes?: string }) => ipcRenderer.invoke('vibes:review-plan', input),
  vibesRunImages: () => ipcRenderer.invoke('vibes:run-images'),
  vibesResumeImages: () => ipcRenderer.invoke('vibes:resume-images'),
  vibesImportImages: () => ipcRenderer.invoke('vibes:import-images'),
  vibesAnimateImage: (input: { sceneId: string }) => ipcRenderer.invoke('vibes:animate-image', input),
  vibesResumeAnimation: (input: { sceneId: string }) => ipcRenderer.invoke('vibes:resume-animation', input),
  vibesImportVideo: (input: { sceneId: string }) => ipcRenderer.invoke('vibes:import-video', input),
  onVibesProgress: (callback: (data: any) => void) => {
    const listener = (_event: any, value: any) => callback(value)
    ipcRenderer.on('vibes-progress', listener)
    return () => ipcRenderer.removeListener('vibes-progress', listener)
  },
  saveProjectAs: (state: any) => ipcRenderer.invoke('save-project-as', state),
  openProject: () => ipcRenderer.invoke('open-project'),
  deleteBankClip: (params: { category: string, file: string }) => ipcRenderer.invoke('delete-bank-clip', params),
  exportVideo: (params: any) => ipcRenderer.invoke('export-video', params),
  getControlAdapterJob: () => ipcRenderer.invoke('control-adapter:get-job'),
  reportControlProgress: (params: any) => ipcRenderer.invoke('control-adapter:progress', params),
  completeControlAdapter: (params: any) => ipcRenderer.invoke('control-adapter:complete', params),
  startCipherLocalDownload: (params: { idempotencyKey: string; sourceUrl: string; name: string; qualityProfile: 'fhd' | 'best' }) =>
    ipcRenderer.invoke('cipher-control:start-local-download', params),
  getCipherLocalDownload: (params: { projectId: string; attemptId: string }) =>
    ipcRenderer.invoke('cipher-control:get-local-download', params),
  listCipherLocalDownloads: () => ipcRenderer.invoke('cipher-control:list-local-downloads'),
  openCipherLocalDownloadProject: (params: { projectId: string; attemptId: string }) =>
    ipcRenderer.invoke('cipher-control:open-local-download-project', params),
  cancelCipherLocalDownload: (params: { projectId: string; attemptId: string }) =>
    ipcRenderer.invoke('cipher-control:cancel-local-download', params),
  retryCipherLocalDownload: (params: { projectId: string; attemptId: string }) =>
    ipcRenderer.invoke('cipher-control:retry-local-download', params),
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
