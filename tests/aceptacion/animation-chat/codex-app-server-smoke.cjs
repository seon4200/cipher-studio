'use strict'

const assert = require('node:assert/strict')
const { CodexAppServerProvider, codexConnectionStatus } = require('../../../src/main/animation/codex-app-server-provider.cjs')

async function main() {
  const status = await codexConnectionStatus()
  assert.equal(status.available, true, 'Codex CLI must be installed')
  assert.equal(status.authenticated, true, 'Use the existing authorized Codex session')
  const provider = new CodexAppServerProvider({ timeoutMs: 60_000 })
  const startedAt = process.hrtime.bigint()
  const result = await provider.complete({
    prompt: 'Call animation_get_capabilities once, then return only JSON with kind="answer", route="none", and response="Animation tool connection verified". Do not call any creation tool.',
    outputSchema: { type: 'object', additionalProperties: false, required: ['kind', 'route', 'response'], properties: {
      kind: { type: 'string', enum: ['answer'] }, route: { type: 'string', enum: ['none'] }, response: { type: 'string' },
    } },
  })
  const elapsedMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n)
  const output = JSON.parse(result.text)
  assert.equal(output.kind, 'answer')
  assert.equal(output.route, 'none')
  assert.equal(output.response, 'Animation tool connection verified')
  assert(result.toolTrace.some(call => call.tool === 'animation_get_capabilities'), 'The connected app-server agent must call the real Animation MCP tool')
  assert(result.toolTrace.some(call => call.summary?.codeRoute?.renderer === 'Animation Canvas'), 'The tool response must expose the drawing library capabilities')
  process.stdout.write(JSON.stringify({ success: true, provider: result.provider,
    model: result.model, threadIdReceived: Boolean(result.threadId), toolCalls: result.toolTrace.map(call => call.tool), elapsedMs }) + '\n')
}

main().catch(error => {
  // Deliberately omit subprocess stderr and model inputs so credential material cannot leak.
  process.stderr.write(`${error.message || 'ANIMATION_APP_SERVER_SMOKE_FAILED'}\n`)
  process.exitCode = 1
})
