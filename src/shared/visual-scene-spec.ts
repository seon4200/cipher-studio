import {
  CAMARAS,
  DENSIDADES,
  ESTRUCTURAS,
  FONDOS,
  RITMOS,
  ZONA_X_MAX,
  ZONA_X_MIN,
  ZONA_Y_MIN,
  type Densidad,
  type IdCamara,
  type IdFondo,
  type Ritmo,
} from './escena'
import { CONTRASTE_MINIMO_ESCENA, SISTEMAS, contrasteTextoEscena, type NombreSistema } from './sistemas'
import { esNombreSolarCanonico, type EstiloSolar } from './iconos-solar'

/**
 * Productive V1 projection for an asset-led Visual.
 *
 * This file is deliberately shared by main and renderer. The main process hashes and
 * resolves it; React uses the exact same canonical identity. Administrative provenance,
 * project paths and bytes are represented by RenderBindings and never enter this object.
 */
export const VISUAL_RENDER_SPEC_VERSION = 1 as const
export const VISUAL_MVP_LAYOUT_REVISION = 'visual-asset-layout-v1' as const
export const VISUAL_MVP_TEXT_REVISION = 'editorial-text-v1' as const
export const VISUAL_MVP_MOTION_REVISION = 'asset-motion-v1' as const
export const VISUAL_MVP_TREATMENT_REVISION = 'asset-treatment-v1' as const
export const VISUAL_MVP_BOUNDS_REVISION = 'subject-bounds-v1' as const
export const VISUAL_MVP_FONT_REVISION = 'cipher-font-pairs-v1' as const
export const VISUAL_MVP_PALETTE_REVISION = 'cipher-palettes-v1' as const

export const VISUAL_MVP_STRUCTURES = ['constelacion', 'marcoPoster', 'editorial'] as const
export type VisualMvpStructure = typeof VISUAL_MVP_STRUCTURES[number]
export const VISUAL_MVP_FONT_PAIRS = ['technical-black', 'editorial-black'] as const
export type VisualMvpFontPair = typeof VISUAL_MVP_FONT_PAIRS[number]
export const VISUAL_MVP_TREATMENTS = ['none', 'accent-mask', 'duotone'] as const
export type VisualMvpTreatment = typeof VISUAL_MVP_TREATMENTS[number]
export const VISUAL_MVP_CYCLE_DIVISORS = [2, 3, 4, 5, 6, 8, 10, 12] as const
export type VisualMvpCycleDivisor = typeof VISUAL_MVP_CYCLE_DIVISORS[number]

export type VisualModeV1 = 'asset-led' | 'editorial-text'
export type VisualMvpAssetKind = 'simple-icon' | 'complex-illustration'
export type VisualMvpIntensity = 'subtle' | 'medium' | 'strong'
export type VisualMvpEntry = 'fade-slide' | 'scale-in'
export type VisualMvpSustain = 'float' | 'breathe'
export type VisualMvpExit = 'fade-out' | 'scale-down'

export type SubjectBoundsV1 = {
  revision: typeof VISUAL_MVP_BOUNDS_REVISION
  alphaBounds: { x: number; y: number; width: number; height: number }
  visibleWidthRatio: number
  visibleHeightRatio: number
  centerOfMass: { x: number; y: number }
  aspectRatio: number
  transparentPadding: { top: number; right: number; bottom: number; left: number }
}

export type AssetMotionRecipeV1 = {
  entry: { preset: VisualMvpEntry; start: number; duration: number; intensity: VisualMvpIntensity }
  sustain: {
    preset: VisualMvpSustain
    start: number
    end: number
    cycleDivisor: VisualMvpCycleDivisor
    intensity: VisualMvpIntensity
  }
  emphasis: null | {
    preset: 'punch'
    start: number
    duration: number
    intensity: VisualMvpIntensity
    reason: 'keyword' | 'manual'
  }
  exit: { preset: VisualMvpExit; start: number; duration: number; intensity: VisualMvpIntensity }
  visibility: { start: number; end: number }
}

