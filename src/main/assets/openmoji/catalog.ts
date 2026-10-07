import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import aliasDocument from './openmoji-aliases.es.json'
import { getOpenMojiCatalogInfo, OPENMOJI_CATALOG_VERSION, type OpenMojiCatalogInfo } from './attribution'

export { getOpenMojiCatalogInfo, OPENMOJI_CATALOG_VERSION }
export type { OpenMojiCatalogInfo }

const RESOURCE_SCHEMA_VERSION = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const MAX_QUERY_LENGTH = 256

export type OpenMojiCatalogEntry = {
  stableId: string
  hexcode: string
  emoji?: string
  annotation: string
  normalizedAnnotation: string
  group?: string
  subgroup?: string
  tags: readonly string[]
  aliases: readonly string[]
  svgRelativeFile: string
}

export type OpenMojiSearchOptions = {
  group?: string
  subgroup?: string
  limit?: number
}

export type OpenMojiSearchResult = {
  entry: OpenMojiCatalogEntry
  score: number
  matchReason: 'emoji-exact' | 'hexcode-exact' | 'annotation-exact' | 'alias-exact' | 'all-tokens' | 'token-prefix'
}

export type OpenMojiCatalogWarning = {
  code: 'OPENMOJI_SVG_DECLARED_MISSING'
  hexcode: string
}

export type OpenMojiCatalog = {
  entries: readonly OpenMojiCatalogEntry[]
  warnings: readonly OpenMojiCatalogWarning[]
}

export type OpenMojiAliasDefinition = {
  alias: string
  language: string
  stableIds: readonly string[]
  comment?: string
}

export type OpenMojiCatalogLoadOptions = {
  // Injection is deliberately explicit. Production uses the deterministic runtime
  // resolver; tests can supply a fixture without consulting the user's node_modules.
  resourceRoot?: string
  aliases?: readonly OpenMojiAliasDefinition[]
}

export type OpenMojiRuntimePaths = {
  packaged?: boolean
  resourcesPath?: string
  compiledMainDir?: string
}

export class OpenMojiCatalogError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'OpenMojiCatalogError'
  }
}

type ResourceManifest = {
  resourceSchemaVersion: number
  provider: string
  sourceKind: string
  sourcePackage: string
  catalogVersion: string
  metadataRelativeFile: string
  svgRootRelative: string
  licenseRelativeFile: string
  entryCount: number
  svgCount: number
  knownMissingSvgHexcodes: string[]
  metadataSha256: string
  fileListSha256: string
  generatorRevision: string
  resourceFingerprint: string
}

type OfficialEntry = {
  emoji?: unknown
  hexcode?: unknown
  group?: unknown
  subgroups?: unknown
  annotation?: unknown
  tags?: unknown
  openmoji_tags?: unknown
}

type LoadedCatalog = {
  catalog: OpenMojiCatalog
  byStableId: Map<string, OpenMojiCatalogEntry>
  byHexcode: Map<string, OpenMojiCatalogEntry>
  resourceRoot: string
  catalogVersion: string
  generatorRevision: string
}

