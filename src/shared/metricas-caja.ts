// A.2: cotas por FUENTE de las etiquetas, no de la tipografia del pie.
// Medidas con Archivo 700 local. Regenerar con medir-cajas-a2.cjs al cambiar el asset.
// Añadir una familia exige SU metrica: no hereda la de Archivo ni un promedio.
export const METRICAS_ETIQUETA = {
  archivo700: {
    // A.3 queda aplazada a Fase B: el peor par admisible solapa incluso al +7%.
    // Se conserva la métrica A.2; no se reduce a ciegas mientras B no separe vecinos.
    familia: 'Archivo', peso: 700, fuenteCqmin: 2.9,
    alfabeto: Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') +
      'ÁÉÍÓÚÜÑáéíóúüñ¡¿',
    emMaximoMedido: 1.001015625,
    // Redondeo HACIA ARRIBA a milésimas de em. Incluye @, más ancho que W.
    emPorCaracter: 1.002,
    espaciadoEm: 0.01,
    fichero: 'archivo-var.woff2'
  }
} as const;
export type IdMetricaEtiqueta = keyof typeof METRICAS_ETIQUETA;
export const METRICA_ETIQUETA: IdMetricaEtiqueta = 'archivo700';

// El emoji tiene una ranura explicita. Su ancho ya no depende de la fuente del sistema.
// La cota de texto y el CSS de escena consumen estas mismas constantes.
export const GEOMETRIA_CAJA = {
  paddingXCqmin: 2.4, bordeCqmin: 0.3, gapCqmin: 1.3, emojiAnchoCqmin: 6.1
} as const;

/** Cota horizontal sin DOM, en % del ancho de un lienzo vertical. */
export function anchoCaja(
  etiqueta: unknown, conEmoji: boolean, id: IdMetricaEtiqueta = METRICA_ETIQUETA
): number {
  const m = METRICAS_ETIQUETA[id];
  const texto = String(etiqueta ?? '');
  // No suponemos que un glifo de otra escritura o una fuente de respaldo sea estrecho.
  // La puerta manda al respaldo; Infinity nunca autoriza una caja cuyo ancho no conocemos.
  if ([...texto].some(c => !m.alfabeto.includes(c))) return Infinity;
  const g = GEOMETRIA_CAJA;
  return 2 * (g.paddingXCqmin + g.bordeCqmin) +
    (conEmoji ? g.emojiAnchoCqmin + g.gapCqmin : 0) +
    texto.length * m.fuenteCqmin * (m.emPorCaracter + m.espaciadoEm);
}
