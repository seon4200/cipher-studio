import { canonicalNarrativeTerm } from './asset-intent'
import { expandConceptLexiconV1 } from './concept-lexicon'
import {
  COLOR_PALETTE_FAMILIES_V1,
  COLOR_PALETTE_FAMILY_VERSION_V1,
  COLOR_PALETTE_REVISION_V1,
  validateVideoColorPalettePlanV1,
  type ColorAccentVariantV1,
  type ColorPaletteFamilyIdV1,
  type ColorPaletteTokensV1,
  type SceneColorPaletteV1,
  type VideoColorPalettePlanV1,
} from './color-palette-v1'

export const COLOR_THEME_IDS_V1 = [
  'technology', 'nature', 'space', 'alert-conflict', 'creative', 'industrial', 'education', 'neutral',
] as const

export type ColorThemeIdV1 = typeof COLOR_THEME_IDS_V1[number]

export type VideoColorPaletteSelectionV1 = {
  plan: VideoColorPalettePlanV1
  theme: ColorThemeIdV1
  scores: Record<ColorThemeIdV1, number>
  evidence: string[]
}

type ThemeDefinitionV1 = {
  id: ColorThemeIdV1
  terms: readonly string[]
  palettes: readonly ColorPaletteFamilyIdV1[]
}

const THEMES_V1: readonly ThemeDefinitionV1[] = Object.freeze([
  Object.freeze({ id: 'technology', terms: Object.freeze([
    'technology', 'tecnologia', 'digital', 'software', 'data', 'datos', 'computer', 'computadora',
    'internet', 'network', 'red', 'artificial intelligence', 'inteligencia artificial', 'ai', 'ia',
    'robot', 'automation', 'automatizacion', 'algorithm', 'algoritmo', 'cyber', 'server', 'cloud',
  ]), palettes: Object.freeze(['blue-tech', 'cyan-digital', 'purple-cosmic'] as ColorPaletteFamilyIdV1[]) }),
  Object.freeze({ id: 'nature', terms: Object.freeze([
    'nature', 'naturaleza', 'environment', 'ambiente', 'ecology', 'ecologia', 'forest', 'bosque',
    'tree', 'arbol', 'leaf', 'hoja', 'plant', 'planta', 'water', 'agua', 'ocean', 'river', 'growth',
    'crecimiento', 'climate', 'clima', 'animal', 'seedling', 'semilla',
  ]), palettes: Object.freeze(['green-nature', 'cyan-digital', 'yellow-energy'] as ColorPaletteFamilyIdV1[]) }),
  Object.freeze({ id: 'space', terms: Object.freeze([
    'space', 'espacio', 'universe', 'universo', 'astronomy', 'astronomia', 'planet', 'planeta',
    'star', 'estrella', 'moon', 'luna', 'rocket', 'cohete', 'astronaut', 'astronauta', 'satellite',
    'satelite', 'telescope', 'telescopio', 'cosmos', 'galaxy', 'galaxia', 'mystery', 'misterio',
  ]), palettes: Object.freeze(['purple-cosmic', 'blue-tech', 'cyan-digital'] as ColorPaletteFamilyIdV1[]) }),
  Object.freeze({ id: 'alert-conflict', terms: Object.freeze([
    'danger', 'peligro', 'warning', 'advertencia', 'alert', 'alerta', 'conflict', 'conflicto', 'war',
    'guerra', 'emergency', 'emergencia', 'fire', 'incendio', 'accident', 'accidente', 'risk', 'riesgo',
    'protest', 'protesta', 'police', 'policia', 'violence', 'violencia', 'crisis', 'hunger', 'hambre',
  ]), palettes: Object.freeze(['red-alert', 'sunset-energy', 'yellow-energy'] as ColorPaletteFamilyIdV1[]) }),
  Object.freeze({ id: 'creative', terms: Object.freeze([
    'creative', 'creativo', 'creatividad', 'art', 'arte', 'culture', 'cultura', 'entertainment',
    'entretenimiento', 'music', 'musica', 'film', 'pelicula', 'cinema', 'design', 'diseno', 'celebration',
    'celebracion', 'party', 'fiesta', 'fashion', 'moda', 'story', 'historia', 'performance', 'talent', 'talento',
  ]), palettes: Object.freeze(['magenta-creative', 'purple-cosmic', 'sunset-energy'] as ColorPaletteFamilyIdV1[]) }),
  Object.freeze({ id: 'industrial', terms: Object.freeze([
    'industry', 'industria', 'industrial', 'engineering', 'ingenieria', 'mechanical', 'mecanica', 'machine',
    'maquina', 'gear', 'engranaje', 'factory', 'fabrica', 'construction', 'construccion', 'worker',
    'trabajador', 'building', 'edificio', 'infrastructure', 'infraestructura', 'transport', 'manufacturing',
  ]), palettes: Object.freeze(['silver-industrial', 'blue-tech', 'yellow-energy'] as ColorPaletteFamilyIdV1[]) }),
  Object.freeze({ id: 'education', terms: Object.freeze([
    'education', 'educacion', 'school', 'escuela', 'learning', 'aprendizaje', 'book', 'libro', 'idea',
    'discovery', 'descubrimiento', 'research', 'investigacion', 'science', 'ciencia', 'teacher', 'profesor',
    'student', 'estudiante', 'university', 'universidad', 'knowledge', 'conocimiento', 'experiment', 'laboratory',
  ]), palettes: Object.freeze(['yellow-energy', 'blue-tech', 'green-nature'] as ColorPaletteFamilyIdV1[]) }),
  Object.freeze({ id: 'neutral', terms: Object.freeze([]), palettes: Object.freeze([
    'blue-tech', 'silver-industrial', 'cyan-digital',
  ] as ColorPaletteFamilyIdV1[]) }),
])

