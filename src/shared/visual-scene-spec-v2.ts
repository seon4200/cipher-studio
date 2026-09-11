import {
  CAMARAS,
  DENSIDADES,
  FONDOS,
  RITMOS,
  type Densidad,
  type IdCamara,
  type IdFondo,
  type Ritmo,
} from './escena'
import { SISTEMAS, type NombreSistema } from './sistemas'
import { esNombreSolarCanonico, type EstiloSolar } from './iconos-solar'
import {
  TYPOGRAPHY_LOOK_IDS_V3,
  type PercentRectV3,
  type TypographyLookIdV3,
} from './visual-layout-v3'
import {
  MODERN_LAYOUT_STRUCTURES_V4,
  SCENE_SLOT_IDS_V2,
  createVisualLayoutV4,
  isLayoutEligibleV4,
  type ModernLayoutStructureV4,
  type SceneSlotIdV2,
  type SceneSlotRoleV2,
  type VisualLayoutV4,
} from './visual-layout-v4'
import {
  VIDEO_VISUAL_STYLE_IDS,
  VIDEO_BACKGROUND_VARIANTS,
  VIDEO_VISUAL_STYLE_REVISION,
  validateVideoVisualStyleV1,
  type VideoVisualStyleV1,
} from './visual-style-v1'
import {
  validateBackgroundProfileV1,
  type BackgroundProfileV1,
} from './background-profile-v1'
import {
  validateSceneColorPaletteV1,
  type SceneColorPaletteV1,
} from './color-palette-v1'
import {
  VISUAL_MVP_BOUNDS_REVISION,
  editorialFallbackSpec,
  evaluateAssetMotion,
  sceneSpecPixelIdentity,
  sceneSpecReactKey,
  validateRenderBindings,
  validateVisualSceneSpec,
  type AssetMotionRecipeV1,
  type RenderBindingsV1,
  type RuntimeRenderAssetV1,
  type SubjectBoundsV1,
  type VisualSceneSpecV1,
} from './visual-scene-spec'

/**
 * V15 is an additive modern schema. V14 remains validated and rendered by VisualSceneSpecV1;
 * dispatch never mutates or upgrades a persisted historical spec.
 */
export const VISUAL_RENDER_SPEC_VERSION_V2 = 2 as const
export const VISUAL_LAYOUT_REVISION_V4 = 'visual-multiasset-layout-v1' as const
export const VISUAL_TEXT_REVISION_V4 = 'editorial-support-text-v1' as const
export const VISUAL_MOTION_REVISION_V2 = 'narrative-role-motion-v1' as const
export const VISUAL_TREATMENT_REVISION_V3 = 'asset-treatment-v3-original-color' as const
export const VISUAL_BINDINGS_VERSION_V2 = 2 as const
export const VISUAL_QC_REVISION_V2 = 'visual-runtime-qc-multiasset-v1' as const

export const VISUAL_ASSET_MIMES_V2 = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'] as const
export type VisualAssetMimeV2 = typeof VISUAL_ASSET_MIMES_V2[number]
export const VISUAL_ASSET_KINDS_V2 = [
  'simple-icon', 'complex-illustration', 'photo-cutout', 'raster-image',
] as const
export type VisualAssetKindV2 = typeof VISUAL_ASSET_KINDS_V2[number]
export const VISUAL_TREATMENTS_V2 = ['original-color', 'system-tint', 'duotone', 'accent-mask'] as const
export type VisualTreatmentV2 = typeof VISUAL_TREATMENTS_V2[number]

export type PresentSceneSlotV2 = {
  slotId: SceneSlotIdV2
  role: SceneSlotRoleV2
  state: 'present'
  sha256: string
  mime: VisualAssetMimeV2
  kind: VisualAssetKindV2
  alphaMode: 'vector' | 'useful-alpha' | 'opaque-rectangle'
  bounds: SubjectBoundsV1
  fitPolicy: 'contain' | 'subject-contain' | 'cover'
  tint: { treatment: VisualTreatmentV2 }
  motion: AssetMotionRecipeV1
}

export type ProceduralSceneSlotV2 = {
  slotId: SceneSlotIdV2
  role: SceneSlotRoleV2
  state: 'procedural'
  kind: 'simple-icon'
  solarIcon: string
  solarStyle: EstiloSolar
  bounds: SubjectBoundsV1
  fitPolicy: 'contain' | 'subject-contain'
  tint: { treatment: 'system-tint' }
  motion: AssetMotionRecipeV1
}

