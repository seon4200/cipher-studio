export const COLOR_PALETTE_FAMILY_VERSION_V1 = 1 as const
export const COLOR_PALETTE_REVISION_V1 = 'vivid-thematic-accents-v1' as const

export const COLOR_PALETTE_FAMILY_IDS_V1 = [
  'blue-tech',
  'cyan-digital',
  'green-nature',
  'sunset-energy',
  'purple-cosmic',
  'red-alert',
  'magenta-creative',
  'silver-industrial',
  'yellow-energy',
] as const

export type ColorPaletteFamilyIdV1 = typeof COLOR_PALETTE_FAMILY_IDS_V1[number]
export type ColorAccentVariantV1 = 'primary-led' | 'secondary-led' | 'bright-led'

export type ColorPaletteTokensV1 = {
  accentPrimary: string
  accentSecondary: string
  accentBright: string
  accentSoft: string
  accentGlow: string
  accentDark: string
}

export type ColorPaletteFamilyDefinitionV1 = {
  id: ColorPaletteFamilyIdV1
  label: string
  compatibleFamilies: readonly ColorPaletteFamilyIdV1[]
  tokens: Readonly<ColorPaletteTokensV1>
}

/** Selected once per ordered video generation; evidence stays in diagnostics, not in this plan. */
export type VideoColorPalettePlanV1 = {
  version: typeof COLOR_PALETTE_FAMILY_VERSION_V1
  primaryFamily: ColorPaletteFamilyIdV1
  compatibleFamilies: ColorPaletteFamilyIdV1[]
  revision: typeof COLOR_PALETTE_REVISION_V1
}

/**
 * Fully materialized scene-level pixel contract. Token values are persisted deliberately: future
 * catalogue edits cannot recolor an existing SceneSpec while keeping the same identity.
 */
export type SceneColorPaletteV1 = {
  version: typeof COLOR_PALETTE_FAMILY_VERSION_V1
  videoPrimaryFamily: ColorPaletteFamilyIdV1
  videoCompatibleFamilies: ColorPaletteFamilyIdV1[]
  family: ColorPaletteFamilyIdV1
  variant: ColorAccentVariantV1
  tokens: ColorPaletteTokensV1
  revision: typeof COLOR_PALETTE_REVISION_V1
}

function definition(
  id: ColorPaletteFamilyIdV1,
  label: string,
  compatibleFamilies: readonly ColorPaletteFamilyIdV1[],
  tokens: ColorPaletteTokensV1,
): ColorPaletteFamilyDefinitionV1 {
  return Object.freeze({ id, label, compatibleFamilies: Object.freeze([...compatibleFamilies]), tokens: Object.freeze({ ...tokens }) })
}

export const COLOR_PALETTE_FAMILIES_V1: Readonly<Record<ColorPaletteFamilyIdV1, ColorPaletteFamilyDefinitionV1>> =
  Object.freeze({
    'blue-tech': definition('blue-tech', 'BLUE TECH', ['cyan-digital', 'purple-cosmic', 'silver-industrial', 'yellow-energy'], {
      accentPrimary: '#2F7BFF', accentSecondary: '#00D4FF', accentBright: '#70E1FF',
      accentSoft: '#6A9EFF', accentGlow: '#00B8FF', accentDark: '#123A8C',
    }),
    'cyan-digital': definition('cyan-digital', 'CYAN DIGITAL', ['blue-tech', 'green-nature', 'purple-cosmic'], {
      accentPrimary: '#00E5FF', accentSecondary: '#23F0C7', accentBright: '#84FFFF',
      accentSoft: '#4FBBC5', accentGlow: '#00B8D4', accentDark: '#075966',
    }),
    'green-nature': definition('green-nature', 'GREEN NATURE', ['cyan-digital', 'yellow-energy'], {
      accentPrimary: '#39E75F', accentSecondary: '#00E6A7', accentBright: '#B4FF4A',
      accentSoft: '#45B96B', accentGlow: '#00FF88', accentDark: '#0D6332',
    }),
    'sunset-energy': definition('sunset-energy', 'SUNSET ENERGY', ['red-alert', 'yellow-energy', 'magenta-creative'], {
      accentPrimary: '#FF6B35', accentSecondary: '#FF3D71', accentBright: '#FFD23F',
      accentSoft: '#E6805C', accentGlow: '#FF7A3D', accentDark: '#7A2A1B',
    }),
    'purple-cosmic': definition('purple-cosmic', 'PURPLE COSMIC', ['blue-tech', 'cyan-digital', 'magenta-creative'], {
      accentPrimary: '#9B5CFF', accentSecondary: '#5B8CFF', accentBright: '#D47CFF',
      accentSoft: '#8A6BC9', accentGlow: '#B44CFF', accentDark: '#3D1C78',
    }),
    'red-alert': definition('red-alert', 'RED ALERT', ['sunset-energy', 'yellow-energy', 'magenta-creative'], {
      accentPrimary: '#FF334F', accentSecondary: '#FF6B35', accentBright: '#FF8A80',
      accentSoft: '#D75A68', accentGlow: '#FF1744', accentDark: '#7A1326',
    }),
    'magenta-creative': definition('magenta-creative', 'MAGENTA CREATIVE', ['purple-cosmic', 'sunset-energy', 'red-alert'], {
      accentPrimary: '#FF2DAA', accentSecondary: '#B44CFF', accentBright: '#FF75D8',
      accentSoft: '#C65AA0', accentGlow: '#FF2BC2', accentDark: '#6A1652',
    }),
    'silver-industrial': definition('silver-industrial', 'SILVER INDUSTRIAL', ['blue-tech', 'yellow-energy'], {
      accentPrimary: '#C8D7E8', accentSecondary: '#45C8FF', accentBright: '#F5FAFF',
      accentSoft: '#91A9C2', accentGlow: '#7FDBFF', accentDark: '#39495C',
    }),
    'yellow-energy': definition('yellow-energy', 'YELLOW ENERGY', ['blue-tech', 'green-nature', 'sunset-energy', 'red-alert'], {
      accentPrimary: '#FFE14A', accentSecondary: '#C8FF3D', accentBright: '#FFF59D',
      accentSoft: '#D7C85A', accentGlow: '#F6FF00', accentDark: '#665A00',
    }),
  })

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every(key => keys.includes(key))
}

