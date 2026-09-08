// Shared authority: schemas are persistence only, never inputs to graphicData.
export const PROJECT_STATE_SCHEMA_VERSION = 1 as const
export const ASSET_MANIFEST_VERSION = 1 as const

export class PersistenceError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message); this.name = 'PersistenceError'
  }
}
export function record(value: unknown, code: string): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PersistenceError(code, 'Se esperaba un objeto JSON')
}
function required(ok: boolean, code: string, message: string) {
  if (!ok) throw new PersistenceError(code, message)
}
function exactKeys(value: Record<string, any>, keys: string[], code: string) {
  required(Object.keys(value).every(k => keys.includes(k)), code, 'Campo no permitido')
}
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
function version(raw: Record<string, any>, field: string, current: number, prefix: string, legacy = false) {
  const v = raw[field]
  if (legacy && !Object.prototype.hasOwnProperty.call(raw, field)) return 0
  required(typeof v === 'number' && Number.isInteger(v) && v >= 0, prefix + '_INVALID_VERSION', 'Versión inválida')
  if (v > current) throw new PersistenceError(prefix + '_UNSUPPORTED_VERSION',
    'Versión encontrada ' + v + '; soportada ' + current, { found: v, supported: current })
  required(v === current, prefix + '_INVALID_VERSION', 'Versión no soportada: ' + v)
  return v as number
}
export type ProjectSubstrate = {
  projectSubstrateVersion: 1
  primaryStyle: 'blueprint' | 'tech' | 'authority' | 'investigation' | 'economic' | 'pop'
  paletteId: 'editorial' | 'clinico' | 'voltaje' | 'calido'
  fontPairId: 'technical-black' | 'editorial-black' | 'manuscript-black'
  decoratorFamilyId: 'measurement' | 'circuits' | 'marginalia' | 'evidence' | 'accounting' | 'cut-paper'
  textureFamilyId: 'technical-grid' | 'aged-paper' | 'radial-gradient' | 'dark-lines' | 'soft-editorial'
  brandMarkId?: string
}
export function validateProjectSubstrate(value: unknown): ProjectSubstrate | null {
  if (value === null) return null
  const code = 'PROJECT_SUBSTRATE_INVALID'
  record(value, code)
  const enums: Record<string, unknown[]> = {
    projectSubstrateVersion: [1],
    primaryStyle: ['blueprint','tech','authority','investigation','economic','pop'],
    paletteId: ['editorial','clinico','voltaje','calido'],
    fontPairId: ['technical-black','editorial-black','manuscript-black'],
    decoratorFamilyId: ['measurement','circuits','marginalia','evidence','accounting','cut-paper'],
    textureFamilyId: ['technical-grid','aged-paper','radial-gradient','dark-lines','soft-editorial']
  }
  exactKeys(value, [...Object.keys(enums), 'brandMarkId'], code)
  for (const [key, options] of Object.entries(enums)) required(options.includes(value[key]), code, 'Substrate inválido: ' + key)
  if (Object.prototype.hasOwnProperty.call(value, 'brandMarkId'))
    required(typeof value.brandMarkId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value.brandMarkId), code, 'brandMarkId debe ser un ID, no ruta/CSS/URL')
  return value as ProjectSubstrate
}
export type ProjectStateV1 = Record<string, any> & {
  schemaVersion: typeof PROJECT_STATE_SCHEMA_VERSION
  projectSubstrate: ProjectSubstrate | null
}
export function migrateProjectState(raw: unknown) {
  record(raw, 'PROJECT_STATE_INVALID')
  const sourceVersion = version(raw, 'schemaVersion', PROJECT_STATE_SCHEMA_VERSION, 'PROJECT_STATE', true)
  const state = { ...raw, schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    projectSubstrate: sourceVersion === 0 && !Object.prototype.hasOwnProperty.call(raw, 'projectSubstrate') ? null : raw.projectSubstrate }
  validateProjectSubstrate(state.projectSubstrate)
  // Existing clip paths and unknown editor fields are deliberately not transformed.
  return { state: state as ProjectStateV1, sourceVersion, targetVersion: PROJECT_STATE_SCHEMA_VERSION,
    migrated: sourceVersion === 0, warnings: sourceVersion === 0 ? ['PROJECT_STATE_MIGRATED_IN_MEMORY'] : [] }
}
export function normalizeProjectRelativePath(value: unknown, assetsOnly = false): string {
  const code = 'ASSET_MANIFEST_PATH_OUTSIDE_PROJECT'
  required(nonempty(value), code, 'Ruta relativa vacía')
  const p = (value as string).replace(/\\/g, '/')
  required(!p.startsWith('/') && !/[:?#\x00-\x1f]/.test(p), code, 'Ruta absoluta, URL o carácter no permitido')
  const parts = p.split('/')
  required(parts.every(s => s !== '' && s !== '.' && s !== '..' &&
    !/[. ]$/.test(s) && !/[<>"|*]/.test(s) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)), code, 'Ruta no canónica')
  if (assetsOnly) required(parts.length >= 4 && parts[0] === 'materiales' && parts[1] === 'assets',
    code, 'Asset fuera de materiales/assets/<provider>/')
  return parts.join('/')
}
export type ProjectAssetRecord = {
  id: string; provider: string; relativeFile: string; sha256: string; mime: string; byteLength: number
  source: { sourceUrl?: string; fileUrl?: string; providerVersion?: string; licenseClaim?: string;
    licenseUrl?: string; attribution?: string; fetchedAt?: string }
  validation: { status: 'accepted' | 'needs-review' | 'rejected'; validatedAt?: string;
    width?: number; height?: number; hasAlpha?: boolean; alphaUseful?: boolean;
    validationRevision: string; warnings: string[] }
}
export type AssetManifestV1 = { assetManifestVersion: typeof ASSET_MANIFEST_VERSION; assets: ProjectAssetRecord[] }
export function emptyAssetManifest(): AssetManifestV1 { return { assetManifestVersion: ASSET_MANIFEST_VERSION, assets: [] } }
export function validateAssetManifest(raw: unknown): AssetManifestV1 {
  const code = 'ASSET_MANIFEST_INVALID'
  record(raw, code)
  version(raw, 'assetManifestVersion', ASSET_MANIFEST_VERSION, 'ASSET_MANIFEST')
  exactKeys(raw, ['assetManifestVersion','assets'], code)
  required(Array.isArray(raw.assets), code, 'assets debe ser array')
  const ids = new Set<string>(), paths = new Set<string>(), contents = new Set<string>()
  const assets = raw.assets.map((a: unknown) => {
    record(a, code)
    exactKeys(a, ['id','provider','relativeFile','sha256','mime','byteLength','source','validation'], code)
    for (const k of ['id','provider','mime']) required(nonempty(a[k]), code, k + ' vacío')
    required(/^[a-z0-9][a-z0-9_-]*$/.test(a.provider), code, 'provider debe ser ID')
    const relativeFile = normalizeProjectRelativePath(a.relativeFile, true)
    required(relativeFile.split('/')[2] === a.provider, code, 'Carpeta y provider difieren')
    required(typeof a.sha256 === 'string' && /^[a-f0-9]{64}$/.test(a.sha256), code, 'SHA-256 inválida')
    required(Number.isSafeInteger(a.byteLength) && a.byteLength >= 0, code, 'byteLength inválido')
    if (ids.has(a.id)) throw new PersistenceError('ASSET_MANIFEST_DUPLICATE_ID', 'ID duplicado', { id: a.id })
    if (paths.has(relativeFile.toLowerCase())) throw new PersistenceError('ASSET_MANIFEST_DUPLICATE_PATH', 'Ruta duplicada', { relativeFile })
    ids.add(a.id); paths.add(relativeFile.toLowerCase())
    record(a.source, code)
    exactKeys(a.source, ['sourceUrl','fileUrl','providerVersion','licenseClaim','licenseUrl','attribution','fetchedAt'], code)
    for (const [key, val] of Object.entries(a.source)) {
      required(nonempty(val), code, 'source.' + key + ' inválido')
      if (key.endsWith('Url')) {
        let valid = false
        try { const u = new URL(val as string); valid = u.protocol === 'https:' && !u.username && !u.password } catch { /* invalid */ }
        required(valid, code, 'URL de procedencia debe ser HTTPS sin credenciales')
      }
    }
    record(a.validation, code)
    exactKeys(a.validation, ['status','validatedAt','width','height','hasAlpha','alphaUseful','validationRevision','warnings'], code)
    required(['accepted','needs-review','rejected'].includes(a.validation.status), code, 'validation.status inválido')
    required(nonempty(a.validation.validationRevision), code, 'validationRevision vacío')
    required(Array.isArray(a.validation.warnings) && a.validation.warnings.every((w: unknown) => typeof w === 'string'), code, 'warnings inválidos')
    for (const k of ['width','height']) if (k in a.validation) required(Number.isSafeInteger(a.validation[k]) && a.validation[k] > 0, code, k + ' inválido')
    for (const k of ['hasAlpha','alphaUseful']) if (k in a.validation) required(typeof a.validation[k] === 'boolean', code, k + ' inválido')
    for (const [date, name] of [[a.source.fetchedAt,'fetchedAt'],[a.validation.validatedAt,'validatedAt']])
      if (date !== undefined) required(typeof date === 'string' && !Number.isNaN(Date.parse(date)), code, name + ' inválido')
    required(a.validation.alphaUseful !== true || a.validation.hasAlpha === true, code, 'alphaUseful requiere hasAlpha')
    // Two active records for the same bytes/type/provider are not independent assets.
    const key = a.sha256 + '|' + a.mime + '|' + a.provider
    if (a.validation.status !== 'rejected') {
      required(!contents.has(key), 'ASSET_MANIFEST_DUPLICATE_CONTENT', 'SHA+MIME+provider activos duplicados'); contents.add(key)
    }
    return { ...a, relativeFile } as ProjectAssetRecord
  })
  return { assetManifestVersion: ASSET_MANIFEST_VERSION, assets }
}