const cachedCatalogs = new Map<string, LoadedCatalog>()
let cachedDefaultCatalog: LoadedCatalog | undefined

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new OpenMojiCatalogError(code, message, details)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function requireString(value: unknown, code: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(code, 'Campo OpenMoji inválido: ' + field)
  return value
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHexcode(value: string): string | undefined {
  const normalized = value.trim().toUpperCase().replace(/[\s_-]+/g, '-')
  return /^(?:[0-9A-F]{2,8})(?:-[0-9A-F]{2,8})*$/.test(normalized) ? normalized : undefined
}

function stableIdForHexcode(hexcode: string): string {
  return 'openmoji:' + hexcode.toLowerCase()
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function resourceFingerprint(manifest: Pick<ResourceManifest, 'catalogVersion' | 'metadataSha256' | 'fileListSha256' | 'generatorRevision'>): string {
  return sha256([
    'openmoji',
    manifest.catalogVersion,
    manifest.metadataSha256,
    manifest.fileListSha256,
    manifest.generatorRevision,
  ].join('\n'))
}

function tagsFromOfficial(entry: OfficialEntry): string[] {
  const values = [entry.tags, entry.openmoji_tags].filter((value): value is string => typeof value === 'string')
  return [...new Set(values.flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean))].sort((a, b) =>
    normalizeText(a).localeCompare(normalizeText(b), 'en'))
}

function checkedAliases(rawAliases: readonly OpenMojiAliasDefinition[]): OpenMojiAliasDefinition[] {
  const names = new Set<string>()
  return rawAliases.map((entry, index) => {
    if (!isRecord(entry)) fail('OPENMOJI_ALIAS_INVALID', 'Alias no es objeto', { index })
    const alias = requireString(entry.alias, 'OPENMOJI_ALIAS_INVALID', 'alias')
    const language = requireString(entry.language, 'OPENMOJI_ALIAS_INVALID', 'language')
    if (!Array.isArray(entry.stableIds) || entry.stableIds.length === 0 || !entry.stableIds.every(value => typeof value === 'string'))
      fail('OPENMOJI_ALIAS_INVALID', 'Alias sin stableIds válidos', { alias })
    const normalized = normalizeText(alias)
    if (!normalized || names.has(normalized)) fail('OPENMOJI_ALIAS_INVALID', 'Alias duplicado o vacío', { alias })
    names.add(normalized)
    const stableIds = [...new Set(entry.stableIds.map(value => value.trim()))]
    if (stableIds.some(value => !/^openmoji:[0-9a-f-]+$/.test(value)))
      fail('OPENMOJI_ALIAS_INVALID', 'stableId de alias inválido', { alias })
    const comment = entry.comment === undefined ? undefined : requireString(entry.comment, 'OPENMOJI_ALIAS_INVALID', 'comment')
    return Object.freeze({ alias, language, stableIds: Object.freeze(stableIds), ...(comment ? { comment } : {}) })
  })
}

function parseAliasDocument(raw: unknown): OpenMojiAliasDefinition[] {
  if (!isRecord(raw) || raw.aliasRevision !== 1 || !Array.isArray(raw.entries))
    fail('OPENMOJI_ALIAS_INVALID', 'Documento de aliases OpenMoji inválido')
  return checkedAliases(raw.entries as OpenMojiAliasDefinition[])
}

const DEFAULT_ALIASES = Object.freeze(parseAliasDocument(aliasDocument))

function aliasesFor(options: OpenMojiCatalogLoadOptions): readonly OpenMojiAliasDefinition[] {
  return options.aliases === undefined ? DEFAULT_ALIASES : Object.freeze(checkedAliases(options.aliases))
}

function aliasesCacheKey(aliases: readonly OpenMojiAliasDefinition[]): string {
  return aliases.map(alias => [
    normalizeText(alias.alias),
    alias.language,
    [...alias.stableIds].join(','),
    alias.comment || '',
  ].join('|')).join('\n')
}

function isDefaultLoad(options: OpenMojiCatalogLoadOptions): boolean {
  return options.resourceRoot === undefined && options.aliases === undefined
}

export function clearOpenMojiCatalogCacheForTests(): void {
  cachedDefaultCatalog = undefined
  cachedCatalogs.clear()
}

export function resolveOpenMojiCatalogResourceRoot(runtime: OpenMojiRuntimePaths = {}): string {
  if (runtime.packaged === true) {
    if (!runtime.resourcesPath || !path.isAbsolute(runtime.resourcesPath))
      fail('OPENMOJI_CATALOG_NOT_FOUND', 'resourcesPath empaquetado no disponible')
    return path.join(runtime.resourcesPath, 'openmoji')
  }
  if (runtime.packaged === false || (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp === true) {
    const compiledMainDir = runtime.compiledMainDir || __dirname
    if (!path.isAbsolute(compiledMainDir)) fail('OPENMOJI_CATALOG_NOT_FOUND', 'Directorio main no absoluto')
    return path.resolve(compiledMainDir, '..', 'openmoji')
  }
  if (process.resourcesPath && path.isAbsolute(process.resourcesPath))
    return path.join(process.resourcesPath, 'openmoji')
  return path.resolve(__dirname, '..', 'openmoji')
}

function requiredResourceRoot(root: string): string {
  if (!path.isAbsolute(root)) fail('OPENMOJI_PATH_OUTSIDE_CATALOG', 'La raíz OpenMoji debe ser absoluta')
  try {
    const stat = fs.statSync(root)
    if (!stat.isDirectory()) fail('OPENMOJI_CATALOG_NOT_FOUND', 'La raíz OpenMoji no es un directorio')
    return fs.realpathSync(root)
  } catch (error: any) {
    if (error instanceof OpenMojiCatalogError) throw error
    fail('OPENMOJI_CATALOG_NOT_FOUND', 'No se encuentra la raíz OpenMoji', { causeCode: error?.code })
  }
}

function confinedCandidate(root: string, relative: string): string {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..'))
    fail('OPENMOJI_PATH_OUTSIDE_CATALOG', 'Ruta OpenMoji no confinada', { relative })
  const candidate = path.resolve(root, relative)
  const relation = path.relative(root, candidate)
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation))
    fail('OPENMOJI_PATH_OUTSIDE_CATALOG', 'Ruta OpenMoji fuera de la raíz', { relative })
  return candidate
}

