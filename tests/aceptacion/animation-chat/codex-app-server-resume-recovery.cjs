'use strict'

const assert = require('node:assert/strict')
const { isThreadResumeWriterConflict, openCodexThread } = require('../../../src/main/animation/codex-app-server-provider.cjs')

async function main() {
  const conflict = new Error('ANIMATION_CODEX_RPC_ERROR_-32600:thread 01a10f21-9d60-7ee3-b8ec-b884fbe59f2d already has an active writer')
  assert.equal(isThreadResumeWriterConflict(conflict), true)
  assert.equal(isThreadResumeWriterConflict(new Error('ANIMATION_CODEX_RPC_ERROR_-32600:thread not found')), false)
  assert.equal(isThreadResumeWriterConflict(new Error('ANIMATION_CODEX_RPC_ERROR_-32600:invalid params')), false)

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
  process.stdout.write('Animation app-server thread recovery: resumes, narrowly recovers stale writer locks, and propagates other errors.\n')
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1 })
