import { createVisualRecoveryLayoutV1, type EditorialMotionCue } from './editorial-motion-profile-v1'
import { createVisualLayoutV4, type ModernLayoutStructureV4, type SceneSlotIdV2,
  type VisualLayoutV4 } from './visual-layout-v4'
import type { PercentRectV3 } from './visual-layout-v3'

/** A separate opt-in pixel contract. Never mutate the previous profile's revision. */
export const COMPOSITION_V2_REVISION = 'composition-17-2026-09-v1' as const
export const COMPOSITION_VARIANTS_V2 = [
  'hero-left', 'hero-right', 'hero-center', 'split-comparison', 'data-dominant',
  'process-steps', 'timeline', 'poster', 'full-raster-context', 'type-led',
  'cutout-cluster', 'quote-statement',
] as const
export type CompositionVariantV2 = typeof COMPOSITION_VARIANTS_V2[number]
export const BACKGROUND_VARIANTS_V2 = [
  'solid-deep', 'soft-radial', 'directional-gradient', 'subtle-grid',
  'fine-lines', 'soft-vignette', 'editorial-shape', 'image-aware-darkening',
] as const
export type BackgroundVariantV2 = typeof BACKGROUND_VARIANTS_V2[number]
export const MOTION_PRIMITIVES_V2 = [
  'slideSoft', 'maskReveal', 'scaleSettle', 'lineDraw', 'wordReveal',
  'staggerCluster', 'fadeLift', 'pairedCompare', 'timelineBuild',
] as const
export type MotionPrimitiveV2 = typeof MOTION_PRIMITIVES_V2[number]
export const MOTION_CUES_V2 = [
  'object', 'photo', 'data', 'comparison', 'process', 'timeline', 'statement', 'type-led',
] as const
export type MotionCueV2 = typeof MOTION_CUES_V2[number]
export const ACCENT_GRAPHICS_V2 = [
  'underline', 'bracket', 'divider', 'connector', 'directional-line',
  'progress-line', 'numeric-marker', 'label', 'corner-frame', 'editorial-block',
] as const
export type AccentGraphicV2 = typeof ACCENT_GRAPHICS_V2[number]

export type CompositionV2 = {
  revision: typeof COMPOSITION_V2_REVISION
  layoutVariant: CompositionVariantV2
  landscapeLayout: VisualLayoutV4
  backgroundVariant: BackgroundVariantV2
  motionCue: MotionCueV2
  motionVariant: MotionPrimitiveV2
  accentGraphics: AccentGraphicV2[]
}

const rect = (x: number, y: number, width: number, height: number): PercentRectV3 => ({ x, y, width, height })
const envelope = (layout: VisualLayoutV4, slotId: SceneSlotIdV2, value: PercentRectV3): void => {
  const item = layout.slotLayouts.find(slot => slot.slotId === slotId)
  if (item) item.envelope = value
}
const withoutUniversalBacking = (layout: VisualLayoutV4): void => {
  layout.slotLayouts = layout.slotLayouts.map(item => ({ ...item, backing: 'none', rotationDeg: 0, opacity: 1,
    crop: 'none' as const }))
}

export function compositionVariantV2(family: ModernLayoutStructureV4, cue: EditorialMotionCue,
  heroKind?: string): CompositionVariantV2 {
  if (family === 'editorial') return cue === 'datum' ? 'data-dominant'
    : cue === 'typographic' ? 'type-led' : 'quote-statement'
  if (cue === 'datum') return 'data-dominant'
  if (family === 'lineaTiempo') return 'timeline'
  if (cue === 'comparison' && family === 'partidoVertical') return 'split-comparison'
  if ((cue === 'process' || cue === 'cause') &&
    ['cascada', 'pilaVertical', 'cuaderno'].includes(family)) return 'process-steps'
  if (heroKind === 'raster-image' && ['marcoPoster', 'partidoVertical'].includes(family)) return 'full-raster-context'
  if (heroKind === 'photo-cutout' && ['marcoPoster', 'partidoVertical', 'cintaDiagonal'].includes(family)) return 'cutout-cluster'
  if (family === 'marcoPoster' || family === 'cuaderno') return 'poster'
  if (family === 'cintaDiagonal' || family === 'capasApiladas' || family === 'corteTransversal' || family === 'cascada') return 'hero-left'
  if (family === 'partidoVertical' || family === 'pilaVertical') return 'hero-right'
  return 'hero-center'
}