export type PresentHeroSlotV1 = {
  slotId: 'hero'
  role: 'hero'
  state: 'present'
  sha256: string
  mime: 'image/svg+xml'
  kind: VisualMvpAssetKind
  bounds: SubjectBoundsV1
  fitPolicy: 'contain' | 'subject-contain'
  tint: { treatment: VisualMvpTreatment }
  motion: AssetMotionRecipeV1
}

/**
 * A local procedural Solar icon. It is a materialized visual choice, not an asset locator:
 * its canonical Solar name/style are PixelIdentity while ProjectAsset bindings remain absent.
 */
export type ProceduralHeroSlotV1 = {
  slotId: 'hero'
  role: 'hero'
  state: 'procedural'
  kind: 'simple-icon'
  solarIcon: string
  solarStyle: EstiloSolar
  bounds: SubjectBoundsV1
  fitPolicy: 'contain' | 'subject-contain'
  tint: { treatment: 'none' }
  motion: AssetMotionRecipeV1
}

/** Missing/omitted carry no SHA. Their state, not a stale content identity, is hashed. */
export type EmptyHeroSlotV1 = {
  slotId: 'hero'
  role: 'hero'
  state: 'missing' | 'omitted'
}

export type SceneSlotV1 = PresentHeroSlotV1 | ProceduralHeroSlotV1 | EmptyHeroSlotV1

export type EditorialTextV1 = {
  connector?: string
  keyword: string
  closing?: string
  alignment: 'left' | 'center'
  maxLines: 2
  fontPairId: VisualMvpFontPair
  timing: {
    connectorStart: number
    keywordStart: number
    closingStart?: number
  }
}

export type VisualDirectionV1 = {
  fondo: IdFondo
  estructura: VisualMvpStructure
  camara: IdCamara
  densidad: Densidad
  ritmo: Ritmo
  semilla: number
}

export type VisualRevisionsV1 = {
  layoutRevision: typeof VISUAL_MVP_LAYOUT_REVISION
  textRevision: typeof VISUAL_MVP_TEXT_REVISION
  motionRevision: typeof VISUAL_MVP_MOTION_REVISION
  treatmentRevision: typeof VISUAL_MVP_TREATMENT_REVISION
  boundsRevision: typeof VISUAL_MVP_BOUNDS_REVISION
  fontRevision: typeof VISUAL_MVP_FONT_REVISION
  paletteRevision: typeof VISUAL_MVP_PALETTE_REVISION
}

export type VisualSceneSpecV1 = {
  renderSpecVersion: typeof VISUAL_RENDER_SPEC_VERSION
  visualMode: VisualModeV1
  renderTier: 'standard'
  sistema: NombreSistema
  direccion: VisualDirectionV1
  text: EditorialTextV1
  slots: SceneSlotV1[]
  revisions: VisualRevisionsV1
  fallbackVisual: 'editorial-text'
}

/** Locator only. Never put this object inside graphicData or PixelIdentity. */
export type RenderBindingsV1 = {
  assets: Array<{ slotId: 'hero'; assetId: string; relativeFile: string }>
}

/** Ephemeral transport generated only after ProjectAsset verification. */
export type PreparedRenderAssetV1 = {
  slotId: 'hero'
  assetId: string
  mime: 'image/svg+xml'
  bytesBase64: string
}

/** Browser-only locator created from PreparedRenderAsset bytes; also outside identity. */
export type RuntimeRenderAssetV1 = {
  slotId: 'hero'
  assetId: string
  mime: 'image/svg+xml'
  objectUrl: string
}

export class VisualSceneSpecError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'VisualSceneSpecError'
  }
}

const REVISIONS: VisualRevisionsV1 = {
  layoutRevision: VISUAL_MVP_LAYOUT_REVISION,
  textRevision: VISUAL_MVP_TEXT_REVISION,
  motionRevision: VISUAL_MVP_MOTION_REVISION,
  treatmentRevision: VISUAL_MVP_TREATMENT_REVISION,
  boundsRevision: VISUAL_MVP_BOUNDS_REVISION,
  fontRevision: VISUAL_MVP_FONT_REVISION,
  paletteRevision: VISUAL_MVP_PALETTE_REVISION,
}