export type EmptySceneSlotV2 = {
  slotId: SceneSlotIdV2
  role: SceneSlotRoleV2
  state: 'missing' | 'omitted'
}

export type SceneSlotV2 = PresentSceneSlotV2 | ProceduralSceneSlotV2 | EmptySceneSlotV2

export type EditorialTextV2 = {
  connector?: string
  keyword: string
  closing?: string
  alignment: 'left' | 'center' | 'right'
  maxLines: 2 | 3
  typographyLookId: TypographyLookIdV3
  timing: { connectorStart: number; keywordStart: number; closingStart?: number }
  motion: {
    secondaryPreset: 'fade-slide'
    keywordPreset: 'scale-punch' | 'slide-reveal' | 'underline-reveal'
    emphasisStart: number
  }
}

export type VisualDirectionV2 = {
  fondo: IdFondo
  estructura: ModernLayoutStructureV4
  camara: IdCamara
  densidad: Densidad
  ritmo: Ritmo
  semilla: number
}

export type VisualRevisionsV2 = {
  layoutRevision: typeof VISUAL_LAYOUT_REVISION_V4
  textRevision: typeof VISUAL_TEXT_REVISION_V4
  motionRevision: typeof VISUAL_MOTION_REVISION_V2
  treatmentRevision: typeof VISUAL_TREATMENT_REVISION_V3
  boundsRevision: typeof VISUAL_MVP_BOUNDS_REVISION
  fontRevision: 'cipher-typography-looks-v2'
  paletteRevision: typeof VIDEO_VISUAL_STYLE_REVISION
  qcRevision: typeof VISUAL_QC_REVISION_V2
}

export type VisualSceneSpecV2 = {
  renderSpecVersion: typeof VISUAL_RENDER_SPEC_VERSION_V2
  visualMode: 'asset-led' | 'editorial-text'
  renderTier: 'standard'
  sistema: NombreSistema
  direccion: VisualDirectionV2
  videoStyle: VideoVisualStyleV1
  /** Omitted only by historical V15 specs; new generation materializes an explicit profile. */
  backgroundProfile?: BackgroundProfileV1
  /** Omitted by historical V15 specs; explicit values are authoritative for new-scene pixels. */
  colorPalette?: SceneColorPaletteV1
  layout: VisualLayoutV4
  text: EditorialTextV2
  slots: SceneSlotV2[]
  revisions: VisualRevisionsV2
  fallbackVisual: 'editorial-text'
}

export type RenderBindingAssetV2 = {
  slotId: SceneSlotIdV2
  assetId: string
  relativeFile: string
}

/** Locator only: paths, provider and provenance never enter the scene pixel contract. */
export type RenderBindingsV2 = {
  version: typeof VISUAL_BINDINGS_VERSION_V2
  assets: RenderBindingAssetV2[]
}

export type PreparedRenderAssetV2 = {
  slotId: SceneSlotIdV2
  assetId: string
  mime: VisualAssetMimeV2
  bytesBase64: string
}

export type RuntimeRenderAssetV2 = {
  slotId: SceneSlotIdV2
  assetId: string
  mime: VisualAssetMimeV2
  objectUrl: string
}

export type VisualSceneSpecAny = VisualSceneSpecV1 | VisualSceneSpecV2
export type RenderBindingsAny = RenderBindingsV1 | RenderBindingsV2
export type RuntimeRenderAssetAny = RuntimeRenderAssetV1 | RuntimeRenderAssetV2
export type PreparedRenderAssetAny = import('./visual-scene-spec').PreparedRenderAssetV1 | PreparedRenderAssetV2

export const VISUAL_REVISIONS_V2: VisualRevisionsV2 = Object.freeze({
  layoutRevision: VISUAL_LAYOUT_REVISION_V4,
  textRevision: VISUAL_TEXT_REVISION_V4,
  motionRevision: VISUAL_MOTION_REVISION_V2,
  treatmentRevision: VISUAL_TREATMENT_REVISION_V3,
  boundsRevision: VISUAL_MVP_BOUNDS_REVISION,
  fontRevision: 'cipher-typography-looks-v2',
  paletteRevision: VIDEO_VISUAL_STYLE_REVISION,
  qcRevision: VISUAL_QC_REVISION_V2,
})

export class VisualSceneSpecV2Error extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'VisualSceneSpecV2Error'
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new VisualSceneSpecV2Error(code, message, details)
}

