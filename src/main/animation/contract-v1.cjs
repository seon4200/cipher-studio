'use strict'

const SCHEMA = 'cipher-animation-scene-plan-v1'
const CONFIG_SCHEMA = 'cipher-animation-config-v1'
const RECIPES = Object.freeze({
  'explanatory-transfer-v1': {
    id: 'explanatory-transfer-v1', version: 2, minParticipants: 2, maxParticipants: 4,
    requiresRelation: true, compatibleRelations: ['contributes', 'transfers', 'feeds', 'responds'],
    purpose: 'Muestra una relación direccional y un cambio provocado en el destino.',
  },
  'group-formation-v1': {
    id: 'group-formation-v1', version: 1, minParticipants: 2, maxParticipants: 6,
    requiresRelation: false, compatibleRelations: ['groups', 'associates', 'coordinates'],
    purpose: 'Organiza participantes separados en una forma colectiva legible.',
  },
  'comparison-v1': {
    id: 'comparison-v1', version: 1, minParticipants: 2, maxParticipants: 4,
    requiresRelation: false, compatibleRelations: ['contrasts', 'compares'],
    purpose: 'Distribuye dos lados para comparar diferencias declaradas.',
  },
})

const COMPONENTS = Object.freeze([
  { id: 'participant-node-v1', version: 2, purpose: 'Dibujo procedural con etiqueta y pose local.', params: ['symbol', 'label', 'meaning', 'accent'], compatibleRecipes: ['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'drawParticipants' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 participant renderer' }, supportedSymbols: ['voice', 'idea', 'data', 'research', 'group', 'object', 'result', 'growth'] },
  { id: 'relation-path-v1', version: 1, purpose: 'Trazo de relación entre anclajes de participantes.', params: ['from', 'to', 'relation', 'width', 'color'], compatibleRecipes: ['explanatory-transfer-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'drawRelations:transfer' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 relation renderer' } },
  { id: 'traveler-v1', version: 1, purpose: 'Marca un recorrido direccional sobre una relación.', params: ['relationId', 'radius', 'start', 'end'], compatibleRecipes: ['explanatory-transfer-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'drawRelations:traveler' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 traveler renderer' } },
  { id: 'arrival-response-v1', version: 1, purpose: 'Resalta el participante al completar una llegada.', params: ['participantId', 'at', 'duration', 'strength'], compatibleRecipes: ['explanatory-transfer-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'arrivalPulse' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 arrival renderer' } },
  { id: 'headline-v1', version: 1, purpose: 'Titular fijo con medida y jerarquía para vertical.', params: ['text', 'font', 'scale', 'maxLines'], compatibleRecipes: ['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'drawTitle' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 typography renderer' } },
  { id: 'outcome-label-v1', version: 1, purpose: 'Resultado estable y legible en la fase de lectura.', params: ['text', 'font', 'scale', 'maxLines'], compatibleRecipes: ['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'drawOutcome' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 outcome renderer' } },
  { id: 'participant-entry-v1', version: 1, purpose: 'Entrada finita hacia la pose calculada del participante.', params: ['instanceId', 'entryEnd', 'pose'], compatibleRecipes: ['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'nodePose' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 participant pose' } },
  { id: 'finite-exit-v1', version: 1, purpose: 'Salida finita coordinada desde el reloj explícito.', params: ['exitStart', 'durationSec'], compatibleRecipes: ['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'renderAt:exit' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 scene clock' } },
  { id: 'group-ring-v1', version: 1, purpose: 'Anillo que hace visible la formación colectiva.', params: ['participantIds', 'center', 'radius', 'progress'], compatibleRecipes: ['group-formation-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'drawRelations:group-formation' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 formation renderer' } },
  { id: 'comparison-columns-v1', version: 1, purpose: 'Dos campos visuales para una comparación declarada.', params: ['leftIds', 'rightIds', 'focus', 'progress'], compatibleRecipes: ['comparison-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'drawRelations:comparison' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 comparison renderer' } },
  { id: 'camera-transform-v1', version: 1, purpose: 'Transformación finita de cámara sobre una composición procedural declarada.', params: ['keyframes', 'focusX', 'focusY', 'zoom', 'rotation'], compatibleRecipes: [], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'withCamera' }, provenance: { kind: 'cipher-new-adapter', source: 'Canvas v4 explicit camera direction; adapted for vector scene geometry' }, limits: { zoom: [0.8, 2.2], rotationRadians: [-0.25, 0.25], normalizedFocus: [0, 1] } },
  { id: 'palette-role-system-v1', version: 1, purpose: 'Paletas semánticas para fondo, tinta, superficie, acento y secundario, sin cambiar la geometría.', params: ['paletteId', 'roles'], compatibleRecipes: ['explanatory-transfer-v1', 'group-formation-v1', 'comparison-v1'], implementation: { moduleId: 'animation-canvas-runtime-v4', path: 'public/animation-canvas/runtime.js', symbol: 'plan.style.palette' }, provenance: { kind: 'cipher-adapted', source: 'Canvas v4 semantic role palettes' } },
  { id: 'editorial-paper-field-v1', version: 2, purpose: 'Fondo procedural cacheado, con degradado radial, retícula tenue y textura determinista.', params: ['palette', 'gridOpacity', 'textureStrength', 'seed', 'width', 'height'], compatibleRecipes: ['code-authored-scene'], implementation: { moduleId: 'animation-canvas-runtime-v4-editorial-v2', path: 'public/animation-canvas/runtime.js', symbol: 'lib.editorialBackground(ctx, options)' }, provenance: { kind: 'adapted-from-user-approved-procedural-package', source: 'film.js: edBG, edGuide' } },
  { id: 'editorial-raised-surface-v1', version: 2, purpose: 'Tarjeta, medallón o moneda procedural con degradado, bisel, sombra y glifo vectorial.', params: ['shape', 'glyph', 'palette', 'surfaceDepth', 'shadowStrength', 'size'], compatibleRecipes: ['code-authored-scene'], implementation: { moduleId: 'animation-canvas-runtime-v4-editorial-v2', path: 'public/animation-canvas/runtime.js', symbol: 'lib.editorialObject(ctx, options)' }, provenance: { kind: 'adapted-from-user-approved-procedural-package', source: 'film.js: edIcon, edAsset, edObject' } },
  { id: 'editorial-measured-type-v1', version: 2, purpose: 'Texto procedural con medida, ajuste de tamaño y tipografía del perfil.', params: ['text', 'fontFamily', 'size', 'maxWidth', 'maxLines', 'style'], compatibleRecipes: ['code-authored-scene'], implementation: { moduleId: 'animation-canvas-runtime-v4-editorial-v2', path: 'public/animation-canvas/runtime.js', symbol: 'lib.editorialText(ctx, options)' }, provenance: { kind: 'adapted-from-user-approved-procedural-package', source: 'film.js: edText, edHeading, edCaption' } },
  { id: 'editorial-progressive-route-v1', version: 2, purpose: 'Trazado Catmull-Rom progresivo por longitud recorrida, compatible con waypoints y viajero determinista.', params: ['points', 'progress', 'width', 'color', 'traveler'], compatibleRecipes: ['code-authored-scene'], implementation: { moduleId: 'animation-canvas-runtime-v4-editorial-v2', path: 'public/animation-canvas/runtime.js', symbol: 'lib.editorialRoute(ctx, options)' }, provenance: { kind: 'adapted-from-user-approved-procedural-package', source: 'film.js: edBezierPoint, edLink' } },
])

