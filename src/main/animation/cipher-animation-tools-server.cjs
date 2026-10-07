'use strict'

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const crypto = require('node:crypto')
const { validateSceneModule } = require('./scene-module-contract.cjs')
const { applyExactSourceEdits, MAX_SOURCE_EDITS, MAX_EDIT_TEXT_CHARS } = require('./scene-template-source-edits.cjs')
const { ANIMATION_COMPONENTS_V1 } = require('./contract-v1.cjs')

const sessionDir = process.env.CIPHER_ANIMATION_TOOL_SESSION_DIR
if (!sessionDir || !path.isAbsolute(sessionDir)) process.exit(73)
fs.mkdirSync(sessionDir, { recursive: true })
const traceFile = path.join(sessionDir, 'animation-tool-trace.jsonl')
const artifactFile = path.join(sessionDir, 'agent-artifact.json')
const selectedTemplateFile = process.env.CIPHER_ANIMATION_SELECTED_TEMPLATE_FILE
let sequence = 0

const participant = {
  type: 'object', additionalProperties: false, required: ['instanceId', 'symbol', 'label', 'meaning', 'side'],
  properties: {
    instanceId: { type: 'string' }, symbol: { type: 'string', enum: ['voice', 'idea', 'data', 'research', 'group', 'object', 'result', 'growth'] },
    label: { type: 'string' }, meaning: { type: 'string' }, side: { type: 'string', enum: ['', 'left', 'right'] },
  },
}
const relation = {
  type: 'object', additionalProperties: false, required: ['id', 'from', 'to', 'kind', 'meaning'],
  properties: { id: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' },
    kind: { type: 'string', enum: ['contributes', 'transfers', 'feeds', 'responds', 'groups', 'associates', 'coordinates', 'contrasts', 'compares'] },
    meaning: { type: 'string' } },
}
const recipeConfig = {
  type: 'object', additionalProperties: false,
  required: ['recipeId', 'headline', 'proposition', 'outcome', 'participants', 'relations', 'paletteId', 'labelScale', 'focus', 'actionLabel', 'arrivalOrder', 'durationSec', 'fps'],
  properties: {
    recipeId: { type: 'string', enum: ['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'] },
    headline: { type: 'string' }, proposition: { type: 'string' }, outcome: { type: 'string' },
    participants: { type: 'array', items: participant }, relations: { type: 'array', items: relation },
    paletteId: { type: 'string', enum: ['paper', 'night', 'garden', 'sapphire'] }, labelScale: { type: 'number' },
    focus: { type: 'string', enum: ['group', 'destination', 'difference', 'sequence'] },
    actionLabel: { type: 'string' }, arrivalOrder: { type: 'array', items: { type: 'string' },
      description: 'Usually [] unless the arrival order itself explains the narration. If non-empty, it must be an exact one-to-one permutation of relations[].id.' },
    durationSec: { type: 'number' }, fps: { type: 'number' },
  },
}
const sceneMetadata = {
  type: 'object', additionalProperties: false, required: ['id', 'version', 'title', 'summary', 'compositionDescription', 'objects', 'behaviors'],
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{2,63}$', description: 'Stable kebab-case ID matching ^[a-z][a-z0-9-]{2,63}$.' },
    version: { type: 'integer', enum: [1] }, title: { type: 'string' }, summary: { type: 'string' },
    compositionDescription: { type: 'string' },
    objects: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'description'],
      properties: { id: { type: 'string' }, description: { type: 'string' } } } },
    behaviors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'description'],
      properties: { id: { type: 'string' }, description: { type: 'string' } } } },
  },
}

const parameterSchemaInput = {
  type: 'object', additionalProperties: false,
  required: ['type', 'properties', 'additionalProperties', 'required'],
  properties: {
    type: { type: 'string', enum: ['object'] },
    properties: { type: 'object', additionalProperties: { type: 'object' },
      description: 'Map each parameter name to a typed rule, for example {"headline":{"type":"string"},"scale":{"type":"number"}}.' },
    additionalProperties: { type: 'boolean', enum: [false] },
    required: { type: 'array', items: { type: 'string' } },
  },
}

