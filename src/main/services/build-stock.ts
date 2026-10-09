import fs from 'fs'
import os from 'os'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { buildCodexProvider } from './build-planner'
import { isVerticalAspectRatioV1 } from '../../shared/aspect-ratio-v1'
import { stockCoverFilter } from '../../shared/editorial-scene-input'

export const BUILD_STOCK_VERSION = 'cipher-build-stock-v1'
export const BUILD_STOCK_MAX_CANDIDATES = 5
export const BUILD_STOCK_VISUAL_FINALISTS = 3
export const BUILD_STOCK_MIN_VISUAL_FIT = 40
export const BUILD_STOCK_PROVIDER_CONCURRENCY = 3
export const BUILD_STOCK_DOWNLOAD_CONCURRENCY = 3
export const BUILD_STOCK_PROVIDER_TIMEOUT_MS = 8_000
export const BUILD_STOCK_DOWNLOAD_TIMEOUT_MS = 30_000
export const BUILD_STOCK_VISUAL_TIMEOUT_MS = 90_000
const MAX_DOWNLOAD_BYTES = 180 * 1024 * 1024
const STOPWORDS = new Set((
  'a an and are as at be by for from in into is it of on or the to with without ' +
  'about after before between during near over under above below through around ' +
  'el la los las un una unos unas de del al en por para con sin sobre entre y o ' +
  'que se su sus como desde hasta hacia tras durante cerca junto este esta estos estas ' +
  'eso esa esos esas una uno hay donde cuando mientras porque pero tambien it its return returns ' +
  'cross crosses crossed crossing moves moved moving goes went going passes passed passing ' +
  'scientist scientists study studies covers covered'
).split(/\s+/))
const NASA_TERMS = new Set('nasa apollo iss astronaut space orbit orbital planet mars lunar moon satellite telescope galaxy universe cosmic rocket'.split(' '))
const PROVIDER_ORDER: Record<string, number> = { pexels: 0, pixabay: 1, coverr: 2, nasa: 3 }

export type BuildStockCandidate = {
  provider: 'pexels' | 'pixabay' | 'coverr' | 'nasa'
  id: string
  downloadUrl: string
  pageUrl?: string
  title: string
  description: string
  tags: string[]
  creator?: string
  license?: string
  width: number
  height: number
  duration?: number
  metadataRelevance?: number
  visualFit?: number
  visualReason?: string
  combinedRelevance?: number
}

export type BuildStockDecision = {
  schema: typeof BUILD_STOCK_VERSION
  buildId: string
  keyword: string
  query: string
  context: { phrase: string; before: string; after: string }
  ranking: 'metadata-visual-relevance-format-stable-v1'
  providerSearches: Array<Record<string, unknown>>
  candidates: Array<Record<string, unknown>>
  selected: Record<string, unknown> | null
  discarded: Array<Record<string, unknown>>
  visualReview: Record<string, unknown>
  crop: Record<string, unknown> | null
  reason: string
  timingsMs: Record<string, number>
  attempts: Array<Record<string, unknown>>
}

export type BuildStockInput = {
  buildId: string
  slotId: string
  keyword: string
  phrase: string
  contextBefore?: string
  contextAfter?: string
  durationSeconds: number
  aspectRatio: string
  stockCacheDirectory: string
  outputPath: string
  projectStockDirectory: string
  priorDecisions?: readonly any[]
  previousDecision?: BuildStockDecision | null
}

type MaterializedStockCandidate = BuildStockCandidate & {
  cachedPath: string
  sourceDuration: number
  offset: number
  useIndex: number
}

type ProviderMetrics = { provider: string; status: string; query: string; calls: number; elapsedMs: number; candidates: number; error?: string }
type Probe = { durationSeconds: number; width: number; height: number }
type StockDependencies = {
  fetch: typeof fetch
  codexProvider: { complete: (request: any) => Promise<any> }
  env: () => Record<string, string | undefined>
  now: () => number
  uuid: () => string
  probeVideo: (filePath: string) => Promise<Probe>
  runFfmpeg: (args: string[]) => Promise<void>
  cacheExists: (filePath: string) => boolean
  mkdir: (directory: string) => Promise<void>
  readBytes: (filePath: string) => Promise<Buffer>
  writeBytes: (filePath: string, bytes: Buffer) => Promise<void>
  rename: (from: string, to: string) => Promise<void>
  copyFile: (from: string, to: string) => Promise<void>
  remove: (filePath: string) => Promise<void>
  makeTempDirectory: () => Promise<string>
  removeTree: (directory: string) => Promise<void>
  logger: (message: string) => void | Promise<void>
  providerTimeoutMs: number
  downloadTimeoutMs: number
  visualTimeoutMs: number
  providerConcurrency: number
  downloadConcurrency: number
  maxCandidates: number
  visualFinalists: number
}

