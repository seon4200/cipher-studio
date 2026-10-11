import type { DirectorDecision, DirectorInput } from '../../shared/director';
import { BuildFailure } from '../build/media';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validate every scene before allowing any decision into the saved plan. */
export function validateDirectorProposal(input: DirectorInput, proposal: unknown): DirectorDecision[] {
  if (!record(proposal) || !Array.isArray(proposal.scenes) ||
      proposal.scenes.length !== input.scenes.length)
    throw new BuildFailure('PLAN_RESPONSE', 'La respuesta del director tiene escenas ausentes o duplicadas.', true);

  const expected = new Set(input.scenes.map(scene => scene.id));
  const decisions = new Map<string, DirectorDecision>();
  for (const item of proposal.scenes) {
    if (!record(item) || typeof item.id !== 'string' || !expected.has(item.id) || decisions.has(item.id))
      throw new BuildFailure('PLAN_RESPONSE', 'La respuesta del director tiene IDs ajenos, ausentes o duplicados.', true);
    const visualIntent = typeof item.visualIntent === 'string' ? item.visualIntent.trim() : '';
    const searchQueries = Array.isArray(item.searchQueries) ? item.searchQueries :
      (typeof item.keyword === 'string' ? [item.keyword] : []);
    const queries = searchQueries.map(query => typeof query === 'string' ? query.trim() : '');
    const keyword = typeof item.keyword === 'string' ? item.keyword.trim() : (queries[0] || '');
    if (!visualIntent || visualIntent.length > 240 || !queries.length || queries.length > 2 ||
        queries.some(query => !query || query.length > 100) ||
        new Set(queries.map(query => query.toLocaleLowerCase())).size !== queries.length ||
        (item.keyword !== undefined && keyword !== queries[0]) ||
        typeof item.sourceStart !== 'number' || !Number.isFinite(item.sourceStart) || item.sourceStart < 0)
      throw new BuildFailure('PLAN_RESPONSE', 'El director devolvió una búsqueda o intervalo inválido.', true);
    // Whitelist fields: provider-supplied timing, category, paths, etc. cannot alter the plan.
    decisions.set(item.id, { id: item.id, visualIntent, searchQueries: queries,
      keyword: queries[0], sourceStart: item.sourceStart });
  }
  return input.scenes.map(scene => decisions.get(scene.id)!);
}