function record(value: unknown, code: string, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, `${name} debe ser objeto`)
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], code: string, name: string): void {
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key))
  if (unexpected.length) fail(code, `${name} contiene campos no permitidos`, { unexpected })
}

function finite(value: unknown, code: string, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(code, `${name} debe ser finito`)
  return value
}

function u01(value: unknown, code: string, name: string): number {
  const result = finite(value, code, name)
  if (result < 0 || result > 1) fail(code, `${name} debe estar en 0..1`)
  return result
}

function nonempty(value: unknown, code: string, name: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(code, `${name} no puede estar vacío`)
  return value.trim()
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (typeof value === 'object') return '{' + Object.keys(value as Record<string, unknown>).sort()
    .map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}'
  return JSON.stringify(value)
}

function validateRect(value: unknown, name: string): asserts value is PercentRectV3 {
  const code = 'VISUAL_SCENE_V2_LAYOUT_INVALID'
  record(value, code, name)
  exactKeys(value, ['x', 'y', 'width', 'height'], code, name)
  const x = finite(value.x, code, `${name}.x`)
  const y = finite(value.y, code, `${name}.y`)
  const width = finite(value.width, code, `${name}.width`)
  const height = finite(value.height, code, `${name}.height`)
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100.000001 || y + height > 100.000001)
    fail(code, `${name} no está confinado`)
}

function validateBounds(value: unknown): asserts value is SubjectBoundsV1 {
  const code = 'VISUAL_SCENE_V2_BOUNDS_INVALID'
  record(value, code, 'bounds')
  exactKeys(value, ['revision', 'alphaBounds', 'visibleWidthRatio', 'visibleHeightRatio', 'centerOfMass', 'aspectRatio', 'transparentPadding'], code, 'bounds')
  if (value.revision !== VISUAL_MVP_BOUNDS_REVISION) fail(code, 'Revisión de SubjectBounds no soportada')
  record(value.alphaBounds, code, 'alphaBounds')
  exactKeys(value.alphaBounds, ['x', 'y', 'width', 'height'], code, 'alphaBounds')
  const x = u01(value.alphaBounds.x, code, 'alphaBounds.x')
  const y = u01(value.alphaBounds.y, code, 'alphaBounds.y')
  const width = u01(value.alphaBounds.width, code, 'alphaBounds.width')
  const height = u01(value.alphaBounds.height, code, 'alphaBounds.height')
  if (width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001)
    fail(code, 'alphaBounds inválido')
  if (u01(value.visibleWidthRatio, code, 'visibleWidthRatio') <= 0 ||
      u01(value.visibleHeightRatio, code, 'visibleHeightRatio') <= 0)
    fail(code, 'Proporción visible inválida')
  record(value.centerOfMass, code, 'centerOfMass')
  exactKeys(value.centerOfMass, ['x', 'y'], code, 'centerOfMass')
  u01(value.centerOfMass.x, code, 'centerOfMass.x')
  u01(value.centerOfMass.y, code, 'centerOfMass.y')
  if (finite(value.aspectRatio, code, 'aspectRatio') <= 0) fail(code, 'aspectRatio inválido')
  record(value.transparentPadding, code, 'transparentPadding')
  exactKeys(value.transparentPadding, ['top', 'right', 'bottom', 'left'], code, 'transparentPadding')
  for (const side of ['top', 'right', 'bottom', 'left'] as const)
    u01(value.transparentPadding[side], code, `transparentPadding.${side}`)
}

