export interface IElectronAPI {
  rutaDeFichero: (f: File) => string;
  onMainMessage: (callback: (message: string) => void) => () => void;
  startTranscription: (filePath: string) => void;
  startCipherLocalDownload: (params: { idempotencyKey: string; sourceUrl: string; name: string; qualityProfile: 'fhd' | 'best' }) => Promise<{ success: boolean; projectId?: string; operationId?: string; attemptId?: string; projectPath?: string; state?: string; error?: string }>;
  getCipherLocalDownload: (params: { projectId: string; attemptId: string }) => Promise<{ success: boolean; state?: any; error?: string }>;
  listCipherLocalDownloads: () => Promise<{ success: boolean; downloads?: any[]; error?: string }>;
  openCipherLocalDownloadProject: (params: { projectId: string; attemptId: string }) => Promise<{ success: boolean; projectPath?: string; error?: string }>;
  cancelCipherLocalDownload: (params: { projectId: string; attemptId: string }) => Promise<{ success: boolean; state?: string; error?: string }>;
  retryCipherLocalDownload: (params: { projectId: string; attemptId: string }) => Promise<{ success: boolean; projectId?: string; operationId?: string; attemptId?: string; projectPath?: string; error?: string }>;
  onTranscriptionUpdate: (callback: (event: any, data: any) => void) => () => void;
  rewriteTranscript: (text: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  generateVoice: (params: { text: string; model: string; voiceId: string; speed: number; stability: number }) => Promise<{ success: boolean; filePath?: string; audioUrl?: string; durationSeconds?: number; newAudioSegments?: any[]; error?: string }>;
  generateMinimaxVideo: (params: { prompt: string }) => Promise<{ success: boolean; filePath?: string; durationSeconds?: number; thumbnailUrl?: string; name?: string; error?: string }>;
  loadBankClips: (params: { category: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  inspectBuildMedia: (params: { projectPath: string; clips: any[] }) => Promise<{ success: boolean; invalidIds?: string[]; error?: string }>;
  retryTimelineAsset: (params: { projectPath: string; clip: any }) => Promise<{ success: boolean; clip?: any; error?: string }>;
  generateTimelineAssets: (params: { scriptText: string; weights: number[]; aspectRatio?: string; audioDuration?: number; transcriptSegments?: any[]; videoPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal'; graphicsPercent?: number; newAudioSegments?: any[]; hasVideoV2?: boolean; audioProvenance?: any; segmentProvenance?: any }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  animationConnectionStatus: () => Promise<{ available: boolean; authenticated: boolean; status: string; provider: string }>;
  animationLoadProject: () => Promise<{ success: boolean; state?: any; recipes?: any[]; components?: any[]; error?: string }>;
  animationLoadDraft: (draftId: string) => Promise<{ success: boolean; draft?: any; error?: string }>;
  animationListDrafts: (timelineClipId: string) => Promise<{ success: boolean; drafts?: Array<{ draftId: string; createdAt?: string | null; route?: string; quote?: string; purpose?: string; previewAvailable?: boolean; applied?: boolean; planHash?: string }>; invalidDraftCount?: number; error?: string }>;
  animationSaveProject: (state: any) => Promise<{ success: boolean; state?: any; error?: string }>;
  animationSaveBuildState: (params: { projectPath: string; projectState: any; animationState?: any }) => Promise<{ success: boolean; error?: string }>;
  animationProjectJobs: () => Promise<{ success: boolean; jobs?: Array<{ jobId: string; kind?: string; clipId?: string | null; phase?: string }>; error?: string }>;
  animationAddReference: (filePath: string) => Promise<{ success: boolean; reference?: any; framePaths?: string[]; error?: string }>;
  animationGenerateDraft: (params: any) => Promise<{ success: boolean; kind?: 'answer'|'draft'; response?: string; threadId?: string;
    draft?: any; clip?: any; draftFile?: string; metrics?: any; error?: string }>;
  animationAdjustDraftStyle: (params: { draftId: string; jobId: string; patch: Record<string, unknown>; instruction?: string }) => Promise<{ success: boolean; draft?: any; clip?: any; metrics?: any; error?: string }>;
  animationReviewDraft: (params: { draftId: string; jobId: string; threadId?: string | null; userMessage: string }) => Promise<{ success: boolean; response?: string; threadId?: string; provider?: string; model?: string; phases?: string[]; metrics?: any; error?: string }>;
  animationReplayDraft: (params: { draftId: string; jobId: string; clipId?: string; projectPath?: string; parameters?: Record<string, unknown> }) => Promise<{ success: boolean; draftId?: string; rendered?: any; planHash?: string; parameterHash?: string | null; parameters?: Record<string, unknown>; route?: string; error?: string }>;
  animationSaveTemplate: (params: { draftId: string; title: string; kind: 'component'|'recipe'|'sequence'; componentId?: string }) => Promise<{ success: boolean; template?: any; error?: string }>;
  animationListTemplates: () => Promise<{ success: boolean; templates?: any[]; error?: string }>;
  animationCancel: (jobId: string) => Promise<{ success: boolean; cancelled?: boolean; settled?: boolean; error?: string }>;
  onAnimationProgress: (callback: (data: any) => void) => () => void;
  generatePerfectSync: (params: { videoPath: string; transcriptSegments: any[]; syncWeights: number[]; aspectRatio?: string; audioPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal'; activeProjectPath?: string }) => Promise<{ success: boolean; v1Clip?: any; v2Clips?: any[]; audioClip?: any; error?: string }>;
  /** rutas es POSICIONAL: rutas[i] es null si ese grafico falto. Los huecos no desplazan. */
  renderGraphicsBatch: (params: { graficos: { graphicData: any; duracion?: number }[]; aspectRatio?: string; resolution?: string; fps?: number; modo?: 'overlay' | 'pantalla' }) => Promise<{ success: boolean; rutas?: (string | null)[]; total?: number; renderizados?: number; aciertos?: number; fallos?: number; sinIntentar?: number; cancelado?: boolean; motivo?: string; error?: string }>;
  onGenerationAviso: (callback: (event: any, data:
    | { tipo: 'avisos'; lista: import('../shared/avisos').Aviso[] }
    | { tipo: 'resumen'; resumen: import('../shared/avisos').Resumen; lista: import('../shared/avisos').Aviso[] }
  ) => void) => () => void;
  onGenerationProgress: (callback: (event: any, data: any) => void) => () => void;
  onExportProgress: (callback: (event: any, data: { step: string; current: number; total: number; message: string }) => void) => () => void;
  cutVideoClips: (params: { videoPath: string; timestamps?: number[]; aspectRatio?: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  saveProjectState: (state: any) => Promise<{ success: boolean; error?: string }>;
  loadProjectState: () => Promise<{ success: boolean; data?: any; error?: string }>;
  vibesLoad: () => Promise<{ success: boolean; sequence?: any; plan?: any; session?: any; job?: any; styleProfile?: any; error?: string }>;
  vibesCreateSlots: (input: { sourceStartSeconds: number; sourceMediaDurationSeconds?: number; durationSeconds: 60; audioDurationSeconds: number; audioPath: string; transcriptSegments: any[] }) => Promise<{ success: boolean; sequence?: any; error?: string }>;
  vibesPlan: () => Promise<{ success: boolean; plan?: any; sequence?: any; alreadyPlanned?: boolean; error?: string }>;
  vibesReviewPlan: (input: { notes?: string }) => Promise<{ success: boolean; plan?: any; sequence?: any; elapsedMs?: number; error?: string }>;
  vibesRunImages: () => Promise<{ success: boolean; operationId?: string; error?: string }>;
  vibesResumeImages: () => Promise<{ success: boolean; operationId?: string; error?: string }>;
  vibesImportImages: () => Promise<{ success: boolean; clips?: any[]; sequence?: any; importMs?: number; error?: string }>;
  vibesAnimateImage: (input: { sceneId: string }) => Promise<{ success: boolean; operationId?: string; alreadyComplete?: boolean; error?: string }>;
  vibesResumeAnimation: (input: { sceneId: string }) => Promise<{ success: boolean; operationId?: string; alreadyComplete?: boolean; error?: string }>;
  vibesImportVideo: (input: { sceneId: string }) => Promise<{ success: boolean; clip?: any; sequence?: any; error?: string }>;
  onVibesProgress: (callback: (data: any) => void) => () => void;
  saveProjectAs: (state: any) => Promise<{ success: boolean; error?: string }>;
  openProject: () => Promise<{ success: boolean; data?: any; projectPath?: string; error?: string }>;
  onSaveBeforeClose: (callback: () => void) => () => void;
  readyToClose: () => void;
  deleteBankClip: (params: { category: string; file: string }) => Promise<{ success: boolean; error?: string }>;
  exportVideo: (params: { clips: any[]; aspectRatio: string; resolution?: string; format?: string; quality?: string; assignedTransitions?: Record<string, string>; transitionDuration?: number; ajustesVideo?: { crop?: { left: number; top: number; right: number; bottom: number } | null; zoom?: number; panXFrac?: number; panYFrac?: number; isMirrored?: boolean; background?: 'blur' | 'black' } }) => Promise<{ success: boolean; filePath?: string; error?: string; avisoTiempos?: string }>;
  getElevenLabsVoices: () => Promise<{ success: boolean; voices?: any[]; error?: string }>;
  listProjects: () => Promise<{ success: boolean; projects?: any[]; error?: string }>;
  createProject: (params: { name: string }) => Promise<{ success: boolean; data?: any; projectPath?: string; error?: string }>;
  loadProject: (params: { projectPath: string }) => Promise<{ success: boolean; data?: any; projectPath?: string; error?: string }>;
  closeProject: () => Promise<{ success: boolean; error?: string }>;
  extractMasterAudio: (params: { videoPath: string }) => Promise<{ success: boolean; path?: string; url?: string; durationSeconds?: number; error?: string }>;
  // `recortado: false` no es un fallo: significa que no habia recorte real que materializar
  // (diferencia menor que un frame) y que `path` sigue siendo el fichero de entrada.
  recortarFuente: (params: { videoPath: string; duracion: number }) => Promise<{
    success: boolean; recortado?: boolean;
    path?: string; url?: string; durationSeconds?: number;
    audioPath?: string; audioUrl?: string; audioDurationSeconds?: number;
    error?: string
  }>;
  deleteProject: (params: { projectPath: string }) => Promise<{ success: boolean; error?: string }>;
  deleteAllProjects: () => Promise<{ success: boolean; error?: string }>;
  clearGlobalStockCache: () => Promise<{ success: boolean; error?: string }>;
  readFileAsBlob: (params: { filePath: string }) => Promise<{ success: boolean; buffer?: Uint8Array; error?: string }>;
  generateThumbnail: (videoPath: string) => Promise<{ success: boolean; thumbnail?: string; error?: string }>;
  regenerateGraphics: (params: {
    scriptText?: string;
    clips?: any[];
    graphicsPercent?: number;
    totalPhrases?: number;
    audioSegments?: any[];
    audioPath?: string;
    aspectRatio?: string;
    resolution?: string;
  }) => Promise<{ success: boolean; mode?: string; clips?: any[]; error?: string; code?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
