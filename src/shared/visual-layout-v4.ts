import type { Densidad, Ritmo } from './escena'
import type { PercentRectV3, TypographyLookIdV3 } from './visual-layout-v3'

export const VISUAL_LAYOUT_V4_VERSION = 2 as const

export const MODERN_LAYOUT_STRUCTURES_V4 = [
  'editorial', 'marcoPoster', 'partidoVertical', 'cintaDiagonal', 'anillosConcentricos',
  'rayosImpacto', 'cuaderno', 'constelacion', 'capasApiladas', 'redNodos', 'lineaTiempo',
  'corteTransversal', 'abanicoTarjetas', 'engranajes', 'cascada', 'mundoIsometrico',
  'pilaVertical',
] as const
export type ModernLayoutStructureV4 = typeof MODERN_LAYOUT_STRUCTURES_V4[number]

export const SCENE_SLOT_IDS_V2 = ['hero', 'support-1', 'support-2'] as const
export type SceneSlotIdV2 = typeof SCENE_SLOT_IDS_V2[number]
export type SceneSlotRoleV2 = SceneSlotIdV2

export const HERO_PLACEMENTS_V4 = [
  'none', 'center-dominant', 'left-dominant', 'right-dominant', 'top-wide', 'framed',
  'integrated', 'document-field', 'radial-center', 'stack-anchor',
] as const
export type HeroPlacementV4 = typeof HERO_PLACEMENTS_V4[number]

export const TEXT_REGIONS_V4 = [
  'top', 'bottom', 'left', 'right', 'center-editorial', 'integrated-safe', 'overlay-safe',
  'document-margin', 'timeline-caption',
] as const
export type TextRegionV4 = typeof TEXT_REGIONS_V4[number]

export const RELATION_STYLES_V4 = [
  'none', 'frame', 'split-axis', 'diagonal-axis', 'radial', 'impact', 'document',
  'constellation-links', 'layer-stack', 'network-links', 'timeline', 'cross-section',
  'card-fan', 'interlock', 'cascade-flow', 'isometric-field', 'vertical-hierarchy',
] as const
export type RelationStyleV4 = typeof RELATION_STYLES_V4[number]

export type SlotLayoutV4 = {
  slotId: SceneSlotIdV2
  placement: HeroPlacementV4
  envelope: PercentRectV3
  zIndex: 2 | 3 | 4 | 5 | 6
  rotationDeg: number
  opacity: number
  backing: 'none' | 'neutral-plate' | 'frame' | 'halo'
  crop: 'none' | 'cover-safe'
}

export type VisualLayoutV4 = {
  version: typeof VISUAL_LAYOUT_V4_VERSION
  family: ModernLayoutStructureV4
  textRegion: TextRegionV4
  textBounds: PercentRectV3
  textAlignment: 'left' | 'center' | 'right'
  relationStyle: RelationStyleV4
  slotLayouts: SlotLayoutV4[]
}

export type LayoutEligibilityV4 = {
  family: ModernLayoutStructureV4
  certified: true
  requiresHero: boolean
  minSupports: 0 | 1 | 2
  maxSupports: 0 | 1 | 2
  relationKinds: readonly string[]
  reason: string
}