export function visualMvpRevisions(): VisualRevisionsV1 {
  return { ...REVISIONS }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new VisualSceneSpecError(code, message, details)
}

function object(value: unknown, code: string, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, `${name} debe ser un objeto`)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], code: string, name: string): void {
  const unexpected = Object.keys(value).filter(key => !keys.includes(key))
  if (unexpected.length) fail(code, `${name} contiene campos no permitidos`, { unexpected })
}

function oneOf<T extends string>(value: unknown, values: readonly T[], code: string, name: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(code, `${name} no pertenece al vocabulario V1`, { value })
  return value as T
}

function finite(value: unknown, code: string, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(code, `${name} debe ser finito`, { value })
  return value
}

function u01(value: unknown, code: string, name: string): number {
  const number = finite(value, code, name)
  if (number < 0 || number > 1) fail(code, `${name} debe estar entre 0 y 1`, { value })
  return number
}

function nonempty(value: unknown, code: string, name: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(code, `${name} no puede estar vacío`)
  return value.trim()
}

function validateBounds(value: unknown): asserts value is SubjectBoundsV1 {
  const code = 'VISUAL_SCENE_BOUNDS_INVALID'
  object(value, code, 'bounds')
  exactKeys(value, ['revision', 'alphaBounds', 'visibleWidthRatio', 'visibleHeightRatio', 'centerOfMass', 'aspectRatio', 'transparentPadding'], code, 'bounds')
  if (value.revision !== VISUAL_MVP_BOUNDS_REVISION) fail(code, 'Revisión de bounds no soportada')
  object(value.alphaBounds, code, 'alphaBounds')
  exactKeys(value.alphaBounds, ['x', 'y', 'width', 'height'], code, 'alphaBounds')
  const x = u01(value.alphaBounds.x, code, 'alphaBounds.x')
  const y = u01(value.alphaBounds.y, code, 'alphaBounds.y')
  const width = u01(value.alphaBounds.width, code, 'alphaBounds.width')
  const height = u01(value.alphaBounds.height, code, 'alphaBounds.height')
  if (width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001)
    fail(code, 'alphaBounds debe ser un rectángulo positivo confinado')
  const visibleWidth = u01(value.visibleWidthRatio, code, 'visibleWidthRatio')
  const visibleHeight = u01(value.visibleHeightRatio, code, 'visibleHeightRatio')
  if (visibleWidth <= 0 || visibleHeight <= 0) fail(code, 'Las proporciones visibles deben ser positivas')
  object(value.centerOfMass, code, 'centerOfMass')
  exactKeys(value.centerOfMass, ['x', 'y'], code, 'centerOfMass')
  u01(value.centerOfMass.x, code, 'centerOfMass.x')
  u01(value.centerOfMass.y, code, 'centerOfMass.y')
  if (finite(value.aspectRatio, code, 'aspectRatio') <= 0) fail(code, 'aspectRatio debe ser positivo')
  object(value.transparentPadding, code, 'transparentPadding')
  exactKeys(value.transparentPadding, ['top', 'right', 'bottom', 'left'], code, 'transparentPadding')
  for (const side of ['top', 'right', 'bottom', 'left'] as const)
    u01(value.transparentPadding[side], code, `transparentPadding.${side}`)
}

function validateMotionWindow(value: unknown, presets: readonly string[], name: string): Record<string, unknown> {
  const code = 'VISUAL_SCENE_MOTION_INVALID'
  object(value, code, name)
  exactKeys(value, ['preset', 'start', 'duration', 'intensity'], code, name)
  oneOf(value.preset, presets, code, `${name}.preset`)
  u01(value.start, code, `${name}.start`)
  const duration = u01(value.duration, code, `${name}.duration`)
  if (duration <= 0 || Number(value.start) + duration > 1.000001) fail(code, `${name} sale de 0..1`)
  oneOf(value.intensity, ['subtle', 'medium', 'strong'], code, `${name}.intensity`)
  return value
}