function confinedExistingFile(root: string, relative: string, missingCode: string): string {
  const candidate = confinedCandidate(root, relative)
  try {
    const real = fs.realpathSync(candidate)
    const realRelation = path.relative(root, real)
    if (!realRelation || realRelation.startsWith('..') || path.isAbsolute(realRelation))
      fail('OPENMOJI_PATH_OUTSIDE_CATALOG', 'Ruta OpenMoji real fuera de la raíz', { relative })
    return real
  } catch (error: any) {
    if (error instanceof OpenMojiCatalogError) throw error
    fail(missingCode, 'No se encuentra recurso OpenMoji', { relative, causeCode: error?.code })
  }
}

function readJson(root: string, relative: string, code: string): { bytes: Buffer, value: unknown } {
  const file = confinedExistingFile(root, relative, 'OPENMOJI_CATALOG_NOT_FOUND')
  try {
    const bytes = fs.readFileSync(file)
    return { bytes, value: JSON.parse(bytes.toString('utf8')) }
  } catch (error: any) {
    if (error instanceof OpenMojiCatalogError) throw error
    fail(code, 'JSON OpenMoji inválido', { relative, causeCode: error?.code })
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

function parseResourceManifest(raw: unknown): ResourceManifest {
  if (!isRecord(raw)) fail('OPENMOJI_METADATA_INVALID', 'Manifest de recurso OpenMoji inválido')
  const manifest = raw as Record<string, unknown>
  const number = (field: string) => {
    if (!Number.isSafeInteger(manifest[field]) || (manifest[field] as number) < 0)
      fail('OPENMOJI_METADATA_INVALID', 'Número de manifest inválido: ' + field)
    return manifest[field] as number
  }
  const string = (field: string) => requireString(manifest[field], 'OPENMOJI_METADATA_INVALID', field)
  if (manifest.resourceSchemaVersion !== RESOURCE_SCHEMA_VERSION || string('provider') !== 'openmoji' ||
    string('sourceKind') !== 'official-npm' || string('sourcePackage') !== 'openmoji')
    fail('OPENMOJI_METADATA_INVALID', 'Manifest de recurso OpenMoji no reconocido')
  const catalogVersion = string('catalogVersion')
  if (catalogVersion !== OPENMOJI_CATALOG_VERSION)
    fail('OPENMOJI_VERSION_MISMATCH', 'Versión OpenMoji incompatible', { found: catalogVersion, expected: OPENMOJI_CATALOG_VERSION })
  const entryCount = number('entryCount')
  if (entryCount === 0)
    fail('OPENMOJI_METADATA_INVALID', 'Manifest OpenMoji sin entradas declaradas')
  if (!Array.isArray(manifest.knownMissingSvgHexcodes) || !manifest.knownMissingSvgHexcodes.every(value => typeof value === 'string'))
    fail('OPENMOJI_METADATA_INVALID', 'knownMissingSvgHexcodes inválido')
  const svgRootRelative = string('svgRootRelative')
  if (svgRootRelative !== 'color/svg')
    fail('OPENMOJI_METADATA_INVALID', '3.4B sólo admite color/svg como recurso OpenMoji')
  for (const field of ['metadataSha256', 'fileListSha256', 'resourceFingerprint']) {
    if (!isSha256(manifest[field])) fail('OPENMOJI_METADATA_INVALID', 'Fingerprint de manifest inválido: ' + field)
  }
  const resource: ResourceManifest = {
    resourceSchemaVersion: RESOURCE_SCHEMA_VERSION,
    provider: 'openmoji',
    sourceKind: 'official-npm',
    sourcePackage: 'openmoji',
    catalogVersion,
    metadataRelativeFile: string('metadataRelativeFile'),
    svgRootRelative,
    licenseRelativeFile: string('licenseRelativeFile'),
    entryCount,
    svgCount: number('svgCount'),
    knownMissingSvgHexcodes: manifest.knownMissingSvgHexcodes.map(value => normalizeHexcode(value) || fail('OPENMOJI_METADATA_INVALID', 'Hexcode faltante inválido')),
    metadataSha256: manifest.metadataSha256 as string,
    fileListSha256: manifest.fileListSha256 as string,
    generatorRevision: string('generatorRevision'),
    resourceFingerprint: manifest.resourceFingerprint as string,
  }
  if (resource.resourceFingerprint !== resourceFingerprint(resource))
    fail('OPENMOJI_METADATA_INVALID', 'Fingerprint de recurso OpenMoji inconsistente')
  return resource
}

function svgRelativeFile(hexcode: string): string {
  return 'color/svg/' + hexcode + '.svg'
}

function svgLooksLikeSvg(file: string): boolean {
  const descriptor = fs.openSync(file, 'r')
  try {
    const bytes = Buffer.alloc(512)
    const read = fs.readSync(descriptor, bytes, 0, bytes.length, 0)
    if (read === 0) return false
    const start = bytes.subarray(0, read).toString('utf8').replace(/^\uFEFF/, '')
    return /^\s*(?:<\?xml[^>]*\?>\s*)?<svg(?:\s|>)/i.test(start)
  } finally {
    fs.closeSync(descriptor)
  }
}

function transformOfficialMetadata(raw: unknown, aliases: readonly OpenMojiAliasDefinition[]): OpenMojiCatalogEntry[] {
  if (!Array.isArray(raw)) fail('OPENMOJI_METADATA_INVALID', 'data/openmoji.json debe ser un array')
  const seenIds = new Set<string>()
  const seenHexcodes = new Set<string>()
  const aliasesByStableId = new Map<string, string[]>()
  for (const alias of aliases) {
    for (const stableId of alias.stableIds) {
      const values = aliasesByStableId.get(stableId) || []
      values.push(alias.alias)
      aliasesByStableId.set(stableId, values)
    }
  }
  return raw.map((rawEntry, index) => {
    if (!isRecord(rawEntry)) fail('OPENMOJI_METADATA_INVALID', 'Entrada OpenMoji no es objeto', { index })
    const official = rawEntry as OfficialEntry
    const hexcode = normalizeHexcode(requireString(official.hexcode, 'OPENMOJI_METADATA_INVALID', 'hexcode'))
    if (!hexcode) fail('OPENMOJI_METADATA_INVALID', 'Hexcode OpenMoji inválido', { index })
    const stableId = stableIdForHexcode(hexcode)
    if (seenIds.has(stableId)) fail('OPENMOJI_DUPLICATE_ID', 'stableId OpenMoji duplicado', { stableId })
    if (seenHexcodes.has(hexcode)) fail('OPENMOJI_DUPLICATE_ID', 'Hexcode OpenMoji duplicado', { hexcode })
    seenIds.add(stableId)
    seenHexcodes.add(hexcode)
    const annotation = requireString(official.annotation, 'OPENMOJI_METADATA_INVALID', 'annotation')
    const group = requireString(official.group, 'OPENMOJI_METADATA_INVALID', 'group')
    const subgroup = requireString(official.subgroups, 'OPENMOJI_METADATA_INVALID', 'subgroups')
    const emoji = typeof official.emoji === 'string' && official.emoji ? official.emoji : undefined
    const tags = tagsFromOfficial(official)
    const entryAliases = aliasesByStableId.get(stableId) || []
    return Object.freeze({
      stableId,
      hexcode,
      ...(emoji ? { emoji } : {}),
      annotation,
      normalizedAnnotation: normalizeText(annotation),
      group,
      subgroup,
      tags: Object.freeze(tags),
      aliases: Object.freeze([...new Set(entryAliases)].sort((a, b) => normalizeText(a).localeCompare(normalizeText(b), 'es'))),
      svgRelativeFile: svgRelativeFile(hexcode),
    })
  })
}

// Exported to let the suite verify the real transformation without copying it.
export function transformOpenMojiMetadata(raw: unknown, aliases: readonly OpenMojiAliasDefinition[] = DEFAULT_ALIASES): readonly OpenMojiCatalogEntry[] {
  return Object.freeze(transformOfficialMetadata(raw, aliases))
}

function loadedCatalog(options: OpenMojiCatalogLoadOptions = {}): LoadedCatalog {
  if (isDefaultLoad(options) && cachedDefaultCatalog) return cachedDefaultCatalog
  const root = requiredResourceRoot(options.resourceRoot || resolveOpenMojiCatalogResourceRoot())
  const aliases = aliasesFor(options)
  const cacheKey = root + '\u0000' + aliasesCacheKey(aliases)
  const cached = cachedCatalogs.get(cacheKey)
  if (cached) {
    if (isDefaultLoad(options)) cachedDefaultCatalog = cached
    return cached
  }
  const resource = parseResourceManifest(readJson(root, 'catalog-resource.json', 'OPENMOJI_METADATA_INVALID').value)
  const license = confinedExistingFile(root, resource.licenseRelativeFile, 'OPENMOJI_CATALOG_NOT_FOUND')
  const licenseStat = fs.statSync(license)
  if (!licenseStat.isFile() || licenseStat.size === 0)
    fail('OPENMOJI_METADATA_INVALID', 'LICENSE.txt OpenMoji vacío')
  const metadataDocument = readJson(root, resource.metadataRelativeFile, 'OPENMOJI_METADATA_INVALID')
  if (sha256(metadataDocument.bytes) !== resource.metadataSha256)
    fail('OPENMOJI_METADATA_INVALID', 'SHA-256 de metadata OpenMoji no coincide')
  const rawMetadata = metadataDocument.value
  if (!Array.isArray(rawMetadata) || rawMetadata.length !== resource.entryCount)
    fail('OPENMOJI_METADATA_INVALID', 'Cantidad de entradas OpenMoji no coincide', { expected: resource.entryCount })
  const entries = transformOfficialMetadata(rawMetadata, aliases)
  const byStableId = new Map(entries.map(entry => [entry.stableId, entry]))
  for (const alias of aliases) for (const stableId of alias.stableIds) {
    if (!byStableId.has(stableId)) fail('OPENMOJI_ALIAS_INVALID', 'Alias apunta a stableId inexistente', { alias: alias.alias, stableId })
  }
  const declaredMissing = new Set(resource.knownMissingSvgHexcodes)
  if (declaredMissing.size !== resource.knownMissingSvgHexcodes.length ||
    [...declaredMissing].some(hexcode => !byStableId.has(stableIdForHexcode(hexcode))))
    fail('OPENMOJI_METADATA_INVALID', 'SVG faltante declarado no corresponde al metadata')
  if (resource.svgCount !== entries.length - declaredMissing.size)
    fail('OPENMOJI_METADATA_INVALID', 'Cantidad declarada de SVG color no coincide', { expected: entries.length - declaredMissing.size, found: resource.svgCount })
  // Validate every derived route without touching color/svg. File-system checks are
  // intentionally delayed until a caller selects one entry.
  for (const entry of entries) confinedCandidate(root, entry.svgRelativeFile)
  const warnings: OpenMojiCatalogWarning[] = [...declaredMissing]
    .map(hexcode => ({ code: 'OPENMOJI_SVG_DECLARED_MISSING' as const, hexcode }))
  const indexed = entries.filter(entry => !declaredMissing.has(entry.hexcode))
  const catalog: OpenMojiCatalog = Object.freeze({ entries: Object.freeze(indexed), warnings: Object.freeze(warnings) })
  const result: LoadedCatalog = {
    catalog,
    byStableId: new Map(indexed.map(entry => [entry.stableId, entry])),
    byHexcode: new Map(indexed.map(entry => [entry.hexcode, entry])),
    resourceRoot: root,
    catalogVersion: resource.catalogVersion,
    generatorRevision: resource.generatorRevision,
  }
  cachedCatalogs.set(cacheKey, result)
  if (isDefaultLoad(options)) cachedDefaultCatalog = result
  return result
}

export function loadOpenMojiCatalog(options: OpenMojiCatalogLoadOptions = {}): OpenMojiCatalog {
  return loadedCatalog(options).catalog
}

function normalizedOption(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !normalizeText(value) || value.length > MAX_QUERY_LENGTH)
    fail('OPENMOJI_QUERY_INVALID', 'Filtro OpenMoji inválido: ' + field)
  return normalizeText(value)
}

function checkedLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT)
    fail('OPENMOJI_QUERY_INVALID', 'limit OpenMoji debe estar entre 1 y ' + MAX_LIMIT)
  return limit
}

