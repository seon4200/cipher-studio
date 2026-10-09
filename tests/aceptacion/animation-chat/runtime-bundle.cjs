'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '../../..')
const runtime = path.join(root, 'dist-electron', 'main', 'animation')
const server = path.join(runtime, 'cipher-animation-tools-server.cjs')
for (const file of [server, path.join(runtime, 'scene-module-contract.cjs'), path.join(runtime, 'scene-template-source-edits.cjs'), path.join(runtime, 'contract-v1.cjs')])
  assert(fs.existsSync(file), `ANIMATION_BUNDLE_DEPENDENCY_MISSING:${path.basename(file)}`)
assert(fs.existsSync(path.join(root, 'dist-electron', 'main', 'animation-style-library.cjs')),
  'ANIMATION_STYLE_LIBRARY_BUNDLE_DEPENDENCY_MISSING')

const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-animation-bundle-check-'))
const input = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
].map(value => JSON.stringify(value)).join('\n') + '\n'
const child = spawnSync(process.execPath, [server], { cwd: root, input, encoding: 'utf8', windowsHide: true,
  env: { ...process.env, CIPHER_ANIMATION_TOOL_SESSION_DIR: sessionDir } })
assert.equal(child.status, 0, `ANIMATION_BUNDLE_SERVER_EXIT:${child.status}:${child.stderr}`)
const responses = String(child.stdout || '').trim().split(/\r?\n/).map(line => JSON.parse(line))
assert(responses.some(value => value.id === 1 && value.result?.serverInfo?.name === 'cipher-animation-tools'),
  'ANIMATION_BUNDLE_INITIALIZE_FAILED')
const listing = responses.find(value => value.id === 2)?.result?.tools || []
for (const tool of ['animation_get_capabilities', 'animation_configure_recipe', 'animation_create_scene_module', 'animation_reuse_scene_template'])
  assert(listing.some(value => value.name === tool), `ANIMATION_BUNDLE_TOOL_MISSING:${tool}`)
const reuseTool = listing.find(value => value.name === 'animation_reuse_scene_template')
assert(reuseTool.inputSchema.required.includes('scene'),
  'Code-template reuse requires current scene metadata so old factual metadata cannot leak')
assert.deepEqual(reuseTool.inputSchema.properties.style.properties.titleFontFamily.enum, ['Instrument Serif', 'DM Sans'],
  'Code-template reuse exposes a checked typography parameter')
process.stdout.write(`Animation Electron bundle: tool server starts and exposes ${listing.length} tools.\n`)