function componentsForRecipe(recipeId) {
  return COMPONENTS.filter(component => component.compatibleRecipes.includes(recipeId)).map(component => ({
    id: component.id, version: component.version, implementation: component.implementation, provenance: component.provenance,
  }))
}

const PALETTES = Object.freeze({
  paper: { background: '#f4f1e9', ink: '#272923', muted: '#78766d', accent: '#d26443', secondary: '#3e7680', surface: '#fffdf7' },
  night: { background: '#14242c', ink: '#f6f1e5', muted: '#aec2c2', accent: '#ed9b57', secondary: '#62adb0', surface: '#20363f' },
  garden: { background: '#f0efe6', ink: '#27382e', muted: '#738174', accent: '#c26749', secondary: '#548d70', surface: '#fbfaf2' },
  sapphire: { background: '#f0f3f6', ink: '#111827', muted: '#334155', accent: '#0284c7', secondary: '#0369a1', surface: '#f8fafc', shadow: '#0f172a', highlight: '#e0f2fe' },
})
const FONTS = Object.freeze({ instrumentSerif: 'Instrument Serif', dmSans: 'DM Sans' })

function fail(code, detail) { throw new Error(detail ? `${code}:${detail}` : code) }
function text(value, field, max = 120) {
  if (typeof value !== 'string' || !value.trim()) fail('ANIMATION_TEXT_REQUIRED', field)
  const result = value.trim().replace(/\s+/g, ' ')
  if (result.length > max) fail('ANIMATION_TEXT_TOO_LONG', field)
  return result
}
function num(value, field, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) fail('ANIMATION_NUMBER_OUT_OF_RANGE', field)
  return value
}

