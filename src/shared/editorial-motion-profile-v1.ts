import {
  createVisualLayoutV4,
  eligibleLayoutFamiliesV4,
  type ModernLayoutStructureV4,
  type SceneSlotIdV2,
  type SlotLayoutV4,
  type VisualLayoutV4,
} from './visual-layout-v4'
import type { PercentRectV3 } from './visual-layout-v3'

/** An opt-in pixel contract. Historical V15 specs omit this field entirely. */
export const EDITORIAL_MOTION_PROFILE_V1 = Object.freeze({
  id: 'editorial-hybrid-v1' as const,
  revision: 'editorial-hybrid-pilot-2026-09-v1' as const,
})
export type EditorialMotionProfileV1 = typeof EDITORIAL_MOTION_PROFILE_V1
export const EDITORIAL_MOTION_PROFILE_V2 = Object.freeze({
  id: 'editorial-hybrid-v1' as const,
  revision: 'editorial-hybrid-pilot-2026-09-v2' as const,
})
/** New scenes only. A persisted V1/V2 profile continues through its original renderer. */
export const VISUAL_RECOVERY_PROFILE_V1 = Object.freeze({
  id: 'visual-recovery-v1' as const,
  revision: 'visual-recovery-2026-09-v1' as const,
})
export const PREMIUM_TYPE_COLOR_PROFILE_V1 = Object.freeze({
  id: 'premium-type-color-v1' as const,
  revision: 'porcelain-editorial-2026-09-v1' as const,
})
export const FAMILIES_MOTION_PROFILE_V2 = Object.freeze({
  id: 'families-motion-v2' as const, revision: 'families-motion-2026-09-v1' as const,
})
export type EditorialMotionProfile = EditorialMotionProfileV1 | typeof EDITORIAL_MOTION_PROFILE_V2 |
  typeof VISUAL_RECOVERY_PROFILE_V1 | typeof PREMIUM_TYPE_COLOR_PROFILE_V1 | typeof FAMILIES_MOTION_PROFILE_V2
export const EDITORIAL_MOTION_CUES = ['protagonist', 'comparison', 'process', 'cause', 'datum', 'typographic'] as const
export type EditorialMotionCue = typeof EDITORIAL_MOTION_CUES[number]

export const EDITORIAL_PILOT_FAMILIES = [
  'editorial', 'marcoPoster', 'partidoVertical', 'cintaDiagonal', 'cuaderno', 'lineaTiempo',
] as const satisfies readonly ModernLayoutStructureV4[]

export function validateEditorialMotionProfileV1(value: unknown): EditorialMotionProfileV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== 'id|revision' ||
      (value as EditorialMotionProfileV1).id !== EDITORIAL_MOTION_PROFILE_V1.id ||
      (value as EditorialMotionProfileV1).revision !== EDITORIAL_MOTION_PROFILE_V1.revision)
    throw new Error('EDITORIAL_MOTION_PROFILE_INVALID')
  return value as EditorialMotionProfileV1
}

export function validateEditorialMotionProfile(value: unknown): EditorialMotionProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== 'id|revision' ||
      !((value as EditorialMotionProfile).id === EDITORIAL_MOTION_PROFILE_V1.id &&
        ((value as EditorialMotionProfile).revision === EDITORIAL_MOTION_PROFILE_V1.revision ||
         (value as EditorialMotionProfile).revision === EDITORIAL_MOTION_PROFILE_V2.revision) ||
        (value as EditorialMotionProfile).id === VISUAL_RECOVERY_PROFILE_V1.id &&
        (value as EditorialMotionProfile).revision === VISUAL_RECOVERY_PROFILE_V1.revision ||
        (value as EditorialMotionProfile).id === PREMIUM_TYPE_COLOR_PROFILE_V1.id &&
        (value as EditorialMotionProfile).revision === PREMIUM_TYPE_COLOR_PROFILE_V1.revision ||
        (value as EditorialMotionProfile).id === FAMILIES_MOTION_PROFILE_V2.id &&
        (value as EditorialMotionProfile).revision === FAMILIES_MOTION_PROFILE_V2.revision))
    throw new Error('EDITORIAL_MOTION_PROFILE_INVALID')
  return value as EditorialMotionProfile
}

