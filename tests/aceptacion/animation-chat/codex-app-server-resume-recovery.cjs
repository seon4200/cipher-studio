'use strict'

const assert = require('node:assert/strict')
const { isThreadResumeWriterConflict, openCodexThread, parseMcpServerNames, buildPlannerMcpOverrides } = require('../../../src/main/animation/codex-app-server-provider.cjs')

async function main() {
  const conflict = new Error('ANIMATION_CODEX_RPC_ERROR_-32600:thread 01a10f21-9d60-7ee3-b8ec-b884fbe59f2d already has an active writer')
  assert.equal(isThreadResumeWriterConflict(conflict), true)
  assert.equal(isThreadResumeWriterConflict(new Error('ANIMATION_CODEX_RPC_ERROR_-32600:thread not found')), false)
  assert.equal(isThreadResumeWriterConflict(new Error('ANIMATION_CODEX_RPC_ERROR_-32600:invalid params')), false)
  const configured = parseMcpServerNames('[mcp_servers.calendar]\n[mcp_servers."private-drive".env]\n')
  assert.deepEqual(configured, ['calendar', 'private-drive'])
  assert.deepEqual(parseMcpServerNames(''), [], 'missing MCP servers must not create invalid empty overrides')
  const overrides = buildPlannerMcpOverrides('[mcp_servers.calendar]\n')
  assert.ok(overrides.some(([key, value]) => key === 'mcp_servers.calendar.enabled' && value === 'false'))
  assert.ok(overrides.some(([key, value]) => key === 'mcp_servers.calendar.required' && value === 'false'))

  const calls = []
  const reopened = await openCodexThread(async (method, params) => {
    calls.push({ method, params })
    if (method === 'thread/resume') throw conflict
    return { thread: { id: 'new-project-animation-thread' } }
  }, '01a10f21-9d60-7ee3-b8ec-b884fbe59f2d', 'C:\\Users\\test\\AppData\\Local\\Temp')
  assert.deepEqual(calls.map(call => call.method), ['thread/resume', 'thread/start'])
  assert.deepEqual(reopened, { result: { thread: { id: 'new-project-animation-thread' } },
    recovery: 'active-writer-conflict-before-turn-start' })

  const missing = new Error('ANIMATION_CODEX_RPC_ERROR_-32600:permission denied')
  await assert.rejects(() => openCodexThread(async method => {
    assert.equal(method, 'thread/resume')
    throw missing
  }, 'existing-thread-id', 'C:\\Users\\test\\AppData\\Local\\Temp'), missing)

  const started = await openCodexThread(async method => {
    assert.equal(method, 'thread/start')
    return { id: 'new-thread' }
  }, null, 'C:\\Users\\test\\AppData\\Local\\Temp')
  assert.equal(started.recovery, null)
  const buildThread = await openCodexThread(async (method, params) => {
    assert.equal(method, 'thread/start')
    assert.equal(params.serviceName, 'cipher-build-planner')
    return { id: 'build-planner-thread' }
  }, null, 'C:\\Users\\test\\AppData\\Local\\Temp', 'cipher-build-planner')
  assert.equal(buildThread.result.id, 'build-planner-thread')
  process.stdout.write('Animation app-server thread recovery: resumes, narrowly recovers stale writer locks, and propagates other errors.\n')
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1 })
