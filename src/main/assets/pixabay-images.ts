import { createHash, randomUUID } from 'crypto'
import fs from 'fs'
import https from 'https'
import path from 'path'
import { inflateSync } from 'zlib'
import {
  type ConceptLexiconEntryV1,
  type ConceptExpansionLevelV1,
} from '../../shared/concept-lexicon'
import type { ProjectAssetRecord } from '../../shared/project-state'
import type { VisualConceptV1 } from '../../shared/visual-concepts'
import { fullSubjectBounds, type SubjectBoundsV1 } from '../../shared/visual-scene-spec'
import {
  readAssetStorage,
  resolveProjectRelativePath,
  saveAssetManifest,
} from '../services/project-persistence'
import { requireAssetProjectRoot } from './openmoji/publish'

/** Pixabay Images retrieval is on-demand and never runs in the renderer. */
export const PIXABAY_IMAGES_PROVIDER_VERSION = 'api-v1' as const
export const PIXABAY_IMAGE_VALIDATION_REVISION = 'pixabay-raster-v1' as const
export const PIXABAY_MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const PIXABAY_MAX_DIMENSION = 16_384

export type PixabayImageRoleV1 = 'hero' | 'support'
export type PixabayImageResolutionTierV1 = 'low' | 'usable' | 'strong'
export type PixabayImageTransparencyStateV1 = 'not-requested' | 'requested-unverified' | 'verified-useful' | 'verified-absent'

/**
 * A deliberately explainable rank. Composition is unverified until a future visual review stage;
 * no fake computer-vision score is introduced in V1.
 */
export type PixabayImageRankingV1 = {
  semantic: 0 | 1 | 2 | 3
  lexicalLevel: ConceptExpansionLevelV1
  subject: VisualConceptV1['subject']
  role: PixabayImageRoleV1
  heroSuitability: 0 | 1 | 2 | 3
  supportSuitability: 0 | 1 | 2 | 3
  resolution: PixabayImageResolutionTierV1
  transparency: PixabayImageTransparencyStateV1
  composition: 'unverified'
  providerConfidence: 1
  previousSuccess: false
  total: number
  reasons: readonly string[]
}

export type PixabayImageSearchPlanV1 = {
  provider: 'pixabay-images'
  concept: string
  role: PixabayImageRoleV1
  subject: VisualConceptV1['subject']
  query: string
  language: 'es' | 'en'
  imageType: 'photo' | 'illustration' | 'vector'
  orientation: 'all' | 'horizontal' | 'vertical'
  transparentRequested: boolean
  level: ConceptExpansionLevelV1
  reason: string
  /** Public query parameters only. API credentials are never copied into a plan or trace. */
  parameters: Readonly<Record<string, string>>
}

export type PixabayImageCandidateV1 = {
  provider: 'pixabay-images'
  id: string
  pageUrl: string
  downloadUrl: string
  tags: readonly string[]
  width: number
  height: number
  imageType: 'photo' | 'illustration' | 'vector'
  score: 0 | 1 | 2 | 3
  reason: string
  query: string
  transparentRequested: boolean
  requiresDownloadValidation: true
  ranking: PixabayImageRankingV1
}

export type PixabaySearchResultV1 = {
  plan: PixabayImageSearchPlanV1
  candidates: readonly PixabayImageCandidateV1[]
  warnings: readonly string[]
}

export type RasterImageInspectionV1 = {
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  extension: 'png' | 'jpg' | 'webp'
  width: number
  height: number
  hasAlpha: boolean
  alphaUseful: boolean
  warnings: readonly string[]
}

export class PixabayImageError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'PixabayImageError'
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new PixabayImageError(code, message, details)
}