function searchableTokens(entry: OpenMojiCatalogEntry): string[] {
  return [...new Set([entry.annotation, ...entry.tags, ...entry.aliases].flatMap(value => normalizeText(value).split(' ').filter(Boolean)))]
}

function matchesOptions(entry: OpenMojiCatalogEntry, group: string | undefined, subgroup: string | undefined): boolean {
  return (!group || normalizeText(entry.group || '') === group) && (!subgroup || normalizeText(entry.subgroup || '') === subgroup)
}

function sortedResults(results: OpenMojiSearchResult[]): OpenMojiSearchResult[] {
  return results.sort((a, b) => b.score - a.score || a.entry.normalizedAnnotation.localeCompare(b.entry.normalizedAnnotation, 'en') ||
    a.entry.hexcode.localeCompare(b.entry.hexcode, 'en') || a.entry.stableId.localeCompare(b.entry.stableId, 'en'))
}

export function searchOpenMoji(query: string, options: OpenMojiSearchOptions = {}): readonly OpenMojiSearchResult[] {
  if (typeof query !== 'string' || query.length > MAX_QUERY_LENGTH || !normalizeText(query))
    fail('OPENMOJI_QUERY_INVALID', 'Consulta OpenMoji vacía o inválida')
  const normalized = normalizeText(query)
  const hexcode = normalizeHexcode(query)
  const group = normalizedOption(options.group, 'group')
  const subgroup = normalizedOption(options.subgroup, 'subgroup')
  const limit = checkedLimit(options.limit)
  const catalog = loadedCatalog()
  const candidates = catalog.catalog.entries.filter(entry => matchesOptions(entry, group, subgroup))
  const add = (entries: OpenMojiCatalogEntry[], score: number, matchReason: OpenMojiSearchResult['matchReason']) =>
    sortedResults(entries.map(entry => ({ entry, score, matchReason }))).slice(0, limit)
  const emojiMatches = candidates.filter(entry => entry.emoji === query.trim())
  if (emojiMatches.length) return add(emojiMatches, 600, 'emoji-exact')
  const hexMatches = hexcode ? candidates.filter(entry => entry.hexcode === hexcode) : []
  if (hexMatches.length) return add(hexMatches, 500, 'hexcode-exact')
  const annotationMatches = candidates.filter(entry => entry.normalizedAnnotation === normalized)
  if (annotationMatches.length) return add(annotationMatches, 400, 'annotation-exact')
  const aliasMatches = candidates.filter(entry => entry.aliases.some(alias => normalizeText(alias) === normalized))
  if (aliasMatches.length) return add(aliasMatches, 300, 'alias-exact')
  const queryTokens = normalized.split(' ')
  const tokenMatches = candidates.filter(entry => {
    const tokens = searchableTokens(entry)
    return queryTokens.every(token => tokens.includes(token))
  })
  if (tokenMatches.length) return add(tokenMatches, 200, 'all-tokens')
  const prefixMatches = candidates.filter(entry => {
    const tokens = searchableTokens(entry)
    return queryTokens.every(token => tokens.some(candidate => candidate.startsWith(token)))
  })
  return prefixMatches.length === 1 ? add(prefixMatches, 100, 'token-prefix') : []
}

