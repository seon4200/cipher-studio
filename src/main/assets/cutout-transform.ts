import { createHash, randomUUID } from 'crypto'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { ProjectAssetRecord } from '../../shared/project-state'
import { readAssetStorage, resolveProjectRelativePath, writeJsonAtomic } from '../services/project-persistence'
import {
  inspectPixabayRasterImageV1,
  publishRasterProjectAssetV1,
  readVerifiedRasterProjectAssetContentV1,
  subjectBoundsFromPixabayRasterV1,
  type RasterImageInspectionV1,
} from './pixabay-images'
import { requireAssetProjectRoot } from './openmoji/publish'
import type { SubjectBoundsV1 } from '../../shared/visual-scene-spec'

/** Local development may use a provisioned sidecar; commercial redistribution stays blocked. */
export const CUTOUT_TRANSFORM_VERSION = 'photo-cutout-v1' as const
export const CUTOUT_DEFAULT_MODEL_V1 = 'u2netp' as const
export const CUTOUT_OPTIONAL_QUALITY_MODEL_V1 = 'isnet-general-use' as const
export const CUTOUT_WEIGHT_LICENSE_GATE = 'PENDING_BEFORE_COMMERCIAL_DISTRIBUTION' as const
export const CUTOUT_MAX_DIMENSION_V1 = 1024 as const
export const CUTOUT_CACHE_VERSION = 1 as const

export type CutoutModelV1 = typeof CUTOUT_DEFAULT_MODEL_V1 | typeof CUTOUT_OPTIONAL_QUALITY_MODEL_V1
export type CutoutQualityV1 = 'CUTOUT_USABLE' | 'CUTOUT_SUSPICIOUS' | 'CUTOUT_FAILED'

export type CutoutRuntimeConfigV1 = {
  pythonExecutable: string
  workerFile: string
  modelCache: string
  maxDimension?: number
}

export type CutoutWorkerOutputV1 = {
  status: 'OK'
  action: 'transform'
  model: CutoutModelV1
  modelRevision: string
  sourceSha256: string
  outputSha256: string
  outputBytes: number
  modelLoadMs: number
  processingMs: number
  width: number
  height: number
  alphaPresent: boolean
  alphaUseful: boolean
  transparentPixelPercent: number
  alphaBoundingBox: { x: number; y: number; width: number; height: number } | null
}

export type CutoutWorkerRequestV1 = {
  inputFile: string
  outputFile: string
  model: CutoutModelV1
  modelCache: string
  maxDimension: number
}

export type CutoutTransformHooksV1 = {
  /** Test seam for the isolated sidecar; publication, validation and cache remain product code. */
  runWorker?: (request: CutoutWorkerRequestV1) => Promise<CutoutWorkerOutputV1>
}

export type CutoutTransformResultV1 = {
  status: 'usable' | 'suspicious' | 'failed'
  quality: CutoutQualityV1
  reason: string
  sourceAsset: ProjectAssetRecord
  asset?: ProjectAssetRecord
  bounds?: SubjectBoundsV1
  cacheHit: boolean
  attempted: boolean
  processingMs: number | null
  model: CutoutModelV1
  modelRevision: string | null
  warnings: readonly string[]
}

type CutoutCacheEntryV1 = {
  cacheKey: string
  sourceAssetId: string
  sourceSha256: string
  model: CutoutModelV1
  modelRevision: string
  maxDimension: number
  quality: CutoutQualityV1
  reason: string
  outputAssetId?: string
  outputSha256?: string
  processingMs: number | null
  createdAt: string
}

type CutoutCacheV1 = {
  version: typeof CUTOUT_CACHE_VERSION
  entries: CutoutCacheEntryV1[]
}

export class CutoutTransformError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'CutoutTransformError'
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new CutoutTransformError(code, message, details)
}

function sha256(bytes: Buffer | string): string { return createHash('sha256').update(bytes).digest('hex') }

function regularFile(file: string, code: string): void {
  const stat = fs.lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, 'Archivo no regular', { file })
}

function configuredWorkerFile(): string | null {
  const fromEnvironment = String(process.env.CIPHER_CUTOUT_WORKER ?? '').trim()
  if (fromEnvironment) return path.resolve(fromEnvironment)
  const packaged = typeof process.resourcesPath === 'string'
    ? path.join(process.resourcesPath, 'cutout-transform', 'cutout_worker.py') : ''
  if (packaged && fs.existsSync(packaged)) return packaged
  // In dev/test, dist-electron/main lives two directories below the repository root.
  const development = path.resolve(__dirname, '../../tools/photo-cutout-production/cutout_worker.py')
  return fs.existsSync(development) ? development : null
}

