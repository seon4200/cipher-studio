import { createVisualLayoutV4, type VisualLayoutV4 } from './visual-layout-v4'

/** Frozen, opt-in pixel contract. Do not edit this revision after publication. */
export const EDITORIAL_EXPLAINER_LIGHT_V1 = Object.freeze({
  id: 'editorial-explainer-light-v1' as const,
  revision: 'editorial-explainer-light-2026-09-v1' as const,
})
export const LIGHT_COLORS_V1 = Object.freeze({
  ivory: '#F0EEE8', white: '#FAF9F6', ink: '#11110F', grid: '#CBC8C1',
  orange: '#F26E35', orangeDepth: '#D85125',
})
export const LIGHT_BACKGROUNDS_V1 = ['ivory-clean', 'ivory-subtle-grid', 'white-soft-paper'] as const
export const LIGHT_MATERIALS_V1 = ['flat-editorial', 'raised-object'] as const
export const LIGHT_HERO_TILES_V1 = ['orange-raised', 'black-raised', 'neutral-raised', 'none'] as const
export const LIGHT_ICON_TREATMENTS_V1 = ['orange-tile', 'black-circle', 'original-color'] as const
export const LIGHT_MOTION_CUES_V1 = ['hero', 'transfer', 'process', 'count', 'compare', 'statement'] as const

export type LightDataRepeaterV1 = {
  revision: 'light-data-repeater-2026-09-v1'
  confirmedValue: number
  unit: string
  symbol: 'person'
  layout: 'grid' | 'stack'
  grouping: number
  tokenCount: number
  label: string
  animation: 'count-accumulate'
}
export type LightStyleV1 = {
  revision: typeof EDITORIAL_EXPLAINER_LIGHT_V1.revision
  background: typeof LIGHT_BACKGROUNDS_V1[number]
  materialPreset: typeof LIGHT_MATERIALS_V1[number]
  shadowPreset: 'upper-left-contact-ambient-v1'
  heroTile: typeof LIGHT_HERO_TILES_V1[number]
  iconTreatment: typeof LIGHT_ICON_TREATMENTS_V1[number]
  connector: { variant: 'straight' | 'curved'; state: 'static' | 'draw'; arrow: boolean } | null
  motionCue: typeof LIGHT_MOTION_CUES_V1[number]
  negativeSpace: 'intentional-editorial'
  dataRepeater: LightDataRepeaterV1 | null
  landscapeLayout: VisualLayoutV4
}

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })
export function createLightLayoutV1(
  mode: 'asset-led' | 'editorial-text', supportCount: number, cue: LightStyleV1['motionCue'],
  orientation: 'portrait' | 'landscape',
): VisualLayoutV4 {
  const family = mode === 'editorial-text' ? 'editorial' : 'marcoPoster'
  const base = createVisualLayoutV4(family, mode, supportCount, 41001)
  const layout: VisualLayoutV4 = { ...base, slotLayouts: base.slotLayouts.map(item => ({
    ...item, backing: 'none', crop: 'none', rotationDeg: 0, opacity: 1,
  })) }
  if (mode === 'editorial-text') {
    layout.textRegion = 'center-editorial'; layout.textAlignment = 'left'
    layout.textBounds = cue === 'count' ? orientation === 'portrait' ? rect(10, 12, 80, 32) : rect(15, 9, 70, 31)
      : orientation === 'portrait' ? rect(10, 31, 80, 44) : rect(15, 29, 70, 45)
    return layout
  }
  const relation = (cue === 'transfer' || cue === 'compare' || cue === 'process') && supportCount > 0
  layout.textAlignment = 'left'
  layout.textRegion = orientation === 'portrait' ? 'bottom' : 'right'
  layout.textBounds = orientation === 'portrait' ? rect(9, 72, 82, 20) : rect(55, 24, 38, 57)
  for (const item of layout.slotLayouts) {
    if (orientation === 'portrait') {
      item.envelope = relation
        ? item.slotId === 'hero' ? rect(10, 27, 35, 34)
          : item.slotId === 'support-1' ? rect(60, 31, 25, 25) : rect(71, 55, 17, 14)
        : item.slotId === 'hero' ? rect(16, 18, 68, 48)
          : item.slotId === 'support-1' ? rect(70, 52, 18, 15) : rect(8, 54, 17, 13)
    } else {
      item.envelope = relation
        ? item.slotId === 'hero' ? rect(9, 25, 24, 49)
          : item.slotId === 'support-1' ? rect(39, 33, 14, 33) : rect(36, 68, 12, 19)
        : item.slotId === 'hero' ? rect(9, 18, 39, 62)
          : item.slotId === 'support-1' ? rect(43, 66, 10, 19) : rect(3, 70, 10, 17)
    }
  }
  return layout
}

export function makeLightDataRepeaterV1(value: number, unit: string): LightDataRepeaterV1 | null {
  if (!Number.isSafeInteger(value) || value < 1 || value > 9999 || !/^(personas|participantes)$/i.test(unit)) return null
  const grouping = value <= 24 ? 1 : Array.from({ length: value }, (_, i) => i + 1)
    .find(divisor => divisor >= Math.ceil(value / 24) && value % divisor === 0) ?? value
  const tokenCount = Math.ceil(value / grouping)
  if (tokenCount < 2 && value > 24) return null
  return { revision: 'light-data-repeater-2026-09-v1', confirmedValue: value, unit,
    symbol: 'person', layout: 'grid', grouping, tokenCount,
    label: grouping === 1 ? `${value} ${unit}` : `${value} ${unit} · 1 símbolo = ${grouping} ${unit}`,
    animation: 'count-accumulate' }
}

export function validateLightStyleV1(value: unknown, mode: 'asset-led' | 'editorial-text', supportCount: number): asserts value is LightStyleV1 {
  const v = value as LightStyleV1
  const keys = ['revision', 'background', 'materialPreset', 'shadowPreset', 'heroTile', 'iconTreatment',
    'connector', 'motionCue', 'negativeSpace', 'dataRepeater', 'landscapeLayout']
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join('|') !== keys.sort().join('|') ||
      v.revision !== EDITORIAL_EXPLAINER_LIGHT_V1.revision ||
      !LIGHT_BACKGROUNDS_V1.includes(v.background) || !LIGHT_MATERIALS_V1.includes(v.materialPreset) ||
      v.shadowPreset !== 'upper-left-contact-ambient-v1' || !LIGHT_HERO_TILES_V1.includes(v.heroTile) ||
      !LIGHT_ICON_TREATMENTS_V1.includes(v.iconTreatment) || !LIGHT_MOTION_CUES_V1.includes(v.motionCue) ||
      v.negativeSpace !== 'intentional-editorial') throw new Error('LIGHT_STYLE_INVALID')
  if (v.connector && (!['straight', 'curved'].includes(v.connector.variant) ||
      !['static', 'draw'].includes(v.connector.state) || typeof v.connector.arrow !== 'boolean' ||
      Object.keys(v.connector).sort().join('|') !== 'arrow|state|variant')) throw new Error('LIGHT_CONNECTOR_INVALID')
  if (v.dataRepeater) {
    const d = v.dataRepeater
    const expected = makeLightDataRepeaterV1(d.confirmedValue, d.unit)
    if (!expected || JSON.stringify(d) !== JSON.stringify(expected)) throw new Error('LIGHT_DATA_REPEATER_INVALID')
  }
  if (JSON.stringify(v.landscapeLayout) !== JSON.stringify(createLightLayoutV1(mode, supportCount, v.motionCue, 'landscape')))
    throw new Error('LIGHT_LANDSCAPE_LAYOUT_INVALID')
}