function validateMotion(value: unknown): asserts value is AssetMotionRecipeV1 {
  const code = 'VISUAL_SCENE_MOTION_INVALID'
  object(value, code, 'motion')
  exactKeys(value, ['entry', 'sustain', 'emphasis', 'exit', 'visibility'], code, 'motion')
  const entry = validateMotionWindow(value.entry, ['fade-slide', 'scale-in'], 'entry')
  const exit = validateMotionWindow(value.exit, ['fade-out', 'scale-down'], 'exit')
  object(value.sustain, code, 'sustain')
  exactKeys(value.sustain, ['preset', 'start', 'end', 'cycleDivisor', 'intensity'], code, 'sustain')
  oneOf(value.sustain.preset, ['float', 'breathe'], code, 'sustain.preset')
  const sustainStart = u01(value.sustain.start, code, 'sustain.start')
  const sustainEnd = u01(value.sustain.end, code, 'sustain.end')
  if (sustainEnd <= sustainStart) fail(code, 'sustain.end debe ser posterior a sustain.start')
  if (!(VISUAL_MVP_CYCLE_DIVISORS as readonly unknown[]).includes(value.sustain.cycleDivisor))
    fail(code, 'cycleDivisor no es un preset cerrado')
  oneOf(value.sustain.intensity, ['subtle', 'medium', 'strong'], code, 'sustain.intensity')
  object(value.visibility, code, 'visibility')
  exactKeys(value.visibility, ['start', 'end'], code, 'visibility')
  const visibleStart = u01(value.visibility.start, code, 'visibility.start')
  const visibleEnd = u01(value.visibility.end, code, 'visibility.end')
  if (visibleEnd <= visibleStart) fail(code, 'visibility debe tener duración positiva')

  const entryEnd = Number(entry.start) + Number(entry.duration)
  const exitStart = Number(exit.start)
  if (entryEnd > sustainStart + 1e-9) fail(code, 'entry debe terminar antes de sustain')
  if (sustainEnd > exitStart + 1e-9) fail(code, 'sustain debe terminar antes de exit')
  if (Number(entry.start) < visibleStart || exitStart + Number(exit.duration) > visibleEnd + 1e-9)
    fail(code, 'entry/exit deben quedar dentro de visibility')

  if (value.emphasis !== null) {
    object(value.emphasis, code, 'emphasis')
    exactKeys(value.emphasis, ['preset', 'start', 'duration', 'intensity', 'reason'], code, 'emphasis')
    if (value.emphasis.preset !== 'punch') fail(code, 'V1 sólo admite emphasis punch')
    const emphasisStart = u01(value.emphasis.start, code, 'emphasis.start')
    const emphasisDuration = u01(value.emphasis.duration, code, 'emphasis.duration')
    if (emphasisDuration <= 0 || emphasisStart + emphasisDuration > exitStart + 1e-9)
      fail(code, 'emphasis no puede invadir exit')
    oneOf(value.emphasis.intensity, ['subtle', 'medium', 'strong'], code, 'emphasis.intensity')
    oneOf(value.emphasis.reason, ['keyword', 'manual'], code, 'emphasis.reason')
  }
}