export const LAYOUT_ELIGIBILITY_V4: Readonly<Record<ModernLayoutStructureV4, LayoutEligibilityV4>> = Object.freeze({
  editorial: { family: 'editorial', certified: true, requiresHero: false, minSupports: 0, maxSupports: 0,
    relationKinds: [], reason: 'El texto es el sujeto y no reserva slots muertos.' },
  marcoPoster: { family: 'marcoPoster', certified: true, requiresHero: true, minSupports: 0, maxSupports: 2,
    relationKinds: [], reason: 'Hero dominante con supports subordinados dentro del campo de póster.' },
  partidoVertical: { family: 'partidoVertical', certified: true, requiresHero: true, minSupports: 0, maxSupports: 2,
    relationKinds: ['contrasta', 'compara'], reason: 'Separa Hero y texto; supports permanecen secundarios.' },
  cintaDiagonal: { family: 'cintaDiagonal', certified: true, requiresHero: true, minSupports: 0, maxSupports: 2,
    relationKinds: ['cruza', 'impulsa'], reason: 'El eje diagonal relaciona contenido real, no placeholders.' },
  anillosConcentricos: { family: 'anillosConcentricos', certified: true, requiresHero: true, minSupports: 0, maxSupports: 2,
    relationKinds: ['enfoca', 'orbita'], reason: 'El Hero es el foco; cada support ocupa una órbita materializada.' },
  rayosImpacto: { family: 'rayosImpacto', certified: true, requiresHero: true, minSupports: 0, maxSupports: 2,
    relationKinds: ['impacta', 'expande'], reason: 'Geometría de impacto subordinada al Hero.' },
  cuaderno: { family: 'cuaderno', certified: true, requiresHero: true, minSupports: 0, maxSupports: 2,
    relationKinds: ['anota', 'documenta'], reason: 'Hero y supports ocupan regiones documentales reales.' },
  constelacion: { family: 'constelacion', certified: true, requiresHero: true, minSupports: 1, maxSupports: 2,
    relationKinds: ['conecta', 'relaciona', 'orbita'], reason: 'Exige al menos un nodo semántico además del Hero.' },
  capasApiladas: { family: 'capasApiladas', certified: true, requiresHero: true, minSupports: 1, maxSupports: 2,
    relationKinds: ['contiene', 'estratifica', 'compone'], reason: 'Cada capa corresponde a un concepto real.' },
  redNodos: { family: 'redNodos', certified: true, requiresHero: true, minSupports: 2, maxSupports: 2,
    relationKinds: ['conecta', 'red', 'interactua'], reason: 'Tres nodos semánticos forman una red mínima.' },
  lineaTiempo: { family: 'lineaTiempo', certified: true, requiresHero: true, minSupports: 2, maxSupports: 2,
    relationKinds: ['secuencia', 'antes', 'despues', 'evoluciona'], reason: 'Requiere tres hitos reales y orden defendible.' },
  corteTransversal: { family: 'corteTransversal', certified: true, requiresHero: true, minSupports: 1, maxSupports: 2,
    relationKinds: ['contiene', 'parte', 'estrato', 'interior'], reason: 'Cada banda representa una parte o estrato real.' },
  abanicoTarjetas: { family: 'abanicoTarjetas', certified: true, requiresHero: true, minSupports: 2, maxSupports: 2,
    relationKinds: ['compara', 'coleccion', 'alternativas'], reason: 'Tres elementos reales justifican las tarjetas.' },
  engranajes: { family: 'engranajes', certified: true, requiresHero: true, minSupports: 2, maxSupports: 2,
    relationKinds: ['interactua', 'mecanismo', 'coopera', 'conecta'], reason: 'Los tres conceptos deben interactuar.' },
  cascada: { family: 'cascada', certified: true, requiresHero: true, minSupports: 2, maxSupports: 2,
    relationKinds: ['causa', 'secuencia', 'deriva', 'fluye'], reason: 'La dirección expresa una cadena real.' },
  mundoIsometrico: { family: 'mundoIsometrico', certified: true, requiresHero: true, minSupports: 2, maxSupports: 2,
    relationKinds: ['contexto', 'sistema', 'entorno', 'construye'], reason: 'Tres objetos/contextos sostienen el campo isométrico.' },
  pilaVertical: { family: 'pilaVertical', certified: true, requiresHero: true, minSupports: 1, maxSupports: 2,
    relationKinds: ['jerarquia', 'niveles', 'pasos', 'contiene'], reason: 'Cada nivel corresponde a un concepto materializado.' },
})

const BASE_FAMILIES: readonly ModernLayoutStructureV4[] = [
  'marcoPoster', 'partidoVertical', 'cintaDiagonal', 'anillosConcentricos', 'rayosImpacto', 'cuaderno',
]

const rect = (x: number, y: number, width: number, height: number): PercentRectV3 => ({ x, y, width, height })
const slot = (
  slotId: SceneSlotIdV2,
  placement: HeroPlacementV4,
  envelope: PercentRectV3,
  zIndex: SlotLayoutV4['zIndex'],
  backing: SlotLayoutV4['backing'] = 'none',
  rotationDeg = 0,
  opacity = 1,
  crop: SlotLayoutV4['crop'] = 'none',
): SlotLayoutV4 => ({ slotId, placement, envelope, zIndex, rotationDeg, opacity, backing, crop })

