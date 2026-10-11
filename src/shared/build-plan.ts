// Contract shared by the renderer and the local execution engine. No provider secrets.
export const BUILD_FPS = 30;
export const MIN_CLIP_FRAMES = 2 * BUILD_FPS;
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
export type DirectionAttemptResult = 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export type DirectionOriginStatus = 'unrecorded' | 'pending' | 'partial' | 'recorded' | 'not-required';
export interface PlanDirectionAttempt {
  id: string;
  planId: string;
  planRevision: number;
  sceneIds: string[];
  providerId: string;
  requestedModelId: string;
  actualModelId?: string;
  providerRequestId?: string;
  providerResponseId?: string;
  startedAt: string;
  endedAt?: string;
  result: DirectionAttemptResult;
  error?: BuildIssue;
}
export interface SceneAttempt {
  stage: 'direction' | 'media'; startedAt: string; endedAt?: string;
  directionAttemptId?: string;
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
  schemaVersion: 1 | 2; id: string; revision: number; projectPath: string;
  inputHash: string; input: BuildInput; fps: number; totalFrames: number;
  stockFrames: number; createdAt: string; updatedAt: string;
  allocationMessage?: string;
  status: 'ready' | 'running' | 'paused' | 'incomplete' | 'complete';
  scenes: BuildScene[]; runId?: string; error?: BuildIssue;
  /** Optional to preserve legacy plans whose original provider/model were never recorded. */
  directionOriginStatus?: DirectionOriginStatus;
  directionAttempts?: PlanDirectionAttempt[];
}
export interface BuildSummary {
  id: string; projectPath: string; status: BuildPlan['status']; total: number;
  completed: number; stockSeconds: number; originalSeconds: number;
  requestedStockPercent: number; obtainedStockSeconds: number;
  allocationMessage?: string;
  directionOriginStatus: DirectionOriginStatus;
  directionAttempts: PlanDirectionAttempt[];
  pending: { id: string; category: SourceKind; error?: BuildIssue }[];
}

export interface BuildAllocationPreview {
  feasible: boolean;
  totalFrames: number;
  clipCount: number;
  stockFrames: number;
  originalFrames: number;
  stockClipCount: number;
  originalClipCount: number;
  requestedStockFrames: number;
  adjustmentMessage?: string;
  error?: string;
}

const formatSeconds = (frames: number) => `${(frames / BUILD_FPS).toFixed(2)} s`;