export function getOpenMojiEntry(stableId: string): OpenMojiCatalogEntry | undefined {
  if (typeof stableId !== 'string' || !stableId.trim()) fail('OPENMOJI_QUERY_INVALID', 'stableId OpenMoji inválido')
  return loadedCatalog().byStableId.get(stableId)
}

export function getOpenMojiEntryByHexcode(hexcode: string): OpenMojiCatalogEntry | undefined {
  if (typeof hexcode !== 'string') fail('OPENMOJI_QUERY_INVALID', 'Hexcode OpenMoji inválido')
  const normalized = normalizeHexcode(hexcode)
  if (!normalized) fail('OPENMOJI_QUERY_INVALID', 'Hexcode OpenMoji inválido')
  return loadedCatalog().byHexcode.get(normalized)
}

export function listOpenMojiGroups(): readonly string[] {
  return Object.freeze([...new Set(loadedCatalog().catalog.entries.map(entry => entry.group).filter((value): value is string => !!value))]
    .sort((a, b) => normalizeText(a).localeCompare(normalizeText(b), 'en')))
}

export function listOpenMojiSubgroups(group?: string): readonly string[] {
  const normalizedGroup = normalizedOption(group, 'group')
  return Object.freeze([...new Set(loadedCatalog().catalog.entries
    .filter(entry => !normalizedGroup || normalizeText(entry.group || '') === normalizedGroup)
    .map(entry => entry.subgroup).filter((value): value is string => !!value))]
    .sort((a, b) => normalizeText(a).localeCompare(normalizeText(b), 'en')))
}