function validateText(value: unknown): asserts value is EditorialTextV1 {
  const code = 'VISUAL_SCENE_TEXT_INVALID'
  object(value, code, 'text')
  exactKeys(value, ['connector', 'keyword', 'closing', 'alignment', 'maxLines', 'fontPairId', 'timing'], code, 'text')
  const connector = Object.prototype.hasOwnProperty.call(value, 'connector')
    ? nonempty(value.connector, code, 'connector') : ''
  const keyword = nonempty(value.keyword, code, 'keyword')
  const closing = Object.prototype.hasOwnProperty.call(value, 'closing')
    ? nonempty(value.closing, code, 'closing') : ''
  oneOf(value.alignment, ['left', 'center'], code, 'alignment')
  if (value.maxLines !== 2) fail(code, 'El MVP fija maxLines=2')
  oneOf(value.fontPairId, VISUAL_MVP_FONT_PAIRS, code, 'fontPairId')
  const words = [connector, keyword, closing].filter(Boolean).join(' ').split(/\s+/).filter(Boolean)
  if (words.length > 8) fail(code, 'El texto editorial supera ocho palabras visibles', { words: words.length })
  object(value.timing, code, 'text.timing')
  exactKeys(value.timing, ['connectorStart', 'keywordStart', 'closingStart'], code, 'text.timing')
  const connectorStart = u01(value.timing.connectorStart, code, 'connectorStart')
  const keywordStart = u01(value.timing.keywordStart, code, 'keywordStart')
  if (keywordStart < connectorStart) fail(code, 'keyword debe entrar después del connector')
  if (closing) {
    if (!Object.prototype.hasOwnProperty.call(value.timing, 'closingStart')) fail(code, 'closing requiere closingStart')
    if (u01(value.timing.closingStart, code, 'closingStart') < keywordStart)
      fail(code, 'closing debe entrar después de keyword')
  } else if (Object.prototype.hasOwnProperty.call(value.timing, 'closingStart')) {
    fail(code, 'closingStart no puede existir sin closing')
  }
}

function validateDirection(value: unknown): asserts value is VisualDirectionV1 {
  const code = 'VISUAL_SCENE_DIRECTION_INVALID'
  object(value, code, 'direccion')
  exactKeys(value, ['fondo', 'estructura', 'camara', 'densidad', 'ritmo', 'semilla'], code, 'direccion')
  if (typeof value.fondo !== 'string' || !(value.fondo in FONDOS)) fail(code, 'Fondo no registrado')
  const estructura = oneOf(value.estructura, VISUAL_MVP_STRUCTURES, code, 'estructura')
  if (typeof value.camara !== 'string' || !(value.camara in CAMARAS)) fail(code, 'Cámara no registrada')
  oneOf(value.densidad, DENSIDADES, code, 'densidad')
  oneOf(value.ritmo, RITMOS, code, 'ritmo')
  const seed = finite(value.semilla, code, 'semilla')
  if (!Number.isSafeInteger(seed) || seed <= 0) fail(code, 'semilla debe ser entero positivo')
  const fondo = FONDOS[value.fondo as IdFondo]
  const camara = CAMARAS[value.camara as IdCamara]
  if (fondo.energia + camara.energia > 3) fail(code, 'El par fondo/cámara supera la energía permitida')
  if (!(estructura in ESTRUCTURAS)) fail(code, 'Estructura no registrada')
}

function validateSlot(value: unknown): asserts value is SceneSlotV1 {
  const code = 'VISUAL_SCENE_SLOT_INVALID'
  object(value, code, 'slot')
  if (value.state === 'missing' || value.state === 'omitted') {
    exactKeys(value, ['slotId', 'role', 'state'], code, 'slot vacío')
    if (value.slotId !== 'hero' || value.role !== 'hero') fail(code, 'El MVP sólo admite el slot hero')
    return
  }
  if (value.state === 'procedural') {
    exactKeys(value, ['slotId', 'role', 'state', 'kind', 'solarIcon', 'solarStyle', 'bounds', 'fitPolicy', 'tint', 'motion'], code, 'slot procedural')
    if (value.slotId !== 'hero' || value.role !== 'hero') fail(code, 'El MVP sólo admite el slot hero')
    if (value.kind !== 'simple-icon') fail(code, 'Solar V1 sólo admite icono simple')
    const solarIcon = nonempty(value.solarIcon, code, 'solarIcon')
    const solarStyle = oneOf(value.solarStyle, ['linear', 'bold-duotone'], code, 'solarStyle')
    if (!esNombreSolarCanonico(solarIcon, solarStyle)) fail(code, 'solarIcon no es un ID Solar canónico válido')
    validateBounds(value.bounds)
    oneOf(value.fitPolicy, ['contain', 'subject-contain'], code, 'fitPolicy')
    object(value.tint, code, 'tint')
    exactKeys(value.tint, ['treatment'], code, 'tint')
    if (value.tint.treatment !== 'none') fail(code, 'Solar procedural V1 no acepta tratamiento externo')
    validateMotion(value.motion)
    return
  }
  exactKeys(value, ['slotId', 'role', 'state', 'sha256', 'mime', 'kind', 'bounds', 'fitPolicy', 'tint', 'motion'], code, 'slot present')
  if (value.slotId !== 'hero' || value.role !== 'hero' || value.state !== 'present')
    fail(code, 'El MVP sólo admite hero present/procedural/missing/omitted')
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) fail(code, 'SHA-256 inválida')
  if (value.mime !== 'image/svg+xml') fail(code, 'El MVP productivo sólo admite SVG OpenMoji')
  oneOf(value.kind, ['simple-icon', 'complex-illustration'], code, 'kind')
  validateBounds(value.bounds)
  oneOf(value.fitPolicy, ['contain', 'subject-contain'], code, 'fitPolicy')
  object(value.tint, code, 'tint')
  exactKeys(value.tint, ['treatment'], code, 'tint')
  oneOf(value.tint.treatment, VISUAL_MVP_TREATMENTS, code, 'treatment')
  validateMotion(value.motion)
}

