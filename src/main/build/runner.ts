import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { BuildInput, BuildIssue, BuildPlan, SceneResult } from '../../shared/build-plan';
import { createPlan, MIN_CLIP_FRAMES, summarize, validateInput, validatePlan } from '../../shared/build-plan';
import { atomicJson, loadPlan, savePlan, claimProject, projectBusy } from './storage';
import { BuildFailure, command, sha256, validateMedia, withTimeout, probe } from './media';
import { directScenes, prepareScene } from './providers';

type Run = { id: string; controller: AbortController };
const activeRuns = new Map<string, Run>();
const MAX_ATTEMPTS = 6;
type Dependencies = {
  direct: typeof directScenes;
  prepare: typeof prepareScene;
  validate: typeof validateMedia;
  fingerprint: (input: BuildInput, signal?: AbortSignal) => Promise<string>;
};

export async function fingerprint(input: BuildInput, signal?: AbortSignal) {
  validateInput(input);
  const audio = Number((await command('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', input.audioPath], signal)).trim());
  if (!Number.isFinite(audio) || Math.abs(audio - input.audioDuration) > 1 / 30)
    throw new BuildFailure('AUDIO_CHANGED', 'La duración del audio en disco difiere de la timeline. Vuelve a cargarlo.');
  const files = { audio: await sha256(input.audioPath, signal),
    original: input.weights[0] > 0 ? await sha256(input.videoPath, signal) : null };
  return createHash('sha256').update(JSON.stringify({ input, files })).digest('hex');
}

