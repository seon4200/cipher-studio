import type { TypographyLookIdV3 } from './visual-layout-v3'

export const VIDEO_VISUAL_STYLE_VERSION = 1 as const
export const VIDEO_VISUAL_STYLE_REVISION = 'video-visual-style-v1' as const

export const VIDEO_VISUAL_STYLE_IDS = ['cream-editorial', 'ink-technical'] as const
export type VideoVisualStyleIdV1 = typeof VIDEO_VISUAL_STYLE_IDS[number]

export const VIDEO_BACKGROUND_VARIANTS = ['ivory', 'warm-cream', 'paper', 'soft-sand'] as const
export type VideoBackgroundVariantV1 = typeof VIDEO_BACKGROUND_VARIANTS[number]

export type VideoVisualStyleV1 = {
  version: typeof VIDEO_VISUAL_STYLE_VERSION
  id: VideoVisualStyleIdV1
  backgroundVariant: VideoBackgroundVariantV1
  backgroundMotion: 'none' | 'subtle'
  decoratorIntensity: 'minimal' | 'restrained'
  revision: typeof VIDEO_VISUAL_STYLE_REVISION
}

export type VideoVisualStylePaletteV1 = {
  background: string
  surface: string
  text: string
  accent: string
  support: string
  line: string
  shadow: string
}

export type VideoVisualStyleDefinitionV1 = {
  id: VideoVisualStyleIdV1
  allowedBackgrounds: readonly VideoBackgroundVariantV1[]
  allowedTypographyLooks: readonly TypographyLookIdV3[]
  defaultBackgroundMotion: 'none' | 'subtle'
  defaultDecoratorIntensity: 'minimal' | 'restrained'
  palettes: Readonly<Record<VideoBackgroundVariantV1, VideoVisualStylePaletteV1>>
}

const creamPalettes: VideoVisualStyleDefinitionV1['palettes'] = {
  ivory: {
    background: '#F7F1E6', surface: '#FFF9EF', text: '#211B16', accent: '#D85F35',
    support: '#28566A', line: '#7A6757', shadow: 'rgba(54,38,25,.20)',
  },
  'warm-cream': {
    background: '#F1E4D2', surface: '#FAF0E1', text: '#241C17', accent: '#CA5735',
    support: '#355D69', line: '#806A57', shadow: 'rgba(54,38,25,.22)',
  },
  paper: {
    background: '#EEE6D8', surface: '#F9F4EA', text: '#1F1B18', accent: '#B94B32',
    support: '#2F5C70', line: '#76685B', shadow: 'rgba(38,31,25,.20)',
  },
  'soft-sand': {
    background: '#E9DDC9', surface: '#F5EBDD', text: '#251E18', accent: '#C85B36',
    support: '#315B68', line: '#74604F', shadow: 'rgba(54,38,25,.24)',
  },
}

const inkPalettes: VideoVisualStyleDefinitionV1['palettes'] = {
  ivory: {
    background: '#EDEBE5', surface: '#F8F6F0', text: '#171A1E', accent: '#245E78',
    support: '#A14830', line: '#5E6670', shadow: 'rgba(12,18,24,.22)',
  },
  'warm-cream': {
    background: '#E8E1D7', surface: '#F4EFE8', text: '#171A1E', accent: '#285F78',
    support: '#A24B33', line: '#60656A', shadow: 'rgba(12,18,24,.24)',
  },
  paper: {
    background: '#E2E2DE', surface: '#F0F1EE', text: '#15191D', accent: '#205B75',
    support: '#9D4631', line: '#59636A', shadow: 'rgba(12,18,24,.22)',
  },
  'soft-sand': {
    background: '#DDD8CF', surface: '#ECE8E0', text: '#161A1E', accent: '#245B72',
    support: '#A04A31', line: '#5D6467', shadow: 'rgba(12,18,24,.25)',
  },
}

