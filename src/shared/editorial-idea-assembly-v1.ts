import type { VisualLayoutV4, SlotLayoutV4 } from './visual-layout-v4'
import type { PercentRectV3 } from './visual-layout-v3'

/** A new opt-in pixel contract. Do not change this revision after delivery. */
export const EDITORIAL_IDEA_ASSEMBLY_V1 = Object.freeze({
  id: 'editorial-idea-assembly-v1' as const,
  revision: 'editorial-idea-assembly-2026-09-v1' as const,
})

export const IDEA_SUPPORT_IDS = ['support-1', 'support-2', 'support-3', 'support-4'] as const
export const IDEA_RESOURCE_IDS = ['idea-background', 'idea-rear', 'idea-accent', 'idea-bulb', 'idea-front'] as const
export type IdeaResourceId = typeof IDEA_RESOURCE_IDS[number]
export type IdeaSupportId = typeof IDEA_SUPPORT_IDS[number]
export type IdeaAccentTheme = 'orange' | 'teal' | 'crimson'

export type IdeaAssemblyResource = {
  id: IdeaResourceId
  sha256: string
  mime: 'image/png'
  alphaMode: 'useful-alpha' | 'opaque-rectangle'
  rect: PercentRectV3
  zIndex: 0 | 1 | 2 | 4 | 5
  timing: { start: number; settle: number; exit: number }
  from: { x: number; y: number; scale: number }
  accentTreatment: 'none' | 'hue-shift'
}

export type IdeaAssemblyV1 = {
  revision: typeof EDITORIAL_IDEA_ASSEMBLY_V1.revision
  accentTheme: IdeaAccentTheme
  heroStartScale: number
  heroAnchor: { x: number; y: number }
  resources: IdeaAssemblyResource[]
  supports: { slotId: IdeaSupportId; label: string; enter: number }[]
  landscapeLayout: VisualLayoutV4
}

const rect = (x: number, y: number, width: number, height: number): PercentRectV3 => ({ x, y, width, height })
const slot = (slotId: 'hero' | IdeaSupportId, envelope: PercentRectV3, zIndex: SlotLayoutV4['zIndex']): SlotLayoutV4 => ({
  slotId, placement: slotId === 'hero' ? 'center-dominant' : 'integrated', envelope, zIndex,
  rotationDeg: 0, opacity: 1, backing: 'none', crop: 'none',
})

export function createIdeaAssemblyLayoutV1(orientation: 'portrait' | 'landscape'): VisualLayoutV4 {
  const portrait = orientation === 'portrait'
  return {
    version: 2, family: 'marcoPoster', textRegion: portrait ? 'top' : 'left',
    textBounds: portrait ? rect(7, 8, 86, 25) : rect(7, 13, 36, 38),
    textAlignment: 'left', relationStyle: 'none',
    slotLayouts: portrait ? [
      slot('hero', rect(20, 30, 60, 58), 4),
      slot('support-1', rect(5, 30, 19, 15), 5),
      slot('support-2', rect(76, 30, 19, 15), 5),
      slot('support-3', rect(5, 65, 19, 15), 5),
      slot('support-4', rect(76, 65, 19, 15), 5),
    ] : [
      slot('hero', rect(38, 11, 45, 79), 4),
      slot('support-1', rect(5, 58, 16, 26), 5),
      slot('support-2', rect(23, 58, 16, 26), 5),
      slot('support-3', rect(82, 15, 14, 25), 5),
      slot('support-4', rect(82, 58, 14, 25), 5),
    ],
  }
}

export function validateIdeaAssemblyV1(value: unknown): asserts value is IdeaAssemblyV1 {
  const v = value as IdeaAssemblyV1
  const validNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  const validRect = (r: PercentRectV3) => r && [r.x, r.y, r.width, r.height].every(validNumber) &&
    r.width > 0 && r.height > 0 && r.x >= -20 && r.y >= -20 && r.x + r.width <= 120 && r.y + r.height <= 120
  if (!v || v.revision !== EDITORIAL_IDEA_ASSEMBLY_V1.revision ||
      !['orange', 'teal', 'crimson'].includes(v.accentTheme) ||
      !validNumber(v.heroStartScale) || v.heroStartScale < .5 || v.heroStartScale > 1 ||
      !v.heroAnchor || !validNumber(v.heroAnchor.x) || !validNumber(v.heroAnchor.y) ||
      !Array.isArray(v.resources) || v.resources.length !== IDEA_RESOURCE_IDS.length ||
      !Array.isArray(v.supports) || v.supports.length !== IDEA_SUPPORT_IDS.length ||
      JSON.stringify(v.landscapeLayout) !== JSON.stringify(createIdeaAssemblyLayoutV1('landscape')))
    throw new Error('IDEA_ASSEMBLY_INVALID')
  const ids = new Set(v.resources.map(r => r.id))
  if (ids.size !== IDEA_RESOURCE_IDS.length || IDEA_RESOURCE_IDS.some(id => !ids.has(id)))
    throw new Error('IDEA_ASSEMBLY_RESOURCES_INVALID')
  for (const r of v.resources) {
    if (!/^[a-f0-9]{64}$/.test(r.sha256) || r.mime !== 'image/png' ||
        !['useful-alpha', 'opaque-rectangle'].includes(r.alphaMode) || !validRect(r.rect) ||
        ![0, 1, 2, 4, 5].includes(r.zIndex) || !['none', 'hue-shift'].includes(r.accentTreatment) ||
        !r.timing || ![r.timing.start, r.timing.settle, r.timing.exit].every(n => validNumber(n) && n >= 0 && n <= 1) ||
        r.timing.start > r.timing.settle || r.timing.settle >= r.timing.exit ||
        !r.from || ![r.from.x, r.from.y, r.from.scale].every(validNumber) || r.from.scale < .5 || r.from.scale > 1.5)
      throw new Error('IDEA_ASSEMBLY_RESOURCE_INVALID:' + r.id)
    if ((r.id === 'idea-background') !== (r.alphaMode === 'opaque-rectangle'))
      throw new Error('IDEA_ASSEMBLY_ALPHA_INVALID:' + r.id)
    if (r.accentTreatment !== (r.id === 'idea-accent' ? 'hue-shift' : 'none'))
      throw new Error('IDEA_ASSEMBLY_MATERIAL_TINT_INVALID:' + r.id)
  }
  if (v.supports.some((s, i) => s.slotId !== IDEA_SUPPORT_IDS[i] || !s.label.trim() || !validNumber(s.enter) || s.enter < 0 || s.enter > .7))
    throw new Error('IDEA_ASSEMBLY_SUPPORTS_INVALID')
}
