export type ControlAdapterKind =
  | "register-source"
  | "transcribe"
  | "rewrite"
  | "list-voices"
  | "generate-voice"
  | "build"
  | "export";

export type ControlAdapterSettings = {
  scriptText?: string;
  weights?: [number, number, number, number];
  graphicsPercent?: 0 | 50 | 100;
  transitionsPercent?: 0 | 50 | 100;
  voice?: {
    mode: "original" | "elevenlabs";
    voiceId?: string;
    voiceName?: string;
    model?: "Eleven Multilingual v2" | "Eleven English v1" | "Eleven Turbo v2";
    speed?: number;
    stability?: number;
    approvedAudioAttemptId?: string;
  };
  sourceHasAudio?: boolean;
  sourceDurationSeconds?: number;
  voiceName?: string;
};

/** Versioned local contract between the authenticated agent and the Cipher worker. */
export type ControlAdapterJob = {
  schemaVersion: 1;
  operationId: string;
  attemptId: string;
  projectId: string;
  kind: ControlAdapterKind;
  name?: string;
  sourceRelativePath?: string;
  sourceAttemptId?: string;
  text?: string;
  settings?: ControlAdapterSettings;
};

export type ControlAdapterProgress = {
  operationId: string;
  attemptId: string;
  stage: string;
  progressPercent?: number;
  detail?: string;
};

export type ControlAdapterResult = {
  operationId: string;
  attemptId: string;
  ok: boolean;
  output?: unknown;
  errorCode?: string;
  errorMessage?: string;
};

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const ownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const onlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every(key => allowed.includes(key));
const boundedText = (value: unknown, maximum: number) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value);
const allowedModels = new Set(['Eleven Multilingual v2', 'Eleven English v1', 'Eleven Turbo v2']);

