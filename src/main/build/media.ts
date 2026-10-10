import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { BUILD_FPS } from '../../shared/build-plan';

export class BuildFailure extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message); this.code = code; this.retryable = retryable;
  }
}

export function withTimeout(signal: AbortSignal, ms: number): AbortSignal & { dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new BuildFailure('TIMEOUT', 'La operación superó su tiempo permitido.', true)), ms);
  const abort = () => controller.abort(signal.reason);
  controller.signal.addEventListener('abort', () => { clearTimeout(timer); signal.removeEventListener('abort', abort); }, { once: true });
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  timer.unref();
  return Object.assign(controller.signal, { dispose: () => controller.abort(new Error('Operación finalizada.')) });
}

export async function command(program: string, args: string[], signal?: AbortSignal, timeoutMs = 120_000) {
  signal?.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(program, args, { windowsHide: true, shell: false });
    let output = '', errors = '', timedOut = false;
    const stop = () => { child.kill(); };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { errors = (errors + d.toString()).slice(-2000); });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
    child.on('error', e => { cleanup(); reject(new BuildFailure('TOOL_UNAVAILABLE', `${program}: ${e.message}`)); });
    child.on('close', code => {
      cleanup();
      if (signal?.aborted) reject(signal.reason || new Error('Cancelado'));
      else if (timedOut) reject(new BuildFailure('MEDIA_TIMEOUT', `${program} superó el tiempo permitido.`, true));
      else if (code !== 0) reject(new BuildFailure('MEDIA_INVALID', `${program} no pudo procesar el archivo: ${errors}`, true));
      else resolve(output);
    });
  });
}

export async function probe(file: string, signal?: AbortSignal) {
  const data = JSON.parse(await command('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,duration,nb_frames,r_frame_rate:format=duration',
    '-of', 'json', file], signal, 30_000));
  const stream = data.streams?.[0];
  const duration = Number(stream?.duration || data.format?.duration);
  if (!stream || !Number.isFinite(duration) || duration <= 0)
    throw new BuildFailure('SOURCE_INVALID', 'El archivo no contiene vídeo con duración válida.');
  return { duration, frames: Number(stream.nb_frames), width: Number(stream.width), height: Number(stream.height) };
}

export async function sha256(file: string, signal?: AbortSignal): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, { signal })) hash.update(chunk);
  return hash.digest('hex');
}

export async function validateMedia(file: string, frames: number, signal?: AbortSignal, expectedHash?: string) {
  const meta = await probe(file, signal);
  const duration = frames / BUILD_FPS;
  if (frames <= 0 || frames > 3 * BUILD_FPS || meta.frames !== frames ||
      meta.duration > 3.000001 || Math.abs(meta.duration - duration) > 0.001)
    throw new BuildFailure('DURATION_MISMATCH', 'El clip generado no coincide con los fotogramas del plan.', true);
  await command('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', '-f', 'null', '-'], signal);
  const digest = await sha256(file, signal);
  if (expectedHash && digest !== expectedHash)
    throw new BuildFailure('FILE_CHANGED', 'El clip guardado cambió o está dañado.', true);
  return { duration, frames, sha256: digest };
}

export async function cutMedia(source: string, output: string, requestedStart: number, frames: number,
  aspectRatio: string, signal?: AbortSignal, outputWidth?: number) {
  const meta = await probe(source, signal);
  const duration = frames / BUILD_FPS;
  if (!Number.isInteger(frames) || frames < 1 || frames > 90 ||
      !Number.isFinite(requestedStart) || requestedStart < 0 || meta.duration + 0.000001 < duration)
    throw new BuildFailure('SOURCE_INTERVAL', 'El vídeo fuente no permite un recorte válido de esta duración.');
  const sourceStart = Math.max(0, Math.min(requestedStart, meta.duration - duration));
  const vertical = aspectRatio === '9:16' || aspectRatio === 'vertical';
  const square = aspectRatio === '1:1' || aspectRatio === 'square';
  const width = outputWidth || (vertical || square ? 1080 : 1920);
  const height = Math.round((square ? width : vertical ? width * 16 / 9 : width * 9 / 16) / 2) * 2;
  await fs.mkdir(path.dirname(output), { recursive: true });
  const partial = `${output}.${randomUUID()}.part.mp4`;
  try {
    await command('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-ss', String(sourceStart), '-i', source,
      '-map', '0:v:0', '-an', '-vf',
      `fps=${BUILD_FPS},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
      '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', partial], signal);
    const verified = await validateMedia(partial, frames, signal);
    signal?.throwIfAborted();
    await fs.rename(partial, output);
    return { ...verified, sourceStart };
  } finally { await fs.rm(partial, { force: true }); }
}
