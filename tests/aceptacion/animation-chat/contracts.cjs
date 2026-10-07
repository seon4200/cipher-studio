'use strict'

const assert = require('node:assert/strict')
const animation = require('../../../src/main/animation/contract-v1.cjs')

function transferConfig({ id, durationSec, participants, relations, headline, arrivalOrder = [] }) {
  return animation.validateAnimationConfigV1({
    schema: animation.ANIMATION_CONFIG_SCHEMA_V1, configId: id,
    recipeId: 'explanatory-transfer-v1',
    content: { verbatimQuote: 'Un aporte llega y fortalece el resultado.', context: '',
      proposition: 'Un aporte fortalece una reserva.', headline, outcome: 'La reserva crece con cada aporte.',
      participants, relations },
    style: { paletteId: 'paper', labelScale: 1 },
    direction: { focus: 'destination', actionLabel: 'La reserva crece con cada aporte.', arrivalOrder },
    timing: { durationSec, fps: 30 },
  })
}

const first = transferConfig({ id: 'variant-one', durationSec: 3,
  headline: 'Un aporte fortalece una reserva',
  participants: [
    { instanceId: 'source', symbol: 'object', label: 'Aporte', meaning: 'Origen de la contribución' },
    { instanceId: 'reserve', symbol: 'result', label: 'Reserva', meaning: 'Destino que recibe' },
  ],
  relations: [{ id: 'contribution', from: 'source', to: 'reserve', kind: 'contributes', meaning: 'El aporte se suma a la reserva' }],
})
const second = transferConfig({ id: 'variant-two', durationSec: 5,
  headline: 'La investigación organiza preguntas',
  participants: [
    { instanceId: 'question', symbol: 'research', label: 'Pregunta', meaning: 'Tema que inicia la investigación' },
    { instanceId: 'finding', symbol: 'idea', label: 'Hallazgo', meaning: 'Resultado de la investigación' },
  ],
  relations: [{ id: 'investigates', from: 'question', to: 'finding', kind: 'feeds', meaning: 'La investigación produce un hallazgo' }],
})

const planA = animation.compileAnimationPlanV1(first)
const planB = animation.compileAnimationPlanV1(second)
const durationResolution = animation.resolveTimelineDuration(6.6, 6.625)
assert.equal(durationResolution.requestedDurationSec, 6.6)
assert.equal(durationResolution.selectedClipDurationSec, 6.625)
assert.equal(durationResolution.resolvedDurationSec, 6.625, 'The timeline slot is the authoritative clock')
assert.equal(durationResolution.resolution, 'timeline-authoritative-duration')
assert.equal(animation.resolveTimelineDuration(6.625, 6.625).resolution, 'exact')
assert.equal(planA.schema, 'cipher-animation-scene-plan-v1')
assert.equal(planA.clock.renderEntryPoint, 'renderAt(outputSeconds)')
assert.equal(planA.recipe.id, planB.recipe.id, 'Both content variants use the same recipe')
assert.notDeepEqual(planA.composition.participants.map(x => x.instanceId), planB.composition.participants.map(x => x.instanceId))
assert.notEqual(planA.composition.title.text, planB.composition.title.text)
assert.equal(planA.composition.relations[0].fromAnchor, 'source')
assert.equal(planA.composition.relations[0].toAnchor, 'reserve')
assert(planB.time.exitStart - planB.time.readStart >= 0.8)
assert.deepEqual(animation.compileAnimationPlanV1(first), planA, 'Compilation is deterministic from saved config')

const twoArrivals = transferConfig({ id: 'arrival-order', durationSec: 5,
  headline: 'Dos aportes, dos llegadas',
  participants: [
    { instanceId: 'one', symbol: 'object', label: 'Aporte 1', meaning: 'Primera contribución' },
    { instanceId: 'two', symbol: 'object', label: 'Aporte 2', meaning: 'Segunda contribución' },
    { instanceId: 'destination', symbol: 'growth', label: 'Reserva', meaning: 'Destino que crece' },
  ],
  relations: [
    { id: 'arrival-one', from: 'one', to: 'destination', kind: 'contributes', meaning: 'El primer aporte llega' },
    { id: 'arrival-two', from: 'two', to: 'destination', kind: 'contributes', meaning: 'El segundo aporte llega' },
  ], arrivalOrder: ['arrival-two', 'arrival-one'],
})
const orderedPlan = animation.compileAnimationPlanV1(twoArrivals)
assert.deepEqual(orderedPlan.time.events.filter(e => e.kind === 'arrival').map(e => e.relationId), ['arrival-two', 'arrival-one'],
  'The declared temporal order determines arrival events without changing participants')

const group = animation.validateAnimationConfigV1({ schema: animation.ANIMATION_CONFIG_SCHEMA_V1, configId: 'group',
  recipeId: 'group-formation-v1', content: { verbatimQuote: 'Las voces se organizan.', context: '',
    proposition: 'Las voces se organizan en un grupo.', headline: 'Las voces se organizan', outcome: 'Se forma un conjunto.',
    participants: [
      { instanceId: 'v1', symbol: 'voice', label: 'Voz A', meaning: 'Primera perspectiva' },
      { instanceId: 'v2', symbol: 'voice', label: 'Voz B', meaning: 'Segunda perspectiva' },
    ], relations: [{ id: 'grouping', from: 'v1', to: 'v2', kind: 'groups', meaning: 'Ambas forman un conjunto' }] },
  style: { paletteId: 'garden' }, direction: { focus: 'group', actionLabel: 'Se forma un conjunto.' }, timing: { durationSec: 4, fps: 30 } })