function validateText(value: unknown): asserts value is EditorialTextV2 {
  const code = 'VISUAL_SCENE_V2_TEXT_INVALID'
  record(value, code, 'text')
  exactKeys(value, ['connector', 'keyword', 'closing', 'alignment', 'maxLines', 'typographyLookId', 'timing', 'motion'], code, 'text')
  const connector = value.connector === undefined ? '' : nonempty(value.connector, code, 'connector')
  const keyword = nonempty(value.keyword, code, 'keyword')
  const closing = value.closing === undefined ? '' : nonempty(value.closing, code, 'closing')
  if (!['left', 'center', 'right'].includes(String(value.alignment)) || ![2, 3].includes(Number(value.maxLines)) ||
      !TYPOGRAPHY_LOOK_IDS_V3.includes(value.typographyLookId as TypographyLookIdV3)) fail(code, 'Jerarquía tipográfica inválida')
  const words = [connector, keyword, closing].filter(Boolean).join(' ').split(/\s+/).filter(Boolean)
  if (words.length > 8) fail(code, 'El texto supera ocho palabras visibles')
  record(value.timing, code, 'text.timing')
  exactKeys(value.timing, ['connectorStart', 'keywordStart', 'closingStart'], code, 'text.timing')
  const connectorStart = u01(value.timing.connectorStart, code, 'connectorStart')
  const keywordStart = u01(value.timing.keywordStart, code, 'keywordStart')
  if (keywordStart < connectorStart) fail(code, 'keywordStart precede connectorStart')
  if (closing) {
    if (value.timing.closingStart === undefined || u01(value.timing.closingStart, code, 'closingStart') < keywordStart)
      fail(code, 'closingStart inválido')
  } else if (value.timing.closingStart !== undefined) fail(code, 'closingStart sin closing')
  record(value.motion, code, 'text.motion')
  exactKeys(value.motion, ['secondaryPreset', 'keywordPreset', 'emphasisStart'], code, 'text.motion')
  if (value.motion.secondaryPreset !== 'fade-slide' ||
      !['scale-punch', 'slide-reveal', 'underline-reveal'].includes(String(value.motion.keywordPreset)))
    fail(code, 'Preset de texto no soportado')
  u01(value.motion.emphasisStart, code, 'emphasisStart')
}

function validateSlot(value: unknown): asserts value is SceneSlotV2 {
  const code = 'VISUAL_SCENE_V2_SLOT_INVALID'
  record(value, code, 'slot')
  if (!SCENE_SLOT_IDS_V2.includes(value.slotId as SceneSlotIdV2) || value.role !== value.slotId)
    fail(code, 'slotId/role inválido')
  if (value.state === 'missing' || value.state === 'omitted') {
    exactKeys(value, ['slotId', 'role', 'state'], code, 'slot vacío')
    return
  }
  if (value.state === 'procedural') {
    exactKeys(value, ['slotId', 'role', 'state', 'kind', 'solarIcon', 'solarStyle', 'bounds', 'fitPolicy', 'tint', 'motion'], code, 'slot Solar')
    if (value.kind !== 'simple-icon' || !['linear', 'bold-duotone'].includes(String(value.solarStyle)) ||
        !esNombreSolarCanonico(nonempty(value.solarIcon, code, 'solarIcon'), value.solarStyle as EstiloSolar))
      fail(code, 'Solar procedural inválido')
    validateBounds(value.bounds)
    if (!['contain', 'subject-contain'].includes(String(value.fitPolicy))) fail(code, 'fitPolicy Solar inválido')
    record(value.tint, code, 'tint')
    exactKeys(value.tint, ['treatment'], code, 'tint')
    if (value.tint.treatment !== 'system-tint') fail(code, 'Solar V15 usa system-tint explícito')
    evaluateAssetMotion(value.motion as AssetMotionRecipeV1, 0.5)
    return
  }
  exactKeys(value, ['slotId', 'role', 'state', 'sha256', 'mime', 'kind', 'alphaMode', 'bounds', 'fitPolicy', 'tint', 'motion'], code, 'slot present')
  if (value.state !== 'present' || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) ||
      !VISUAL_ASSET_MIMES_V2.includes(value.mime as VisualAssetMimeV2) ||
      !VISUAL_ASSET_KINDS_V2.includes(value.kind as VisualAssetKindV2) ||
      !['vector', 'useful-alpha', 'opaque-rectangle'].includes(String(value.alphaMode)) ||
      !['contain', 'subject-contain', 'cover'].includes(String(value.fitPolicy))) fail(code, 'Slot ProjectAsset inválido')
  if (value.mime === 'image/svg+xml' && value.alphaMode !== 'vector') fail(code, 'SVG requiere alphaMode=vector')
  if (value.mime !== 'image/svg+xml' && value.alphaMode === 'vector') fail(code, 'Raster no puede declarar vector')
  if (value.alphaMode === 'opaque-rectangle' && value.fitPolicy === 'subject-contain')
    fail(code, 'Raster opaco no admite subject-contain')
  validateBounds(value.bounds)
  record(value.tint, code, 'tint')
  exactKeys(value.tint, ['treatment'], code, 'tint')
  if (!VISUAL_TREATMENTS_V2.includes(value.tint.treatment as VisualTreatmentV2)) fail(code, 'Tratamiento V15 inválido')
  if (value.mime !== 'image/svg+xml' && value.tint.treatment !== 'original-color')
    fail(code, 'Raster V15 conserva color original')
  evaluateAssetMotion(value.motion as AssetMotionRecipeV1, 0.5)
}