/** Only five geometries change; all other eligible families retain V4 geometry. */
export const VISUAL_RECOVERY_REFINED_FAMILIES = [
  'editorial', 'marcoPoster', 'partidoVertical', 'cintaDiagonal', 'lineaTiempo',
] as const satisfies readonly ModernLayoutStructureV4[]

export function createVisualRecoveryLayoutV1(
  family: ModernLayoutStructureV4,
  visualMode: 'asset-led' | 'editorial-text',
  supportCount: number,
  seed: number,
  cue: EditorialMotionCue,
): VisualLayoutV4 {
  const base = createVisualLayoutV4(family, visualMode, supportCount, seed)
  if (!VISUAL_RECOVERY_REFINED_FAMILIES.includes(family as typeof VISUAL_RECOVERY_REFINED_FAMILIES[number]))
    return base
  const change = (textRegion: VisualLayoutV4['textRegion'], textBounds: PercentRectV3,
    textAlignment: VisualLayoutV4['textAlignment'], slots: SlotLayoutV4[]): VisualLayoutV4 => ({
    ...base, textRegion, textBounds, textAlignment,
    slotLayouts: slots.filter(item => base.slotLayouts.some(active => active.slotId === item.slotId)),
  })
  if (family === 'editorial') return change('center-editorial', rect(8, 13, 84, 74), 'left', [])
  if (family === 'marcoPoster') return cue === 'datum'
    ? change('left', rect(8, 16, 53, 67), 'left', [
      slot('hero', 'right-dominant', rect(61, 24, 32, 48), 4),
      slot('support-1', 'right-dominant', rect(72, 72, 19, 15), 5),
      slot('support-2', 'right-dominant', rect(74, 10, 17, 13), 6),
    ])
    : change('top', rect(8, 9, 84, 28), 'left', [
      slot('hero', 'integrated', rect(12, 38, 76, 47), 4),
      slot('support-1', 'left-dominant', rect(8, 68, 24, 18), 5),
      slot('support-2', 'right-dominant', rect(70, 68, 22, 18), 6),
    ])
  if (family === 'partidoVertical') {
    const left = seed % 2 === 0
    return change(left ? 'right' : 'left', left ? rect(55, 23, 38, 58) : rect(7, 23, 38, 58),
      left ? 'left' : 'right', [
        slot('hero', left ? 'left-dominant' : 'right-dominant', left ? rect(7, 17, 43, 61) : rect(50, 17, 43, 61), 4),
        slot('support-1', left ? 'right-dominant' : 'left-dominant', left ? rect(67, 72, 23, 15) : rect(10, 72, 23, 15), 5),
        slot('support-2', left ? 'right-dominant' : 'left-dominant', left ? rect(75, 10, 17, 13) : rect(8, 10, 17, 13), 6),
      ])
  }
  if (family === 'cintaDiagonal') return change('bottom', rect(8, 61, 84, 29), 'left', [
    slot('hero', 'integrated', rect(37, 12, 55, 51), 4, 'none', -3),
    slot('support-1', 'left-dominant', rect(8, 28, 23, 19), 5),
    slot('support-2', 'right-dominant', rect(71, 47, 21, 17), 5),
  ])
  return change('timeline-caption', rect(8, 66, 84, 24), 'left', [
    slot('hero', 'left-dominant', rect(6, 17, 30, 40), 5),
    slot('support-1', 'center-dominant', rect(38, 24, 25, 32), 5),
    slot('support-2', 'right-dominant', rect(67, 30, 26, 29), 5),
  ])
}

const rect = (x: number, y: number, width: number, height: number): PercentRectV3 => ({ x, y, width, height })
const slot = (slotId: SceneSlotIdV2, placement: SlotLayoutV4['placement'], envelope: PercentRectV3,
  zIndex: SlotLayoutV4['zIndex'], backing: SlotLayoutV4['backing'] = 'none',
  rotationDeg = 0): SlotLayoutV4 => ({
  slotId, placement, envelope, zIndex, backing, rotationDeg, opacity: 1, crop: 'none',
})

