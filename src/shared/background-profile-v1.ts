export const BACKGROUND_PROFILE_VERSION_V1 = 1 as const
export const BACKGROUND_PROFILE_REVISION_V1 = 'background-profile-v1' as const
export const BACKGROUND_PROFILE_IDS_V1 = ['solid-black-v1'] as const

export type BackgroundProfileIdV1 = typeof BACKGROUND_PROFILE_IDS_V1[number]

/**
 * Pixel contract for the lowest visual surface only. Composition, decorators, narrative assets
 * and motion remain independent authorities and are deliberately absent from this object.
 */
export type BackgroundProfileV1 = {
  version: typeof BACKGROUND_PROFILE_VERSION_V1
  id: BackgroundProfileIdV1
  revision: typeof BACKGROUND_PROFILE_REVISION_V1
}

export type BackgroundPaletteV1 = {
  background: string
  surface: string
  text: string
  accent: string
  support: string
  line: string
  shadow: string
}

export type BackgroundProfileDefinitionV1 = {
  id: BackgroundProfileIdV1
  family: 'solid'
  baseColor: string
  surfaceColor: string
  textColor: string
  lineColor: string
  shadowColor: string
  minimumAccentContrast: number
}

export const BACKGROUND_PROFILES_V1: Readonly<Record<BackgroundProfileIdV1, BackgroundProfileDefinitionV1>> =
  Object.freeze({
    'solid-black-v1': Object.freeze({
      id: 'solid-black-v1',
      family: 'solid',
      baseColor: '#0D0D0F',
      surfaceColor: '#1A1A1E',
      textColor: '#F5F2EA',
      lineColor: '#AAA69F',
      shadowColor: 'rgba(0,0,0,.58)',
      minimumAccentContrast: 3,
    }),
  })

function parseHex(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) throw new Error('BACKGROUND_PROFILE_COLOR_INVALID')
  return [0, 2, 4].map(offset => parseInt(match[1].slice(offset, offset + 2), 16)) as [number, number, number]
}

function toHex(channels: readonly number[]): string {
  return '#' + channels.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function relativeLuminance(value: string): number {
  const channels = parseHex(value).map(channel => {
    const normalized = channel / 255
    return normalized <= .04045 ? normalized / 12.92 : Math.pow((normalized + .055) / 1.055, 2.4)
  })
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}

export function backgroundContrastRatioV1(left: string, right: string): number {
  const a = relativeLuminance(left)
  const b = relativeLuminance(right)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}

/** Preserve the source hue while lifting only as much as a dark base needs for shared marks. */
function ensureContrastAgainstDark(value: string, background: string, minimum: number): string {
  if (backgroundContrastRatioV1(value, background) >= minimum) return value.toUpperCase()
  const source = parseHex(value)
  for (let step = 1; step <= 20; step++) {
    const mix = step / 20
    const candidate = toHex(source.map(channel => channel + (255 - channel) * mix))
    if (backgroundContrastRatioV1(candidate, background) >= minimum) return candidate
  }
  return '#FFFFFF'
}

export function materializeBackgroundProfileV1(
  id: BackgroundProfileIdV1 = 'solid-black-v1',
): BackgroundProfileV1 {
  if (!BACKGROUND_PROFILES_V1[id]) throw new Error('BACKGROUND_PROFILE_INVALID')
  return Object.freeze({
    version: BACKGROUND_PROFILE_VERSION_V1,
    id,
    revision: BACKGROUND_PROFILE_REVISION_V1,
  })
}

export function validateBackgroundProfileV1(value: unknown): BackgroundProfileV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('BACKGROUND_PROFILE_INVALID')
  const profile = value as Record<string, unknown>
  const keys = Object.keys(profile)
  if (keys.some(key => !['version', 'id', 'revision'].includes(key)) ||
      profile.version !== BACKGROUND_PROFILE_VERSION_V1 ||
      !BACKGROUND_PROFILE_IDS_V1.includes(profile.id as BackgroundProfileIdV1) ||
      profile.revision !== BACKGROUND_PROFILE_REVISION_V1)
    throw new Error('BACKGROUND_PROFILE_INVALID')
  return profile as BackgroundProfileV1
}

/**
 * Historical specs omit a profile and receive their exact original palette object. New specs
 * opt into a profile explicitly; only shared environmental tokens change, never asset pixels.
 */
export function applyBackgroundProfileV1<T extends BackgroundPaletteV1>(
  palette: T,
  profile?: BackgroundProfileV1,
): T {
  if (profile === undefined) return palette
  const value = validateBackgroundProfileV1(profile)
  const definition = BACKGROUND_PROFILES_V1[value.id]
  return {
    ...palette,
    background: definition.baseColor,
    surface: definition.surfaceColor,
    text: definition.textColor,
    accent: ensureContrastAgainstDark(palette.accent, definition.baseColor, definition.minimumAccentContrast),
    support: ensureContrastAgainstDark(palette.support, definition.baseColor, definition.minimumAccentContrast),
    line: definition.lineColor,
    shadow: definition.shadowColor,
  }
}
