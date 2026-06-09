export interface IElectronAPI {
  onMainMessage: (callback: (message: string) => void) => () => void;
  startTranscription: (filePath: string) => void;
  onTranscriptionUpdate: (callback: (event: any, data: any) => void) => () => void;
  rewriteTranscript: (text: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  generateVoice: (params: { text: string; model: string; voiceId: string; speed: number; stability: number }) => Promise<{ success: boolean; filePath?: string; audioUrl?: string; durationSeconds?: number; error?: string }>;
  generateMinimaxVideo: (params: { prompt: string }) => Promise<{ success: boolean; filePath?: string; durationSeconds?: number; thumbnailUrl?: string; name?: string; error?: string }>;
  loadBankClips: (params: { category: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  generateTimelineAssets: (params: { scriptText: string; weights: number[]; aspectRatio?: string; audioDuration?: number; transcriptSegments?: any[]; videoPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal'; graphicsPercent?: number }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  onGenerationProgress: (callback: (event: any, data: any) => void) => () => void;
  cutVideoClips: (params: { videoPath: string; timestamps?: number[]; aspectRatio?: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  saveProjectState: (state: any) => Promise<{ success: boolean; error?: string }>;
  loadProjectState: () => Promise<{ success: boolean; data?: any; error?: string }>;
  saveProjectAs: (state: any) => Promise<{ success: boolean; error?: string }>;
  openProject: () => Promise<{ success: boolean; data?: any; projectPath?: string; error?: string }>;
  onSaveBeforeClose: (callback: () => void) => () => void;
  readyToClose: () => void;
  deleteBankClip: (params: { category: string; file: string }) => Promise<{ success: boolean; error?: string }>;
  exportVideo: (params: { clips: any[]; aspectRatio: string; resolution?: string; format?: string; quality?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getElevenLabsVoices: () => Promise<{ success: boolean; voices?: any[]; error?: string }>;
  listProjects: () => Promise<{ success: boolean; projects?: any[]; error?: string }>;
  createProject: (params: { name: string }) => Promise<{ success: boolean; data?: any; projectPath?: string; error?: string }>;
  loadProject: (params: { projectPath: string }) => Promise<{ success: boolean; data?: any; projectPath?: string; error?: string }>;
  closeProject: () => Promise<{ success: boolean; error?: string }>;
  deleteProject: (params: { projectPath: string }) => Promise<{ success: boolean; error?: string }>;
  deleteAllProjects: () => Promise<{ success: boolean; error?: string }>;
  clearGlobalStockCache: () => Promise<{ success: boolean; error?: string }>;
  readFileAsBlob: (params: { filePath: string }) => Promise<{ success: boolean; buffer?: Uint8Array; error?: string }>;
  regenerateGraphics: (params: { scriptText: string; clips: any[]; graphicsPercent: number }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