function execFileAsync(executable: string, args: string[], timeout = 30_000) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(executable, args, { windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(error)
      else resolve({ stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

async function probeStockVideo(filePath: string): Promise<Probe> {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'format=duration:stream=width,height', '-of', 'json', filePath], 15_000)
  let parsed: any
  try { parsed = JSON.parse(stdout) } catch { throw new Error('STOCK_MEDIA_PROBE_INVALID') }
  const durationSeconds = Number(parsed?.format?.duration)
  const stream = Array.isArray(parsed?.streams) ? parsed.streams[0] : null
  const width = Number(stream?.width), height = Number(stream?.height)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isInteger(width) || width <= 0 ||
      !Number.isInteger(height) || height <= 0) throw new Error('STOCK_MEDIA_INVALID')
  return { durationSeconds, width, height }
}

function words(value: unknown): string[] {
  return [...new Set(String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .match(/[a-z0-9]{3,}/g) || [])].filter(word => !STOPWORDS.has(word))
}

export function buildStockSearchQuery(input: { keyword: string; phrase: string; contextBefore?: string; contextAfter?: string }) {
  const keywordWords = words(input.keyword).slice(0, 3)
  const phraseWords = words(input.phrase).filter(word => !keywordWords.includes(word))
  const contextWords = words(`${input.contextAfter || ''} ${input.contextBefore || ''}`)
    .filter(word => !keywordWords.includes(word) && !phraseWords.includes(word))
  // Search endpoints such as NASA apply terms conjunctively. Keep a few high-signal
  // terms so scene context sharpens the query without making it so narrow that it
  // excludes otherwise relevant footage.
  const result = [...keywordWords, ...phraseWords.slice(0, 1), ...contextWords.slice(0, 1)].slice(0, 5)
  return result.join(' ').trim()
}

function uniqueTerms(input: { keyword: string; phrase: string; contextBefore?: string; contextAfter?: string }) {
  const weights = new Map<string, number>()
  for (const word of words(input.keyword)) weights.set(word, Math.max(weights.get(word) || 0, 3))
  for (const word of words(input.phrase)) weights.set(word, Math.max(weights.get(word) || 0, 2))
  for (const word of words(`${input.contextBefore || ''} ${input.contextAfter || ''}`))
    weights.set(word, Math.max(weights.get(word) || 0, 0.75))
  return weights
}

export function scoreBuildStockMetadata(candidate: Pick<BuildStockCandidate, 'title' | 'description' | 'tags'>,
  context: { keyword: string; phrase: string; contextBefore?: string; contextAfter?: string }) {
  const terms = uniqueTerms(context)
  if (!terms.size) return 0
  const haystack = words(`${candidate.title} ${candidate.description} ${(candidate.tags || []).join(' ')}`)
  const availableWeight = [...terms.values()].reduce((sum, value) => sum + value, 0)
  const matchedWeight = [...terms.entries()].reduce((sum, [word, value]) => sum + (haystack.includes(word) ? value : 0), 0)
  const phraseTerms = words(context.phrase)
  const phraseCoverage = phraseTerms.length ? phraseTerms.filter(word => haystack.includes(word)).length / phraseTerms.length : 0
  return Math.max(0, Math.min(100, Math.round(80 * matchedWeight / availableWeight + 20 * phraseCoverage)))
}

function stableCandidateKey(candidate: Pick<BuildStockCandidate, 'provider' | 'id'>) {
  return `${candidate.provider}:${candidate.id}`
}

function compareCandidateMetadata(a: BuildStockCandidate, b: BuildStockCandidate) {
  return (Number(b.metadataRelevance) - Number(a.metadataRelevance)) ||
    (PROVIDER_ORDER[a.provider] - PROVIDER_ORDER[b.provider]) || a.id.localeCompare(b.id)
}

export function rankBuildStockCandidates<T extends BuildStockCandidate>(candidates: T[], context: {
  keyword: string; phrase: string; contextBefore?: string; contextAfter?: string
}) {
  return candidates.map(candidate => ({ ...candidate,
    metadataRelevance: scoreBuildStockMetadata(candidate, context) })).sort(compareCandidateMetadata)
}

function formatScore(candidate: BuildStockCandidate, vertical: boolean) {
  let score = 0
  const hasDimensions = candidate.width > 0 && candidate.height > 0
  if (hasDimensions && ((candidate.height > candidate.width) === vertical)) score += 3
  if (candidate.width >= 1280 || candidate.height >= 1280) score += 2
  if (candidate.duration && candidate.duration >= 3 && candidate.duration <= 10) score += 1
  return score
}

function compareFinalCandidates(a: BuildStockCandidate, b: BuildStockCandidate, vertical: boolean) {
  return (Number(b.combinedRelevance) - Number(a.combinedRelevance)) ||
    (formatScore(b, vertical) - formatScore(a, vertical)) ||
    (PROVIDER_ORDER[a.provider] - PROVIDER_ORDER[b.provider]) || a.id.localeCompare(b.id)
}

function stableId(provider: string, id: unknown, fallback: string) {
  const value = String(id ?? '').trim()
  if (value) return value.slice(0, 120)
  return createHash('sha256').update(`${provider}\0${fallback}`).digest('hex').slice(0, 32)
}

function slugFromUrl(value: unknown) {
  try { return new URL(String(value)).pathname.split('/').filter(Boolean).pop()?.replace(/[-_]+/g, ' ') || '' }
  catch { return '' }
}

function safeHttpsUrl(value: unknown) {
  try { const url = new URL(String(value)); return url.protocol === 'https:' ? url.toString() : '' }
  catch { return '' }
}

export function safeNasaAssetUrl(value: unknown) {
  try {
    const url = new URL(String(value))
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname.toLowerCase() !== 'images-assets.nasa.gov') return ''
    url.protocol = 'https:'
    return url.toString()
  } catch { return '' }
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(tag => typeof tag === 'string' ? [tag] :
    typeof tag?.name === 'string' ? [tag.name] : []).map(tag => tag.trim()).filter(Boolean).slice(0, 20)
  if (typeof value === 'string') return value.split(/[,|]/).map(tag => tag.trim()).filter(Boolean).slice(0, 20)
  return []
}

function bestPexelsFile(files: any[], vertical: boolean) {
  return [...files].filter(file => safeHttpsUrl(file?.link) && (!file?.file_type || file.file_type === 'video/mp4'))
    .sort((a, b) => {
      const av = Number(a?.height) > Number(a?.width), bv = Number(b?.height) > Number(b?.width)
      const aspect = Number(bv === vertical) - Number(av === vertical)
      if (aspect) return aspect
      const area = (Number(b?.width) || 0) * (Number(b?.height) || 0) - (Number(a?.width) || 0) * (Number(a?.height) || 0)
      return area || String(a?.id || '').localeCompare(String(b?.id || ''))
    })[0]
}

function nasaIsRelevant(input: { keyword: string; phrase: string; contextBefore?: string; contextAfter?: string }) {
  const terms = words(`${input.keyword} ${input.phrase} ${input.contextBefore || ''} ${input.contextAfter || ''}`)
    .filter(term => NASA_TERMS.has(term))
  return terms.some(term => ['nasa', 'apollo', 'iss', 'mars', 'moon', 'astronaut'].includes(term)) || new Set(terms).size >= 2
}

function mapPexels(data: any, vertical: boolean): BuildStockCandidate[] {
  return (Array.isArray(data?.videos) ? data.videos : []).flatMap((video: any) => {
    const file = bestPexelsFile(Array.isArray(video?.video_files) ? video.video_files : [], vertical)
    if (!file) return []
    const pageUrl = safeHttpsUrl(video?.url)
    const tags = parseTags(video?.tags)
    const title = String(video?.title || video?.alt || slugFromUrl(video?.url) || tags.join(' ')).slice(0, 300)
    return [{ provider: 'pexels' as const, id: stableId('pexels', video?.id, pageUrl || title), downloadUrl: safeHttpsUrl(file.link),
      pageUrl: pageUrl || undefined, title, description: String(video?.description || '').slice(0, 1500), tags,
      creator: String(video?.user?.name || '').slice(0, 120) || undefined,
      width: Number(file.width) || 0, height: Number(file.height) || 0,
      duration: Number.isFinite(Number(video?.duration)) ? Number(video.duration) : undefined }]
  })
}

