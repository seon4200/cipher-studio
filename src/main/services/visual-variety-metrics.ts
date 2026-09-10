import { ESTRUCTURAS } from '../../shared/escena'
import { VISUAL_MVP_HERO_ENVELOPES, type VisualMvpStructure } from '../../shared/visual-scene-spec'

/**
 * Diagnostic-only projection of materialized modern Visuals. It never feeds
 * PixelIdentity, cache keys, layout selection, or renderer props.
 */
export const VISUAL_VARIETY_METRICS_VERSION = 1 as const

type SceneSpecForVarietyV1 = {
  visualMode: 'asset-led' | 'editorial-text'
  direccion: { estructura: string }
  text: { fontPairId: string; alignment?: string }
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
}

function counted(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'en')))
}

function supportedStructure(value: string): value is VisualMvpStructure {
  return Object.prototype.hasOwnProperty.call(VISUAL_MVP_HERO_ENVELOPES, value)
}

function keywordTypeface(fontPairId: string): string {
  // These are the keyword families currently consumed by VisualAssetMvp. The
  // connector pair differs, but both certified V13 keyword looks use Archivo Black.
  if (fontPairId === 'technical-black' || fontPairId === 'editorial-black') return 'Archivo Black'
  return `unknown:${fontPairId || 'missing'}`
}

function activeHero(spec: SceneSpecForVarietyV1): boolean {
  return spec.slots.some(slot => slot.role === 'hero' && (slot.state === 'present' || slot.state === 'procedural'))
}

function heroPlacement(structure: VisualMvpStructure): string {
  const anchor = ESTRUCTURAS[structure].heroe
  const envelope = VISUAL_MVP_HERO_ENVELOPES[structure]
  return `${structure}|center=${anchor.x.toFixed(2)},${anchor.y.toFixed(2)}|envelope=${envelope.widthPct}x${envelope.heightPct}`
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
  const nonMaterialized = new Set<string>()

  for (const input of inputs) {
    if (!input?.materialized || !input.sceneSpec) continue
    const spec = input.sceneSpec
    const structure = String(spec.direccion?.estructura ?? 'missing')
    const alignment = String(spec.text?.alignment ?? 'center')
    structures.push(structure)
    typefaces.push(keywordTypeface(String(spec.text?.fontPairId ?? '')))

    if (spec.visualMode === 'editorial-text') {
      if (structure !== 'editorial') nonMaterialized.add(structure)
      effectiveStructures.push(`editorial-text|text=${alignment}`)
      continue
    }

    if (!supportedStructure(structure) || !activeHero(spec)) {
      nonMaterialized.add(structure)
      effectiveStructures.push(`asset-led-unmaterialized|${structure}|text=${alignment}`)
      continue
    }
    const placement = heroPlacement(structure)
    placements.push(placement)
    effectiveStructures.push(`asset-led|${placement}|text=${alignment}`)
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
  }
}