function issue(error: unknown): BuildIssue {
  if (error instanceof BuildFailure) return { code: error.code, message: error.message, retryable: error.retryable };
  return { code: 'BUILD_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false };
}

export class BuildRunner {
  deps: Dependencies;
  constructor(deps: Partial<Dependencies> = {}) {
    this.deps = { direct: directScenes, prepare: prepareScene, validate: validateMedia, fingerprint, ...deps };
  }
  cancel(project: string) {
    activeRuns.get(path.resolve(project))?.controller.abort(new Error('Construcción cancelada. Puedes continuar.'));
  }
  cancelAll() { for (const run of activeRuns.values()) run.controller.abort(new Error('Se cerró la aplicación.')); }
  isRunning(project: string) { return activeRuns.has(path.resolve(project)); }
  hasActiveRuns() { return activeRuns.size > 0; }
  async inspect(project: string) {
    let plan = await loadPlan(project);
    if (!plan) return null;
    if (!activeRuns.has(path.resolve(project)) && !(await projectBusy(project)) && plan.status === 'running') {
      // Acquire a claim and reread: the running build may have completed between
      // the first read and the busy check. Never overwrite that newer checkpoint.
      let release: (() => Promise<void>) | undefined;
      try {
        release = await claimProject(project);
        plan = await loadPlan(project);
        if (!plan) return null;
        if (plan.status === 'running') {
          plan.status = 'paused'; delete plan.runId;
          for (const s of plan.scenes) if (s.status === 'running') {
            s.status = 'pending';
            s.error = { code: 'INTERRUPTED', message: 'La ejecución anterior se interrumpió. Puedes continuar.', retryable: true };
            const attempt = s.attempts[s.attempts.length - 1];
            if (attempt && !attempt.endedAt) { attempt.endedAt = new Date().toISOString(); attempt.error = s.error; }
          }
          await savePlan(plan);
        }
      } finally { await release?.(); }
    }
    return summarize(plan);
  }

  async run(input: BuildInput, mode: 'new' | 'continue', expectedPlanId: string | null,
    onProgress: (value: ReturnType<typeof summarize> & { runId: string; paragraph: string; type: string; index: number }) => void) {
    validateInput(input);
    const project = path.resolve(input.projectPath);
    if (activeRuns.has(project)) throw new BuildFailure('BUSY', 'Este proyecto ya tiene una construcción activa.');
    const run: Run = { id: randomUUID(), controller: new AbortController() };
    activeRuns.set(project, run); // reserve synchronously, before any I/O
    const signal = run.controller.signal;
    let plan: BuildPlan | null = null;
    let release: (() => Promise<void>) | undefined;
    const check = () => {
      signal.throwIfAborted();
      if (activeRuns.get(project) !== run) throw new Error('La ejecución dejó de estar vigente.');
    };
    const report = (paragraph: string, type: string) => {
      if (!plan) return;
      const summary = summarize(plan);
      onProgress({ ...summary, runId: run.id, paragraph, type, index: summary.completed - 1 });
    };
    const persist = async () => { if (plan) await savePlan(plan); };
    try {
      release = await claimProject(project); check();
      plan = await loadPlan(project); check();
      if ((plan?.id || null) !== expectedPlanId)
        throw new BuildFailure('STALE_PLAN', 'El plan cambió. Actualiza el estado antes de construir.');
      const inputHash = await this.deps.fingerprint(input, signal); check();
      const sourceDuration = input.weights[0] > 0 ? (await probe(input.videoPath, signal)).duration : 0;
      if (mode === 'continue') {
        if (!plan) throw new BuildFailure('NO_PLAN', 'No hay un plan guardado para continuar.');
        if (plan.inputHash !== inputHash)
          throw new BuildFailure('INPUT_CHANGED', 'Cambió el guion, audio, fuente, formato o mezcla. Recupera esos ajustes o pulsa Nuevo plan.');
        if (plan.schemaVersion === 1 && plan.status !== 'complete')
          throw new BuildFailure('LEGACY_DURATION_RULE', 'Este plan incompleto usa la regla anterior de duración. Conserva sus archivos y crea un plan nuevo de 2–3 s.');
      } else {
        if (plan) await atomicJson(path.join(project, 'build', 'history', `${plan.id}.json`), plan);
        const revision = (plan?.revision || 0) + 1;
        plan = createPlan(input, randomUUID(), inputHash, revision);
      }
      const current = plan!;
      for (const scene of current.scenes.filter(s => s.category === 'original')) {
        if (scene.frames / current.fps > sourceDuration + 0.000001)
          throw new BuildFailure('SOURCE_INTERVAL', 'El original es más corto que un fragmento solicitado. Usa otra fuente.');
        scene.sourceStart = Math.min(scene.sourceStart, Math.max(0, sourceDuration - scene.frames / current.fps));
      }
      current.status = 'running'; current.runId = run.id; delete current.error;
      await persist(); check();

      // Reopening trusts neither status flags nor file existence alone.
      for (const scene of current.scenes) {
        check();
        if (scene.status === 'complete' && scene.result) {
          try { await this.deps.validate(scene.result.path, scene.frames, signal, scene.result.sha256,
            current.schemaVersion === 1 ? 1 : MIN_CLIP_FRAMES); }
          catch (e) { check(); scene.status = 'pending'; scene.error = issue(e); delete scene.result; }
        } else if (scene.status === 'running') {
          scene.status = 'pending';
          const attempt = scene.attempts[scene.attempts.length - 1];
          if (attempt && !attempt.endedAt) attempt.endedAt = new Date().toISOString();
        }
      }
      await persist();
      if (current.schemaVersion === 1 && current.scenes.some(scene => scene.status !== 'complete'))
        throw new BuildFailure('LEGACY_DURATION_RULE', 'El plan anterior tiene medios pendientes o inválidos. Se conservaron los archivos; crea un plan nuevo de 2–3 s.');
      const needsDirection = current.scenes.filter(s => s.status !== 'complete' &&
        (s.category === 'stock' || !input.originalAudio) && !s.keyword);
      for (let offset = 0; offset < needsDirection.length; offset += 20) {
        check();
        const batch = needsDirection.slice(offset, offset + 20).filter(s =>
          s.attempts.filter(a => a.stage === 'direction').length < MAX_ATTEMPTS);
        if (!batch.length) continue;
        for (let attempt = 0; attempt < 2; attempt++) {
          check();
          for (const scene of batch) {
            scene.status = 'running';
            scene.attempts.push({ stage: 'direction', startedAt: new Date().toISOString() });
          }
          await persist(); report('Preparando búsquedas y fragmentos', 'Planificación');
          try {
            const decisions = await this.deps.direct(batch, input, signal); check();
            for (const decision of decisions) {
              const scene = batch.find(s => s.id === decision.id);
              if (!scene) throw new BuildFailure('PLAN_RESPONSE', 'El director devolvió un ID ajeno al plan.');
              scene.keyword = decision.keyword;
              if (!input.originalAudio && scene.category === 'original')
                scene.sourceStart = Math.min(decision.sourceStart, Math.max(0, sourceDuration - scene.frames / current.fps));
            }
            if (batch.some(s => !s.keyword)) throw new BuildFailure('PLAN_RESPONSE', 'Faltan decisiones del director.', true);
            for (const scene of batch) {
              scene.status = 'pending'; delete scene.error;
              scene.attempts[scene.attempts.length - 1].endedAt = new Date().toISOString();
            }
            await persist(); break;
          } catch (error) {
            check(); const failure = issue(error);
            for (const scene of batch) {
              scene.status = failure.retryable ? 'failed' : 'blocked'; scene.error = failure;
              Object.assign(scene.attempts[scene.attempts.length - 1], { endedAt: new Date().toISOString(), error: failure });
            }
            await persist();
            if (!failure.retryable || batch.some(s => s.attempts.filter(a => a.stage === 'direction').length >= MAX_ATTEMPTS)) break;
          }
        }
      }

      // Bounded sequential execution first. Parallel workers are a later measured
      // optimization; this preserves deterministic checkpoints and avoids nested retries.
      for (const scene of current.scenes) {
        check();
        if (scene.status === 'complete') continue;
        if ((scene.category === 'stock' || !input.originalAudio) && !scene.keyword) {
          scene.status = 'blocked'; scene.error ||= { code: 'DIRECTION_LIMIT', message: 'No se pudo completar la dirección. Revisa la conexión o crea otro plan.', retryable: false };
          await persist(); continue;
        }
        const prior = scene.attempts.filter(a => a.stage === 'media').length;
        if (prior >= MAX_ATTEMPTS) {
          scene.status = 'blocked'; scene.error = { code: 'ATTEMPT_LIMIT', message: 'Se alcanzó el límite de intentos de esta escena. Revisa la causa antes de crear otro plan.', retryable: false };
          await persist(); continue;
        }
        scene.status = 'running'; delete scene.error;
        scene.attempts.push({ stage: 'media', startedAt: new Date().toISOString() });
        await persist(); check(); report(`Preparando ${scene.category}: ${scene.text}`, 'Medios');
        const output = path.join(project, 'materiales', 'builds', current.id, `${scene.id}.mp4`);
        const sceneSignal = withTimeout(signal, 180_000);
        try {
          const result: SceneResult = await this.deps.prepare(scene, input, output, sceneSignal, async (id, reason) => {
            check(); scene.rejectedCandidates.push(id);
            scene.attempts.push({ stage: 'media', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
              candidate: id, error: { code: reason, message: 'Candidato descartado.', retryable: true } });
            await persist();
          });
          check();
          const verified = await this.deps.validate(result.path, scene.frames, signal, result.sha256); check();
          scene.result = { ...result, ...verified }; scene.status = 'complete';
          delete scene.error;
        } catch (error) {
          check(); scene.error = issue(error); scene.status = scene.error.retryable ? 'failed' : 'blocked';
        } finally { sceneSignal.dispose(); }
        const activeAttempt = [...scene.attempts].reverse().find(a => !a.endedAt);
        if (activeAttempt) { activeAttempt.endedAt = new Date().toISOString(); activeAttempt.error = scene.error; }
        await persist(); report('Avance guardado', 'Medios');
      }
      check();
      if (await this.deps.fingerprint(input, signal) !== current.inputHash)
        throw new BuildFailure('INPUT_CHANGED', 'Los archivos fuente cambiaron durante la ejecución. Conservamos los resultados, pero necesitas un nuevo plan.');
      current.status = current.scenes.every(s => s.status === 'complete') ? 'complete' : 'incomplete';
      delete current.runId;
      await persist();
      return { success: current.status === 'complete', summary: summarize(current),
        clips: this.clips(current), error: current.status === 'complete' ? undefined : 'Hay escenas pendientes. El avance está guardado; puedes continuar.' };
    } catch (error) {
      // A stale request must not rewrite the newer plan it failed to acquire.
      if (plan?.runId === run.id) {
        plan.status = signal.aborted ? 'paused' : 'incomplete'; plan.error = issue(error);
        delete plan.runId;
        for (const scene of plan.scenes) if (scene.status === 'running') {
          scene.status = 'pending';
          const attempt = [...scene.attempts].reverse().find(a => !a.endedAt);
          if (attempt) { attempt.endedAt = new Date().toISOString(); attempt.error = issue(error); }
        }
        await persist();
        return { success: false, summary: summarize(plan), clips: this.clips(plan), error: (error as Error).message };
      }
      throw error;
    } finally {
      run.controller.abort(new Error('Ejecución finalizada.'));
      try { await release?.(); } finally { if (activeRuns.get(project) === run) activeRuns.delete(project); }
    }
  }

  clips(plan: BuildPlan) {
    return plan.scenes.filter(s => s.status === 'complete' && s.result).map(s => ({
      id: s.id, buildPlanId: plan.id, name: `${s.category} ${s.id.slice(-6)}`,
      path: s.result!.path, url: pathToFileURL(s.result!.path).href, type: 'video', category: s.category,
      phraseIdx: s.phraseIndex, startSeconds: s.startFrame / plan.fps, durationSeconds: s.frames / plan.fps,
    }));
  }

  async validateExport(project: string, clips: any[]) {
    const generated = clips.filter(c => c.buildPlanId);
    if (!generated.length) return;
    if (new Set(generated.map(c => c.buildPlanId)).size !== 1 ||
        clips.some(c => c.type !== 'audio' && c.type !== 'graphic' && !c.buildPlanId))
      throw new Error('El montaje mezcla planes o contiene vídeos fuera del plan validado.');
    let plan = await loadPlan(project);
    if (plan?.id !== generated[0].buildPlanId) plan = await loadPlan(project, generated[0].buildPlanId);
    if (!plan || plan.status !== 'complete') throw new Error('La construcción está incompleta. Continúa antes de exportar.');
    validatePlan(plan);
    let cursor = 0;
    for (const clip of [...generated].sort((a, b) => a.startSeconds - b.startSeconds)) {
      if (!Number.isFinite(clip.startSeconds) || !Number.isFinite(clip.durationSeconds) ||
          Math.abs(clip.startSeconds * plan.fps - cursor) > 0.00001)
        throw new Error('El montaje tiene huecos o solapamientos. Recoloca los clips antes de exportar.');
      cursor += Math.round(clip.durationSeconds * plan.fps);
    }
    if (cursor !== plan.totalFrames) throw new Error('El montaje no cubre la duración del proyecto.');
    if (generated.length !== plan.scenes.length || new Set(generated.map(c => c.id)).size !== plan.scenes.length)
      throw new Error('El montaje no contiene todas las escenas del plan.');
    for (const scene of plan.scenes) {
      const clip = generated.find(c => c.id === scene.id);
      if (!clip || clip.buildPlanId !== plan.id || clip.path !== scene.result?.path ||
          clip.category !== scene.category ||
          (clip.segmentStartOffset || 0) !== 0 ||
          Math.abs(clip.durationSeconds - scene.frames / plan.fps) > 0.000001)
        throw new Error('El montaje fue modificado y ya no coincide con el plan. Reconstruye o restaura su versión antes de exportar.');
      await this.deps.validate(scene.result!.path, scene.frames, undefined, scene.result!.sha256,
        plan.schemaVersion === 1 ? 1 : MIN_CLIP_FRAMES);
    }
  }
}
