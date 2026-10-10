// Contract shared by the renderer and the local execution engine. No provider secrets.
export const BUILD_FPS = 30;
export const MAX_CLIP_FRAMES = 3 * BUILD_FPS;
export type SourceKind = 'original' | 'stock';
export type SceneStatus = 'pending' | 'running' | 'complete' | 'failed' | 'blocked';
export interface BuildInput {
  projectPath: string;
  scriptText: string;
  audioPath: string;
  audioDuration: number;
  videoPath: string;
  weights: number[]; // Original, Stock, IA — screen time, not clip count
  aspectRatio: string;
  segments: { start: number; end: number; text: string }[];
  originalAudio: boolean;
}
export interface BuildIssue { code: string; message: string; retryable: boolean }
export interface SceneAttempt {
  stage: 'direction' | 'media'; startedAt: string; endedAt?: string;
  error?: BuildIssue; candidate?: string;
}
export interface SceneResult {
  path: string; sha256: string; frames: number; duration: number;
  sourcePath: string; sourceStart: number; provider: string; candidate?: string;
}
export interface BuildScene {
  id: string; phraseIndex: number; text: string;
  startFrame: number; frames: number; category: SourceKind;
  keyword?: string; sourceStart: number;
  status: SceneStatus; attempts: SceneAttempt[]; rejectedCandidates: string[];
  error?: BuildIssue; result?: SceneResult;
}
export interface BuildPlan {
  schemaVersion: 1; id: string; revision: number; projectPath: string;
  inputHash: string; input: BuildInput; fps: number; totalFrames: number;
  stockFrames: number; createdAt: string; updatedAt: string;
  status: 'ready' | 'running' | 'paused' | 'incomplete' | 'complete';
  scenes: BuildScene[]; runId?: string; error?: BuildIssue;
}
export interface BuildSummary {
  id: string; projectPath: string; status: BuildPlan['status']; total: number;
  completed: number; stockSeconds: number; originalSeconds: number;
  requestedStockPercent: number; obtainedStockSeconds: number;
  pending: { id: string; category: SourceKind; error?: BuildIssue }[];
}

export function validateInput(input: BuildInput) {
  if (!input.projectPath || !input.scriptText?.trim() || !input.audioPath)
    throw new Error('Selecciona proyecto, guion y audio principal.');
  if (!Number.isFinite(input.audioDuration) || input.audioDuration < 1 / BUILD_FPS)
    throw new Error('La duración del audio no es válida.');
  if (!['9:16', '16:9', '1:1', 'vertical', 'horizontal', 'square'].includes(input.aspectRatio))
    throw new Error('Formato no compatible.');
  if (!Array.isArray(input.weights) || input.weights.length !== 3 ||
      input.weights.some(w => !Number.isFinite(w) || w < 0 || w > 100) ||
      Math.abs(input.weights.reduce((a, b) => a + b, 0) - 100) > 0.0001)
    throw new Error('Original, Stock e IA deben sumar 100 %.');
  if (input.weights[2] !== 0) throw new Error('Esta entrega admite Original y Stock. Pon IA en 0 %.');
  if (input.weights[0] > 0 && !input.videoPath) throw new Error('Falta el vídeo original.');
  if (!input.segments?.length || input.segments.some(s =>
    !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end <= s.start))
    throw new Error('Transcribe el audio principal antes de construir.');
  for (let i = 1; i < input.segments.length; i++) {
    if (input.segments[i].start < input.segments[i - 1].start)
      throw new Error('Los segmentos de transcripción no están ordenados.');
  }
  if (input.audioDuration - input.segments[input.segments.length - 1].end > 10)
    throw new Error('La transcripción no cubre el audio. Vuelve a transcribir.');
}