const tools = [
  { name: 'animation_get_capabilities', description: 'Read the Animation tool capabilities and choose a recipe or code-authored scene route.',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] } },
  { name: 'animation_configure_recipe', description: 'Configure a registered Animation recipe when its fixed composition genuinely expresses the requested idea. Pass every semantic field as structured JSON objects; do not flatten participants or relationships into delimited strings.',
    annotations: { destructiveHint: false, openWorldHint: false }, inputSchema: { type: 'object', additionalProperties: false, required: ['config'],
      properties: { config: recipeConfig } } },
  { name: 'animation_create_scene_module', description: 'Create an Animation Canvas procedural scene module when no registered recipe can express the idea. Supply actual JavaScript drawing code that defines objects, behaviors, and the composition. The code must use CipherAnimation.registerScene and the supplied Canvas drawing library API, with no catalog images/icons, network, filesystem, DOM, or browser-global capabilities. scene.id must match ^[a-z][a-z0-9-]{2,63}$ and version must be 1. parameterSchema must be a complete JSON Schema object with type="object", properties map, additionalProperties=false, and required array.',
    annotations: { destructiveHint: false, openWorldHint: false }, inputSchema: { type: 'object', additionalProperties: false,
      required: ['scene', 'source', 'parameterSchema', 'parameterValues', 'durationSec', 'fps', 'paletteId'],
      properties: { scene: sceneMetadata, source: { type: 'string' },
        parameterSchema: parameterSchemaInput, parameterValues: { type: 'object' },
        durationSec: { type: 'number' }, fps: { type: 'number' }, paletteId: { type: 'string', enum: ['paper', 'night', 'garden', 'sapphire'] } } },
  },
  { name: 'animation_reuse_scene_template', description: 'Reuse the user-selected, verified procedural scene module loaded from the project library. Do not copy the module source into the chat or rewrite the whole module. Change declared content parameters, palette, typography/scales, or duration; when a requested localized code change is necessary, use sourceEdits with one or more exact unique from/to snippets (bounded size/count), then validate the resulting module. Preserve unrelated source and style; do not carry over facts that are not parameterized and supported by the current narration.',
    annotations: { destructiveHint: false, openWorldHint: false },
    inputSchema: { type: 'object', additionalProperties: false,
      required: ['parameters', 'paletteId', 'durationSec', 'scene'],
      properties: { parameters: { type: 'object' }, paletteId: { type: 'string', enum: ['paper', 'night', 'garden', 'sapphire'] },
        sourceEdits: { type: 'array', maxItems: MAX_SOURCE_EDITS,
          description: 'Optional localized code change against the saved module. Each `from` must occur exactly once; changes are applied by the tool before module validation.',
          items: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: {
            from: { type: 'string', minLength: 1, maxLength: MAX_EDIT_TEXT_CHARS },
            to: { type: 'string', minLength: 1, maxLength: MAX_EDIT_TEXT_CHARS },
          } } },
        durationSec: { type: 'number' }, style: { type: 'object', additionalProperties: false,
          properties: { titleFontFamily: { type: 'string', enum: ['Instrument Serif', 'DM Sans'] },
            bodyFontFamily: { type: 'string', enum: ['Instrument Serif', 'DM Sans'] },
            titleScale: { type: 'number', minimum: 0.6, maximum: 1.6 },
            labelScale: { type: 'number', minimum: 0.6, maximum: 1.6 },
            gridOpacity: { type: 'number', minimum: 0, maximum: 0.3 }, textureStrength: { type: 'number', minimum: 0, maximum: 0.2 },
            surfaceDepth: { type: 'number', minimum: 0.5, maximum: 1.5 }, shadowStrength: { type: 'number', minimum: 0, maximum: 1 },
            cameraDrift: { type: 'number', minimum: 0, maximum: 0.08 }, profileId: { type: 'string' }, profileVersion: { type: 'integer' } } }, scene: sceneMetadata } } },
]

