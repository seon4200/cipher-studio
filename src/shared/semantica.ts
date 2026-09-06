// CONTRATO CERRADO ENTRE IA Y MOTOR. La IA nombra una relacion; este modulo la valida contra
// el registro real y proyecta solamente los campos que pueden llegar al hash y al renderer.
import { sanearConceptos, type Concepto } from './conceptos';
import { estructurasParaRelacion, type RelacionVisual } from './escena';

export type SemanticaVisual = {
  relacion: RelacionVisual;
  ancla: Concepto;
  terminos: Concepto[];
};

/** Repetir un término solo expresa algo cuando se comparan o engranan dos iguales. */
const RELACIONES_QUE_ADMITEN_REPETIDOS = new Set<RelacionVisual>(['contrasta', 'encaja']);

function conceptoSeguro(crudo: unknown): Concepto | null {
  // Reutiliza el saneador real sin copiar su segmentacion de grafemas ni el limite de etiqueta.
  const tres = sanearConceptos([crudo, crudo, crudo]);
  return tres?.[0] ?? null;
}

/** Null significa que la semantica se rechaza completa y el motor vuelve al sorteo determinista. */
export function sanearSemanticaVisual(crudo: unknown): SemanticaVisual | null {
  if (!crudo || typeof crudo !== 'object') return null;
  try {
    const v = crudo as Record<string, unknown>;
    const relacion = typeof v.relacion === 'string' ? v.relacion as RelacionVisual : null;
    if (!relacion || !estructurasParaRelacion(relacion).length) return null;
    const terminos = sanearConceptos(v.terminos);
    const ancla = conceptoSeguro(v.ancla) ?? terminos?.[0] ?? null;
    if (!terminos || !ancla) return null;
    // La lista no se deduplica: dos relojes pueden ser la idea. Pero una repetición fuera de
    // comparación/acoplamiento era el contenedor viejo incapaz de expresar una relación.
    const repetidos = new Set<string>();
    for (const termino of terminos) {
      const clave = `${termino.icono ?? termino.emoji}\u0001${termino.etiqueta}`;
      if (repetidos.has(clave) && !RELACIONES_QUE_ADMITEN_REPETIDOS.has(relacion)) return null;
      repetidos.add(clave);
    }
    return { relacion, ancla, terminos };
  } catch {
    return null;
  }
}