/** Chooses the closest time-based mix that can be divided into complete 2–3 s clips. */
export function previewAllocation(audioDuration: number, weights: number[]): BuildAllocationPreview {
  const totalFrames = Number.isFinite(audioDuration) ? Math.round(audioDuration * BUILD_FPS) : 0;
  const requestedStockFrames = Number.isFinite(weights?.[1])
    ? Math.round(totalFrames * weights[1] / 100) : 0;
  const noAllocation = (error: string): BuildAllocationPreview => ({
    feasible: false, totalFrames, clipCount: 0, stockFrames: 0, originalFrames: 0,
    stockClipCount: 0, originalClipCount: 0, requestedStockFrames, error,
  });

  if (totalFrames < MIN_CLIP_FRAMES) {
    return noAllocation(`El audio dura ${formatSeconds(totalFrames)}, menos del mínimo de 2.00 s. No se puede cubrir con un clip válido.`);
  }
  const clipCount = Math.ceil(totalFrames / MAX_CLIP_FRAMES);
  if (clipCount > Math.floor(totalFrames / MIN_CLIP_FRAMES)) {
    return noAllocation(`La duración total es ${formatSeconds(totalFrames)}. Un clip cubre como máximo 3.00 s y dos clips necesitan al menos 4.00 s; no hay reparto completo sin dejar un residuo.`);
  }

  const candidates: { stockFrames: number; stockClipCount: number; originalClipCount: number; distance: number; missingRequestedSource: number }[] = [];
  for (let stockClipCount = 0; stockClipCount <= clipCount; stockClipCount++) {
    const originalClipCount = clipCount - stockClipCount;
    const minStock = stockClipCount ? stockClipCount * MIN_CLIP_FRAMES : 0;
    const maxStock = stockClipCount ? stockClipCount * MAX_CLIP_FRAMES : 0;
    const minOriginal = originalClipCount ? originalClipCount * MIN_CLIP_FRAMES : 0;
    const maxOriginal = originalClipCount ? originalClipCount * MAX_CLIP_FRAMES : 0;
    const lower = Math.max(minStock, totalFrames - maxOriginal);
    const upper = Math.min(maxStock, totalFrames - minOriginal);
    if (lower > upper) continue;
    const stockFrames = Math.max(lower, Math.min(upper, requestedStockFrames));
    candidates.push({
      stockFrames, stockClipCount, originalClipCount,
      distance: Math.abs(stockFrames - requestedStockFrames),
      missingRequestedSource: Number(weights[1] > 0 && stockClipCount === 0) +
        Number(weights[0] > 0 && originalClipCount === 0),
    });
  }

  candidates.sort((a, b) => a.distance - b.distance ||
    a.missingRequestedSource - b.missingRequestedSource || a.stockFrames - b.stockFrames);
  const chosen = candidates[0];
  if (!chosen) return noAllocation(`La duración total de ${formatSeconds(totalFrames)} no se puede dividir en clips completos de 2–3 s.`);

  const originalFrames = totalFrames - chosen.stockFrames;
  const adjustmentMessage = chosen.stockFrames === requestedStockFrames ? undefined :
    `La mezcla solicitada es Stock ${formatSeconds(requestedStockFrames)} / Original ${formatSeconds(totalFrames - requestedStockFrames)} ` +
    `(${weights[1]} % / ${weights[0]} %), pero no permite clips completos de 2–3 s. ` +
    `El reparto viable más cercano es Stock ${formatSeconds(chosen.stockFrames)} / Original ${formatSeconds(originalFrames)} ` +
    `(${(chosen.stockFrames / totalFrames * 100).toFixed(0)} % / ${(originalFrames / totalFrames * 100).toFixed(0)} %). ` +
    `¿Quieres construir con este reparto?`;

  return {
    feasible: true, totalFrames, clipCount, stockFrames: chosen.stockFrames, originalFrames,
    stockClipCount: chosen.stockClipCount, originalClipCount: chosen.originalClipCount,
    requestedStockFrames, adjustmentMessage,
  };
}

function distributeFrames(total: number, count: number) {
  if (!count) return [];
  const base = Math.floor(total / count), remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + Number(index < remainder));
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
  const allocation = previewAllocation(input.audioDuration, input.weights);
  if (!allocation.feasible) throw new Error(allocation.error);
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
  const allocation = previewAllocation(input.audioDuration, input.weights);
  const stockDurations = distributeFrames(allocation.stockFrames, allocation.stockClipCount);
  const originalDurations = distributeFrames(allocation.originalFrames, allocation.originalClipCount);
  let stockIndex = 0, originalIndex = 0, cursor = 0, stockUsed = 0;
  const scenes: BuildScene[] = [];
  while (stockIndex < stockDurations.length || originalIndex < originalDurations.length) {
    const hasStock = stockIndex < stockDurations.length;
    const hasOriginal = originalIndex < originalDurations.length;
    let stock = hasStock;
    if (hasStock && hasOriginal) {
      const stockFrames = stockDurations[stockIndex];
      const originalFrames = originalDurations[originalIndex];
      const stockError = Math.abs(stockUsed + stockFrames -
        (cursor + stockFrames) * allocation.stockFrames / totalFrames);
      const originalError = Math.abs(stockUsed -
        (cursor + originalFrames) * allocation.stockFrames / totalFrames);
      stock = stockError <= originalError;
    }
    const category = stock ? 'stock' : 'original';
    const frames = stock ? stockDurations[stockIndex++] : originalDurations[originalIndex++];
    const seconds = cursor / BUILD_FPS;
    let phraseIndex = 0;
    for (let j = 0; j < input.segments.length; j++) {
      if (input.segments[j].start <= seconds) phraseIndex = j;
    }
    scenes.push({
      id: `${id}-s${String(scenes.length + 1).padStart(5, '0')}`,
      phraseIndex, text: input.segments[phraseIndex].text,
      startFrame: cursor, frames, category,
      sourceStart: seconds, status: 'pending', attempts: [], rejectedCandidates: [],
    });
    if (stock) stockUsed += frames;
    cursor += frames;
  }
  const now = new Date().toISOString();
  const plan: BuildPlan = { schemaVersion: 2, id, revision, projectPath: input.projectPath,
    inputHash, input, fps: BUILD_FPS, totalFrames, stockFrames: allocation.stockFrames,
    allocationMessage: allocation.adjustmentMessage,
    createdAt: now, updatedAt: now, status: 'ready', scenes,
    directionOriginStatus: 'pending', directionAttempts: [] };
  validatePlan(plan);
  return plan;
}

