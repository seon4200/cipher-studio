import { runCommonMediaQueue, requiredMediaPending } from '../../shared/build-integrity';
import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { colocarYFiltrarTarjetas } from '../../shared/exclusion';
import { assignCipherTransitions, CIPHER_DEFAULT_TRANSITIONS } from '../../shared/transitions';
import { createTimedScriptSegments } from '../../shared/build-planning';
import type { ControlAdapterJob, ControlAdapterProgress } from '../../shared/control-adapter';

const api = (window as any).electronAPI;
const clamp = (value: unknown, low: number, high: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low;
const safeFailure = (error: unknown) => {
  const raw = error instanceof Error ? error.message : 'CIPHER_OPERATION_FAILED';
  const code = raw.split(/[\s:]/, 1)[0].replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'CIPHER_OPERATION_FAILED';
  return { code, message: `Cipher no pudo completar esta operación (${code}).` };
};

function emit(job: ControlAdapterJob, stage: string, progressPercent?: number) {
  const message: ControlAdapterProgress = {
    operationId: job.operationId,
    attemptId: job.attemptId,
    stage,
    ...(progressPercent !== undefined ? { progressPercent } : {}),
  };
  api.reportControlProgress(message);
}

function audioClip(job: ControlAdapterJob, state: any, sourcePath: string) {
  const voice = job.settings?.voice ?? { mode: 'original' as const };
  if (voice.mode === 'none') return null;
  if (voice.mode === 'original') {
    if (job.settings?.sourceHasAudio !== true) throw new Error('SOURCE_AUDIO_UNAVAILABLE');
    const source = state.clips?.find((clip: any) => clip.type === 'video' && clip.path === sourcePath);
    return {
      id: `control-audio-${job.projectId}`,
      name: 'Voz - Audio Original',
      narration: true, audioProvenance: { origin: 'original', sourcePath }, narrationSegments: state.transcriptSegments,
      startSeconds: 0,
      durationSeconds: Number(source?.durationSeconds) || 0,
      type: 'audio',
      path: sourcePath,
    };
  }
  const voiceVersion = [...(state.generatedVoices || [])].reverse().find((voiceItem: any) =>
    voiceItem?.controlAttemptId === job.settings?.voice?.approvedAudioAttemptId);
  const audioPath = voiceVersion?.filePath || (job.settings?.voice?.approvedAudioAttemptId ? '' : state.controlGeneratedVoicePath);
  if (!audioPath) throw new Error('APPROVED_VOICE_AUDIO_UNAVAILABLE');
  return {
    id: voiceVersion?.id || `control-voice-${job.projectId}`,
    name: `Voz - ${voiceVersion?.speaker || voice.voiceName || 'ElevenLabs'}`,
    startSeconds: 0,
    durationSeconds: Number(voiceVersion?.durationSeconds) || 0,
    type: 'audio',
    path: audioPath,
    narration: true, audioProvenance: { origin: 'generated', voiceId: voiceVersion?.id }, narrationSegments: voiceVersion?.segments || [],
    segments: voiceVersion?.segments || [],
  };
}

async function save(state: any) {
  const result = await api.saveProjectState(state);
  if (!result?.success) throw new Error(result?.error || 'PROJECT_STATE_SAVE_FAILED');
}

async function transcribe(job: ControlAdapterJob, sourcePath: string, state: any) {
  if (!sourcePath) throw new Error('SOURCE_FILE_UNAVAILABLE');
  emit(job, 'Transcribiendo con Whisper local');
  const segments = await new Promise<any[]>((resolve, reject) => {
    let settled = false;
    const stop = api.onTranscriptionUpdate((_event: any, event: any) => {
      if (event?.status === 'success' && Array.isArray(event?.result?.segments)) {
        settled = true; stop(); resolve(event.result.segments);
      } else if (event?.status === 'error') {
        settled = true; stop(); reject(new Error(String(event.error || 'WHISPER_FAILED')));
      }
    });
    api.startTranscription(sourcePath);
    window.setTimeout(() => {
      if (!settled) { stop(); reject(new Error('WHISPER_TIMEOUT')); }
    }, 2 * 60 * 60 * 1000);
  });
  const transcriptText = segments.map(segment => String(segment.text || '').trim()).filter(Boolean).join(' ').trim();
  if (!transcriptText) throw new Error('EMPTY_TRANSCRIPT');
  await save({ ...state, controlTranscriptAttemptId: job.attemptId, transcriptSegments: segments, originalTranscriptText: transcriptText,
    transcriptionStatus: 'Transcripción completada', aiScript: transcriptText });
  return { transcriptText, segments };
}

async function run(job: ControlAdapterJob, sourcePath: string, projectPath: string) {
  const loaded = await api.loadProjectState();
  if (!loaded?.success || !loaded.data) throw new Error('CIPHER_PROJECT_STATE_UNAVAILABLE');
  let state = loaded.data;
  if (job.kind === 'register-source') {
    if (!sourcePath) throw new Error('SOURCE_FILE_UNAVAILABLE');
    const fileName = sourcePath.split(/[\\/]/).at(-1) || 'original.mp4';
    const durationSeconds = Number(job.settings?.sourceDurationSeconds) || 0;
    if (!(durationSeconds > 0)) throw new Error('SOURCE_DURATION_UNAVAILABLE');
    const original = { id: `control-source-${job.projectId}`, name: fileName, duration: '',
      durationSeconds, type: 'video', path: sourcePath, size: '', category: 'original' };
    state = { ...state, id: job.projectId, name: job.name || state.name || 'Cipher Control',
      clips: [original], timelineVideoClips: [], transcriptSegments: [], originalTranscriptText: '', aiScript: '' };
    await save(state);
    emit(job, 'Original asociado al proyecto local');
    return { localProjectKey: job.projectId, sourceRegistered: true, fileName, durationSeconds };
  }
  if (job.kind === 'transcribe') return transcribe(job, sourcePath, state);
  if (job.kind === 'rewrite') {
    const text = String(job.text || '').trim();
    if (!text || text.length > 60000) throw new Error('INVALID_REWRITE_TEXT');
    emit(job, 'Reescribiendo con la integración existente de Cipher');
    const result = await api.rewriteTranscript(text);
    if (!result?.success || typeof result.data !== 'string' || !result.data.trim())
      throw new Error(String(result?.error || 'REWRITE_FAILED'));
    const scriptText = result.data.trim();
    state = { ...state, controlScriptResults: [...(state.controlScriptResults || []), { attemptId: job.attemptId, text: scriptText }] };
    await save(state);
    return { scriptText };
  }
  if (job.kind === 'list-voices') {
    emit(job, 'Consultando voces disponibles en ElevenLabs');
    const result = await api.getElevenLabsVoices();
    if (!result?.success || !Array.isArray(result.voices)) throw new Error('VOICE_LIST_FAILED');
    return { voices: result.voices.filter((voice: any) => typeof voice?.voice_id === 'string' && voice.voice_id)
      .map((voice: any) => ({ id: voice.voice_id, name: String(voice.name || voice.voice_id), category: String(voice.category || '') })) };
  }
  if (job.kind === 'generate-voice') {
    const settings = job.settings?.voice;
    const text = String(job.text || '').trim();
    if (!settings || settings.mode !== 'elevenlabs' || !text) throw new Error('INVALID_VOICE_REQUEST');
    emit(job, 'Generando audio con ElevenLabs');
    const result = await api.generateVoice({ text, model: settings.model, voiceId: settings.voiceId,
      speed: clamp(settings.speed, 0.7, 1.2), stability: clamp(settings.stability, 0, 100) });
    if (!result?.success || !result.filePath) throw new Error('VOICE_GENERATION_FAILED');
    const version = { id: `control-voice-${job.attemptId}`, controlAttemptId: job.attemptId,
      timestamp: Date.now(), speaker: settings.voiceName || settings.voiceId || 'ElevenLabs', segments: result.newAudioSegments,
      model: settings.model || 'Eleven Multilingual v2', speed: clamp(settings.speed, 0.7, 1.2),
      stability: clamp(settings.stability, 0, 100), text, filePath: result.filePath,
      audioUrl: '', durationSeconds: Number(result.durationSeconds) || 0 };
    if (!(version.durationSeconds > 0) || !Array.isArray(result.newAudioSegments) || !result.newAudioSegments.length)
      throw new Error('VOICE_RESULT_INCOMPLETE');
    state = { ...state, generatedVoices: [...(state.generatedVoices || []), version],
      newAudioSegments: result.newAudioSegments, controlGeneratedVoicePath: result.filePath };
    await save(state);
    return { audioPath: result.filePath, durationSeconds: version.durationSeconds,
      segments: result.newAudioSegments, speaker: version.speaker, model: version.model,
      speed: version.speed, stability: version.stability, text };
  }
  if (job.kind === 'build') {
    const settings = job.settings;
    if (!settings) throw new Error('BUILD_SETTINGS_REQUIRED');
    const scriptText = String(settings?.scriptText || '').trim();
    const weights = settings?.weights;
    if (!scriptText || scriptText.length > 4000) throw new Error('APPROVED_SCRIPT_REQUIRED');
    if (!Array.isArray(weights) || weights.length !== 4 || weights.some(value => !Number.isInteger(value) || value < 0 || value > 100) || weights.reduce((a, b) => a + b, 0) !== 100)
      throw new Error('INVALID_MIX_WEIGHTS');
    if (![0, 50, 100].includes(settings?.graphicsPercent ?? -1) || ![0, 50, 100].includes(settings?.transitionsPercent ?? -1))
      throw new Error('INVALID_COVERAGE');
    const effectiveAudio = audioClip(job, state, sourcePath);
    const mode = settings?.voice?.mode;
    const needsSource = weights[0] > 0 || mode === 'original';
    const source = needsSource ? state.clips?.find((clip: any) => clip.type === 'video' && clip.path === sourcePath) : null;
    if (needsSource && (!source || !(Number(source.durationSeconds) > 0))) throw new Error('ORIGINAL_NOT_REGISTERED');
    const buildDurationSeconds = mode === 'none' ? Number(settings.buildDurationSeconds) : Number(effectiveAudio?.durationSeconds) || 0;
    const sourceSegments = mode === 'none' ? createTimedScriptSegments(scriptText, buildDurationSeconds)
      : mode === 'original' ? state.transcriptSegments : (effectiveAudio?.segments || state.newAudioSegments);
    if (mode !== 'none' && (!Array.isArray(sourceSegments) || sourceSegments.length === 0)) throw new Error('AUDIO_TIMESTAMPS_REQUIRED');

    const recovering = state.controlBuild?.operationId === job.operationId && state.timelineVideoClips?.some((c: any) => c.buildPlan);
    if (recovering && state.controlBuild?.status === 'ready' && state.controlBuild?.result) {
      const checked = await api.inspectBuildMedia({ projectPath, clips: state.timelineVideoClips });
      if (checked.success && !checked.invalidIds?.length && !state.timelineVideoClips.some(requiredMediaPending)) return state.controlBuild.result;
      throw new Error('BUILD_MEDIA_MISSING_CONTINUE_IN_STUDIO');
    }
    const preliminaryVersionId = recovering && state.controlBuild?.timelineVersionId
      ? state.controlBuild.timelineVersionId : `control-${job.attemptId}`;
    if (!recovering && weights[0] > 0) emit(job, 'Preparando segmentos del original');
    const sliced = !recovering && weights[0] > 0 ? await api.cutVideoClips({ videoPath: sourcePath, aspectRatio: 'vertical' }) : { success: true };
    if (!sliced?.success) throw new Error('SOURCE_SLICING_FAILED');
    emit(job, 'Construyendo montaje con el reparto de Cipher');
    const built = recovering ? { success: true, clips: state.timelineVideoClips.filter((c: any) => c.type !== 'audio') } : await api.generateTimelineAssets({ scriptText, weights, aspectRatio: 'vertical',
      audioDuration: effectiveAudio ? Number(effectiveAudio.durationSeconds) || undefined : undefined,
      buildDurationSeconds: mode === 'none' ? buildDurationSeconds : undefined,
      sourceDurationSeconds: source ? Number(source.durationSeconds) : undefined,
      transcriptSegments: state.transcriptSegments, videoPath: needsSource ? sourcePath : undefined, iaStyle: 'normal',
      graphicsPercent: 0, newAudioSegments: mode === 'none' ? undefined : sourceSegments,
      audioProvenance: effectiveAudio?.audioProvenance || { origin: 'none' },
      segmentProvenance: effectiveAudio ? { source: 'source-transcript', narration: effectiveAudio.audioProvenance.origin } : undefined });
    if (!built?.success || !Array.isArray(built.clips) || !built.clips.length)
      throw new Error('TIMELINE_BUILD_FAILED');
    let videos = built.clips.map((item: any, index: number) => {
      const clip = item?.clip || item;
      if (!clip) throw new Error('INVALID_TIMELINE_CLIP');
      if (clip.type === 'graphic') return { id: clip.id || `control-graphic-${index}`,
        name: clip.name || 'Gráfico', startSeconds: Number(clip.startSeconds) || 0,
        graphicStartRelative: Number(clip.graphicStartRelative) || 0,
        phraseIdx: Number(clip.phraseIdx) || -1, durationSeconds: Number(clip.durationSeconds) || 2,
        type: 'graphic', graphicData: clip.graphicData };
      if ((!clip.path && !clip.buildPlan) || !Number.isFinite(Number(clip.startSeconds)) || !(Number(clip.durationSeconds) > 0))
        throw new Error('INVALID_TIMELINE_CLIP');
      return { ...clip, id: clip.id || `control-video-${index}`, name: clip.name || `Clip ${index + 1}`,
        startSeconds: Number(clip.startSeconds) || 0, phraseIdx: Number(clip.phraseIdx) || -1,
        durationSeconds: Number(clip.durationSeconds), type: 'video', url: clip.url, path: clip.path,
        category: clip.category || item.type, visualRegeneration: clip.visualRegeneration,
        stockDecision: clip.stockDecision, thumbnailUrl: clip.thumbnailUrl || '' };
    });
    let mediaTimeline = [...videos, ...(effectiveAudio ? [effectiveAudio] : [])];
    const persistMedia = async (next: any[]) => {
      const previousVersions = state.timelineVersions || [];
      const version = { id: preliminaryVersionId, name: 'Montaje preliminar', timestamp: Date.now(), timelineVideoClips: next };
      const timelineVersions = previousVersions.some((v: any) => v.id === preliminaryVersionId)
        ? previousVersions.map((v: any) => v.id === preliminaryVersionId ? { ...v, timelineVideoClips: next } : v)
        : [...previousVersions, version];
      const nextState = { ...state, aiScript: scriptText, timelineWeights: [...weights], buildDurationSeconds,
        timelineVideoClips: next,
        activeVersionId: preliminaryVersionId, timelineVersions,
        controlBuild: { ...state.controlBuild, operationId: job.operationId, attemptId: job.attemptId,
          timelineVersionId: preliminaryVersionId, status: 'preliminary' } };
      const saved = await api.animationSaveBuildState({ projectPath, projectState: nextState });
      if (!saved.success) throw new Error(saved.error || 'PROJECT_STATE_SAVE_FAILED');
      state = nextState;
    };
    await persistMedia(mediaTimeline);
    await runCommonMediaQueue({ getClips: () => mediaTimeline, onClips: next => { mediaTimeline = next },
      persist: persistMedia, isCurrent: () => true, isCancelled: () => false,
      dispatch: async clip => {
        const result = await api.retryTimelineAsset({ projectPath, clip });
        if (!result.success) throw new Error(result.error || 'BUILD_MEDIA_FAILED');
        return result.clip;
      } });
    if (mediaTimeline.some(requiredMediaPending)) throw new Error('BUILD_MEDIA_PENDING_CONTINUE_IN_STUDIO');
    videos = mediaTimeline.filter((clip: any) => clip.type !== 'audio');
    const videoOnly = videos.filter((clip: any) => clip.type !== 'graphic');
    const graphicsPercent = settings.graphicsPercent as 0 | 50 | 100;
    let overlays: any[] = [];
    if (graphicsPercent > 0) {
      emit(job, 'Generando gráficos superpuestos');
      const generated = await api.regenerateGraphics({ strict: true, scriptText,
        audioPath: effectiveAudio?.path || '', clips: videoOnly.map((clip: any) => ({ id: clip.id,
          name: clip.name, startSeconds: clip.startSeconds, phraseIdx: clip.phraseIdx })),
        graphicsPercent, audioSegments: sourceSegments });
      if (!generated?.success || !Array.isArray(generated.clips)) throw new Error('GRAPHICS_GENERATION_FAILED');
      const placed = colocarYFiltrarTarjetas(generated.clips, videoOnly);
      const raw = placed.quedan.map((item, index) => ({ id: `control-graphic-${job.attemptId}-${index}`,
        name: `Gráfico: ${item.cruda.graphicData?.label || item.cruda.graphicData?.type || 'Superposición'}`,
        startSeconds: item.startSeconds, durationSeconds: item.durationSeconds,
        phraseIdx: item.cruda.phraseIdx ?? -1, type: 'graphic', graphicData: item.cruda.graphicData }));
      if (raw.length) {
        const sealed = await api.renderGraphicsBatch({ graficos: raw.map(clip => ({ graphicData: clip.graphicData, duracion: clip.durationSeconds })),
          aspectRatio: 'vertical', resolution: '1080p' });
        const paths: string[] = Array.isArray(sealed?.rutas) ? sealed.rutas : [];
        if (sealed?.cancelado || paths.length !== raw.length || paths.some(path => typeof path !== 'string' || !path))
          throw new Error('GRAPHICS_RENDER_INCOMPLETE');
        overlays = raw.map((clip, index) => ({ ...clip, graphicMovHash: paths[index].replace(/\\/g, '/').split('/').pop()!.replace(/\.mov$/i, '') }));
      }
    }
    const transitionsPercent = settings.transitionsPercent as 0 | 50 | 100;
    const audioClips = effectiveAudio ? [effectiveAudio] : [];
    const assignedTransitions = assignCipherTransitions([...videos, ...overlays, ...audioClips], transitionsPercent, [...CIPHER_DEFAULT_TRANSITIONS]);
    const timeline = [...videos, ...overlays, ...audioClips];
    const versionId = preliminaryVersionId;
    const version = { id: versionId, name: 'Montaje ' + new Date().toISOString(), timestamp: Date.now(), timelineVideoClips: timeline };
    state = { ...state, aiScript: scriptText, timelineWeights: [...weights], buildDurationSeconds,
      timelineVersions: (state.timelineVersions || []).map((v: any) => v.id === versionId ? version : v),
      activeVersionId: versionId, timelineVideoClips: timeline, assignedTransitions, graphicsPercent,
      controlBuild: { operationId: job.operationId, attemptId: job.attemptId, timelineVersionId: versionId, weights: [...weights], graphicsPercent,
        transitionsPercent, assignedTransitions, localProjectPath: projectPath } };
    const result = { timelineVersionId: versionId, clipCount: videos.length, graphicCount: overlays.length,
      transitionCount: Object.keys(assignedTransitions).length, weights: [...weights], graphicsPercent, transitionsPercent };
    state.controlBuild = { ...state.controlBuild, status: 'ready', result };
    const saved = await api.animationSaveBuildState({ projectPath, projectState: state });
    if (!saved.success) throw new Error(saved.error || 'PROJECT_STATE_SAVE_FAILED');
    return result;
  }
  if (job.kind === 'export') {
    const clips = state.timelineVideoClips;
    if (!Array.isArray(clips) || !clips.length) throw new Error('BUILT_TIMELINE_REQUIRED');
    emit(job, 'Exportando el video en el PC');
    const result = await api.exportVideo({ clips, aspectRatio: 'vertical', resolution: '1080p', format: 'mp4', quality: 'high',
      assignedTransitions: state.assignedTransitions || {}, transitionDuration: 0.5, controlExportId: job.attemptId });
    if (!result?.success || !result.filePath) throw new Error('VIDEO_EXPORT_FAILED');
    return { filePath: result.filePath, warning: result.avisoTiempos || null };
  }
  throw new Error('UNSUPPORTED_CIPHER_OPERATION');
}

function ControlAdapterRunner() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      let job: ControlAdapterJob | null = null;
      try {
        const resolved = await api.getControlAdapterJob();
        job = resolved?.job;
        if (!job) throw new Error('CONTROL_JOB_UNAVAILABLE');
        const output = await run(job, String(resolved.sourcePath || ''), String(resolved.projectPath || ''));
        await api.completeControlAdapter({ operationId: job.operationId, attemptId: job.attemptId, ok: true, output });
      } catch (error) {
        const { code, message } = safeFailure(error);
        if (job) await api.completeControlAdapter({ operationId: job.operationId, attemptId: job.attemptId,
          ok: false, errorCode: code, errorMessage: message });
      }
    })();
  }, []);
  return <main style={{ background: '#080910', color: '#fff', minHeight: '100vh', padding: 24, fontFamily: 'sans-serif' }}>Cipher Control worker running</main>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<ControlAdapterRunner />);
