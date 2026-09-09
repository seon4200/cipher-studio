import { createHash, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { DOMParser } from '@xmldom/xmldom'
import {
  emptyAssetManifest,
  type AssetManifestV1,
  type ProjectAssetRecord,
} from '../../../shared/project-state'
import {
  loadProjectFile,
  readAssetStorage,
  resolveProjectRelativePath,
  saveAssetManifest,
} from '../../services/project-persistence'
import { getOpenMojiCatalogInfo } from './attribution'
import { getOpenMojiEntry, resolveOpenMojiSvgCatalogPath } from './catalog'

export const OPENMOJI_SVG_VALIDATION_REVISION = 'openmoji-svg-v1' as const
export const OPENMOJI_SVG_MIME = 'image/svg+xml' as const
// This is a per-file policy: publication never scans the catalog. The selected
// 1F382 SVG is far below it; larger files need an explicit policy revision.
export const MAX_OPENMOJI_SVG_BYTES = 512 * 1024

export class OpenMojiAssetError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'OpenMojiAssetError'
  }
}

export type ValidatedOpenMojiSvg = {
  sha256: string
  byteLength: number
  viewBox: string
  validationRevision: typeof OPENMOJI_SVG_VALIDATION_REVISION
}

export type VerifiedProjectAssetContent = ValidatedOpenMojiSvg & {
  absoluteFile: string
  /** Exact bytes that passed size, SHA, MIME and SVG-policy validation. */
  bytes: Buffer
}

export type PublishOpenMojiAssetInput = {
  projectRoot: string
  stableId: string
}

export type PublishOpenMojiAssetResult = {
  status: 'created' | 'reused'
  asset: ProjectAssetRecord
  manifestPath: string
  absoluteFile: string
  warnings: string[]
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new OpenMojiAssetError(code, message, details)
}

function errorCode(error: unknown): string | undefined {
  return !!error && typeof error === 'object' && 'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined
}

function exists(target: string): boolean {
  try {
    fs.lstatSync(target)
    return true
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return false
    throw error
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function samePath(left: string, right: string): boolean {
  const a = path.resolve(left)
  const b = path.resolve(right)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function regularFile(target: string, missingCode: string): fs.Stats {
  let stat: fs.Stats
  try {
    stat = fs.lstatSync(target)
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') fail(missingCode, 'Archivo no encontrado', { target })
    fail(missingCode, 'No se pudo inspeccionar el archivo', { target, causeCode: errorCode(error) })
  }
  if (stat.isSymbolicLink() || !stat.isFile())
    fail(missingCode, 'Se requiere un archivo regular', { target })
  return stat
}

export function requireAssetProjectRoot(value: unknown): string {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim()))
    fail('ASSET_PROJECT_ROOT_REQUIRED', 'projectRoot es obligatorio')
  if (typeof value !== 'string' || !path.isAbsolute(value))
    fail('ASSET_PROJECT_ROOT_INVALID', 'projectRoot debe ser una ruta absoluta')

  const root = path.resolve(value)
  if (samePath(root, process.cwd()))
    fail('ASSET_PROJECT_ROOT_IS_REPOSITORY', 'projectRoot no puede ser process.cwd()')

  let rootStat: fs.Stats
  try {
    rootStat = fs.lstatSync(root)
  } catch (error: unknown) {
    fail('ASSET_PROJECT_ROOT_INVALID', 'projectRoot no existe', { causeCode: errorCode(error) })
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
    fail('ASSET_PROJECT_ROOT_INVALID', 'projectRoot debe ser un directorio real, no un enlace')

  let realRoot: string
  try {
    realRoot = fs.realpathSync(root)
  } catch (error: unknown) {
    fail('ASSET_PROJECT_ROOT_INVALID', 'projectRoot no tiene una ruta real válida', { causeCode: errorCode(error) })
  }
  if (!samePath(root, realRoot))
    fail('ASSET_PROJECT_ROOT_INVALID', 'projectRoot no puede ser un alias, symlink o junction')
  if (exists(path.join(root, '.git')) ||
      (exists(path.join(root, 'package.json')) && exists(path.join(root, 'src'))))
    fail('ASSET_PROJECT_ROOT_IS_REPOSITORY', 'projectRoot parece ser un repositorio, no un proyecto Cipher')

  const stateFile = path.join(root, 'project-state.json')
  if (!exists(stateFile))
    fail('ASSET_PROJECT_STATE_INVALID', 'projectRoot no contiene project-state.json')
  try {
    regularFile(stateFile, 'ASSET_PROJECT_STATE_INVALID')
    // The real persistence reader validates schema/migration and is read-only.
    loadProjectFile(stateFile)
  } catch (error: unknown) {
    if (error instanceof OpenMojiAssetError) throw error
    fail('ASSET_PROJECT_STATE_INVALID', 'project-state.json no es utilizable', { causeCode: errorCode(error) })
  }
  return root
}

function decodeUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error: unknown) {
    fail('OPENMOJI_SVG_INVALID', 'SVG no está codificado como UTF-8 válido', { causeCode: errorCode(error) })
  }
}