function validateRevisions(value: unknown): asserts value is VisualRevisionsV1 {
  const code = 'VISUAL_SCENE_REVISION_INVALID'
  object(value, code, 'revisions')
  exactKeys(value, Object.keys(REVISIONS), code, 'revisions')
  for (const [key, expected] of Object.entries(REVISIONS))
    if (value[key] !== expected) fail(code, `Revisión no soportada: ${key}`, { expected, actual: value[key] })
}

export function validateVisualSceneSpec(value: unknown): VisualSceneSpecV1 {
  const code = 'VISUAL_SCENE_SPEC_INVALID'
  object(value, code, 'sceneSpec')
  exactKeys(value, ['renderSpecVersion', 'visualMode', 'renderTier', 'sistema', 'direccion', 'text', 'slots', 'revisions', 'fallbackVisual'], code, 'sceneSpec')
  if (value.renderSpecVersion !== VISUAL_RENDER_SPEC_VERSION) fail(code, 'renderSpecVersion no soportada')
  const visualMode = oneOf(value.visualMode, ['asset-led', 'editorial-text'], code, 'visualMode')
  if (value.renderTier !== 'standard') fail(code, 'El MVP no degrada silenciosamente el renderTier')
  oneOf(value.sistema, Object.keys(SISTEMAS) as NombreSistema[], code, 'sistema')
  validateDirection(value.direccion)
  validateText(value.text)
  if (!Array.isArray(value.slots) || value.slots.length > 1) fail(code, 'El MVP admite como máximo un slot')
  for (const slot of value.slots) validateSlot(slot)
  const activeHero = value.slots.filter(slot => ['present', 'procedural'].includes((slot as { state?: unknown }).state as string))
  if (visualMode === 'asset-led' && activeHero.length !== 1) fail('VISUAL_SCENE_HERO_REQUIRED', 'asset-led exige un Hero present o procedural')
  if (visualMode === 'editorial-text' && activeHero.length !== 0) fail(code, 'editorial-text no puede contener un Hero')
  validateRevisions(value.revisions)
  if (value.fallbackVisual !== 'editorial-text') fail(code, 'El único fallback del MVP es editorial-text')
  return value as VisualSceneSpecV1
}

export function validateRenderBindings(value: unknown): RenderBindingsV1 {
  const code = 'VISUAL_RENDER_BINDINGS_INVALID'
  object(value, code, 'RenderBindings')
  exactKeys(value, ['assets'], code, 'RenderBindings')
  if (!Array.isArray(value.assets) || value.assets.length > 1) fail(code, 'El MVP admite como máximo un binding')
  const assets = value.assets.map(candidate => {
    object(candidate, code, 'binding')
    exactKeys(candidate, ['slotId', 'assetId', 'relativeFile'], code, 'binding')
    if (candidate.slotId !== 'hero') fail(code, 'El binding debe apuntar al slot hero')
    return {
      slotId: 'hero' as const,
      assetId: nonempty(candidate.assetId, code, 'assetId'),
      relativeFile: nonempty(candidate.relativeFile, code, 'relativeFile'),
    }
  })
  return { assets }
}