function canonical(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en').normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/[\s_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function words(value: string): string[] { return canonical(value).split(' ').filter(Boolean) }

function safeUrl(value: unknown, field: string): string {
  if (typeof value !== 'string') fail('PIXABAY_IMAGE_INVALID_URL', field + ' no es URL')
  let url: URL
  try { url = new URL(value) } catch { fail('PIXABAY_IMAGE_INVALID_URL', field + ' no es URL') }
  if (url.protocol !== 'https:' || url.username || url.password) fail('PIXABAY_IMAGE_INVALID_URL', field + ' debe ser HTTPS sin credenciales')
  return url.toString()
}

function imageTypeFor(concept: VisualConceptV1): PixabayImageSearchPlanV1['imageType'] {
  return concept.subject === 'person' || concept.subject === 'place' || concept.subject === 'event' ? 'photo' : 'illustration'
}

/** Builds provider-native ES/EN plans; it does not make a request or append credentials. */
export function buildPixabayImageSearchPlansV1(input: {
  concept: VisualConceptV1
  lexicon?: ConceptLexiconEntryV1
  level: ConceptExpansionLevelV1
  role?: PixabayImageRoleV1
  maxPlans?: number
}): readonly PixabayImageSearchPlanV1[] {
  const maxPlans = Math.min(Math.max(Math.trunc(input.maxPlans ?? 3), 1), 4)
  const sourceTerms = input.lexicon?.pixabayTerms?.length ? input.lexicon.pixabayTerms :
    [input.concept.normalizedTerm, ...input.concept.aliases]
  const terms = [...new Set(sourceTerms.map(canonical).filter(Boolean))].slice(0, maxPlans)
  const imageType = imageTypeFor(input.concept)
  const role = input.role ?? 'hero'
  const plans: PixabayImageSearchPlanV1[] = []
  for (let index = 0; index < terms.length; index++) {
    const term = terms[index]
    const english = /^[a-z0-9 ]+$/i.test(term)
    const isolated = index === 0 && input.concept.subject !== 'place' && input.concept.subject !== 'event'
    const query = isolated ? term + ' isolated' : term
    plans.push(Object.freeze({
      provider: 'pixabay-images', concept: input.concept.normalizedTerm, query,
      role, subject: input.concept.subject,
      language: english ? 'en' : 'es', imageType, orientation: 'all', transparentRequested: isolated,
      level: input.level, reason: isolated ? 'PIXABAY_ISOLATED_PRIMARY' : 'PIXABAY_LEXICON_TERM',
      parameters: Object.freeze({ q: query, lang: english ? 'en' : 'es', image_type: imageType,
        orientation: 'all', safesearch: 'true', per_page: '20', ...(isolated ? { colors: 'transparent' } : {}) }),
    }))
  }
  return Object.freeze(plans)
}

function requestJson(url: URL): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 10_000, headers: { Accept: 'application/json' } }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('error', reject)
      response.on('end', () => {
        if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300)
          return reject(new PixabayImageError('PIXABAY_IMAGE_HTTP', 'Pixabay respondió HTTP ' + response.statusCode))
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch { reject(new PixabayImageError('PIXABAY_IMAGE_RESPONSE_INVALID', 'Pixabay devolvió JSON inválido')) }
      })
    })
    request.once('timeout', () => request.destroy(new PixabayImageError('PIXABAY_IMAGE_TIMEOUT', 'Pixabay excedió el tiempo límite')))
    request.once('error', reject)
  })
}

function requestBytes(url: URL, redirects = 0): Promise<Buffer> {
  if (redirects > 3) return Promise.reject(new PixabayImageError('PIXABAY_IMAGE_REDIRECT_LIMIT', 'Demasiadas redirecciones'))
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 15_000, headers: { Accept: 'image/png,image/jpeg,image/webp' } }, response => {
      const status = response.statusCode ?? 500
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        let next: URL
        try { next = new URL(response.headers.location, url) }
        catch { return reject(new PixabayImageError('PIXABAY_IMAGE_INVALID_URL', 'Redirección Pixabay inválida')) }
        if (next.protocol !== 'https:') return reject(new PixabayImageError('PIXABAY_IMAGE_INVALID_URL', 'Redirección no HTTPS'))
        requestBytes(next, redirects + 1).then(resolve, reject)
        return
      }
      if (status < 200 || status >= 300) {
        response.resume()
        reject(new PixabayImageError('PIXABAY_IMAGE_DOWNLOAD_HTTP', 'Descarga Pixabay respondió HTTP ' + status))
        return
      }
      const chunks: Buffer[] = []
      let length = 0
      response.on('data', chunk => {
        const bytes = Buffer.from(chunk)
        length += bytes.length
        if (length > PIXABAY_MAX_IMAGE_BYTES) {
          request.destroy(new PixabayImageError('PIXABAY_IMAGE_TOO_LARGE', 'Imagen Pixabay excede el límite'))
          return
        }
        chunks.push(bytes)
      })
      response.once('error', reject)
      response.once('end', () => resolve(Buffer.concat(chunks)))
    })
    request.once('timeout', () => request.destroy(new PixabayImageError('PIXABAY_IMAGE_TIMEOUT', 'Descarga Pixabay excedió el tiempo límite')))
    request.once('error', reject)
  })
}

