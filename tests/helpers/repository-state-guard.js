// Root project-state files may predate a test run. A suite must preserve their
// existence, bytes and mtime; requiring absence would falsely reject real data.
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function fingerprint (file) {
  if (!fs.existsSync(file)) return null
  const stat = fs.statSync(file)
  assert(stat.isFile(), `ROOT_STATE_NOT_FILE:${file}`)
  return { bytes: stat.size, mtimeMs: stat.mtimeMs,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }
}

function captureRootState (root) {
  return Object.fromEntries(['project-state.json', 'project-state.json.bak']
    .map(name => [name, fingerprint(path.join(root, name))]))
}

function assertRootStateUnchanged (root, before) {
  assert.deepEqual(captureRootState(root), before, 'La suite modificó estados de la raíz del repositorio')
}

module.exports = { captureRootState, assertRootStateUnchanged }
