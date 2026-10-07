import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Check, Download, Image, Layers3, Play, RefreshCw, Sparkles, X } from 'lucide-react'

type VibesWorkspaceProps = {
  projectPath: string | null
  audioClip: { path?: string; url?: string; durationSeconds?: number } | null
  transcriptSegments: any[]
  sourceStartDefault?: number
  sourceMediaDurationSeconds?: number
  onClose: () => void
  onSlotsAssigned: (sequence: any) => void | Promise<void>
  onImagesImported: (clips: any[], sequence: any) => void | Promise<void>
  onVideoImported: (clip: any, sequence: any) => void | Promise<void>
}

const fileUrl = (filePath?: string) => filePath
  ? 'file:///' + filePath.replace(/\\/g, '/').split('/').map((segment, index) => index === 0 ? segment : encodeURIComponent(segment)).join('/')
  : ''

const prettySeconds = (value: number) => `${Number(value).toFixed(2)} s`

export function VibesWorkspace({ projectPath, audioClip, transcriptSegments, sourceStartDefault = 0, sourceMediaDurationSeconds, onClose, onSlotsAssigned, onImagesImported, onVideoImported }: VibesWorkspaceProps) {
  const [loaded, setLoaded] = useState<any>(null)
  const [sourceStart, setSourceStart] = useState(sourceStartDefault)
  const [progress, setProgress] = useState<any>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [selectedSceneId, setSelectedSceneId] = useState('')

  const refresh = useCallback(async () => {
    const result = await window.electronAPI.vibesLoad()
    if (result.success) setLoaded(result)
    else setError(result.error || 'No se pudo cargar el estado de Vibes.')
  }, [])

  useEffect(() => {
    void refresh()
    return window.electronAPI.onVibesProgress(value => {
      setProgress(value)
      if (value.phase === 'error' && value.error) setError(value.error)
      void refresh()
    })
  }, [refresh])

  const sequence = loaded?.sequence
  const plan = loaded?.plan
  const job = progress?.snapshot || loaded?.job
  const inFlight = ['starting', 'running'].includes(progress?.phase)
  const readyCount = job?.completeCount || 0
  const canAssign = Boolean(projectPath && audioClip?.path && (audioClip.durationSeconds || 0) >= 60 && transcriptSegments.length)
  const slots = sequence?.slots || []
  const planById = useMemo(() => new Map((plan?.scenes || []).map((scene: any) => [scene.sceneId, scene])), [plan])
  const selectedResult = job?.scenes?.find((scene: any) => scene.sceneId === selectedSceneId) || null
  useEffect(() => {
    const candidates = (job?.scenes || []).filter((scene: any) => scene.imagePreview?.absolutePath)
    if (!candidates.length) return
    if (!candidates.some((scene: any) => scene.sceneId === selectedSceneId)) setSelectedSceneId(candidates[0].sceneId)
  }, [job?.scenes, selectedSceneId])

  const runAction = async (name: string, action: () => Promise<any>) => {
    setBusy(name)
    setError('')
    try {
      const result = await action()
      if (!result?.success) throw new Error(result?.error || 'La operación de Vibes falló.')
      if (result.sequence && name === 'assign') await onSlotsAssigned(result.sequence)
      if (result.clips) await onImagesImported(result.clips, result.sequence)
      if (result.clip) await onVideoImported(result.clip, result.sequence)
      if (result.elapsedMs) setProgress((current: any) => ({ ...current, elapsedMs: result.elapsedMs }))
      await refresh()
      return result
    } catch (exception: any) {
      setError(String(exception?.message || exception))
      return null
    } finally {
      setBusy('')
    }
  }

  const assign = () => runAction('assign', () => window.electronAPI.vibesCreateSlots({
    sourceStartSeconds: Number(sourceStart),
    sourceMediaDurationSeconds,
    durationSeconds: 60,
    audioDurationSeconds: Number(audioClip?.durationSeconds || 0),
    audioPath: String(audioClip?.path || ''),
    transcriptSegments,
  }))

  const makePlan = () => runAction('plan', () => window.electronAPI.vibesPlan())
  const reviewPlan = () => runAction('review', () => window.electronAPI.vibesReviewPlan({ notes: reviewNotes }))
  const generate = () => runAction('generate', () => window.electronAPI.vibesRunImages())
  const resume = () => runAction('resume', () => window.electronAPI.vibesResumeImages())
  const importImages = () => runAction('import', () => window.electronAPI.vibesImportImages())
  const animateSelected = () => runAction('animate', () => window.electronAPI.vibesAnimateImage({ sceneId: selectedSceneId }))
  const resumeAnimation = () => runAction('resume-animation', () => window.electronAPI.vibesResumeAnimation({ sceneId: selectedSceneId }))
  const importVideo = () => runAction('import-video', () => window.electronAPI.vibesImportVideo({ sceneId: selectedSceneId }))
  const selectedHasVideoRequest = Boolean(selectedResult?.remoteVideoBatchId || selectedResult?.remoteVideoContentItemId ||
    selectedResult?.status === 'pending_reconciliation' || ['video_generation', 'video_poll', 'download'].includes(selectedResult?.stage))
  const canAnimateSelected = Boolean(selectedResult?.status === 'image_ready' && selectedResult?.imagePreview?.absolutePath)
  const canResumeAnimation = Boolean(selectedHasVideoRequest && selectedResult?.status !== 'complete')

  return (
    <div className="fixed inset-0 z-[120] bg-[#07090d]/95 backdrop-blur-sm flex flex-col text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1118]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2 bg-amber-500/15 text-amber-300"><Image className="w-5 h-5" /></div>
          <div>
            <h2 className="text-base font-semibold">Vibes · imágenes y animación</h2>
            <p className="text-xs text-slate-400">IA → DeepSeek → Vibes → biblioteca y timeline</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" aria-label="Cerrar Vibes"><X className="w-5 h-5" /></button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-[320px_minmax(0,1fr)] gap-5">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-[#111720] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="w-4 h-4 text-sky-300" /> Asignación del tramo</div>
            <p className="text-xs text-slate-400">Cipher conserva la voz y asigna 20 espacios consecutivos de 3 segundos. El tiempo indicado abajo pertenece al audio y la transcripción de origen.</p>
            <label className="block text-[11px] text-slate-400">Inicio de origen (segundos)
              <input type="number" step="0.01" min="0" value={sourceStart} onChange={event => setSourceStart(Number(event.target.value))} disabled={Boolean(sequence)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#080c12] px-3 py-2 text-sm text-white disabled:opacity-60" />
            </label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-black/30 p-2"><span className="text-slate-500">Duración</span><div className="text-white">60 s</div></div>
              <div className="rounded-lg bg-black/30 p-2"><span className="text-slate-500">Reparto</span><div className="text-white">IA 100 %</div></div>
              <div className="rounded-lg bg-black/30 p-2"><span className="text-slate-500">Intervalos</span><div className="text-white">20 × 3 s</div></div>
              <div className="rounded-lg bg-black/30 p-2"><span className="text-slate-500">Voz</span><div className="text-white">Se conserva</div></div>
            </div>
            <button onClick={() => void assign()} disabled={!canAssign || Boolean(sequence) || Boolean(busy)} className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-3 py-2 text-xs font-semibold">
              {sequence ? <><Check className="inline w-3.5 h-3.5 mr-1" /> Espacios asignados</> : busy === 'assign' ? 'Asignando…' : 'Configurar 100 % IA y crear espacios'}
            </button>
            {!canAssign && <p className="text-[10px] text-amber-300/80">Abre un proyecto con una voz local de 60 segundos y transcripción temporizada para asignar.</p>}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#111720] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 text-violet-300" /> Estilo aprobado</div>
            <div className="text-xs text-white">{loaded?.styleProfile?.name || 'COLLAGE EDITORIAL FOTOGRÁFICO DE PAPEL'}</div>
            <div className="font-mono text-[10px] text-slate-400">{loaded?.styleProfile?.id || 'vibes-editorial-photographic-paper@2.0.0'}</div>
            <div className="flex gap-2">{Object.values(loaded?.styleProfile?.palette || {}).filter((value: any) => value?.hex).map((value: any) => <span key={value.hex} title={value.use} className="h-6 flex-1 rounded border border-white/10" style={{ backgroundColor: value.hex }} />)}</div>
            <details className="text-[10px] text-slate-400">
              <summary className="cursor-pointer">Ver el perfil completo guardado</summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2">{JSON.stringify(loaded?.styleProfile || {}, null, 2)}</pre>
            </details>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#111720] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="w-4 h-4 text-emerald-300" /> Ejecución del bot</div>
            <div className="text-[11px] text-slate-400">{job ? `${readyCount}/20 imágenes descargadas · ${job.failedCount || 0} errores · ${job.pendingReconciliationCount || 0} por reconciliar` : 'Sin trabajo Vibes todavía.'}</div>
            {inFlight && <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full w-1/2 bg-amber-400 animate-pulse" /></div>}
            {progress?.phase && <div className="text-[10px] text-slate-500">{progress.phase}{progress.elapsedMs ? ` · ${(progress.elapsedMs / 1000).toFixed(1)} s` : ''}</div>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => void makePlan()} disabled={!sequence || Boolean(plan) || Boolean(busy) || inFlight} className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-2 py-2 text-xs font-semibold">{busy === 'plan' ? 'Planificando…' : 'Planificar con DeepSeek'}</button>
              <button onClick={() => void generate()} disabled={!plan || Boolean(loaded?.session) || Boolean(busy) || inFlight} className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 px-2 py-2 text-xs font-semibold"><Play className="inline w-3 h-3 mr-1" />Construir imágenes</button>
              {plan && <label className="col-span-2 text-[10px] text-slate-400">Notas de revisión para DeepSeek (opcional)
                <textarea value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} maxLength={4000} rows={5} placeholder="Indica IDs e incertidumbres que debe conservar. DeepSeek recibirá estas notas junto con la narración, los intervalos y el perfil." className="mt-1 w-full rounded-lg border border-slate-700 bg-[#080c12] px-2 py-2 text-[10px] text-white placeholder:text-slate-600" />
              </label>}
              {plan && <button onClick={() => void reviewPlan()} disabled={Boolean(busy) || inFlight} className="col-span-2 rounded-lg bg-violet-900/70 hover:bg-violet-800 disabled:opacity-40 px-2 py-2 text-xs font-semibold">{busy === 'review' ? 'Revisando contenido con DeepSeek…' : 'Revisar fidelidad con DeepSeek'}</button>}
              <button onClick={() => void resume()} disabled={!loaded?.session || Boolean(busy) || inFlight || (job && !job.failedCount && !job.pendingReconciliationCount && readyCount === job.sceneCount)} className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-2 py-2 text-xs font-semibold"><RefreshCw className="inline w-3 h-3 mr-1" />Reanudar pendiente</button>
              <button onClick={() => void importImages()} disabled={!job || readyCount !== 20 || Boolean(busy) || inFlight} className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 px-2 py-2 text-xs font-semibold"><Download className="inline w-3 h-3 mr-1" />Importar imágenes</button>
              <button onClick={() => void animateSelected()} disabled={!canAnimateSelected || Boolean(busy) || inFlight} className="col-span-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-40 px-2 py-2 text-xs font-semibold"><Play className="inline w-3 h-3 mr-1" />Construir video desde imagen seleccionada</button>
              <button onClick={() => void resumeAnimation()} disabled={!canResumeAnimation || Boolean(busy) || inFlight} className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-2 py-2 text-xs font-semibold"><RefreshCw className="inline w-3 h-3 mr-1" />Reanudar animación</button>
              <button onClick={() => void importVideo()} disabled={selectedResult?.status !== 'complete' || !selectedResult?.video?.absolutePath || Boolean(busy) || inFlight} className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 px-2 py-2 text-xs font-semibold"><Download className="inline w-3 h-3 mr-1" />Incorporar video</button>
            </div>
            {plan?.deepSeek && <div className="text-[10px] text-slate-500">DeepSeek: {plan.deepSeek.model} · {(plan.deepSeek.planningMs / 1000).toFixed(2)} s · uso reportado: {plan.deepSeek.usage ? JSON.stringify(plan.deepSeek.usage) : 'no informado'}</div>}
            {plan?.deepSeek?.review && <div className="text-[10px] text-slate-500">Revisión DeepSeek: {plan.deepSeek.review.model} · {(plan.deepSeek.review.planningMs / 1000).toFixed(2)} s · uso reportado: {plan.deepSeek.review.usage ? JSON.stringify(plan.deepSeek.review.usage) : 'no informado'}</div>}
            {loaded?.session?.generationDownloadMs != null && <div className="text-[10px] text-slate-500">Generación/descarga: {(loaded.session.generationDownloadMs / 1000).toFixed(2)} s · importación: {loaded.session.importMs == null ? 'pendiente' : `${(loaded.session.importMs / 1000).toFixed(2)} s`}</div>}
            {error && <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-2 text-[11px] text-red-300 break-words">{error}</div>}
            {job?.scenes?.some((scene: any) => scene.error) && <ul className="space-y-1 max-h-32 overflow-auto">{job.scenes.filter((scene: any) => scene.error).map((scene: any) => <li key={scene.sceneId} className="text-[10px] text-red-300"><b>{scene.sceneId}</b> · {scene.error}</li>)}</ul>}
          </section>
        </aside>

        <section className="min-w-0 rounded-2xl border border-slate-800 bg-[#111720] p-4">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="text-sm font-semibold">{plan ? 'Prompts y resultado de la secuencia' : 'Intervalos y fragmentos'}</h3><p className="text-[11px] text-slate-500">{sequence ? `Origen ${prettySeconds(sequence.sourceStartSeconds)}–${prettySeconds(sequence.sourceEndSeconds)} · ${slots.length} intervalos estables` : 'Asigna los espacios para iniciar el flujo.'}</p></div>
            {job?.jobId && <span className="font-mono text-[10px] text-slate-500">job {job.jobId}</span>}
          </div>
          {!slots.length ? <div className="h-[55vh] grid place-items-center text-sm text-slate-500">Aún no hay intervalos asignados.</div> : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
              {slots.map((slot: any, index: number) => {
                const scene = planById.get(slot.id) as any
                const result = job?.scenes?.find((item: any) => item.sceneId === slot.id)
                const previewUrl = result?.imagePreview?.absolutePath ? fileUrl(result.imagePreview.absolutePath) : ''
                return <article key={slot.id} className="rounded-xl border border-slate-800 bg-[#0b1017] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[10px]">
                    <label className="flex items-center gap-2 font-semibold text-slate-300">
                      <input type="radio" name="vibes-selected-image" checked={selectedSceneId === slot.id} onChange={() => setSelectedSceneId(slot.id)} disabled={!result?.imagePreview?.absolutePath} aria-label={'Seleccionar imagen Vibes ' + String(index + 1)} />
                      {String(index + 1).padStart(2, '0')} · {prettySeconds(slot.timelineStartSeconds)}–{prettySeconds(slot.timelineStartSeconds + 3)}
                    </label>
                    <span className="text-slate-500 truncate ml-2">{result?.status || (scene ? 'planificado' : 'asignado')}</span>
                  </div>
                  {previewUrl ? <img src={previewUrl} alt={`Vibes ${slot.id}`} className="w-full aspect-[9/16] max-h-72 object-contain bg-black" /> : <div className="aspect-[9/16] max-h-72 grid place-items-center bg-[#151b23] text-slate-600"><Image className="w-8 h-8" /></div>}
                  <div className="p-3 space-y-2 text-[10px]">
                    <p className="text-slate-300 min-h-8"><b className="text-slate-500">Narración literal:</b> {slot.scriptFragment || <i>silencio</i>}</p>
                    {slot.silentInterval && <p className="text-slate-500">Contexto · anterior: {slot.neighborContext.previous || '—'} · siguiente: {slot.neighborContext.next || '—'}</p>}
                    {scene && <>
                      <p className="text-sky-200"><b>Idea:</b> {scene.narrativeIntent}</p>
                      <p className="text-slate-400"><b>Se mostrará:</b> {scene.visualDescription}</p>
                      <details><summary className="cursor-pointer text-amber-300">Prompt efectivo de Vibes</summary><p className="mt-1 text-slate-400 whitespace-pre-wrap">{scene.imagePrompt}</p></details>
                    </>}
                    {scene?.motionPrompt && <details><summary className="cursor-pointer text-violet-300">Instrucción guardada de movimiento</summary><p className="mt-1 text-slate-400 whitespace-pre-wrap">{scene.motionPrompt}</p></details>}
                    {result?.motionPrompt && <details><summary className="cursor-pointer text-violet-300">Instrucción usada en el trabajo</summary><p className="mt-1 text-slate-400 whitespace-pre-wrap">{result.motionPrompt}</p></details>}
                    {result?.remoteVideoBatchId && <p className="text-slate-500 font-mono">Lote de video {result.remoteVideoBatchId} · {result.remoteVideoContentItemId || 'pendiente'}</p>}
                    {result?.error && <p className="text-red-300">{result.error}</p>}
                  </div>
                </article>
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
