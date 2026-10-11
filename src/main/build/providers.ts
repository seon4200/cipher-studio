import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { BuildInput, BuildScene, SceneResult, StockCandidateEvidence, StockSearchRecord } from '../../shared/build-plan';
import { MIN_CLIP_FRAMES } from '../../shared/build-plan';
import { BuildFailure, cutMedia, probe } from './media';
import { request } from './request';
import { readSearchCache, writeSearchCache } from './stock-search-cache';
import { assessStockCandidate, rankStockCandidates, sceneSearchQueries, type SearchCandidate } from './stock-selection';

type ProviderBatch = { totalHits?: number; candidates: SearchCandidate[]; cacheHit: boolean };
type SearchWriter = (records: StockSearchRecord[]) => Promise<void>;

const splitTags = (value: unknown): string[] | undefined => {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const clean = values.map(tag => String(tag).trim().slice(0, 100)).filter(Boolean).slice(0, 40);
  return clean.length ? clean : undefined;
};
const shortText = (value: unknown, length: number) => typeof value === 'string' ? value.trim().slice(0, length) || undefined : undefined;
const pageUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    url.search = ''; url.hash = '';
    return url.toString().slice(0, 500);
  } catch { return undefined; }
};
const safePixabayAssetUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && url.hostname.toLowerCase().endsWith('.pixabay.com') &&
      !url.username && !url.password && !url.search ? url.toString() : undefined;
  } catch { return undefined; }
};
const toCandidate = (value: any, provider: string, url: unknown, query: string, responseRank: number,
  dimensions: { width?: number; height?: number; duration?: number } = {}): SearchCandidate | null => {
  if (typeof value?.id !== 'string' && typeof value?.id !== 'number') return null;
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return null;
  return {
    id: String(value.id), provider, url, width: Number(value.width || dimensions.width || 0),
    height: Number(value.height || dimensions.height || 0), duration: Number(value.duration || dimensions.duration) || undefined,
    pageUrl: pageUrl(value.pageURL || value.url || value.webformatURL),
    title: shortText(value.title || value.name, 240), tags: splitTags(value.tags),
    type: shortText(value.type, 80), views: Number.isFinite(value.views) ? value.views : undefined,
    downloads: Number.isFinite(value.downloads) ? value.downloads : undefined,
    likes: Number.isFinite(value.likes) ? value.likes : undefined, query, responseRank,
  };
};
const cacheKey = (query: string) => createHash('sha256').update(JSON.stringify({
  provider: 'pixabay', query, lang: 'en', video_type: 'all', order: 'popular', page: 1, per_page: 3, safesearch: true,
})).digest('hex');

async function searchPixabay(query: string, input: BuildInput, signal: AbortSignal): Promise<ProviderBatch> {
  const file = path.join(input.projectPath, 'build', 'stock-search-cache', `${cacheKey(query)}.json`);
  const cached = await readSearchCache<{ totalHits?: number; candidates: SearchCandidate[] }>(file);
  if (cached && Array.isArray(cached.value.candidates)) {
    return { totalHits: cached.value.totalHits, cacheHit: true,
      candidates: cached.value.candidates.map(candidate => ({ ...candidate, query })) };
  }
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) throw new BuildFailure('CREDENTIALS', 'Pixabay no tiene credenciales configuradas.');
  const encoded = encodeURIComponent(query);
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encoded}&lang=en&video_type=all&order=popular&page=1&per_page=3&safesearch=true`;
  const response = await request(url, signal);
  const data: any = await response.json();
  const candidates: SearchCandidate[] = (data.hits || []).slice(0, 3).flatMap((video: any, index: number) => {
    // Pixabay can return an empty large URL while medium is usable; choose the first usable rendition.
    const file = [video.videos?.large, video.videos?.medium, video.videos?.small, video.videos?.tiny]
      .find(item => typeof item?.url === 'string' && item.url);
    const candidate = toCandidate({ ...video, pageURL: video.pageURL, type: video.type }, 'pixabay', file?.url,
      query, index + 1, { width: file?.width, height: file?.height, duration: video.duration });
    return candidate ? [candidate] : [];
  });
  const totalHits = Number.isFinite(data.totalHits) ? data.totalHits : undefined;
  const cacheable = candidates.every(candidate => !!safePixabayAssetUrl(candidate.url));
  if (cacheable) await writeSearchCache(file, { totalHits, candidates: candidates.map(candidate => ({
    ...candidate, url: safePixabayAssetUrl(candidate.url)!,
  })) });
  return { totalHits, candidates, cacheHit: false };
}

async function searchPexels(query: string, aspectRatio: string, signal: AbortSignal): Promise<ProviderBatch> {
  const vertical = aspectRatio === '9:16' || aspectRatio === 'vertical';
  const response = await request(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3`, signal,
    { headers: { Authorization: process.env.PEXELS_API_KEY! } });
  const data: any = await response.json();
  const candidates: SearchCandidate[] = [];
  for (const [index, video] of (data.videos || []).slice(0, 3).entries()) {
    const file = (video.video_files || []).filter((item: any) => item.file_type === 'video/mp4')
      .sort((a: any, b: any) => Math.abs((a.height > a.width ? 1 : 0) - Number(vertical)) -
        Math.abs((b.height > b.width ? 1 : 0) - Number(vertical)) || b.width - a.width)[0];
    const candidate = toCandidate({ ...video, pageURL: video.url, tags: video.tags }, 'pexels', file?.link,
      query, index + 1, { width: file?.width, height: file?.height, duration: video.duration });
    if (candidate) candidates.push(candidate);
  }
  return { totalHits: Number.isFinite(data.total_results) ? data.total_results : undefined, candidates, cacheHit: false };
}

