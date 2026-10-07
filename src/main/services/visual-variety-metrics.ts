import { ESTRUCTURAS } from '../../shared/escena'
import { VISUAL_MVP_HERO_ENVELOPES, type VisualMvpStructureV13 } from '../../shared/visual-scene-spec'
import { TYPOGRAPHY_LOOKS_V3, type TypographyLookIdV3 } from '../../shared/visual-layout-v3'

/**
 * Diagnostic-only projection of materialized modern Visuals. It never feeds
 * PixelIdentity, cache keys, layout selection, or renderer props.
 */
export const VISUAL_VARIETY_METRICS_VERSION = 1 as const

type SceneSpecForVarietyV1 = {
  visualMode: 'asset-led' | 'editorial-text'
  direccion: { estructura: string }
  layout?: {
    family: string
    heroPlacement: string
    heroEnvelope: { x: number; y: number; width: number; height: number } | null
    textRegion: string
    textBounds: { x: number; y: number; width: number; height: number }
  }
  text: { fontPairId?: string; typographyLookId?: string; alignment?: string }
  slots: readonly { role?: string; state?: string }[]
}

export type MaterializedVisualForVarietyV1 = {
  materialized: boolean
  sceneSpec: SceneSpecForVarietyV1
}

export type VisualVarietyMetricsV1 = {
  version: typeof VISUAL_VARIETY_METRICS_VERSION
  materializedVisuals: number
  distinctStructures: number
  dominantStructureShare: number
  distinctHeroPlacements: number
  distinctKeywordTypefaces: number
  structureDistribution: Record<string, number>
  effectiveStructureDistribution: Record<string, number>
  heroPlacementDistribution: Record<string, number>
  keywordTypefaceDistribution: Record<string, number>
  nonMaterializedStructureIds: string[]
  consecutiveSameStructure: number
  consecutiveSameHeroPlacement: number
  consecutiveSameKeywordTypeface: number
}

function counted(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'en')))
}

function supportedStructure(value: string): value is VisualMvpStructureV13 {
  return Object.prototype.hasOwnProperty.call(VISUAL_MVP_HERO_ENVELOPES, value)
}

function keywordTypeface(fontPairId: string, typographyLookId?: string): string {
  if (typographyLookId && Object.prototype.hasOwnProperty.call(TYPOGRAPHY_LOOKS_V3, typographyLookId))
    return TYPOGRAPHY_LOOKS_V3[typographyLookId as TypographyLookIdV3].keywordFamily
  // These are the keyword families currently consumed by VisualAssetMvp. The
  // connector pair differs, but both certified V13 keyword looks use Archivo Black.
  if (fontPairId === 'technical-black' || fontPairId === 'editorial-black') return 'Archivo Black'
  return `unknown:${fontPairId || 'missing'}`
}

function activeHero(spec: SceneSpecForVarietyV1): boolean {
  return spec.slots.some(slot => slot.role === 'hero' && (slot.state === 'present' || slot.state === 'procedural'))
}

function heroPlacement(structure: VisualMvpStructureV13): string {
  const anchor = ESTRUCTURAS[structure].heroe
  const envelope = VISUAL_MVP_HERO_ENVELOPES[structure]
  return `${structure}|center=${anchor.x.toFixed(2)},${anchor.y.toFixed(2)}|envelope=${envelope.widthPct}x${envelope.heightPct}`
}

function maxConsecutive(values: readonly string[]): number {
  let maximum = 0
  let run = 0
  let previous: string | undefined
  for (const value of values) {
    run = value === previous ? run + 1 : 1
    previous = value
    maximum = Math.max(maximum, run)
  }
  return maximum
}

/**
 * Measures perceptual opportunities actually materialized, not catalogue IDs.
 * Editorial text contributes one explicit editorial composition; a requested
 * non-editorial structure with no active Hero is recorded rather than counted
 * as false variety.
 */
export function measureVisualVarietyV1(inputs: readonly MaterializedVisualForVarietyV1[]): VisualVarietyMetricsV1 {
  const structures: string[] = []
  const effectiveStructures: string[] = []
  const placements: string[] = []
  const typefaces: string[] = []
  const consecutiveStructures: string[] = []
  const consecutivePlacements: string[] = []
  const nonMaterialized = new Set<string>()

  for (const input of inputs) {
    if (!input?.materialized || !input.sceneSpec) continue
    const spec = input.sceneSpec
    const structure = String(spec.direccion?.estructura ?? 'missing')
    const alignment = String(spec.text?.alignment ?? 'center')
    structures.push(structure)
    const typeface = keywordTypeface(String(spec.text?.fontPairId ?? ''), spec.text?.typographyLookId)
    typefaces.push(typeface)

    if (spec.layout) {
      const envelope = spec.layout.heroEnvelope
      const placement = envelope
        ? `${spec.layout.heroPlacement}|rect=${envelope.x},${envelope.y},${envelope.width},${envelope.height}`
        : 'none'
      // A family is the perceptual grammar. Left/right variants and envelope geometry are
      // deliberately measured by distinctHeroPlacements instead of being double-counted as
      // extra structures (which would make the diversity gate trivially gameable).
      effectiveStructures.push(spec.layout.family)
      consecutiveStructures.push(spec.layout.family)
      consecutivePlacements.push(placement)
      if (envelope && activeHero(spec)) placements.push(placement)
      else if (spec.visualMode === 'asset-led') nonMaterialized.add(structure)
      continue
    }

    if (spec.visualMode === 'editorial-text') {
      if (structure !== 'editorial') nonMaterialized.add(structure)
      effectiveStructures.push(`editorial-text|text=${alignment}`)
      consecutiveStructures.push('editorial-text')
      consecutivePlacements.push('none')
      continue
    }

    if (!supportedStructure(structure) || !activeHero(spec)) {
      nonMaterialized.add(structure)
      effectiveStructures.push(`asset-led-unmaterialized|${structure}|text=${alignment}`)
      consecutiveStructures.push(`asset-led-unmaterialized:${structure}`)
      consecutivePlacements.push('none')
      continue
    }
    const placement = heroPlacement(structure)
    placements.push(placement)
    effectiveStructures.push(`asset-led|${placement}|text=${alignment}`)
    consecutiveStructures.push(structure)
    consecutivePlacements.push(placement)
  }

  const effectiveDistribution = counted(effectiveStructures)
  const largest = Math.max(0, ...Object.values(effectiveDistribution))
  const materializedVisuals = effectiveStructures.length
  return {
    version: VISUAL_VARIETY_METRICS_VERSION,
    materializedVisuals,
    distinctStructures: Object.keys(effectiveDistribution).length,
    dominantStructureShare: materializedVisuals === 0 ? 0 : Number((largest / materializedVisuals * 100).toFixed(2)),
    distinctHeroPlacements: new Set(placements).size,
    distinctKeywordTypefaces: new Set(typefaces).size,
    structureDistribution: counted(structures),
    effectiveStructureDistribution: effectiveDistribution,
    heroPlacementDistribution: counted(placements),
    keywordTypefaceDistribution: counted(typefaces),
    nonMaterializedStructureIds: [...nonMaterialized].sort((left, right) => left.localeCompare(right, 'en')),
    consecutiveSameStructure: maxConsecutive(consecutiveStructures),
    consecutiveSameHeroPlacement: maxConsecutive(consecutivePlacements),
    consecutiveSameKeywordTypeface: maxConsecutive(typefaces),
  }
}