function isFamily(value: unknown): value is ColorPaletteFamilyIdV1 {
  return COLOR_PALETTE_FAMILY_IDS_V1.includes(value as ColorPaletteFamilyIdV1)
}

function validateFamilyList(value: unknown, primary: ColorPaletteFamilyIdV1): ColorPaletteFamilyIdV1[] {
  if (!Array.isArray(value) || value.length > 2 || value.some(item => !isFamily(item)))
    throw new Error('COLOR_PALETTE_PLAN_INVALID')
  const families = value as ColorPaletteFamilyIdV1[]
  if (new Set(families).size !== families.length || families.includes(primary))
    throw new Error('COLOR_PALETTE_PLAN_INVALID')
  if (families.some(family => !COLOR_PALETTE_FAMILIES_V1[primary].compatibleFamilies.includes(family)))
    throw new Error('COLOR_PALETTE_PLAN_INVALID')
  return families
}

export function validateColorPaletteTokensV1(value: unknown): ColorPaletteTokensV1 {
  const keys = ['accentPrimary', 'accentSecondary', 'accentBright', 'accentSoft', 'accentGlow', 'accentDark'] as const
  if (!record(value) || !exactKeys(value, keys) || keys.some(key => typeof value[key] !== 'string' || !/^#[0-9A-F]{6}$/i.test(String(value[key]))))
    throw new Error('COLOR_PALETTE_TOKENS_INVALID')
  return value as ColorPaletteTokensV1
}

export function validateVideoColorPalettePlanV1(value: unknown): VideoColorPalettePlanV1 {
  if (!record(value) || !exactKeys(value, ['version', 'primaryFamily', 'compatibleFamilies', 'revision']) ||
      value.version !== COLOR_PALETTE_FAMILY_VERSION_V1 || !isFamily(value.primaryFamily) ||
      value.revision !== COLOR_PALETTE_REVISION_V1)
    throw new Error('COLOR_PALETTE_PLAN_INVALID')
  validateFamilyList(value.compatibleFamilies, value.primaryFamily)
  return value as VideoColorPalettePlanV1
}

export function validateSceneColorPaletteV1(value: unknown): SceneColorPaletteV1 {
  if (!record(value) || !exactKeys(value, [
    'version', 'videoPrimaryFamily', 'videoCompatibleFamilies', 'family', 'variant', 'tokens', 'revision',
  ]) || value.version !== COLOR_PALETTE_FAMILY_VERSION_V1 || !isFamily(value.videoPrimaryFamily) ||
      !isFamily(value.family) || !['primary-led', 'secondary-led', 'bright-led'].includes(String(value.variant)) ||
      value.revision !== COLOR_PALETTE_REVISION_V1)
    throw new Error('COLOR_PALETTE_SCENE_INVALID')
  const compatible = validateFamilyList(value.videoCompatibleFamilies, value.videoPrimaryFamily)
  if (![value.videoPrimaryFamily, ...compatible].includes(value.family)) throw new Error('COLOR_PALETTE_SCENE_INVALID')
  validateColorPaletteTokensV1(value.tokens)
  return value as SceneColorPaletteV1
}
