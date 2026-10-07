'use strict'

const crypto = require('node:crypto')
const vm = require('node:vm')
const { parse } = require('@babel/parser')

const SCENE_SCHEMA = 'cipher-animation-agent-scene-module-v1'
const MAX_SOURCE_BYTES = 32_000
// `top` remains allowed as ordinary geometry. Parse the module before checking
// capabilities so comments, strings, and regular-expression bodies are not
// mistaken for executable references. This stays conservative about computed
// access to capability names and prototype escape properties.
const FORBIDDEN_IDENTIFIERS = new Set([
  'window', 'document', 'globalThis', 'self', 'parent', 'frames', 'opener', 'navigator',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'import',
  'require', 'process', 'eval', 'Function', 'constructor', 'prototype', '__proto__',
  'Reflect', 'Proxy', 'localStorage', 'sessionStorage', 'indexedDB', 'setTimeout', 'setInterval',
  'requestAnimationFrame', 'alert', 'prompt', 'open', 'location', 'history', 'postMessage',
  'Image', 'Audio', 'OffscreenCanvas', 'createImageBitmap', 'Date', 'performance', 'crypto',
])
const FORBIDDEN_MEMBER_PROPERTIES = new Set([
  ...FORBIDDEN_IDENTIFIERS, 'canvas', 'ownerDocument', 'defaultView', 'createElement', 'parentNode',
])

function isNonReferenceIdentifier(node, parent) {
  if (!parent) return false
  if ((parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression') &&
      parent.property === node && !parent.computed) return true
  if (['ObjectProperty', 'ObjectMethod', 'ClassMethod', 'ClassProperty', 'ClassPrivateMethod', 'ClassPrivateProperty'].includes(parent.type) &&
      parent.key === node && !parent.computed) return true
  if ((parent.type === 'LabeledStatement' && parent.label === node) ||
      ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && parent.label === node)) return true
  return false
}

function findForbiddenCapability(ast) {
  let found = null
  const seen = new WeakSet()
  function visit(node, parent = null) {
    if (!node || typeof node !== 'object' || found || seen.has(node)) return
    seen.add(node)
    if (node.type === 'ImportDeclaration' || node.type === 'ImportExpression' || node.type === 'Import') {
      found = 'import'; return
    }
    if (node.type === 'Identifier' && FORBIDDEN_IDENTIFIERS.has(node.name) && !isNonReferenceIdentifier(node, parent)) {
      found = node.name; return
    }
    if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
      const propertyName = node.computed
        ? (node.property?.type === 'StringLiteral' || node.property?.type === 'Literal' ? node.property.value : null)
        : node.property?.name
      if (typeof propertyName === 'string' && FORBIDDEN_MEMBER_PROPERTIES.has(propertyName)) {
        found = propertyName; return
      }
      if (node.object?.type === 'Identifier' && node.object.name === 'Math' && propertyName === 'random') {
        found = 'Math.random'; return
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra' || key === 'leadingComments' ||
          key === 'innerComments' || key === 'trailingComments' || key === 'comments' || key === 'tokens') continue
      if (Array.isArray(value)) value.forEach(child => visit(child, node))
      else if (value && typeof value === 'object') visit(value, node)
    }
  }
  visit(ast)
  return found
}

function fail(code, detail = '') {
  throw new Error(detail ? code + ':' + detail : code)
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key =>
    JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}'
  return JSON.stringify(value)
}