async function searchCoverr(query: string, signal: AbortSignal): Promise<ProviderBatch> {
  const response = await request(`https://api.coverr.co/videos?query=${encodeURIComponent(query)}&page_size=3&urls=true`, signal,
    { headers: { Authorization: `Bearer ${process.env.COVERR_API_KEY}` } });
  const data: any = await response.json();
  const candidates: SearchCandidate[] = [];
  for (const [index, video] of (data.hits || data.videos || []).slice(0, 3).entries()) {
    const url = video.urls?.mp4_download || video.urls?.mp4 || video.download_url;
    const candidate = toCandidate({ ...video, id: video.id || video.slug, pageURL: video.url }, 'coverr', url,
      query, index + 1, { width: video.width || 1920, height: video.height || 1080, duration: video.duration });
    if (candidate) candidates.push(candidate);
  }
  return { totalHits: Number.isFinite(data.total) ? data.total : undefined, candidates, cacheHit: false };
}

async function searchNasa(query: string, signal: AbortSignal): Promise<ProviderBatch> {
  const response = await request(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=video&page_size=3`, signal);
  const data: any = await response.json();
  const candidates: SearchCandidate[] = [];
  for (const [index, video] of (data.collection?.items || []).slice(0, 2).entries()) {
    const id = video.data?.[0]?.nasa_id;
    if (!id) continue;
    const asset: any = await (await request(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`, signal)).json();
    const file = (asset.collection?.items || []).find((item: any) => /^https:\/\//i.test(item.href || '') && /\.mp4(?:$|\?)/i.test(item.href));
    const candidate = toCandidate({ id, title: video.data?.[0]?.title, description: video.data?.[0]?.description,
      tags: video.data?.[0]?.keywords, pageURL: video.data?.[0]?.nasa_id ? `https://images.nasa.gov/details/${video.data[0].nasa_id}` : undefined },
    'nasa', file?.href, query, index + 1, { width: 1920, height: 1080 });
    if (candidate) candidates.push(candidate);
  }
  return { totalHits: Number.isFinite(data.collection?.metadata?.total_hits) ? data.collection.metadata.total_hits : undefined,
    candidates, cacheHit: false };
}

function evidenceFor(candidate: SearchCandidate, decision: StockCandidateEvidence['decision'], score: number,
  reasons: string[]): StockCandidateEvidence {
  return { providerId: candidate.provider, id: candidate.id, responseRank: candidate.responseRank,
    pageUrl: candidate.pageUrl, title: candidate.title, tags: candidate.tags, type: candidate.type,
    duration: candidate.duration, width: candidate.width, height: candidate.height, views: candidate.views,
    downloads: candidate.downloads, likes: candidate.likes, relevanceScore: score, decision, reasons };
}

