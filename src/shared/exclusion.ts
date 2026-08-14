// LA EXCLUSION MUTUA ENTRE VISUALES Y TARJETAS.
//
// Un Visual ocupa el CUADRO ENTERO. Una tarjeta encima no aporta nada: taparia parte de lo
// unico que se ve. Y moverla seria colocarla donde el guion no la pidio, asi que se DESCARTA
// y se cuenta.
//
// Vive aqui, puro y compartido, porque hay DOS caminos que construyen tarjetas —el de generar
// el timeline y el del boton de regenerar graficos— y arreglar uno solo dejaria el otro
// abierto. Es el patron de las dos vias de carga, que ya mordio una vez.

export type Tramo = { startSeconds: number; durationSeconds: number };

// Tolerancia para BORDES, no una regla. Con tarjetas de 2 s y Visuales de 2-3 s casi nunca
// decide nada, que es justo lo que se busca: sin ella, una tarjeta que solo toca la frontera
// de un Visual —40 ms que no ve nadie— se descartaria, y perder una tarjeta buena es peor que
// dejar pasar un solape imperceptible.
export const SOLAPE_MINIMO_S = 0.15;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function solapa(a: Tramo, b: Tramo): boolean {
  const aIni = num(a?.startSeconds), aDur = num(a?.durationSeconds);
  const bIni = num(b?.startSeconds), bDur = num(b?.durationSeconds);
  // Con un valor no numerico NO se puede saber si solapan, y ante la duda se CONSERVA la
  // tarjeta: descartarla seria destruir algo por un dato que ya venia roto. Un clip con
  // startSeconds NaN es otro problema, y este no es su sitio.
  if (aIni === null || aDur === null || bIni === null || bDur === null) return false;
  const ini = Math.max(aIni, bIni);
  const fin = Math.min(aIni + aDur, bIni + bDur);
  return (fin - ini) >= SOLAPE_MINIMO_S;
}

export type Descartada<T> = { tarjeta: T; visual: Tramo };

/**
 * Separa las tarjetas que caen sobre un Visual.
 *
 * Devuelve tambien las descartadas CON el Visual que las tapaba: sin eso el recuento podria
 * decir cuantas, pero no por que, y el usuario no tendria forma de comprobarlo.
 */
export function excluirSobreVisuales<T extends Tramo>(
  tarjetas: T[], visuales: Tramo[]
): { quedan: T[]; descartadas: Descartada<T>[] } {
  if (!Array.isArray(tarjetas)) return { quedan: [], descartadas: [] };
  if (!Array.isArray(visuales) || !visuales.length) return { quedan: tarjetas, descartadas: [] };
  const quedan: T[] = [];
  const descartadas: Descartada<T>[] = [];
  for (const t of tarjetas) {
    // El PRIMERO que solapa: una tarjeta que cae sobre dos Visuales se descarta una sola vez,
    // no dos. El recuento cuenta TARJETAS, no colisiones.
    const choca = visuales.find(v => solapa(t, v));
    if (choca) descartadas.push({ tarjeta: t, visual: choca });
    else quedan.push(t);
  }
  return { quedan, descartadas };
}