function validateParameterSchema(schema, values) {
  if (!schema || schema.type !== 'object' || !schema.properties || typeof schema.properties !== 'object' ||
      Array.isArray(schema.properties) || Object.keys(schema.properties).length > 24 ||
      schema.additionalProperties !== false || !Array.isArray(schema.required))
    fail('ANIMATION_SCENE_PARAMETER_SCHEMA_INVALID',
      'expected parameterSchema={"type":"object","properties":{"name":{"type":"string|number|integer|boolean"}},"additionalProperties":false,"required":["name"]}')
  const keys = Object.keys(schema.properties)
  if (keys.some(key => !/^[a-z][a-zA-Z0-9_]{0,39}$/.test(key)) ||
      new Set(schema.required).size !== schema.required.length || schema.required.some(key => !keys.includes(key)))
    fail('ANIMATION_SCENE_PARAMETER_FIELDS_INVALID')
  if (!values || typeof values !== 'object' || Array.isArray(values) ||
      Object.keys(values).some(key => !keys.includes(key)))
    fail('ANIMATION_SCENE_PARAMETER_VALUES_INVALID')
  const normalized = {}
  for (const key of keys) {
    const rule = schema.properties[key]
    if (!rule || typeof rule !== 'object' || !['string', 'number', 'integer', 'boolean'].includes(rule.type))
      fail('ANIMATION_SCENE_PARAMETER_RULE_INVALID', key)
    const value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : rule.default
    if (value === undefined) {
      if (schema.required.includes(key)) fail('ANIMATION_SCENE_PARAMETER_REQUIRED', key)
      continue
    }
    if (rule.type === 'string') {
      if (typeof value !== 'string' || value.length > Math.min(240, Number(rule.maxLength) || 240))
        fail('ANIMATION_SCENE_PARAMETER_TYPE_INVALID', key)
      if (Array.isArray(rule.enum) && !rule.enum.includes(value)) fail('ANIMATION_SCENE_PARAMETER_ENUM_INVALID', key)
    } else if (rule.type === 'number' || rule.type === 'integer') {
      if (typeof value !== 'number' || !Number.isFinite(value) || rule.type === 'integer' && !Number.isInteger(value))
        fail('ANIMATION_SCENE_PARAMETER_TYPE_INVALID', key)
      if (Number.isFinite(rule.minimum) && value < rule.minimum || Number.isFinite(rule.maximum) && value > rule.maximum)
        fail('ANIMATION_SCENE_PARAMETER_RANGE_INVALID', key)
    } else if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') fail('ANIMATION_SCENE_PARAMETER_TYPE_INVALID', key)
    } else fail('ANIMATION_SCENE_PARAMETER_TYPE_UNSUPPORTED', key)
    normalized[key] = value
  }
  return normalized
}

function validateSceneModule(input) {
  if (!input || typeof input !== 'object') fail('ANIMATION_SCENE_MODULE_INVALID')
  const scene = input.scene
  const source = input.source
  if (!scene || !/^[a-z][a-z0-9-]{2,63}$/.test(scene.id || '') || scene.version !== 1)
    fail('ANIMATION_SCENE_ID_INVALID')
  for (const key of ['title', 'summary', 'compositionDescription']) {
    if (typeof scene[key] !== 'string' || !scene[key].trim() || scene[key].length > 240)
      fail('ANIMATION_SCENE_METADATA_INVALID', key)
  }
  for (const key of ['objects', 'behaviors']) {
    if (!Array.isArray(scene[key]) || scene[key].length < 1 || scene[key].length > 12) fail('ANIMATION_SCENE_' + key.toUpperCase() + '_INVALID')
    const ids = new Set()
    for (const entry of scene[key]) {
      if (!entry || !/^[a-z][a-z0-9-]{1,39}$/.test(entry.id || '') || ids.has(entry.id) ||
          typeof entry.description !== 'string' || !entry.description.trim() || entry.description.length > 240)
        fail('ANIMATION_SCENE_' + key.toUpperCase() + '_ENTRY_INVALID')
      ids.add(entry.id)
    }
  }
  if (typeof source !== 'string' || Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES ||
      !source.includes('CipherAnimation.registerScene'))
    fail('ANIMATION_SCENE_SOURCE_INVALID')
  let ast
  try { ast = parse(source, { sourceType: 'script', errorRecovery: false }) }
  catch (error) { fail('ANIMATION_SCENE_SOURCE_SYNTAX_INVALID', String(error.message).slice(0, 180)) }
  const forbidden = findForbiddenCapability(ast)
  if (forbidden) fail('ANIMATION_SCENE_SOURCE_CAPABILITY_FORBIDDEN', `identifier=${forbidden}`)
  try { new vm.Script(source, { filename: scene.id + '.scene.js' }) }
  catch (error) { fail('ANIMATION_SCENE_SOURCE_SYNTAX_INVALID', String(error.message).slice(0, 180)) }
  const parameters = validateParameterSchema(input.parameterSchema, input.parameterValues)
  if (!Number.isFinite(input.durationSec) || input.durationSec < 3 || input.durationSec > 10)
    fail('ANIMATION_SCENE_DURATION_INVALID')
  if (!Number.isFinite(input.fps) || input.fps < 12 || input.fps > 60)
    fail('ANIMATION_SCENE_FPS_INVALID')
  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex')
  return { schema: SCENE_SCHEMA, scene: {
    id: scene.id, version: 1, title: scene.title.trim(), summary: scene.summary.trim(),
    compositionDescription: scene.compositionDescription.trim(),
    objects: scene.objects.map(x => ({ id: x.id, description: x.description.trim() })),
    behaviors: scene.behaviors.map(x => ({ id: x.id, description: x.description.trim() })),
  }, source, sourceSha256, parameterSchema: input.parameterSchema, parameterValues: parameters, parameters,
  durationSec: input.durationSec, fps: input.fps }
}

