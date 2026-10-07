import type { Densidad, IdEstructura, Ritmo } from './escena'

export const VISUAL_LAYOUT_V3_VERSION = 1 as const

export type HistoricalLayoutStatusV3 =
  | 'READY_MODERN'
  | 'ADAPTABLE_SINGLE_HERO'
  | 'ADAPTABLE_HERO_TEXT'
  | 'REQUIRES_SUPPORT'
  | 'REQUIRES_MULTI_ASSET'
  | 'LEGACY_ONLY_FOR_NOW'
  | 'REJECTED_WITH_REASON'

export type HistoricalLayoutAssessmentV3 = {
  status: HistoricalLayoutStatusV3
  certified: boolean
  reason: string
}

/**
 * The complete historical inventory, classified against the deliberately smaller V14 contract:
 * one Hero at most plus editorial text. It is product metadata, not a renderer dispatch table.
 */
export const HISTORICAL_LAYOUT_MATRIX_V3 = {
  constelacion: {
    status: 'REQUIRES_SUPPORT', certified: false,
    reason: 'Its grammar is a central subject related to several real semantic nodes; one Hero plus text cannot materialize those nodes honestly.',
  },
  marcoPoster: {
    status: 'READY_MODERN', certified: true,
    reason: 'A single Hero and a bounded text region fully materialize the poster grammar.',
  },
  editorial: {
    status: 'READY_MODERN', certified: true,
    reason: 'Text is the first-class subject and no asset slot is required.',
  },
  capasApiladas: {
    status: 'REQUIRES_SUPPORT', certified: false,
    reason: 'Layering is only meaningful when two or more real layers or concepts exist.',
  },
  redNodos: {
    status: 'REQUIRES_MULTI_ASSET', certified: false,
    reason: 'A network needs multiple materialized nodes; generic dots would be false structure.',
  },
  lineaTiempo: {
    status: 'REQUIRES_SUPPORT', certified: false,
    reason: 'A timeline requires multiple ordered events, which SceneSpec V14 does not carry.',
  },
  corteTransversal: {
    status: 'REQUIRES_SUPPORT', certified: false,
    reason: 'The cross-section grammar requires multiple named strata.',
  },
  partidoVertical: {
    status: 'ADAPTABLE_HERO_TEXT', certified: true,
    reason: 'One Hero and one text block can occupy opposite fields without placeholders.',
  },
  cintaDiagonal: {
    status: 'ADAPTABLE_HERO_TEXT', certified: true,
    reason: 'The diagonal axis can relate one Hero to one text region.',
  },
  anillosConcentricos: {
    status: 'ADAPTABLE_SINGLE_HERO', certified: true,
    reason: 'The rings express focus around one real Hero without inventing Support.',
  },
  abanicoTarjetas: {
    status: 'REQUIRES_MULTI_ASSET', certified: false,
    reason: 'A fan of cards requires several materialized cards or assets.',
  },
  rayosImpacto: {
    status: 'ADAPTABLE_SINGLE_HERO', certified: true,
    reason: 'Impact geometry can subordinate itself to one Hero or to editorial text as subject.',
  },
  engranajes: {
    status: 'REQUIRES_MULTI_ASSET', certified: false,
    reason: 'Interlocking gears encode multiple interacting parts.',
  },
  cuaderno: {
    status: 'ADAPTABLE_HERO_TEXT', certified: true,
    reason: 'A document field can contain one Hero and an adjacent annotation, or text alone.',
  },
  cascada: {
    status: 'REQUIRES_SUPPORT', certified: false,
    reason: 'A cascade requires an ordered series of distinct real items.',
  },
  mundoIsometrico: {
    status: 'REQUIRES_MULTI_ASSET', certified: false,
    reason: 'The world is built from several tiles or objects, not one repeated placeholder.',
  },
  pilaVertical: {
    status: 'REQUIRES_SUPPORT', certified: false,
    reason: 'A stack requires multiple real blocks or concepts.',
  },
} as const satisfies Record<Exclude<IdEstructura, 'unaCaja'>, HistoricalLayoutAssessmentV3>

export const MODERN_LAYOUT_STRUCTURES_V3 = [
  'editorial',
  'marcoPoster',
  'partidoVertical',
  'cintaDiagonal',
  'anillosConcentricos',
  'rayosImpacto',
  'cuaderno',
] as const
export type ModernLayoutStructureV3 = typeof MODERN_LAYOUT_STRUCTURES_V3[number]

export const LAYOUT_FAMILIES_V3 = [
  'editorial', 'poster', 'split', 'diagonal', 'focus', 'impact', 'document',
] as const
export type LayoutFamilyV3 = typeof LAYOUT_FAMILIES_V3[number]