/** Explicit pre-render download. It is dependency-injectable so tests can prove renderer/network separation. */
export async function downloadPixabayImageBytesV1(input: {
  candidate: PixabayImageCandidateV1
  requestBytes?: (url: URL) => Promise<Buffer>
}): Promise<Buffer> {
  const url = new URL(safeUrl(input.candidate.downloadUrl, 'candidate.downloadUrl'))
  const bytes = await (input.requestBytes ?? requestBytes)(url)
  inspectPixabayRasterImageV1(bytes)
  return bytes
}

function parsedHits(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { hits?: unknown }).hits))
    fail('PIXABAY_IMAGE_RESPONSE_INVALID', 'Respuesta de Pixabay sin hits')
  return (value as { hits: unknown[] }).hits
}

function levelScore(level: ConceptExpansionLevelV1): 0 | 1 | 2 | 3 {
  return level === 'exact' || level === 'synonym' ? 3 : level === 'related' ? 2 : 1
}

function resolutionTier(width: number, height: number): PixabayImageResolutionTierV1 {
  const pixels = width * height
  return pixels >= 1_500_000 ? 'strong' : pixels >= 360_000 ? 'usable' : 'low'
}

function unverifiedRanking(input: {
  semantic: 0 | 1 | 2 | 3
  plan: PixabayImageSearchPlanV1
  width: number
  height: number
}): PixabayImageRankingV1 {
  const resolution = resolutionTier(input.width, input.height)
  const heroSuitability: 0 | 1 | 2 | 3 = input.plan.role === 'hero'
    ? input.semantic >= 2 && resolution !== 'low' ? 3 : input.semantic >= 2 ? 2 : 1
    : 1
  const supportSuitability: 0 | 1 | 2 | 3 = input.plan.role === 'support'
    ? input.semantic >= 2 ? 3 : 2
    : input.semantic >= 2 ? 2 : 1
  const reasons = [
    'SEMANTIC_' + input.semantic,
    'LEXICAL_' + input.plan.level.toUpperCase(),
    'ROLE_' + input.plan.role.toUpperCase(),
    'RESOLUTION_' + resolution.toUpperCase(),
    input.plan.transparentRequested ? 'TRANSPARENCY_REQUESTED_UNVERIFIED' : 'TRANSPARENCY_NOT_REQUESTED',
    'COMPOSITION_UNVERIFIED',
    'PREVIOUS_SUCCESS_UNAVAILABLE',
  ]
  // Semantic relevance dominates. Quality signals are deliberately modest until bytes are read.
  const total = input.semantic * 100 + heroSuitability * 10 + supportSuitability * 4 +
    (resolution === 'strong' ? 3 : resolution === 'usable' ? 2 : 0)
  return Object.freeze({
    semantic: input.semantic, lexicalLevel: input.plan.level, subject: input.plan.subject, role: input.plan.role,
    heroSuitability, supportSuitability, resolution,
    transparency: input.plan.transparentRequested ? 'requested-unverified' : 'not-requested',
    composition: 'unverified', providerConfidence: 1, previousSuccess: false, total,
    reasons: Object.freeze(reasons),
  })
}

/** Sorts no more than the caller's bounded result set; it never performs an additional request. */
export function rankPixabayImageCandidatesV1(candidates: readonly PixabayImageCandidateV1[]): readonly PixabayImageCandidateV1[] {
  return Object.freeze([...candidates].sort((a, b) => b.ranking.total - a.ranking.total ||
    b.score - a.score || a.id.localeCompare(b.id, 'en')))
}

/** Only semantically usable candidates may progress to download/byte validation. */
export function selectPixabayImageCandidateV1(candidates: readonly PixabayImageCandidateV1[]): PixabayImageCandidateV1 | null {
  return rankPixabayImageCandidatesV1(candidates).find(candidate => candidate.ranking.semantic >= 2) ?? null
}