function mapPixabay(data: any): BuildStockCandidate[] {
  return (Array.isArray(data?.hits) ? data.hits : []).flatMap((hit: any) => {
    const rendition = hit?.videos?.large?.url ? hit.videos.large : hit?.videos?.medium
    const downloadUrl = safeHttpsUrl(rendition?.url)
    if (!downloadUrl) return []
    const pageUrl = safeHttpsUrl(hit?.pageURL)
    const tags = parseTags(hit?.tags)
    return [{ provider: 'pixabay' as const, id: stableId('pixabay', hit?.id, pageUrl || downloadUrl), downloadUrl,
      pageUrl: pageUrl || undefined, title: tags.slice(0, 6).join(' '), description: tags.join(', '), tags,
      creator: String(hit?.user || '').slice(0, 120) || undefined,
      width: Number(rendition?.width) || 0, height: Number(rendition?.height) || 0,
      duration: Number.isFinite(Number(hit?.duration)) ? Number(hit.duration) : undefined }]
  })
}

function mapCoverr(data: any): BuildStockCandidate[] {
  const hits = Array.isArray(data?.hits) ? data.hits : Array.isArray(data?.videos) ? data.videos : []
  return hits.flatMap((hit: any) => {
    const downloadUrl = safeHttpsUrl(hit?.urls?.mp4_download || hit?.urls?.mp4 || hit?.video_url)
    if (!downloadUrl) return []
    const pageUrl = safeHttpsUrl(hit?.url || hit?.page_url)
    const tags = parseTags(hit?.tags || hit?.keywords)
    const title = String(hit?.title || hit?.name || hit?.slug || tags.join(' ')).slice(0, 300)
    return [{ provider: 'coverr' as const, id: stableId('coverr', hit?.id || hit?.slug, pageUrl || downloadUrl), downloadUrl,
      pageUrl: pageUrl || undefined, title, description: String(hit?.description || '').slice(0, 1500), tags,
      creator: String(hit?.creator || hit?.author || '').slice(0, 120) || undefined,
      width: Number(hit?.width) || 0, height: Number(hit?.height) || 0,
      duration: Number.isFinite(Number(hit?.duration)) && Number(hit.duration) > 0 ? Number(hit.duration) : undefined }]
  })
}

function createSemaphore(limit: number) {
  let active = 0
  const waiting: Array<() => void> = []
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= Math.max(1, limit)) await new Promise<void>(resolve => waiting.push(resolve))
    active++
    try { return await task() }
    finally { active--; waiting.shift()?.() }
  }
}

async function mapLimited<T, R>(values: T[], limit: number, task: (value: T, index: number) => Promise<R>) {
  const output = new Array<R>(values.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(values.length, Math.max(1, limit)) }, async () => {
    while (true) {
      const index = next++
      if (index >= values.length) break
      output[index] = await task(values[index], index)
    }
  }))
  return output
}

function publicError(error: unknown) {
  const value = String((error as any)?.message || error || 'STOCK_PROVIDER_FAILED')
  const code = value.match(/(?:HTTP_\d{3}|TIMEOUT|ABORTED|FAILED|INVALID|UNAVAILABLE|MISSING|CORRUPT|TOO_SHORT|CANCELLED)(?::[A-Z0-9_:-]+)?/i)
  return (code?.[0] || value.split(/\r?\n/, 1)[0]).slice(0, 180)
}

export const BUILD_STOCK_VISUAL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reviews'], properties: { reviews: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['candidateIndex', 'visualFit', 'reason'], properties: {
      candidateIndex: { type: 'integer', minimum: 1 }, visualFit: { type: 'integer', minimum: 0, maximum: 100 },
      reason: { type: 'string', minLength: 1, maxLength: 320 },
    },
  } } },
} as const

function parseVisualReview(text: unknown, count: number) {
  const raw = String(text || '').trim(), first = raw.indexOf('{'), last = raw.lastIndexOf('}')
  if (first < 0 || last <= first) throw new Error('STOCK_CODEX_REVIEW_JSON_INVALID')
  let parsed: any
  try { parsed = JSON.parse(raw.slice(first, last + 1)) } catch { throw new Error('STOCK_CODEX_REVIEW_JSON_INVALID') }
  if (!Array.isArray(parsed?.reviews) || parsed.reviews.length !== count) throw new Error('STOCK_CODEX_REVIEW_INCOMPLETE')
  const sorted = [...parsed.reviews].sort((a: any, b: any) => Number(a?.candidateIndex) - Number(b?.candidateIndex))
  return sorted.map((review: any, index: number) => {
    if (review?.candidateIndex !== index + 1 || !Number.isInteger(review?.visualFit) || review.visualFit < 0 ||
        review.visualFit > 100 || typeof review.reason !== 'string' || !review.reason.trim() || review.reason.length > 320)
      throw new Error(`STOCK_CODEX_REVIEW_INVALID:${index + 1}`)
    return { visualFit: review.visualFit, reason: review.reason.trim() }
  })
}

function candidateRecord(candidate: BuildStockCandidate) {
  return { provider: candidate.provider, id: candidate.id, title: candidate.title, description: candidate.description,
    tags: candidate.tags, creator: candidate.creator || null, license: candidate.license || null,
    pageUrl: candidate.pageUrl || null, width: candidate.width, height: candidate.height,
    duration: candidate.duration ?? null, metadataRelevance: candidate.metadataRelevance ?? null,
    visualFit: candidate.visualFit ?? null, visualReason: candidate.visualReason || null,
    combinedRelevance: candidate.combinedRelevance ?? null }
}

function oldTechnicalScore(candidate: BuildStockCandidate, vertical: boolean) {
  return formatScore(candidate, vertical)
}

export function compareBuildStockRanking(base: BuildStockCandidate[], improved: BuildStockCandidate[], vertical: boolean,
  context: { keyword: string; phrase: string; contextBefore?: string; contextAfter?: string }) {
  const baseTop = [...base].sort((a, b) => oldTechnicalScore(b, vertical) - oldTechnicalScore(a, vertical) ||
    (PROVIDER_ORDER[a.provider] - PROVIDER_ORDER[b.provider]) || a.id.localeCompare(b.id))[0]
  const improvedTop = rankBuildStockCandidates(improved, context).sort((a, b) => compareCandidateMetadata(a, b) ||
    (oldTechnicalScore(b, vertical) - oldTechnicalScore(a, vertical)))[0]
  return { baseTop: baseTop ? stableCandidateKey(baseTop) : null, improvedTop: improvedTop ? stableCandidateKey(improvedTop) : null }
}