export const HERO_PLACEMENTS_V3 = [
  'none', 'center-dominant', 'left-dominant', 'right-dominant', 'top-wide', 'framed', 'integrated',
] as const
export type HeroPlacementV3 = typeof HERO_PLACEMENTS_V3[number]

export const TEXT_REGIONS_V3 = [
  'top', 'bottom', 'left', 'right', 'center-editorial', 'integrated-safe', 'overlay-safe',
] as const
export type TextRegionV3 = typeof TEXT_REGIONS_V3[number]

export type PercentRectV3 = { x: number; y: number; width: number; height: number }

export type VisualLayoutV3 = {
  version: typeof VISUAL_LAYOUT_V3_VERSION
  family: LayoutFamilyV3
  heroPlacement: HeroPlacementV3
  heroEnvelope: PercentRectV3 | null
  textRegion: TextRegionV3
  textBounds: PercentRectV3
  textAlignment: 'left' | 'center' | 'right'
}

export const TYPOGRAPHY_LOOK_IDS_V3 = [
  'editorial-strong',
  'impact-condensed',
  'sport-condensed',
  'technical-condensed',
  'elegant-serif',
  'poster-condensed',
] as const
export type TypographyLookIdV3 = typeof TYPOGRAPHY_LOOK_IDS_V3[number]

export type TypographyLookV3 = {
  id: TypographyLookIdV3
  keywordFamily: string
  keywordWeight: number
  connectorFamily: string
  connectorWeight: number
  closingFamily: string
  closingWeight: number
  keywordCase: 'uppercase' | 'preserve'
  trackingEm: number
  lineHeight: number
  minKeywordCqmin: number
  maxKeywordCqmin: number
  widthBudget: number
  alignmentPreference: 'left' | 'center' | 'right'
}

/** Every requested weight below is physically present in the bundled WOFF2 (OS/2.usWeightClass). */
export const TYPOGRAPHY_LOOKS_V3: Record<TypographyLookIdV3, TypographyLookV3> = {
  'editorial-strong': {
    id: 'editorial-strong', keywordFamily: 'Archivo Black', keywordWeight: 400,
    connectorFamily: 'DM Serif Display', connectorWeight: 400,
    closingFamily: 'DM Serif Display', closingWeight: 400,
    keywordCase: 'uppercase', trackingEm: -.025, lineHeight: .9,
    minKeywordCqmin: 3.5, maxKeywordCqmin: 10.4, widthBudget: 76,
    alignmentPreference: 'left',
  },
  'impact-condensed': {
    id: 'impact-condensed', keywordFamily: 'Anton', keywordWeight: 400,
    connectorFamily: 'Archivo', connectorWeight: 700,
    closingFamily: 'Archivo', closingWeight: 700,
    keywordCase: 'uppercase', trackingEm: .01, lineHeight: .88,
    minKeywordCqmin: 3.6, maxKeywordCqmin: 11.2, widthBudget: 88,
    alignmentPreference: 'center',
  },
  'sport-condensed': {
    id: 'sport-condensed', keywordFamily: 'Bebas Neue', keywordWeight: 400,
    connectorFamily: 'Space Mono', connectorWeight: 700,
    closingFamily: 'Space Mono', closingWeight: 700,
    keywordCase: 'uppercase', trackingEm: .035, lineHeight: .9,
    minKeywordCqmin: 3.7, maxKeywordCqmin: 11.5, widthBudget: 91,
    alignmentPreference: 'center',
  },
  'technical-condensed': {
    id: 'technical-condensed', keywordFamily: 'IBM Plex Sans Condensed', keywordWeight: 700,
    connectorFamily: 'Space Mono', connectorWeight: 700,
    closingFamily: 'Space Mono', closingWeight: 700,
    keywordCase: 'uppercase', trackingEm: .025, lineHeight: .92,
    minKeywordCqmin: 3.4, maxKeywordCqmin: 9.8, widthBudget: 82,
    alignmentPreference: 'left',
  },
  'elegant-serif': {
    id: 'elegant-serif', keywordFamily: 'Playfair Display', keywordWeight: 800,
    connectorFamily: 'DM Serif Display', connectorWeight: 400,
    closingFamily: 'DM Serif Display', closingWeight: 400,
    keywordCase: 'preserve', trackingEm: -.02, lineHeight: .94,
    minKeywordCqmin: 3.3, maxKeywordCqmin: 9.6, widthBudget: 72,
    alignmentPreference: 'left',
  },
  'poster-condensed': {
    id: 'poster-condensed', keywordFamily: 'Barlow Condensed', keywordWeight: 700,
    connectorFamily: 'Archivo', connectorWeight: 700,
    closingFamily: 'Archivo', closingWeight: 700,
    keywordCase: 'uppercase', trackingEm: .018, lineHeight: .9,
    minKeywordCqmin: 3.5, maxKeywordCqmin: 10.8, widthBudget: 86,
    alignmentPreference: 'left',
  },
}

