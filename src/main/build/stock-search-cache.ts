import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const PIXABAY_SEARCH_CACHE_MS = 24 * 60 * 60 * 1000;

export async function readSearchCache<T>(file: string): Promise<{ value: T; cachedAt: string } | null> {
  try {
    const entry = JSON.parse(await fs.readFile(file, 'utf8'));
    if (entry?.schemaVersion !== 1 || !Number.isFinite(Date.parse(entry.expiresAt)) ||
        Date.parse(entry.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(entry.cachedAt)) ||
        !entry.value) return null;
    return { value: entry.value as T, cachedAt: entry.cachedAt };
  } catch { return null; }
}

export async function writeSearchCache<T>(file: string, value: T, now = Date.now()) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify({ schemaVersion: 1, cachedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PIXABAY_SEARCH_CACHE_MS).toISOString(), value }), 'utf8');
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}
