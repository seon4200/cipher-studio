import { canonicalNarrativeTerm } from '../../shared/asset-intent'
import { type ConceptLexiconEntryV1, type ConceptExpansionLevelV1 } from '../../shared/concept-lexicon'
import type { VisualConceptV1 } from '../../shared/visual-concepts'
import { NOMBRES_SOLAR } from '../../shared/solar-nombres'

/**
 * Search metadata for the complete local Solar name catalog. The renderer still accepts only
 * the certified `linear` and `bold-duotone` variants; this index never expands renderer styles.
 */
export const SOLAR_ASSET_INDEX_VERSION = 1 as const
export const SOLAR_RENDERABLE_VARIANTS_V1 = ['bold-duotone', 'linear'] as const

export type SolarAssetIndexEntryV1 = {
  base: string
  variants: readonly string[]
  renderableVariants: readonly string[]
}

export type SolarAssetIndexV1 = {
  version: typeof SOLAR_ASSET_INDEX_VERSION
  totalVariantNames: number
  bases: readonly SolarAssetIndexEntryV1[]
}

export type SolarSearchCandidateV1 = {
  provider: 'solar'
  base: string
  variant: string
  score: 0 | 1 | 2 | 3
  level: ConceptExpansionLevelV1
  reason: string
}

const SUFFIXES = ['bold-duotone', 'line-duotone', 'linear', 'outline', 'broken', 'bold'] as const
let cached: SolarAssetIndexV1 | undefined

function baseFor(name: string): string {
  for (const suffix of SUFFIXES) if (name.endsWith('-' + suffix)) return name.slice(0, -suffix.length - 1)
  return name
}

function scoreFor(level: ConceptExpansionLevelV1): 0 | 1 | 2 | 3 {
  return level === 'exact' ? 3 : level === 'synonym' ? 3 : level === 'related' ? 2 : 1
}

function queryKey(value: string): string {
  return canonicalNarrativeTerm(value).replace(/\s+/g, '-')
}

export function loadSolarAssetIndexV1(): SolarAssetIndexV1 {
  if (cached) return cached
  const groups = new Map<string, string[]>()
  for (const raw of NOMBRES_SOLAR) {
    const name = String(raw).trim().toLowerCase()
    if (!name) continue
    const base = baseFor(name)
    const values = groups.get(base) ?? []
    values.push(name)
    groups.set(base, values)
  }
  const bases = [...groups.entries()].map(([base, variants]) => ({
    base,
    variants: Object.freeze([...new Set(variants)].sort((a, b) => a.localeCompare(b, 'en'))),
    renderableVariants: Object.freeze(SOLAR_RENDERABLE_VARIANTS_V1
      .map(style => base + '-' + style)
      .filter(name => variants.includes(name))),
  })).sort((a, b) => a.base.localeCompare(b.base, 'en'))
  cached = Object.freeze({ version: SOLAR_ASSET_INDEX_VERSION, totalVariantNames: NOMBRES_SOLAR.length, bases: Object.freeze(bases) })
  return cached
}

function allTokensMatch(base: string, query: string): boolean {
  const baseTokens = base.split('-').filter(Boolean)
  const queryTokens = query.split('-').filter(Boolean)
  return queryTokens.length > 0 && queryTokens.every(token => baseTokens.includes(token))
}

/**
 * Finds a canonical Solar concept base first, then selects a renderer-certified variant. The
 * complete index remains visible in diagnostics even if a base lacks a currently renderable style.
 */
export function searchSolarAssetIndexV1(input: {
  concept: VisualConceptV1
  lexicon?: ConceptLexiconEntryV1
  level: ConceptExpansionLevelV1
  limit?: number
}): readonly SolarSearchCandidateV1[] {
  const index = loadSolarAssetIndexV1()
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 6), 1), 20)
  const directBases = new Set((input.lexicon?.solarBases ?? []).map(queryKey).filter(Boolean))
  const queryTerms = [input.concept.normalizedTerm, ...input.concept.aliases,
    ...(input.lexicon ? [input.lexicon.canonical, ...input.lexicon.synonyms, ...input.lexicon.related] : [])]
    .map(queryKey).filter(Boolean)
  const candidates: SolarSearchCandidateV1[] = []
  for (const row of index.bases) {
    const variant = row.renderableVariants[0]
    if (!variant) continue
    const direct = directBases.has(row.base)
    const matched = direct || queryTerms.some(term => term === row.base || allTokensMatch(row.base, term))
    if (!matched) continue
    const score = direct ? scoreFor(input.level) : (input.level === 'context' ? 1 : 2)
    candidates.push({
      provider: 'solar', base: row.base, variant, score,
      level: input.level,
      reason: direct ? 'LEXICON_SOLAR_BASE' : 'SOLAR_BASE_TOKEN_MATCH',
    })
  }
  return candidates.sort((a, b) => b.score - a.score || a.base.localeCompare(b.base, 'en')).slice(0, limit)
}
