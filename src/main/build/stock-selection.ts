import type { BuildScene, StockCandidateDecision } from '../../shared/build-plan';

export interface SearchCandidate {
  id: string; provider: string; url: string; width: number; height: number; duration?: number;
  pageUrl?: string; title?: string; tags?: string[]; type?: string;
  views?: number; downloads?: number; likes?: number; query: string; responseRank: number;
}

export interface CandidateAssessment {
  decision: StockCandidateDecision; score: number; reasons: string[];
}

const GENERIC = new Set([
  'a', 'an', 'the', 'and', 'or', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'to', 'toward',
  'with', 'about', 'person', 'people', 'human', 'man', 'woman', 'someone', 'individual', 'video', 'clip',
  'footage', 'visual', 'personal', 'self', 'potential', 'success', 'growth', 'confidence', 'achievement', 'recognition',
  'skill', 'performance', 'effort', 'goal', 'goals', 'future', 'thinking', 'thought', 'working', 'work',
]);
const tokens = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase().match(/[a-z0-9]+/g) || [];

export function sceneSearchQueries(scene: Pick<BuildScene, 'searchQueries' | 'keyword'>): string[] {
  const proposed = Array.isArray(scene.searchQueries) && scene.searchQueries.length
    ? scene.searchQueries : [scene.keyword || ''];
  const unique = [...new Set(proposed.map(query => query.trim().replace(/\s+/g, ' ')).filter(Boolean))];
  return unique.slice(0, 2).map(query => query.slice(0, 100));
}

export function assessStockCandidate(query: string, candidate: Pick<SearchCandidate, 'title' | 'tags'>): CandidateAssessment {
  const metadata = [...(candidate.tags || []), candidate.title || ''].join(' ');
  const normalized = tokens(metadata);
  const available = new Set(normalized);
  const searchTerms = [...new Set(tokens(query))];
  const specificTerms = searchTerms.filter(term => !GENERIC.has(term));
  const matches = specificTerms.filter(term => available.has(term));
  const score = specificTerms.length ? matches.length / specificTerms.length : 0;
  const reasons: string[] = [];

  if (!metadata.trim()) reasons.push('El proveedor no devolvió título ni etiquetas para evaluar la pertinencia.');
  const queryTokens = new Set(searchTerms);
  const hasPersonIntent = ['person', 'people', 'human', 'man', 'woman'].some(term => queryTokens.has(term));
  const hasPersonEvidence = ['person', 'people', 'human', 'man', 'woman'].some(term => available.has(term));
  const animalEvidence = ['bird', 'animal', 'fish', 'insect', 'ants', 'ant', 'spider', 'dog', 'cat'].some(term => available.has(term));
  if (hasPersonIntent && animalEvidence && !hasPersonEvidence) {
    reasons.push('Contradicción clara: la consulta pide una persona y las etiquetas describen un animal.');
    return { decision: 'rejected', score, reasons };
  }
  if (queryTokens.has('mirror') && ['circuit', 'processor', 'motherboard', 'chip', 'electronics'].some(term => available.has(term)) &&
      !['mirror', 'reflection', 'face', 'person', 'woman', 'man'].some(term => available.has(term))) {
    reasons.push('Contradicción clara: la consulta pide un espejo y las etiquetas describen electrónica.');
    return { decision: 'rejected', score, reasons };
  }
  if (queryTokens.has('alone') && ['colleague', 'colleagues', 'team', 'meeting', 'group'].some(term => available.has(term))) {
    reasons.push('Contradicción clara: la consulta pide una persona sola y las etiquetas describen un grupo.');
    return { decision: 'rejected', score, reasons };
  }
  if (queryTokens.has('self') && ['colleague', 'colleagues', 'team', 'meeting', 'group', 'conversation', 'discussion'].some(term => available.has(term))) {
    reasons.push('Contradicción clara: la consulta pide auto-diálogo y las etiquetas describen una interacción grupal.');
    return { decision: 'rejected', score, reasons };
  }
  if (available.has('generated') && available.has('ai'))
    reasons.push('Las etiquetas identifican contenido generado por IA; requiere revisión visual.');
  if (!specificTerms.length || matches.length < Math.min(2, specificTerms.length) || score < 0.67)
    reasons.push('Las etiquetas no aportan suficiente coincidencia concreta con la consulta.');
  if (reasons.length) return { decision: 'pending-review', score, reasons };
  return { decision: 'metadata-supported', score, reasons: ['Los metadatos respaldan suficientes términos concretos de la consulta.'] };
}

export function rankStockCandidates(candidates: SearchCandidate[], aspectRatio: string) {
  const vertical = aspectRatio === '9:16' || aspectRatio === 'vertical';
  return candidates.map(candidate => ({ candidate, assessment: assessStockCandidate(candidate.query, candidate) }))
    .sort((a, b) => {
      const decisionRank = (item: CandidateAssessment) => item.decision === 'metadata-supported' ? 0 :
        item.decision === 'pending-review' ? 1 : 2;
      return decisionRank(a.assessment) - decisionRank(b.assessment) ||
        b.assessment.score - a.assessment.score ||
        Number((b.candidate.height > b.candidate.width) === vertical) - Number((a.candidate.height > a.candidate.width) === vertical) ||
        b.candidate.width - a.candidate.width || a.candidate.responseRank - b.candidate.responseRank;
    });
}
