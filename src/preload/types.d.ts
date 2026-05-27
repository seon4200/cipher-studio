export interface IElectronAPI {
  onMainMessage: (callback: (message: string) => void) => () => void;
  startTranscription: (filePath: string) => void;
  onTranscriptionUpdate: (callback: (event: any, data: any) => void) => () => void;
  rewriteTranscript: (text: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  generateVoice: (params: { text: string; model: string; speaker: string; speed: number; stability: number }) => Promise<{ success: boolean; filePath?: string; audioUrl?: string; error?: string }>;
  loadBankClips: (params: { category: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  cutVideoClips: (params: { videoPath: string; segments: any[]; aspectRatio: string }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  saveProjectState: (state: any) => Promise<{ success: boolean; error?: string }>;
  loadProjectState: () => Promise<{ success: boolean; data?: any; error?: string }>;
  saveProjectAs: (state: any) => Promise<{ success: boolean; error?: string }>;
  openProject: () => Promise<{ success: boolean; data?: any; error?: string }>;
  onSaveBeforeClose: (callback: () => void) => () => void;
  readyToClose: () => void;
  deleteBankClip: (params: { category: string; file: string }) => Promise<{ success: boolean; error?: string }>;
  exportVideo: (params: { clips: any[]; aspectRatio: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
