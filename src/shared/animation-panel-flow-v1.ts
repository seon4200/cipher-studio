export type AnimationPanelTargetV1 = {
  tool: 'animation' | 'subtitles' | null
  mode: 'style' | 'scene'
}

/** Resume the user's narration flow without mistaking a transcript for applied audio. */
export function resolveAnimationPanelFlowV1(
  timeline: readonly { type?: string; narration?: boolean; name?: string }[] = [],
  transcriptSegments: readonly unknown[] = [],
): AnimationPanelTargetV1 {
  const narrationApplied = timeline.some(clip => clip.type === 'audio' &&
    (clip.narration === true || /^voz\s*-/i.test(String(clip.name || ''))))
  if (narrationApplied) return { tool: 'animation', mode: 'style' }
  if (transcriptSegments.length > 0) return { tool: 'subtitles', mode: 'scene' }
  return { tool: null, mode: 'scene' }
}