function resolveTimelineDuration(requestedDurationSec, selectedClipDurationSec) {
  const requested = num(requestedDurationSec, 'requestedDurationSec', 3, 10)
  const selected = num(selectedClipDurationSec, 'selectedClipDurationSec', 3, 10)
  return { requestedDurationSec: requested, selectedClipDurationSec: selected, resolvedDurationSec: selected,
    resolution: requested === selected ? 'exact' : 'timeline-authoritative-duration' }
}

function validateAnimationConfigV1(config) {
  if (!config || config.schema !== CONFIG_SCHEMA) fail('ANIMATION_CONFIG_SCHEMA_UNSUPPORTED')
  if (!RECIPES[config.recipeId]) fail('ANIMATION_RECIPE_NOT_REGISTERED', String(config.recipeId))
  const recipe = RECIPES[config.recipeId]
  const durationSec = num(config.timing?.durationSec, 'timing.durationSec', 3, 10)
  const fps = num(config.timing?.fps, 'timing.fps', 12, 60)
  const participants = config.content?.participants
  if (!Array.isArray(participants) || participants.length < recipe.minParticipants || participants.length > recipe.maxParticipants)
    fail('ANIMATION_PARTICIPANT_COUNT_UNSUPPORTED', `${recipe.minParticipants}-${recipe.maxParticipants}`)
  const ids = new Set()
  const cleanParticipants = participants.map((p, i) => {
    if (!p || typeof p !== 'object') fail('ANIMATION_PARTICIPANT_INVALID', String(i))
    const id = text(p.instanceId, `participants.${i}.instanceId`, 64)
    if (ids.has(id)) fail('ANIMATION_PARTICIPANT_ID_DUPLICATE', id)
    ids.add(id)
    if (!['voice', 'idea', 'data', 'research', 'group', 'object', 'result', 'growth'].includes(p.symbol))
      fail('ANIMATION_SYMBOL_UNSUPPORTED', `participants.${i}.symbol`)
    const symbol = p.symbol
    const side = p.side === 'left' || p.side === 'right' ? p.side : undefined
    return { instanceId: id, symbol, label: text(p.label, `participants.${i}.label`, 40),
      meaning: text(p.meaning, `participants.${i}.meaning`, 140), side }
  })
  const relations = config.content?.relations
  if (!Array.isArray(relations)) fail('ANIMATION_RELATIONS_REQUIRED')
  if (recipe.requiresRelation && !relations.length) fail('ANIMATION_RELATION_REQUIRED', recipe.id)
  const cleanRelations = relations.map((r, i) => {
    if (!r || !ids.has(r.from) || !ids.has(r.to) || r.from === r.to)
      fail('ANIMATION_RELATION_ENDPOINT_INVALID', String(i))
    if (!recipe.compatibleRelations.includes(r.kind)) fail('ANIMATION_RELATION_INCOMPATIBLE', String(r.kind))
    return { id: text(r.id || `relation-${i + 1}`, `relations.${i}.id`, 64), from: r.from, to: r.to,
      kind: r.kind, meaning: text(r.meaning, `relations.${i}.meaning`, 140) }
  })
  if (new Set(cleanRelations.map(x => x.id)).size !== cleanRelations.length) fail('ANIMATION_RELATION_ID_DUPLICATE')
  const arrivalOrder = Array.isArray(config.direction?.arrivalOrder) ? config.direction.arrivalOrder.map((id, i) =>
    text(id, `direction.arrivalOrder.${i}`, 64)) : []
  if (arrivalOrder.length && (arrivalOrder.length !== cleanRelations.length || new Set(arrivalOrder).size !== arrivalOrder.length ||
      arrivalOrder.some(id => !cleanRelations.some(relation => relation.id === id))) )
    fail('ANIMATION_ARRIVAL_ORDER_INVALID')
  if (arrivalOrder.length && recipe.id !== 'explanatory-transfer-v1') fail('ANIMATION_ARRIVAL_ORDER_RECIPE_INCOMPATIBLE')
  if (recipe.id === 'explanatory-transfer-v1') {
    const incoming = new Set(cleanRelations.map(r => r.to))
    const outgoing = new Set(cleanRelations.map(r => r.from))
    const destinations = [...incoming].filter(id => !outgoing.has(id))
    if (destinations.length !== 1) fail('ANIMATION_TRANSFER_NEEDS_ONE_DESTINATION', String(destinations.length))
  }
  if (recipe.id === 'comparison-v1') {
    if (cleanParticipants.some(p => !p.side) || !cleanParticipants.some(p => p.side === 'left') || !cleanParticipants.some(p => p.side === 'right'))
      fail('ANIMATION_COMPARISON_REQUIRES_TWO_SIDES')
  }
  if (!PALETTES[config.style?.paletteId]) fail('ANIMATION_PALETTE_NOT_REGISTERED', String(config.style?.paletteId))
  const paletteId = config.style.paletteId
  const labelScale = num(config.style?.labelScale ?? 1, 'style.labelScale', 0.8, 1.5)
  const titleFont = config.style?.titleFont ?? 'instrumentSerif'
  const bodyFont = config.style?.bodyFont ?? 'dmSans'
  if (!FONTS[titleFont] || !FONTS[bodyFont]) fail('ANIMATION_FONT_NOT_MATERIALIZED')
  const titleScale = num(config.style?.titleScale ?? 1, 'style.titleScale', 0.8, 1.35)
  const actionLabel = text(config.direction?.actionLabel || config.content?.outcome, 'direction.actionLabel', 80)
  if (!['group', 'destination', 'difference', 'sequence'].includes(config.direction?.focus))
    fail('ANIMATION_FOCUS_UNSUPPORTED', String(config.direction?.focus))
  const headline = text(config.content?.headline, 'content.headline', 72)
  const proposition = text(config.content?.proposition, 'content.proposition', 240)
  const verbatimQuote = text(config.content?.verbatimQuote, 'content.verbatimQuote', 500)
  const context = String(config.content?.context ?? '').trim().slice(0, 800)
  return { schema: CONFIG_SCHEMA, configId: text(config.configId, 'configId', 80), revision: 1,
    recipeId: recipe.id, timing: { durationSec, fps },
    content: { verbatimQuote, context, proposition, headline, outcome: actionLabel, participants: cleanParticipants, relations: cleanRelations },
    style: { paletteId, labelScale, titleFont, bodyFont, titleScale },
    direction: { actionLabel, focus: config.direction.focus, arrivalOrder } }
}