const THEME_TERM_SETS = new Map(THEMES_V1.map(theme => [theme.id,
  new Set(theme.terms.map(canonicalNarrativeTerm).filter(Boolean))] as const))

function hash32(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function semanticSignals(terms: readonly unknown[]): Map<string, number> {
  const signals = new Map<string, number>()
  const add = (value: string, weight: number) => {
    const normalized = canonicalNarrativeTerm(value)
    if (!normalized) return
    signals.set(normalized, Math.max(signals.get(normalized) ?? 0, weight))
    for (const token of normalized.split(/\s+/).filter(token => token.length >= 3))
      signals.set(token, Math.max(signals.get(token) ?? 0, Math.max(1, weight - 1)))
  }
  for (const raw of terms) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    add(raw, 4)
    for (const expansion of expandConceptLexiconV1(raw)) {
      const weight = expansion.level === 'exact' ? 4 : expansion.level === 'synonym' ? 3 :
        expansion.level === 'related' ? 2 : 1
      add(expansion.term, weight)
      add(expansion.entry.canonical, weight)
    }
  }
  return signals
}

function scoreThemes(terms: readonly unknown[]): { scores: Record<ColorThemeIdV1, number>; evidence: string[] } {
  const signals = semanticSignals(terms)
  const scores = Object.fromEntries(COLOR_THEME_IDS_V1.map(id => [id, 0])) as Record<ColorThemeIdV1, number>
  const evidence: Array<{ term: string; theme: ColorThemeIdV1; weight: number }> = []
  for (const theme of THEMES_V1) {
    if (theme.id === 'neutral') continue
    const allowed = THEME_TERM_SETS.get(theme.id)!
    for (const [term, weight] of signals) {
      if (!allowed.has(term)) continue
      scores[theme.id] += weight
      evidence.push({ term, theme: theme.id, weight })
    }
  }
  return {
    scores,
    evidence: evidence.sort((left, right) => right.weight - left.weight || left.term.localeCompare(right.term, 'en'))
      .slice(0, 12).map(item => `${item.theme}:${item.term}:${item.weight}`),
  }
}