/** Returns null instead of guessing a user-level Python or triggering a model download. */
export function configuredCutoutRuntimeV1(): CutoutRuntimeConfigV1 | null {
  const pythonExecutable = String(process.env.CIPHER_CUTOUT_PYTHON ?? '').trim()
  const modelCache = String(process.env.CIPHER_CUTOUT_MODEL_CACHE ?? '').trim()
  const workerFile = configuredWorkerFile()
  if (!pythonExecutable || !modelCache || !workerFile) return null
  return { pythonExecutable: path.resolve(pythonExecutable), workerFile: path.resolve(workerFile),
    modelCache: path.resolve(modelCache), maxDimension: CUTOUT_MAX_DIMENSION_V1 }
}

function configuredModelRevision(runtime: CutoutRuntimeConfigV1, model: CutoutModelV1): string {
  const target = path.join(runtime.modelCache, 'models', model, model + '.onnx')
  if (!fs.existsSync(target)) fail('CUTOUT_MODEL_NOT_INSTALLED', 'Modelo local no instalado', { model })
  regularFile(target, 'CUTOUT_MODEL_NOT_REGULAR')
  return 'sha256:' + sha256(fs.readFileSync(target))
}

function parseWorkerOutput(value: string): CutoutWorkerOutputV1 {
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { fail('CUTOUT_WORKER_INVALID_JSON', 'Worker no devolvió JSON válido') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    fail('CUTOUT_WORKER_INVALID_JSON', 'Worker no devolvió objeto')
  const row = parsed as Record<string, unknown>
  if (row.status !== 'OK' || row.action !== 'transform' ||
      (row.model !== 'u2netp' && row.model !== 'isnet-general-use') ||
      typeof row.modelRevision !== 'string' || !row.modelRevision ||
      typeof row.outputSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.outputSha256) ||
      !Number.isFinite(row.processingMs) || !Number.isInteger(row.width) || !Number.isInteger(row.height) ||
      typeof row.alphaPresent !== 'boolean' || typeof row.alphaUseful !== 'boolean' ||
      !Number.isFinite(row.transparentPixelPercent))
    fail('CUTOUT_WORKER_INVALID_RESULT', 'Resultado del worker incompleto')
  return row as unknown as CutoutWorkerOutputV1
}

async function runWorkerProcessV1(runtime: CutoutRuntimeConfigV1, request: CutoutWorkerRequestV1): Promise<CutoutWorkerOutputV1> {
  if (!fs.existsSync(runtime.pythonExecutable)) fail('CUTOUT_RUNTIME_UNAVAILABLE', 'Python de cutout no existe')
  if (!fs.existsSync(runtime.workerFile)) fail('CUTOUT_RUNTIME_UNAVAILABLE', 'Worker de cutout no existe')
  regularFile(runtime.pythonExecutable, 'CUTOUT_RUNTIME_UNAVAILABLE')
  regularFile(runtime.workerFile, 'CUTOUT_RUNTIME_UNAVAILABLE')
  return await new Promise<CutoutWorkerOutputV1>((resolve, reject) => {
    const child = spawn(runtime.pythonExecutable, [runtime.workerFile, 'transform',
      '--input', request.inputFile, '--output', request.outputFile, '--cache', request.modelCache,
      '--model', request.model, '--max-dimension', String(request.maxDimension)],
    { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', settled = false
    const finish = (error?: Error, value?: CutoutWorkerOutputV1) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else if (value) resolve(value)
      else reject(new CutoutTransformError('CUTOUT_WORKER_FAILED', 'Worker terminó sin resultado'))
    }
    const timeout = setTimeout(() => {
      child.kill()
      finish(new CutoutTransformError('CUTOUT_WORKER_TIMEOUT', 'Worker excedió 60 segundos'))
    }, 60_000)
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', error => { clearTimeout(timeout); finish(new CutoutTransformError('CUTOUT_RUNTIME_UNAVAILABLE', error.message)) })
    child.once('close', code => {
      clearTimeout(timeout)
      if (code !== 0) {
        const last = stderr.trim().split(/\r?\n/).filter(Boolean).pop() ?? ''
        try {
          const parsed = JSON.parse(last) as { code?: unknown; message?: unknown }
          return finish(new CutoutTransformError(String(parsed.code ?? 'CUTOUT_WORKER_FAILED'), String(parsed.message ?? 'Worker falló')))
        } catch {
          return finish(new CutoutTransformError('CUTOUT_WORKER_FAILED', last || 'Worker terminó con código ' + code))
        }
      }
      const last = stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? ''
      try { finish(undefined, parseWorkerOutput(last)) }
      catch (error) { finish(error as Error) }
    })
  })
}

function cachePath(root: string): string {
  return resolveProjectRelativePath(root, 'materiales/diagnostics/cutout-transforms-v1.json')
}

function validateCache(value: unknown): CutoutCacheV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('CUTOUT_CACHE_INVALID', 'Cache cutout inválida')
  const row = value as Record<string, unknown>
  if (row.version !== CUTOUT_CACHE_VERSION || !Array.isArray(row.entries))
    fail('CUTOUT_CACHE_INVALID', 'Versión o entries de cache inválidos')
  for (const entry of row.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('CUTOUT_CACHE_INVALID', 'Entry cutout inválida')
    const item = entry as Record<string, unknown>
    if (typeof item.cacheKey !== 'string' || !/^[a-f0-9]{64}$/.test(item.cacheKey) ||
        typeof item.sourceAssetId !== 'string' || typeof item.sourceSha256 !== 'string' ||
        (item.model !== 'u2netp' && item.model !== 'isnet-general-use') ||
        typeof item.modelRevision !== 'string' || !Number.isInteger(item.maxDimension) ||
        !['CUTOUT_USABLE', 'CUTOUT_SUSPICIOUS', 'CUTOUT_FAILED'].includes(String(item.quality)) ||
        typeof item.reason !== 'string' || !Number.isFinite(item.processingMs) && item.processingMs !== null ||
        typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)))
      fail('CUTOUT_CACHE_INVALID', 'Entry cutout incompleta')
  }
  return row as unknown as CutoutCacheV1
}