function relationStyle(family: ModernLayoutStructureV4): RelationStyleV4 {
  return ({
    editorial: 'none', marcoPoster: 'frame', partidoVertical: 'split-axis', cintaDiagonal: 'diagonal-axis',
    anillosConcentricos: 'radial', rayosImpacto: 'impact', cuaderno: 'document',
    constelacion: 'constellation-links', capasApiladas: 'layer-stack', redNodos: 'network-links',
    lineaTiempo: 'timeline', corteTransversal: 'cross-section', abanicoTarjetas: 'card-fan',
    engranajes: 'interlock', cascada: 'cascade-flow', mundoIsometrico: 'isometric-field',
    pilaVertical: 'vertical-hierarchy',
  } as const)[family]
}

function activeIds(supportCount: number): SceneSlotIdV2[] {
  return ['hero', ...(supportCount >= 1 ? ['support-1'] : []), ...(supportCount >= 2 ? ['support-2'] : [])] as SceneSlotIdV2[]
}

/** Exact geometry authority for V15 renderer, QC and PixelIdentity. */
export function createVisualLayoutV4(
  family: ModernLayoutStructureV4,
  visualMode: 'asset-led' | 'editorial-text',
  supportCount: number,
  seed: number,
): VisualLayoutV4 {
  if (!MODERN_LAYOUT_STRUCTURES_V4.includes(family) || !Number.isSafeInteger(seed) || seed <= 0)
    throw new Error('VISUAL_LAYOUT_V4_INPUT_INVALID')
  const supports = Math.min(2, Math.max(0, Math.trunc(supportCount)))
  if (visualMode === 'editorial-text') {
    if (family !== 'editorial' || supports !== 0) throw new Error('VISUAL_LAYOUT_V4_EDITORIAL_INVALID')
    return { version: 2, family, textRegion: 'center-editorial', textBounds: rect(10, 22, 80, 56),
      textAlignment: 'left', relationStyle: 'none', slotLayouts: [] }
  }
  const eligibility = LAYOUT_ELIGIBILITY_V4[family]
  if (!eligibility.requiresHero || supports < eligibility.minSupports || supports > eligibility.maxSupports)
    throw new Error('VISUAL_LAYOUT_V4_ELIGIBILITY_INVALID')
  const ids = activeIds(supports)
  const take = (values: SlotLayoutV4[]) => values.filter(value => ids.includes(value.slotId))
  const common = (textRegion: TextRegionV4, textBounds: PercentRectV3,
    textAlignment: VisualLayoutV4['textAlignment'], values: SlotLayoutV4[]): VisualLayoutV4 => ({
    version: 2, family, textRegion, textBounds, textAlignment,
    relationStyle: relationStyle(family), slotLayouts: take(values),
  })
  if (family === 'marcoPoster') return common('bottom', rect(11, 69, 78, 17), 'center', [
    slot('hero', 'framed', rect(17, 15, 66, 48), 4, 'neutral-plate'),
    slot('support-1', 'left-dominant', rect(9, 48, 22, 17), 6, 'halo', -5),
    slot('support-2', 'right-dominant', rect(69, 48, 22, 17), 6, 'halo', 5),
  ])
  if (family === 'partidoVertical') {
    const heroLeft = seed % 2 === 0
    return common(heroLeft ? 'right' : 'left', heroLeft ? rect(57, 20, 34, 54) : rect(9, 20, 34, 54),
      heroLeft ? 'left' : 'right', [
        slot('hero', heroLeft ? 'left-dominant' : 'right-dominant', heroLeft ? rect(9, 19, 43, 50) : rect(48, 19, 43, 50), 4),
        slot('support-1', heroLeft ? 'right-dominant' : 'left-dominant', heroLeft ? rect(62, 57, 23, 18) : rect(15, 57, 23, 18), 5, 'halo'),
        slot('support-2', heroLeft ? 'right-dominant' : 'left-dominant', heroLeft ? rect(70, 13.8, 18, 15) : rect(12, 13.8, 18, 15), 5, 'halo'),
      ])
  }
  if (family === 'cintaDiagonal') return common('bottom', rect(9, 66, 58, 20), 'left', [
    slot('hero', 'integrated', rect(38, 17, 51, 44), 4, 'none', -5),
    slot('support-1', 'left-dominant', rect(9, 37, 24, 20), 5, 'halo', -8),
    slot('support-2', 'right-dominant', rect(69, 57, 22, 18), 5, 'halo', -8),
  ])
  if (family === 'anillosConcentricos') return common('bottom', rect(11, 64, 78, 22), 'center', [
    slot('hero', 'radial-center', rect(24, 19, 52, 42), 4, 'halo'),
    slot('support-1', 'right-dominant', rect(71, 22, 19, 16), 5, 'halo'),
    slot('support-2', 'left-dominant', rect(10, 44, 19, 16), 5, 'halo'),
  ])
  if (family === 'rayosImpacto') return common('bottom', rect(9, 64, 82, 22), 'center', [
    slot('hero', 'center-dominant', rect(19, 16, 62, 46), 5, 'halo'),
    slot('support-1', 'left-dominant', rect(8.5, 45, 22, 17), 6, 'neutral-plate', -7),
    slot('support-2', 'right-dominant', rect(69.5, 45, 22, 17), 6, 'neutral-plate', 7),
  ])
  if (family === 'cuaderno') return common('document-margin', rect(10, 58, 49, 26), 'left', [
    slot('hero', 'document-field', rect(50, 18, 38, 35), 4, 'frame', 2),
    slot('support-1', 'left-dominant', rect(11, 20, 26, 21), 5, 'none', -3),
    slot('support-2', 'right-dominant', rect(63, 56, 23, 19), 5, 'none', 4),
  ])
  if (family === 'constelacion') return common('bottom', rect(13, 72, 74, 14), 'center', [
    slot('hero', 'radial-center', rect(31, 25, 38, 31), 5, 'halo'),
    slot('support-1', 'left-dominant', rect(8.5, 18, 24, 20), 4, 'halo'),
    slot('support-2', 'right-dominant', rect(68, 45, 23, 19), 4, 'halo'),
  ])
  if (family === 'capasApiladas') return common('right', rect(57, 59, 34, 25), 'left', [
    slot('hero', 'stack-anchor', rect(16, 19, 50, 38), 5, 'neutral-plate', -3),
    slot('support-1', 'right-dominant', rect(54, 35, 32, 25), 4, 'neutral-plate', 4),
    slot('support-2', 'left-dominant', rect(13, 55, 30, 23), 3, 'neutral-plate', -4),
  ])
  if (family === 'redNodos') return common('bottom', rect(13, 73, 74, 13), 'center', [
    slot('hero', 'center-dominant', rect(31, 19, 38, 31), 6, 'halo'),
    slot('support-1', 'left-dominant', rect(8.5, 47, 25, 21), 5, 'halo'),
    slot('support-2', 'right-dominant', rect(66.5, 47, 25, 21), 5, 'halo'),
  ])
  if (family === 'lineaTiempo') return common('timeline-caption', rect(10, 73, 80, 13), 'left', [
    slot('hero', 'left-dominant', rect(5.5, 15.5, 35, 33), 6, 'frame'),
    slot('support-1', 'center-dominant', rect(38.5, 35, 23, 22), 5, 'frame'),
    slot('support-2', 'right-dominant', rect(67.5, 50, 23, 22), 5, 'frame'),
  ])
  if (family === 'corteTransversal') return common('right', rect(58, 19, 33, 62), 'left', [
    slot('hero', 'left-dominant', rect(9, 18, 43, 28), 5, 'neutral-plate'),
    slot('support-1', 'left-dominant', rect(9, 47, 43, 18), 4, 'neutral-plate'),
    slot('support-2', 'left-dominant', rect(9, 66, 43, 18), 3, 'neutral-plate'),
  ])
  if (family === 'abanicoTarjetas') return common('top', rect(12, 14, 76, 17), 'center', [
    slot('hero', 'center-dominant', rect(28, 33, 44, 40), 6, 'frame'),
    slot('support-1', 'left-dominant', rect(10, 41, 30, 26), 4, 'frame', -11),
    slot('support-2', 'right-dominant', rect(60, 41, 30, 26), 5, 'frame', 11),
  ])
  if (family === 'engranajes') return common('bottom', rect(12, 71, 76, 15), 'center', [
    slot('hero', 'center-dominant', rect(31, 19.5, 38, 31), 6, 'halo'),
    slot('support-1', 'left-dominant', rect(9, 46, 30, 25), 5, 'halo'),
    slot('support-2', 'right-dominant', rect(61, 46, 30, 25), 5, 'halo'),
  ])
  if (family === 'cascada') return common('top', rect(55, 12, 36, 22), 'left', [
    slot('hero', 'left-dominant', rect(8.5, 15.5, 40, 29), 6, 'neutral-plate'),
    slot('support-1', 'center-dominant', rect(30, 39, 34, 24), 5, 'neutral-plate'),
    slot('support-2', 'right-dominant', rect(51, 58, 34, 24), 4, 'neutral-plate'),
  ])
  if (family === 'mundoIsometrico') return common('top', rect(11, 14, 78, 15), 'center', [
    slot('hero', 'center-dominant', rect(30, 34, 40, 34), 6, 'halo'),
    slot('support-1', 'left-dominant', rect(8.5, 53, 29, 24), 5, 'neutral-plate', -3),
    slot('support-2', 'right-dominant', rect(62.5, 53, 29, 24), 5, 'neutral-plate', 3),
  ])
  return common('right', rect(58, 19, 33, 63), 'left', [
    slot('hero', 'stack-anchor', rect(10, 17, 42, 27), 6, 'neutral-plate'),
    slot('support-1', 'stack-anchor', rect(13, 44, 36, 20), 5, 'neutral-plate'),
    slot('support-2', 'stack-anchor', rect(16, 64, 30, 18), 4, 'neutral-plate'),
  ])
}

