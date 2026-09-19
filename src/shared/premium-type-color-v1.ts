import type { ColorPaletteFamilyIdV1 } from './color-palette-v1'

export const PREMIUM_TYPE_COLOR_REVISION = 'porcelain-editorial-2026-09-v1' as const
export const PORCELAIN_PALETTES = Object.freeze({
  monochrome: { accent: '#C7C8CC', secondary: '#D5DBE4' },
  champagne: { accent: '#C8A46B', secondary: '#E0C99B' },
  cobalt: { accent: '#4F6FFF', secondary: '#91A4FF' },
  ice: { accent: '#AEB9C9', secondary: '#D5DBE4' },
} as const)
export type PorcelainPaletteId = keyof typeof PORCELAIN_PALETTES
export const PREMIUM_TYPE_THEMES = Object.freeze({
  'premium-minimal': { title: 'DM Sans', body: 'DM Sans', data: 'IBM Plex Sans Condensed', titleWeight: 700 },
  'editorial-luxe': { title: 'Instrument Serif', body: 'DM Sans', data: 'Barlow Condensed', titleWeight: 400 },
  'modern-creative': { title: 'Bricolage Grotesque', body: 'DM Sans', data: 'IBM Plex Sans Condensed', titleWeight: 700 },
  'condensed-impact': { title: 'Barlow Condensed', body: 'DM Sans', data: 'IBM Plex Sans Condensed', titleWeight: 700 },
  'human-signature': { title: 'DM Sans', body: 'DM Sans', data: 'IBM Plex Sans Condensed', titleWeight: 700 },
} as const)
export type PremiumTypeThemeId = keyof typeof PREMIUM_TYPE_THEMES
export const WORD_TREATMENTS = ['ivory-solid', 'ivory-outline', 'accent-solid', 'accent-outline',
  'editorial-underline', 'signature-accent'] as const
export type WordTreatment = typeof WORD_TREATMENTS[number]

/** A fully materialized pixel contract. Selection runs once per video, never in the renderer. */
export type PremiumStyleV1 = {
  revision: typeof PREMIUM_TYPE_COLOR_REVISION
  typographyTheme: PremiumTypeThemeId
  porcelainPalette: PorcelainPaletteId
  keywordTreatment: WordTreatment
  outlineMode: 'none' | 'fine'
  signatureAccent: boolean
  accentUsage: 'single-keyword'
  accentPrimary: string
  accentSecondary: string
}

const BY_FAMILY: Record<ColorPaletteFamilyIdV1, { palette: PorcelainPaletteId; theme: PremiumTypeThemeId }> = {
  'blue-tech': { palette: 'cobalt', theme: 'premium-minimal' },
  'cyan-digital': { palette: 'ice', theme: 'premium-minimal' },
  'green-nature': { palette: 'monochrome', theme: 'human-signature' },
  'sunset-energy': { palette: 'champagne', theme: 'editorial-luxe' },
  'purple-cosmic': { palette: 'monochrome', theme: 'editorial-luxe' },
  'red-alert': { palette: 'monochrome', theme: 'condensed-impact' },
  'magenta-creative': { palette: 'champagne', theme: 'modern-creative' },
  'silver-industrial': { palette: 'ice', theme: 'condensed-impact' },
  'yellow-energy': { palette: 'champagne', theme: 'modern-creative' },
}

export function selectPremiumStyleV1(family: ColorPaletteFamilyIdV1, cue: string, keyword = ''): PremiumStyleV1 {
  const { palette, theme } = BY_FAMILY[family]
  const shortSignature = keyword.trim().split(/\s+/u).length === 1 &&
    Array.from(keyword.trim()).length > 0 && Array.from(keyword.trim()).length <= 12
  const treatment: WordTreatment = theme === 'human-signature' && cue === 'typographic' && shortSignature
    ? 'signature-accent' : cue === 'datum' ? 'accent-solid'
      : theme === 'condensed-impact' ? 'ivory-outline'
        : theme === 'editorial-luxe' ? 'editorial-underline'
          : theme === 'modern-creative' ? 'accent-solid'
            : theme === 'premium-minimal' && cue === 'typographic' ? 'accent-outline' : 'ivory-solid'
  const colors = PORCELAIN_PALETTES[palette]
  return { revision: PREMIUM_TYPE_COLOR_REVISION, typographyTheme: theme,
    porcelainPalette: palette, keywordTreatment: treatment,
    outlineMode: treatment.includes('outline') ? 'fine' : 'none',
    signatureAccent: treatment === 'signature-accent', accentUsage: 'single-keyword',
    accentPrimary: colors.accent, accentSecondary: colors.secondary }
}

export function validatePremiumStyleV1(value: unknown): PremiumStyleV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PREMIUM_STYLE_INVALID')
  const style = value as PremiumStyleV1
  if (Object.keys(style).sort().join('|') !== ['revision', 'typographyTheme', 'porcelainPalette',
    'keywordTreatment', 'outlineMode', 'signatureAccent', 'accentUsage', 'accentPrimary', 'accentSecondary'].sort().join('|') ||
    style.revision !== PREMIUM_TYPE_COLOR_REVISION || !(style.typographyTheme in PREMIUM_TYPE_THEMES) ||
    !(style.porcelainPalette in PORCELAIN_PALETTES) || !WORD_TREATMENTS.includes(style.keywordTreatment) ||
    style.outlineMode !== (style.keywordTreatment.includes('outline') ? 'fine' : 'none') ||
    style.signatureAccent !== (style.keywordTreatment === 'signature-accent') ||
    style.accentUsage !== 'single-keyword' ||
    style.accentPrimary !== PORCELAIN_PALETTES[style.porcelainPalette].accent ||
    style.accentSecondary !== PORCELAIN_PALETTES[style.porcelainPalette].secondary)
    throw new Error('PREMIUM_STYLE_INVALID')
  return style
}