function validateDirection(value: unknown): asserts value is VisualDirectionV2 {
  const code = 'VISUAL_SCENE_V2_DIRECTION_INVALID'
  record(value, code, 'direccion')
  exactKeys(value, ['fondo', 'estructura', 'camara', 'densidad', 'ritmo', 'semilla'], code, 'direccion')
  if (typeof value.fondo !== 'string' || !(value.fondo in FONDOS) ||
      !MODERN_LAYOUT_STRUCTURES_V4.includes(value.estructura as ModernLayoutStructureV4) ||
      typeof value.camara !== 'string' || !(value.camara in CAMARAS) ||
      !DENSIDADES.includes(value.densidad as Densidad) || !RITMOS.includes(value.ritmo as Ritmo) ||
      !Number.isSafeInteger(value.semilla) || Number(value.semilla) <= 0) fail(code, 'Dirección V15 inválida')
}

function validateLayout(value: unknown, spec: Record<string, unknown>, slots: SceneSlotV2[]): asserts value is VisualLayoutV4 {
  const code = 'VISUAL_SCENE_V2_LAYOUT_INVALID'
  record(value, code, 'layout')
  exactKeys(value, ['version', 'family', 'textRegion', 'textBounds', 'textAlignment', 'relationStyle', 'slotLayouts'], code, 'layout')
  if (value.version !== 2 || !MODERN_LAYOUT_STRUCTURES_V4.includes(value.family as ModernLayoutStructureV4)) fail(code, 'Familia V15 inválida')
  validateRect(value.textBounds, 'layout.textBounds')
  if (!Array.isArray(value.slotLayouts)) fail(code, 'slotLayouts debe ser array')
  for (const item of value.slotLayouts) {
    record(item, code, 'slotLayout')
    exactKeys(item, ['slotId', 'placement', 'envelope', 'zIndex', 'rotationDeg', 'opacity', 'backing', 'crop'], code, 'slotLayout')
    if (!SCENE_SLOT_IDS_V2.includes(item.slotId as SceneSlotIdV2) || !Number.isInteger(item.zIndex) ||
        Number(item.zIndex) < 2 || Number(item.zIndex) > 6 || !Number.isFinite(item.rotationDeg) ||
        Number(item.rotationDeg) < -30 || Number(item.rotationDeg) > 30 ||
        typeof item.opacity !== 'number' || item.opacity <= 0 || item.opacity > 1) fail(code, 'Geometría de slot inválida')
    validateRect(item.envelope, `layout.${String(item.slotId)}.envelope`)
  }
  const active = slots.filter(slot => slot.state === 'present' || slot.state === 'procedural')
  const supportCount = active.filter(slot => slot.role !== 'hero').length
  const expected = createVisualLayoutV4(
    value.family as ModernLayoutStructureV4,
    spec.visualMode as 'asset-led' | 'editorial-text',
    supportCount,
    Number((spec.direccion as VisualDirectionV2).semilla),
  )
  if (canonical(value) !== canonical(expected)) fail(code, 'Layout no coincide con geometría V15 certificada')
  const activeIds = active.map(slot => slot.slotId).sort()
  const layoutIds = value.slotLayouts.map(item => (item as { slotId: SceneSlotIdV2 }).slotId).sort()
  if (canonical(activeIds) !== canonical(layoutIds)) fail(code, 'Layout y slots activos no coinciden')
}

