import { createLightLayoutV1, makeLightDataRepeaterV1, type LightStyleV1 } from './editorial-explainer-light-v1'
import type { VisualLayoutV4 } from './visual-layout-v4'

/** Separate pixel contract. V1 is deliberately never reinterpreted by this revision. */
export const EDITORIAL_EXPLAINER_LIGHT_V2 = Object.freeze({
  id: 'editorial-explainer-light-v2' as const,
  revision: 'editorial-explainer-light-2026-09-v2' as const,
})
export type LightStyleV2 = Omit<LightStyleV1, 'revision'> & {
  revision: typeof EDITORIAL_EXPLAINER_LIGHT_V2.revision
}

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })
export function createLightLayoutV2(
  mode: 'asset-led' | 'editorial-text', supportCount: number, cue: LightStyleV2['motionCue'],
  orientation: 'portrait' | 'landscape',
): VisualLayoutV4 {
  const base = createLightLayoutV1(mode, supportCount, cue, orientation)
  const layout: VisualLayoutV4 = { ...base, slotLayouts: base.slotLayouts.map(slot => ({ ...slot })) }
  if (mode === 'editorial-text') {
    layout.textBounds = cue === 'count'
      ? orientation === 'portrait' ? rect(10, 12, 80, 31) : rect(11, 9, 78, 34)
      : orientation === 'portrait' ? rect(11, 31, 78, 39) : rect(13, 24, 74, 52)
    return layout
  }
  const relation = (cue === 'transfer' || cue === 'compare' || cue === 'process') && supportCount > 0
  layout.textBounds = orientation === 'portrait' ? rect(9, 72, 82, 22)
    : relation ? rect(9, 68, 82, 20) : rect(55, 24, 39, 55)
  layout.textRegion = orientation === 'portrait' || relation ? 'bottom' : 'right'
  for (const slot of layout.slotLayouts) {
    if (orientation === 'portrait') {
      slot.envelope = relation
        ? slot.slotId === 'hero' ? rect(7, 24, 38, 39)
          : slot.slotId === 'support-1' ? rect(61, 29, 24, 23) : rect(65, 53, 18, 15)
        : slot.slotId === 'hero' ? rect(10, 15, 78, 54)
          : slot.slotId === 'support-1' ? rect(71, 24, 17, 15) : rect(71, 49, 17, 15)
    } else {
      slot.envelope = relation
        ? slot.slotId === 'hero' ? rect(7, 18, 29, 49)
          : slot.slotId === 'support-1' ? rect(53, 23, 20, 39) : rect(78, 34, 12, 22)
        : slot.slotId === 'hero' ? rect(7, 13, 47, 73)
          : slot.slotId === 'support-1' ? rect(42, 17, 12, 25) : rect(42, 57, 12, 25)
    }
  }
  return layout
}

export function validateLightStyleV2(value: unknown, mode: 'asset-led' | 'editorial-text', supportCount: number): asserts value is LightStyleV2 {
  const v = value as LightStyleV2
  if (!v || typeof v !== 'object' || Array.isArray(v) || v.revision !== EDITORIAL_EXPLAINER_LIGHT_V2.revision ||
      Object.keys(v).sort().join('|') !== 'background|connector|dataRepeater|heroTile|iconTreatment|landscapeLayout|materialPreset|motionCue|negativeSpace|revision|shadowPreset' ||
      !['ivory-clean', 'ivory-subtle-grid', 'white-soft-paper'].includes(v.background) ||
      !['flat-editorial', 'raised-object'].includes(v.materialPreset) ||
      !['orange-raised', 'black-raised', 'neutral-raised', 'none'].includes(v.heroTile) ||
      !['orange-tile', 'black-circle', 'original-color'].includes(v.iconTreatment) ||
      !['hero', 'transfer', 'process', 'count', 'compare', 'statement'].includes(v.motionCue) ||
      v.shadowPreset !== 'upper-left-contact-ambient-v1' || v.negativeSpace !== 'intentional-editorial')
    throw new Error('LIGHT_V2_STYLE_INVALID')
  if (v.connector && (Object.keys(v.connector).sort().join('|') !== 'arrow|state|variant' ||
      !['straight', 'curved'].includes(v.connector.variant) || !['static', 'draw'].includes(v.connector.state) ||
      typeof v.connector.arrow !== 'boolean')) throw new Error('LIGHT_V2_CONNECTOR_INVALID')
  if (v.dataRepeater && JSON.stringify(v.dataRepeater) !== JSON.stringify(
    makeLightDataRepeaterV1(v.dataRepeater.confirmedValue, v.dataRepeater.unit)))
    throw new Error('LIGHT_V2_DATA_INVALID')
  if (JSON.stringify(v.landscapeLayout) !== JSON.stringify(createLightLayoutV2(mode, supportCount, v.motionCue, 'landscape')))
    throw new Error('LIGHT_V2_LANDSCAPE_LAYOUT_INVALID')
}