/** Two actual percentage layouts are persisted; the renderer only chooses the orientation. */
export function createCompositionLayoutV2(family: ModernLayoutStructureV4,
  mode: 'asset-led' | 'editorial-text', supportCount: number, seed: number,
  cue: EditorialMotionCue, heroKind: string | undefined, orientation: 'portrait' | 'landscape'): VisualLayoutV4 {
  const base = ['editorial', 'marcoPoster', 'partidoVertical', 'cintaDiagonal', 'lineaTiempo'].includes(family)
    ? createVisualRecoveryLayoutV1(family, mode, supportCount, seed, cue)
    : createVisualLayoutV4(family, mode, supportCount, seed)
  const layout: VisualLayoutV4 = { ...base, textBounds: { ...base.textBounds },
    slotLayouts: base.slotLayouts.map(item => ({ ...item, envelope: { ...item.envelope } })) }
  const variant = compositionVariantV2(family, cue, heroKind)
  withoutUniversalBacking(layout)
  if (mode === 'editorial-text') {
    layout.textBounds = orientation === 'portrait' ? rect(9, 27, 82, 49) : rect(10, 23, 80, 55)
    layout.textRegion = 'center-editorial'; layout.textAlignment = 'left'
    return layout
  }
  if (orientation === 'landscape') {
    if (variant === 'full-raster-context') {
      layout.textBounds = supportCount ? rect(29, 74, 43, 18) : rect(8, 74, 84, 18)
      layout.textRegion = 'bottom'; layout.textAlignment = 'left'
      envelope(layout, 'hero', rect(7, 8, 86, 64))
      envelope(layout, 'support-1', rect(8, 74, 18, 15))
      envelope(layout, 'support-2', rect(74, 74, 18, 15))
    } else if (variant === 'split-comparison') {
      layout.textBounds = rect(33, 77, 46, 15); layout.textRegion = 'bottom'; layout.textAlignment = 'center'
      envelope(layout, 'hero', rect(7, 13, 39, 55)); envelope(layout, 'support-1', rect(58, 15, 31, 51))
      envelope(layout, 'support-2', rect(78, 68, 16, 14))
    } else if (variant === 'timeline' || variant === 'process-steps') {
      layout.textBounds = rect(9, 75, 82, 17); layout.textRegion = 'timeline-caption'; layout.textAlignment = 'left'
      envelope(layout, 'hero', rect(7, 19, 34, 48)); envelope(layout, 'support-1', rect(43, 25, 23, 36))
      envelope(layout, 'support-2', rect(69, 25, 23, 36))
    } else if (variant === 'data-dominant') {
      layout.textBounds = rect(7, 15, 57, 69); layout.textRegion = 'left'; layout.textAlignment = 'left'
      envelope(layout, 'hero', rect(67, 20, 25, 49)); envelope(layout, 'support-1', rect(74, 73, 17, 15))
      envelope(layout, 'support-2', rect(74, 7, 18, 13))
    } else {
      const right = variant === 'hero-right' || family === 'partidoVertical' && seed % 2 !== 0
      layout.textBounds = right ? rect(7, 18, 39, 65) : rect(58, 18, 36, 65)
      layout.textRegion = right ? 'left' : 'right'; layout.textAlignment = 'left'
      envelope(layout, 'hero', right ? rect(52, 25, 40, 48) : rect(7, 25, 43, 48))
      envelope(layout, 'support-1', right ? rect(53, 75, 18, 14) : rect(8, 75, 19, 14))
      envelope(layout, 'support-2', right ? rect(74, 8, 18, 14) : rect(31, 8, 18, 14))
    }
  } else if (variant === 'cutout-cluster') {
    layout.textBounds = supportCount ? rect(8, 75, 84, 17) : rect(8, 66, 84, 25)
    layout.textRegion = 'bottom'; layout.textAlignment = 'left'
    envelope(layout, 'hero', rect(5, 10, 90, 51))
    envelope(layout, 'support-1', rect(8, 61, 22, 13))
    envelope(layout, 'support-2', rect(70, 61, 22, 13))
  } else if (variant === 'data-dominant') {
    layout.textBounds = rect(8, 16, 57, 66); layout.textRegion = 'left'; layout.textAlignment = 'left'
    envelope(layout, 'hero', rect(64, 25, 28, 44)); envelope(layout, 'support-1', rect(72, 72, 18, 15))
    envelope(layout, 'support-2', rect(72, 9, 18, 13))
  } else if (variant === 'split-comparison') {
    layout.textBounds = rect(8, 72, 84, 18); layout.textRegion = 'bottom'; layout.textAlignment = 'left'
    envelope(layout, 'hero', rect(7, 21, 39, 43)); envelope(layout, 'support-1', rect(58, 23, 31, 39))
    envelope(layout, 'support-2', rect(72, 8, 18, 13))
  } else if (variant === 'timeline' || variant === 'process-steps') {
    layout.textBounds = rect(8, 72, 84, 18); layout.textRegion = 'timeline-caption'; layout.textAlignment = 'left'
    envelope(layout, 'hero', rect(7, 18, 32, 42)); envelope(layout, 'support-1', rect(41, 24, 22, 34))
    envelope(layout, 'support-2', rect(70, 29, 22, 31))
  } else if (variant === 'hero-left' || variant === 'hero-right') {
    const right = variant === 'hero-right'
    layout.textBounds = right ? rect(7, 30, 44, 57) : rect(52, 30, 42, 57)
    layout.textRegion = right ? 'left' : 'right'; layout.textAlignment = 'left'
    envelope(layout, 'hero', right ? rect(53, 20, 39, 50) : rect(8, 20, 40, 50))
    envelope(layout, 'support-1', right ? rect(9, 9, 24, 18) : rect(70, 9, 22, 18))
    envelope(layout, 'support-2', right ? rect(70, 73, 21, 16) : rect(9, 73, 21, 16))
  } else if (variant === 'full-raster-context' || variant === 'poster') {
    layout.textBounds = rect(8, 73, 84, 17); layout.textRegion = 'bottom'; layout.textAlignment = 'left'
    envelope(layout, 'hero', rect(8, 12, 84, 46)); envelope(layout, 'support-1', rect(8, 59, 20, 13))
    envelope(layout, 'support-2', rect(72, 59, 20, 13))
  } else {
    layout.textBounds = rect(9, 73, 82, 17); layout.textRegion = 'bottom'; layout.textAlignment = 'center'
    envelope(layout, 'hero', rect(24, 15, 52, 52)); envelope(layout, 'support-1', rect(8, 45, 20, 17))
    envelope(layout, 'support-2', rect(72, 45, 20, 17))
  }
  // Preserve a distinct spatial grammar for each of the inherited families.
  // These are safe envelopes, never decorative substitutes for missing Supports.
  if (mode === 'asset-led' && orientation === 'portrait') {
    if (family === 'anillosConcentricos') {
      envelope(layout, 'hero', rect(28, 18, 44, 43));
      envelope(layout, 'support-1', rect(8, 48, 19, 16)); envelope(layout, 'support-2', rect(73, 27, 19, 16))
    } else if (family === 'rayosImpacto') {
      envelope(layout, 'hero', rect(23, 16, 54, 44));
      envelope(layout, 'support-1', rect(8, 52, 18, 15)); envelope(layout, 'support-2', rect(74, 52, 18, 15))
    } else if (family === 'constelacion' || family === 'redNodos' || family === 'engranajes') {
      envelope(layout, 'hero', rect(34, 18, 32, 35));
      envelope(layout, 'support-1', rect(8, 48, 23, 18)); envelope(layout, 'support-2', rect(69, 48, 23, 18))
    } else if (family === 'capasApiladas' || family === 'corteTransversal' || family === 'pilaVertical') {
      layout.textBounds = rect(56, 22, 37, 58); layout.textRegion = 'right'; layout.textAlignment = 'left'
      envelope(layout, 'hero', rect(8, 15, 43, 31));
      envelope(layout, 'support-1', rect(8, 49, 43, 17)); envelope(layout, 'support-2', rect(8, 69, 43, 17))
    } else if (family === 'abanicoTarjetas') {
      layout.textBounds = rect(10, 12, 80, 18); layout.textRegion = 'top'; layout.textAlignment = 'center'
      envelope(layout, 'hero', rect(31, 35, 38, 33));
      envelope(layout, 'support-1', rect(8, 45, 21, 20)); envelope(layout, 'support-2', rect(71, 45, 21, 20))
    } else if (family === 'cascada') {
      layout.textBounds = rect(56, 12, 37, 22); layout.textRegion = 'top'; layout.textAlignment = 'left'
      envelope(layout, 'hero', rect(8, 14, 43, 29));
      envelope(layout, 'support-1', rect(31, 46, 32, 20)); envelope(layout, 'support-2', rect(55, 68, 32, 19))
    } else if (family === 'mundoIsometrico') {
      layout.textBounds = rect(10, 12, 80, 18); layout.textRegion = 'top'; layout.textAlignment = 'center'
      envelope(layout, 'hero', rect(31, 33, 38, 34));
      envelope(layout, 'support-1', rect(8, 57, 21, 19)); envelope(layout, 'support-2', rect(71, 57, 21, 19))
    }
  }
  return layout
}