function jsonLine(value) { process.stdout.write(JSON.stringify(value) + '\n') }
function result(id, value) { jsonLine({ jsonrpc: '2.0', id, result: value }) }
function error(id, code, message) { jsonLine({ jsonrpc: '2.0', id, error: { code, message } }) }
function textResult(text, structuredContent) {
  return { content: [{ type: 'text', text }], ...(structuredContent ? { structuredContent } : {}) }
}
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function recordTrace(tool, input, summary) {
  const entry = { sequence: ++sequence, at: new Date().toISOString(), tool,
    inputSha256: sha(JSON.stringify(input)), summary }
  fs.appendFileSync(traceFile, JSON.stringify(entry) + '\n', { encoding: 'utf8', mode: 0o600 })
  return entry
}
function saveRejectedSource(input, errorValue) {
  const source = input?.source
  const directory = process.env.CIPHER_ANIMATION_REJECTED_SOURCE_DIR
  const error = String(errorValue?.message || errorValue || '')
  if (typeof source !== 'string' || !path.isAbsolute(directory || '') ||
      !/^ANIMATION_SCENE_[A-Z0-9_]+/.test(error)) return null
  try {
    const sourceSha256 = sha(source)
    const file = `${Date.now()}-${crypto.randomUUID()}.rejected.js.txt`
    const root = path.resolve(directory)
    fs.mkdirSync(root, { recursive: true })
    fs.writeFileSync(path.join(root, file), source, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    fs.writeFileSync(path.join(root, file.replace(/\.rejected\.js\.txt$/, '.json')),
      JSON.stringify({ schema: 'cipher-animation-private-rejected-source-v1', sceneId: input?.scene?.id || null,
        sourceSha256, sourceLength: source.length, error, evidenceOnly: true, executableModule: false,
        capturedAt: new Date().toISOString(), sourceFile: file }, null, 2) + '\n',
      { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    return file
  } catch { return null }
}
function validateRecipeConfig(config) {
  if (!config || typeof config !== 'object' || !['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'].includes(config.recipeId))
    throw new Error('ANIMATION_RECIPE_CONFIG_INVALID')
  if (!Array.isArray(config.participants) || !Array.isArray(config.relations) ||
      typeof config.headline !== 'string' || typeof config.proposition !== 'string' || typeof config.outcome !== 'string')
    throw new Error('ANIMATION_RECIPE_CONTENT_INVALID')
  const participantIds = new Set(config.participants.map(p => p?.instanceId))
  const relationIds = config.relations.map(r => r?.id)
  if (participantIds.size !== config.participants.length || config.participants.some(p => !p?.instanceId))
    throw new Error('ANIMATION_TOOL_PARTICIPANT_IDS_INVALID')
  if (config.relations.some(r => !r?.id || !participantIds.has(r.from) || !participantIds.has(r.to) || r.from === r.to) ||
      new Set(relationIds).size !== relationIds.length)
    throw new Error('ANIMATION_TOOL_RELATION_ENDPOINTS_INVALID')
  const arrivalOrder = config.arrivalOrder || []
  if (!Array.isArray(arrivalOrder) || arrivalOrder.length &&
      (arrivalOrder.length !== relationIds.length || new Set(arrivalOrder).size !== arrivalOrder.length ||
        arrivalOrder.some(id => !relationIds.includes(id))))
    throw new Error('ANIMATION_TOOL_ARRIVAL_ORDER_MUST_PERMUTE_RELATIONS')
  return config
}
function handleTool(name, input) {
  if (name === 'animation_get_capabilities') {
    let selectedSceneTemplate = { available: false }
    if (selectedTemplateFile && fs.existsSync(selectedTemplateFile)) {
      try {
        const selected = JSON.parse(fs.readFileSync(selectedTemplateFile, 'utf8'))
        selectedSceneTemplate = { available: true, templateId: selected.templateId, title: selected.title,
          sceneId: selected.module?.scene?.id, sourceSha256: selected.module?.sourceSha256,
          paletteId: selected.paletteId, style: selected.style,
          parameterNames: Object.keys(selected.module?.parameterSchema?.properties || {}) }
      } catch {}
    }
    const summary = { routes: ['configure_recipe', 'create_scene_module', ...(selectedSceneTemplate.available ? ['reuse_scene_template'] : [])],
      recipes: [
        { id: 'explanatory-transfer-v1', suitableFor: 'directional transfer into a changed destination; fixed registered layout' },
        { id: 'group-formation-v1', suitableFor: 'group organization; fixed registered layout' },
        { id: 'comparison-v1', suitableFor: 'explicit left/right comparison; fixed registered layout' },
      ],
      components: ANIMATION_COMPONENTS_V1.map(component => ({ id: component.id, version: component.version,
        purpose: component.purpose, params: component.params, compatibleRecipes: component.compatibleRecipes,
        ...(component.limits ? { limits: component.limits } : {}) })),
      codeRoute: { renderer: 'Animation Canvas', allowsCodeObjectsBehaviorsAndComposition: true,
        drawingLibrary: 'Animation Canvas',
        inputs: ['CanvasRenderingContext2D', 'timeSec', 'durationSec', 'width', 'height', 'palette', 'parameter values'],
        library: ['keyPath', 'settle', 'drawingTrack', 'makeStroke', 'drawStroke', 'motionPath', 'morphPoints', 'solveLimb', 'withCamera',
          'editorialBackground', 'editorialObject', 'editorialText', 'editorialRoute', 'editorialTraveler'],
        libraryCalls: {
          editorialBackground: 'lib.editorialBackground(ctx, {width,height,palette,gridOpacity,textureStrength,seed})',
          editorialObject: 'lib.editorialObject(ctx, {x,y,size,shape,glyph,palette,style})',
          editorialText: 'lib.editorialText(ctx, {text,x,y,fontFamily,size,maxWidth,maxLines,align,color,style})',
          editorialRoute: 'lib.editorialRoute(ctx, {points:[{x,y},...],progress,width,color,traveler,style})',
          editorialTraveler: 'lib.editorialTraveler(ctx, {x,y,radius,color,glow,edge})',
        },
        camera: { componentId: 'camera-transform-v1', focusCoordinates: 'normalized viewport coordinates', follows: ['world geometry', 'participants', 'anchors', 'effects drawn inside drawWorld'], fixedScreen: 'draw after withCamera returns' },
        style: { paletteRoles: ['background', 'ink', 'muted', 'accent', 'secondary', 'surface', 'shadow', 'highlight'], fonts: ['Instrument Serif', 'DM Sans'], adjustments: 'palette and finish parameters do not change geometry' },
        assets: 'procedural vector/canvas drawing only; no catalog images or icons' },
      selectedSceneTemplate }
    const entry = recordTrace(name, input, summary)
    return textResult(JSON.stringify(summary), { traceSequence: entry.sequence, ...summary })
  }
  if (name === 'animation_configure_recipe') {
    const config = validateRecipeConfig(input?.config)
    const artifact = { schema: 'cipher-animation-agent-artifact-v1', route: 'recipe',
      config, createdAt: new Date().toISOString() }
    fs.writeFileSync(artifactFile, JSON.stringify(artifact, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    const entry = recordTrace(name, input, { route: 'recipe', recipeId: config.recipeId,
      participants: config.participants.length, relations: config.relations.length })
    return textResult('Recipe configuration accepted and staged.', { route: 'recipe', traceSequence: entry.sequence })
  }
  if (name === 'animation_create_scene_module') {
    const validated = validateSceneModule(input)
    if (!['paper', 'night', 'garden', 'sapphire'].includes(input.paletteId)) throw new Error('ANIMATION_PALETTE_NOT_REGISTERED')
    const artifact = { schema: 'cipher-animation-agent-artifact-v1', route: 'code',
      module: validated, paletteId: input.paletteId, createdAt: new Date().toISOString() }
    fs.writeFileSync(artifactFile, JSON.stringify(artifact, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    const entry = recordTrace(name, input, { route: 'code', sceneId: validated.scene.id,
      objects: validated.scene.objects.map(x => x.id), behaviors: validated.scene.behaviors.map(x => x.id),
      sourceSha256: validated.sourceSha256, parameterNames: Object.keys(validated.parameters) })
    return textResult('Procedural Animation Canvas module staged. Source SHA-256: ' + validated.sourceSha256,
      { route: 'code', sceneId: validated.scene.id, sourceSha256: validated.sourceSha256, traceSequence: entry.sequence })
  }
  if (name === 'animation_reuse_scene_template') {
    if (!selectedTemplateFile || !fs.existsSync(selectedTemplateFile)) throw new Error('ANIMATION_SELECTED_SCENE_TEMPLATE_MISSING')
    const saved = JSON.parse(fs.readFileSync(selectedTemplateFile, 'utf8'))
    if (!input?.scene || input.scene.id !== saved.module?.scene?.id || input.scene.version !== saved.module?.scene?.version)
      throw new Error('ANIMATION_REUSE_SCENE_METADATA_REQUIRED')
    const sourceEdits = applyExactSourceEdits(saved.module?.source, input?.sourceEdits || [])
    const validated = validateSceneModule({ ...saved.module, source: sourceEdits.source, scene: input.scene, parameterValues: input?.parameters,
      durationSec: input?.durationSec })
    if (!['paper', 'night', 'garden', 'sapphire'].includes(input?.paletteId)) throw new Error('ANIMATION_PALETTE_NOT_REGISTERED')
    const style = { ...(saved.style || {}), ...(input?.style || {}) }
    const artifact = { schema: 'cipher-animation-agent-artifact-v1', route: 'code', module: validated,
      paletteId: input.paletteId, style, reusedTemplateId: saved.templateId, createdAt: new Date().toISOString() }
    fs.writeFileSync(artifactFile, JSON.stringify(artifact, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    const entry = recordTrace(name, input, { route: 'code', reusedTemplateId: saved.templateId,
      sceneId: validated.scene.id, sceneTitle: validated.scene.title, sourceSha256: validated.sourceSha256,
      parameterNames: Object.keys(validated.parameters), sourceEditCount: sourceEdits.appliedCount,
      sourceChanged: sourceEdits.source !== saved.module.source })
    return textResult('Verified procedural scene template reused. Source SHA-256: ' + validated.sourceSha256,
      { route: 'code', sceneId: validated.scene.id, sourceSha256: validated.sourceSha256, traceSequence: entry.sequence })
  }
  throw new Error('ANIMATION_TOOL_UNKNOWN')
}

const reader = readline.createInterface({ input: process.stdin })
reader.on('line', line => {
  let request
  try { request = JSON.parse(line) } catch { return }
  const id = request.id
  if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') return
  if (request.method === 'initialize') {
    result(id, { protocolVersion: request.params?.protocolVersion || '2025-03-26',
      capabilities: { tools: {} }, serverInfo: { name: 'cipher-animation-tools', version: '1.0.0' } })
    return
  }
  if (request.method === 'ping') { result(id, {}); return }
  if (request.method === 'tools/list') { result(id, { tools }); return }
  if (request.method === 'tools/call') {
    const toolName = String(request.params?.name || '')
    const input = request.params?.arguments || {}
    try {
      const value = handleTool(toolName, input)
      result(id, value)
    } catch (errorValue) {
      const retained = toolName === 'animation_create_scene_module' ? saveRejectedSource(input, errorValue) : null
      const detail = String(errorValue?.message || errorValue) + (retained ? ' [rejected source retained as private, non-executable evidence]' : '')
      result(id, { content: [{ type: 'text', text: detail }], isError: true })
    }
    return
  }
  error(id, -32601, 'Method not found')
})