function readCache(root: string): CutoutCacheV1 {
  const target = cachePath(root)
  if (!fs.existsSync(target)) return { version: CUTOUT_CACHE_VERSION, entries: [] }
  regularFile(target, 'CUTOUT_CACHE_INVALID')
  try { return validateCache(JSON.parse(fs.readFileSync(target, 'utf8'))) }
  catch (error) {
    if (error instanceof CutoutTransformError) throw error
    fail('CUTOUT_CACHE_INVALID', 'No se pudo leer cache cutout')
  }
}

function saveCache(root: string, cache: CutoutCacheV1): void {
  const target = cachePath(root)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  writeJsonAtomic(target, cache, validateCache, 'CUTOUT_CACHE')
}

function cacheKey(input: { sourceSha256: string; model: CutoutModelV1; modelRevision: string; maxDimension: number }): string {
  return sha256([CUTOUT_TRANSFORM_VERSION, input.sourceSha256, input.model, input.modelRevision,
    String(input.maxDimension)].join('|'))
}

function qualityFor(input: {
  inspection: RasterImageInspectionV1
  bounds: SubjectBoundsV1
  transparentPixelPercent?: number
}): { quality: CutoutQualityV1; reason: string } {
  if (!input.inspection.hasAlpha || !input.inspection.alphaUseful || input.inspection.width < 64 || input.inspection.height < 64)
    return { quality: 'CUTOUT_FAILED', reason: 'CUTOUT_ALPHA_OR_DIMENSIONS_INVALID' }
  const visibleArea = input.bounds.visibleWidthRatio * input.bounds.visibleHeightRatio
  const transparent = input.transparentPixelPercent
  if (visibleArea < .015 || visibleArea > .995 ||
      (transparent !== undefined && (transparent < .2 || transparent > 99.5)))
    return { quality: 'CUTOUT_SUSPICIOUS', reason: 'CUTOUT_BOUNDS_OR_TRANSPARENCY_SUSPICIOUS' }
  return { quality: 'CUTOUT_USABLE', reason: 'CUTOUT_ALPHA_BOUNDS_VALID' }
}

function manifestAsset(root: string, assetId: string, sha: string): ProjectAssetRecord | null {
  const storage = readAssetStorage(root)
  if (storage.status !== 'valid' && storage.status !== 'recovered-from-backup') return null
  const asset = storage.manifest.assets.find(value => value.id === assetId && value.sha256 === sha) ?? null
  if (!asset) return null
  try {
    const verified = readVerifiedRasterProjectAssetContentV1(root, asset)
    if (!verified.inspection.alphaUseful) return null
    return asset
  } catch { return null }
}