/** Re-ranks a downloaded candidate with observed alpha, without pretending to judge composition. */
export function validatePixabayImageCandidateRankingV1(
  candidate: PixabayImageCandidateV1,
  inspection: RasterImageInspectionV1,
): PixabayImageRankingV1 {
  const transparency: PixabayImageTransparencyStateV1 = candidate.transparentRequested
    ? inspection.alphaUseful ? 'verified-useful' : 'verified-absent'
    : inspection.alphaUseful ? 'verified-useful' : 'not-requested'
  const alphaBonus = transparency === 'verified-useful' ? 4 : transparency === 'verified-absent' ? -20 : 0
  return Object.freeze({
    ...candidate.ranking,
    transparency,
    total: candidate.ranking.total + alphaBonus,
    reasons: Object.freeze([...candidate.ranking.reasons,
      transparency === 'verified-useful' ? 'TRANSPARENCY_VERIFIED_USEFUL' :
        transparency === 'verified-absent' ? 'TRANSPARENCY_VERIFIED_ABSENT' : 'TRANSPARENCY_NOT_REQUIRED']),
  })
}

function candidateFromHit(hit: unknown, plan: PixabayImageSearchPlanV1): PixabayImageCandidateV1 | null {
  if (!hit || typeof hit !== 'object' || Array.isArray(hit)) return null
  const value = hit as Record<string, unknown>
  const id = Number.isSafeInteger(value.id) || typeof value.id === 'string' ? String(value.id) : ''
  const pageUrl = value.pageURL
  const downloadUrl = value.largeImageURL ?? value.webformatURL
  const width = Number(value.imageWidth ?? value.webformatWidth)
  const height = Number(value.imageHeight ?? value.webformatHeight)
  const kind = value.type === 'photo' || value.type === 'illustration' || value.type === 'vector' ? value.type : plan.imageType
  if (!id || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return null
  let safePage: string, safeDownload: string
  try { safePage = safeUrl(pageUrl, 'pageURL'); safeDownload = safeUrl(downloadUrl, 'image URL') } catch { return null }
  const tags = typeof value.tags === 'string' ? value.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
  const target = words(plan.query).filter(word => word !== 'isolated')
  const tagWords = new Set(tags.flatMap(words))
  const matching = target.filter(word => tagWords.has(word)).length
  const score = matching === target.length && target.length ? levelScore(plan.level) : matching ? 2 : 1
  const semantic = score as 0 | 1 | 2 | 3
  return {
    provider: 'pixabay-images', id, pageUrl: safePage, downloadUrl: safeDownload, tags: Object.freeze(tags),
    width, height, imageType: kind, score: semantic,
    reason: matching === target.length && target.length ? 'PIXABAY_TAGS_MATCH_PLAN' : matching ? 'PIXABAY_PARTIAL_TAG_MATCH' : 'PIXABAY_PROVIDER_RESULT',
    query: plan.query, transparentRequested: plan.transparentRequested, requiresDownloadValidation: true,
    ranking: unverifiedRanking({ semantic, plan, width, height }),
  }
}

/** Performs one explicit, bounded API request. Results are candidates only; no asset is downloaded. */
export async function searchPixabayImagesV1(input: {
  plan: PixabayImageSearchPlanV1
  apiKey?: string
  requestJson?: (url: URL) => Promise<unknown>
}): Promise<PixabaySearchResultV1> {
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : ''
  if (!apiKey) return { plan: input.plan, candidates: [], warnings: ['PIXABAY_IMAGE_API_KEY_ABSENT'] }
  const url = new URL('https://pixabay.com/api/')
  for (const [key, value] of Object.entries(input.plan.parameters)) url.searchParams.set(key, value)
  url.searchParams.set('key', apiKey)
  const response = await (input.requestJson ?? requestJson)(url)
  const candidates = rankPixabayImageCandidatesV1(parsedHits(response).map(hit => candidateFromHit(hit, input.plan))
    .filter((value): value is PixabayImageCandidateV1 => !!value)).slice(0, 40)
  return { plan: input.plan, candidates: Object.freeze(candidates), warnings: Object.freeze([]) }
}

function readUInt24LE(bytes: Buffer, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function pngInspection(bytes: Buffer): RasterImageInspectionV1 {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    fail('PIXABAY_IMAGE_INVALID_BYTES', 'PNG inválido')
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0
  const idat: Buffer[] = []
  let trns: Buffer | undefined
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset); offset += 4
    const type = bytes.subarray(offset, offset + 4).toString('ascii'); offset += 4
    if (offset + length + 4 > bytes.length) fail('PIXABAY_IMAGE_INVALID_BYTES', 'Chunk PNG fuera de rango')
    const data = bytes.subarray(offset, offset + length); offset += length + 4
    if (type === 'IHDR') {
      if (data.length !== 13) fail('PIXABAY_IMAGE_INVALID_BYTES', 'IHDR PNG inválido')
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'tRNS') trns = data
    else if (type === 'IEND') break
  }
  if (!width || !height || width > PIXABAY_MAX_DIMENSION || height > PIXABAY_MAX_DIMENSION) fail('PIXABAY_IMAGE_DIMENSIONS_INVALID', 'Dimensiones PNG inválidas')
  const hasAlpha = colorType === 4 || colorType === 6 || (colorType === 3 && !!trns)
  const warnings: string[] = []
  let alphaUseful = false
  if (colorType === 3 && trns) alphaUseful = trns.some(value => value < 255)
  else if ((colorType === 4 || colorType === 6) && bitDepth === 8 && interlace === 0 && idat.length) {
    const channels = colorType === 6 ? 4 : 2
    const rowBytes = width * channels
    let data: Buffer
    try { data = inflateSync(Buffer.concat(idat)) } catch { fail('PIXABAY_IMAGE_INVALID_BYTES', 'IDAT PNG no se puede descomprimir') }
    if (data.length !== height * (rowBytes + 1)) fail('PIXABAY_IMAGE_INVALID_BYTES', 'Tamaño PNG descomprimido inválido')
    let prior = Buffer.alloc(rowBytes), cursor = 0
    for (let row = 0; row < height; row++) {
      const filter = data[cursor++]; const current = Buffer.from(data.subarray(cursor, cursor + rowBytes)); cursor += rowBytes
      for (let x = 0; x < rowBytes; x++) {
        const left = x >= channels ? current[x - channels] : 0
        const up = prior[x]
        const upLeft = x >= channels ? prior[x - channels] : 0
        if (filter === 1) current[x] = (current[x] + left) & 255
        else if (filter === 2) current[x] = (current[x] + up) & 255
        else if (filter === 3) current[x] = (current[x] + Math.floor((left + up) / 2)) & 255
        else if (filter === 4) {
          const p = left + up - upLeft, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft)
          current[x] = (current[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255
        } else if (filter !== 0) fail('PIXABAY_IMAGE_INVALID_BYTES', 'Filtro PNG inválido')
      }
      for (let x = channels - 1; x < rowBytes; x += channels) if (current[x] < 255) { alphaUseful = true; break }
      prior = current
      if (alphaUseful) break
    }
  } else if (hasAlpha) warnings.push('PIXABAY_IMAGE_ALPHA_NOT_DECODED')
  return { mime: 'image/png', extension: 'png', width, height, hasAlpha, alphaUseful, warnings: Object.freeze(warnings) }
}

function jpegInspection(bytes: Buffer): RasterImageInspectionV1 {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('PIXABAY_IMAGE_INVALID_BYTES', 'JPEG inválido')
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue }
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if (marker === 0xd9 || marker === 0xda) break
    if (offset + 2 > bytes.length) break
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) break
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      const height = bytes.readUInt16BE(offset + 3), width = bytes.readUInt16BE(offset + 5)
      if (!width || !height || width > PIXABAY_MAX_DIMENSION || height > PIXABAY_MAX_DIMENSION) fail('PIXABAY_IMAGE_DIMENSIONS_INVALID', 'Dimensiones JPEG inválidas')
      return { mime: 'image/jpeg', extension: 'jpg', width, height, hasAlpha: false, alphaUseful: false, warnings: Object.freeze([]) }
    }
    offset += length
  }
  fail('PIXABAY_IMAGE_DIMENSIONS_INVALID', 'JPEG sin SOF')
}

