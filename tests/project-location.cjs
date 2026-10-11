'use strict';
// Uses only disposable folders under one test-owned OS temp directory.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let temp, ProjectLocationStore, legacyProjectsDirectory;

before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cipher-project-location-'));
  const compiled = spawnSync(process.execPath, [require.resolve('typescript/lib/tsc.js'), '--target', 'es2022',
    '--module', 'commonjs', '--moduleResolution', 'node', '--strict', '--skipLibCheck', '--esModuleInterop',
    '--rootDir', 'src', '--outDir', path.join(temp, 'compiled'), 'src/main/project-location.ts'],
  { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  ({ ProjectLocationStore, legacyProjectsDirectory } = require(path.join(temp, 'compiled/main/project-location.js')));
});
after(async () => { if (temp) await fs.rm(temp, { recursive: true, force: true }); });

test('adopts an existing legacy project folder without moving or rewriting its project', async () => {
  const userData = path.join(temp, 'user-data-legacy');
  const oldCwd = path.join(temp, 'old-cipher-studio');
  const oldProjects = legacyProjectsDirectory(oldCwd);
  const project = path.join(oldProjects, 'existing-project');
  await fs.mkdir(project, { recursive: true });
  const state = '{"id":"existing-project","name":"Preserve"}';
  await fs.writeFile(path.join(project, 'project-state.json'), state);

  const store = new ProjectLocationStore(userData, () => oldProjects);
  assert.equal(await store.getProjectsDirectory(), oldProjects);
  assert.equal(await fs.readFile(path.join(project, 'project-state.json'), 'utf8'), state);
  assert.equal(await fs.access(path.join(userData, 'projects')).then(() => true, () => false), false);
});

test('remembers a project opened from another folder across a changed startup directory', async () => {
  const userData = path.join(temp, 'user-data-opened');
  const emptyLegacy = path.join(temp, 'empty-legacy', 'proyectos');
  const initial = new ProjectLocationStore(userData, () => emptyLegacy);
  assert.equal(await initial.getProjectsDirectory(), path.join(userData, 'projects'));

  const externalRoot = path.join(temp, 'existing-library');
  const project = path.join(externalRoot, 'aaa-test');
  await fs.mkdir(path.join(project, 'materiales', 'builds'), { recursive: true });
  const state = '{"id":"aaa-test","plan":"keep"}';
  const media = Buffer.from('test evidence only');
  await fs.writeFile(path.join(project, 'project-state.json'), state);
  await fs.writeFile(path.join(project, 'materiales', 'builds', 'saved.bin'), media);
  const mediaHash = require('node:crypto').createHash('sha256').update(media).digest('hex');

  await initial.rememberProject(project);
  const restarted = new ProjectLocationStore(userData, () => path.join(temp, 'different-startup', 'proyectos'));
  assert.equal(await restarted.getProjectsDirectory(), externalRoot);
  assert.equal(await fs.readFile(path.join(project, 'project-state.json'), 'utf8'), state);
  const preservedMedia = await fs.readFile(path.join(project, 'materiales', 'builds', 'saved.bin'));
  assert.equal(require('node:crypto').createHash('sha256').update(preservedMedia).digest('hex'), mediaHash);
  assert.equal(await fs.access(path.join(userData, 'projects', 'aaa-test')).then(() => true, () => false), false);
});