function scenePlan(moduleRecord, paletteId = 'paper', styleOverrides = {}) {
  const module = validateSceneModule(moduleRecord)
  if (!['paper', 'night', 'garden', 'sapphire'].includes(paletteId)) fail('ANIMATION_PALETTE_NOT_REGISTERED', String(paletteId))
  const { ANIMATION_PALETTES_V1, ANIMATION_FONTS_V1 } = require('./contract-v1.cjs')
  const palette = ANIMATION_PALETTES_V1[paletteId]
  const baseStyle = { paletteId, palette, titleFontFamily: 'Instrument Serif', bodyFontFamily: 'DM Sans', titleScale: 1,
    labelScale: 1, gridOpacity: .075, textureStrength: .045, surfaceDepth: 1, shadowStrength: .85, cameraDrift: .025,
    profileId: 'cipher-editorial-sapphire-v1', profileVersion: 1 }
  const style = { ...baseStyle, titleFontFamily: styleOverrides?.titleFontFamily ?? baseStyle.titleFontFamily,
    bodyFontFamily: styleOverrides?.bodyFontFamily ?? baseStyle.bodyFontFamily,
    titleScale: styleOverrides?.titleScale ?? baseStyle.titleScale,
    labelScale: styleOverrides?.labelScale ?? baseStyle.labelScale,
    gridOpacity: styleOverrides?.gridOpacity ?? baseStyle.gridOpacity,
    textureStrength: styleOverrides?.textureStrength ?? baseStyle.textureStrength,
    surfaceDepth: styleOverrides?.surfaceDepth ?? baseStyle.surfaceDepth,
    shadowStrength: styleOverrides?.shadowStrength ?? baseStyle.shadowStrength,
    cameraDrift: styleOverrides?.cameraDrift ?? baseStyle.cameraDrift,
    profileId: styleOverrides?.profileId ?? baseStyle.profileId,
    profileVersion: styleOverrides?.profileVersion ?? baseStyle.profileVersion, paletteId, palette }
  if (!Object.values(ANIMATION_FONTS_V1).includes(style.titleFontFamily) || !Object.values(ANIMATION_FONTS_V1).includes(style.bodyFontFamily))
    fail('ANIMATION_FONT_NOT_REGISTERED')
  for (const key of ['titleScale', 'labelScale']) {
    if (!Number.isFinite(style[key]) || style[key] < .6 || style[key] > 1.6) fail('ANIMATION_STYLE_SCALE_OUT_OF_RANGE', key)
  }
  for (const [key, minimum, maximum] of [['gridOpacity', 0, .3], ['textureStrength', 0, .2], ['surfaceDepth', .5, 1.5],
    ['shadowStrength', 0, 1], ['cameraDrift', 0, .08]]) {
    if (!Number.isFinite(style[key]) || style[key] < minimum || style[key] > maximum) fail('ANIMATION_STYLE_PARAMETER_OUT_OF_RANGE', key)
  }
  return {
    schema: 'cipher-animation-code-scene-plan-v1', revision: 1, route: 'agent-authored-code',
    renderer: { id: 'animation-canvas-procedural-renderer', version: 4 },
    scene: module.scene, sourceSha256: module.sourceSha256,
    moduleRef: { assetId: `animation-scene-module-${module.scene.id}-v${module.scene.version}`, role: 'scene-module', sha256: module.sourceSha256 },
    parameterSchema: module.parameterSchema, parameters: module.parameters,
    style, viewport: { width: 1080, height: 1920, fps: module.fps, orientation: 'portrait' },
    clock: { kind: 'explicit-output-seconds', localOriginSec: 0, durationSec: module.durationSec, renderEntryPoint: 'renderAt(outputSeconds)' },
    time: { entryEnd: module.durationSec * .12, actionStart: module.durationSec * .16,
      actionEnd: module.durationSec * .62, readStart: module.durationSec * .72, exitStart: module.durationSec * .94 },
    provenance: { author: 'connected-cipher-animation-agent', execution: 'isolated-animation-renderer',
      drawingLibrary: 'Animation Canvas', parameterized: true, humanReviewRequired: true,
      externalRevision: '90e966201add3ff41dc4ebd1348165c0cb2d5eab', externalLicense: 'MIT' },
  }
}

module.exports = { SCENE_SCHEMA, MAX_SOURCE_BYTES, stableJson, validateParameterSchema, findForbiddenCapability, validateSceneModule, scenePlan }