export function validatePlan(plan: BuildPlan) {
  validateInput(plan.input);
  if (!/^[a-zA-Z0-9-]+$/.test(plan.id) || plan.projectPath !== plan.input.projectPath)
    throw new Error('La identidad del plan o del proyecto es inválida.');
  const allocation = plan.schemaVersion === 2
    ? previewAllocation(plan.totalFrames / BUILD_FPS, plan.input.weights) : null;
  if (![1, 2].includes(plan.schemaVersion) || plan.fps !== BUILD_FPS || !Number.isInteger(plan.totalFrames) ||
      plan.totalFrames !== Math.round(plan.input.audioDuration * BUILD_FPS) ||
      (plan.schemaVersion === 1 && plan.stockFrames !== Math.round(plan.totalFrames * plan.input.weights[1] / 100)) ||
      (plan.schemaVersion === 2 && (!allocation?.feasible || plan.stockFrames !== allocation.stockFrames ||
        plan.scenes.length !== allocation.clipCount)))
    throw new Error('Versión o reloj del plan inválidos.');
  const ids = new Set<string>(); let end = 0, stock = 0;
  for (const scene of plan.scenes) {
    if (!scene.id.startsWith(`${plan.id}-s`) || !/^[a-zA-Z0-9-]+$/.test(scene.id) || ids.has(scene.id) || !Number.isInteger(scene.frames) ||
        scene.frames < (plan.schemaVersion === 2 ? MIN_CLIP_FRAMES : 1) ||
        scene.frames > MAX_CLIP_FRAMES || scene.startFrame !== end ||
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
  if (plan.directionOriginStatus !== undefined &&
      !['unrecorded', 'pending', 'partial', 'recorded', 'not-required'].includes(plan.directionOriginStatus))
    throw new Error('El estado del origen editorial no es válido.');
  if (plan.directionAttempts !== undefined) {
    if (!Array.isArray(plan.directionAttempts)) throw new Error('El registro de dirección del plan es inválido.');
    const attemptIds = new Set<string>();
    for (const attempt of plan.directionAttempts) {
      if (!attempt || !/^[a-zA-Z0-9-]+$/.test(attempt.id) || attemptIds.has(attempt.id) ||
          attempt.planId !== plan.id || attempt.planRevision !== plan.revision ||
          !Array.isArray(attempt.sceneIds) || !attempt.sceneIds.length ||
          attempt.sceneIds.some(id => !ids.has(id)) || typeof attempt.providerId !== 'string' || !attempt.providerId ||
          typeof attempt.requestedModelId !== 'string' || !attempt.requestedModelId ||
          !Number.isFinite(Date.parse(attempt.startedAt)) ||
          !['running', 'completed', 'failed', 'cancelled', 'interrupted'].includes(attempt.result) ||
          (attempt.result !== 'running' && !attempt.endedAt) ||
          (attempt.endedAt !== undefined && !Number.isFinite(Date.parse(attempt.endedAt))))
        throw new Error('Un intento de dirección no coincide con el plan o su revisión.');
      attemptIds.add(attempt.id);
    }
    for (const scene of plan.scenes) for (const sceneAttempt of scene.attempts) {
      if (sceneAttempt.directionAttemptId && !attemptIds.has(sceneAttempt.directionAttemptId))
        throw new Error('Una escena referencia un intento de dirección ausente.');
    }
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
    allocationMessage: plan.allocationMessage,
    directionOriginStatus: plan.directionOriginStatus || 'unrecorded',
    directionAttempts: plan.directionAttempts || [],
    pending: plan.scenes.filter(s => s.status !== 'complete').map(s =>
      ({ id: s.id, category: s.category, error: s.error })),
  };
}