/** Layout grammar for the six certified pilot families; no synthetic Support placeholders. */
export function createEditorialPilotLayoutV1(
  family: ModernLayoutStructureV4,
  visualMode: 'asset-led' | 'editorial-text',
  supportCount: number,
  seed: number,
): VisualLayoutV4 {
  // Keep the existing eligibility and seed validation as the only authority.
  const baseline = createVisualLayoutV4(family, visualMode, supportCount, seed)
  if (!EDITORIAL_PILOT_FAMILIES.includes(family as typeof EDITORIAL_PILOT_FAMILIES[number])) return baseline
  const ids = new Set(baseline.slotLayouts.map(item => item.slotId))
  const make = (textRegion: VisualLayoutV4['textRegion'], textBounds: PercentRectV3,
    textAlignment: VisualLayoutV4['textAlignment'], values: SlotLayoutV4[]): VisualLayoutV4 => ({
    ...baseline, textRegion, textBounds, textAlignment,
    slotLayouts: values.filter(item => ids.has(item.slotId)),
  })
  if (family === 'editorial') return make('center-editorial', rect(8, 19, 84, 63), 'left', [])
  if (family === 'marcoPoster') return make('top', rect(8, 9, 84, 23), 'left', [
    slot('hero', 'integrated', rect(15, 34, 70, 49), 4),
    slot('support-1', 'left-dominant', rect(6, 64, 22, 18), 6),
    slot('support-2', 'right-dominant', rect(73, 64, 21, 18), 6),
  ])
  if (family === 'partidoVertical') {
    const left = seed % 2 === 0
    return make(left ? 'right' : 'left', left ? rect(55, 12, 39, 46) : rect(6, 12, 39, 46),
      left ? 'left' : 'right', [
        slot('hero', left ? 'left-dominant' : 'right-dominant', left ? rect(7, 15, 44, 63) : rect(49, 15, 44, 63), 4),
        slot('support-1', left ? 'right-dominant' : 'left-dominant', left ? rect(58, 63, 22, 19) : rect(20, 63, 22, 19), 5),
        slot('support-2', left ? 'right-dominant' : 'left-dominant', left ? rect(77, 72, 16, 14) : rect(7, 72, 16, 14), 6),
      ])
  }
  if (family === 'cintaDiagonal') return make('bottom', rect(8, 60, 84, 30), 'left', [
    slot('hero', 'integrated', rect(38, 12, 55, 52), 4, 'none', -3),
    slot('support-1', 'left-dominant', rect(8, 33, 24, 20), 5),
    slot('support-2', 'right-dominant', rect(70, 48, 22, 17), 5),
  ])
  if (family === 'cuaderno') return make('left', rect(8, 37, 39, 43), 'left', [
    slot('hero', 'document-field', rect(50, 16, 43, 56), 4),
    slot('support-1', 'left-dominant', rect(8, 14, 29, 20), 5),
    slot('support-2', 'right-dominant', rect(68, 73, 21, 15), 5),
  ])
  return make('timeline-caption', rect(8, 65, 84, 24), 'left', [
    slot('hero', 'left-dominant', rect(6, 18, 30, 39), 5),
    slot('support-1', 'center-dominant', rect(37, 25, 26, 32), 5),
    slot('support-2', 'right-dominant', rect(66, 31, 27, 29), 5),
  ])
}

