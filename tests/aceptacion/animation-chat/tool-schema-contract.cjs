'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const readline = require('node:readline')

async function main() {
  const server = path.resolve(__dirname, '../../../src/main/animation/cipher-animation-tools-server.cjs')
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-animation-schema-test-'))
  const child = spawn(process.execPath, [server], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CIPHER_ANIMATION_TOOL_SESSION_DIR: sessionDir } })
  const lines = readline.createInterface({ input: child.stdout })
  const pending = new Map()
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000) })
  lines.on('line', line => {
    let message
    try { message = JSON.parse(line) } catch { return }
    const resolve = pending.get(message.id)
    if (resolve) { pending.delete(message.id); resolve(message) }
  })
  const request = (id, method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP_SCHEMA_PROBE_TIMEOUT:${method}`)) }, 5000)
    pending.set(id, value => { clearTimeout(timer); resolve(value) })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
  try {
    await request(1, 'initialize', { protocolVersion: '2025-03-26' })
    const response = await request(2, 'tools/list')
    const tool = response.result?.tools?.find(item => item.name === 'animation_create_scene_module')
    assert(tool, 'ANIMATION_SCENE_MODULE_TOOL_MISSING')
    const schema = tool.inputSchema.properties.parameterSchema
    assert.equal(tool.inputSchema.properties.scene.properties.id.pattern, '^[a-z][a-z0-9-]{2,63}$')
    assert.deepEqual(tool.inputSchema.properties.scene.properties.version.enum, [1])
    assert.equal(schema.type, 'object')
    assert(schema.required.includes('type') && schema.required.includes('properties') &&
      schema.required.includes('additionalProperties') && schema.required.includes('required'))
    assert.deepEqual(schema.properties.type.enum, ['object'])
    assert.deepEqual(schema.properties.additionalProperties.enum, [false])
    assert.equal(schema.properties.properties.additionalProperties.type, 'object')
    const reuseTool = response.result?.tools?.find(item => item.name === 'animation_reuse_scene_template')
    const sourceEdits = reuseTool?.inputSchema.properties.sourceEdits
    assert.equal(sourceEdits?.type, 'array')
    assert.equal(sourceEdits?.maxItems, 8)
    assert.deepEqual(sourceEdits?.items.required, ['from', 'to'])
    assert.equal(sourceEdits?.items.properties.from.maxLength, 1200)
    process.stdout.write('Animation MCP parameter schema: full JSON Schema envelope is advertised to the agent.\n')
  } finally {
    child.stdin.end()
    await new Promise(resolve => child.once('close', resolve))
    lines.close()
    fs.rmSync(sessionDir, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error.message, error.stack || ''); process.exitCode = 1 })
