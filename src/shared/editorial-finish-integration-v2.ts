import type { EditorialLocalRelationV2, EditorialLocalEventV2 } from './editorial-local-bank-v2'

/** Pixel-visible finish for newly planned scenes in the existing editorial route.
 * Absence of this marker means the saved V4 finish remains byte-for-byte historical. */
export const EDITORIAL_FINISH_INTEGRATION_V2 = 'editorial-finish-integration-2026-09-v2' as const

type Meaning = EditorialLocalRelationV2['meaning']
const recipes: Record<Meaning, Pick<EditorialLocalRelationV2, 'representation' | 'response'>> = {
  informs: { representation: 'arrow', response: 'accent' },
  causes: { representation: 'light-pulse', response: 'halo' },
  transfers: { representation: 'dot-flow', response: 'pulse' },
  connects: { representation: 'accent-link', response: 'scale' },
  compares: { representation: 'dotted', response: 'none' },
}

export function editorialFinishRecipeV2(meaning: Meaning) {
  return recipes[meaning]
}

/** One finite arrival event per grounded relation, never an ambient substitute for meaning. */
export function editorialArrivalEventsV2(relations: readonly EditorialLocalRelationV2[],
  color: string): EditorialLocalEventV2[] {
  return relations.map((relation, index) => ({
    id: `grounded-arrival-${index}`,
    target: relation.to,
    kind: 'arrival',
    start: relation.arrival - .015,
    duration: relation.end - relation.arrival + .015,
    seed: 41 + index * 37,
    color,
    count: relation.meaning === 'compares' ? 3 : 5,
    size: .8,
    opacity: .46,
    intensity: 'discreto',
  }))
}

export function validateEditorialFinishIntegrationV2(plan: {
  finishIntegration?: typeof EDITORIAL_FINISH_INTEGRATION_V2
  relations: EditorialLocalRelationV2[]
  events: EditorialLocalEventV2[]
  accent: string
  particles: { mode: string; count: number; opacity: number }
}): void {
  if (plan.finishIntegration === undefined) return
  if (plan.finishIntegration !== EDITORIAL_FINISH_INTEGRATION_V2 ||
      plan.particles.mode !== 'none' || plan.particles.count !== 0 || plan.particles.opacity !== 0)
    throw Error('EDITORIAL_FINISH_INTEGRATION_INVALID')
  for (const relation of plan.relations) {
    const expected = editorialFinishRecipeV2(relation.meaning)
    if (relation.representation !== expected.representation || relation.response !== expected.response)
      throw Error('EDITORIAL_FINISH_RECIPE_MISMATCH')
  }
  const actual = plan.events.filter(event => event.kind === 'arrival')
  if (JSON.stringify(actual) !== JSON.stringify(editorialArrivalEventsV2(plan.relations, plan.accent)))
    throw Error('EDITORIAL_FINISH_ARRIVAL_NOT_GROUNDED')
}