function webpInspection(bytes: Buffer): RasterImageInspectionV1 {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP')
    fail('PIXABAY_IMAGE_INVALID_BYTES', 'WebP inválido')
  let offset = 12, width = 0, height = 0, hasAlpha = false
  while (offset + 8 <= bytes.length) {
    const type = bytes.subarray(offset, offset + 4).toString('ascii')
    const length = bytes.readUInt32LE(offset + 4); const dataOffset = offset + 8
    if (dataOffset + length > bytes.length) break
    if (type === 'VP8X' && length >= 10) {
      hasAlpha = !!(bytes[dataOffset] & 0x10)
      width = 1 + readUInt24LE(bytes, dataOffset + 4); height = 1 + readUInt24LE(bytes, dataOffset + 7)
    } else if (type === 'ALPH') hasAlpha = true
    offset = dataOffset + length + (length % 2)
  }
  if (!width || !height || width > PIXABAY_MAX_DIMENSION || height > PIXABAY_MAX_DIMENSION) fail('PIXABAY_IMAGE_DIMENSIONS_INVALID', 'WebP sin VP8X válido')
  return { mime: 'image/webp', extension: 'webp', width, height, hasAlpha, alphaUseful: false,
    warnings: Object.freeze(hasAlpha ? ['PIXABAY_IMAGE_WEBP_ALPHA_REQUIRES_DECODE'] : []) }
}