const comparison = animation.validateAnimationConfigV1({ schema: animation.ANIMATION_CONFIG_SCHEMA_V1, configId: 'compare',
  recipeId: 'comparison-v1', content: { verbatimQuote: 'El cambio se compara con el estado inicial.', context: '',
    proposition: 'Se comparan dos estados.', headline: 'Antes y después', outcome: 'La diferencia queda visible.',
    participants: [
      { instanceId: 'before', symbol: 'object', label: 'Antes', meaning: 'Estado inicial', side: 'left' },
      { instanceId: 'after', symbol: 'result', label: 'Después', meaning: 'Estado final', side: 'right' },
    ], relations: [{ id: 'compare', from: 'before', to: 'after', kind: 'contrasts', meaning: 'Contrasta los dos estados' }] },
  style: { paletteId: 'night' }, direction: { focus: 'difference', actionLabel: 'La diferencia queda visible.' }, timing: { durationSec: 4, fps: 30 } })
assert.equal(animation.compileAnimationPlanV1(group).recipe.id, 'group-formation-v1')
assert.equal(animation.compileAnimationPlanV1(comparison).composition.participants.find(x => x.instanceId === 'before').side, 'left')

const stateLate = animation.animationStateAt(planA, 2.2)
const stateEarly = animation.animationStateAt(planA, 0.2)
assert.equal(stateLate.phase, 'reading')
assert.equal(stateEarly.phase, 'entry')
assert.equal(animation.animationStateAt(planA, 2.2).phase, stateLate.phase,
  'Seeking out of order produces the same state at a given local output time')
assert.equal(planA.clock.localOriginSec, 0, 'Plans use a local clock; timeline placement is external')

const expectCode = (fn, code) => assert.throws(fn, error => error.message.startsWith(code), code)
expectCode(() => animation.compileAnimationPlanV1({ ...first, recipeId: 'unknown' }), 'ANIMATION_RECIPE_NOT_REGISTERED')
expectCode(() => transferConfig({ id: 'short', durationSec: 2.9,
  headline: 'Corta', participants: first.content.participants, relations: first.content.relations }), 'ANIMATION_NUMBER_OUT_OF_RANGE')
expectCode(() => animation.resolveTimelineDuration(2.9, 6.625), 'ANIMATION_NUMBER_OUT_OF_RANGE')
expectCode(() => animation.resolveTimelineDuration(6, 2.9), 'ANIMATION_NUMBER_OUT_OF_RANGE')
expectCode(() => transferConfig({ id: 'bad-endpoint', durationSec: 3, headline: 'Inválida',
  participants: first.content.participants, relations: [{ ...first.content.relations[0], to: 'missing' }] }), 'ANIMATION_RELATION_ENDPOINT_INVALID')
expectCode(() => transferConfig({ id: 'unsupported-relation', durationSec: 3, headline: 'Inválida',
  participants: first.content.participants, relations: [{ ...first.content.relations[0], kind: 'contrasts' }] }), 'ANIMATION_RELATION_INCOMPATIBLE')
expectCode(() => transferConfig({ id: 'bad-arrival-order', durationSec: 3, headline: 'Inválida',
  participants: twoArrivals.content.participants, relations: twoArrivals.content.relations, arrivalOrder: ['missing'] }), 'ANIMATION_ARRIVAL_ORDER_INVALID')
expectCode(() => transferConfig({ id: 'duplicate-id', durationSec: 3, headline: 'Inválida',
  participants: [first.content.participants[0], first.content.participants[0]], relations: first.content.relations }), 'ANIMATION_PARTICIPANT_ID_DUPLICATE')
expectCode(() => transferConfig({ id: 'bad-destination', durationSec: 3, headline: 'Inválida',
  participants: first.content.participants, relations: [
    ...first.content.relations, { id: 'cycle', from: 'reserve', to: 'source', kind: 'transfers', meaning: 'ciclo' },
  ] }), 'ANIMATION_TRANSFER_NEEDS_ONE_DESTINATION')
expectCode(() => animation.validateAnimationConfigV1({ ...first, style: { paletteId: 'not-registered' } }), 'ANIMATION_PALETTE_NOT_REGISTERED')
expectCode(() => animation.validateAnimationConfigV1({ ...first,
  content: { ...first.content, participants: [{ ...first.content.participants[0], symbol: 'unregistered' }, first.content.participants[1]] },
}), 'ANIMATION_SYMBOL_UNSUPPORTED')

const componentIdsA = planA.components.map(x => `${x.id}@${x.version}`)
const componentIdsGroup = animation.compileAnimationPlanV1(group).components.map(x => `${x.id}@${x.version}`)
const sharedComponents = componentIdsA.filter(id => componentIdsGroup.includes(id))
assert(sharedComponents.includes('participant-node-v1@2'), 'The exact participant component version is reused by transfer and group formation')
assert(sharedComponents.includes('headline-v1@1'), 'The same title component is shared across scene directions')
assert(planA.components.some(x => x.implementation?.moduleId === 'animation-canvas-runtime-v4' && x.implementation?.symbol === 'drawParticipants'))
assert(componentIdsA.includes('traveler-v1@1') && !componentIdsGroup.includes('traveler-v1@1'),
  'Only transfer includes the traveler component; incompatible recipes do not advertise it')
assert(componentIdsGroup.includes('group-ring-v1@1') && !componentIdsA.includes('group-ring-v1@1'),
  'Group formation includes its actual collective-shape component')
assert.equal(planA.revision, 2, 'ScenePlan revision 2 pins accurate component dependencies while revision 1 remains replayable')
process.stdout.write('Animation contracts: valid variants, deterministic plan, shared components, and rejection cases passed.\n')
require('./scene-module-contract.cjs')
