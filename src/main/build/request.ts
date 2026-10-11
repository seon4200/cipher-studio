// Shared transport; preserves the 1B timeout and bounded retry policy.
import { BuildFailure, withTimeout } from './media';

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal.throwIfAborted();
  const stop = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, ms);
  signal.addEventListener('abort', stop, { once: true });
});

export async function request(url: string, signal: AbortSignal, init: RequestInit = {},
  onResponse?: (response: Response, attempt: number) => void): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      const response = await fetch(url, { ...init, signal: withTimeout(signal, 30_000) });
      onResponse?.(response, attempt + 1);
      if (response.ok) return response;
      if (response.status === 401 || response.status === 403)
        throw new BuildFailure('CREDENTIALS', 'El proveedor rechazó las credenciales.');
      if (response.status === 429) {
        const header = response.headers.get('retry-after');
        const seconds = header ? (Number.isFinite(Number(header)) ? Number(header) : (Date.parse(header) - Date.now()) / 1000) : 2;
        await response.body?.cancel();
        if (attempt === 0 && Number.isFinite(seconds) && seconds >= 0 && seconds <= 15) {
          await sleep(Math.max(1000, seconds * 1000), signal); continue;
        }
        throw new BuildFailure('RATE_LIMIT', 'El proveedor limita peticiones. Continúa más tarde.', true);
      }
      throw new BuildFailure('HTTP_ERROR', `El proveedor devolvió HTTP ${response.status}.`, response.status >= 500);
    } catch (error) {
      signal.throwIfAborted();
      const issue = error instanceof BuildFailure ? error : new BuildFailure('NETWORK', 'No se pudo conectar con el proveedor.', true);
      if (!issue.retryable || attempt >= 1 || issue.code === 'RATE_LIMIT') throw issue;
      await sleep(1000, signal);
    }
  }
}