export function validateVisualSceneSpecV2(value: unknown): VisualSceneSpecV2 {
  const code = 'VISUAL_SCENE_SPEC_V2_INVALID'
  record(value, code, 'sceneSpec')
  exactKeys(value, ['renderSpecVersion', 'visualMode', 'renderTier', 'sistema', 'direccion', 'videoStyle', 'backgroundProfile', 'colorPalette', 'layout', 'text', 'slots', 'revisions', 'fallbackVisual'], code, 'sceneSpec')
  if (value.renderSpecVersion !== VISUAL_RENDER_SPEC_VERSION_V2 ||
      !['asset-led', 'editorial-text'].includes(String(value.visualMode)) || value.renderTier !== 'standard' ||
      !Object.keys(SISTEMAS).includes(String(value.sistema)) || value.fallbackVisual !== 'editorial-text')
    fail(code, 'Cabecera V15 inválida')
  validateDirection(value.direccion)
  validateVideoVisualStyleV1(value.videoStyle)
  if (value.backgroundProfile !== undefined) validateBackgroundProfileV1(value.backgroundProfile)
  if (value.colorPalette !== undefined) validateSceneColorPaletteV1(value.colorPalette)
  validateText(value.text)
  if (!Array.isArray(value.slots) || value.slots.length > 3) fail(code, 'V15 admite máximo tres slots')
  value.slots.forEach(validateSlot)
  const ids = value.slots.map(slot => (slot as SceneSlotV2).slotId)
  if (new Set(ids).size !== ids.length) fail(code, 'slotId duplicado')
  const active = (value.slots as SceneSlotV2[]).filter(slot => slot.state === 'present' || slot.state === 'procedural')
  const heroes = active.filter(slot => slot.role === 'hero')
  const supports = active.filter(slot => slot.role !== 'hero')
  if (value.visualMode === 'asset-led' && heroes.length !== 1) fail('VISUAL_SCENE_V2_HERO_REQUIRED', 'asset-led exige exactamente un Hero')
  if (value.visualMode === 'editorial-text' && active.length) fail(code, 'editorial-text no acepta assets activos')
  if (supports.length > 2 || (supports.length && !heroes.length)) fail(code, 'Supports requieren Hero y máximo dos')
  const identities = active.map(slot => slot.state === 'present' ? `sha:${slot.sha256}` : `solar:${slot.solarIcon}`)
  if (new Set(identities).size !== identities.length)
    fail(code, 'Un mismo asset semántico no puede llenar varios slots sin una revisión contractual explícita')
  validateLayout(value.layout, value, value.slots as SceneSlotV2[])
  if ((value.layout as VisualLayoutV4).family !== (value.direccion as VisualDirectionV2).estructura ||
      (value.text as EditorialTextV2).alignment !== (value.layout as VisualLayoutV4).textAlignment)
    fail(code, 'Dirección, layout y texto no coinciden')
  record(value.revisions, code, 'revisions')
  exactKeys(value.revisions, Object.keys(VISUAL_REVISIONS_V2), code, 'revisions')
  if (canonical(value.revisions) !== canonical(VISUAL_REVISIONS_V2)) fail(code, 'Revisiones V15 no soportadas')
  return value as VisualSceneSpecV2
}

export function validateRenderBindingsV2(value: unknown): RenderBindingsV2 {
  const code = 'VISUAL_RENDER_BINDINGS_V2_INVALID'
  record(value, code, 'RenderBindingsV2')
  exactKeys(value, ['version', 'assets'], code, 'RenderBindingsV2')
  if (value.version !== VISUAL_BINDINGS_VERSION_V2 || !Array.isArray(value.assets) || value.assets.length > 3)
    fail(code, 'RenderBindingsV2 inválido')
  const assets = value.assets.map(raw => {
    record(raw, code, 'binding')
    exactKeys(raw, ['slotId', 'assetId', 'relativeFile'], code, 'binding')
    if (!SCENE_SLOT_IDS_V2.includes(raw.slotId as SceneSlotIdV2)) fail(code, 'slotId de binding inválido')
    return { slotId: raw.slotId as SceneSlotIdV2, assetId: nonempty(raw.assetId, code, 'assetId'),
      relativeFile: nonempty(raw.relativeFile, code, 'relativeFile') }
  })
  if (new Set(assets.map(asset => asset.slotId)).size !== assets.length) fail(code, 'Binding de slot duplicado')
  if (new Set(assets.map(asset => asset.assetId)).size !== assets.length) fail(code, 'Asset repetido sin justificación explícita')
  return { version: VISUAL_BINDINGS_VERSION_V2, assets }
}

export function validateVisualSceneSpecAny(value: unknown): VisualSceneSpecAny {
  return !!value && typeof value === 'object' && (value as { renderSpecVersion?: unknown }).renderSpecVersion === 2
    ? validateVisualSceneSpecV2(value) : validateVisualSceneSpec(value)
}

export function validateRenderBindingsAny(value: unknown, spec: VisualSceneSpecAny): RenderBindingsAny {
  return spec.renderSpecVersion === 2 ? validateRenderBindingsV2(value) : validateRenderBindings(value)
}