function sourceForDerivedCutout(source: ProjectAssetRecord, model: CutoutModelV1, revision: string): ProjectAssetRecord['source'] {
  return {
    ...(source.source.sourceUrl ? { sourceUrl: source.source.sourceUrl } : {}),
    ...(source.source.fileUrl ? { fileUrl: source.source.fileUrl } : {}),
    providerVersion: `${CUTOUT_TRANSFORM_VERSION};model=${model};revision=${revision}`,
    ...(source.source.licenseClaim ? { licenseClaim: source.source.licenseClaim } : {}),
    ...(source.source.licenseUrl ? { licenseUrl: source.source.licenseUrl } : {}),
    attribution: `Derived photo cutout from ${source.id}`,
    fetchedAt: new Date().toISOString(),
  }
}

function upsertCacheEntry(root: string, entry: CutoutCacheEntryV1): void {
  const current = readCache(root)
  const entries = [...current.entries.filter(value => value.cacheKey !== entry.cacheKey), entry]
  saveCache(root, { version: CUTOUT_CACHE_VERSION, entries })
}

/**
 * Materialises a derived local RGBA ProjectAsset.  A missing runtime or an unusable alpha result
 * is an explicit non-throwing decision so the resolver can continue through its normal fallback
 * cascade rather than turn a Visual into a broken scene.
 */
