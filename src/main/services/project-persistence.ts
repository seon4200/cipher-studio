import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { PersistenceError, migrateProjectState, normalizeProjectRelativePath,
  validateAssetManifest, emptyAssetManifest, record, AssetManifestV1 } from '../../shared/project-state'

export { PersistenceError, migrateProjectState, validateProjectSubstrate, validateAssetManifest,
  emptyAssetManifest, normalizeProjectRelativePath, PROJECT_STATE_SCHEMA_VERSION, ASSET_MANIFEST_VERSION } from '../../shared/project-state'
const f = fs
export type Recovery<T> = { value: T; status: 'valid' | 'recovered-from-backup'; warnings: string[] }
const exists = (p: string) => { try { f.lstatSync(p); return true } catch (e: any) { if (e.code === 'ENOENT') return false; throw e } }
function regular(p: string) {
  const stat = f.lstatSync(p)
  if (stat.isSymbolicLink() || !stat.isFile()) throw new PersistenceError('PERSISTENCE_NOT_REGULAR_FILE', 'No es archivo regular: ' + p)
}
function parse<T>(p: string, validate: (v: unknown) => T, prefix: string): T {
  regular(p)
  let raw: unknown
  try { raw = JSON.parse(f.readFileSync(p, 'utf8')) }
  catch (e: any) {
    if (!(e instanceof SyntaxError)) throw e
    throw new PersistenceError(prefix + '_INVALID_JSON', 'JSON inválido: ' + p)
  }
  return validate(raw)
}
function unsupported(e: any) { return typeof e?.code === 'string' && e.code.endsWith('_UNSUPPORTED_VERSION') }
function recoverable(e: any) {
  return e?.code === 'ENOENT' || (e instanceof PersistenceError &&
    (e.code.endsWith('_INVALID_JSON') || e.code === 'PROJECT_STATE_INVALID' || e.code === 'ASSET_MANIFEST_INVALID'))
}
export function readJsonRecoverable<T>(target: string, validate: (v: unknown) => T, prefix: string): Recovery<T> {
  try {
    return { value: parse(target, validate, prefix), status: 'valid', warnings: ownTemps(target).length ? [prefix + '_TEMPORARIES_PRESENT'] : [] }
  } catch (primary: any) {
    // Future versions, bad substrate or confinement errors are not corruption to hide.
    if (unsupported(primary) || !recoverable(primary)) throw primary
    try {
      const value = parse(target + '.bak', validate, prefix)
      return { value, status: 'recovered-from-backup',
        warnings: [prefix + '_RECOVERED_FROM_BACKUP', primary.code || prefix + '_READ_FAILED',
          ...(ownTemps(target).length ? [prefix + '_TEMPORARIES_PRESENT'] : [])] }
    } catch (backup: any) {
      if (unsupported(backup)) throw backup
      throw new PersistenceError(prefix + '_UNRECOVERABLE', 'Principal y backup no utilizables',
        { primaryCode: primary.code, backupCode: backup.code })
    }
  }
}
function ownTemps(target: string) {
  const prefix = '.' + path.basename(target) + '.cipher-'
  try { return f.readdirSync(path.dirname(target)).filter(n => n.startsWith(prefix) && n.endsWith('.tmp')) }
  catch (e: any) { if (e.code === 'ENOENT') return []; throw e }
}
function syncTemp(p: string, bytes: string) {
  const fd = f.openSync(p, 'wx')
  try { f.writeFileSync(fd, bytes, 'utf8'); f.fsyncSync(fd) } finally { f.closeSync(fd) }
}
export function writeJsonAtomic<T>(target: string, value: unknown, validate: (v: unknown) => T,
  prefix: string, hooks: { beforePublish?: () => void } = {}) {
  // Synchronous sequence serializes all IPC writes in this main process. No cross-process lock.
  let temporary: string | undefined, backupTemp: string | undefined
  try {
    const serialized = JSON.stringify(value, null, 2)
    if (serialized === undefined) throw new PersistenceError(prefix + '_INVALID', 'No serializable')
    validate(JSON.parse(serialized))
    let priorBytes: string | undefined
    if (exists(target) || exists(target + '.bak')) {
      const prior = readJsonRecoverable(target, validate, prefix)
      priorBytes = f.readFileSync(prior.status === 'valid' ? target : target + '.bak', 'utf8')
    }
    const parent = path.dirname(target)
    if (!f.statSync(parent).isDirectory()) throw new Error('Directorio inexistente')
    temporary = path.join(parent, '.' + path.basename(target) + '.cipher-' + randomUUID() + '.tmp')
    syncTemp(temporary, serialized)
    if (priorBytes !== undefined) {
      // Do not replace a known good .bak with a corrupt primary.
      if (exists(target + '.bak')) regular(target + '.bak')
      backupTemp = path.join(parent, '.' + path.basename(target) + '.cipher-' + randomUUID() + '.tmp')
      syncTemp(backupTemp, priorBytes)
      f.renameSync(backupTemp, target + '.bak'); backupTemp = undefined
    }
    hooks.beforePublish?.()
    // Windows/libuv rename replaces an existing file. No unlink-target fallback.
    f.renameSync(temporary, target); temporary = undefined
    return { warnings: [] as string[] }
  } catch (e: any) {
    if (e instanceof PersistenceError) throw e
    throw new PersistenceError(prefix + '_WRITE_FAILED', 'No se publicó el JSON: ' + e.message, { causeCode: e.code })
  } finally {
    // Only temporaries created by THIS operation; do not sweep unrelated leftovers.
    for (const p of [temporary, backupTemp]) if (p) { try { f.unlinkSync(p) } catch { /* retained and reported on next read */ } }
  }
}
export function resolveProjectRelativePath(projectRoot: string, relativeFile: string, assetsOnly = false) {
  const relative = normalizeProjectRelativePath(relativeFile, assetsOnly)
  const root = path.resolve(projectRoot)
  // Reject all symlinks/junctions, including an existing ancestor. No mutable alias paths.
  let current = path.parse(root).root
  const parts = path.relative(current, root).split(path.sep).filter(Boolean).concat(relative.split('/'))
  for (const part of parts) {
    current = path.join(current, part)
    if (exists(current) && f.lstatSync(current).isSymbolicLink())
      throw new PersistenceError('ASSET_MANIFEST_PATH_OUTSIDE_PROJECT', 'Symlink/junction no permitido: ' + current)
  }
  const result = path.resolve(root, relative)
  const rel = path.relative(root, result)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel))
    throw new PersistenceError('ASSET_MANIFEST_PATH_OUTSIDE_PROJECT', 'Ruta fuera del proyecto')
  if (exists(result)) {
    const real = f.realpathSync(result), realRoot = f.realpathSync(root)
    const realRel = path.relative(realRoot, real)
    if (!realRel || realRel.startsWith('..') || path.isAbsolute(realRel))
      throw new PersistenceError('ASSET_MANIFEST_PATH_OUTSIDE_PROJECT', 'Destino real fuera del proyecto')
  }
  return result
}
function manifestPath(root: string) { return resolveProjectRelativePath(root, 'materiales/assets/manifest.json') }
export function auditAssetManifest(root: string, raw: unknown, physical = false) {
  const result = { status: 'valid' as 'valid' | 'invalid', errors: [] as string[], warnings: [] as string[],
    missingAssets: [] as string[], outsideAssets: [] as string[], duplicateIds: [] as string[], duplicatePaths: [] as string[] }
  try {
    const m = validateAssetManifest(raw)
    for (const a of m.assets) {
      try {
        // Structural mode has no filesystem reads. Physical mode also checks junctions.
        const file = physical ? resolveProjectRelativePath(root, a.relativeFile, true) : ''
        if (!physical) continue
        if (!exists(file)) { result.missingAssets.push(a.id); result.warnings.push('ASSET_FILE_MISSING:' + a.id); continue }
        const stat = f.statSync(file)
        if (!stat.isFile() || stat.size !== a.byteLength) result.errors.push('ASSET_BYTE_LENGTH_MISMATCH:' + a.id)
      } catch (e: any) {
        if (e.code === 'ASSET_MANIFEST_PATH_OUTSIDE_PROJECT') result.outsideAssets.push(a.id)
        result.errors.push(e.code || 'ASSET_FILE_READ_FAILED')
      }
    }
  } catch (e: any) {
    result.errors.push(e.code || 'ASSET_MANIFEST_INVALID')
    if (e.code === 'ASSET_MANIFEST_DUPLICATE_ID') result.duplicateIds.push(e.details.id)
    if (e.code === 'ASSET_MANIFEST_DUPLICATE_PATH') result.duplicatePaths.push(e.details.relativeFile)
    if (e.code === 'ASSET_MANIFEST_PATH_OUTSIDE_PROJECT') result.outsideAssets.push('invalid-relativeFile')
  }
  if (result.errors.length || result.missingAssets.length) result.status = 'invalid'
  return result
}
export function readAssetStorage(root: string) {
  try {
    const target = manifestPath(root)
    if (!exists(target) && !exists(target + '.bak')) return { status: 'absent' as const, warnings: [] as string[] }
    const loaded = readJsonRecoverable(target, validateAssetManifest, 'ASSET_MANIFEST')
    return { status: loaded.status, manifest: loaded.value, warnings: loaded.warnings,
      audit: auditAssetManifest(root, loaded.value, true) }
  } catch (e: any) {
    return { status: unsupported(e) ? 'unsupported-version' as const : 'invalid' as const,
      warnings: [e.code || 'ASSET_MANIFEST_READ_FAILED'], error: e.message }
  }
}
export function ensureAssetStorage(root: string): AssetManifestV1 {
  const target = manifestPath(root), current = readAssetStorage(root)
  if (current.status === 'valid' || current.status === 'recovered-from-backup') return current.manifest!
  if (current.status !== 'absent') throw new PersistenceError(current.warnings[0], current.error || 'Manifest no utilizable')
  f.mkdirSync(path.dirname(target), { recursive: true })
  const manifest = emptyAssetManifest()
  writeJsonAtomic(target, manifest, validateAssetManifest, 'ASSET_MANIFEST')
  return manifest
}
export function saveAssetManifest(root: string, raw: unknown) {
  const manifest = validateAssetManifest(raw)
  for (const a of manifest.assets) resolveProjectRelativePath(root, a.relativeFile, true)
  const target = manifestPath(root)
  f.mkdirSync(path.dirname(target), { recursive: true })
  writeJsonAtomic(target, manifest, validateAssetManifest, 'ASSET_MANIFEST')
  return manifest
}
const validateState = (raw: unknown) => migrateProjectState(raw).state
export function loadProjectFile(target: string) {
  const loaded = readJsonRecoverable(target, migrateProjectState, 'PROJECT_STATE')
  // Migration is in memory only. readJsonRecoverable never writes backups or primary.
  return { state: loaded.value.state, status: loaded.status, warnings: [...loaded.warnings, ...loaded.value.warnings],
    assets: readAssetStorage(path.dirname(target)) }
}
export function saveProjectFile(target: string, payload: unknown, sourceFile = target) {
  record(payload, 'PROJECT_STATE_INVALID')
  // Reject an explicit future/invalid incoming schema before merging, and guard destination.
  migrateProjectState(payload)
  const previous = exists(sourceFile) || exists(sourceFile + '.bak') ? loadProjectFile(sourceFile).state : {}
  const state = migrateProjectState({ ...previous, ...payload, date: Date.now() }).state
  writeJsonAtomic(target, state, validateState, 'PROJECT_STATE')
  return state
}
export function createProjectFiles(root: string, initial: unknown) {
  const target = path.join(root, 'project-state.json')
  if (exists(target) || exists(target + '.bak')) throw new PersistenceError('PROJECT_ALREADY_EXISTS', 'Proyecto ya existente')
  const state = migrateProjectState(initial).state
  ensureAssetStorage(root)
  writeJsonAtomic(target, state, validateState, 'PROJECT_STATE')
  return state
}
