import React, { useEffect, useRef, useState } from 'react'
import { LoaderCircle, MessageSquare, Paperclip, Play, RefreshCw, Save, Sparkles, Square, Undo2, Trash2, Pencil } from 'lucide-react'
import { CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1 } from '../../../shared/animation-style-profile-v1'

type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; text: string; createdAt: string }
type Props = {
  projectPath: string | null
  flowMode?: 'style' | 'scene'
  onBackToAudio?: () => void
  onContinueWithStyle?: () => void
  selectedClip: any | null
  selectedClipCount: number
  transcriptSegments: any[]
  currentTimeSeconds: number
  projectDurationSeconds: number
  projectFps: number
  projectFormat: string
  timelineWeights: number[]
  timelineVideoClips: any[]
  selectedTimelineClipIds: string[]
  canApplyNewVisualAt: (startSeconds: number, durationSeconds: number) => boolean
  onSelectVisualSlot: (clipId: string) => void
  onApply: (clip: any, selectedClipId: string) => boolean
  onUndo: () => void
  onRestore: (snapshot: any) => boolean
}

const PALETTE_LABELS: Record<string, string> = { paper: 'Papel cálido', night: 'Noche azul', garden: 'Jardín', sapphire: 'Azul zafiro' }
function parseStyleRequest(request: string, current: any) {
  const value = request.toLowerCase()
  const patch: Record<string, unknown> = {}
  if (/\b(?:cambia|cambiar|modifica|ajusta|usa|pon|aplica|elige)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:paleta|colores?|color)\b/.test(value)) {
    if (/\b(verde|jard[ií]n|natural|garden)\b/.test(value)) patch.paletteId = 'garden'
    else if (/\b(zafiro|sapphire|azul editorial|azul brillante)\b/.test(value)) patch.paletteId = 'sapphire'
    else if (/\b(noche|oscuro|night)\b/.test(value)) patch.paletteId = 'night'
    else if (/\bazul\b/.test(value)) patch.paletteId = 'sapphire'
    else if (/\b(papel|c[aá]lid[oa]|claro|paper)\b/.test(value)) patch.paletteId = 'paper'
  }
  // Keep the offline typography shortcut limited to direct typography commands.
  // Otherwise phrases such as "usa el módulo guardado como fuente" are misread as
  // font edits and silently bypass the code-generation path.
  if (/\b(?:cambia|modifica|ajusta|usa|pon|aplica|pasa|elige)\s+(?:(?:la|el|una)\s+)?(?:tipograf[ií]a|fuente|letra|sans(?:[- ]serif)?|serif)\b/.test(value)) {
    if (/\bsans(?:[- ]serif)?\b/.test(value)) { patch.titleFont = 'dmSans'; patch.bodyFont = 'dmSans' }
    else if (/\bserif(?:a|as)?\b/.test(value)) { patch.titleFont = 'instrumentSerif'; patch.bodyFont = 'dmSans' }
    else if (/\b(?:tipograf[ií]a|fuente|letra)\b/.test(value)) patch.titleFont = current?.titleFont === 'instrumentSerif' ? 'dmSans' : 'instrumentSerif'
  }
  if (/\b(agrand|aument|m[aá]s grande|sube).{0,36}\b(textos?|etiquetas?|titulares?|letras?)\b/.test(value)) {
    patch.labelScale = Math.min(1.5, Number(current?.labelScale || 1) + .1)
    if (/titular|t[ií]tulo|todo el texto/.test(value)) patch.titleScale = Math.min(1.35, Number(current?.titleScale || 1) + .1)
  }
  return Object.keys(patch).length ? patch : null
}
const ERROR_MESSAGES: Record<string, string> = {
  ANIMATION_ACTIVE_PROJECT_REQUIRED: 'Abre un proyecto para usar Animation.',
  ANIMATION_CODEX_CLI_NOT_INSTALLED: 'No se encontró Codex CLI en este equipo.',
  ANIMATION_CODEX_LOGIN_REQUIRED: 'Inicia sesión en Codex antes de generar. Animation no solicita ni guarda claves API.',
  ANIMATION_CODEX_VERSION_UNSUPPORTED: 'La versión de Codex CLI no coincide con la versión fijada para Animation. Actualiza o restaura la versión indicada.',
  ANIMATION_CODEX_TIMEOUT: 'El agente local tardó demasiado. Puedes reintentar sin cambiar el proyecto.',
  ANIMATION_CODEX_STREAM_ERROR: 'Codex app-server no completó la inferencia.',
  ANIMATION_CANCELLED: 'Creación cancelada. El resultado no se aplicó al timeline.',
  ANIMATION_SELECTED_CLIP_UNSUPPORTED: 'Selecciona un único clip de Visuales de al menos 3 segundos.',
  ANIMATION_DURATION_CANNOT_FIT_EXPLANATION: 'La duración no alcanza para la acción y la lectura estable de esta receta.',
  ANIMATION_REFERENCE_FORMAT_UNSUPPORTED: 'La referencia debe ser PNG, JPG, WEBP o un video MP4, MOV, M4V, WEBM o AVI.',
  ANIMATION_REFERENCE_VIDEO_PROBE_FAILED: 'No se pudo leer la duración del video de referencia con ffprobe.',
  ANIMATION_REFERENCE_FRAME_EXTRACTION_FAILED: 'No se pudieron extraer los fotogramas de la referencia de video.',
  ANIMATION_CODE_SCENE_COMPONENT_EXTRACTION_UNSUPPORTED: 'Esta escena procedural todavía no ofrece extracción automática de componentes; guárdala como receta o secuencia.',
}
const errorText = (value: string) => {
  const [code, ...details] = value.split(':')
  const message = ERROR_MESSAGES[code]
  return message ? `${message}${details.length ? ` (${details.join(':')})` : ''}` : value
}
const connectionText = (conn: any) => {
  if (!conn?.available) return 'Codex CLI no está disponible.'
  if (conn.status === 'unsupported-version') return `Versión Codex ${conn.version} no compatible; requiere ${conn.expectedVersion}.`
  if (conn.status === 'version-unknown') return `No se pudo verificar la versión fijada ${conn.expectedVersion}.`
  if (conn.status === 'timeout') return 'La comprobación de la sesión local agotó el tiempo.'
  if (!conn.authenticated) return 'Falta iniciar sesión en Codex con la cuenta autorizada.'
  return 'Sesión Codex detectada · se comprobará con una solicitud real.'
}