function dominantTheme(scores: Record<ColorThemeIdV1, number>): ColorThemeIdV1 {
  const ranked = THEMES_V1.filter(theme => theme.id !== 'neutral')
    .map((theme, index) => ({ id: theme.id, score: scores[theme.id], index }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
  return ranked[0]?.score > 0 ? ranked[0].id : 'neutral'
}

export function selectVideoColorPalettePlanV1(input: {
  terms: readonly unknown[]
  seed?: number
}): VideoColorPaletteSelectionV1 {
  const seed = input.seed ?? 1
  if (!Number.isSafeInteger(seed) || seed <= 0) throw new Error('COLOR_PALETTE_SEED_INVALID')
  const scored = scoreThemes(input.terms)
  const theme = dominantTheme(scored.scores)
  const definition = THEMES_V1.find(item => item.id === theme)!
  const plan = validateVideoColorPalettePlanV1({
    version: COLOR_PALETTE_FAMILY_VERSION_V1,
    primaryFamily: definition.palettes[0],
    compatibleFamilies: [definition.palettes[1], definition.palettes[2]],
    revision: COLOR_PALETTE_REVISION_V1,
  })
  return { plan, theme, scores: scored.scores, evidence: scored.evidence }
}

function variantTokens(base: Readonly<ColorPaletteTokensV1>, variant: ColorAccentVariantV1): ColorPaletteTokensV1 {
  if (variant === 'primary-led') return { ...base }
  if (variant === 'secondary-led') return {
    ...base, accentPrimary: base.accentSecondary, accentSecondary: base.accentPrimary,
  }
  return {
    ...base, accentPrimary: base.accentBright, accentBright: base.accentPrimary,
  }
}

function rotate<T>(values: readonly T[], offset: number): T[] {
  if (!values.length) return []
  const start = ((offset % values.length) + values.length) % values.length
  return [...values.slice(start), ...values.slice(0, start)]
}

/**
 * Stable per-scene variation. Semantic affinity narrows the compatible gamut; scene order and
 * concept hash choose a lead token. A recent-accent guard prevents a third identical lead when
 * another compatible token exists.
 */
export function materializeSceneColorPaletteV1(input: {
  plan: VideoColorPalettePlanV1
  sceneId: string
  sceneIndex: number
  terms: readonly unknown[]
  recentAccentPrimaries?: readonly string[]
}): SceneColorPaletteV1 {
  const plan = validateVideoColorPalettePlanV1(input.plan)
  if (!input.sceneId.trim() || !Number.isSafeInteger(input.sceneIndex) || input.sceneIndex < 0)
    throw new Error('COLOR_PALETTE_SCENE_INPUT_INVALID')
  const allowed = [plan.primaryFamily, ...plan.compatibleFamilies]
  const scored = scoreThemes(input.terms)
  const localTheme = dominantTheme(scored.scores)
  const localFamilies = THEMES_V1.find(theme => theme.id === localTheme)!.palettes.filter(family => allowed.includes(family))
  const familyBase = localFamilies.length ? localFamilies : allowed
  const termKey = [...semanticSignals(input.terms).keys()].sort().join('|') || input.sceneId
  const familyOrder = rotate(familyBase, input.sceneIndex + hash32(termKey))
  const variants: readonly ColorAccentVariantV1[] = ['primary-led', 'secondary-led', 'bright-led']
  const variantOrder = rotate(variants, input.sceneIndex + hash32(`${input.sceneId}|${termKey}`))
  const candidates = familyOrder.flatMap(family => variantOrder.map(variant => ({
    family, variant, tokens: variantTokens(COLOR_PALETTE_FAMILIES_V1[family].tokens, variant),
  })))
  const recent = input.recentAccentPrimaries ?? []
  const repeated = recent.length >= 2 && recent.at(-1) === recent.at(-2) ? recent.at(-1) : null
  const selected = candidates.find(candidate => candidate.tokens.accentPrimary !== repeated) ?? candidates[0]
  if (!selected) throw new Error('COLOR_PALETTE_SCENE_INVALID')
  return Object.freeze({
    version: COLOR_PALETTE_FAMILY_VERSION_V1,
    videoPrimaryFamily: plan.primaryFamily,
    videoCompatibleFamilies: Object.freeze([...plan.compatibleFamilies]) as ColorPaletteFamilyIdV1[],
    family: selected.family,
    variant: selected.variant,
    tokens: Object.freeze({ ...selected.tokens }) as ColorPaletteTokensV1,
    revision: COLOR_PALETTE_REVISION_V1,
  })
}

export function colorThemeForTermsV1(terms: readonly unknown[]): ColorThemeIdV1 {
  return dominantTheme(scoreThemes(terms).scores)
}