function requireFragmentOnly(value: string, field: string): void {
  const reference = value.trim()
  if (reference && !reference.startsWith('#'))
    fail('OPENMOJI_SVG_EXTERNAL_RESOURCE', 'SVG contiene una referencia externa', { field, reference })
}

function inspectCssUrls(value: string, field: string): void {
  const urls = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi
  for (let match = urls.exec(value); match; match = urls.exec(value))
    requireFragmentOnly(match[1] ?? match[2] ?? match[3] ?? '', field)
}

function elementName(element: any): string {
  return String(element.localName || element.tagName || '').toLowerCase()
}

function inspectSvgElement(element: any): void {
  const name = elementName(element)
  if (['script', 'iframe', 'object', 'embed'].includes(name))
    fail('OPENMOJI_SVG_FORBIDDEN_ELEMENT', 'SVG contiene un elemento no permitido', { name })
  if (name === 'foreignobject')
    fail('OPENMOJI_SVG_FOREIGN_OBJECT', 'SVG contiene foreignObject')
  for (let index = 0; index < element.attributes.length; index++) {
    const attribute = element.attributes.item(index)
    if (!attribute) continue
    const name = String(attribute.localName || attribute.name || '').toLowerCase()
    if (/^on[a-z0-9_-]+$/.test(name))
      fail('OPENMOJI_SVG_EVENT_HANDLER', 'SVG contiene un event handler', { attribute: attribute.name })
    if (name === 'href' || name === 'src' || name.endsWith(':href'))
      requireFragmentOnly(attribute.value, attribute.name)
    inspectCssUrls(attribute.value, attribute.name)
  }
  if (name === 'style') inspectCssUrls(element.textContent || '', 'style')
  // xmldom exposes firstChild/nextSibling reliably for XML; firstElementChild is
  // not available in every supported runtime, so do not skip nested references.
  for (let child = element.firstChild; child; child = child.nextSibling)
    if (child.nodeType === 1) inspectSvgElement(child)
}