function layoutParticipants(recipeId, participants) {
  const count = participants.length
  const midY = recipeId === 'comparison-v1' ? 1010 : 960
  const results = {}
  if (recipeId === 'explanatory-transfer-v1') {
    const incoming = new Set()
    const outgoing = new Set()
    for (const r of participants.relations) { incoming.add(r.to); outgoing.add(r.from) }
    const targets = participants.list.filter(p => incoming.has(p.instanceId) && !outgoing.has(p.instanceId))
    const destination = targets[targets.length - 1]
    const sources = participants.list.filter(p => p.instanceId !== destination?.instanceId)
    const sourceRadius = sources.length >= 3 ? 108 : 132
    const firstY = sources.length >= 3 ? 540 : sources.length === 2 ? 650 : midY
    const lastY = sources.length >= 3 ? 1220 : sources.length === 2 ? 1210 : midY
    const srcY = sources.length === 1 ? [midY] : sources.map((_, i) => firstY + i * (lastY - firstY) / (sources.length - 1))
    sources.forEach((p, i) => { results[p.instanceId] = { x: 230, y: srcY[i], radius: sourceRadius, labelSide: 'bottom' } })
    if (destination) results[destination.instanceId] = { x: 805, y: midY, radius: 166, labelSide: 'bottom', destination: true }
    participants.list.filter(p => !results[p.instanceId]).forEach((p, i) => { results[p.instanceId] = { x: 520, y: 620 + i * 200, radius: 112, labelSide: 'bottom' } })
  } else if (recipeId === 'comparison-v1') {
    const sides = { left: participants.list.filter(p => p.side === 'left'), right: participants.list.filter(p => p.side === 'right') }
    for (const side of ['left', 'right']) sides[side].forEach((p, i) => {
      const y = sides[side].length === 1 ? midY : 700 + i * Math.min(270, 620 / (sides[side].length - 1))
      results[p.instanceId] = { x: side === 'left' ? 285 : 795, y, radius: 126, labelSide: 'bottom', side }
    })
  } else {
    const radius = count > 4 ? 255 : 295
    participants.list.forEach((p, i) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i / count)
      results[p.instanceId] = { x: 540 + Math.cos(angle) * radius, y: midY + Math.sin(angle) * radius, radius: count > 4 ? 112 : 132, labelSide: 'bottom' }
    })
  }
  return results
}