export const STRUCTURE_FAMILY_V3: Record<ModernLayoutStructureV3, LayoutFamilyV3> = {
  editorial: 'editorial',
  marcoPoster: 'poster',
  partidoVertical: 'split',
  cintaDiagonal: 'diagonal',
  anillosConcentricos: 'focus',
  rayosImpacto: 'impact',
  cuaderno: 'document',
}

const ASSET_STRUCTURES: readonly ModernLayoutStructureV3[] = [
  'marcoPoster', 'partidoVertical', 'cintaDiagonal', 'anillosConcentricos', 'rayosImpacto', 'cuaderno',
]
const EDITORIAL_STRUCTURES: readonly ModernLayoutStructureV3[] = [
  'editorial', 'cintaDiagonal', 'rayosImpacto', 'cuaderno',
]

const LOOKS_BY_FAMILY: Record<LayoutFamilyV3, readonly TypographyLookIdV3[]> = {
  editorial: ['editorial-strong', 'elegant-serif', 'technical-condensed'],
  poster: ['poster-condensed', 'sport-condensed', 'editorial-strong'],
  split: ['technical-condensed', 'poster-condensed', 'sport-condensed'],
  diagonal: ['impact-condensed', 'sport-condensed', 'technical-condensed'],
  focus: ['elegant-serif', 'editorial-strong', 'impact-condensed'],
  impact: ['impact-condensed', 'sport-condensed', 'poster-condensed'],
  document: ['technical-condensed', 'elegant-serif', 'editorial-strong'],
}

