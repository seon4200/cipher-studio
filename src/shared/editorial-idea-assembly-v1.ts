import type { VisualLayoutV4, SlotLayoutV4 } from './visual-layout-v4'
import type { PercentRectV3 } from './visual-layout-v3'

/** A new opt-in pixel contract. Do not change this revision after delivery. */
export const EDITORIAL_IDEA_ASSEMBLY_V1 = Object.freeze({
  id: 'editorial-idea-assembly-v1' as const,
  revision: 'editorial-idea-assembly-2026-09-v1' as const,
})

/** V1 remains frozen. V2 is the contained polish contract for the same IDEA scene. */
export const EDITORIAL_IDEA_ASSEMBLY_V2 = Object.freeze({
  id: 'editorial-idea-assembly-v1' as const,
  revision: 'editorial-idea-assembly-2026-09-v2' as const,
})

/**
 * V3 freezes a causal connector hand-off over V2's approved stable composition.
 * It is deliberately a fresh revision: V1/V2 continue through their original
 * geometry, routes and timing dispatch.
 */
export const EDITORIAL_IDEA_ASSEMBLY_V3 = Object.freeze({
  id: 'editorial-idea-assembly-v1' as const,
  revision: 'editorial-idea-assembly-2026-09-v3' as const,
})

export type IdeaAssemblyRevision =
  | typeof EDITORIAL_IDEA_ASSEMBLY_V1.revision
  | typeof EDITORIAL_IDEA_ASSEMBLY_V2.revision
  | typeof EDITORIAL_IDEA_ASSEMBLY_V3.revision

export function isIdeaAssemblyRevision(value: unknown): value is IdeaAssemblyRevision {
  return value === EDITORIAL_IDEA_ASSEMBLY_V1.revision ||
    value === EDITORIAL_IDEA_ASSEMBLY_V2.revision ||
    value === EDITORIAL_IDEA_ASSEMBLY_V3.revision
}

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

export type IdeaConnectorRelation =
  | 'support-to-hero'
  | 'hero-to-support'
  | 'support-to-support'

/**
 * The local paths are deliberately part of the persisted V3 visual contract.
 * They describe routes in the compositor's 0..100 SVG coordinate system, not
 * runtime asset locations or provider metadata.
 */
export type IdeaAssemblyConnector = {
  id: IdeaSupportId
  relation: IdeaConnectorRelation
  from: 'hero' | IdeaSupportId
  to: 'hero' | IdeaSupportId
  start: number
  end: number
  portrait: { path: string; tip: { x: number; y: number } }
  landscape: { path: string; tip: { x: number; y: number } }
}

export type IdeaAssemblySupport = {
  slotId: IdeaSupportId
  label: string
  enter: number
  /** V3 only: frozen completion beat for the support's own entrance. */
  settle?: number
}

