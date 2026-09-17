// Phase 2A attribution only: run the original sixteen reds on clean, built,
// detached base/pilot worktrees with identical Electron and display flags.
// The checkouts are supplied explicitly; this script never deletes them.
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const base = process.argv[2]
const pilot = process.argv[3]
assert(base && pilot, 'USAGE: node compare-regressions.cjs BASE_WORKTREE PILOT_WORKTREE')
const suites = [
  'asset-resolver-v1', 'assets-persistencia', 'background-black-foundation-v1',
  'graficos', 'motion-graphics-v15', 'openmoji-asset-roundtrip', 'persistencia',
  'photo-cutout-production-v1', 'photo-cutout-spike-v1', 'production-retrieval-final',
  'v15-color-system-v1', 'visual-asset-mvp', 'visual-composition-v2',
  'visual-functional-baseline-v1', 'visual-layout-typography-v3',
  'visual-retrieval-engine-v1',
]
const sha = data => crypto.createHash('sha256').update(data).digest('hex')
const electron = path.join(__dirname, '..', '..', '..', 'node_modules', 'electron', 'dist', 'electron.exe')
assert(fs.existsSync(electron), 'ELECTRON_BINARY_MISSING')
for (const root of [base, pilot]) {
  assert(fs.existsSync(path.join(root, 'dist-electron', 'main', 'index.js')), `BUILD_MISSING:${root}`)
  assert(!fs.existsSync(path.join(root, 'project-state.json')), `ROOT_STATE_PRESENT:${root}`)
  assert(!fs.existsSync(path.join(root, 'project-state.json.bak')), `ROOT_BAK_PRESENT:${root}`)
  assert(!fs.existsSync(path.join(root, '.env')), `ENV_PRESENT:${root}`)
}
const results = []
for (const suite of suites) {
  const pair = { suite }
  for (const [label, root] of [['base', base], ['pilot', pilot]]) {
    const userRoot = path.join(root, '_test-user-env')
    const appData = path.join(userRoot, 'Roaming')
    const localAppData = path.join(userRoot, 'Local')
    fs.mkdirSync(appData, { recursive: true })
    fs.mkdirSync(localAppData, { recursive: true })
    const start = performance.now()
    const outcome = spawnSync(electron, ['--force-device-scale-factor=1', `tests/${suite}.js`], {
      cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
      env: { ...process.env, APPDATA: appData, LOCALAPPDATA: localAppData },
    })
    const output = `${outcome.stdout ?? ''}\n${outcome.stderr ?? ''}`
    const lines = output.split(/\r?\n/)
    pair[label] = {
      exitCode: outcome.status, signal: outcome.signal ?? null,
      processError: outcome.error?.code ?? null, durationMs: Math.round(performance.now() - start),
      outputSha256: sha(output), outputTail: lines.slice(-45).join('\n').slice(-9000),
      assertionLines: lines.filter(line => /AssertionError|FALLO:|Error:|ERR_|PILOT_QC_FAILED|CASOS_COMPLETADOS/.test(line)).slice(-16),
    }
    console.log(`${suite} ${label} exit=${outcome.status} signal=${outcome.signal ?? '-'} ms=${pair[label].durationMs}`)
  }
  results.push(pair)
}
const report = {
  version: 1,
  conditions: {
    base, pilot, electron, node: process.version,
    deviceScaleFactor: 1, appData: 'isolated-per-checkout', network: 'suite-defined',
    packageLockBaseSha256: sha(fs.readFileSync(path.join(base, 'package-lock.json'))),
    packageLockPilotSha256: sha(fs.readFileSync(path.join(pilot, 'package-lock.json'))),
    baseBuildSha256: sha(fs.readFileSync(path.join(base, 'dist-electron', 'main', 'index.js'))),
    pilotBuildSha256: sha(fs.readFileSync(path.join(pilot, 'dist-electron', 'main', 'index.js'))),
  },
  results,
}
const destination = path.join(__dirname, 'regression-attribution-raw.json')
fs.writeFileSync(destination, JSON.stringify(report, null, 2))
console.log(`ATTRIBUTION_RAW=${destination}`)