/** Absent means legacy. Present but invalid always fails; it never silently becomes legacy. */
export function sceneSpecFromGraphicData(graphicData: unknown): VisualSceneSpecV1 | null {
  if (!graphicData || typeof graphicData !== 'object') return null
  const extra = (graphicData as { extra?: unknown }).extra
  if (!extra || typeof extra !== 'object' || Array.isArray(extra) ||
      !Object.prototype.hasOwnProperty.call(extra, 'sceneSpec')) return null
  return validateVisualSceneSpec((extra as { sceneSpec?: unknown }).sceneSpec)
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (typeof value === 'object') return '{' + Object.keys(value as Record<string, unknown>).sort()
    .map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}'
  return JSON.stringify(value)
}

/** The exact shared key source for file cache and React tree identity. */
export function sceneSpecPixelIdentity(spec: VisualSceneSpecV1): string {
  return canonical(validateVisualSceneSpec(spec))
}

export function sceneSpecReactKey(spec: VisualSceneSpecV1): string {
  return 'scene-v1|' + sceneSpecPixelIdentity(spec)
}

export function editorialFallbackSpec(spec: VisualSceneSpecV1): VisualSceneSpecV1 {
  const hero = spec.slots.find(slot => slot.role === 'hero')
  return validateVisualSceneSpec({
    ...spec,
    visualMode: 'editorial-text',
    slots: hero ? [{ slotId: 'hero', role: 'hero', state: 'missing' }] : [],
  })
}

export function createMvpMotion(
  entry: VisualMvpEntry,
  sustain: VisualMvpSustain,
  exit: VisualMvpExit,
  emphasis = false,
): AssetMotionRecipeV1 {
  return {
    entry: { preset: entry, start: 0, duration: 0.2, intensity: 'medium' },
    sustain: { preset: sustain, start: 0.2, end: 0.8, cycleDivisor: 3, intensity: 'subtle' },
    emphasis: emphasis
      ? { preset: 'punch', start: 0.52, duration: 0.1, intensity: 'medium', reason: 'keyword' }
      : null,
    exit: { preset: exit, start: 0.8, duration: 0.2, intensity: 'medium' },
    visibility: { start: 0, end: 1 },
  }
}

export function fullSubjectBounds(aspectRatio = 1): SubjectBoundsV1 {
  return {
    revision: VISUAL_MVP_BOUNDS_REVISION,
    alphaBounds: { x: 0, y: 0, width: 1, height: 1 },
    visibleWidthRatio: 1,
    visibleHeightRatio: 1,
    centerOfMass: { x: 0.5, y: 0.5 },
    aspectRatio,
    transparentPadding: { top: 0, right: 0, bottom: 0, left: 0 },
  }
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value), 3)
const INTENSITY = { subtle: 0.68, medium: 1, strong: 1.32 } as const

export type EvaluatedAssetMotion = {
  opacity: number
  translateXCqmin: number
  translateYCqmin: number
  scale: number
}