/** Validate an untrusted local task file before exposing any operation to Cipher IPC. */
export function validateControlAdapterJob(raw: unknown): ControlAdapterJob {
  if (!ownRecord(raw) || !onlyKeys(raw, ['schemaVersion','operationId','attemptId','projectId','kind','name','sourceRelativePath','sourceAttemptId','text','settings']) ||
      raw.schemaVersion !== 1 || !isUuid(raw.operationId) || !isUuid(raw.attemptId) || !isUuid(raw.projectId) ||
      !['register-source','transcribe','rewrite','list-voices','generate-voice','build','export'].includes(String(raw.kind)))
    throw new Error('CONTROL_JOB_INVALID');
  const job = raw as unknown as ControlAdapterJob;
  if (job.name !== undefined && !boundedText(job.name, 80)) throw new Error('CONTROL_JOB_NAME_INVALID');
  if (job.text !== undefined && !boundedText(job.text, 60000)) throw new Error('CONTROL_JOB_TEXT_INVALID');
  if (job.sourceRelativePath !== undefined) {
    if (typeof job.sourceRelativePath !== 'string' || !job.sourceAttemptId || !isUuid(job.sourceAttemptId))
      throw new Error('CONTROL_SOURCE_PATH_INVALID');
    const filename = job.sourceRelativePath.split('/').at(-1) || '';
    if (!/^[^\\/:*?"<>|\x00-\x1f.][^\\/:*?"<>|\x00-\x1f]{0,219}\.[A-Za-z0-9]{2,8}$/.test(filename) ||
        job.sourceRelativePath !== `projects/${job.projectId}/source/attempts/${job.sourceAttemptId}/${filename}`)
      throw new Error('CONTROL_SOURCE_PATH_INVALID');
  }
  if (['register-source','transcribe','build'].includes(job.kind) && !job.sourceRelativePath)
    throw new Error('CONTROL_SOURCE_REQUIRED');
  if (job.settings !== undefined) {
    if (!ownRecord(job.settings) || !onlyKeys(job.settings, ['scriptText','weights','graphicsPercent','transitionsPercent','voice','sourceHasAudio','sourceDurationSeconds','voiceName']))
      throw new Error('CONTROL_SETTINGS_INVALID');
    const settings = job.settings as unknown as ControlAdapterSettings;
    if (settings.scriptText !== undefined && !boundedText(settings.scriptText, 4000)) throw new Error('CONTROL_SCRIPT_INVALID');
    if (settings.voiceName !== undefined && !boundedText(settings.voiceName, 120)) throw new Error('CONTROL_VOICE_NAME_INVALID');
    if (settings.sourceHasAudio !== undefined && typeof settings.sourceHasAudio !== 'boolean') throw new Error('CONTROL_SOURCE_AUDIO_INVALID');
    if (settings.sourceDurationSeconds !== undefined && (!Number.isFinite(settings.sourceDurationSeconds) || settings.sourceDurationSeconds <= 0 || settings.sourceDurationSeconds > 86400))
      throw new Error('CONTROL_SOURCE_DURATION_INVALID');
    if (settings.weights !== undefined && (!Array.isArray(settings.weights) || settings.weights.length !== 4 ||
        settings.weights.some(value => !Number.isInteger(value) || value < 0 || value > 100) || settings.weights.reduce((a, b) => a + b, 0) !== 100))
      throw new Error('CONTROL_MIX_INVALID');
    if (settings.graphicsPercent !== undefined && ![0,50,100].includes(settings.graphicsPercent)) throw new Error('CONTROL_GRAPHICS_INVALID');
    if (settings.transitionsPercent !== undefined && ![0,50,100].includes(settings.transitionsPercent)) throw new Error('CONTROL_TRANSITIONS_INVALID');
    if (settings.voice !== undefined) {
      if (!ownRecord(settings.voice) || !onlyKeys(settings.voice, ['mode','voiceId','voiceName','model','speed','stability','approvedAudioAttemptId']) ||
          !['original','elevenlabs'].includes(String(settings.voice.mode))) throw new Error('CONTROL_VOICE_INVALID');
      if (settings.voice.approvedAudioAttemptId !== undefined && !isUuid(settings.voice.approvedAudioAttemptId)) throw new Error('CONTROL_AUDIO_VERSION_INVALID');
      if (settings.voice.mode === 'elevenlabs' &&
          (typeof settings.voice.voiceId !== 'string' || !/^[A-Za-z0-9_-]{5,64}$/.test(settings.voice.voiceId) ||
           !allowedModels.has(String(settings.voice.model)) || !Number.isFinite(settings.voice.speed) || settings.voice.speed! < 0.7 || settings.voice.speed! > 1.2 ||
           !Number.isInteger(settings.voice.stability) || settings.voice.stability! < 0 || settings.voice.stability! > 100))
        throw new Error('CONTROL_VOICE_OPTIONS_INVALID');
    }
  }
  if (job.kind === 'rewrite' && !boundedText(job.text, 60000)) throw new Error('CONTROL_REWRITE_TEXT_REQUIRED');
  if (job.kind === 'generate-voice' && (!boundedText(job.text, 4000) || job.settings?.voice?.mode !== 'elevenlabs'))
    throw new Error('CONTROL_VOICE_TEXT_REQUIRED');
  if (job.kind === 'register-source' && !(Number(job.settings?.sourceDurationSeconds) > 0))
    throw new Error('CONTROL_SOURCE_DURATION_REQUIRED');
  if (job.kind === 'build' && (!job.settings?.scriptText || !job.settings.weights ||
      job.settings.graphicsPercent === undefined || job.settings.transitionsPercent === undefined || !job.settings.voice))
    throw new Error('CONTROL_BUILD_SETTINGS_REQUIRED');
  if (job.kind === 'build' && job.settings?.voice?.mode === 'original' && job.settings.sourceHasAudio !== true)
    throw new Error('SOURCE_AUDIO_UNAVAILABLE');
  return job;
}