function normalizeRelation(value: string | undefined): string {
  return String(value ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '')
}

export function isLayoutEligibleV4(input: {
  family: ModernLayoutStructureV4
  visualMode: 'asset-led' | 'editorial-text'
  supportCount: number
  relation?: string
}): boolean {
  const rule = LAYOUT_ELIGIBILITY_V4[input.family]
  if (input.visualMode === 'editorial-text') return input.family === 'editorial' && input.supportCount === 0
  if (!rule.requiresHero || input.supportCount < rule.minSupports || input.supportCount > rule.maxSupports) return false
  if (!rule.relationKinds.length || BASE_FAMILIES.includes(input.family)) return true
  const relation = normalizeRelation(input.relation)
  return rule.relationKinds.some(term => relation.includes(normalizeRelation(term)))
}

export function eligibleLayoutFamiliesV4(input: {
  visualMode: 'asset-led' | 'editorial-text'
  supportCount: number
  relation?: string
}): ModernLayoutStructureV4[] {
  return MODERN_LAYOUT_STRUCTURES_V4.filter(family => isLayoutEligibleV4({ ...input, family }))
}

function hash32(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}

export function selectVisualPresentationV4(input: {
  sceneId: string
  visualMode: 'asset-led' | 'editorial-text'
  supportCount: number
  relation?: string
  density: Densidad
  rhythm: Ritmo
  seed: number
  allowedTypographyLooks: readonly TypographyLookIdV3[]
  recentFamilies?: readonly ModernLayoutStructureV4[]
  recentTypographyLooks?: readonly TypographyLookIdV3[]
}): { family: ModernLayoutStructureV4; layout: VisualLayoutV4; typographyLookId: TypographyLookIdV3 } {
  const compatible = eligibleLayoutFamiliesV4(input)
  if (!compatible.length) throw new Error('VISUAL_LAYOUT_V4_NO_ELIGIBLE_FAMILY')
  const offset = hash32(`${input.sceneId}|${input.seed}|${input.supportCount}|${input.rhythm}|${input.density}`) % compatible.length
  const rotated = [...compatible.slice(offset), ...compatible.slice(0, offset)]
  const recent = input.recentFamilies?.slice(-2) ?? []
  const family = recent.length === 2 && recent[0] === rotated[0] && recent[1] === rotated[0]
    ? rotated.find(value => value !== rotated[0]) ?? rotated[0] : rotated[0]
  const looks = input.allowedTypographyLooks.length ? [...input.allowedTypographyLooks] : ['editorial-strong' as const]
  const lookOffset = hash32(`${input.sceneId}|${input.seed}|${family}|typography-v15`) % looks.length
  const orderedLooks = [...looks.slice(lookOffset), ...looks.slice(0, lookOffset)]
  const recentLooks = input.recentTypographyLooks?.slice(-2) ?? []
  const typographyLookId = recentLooks.length === 2 && recentLooks[0] === orderedLooks[0] && recentLooks[1] === orderedLooks[0]
    ? orderedLooks.find(value => value !== orderedLooks[0]) ?? orderedLooks[0] : orderedLooks[0]
  return { family, layout: createVisualLayoutV4(family, input.visualMode, input.supportCount, input.seed), typographyLookId }
}