function compileAnimationPlanV1(input) {
  const config = validateAnimationConfigV1(input)
  const duration = config.timing.durationSec
  const palette = PALETTES[config.style.paletteId]
  const pose = layoutParticipants(config.recipeId, { list: config.content.participants, relations: config.content.relations })
  const entryEnd = Math.min(0.5, duration * 0.17)
  const organizeEnd = Math.min(0.92, duration * 0.31)
  const exitStart = duration - 0.16
  const arrivalDuration = Math.min(0.28, duration * 0.09)
  const maxActionEnd = exitStart - 0.8 - arrivalDuration
  const actionStart = organizeEnd
  const actionEnd = Math.min(actionStart + 1.05, maxActionEnd)
  if (actionEnd <= actionStart + 0.25) fail('ANIMATION_DURATION_CANNOT_FIT_EXPLANATION', String(duration))
  const readStart = config.recipeId === 'explanatory-transfer-v1' ? actionEnd + arrivalDuration : actionEnd
  if (exitStart - readStart + 1e-9 < 0.8) fail('ANIMATION_STABLE_READING_TOO_SHORT', String(exitStart - readStart))
  const arrivalRelations = config.direction.arrivalOrder.length
    ? config.direction.arrivalOrder.map(id => config.content.relations.find(relation => relation.id === id))
    : config.content.relations
  const events = [
    { id: 'participants-enter', kind: 'entry', at: 0, endsAt: entryEnd },
    { id: 'group-organizes', kind: 'organization', at: entryEnd, endsAt: organizeEnd },
    { id: 'action-begins', kind: 'action', at: actionStart, endsAt: actionEnd },
    ...(config.recipeId === 'explanatory-transfer-v1' ? arrivalRelations.map((r, i) => ({
      id: `${r.id}-arrival`, kind: 'arrival', relationId: r.id,
      at: actionStart + (actionEnd - actionStart) * ((i + 0.76) / config.content.relations.length),
      endsAt: actionStart + (actionEnd - actionStart) * ((i + 0.76) / config.content.relations.length) + arrivalDuration,
    })) : []),
    { id: 'stable-reading', kind: 'stable-reading', at: readStart, endsAt: exitStart },
    { id: 'finite-exit', kind: 'exit', at: exitStart, endsAt: duration },
  ]
  const lines = config.recipeId === 'explanatory-transfer-v1'
    ? config.content.relations.map((r, i) => ({ ...r, fromAnchor: r.from, toAnchor: r.to,
      travelerRadius: 22, strokeWidth: 11, speed: 'ease-in-out', order: i })) : []
  const layout = layoutParticipants(config.recipeId, { list: config.content.participants, relations: config.content.relations })
  return {
    schema: SCHEMA, revision: 2, recipe: { id: config.recipeId, version: RECIPES[config.recipeId].version },
    renderer: { id: 'animation-canvas-procedural-renderer', version: 3 },
    viewport: { width: 1080, height: 1920, fps: config.timing.fps, orientation: 'portrait' },
    clock: { kind: 'explicit-output-seconds', localOriginSec: 0, durationSec: duration, renderEntryPoint: 'renderAt(outputSeconds)' },
    content: config.content,
    style: { ...config.style, palette, titleFontFamily: FONTS[config.style.titleFont], bodyFontFamily: FONTS[config.style.bodyFont] },
    composition: { participants: config.content.participants.map(p => ({ ...p, ...layout[p.instanceId] })), relations: lines,
      title: { text: config.content.headline, x: 540, y: 282, maxWidth: 880, fontRole: 'title', fixedToScene: true },
      outcome: { text: config.direction.actionLabel, x: 540, y: 1690, maxWidth: 820, fontRole: 'body' },
      focus: config.direction.focus, arrivalOrder: config.direction.arrivalOrder, zOrder: ['background', 'relations', 'participants', 'travelers', 'labels', 'headline', 'outcome', 'arrival-response'] },
    time: { entryEnd, organizeEnd, actionStart, actionEnd, readStart, exitStart, events },
    components: componentsForRecipe(config.recipeId),
    provenance: { kind: 'chat-directed-config', humanReviewRequired: true, codeExecution: 'trusted-renderer-only' },
  }
}

