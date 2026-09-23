import type { VisualLayoutV4, SlotLayoutV4 } from './visual-layout-v4'
import type { PercentRectV3 } from './visual-layout-v3'
import { getApprovedIdeaSupportV41 } from './editorial-idea-support-catalog-v4-1'
import { EDITORIAL_MODULAR_CATALOG_V1, MODULAR_CATALOG_REVISION_V1,
  getCuratedModularAssetV1, resolveModularTitleAccentV1,
  type ModularRecipeV1 } from './editorial-modular-catalog-v1'

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

/** Raster alpha color is opt-in; prior IDEA revisions retain their original filters. */
export const EDITORIAL_IDEA_ASSEMBLY_V4 = Object.freeze({
  id: 'editorial-idea-assembly-v1' as const,
  revision: 'editorial-idea-assembly-2026-09-v4' as const,
})
/** V4.1 is a fresh opt-in revision for the locally imported Support catalog. */
export const EDITORIAL_IDEA_ASSEMBLY_V4_1 = Object.freeze({
  id: 'editorial-idea-assembly-v1' as const,
  revision: 'editorial-idea-assembly-2026-09-v4-1' as const,
})
export const EDITORIAL_IDEA_COLOR_REVISION_V1 = 'editorial-color-system-2026-09-v1' as const
export const IDEA_V4_SECONDARY_RESOURCE_ID = 'idea-accent-secondary' as const
export type IdeaColorCapability = 'none' | 'alpha-mask' | 'accent-primary' | 'accent-secondary' | 'fixed-spectrum'
export type IdeaSupportTintV4 = {
  revision: typeof EDITORIAL_IDEA_COLOR_REVISION_V1
  source: 'ink' | 'video-primary' | 'hero-primary' | 'hero-secondary' | 'custom'
  resolvedColor: string
}
export type IdeaHeroPaletteV4 = {
  revision: typeof EDITORIAL_IDEA_COLOR_REVISION_V1
  mode: 'recolorable' | 'dual-accent' | 'fixed-spectrum'
  primary?: string
  secondary?: string
}
export type IdeaColorIntentV4 = {
  supportSource: IdeaSupportTintV4['source']
  customColor?: string
  heroMode: IdeaHeroPaletteV4['mode']
  heroPrimary?: string
  heroSecondary?: string
}
export const IDEA_INK_V4 = '#11110F'
export const IDEA_VIDEO_PRIMARY_V4 = '#A83B19'
export const IDEA_DEFAULT_HERO_PRIMARY_V4 = '#C5481E'
export const isIdeaHexV4 = (value: unknown): value is string => typeof value === 'string' && /^#[0-9A-F]{6}$/.test(value)
export function resolveIdeaColorV4(intent: IdeaColorIntentV4): { supportTint: IdeaSupportTintV4; heroPalette: IdeaHeroPaletteV4 } {
  if (!intent || !['recolorable', 'dual-accent', 'fixed-spectrum'].includes(intent.heroMode) ||
      !['ink', 'video-primary', 'hero-primary', 'hero-secondary', 'custom'].includes(intent.supportSource))
    throw new Error('IDEA_V4_COLOR_INTENT_INVALID')
  const primary = intent.heroPrimary
  const secondary = intent.heroSecondary
  if (intent.heroMode === 'fixed-spectrum' ? primary !== undefined || secondary !== undefined : !isIdeaHexV4(primary))
    throw new Error('IDEA_V4_HERO_PRIMARY_INVALID')
  if (intent.heroMode === 'dual-accent' ? !isIdeaHexV4(secondary) : secondary !== undefined)
    throw new Error('IDEA_V4_HERO_SECONDARY_INVALID')
  if (intent.supportSource === 'custom' ? !isIdeaHexV4(intent.customColor) : intent.customColor !== undefined)
    throw new Error('IDEA_V4_CUSTOM_COLOR_INVALID')
  if ((intent.supportSource === 'hero-primary' && !primary) ||
      (intent.supportSource === 'hero-secondary' && !secondary))
    throw new Error('IDEA_V4_SUPPORT_SOURCE_UNAVAILABLE')
  const resolvedColor = intent.supportSource === 'ink' ? IDEA_INK_V4
    : intent.supportSource === 'video-primary' ? IDEA_VIDEO_PRIMARY_V4
    : intent.supportSource === 'hero-primary' ? primary!
    : intent.supportSource === 'hero-secondary' ? secondary! : intent.customColor!
  return {
    supportTint: { revision: EDITORIAL_IDEA_COLOR_REVISION_V1, source: intent.supportSource, resolvedColor },
    heroPalette: { revision: EDITORIAL_IDEA_COLOR_REVISION_V1, mode: intent.heroMode,
      ...(primary ? { primary } : {}), ...(secondary ? { secondary } : {}) },
  }
}