export function createPlan(input: BuildInput, id: string, inputHash: string, revision: number): BuildPlan {
  validateInput(input);
  const totalFrames = Math.round(input.audioDuration * BUILD_FPS);
  const stockFrames = Math.round(totalFrames * input.weights[1] / 100);
  let stockLeft = stockFrames, originalLeft = totalFrames - stockFrames;
  let cursor = 0, stockUsed = 0;
  const scenes: BuildScene[] = [];
  // Phrase boundaries remain visible in the plan. Silence belongs to the nearest
  // preceding phrase, with an explicit clip rather than a stretched final frame.
  const boundaries = [...new Set([0, totalFrames, ...input.segments.flatMap(s =>
    [Math.round(s.start * BUILD_FPS), Math.round(s.end * BUILD_FPS)])])]
    .filter(n => n >= 0 && n <= totalFrames).sort((a, b) => a - b);
  for (let i = 1; i < boundaries.length; i++) {
    while (cursor < boundaries[i]) {
      const size = Math.min(MAX_CLIP_FRAMES, boundaries[i] - cursor);
      const target = (cursor + size) * stockFrames / totalFrames;
      const stock = stockLeft > 0 && (originalLeft === 0 ||
        Math.abs(stockUsed + size - target) <= Math.abs(stockUsed - target));
      const frames = Math.min(size, stock ? stockLeft : originalLeft);
      const seconds = cursor / BUILD_FPS;
      let phraseIndex = 0;
      for (let j = 0; j < input.segments.length; j++) {
        if (input.segments[j].start <= seconds) phraseIndex = j;
      }
      scenes.push({
        id: `${id}-s${String(scenes.length + 1).padStart(5, '0')}`,
        phraseIndex, text: input.segments[phraseIndex].text,
        startFrame: cursor, frames, category: stock ? 'stock' : 'original',
        sourceStart: seconds, status: 'pending', attempts: [], rejectedCandidates: [],
      });
      if (stock) { stockLeft -= frames; stockUsed += frames; } else originalLeft -= frames;
      cursor += frames;
    }
  }
  const now = new Date().toISOString();
  const plan: BuildPlan = { schemaVersion: 1, id, revision, projectPath: input.projectPath,
    inputHash, input, fps: BUILD_FPS, totalFrames, stockFrames,
    createdAt: now, updatedAt: now, status: 'ready', scenes };
  validatePlan(plan);
  return plan;
}

export function validatePlan(plan: BuildPlan) {
  validateInput(plan.input);
  if (!/^[a-zA-Z0-9-]+$/.test(plan.id) || plan.projectPath !== plan.input.projectPath)
    throw new Error('La identidad del plan o del proyecto es inválida.');
  if (plan.schemaVersion !== 1 || plan.fps !== BUILD_FPS || !Number.isInteger(plan.totalFrames) ||
      plan.totalFrames !== Math.round(plan.input.audioDuration * BUILD_FPS) ||
      plan.stockFrames !== Math.round(plan.totalFrames * plan.input.weights[1] / 100))
    throw new Error('Versión o reloj del plan inválidos.');
  const ids = new Set<string>(); let end = 0, stock = 0;
  for (const scene of plan.scenes) {
    if (!scene.id.startsWith(`${plan.id}-s`) || !/^[a-zA-Z0-9-]+$/.test(scene.id) || ids.has(scene.id) || !Number.isInteger(scene.frames) ||
        scene.frames <= 0 || scene.frames > MAX_CLIP_FRAMES || scene.startFrame !== end ||
        !['stock', 'original'].includes(scene.category) ||
        !Number.isInteger(scene.phraseIndex) || !plan.input.segments[scene.phraseIndex] ||
        !Number.isFinite(scene.sourceStart) || scene.sourceStart < 0)
      throw new Error('Plan inválido: identidad, duración, fuente o cobertura.');
    ids.add(scene.id); end += scene.frames;
    if (scene.category === 'stock') stock += scene.frames;
    if (scene.status === 'complete' && (!scene.result || scene.result.frames !== scene.frames ||
        Math.abs(scene.result.duration - scene.frames / plan.fps) > 0.001))
      throw new Error('Un resultado completo no coincide con el plan.');
  }
  if (!plan.scenes.length || end !== plan.totalFrames || stock !== plan.stockFrames)
    throw new Error('El plan no cubre la duración o la mezcla solicitada.');
  if (plan.status === 'complete' && plan.scenes.some(s => s.status !== 'complete'))
    throw new Error('El proyecto tiene escenas pendientes.');
}

export function summarize(plan: BuildPlan): BuildSummary {
  return { id: plan.id, projectPath: plan.projectPath, status: plan.status,
    total: plan.scenes.length, completed: plan.scenes.filter(s => s.status === 'complete').length,
    stockSeconds: plan.stockFrames / plan.fps,
    originalSeconds: (plan.totalFrames - plan.stockFrames) / plan.fps,
    requestedStockPercent: plan.input.weights[1],
    obtainedStockSeconds: plan.scenes.filter(s => s.category === 'stock' && s.status === 'complete')
      .reduce((sum, s) => sum + s.frames / plan.fps, 0),
    pending: plan.scenes.filter(s => s.status !== 'complete').map(s =>
      ({ id: s.id, category: s.category, error: s.error })),
  };
}