/** Pure U01 motion evaluator shared by the renderer and QC. */
export function evaluateAssetMotion(motion: AssetMotionRecipeV1, normalizedTime: number): EvaluatedAssetMotion {
  validateMotion(motion)
  const u = clamp(normalizedTime)
  const entryProgress = easeOut((u - motion.entry.start) / motion.entry.duration)
  const exitProgress = easeOut((u - motion.exit.start) / motion.exit.duration)
  const entryStrength = INTENSITY[motion.entry.intensity]
  const sustainStrength = INTENSITY[motion.sustain.intensity]
  const exitStrength = INTENSITY[motion.exit.intensity]
  let opacity = u < motion.visibility.start || u > motion.visibility.end ? 0 : 1
  let translateYCqmin = 0
  let scale = 1

  if (motion.entry.preset === 'fade-slide') {
    opacity *= entryProgress
    translateYCqmin += (1 - entryProgress) * 5.2 * entryStrength
  } else {
    opacity *= entryProgress
    scale *= 1 - (1 - entryProgress) * 0.18 * entryStrength
  }

  if (u >= motion.sustain.start && u <= motion.sustain.end) {
    const phase = u * Math.PI * 2 * motion.sustain.cycleDivisor
    if (motion.sustain.preset === 'float') translateYCqmin += Math.sin(phase) * 1.35 * sustainStrength
    else scale *= 1 + Math.sin(phase) * 0.018 * sustainStrength
  }

  if (motion.emphasis && u >= motion.emphasis.start && u <= motion.emphasis.start + motion.emphasis.duration) {
    const p = (u - motion.emphasis.start) / motion.emphasis.duration
    scale *= 1 + Math.sin(Math.PI * p) * 0.075 * INTENSITY[motion.emphasis.intensity]
  }

  if (u >= motion.exit.start) {
    if (motion.exit.preset === 'fade-out') opacity *= 1 - exitProgress
    else scale *= 1 - exitProgress * 0.2 * exitStrength
  }
  return { opacity: clamp(opacity), translateXCqmin: 0, translateYCqmin, scale }
}

export function motionQcTimes(motion: AssetMotionRecipeV1): number[] {
  const points = [0, motion.entry.start + motion.entry.duration, 0.5,
    motion.emphasis ? motion.emphasis.start + motion.emphasis.duration / 2 : 0.5,
    motion.exit.start, motion.exit.start + motion.exit.duration]
  return [...new Set(points.map(value => Number(clamp(value).toFixed(6))))]
}

/** Position comes from HeroEstructura; only the fit envelope is certified here. */
export const VISUAL_MVP_HERO_ENVELOPES: Record<VisualMvpStructure, { widthPct: number; heightPct: number }> = {
  constelacion: { widthPct: 44, heightPct: 29 },
  marcoPoster: { widthPct: 42, heightPct: 29 },
  editorial: { widthPct: 38, heightPct: 28 },
}

export type VisualMvpQcIssue = {
  code: string
  level: 'error' | 'needs-review'
  message: string
}

export function evaluateVisualMvpQc(spec: VisualSceneSpecV1): VisualMvpQcIssue[] {
  validateVisualSceneSpec(spec)
  const issues: VisualMvpQcIssue[] = []
  const fondo = FONDOS[spec.direccion.fondo]
  const tone = 'tonoDominante' in fondo ? fondo.tonoDominante : fondo.tono
  const contrast = contrasteTextoEscena(spec.sistema, tone)
  if (contrast < CONTRASTE_MINIMO_ESCENA)
    issues.push({ code: 'VISUAL_QC_TEXT_CONTRAST', level: 'error', message: `Contraste conservador ${contrast.toFixed(2)} < ${CONTRASTE_MINIMO_ESCENA}` })

  const hero = spec.slots.find((slot): slot is PresentHeroSlotV1 | ProceduralHeroSlotV1 =>
    slot.state === 'present' || slot.state === 'procedural')
  if (!hero) return issues
  const meta = ESTRUCTURAS[spec.direccion.estructura].heroe
  const envelope = VISUAL_MVP_HERO_ENVELOPES[spec.direccion.estructura]
  for (const u of motionQcTimes(hero.motion)) {
    const motion = evaluateAssetMotion(hero.motion, u)
    const width = envelope.widthPct * motion.scale
    const height = envelope.heightPct * motion.scale
    // cqmin is one percent of width on 9:16; in Y that is 9/16 percent of the frame.
    const left = meta.x + motion.translateXCqmin - width / 2
    const right = meta.x + motion.translateXCqmin + width / 2
    const centerY = meta.y + motion.translateYCqmin * 9 / 16
    const top = centerY - height / 2
    const bottom = centerY + height / 2
    if (left < ZONA_X_MIN || right > ZONA_X_MAX || top < ZONA_Y_MIN || bottom > 71.5) {
      issues.push({ code: 'VISUAL_QC_HERO_BOUNDS', level: 'error', message: `Hero fuera de envelope seguro en u=${u}` })
      break
    }
  }
  return issues
}