export function sceneSpecFromGraphicDataAny(graphicData: unknown): VisualSceneSpecAny | null {
  if (!graphicData || typeof graphicData !== 'object') return null
  const extra = (graphicData as { extra?: unknown }).extra
  if (!extra || typeof extra !== 'object' || Array.isArray(extra) ||
      !Object.prototype.hasOwnProperty.call(extra, 'sceneSpec')) return null
  return validateVisualSceneSpecAny((extra as { sceneSpec?: unknown }).sceneSpec)
}

/** V1 delegates to its byte-stable historical canonicalizer; V2 hashes its full pixel contract. */
export function sceneSpecPixelIdentityAny(spec: VisualSceneSpecAny): string {
  return spec.renderSpecVersion === 1 ? sceneSpecPixelIdentity(spec) : canonical(validateVisualSceneSpecV2(spec))
}

export function sceneSpecReactKeyAny(spec: VisualSceneSpecAny): string {
  return spec.renderSpecVersion === 1 ? sceneSpecReactKey(spec) : 'scene-v2|' + sceneSpecPixelIdentityAny(spec)
}

export function editorialFallbackSpecAny(spec: VisualSceneSpecAny): VisualSceneSpecAny {
  if (spec.renderSpecVersion === 1) return editorialFallbackSpec(spec)
  const slots: SceneSlotV2[] = spec.slots.map(slot => ({ slotId: slot.slotId, role: slot.role, state: 'missing' }))
  const layout = createVisualLayoutV4('editorial', 'editorial-text', 0, spec.direccion.semilla)
  return validateVisualSceneSpecV2({
    ...spec,
    visualMode: 'editorial-text',
    direccion: { ...spec.direccion, estructura: 'editorial' },
    layout,
    text: { ...spec.text, alignment: layout.textAlignment },
    slots,
  })
}

/**
 * Produces a new, canonical pixel contract after a verified file disappears or changes.  A
 * missing Hero becomes editorial.  Missing Supports are removed and the family is retained only
 * while it remains honestly eligible; otherwise the always-valid poster relation is selected.
 */
export function degradedVisualSceneSpecV2(
  spec: VisualSceneSpecV2,
  failedSlots: readonly SceneSlotIdV2[],
): VisualSceneSpecV2 {
  const failed = new Set(failedSlots)
  if (failed.has('hero')) return editorialFallbackSpecAny(spec) as VisualSceneSpecV2
  // Slot roles encode narrative order. Reassigning support-2 into support-1 after verification
  // would silently change composition/identity without a resolver trace. Keep the sequence
  // contiguous instead: losing support-1 also omits every later support.
  if (failed.has('support-1')) failed.add('support-2')
  const slots = spec.slots.map(slot => failed.has(slot.slotId)
    ? { slotId: slot.slotId, role: slot.role, state: 'missing' as const }
    : slot)
  const active = slots.filter(slot => slot.state === 'present' || slot.state === 'procedural')
  const supportCount = active.filter(slot => slot.role !== 'hero').length
  if (!active.some(slot => slot.role === 'hero')) return editorialFallbackSpecAny(spec) as VisualSceneSpecV2
  const family = isLayoutEligibleV4({
    family: spec.layout.family,
    visualMode: 'asset-led',
    supportCount,
  }) ? spec.layout.family : 'marcoPoster'
  const layout = createVisualLayoutV4(family, 'asset-led', supportCount, spec.direccion.semilla)
  return validateVisualSceneSpecV2({
    ...spec,
    direccion: { ...spec.direccion, estructura: family },
    layout,
    text: { ...spec.text, alignment: layout.textAlignment },
    slots,
  })
}

export type VisualStructuralQcFindingV2 = {
  code: string
  level: 'error' | 'needs-review'
  message: string
  slotId?: SceneSlotIdV2
}

