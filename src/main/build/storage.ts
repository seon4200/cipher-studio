import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BuildPlan } from '../../shared/build-plan';
import { validatePlan } from '../../shared/build-plan';

const writes = new Map<string, Promise<void>>();
const processToken = randomUUID();

async function liveClaims(project: string, except?: string) {
  const directory = path.join(project, 'build', 'locks');
  const files = await fs.readdir(directory).catch((e: any) => { if (e.code === 'ENOENT') return []; throw e; });
  const live: string[] = [];
  for (const file of files) {
    if (file === except || !/^\d+_[a-f0-9-]+_[a-f0-9-]+\.lock$/.test(file)) continue;
    const [pidText, token] = file.split('_');
    const pid = Number(pidText);
    let alive = false;
    try { process.kill(pid, 0); alive = pid !== process.pid || token === processToken; }
    catch (e: any) { alive = e.code === 'EPERM'; }
    if (alive) live.push(file);
    else await fs.rm(path.join(directory, file), { force: true });
  }
  return live;
}

export async function projectBusy(project: string) { return (await liveClaims(project)).length > 0; }

export async function claimProject(project: string) {
  const directory = path.join(project, 'build', 'locks');
  await fs.mkdir(directory, { recursive: true });
  const name = `${process.pid}_${processToken}_${randomUUID()}.lock`;
  const file = path.join(directory, name);
  await fs.writeFile(file, '', { flag: 'wx' });
  // Every contender creates a unique claim before checking the others. In a race
  // both may back off, but neither can enter while another live claim exists.
  try {
    if ((await liveClaims(project, name)).length) throw new Error('Otra instancia está trabajando en este proyecto.');
    return () => fs.rm(file, { force: true });
  } catch (e) { await fs.rm(file, { force: true }); throw e; }
}
export async function readJson<T>(file: string): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    // A last-good copy is recovery evidence, never silently discarded.
    try { return JSON.parse(await fs.readFile(`${file}.bak`, 'utf8')); }
    catch (backupError) { throw (error as any).code === 'ENOENT' && (backupError as any).code !== 'ENOENT' ? backupError : error; }
  }
}

export async function atomicJson(file: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value, null, 2); // capture before waiting for other writes
  const previous = writes.get(file) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    const handle = await fs.open(temporary, 'wx');
    try { await handle.writeFile(body, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    try {
      try {
        JSON.parse(await fs.readFile(file, 'utf8'));
        // Keep both the original pre-change state and the latest valid state.
        await fs.copyFile(file, `${file}.before-1b`, fs.constants.COPYFILE_EXCL)
          .catch(e => { if (e.code !== 'EEXIST') throw e; });
        const backupTemp = `${temporary}.bak`;
        await fs.copyFile(file, backupTemp);
        await fs.rename(backupTemp, `${file}.bak`);
      } catch (e: any) { if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
      await fs.rename(temporary, file);
    } finally { await fs.rm(temporary, { force: true }); }
  });
  writes.set(file, next);
  try { await next; } finally { if (writes.get(file) === next) writes.delete(file); }
}

export const planFile = (project: string) => path.join(project, 'build', 'plan.json');
function pathComparisonKey(value: string) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
async function canonicalProjectPath(project: string) {
  try { return await fs.realpath(project); }
  catch (error: any) {
    // Preserve the useful "wrong project" error for stale paths while allowing
    // Windows 8.3 aliases and junctions to compare by their physical location.
    if (error.code === 'ENOENT') return path.resolve(project);
    throw error;
  }
}
export async function loadPlan(project: string, archivedId?: string): Promise<BuildPlan | null> {
  try {
    if (archivedId && !/^[a-zA-Z0-9-]+$/.test(archivedId)) throw new Error('ID de plan inválido.');
    const file = archivedId ? path.join(project, 'build', 'history', `${archivedId}.json`) : planFile(project);
    const plan = await readJson<BuildPlan>(file);
    validatePlan(plan);
    if (archivedId && plan.id !== archivedId) throw new Error('El archivo no corresponde al plan solicitado.');
    const [savedProjectPath, requestedProjectPath] = await Promise.all([
      canonicalProjectPath(plan.projectPath), canonicalProjectPath(project),
    ]);
    if (pathComparisonKey(savedProjectPath) !== pathComparisonKey(requestedProjectPath))
      throw new Error('El plan pertenece a otra carpeta de proyecto.');
    for (const scene of plan.scenes) {
      if (scene.result && pathComparisonKey(scene.result.path) !==
          pathComparisonKey(path.resolve(plan.projectPath, 'materiales', 'builds', plan.id, `${scene.id}.mp4`)))
        throw new Error('Un resultado apunta fuera de su carpeta de ejecución.');
    }
    return plan;
  } catch (e: any) { if (e.code === 'ENOENT') return null; throw e; }
}
export async function savePlan(plan: BuildPlan) {
  validatePlan(plan);
  plan.updatedAt = new Date().toISOString();
  await atomicJson(planFile(plan.projectPath), plan);
}