async function searchStock(scene: BuildScene, input: BuildInput, signal: AbortSignal,
  onEvidence?: SearchWriter, usedCandidateIds: ReadonlySet<string> = new Set()) {
  const queries = sceneSearchQueries(scene);
  if (!queries.length) throw new BuildFailure('NO_STOCK_QUERY', 'La escena no tiene consultas Stock guardadas.');
  const providers = [
    ...(process.env.PEXELS_API_KEY ? [{ id: 'pexels', search: (q: string) => searchPexels(q, input.aspectRatio, signal) }] : []),
    ...(process.env.PIXABAY_API_KEY ? [{ id: 'pixabay', search: (q: string) => searchPixabay(q, input, signal) }] : []),
    ...(process.env.COVERR_API_KEY ? [{ id: 'coverr', search: (q: string) => searchCoverr(q, signal) }] : []),
    ...(/\b(space|planet|solar|moon|nasa|galaxy|star|astronaut|rocket|earth|universe|satellite|mars)\b/i.test(queries.join(' '))
      ? [{ id: 'nasa', search: (q: string) => searchNasa(q, signal) }] : []),
  ];
  if (!providers.length) throw new BuildFailure('CREDENTIALS', 'Configura Pexels, Pixabay o Coverr. NASA se consulta solo para temas espaciales.');

  const records: StockSearchRecord[] = [];
  const entries: { candidate: SearchCandidate; evidence: StockCandidateEvidence }[] = [];
  const errors: string[] = [];
  for (const query of queries) {
    for (const provider of providers) {
      signal.throwIfAborted();
      const requestedAt = new Date().toISOString();
      const record: StockSearchRecord = { providerId: provider.id, query, encodedQuery: encodeURIComponent(query),
        requestedAt, completedAt: requestedAt, status: 'failed', cacheHit: false, candidatesReceived: 0, candidates: [] };
      record.parameters = provider.id === 'pixabay' ? { q: query, lang: 'en', video_type: 'all', order: 'popular', page: 1, per_page: 3, safesearch: true }
        : provider.id === 'pexels' ? { query, per_page: 3 }
          : provider.id === 'coverr' ? { query, page_size: 3, urls: true }
            : { q: query, media_type: 'video', page_size: 3 };
      records.push(record);
      try {
        const result = await provider.search(query);
        record.completedAt = new Date().toISOString(); record.cacheHit = result.cacheHit;
        record.totalHits = result.totalHits; record.candidatesReceived = result.candidates.length;
        record.status = result.candidates.length ? 'completed' : 'empty';
        for (const candidate of result.candidates) {
          const assessment = assessStockCandidate(query, candidate);
          const evidence = evidenceFor(candidate, assessment.decision, assessment.score, assessment.reasons);
          record.candidates.push(evidence); entries.push({ candidate, evidence });
        }
      } catch (error) {
        signal.throwIfAborted();
        const code = error instanceof BuildFailure ? error.code : 'SEARCH_FAILED';
        record.completedAt = new Date().toISOString(); record.errorCode = code;
        errors.push(`${provider.id}: ${error instanceof Error ? error.message : 'Error de búsqueda.'}`);
      }
      await onEvidence?.(records);
    }
    // Avoid a second provider round when this query already has a supported,
    // unused candidate. A fallback query is only sent when the first has no safe choice.
    const queryHasUsableCandidate = entries.some(({ candidate, evidence }) => candidate.query === query &&
      evidence.decision === 'metadata-supported' && !usedCandidateIds.has(`${candidate.provider}:${candidate.id}`) &&
      !scene.rejectedCandidates.includes(`${candidate.provider}:${candidate.id}`));
    if (queryHasUsableCandidate) break;
  }
  if (!entries.length) {
    const failureCodes = records.filter(record => record.status === 'failed').map(record => record.errorCode);
    if (failureCodes.length && failureCodes.every(code => code === 'CREDENTIALS'))
      throw new BuildFailure('CREDENTIALS', errors.join(' · ') || 'El proveedor rechazó sus credenciales.');
    if (failureCodes.length && failureCodes.every(code => code === 'RATE_LIMIT'))
      throw new BuildFailure('RATE_LIMIT', 'El proveedor limita peticiones. Continúa más tarde.', true);
    if (failureCodes.length && failureCodes.every(code => code === 'NETWORK' || code === 'TIMEOUT'))
      throw new BuildFailure('NETWORK', 'No se pudo conectar con ningún proveedor Stock.', true);
    if (errors.length) throw new BuildFailure('NO_STOCK', errors.join(' · ') || 'La búsqueda no devolvió candidatos.', true);
    throw new BuildFailure('NO_STOCK', 'La búsqueda no devolvió candidatos Stock.', true);
  }

  const ranked = rankStockCandidates(entries.map(entry => entry.candidate), input.aspectRatio);
  const evidenceByCandidate = new Map(entries.map(entry => [entry.candidate, entry.evidence]));
  ranked.forEach(({ candidate }, index) => { const evidence = evidenceByCandidate.get(candidate); if (evidence) evidence.evaluationOrder = index + 1; });
  const unique = new Set<string>();
  for (const { candidate } of ranked) {
    const id = `${candidate.provider}:${candidate.id}`;
    const evidence = evidenceByCandidate.get(candidate)!;
    if (usedCandidateIds.has(id)) {
      evidence.decision = 'duplicate'; evidence.reasons.push('Este recurso ya está asignado a otra escena del mismo plan.');
    } else if (scene.rejectedCandidates.includes(id)) {
      evidence.decision = 'rejected'; evidence.reasons.push('Este recurso ya falló al descargarse o validarse en un intento anterior.');
    } else if (unique.has(id)) {
      evidence.decision = 'duplicate'; evidence.reasons.push('El mismo ID apareció en más de una respuesta de búsqueda.');
    } else unique.add(id);
  }
  const supported = ranked.filter(({ candidate }) => {
    const item = evidenceByCandidate.get(candidate)!;
    return item.decision === 'metadata-supported';
  }).map(({ candidate }) => candidate);
  if (!supported.length) {
    scene.stockReviewStatus = 'pending';
    const best = ranked.find(({ candidate }) => evidenceByCandidate.get(candidate)?.decision === 'pending-review');
    await onEvidence?.(records);
    throw new BuildFailure('STOCK_REVIEW', best
      ? `La escena ${scene.id} no tiene un candidato Stock suficientemente respaldado por metadatos. Requiere revisión visual; no se descargó ningún candidato.`
      : `La escena ${scene.id} no tiene un candidato Stock nuevo y pertinente. No se sustituirá por Original.`, false);
  }
  scene.stockReviewStatus = undefined;
  return { candidates: supported, records, evidenceByCandidate, onEvidence };
}