/** Validates magic bytes and dimensions. `colors=transparent` is only a request; alpha is proven from bytes. */
export function inspectPixabayRasterImageV1(bytes: Buffer): RasterImageInspectionV1 {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > PIXABAY_MAX_IMAGE_BYTES)
    fail('PIXABAY_IMAGE_INVALID_BYTES', 'Imagen vacía o excede el límite')
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return pngInspection(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegInspection(bytes)
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return webpInspection(bytes)
  fail('PIXABAY_IMAGE_UNSUPPORTED_MIME', 'Formato de imagen no admitido')
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft
  const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft)
  return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
}

/**
 * Derives actual useful alpha bounds for the PNG formats that V1 can prove. Opaque rasters and
 * undecoded WebP alpha intentionally use the full canvas rather than inventing a subject crop.
 */
export function subjectBoundsFromPixabayRasterV1(bytes: Buffer): SubjectBoundsV1 {
  const inspection = inspectPixabayRasterImageV1(bytes)
  const full = fullSubjectBounds(inspection.width / inspection.height)
  if (inspection.mime !== 'image/png' || !inspection.alphaUseful) return full
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0
  const idat: Buffer[] = []
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset); offset += 4
    const type = bytes.subarray(offset, offset + 4).toString('ascii'); offset += 4
    const data = bytes.subarray(offset, offset + length); offset += length + 4
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 4 && colorType !== 6) || !idat.length) return full
  const channels = colorType === 6 ? 4 : 2
  const rowBytes = width * channels
  let data: Buffer
  try { data = inflateSync(Buffer.concat(idat)) } catch { return full }
  if (data.length !== height * (rowBytes + 1)) return full
  let prior = Buffer.alloc(rowBytes), cursor = 0
  let minX = width, minY = height, maxX = -1, maxY = -1, alphaWeight = 0, weightedX = 0, weightedY = 0
  for (let y = 0; y < height; y++) {
    const filter = data[cursor++]
    const current = Buffer.from(data.subarray(cursor, cursor + rowBytes)); cursor += rowBytes
    for (let x = 0; x < rowBytes; x++) {
      const left = x >= channels ? current[x - channels] : 0
      const up = prior[x]
      const upLeft = x >= channels ? prior[x - channels] : 0
      if (filter === 1) current[x] = (current[x] + left) & 255
      else if (filter === 2) current[x] = (current[x] + up) & 255
      else if (filter === 3) current[x] = (current[x] + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) current[x] = (current[x] + paeth(left, up, upLeft)) & 255
      else if (filter !== 0) return full
    }
    for (let x = 0; x < width; x++) {
      const alpha = current[x * channels + channels - 1]
      if (alpha <= 3) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      alphaWeight += alpha; weightedX += x * alpha; weightedY += y * alpha
    }
    prior = current
  }
  if (maxX < minX || maxY < minY || !alphaWeight) return full
  const x = minX / width, y = minY / height
  const visibleWidthRatio = (maxX - minX + 1) / width
  const visibleHeightRatio = (maxY - minY + 1) / height
  return {
    revision: 'subject-bounds-v1',
    alphaBounds: { x, y, width: visibleWidthRatio, height: visibleHeightRatio },
    visibleWidthRatio, visibleHeightRatio,
    centerOfMass: { x: (weightedX / alphaWeight + .5) / width, y: (weightedY / alphaWeight + .5) / height },
    aspectRatio: width / height,
    transparentPadding: { top: y, right: 1 - x - visibleWidthRatio,
      bottom: 1 - y - visibleHeightRatio, left: x },
  }
}

