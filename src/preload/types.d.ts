export interface IElectronAPI {
  rutaDeFichero: (f: File) => string;
  onMainMessage: (callback: (message: string) => void) => () => void;
  startTranscription: (filePath: string) => void;
  onTranscriptionUpdate: (callback: (event: any, data: any) => void) => () => void;
  rewriteTranscript: (text: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  generateVoice: (params: { text: string; model: string; voiceId: string; speed: number; stability: number }) => Promise<{ success: boolean; filePath?: string; audioUrl?: string; durationSeconds?: number; newAudioSegments?: any[]; error?: string }>;
  generateMinimaxVideo: (params: { prompt: string }) => Promise<{ success: boolean; filePath?: string; durationSeconds?: number; thumbnailUrl?: string; name?: string; error?: string }>;
  loadBankClips: (params: { category: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  generateTimelineAssets: (params: { scriptText: string; weights: number[]; aspectRatio?: string; audioDuration?: number; transcriptSegments?: any[]; videoPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal'; graphicsPercent?: number; newAudioSegments?: any[]; hasVideoV2?: boolean }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  generatePerfectSync: (params: { videoPath: string; transcriptSegments: any[]; syncWeights: number[]; aspectRatio?: string; audioPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal'; activeProjectPath?: string }) => Promise<{ success: boolean; v1Clip?: any; v2Clips?: any[]; audioClip?: any; error?: string }>;
  /** rutas es POSICIONAL: rutas[i] es null si ese grafico falto. Los huecos no desplazan. */
  renderGraphicsBatch: (params: { graficos: { graphicData: any; duracion?: number }[]; aspectRatio?: string; resolution?: string; fps?: number; modo?: 'overlay' | 'pantalla' }) => Promise<{ success: boolean; rutas?: (string | null)[]; total?: number; renderizados?: number; aciertos?: number; fallos?: number; sinIntentar?: number; cancelado?: boolean; motivo?: string; error?: string }>;
  onGenerationProgress: (callback: (event: any, data: any) => void) => () => void;
  onExportProgress: (callback: (event: any, data: { step: string; current: number; total: number; message: string }) => void) => () => void;
  cutVideoClips: (params: { videoPath: string; timestamps?: number[]; aspectRatio?: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  saveProjectState: (state: any) => Promise<{ success: boolean; error?: string }>;
  loadProjectState: () => Promise<{ success: boolean; data?: any; error?: string }>;
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
  regenerateGraphics: (params: { scriptText: string; clips: any[]; graphicsPercent: number; totalPhrases?: number; audioSegments?: any[]; audioPath?: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