/** New revision only. V1's exact geometry remains the historical dispatch. */
export function createEditorialPilotLayoutV2(
  family: ModernLayoutStructureV4,
  visualMode: 'asset-led' | 'editorial-text',
  supportCount: number,
  seed: number,
  cue: EditorialMotionCue,
): VisualLayoutV4 {
  const old = createEditorialPilotLayoutV1(family, visualMode, supportCount, seed)
  const replace = (textRegion: VisualLayoutV4['textRegion'], textBounds: PercentRectV3,
    textAlignment: VisualLayoutV4['textAlignment'], values: SlotLayoutV4[]): VisualLayoutV4 => ({
    ...old, textRegion, textBounds, textAlignment,
    slotLayouts: values.filter(item => old.slotLayouts.some(current => current.slotId === item.slotId)),
  })
  if (family === 'editorial') return replace('center-editorial', rect(8, 15, 84, 70), 'left', [])
  if (family === 'partidoVertical' && cue === 'comparison' && supportCount > 0)
    return replace('bottom', rect(8, 68, 84, 23), 'left', [
      slot('hero', 'left-dominant', rect(7, 15, 43, 47), 4),
      slot('support-1', 'right-dominant', rect(57, 16, 34, 45), 5),
      slot('support-2', 'right-dominant', rect(75, 62, 17, 13), 6),
    ])
  if (family === 'partidoVertical') {
    const left = seed % 2 === 0
    return replace(left ? 'right' : 'left', left ? rect(55, 34, 39, 29) : rect(6, 34, 39, 29),
      left ? 'left' : 'right', [
        slot('hero', left ? 'left-dominant' : 'right-dominant', left ? rect(7, 27, 44, 53) : rect(49, 27, 44, 53), 4),
        slot('support-1', left ? 'right-dominant' : 'left-dominant', left ? rect(56, 64, 24, 20) : rect(20, 64, 24, 20), 5),
        slot('support-2', left ? 'right-dominant' : 'left-dominant', left ? rect(78, 68, 16, 16) : rect(6, 68, 16, 16), 6),
      ])
  }
  if (family === 'cuaderno') return replace('top', rect(8, 18, 84, 25), 'left', [
    slot('hero', 'document-field', rect(39, 42, 54, 45), 4),
    slot('support-1', 'left-dominant', rect(7, 48, 33, 29), 5),
    slot('support-2', 'left-dominant', rect(8, 73, 25, 15), 6),
  ])
  if (family === 'marcoPoster' && cue === 'datum') return replace('left', rect(8, 17, 52, 61), 'left', [
    slot('hero', 'right-dominant', rect(62, 33, 30, 38), 4),
    slot('support-1', 'right-dominant', rect(70, 72, 21, 17), 5),
    slot('support-2', 'right-dominant', rect(72, 15, 19, 17), 6),
  ])
  if (family === 'marcoPoster') return replace('top', rect(8, 8, 84, 21), 'left', [
    slot('hero', 'integrated', rect(10, 31, 80, 54), 4),
    slot('support-1', 'left-dominant', rect(7, 64, 26, 22), 5),
    slot('support-2', 'right-dominant', rect(69, 66, 24, 21), 6),
  ])
  return old
}

/** Semantic eligibility remains V4's; the profile only limits its own presentation menu. */
export function selectEditorialPilotFamilyV1(input: {
  visualMode: 'asset-led' | 'editorial-text'
  supportCount: number
  relation?: string
  sceneId: string
  seed: number
  recentFamilies?: readonly ModernLayoutStructureV4[]
}): ModernLayoutStructureV4 {
  const eligible = eligibleLayoutFamiliesV4(input).filter(value =>
    EDITORIAL_PILOT_FAMILIES.includes(value as typeof EDITORIAL_PILOT_FAMILIES[number]))
  if (!eligible.length) throw new Error('EDITORIAL_PILOT_NO_ELIGIBLE_FAMILY')
  // Relation-specific grammar is useful only when the existing V4 eligibility
  // certifies real slots. In particular, timeline never gets empty milestones.
  const relation = (input.relation ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/(secuencia|antes|despues|evoluciona)/.test(relation) && eligible.includes('lineaTiempo'))
    return 'lineaTiempo'
  if (/(compara|contrasta)/.test(relation) && eligible.includes('partidoVertical'))
    return 'partidoVertical'
  let hash = 2166136261
  for (const char of `${input.sceneId}|${input.seed}|editorial-hybrid-v1`) {
    hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619)
  }
  const first = eligible[(hash >>> 0) % eligible.length]
  const recent = input.recentFamilies?.slice(-2) ?? []
  return recent.length === 2 && recent.every(value => value === first)
    ? eligible.find(value => value !== first) ?? first : first
}
