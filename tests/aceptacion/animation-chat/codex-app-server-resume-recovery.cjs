'use strict'

const assert = require('node:assert/strict')
const { isThreadResumeWriterConflict, isToollessPlannerPurpose, isTransientCodexReconnectMessage, openCodexThread,
  classifyCodexErrorNotification, classifyMcpServerStatus, summarizeCodexProcessOutput,
  parseMcpServerNames, buildPlannerMcpOverrides, SUPPORTED_CODEX_CLI_VERSION,
  REQUIRED_ANIMATION_TOOLS } = require('../../../src/main/animation/codex-app-server-provider.cjs')

async function main() {
  assert.equal(isToollessPlannerPurpose('build-planner'), true)
  assert.equal(isToollessPlannerPurpose('style-planner'), true,
    'Style proposals attach reference images but do not require the Animation tool server')
  assert.equal(isToollessPlannerPurpose('animation'), false,
    'Scene generation continues to require the Animation tool server')
  assert.equal(isTransientCodexReconnectMessage('Reconnecting... 2/5'), true,
    'a bounded Codex reconnect notice is progress, not an immediate terminal stream failure')
  assert.equal(isTransientCodexReconnectMessage('Reconnecting… 5/5'), true)
  assert.equal(isTransientCodexReconnectMessage('connection permanently closed'), false,
    'unclassified stream failures continue to fail closed')
  assert.equal(SUPPORTED_CODEX_CLI_VERSION, '0.162.0-alpha.2',
    'the provider is pinned to the installed app-server protocol whose ErrorNotification contains willRetry')
  const scope = { threadId: 'thread-1', turnId: 'turn-1' }
  assert.deepEqual(classifyCodexErrorNotification({ error: { message: 'Reconnecting… 2/2' }, willRetry: true,
    threadId: 'thread-1', turnId: 'turn-1' }, scope), { action: 'progress', reason: 'protocol-will-retry', willRetry: true,
    attempt: { current: 2, total: 2 }, threadMatches: true, turnMatches: true },
  'the protocol retry flag wins even when the notice says the last attempt')
  assert.equal(classifyCodexErrorNotification({ error: { message: 'Reconnecting… 2/2' }, threadId: 'thread-1',
    turnId: 'turn-1' }, scope).action, 'progress', 'legacy final reconnect notices are progress until a real terminal signal')
  assert.equal(classifyCodexErrorNotification({ error: { message: 'Reconnecting… 2/2' }, willRetry: false,
    threadId: 'thread-1', turnId: 'turn-1' }, scope).reason, 'protocol-terminal-error',
  'explicit willRetry=false remains terminal')
  assert.equal(classifyCodexErrorNotification({ error: { message: 'temporary service issue' }, willRetry: true,
    threadId: 'thread-1', turnId: 'turn-1' }, scope).action, 'progress')
  assert.equal(classifyCodexErrorNotification({ error: { message: 'terminal service issue' }, willRetry: false,
    threadId: 'thread-1', turnId: 'turn-1' }, scope).action, 'fail')
  assert.equal(classifyCodexErrorNotification({ error: { message: 'Reconnecting… 2/2' }, willRetry: true,
    threadId: 'different-thread', turnId: 'turn-1' }, scope).reason, 'different-thread')
  assert.equal(classifyCodexErrorNotification({ error: { message: 'Reconnecting… 2/2' }, willRetry: true,
    threadId: 'thread-1', turnId: 'different-turn' }, scope).reason, 'different-turn')

  assert.equal(classifyMcpServerStatus({ server: null, enabled: false }).state, 'disabled')
  assert.equal(classifyMcpServerStatus({ server: null, enabled: true }).state, 'registration-absent')
  assert.equal(classifyMcpServerStatus({ server: null, enabled: true,
    startupEvents: [{ status: 'failed', failureReason: 'reauthenticationRequired', errorClass: 'mcp-or-process' }] }).state, 'startup-failed')
  assert.equal(classifyMcpServerStatus({ server: { runtimeStatus: 'connected', tools: Object.fromEntries(REQUIRED_ANIMATION_TOOLS.map(name => [name, {}])) },
    startupEvents: [{ status: 'failed' }, { status: 'ready' }] }).state, 'ready',
  'an earlier failed startup event does not override the server state after it recovers')
  assert.equal(classifyMcpServerStatus({ server: { runtimeStatus: 'failed', tools: {} } }).state, 'startup-failed')
  const incomplete = classifyMcpServerStatus({ server: { runtimeStatus: 'connected', tools: {
    animation_get_capabilities: {}, animation_create_scene_module: {},
  }, toolsError: null } })
  assert.equal(incomplete.state, 'tools-incomplete')
  assert.deepEqual(incomplete.missingTools, ['animation_configure_recipe'])
  const announcedTools = Object.fromEntries(REQUIRED_ANIMATION_TOOLS.map(name => [name, {}]))
  const readyMcp = classifyMcpServerStatus({ server: { runtimeStatus: 'connected', tools: announcedTools,
    toolsError: null, authStatus: 'unsupported' }, enabled: true })
  assert.equal(readyMcp.state, 'ready')
  assert.deepEqual(readyMcp.tools, [...REQUIRED_ANIMATION_TOOLS].sort())

  const outputSummary = summarizeCodexProcessOutput('failed to send remote plugin request OPENAI_API_KEY=secret-value at C:\\Users\\private; https://host.test/path?token=private\n')
  assert.equal(outputSummary.stderrLineCount, 1)
  assert.deepEqual(outputSummary.stderrSignals, ['remote-request-failed'])
  assert(!JSON.stringify(outputSummary).includes('secret-value') && !JSON.stringify(outputSummary).includes('C:\\Users\\private') &&
    !JSON.stringify(outputSummary).includes('token=private'), 'process output is reduced to safe classifications')
  const structuredSummary = summarizeCodexProcessOutput('{"level":"WARN","fields":{"message":"failed with token=private-value"},"target":"private-target"}')
  assert(!JSON.stringify(structuredSummary).includes('private-value') && !JSON.stringify(structuredSummary).includes('private-target'),
    'structured process logs retain only a classification, not their arbitrary fields')
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
  process.stdout.write('Animation app-server protocol retry semantics, MCP readiness diagnostics, safe process-output summaries, and thread recovery passed.\n')
}

main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1 })