export type IdeaAssemblyRevision =
  | typeof EDITORIAL_IDEA_ASSEMBLY_V1.revision
  | typeof EDITORIAL_IDEA_ASSEMBLY_V2.revision
  | typeof EDITORIAL_IDEA_ASSEMBLY_V3.revision
  | typeof EDITORIAL_IDEA_ASSEMBLY_V4.revision
  | typeof EDITORIAL_IDEA_ASSEMBLY_V4_1.revision
  | typeof EDITORIAL_MODULAR_CATALOG_V1.revision

export function isIdeaAssemblyRevision(value: unknown): value is IdeaAssemblyRevision {
  return value === EDITORIAL_IDEA_ASSEMBLY_V1.revision ||
    value === EDITORIAL_IDEA_ASSEMBLY_V2.revision ||
    value === EDITORIAL_IDEA_ASSEMBLY_V3.revision ||
    value === EDITORIAL_IDEA_ASSEMBLY_V4.revision ||
    value === EDITORIAL_IDEA_ASSEMBLY_V4_1.revision ||
    value === EDITORIAL_MODULAR_CATALOG_V1.revision
}

export const IDEA_SUPPORT_IDS = ['support-1', 'support-2', 'support-3', 'support-4'] as const
export const IDEA_RESOURCE_IDS = ['idea-background', 'idea-rear', 'idea-accent', 'idea-bulb', 'idea-front'] as const
export type IdeaResourceId = typeof IDEA_RESOURCE_IDS[number] | typeof IDEA_V4_SECONDARY_RESOURCE_ID
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
  accentTreatment: 'none' | 'hue-shift' | 'alpha-mask'
  /** Present only in V4; this metadata authorizes alpha masking by layer. */
  colorCapability?: IdeaColorCapability
  /** Modular V1 only; catalog identity is logical and path-free. */
  catalogAssetId?: string
  catalogSha256?: string
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
  /** V4.1 only: logical catalog identity; paths and provenance stay outside SceneSpec. */
  catalogAssetId?: string
  /** V4.1 only: pinned source bytes, also required to equal the corresponding SceneSpec slot SHA. */
  catalogSha256?: string
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
  /** V4 only. Resolved colors are persisted and included in PixelIdentity. */
  supportTint?: IdeaSupportTintV4
  heroPalette?: IdeaHeroPaletteV4
  landscapeLayout: VisualLayoutV4
  /** Modular V1 only. These frozen choices affect visible pixels. */
  catalogRevision?: typeof MODULAR_CATALOG_REVISION_V1
  heroCatalogAssetId?: string
  heroCatalogSha256?: string
  recipe?: ModularRecipeV1
  titleAccentResolved?: string
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
  const isV4_1 = v?.revision === EDITORIAL_IDEA_ASSEMBLY_V4_1.revision
  const isModular = v?.revision === EDITORIAL_MODULAR_CATALOG_V1.revision
  const isV4 = v?.revision === EDITORIAL_IDEA_ASSEMBLY_V4.revision || isV4_1 || isModular
  const exactKeys = (object: object, keys: string[]) =>
    JSON.stringify(Object.keys(object).sort()) === JSON.stringify(keys.sort())
  const validNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  const validRect = (r: PercentRectV3) => r && [r.x, r.y, r.width, r.height].every(validNumber) &&
    r.width > 0 && r.height > 0 && r.x >= -20 && r.y >= -20 && r.x + r.width <= 120 && r.y + r.height <= 120
  if (!v || !isIdeaAssemblyRevision(v.revision) ||
      !['orange', 'teal', 'crimson'].includes(v.accentTheme) ||
      !validNumber(v.heroStartScale) || v.heroStartScale < .5 || v.heroStartScale > 1 ||
      !v.heroAnchor || !validNumber(v.heroAnchor.x) || !validNumber(v.heroAnchor.y) ||
      !Array.isArray(v.resources) || v.resources.length < (isModular ? 1 : IDEA_RESOURCE_IDS.length) ||
      v.resources.length > (isModular ? 4 : IDEA_RESOURCE_IDS.length + (isV4 ? 1 : 0)) ||
      !Array.isArray(v.supports) || v.supports.length !== IDEA_SUPPORT_IDS.length ||
      JSON.stringify(v.landscapeLayout) !== JSON.stringify(createIdeaAssemblyLayoutForRevision(v.revision, 'landscape')))
    throw new Error('IDEA_ASSEMBLY_INVALID')
  if (isV4 && !exactKeys(v, ['revision', 'accentTheme', 'heroStartScale', 'heroAnchor',
    'resources', 'supports', 'connectorSequence', 'supportTint', 'heroPalette', 'landscapeLayout',
    ...(isModular ? ['catalogRevision', 'heroCatalogAssetId', 'heroCatalogSha256', 'recipe', 'titleAccentResolved'] : [])]))
    throw new Error('IDEA_V4_COLOR_CONTRACT_INVALID')
  if (isModular) {
    const hero = getCuratedModularAssetV1(v.heroCatalogAssetId)
    if (v.catalogRevision !== MODULAR_CATALOG_REVISION_V1 || !hero || hero.role !== 'hero-core' ||
        hero.sha256 !== v.heroCatalogSha256 || !['vertical', 'wide', 'compact', 'organic'].includes(v.recipe as string) ||
        !v.heroPalette?.primary || v.titleAccentResolved !== resolveModularTitleAccentV1(v.heroPalette.primary))
      throw new Error('MODULAR_HERO_CATALOG_IDENTITY_INVALID')
  }
  const ids = new Set(v.resources.map(r => r.id))
  if (ids.size !== v.resources.length || (isModular ? !ids.has('idea-background') : IDEA_RESOURCE_IDS.some(id => !ids.has(id))) ||
      v.resources.some(r => !(isModular ? ['idea-background', 'idea-rear', 'idea-accent', 'idea-front']
        : [...IDEA_RESOURCE_IDS, ...(isV4 ? [IDEA_V4_SECONDARY_RESOURCE_ID] : [])]).includes(r.id)))
    throw new Error('IDEA_ASSEMBLY_RESOURCES_INVALID')
  for (const r of v.resources) {
    if (!/^[a-f0-9]{64}$/.test(r.sha256) || r.mime !== 'image/png' ||
        !['useful-alpha', 'opaque-rectangle'].includes(r.alphaMode) || !validRect(r.rect) ||
        ![0, 1, 2, 4, 5].includes(r.zIndex) || !['none', 'hue-shift', 'alpha-mask'].includes(r.accentTreatment) ||
        !r.timing || ![r.timing.start, r.timing.settle, r.timing.exit].every(n => validNumber(n) && n >= 0 && n <= 1) ||
        r.timing.start > r.timing.settle || r.timing.settle >= r.timing.exit ||
        !r.from || ![r.from.x, r.from.y, r.from.scale].every(validNumber) || r.from.scale < .5 || r.from.scale > 1.5)
      throw new Error('IDEA_ASSEMBLY_RESOURCE_INVALID:' + r.id)
    if ((r.id === 'idea-background') !== (r.alphaMode === 'opaque-rectangle'))
      throw new Error('IDEA_ASSEMBLY_ALPHA_INVALID:' + r.id)
    if (!isV4 && (r.colorCapability !== undefined || r.accentTreatment !== (r.id === 'idea-accent' ? 'hue-shift' : 'none')))
      throw new Error('IDEA_ASSEMBLY_MATERIAL_TINT_INVALID:' + r.id)
    if (isV4) {
      if (!exactKeys(r, ['id', 'sha256', 'mime', 'alphaMode', 'rect', 'zIndex',
        'timing', 'from', 'accentTreatment', 'colorCapability',
        ...(isModular && r.id !== 'idea-background' ? ['catalogAssetId', 'catalogSha256'] : [])]))
        throw new Error('IDEA_V4_RESOURCE_COLOR_UNAUTHORIZED:' + r.id)
      if (isModular && r.id !== 'idea-background') {
        const approved = getCuratedModularAssetV1(r.catalogAssetId)
        const expectedRole = r.id === 'idea-rear' ? 'rear-collage' : r.id === 'idea-front' ? 'front-collage' : 'accent-mask'
        if (!approved || approved.role !== expectedRole || approved.sha256 !== r.catalogSha256 || r.sha256 !== approved.sha256)
          throw new Error('MODULAR_RESOURCE_NOT_CURATED:' + r.id)
      }
      const accentLayer = r.id === 'idea-accent' || r.id === IDEA_V4_SECONDARY_RESOURCE_ID
      const expectedCapability: IdeaColorCapability = r.id === IDEA_V4_SECONDARY_RESOURCE_ID ? 'accent-secondary'
        : r.id === 'idea-accent' ? (v.heroPalette?.mode === 'fixed-spectrum' ? 'fixed-spectrum' : 'accent-primary') : 'none'
      if (r.colorCapability !== expectedCapability ||
          r.accentTreatment !== (accentLayer && v.heroPalette?.mode !== 'fixed-spectrum' ? 'alpha-mask' : 'none') ||
          (accentLayer && r.alphaMode !== 'useful-alpha'))
        throw new Error('IDEA_V4_RESOURCE_COLOR_UNAUTHORIZED:' + r.id)
    }
  }
  if (v.supports.some((s, i) => s.slotId !== IDEA_SUPPORT_IDS[i] || !s.label.trim() || !validNumber(s.enter) || s.enter < 0 || s.enter > .7))
    throw new Error('IDEA_ASSEMBLY_SUPPORTS_INVALID')
  if (isV4_1 || isModular) {
    if (v.supports.some((support, i) => {
      const modularApproved = isModular ? getCuratedModularAssetV1(support.catalogAssetId) : undefined
      const historicalApproved = isV4_1 ? getApprovedIdeaSupportV41(support.catalogAssetId) : undefined
      const approved = modularApproved ?? historicalApproved
      return !exactKeys(support, ['slotId', 'label', 'enter', 'settle', 'catalogAssetId', 'catalogSha256']) ||
        !approved || (isModular && modularApproved?.role !== 'support') || support.catalogSha256 !== approved.sha256 ||
        (isV4_1 && support.label !== historicalApproved?.label) ||
        support.slotId !== IDEA_SUPPORT_IDS[i] || !validNumber(support.settle) || support.settle! <= support.enter
    })) throw new Error('IDEA_V41_SUPPORT_CATALOG_IDENTITY_INVALID')
  } else if (v.supports.some(s => s.catalogAssetId !== undefined || s.catalogSha256 !== undefined))
    throw new Error('IDEA_ASSEMBLY_HISTORICAL_CATALOG_IDENTITY_INVALID')
  const hasSequence = v.revision === EDITORIAL_IDEA_ASSEMBLY_V3.revision || isV4
  if (!hasSequence) {
    if (v.supportTint !== undefined || v.heroPalette !== undefined)
      throw new Error('IDEA_ASSEMBLY_HISTORICAL_COLOR_INVALID')
    if (v.supports.some(s => s.settle !== undefined) || v.connectorSequence !== undefined)
      throw new Error('IDEA_ASSEMBLY_HISTORICAL_ROUTE_INVALID')
    return
  }
  if (isV4) {
    if (!v.supportTint || !v.heroPalette ||
        !exactKeys(v.supportTint, ['revision', 'source', 'resolvedColor']) ||
        !exactKeys(v.heroPalette, ['revision', 'mode',
          ...(v.heroPalette.primary === undefined ? [] : ['primary']),
          ...(v.heroPalette.secondary === undefined ? [] : ['secondary'])]) ||
        v.supportTint.revision !== EDITORIAL_IDEA_COLOR_REVISION_V1 ||
        v.heroPalette.revision !== EDITORIAL_IDEA_COLOR_REVISION_V1 ||
        !['ink', 'video-primary', 'hero-primary', 'hero-secondary', 'custom'].includes(v.supportTint.source) ||
        !['recolorable', 'dual-accent', 'fixed-spectrum'].includes(v.heroPalette.mode) ||
        !isIdeaHexV4(v.supportTint.resolvedColor) ||
        (v.heroPalette.primary !== undefined && !isIdeaHexV4(v.heroPalette.primary)) ||
        (v.heroPalette.secondary !== undefined && !isIdeaHexV4(v.heroPalette.secondary)))
      throw new Error('IDEA_V4_COLOR_CONTRACT_INVALID')
    if ((v.heroPalette.mode === 'fixed-spectrum') !== (v.heroPalette.primary === undefined) ||
        (v.heroPalette.mode === 'dual-accent') !== (v.heroPalette.secondary !== undefined))
      throw new Error('IDEA_V4_HERO_PALETTE_INVALID')
    if ((isV4_1 || isModular) && (v.heroPalette.mode !== 'recolorable' || ids.has(IDEA_V4_SECONDARY_RESOURCE_ID)))
      throw new Error('IDEA_V41_HERO_COLOR_MODE_UNAVAILABLE')
    if (v.heroPalette.mode === 'dual-accent' && !ids.has(IDEA_V4_SECONDARY_RESOURCE_ID))
      throw new Error('IDEA_V4_SECONDARY_LAYER_REQUIRED')
    if ((v.supportTint.source === 'hero-primary' && v.supportTint.resolvedColor !== v.heroPalette.primary) ||
        (v.supportTint.source === 'hero-secondary' && v.supportTint.resolvedColor !== v.heroPalette.secondary) ||
        (v.heroPalette.mode !== 'dual-accent' && ids.has(IDEA_V4_SECONDARY_RESOURCE_ID)))
      throw new Error('IDEA_V4_COLOR_RESOLUTION_MISMATCH')
  } else if (v.supportTint !== undefined || v.heroPalette !== undefined)
    throw new Error('IDEA_ASSEMBLY_HISTORICAL_COLOR_INVALID')
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
