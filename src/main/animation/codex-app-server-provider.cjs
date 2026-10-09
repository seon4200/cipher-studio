'use strict'

const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const readline = require('node:readline')
const { performance } = require('node:perf_hooks')
const SUPPORTED_CODEX_CLI_VERSION = '0.162.0-alpha.2'
const REQUIRED_ANIMATION_TOOLS = Object.freeze([
  'animation_get_capabilities', 'animation_configure_recipe', 'animation_create_scene_module',
])

function configuredModelInfo() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
  try {
    const config = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8')
    return {
      model: config.match(/^\s*model\s*=\s*["']([^"']+)["']/m)?.[1] || null,
      reasoningEffort: config.match(/^\s*model_reasoning_effort\s*=\s*["']([^"']+)["']/m)?.[1] || null,
    }
  } catch { return { model: null, reasoningEffort: null } }
}

function parseMcpServerNames(configText = '') {
  const names = new Set()
  for (const line of String(configText).split(/\r?\n/)) {
    const match = line.match(/^\s*\[mcp_servers\.([^.\]]+)(?:\.[^\]]+)?\]\s*$/)
    const name = match?.[1]?.trim().replace(/^["']|["']$/g, '')
    if (name && /^[A-Za-z0-9_-]{1,80}$/.test(name)) names.add(name)
  }
  return [...names].sort()
}

function buildPlannerMcpOverrides(configText = '') {
  return parseMcpServerNames(configText).flatMap(name => [
    [`mcp_servers.${name}.enabled`, 'false'],
    [`mcp_servers.${name}.required`, 'false'],
  ])
}

function configuredMcpServerNames() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
  try { return parseMcpServerNames(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8')) }
  catch { return [] }
}

function terminateChildTree(child) {
  if (!child || child.exitCode !== null) return Promise.resolve()
  if (process.platform !== 'win32' || !Number.isInteger(child.pid)) {
    try { child.kill('SIGKILL') } catch {}
    return Promise.resolve()
  }
  return new Promise(resolve => {
    let settled = false
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve() }
    const timer = setTimeout(() => { try { child.kill() } catch {}; finish() }, 5000)
    try {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'],
        { windowsHide: true, stdio: 'ignore' })
      killer.once('error', () => { try { child.kill() } catch {}; finish() })
      killer.once('close', finish)
      killer.unref()
    } catch { try { child.kill() } catch {}; finish() }
  })
}

function waitForClose(child, timeoutMs) {
  if (!child || child.exitCode !== null) return Promise.resolve(true)
  return new Promise(resolve => {
    let settled = false
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); child.removeListener('close', onClose); resolve(value) }
    const onClose = () => finish(true)
    const timer = setTimeout(() => finish(false), timeoutMs)
    child.once('close', onClose)
  })
}

function resolveCodexExecutable() {
  if (process.env.CIPHER_CODEX_EXECUTABLE && fs.existsSync(process.env.CIPHER_CODEX_EXECUTABLE))
    return process.env.CIPHER_CODEX_EXECUTABLE
  const where = process.platform === 'win32' ? 'where.exe' : 'which'
  const found = spawnSync(where, ['codex'], { encoding: 'utf8', windowsHide: true, timeout: 4000 })
  if (found.status === 0) {
    const executable = String(found.stdout).split(/\r?\n/).map(x => x.trim())
      .find(x => /(?:^|[/\\])codex(?:\.exe)?$/i.test(x))
    if (executable) return executable
  }
  const localAppData = process.env.LOCALAPPDATA
  const codexRoot = localAppData && path.join(localAppData, 'OpenAI', 'Codex', 'bin')
  if (codexRoot && fs.existsSync(codexRoot)) {
    const candidates = fs.readdirSync(codexRoot).map(name => path.join(codexRoot, name, 'codex.exe'))
      .filter(file => fs.existsSync(file)).sort().reverse()
    if (candidates.length) return candidates[0]
  }
  return null
}

function execBounded(executable, args, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    let settled = false
    const done = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value) }
    const timer = setTimeout(() => { try { child.kill() } catch {} done({ ok: false, reason: 'timeout' }) }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', data => { stdout = (stdout + data).slice(-4000) })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000) })
    child.once('error', () => done({ ok: false, reason: 'spawn-failed' }))
    child.once('close', code => done({ ok: code === 0, stdout: stdout + '\n' + stderr }))
  })
}