function sha256(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex') }

function regularFile(target: string): void {
  const stat = fs.lstatSync(target)
  if (!stat.isFile() || stat.isSymbolicLink()) fail('PIXABAY_IMAGE_NOT_REGULAR', 'Asset no es archivo regular')
}

export function verifyPixabayImageAssetContentV1(projectRoot: unknown, asset: ProjectAssetRecord): RasterImageInspectionV1 {
  return readVerifiedPixabayImageAssetContentV1(projectRoot, asset).inspection
}

/**
 * Provider-neutral raster gate used by the renderer. A future local-library adapter (for
 * example ByPeople after its audit) can publish the same ProjectAsset contract without adding
 * a provider-specific drawing path. Provider adapters still own provenance and publication;
 * the renderer only proves confined bytes, identity, MIME and raster structure.
 */
export function readVerifiedRasterProjectAssetContentV1(projectRoot: unknown, asset: ProjectAssetRecord): {
  bytes: Buffer
  inspection: RasterImageInspectionV1
  absoluteFile: string
} {
  const root = requireAssetProjectRoot(projectRoot)
  if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime))
    fail('RASTER_PROJECT_ASSET_INVALID', 'ProjectAsset no declara un MIME raster soportado')
  const absoluteFile = resolveProjectRelativePath(root, asset.relativeFile, true)
  if (!fs.existsSync(absoluteFile)) fail('PROJECT_ASSET_MISSING', 'Asset raster no existe')
  regularFile(absoluteFile)
  const bytes = fs.readFileSync(absoluteFile)
  if (bytes.length !== asset.byteLength) fail('PROJECT_ASSET_SIZE_MISMATCH', 'Tamaño raster no coincide')
  if (sha256(bytes) !== asset.sha256) fail('PROJECT_ASSET_SHA_MISMATCH', 'SHA raster no coincide')
  const inspection = inspectPixabayRasterImageV1(bytes)
  if (inspection.mime !== asset.mime) fail('PROJECT_ASSET_MIME_MISMATCH', 'MIME raster no coincide')
  return { bytes, inspection, absoluteFile }
}

/**
 * Reads once and returns the exact bytes that may be transported to the renderer.  Keeping the
 * verified buffer avoids a verify/read race in which the file could change between two reads.
 */
export function readVerifiedPixabayImageAssetContentV1(projectRoot: unknown, asset: ProjectAssetRecord): {
  bytes: Buffer
  inspection: RasterImageInspectionV1
  absoluteFile: string
} {
  if (!asset || asset.provider !== 'pixabay') fail('PIXABAY_IMAGE_ASSET_INVALID', 'ProjectAsset no corresponde a Pixabay')
  return readVerifiedRasterProjectAssetContentV1(projectRoot, asset)
}

/**
 * ProjectAsset-first lookup for a future explicit Pixabay preparation stage. It never requests
 * the provider and treats a stale/corrupt matching record as invalid rather than silently using it.
 */
export function findReusablePixabayImageAssetV1(projectRoot: unknown, candidate: Pick<PixabayImageCandidateV1, 'pageUrl' | 'downloadUrl'>): {
  asset: ProjectAssetRecord | null
  invalid: boolean
} {
  const root = requireAssetProjectRoot(projectRoot)
  const storage = readAssetStorage(root)
  if (storage.status === 'absent') return { asset: null, invalid: false }
  if (storage.status !== 'valid' && storage.status !== 'recovered-from-backup')
    return { asset: null, invalid: true }
  const sourceUrl = safeUrl(candidate.pageUrl, 'candidate.pageUrl')
  const fileUrl = safeUrl(candidate.downloadUrl, 'candidate.downloadUrl')
  const existing = storage.manifest!.assets.find(asset => asset.provider === 'pixabay' &&
    asset.source.sourceUrl === sourceUrl && asset.source.fileUrl === fileUrl && asset.validation.status === 'accepted')
  if (!existing) return { asset: null, invalid: false }
  try {
    verifyPixabayImageAssetContentV1(root, existing)
    return { asset: existing, invalid: false }
  } catch {
    return { asset: null, invalid: true }
  }
}