export function resolveOpenMojiSvgCatalogPath(entry: OpenMojiCatalogEntry, options: OpenMojiCatalogLoadOptions = {}): string {
  if (!entry || typeof entry !== 'object') fail('OPENMOJI_QUERY_INVALID', 'Entrada OpenMoji inválida')
  const hexcode = normalizeHexcode(entry.hexcode)
  const expected = hexcode ? svgRelativeFile(hexcode) : undefined
  if (!hexcode || entry.svgRelativeFile !== expected || entry.stableId !== stableIdForHexcode(hexcode))
    fail('OPENMOJI_PATH_OUTSIDE_CATALOG', 'Entrada OpenMoji no puede resolver una ruta confiable')
  const catalog = loadedCatalog(options)
  const canonical = catalog.byStableId.get(entry.stableId)
  if (!canonical || canonical.hexcode !== hexcode) fail('OPENMOJI_SVG_NOT_FOUND', 'Entrada OpenMoji no pertenece al catálogo cargado')
  const file = confinedExistingFile(catalog.resourceRoot, canonical.svgRelativeFile, 'OPENMOJI_SVG_NOT_FOUND')
  const stat = fs.statSync(file)
  if (!stat.isFile() || path.extname(file).toLowerCase() !== '.svg' || stat.size === 0 || !svgLooksLikeSvg(file))
    fail('OPENMOJI_SVG_NOT_FOUND', 'SVG OpenMoji inválido al resolver', { stableId: canonical.stableId })
  return file
}
