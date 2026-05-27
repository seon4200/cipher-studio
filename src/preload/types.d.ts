export interface IElectronAPI {
  onMainMessage: (callback: (message: string) => void) => () => void;
  startTranscription: (filePath: string) => void;
  onTranscriptionUpdate: (callback: (event: any, data: any) => void) => () => void;
  rewriteTranscript: (text: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  generateVoice: (params: { text: string; model: string; speaker: string; speed: number; stability: number }) => Promise<{ success: boolean; filePath?: string; audioUrl?: string; error?: string }>;
  saveProjectState: (state: any) => Promise<{ success: boolean; error?: string }>;
  loadProjectState: () => Promise<{ success: boolean; data?: any; error?: string }>;
  saveProjectAs: (state: any) => Promise<{ success: boolean; error?: string }>;
  openProject: () => Promise<{ success: boolean; data?: any; error?: string }>;
  onSaveBeforeClose: (callback: () => void) => () => void;
  readyToClose: () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