function animationStateAt(plan, outputSeconds) {
  if (!plan || plan.schema !== SCHEMA || !Number.isFinite(outputSeconds)) fail('ANIMATION_PLAN_TIME_INVALID')
  const duration = plan.clock.durationSec
  const t = Math.max(0, Math.min(duration, outputSeconds))
  const isReading = t >= plan.time.readStart && t < plan.time.exitStart
  const arrivals = plan.time.events.filter(e => e.kind === 'arrival' && t >= e.at && t < e.endsAt)
  return { outputSeconds: t, phase: t < plan.time.entryEnd ? 'entry' : t < plan.time.organizeEnd ? 'organization' :
    t < plan.time.actionEnd ? 'action' : t < plan.time.readStart ? 'arrival' : t < plan.time.exitStart ? 'reading' : 'exit',
    isReading, arrivingRelations: arrivals.map(e => e.relationId) }
}

module.exports = { ANIMATION_CONFIG_SCHEMA_V1: CONFIG_SCHEMA, ANIMATION_SCENE_PLAN_SCHEMA_V1: SCHEMA,
  ANIMATION_RECIPES_V1: RECIPES, ANIMATION_COMPONENTS_V1: COMPONENTS, ANIMATION_PALETTES_V1: PALETTES, ANIMATION_FONTS_V1: FONTS,
  validateAnimationConfigV1, compileAnimationPlanV1, animationStateAt, resolveTimelineDuration }