export type IdeaAssemblyV1 = {
  /** Kept under the V1 transport name so no second SceneSpec subsystem is introduced. */
  revision: IdeaAssemblyRevision
  accentTheme: IdeaAccentTheme
  heroStartScale: number
  heroAnchor: { x: number; y: number }
  resources: IdeaAssemblyResource[]
  supports: IdeaAssemblySupport[]
  /** V3 only. V1/V2 intentionally omit the causal routing plan. */
  connectorSequence?: IdeaAssemblyConnector[]
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

/** New revision only. The V1 geometry above stays the exact historical dispatch. */
export function createIdeaAssemblyLayoutV2(orientation: 'portrait' | 'landscape'): VisualLayoutV4 {
  const portrait = orientation === 'portrait'
  return {
    version: 2, family: 'marcoPoster', textRegion: portrait ? 'top' : 'left',
    textBounds: portrait ? rect(7, 7, 86, 26) : rect(6, 9, 35, 43),
    textAlignment: 'left', relationStyle: 'none',
    slotLayouts: portrait ? [
      slot('hero', rect(20, 30, 60, 58), 4),
      slot('support-1', rect(5, 31, 19, 15), 5),
      slot('support-2', rect(76, 31, 19, 15), 5),
      slot('support-3', rect(5, 66, 19, 15), 5),
      slot('support-4', rect(76, 66, 19, 15), 5),
    ] : [
      slot('hero', rect(39, 6, 45, 86), 4),
      slot('support-1', rect(4, 64, 16, 22), 5),
      slot('support-2', rect(22, 64, 16, 22), 5),
      slot('support-3', rect(84, 14, 13, 22), 5),
      slot('support-4', rect(84, 64, 13, 22), 5),
    ],
  }
}

/** V3 retains V2's approved resting geometry exactly; only the connector plan changes. */
export function createIdeaAssemblyLayoutV3(orientation: 'portrait' | 'landscape'): VisualLayoutV4 {
  return createIdeaAssemblyLayoutV2(orientation)
}

export function createIdeaAssemblyLayoutForRevision(
  revision: IdeaAssemblyRevision,
  orientation: 'portrait' | 'landscape',
): VisualLayoutV4 {
  if (revision === EDITORIAL_IDEA_ASSEMBLY_V1.revision) return createIdeaAssemblyLayoutV1(orientation)
  if (revision === EDITORIAL_IDEA_ASSEMBLY_V2.revision) return createIdeaAssemblyLayoutV2(orientation)
  return createIdeaAssemblyLayoutV3(orientation)
}

export function validateIdeaAssemblyV1(value: unknown): asserts value is IdeaAssemblyV1 {
  const v = value as IdeaAssemblyV1
  const validNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  const validRect = (r: PercentRectV3) => r && [r.x, r.y, r.width, r.height].every(validNumber) &&
    r.width > 0 && r.height > 0 && r.x >= -20 && r.y >= -20 && r.x + r.width <= 120 && r.y + r.height <= 120
  if (!v || !isIdeaAssemblyRevision(v.revision) ||
      !['orange', 'teal', 'crimson'].includes(v.accentTheme) ||
      !validNumber(v.heroStartScale) || v.heroStartScale < .5 || v.heroStartScale > 1 ||
      !v.heroAnchor || !validNumber(v.heroAnchor.x) || !validNumber(v.heroAnchor.y) ||
      !Array.isArray(v.resources) || v.resources.length !== IDEA_RESOURCE_IDS.length ||
      !Array.isArray(v.supports) || v.supports.length !== IDEA_SUPPORT_IDS.length ||
      JSON.stringify(v.landscapeLayout) !== JSON.stringify(createIdeaAssemblyLayoutForRevision(v.revision, 'landscape')))
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
  const isV3 = v.revision === EDITORIAL_IDEA_ASSEMBLY_V3.revision
  if (!isV3) {
    if (v.supports.some(s => s.settle !== undefined) || v.connectorSequence !== undefined)
      throw new Error('IDEA_ASSEMBLY_HISTORICAL_ROUTE_INVALID')
    return
  }
  if (v.supports.some(s => !validNumber(s.settle) || s.settle! <= s.enter || s.settle! > .7) ||
      !Array.isArray(v.connectorSequence) || v.connectorSequence.length !== IDEA_SUPPORT_IDS.length)
    throw new Error('IDEA_ASSEMBLY_V3_TIMING_INVALID')
  const expected: readonly [IdeaSupportId, IdeaConnectorRelation, 'hero' | IdeaSupportId, 'hero' | IdeaSupportId][] = [
    ['support-1', 'support-to-hero', 'support-1', 'hero'],
    ['support-2', 'support-to-hero', 'support-2', 'hero'],
    ['support-3', 'hero-to-support', 'hero', 'support-3'],
    ['support-4', 'support-to-support', 'support-3', 'support-4'],
  ]
  const frame = 1 / 80
  for (const [i, connector] of v.connectorSequence.entries()) {
    const [id, relation, from, to] = expected[i]
    const sourceSupport = v.supports.find(s => s.slotId === id)!
    const gap = connector.start - sourceSupport.settle!
    const validPath = (part: IdeaAssemblyConnector['portrait'] | undefined) => {
      if (!part) return false
      return typeof part.path === 'string' && /^[0-9 .,+\-MCQCSZ]+$/i.test(part.path) &&
        validNumber(part.tip?.x) && validNumber(part.tip?.y) &&
        part.tip.x >= 0 && part.tip.x <= 100 && part.tip.y >= 0 && part.tip.y <= 100
    }
    if (connector.id !== id || connector.relation !== relation || connector.from !== from || connector.to !== to ||
        !validNumber(connector.start) || !validNumber(connector.end) || connector.start < 0 || connector.end > .7 ||
        connector.end <= connector.start || gap < frame * 2 - 1e-9 || gap > frame * 3 + 1e-9 ||
        !validPath(connector.portrait) || !validPath(connector.landscape))
      throw new Error('IDEA_ASSEMBLY_V3_CONNECTOR_INVALID:' + id)
    if (i > 0) {
      const previous = v.connectorSequence[i - 1]
      const handoff = connector.start - previous.end
      if (handoff < 0 || handoff > frame + 1e-9) throw new Error('IDEA_ASSEMBLY_V3_HANDOFF_INVALID:' + id)
    }
  }
}