export default function AnimationWorkspace({ projectPath, flowMode = 'scene', onBackToAudio, onContinueWithStyle,
  selectedClip, selectedClipCount, transcriptSegments, currentTimeSeconds, projectDurationSeconds, projectFps,
  projectFormat, timelineWeights, timelineVideoClips, selectedTimelineClipIds, canApplyNewVisualAt,
  onSelectVisualSlot, onApply, onUndo, onRestore }: Props) {
  const [connection, setConnection] = useState<any>(null)
  const [statusLabel, setStatusLabel] = useState('Comprobando la sesión local…')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [references, setReferences] = useState<any[]>([])
  const [styleProfile, setStyleProfile] = useState<any>(CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1)
  const [styles, setStyles] = useState<any[]>([])
  const [styleProposal, setStyleProposal] = useState<any>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameEditing, setRenameEditing] = useState(false)
  const [styleScope, setStyleScope] = useState<'clip' | 'project'>('clip')
  const [templates, setTemplates] = useState<any[]>([])
  const [savedDrafts, setSavedDrafts] = useState<any[]>([])
  const [currentDraft, setCurrentDraft] = useState<any>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<any>(null)
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [providerVerified, setProviderVerified] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const conversationEnd = useRef<HTMLDivElement>(null)
  const pendingSourceId = useRef<string | null>(null)
  const activeJobRef = useRef<{ jobId: string; projectPath: string; sourceClipId: string | null } | null>(null)
  const cancelledJobIdsRef = useRef(new Set<string>())
  const selectedClipIdRef = useRef<string | null>(selectedClip?.id || null)
  selectedClipIdRef.current = selectedClip?.id || null

  const beginAnimationJob = (jobId: string, sourceClipId = selectedClipIdRef.current) => {
    if (activeJobRef.current) throw new Error('ANIMATION_JOB_ALREADY_RUNNING')
    activeJobRef.current = { jobId, projectPath: String(projectPath || ''), sourceClipId }
  }
  const animationJobIsCurrent = (jobId: string) => {
    const active = activeJobRef.current
    return !!active && active.jobId === jobId && !cancelledJobIdsRef.current.has(jobId) &&
      active.projectPath === String(projectPath || '') && active.sourceClipId === selectedClipIdRef.current
  }
  const finishAnimationJob = (jobId: string) => {
    if (activeJobRef.current?.jobId === jobId) activeJobRef.current = null
    cancelledJobIdsRef.current.delete(jobId)
  }
  const requestAnimationJobCancel = async (jobId: string, updateUi = true) => {
    cancelledJobIdsRef.current.add(jobId)
    if (activeJobRef.current?.jobId === jobId) pendingSourceId.current = null
    if (updateUi) setProgress({ phase: 'cancelling', message: 'Cancelando y esperando que termine la tarea…' })
    try {
      const result = await window.electronAPI.animationCancel(jobId)
      if (updateUi && result?.settled === false) setStatusLabel('La cancelación sigue en curso; Cipher mantiene bloqueada otra generación hasta que termine.')
      return result
    } catch (error: any) {
      if (updateUi) setError(errorText(String(error?.message || 'ANIMATION_CANCEL_FAILED')))
      return null
    }
  }

  useEffect(() => {
    let active = true
    pendingSourceId.current = null
    setMessages([]); setReferences([]); setTemplates([]); setStyles([]); setStyleProposal(null); setCurrentDraft(null); setThreadId(null); setError('')
    setProviderVerified(false)
    if (!projectPath) { setStatusLabel('Abre un proyecto para iniciar Animation.'); return }
    void Promise.all([window.electronAPI.animationConnectionStatus(), window.electronAPI.animationLoadProject(),
      window.electronAPI.animationListTemplates(), window.electronAPI.animationListStyles()])
      .then(([conn, project, library, styleLibrary]) => {
        if (!active) return
        setConnection(conn)
        setStatusLabel(connectionText(conn))
        if (!project.success) { setError(errorText(project.error || 'No se pudo cargar Animation para este proyecto.')); return }
        const state = project.state || {}
        setMessages(Array.isArray(state.conversation) ? state.conversation : [])
        setThreadId(state.threadId || null)
        setReferences(Array.isArray(state.references) ? state.references : [])
        setStyleProfile(state.styleProfile || CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1)
        setStyles(styleLibrary.success ? styleLibrary.styles || [] : [])
        if (state.activeDraft) {
          pendingSourceId.current = state.activeDraft.targetMode === 'new-visual-draft' ? null : state.activeDraft.selectedTimelineBinding?.clipId || null
          setCurrentDraft({ ...state.activeDraft,
            undoSnapshot: state.undoSnapshot || null,
            applied: selectedClip?.animationV1?.draftId === state.activeDraft.draftId })
        }
        if (state.activeDraftId && !state.activeDraft) setStatusLabel('Se conservó la configuración del proyecto; abre el plan para regenerarlo sin conexión.')
        setTemplates(library.success ? library.templates || [] : state.library || [])
      })
      .catch(e => { if (active) setError(String(e?.message || e)) })
    return () => {
      active = false
      const running = activeJobRef.current
      if (running?.projectPath === String(projectPath || '')) void requestAnimationJobCancel(running.jobId, false)
    }
  }, [projectPath])

  useEffect(() => {
    const running = activeJobRef.current
    if (running && running.sourceClipId !== selectedClipIdRef.current) void requestAnimationJobCancel(running.jobId)
  }, [projectPath, selectedClip?.id])

  useEffect(() => {
    const draftId = selectedClip?.animationV1?.draftId
    if (!projectPath || !selectedClip?.id || !draftId || currentDraft?.selectedTimelineBinding?.clipId === selectedClip.id) return
    let active = true
    void window.electronAPI.animationLoadDraft(draftId).then(result => {
      if (!active) return
      if (!result.success || !result.draft) { setError(errorText(result.error || 'ANIMATION_DRAFT_LOAD_FAILED')); return }
      pendingSourceId.current = selectedClip.id
      setCurrentDraft({ ...result.draft, applied: true })
      setStatusLabel('Se abrió el plan Animation asociado a este Visual.')
    }).catch((e: any) => { if (active) setError(errorText(String(e?.message || e))) })
    return () => { active = false }
  }, [projectPath, selectedClip?.id, selectedClip?.animationV1?.draftId, currentDraft?.selectedTimelineBinding?.clipId])

  useEffect(() => {
    let active = true
    const clipId = selectedClip?.id
    if (!projectPath || !clipId || selectedClip?.category !== 'visual') { setSavedDrafts([]); return }
    void window.electronAPI.animationListDrafts(clipId).then(result => {
      if (active && selectedClipIdRef.current === clipId && result.success) setSavedDrafts(result.drafts || [])
    }).catch(() => { if (active) setSavedDrafts([]) })
    return () => { active = false }
  }, [projectPath, selectedClip?.id, selectedClip?.category, selectedClip?.animationV1?.draftId])

  useEffect(() => {
    if (!currentDraft || !selectedClip || selectedClip.id !== currentDraft.selectedTimelineBinding?.clipId) return
    const isApplied = selectedClip.animationV1?.draftId === currentDraft.draftId
    setCurrentDraft((previous: any) => previous?.draftId === currentDraft.draftId && previous.applied !== isApplied
      ? { ...previous, applied: isApplied } : previous)
  }, [currentDraft?.draftId, selectedClip?.id, selectedClip?.animationV1?.draftId])

  useEffect(() => {
    if (!lastJobId) return
    return window.electronAPI.onAnimationProgress(data => {
      if (data?.jobId === lastJobId) setProgress(data)
    })
  }, [lastJobId])

  useEffect(() => { conversationEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages])

  const persistConversation = (nextMessages: ChatMessage[], nextThreadId = threadId, extra: any = {}) => {
    setMessages(nextMessages); setThreadId(nextThreadId)
    if (!projectPath) return
    void window.electronAPI.animationSaveProject({ schema: 'cipher-animation-project-v1', conversation: nextMessages,
      threadId: nextThreadId, references, library: templates, activeDraftId: extra.activeDraftId ?? currentDraft?.draftId ?? null,
      activeStyle: extra.activeStyle ?? currentDraft?.config?.style ?? {}, styleProfile: extra.styleProfile ?? styleProfile })
  }

  const chooseStyleProfile = async (profileId: string) => {
    const next = styles.find(profile => profile.id === profileId)
    if (!next) return
    if (!projectPath) return
    const result = await window.electronAPI.animationSnapshotStyle({ projectPath, profile: next })
    if (!result?.success || !result.profile) { setError(errorText(result?.error || 'ANIMATION_STYLE_SNAPSHOT_FAILED')); return }
    setStyleProfile(result.profile)
    persistConversation(messages, threadId, { styleProfile: result.profile })
    setStatusLabel(`Perfil ${result.profile.title} · v${result.profile.version} copiado en el proyecto y activo para nuevas creaciones.`)
  }

  const proposeProjectStyle = async (request: string) => {
    if (!connection?.authenticated) { setError('La sesión Codex no está disponible. Comprueba el inicio de sesión desde Codex y vuelve a intentar.'); return }
    const sourceClipId = selectedClip?.id || null
    const jobId = crypto.randomUUID()
    beginAnimationJob(jobId, sourceClipId)
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: request, createdAt: new Date().toISOString() }
    const withUser = [...messages, userMessage]
    setLastJobId(jobId); setProgress({ phase: 'style-analysis', message: 'Analizando dirección visual y referencias…' });
    setError(''); setBusy(true); setInput(''); setStyleProposal(null)
    persistConversation(withUser)
    try {
      const result = await window.electronAPI.animationProposeStyle({ jobId, projectPath, instruction: request,
        referenceIds: references.map(ref => ref.id), currentProfile: styleProfile, threadId })
      if (!animationJobIsCurrent(jobId)) return
      if (!result?.success || !result.proposal) throw new Error(errorText(String(result?.error || 'ANIMATION_STYLE_PROPOSAL_FAILED')))
      setStyleProposal({ ...result.proposal, response: result.response, metrics: result.metrics })
      const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant',
        text: `${result.response || 'Perfil propuesto.'}\n\nAlcance antes de guardar: se aplicará a los Visuales nuevos del proyecto. Los Visuales existentes conservan su código y versión.`,
        createdAt: new Date().toISOString() }
      persistConversation([...withUser, assistant], result.threadId || threadId)
      setProviderVerified(true)
      setStatusLabel(`Propuesta real de Codex · ${result.metrics?.calls || 1} llamada · ${result.metrics?.directionMs ?? '—'} ms. Revisa el alcance antes de guardar.`)
    } catch (e: any) {
      if (cancelledJobIdsRef.current.has(jobId) || !animationJobIsCurrent(jobId)) {
        setStatusLabel('Propuesta cancelada; no se guardó ningún cambio global.')
        return
      }
      const message = errorText(String(e?.message || 'ANIMATION_STYLE_PROPOSAL_FAILED'))
      persistConversation([...withUser, { id: crypto.randomUUID(), role: 'assistant', text: message, createdAt: new Date().toISOString() }])
      setError(message)
    } finally { finishAnimationJob(jobId); setBusy(false); setProgress(null); setLastJobId(null) }
  }

  const saveStyleProposal = async (mode: 'new' | 'update') => {
    if (!styleProposal || !projectPath || busy) return
    const canUpdate = mode !== 'update' || (styleProfile?.id?.startsWith('style-') && styles.some(item => item.id === styleProfile.id && item.deletable))
    if (!canUpdate) { setError('El estilo inicial se conserva como base; guarda la propuesta como un estilo nuevo.'); return }
    setBusy(true); setError('')
    try {
      const result = await window.electronAPI.animationSaveStyle({ projectPath, mode,
        profile: styleProposal, referenceIds: references.map(ref => ref.id), activate: true })
      if (!result?.success || !result.profile) throw new Error(errorText(String(result?.error || 'ANIMATION_STYLE_SAVE_FAILED')))
      const library = await window.electronAPI.animationListStyles()
      setStyles(library.success ? library.styles || [] : styles)
      setStyleProfile(result.profile)
      setStyleProposal(null)
      persistConversation(messages, threadId, { styleProfile: result.profile })
      setStatusLabel(`Estilo ${result.profile.title} · v${result.profile.version} guardado y activo para nuevos Visuales.`)
    } catch (e: any) { setError(errorText(String(e?.message || 'ANIMATION_STYLE_SAVE_FAILED'))) }
    finally { setBusy(false) }
  }

  const renameSelectedStyle = async () => {
    if (!projectPath || !styleProfile?.id?.startsWith('style-') || !renameValue.trim()) return
    const result = await window.electronAPI.animationRenameStyle({ styleId: styleProfile.id, title: renameValue.trim() })
    if (!result?.success || !result.profile) { setError(errorText(result?.error || 'ANIMATION_STYLE_RENAME_FAILED')); return }
    const snapshot = await window.electronAPI.animationSnapshotStyle({ projectPath, profile: result.profile })
    if (!snapshot?.success || !snapshot.profile) { setError(errorText(snapshot?.error || 'ANIMATION_STYLE_SNAPSHOT_FAILED')); return }
    const library = await window.electronAPI.animationListStyles()
    setStyles(library.success ? library.styles || [] : styles)
    setStyleProfile(snapshot.profile)
    setRenameEditing(false)
    persistConversation(messages, threadId, { styleProfile: snapshot.profile })
    setStatusLabel(`Estilo renombrado · nueva versión v${snapshot.profile.version} copiada al proyecto.`)
  }

  const deleteSelectedStyle = async () => {
    const selected = styles.find(item => item.id === styleProfile?.id)
    if (!selected?.deletable || !window.confirm(`Eliminar “${selected.title}” de la biblioteca de estilos? Los proyectos ya guardados conservarán su copia.`)) return
    const result = await window.electronAPI.animationDeleteStyle(selected.id)
    if (!result?.success) { setError(errorText(result?.error || 'ANIMATION_STYLE_DELETE_FAILED')); return }
    const library = await window.electronAPI.animationListStyles()
    const nextStyles = library.success ? library.styles || [] : []
    setStyles(nextStyles)
    const nextProfile = nextStyles.find((item: any) => item.id === CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1.id) || nextStyles[0]
    if (nextProfile) void chooseStyleProfile(nextProfile.id)
    setStatusLabel('Estilo eliminado de la biblioteca administrada. Las copias guardadas en proyectos siguen disponibles.')
  }

  const openSavedDraft = async (draftId: string) => {
    const targetClipId = selectedClipIdRef.current
    if (!targetClipId || busy || !projectPath) return
    setError('')
    try {
      const result = await window.electronAPI.animationLoadDraft(draftId)
      if (!result.success || !result.draft) throw new Error(errorText(result.error || 'ANIMATION_DRAFT_LOAD_FAILED'))
      if (selectedClipIdRef.current !== targetClipId) return
      if (result.draft.selectedTimelineBinding?.clipId !== targetClipId) throw new Error('ANIMATION_DRAFT_TARGET_MISMATCH')
      const applied = selectedClip?.animationV1?.draftId === draftId
      pendingSourceId.current = targetClipId
      setCurrentDraft({ ...result.draft, applied })
      setStatusLabel('Se recuperó el borrador guardado con sus recursos locales; no se llamó al proveedor.')
      persistConversation(messages, threadId, { activeDraftId: draftId, activeStyle: result.draft.config?.style || styleProfile })
    } catch (error: any) { setError(errorText(String(error?.message || error))) }
  }

  const send = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const request = input.trim()
    if (!request || busy || activeJobRef.current || !projectPath) return
    const reviewRequest = currentDraft?.draftId && /^(revisa|eval[uú]a|inspecciona|mira).*(capturas|preview|previsualizaci[oó]n|vista previa|borrador)/i.test(request)
    if (reviewRequest) {
      if (!connection?.authenticated) { setError('La sesión Codex no está disponible. Comprueba el inicio de sesión desde Codex y vuelve a intentar.'); return }
      const jobId = crypto.randomUUID()
      beginAnimationJob(jobId)
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: request, createdAt: new Date().toISOString() }
      const withUser = [...messages, userMessage]
      setLastJobId(jobId); setProgress({ phase: 'review', message: 'Preparando capturas reales de entrada, acción y lectura…' }); setError(''); setBusy(true); setInput('')
      persistConversation(withUser)
      try {
        const result = await window.electronAPI.animationReviewDraft({ draftId: currentDraft.draftId, jobId, threadId, userMessage: request })
        if (!animationJobIsCurrent(jobId)) return
        if (!result?.success) throw new Error(errorText(String(result?.error || 'ANIMATION_VISUAL_REVIEW_FAILED')))
        const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: result.response || '', createdAt: new Date().toISOString() }
        persistConversation([...withUser, assistant], result.threadId || threadId)
        setProviderVerified(true); setStatusLabel('El agente inspeccionó capturas reales de la previsualización.'); setProgress(null)
      } catch (e: any) {
        if (cancelledJobIdsRef.current.has(jobId) || !animationJobIsCurrent(jobId)) {
          setStatusLabel('Revisión cancelada; no se incorporó una respuesta tardía.')
          return
        }
        const message = errorText(String(e?.message || 'ANIMATION_VISUAL_REVIEW_FAILED'))
        persistConversation([...withUser, { id: crypto.randomUUID(), role: 'assistant', text: message, createdAt: new Date().toISOString() }])
        setError(message)
      } finally { finishAnimationJob(jobId); setBusy(false); setLastJobId(null); setProgress(null) }
      return
    }
    const projectStyle = { paletteId: styleProfile?.parameters?.paletteId || 'paper',
      titleFont: styleProfile?.parameters?.titleFontFamily === 'DM Sans' ? 'dmSans' : 'instrumentSerif',
      bodyFont: styleProfile?.parameters?.bodyFontFamily === 'Instrument Serif' ? 'instrumentSerif' : 'dmSans',
      titleScale: styleProfile?.parameters?.titleScale || 1, labelScale: styleProfile?.parameters?.labelScale || 1 }
    if (flowMode === 'style' || styleScope === 'project') {
      await proposeProjectStyle(request)
      return
    }
    const styleBase = currentDraft?.config?.style || currentDraft?.scenePlan?.style || projectStyle
    const stylePatch = parseStyleRequest(request, styleBase)
    if (stylePatch && currentDraft?.draftId) {
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: request, createdAt: new Date().toISOString() }
      const withUser = [...messages, userMessage]
      const nextStyleProfile = styleProfile
      const jobId = crypto.randomUUID()
      beginAnimationJob(jobId, currentDraft?.selectedTimelineBinding?.clipId || selectedClip?.id || null)
      pendingSourceId.current = currentDraft.targetMode === 'new-visual-draft' ? null : currentDraft.selectedTimelineBinding?.clipId || null
      setLastJobId(jobId); setProgress({ phase: 'style', message: 'Ajustando paleta y tipografía localmente…' }); setError(''); setBusy(true); setInput('')
      persistConversation(withUser, threadId, { styleProfile: nextStyleProfile })
      try {
        const result = await window.electronAPI.animationAdjustDraftStyle({ draftId: currentDraft.draftId, jobId, patch: stylePatch, instruction: request })
        if (!animationJobIsCurrent(jobId)) return
        if (!result?.success || !result.draft) throw new Error(errorText(String(result?.error || 'ANIMATION_STYLE_ADJUSTMENT_FAILED')))
        const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: 'Ajuste de estilo regenerado sin modelo y sin reescribir la geometría. Revisa la previsualización.', createdAt: new Date().toISOString() }
        setCurrentDraft({ ...result.draft, applied: false, generationMetrics: result.metrics })
        persistConversation([...withUser, assistant], threadId, { activeDraftId: result.draft.draftId,
          activeStyle: result.draft.config?.style || result.draft.scenePlan?.style, styleProfile: nextStyleProfile })
        setStatusLabel('Paleta y tipografía cambiadas sólo para este Visual; su geometría se conserva.')
      } catch (e: any) {
        if (cancelledJobIdsRef.current.has(jobId) || !animationJobIsCurrent(jobId)) {
          setStatusLabel('Ajuste cancelado; no se incorporó una versión tardía.')
          return
        }
        const message = errorText(String(e?.message || 'ANIMATION_STYLE_ADJUSTMENT_FAILED'))
        persistConversation([...withUser, { id: crypto.randomUUID(), role: 'assistant', text: message, createdAt: new Date().toISOString() }])
        setError(message)
      } finally { finishAnimationJob(jobId); setBusy(false); setProgress(null); setLastJobId(null) }
      return
    }
    if (selectedClipCount > 0 && (!selectedClip || selectedClip.category !== 'visual' || selectedClip.type === 'graphic' || selectedClipCount !== 1)) {
      setError('Animation sólo modifica un Visual seleccionado; no cambia Original, Stock, audio ni gráficos.'); return
    }
    if (!connection?.authenticated) { setError('La sesión Codex no está disponible. Comprueba el inicio de sesión desde Codex y vuelve a intentar.'); return }
    const jobId = crypto.randomUUID()
    const fps = Number(projectFps) || 30
    const targetMode = selectedClip ? 'selected-visual' : 'new-visual-draft'
    const startSeconds = selectedClip ? selectedClip.startSeconds : Math.max(0, Math.floor(Number(currentTimeSeconds || 0) * fps) / fps)
    const durationSeconds = selectedClip ? Number(selectedClip.durationSeconds) : 3
    if (!selectedClip && projectDurationSeconds > 0 && startSeconds + durationSeconds > projectDurationSeconds + 1 / fps) {
      setError('Quedan menos de 3 segundos en ese punto. Mueve el cursor a un intervalo completo de Visuales.'); return
    }
    const targetClip = selectedClip || { id: `animation-new-${crypto.randomUUID()}`, name: 'Nuevo Visual desde el cursor', category: 'visual',
      type: 'video', startSeconds, durationSeconds, text: '' }
    beginAnimationJob(jobId, selectedClip?.id || null)
    pendingSourceId.current = selectedClip?.id || null
    setLastJobId(jobId); setProgress({ phase: 'starting', message: 'Preparando Animation…' }); setError(''); setBusy(true); setInput('')
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: request, createdAt: new Date().toISOString() }
    const withUser = [...messages, userMessage]
    persistConversation(withUser)
    try {
      const result = await window.electronAPI.animationGenerateDraft({ jobId, userMessage: request, targetMode,
        clip: { id: targetClip.id, name: targetClip.name, category: targetClip.category,
          startSeconds: targetClip.startSeconds, durationSeconds: targetClip.durationSeconds,
          text: targetClip.transcriptText || targetClip.text },
        transcriptSegments, threadId, projectContext: { durationSeconds: projectDurationSeconds, fps, format: projectFormat, timelineWeights },
        activeConfig: selectedClip && currentDraft?.selectedTimelineBinding?.clipId === selectedClip.id ? currentDraft.config : undefined,
        template: undefined, freshCodeOnly: true, referenceIds: references.map(ref => ref.id), styleProfile, fps })
      if (!animationJobIsCurrent(jobId)) return
      if (!result?.success) throw new Error(errorText(String(result?.error || 'ANIMATION_GENERATION_FAILED')))
      if (result.kind === 'answer') {
        const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: result.response || '', createdAt: new Date().toISOString() }
        persistConversation([...withUser, assistant], result.threadId || threadId)
        setProviderVerified(true); setStatusLabel('Inferencia comprobada · Codex app-server local (experimental).')
        setProgress(null); return
      }
      if (result.kind !== 'draft' || !result.draft || !result.clip) throw new Error('ANIMATION_DRAFT_RESULT_INCOMPLETE')
      const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: result.response || (selectedClip
        ? 'Borrador listo. Revisa la previsualización y aplícala al Visual seleccionado.'
        : 'Borrador listo en el intervalo del cursor. Revisa la previsualización y aplícalo para insertar un nuevo Visual sin tocar Original ni Stock.'), createdAt: new Date().toISOString() }
      const draft = { ...result.draft, clip: result.clip, targetMode, applied: false, generationMetrics: result.metrics }
      setCurrentDraft(draft)
      setProviderVerified(true); setStatusLabel('Inferencia comprobada · borrador generado con acción y lectura estable.')
      persistConversation([...withUser, assistant], result.draft.provider?.threadId || threadId,
        { activeDraftId: draft.draftId, activeStyle: draft.config?.style })
      setProgress(null)
    } catch (e: any) {
      if (cancelledJobIdsRef.current.has(jobId) || !animationJobIsCurrent(jobId)) {
        setStatusLabel('Creación cancelada; no se aplicó ninguna respuesta tardía al timeline.')
        return
      }
      const code = String(e?.message || 'ANIMATION_GENERATION_FAILED')
      const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: errorText(code), createdAt: new Date().toISOString() }
      persistConversation([...withUser, assistant])
      setError(errorText(code)); setProgress(null)
    } finally { finishAnimationJob(jobId); setBusy(false); setLastJobId(null) }
  }

  const continueWithStyle = async () => {
    if (!projectPath || busy) return
    setError('')
    try {
      const loaded = await window.electronAPI.animationLoadProject()
      if (!loaded.success) throw new Error(errorText(loaded.error || 'ANIMATION_PROJECT_LOAD_FAILED'))
      const profileStyle = { paletteId: styleProfile?.parameters?.paletteId || 'paper',
        titleFont: styleProfile?.parameters?.titleFontFamily === 'DM Sans' ? 'dmSans' : 'instrumentSerif',
        bodyFont: styleProfile?.parameters?.bodyFontFamily === 'Instrument Serif' ? 'instrumentSerif' : 'dmSans',
        titleScale: styleProfile?.parameters?.titleScale || 1, labelScale: styleProfile?.parameters?.labelScale || 1 }
      const saved = await window.electronAPI.animationSaveProject({ ...(loaded.state || {}),
        schema: 'cipher-animation-project-v1', conversation: messages, threadId, references, library: templates,
        activeDraftId: currentDraft?.draftId || null, activeStyle: profileStyle, styleProfile })
      if (!saved?.success) throw new Error(errorText(saved?.error || 'ANIMATION_PROJECT_SAVE_FAILED'))
      setStatusLabel('Estilo del proyecto guardado. Continúa con la construcción del timeline.')
      onContinueWithStyle?.()
    } catch (e: any) { setError(errorText(String(e?.message || e))) }
  }

  const cancel = async () => {
    const jobId = activeJobRef.current?.jobId || lastJobId
    if (!jobId) return
    await requestAnimationJobCancel(jobId)
  }

  const addReference = async (file: File) => {
    if (!projectPath) return
    const filePath = window.electronAPI.rutaDeFichero(file)
    if (!filePath) { setError('Cipher no pudo resolver la ruta del archivo.'); return }
    setError(''); setBusy(true); setStatusLabel('Materializando referencia dentro del proyecto…')
    try {
      const result = await window.electronAPI.animationAddReference(filePath)
      if (!result.success || !result.reference) throw new Error(errorText(result.error || 'ANIMATION_REFERENCE_FAILED'))
      const next = [...references, result.reference]
      setReferences(next)
      const saved = await window.electronAPI.animationLoadProject()
      const state = saved.state || {}
      await window.electronAPI.animationSaveProject({ ...state, conversation: messages, threadId, references: next,
        library: templates, activeDraftId: currentDraft?.draftId, activeStyle: currentDraft?.config?.style, styleProfile })
      setStatusLabel(providerVerified ? 'Referencia añadida al proyecto.' : 'Referencia añadida; se enviará con la siguiente instrucción.')
    } catch (e: any) { setError(errorText(String(e?.message || e))) }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = '' }
  }

  const applyDraft = async () => {
    if (!currentDraft?.clip) return
    if (!projectPath) { setError('Abre un proyecto para aplicar el borrador.'); return }
    const duration = Number(currentDraft.clip.durationSeconds)
    if (currentDraft.targetMode === 'new-visual-draft' && selectedClipCount === 0) {
      if (!canApplyNewVisualAt(Number(currentDraft.clip.startSeconds), duration)) {
        setError('Ese intervalo ya está ocupado. Elige un Visual existente de la misma duración o mueve el cursor a un hueco libre. No se reemplazará Original, Stock ni gráficos.'); return
      }
      const snapshot = { schema: 'cipher-animation-undo-snapshot-v1', projectPath, draftId: currentDraft.draftId,
        clipId: currentDraft.clip.id, previousClips: [], selectedTimelineClipIds,
        timelineClipOrder: timelineVideoClips.map((clip: any) => clip.id) }
      const loaded = await window.electronAPI.animationLoadProject()
      if (!loaded.success) { setError(errorText(loaded.error || 'ANIMATION_PROJECT_LOAD_FAILED')); return }
      const before = loaded.state || {}
      const stored = await window.electronAPI.animationSaveProject({ ...before, undoSnapshot: snapshot })
      if (!stored.success) { setError(errorText(stored.error || 'ANIMATION_UNDO_SNAPSHOT_SAVE_FAILED')); return }
      const ok = onApply({ ...currentDraft.clip, targetMode: 'new-visual-draft' }, currentDraft.clip.id)
      if (!ok) {
        await window.electronAPI.animationSaveProject({ ...before, undoSnapshot: before.undoSnapshot || null })
        setError('El proyecto o el intervalo cambió; no se insertó el nuevo Visual.'); return
      }
      const nextDraft = { ...currentDraft, undoSnapshot: snapshot, applied: true }
      setCurrentDraft(nextDraft)
      setStatusLabel('Animation insertado en un intervalo libre. Deshacer restaura el timeline anterior.')
      return
    }
    if (!selectedClip || selectedClipCount !== 1 || selectedClip.category !== 'visual' ||
        Math.abs(Number(selectedClip.durationSeconds) - duration) > 1 / (Number(projectFps) || 30)) {
      setError('Selecciona un Visual del mismo intervalo y duración; Original, Stock y gráficos quedan intactos.'); return
    }
    const canRetarget = currentDraft.targetMode === 'new-visual-draft'
    if (!canRetarget && pendingSourceId.current !== selectedClip.id) {
      setError('La selección del timeline cambió. Este borrador queda separado; selecciona de nuevo su Visual de origen.'); return
    }
    const sourceId = canRetarget ? selectedClip.id : pendingSourceId.current
    if (!sourceId) { setError('Este borrador no conserva un intervalo Visual válido.'); return }
    const targetStart = Number(selectedClip.startSeconds || 0), targetEnd = targetStart + duration
    const overlappingGraphics = timelineVideoClips.filter(clip => clip.type === 'graphic' &&
      targetStart < Number(clip.startSeconds || 0) + Number(clip.durationSeconds || 0) - 1 / (Number(projectFps) || 30) &&
      targetEnd > Number(clip.startSeconds || 0) + 1 / (Number(projectFps) || 30))
    const loaded = await window.electronAPI.animationLoadProject()
    if (!loaded.success) { setError(errorText(loaded.error || 'ANIMATION_PROJECT_LOAD_FAILED')); return }
    const before = loaded.state || {}
      const existingSnapshot = currentDraft.undoSnapshot || before.undoSnapshot
      const normalizePath = (value: unknown) => String(value || '').replace(/[\\/]+/g, '/').toLowerCase()
      const snapshotStillOwnsClip = existingSnapshot?.schema === 'cipher-animation-undo-snapshot-v1' &&
        normalizePath(existingSnapshot.projectPath) === normalizePath(projectPath) &&
        existingSnapshot.draftId === currentDraft.draftId && existingSnapshot.clipId === sourceId &&
        Array.isArray(existingSnapshot.previousClips) && (existingSnapshot.previousClips.length === 0 ||
          existingSnapshot.previousClips.some((clip: any) => clip.id === sourceId))
      // Re-rendering/reapplying the same already-bound draft must keep the original
      // pre-Animation snapshot. A different draft still snapshots the current media
      // so Undo returns exactly one visual revision.
      const snapshot = selectedClip.animationV1?.draftId === currentDraft.draftId && snapshotStillOwnsClip
        ? existingSnapshot
        : { schema: 'cipher-animation-undo-snapshot-v1', projectPath, draftId: currentDraft.draftId,
            clipId: sourceId, previousClips: [selectedClip, ...overlappingGraphics], selectedTimelineClipIds,
            timelineClipOrder: timelineVideoClips.map((clip: any) => clip.id) }
    const stored = await window.electronAPI.animationSaveProject({ ...before, undoSnapshot: snapshot })
    if (!stored.success) { setError(errorText(stored.error || 'ANIMATION_UNDO_SNAPSHOT_SAVE_FAILED')); return }
    const ok = onApply(currentDraft.clip, sourceId)
    if (!ok) {
      await window.electronAPI.animationSaveProject({ ...before, undoSnapshot: before.undoSnapshot || null })
      setError('No se aplicó porque la selección ya no coincide con el borrador.'); return
    }
    const nextDraft = { ...currentDraft, undoSnapshot: snapshot, applied: true }
    setCurrentDraft(nextDraft)
    setStatusLabel('Animation aplicado al Visual seleccionado. Deshacer restaura el medio anterior.')
  }

  const replayOffline = async () => {
    if (!currentDraft?.draftId || busy) return
    const jobId = crypto.randomUUID(); beginAnimationJob(jobId); setLastJobId(jobId); setBusy(true); setError(''); setProgress({ phase: 'replay', message: 'Reproduciendo plan guardado sin modelo…' })
    try {
      // render saved plan locally; no Codex request or catalogue lookup is made.
      const result = await window.electronAPI.animationReplayDraft({ draftId: currentDraft.draftId, jobId })
      if (!animationJobIsCurrent(jobId)) return
      if (!result.success || !result.rendered) throw new Error(result.error || 'ANIMATION_REPLAY_FAILED')
      setCurrentDraft((prev: any) => ({ ...prev, render: { ...prev.render, mediaAvailable: true, cacheMissing: false },
        clip: { ...prev.clip, path: result.rendered.path, url: result.rendered.url, mediaAvailable: true }, replay: result.rendered, applied: false }))
      setStatusLabel('Plan guardado regenerado offline desde Animation Canvas.')
    } catch (e: any) {
      if (!cancelledJobIdsRef.current.has(jobId) && animationJobIsCurrent(jobId)) setError(errorText(String(e?.message || e)))
    }
    finally { finishAnimationJob(jobId); setBusy(false); setLastJobId(null); setProgress(null) }
  }

  const undoAnimation = async () => {
    if (!projectPath) return
    try {
      const loaded = await window.electronAPI.animationLoadProject()
      if (!loaded.success) throw new Error(loaded.error || 'ANIMATION_PROJECT_LOAD_FAILED')
      const state = loaded.state || {}
      const snapshot = currentDraft?.undoSnapshot || state.undoSnapshot
      if (snapshot?.schema === 'cipher-animation-undo-snapshot-v1') {
        const sameProject = String(snapshot.projectPath).replace(/[\\/]+/g, '/').toLowerCase() === String(projectPath).replace(/[\\/]+/g, '/').toLowerCase()
        if (!sameProject || snapshot.draftId !== currentDraft?.draftId || typeof snapshot.clipId !== 'string' ||
            !Array.isArray(snapshot.previousClips) || snapshot.previousClips.some((clip: any) => !clip || typeof clip.id !== 'string') ||
            (snapshot.previousClips.length > 0 && !snapshot.previousClips.some((clip: any) => clip.id === snapshot.clipId)) ||
            (snapshot.timelineClipOrder !== undefined && (!Array.isArray(snapshot.timelineClipOrder) ||
              snapshot.timelineClipOrder.length > 2000 || snapshot.timelineClipOrder.some((id: any) => typeof id !== 'string') ||
              new Set(snapshot.timelineClipOrder).size !== snapshot.timelineClipOrder.length ||
              (snapshot.previousClips.length > 0 && !snapshot.timelineClipOrder.includes(snapshot.clipId))))) {
          throw new Error('ANIMATION_UNDO_SNAPSHOT_PROJECT_MISMATCH')
        }
        if (!onRestore(snapshot)) throw new Error('ANIMATION_UNDO_RESTORE_REJECTED')
        const saved = await window.electronAPI.animationSaveProject({ ...state, undoSnapshot: null })
        if (!saved.success) throw new Error(saved.error || 'ANIMATION_UNDO_SNAPSHOT_CLEAR_FAILED')
      } else {
        // Keep same-session undo working for older project states created before the
        // persisted Animation snapshot was introduced.
        onUndo()
      }
      setCurrentDraft((previous: any) => previous ? { ...previous, applied: false, undoSnapshot: null } : previous)
      setStatusLabel('Se restauró el estado anterior del Visual y del timeline.')
    } catch (e: any) { setError(errorText(String(e?.message || e))) }
  }

  const draftStillMatches = !!currentDraft?.clip && currentDraft.targetMode === 'new-visual-draft' && selectedClipCount === 0 &&
    canApplyNewVisualAt(Number(currentDraft.clip.startSeconds), Number(currentDraft.clip.durationSeconds)) ||
    !!currentDraft?.clip && selectedClipCount === 1 && selectedClip?.category === 'visual' &&
    selectedClip.type !== 'graphic' && Math.abs(Number(currentDraft.clip.durationSeconds) - Number(selectedClip.durationSeconds)) <= 1 / (Number(projectFps) || 30) &&
    (currentDraft.targetMode === 'new-visual-draft' || currentDraft.clip.id === selectedClip.id)
  const durationLabel = selectedClip ? `${Number(selectedClip.durationSeconds).toFixed(2)} s` : 'sin selección'
  const styleOnly = flowMode === 'style'
  const activeStyle = currentDraft?.config?.style || currentDraft?.scenePlan?.style || {}
  const activePalette = PALETTE_LABELS[styleProfile?.parameters?.paletteId] || styleProfile?.parameters?.paletteId || 'activa'
  const visualSlots = timelineVideoClips.filter((clip: any) => clip.type === 'video' && clip.category === 'visual')
    .sort((a: any, b: any) => Number(a.startSeconds || 0) - Number(b.startSeconds || 0))
  const pendingVisualSlots = visualSlots.filter((clip: any) => !clip.animationV1)
  const slotQuote = (clip: any) => transcriptSegments.filter((segment: any) =>
    Number(segment.end) > Number(clip.startSeconds || 0) && Number(segment.start) < Number(clip.startSeconds || 0) + Number(clip.durationSeconds || 0))
    .map((segment: any) => String(segment.text || '').trim()).filter(Boolean).join(' ').slice(0, 82)
  const timeLabel = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`

  return <div className="flex h-full min-h-0 flex-col overflow-y-auto pr-1 text-slate-100">
    {styleOnly ? <div className="mb-3 rounded-xl border border-indigo-500/25 bg-indigo-950/25 p-3">
      <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-300"/><strong className="text-xs">Animation · estilo del proyecto</strong></div>
      <label className="flex items-center gap-2 text-[9px] text-slate-400">
        Estilo activo · {activePalette}
        <select aria-label="Perfil de estilo Animation" value={styleProfile?.id || CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1.id}
          onChange={e => chooseStyleProfile(e.target.value)} disabled={busy}
          className="min-w-0 flex-1 rounded border border-[#45454a] bg-[#111113] px-1.5 py-1 text-[9px] text-slate-200">
          {styles.map(profile => <option key={profile.id} value={profile.id}>{profile.title} · v{profile.version}</option>)}
        </select>
      </label>
      <div className="mt-2 flex gap-1">
        {styleProfile?.id?.startsWith('style-') && <button type="button" onClick={() => { setRenameValue(styleProfile.title); setRenameEditing(value => !value) }} className="rounded border border-[#45454a] px-2 py-1 text-[9px] text-slate-300"><Pencil className="mr-1 inline h-3 w-3"/>Renombrar</button>}
        {styleProfile?.id?.startsWith('style-') && <button type="button" onClick={() => void deleteSelectedStyle()} className="rounded border border-red-700/50 px-2 py-1 text-[9px] text-red-200"><Trash2 className="mr-1 inline h-3 w-3"/>Eliminar de biblioteca</button>}
      </div>
      {renameEditing && <div className="mt-2 flex gap-1"><input value={renameValue} maxLength={80} onChange={event => setRenameValue(event.target.value)} aria-label="Nuevo nombre del estilo" className="min-w-0 flex-1 rounded border border-[#45454a] bg-[#111113] px-2 py-1 text-[10px] text-slate-100"/><button type="button" onClick={() => void renameSelectedStyle()} disabled={busy || !renameValue.trim()} className="rounded bg-indigo-700 px-2 py-1 text-[9px] text-white disabled:opacity-40">Guardar nombre</button></div>}
      <p className="mt-2 text-[9px] leading-relaxed text-slate-500">La copia del proyecto conserva la versión usada. Las escenas existentes mantienen su código; el perfil activo dirige los Visuales nuevos.</p>
    </div> : <div className="mb-3 rounded-xl border border-indigo-500/25 bg-indigo-950/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-300"/><strong className="text-xs">Animation · Canvas</strong></div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] ${providerVerified ? 'bg-emerald-900/60 text-emerald-200' : connection?.authenticated ? 'bg-amber-900/60 text-amber-200' : 'bg-slate-700 text-slate-300'}`}>
          {providerVerified ? 'Inferencia probada' : connection?.authenticated ? 'Sesión detectada' : connection?.available ? 'Sin sesión' : 'No disponible'}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">{statusLabel}</p>
      <div className="mt-2 border-t border-[#3a3a3c] pt-2 text-[10px] text-slate-300">
        Actúa sobre: <b>{selectedClipCount === 1 ? selectedClip?.name || 'clip seleccionado' : selectedClipCount > 1 ? `${selectedClipCount} clips seleccionados` : 'ningún clip'}</b> · {durationLabel}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-300">
        <label className="min-w-0 truncate">Estilo
          <select aria-label="Perfil de estilo Animation" value={styleProfile?.id || CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1.id}
            onChange={e => chooseStyleProfile(e.target.value)} disabled={busy}
            className="ml-1 max-w-[145px] rounded border border-[#45454a] bg-[#111113] px-1.5 py-1 text-[9px] text-slate-200">
            {styles.map(profile => <option key={profile.id} value={profile.id}>{profile.title} · v{profile.version}</option>)}
          </select>
        </label>
        <select aria-label="Alcance de los cambios de estilo" value={styleScope} onChange={e => setStyleScope(e.target.value as 'clip'|'project')}
          className="shrink-0 rounded border border-[#45454a] bg-[#111113] px-1.5 py-1 text-[9px] text-slate-200">
          <option value="clip">Sólo este Visual</option><option value="project">Proponer estilo para Visuales nuevos</option>
        </select>
      </div>
      {selectedClipCount > 1 && <p className="mt-1 text-[9px] text-amber-300">La primera versión modifica un Visual por operación; el resto queda intacto.</p>}
    </div>}

    {!styleOnly && visualSlots.length > 0 && <div className="mb-2 rounded-xl border border-[#3a3a3c] bg-[#171719] p-2">
      <div className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        <span>Slots Animation</span><span>{visualSlots.length - pendingVisualSlots.length}/{visualSlots.length} listos</span>
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {visualSlots.map((clip: any, index: number) => <button key={clip.id} type="button" onClick={() => onSelectVisualSlot(clip.id)}
          className={`w-full rounded-md border px-2 py-1.5 text-left ${clip.animationV1 ? 'border-emerald-900/70 bg-emerald-950/20' : 'border-amber-900/70 bg-amber-950/20'} ${selectedClip?.id === clip.id ? 'ring-1 ring-indigo-400' : ''}`}>
          <span className="mr-2 font-mono text-[9px] text-slate-400">{String(index + 1).padStart(2, '0')} · {timeLabel(Number(clip.startSeconds || 0))}</span>
          <span className="text-[9px] text-slate-200">{clip.animationV1 ? 'Listo' : 'Pendiente'} · {slotQuote(clip) || clip.name}</span>
        </button>)}
      </div>
      {pendingVisualSlots.length > 0 && <p className="mt-1 text-[8px] text-slate-500">Selecciona un slot para crear o reanudarlo; los ya aplicados permanecen guardados.</p>}
    </div>}

    <div className="mb-2 flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"><MessageSquare className="mr-1 inline h-3 w-3"/>{styleOnly ? 'Estilo del proyecto' : 'Chat del proyecto'}</span>
      <button type="button" onClick={() => fileInput.current?.click()} disabled={!projectPath || busy}
        className="rounded-md border border-[#3a3a3c] px-2 py-1 text-[10px] text-slate-300 hover:border-indigo-400 disabled:opacity-40">
        <Paperclip className="mr-1 inline h-3 w-3"/>Referencia
      </button>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,video/x-msvideo" hidden
        onChange={e => { const file = e.target.files?.[0]; if (file) void addReference(file) }} />
    </div>
    {references.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{references.map(ref => <span key={ref.id} className="rounded bg-slate-800 px-2 py-1 text-[9px] text-slate-300">{ref.name}{ref.kind === 'video' ? ` · ${(ref.frames || []).map((f: any) => `${f.timeSec}s`).join('/')}` : ''}</span>)}</div>}

    <div className={`flex-1 min-h-[130px] space-y-3 overflow-y-auto rounded-xl border border-[#3a3a3c] bg-[#111113] p-3 ${currentDraft ? 'max-h-[155px]' : ''}`}>
      {messages.length === 0 && <div className="rounded-lg border border-dashed border-[#45454a] p-3 text-[10px] leading-relaxed text-slate-400">
        {styleOnly ? <>
          <p className="mb-1 text-slate-200">Describe una dirección visual o adjunta referencias.</p>
          <p>Codex propone un perfil editable; revisa su alcance antes de guardarlo.</p>
        </> : <>
          <p className="mb-1 text-slate-200">Indica qué debe entenderse en la escena.</p>
          <p>Ejemplos: «organiza las dos causas y muestra su resultado», «cambia la paleta a jardín y usa sans serif», «reordena la entrada sin cambiar el resto».</p>
          <p className="mt-2">Con un Visual seleccionado se usa ese intervalo. Sin selección, el borrador parte del cursor por 3 s y sólo se inserta si todo el intervalo está libre; si está ocupado, se conserva Original, Stock y gráficos y puedes elegir un Visual compatible.</p>
        </>}
      </div>}
      {messages.map(msg => <div key={msg.id} className={`max-w-[95%] rounded-lg p-2 text-[11px] leading-relaxed ${msg.role === 'user' ? 'ml-auto bg-indigo-700/50 text-white' : 'bg-[#242426] text-slate-200'}`}>
        <div className="mb-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">{msg.role === 'user' ? 'Tú' : 'Animation'}</div>{msg.text}
      </div>)}
      {busy && <div className="flex items-center gap-2 text-[10px] text-indigo-200"><LoaderCircle className="h-3 w-3 animate-spin"/>{progress?.message || 'Trabajando…'}</div>}
      <div ref={conversationEnd}/>
    </div>

    {error && <div role="alert" className="mt-2 rounded-lg border border-red-700/50 bg-red-950/30 p-2 text-[10px] text-red-200">{error}</div>}
    {!styleOnly && savedDrafts.length > 0 && <div className="mt-3 rounded-xl border border-indigo-500/25 bg-indigo-950/10 p-2">
      <div className="mb-1 text-[9px] font-semibold uppercase text-slate-400">Borradores guardados para este Visual</div>
      <div className="space-y-1">
        {savedDrafts.map(draft => <button key={draft.draftId} type="button" data-animation-draft-id={draft.draftId}
          onClick={() => void openSavedDraft(draft.draftId)} disabled={busy}
          className="block w-full rounded-lg border border-[#38383d] px-2 py-1.5 text-left text-[9px] text-slate-200 hover:border-indigo-400 disabled:opacity-40">
          <span className="mr-1 text-indigo-200">Abrir borrador guardado</span>
          <span>{draft.quote || draft.purpose || draft.draftId}</span>
          <span className="ml-1 text-slate-500">{draft.applied ? '· aplicado' : draft.previewAvailable ? '· preview disponible' : '· requiere regenerar preview'}</span>
        </button>)}
      </div>
    </div>}
    {!styleOnly && currentDraft && <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-2">
      <div className="flex items-center justify-between gap-2">
        <strong className="truncate text-[10px] text-emerald-100">Borrador · {currentDraft.config?.recipeId}</strong>
        <span className="shrink-0 text-[9px] text-slate-400">{currentDraft.scenePlan?.clock?.durationSec?.toFixed(2)} s · {currentDraft.generationMetrics?.frames || currentDraft.render?.frameCount} frames</span>
      </div>
      {currentDraft.render?.cacheMissing === true
        ? <div className="mt-2 rounded-lg border border-amber-600/30 bg-amber-950/20 p-2 text-[10px] text-amber-100">Falta sólo la caché de preview. Regenera desde el plan y código guardados para verla sin proveedor ni catálogo.</div>
        : <video key={currentDraft.clip?.url} src={currentDraft.clip?.url} controls playsInline preload="metadata"
          className="mt-2 max-h-[250px] w-full rounded-lg bg-black" />}
      <p className="mt-2 text-[10px] text-slate-300">{currentDraft.config?.content?.proposition || currentDraft.scenePlan?.scene?.summary}</p>
      <p className="mt-1 text-[9px] text-slate-400">Estilo activo: {PALETTE_LABELS[activeStyle.paletteId] || activeStyle.paletteId || 'sin fijar'} · etiquetas ×{activeStyle.labelScale || 1}</p>
      <p className="mt-1 text-[9px] text-slate-500">Plan {currentDraft.planHash?.slice(0, 12)} · receta v{currentDraft.provenance?.recipeVersion || currentDraft.config?.revision} · hecho desde {currentDraft.provider?.provider || currentDraft.provider?.id || 'Codex local'}</p>
       {!draftStillMatches && <p className="mt-2 text-[9px] text-amber-300">Selecciona el Visual de origen o un intervalo Visual compatible de {currentDraft.clip.durationSeconds?.toFixed(2)} s. También puedes insertar en un hueco libre. Original, Stock y gráficos nunca se sustituyen.</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={applyDraft} disabled={busy || !draftStillMatches || currentDraft.applied}
          className="rounded-lg bg-emerald-700 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-40">
          {currentDraft.targetMode === 'new-visual-draft' && selectedClipCount === 0 ? 'Insertar Visual en el intervalo libre' : 'Aplicar al Visual seleccionado'}
        </button>
        <button type="button" onClick={undoAnimation} className="rounded-lg border border-[#45454a] px-2 py-2 text-[10px] text-slate-200 hover:border-amber-400">
          <Undo2 className="mr-1 inline h-3 w-3"/>Deshacer</button>
        <button type="button" onClick={() => void replayOffline()} disabled={busy}
          className="rounded-lg border border-[#45454a] px-2 py-2 text-[10px] text-slate-200 disabled:opacity-40">
          <RefreshCw className="mr-1 inline h-3 w-3"/>Regenerar offline</button>
        <span className="rounded-lg border border-[#303034] px-2 py-2 text-center text-[9px] text-slate-400">{currentDraft.applied ? 'Aplicado al timeline' : 'Pendiente de revisión'}</span>
      </div>
    </div>}

    {styleOnly && styleProposal && <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
      <div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-emerald-100">Propuesta Codex · {styleProposal.title} · v{styleProposal.version}</strong>
        <span className="text-[8px] text-slate-400">{styleProposal.metrics?.calls || 1} llamada · {styleProposal.metrics?.directionMs ?? '—'} ms</span></div>
      <p className="mt-1 text-[9px] text-slate-300">{styleProposal.description}</p>
      {styleProposal.reference?.referenceAnalysis && <p className="mt-1 text-[9px] text-slate-400">Lectura de referencia: {styleProposal.reference.referenceAnalysis}</p>}
      <p className="mt-2 rounded bg-amber-950/40 p-2 text-[9px] text-amber-100">Alcance: al activar, este perfil queda copiado en el proyecto y se usa para Visuales nuevos. Las escenas existentes mantienen código y versión.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void saveStyleProposal('new')} disabled={busy} className="rounded bg-indigo-700 px-2 py-2 text-[9px] text-white disabled:opacity-40"><Save className="mr-1 inline h-3 w-3"/>Guardar como estilo nuevo</button>
        <button type="button" onClick={() => void saveStyleProposal('update')} disabled={busy || !styleProfile?.id?.startsWith('style-')} className="rounded border border-indigo-500/50 px-2 py-2 text-[9px] text-indigo-100 disabled:opacity-40">Guardar como actualización</button>
      </div>
    </div>}

    <form onSubmit={send} className="mt-3 flex flex-col gap-2">
      <textarea value={input} onChange={e => setInput(e.target.value)} maxLength={4000} rows={3} disabled={!projectPath || busy}
          placeholder={styleOnly ? 'Describe estilo, composición, color o movimiento…' : selectedClip ? 'Describe la escena o el cambio visual…' : `Crea desde ${Number(currentTimeSeconds || 0).toFixed(2)} s o pregunta por el estilo…`}
        className="w-full resize-y rounded-xl border border-[#45454a] bg-[#111113] p-2.5 text-[11px] text-slate-100 outline-none focus:border-indigo-500 disabled:opacity-50" />
      <div className="flex gap-2">
        {busy ? <button type="button" onClick={() => void cancel()} className="flex-1 rounded-lg border border-red-500/50 px-3 py-2 text-[10px] text-red-200">
          <Square className="mr-1 inline h-3 w-3"/>Cancelar</button> : <button type="submit" disabled={!input.trim() || (!styleOnly && !connection?.authenticated) || !projectPath || (!styleOnly && selectedClipCount > 0 && !selectedClip)}
          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">
          <Play className="mr-1 inline h-3 w-3"/>{styleOnly ? 'Enviar' : 'Crear / consultar'}</button>}
        {!styleOnly && progress && <span className="max-w-[42%] self-center truncate text-[9px] text-slate-400">{progress.phase}</span>}
      </div>
    </form>
    {styleOnly && <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => void continueWithStyle()} disabled={busy || !projectPath}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">Usar estilo activo</button>
      <button type="button" onClick={() => onBackToAudio?.()} disabled={busy}
        className="rounded-lg border border-[#45454a] px-3 py-2 text-[10px] font-semibold text-slate-200 disabled:opacity-40">Volver al audio</button>
    </div>}
    {!styleOnly && <p className="mt-2 text-[8px] leading-relaxed text-slate-500">Proveedor local: Codex app-server stdio {providerVerified ? '· inferencia comprobada durante esta sesión' : connection?.authenticated ? '· inicio de sesión detectado; la inferencia se comprobará al enviar' : ''}. App-server es experimental; las escenas se guardan y reproducen offline con el contrato Animation.</p>}
  </div>
}
