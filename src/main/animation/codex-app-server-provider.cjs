'use strict'

const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const readline = require('node:readline')
const { performance } = require('node:perf_hooks')
const SUPPORTED_CODEX_CLI_VERSION = '0.160.1'

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
    if (!['animation', 'build-planner'].includes(purpose)) throw new Error('CODEX_PURPOSE_UNSUPPORTED')
    const providerStartedAt = performance.now()
    const phaseTimings = {}
    const toolCallSpans = []
    const openToolCalls = new Map()
    let firstTurnStartedMs = null
    let firstTextDeltaMs = null
    let validationFailures = 0
    let lastValidationCode = null
    const modelInfo = configuredModelInfo()
    const requestMetadata = { purpose, promptChars: typeof prompt === 'string' ? prompt.length : 0,
      referenceCount: Array.isArray(referencePaths) ? referencePaths.length : 0, resumedThread: Boolean(threadId) }
    let threadRecovery = null
    const timingSnapshot = () => ({ schema: 'cipher-animation-provider-timing-v1', provider: 'codex-app-server',
      model: modelInfo.model || 'Codex configured model', reasoningEffort: modelInfo.reasoningEffort,
      timeoutMs: this.timeoutMs, elapsedMs: Math.round(performance.now() - providerStartedAt),
      request: { ...requestMetadata }, phases: { ...phaseTimings }, threadRecovery, firstTurnStartedMs, firstTextDeltaMs,
      validationFailures, lastValidationCode,
      toolCalls: [...toolCallSpans.map(call => ({ ...call })), ...[...openToolCalls.entries()].map(([id, call]) => ({
        tool: call.tool, startedAtUtc: call.startedAtUtc, completedAtUtc: null,
        durationMs: Math.round(performance.now() - call.startedMs), result: 'in-progress-at-stop', itemId: id,
      }))] })
    let phaseStarted = performance.now()
    const executable = resolveCodexExecutable()
    phaseTimings.resolveCodexExecutableMs = Math.round(performance.now() - phaseStarted)
    if (!executable) throw new Error(isBuildPlanner ? 'BUILD_CODEX_CLI_NOT_INSTALLED' : 'ANIMATION_CODEX_CLI_NOT_INSTALLED')
    let nodeExecutable = null
    if (!isBuildPlanner) {
      phaseStarted = performance.now()
      nodeExecutable = resolveNodeExecutable()
      phaseTimings.resolveNodeExecutableMs = Math.round(performance.now() - phaseStarted)
      if (!nodeExecutable) throw new Error('ANIMATION_NODE_RUNTIME_NOT_INSTALLED')
    }
    phaseStarted = performance.now()
    const status = await codexConnectionStatus()
    phaseTimings.connectionAndLoginCheckMs = Math.round(performance.now() - phaseStarted)
    if (status.status === 'unsupported-version' || status.status === 'version-unknown')
      throw new Error(`${isBuildPlanner ? 'BUILD' : 'ANIMATION'}_CODEX_VERSION_UNSUPPORTED:expected=${status.expectedVersion || SUPPORTED_CODEX_CLI_VERSION},detected=${status.version || 'unknown'}`)
    if (!status.authenticated) throw new Error(isBuildPlanner ? 'BUILD_CODEX_LOGIN_REQUIRED' : 'ANIMATION_CODEX_LOGIN_REQUIRED')
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error(isBuildPlanner ? 'BUILD_CODEX_PROMPT_EMPTY' : 'ANIMATION_PROMPT_EMPTY')
    if (signal?.aborted) throw new Error(isBuildPlanner ? 'BUILD_CODEX_CANCELLED' : 'ANIMATION_CANCELLED')
    // The chat agent receives no project path. It gets only transcript/scene data from the
    // caller, and the optional exact reference folders below are the only readable roots.
    const safeCwd = os.tmpdir()
    const toolSessionDir = isBuildPlanner ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-animation-agent-'))
    let selectedTemplateFile = ''
    if (reusableSceneTemplate) {
      selectedTemplateFile = path.join(toolSessionDir, 'selected-scene-template.json')
      fs.writeFileSync(selectedTemplateFile, JSON.stringify(reusableSceneTemplate), { encoding: 'utf8', mode: 0o600 })
    }
    const toolServerFile = isBuildPlanner ? null : [path.join(__dirname, 'cipher-animation-tools-server.cjs'),
      path.join(__dirname, 'animation', 'cipher-animation-tools-server.cjs')].find(file => fs.existsSync(file))
    if (!isBuildPlanner && !toolServerFile) { try { fs.rmSync(toolSessionDir, { recursive: true, force: true }) } catch {}; throw new Error('ANIMATION_TOOLS_SERVER_NOT_INSTALLED') }
    const childEnv = { ...process.env }
    delete childEnv.OPENAI_API_KEY
    delete childEnv.CODEX_API_KEY
    if (toolSessionDir) childEnv.CIPHER_ANIMATION_TOOL_SESSION_DIR = toolSessionDir
    const privateRejectedSourceDir = typeof failureEvidenceDirectory === 'string' && path.isAbsolute(failureEvidenceDirectory)
      ? path.resolve(failureEvidenceDirectory) : ''
    const config = [
      ...(isBuildPlanner ? configuredMcpServerNames().flatMap(name => [
        [`mcp_servers.${name}.enabled`, 'false'],
        [`mcp_servers.${name}.required`, 'false'],
      ]) : [
      ['mcp_servers.cipher_animation.command', JSON.stringify(nodeExecutable)],
      ['mcp_servers.cipher_animation.args', JSON.stringify([toolServerFile])],
      ['mcp_servers.cipher_animation.env', '{CIPHER_ANIMATION_TOOL_SESSION_DIR=' + JSON.stringify(toolSessionDir) +
        (selectedTemplateFile ? ',CIPHER_ANIMATION_SELECTED_TEMPLATE_FILE=' + JSON.stringify(selectedTemplateFile) : '') +
        (privateRejectedSourceDir ? ',CIPHER_ANIMATION_REJECTED_SOURCE_DIR=' + JSON.stringify(privateRejectedSourceDir) : '') + '}'],
      ['mcp_servers.cipher_animation.required', 'true'],
      ['mcp_servers.node_repl.enabled', 'false'],
      ['mcp_servers.cua_repl', '{enabled=false,command=' + JSON.stringify(nodeExecutable) + ',args=["disabled-placeholder"]}'],
      ]),
      // These one-shot sessions do not need shell snapshot optimization. This override is
      // scoped to the child process and never edits the user's Codex config.
      ['features.shell_snapshot', 'false'],
    ].flatMap(([key, value]) => ['-c', key + '=' + value])
    const child = spawn(executable, [...config, 'app-server', '--stdio'], { cwd: safeCwd,
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: childEnv })
    let childStderr = ''
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
    let turnId = ''
    let closed = false
    const terminate = () => terminationPromise || (terminationPromise = terminateChildTree(child))
    const rejectWithTiming = error => {
      const value = error instanceof Error ? error : new Error(String(error))
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
      try { msg = JSON.parse(raw) } catch { return }
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
        const turn = msg.params?.turn
        if (turnId && turn?.id && turn.id !== turnId) return
        const status = turn?.status
        if (status === 'completed' || status === 'complete') resolveTurn()
        else rejectWithTiming(new Error(status === 'interrupted' ? 'ANIMATION_CANCELLED' :
          `ANIMATION_CODEX_TURN_${String(status || 'failed')}:${publicErrorDetail(turn?.error?.message || turn?.error?.code || '')}`))
      }
      if (msg.method === 'error') {
        const detail = msg.params?.error || msg.params || {}
        rejectWithTiming(new Error(`ANIMATION_CODEX_STREAM_ERROR:${publicErrorDetail(detail.message || detail.code || '')}`))
      }
    }
    rl.on('line', onLine)
    const onAbort = () => rejectWithTiming(new Error(isBuildPlanner ? 'BUILD_CODEX_CANCELLED' : 'ANIMATION_CANCELLED'))
    signal?.addEventListener('abort', onAbort, { once: true })
    const deadline = setTimeout(() => rejectWithTiming(new Error('ANIMATION_CODEX_TIMEOUT')), this.timeoutMs)
    child.once('error', () => rejectWithTiming(new Error('ANIMATION_CODEX_SPAWN_FAILED')))
    child.once('close', () => {
      closed = true
      const detail = publicErrorDetail(childStderr)
      const closedError = new Error(`ANIMATION_CODEX_SERVER_CLOSED${detail && detail !== 'unknown' ? ':' + detail : ''}`)
      for (const waiter of pending.values()) waiter.reject(closedError)
      pending.clear()
      if (!turnFinished) rejectWithTiming(closedError)
    })
    let operationError = null
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
      if (!isBuildPlanner) {
        const mcpStatus = await measuredRequest('toolServerReadinessRpcMs', 'mcpServerStatus/list', { threadId: activeThreadId,
          serverName: 'cipher_animation', detail: 'toolsAndAuthOnly', limit: 10 })
        const mcpServer = (mcpStatus?.data || []).find(server => server.name === 'cipher_animation')
        mcpToolNames = Object.keys(mcpServer?.tools || {})
        if (!mcpServer || !mcpToolNames.includes('animation_get_capabilities') || !mcpToolNames.includes('animation_configure_recipe') ||
            !mcpToolNames.includes('animation_create_scene_module'))
          throw new Error(`ANIMATION_TOOLS_SERVER_UNAVAILABLE:${mcpServer?.runtimeStatus?.status || mcpServer?.toolsError || 'not-registered'}`)
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
      return { text: finalMessage.trim(), threadId: activeThreadId, provider: 'codex-app-server',
        model: modelInfo.model || 'Codex configured model', reasoningEffort: modelInfo.reasoningEffort,
        artifact, toolTrace, mcpToolNames, providerTiming: timingSnapshot() }
    } catch (error) {
      // The inner turn-wait catch runs before its finally block records the wait duration.
      // Reattach the complete snapshot after cleanup, while keeping the original error.
      operationError = error
      throw error
    } finally {
      clearTimeout(deadline)
      if (turnTimeoutHandle) clearTimeout(turnTimeoutHandle)
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
    }
  }
}

module.exports = { CodexAppServerProvider, codexConnectionStatus, resolveCodexExecutable, resolveNodeExecutable,
  isThreadResumeWriterConflict, openCodexThread, parseMcpServerNames, buildPlannerMcpOverrides, SUPPORTED_CODEX_CLI_VERSION }
