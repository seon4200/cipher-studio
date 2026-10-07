import type { ColorPaletteFamilyIdV1 } from './color-palette-v1'
import type { TypographyLookIdV3 } from './visual-layout-v3'

export const VISUAL_RECOVERY_TYPOGRAPHY_THEMES_V1 = Object.freeze({
  'impact-modern': { look: 'impact-condensed', role: 'display', primary: 'Anton', secondary: 'Archivo' },
  // V3's six-look registry remains historical. The opt-in profile draws this
  // pairing explicitly; editorial-strong is only its persisted base look.
  'clean-explainer': { look: 'editorial-strong', role: 'explainer', primary: 'Outfit', secondary: 'Archivo' },
  'editorial-story': { look: 'elegant-serif', role: 'narrative', primary: 'Playfair Display', secondary: 'DM Serif Display' },
  'condensed-headline': { look: 'poster-condensed', role: 'compact', primary: 'Barlow Condensed', secondary: 'Archivo' },
  'data-technical': { look: 'technical-condensed', role: 'technical', primary: 'IBM Plex Sans Condensed', secondary: 'Space Mono' },
} as const satisfies Record<string, { look: TypographyLookIdV3; role: string; primary: string; secondary: string }>)
export type VisualRecoveryTypographyThemeIdV1 = keyof typeof VISUAL_RECOVERY_TYPOGRAPHY_THEMES_V1

const BY_PALETTE: Record<ColorPaletteFamilyIdV1, VisualRecoveryTypographyThemeIdV1> = {
  'blue-tech': 'data-technical', 'cyan-digital': 'data-technical',
  'green-nature': 'clean-explainer', 'yellow-energy': 'clean-explainer',
  'sunset-energy': 'impact-modern', 'red-alert': 'impact-modern',
  'purple-cosmic': 'editorial-story', 'magenta-creative': 'editorial-story',
  'silver-industrial': 'condensed-headline',
}

/** The video-primary palette, not the per-scene accent, chooses a stable type pairing. */
export function selectVisualRecoveryTypographyV1(primary: ColorPaletteFamilyIdV1):
  { id: VisualRecoveryTypographyThemeIdV1; look: TypographyLookIdV3 } {
  const id = BY_PALETTE[primary]
  return { id, look: VISUAL_RECOVERY_TYPOGRAPHY_THEMES_V1[id].look }
}