export function validateOpenMojiSvgBytes(bytes: Buffer): ValidatedOpenMojiSvg {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    fail('OPENMOJI_SVG_INVALID', 'SVG vacío')
  if (bytes.length > MAX_OPENMOJI_SVG_BYTES)
    fail('OPENMOJI_SVG_TOO_LARGE', 'SVG supera el límite de tamaño', { maxBytes: MAX_OPENMOJI_SVG_BYTES, byteLength: bytes.length })
  if (bytes.includes(0)) fail('OPENMOJI_SVG_INVALID', 'SVG contiene bytes nulos')

  const text = decodeUtf8(bytes)
  if (/<!doctype\b/i.test(text)) fail('OPENMOJI_SVG_DOCTYPE_FORBIDDEN', 'SVG contiene DOCTYPE')
  if (/<!entity\b/i.test(text)) fail('OPENMOJI_SVG_ENTITY_FORBIDDEN', 'SVG contiene ENTITY')
  if (/<\s*script\b/i.test(text)) fail('OPENMOJI_SVG_FORBIDDEN_ELEMENT', 'SVG contiene script')
  if (/<\s*foreignobject\b/i.test(text)) fail('OPENMOJI_SVG_FOREIGN_OBJECT', 'SVG contiene foreignObject')
  if (/<\s*(?:iframe|object|embed)\b/i.test(text))
    fail('OPENMOJI_SVG_FORBIDDEN_ELEMENT', 'SVG contiene un elemento externo')
  if (/@import\b/i.test(text)) fail('OPENMOJI_SVG_EXTERNAL_RESOURCE', 'SVG contiene @import')
  const start = text.replace(/^\uFEFF/, '').trimStart()
  if (!/^(?:<\?xml\b[\s\S]*?\?>\s*)?<svg(?:\s|>)/i.test(start))
    fail('OPENMOJI_SVG_INVALID', 'SVG no comienza con XML/SVG válido')

  let document: any
  try {
    document = new DOMParser({
      locator: false,
      onError: (_level, message) => { throw new Error(message) },
    }).parseFromString(text, OPENMOJI_SVG_MIME)
  } catch (error: unknown) {
    fail('OPENMOJI_SVG_INVALID', 'SVG XML inválido', { cause: error instanceof Error ? error.message : String(error) })
  }
  const root = document.documentElement
  if (!root || elementName(root) !== 'svg')
    fail('OPENMOJI_SVG_INVALID', 'El elemento raíz del SVG debe ser svg')
  const viewBox = root.getAttribute('viewBox')
  const values: number[] = viewBox === null ? [] : viewBox.trim().split(/[\s,]+/).map(Number)
  if (values.length !== 4 || values.some(value => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0)
    fail('OPENMOJI_SVG_VIEWBOX_INVALID', 'SVG requiere un viewBox finito y positivo')
  inspectSvgElement(root)
  return {
    sha256: sha256(bytes),
    byteLength: bytes.length,
    viewBox: viewBox!,
    validationRevision: OPENMOJI_SVG_VALIDATION_REVISION,
  }
}

function resolveAssetFile(projectRoot: string, relativeFile: unknown): string {
  try {
    if (typeof relativeFile !== 'string') throw new Error('relativeFile no es string')
    return resolveProjectRelativePath(projectRoot, relativeFile, true)
  } catch (error: unknown) {
    fail('PROJECT_ASSET_OUTSIDE_PROJECT', 'La referencia de asset sale del proyecto', { causeCode: errorCode(error) })
  }
}

export function readVerifiedProjectAssetContent(
  projectRoot: string,
  asset: ProjectAssetRecord,
): VerifiedProjectAssetContent {
  const root = requireAssetProjectRoot(projectRoot)
  if (!asset || typeof asset !== 'object') fail('PROJECT_ASSET_MISSING', 'Registro de asset inválido')
  if (asset.mime !== OPENMOJI_SVG_MIME)
    fail('PROJECT_ASSET_MIME_MISMATCH', 'El MIME del asset no coincide con OpenMoji SVG')
  const file = resolveAssetFile(root, asset.relativeFile)
  if (path.extname(file).toLowerCase() !== '.svg')
    fail('PROJECT_ASSET_MIME_MISMATCH', 'La extensión del asset no coincide con OpenMoji SVG')
  const stat = regularFile(file, 'PROJECT_ASSET_MISSING')
  if (stat.size !== asset.byteLength)
    fail('PROJECT_ASSET_SIZE_MISMATCH', 'El tamaño del asset no coincide con el manifest', { expected: asset.byteLength, actual: stat.size })
  let bytes: Buffer
  try {
    bytes = fs.readFileSync(file)
  } catch (error: unknown) {
    fail('PROJECT_ASSET_MISSING', 'No se pudo leer el asset', { causeCode: errorCode(error) })
  }
  const actualSha = sha256(bytes)
  if (actualSha !== asset.sha256)
    fail('PROJECT_ASSET_SHA_MISMATCH', 'La SHA-256 del asset no coincide con el manifest', { expected: asset.sha256, actual: actualSha })
  if (asset.provider !== 'openmoji' || asset.validation.validationRevision !== OPENMOJI_SVG_VALIDATION_REVISION)
    fail('PROJECT_ASSET_SVG_INVALID', 'El asset no cumple la política OpenMoji SVG V1')
  return { ...validateOpenMojiSvgBytes(bytes), absoluteFile: file, bytes }
}

export function verifyProjectAssetContent(projectRoot: string, asset: ProjectAssetRecord): ValidatedOpenMojiSvg {
  const { absoluteFile: _absoluteFile, bytes: _bytes, ...validated } =
    readVerifiedProjectAssetContent(projectRoot, asset)
  return validated
}

type PublishFileResult = { created: boolean, absoluteFile: string }

function verifyExactFile(target: string, expected: ValidatedOpenMojiSvg): void {
  const stat = regularFile(target, 'PROJECT_ASSET_DESTINATION_CONFLICT')
  if (stat.size !== expected.byteLength)
    fail('PROJECT_ASSET_DESTINATION_CONFLICT', 'El destino existente tiene tamaño distinto', { target })
  const bytes = fs.readFileSync(target)
  if (sha256(bytes) !== expected.sha256)
    fail('PROJECT_ASSET_DESTINATION_CONFLICT', 'El destino existente tiene bytes distintos', { target })
}

function publishExactBytes(projectRoot: string, relativeFile: string, target: string, bytes: Buffer,
  expected: ValidatedOpenMojiSvg): PublishFileResult {
  if (exists(target)) {
    verifyExactFile(target, expected)
    return { created: false, absoluteFile: target }
  }
  const parent = path.dirname(target)
  fs.mkdirSync(parent, { recursive: true })
  const confinedTarget = resolveAssetFile(projectRoot, relativeFile)
  if (!samePath(confinedTarget, target))
    fail('PROJECT_ASSET_PUBLISH_FAILED', 'El destino OpenMoji dejó de estar confinado')
  let temporary: string | undefined
  try {
    temporary = path.join(parent, '.' + path.basename(target) + '.cipher-' + randomUUID() + '.tmp')
    const descriptor = fs.openSync(temporary, 'wx')
    try {
      fs.writeFileSync(descriptor, bytes)
      fs.fsyncSync(descriptor)
    } finally {
      fs.closeSync(descriptor)
    }
    verifyExactFile(temporary, expected)
    try {
      fs.renameSync(temporary, target)
      temporary = undefined
      return { created: true, absoluteFile: target }
    } catch (error: unknown) {
      if (exists(target)) {
        verifyExactFile(target, expected)
        return { created: false, absoluteFile: target }
      }
      fail('PROJECT_ASSET_PUBLISH_FAILED', 'No se pudo publicar el SVG OpenMoji', { causeCode: errorCode(error) })
    }
  } finally {
    if (temporary) {
      try { fs.unlinkSync(temporary) } catch { /* only our exact temporary is eligible */ }
    }
  }
  return fail('PROJECT_ASSET_PUBLISH_FAILED', 'La publicación OpenMoji terminó sin resultado')
}

function rollbackCreatedFile(target: string, expected: ValidatedOpenMojiSvg): 'removed' | 'retained-mismatch' | 'not-found' | 'failed' {
  try {
    if (!exists(target)) return 'not-found'
    verifyExactFile(target, expected)
    fs.unlinkSync(target)
    return 'removed'
  } catch (error: unknown) {
    if (error instanceof OpenMojiAssetError && error.code === 'PROJECT_ASSET_DESTINATION_CONFLICT') return 'retained-mismatch'
    return 'failed'
  }
}

function readableManifest(projectRoot: string): AssetManifestV1 {
  const storage = readAssetStorage(projectRoot)
  if (storage.status === 'absent') return emptyAssetManifest()
  if ((storage.status === 'valid' || storage.status === 'recovered-from-backup') && 'manifest' in storage) {
    if (storage.audit.status !== 'valid')
      fail('OPENMOJI_ASSET_MANIFEST_INVALID', 'El manifest existente no supera la auditoría física', { errors: storage.audit.errors })
    return storage.manifest
  }
  fail('OPENMOJI_ASSET_MANIFEST_INVALID', 'El manifest existente no es utilizable', { warnings: storage.warnings })
}

function canonicalStableId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) fail('OPENMOJI_ASSET_STABLE_ID_INVALID', 'stableId es obligatorio')
  const stableId = value.trim().toLowerCase()
  if (!/^openmoji:[0-9a-f-]+$/.test(stableId))
    fail('OPENMOJI_ASSET_STABLE_ID_INVALID', 'stableId OpenMoji no es canónico')
  return stableId
}