/** Static gates that can be proven before launching Chromium. */
export function evaluateVisualStructuralQcV2(spec: VisualSceneSpecV2): VisualStructuralQcFindingV2[] {
  const value = validateVisualSceneSpecV2(spec)
  const findings: VisualStructuralQcFindingV2[] = []
  const active = value.slots.filter(slot => slot.state === 'present' || slot.state === 'procedural')
  const layouts = new Map(value.layout.slotLayouts.map(layout => [layout.slotId, layout]))
  const heroLayout = layouts.get('hero')
  if (value.visualMode === 'asset-led' && heroLayout) {
    const area = heroLayout.envelope.width * heroLayout.envelope.height / 100
    if (area < 11) findings.push({ code: 'VISUAL_QC_HERO_TOO_SMALL', level: 'error',
      message: 'El envelope del Hero ocupa menos del 11% del lienzo', slotId: 'hero' })
  }
  for (const slot of active) {
    const layout = layouts.get(slot.slotId)
    if (!layout) {
      findings.push({ code: 'VISUAL_QC_SLOT_LAYOUT_MISSING', level: 'error',
        message: 'Un slot activo no tiene geometría', slotId: slot.slotId })
      continue
    }
    const area = layout.envelope.width * layout.envelope.height / 100
    if (slot.role !== 'hero' && area < 2.2) findings.push({ code: 'VISUAL_QC_SUPPORT_TOO_SMALL', level: 'error',
      message: 'Un Support ocupa menos del 2.2% del lienzo', slotId: slot.slotId })
    if (slot.role !== 'hero' && heroLayout) {
      const heroArea = heroLayout.envelope.width * heroLayout.envelope.height
      const supportArea = layout.envelope.width * layout.envelope.height
      if (supportArea > heroArea * .78) findings.push({ code: 'VISUAL_QC_SUPPORT_DOMINATES_HERO', level: 'error',
        message: 'Un Support domina al Hero sin justificación', slotId: slot.slotId })
    }
  }
  if (value.videoStyle.backgroundMotion !== 'none' && value.videoStyle.backgroundMotion !== 'subtle')
    findings.push({ code: 'VISUAL_QC_BACKGROUND_MOTION', level: 'error', message: 'Motion de fondo no permitido' })
  return findings
}

export function visualRevisionsV2(): VisualRevisionsV2 { return { ...VISUAL_REVISIONS_V2 } }

export function createRoleMotionV2(input: {
  role: SceneSlotRoleV2
  energy: 'low' | 'medium' | 'high'
  emphasis?: boolean
}): AssetMotionRecipeV1 {
  const offset = input.role === 'hero' ? 0 : input.role === 'support-1' ? 0.08 : 0.16
  const duration = 0.18
  const sustainStart = offset + duration
  const intensity = input.role === 'hero' ? (input.energy === 'high' ? 'strong' : 'medium') : 'subtle'
  return {
    entry: { preset: input.role === 'hero' && input.energy !== 'low' ? 'scale-in' : 'fade-slide',
      start: offset, duration, intensity },
    sustain: { preset: input.role === 'hero' && input.energy !== 'low' ? 'float' : 'breathe',
      start: sustainStart, end: 0.78, cycleDivisor: input.role === 'hero' ? 3 : input.role === 'support-1' ? 4 : 5,
      intensity: input.role === 'hero' ? 'subtle' : 'subtle' },
    emphasis: input.emphasis && input.role === 'hero'
      ? { preset: 'punch', start: 0.52, duration: 0.1, intensity: 'medium', reason: 'keyword' }
      : null,
    exit: { preset: input.role === 'hero' ? 'scale-down' : 'fade-out', start: 0.82, duration: 0.18,
      intensity: input.role === 'hero' ? 'medium' : 'subtle' },
    visibility: { start: offset, end: 1 },
  }
}

export function activeSlotsV2(spec: VisualSceneSpecV2): Array<PresentSceneSlotV2 | ProceduralSceneSlotV2> {
  return spec.slots.filter((slot): slot is PresentSceneSlotV2 | ProceduralSceneSlotV2 =>
    slot.state === 'present' || slot.state === 'procedural')
}

export function motionQcTimesV2(spec: VisualSceneSpecV2): number[] {
  const points = [0, 0.2, 0.5, spec.text.motion.emphasisStart, 0.82, 1]
  for (const slot of activeSlotsV2(spec)) {
    points.push(slot.motion.entry.start + slot.motion.entry.duration, slot.motion.sustain.start,
      slot.motion.emphasis ? slot.motion.emphasis.start + slot.motion.emphasis.duration / 2 : 0.5,
      slot.motion.exit.start)
  }
  return [...new Set(points.map(value => Number(Math.min(1, Math.max(0, value)).toFixed(6))))].sort((a, b) => a - b)
}

/** Useful for tests proving that style/provider/path boundaries remain explicit. */
export const VISUAL_SCENE_V2_VOCABULARY = Object.freeze({
  styles: VIDEO_VISUAL_STYLE_IDS,
  backgrounds: VIDEO_BACKGROUND_VARIANTS,
  treatments: VISUAL_TREATMENTS_V2,
  mimes: VISUAL_ASSET_MIMES_V2,
})