const BACKGROUND_GROUPS: readonly (readonly BackgroundVariantV2[])[] = [
  ['solid-deep', 'soft-radial', 'soft-vignette'],
  ['solid-deep', 'directional-gradient', 'fine-lines'],
  ['solid-deep', 'subtle-grid', 'editorial-shape'],
  ['solid-deep', 'image-aware-darkening', 'soft-vignette'],
]
function hash32(value: string): number {
  let valueHash = 2166136261
  for (const char of value) { valueHash ^= char.charCodeAt(0); valueHash = Math.imul(valueHash, 16777619) }
  return valueHash >>> 0
}
export function selectCompositionV2(input: {
  family: ModernLayoutStructureV4; mode: 'asset-led' | 'editorial-text'; supportCount: number;
  seed: number; sceneId: string; cue: EditorialMotionCue; heroKind?: string;
  videoPaletteFamily: string; recentBackgrounds?: readonly BackgroundVariantV2[]
}): CompositionV2 {
  const layoutVariant = compositionVariantV2(input.family, input.cue, input.heroKind)
  const motionCue: MotionCueV2 = layoutVariant === 'timeline' ? 'timeline'
    : layoutVariant === 'process-steps' ? 'process' : layoutVariant === 'split-comparison' ? 'comparison'
      : layoutVariant === 'data-dominant' ? 'data' : layoutVariant === 'type-led' ? 'type-led'
        : input.heroKind === 'photo-cutout' || input.heroKind === 'raster-image' ? 'photo'
          : input.cue === 'typographic' ? 'statement' : 'object'
  let motionVariant: MotionPrimitiveV2 = ({ timeline:'timelineBuild', process:'staggerCluster',
    comparison:'pairedCompare', data:'lineDraw', 'type-led':'wordReveal', photo:'maskReveal',
    statement:'fadeLift', object:'scaleSettle' } as const)[motionCue]
  if (motionCue === 'object') {
    motionVariant = layoutVariant === 'hero-left' || layoutVariant === 'hero-right' ? 'slideSoft'
      : layoutVariant === 'poster' ? 'maskReveal'
        : ['constelacion', 'redNodos', 'engranajes'].includes(input.family) ? 'staggerCluster'
          : 'scaleSettle'
  }
  // FNV's lowest two bits for the nine existing palette ids hit only three
  // residues. Mix higher bits so every coherent video-level group is reachable.
  const group = BACKGROUND_GROUPS[(hash32(input.videoPaletteFamily) >>> 6) % BACKGROUND_GROUPS.length]
  const candidates = input.heroKind === 'raster-image' ? ['image-aware-darkening', 'solid-deep'] as const : group
  let backgroundVariant: BackgroundVariantV2 = candidates[hash32(input.sceneId) % candidates.length]
  if (input.recentBackgrounds?.at(-1) === backgroundVariant && candidates.length > 1)
    backgroundVariant = candidates[(candidates.indexOf(backgroundVariant) + 1) % candidates.length]
  const accentGraphics: AccentGraphicV2[] = motionCue === 'data' ? ['numeric-marker', 'progress-line']
    : motionCue === 'comparison' ? ['divider'] : motionCue === 'timeline' ? ['connector']
      : motionCue === 'process' ? ['directional-line'] : motionCue === 'type-led' ? ['underline']
        : layoutVariant === 'poster' ? ['corner-frame']
          : ['constelacion', 'redNodos', 'engranajes', 'cascada'].includes(input.family)
            && input.supportCount > 0 ? ['connector']
            : layoutVariant === 'hero-left' || layoutVariant === 'hero-right' ? ['directional-line']
              : ['bracket']
  return { revision: COMPOSITION_V2_REVISION, layoutVariant,
    landscapeLayout: createCompositionLayoutV2(input.family, input.mode, input.supportCount,
      input.seed, input.cue, input.heroKind, 'landscape'),
    backgroundVariant, motionCue, motionVariant, accentGraphics }
}