function recordFor(entry: { hexcode: string }, validated: ValidatedOpenMojiSvg): ProjectAssetRecord {
  const info = getOpenMojiCatalogInfo()
  const id = 'openmoji-' + entry.hexcode.toLowerCase() + '-' + validated.sha256.slice(0, 12)
  return {
    id,
    provider: 'openmoji',
    relativeFile: 'materiales/assets/openmoji/' + validated.sha256 + '.svg',
    sha256: validated.sha256,
    mime: OPENMOJI_SVG_MIME,
    byteLength: validated.byteLength,
    source: {
      sourceUrl: info.sourceRepository,
      // The source bytes came from Cipher's local pinned catalog. This records
      // the package archive as provenance; no network request occurs here.
      fileUrl: 'https://registry.npmjs.org/openmoji/-/openmoji-' + info.catalogVersion + '.tgz',
      providerVersion: info.catalogVersion,
      licenseClaim: info.license,
      licenseUrl: info.attributionPage,
      attribution: info.attributionText,
      fetchedAt: new Date().toISOString(),
    },
    validation: {
      status: 'accepted',
      validatedAt: new Date().toISOString(),
      validationRevision: OPENMOJI_SVG_VALIDATION_REVISION,
      warnings: [],
    },
  }
}

export function publishOpenMojiAsset(input: PublishOpenMojiAssetInput): PublishOpenMojiAssetResult {
  if (!input || typeof input !== 'object') fail('OPENMOJI_ASSET_INPUT_INVALID', 'Entrada de publicación inválida')
  const projectRoot = requireAssetProjectRoot(input.projectRoot)
  const stableId = canonicalStableId(input.stableId)
  const entry = getOpenMojiEntry(stableId)
  if (!entry) fail('OPENMOJI_ASSET_NOT_FOUND', 'stableId OpenMoji no existe en el catálogo local', { stableId })

  const sourceFile = resolveOpenMojiSvgCatalogPath(entry)
  const sourceBytes = fs.readFileSync(sourceFile)
  const validated = validateOpenMojiSvgBytes(sourceBytes)
  const asset = recordFor(entry, validated)
  const manifestPath = resolveProjectRelativePath(projectRoot, 'materiales/assets/manifest.json')
  const manifest = readableManifest(projectRoot)
  const sameId = manifest.assets.find(candidate => candidate.id === asset.id)
  if (sameId && (sameId.sha256 !== asset.sha256 || sameId.relativeFile !== asset.relativeFile || sameId.provider !== asset.provider))
    fail('OPENMOJI_ASSET_ID_CONFLICT', 'El manifest ya usa el ID OpenMoji para otro contenido', { id: asset.id })
  const sameContent = manifest.assets.find(candidate => candidate.provider === asset.provider &&
    candidate.mime === asset.mime && candidate.sha256 === asset.sha256 && candidate.validation.status !== 'rejected')
  if (sameContent) {
    verifyProjectAssetContent(projectRoot, sameContent)
    return {
      status: 'reused', asset: sameContent, manifestPath,
      absoluteFile: resolveAssetFile(projectRoot, sameContent.relativeFile), warnings: [],
    }
  }

  const absoluteFile = resolveAssetFile(projectRoot, asset.relativeFile)
  const publish = publishExactBytes(projectRoot, asset.relativeFile, absoluteFile, sourceBytes, validated)
  try {
    saveAssetManifest(projectRoot, { ...manifest, assets: [...manifest.assets, asset] })
  } catch (error: unknown) {
    const rollback = publish.created ? rollbackCreatedFile(absoluteFile, validated) : 'not-needed'
    fail('OPENMOJI_ASSET_MANIFEST_WRITE_FAILED', 'No se pudo registrar el SVG OpenMoji en el manifest', {
      causeCode: errorCode(error), rollback,
    })
  }

  const reopened = readAssetStorage(projectRoot)
  if (!((reopened.status === 'valid' || reopened.status === 'recovered-from-backup') && 'manifest' in reopened))
    fail('OPENMOJI_ASSET_MANIFEST_INVALID', 'El manifest no se pudo reabrir después de publicar')
  const persisted = reopened.manifest.assets.find(candidate => candidate.id === asset.id)
  if (!persisted) fail('OPENMOJI_ASSET_MANIFEST_INVALID', 'El registro OpenMoji no aparece al reabrir el manifest')
  verifyProjectAssetContent(projectRoot, persisted)
  return {
    status: publish.created ? 'created' : 'reused',
    asset: persisted,
    manifestPath,
    absoluteFile,
    warnings: publish.created ? [] : ['OPENMOJI_ASSET_FILE_REUSED'],
  }
}