function resolveNodeExecutable() {
  if (process.env.CIPHER_ANIMATION_NODE_EXECUTABLE && fs.existsSync(process.env.CIPHER_ANIMATION_NODE_EXECUTABLE))
    return process.env.CIPHER_ANIMATION_NODE_EXECUTABLE
  const where = process.platform === 'win32' ? 'where.exe' : 'which'
  const found = spawnSync(where, ['node'], { encoding: 'utf8', windowsHide: true, timeout: 4000 })
  if (found.status === 0) {
    const executable = String(found.stdout).split(/\r?\n/).map(x => x.trim()).find(Boolean)
    if (executable) return executable
  }
  return null
}
async function codexConnectionStatus() {
  const executable = resolveCodexExecutable()
  if (!executable) return { available: false, authenticated: false, status: 'not-installed', provider: 'codex-app-server' }
  const versionResult = await execBounded(executable, ['--version'], 4000)
  const versionMatch = String(versionResult.stdout || '').match(/codex-cli\s+(\S+)/i)
  const version = versionMatch?.[1] || null
  if (!versionResult.ok || !version) return { available: true, authenticated: false, status: 'version-unknown',
    provider: 'codex-app-server', expectedVersion: SUPPORTED_CODEX_CLI_VERSION, version }
  if (version !== SUPPORTED_CODEX_CLI_VERSION) return { available: true, authenticated: false, status: 'unsupported-version',
    provider: 'codex-app-server', expectedVersion: SUPPORTED_CODEX_CLI_VERSION, version }
  const result = await execBounded(executable, ['login', 'status'], 8000)
  if (!result.ok) return { available: true, authenticated: false,
    status: result.reason === 'timeout' ? 'timeout' : 'not-authenticated', provider: 'codex-app-server', version }
  // This integration is authorized through the user's ChatGPT/Codex login only. An
  // API-key login is deliberately not treated as equivalent, to avoid a billing switch.
  const authenticated = /logged in using chatgpt/i.test(result.stdout || '')
  return { available: true, authenticated, status: authenticated ? 'ready-to-test' : 'not-authenticated', provider: 'codex-app-server', version }
}

function extractText(item) {
  if (!item || typeof item !== 'object') return ''
  if (typeof item.text === 'string') return item.text
  if (Array.isArray(item.content)) return item.content.map(part => typeof part === 'string' ? part : part?.text || '').join('')
  if (Array.isArray(item.parts)) return item.parts.map(part => part?.text || '').join('')
  return ''
}

function isThreadResumeWriterConflict(error) {
  const message = String(error?.message || error || '')
  return /ANIMATION_CODEX_RPC_ERROR_-32600:/.test(message) &&
    /thread [0-9a-f-]{36} already has an active writer/i.test(message)
}

function isToollessPlannerPurpose(purpose) {
  return purpose === 'build-planner' || purpose === 'style-planner'
}

function isTransientCodexReconnectMessage(value) {
  return /^Reconnecting(?:\.{3}|…)?\s*\d+\s*\/\s*\d+$/i.test(String(value || '').trim())
}

function classifyCodexErrorNotification(notification, { threadId = '', turnId = '' } = {}) {
  const params = notification && typeof notification === 'object' ? notification : {}
  const message = String(params.error?.message || params.message || '')
  const attempt = message.match(/^(?:Reconnecting(?:\.{3}|…)?\s*)(\d+)\s*\/\s*(\d+)$/i)
  const threadMatches = !threadId || !params.threadId || params.threadId === threadId
  const turnMatches = !turnId || !params.turnId || params.turnId === turnId
  if (!threadMatches || !turnMatches)
    return { action: 'ignore', reason: !threadMatches ? 'different-thread' : 'different-turn', threadMatches, turnMatches }
  const willRetry = typeof params.willRetry === 'boolean' ? params.willRetry : null
  // In app-server v2, ErrorNotification.willRetry carries the terminality contract.
  // Older versions exposed Reconnecting n/m as progress; even n === m is not a
  // terminal signal unless the protocol says willRetry=false or the turn/process ends.
  if (willRetry === true || (willRetry === null && isTransientCodexReconnectMessage(message)))
    return { action: 'progress', reason: willRetry === true ? 'protocol-will-retry' : 'legacy-reconnect-progress',
      willRetry, attempt: attempt ? { current: Number(attempt[1]), total: Number(attempt[2]) } : null,
      threadMatches, turnMatches }
  return { action: 'fail', reason: willRetry === false ? 'protocol-terminal-error' : 'unclassified-error',
    willRetry, attempt: attempt ? { current: Number(attempt[1]), total: Number(attempt[2]) } : null,
    threadMatches, turnMatches }
}

function classifyMcpServerStatus({ server, startupEvents = [], enabled = true,
  requiredTools = REQUIRED_ANIMATION_TOOLS } = {}) {
  const runtimeStatus = server?.runtimeStatus || null
  const toolNames = Object.keys(server?.tools || {}).sort()
  const missingTools = requiredTools.filter(name => !toolNames.includes(name))
  const latestStartup = [...startupEvents].reverse()[0] || null
  const failedStartup = latestStartup?.status === 'failed' ? latestStartup : null
  let state = 'ready'
  if (!enabled || runtimeStatus === 'disabled') state = 'disabled'
  else if (runtimeStatus === 'authenticationRequired' || server?.authStatus === 'notLoggedIn') state = 'authentication-required'
  else if (runtimeStatus === 'failed' || failedStartup) state = 'startup-failed'
  else if (!server && latestStartup?.status === 'starting') state = 'starting'
  else if (!server) state = failedStartup ? 'startup-failed' : 'registration-absent'
  else if (runtimeStatus === 'starting' || runtimeStatus === 'notStarted') state = 'starting'
  else if (runtimeStatus === 'cancelled') state = 'startup-cancelled'
  else if (server.toolsError || missingTools.length) state = 'tools-incomplete'
  return {
    state,
    serverPresent: Boolean(server),
    runtimeStatus,
    startupStatus: latestStartup?.status || null,
    failureReason: failedStartup?.failureReason || null,
    startupErrorClass: failedStartup?.errorClass || null,
    toolsErrorPresent: Boolean(server?.toolsError),
    authStatus: server?.authStatus || null,
    tools: toolNames,
    missingTools,
  }
}

