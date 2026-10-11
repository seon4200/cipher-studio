import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash, randomUUID } from 'node:crypto';
import type { BuildInput, BuildScene, SceneResult } from '../../shared/build-plan';
import { MIN_CLIP_FRAMES } from '../../shared/build-plan';
import { BuildFailure, cutMedia, probe } from './media';

import { request } from './request';

type Candidate = { id: string; provider: string; url: string; width: number; height: number; duration?: number };
async function searchStock(keyword: string, aspectRatio: string, signal: AbortSignal) {
  const candidates: Candidate[] = [], errors: string[] = [], failures: unknown[] = [];
  let available = 0;
  const collect = async (name: string, fn: () => Promise<void>) => {
    available++;
    try { await fn(); } catch (e) { signal.throwIfAborted(); errors.push(`${name}: ${(e as Error).message}`); failures.push(e); }
  };
  const vertical = aspectRatio === '9:16' || aspectRatio === 'vertical';
  if (process.env.PEXELS_API_KEY) await collect('Pexels', async () => {
    const r: any = await (await request(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=5`, signal,
      { headers: { Authorization: process.env.PEXELS_API_KEY! } })).json();
    for (const video of (r.videos || []).slice(0, 3)) {
      const file = (video.video_files || []).filter((f: any) => f.file_type === 'video/mp4')
        .sort((a: any, b: any) => Math.abs((a.height > a.width ? 1 : 0) - Number(vertical)) -
          Math.abs((b.height > b.width ? 1 : 0) - Number(vertical)) || b.width - a.width)[0];
      if (file?.link) candidates.push({ id: String(video.id), provider: 'pexels', url: file.link,
        width: file.width, height: file.height, duration: video.duration });
    }
  });
  if (process.env.PIXABAY_API_KEY) await collect('Pixabay', async () => {
    const r: any = await (await request(`https://pixabay.com/api/videos/?key=${encodeURIComponent(process.env.PIXABAY_API_KEY!)}&q=${encodeURIComponent(keyword)}&per_page=5&safesearch=true`, signal)).json();
    for (const video of (r.hits || []).slice(0, 3)) {
      const file = video.videos?.large || video.videos?.medium;
      if (file?.url) candidates.push({ id: String(video.id), provider: 'pixabay', url: file.url,
        width: file.width, height: file.height, duration: video.duration });
    }
  });
  if (process.env.COVERR_API_KEY) await collect('Coverr', async () => {
    const r: any = await (await request(`https://api.coverr.co/videos?query=${encodeURIComponent(keyword)}&page_size=5&urls=true`, signal,
      { headers: { Authorization: `Bearer ${process.env.COVERR_API_KEY}` } })).json();
    for (const video of (r.hits || r.videos || []).slice(0, 3)) {
      const url = video.urls?.mp4_download || video.urls?.mp4 || video.download_url;
      if (url) candidates.push({ id: String(video.id || video.slug), provider: 'coverr', url,
        width: video.width || 1920, height: video.height || 1080, duration: video.duration });
    }
  });
  if (/\b(space|planet|solar|moon|nasa|galaxy|star|astronaut|rocket|earth|universe|satellite|mars)\b/i.test(keyword))
    await collect('NASA', async () => {
      const r: any = await (await request(`https://images-api.nasa.gov/search?q=${encodeURIComponent(keyword)}&media_type=video&page_size=3`, signal)).json();
      for (const video of (r.collection?.items || []).slice(0, 2)) {
        const id = video.data?.[0]?.nasa_id;
        if (!id) continue;
        const asset: any = await (await request(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`, signal)).json();
        const file = (asset.collection?.items || []).find((f: any) => /\.mp4$/i.test(f.href));
        if (file) candidates.push({ id, provider: 'nasa', url: file.href, width: 1920, height: 1080 });
      }
    });
  if (!available) throw new BuildFailure('CREDENTIALS', 'Configura Pexels, Pixabay o Coverr. NASA solo se usa para temas espaciales.');
  if (!candidates.length && failures.length === available && failures.every(e => e instanceof BuildFailure && e.code === 'CREDENTIALS'))
    throw new BuildFailure('CREDENTIALS', errors.join(' · '));
  if (!candidates.length) throw new BuildFailure('NO_STOCK', errors.join(' · ') || 'La búsqueda no devolvió Stock. La escena conserva su categoría.', true);
  return candidates.sort((a, b) => Number((b.height > b.width) === vertical) - Number((a.height > a.width) === vertical) || b.width - a.width);
}

async function download(candidate: Candidate, directory: string, signal: AbortSignal) {
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
  rejectCandidate: (id: string, reason: string) => Promise<void>): Promise<SceneResult> {
  if (scene.category === 'original') {
    const clip = await cutMedia(input.videoPath, output, scene.sourceStart, scene.frames,
      input.aspectRatio, signal, undefined, MIN_CLIP_FRAMES);
    return { ...clip, path: output, sourcePath: input.videoPath, provider: 'original' };
  }
  const pool = await searchStock(scene.keyword!, input.aspectRatio, signal);
  let tried = 0;
  for (const candidate of pool) {
    const id = `${candidate.provider}:${candidate.id}`;
    if (scene.rejectedCandidates.includes(id)) continue;
    if (++tried > 3) break;
    try {
      const source = await download(candidate, path.join(input.projectPath, 'build', 'stock-cache'), signal);
      const clip = await cutMedia(source, output, 0, scene.frames,
        input.aspectRatio, signal, undefined, MIN_CLIP_FRAMES);
      return { ...clip, path: output, sourcePath: source, provider: candidate.provider, candidate: id };
    } catch (error) {
      signal.throwIfAborted();
      // Availability errors can recover on the next run; invalid media should not
      // be chosen repeatedly. The runner persists the discard before continuing.
      if (error instanceof BuildFailure && ['NETWORK', 'RATE_LIMIT', 'CREDENTIALS', 'MEDIA_TIMEOUT'].includes(error.code)) throw error;
      await rejectCandidate(id, error instanceof BuildFailure ? error.code : 'DOWNLOAD_INVALID');
    }
  }
  throw new BuildFailure('NO_VALID_STOCK', 'No se consiguió un candidato válido. Stock sigue pendiente; continúa o crea otro plan.', true);
}
