/**
 * Compatibility boundary for timeline chart rendering.
 *
 * New Visuales are created and rendered by the Animation chat. This module keeps the
 * generic chart IPC contract used by overlays, while explicitly rejecting every retired
 * Visual type and persisted SceneSpec. It intentionally has no catalog, asset retrieval,
 * image recovery, SceneSpec renderer, or fallback path.
 */
export class VisualAssetRenderError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'VisualAssetRenderError'
  }
}

export type PreparedGraphicRender = {
  kind: 'chart'
  graphicData: unknown
}

function rejectRetiredVisual(): never {
  throw new VisualAssetRenderError(
    'LEGACY_VISUAL_GENERATOR_DISABLED',
    'Los Visuales históricos se reproducen desde sus clips materializados; Animation crea los nuevos.',
    { engine: 'animation-chat', fallbackUsed: false },
  )
}

/** Generic chart data is passed through; Visuales and SceneSpecs cannot be regenerated here. */
export function prepareGraphicForVisualRender(input: {
  graphicData: unknown
  projectRoot?: unknown
  renderBindings?: unknown
}): PreparedGraphicRender {
  const graphic = input.graphicData && typeof input.graphicData === 'object'
    ? input.graphicData as Record<string, unknown> : {}
  const extra = graphic.extra && typeof graphic.extra === 'object' && !Array.isArray(graphic.extra)
    ? graphic.extra as Record<string, unknown> : {}

  if ((typeof graphic.type === 'string' && graphic.type.startsWith('visual_')) ||
      Object.prototype.hasOwnProperty.call(extra, 'sceneSpec')) {
    return rejectRetiredVisual()
  }

  return { kind: 'chart', graphicData: input.graphicData }
}