function summarizeCodexProcessOutput(stderr = '') {
  const lines = String(stderr || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const signals = []
  const outputClasses = []
  for (const line of lines) {
    if (/failed to send remote .* request|error sending request/i.test(line)) signals.push('remote-request-failed')
    else if (/access is denied|permission denied/i.test(line)) signals.push('permission-denied')
    else if (/failed to start|spawn.*failed|no such file|not found/i.test(line)) signals.push('process-start-failed')
    else if (/invalid config|failed to parse config/i.test(line)) signals.push('configuration-error')
    else if (/mcp.*(failed|error)|failed.*mcp/i.test(line)) signals.push('mcp-error')
    else if (/\b(error|fatal)\b/i.test(line)) signals.push('process-error')
    let structured = null
    try { structured = JSON.parse(line) } catch {}
    const message = String(structured?.fields?.message || structured?.message || '')
    const level = typeof structured?.level === 'string' && /^(TRACE|DEBUG|INFO|WARN|ERROR)$/i.test(structured.level)
      ? structured.level.toLowerCase() : null
    if (/ignoring interface\.icon_(?:small|large).*icon path/i.test(message)) outputClasses.push('plugin-icon-path-warning')
    else if (structured) outputClasses.push(`${level || 'structured'}-${classifySafeErrorText(message)}`)
    else if (/warning/i.test(line)) outputClasses.push('warning-output')
    else if (/\b(error|fatal)\b/i.test(line)) outputClasses.push('error-output')
    else outputClasses.push('unclassified-output')
  }
  return {
    stderrLineCount: lines.length,
    stderrSignals: [...new Set(signals)],
    stderrOutputClasses: outputClasses.slice(-8),
  }
}

function failureCodeFromError(error) {
  const message = String(error?.message || error || '')
  return message.match(/^([A-Z][A-Z0-9_]+)/)?.[1] || 'ANIMATION_PROVIDER_ERROR'
}

function classifySafeErrorText(value) {
  const text = String(value || '')
  if (/rate.?limit|too many requests|429/i.test(text)) return 'rate-limited'
  if (/auth|login|unauthori[sz]ed|forbidden|401|403/i.test(text)) return 'authentication-or-permission'
  if (/timeout|timed out|deadline/i.test(text)) return 'timeout'
  if (/connect|network|dns|socket|remote request|transport/i.test(text)) return 'connection'
  if (/config|parse/i.test(text)) return 'configuration'
  if (/mcp|tool server|spawn|process/i.test(text)) return 'mcp-or-process'
  return text ? 'provider-error' : 'empty'
}

function safeStartupFailureReason(value) {
  return value === 'reauthenticationRequired' ? value : null
}

async function openCodexThread(request, threadId, cwd, serviceName = 'cipher-animation') {
  if (!threadId) {
    return { result: await request('thread/start', { cwd, serviceName, personality: 'friendly' }),
      recovery: null }
  }
  try {
    return { result: await request('thread/resume', { threadId, cwd }), recovery: null }
  } catch (error) {
    // The resume rejection happens before turn/start, so no scene request was accepted.
    // The UI thread index can show this thread as idle even while app-server's writer lock
    // remains held. Start one fresh session for this project request; the project transcript
    // and saved drafts remain the source of continuity.
    if (!isThreadResumeWriterConflict(error)) throw error
    return {
      result: await request('thread/start', { cwd, serviceName, personality: 'friendly' }),
      recovery: 'active-writer-conflict-before-turn-start',
    }
  }
}

function publicErrorDetail(value) {
  let raw = value && typeof value === 'object' ? JSON.stringify(value) : String(value || 'unknown')
  raw = raw.replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted]').replace(/bearer\s+\S+/ig, 'Bearer [redacted]')
  try {
    const parsed = JSON.parse(raw)
    const message = parsed?.error?.message || parsed?.message
    if (typeof message === 'string') raw = message
  } catch {}
  return raw.length > 760 ? raw.slice(-760) : raw
}

class CodexAppServerProvider {
  constructor({ timeoutMs = 600_000 } = {}) { this.timeoutMs = timeoutMs }

