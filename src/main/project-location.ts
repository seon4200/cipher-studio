import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

type StoredLocation = { schemaVersion: 1; projectsDirectory: string };

async function containsProject(directory: string) {
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        try {
          await fs.access(path.join(directory, entry.name, 'project-state.json'));
          return true;
        } catch { /* This child is not a Cipher project. */ }
      }
    }
  } catch { /* An absent legacy directory is not an error. */ }
  return false;
}

/** The old directory rule, retained only to adopt existing projects on first launch. */
export function legacyProjectsDirectory(cwd: string) {
  const resolved = path.resolve(cwd);
  const base = path.basename(resolved).toLowerCase() === 'cipher-studio'
    ? resolved : path.join(resolved, 'cipher-studio');
  return path.join(base, 'proyectos');
}

/** Stores only the project collection path; project files and media are never moved. */
export class ProjectLocationStore {
  private readonly file: string;
  private readonly stableDirectory: string;

  constructor(userDataPath: string, private readonly legacyDirectory: () => string = () => legacyProjectsDirectory(process.cwd())) {
    this.file = path.join(userDataPath, 'projects-location.json');
    this.stableDirectory = path.join(userDataPath, 'projects');
  }

  private async read(): Promise<StoredLocation | null> {
    try {
      const value = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (value?.schemaVersion === 1 && typeof value.projectsDirectory === 'string' &&
          path.isAbsolute(value.projectsDirectory)) return value;
    } catch { /* A missing or invalid pointer is recovered without touching project data. */ }
    return null;
  }

  private async write(projectsDirectory: string) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    const value: StoredLocation = { schemaVersion: 1, projectsDirectory: path.resolve(projectsDirectory) };
    try {
      await fs.writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx' });
      await fs.rename(temporary, this.file);
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }

  async getProjectsDirectory() {
    const stored = await this.read();
    if (stored) return stored.projectsDirectory;

    const legacy = path.resolve(this.legacyDirectory());
    if (await containsProject(legacy)) {
      await this.write(legacy);
      return legacy;
    }

    await fs.mkdir(this.stableDirectory, { recursive: true });
    await this.write(this.stableDirectory);
    return this.stableDirectory;
  }

  /** Called after Cipher successfully opens a project selected from any folder. */
  async rememberProject(projectPath: string) {
    const resolved = path.resolve(projectPath);
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) throw new Error('La carpeta seleccionada no es un proyecto.');
    await fs.access(path.join(resolved, 'project-state.json'));
    await this.write(path.dirname(resolved));
  }
}