async function download(candidate: SearchCandidate, directory: string, signal: AbortSignal) {
  await fs.mkdir(directory, { recursive: true });
  const key = createHash('sha256').update(`${candidate.provider}:${candidate.id}`).digest('hex');
  const file = path.join(directory, `${key}.mp4`);
  try { await probe(file, signal); return file; } catch { signal.throwIfAborted(); }
  const partial = `${file}.${randomUUID()}.part`;
  try {
    const response = await request(candidate.url, signal);
    if (!response.body) throw new BuildFailure('DOWNLOAD', 'El proveedor entregó un archivo vacío.', true);
    let size = 0;
    const limit = new Transform({ transform(chunk, _encoding, callback) {
      size += chunk.length;
      callback(size > 512 * 1024 * 1024 ? new BuildFailure('DOWNLOAD_SIZE', 'El candidato supera 512 MB. Se probará otro.') : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body as any), limit, createWriteStream(partial), { signal });
    await probe(partial, signal);
    await fs.rename(partial, file);
    return file;
  } finally { await fs.rm(partial, { force: true }); }
}

export async function prepareScene(scene: BuildScene, input: BuildInput, output: string, signal: AbortSignal,
  rejectCandidate: (id: string, reason: string) => Promise<void>, onSearchEvidence?: SearchWriter,
  usedCandidateIds: ReadonlySet<string> = new Set()): Promise<SceneResult> {
  if (scene.category === 'original') {
    const clip = await cutMedia(input.videoPath, output, scene.sourceStart, scene.frames,
      input.aspectRatio, signal, undefined, MIN_CLIP_FRAMES);
    return { ...clip, path: output, sourcePath: input.videoPath, provider: 'original' };
  }
  const result = await searchStock(scene, input, signal, onSearchEvidence, usedCandidateIds);
  let tried = 0;
  for (const candidate of result.candidates) {
    const id = `${candidate.provider}:${candidate.id}`;
    if (++tried > 3) break;
    const evidence = result.evidenceByCandidate.get(candidate)!;
    const record = result.records.find(item => item.providerId === candidate.provider && item.query === candidate.query);
    if (record) record.selectedCandidateId = id;
    await result.onEvidence?.(result.records);
    try {
      const source = await download(candidate, path.join(input.projectPath, 'build', 'stock-cache'), signal);
      const clip = await cutMedia(source, output, 0, scene.frames,
        input.aspectRatio, signal, undefined, MIN_CLIP_FRAMES);
      return { ...clip, path: output, sourcePath: source, provider: candidate.provider, candidate: id };
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof BuildFailure && ['NETWORK', 'RATE_LIMIT', 'CREDENTIALS', 'MEDIA_TIMEOUT'].includes(error.code)) throw error;
      evidence.decision = 'rejected'; evidence.reasons.push(`Descarga o validación fallida: ${error instanceof BuildFailure ? error.code : 'DOWNLOAD_INVALID'}.`);
      await result.onEvidence?.(result.records);
      await rejectCandidate(id, error instanceof BuildFailure ? error.code : 'DOWNLOAD_INVALID');
    }
  }
  throw new BuildFailure('NO_VALID_STOCK', 'No se consiguió un candidato válido. Stock sigue pendiente; continúa cuando haya una alternativa.', true);
}
