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
  generateTimelineAssets: (params: { scriptText: string; weights: number[]; aspectRatio?: string; audioDuration?: number; transcriptSegments?: any[]; videoPath?: string; iaStyle?: 'cartoon' | 'bw' | 'normal'; visualAssetPack?: 'legacy' | 'modern-pack-100-v1' | 'modern-pack-100-v1+local'; visualPresentationProfile?: 'standard' | 'editorial-hybrid-v1' | 'visual-recovery-v1' | 'premium-type-color-v1' | 'editorial-explainer-light-v1' | 'editorial-explainer-light-v2' | 'editorial-explainer-v3' | 'editorial-idea-assembly-v4' | 'editorial-modular-catalog-v1' | 'editorial-modular-families-v1' | 'editorial-modular-finish-v1-1' | 'editorial-local-bank-v2' | 'editorial-local-bank-v3' | 'editorial-local-bank-v4' | 'families-motion-v2'; modularCatalogRoot?:string; editorialFamilyChoice?:string; editorialFamilyColor?:string; editorialFamilyEffects?:string; editorialFinishControls?:{display:string;local:string;ambient:string;composition:string;representation:string;response:string;headline:string;keyword:string;body:string;effects:string}; graphicsPercent?: number; newAudioSegments?: any[]; hasVideoV2?: boolean }) => Promise<{ success: boolean; clips?: any[]; error?: string }>;
  generateIdeaAssemblyV4Pilot: (params: { assetRoot: string;
    color: import('../shared/editorial-idea-assembly-v1').IdeaColorIntentV4;
    orientation: 'portrait' | 'landscape' }) => Promise<{ success: boolean; path?: string; url?: string;
      durationSeconds?: number; graphicData?: any; renderBindings?: any; findings?: any[]; error?: string }>;
  regenerateIdeaAssemblyV4Pilot: (params: { graphicData: any; renderBindings: any;
    orientation: 'portrait' | 'landscape' }) => Promise<{ success: boolean; path?: string;
      url?: string; durationSeconds?: number; error?: string }>;
  listEditorialModularCatalogV1: (catalogRoot: string, verifyAll?: boolean) => Promise<{success:boolean; assets?:Array<{assetId:string;role:string;primaryWordEs:string;code:string}>;health?:{listed:number;verified:number;failures:Array<{assetId:string;error:string}>};error?:string}>;
  listEditorialModularCatalogV2: (catalogRoot: string, verifyAll?: boolean) => Promise<{success:boolean; assets?:Array<{assetId:string;role:string;primaryWordEs:string;code:string}>;health?:{listed:number;verified:number;failures:Array<{assetId:string;error:string}>};error?:string}>;
  chooseEditorialModularCatalogRoot: () => Promise<{success:boolean;catalogRoot?:string;canceled?:boolean;error?:string}>;
  rebindEditorialFamilyClipV1: (params: {catalogRoot:string;graphicData:any;renderBindings:any;
    finishControls?:{display:string;local:string;ambient:string;composition:string;representation:string;response:string;
      headline:string;keyword:string;body:string;effects:string};
    orientation:'portrait'|'landscape';durationSeconds:number;
    edits:{family:import('../shared/editorial-modular-families-v1').EditorialFamilyIdV1;
      heroId?:string;supportIds:string[];rearId?:string;accentId?:string;frontId?:string}}) =>
    Promise<{success:boolean;path?:string;url?:string;durationSeconds?:number;graphicData?:any;
      renderBindings?:any;pixelIdentity?:string;error?:string}>;
  generateEditorialModularCatalogV1: (params: import('../shared/editorial-modular-catalog-v1').ModularCatalogPilotInputV1) => Promise<{success:boolean;path?:string;url?:string;durationSeconds?:number;graphicData?:any;renderBindings?:any;error?:string}>;
  chooseEditorialCatalogBatchFolder: () => Promise<string | null>;
  previewEditorialCatalogBatchV2: (catalogRoot:string,batchFolder:string) => Promise<{success:boolean;preview?:any;error?:string}>;
  activateEditorialCatalogBatchV2: (catalogRoot:string,batchFolder:string) => Promise<{success:boolean;preview?:any;error?:string}>;
  rollbackEditorialCatalogSnapshotV2: (catalogRoot:string) => Promise<{success:boolean;error?:string}>;
  regenerateEditorialModularCatalogV1: (params: {graphicData:any;renderBindings:any;orientation:'portrait'|'landscape'}) => Promise<{success:boolean;path?:string;url?:string;durationSeconds?:number;error?:string}>;
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
    mode?: 'modern-visual';
    modernVisuals?: { clipId: string; context: any }[];
    aspectRatio?: string;
    resolution?: string;
  }) => Promise<{ success: boolean; mode?: string; clips?: any[]; error?: string; code?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
