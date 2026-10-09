'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { scenePlan, validateParameterSchema, validateSceneModule } = require('../../../src/main/animation/scene-module-contract.cjs')

const source = `CipherAnimation.registerScene({
  id: 'flow-ribbons', version: 1,
  render({ ctx, t, durationSec, width, height, palette, params, lib }) {
    const progress = Math.max(0, Math.min(1, t / Math.max(0.1, durationSec * 0.62)))
    const x = width * (0.18 + 0.58 * progress)
    ctx.fillStyle = palette.ink
    ctx.textAlign = 'center'
    ctx.font = '600 62px "DM Sans"'
    ctx.fillText(params.headline, width * 0.5, height * 0.22, width * 0.84)
    const stroke = lib.makeStroke([[width * 0.18, height * 0.62], [x, height * 0.62]], { id: 'incoming-signal', width: 18, rough: 0 })
    lib.drawStroke(ctx, stroke, { color: palette.accent, progress })
    ctx.fillStyle = palette.accent
    ctx.beginPath()
    ctx.arc(x, height * 0.62, 27, 0, Math.PI * 2)
    ctx.fill()
    return { phase: t >= durationSec * 0.72 ? 'reading' : 'action', state: params.headline }
  }
})`
const input = {
  scene: { id: 'flow-ribbons', version: 1, title: 'Las ideas encuentran un cauce',
    summary: 'Organiza señales dispersas en un recorrido común.', compositionDescription: 'El trazo converge hacia una salida central.',
    objects: [{ id: 'signals', description: 'Trazos que representan señales' }, { id: 'stream', description: 'Un cauce que las organiza' }],
    behaviors: [{ id: 'converge', description: 'Los trazos se reúnen progresivamente' }] },
  source,
  parameterSchema: { type: 'object', additionalProperties: false, required: ['headline'], properties: {
    headline: { type: 'string', default: 'Las ideas encuentran un cauce', maxLength: 120 },
  } },
  parameterValues: { headline: 'Las ideas encuentran un cauce' }, durationSec: 4, fps: 30,
}
const rejects = (fn, code) => assert.throws(fn, error => error.message.startsWith(code), code)

const validated = validateSceneModule(input)
const plan = scenePlan(validated, 'paper')
assert.equal(plan.schema, 'cipher-animation-code-scene-plan-v1')
assert.equal(plan.clock.renderEntryPoint, 'renderAt(outputSeconds)')
assert.equal(plan.moduleRef.sha256, crypto.createHash('sha256').update(source).digest('hex'))
assert.equal(plan.parameters.headline, 'Las ideas encuentran un cauce')
assert.deepEqual(scenePlan(validated, 'paper'), plan, 'Code scene compilation stays deterministic')
const gardenStylePlan = scenePlan(validated, 'garden', { titleFontFamily: 'DM Sans', bodyFontFamily: 'DM Sans', titleScale: 1.1, labelScale: 1.25 })
assert.equal(gardenStylePlan.style.titleFontFamily, 'DM Sans', 'A saved template can retain its typography at compile time')
assert.equal(gardenStylePlan.style.labelScale, 1.25, 'Style remains a plan parameter, independent of code')
assert.equal(gardenStylePlan.style.paletteId, 'garden')
const customStylePlan = scenePlan(validated, 'paper', { palette: { paper: '#EAE7E1', cyan: '#38BDF8' }, movementIntensity: 'dynamic' })
assert.equal(customStylePlan.style.palette.paper, '#EAE7E1')
assert.equal(customStylePlan.style.palette.cyan, '#38BDF8')
assert.equal(customStylePlan.style.movementIntensity, 'dynamic')
rejects(() => scenePlan(validated, 'paper', { palette: { paper: 'url(https://example.com)' } }), 'ANIMATION_STYLE_PALETTE_INVALID')
rejects(() => scenePlan(validated, 'garden', { titleFontFamily: 'Unregistered', bodyFontFamily: 'DM Sans', titleScale: 1, labelScale: 1 }),
  'ANIMATION_FONT_NOT_REGISTERED')
rejects(() => scenePlan(validated, 'garden', { titleFontFamily: 'DM Sans', bodyFontFamily: 'DM Sans', titleScale: 1, labelScale: 1.7 }),
  'ANIMATION_STYLE_SCALE_OUT_OF_RANGE')
assert.equal(validateParameterSchema(input.parameterSchema, { headline: 'La ciencia organiza preguntas' }).headline,
  'La ciencia organiza preguntas', 'Reusable module accepts another content value without source edits')

rejects(() => validateSceneModule({ ...input, source: source + '\nwindow.location = "https://example.com"' }), 'ANIMATION_SCENE_SOURCE_CAPABILITY_FORBIDDEN')
rejects(() => validateSceneModule({ ...input, source: source + '\nMath.random()' }), 'ANIMATION_SCENE_SOURCE_CAPABILITY_FORBIDDEN')
const localTopSource = source.replace('const progress =', 'const top = height * 0.25\n    const progress =')
assert.doesNotThrow(() => validateSceneModule({ ...input, source: localTopSource }),
  'A local geometry variable named top is not a browser global and must pass the isolated-source validator')
const commentAndLiteralSource = source + '\n// window is mentioned here as documentation; document is not available to scene code.\nconst note = "window document are ordinary text here"\nconst pattern = /window|document/'
assert.doesNotThrow(() => validateSceneModule({ ...input, source: commentAndLiteralSource }),
  'Comments, strings and regex literals do not count as executable browser access')
rejects(() => validateSceneModule({ ...input, source: source + '\nctx.canvas.ownerDocument.createElement("canvas")' }),
  'ANIMATION_SCENE_SOURCE_CAPABILITY_FORBIDDEN')
rejects(() => validateSceneModule({ ...input, source: source + '\nctx["canvas"]' }), 'ANIMATION_SCENE_SOURCE_CAPABILITY_FORBIDDEN')
rejects(() => validateSceneModule({ ...input, source: source + '\nwindow.top.location' }),
  'ANIMATION_SCENE_SOURCE_CAPABILITY_FORBIDDEN')
rejects(() => validateSceneModule({ ...input, durationSec: 2.9 }), 'ANIMATION_SCENE_DURATION_INVALID')
rejects(() => validateParameterSchema(input.parameterSchema, { headline: 'x', unexpected: true }), 'ANIMATION_SCENE_PARAMETER_VALUES_INVALID')
assert.throws(() => validateParameterSchema({ quoteText: { type: 'string' } }, { quoteText: 'Texto' }),
  error => error.message.startsWith('ANIMATION_SCENE_PARAMETER_SCHEMA_INVALID:expected parameterSchema='),
  'Invalid parameter schemas explain the exact required envelope to the director')

process.stdout.write('Animation code-scene contracts: validation, deterministic plans, reuse parameters, and rejection cases passed.\n')