function writeAtomically(finalFile: string, bytes: Buffer): 'created' | 'reused' {
  if (fs.existsSync(finalFile)) {
    regularFile(finalFile)
    const existing = fs.readFileSync(finalFile)
    if (existing.length !== bytes.length || sha256(existing) !== sha256(bytes)) fail('PIXABAY_IMAGE_DESTINATION_CONFLICT', 'Destino Pixabay ya existe con otros bytes')
    return 'reused'
  }
  const temp = path.join(path.dirname(finalFile), '.' + path.basename(finalFile) + '.cipher-' + randomUUID() + '.tmp')
  let fd: number | undefined
  try {
    fd = fs.openSync(temp, 'wx')
    fs.writeFileSync(fd, bytes)
    fs.fsyncSync(fd)
    fs.closeSync(fd); fd = undefined
    const verified = fs.readFileSync(temp)
    if (verified.length !== bytes.length || sha256(verified) !== sha256(bytes)) fail('PIXABAY_IMAGE_TEMP_VERIFY_FAILED', 'Temporal Pixabay no verificó SHA')
    fs.renameSync(temp, finalFile)
    return 'created'
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd) } catch { /* best effort */ }
    if (fs.existsSync(temp)) try { fs.unlinkSync(temp) } catch { /* only this operation temporary */ }
  }
}

/** Publishes already-downloaded bytes only after validation; normal resolver search never invokes this automatically. */
export function publishPixabayImageAssetV1(input: {
  projectRoot: unknown
  candidate: PixabayImageCandidateV1
  bytes: Buffer
  fetchedAt?: string
  hooks?: { beforeManifestWrite?: () => void }
}): { status: 'created' | 'reused'; asset: ProjectAssetRecord; absoluteFile: string; warnings: readonly string[] } {
  const root = requireAssetProjectRoot(input.projectRoot)
  const inspection = inspectPixabayRasterImageV1(input.bytes)
  if (input.candidate.transparentRequested && !inspection.alphaUseful)
    fail('PIXABAY_IMAGE_ALPHA_REQUIRED', 'La consulta pidió aislamiento pero los bytes no tienen alpha útil')
  const contentSha = sha256(input.bytes)
  const storage = readAssetStorage(root)
  if (storage.status !== 'absent' && storage.status !== 'valid' && storage.status !== 'recovered-from-backup')
    fail('PIXABAY_IMAGE_MANIFEST_INVALID', 'Manifest existente no se puede usar')
  const existing = storage.status === 'absent' ? undefined : storage.manifest!.assets.find(asset =>
    asset.provider === 'pixabay' && asset.sha256 === contentSha && asset.mime === inspection.mime && asset.validation.status === 'accepted')
  if (existing) {
    verifyPixabayImageAssetContentV1(root, existing)
    return { status: 'reused', asset: existing, absoluteFile: resolveProjectRelativePath(root, existing.relativeFile, true), warnings: inspection.warnings }
  }
  const relativeFile = `materiales/assets/pixabay/${contentSha}.${inspection.extension}`
  const absoluteFile = resolveProjectRelativePath(root, relativeFile, true)
  fs.mkdirSync(path.dirname(absoluteFile), { recursive: true })
  const status = writeAtomically(absoluteFile, input.bytes)
  const candidate = input.candidate
  const asset: ProjectAssetRecord = {
    id: `pixabay-${candidate.id.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 36)}-${contentSha.slice(0, 12)}`,
    provider: 'pixabay', relativeFile, sha256: contentSha, mime: inspection.mime, byteLength: input.bytes.length,
    source: {
      sourceUrl: safeUrl(candidate.pageUrl, 'candidate.pageUrl'), fileUrl: safeUrl(candidate.downloadUrl, 'candidate.downloadUrl'),
      providerVersion: PIXABAY_IMAGES_PROVIDER_VERSION, licenseClaim: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/', attribution: 'Pixabay image ' + candidate.id,
      fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    },
    validation: { status: 'accepted', validatedAt: new Date().toISOString(), width: inspection.width, height: inspection.height,
      hasAlpha: inspection.hasAlpha, alphaUseful: inspection.alphaUseful, validationRevision: PIXABAY_IMAGE_VALIDATION_REVISION,
      warnings: [...inspection.warnings] },
  }
  try {
    input.hooks?.beforeManifestWrite?.()
    const prior = storage.status === 'absent' ? [] : storage.manifest!.assets
    saveAssetManifest(root, { assetManifestVersion: 1, assets: [...prior, asset] })
    verifyPixabayImageAssetContentV1(root, asset)
    return { status, asset, absoluteFile, warnings: inspection.warnings }
  } catch (error) {
    if (status === 'created') try { fs.unlinkSync(absoluteFile) } catch { /* orphan detection remains a later concern */ }
    throw error
  }
}