  async complete({ prompt, cwd, threadId, signal, onProgress, referencePaths = [], outputSchema,
    reusableSceneTemplate = null, failureEvidenceDirectory = null, purpose = 'animation' }) {
    const isBuildPlanner = purpose === 'build-planner'
    const isStylePlanner = purpose === 'style-planner'
    const isToollessPlanner = isToollessPlannerPurpose(purpose)
    const purposePrefix = isBuildPlanner ? 'BUILD' : isStylePlanner ? 'ANIMATION_STYLE' : 'ANIMATION'
    if (!['animation', 'build-planner', 'style-planner'].includes(purpose)) throw new Error('CODEX_PURPOSE_UNSUPPORTED')
    const providerStartedAt = performance.now()
    const phaseTimings = {}
    const toolCallSpans = []
    const openToolCalls = new Map()
    let firstTurnStartedMs = null
    let firstTextDeltaMs = null
    let validationFailures = 0
    let lastValidationCode = null
    let reconnectNotices = 0
    let lastReconnectNotice = null
    let reconnectTimer = null
    let childStderr = ''
    const modelInfo = configuredModelInfo()
    let connectionDiagnostic = { status: 'not-checked', available: false, authenticated: false,
      version: null, expectedVersion: SUPPORTED_CODEX_CLI_VERSION }
    let effectiveMcpConfig = null
    let mcpServerDiagnostic = null
    let mcpServerStatusListDiagnostic = { state: 'not-requested' }
    const startupEvents = []
    let lastErrorNotification = null
    let failureCode = null
    const processDiagnostic = { exitCode: null, signalCode: null, spawnErrorCode: null,
      stdoutProtocolMethods: {}, malformedProtocolLines: 0 }
    const requestMetadata = { purpose, promptChars: typeof prompt === 'string' ? prompt.length : 0,
      referenceCount: Array.isArray(referencePaths) ? referencePaths.length : 0, resumedThread: Boolean(threadId) }
    let threadRecovery = null
    const timingSnapshot = () => ({ schema: 'cipher-animation-provider-timing-v1', provider: 'codex-app-server',
      model: modelInfo.model || 'Codex configured model', reasoningEffort: modelInfo.reasoningEffort,
      timeoutMs: this.timeoutMs, elapsedMs: Math.round(performance.now() - providerStartedAt),
      request: { ...requestMetadata }, phases: { ...phaseTimings }, threadRecovery, firstTurnStartedMs, firstTextDeltaMs,
      validationFailures, lastValidationCode, reconnectNotices, lastReconnectNotice,
      failureCode,
      preflight: { ...connectionDiagnostic }, effectiveMcpConfig: effectiveMcpConfig && { ...effectiveMcpConfig },
      mcpServerStatusList: { ...mcpServerStatusListDiagnostic },
      mcpServer: mcpServerDiagnostic && { ...mcpServerDiagnostic,
        tools: [...(mcpServerDiagnostic.tools || [])], missingTools: [...(mcpServerDiagnostic.missingTools || [])] },
      mcpStartupEvents: startupEvents.map(event => ({ ...event })),
      lastErrorNotification: lastErrorNotification && { ...lastErrorNotification },
      process: { ...processDiagnostic, stdoutProtocolMethods: { ...processDiagnostic.stdoutProtocolMethods },
        ...summarizeCodexProcessOutput(childStderr) },
      toolCalls: [...toolCallSpans.map(call => ({ ...call })), ...[...openToolCalls.entries()].map(([id, call]) => ({
        tool: call.tool, startedAtUtc: call.startedAtUtc, completedAtUtc: null,
        durationMs: Math.round(performance.now() - call.startedMs), result: 'in-progress-at-stop', itemId: id,
      }))] })
    const preflightError = code => {
      const error = new Error(code)
      failureCode = failureCodeFromError(error)
      error.providerTiming = timingSnapshot()
      throw error
    }
    let phaseStarted = performance.now()
    const executable = resolveCodexExecutable()
    phaseTimings.resolveCodexExecutableMs = Math.round(performance.now() - phaseStarted)
    if (!executable) preflightError(`${purposePrefix}_CODEX_CLI_NOT_INSTALLED`)
    let nodeExecutable = null
    if (!isBuildPlanner) {
      phaseStarted = performance.now()
      nodeExecutable = resolveNodeExecutable()
      phaseTimings.resolveNodeExecutableMs = Math.round(performance.now() - phaseStarted)
      if (!nodeExecutable) preflightError('ANIMATION_NODE_RUNTIME_NOT_INSTALLED')
    }
    phaseStarted = performance.now()
    let status
    try { status = await codexConnectionStatus() }
    catch (error) {
      connectionDiagnostic = { status: 'check-failed', available: true, authenticated: false,
        version: null, expectedVersion: SUPPORTED_CODEX_CLI_VERSION, errorClass: classifySafeErrorText(error?.message) }
      preflightError(`${purposePrefix}_CODEX_STATUS_CHECK_FAILED`)
    }
    phaseTimings.connectionAndLoginCheckMs = Math.round(performance.now() - phaseStarted)
    connectionDiagnostic = { status: status.status, available: Boolean(status.available), authenticated: Boolean(status.authenticated),
      version: status.version || null, expectedVersion: status.expectedVersion || SUPPORTED_CODEX_CLI_VERSION }
    if (status.status === 'unsupported-version' || status.status === 'version-unknown')
      preflightError(`${purposePrefix}_CODEX_VERSION_UNSUPPORTED:expected=${status.expectedVersion || SUPPORTED_CODEX_CLI_VERSION},detected=${status.version || 'unknown'}`)
    if (!status.authenticated) preflightError(`${purposePrefix}_CODEX_LOGIN_REQUIRED`)
    if (typeof prompt !== 'string' || !prompt.trim()) preflightError(`${purposePrefix}_CODEX_PROMPT_EMPTY`)
    if (signal?.aborted) preflightError(`${purposePrefix}_CODEX_CANCELLED`)
    // The chat agent receives no project path. It gets only transcript/scene data from the
    // caller, and the optional exact reference folders below are the only readable roots.
    const safeCwd = os.tmpdir()
    const toolSessionDir = isToollessPlanner ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-animation-agent-'))
    let selectedTemplateFile = ''
    if (reusableSceneTemplate) {
      selectedTemplateFile = path.join(toolSessionDir, 'selected-scene-template.json')
      fs.writeFileSync(selectedTemplateFile, JSON.stringify(reusableSceneTemplate), { encoding: 'utf8', mode: 0o600 })
    }
    const toolServerFile = isToollessPlanner ? null : [path.join(__dirname, 'cipher-animation-tools-server.cjs'),
      path.join(__dirname, 'animation', 'cipher-animation-tools-server.cjs')].find(file => fs.existsSync(file))
    if (!isToollessPlanner && !toolServerFile) { try { fs.rmSync(toolSessionDir, { recursive: true, force: true }) } catch {}; preflightError('ANIMATION_TOOLS_SERVER_NOT_INSTALLED') }
    const childEnv = { ...process.env }
    delete childEnv.OPENAI_API_KEY
    delete childEnv.CODEX_API_KEY
    if (toolSessionDir) childEnv.CIPHER_ANIMATION_TOOL_SESSION_DIR = toolSessionDir
    const privateRejectedSourceDir = typeof failureEvidenceDirectory === 'string' && path.isAbsolute(failureEvidenceDirectory)
      ? path.resolve(failureEvidenceDirectory) : ''
    const config = [
      ...(isToollessPlanner ? configuredMcpServerNames().flatMap(name => [
        [`mcp_servers.${name}.enabled`, 'false'],
        [`mcp_servers.${name}.required`, 'false'],
      ]) : [
      ['mcp_servers.cipher_animation.command', JSON.stringify(nodeExecutable)],
      ['mcp_servers.cipher_animation.args', JSON.stringify([toolServerFile])],
      ['mcp_servers.cipher_animation.env', '{CIPHER_ANIMATION_TOOL_SESSION_DIR=' + JSON.stringify(toolSessionDir) +
        (selectedTemplateFile ? ',CIPHER_ANIMATION_SELECTED_TEMPLATE_FILE=' + JSON.stringify(selectedTemplateFile) : '') +
        (privateRejectedSourceDir ? ',CIPHER_ANIMATION_REJECTED_SOURCE_DIR=' + JSON.stringify(privateRejectedSourceDir) : '') + '}'],
      ['mcp_servers.cipher_animation.required', 'true'],
      ['mcp_servers.cipher_animation.enabled', 'true'],
      ['mcp_servers.node_repl.enabled', 'false'],
      ['mcp_servers.cua_repl', '{enabled=false,command=' + JSON.stringify(nodeExecutable) + ',args=["disabled-placeholder"]}'],
      ]),
      // These one-shot sessions do not need shell snapshot optimization. This override is
      // scoped to the child process and never edits the user's Codex config.
      ['features.shell_snapshot', 'false'],
    ].flatMap(([key, value]) => ['-c', key + '=' + value])
    const configuredNames = configuredMcpServerNames()
    effectiveMcpConfig = isToollessPlanner ? {
      mode: 'tool-less-planner', customServersDisabled: configuredNames.length,
      model: modelInfo.model || null, reasoningEffort: modelInfo.reasoningEffort,
    } : {
      mode: 'animation-tools', serverName: 'cipher_animation', enabled: true, required: true,
      command: path.basename(nodeExecutable), toolServer: path.basename(toolServerFile),
      toolServerPresent: fs.existsSync(toolServerFile),
      envKeyNames: ['CIPHER_ANIMATION_TOOL_SESSION_DIR', ...(selectedTemplateFile ? ['CIPHER_ANIMATION_SELECTED_TEMPLATE_FILE'] : []),
        ...(privateRejectedSourceDir ? ['CIPHER_ANIMATION_REJECTED_SOURCE_DIR'] : [])],
      userConfigEntryPresent: configuredNames.includes('cipher_animation'),
      model: modelInfo.model || null, reasoningEffort: modelInfo.reasoningEffort,
    }
    const child = spawn(executable, [...config, 'app-server', '--stdio'], { cwd: safeCwd,
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: childEnv })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { childStderr = (childStderr + chunk).slice(-3000) })
    const rl = readline.createInterface({ input: child.stdout })
    let nextId = 1
    const pending = new Map()
    let finalMessage = ''
    let activeThreadId = threadId || ''
    let turnFinished
    let resolveTurn
    let rejectTurn
    let turnTimeoutHandle
    let terminationPromise = null
    const turnDone = new Promise((resolve, reject) => { resolveTurn = resolve; rejectTurn = reject })
    // A startup/RPC failure can close the child before turn/start begins, when no code
    // awaits turnDone yet. Keep that deferred rejection observed; callers still receive
    // the original error from the request that failed.
    turnDone.catch(() => {})
    let turnId = ''
    let closed = false
    const terminate = () => terminationPromise || (terminationPromise = terminateChildTree(child))
    const rejectWithTiming = error => {
      const value = error instanceof Error ? error : new Error(String(error))
      if (!failureCode) failureCode = failureCodeFromError(value)
      value.providerTiming = timingSnapshot()
      void terminate()
      rejectTurn(value)
    }
    const request = (method, params, timeoutMs = 30_000) => new Promise((resolve, reject) => {
      const id = nextId++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`ANIMATION_CODEX_RPC_TIMEOUT:${method}`))
        // If the turn itself could not be started, close this one-shot session rather
        // than leaving a child app-server waiting invisibly in the background.
        if (method === 'turn/start') void terminate()
      }, timeoutMs)
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) },
        reject: error => { clearTimeout(timer); reject(error) } })
      child.stdin.write(JSON.stringify({ method, id, params }) + '\n')
    })
    const measuredRequest = async (phase, method, params, timeoutMs) => {
      const start = performance.now()
      try { return await request(method, params, timeoutMs) }
      finally { phaseTimings[phase] = Math.round(performance.now() - start) }
    }
    const onLine = raw => {
      let msg
      try { msg = JSON.parse(raw) } catch { processDiagnostic.malformedProtocolLines++; return }
      if (typeof msg.method === 'string') {
        const method = /^[A-Za-z0-9/_-]{1,80}$/.test(msg.method) ? msg.method : '<other>'
        processDiagnostic.stdoutProtocolMethods[method] = (processDiagnostic.stdoutProtocolMethods[method] || 0) + 1
      }
      if (msg.method === 'mcpServer/startupStatus/updated' && msg.params?.name === 'cipher_animation') {
        const params = msg.params
        startupEvents.push({ status: ['starting', 'ready', 'failed', 'cancelled'].includes(params.status) ? params.status : 'unknown',
          failureReason: safeStartupFailureReason(params.failureReason),
          errorClass: params.error ? classifySafeErrorText(params.error) : null,
          threadScoped: Boolean(params.threadId) })
        if (startupEvents.length > 16) startupEvents.shift()
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const waiter = pending.get(msg.id); pending.delete(msg.id)
        if (msg.error) waiter.reject(new Error('ANIMATION_CODEX_RPC_ERROR_' + String(msg.error.code ?? 'unknown') + ':' + String(msg.error.message || '')))
        else waiter.resolve(msg.result)
      }
      if (msg.method === 'item/completed' && msg.params?.item) {
        const item = msg.params.item
        if (['agentMessage', 'agent_message'].includes(item.type)) finalMessage = extractText(item) || finalMessage
        if (String(item.type || '').toLowerCase().includes('mcp') || String(item.type || '').toLowerCase().includes('tool')) {
          const opened = openToolCalls.get(item.id)
          const tool = String(item.tool || item.name || opened?.tool || 'unknown')
          const output = Array.isArray(item.result?.content) ? item.result.content.map(part => part?.text || '').join('\n') : ''
          const validationMatch = output.match(/\b(ANIMATION_SCENE_[A-Z0-9_]+)(?=:|\b)/)
          toolCallSpans.push({ tool, startedAtUtc: opened?.startedAtUtc || null, completedAtUtc: new Date().toISOString(),
            durationMs: opened ? Math.round(performance.now() - opened.startedMs) : null,
            result: item.result?.isError || validationMatch ? 'rejected' : 'ok', validationCode: validationMatch?.[1] || null })
          openToolCalls.delete(item.id)
          if (tool === 'animation_create_scene_module' && validationMatch) {
            validationFailures++
            lastValidationCode = validationMatch?.[1] || 'ANIMATION_SCENE_VALIDATION_FAILED'
            if (validationFailures >= 3) {
              rejectWithTiming(new Error(`ANIMATION_CODEX_SCENE_VALIDATION_RETRY_LIMIT:${lastValidationCode}`))
              return
            }
          }
        }
        // Surface coarse, content-free progress so a long code-authoring turn does not look
        // stalled. Never forward prompt text, tool arguments, or generated source here.
        if (String(item.type || '').toLowerCase().includes('mcp') || String(item.type || '').toLowerCase().includes('tool'))
          onProgress?.({ phase: 'tool', message: isBuildPlanner ? 'Codex está preparando el plan.' : 'El agente completó una operación de Animation.' })
      }
      if (msg.method === 'item/agentMessage/delta') finalMessage += String(msg.params?.delta ?? '')
      if (msg.method === 'item/started') {
        const item = msg.params?.item || {}
        if (firstTextDeltaMs === null && ['agentMessage', 'agent_message'].includes(item.type))
          firstTextDeltaMs = Math.round(performance.now() - providerStartedAt)
        if (String(item.type || '').toLowerCase().includes('mcp') || String(item.type || '').toLowerCase().includes('tool'))
          openToolCalls.set(item.id, { tool: String(item.tool || item.name || item.server || 'unknown'),
            startedMs: performance.now(), startedAtUtc: new Date().toISOString() })
        if (String(item.type || '').toLowerCase().includes('mcp') || String(item.type || '').toLowerCase().includes('tool'))
          onProgress?.({ phase: 'tool', message: isBuildPlanner ? 'Codex está preparando el plan.' : 'El agente está usando una herramienta de Animation.' })
      }
      if (msg.method === 'item/agentMessage/delta' && firstTextDeltaMs === null && String(msg.params?.delta || '').length)
        firstTextDeltaMs = Math.round(performance.now() - providerStartedAt)
      if (msg.method === 'turn/started') {
        turnId = msg.params?.turn?.id || turnId
        if (firstTurnStartedMs === null) firstTurnStartedMs = Math.round(performance.now() - providerStartedAt)
        onProgress?.({ phase: 'thinking', message: isBuildPlanner ? 'Codex está planificando Construir.' : 'Animation está preparando la dirección.' })
      }
      if (msg.method === 'turn/completed') {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
        const turn = msg.params?.turn
        if (turnId && turn?.id && turn.id !== turnId) return
        const status = turn?.status
        if (status === 'completed' || status === 'complete') resolveTurn()
        else rejectWithTiming(new Error(status === 'interrupted' ? 'ANIMATION_CANCELLED' :
          `ANIMATION_CODEX_TURN_${String(status || 'failed')}:${publicErrorDetail(turn?.error?.message || turn?.error?.code || '')}`))
      }
      if (msg.method === 'error') {
        const detail = msg.params?.error || msg.params || {}
        const message = String(detail.message || detail.code || '')
        const classification = classifyCodexErrorNotification(msg.params, { threadId: activeThreadId, turnId })
        lastErrorNotification = { action: classification.action, reason: classification.reason,
          willRetry: classification.willRetry, attempt: classification.attempt,
          threadMatches: classification.threadMatches, turnMatches: classification.turnMatches,
          errorClass: classifySafeErrorText(message) }
        if (classification.action === 'ignore') return
        if (classification.action === 'progress') {
          const current = classification.attempt?.current || reconnectNotices + 1
          const total = classification.attempt?.total || 5
          reconnectNotices++
          lastReconnectNotice = isTransientCodexReconnectMessage(message) ? message : 'retry-notification'
          onProgress?.({ phase: 'reconnecting', current, total,
            message: 'Codex está restableciendo la conexión; la solicitud sigue activa.' })
          if (!reconnectTimer)
            reconnectTimer = setTimeout(() => rejectWithTiming(new Error('ANIMATION_CODEX_RECONNECT_TIMEOUT')), 120_000)
          return
        }
        rejectWithTiming(new Error(`ANIMATION_CODEX_STREAM_ERROR:${classification.reason}:${classifySafeErrorText(message)}`))
      }
    }
    rl.on('line', onLine)
    const onAbort = () => rejectWithTiming(new Error(isBuildPlanner ? 'BUILD_CODEX_CANCELLED' : 'ANIMATION_CANCELLED'))
    signal?.addEventListener('abort', onAbort, { once: true })
    const deadline = setTimeout(() => rejectWithTiming(new Error('ANIMATION_CODEX_TIMEOUT')), this.timeoutMs)
    child.once('error', error => {
      processDiagnostic.spawnErrorCode = typeof error?.code === 'string' ? error.code.slice(0, 48) : 'unknown'
      rejectWithTiming(new Error('ANIMATION_CODEX_SPAWN_FAILED'))
    })
    child.once('close', (exitCode, signalCode) => {
      closed = true
      processDiagnostic.exitCode = Number.isInteger(exitCode) ? exitCode : null
      processDiagnostic.signalCode = typeof signalCode === 'string' ? signalCode : null
      const closedError = new Error('ANIMATION_CODEX_SERVER_CLOSED')
      for (const waiter of pending.values()) waiter.reject(closedError)
      pending.clear()
      if (!turnFinished) rejectWithTiming(closedError)
    })
    let operationError = null
    let providerResult = null
    try {
      await measuredRequest('initializeRpcMs', 'initialize',
        { clientInfo: { name: 'cipher-animation', title: 'Cipher Animation', version: '1.0.0' } })
      child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n')
      phaseStarted = performance.now()
      const serviceName = isBuildPlanner ? 'cipher-build-planner' : 'cipher-animation'
      const threadOpen = await openCodexThread(request, threadId, safeCwd, serviceName)
      const threadResult = threadOpen.result
      threadRecovery = threadOpen.recovery
      phaseTimings.threadResumeOrStartRpcMs = Math.round(performance.now() - phaseStarted)
      activeThreadId = threadResult?.thread?.id || threadResult?.id || activeThreadId
      if (!activeThreadId) throw new Error('ANIMATION_CODEX_THREAD_ID_MISSING')
      let mcpToolNames = []
      if (!isToollessPlanner) {
        const mcpStatusStarted = performance.now()
        let mcpStatus
        try {
          mcpStatus = await measuredRequest('toolServerReadinessRpcMs', 'mcpServerStatus/list', { threadId: activeThreadId,
            serverName: 'cipher_animation', detail: 'toolsAndAuthOnly', limit: 10 })
        } catch (error) {
          mcpServerStatusListDiagnostic = { state: 'request-failed', errorClass: classifySafeErrorText(error?.message),
            elapsedMs: Math.round(performance.now() - mcpStatusStarted) }
          throw error
        }
        const mcpServer = (mcpStatus?.data || []).find(server => server.name === 'cipher_animation')
        mcpServerStatusListDiagnostic = { state: 'received', entryCount: Array.isArray(mcpStatus?.data) ? mcpStatus.data.length : 0,
          serverFound: Boolean(mcpServer), elapsedMs: Math.round(performance.now() - mcpStatusStarted) }
        mcpServerDiagnostic = classifyMcpServerStatus({ server: mcpServer, startupEvents,
          enabled: effectiveMcpConfig?.enabled === true, requiredTools: REQUIRED_ANIMATION_TOOLS })
        mcpToolNames = [...mcpServerDiagnostic.tools]
        if (mcpServerDiagnostic.state !== 'ready')
          throw new Error(`ANIMATION_TOOLS_SERVER_UNAVAILABLE:${mcpServerDiagnostic.state}`)
      }
      onProgress?.({ phase: 'request', message: isBuildPlanner ? 'Enviando el guion al planificador Codex.' : 'Enviando el contexto seleccionado al agente local.' })
      const roots = [...new Set(referencePaths.filter(x => typeof x === 'string' && path.isAbsolute(x)).map(x => path.dirname(x)))]
      const input = [{ type: 'text', text: prompt }, ...referencePaths.filter(x => typeof x === 'string' && path.isAbsolute(x))
        .map(imagePath => ({ type: 'localImage', path: imagePath }))]
      const started = await measuredRequest('turnStartRpcMs', 'turn/start', { threadId: activeThreadId, input,
        approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly', networkAccess: false },
        ...(outputSchema ? { outputSchema } : {}) }, 120_000)
      turnId = started?.turn?.id || turnId
      turnFinished = false
      const turnDeadline = new Promise((_, reject) => {
        turnTimeoutHandle = setTimeout(() => reject(new Error('ANIMATION_CODEX_TIMEOUT')), this.timeoutMs)
      })
      const turnWaitStarted = performance.now()
      try { await Promise.race([turnDone, turnDeadline]) }
      catch (error) {
        if (error && typeof error === 'object' && !error.providerTiming) error.providerTiming = timingSnapshot()
        throw error
      } finally { phaseTimings.agentTurnWaitMs = Math.round(performance.now() - turnWaitStarted) }
      turnFinished = true
      phaseTimings.providerTotalMs = Math.round(performance.now() - providerStartedAt)
      if (!finalMessage.trim()) throw new Error('ANIMATION_CODEX_EMPTY_RESPONSE')
      const artifactPath = toolSessionDir && path.join(toolSessionDir, 'agent-artifact.json')
      const tracePath = toolSessionDir && path.join(toolSessionDir, 'animation-tool-trace.jsonl')
      const artifact = artifactPath && fs.existsSync(artifactPath) ? JSON.parse(fs.readFileSync(artifactPath, 'utf8')) : null
      const toolTrace = tracePath && fs.existsSync(tracePath) ? fs.readFileSync(tracePath, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : []
      providerResult = { text: finalMessage.trim(), threadId: activeThreadId, provider: 'codex-app-server',
        model: modelInfo.model || 'Codex configured model', reasoningEffort: modelInfo.reasoningEffort,
        artifact, toolTrace, mcpToolNames, providerTiming: null }
      return providerResult
    } catch (error) {
      // The inner turn-wait catch runs before its finally block records the wait duration.
      // Reattach the complete snapshot after cleanup, while keeping the original error.
      operationError = error
      throw error
    } finally {
      clearTimeout(deadline)
      if (turnTimeoutHandle) clearTimeout(turnTimeoutHandle)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      signal?.removeEventListener('abort', onAbort)
      rl.close()
      if (!closed) {
        try { child.stdin.end() } catch {}
        const exited = await waitForClose(child, 1200)
        if (!exited) await terminate()
      }
      if (toolSessionDir) try { fs.rmSync(toolSessionDir, { recursive: true, force: true }) } catch {}
      phaseTimings.providerTotalMs = Math.round(performance.now() - providerStartedAt)
      if (operationError && typeof operationError === 'object') operationError.providerTiming = timingSnapshot()
      else if (providerResult) providerResult.providerTiming = timingSnapshot()
    }
  }
}

module.exports = { CodexAppServerProvider, codexConnectionStatus, resolveCodexExecutable, resolveNodeExecutable,
  isThreadResumeWriterConflict, isToollessPlannerPurpose, isTransientCodexReconnectMessage, openCodexThread,
  classifyCodexErrorNotification, classifyMcpServerStatus, summarizeCodexProcessOutput,
  parseMcpServerNames, buildPlannerMcpOverrides,
  REQUIRED_ANIMATION_TOOLS, SUPPORTED_CODEX_CLI_VERSION }