function hash32(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rotate<T>(values: readonly T[], offset: number): T[] {
  if (!values.length) return []
  const normalized = Math.abs(offset) % values.length
  return [...values.slice(normalized), ...values.slice(0, normalized)]
}

function withoutTripleRepeat<T>(values: readonly T[], recent: readonly T[]): T {
  if (!values.length) throw new Error('VISUAL_LAYOUT_NO_COMPATIBLE_CANDIDATE')
  const last = recent.slice(-2)
  if (last.length === 2 && last[0] === values[0] && last[1] === values[0])
    return values.find(value => value !== values[0]) ?? values[0]
  return values[0]
}

export type SelectVisualPresentationV3Input = {
  sceneId: string
  visualMode: 'asset-led' | 'editorial-text'
  heroKind?: 'simple-icon' | 'complex-illustration'
  relation?: string
  visibleWordCount: number
  keywordLength: number
  density: Densidad
  rhythm: Ritmo
  seed: number
  recentStructures?: readonly ModernLayoutStructureV3[]
  recentTypographyLooks?: readonly TypographyLookIdV3[]
}

export type VisualPresentationV3 = {
  structure: ModernLayoutStructureV3
  layout: VisualLayoutV3
  typographyLookId: TypographyLookIdV3
}

function structuralCandidates(input: SelectVisualPresentationV3Input): ModernLayoutStructureV3[] {
  const base = input.visualMode === 'asset-led' ? ASSET_STRUCTURES : EDITORIAL_STRUCTURES
  const relation = String(input.relation ?? '').toLocaleLowerCase('es')
  const preferred: ModernLayoutStructureV3[] = []
  if (/cruza|contrasta/.test(relation) && input.visualMode === 'asset-led') preferred.push('partidoVertical', 'cintaDiagonal')
  if (/contiene|estratifica/.test(relation) && input.visualMode === 'asset-led') preferred.push('marcoPoster', 'cuaderno')
  if (/expande|orbita/.test(relation) && input.visualMode === 'asset-led') preferred.push('anillosConcentricos', 'rayosImpacto')
  if (/anota|secuencia/.test(relation)) preferred.push('cuaderno')
  if (input.rhythm === 'golpeSeco' || input.rhythm === 'acelerando') preferred.push('rayosImpacto', 'cintaDiagonal')
  if (input.heroKind === 'complex-illustration') preferred.push('marcoPoster', 'partidoVertical', 'cuaderno')
  if (input.visualMode === 'editorial-text' && input.visibleWordCount >= 6) preferred.push('editorial', 'cuaderno')
  const unique = [...preferred, ...base].filter((value, index, values) =>
    base.includes(value) && values.indexOf(value) === index)
  const offset = hash32(`${input.sceneId}|${input.seed}|${input.keywordLength}|${input.visualMode}`) % unique.length
  return rotate(unique, offset)
}

export function createVisualLayoutV3(
  structure: ModernLayoutStructureV3,
  visualMode: 'asset-led' | 'editorial-text',
  seed: number,
): VisualLayoutV3 {
  const family = STRUCTURE_FAMILY_V3[structure]
  if (visualMode === 'editorial-text') {
    const textOnly: Record<Extract<ModernLayoutStructureV3, 'editorial' | 'cintaDiagonal' | 'rayosImpacto' | 'cuaderno'>,
      Pick<VisualLayoutV3, 'textRegion' | 'textBounds' | 'textAlignment'>> = {
      editorial: { textRegion: 'center-editorial', textBounds: { x: 10, y: 20, width: 80, height: 60 }, textAlignment: 'left' },
      cintaDiagonal: { textRegion: 'integrated-safe', textBounds: { x: 10, y: 28, width: 72, height: 48 }, textAlignment: 'left' },
      rayosImpacto: { textRegion: 'overlay-safe', textBounds: { x: 9, y: 28, width: 82, height: 45 }, textAlignment: 'center' },
      cuaderno: { textRegion: 'center-editorial', textBounds: { x: 11, y: 18, width: 78, height: 64 }, textAlignment: 'left' },
    }
    if (!(structure in textOnly)) throw new Error(`VISUAL_LAYOUT_EDITORIAL_INCOMPATIBLE:${structure}`)
    return { version: 1, family, heroPlacement: 'none', heroEnvelope: null, ...textOnly[structure as keyof typeof textOnly] }
  }

  if (structure === 'editorial') throw new Error('VISUAL_LAYOUT_ASSET_EDITORIAL_INCOMPATIBLE')
  if (structure === 'marcoPoster') return {
    version: 1, family, heroPlacement: 'framed', heroEnvelope: { x: 21, y: 17, width: 58, height: 42 },
    textRegion: 'bottom', textBounds: { x: 11, y: 65, width: 78, height: 22 }, textAlignment: 'center',
  }
  if (structure === 'partidoVertical') {
    const heroLeft = hash32(`split|${seed}`) % 2 === 0
    return heroLeft
      ? { version: 1, family, heroPlacement: 'left-dominant', heroEnvelope: { x: 11, y: 22, width: 36, height: 46 },
          textRegion: 'right', textBounds: { x: 53, y: 20, width: 38, height: 60 }, textAlignment: 'left' }
      : { version: 1, family, heroPlacement: 'right-dominant', heroEnvelope: { x: 53, y: 22, width: 36, height: 46 },
          textRegion: 'left', textBounds: { x: 9, y: 20, width: 38, height: 60 }, textAlignment: 'right' }
  }
  if (structure === 'cintaDiagonal') return {
    version: 1, family, heroPlacement: 'integrated', heroEnvelope: { x: 47, y: 18, width: 40, height: 34 },
    textRegion: 'integrated-safe', textBounds: { x: 9, y: 50, width: 52, height: 34 }, textAlignment: 'left',
  }
  if (structure === 'anillosConcentricos') return {
    version: 1, family, heroPlacement: 'center-dominant', heroEnvelope: { x: 23, y: 19, width: 54, height: 42 },
    textRegion: 'bottom', textBounds: { x: 11, y: 68, width: 78, height: 19 }, textAlignment: 'center',
  }
  if (structure === 'rayosImpacto') return {
    version: 1, family, heroPlacement: 'top-wide', heroEnvelope: { x: 18, y: 17, width: 64, height: 34 },
    textRegion: 'bottom', textBounds: { x: 9, y: 62, width: 82, height: 25 }, textAlignment: 'center',
  }
  return {
    version: 1, family, heroPlacement: 'right-dominant', heroEnvelope: { x: 50.5, y: 25, width: 35, height: 32 },
    textRegion: 'left', textBounds: { x: 9, y: 20, width: 48, height: 58 }, textAlignment: 'left',
  }
}

export function selectVisualPresentationV3(input: SelectVisualPresentationV3Input): VisualPresentationV3 {
  if (!Number.isSafeInteger(input.seed) || input.seed <= 0) throw new Error('VISUAL_LAYOUT_SEED_INVALID')
  const candidates = structuralCandidates(input)
  const structure = withoutTripleRepeat(candidates, input.recentStructures ?? [])
  const layout = createVisualLayoutV3(structure, input.visualMode, input.seed)
  const looks = LOOKS_BY_FAMILY[layout.family]
  const orderedLooks = rotate(looks, hash32(`${input.sceneId}|${input.seed}|${layout.family}|type`) % looks.length)
  const typographyLookId = withoutTripleRepeat(orderedLooks, input.recentTypographyLooks ?? [])
  return { structure, layout, typographyLookId }
}

export function typographyLookV3(id: TypographyLookIdV3): TypographyLookV3 {
  return TYPOGRAPHY_LOOKS_V3[id]
}