export async function materializePhotoCutoutV1(input: {
  projectRoot: unknown
  sourceAsset: ProjectAssetRecord
  model?: CutoutModelV1
  runtime?: CutoutRuntimeConfigV1 | null
  hooks?: CutoutTransformHooksV1
}): Promise<CutoutTransformResultV1> {
  const root = requireAssetProjectRoot(input.projectRoot)
  const model = input.model ?? CUTOUT_DEFAULT_MODEL_V1
  const source = readVerifiedRasterProjectAssetContentV1(root, input.sourceAsset)
  const sourceBounds = subjectBoundsFromPixabayRasterV1(source.bytes)
  if (source.inspection.alphaUseful) {
    const quality = qualityFor({ inspection: source.inspection, bounds: sourceBounds })
    return { status: quality.quality === 'CUTOUT_USABLE' ? 'usable' : 'suspicious', quality: quality.quality,
      reason: 'CUTOUT_SOURCE_ALREADY_HAS_ALPHA:' + quality.reason, sourceAsset: input.sourceAsset,
      ...(quality.quality !== 'CUTOUT_FAILED' ? { asset: input.sourceAsset, bounds: sourceBounds } : {}),
      cacheHit: false, attempted: false, processingMs: 0, model, modelRevision: null,
      warnings: Object.freeze(['CUTOUT_SOURCE_ALPHA_REUSED']) }
  }
  const runtime = input.runtime === undefined ? configuredCutoutRuntimeV1() : input.runtime
  if (!runtime) return { status: 'failed', quality: 'CUTOUT_FAILED', reason: 'CUTOUT_RUNTIME_UNAVAILABLE',
    sourceAsset: input.sourceAsset, cacheHit: false, attempted: false, processingMs: null, model, modelRevision: null,
    warnings: Object.freeze(['CUTOUT_RUNTIME_UNAVAILABLE']) }
  let revision: string
  try { revision = configuredModelRevision(runtime, model) }
  catch (error) {
    const code = error instanceof CutoutTransformError ? error.code : 'CUTOUT_MODEL_NOT_INSTALLED'
    return { status: 'failed', quality: 'CUTOUT_FAILED', reason: code, sourceAsset: input.sourceAsset,
      cacheHit: false, attempted: false, processingMs: null, model, modelRevision: null,
      warnings: Object.freeze([code]) }
  }
  const key = cacheKey({ sourceSha256: input.sourceAsset.sha256, model, modelRevision: revision,
    maxDimension: runtime.maxDimension ?? CUTOUT_MAX_DIMENSION_V1 })
  let cache: CutoutCacheV1
  try { cache = readCache(root) }
  catch (error) {
    const code = error instanceof CutoutTransformError ? error.code : 'CUTOUT_CACHE_INVALID'
    return { status: 'failed', quality: 'CUTOUT_FAILED', reason: code, sourceAsset: input.sourceAsset,
      cacheHit: false, attempted: false, processingMs: null, model, modelRevision: revision,
      warnings: Object.freeze([code]) }
  }
  const cached = cache.entries.find(entry => entry.cacheKey === key && entry.quality === 'CUTOUT_USABLE')
  if (cached?.outputAssetId && cached.outputSha256) {
    const asset = manifestAsset(root, cached.outputAssetId, cached.outputSha256)
    if (asset) {
      const verified = readVerifiedRasterProjectAssetContentV1(root, asset)
      return { status: 'usable', quality: 'CUTOUT_USABLE', reason: 'CUTOUT_CACHE_REUSED',
        sourceAsset: input.sourceAsset, asset, bounds: subjectBoundsFromPixabayRasterV1(verified.bytes),
        cacheHit: true, attempted: true, processingMs: 0, model, modelRevision: revision,
        warnings: Object.freeze(['CUTOUT_CACHE_HIT']) }
    }
  }
  const outputDirectory = resolveProjectRelativePath(root, 'materiales/assets/cutout')
  fs.mkdirSync(outputDirectory, { recursive: true })
  const temporaryOutput = path.join(outputDirectory, `.cutout-${randomUUID()}.png`)
  let worker: CutoutWorkerOutputV1
  try {
    const request: CutoutWorkerRequestV1 = { inputFile: source.absoluteFile, outputFile: temporaryOutput,
      model, modelCache: runtime.modelCache, maxDimension: runtime.maxDimension ?? CUTOUT_MAX_DIMENSION_V1 }
    worker = input.hooks?.runWorker ? await input.hooks.runWorker(request) : await runWorkerProcessV1(runtime, request)
    if (worker.model !== model || worker.modelRevision !== revision || worker.sourceSha256 !== input.sourceAsset.sha256)
      fail('CUTOUT_WORKER_IDENTITY_MISMATCH', 'Worker devolvió identidad distinta a la solicitada')
    if (!fs.existsSync(temporaryOutput)) fail('CUTOUT_OUTPUT_MISSING', 'Worker no produjo salida local')
    regularFile(temporaryOutput, 'CUTOUT_OUTPUT_NOT_REGULAR')
    const bytes = fs.readFileSync(temporaryOutput)
    if (sha256(bytes) !== worker.outputSha256) fail('CUTOUT_OUTPUT_SHA_MISMATCH', 'SHA de worker no coincide con bytes')
    const inspection = inspectPixabayRasterImageV1(bytes)
    const bounds = subjectBoundsFromPixabayRasterV1(bytes)
    const quality = qualityFor({ inspection, bounds, transparentPixelPercent: worker.transparentPixelPercent })
    const entryBase: Omit<CutoutCacheEntryV1, 'quality' | 'reason' | 'outputAssetId' | 'outputSha256'> = {
      cacheKey: key, sourceAssetId: input.sourceAsset.id, sourceSha256: input.sourceAsset.sha256,
      model, modelRevision: revision, maxDimension: request.maxDimension, processingMs: worker.processingMs,
      createdAt: new Date().toISOString(),
    }
    if (quality.quality !== 'CUTOUT_USABLE') {
      upsertCacheEntry(root, { ...entryBase, quality: quality.quality, reason: quality.reason })
      return { status: quality.quality === 'CUTOUT_SUSPICIOUS' ? 'suspicious' : 'failed', quality: quality.quality,
        reason: quality.reason, sourceAsset: input.sourceAsset, cacheHit: false, attempted: true,
        processingMs: worker.processingMs, model, modelRevision: revision,
        warnings: Object.freeze([quality.reason]) }
    }
    const published = publishRasterProjectAssetV1({ projectRoot: root, provider: 'cutout',
      assetId: `cutout-${input.sourceAsset.sha256.slice(0, 20)}-${model.replace(/[^a-z0-9]/gi, '')}-${sha256(revision).slice(0, 8)}`,
      bytes, source: sourceForDerivedCutout(input.sourceAsset, model, revision),
      validationRevision: CUTOUT_TRANSFORM_VERSION, requireUsefulAlpha: true,
      validationWarnings: [`CUTOUT_MODEL:${model}`, `CUTOUT_MODEL_REVISION:${revision}`] })
    upsertCacheEntry(root, { ...entryBase, quality: 'CUTOUT_USABLE', reason: quality.reason,
      outputAssetId: published.asset.id, outputSha256: published.asset.sha256 })
    return { status: 'usable', quality: 'CUTOUT_USABLE', reason: quality.reason, sourceAsset: input.sourceAsset,
      asset: published.asset, bounds, cacheHit: published.status === 'reused', attempted: true,
      processingMs: worker.processingMs, model, modelRevision: revision,
      warnings: Object.freeze([...published.warnings, quality.reason]) }
  } catch (error) {
    const code = error instanceof CutoutTransformError ? error.code : 'CUTOUT_TRANSFORM_FAILED'
    return { status: 'failed', quality: 'CUTOUT_FAILED', reason: code, sourceAsset: input.sourceAsset,
      cacheHit: false, attempted: true, processingMs: null, model, modelRevision: revision,
      warnings: Object.freeze([code]) }
  } finally {
    if (fs.existsSync(temporaryOutput)) try { fs.unlinkSync(temporaryOutput) } catch { /* only this operation temporary */ }
  }
}