export const VIDEO_VISUAL_STYLES_V1: Readonly<Record<VideoVisualStyleIdV1, VideoVisualStyleDefinitionV1>> = Object.freeze({
  'cream-editorial': Object.freeze({
    id: 'cream-editorial',
    allowedBackgrounds: VIDEO_BACKGROUND_VARIANTS,
    allowedTypographyLooks: Object.freeze([
      'editorial-strong', 'elegant-serif', 'poster-condensed', 'technical-condensed',
      'impact-condensed', 'sport-condensed',
    ] as TypographyLookIdV3[]),
    defaultBackgroundMotion: 'none',
    defaultDecoratorIntensity: 'minimal',
    palettes: Object.freeze(creamPalettes),
  }),
  'ink-technical': Object.freeze({
    id: 'ink-technical',
    allowedBackgrounds: VIDEO_BACKGROUND_VARIANTS,
    allowedTypographyLooks: Object.freeze([
      'technical-condensed', 'poster-condensed', 'impact-condensed', 'editorial-strong',
    ] as TypographyLookIdV3[]),
    defaultBackgroundMotion: 'subtle',
    defaultDecoratorIntensity: 'restrained',
    palettes: Object.freeze(inkPalettes),
  }),
})

function hash32(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** The style ID is selected once per video; only an allowed quiet background variant changes per scene. */
export function materializeVideoVisualStyleV1(input: {
  videoStyleId: VideoVisualStyleIdV1
  sceneId: string
  seed: number
  backgroundMotion?: 'none' | 'subtle'
}): VideoVisualStyleV1 {
  const definition = VIDEO_VISUAL_STYLES_V1[input.videoStyleId]
  if (!definition) throw new Error('VIDEO_VISUAL_STYLE_INVALID')
  if (!Number.isSafeInteger(input.seed) || input.seed <= 0) throw new Error('VIDEO_VISUAL_STYLE_SEED_INVALID')
  const variants = definition.allowedBackgrounds
  const backgroundVariant = variants[hash32(`${input.sceneId}|${input.seed}|${input.videoStyleId}`) % variants.length]
  return Object.freeze({
    version: VIDEO_VISUAL_STYLE_VERSION,
    id: input.videoStyleId,
    backgroundVariant,
    backgroundMotion: input.backgroundMotion ?? definition.defaultBackgroundMotion,
    decoratorIntensity: definition.defaultDecoratorIntensity,
    revision: VIDEO_VISUAL_STYLE_REVISION,
  })
}

export function validateVideoVisualStyleV1(value: unknown): VideoVisualStyleV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('VIDEO_VISUAL_STYLE_INVALID')
  const style = value as Record<string, unknown>
  const allowed = ['version', 'id', 'backgroundVariant', 'backgroundMotion', 'decoratorIntensity', 'revision']
  if (Object.keys(style).some(key => !allowed.includes(key)) || style.version !== VIDEO_VISUAL_STYLE_VERSION ||
      !VIDEO_VISUAL_STYLE_IDS.includes(style.id as VideoVisualStyleIdV1) ||
      !VIDEO_BACKGROUND_VARIANTS.includes(style.backgroundVariant as VideoBackgroundVariantV1) ||
      !['none', 'subtle'].includes(String(style.backgroundMotion)) ||
      !['minimal', 'restrained'].includes(String(style.decoratorIntensity)) ||
      style.revision !== VIDEO_VISUAL_STYLE_REVISION)
    throw new Error('VIDEO_VISUAL_STYLE_INVALID')
  const definition = VIDEO_VISUAL_STYLES_V1[style.id as VideoVisualStyleIdV1]
  if (!definition.allowedBackgrounds.includes(style.backgroundVariant as VideoBackgroundVariantV1))
    throw new Error('VIDEO_VISUAL_STYLE_BACKGROUND_INVALID')
  return style as VideoVisualStyleV1
}

export function videoVisualStylePaletteV1(style: VideoVisualStyleV1): VideoVisualStylePaletteV1 {
  const value = validateVideoVisualStyleV1(style)
  return VIDEO_VISUAL_STYLES_V1[value.id].palettes[value.backgroundVariant]
}