export function createBuildStockService(overrides: Partial<StockDependencies> = {}) {
  const deps: StockDependencies = {
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    codexProvider: buildCodexProvider,
    env: () => process.env,
    now: () => performance.now(),
    uuid: () => randomUUID(),
    probeVideo: probeStockVideo,
    runFfmpeg: async args => { await execFileAsync('ffmpeg', args, 45_000) },
    cacheExists: filePath => { try { return fs.statSync(filePath).isFile() } catch { return false } },
    mkdir: directory => fs.promises.mkdir(directory, { recursive: true }).then(() => {}),
    readBytes: filePath => fs.promises.readFile(filePath),
    writeBytes: (filePath, bytes) => fs.promises.writeFile(filePath, bytes, { flag: 'wx' }),
    rename: (from, to) => fs.promises.rename(from, to),
    copyFile: (from, to) => fs.promises.copyFile(from, to),
    remove: filePath => fs.promises.rm(filePath, { force: true }),
    makeTempDirectory: () => fs.promises.mkdtemp(path.join(os.tmpdir(), 'cipher-stock-')),
    removeTree: directory => fs.promises.rm(directory, { recursive: true, force: true }),
    logger: message => console.log(message),
    providerTimeoutMs: BUILD_STOCK_PROVIDER_TIMEOUT_MS, downloadTimeoutMs: BUILD_STOCK_DOWNLOAD_TIMEOUT_MS,
    visualTimeoutMs: BUILD_STOCK_VISUAL_TIMEOUT_MS, providerConcurrency: BUILD_STOCK_PROVIDER_CONCURRENCY,
    downloadConcurrency: BUILD_STOCK_DOWNLOAD_CONCURRENCY, maxCandidates: BUILD_STOCK_MAX_CANDIDATES,
    visualFinalists: BUILD_STOCK_VISUAL_FINALISTS,
    ...overrides,
  }
  const downloadSemaphore = createSemaphore(deps.downloadConcurrency)
  const inFlightDownloads = new Map<string, Promise<{ path: string; probe: Probe }>>()
  const buildReservations = new Map<string, Map<string, number>>()

  async function jsonRequest(provider: string, url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    try {
      const response = await deps.fetch(url, { ...init, signal: controller.signal })
      if (!response.ok) throw new Error(`${provider.toUpperCase()}_HTTP_${response.status}`)
      return await response.json()
    } catch (error: any) {
      if (timedOut) throw new Error(`${provider.toUpperCase()}_TIMEOUT`)
      throw error
    } finally { clearTimeout(timer) }
  }

  async function bytesRequest(provider: string, url: string) {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, deps.downloadTimeoutMs)
    try {
      const response = await deps.fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`STOCK_DOWNLOAD_HTTP_${response.status}`)
      const size = Number(response.headers?.get?.('content-length')) || 0
      if (size > MAX_DOWNLOAD_BYTES) throw new Error('STOCK_DOWNLOAD_TOO_LARGE')
      const bytes = Buffer.from(await response.arrayBuffer())
      if (!bytes.length || bytes.length > MAX_DOWNLOAD_BYTES) throw new Error('STOCK_DOWNLOAD_SIZE_INVALID')
      return bytes
    } catch (error: any) {
      if (timedOut) throw new Error(`${provider.toUpperCase()}_DOWNLOAD_TIMEOUT`)
      throw error
    } finally { clearTimeout(timer) }
  }

  async function search(input: BuildStockInput, query: string, vertical: boolean) {
    const env = deps.env()
    const configs: Array<{ provider: string; enabled: boolean; run: (metrics: ProviderMetrics) => Promise<BuildStockCandidate[]> }> = [
      { provider: 'pexels', enabled: Boolean(env.PEXELS_API_KEY), run: async metrics => {
        const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=${vertical ? 'portrait' : 'landscape'}`
        metrics.calls++
        const data = await jsonRequest('pexels', url, { headers: { Authorization: String(env.PEXELS_API_KEY) } }, deps.providerTimeoutMs)
        return mapPexels(data, vertical)
      } },
      { provider: 'pixabay', enabled: Boolean(env.PIXABAY_API_KEY), run: async metrics => {
        const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(String(env.PIXABAY_API_KEY))}&q=${encodeURIComponent(query)}&per_page=10&safesearch=true`
        metrics.calls++
        return mapPixabay(await jsonRequest('pixabay', url, {}, deps.providerTimeoutMs))
      } },
      { provider: 'coverr', enabled: Boolean(env.COVERR_API_KEY), run: async metrics => {
        const url = `https://api.coverr.co/videos?query=${encodeURIComponent(query)}&page_size=10`
        metrics.calls++
        return mapCoverr(await jsonRequest('coverr', url, { headers: { Authorization: `Bearer ${env.COVERR_API_KEY}` } }, deps.providerTimeoutMs))
      } },
      { provider: 'nasa', enabled: nasaIsRelevant(input), run: async metrics => {
        metrics.calls++
        const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=video&page_size=5`
        const data = await jsonRequest('nasa', url, {}, deps.providerTimeoutMs)
        const items = Array.isArray(data?.collection?.items) ? data.collection.items : []
        const shortList = items.filter((item: any) => {
          const description = String(item?.data?.[0]?.description || '').toLowerCase()
          return !/(conference|briefing|webinar|full length|press conference)/.test(description)
        }).slice(0, deps.maxCandidates)
        const nasaCandidates = await mapLimited(shortList, 2, async (item: any): Promise<BuildStockCandidate | null> => {
          const first = item?.data?.[0] || {}
          const id = stableId('nasa', first.nasa_id, String(item?.href || first.title || ''))
          if (!first.nasa_id) return null
          metrics.calls++
          const assets = await jsonRequest('nasa', `https://images-api.nasa.gov/asset/${encodeURIComponent(first.nasa_id)}`,
            {}, deps.providerTimeoutMs)
          const files = (Array.isArray(assets?.collection?.items) ? assets.collection.items : [])
            .filter((asset: any) => typeof asset?.href === 'string' && /\.mp4(?:$|\?)/i.test(asset.href))
            .sort((a: any, b: any) => Number(/large/i.test(b.href)) - Number(/large/i.test(a.href)) || String(a.href).localeCompare(String(b.href)))
          const downloadUrl = safeNasaAssetUrl(files[0]?.href)
          if (!downloadUrl) return null
          const pageUrl = safeHttpsUrl(item?.href)
          return { provider: 'nasa' as const, id, downloadUrl, pageUrl: pageUrl || undefined,
            title: String(first.title || '').slice(0, 300), description: String(first.description || '').slice(0, 1500),
            tags: parseTags(first.keywords), creator: String(first.center || '').slice(0, 120) || undefined,
            width: 0, height: 0 }
        })
        return nasaCandidates.filter((candidate): candidate is BuildStockCandidate => candidate !== null)
      } },
    ]
    const enabled = configs.filter(config => config.enabled)
    const disabled = configs.filter(config => !config.enabled).map(config => ({ provider: config.provider,
      status: config.provider === 'nasa' ? 'skipped-not-domain-relevant' : 'disabled-no-credential', query, calls: 0, elapsedMs: 0, candidates: 0 }))
    const results = await mapLimited(enabled, deps.providerConcurrency, async config => {
      const started = deps.now()
      const metrics: ProviderMetrics = { provider: config.provider, status: 'ok', query, calls: 0, elapsedMs: 0, candidates: 0 }
      try {
        const candidates = await config.run(metrics)
        metrics.candidates = candidates.length
        return { metrics, candidates }
      } catch (error) {
        metrics.status = 'error'; metrics.error = publicError(error)
        return { metrics, candidates: [] as BuildStockCandidate[] }
      } finally { metrics.elapsedMs = Math.max(0, Math.round(deps.now() - started)) }
    })
    return { candidates: results.flatMap(result => result.candidates), metrics: [...results.map(result => result.metrics), ...disabled] }
  }

  async function cacheCandidate(candidate: BuildStockCandidate, cacheDirectory: string) {
    const cacheKey = stableCandidateKey(candidate)
    const cachePath = path.join(cacheDirectory, createHash('sha256').update(cacheKey).digest('hex').slice(0, 36) + '.mp4')
    const current = inFlightDownloads.get(cachePath)
    if (current) return await current
    const task = downloadSemaphore(async () => {
      if (deps.cacheExists(cachePath)) {
        try { return { path: cachePath, probe: await deps.probeVideo(cachePath) } }
        catch { await deps.remove(cachePath) }
      }
      const temporaryPath = `${cachePath}.${deps.uuid()}.tmp`
      try {
        const bytes = await bytesRequest(candidate.provider, candidate.downloadUrl)
        await deps.writeBytes(temporaryPath, bytes)
        const probe = await deps.probeVideo(temporaryPath)
        if (!Number.isFinite(probe.durationSeconds) || probe.durationSeconds <= 0 || probe.width <= 0 || probe.height <= 0)
          throw new Error('STOCK_MEDIA_INVALID')
        await deps.rename(temporaryPath, cachePath)
        return { path: cachePath, probe }
      } catch (error) { await deps.remove(temporaryPath); throw error }
    })
    inFlightDownloads.set(cachePath, task)
    try { return await task } finally { if (inFlightDownloads.get(cachePath) === task) inFlightDownloads.delete(cachePath) }
  }

  async function framesFor(candidatePath: string, offset: number, sourceSpan: number, tempDirectory: string, label: string) {
    const frames: string[] = []
    for (const [index, fraction] of [0.2, 0.5, 0.8].entries()) {
      const framePath = path.join(tempDirectory, `${label}-frame-${index + 1}.jpg`)
      const timestamp = Math.max(0, offset + sourceSpan * fraction)
      await deps.runFfmpeg(['-v', 'error', '-y', '-ss', timestamp.toFixed(3), '-i', candidatePath,
        '-frames:v', '1', '-vf', 'scale=480:270:force_original_aspect_ratio=decrease', framePath])
      if (!deps.cacheExists(framePath)) throw new Error('STOCK_FRAME_EXTRACTION_FAILED')
      frames.push(framePath)
    }
    return frames
  }

  async function inspectFinalists(candidates: MaterializedStockCandidate[], input: BuildStockInput,
    tempDirectory: string, callIndex: number) {
    const stageStarted = deps.now()
    const refs: string[] = []
    const inspectable: MaterializedStockCandidate[] = []
    const failedCandidates: Array<{ provider: string; id: string; error: string }> = []
    for (const [index, candidate] of candidates.entries()) {
      try {
        const frameSet = await framesFor((candidate as any).cachedPath, (candidate as any).offset || 0,
          input.durationSeconds / 0.8, tempDirectory, `review-${callIndex}-${index + 1}`)
        inspectable.push(candidate); refs.push(...frameSet)
      } catch (error) { failedCandidates.push({ provider: candidate.provider, id: candidate.id, error: publicError(error) }) }
    }
    if (!inspectable.length) return { candidates: inspectable, failedCandidates, reviews: [], calls: 0, providerMs: 0,
      elapsedMs: Math.round(deps.now() - stageStarted), error: undefined as string | undefined }
    const description = inspectable.map((candidate, index) => `Candidato ${index + 1}: ${candidate.provider}/${candidate.id}. ` +
      `Título: ${candidate.title || '(sin título)'}. Etiquetas: ${candidate.tags.join(', ') || '(sin etiquetas)'}. ` +
      `Fotogramas adjuntos ${index * 3 + 1}, ${index * 3 + 2} y ${index * 3 + 3} corresponden a este candidato.`).join('\n')
    const prompt = [
      'Evalúa visualmente fotogramas de candidatos de vídeo Stock para una escena del montaje. Devuelve solo JSON según el esquema.',
      'Cada grupo de tres imágenes adjuntas corresponde al candidato descrito en el mismo orden. Mira el contenido visible del fotograma, no infieras contenido desde título o etiquetas.',
      'Puntúa cuánto muestra cada vídeo la acción, sujeto y contexto pedidos. No puntúes resolución ni orientación. Si el contenido no permite identificar la escena, usa puntuación baja y explica por qué.',
      'El sujeto principal y la acción solicitada son criterios dominantes. Si no aparecen en los fotogramas, asigna como máximo 25 puntos aunque coincida el paisaje, el tema general, el título o las etiquetas.',
      `Frase: ${input.phrase}`, `Contexto anterior: ${input.contextBefore || '(vacío)'}`,
      `Contexto siguiente: ${input.contextAfter || '(vacío)'}`, `Keyword inicial de Codex: ${input.keyword}`,
      `Duración que debe cubrir el recorte: ${input.durationSeconds.toFixed(2)} s.`, description,
      'Devuelve una revisión por cada candidato, con índice empezando en 1, visualFit de 0 a 100 y un motivo breve anclado en los fotogramas.',
    ].join('\n')
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, deps.visualTimeoutMs)
    const started = deps.now()
    try {
      const result = await deps.codexProvider.complete({ purpose: 'build-planner', prompt, referencePaths: refs,
        outputSchema: BUILD_STOCK_VISUAL_SCHEMA, signal: controller.signal })
      return { candidates: inspectable, failedCandidates, reviews: parseVisualReview(result?.text, inspectable.length), calls: 1,
        providerMs: Number(result?.providerTiming?.elapsedMs) || Math.round(deps.now() - started),
        elapsedMs: Math.round(deps.now() - stageStarted), model: String(result?.model || 'Codex configured model'), frameCount: refs.length }
    } catch (error) {
      return { candidates: inspectable, failedCandidates, reviews: [], calls: 1,
        providerMs: Math.round(deps.now() - started), elapsedMs: Math.round(deps.now() - stageStarted),
        error: timedOut ? 'STOCK_CODEX_REVIEW_TIMEOUT' : `STOCK_CODEX_REVIEW_FAILED:${publicError(error)}` }
    } finally { clearTimeout(timer) }
  }

  return async function materializeStockBuildSlot(input: BuildStockInput): Promise<{ decision: BuildStockDecision; path: string }> {
    const overallStarted = deps.now()
    const context = { phrase: String(input.phrase || '').trim(), before: String(input.contextBefore || '').trim(),
      after: String(input.contextAfter || '').trim() }
    if (!input.keyword || !input.keyword.trim() || /^b-?roll$/i.test(input.keyword.trim())) throw new Error('STOCK_KEYWORD_MISSING')
    if (!context.phrase || !Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0)
      throw new Error('STOCK_SCENE_CONTEXT_INVALID')
    const queryStarted = deps.now()
    const query = buildStockSearchQuery({ keyword: input.keyword, phrase: context.phrase,
      contextBefore: context.before, contextAfter: context.after })
    const queryBuildMs = Math.round(deps.now() - queryStarted)
    const vertical = isVerticalAspectRatioV1(input.aspectRatio)
    const prior = (input.priorDecisions || []).filter(decision => decision?.buildId === input.buildId)
    const priorSelections = prior.map(decision => decision?.selected).filter(Boolean)
    const usedKeys = new Set(priorSelections.map((candidate: any) => `${candidate.provider}:${candidate.id}`))
    const priorSlot = input.previousDecision?.schema === BUILD_STOCK_VERSION ? input.previousDecision : null
    const previousAttempts = Array.isArray(priorSlot?.attempts) ? priorSlot!.attempts.slice(-19) : []
    const discarded: Array<Record<string, unknown>> = []
    const providerSearches: Array<Record<string, unknown>> = []
    const candidateRecords: Array<Record<string, unknown>> = []
    const visualReview: Record<string, any> = { status: 'pending', provider: 'codex-app-server', calls: 0,
      providerMs: 0, frameCount: 0, candidates: [] }
    const stageTimes: Record<string, number> = { queryBuildMs, providerSearchMs: 0, metadataRankingMs: 0,
      downloadValidationMs: 0, visualInspectionMs: 0, cropMs: 0 }
    const makeDecision = (selected: Record<string, unknown> | null, crop: Record<string, unknown> | null, reason: string): BuildStockDecision => ({
      schema: BUILD_STOCK_VERSION, buildId: input.buildId, keyword: input.keyword, query, context,
      ranking: 'metadata-visual-relevance-format-stable-v1', providerSearches, candidates: candidateRecords,
      selected, discarded: [...discarded], visualReview, crop, reason, timingsMs: { ...stageTimes },
      attempts: [...previousAttempts, { at: new Date().toISOString(), query, providerSearches: [...providerSearches],
        candidates: [...candidateRecords], selected, discarded: [...discarded], visualReview: { ...visualReview },
        crop, timingsMs: { ...stageTimes }, reason }].slice(-20),
    })
    const fail = (code: string, selected: Record<string, unknown> | null = null, crop: Record<string, unknown> | null = null): never => {
      stageTimes.totalMs = Math.round(deps.now() - overallStarted)
      const decision = makeDecision(selected, crop, code)
      const error: any = new Error(code)
      error.stockDecision = decision
      throw error
    }
    let tempDirectory = ''
    let reservationScope = ''
    const reservedKeys = new Set<string>()
    let selectedReservationKey = ''
    try {
      await deps.mkdir(input.stockCacheDirectory)
      const searchStarted = deps.now()
      const searchResult = await search(input, query, vertical)
      stageTimes.providerSearchMs = Math.round(deps.now() - searchStarted)
      providerSearches.push(...searchResult.metrics)
      const rankingStarted = deps.now()
      const ranked = rankBuildStockCandidates(searchResult.candidates, { keyword: input.keyword, phrase: context.phrase,
        contextBefore: context.before, contextAfter: context.after })
      stageTimes.metadataRankingMs = Math.round(deps.now() - rankingStarted)
      candidateRecords.push(...ranked.map(candidateRecord))
      if (!ranked.length) fail('STOCK_NO_RESULTS')

      const reservationKey = input.stockCacheDirectory + ':' + input.buildId
      reservationScope = reservationKey
      if (!buildReservations.has(reservationKey)) buildReservations.set(reservationKey, new Map())
      const reservations = buildReservations.get(reservationKey)!
      const valid: MaterializedStockCandidate[] = []
      const deferredDuplicates: BuildStockCandidate[] = []
      const attempted = new Set<string>()
      const maxAttempts = Math.min(deps.maxCandidates, ranked.length)
      const downloadStarted = deps.now()
      for (const candidate of ranked.slice(0, maxAttempts)) {
        const key = stableCandidateKey(candidate)
        attempted.add(key)
        const previousUseCount = priorSelections.filter((selected: any) => `${selected.provider}:${selected.id}` === key).length
        const reservedUseCount = reservations.get(key) || 0
        const duplicate = usedKeys.has(key) || reservedUseCount > 0
        const hasUnusedChoice = valid.some(other => {
          const otherKey = stableCandidateKey(other)
          return !usedKeys.has(otherKey) && otherKey !== key
        }) || ranked.some(other => {
          const otherKey = stableCandidateKey(other)
          return !usedKeys.has(otherKey) && !reservations.has(otherKey) && !attempted.has(otherKey)
        }) || ranked.some(other => {
          const otherKey = stableCandidateKey(other)
          return !usedKeys.has(otherKey) && !reservations.has(otherKey) && otherKey !== key
        })
        if (duplicate && hasUnusedChoice) {
          discarded.push({ provider: candidate.provider, id: candidate.id, reason: 'PREVIOUSLY_SELECTED_IN_THIS_BUILD' })
          deferredDuplicates.push(candidate)
          continue
        }
        reservations.set(key, reservedUseCount + 1)
        reservedKeys.add(key)
        try {
          const cached = await cacheCandidate(candidate, input.stockCacheDirectory)
          const sourceDuration = cached.probe.durationSeconds
          const sourceSpan = input.durationSeconds / 0.8
          if (sourceDuration + 1 / 30 < sourceSpan) {
            discarded.push({ provider: candidate.provider, id: candidate.id, reason: 'CANDIDATE_TOO_SHORT',
              sourceDurationSeconds: sourceDuration, requiredSourceSeconds: sourceSpan })
            continue
          }
          const useIndex = Math.max(previousUseCount, reservedUseCount)
          const margin = Math.max(0, sourceDuration - sourceSpan)
          const offset = margin > 0.2 ? Math.round(margin * vanDerCorput(useIndex) * 100) / 100 : 0
          valid.push({ ...candidate, width: cached.probe.width, height: cached.probe.height,
            duration: sourceDuration, cachedPath: cached.path, sourceDuration, offset, useIndex })
        } catch (error) {
          discarded.push({ provider: candidate.provider, id: candidate.id, reason: publicError(error), stage: 'download-validation' })
        }
      }
      if (!valid.length) for (const candidate of deferredDuplicates) {
        const key = stableCandidateKey(candidate)
        const reservedUseCount = reservations.get(key) || 0
        reservations.set(key, reservedUseCount + 1)
        reservedKeys.add(key)
        try {
          const cached = await cacheCandidate(candidate, input.stockCacheDirectory)
          const sourceDuration = cached.probe.durationSeconds, sourceSpan = input.durationSeconds / 0.8
          if (sourceDuration + 1 / 30 < sourceSpan) {
            discarded.push({ provider: candidate.provider, id: candidate.id, reason: 'CANDIDATE_TOO_SHORT',
              sourceDurationSeconds: sourceDuration, requiredSourceSeconds: sourceSpan })
            continue
          }
          const previousUseCount = priorSelections.filter((selected: any) => `${selected.provider}:${selected.id}` === key).length
          const useIndex = Math.max(previousUseCount, reservedUseCount)
          const margin = Math.max(0, sourceDuration - sourceSpan)
          const offset = margin > 0.2 ? Math.round(margin * vanDerCorput(useIndex) * 100) / 100 : 0
          valid.push({ ...candidate, width: cached.probe.width, height: cached.probe.height, duration: sourceDuration,
            cachedPath: cached.path, sourceDuration, offset, useIndex })
          if (valid.length) break
        } catch (error) { discarded.push({ provider: candidate.provider, id: candidate.id,
          reason: publicError(error), stage: 'download-validation' }) }
      }
      stageTimes.downloadValidationMs = Math.round(deps.now() - downloadStarted)
      candidateRecords.splice(0, candidateRecords.length, ...ranked.map(candidate => {
        const prepared = valid.find(value => stableCandidateKey(value) === stableCandidateKey(candidate))
        return candidateRecord(prepared || candidate)
      }))
      if (!valid.length) fail('STOCK_NO_VALID_CANDIDATE')
      tempDirectory = await deps.makeTempDirectory()

      const candidatesToReview = valid.slice(0, Math.min(deps.visualFinalists, valid.length))
      const reviewed = await inspectFinalists(candidatesToReview, input, tempDirectory, 1)
      stageTimes.visualInspectionMs += reviewed.elapsedMs || reviewed.providerMs
      visualReview.calls += reviewed.calls
      visualReview.providerMs += reviewed.providerMs
      for (const rejected of reviewed.failedCandidates || []) discarded.push({ ...rejected,
        reason: rejected.error, stage: 'frame-extraction' })
      if (reviewed.error) {
        visualReview.status = 'error'; visualReview.error = reviewed.error
        fail(reviewed.error)
      }
      visualReview.status = reviewed.calls ? 'complete' : 'pending-next-candidate'
      if (reviewed.model) visualReview.model = reviewed.model
      visualReview.frameCount += reviewed.frameCount || 0
      visualReview.candidates.push(...reviewed.candidates.map((candidate, index) => ({ provider: candidate.provider, id: candidate.id,
        visualFit: reviewed.reviews[index].visualFit, reason: reviewed.reviews[index].reason })))
      reviewed.candidates.forEach((candidate, index) => {
        candidate.visualFit = reviewed.reviews[index].visualFit
        candidate.visualReason = reviewed.reviews[index].reason
        candidate.combinedRelevance = Math.round(Number(candidate.metadataRelevance || 0) * 0.65 + Number(candidate.visualFit || 0) * 0.35)
      })

      const remaining = valid.filter(candidate => !reviewed.candidates.includes(candidate) &&
        !(reviewed.failedCandidates || []).some(failed => failed.provider === candidate.provider && failed.id === candidate.id))
      const unreviewed = [...remaining]
      const ordered: typeof valid = [...reviewed.candidates.sort((a, b) => compareFinalCandidates(a, b, vertical))]
      let cursor = 0
      const cropStarted = deps.now()
      while (cursor < ordered.length || unreviewed.length) {
        if (cursor >= ordered.length) {
          const nextBatch = unreviewed.splice(0, 1)
          const nextReview = await inspectFinalists(nextBatch, input, tempDirectory, visualReview.calls + 1)
          stageTimes.visualInspectionMs += nextReview.elapsedMs || nextReview.providerMs
          visualReview.calls += nextReview.calls
          visualReview.providerMs += nextReview.providerMs
          if (nextReview.error) { visualReview.status = 'error'; visualReview.error = nextReview.error; fail(nextReview.error) }
          if (nextReview.calls) {
            visualReview.status = 'complete'
            if (nextReview.model) visualReview.model = nextReview.model
            visualReview.frameCount += nextReview.frameCount || 0
          }
          for (const rejected of nextReview.failedCandidates || []) discarded.push({ ...rejected,
            reason: rejected.error, stage: 'frame-extraction' })
          if (!nextReview.candidates.length) continue
          const reviewedCandidate = nextReview.candidates[0]
          reviewedCandidate.visualFit = nextReview.reviews[0].visualFit
          reviewedCandidate.visualReason = nextReview.reviews[0].reason
          reviewedCandidate.combinedRelevance = Math.round(Number(reviewedCandidate.metadataRelevance || 0) * 0.65 + Number(reviewedCandidate.visualFit || 0) * 0.35)
          visualReview.candidates.push({ provider: reviewedCandidate.provider, id: reviewedCandidate.id,
            visualFit: reviewedCandidate.visualFit, reason: reviewedCandidate.visualReason })
          ordered.push(reviewedCandidate)
        }
        const candidate = ordered[cursor++]
        const visualFit = Number(candidate.visualFit || 0)
        if (visualFit < BUILD_STOCK_MIN_VISUAL_FIT) {
          discarded.push({ provider: candidate.provider, id: candidate.id, reason: 'VISUAL_RELEVANCE_BELOW_MINIMUM',
            visualFit, minimumVisualFit: BUILD_STOCK_MIN_VISUAL_FIT, visualReason: candidate.visualReason })
          continue
        }
        const selectedRecord = { provider: candidate.provider, id: candidate.id, title: candidate.title,
          pageUrl: candidate.pageUrl || null, metadataRelevance: candidate.metadataRelevance,
          visualFit, visualReason: candidate.visualReason, combinedRelevance: candidate.combinedRelevance,
          reason: visualFit >= 60 ? 'BEST_SCENE_MATCH_AFTER_FRAME_REVIEW' : 'BEST_AVAILABLE_SCENE_MATCH_AFTER_FRAME_REVIEW',
          useIndex: candidate.useIndex, repeated: candidate.useIndex > 0 }
        const tempOutput = `${input.outputPath}.${deps.uuid()}.tmp.mp4`
        const filter = stockCoverFilter(input.aspectRatio)
        const cropRecord: Record<string, any> = { offsetSeconds: candidate.offset, durationSeconds: input.durationSeconds,
          sourceDurationSeconds: candidate.sourceDuration, sourceSecondsRequired: input.durationSeconds / 0.8,
          filter, validation: 'pending' }
        try {
          await deps.runFfmpeg(['-v', 'error', '-y', '-ss', candidate.offset.toFixed(3), '-i', candidate.cachedPath,
            '-vf', filter, '-t', input.durationSeconds.toFixed(3), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', tempOutput])
          const cropped = await deps.probeVideo(tempOutput)
          if (cropped.durationSeconds + 1 / 30 < input.durationSeconds) throw new Error('STOCK_CROP_TOO_SHORT')
          if (cropped.width <= 0 || cropped.height <= 0) throw new Error('STOCK_CROP_INVALID')
          cropRecord.validation = 'valid'
          cropRecord.outputDurationSeconds = cropped.durationSeconds
          cropRecord.outputWidth = cropped.width
          cropRecord.outputHeight = cropped.height
          await deps.remove(input.outputPath)
          await deps.rename(tempOutput, input.outputPath)
          await deps.mkdir(input.projectStockDirectory)
          const stockCopy = path.join(input.projectStockDirectory, `stock_${input.slotId}.mp4`)
          const tempCopy = `${stockCopy}.${deps.uuid()}.tmp`
          await deps.copyFile(input.outputPath, tempCopy)
          await deps.remove(stockCopy)
          await deps.rename(tempCopy, stockCopy)
          stageTimes.cropMs = Math.round(deps.now() - cropStarted)
          stageTimes.totalMs = Math.round(deps.now() - overallStarted)
          candidateRecords.splice(0, candidateRecords.length, ...valid.map(candidateRecord))
          const decision = makeDecision({ ...selectedRecord, cacheKey: stableCandidateKey(candidate),
            cacheFile: path.basename(candidate.cachedPath), projectFile: path.basename(stockCopy) }, cropRecord,
          candidate.useIndex > 0 ? 'BEST_RELEVANT_UNUSED_CANDIDATE_POOL_EXHAUSTED_REUSE_WITH_NEW_CROP' : 'BEST_RELEVANT_VISUALLY_REVIEWED')
          await deps.logger(`[Build Stock] slot=${input.slotId} provider=${candidate.provider} id=${candidate.id} ` +
            `metadata=${candidate.metadataRelevance} visual=${candidate.visualFit} query="${query}" attempts=${attempted.size}`)
          selectedReservationKey = stableCandidateKey(candidate)
          return { decision, path: input.outputPath }
        } catch (error) {
          await deps.remove(tempOutput)
          discarded.push({ provider: candidate.provider, id: candidate.id, reason: publicError(error), stage: 'crop-validation' })
        }
      }
      stageTimes.cropMs = Math.round(deps.now() - cropStarted)
      candidateRecords.splice(0, candidateRecords.length, ...valid.map(candidateRecord))
      fail(discarded.some(candidate => candidate.reason === 'VISUAL_RELEVANCE_BELOW_MINIMUM')
        ? 'STOCK_NO_RELEVANT_CANDIDATE' : 'STOCK_CANDIDATES_FAILED_MATERIALIZATION')
    } catch (error: any) {
      if (error?.stockDecision) throw error
      return fail(publicError(error))
    } finally {
      const reservations = reservationScope ? buildReservations.get(reservationScope) : null
      if (reservations) {
        for (const key of reservedKeys) {
          if (key === selectedReservationKey) continue
          const count = reservations.get(key) || 0
          if (count <= 1) reservations.delete(key)
          else reservations.set(key, count - 1)
        }
        if (!reservations.size) buildReservations.delete(reservationScope)
      }
      if (tempDirectory) await deps.removeTree(tempDirectory).catch(() => {})
    }
    throw new Error('STOCK_UNEXPECTED_FALLTHROUGH')
  }
}

function vanDerCorput(n: number) {
  let value = Math.max(0, Math.floor(n)), result = 0, denominator = 1
  while (value > 0) { denominator *= 2; result += (value % 2) / denominator; value = Math.floor(value / 2) }
  return result
}

export const materializeBuildStockSlot = createBuildStockService()
