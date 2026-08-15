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
/**
 * EL TEXTO DEL AVISO, EN UN SOLO SITIO.
 *
 * Los tres caminos que construyen tarjetas dicen lo mismo con las mismas palabras. Redactarlo
 * en cada uno es como se llega a que dos digan una cosa y el tercero no diga nada, que es
 * exactamente lo que paso.
 */
export function avisoDeExclusion(descartadas: number, total: number): string {
  if (!(descartadas > 0)) return '';
  return `${descartadas} de ${total} gráficos se descartaron porque caían sobre un Visual, ` +
    `que ya ocupa la pantalla entera.`;
}

export type TarjetaCruda = {
  id?: string;
  name?: string;
  graphicData?: any;
  graphicAbsoluteStart?: number | null;
  graphicDuration?: number | null;
  phraseIdx?: number;
};

export type ClipDelTimeline = Tramo & { id?: string; name?: string; category?: string };

/** La tarjeta ya COLOCADA: se sabe donde va y si llego ahi por respaldo. */
export type Colocada = {
  cruda: TarjetaCruda;
  startSeconds: number;
  durationSeconds: number;
  usaRespaldo: boolean;
};

const esVisual = (c: { category?: string }): boolean =>
  String(c?.category || '').toLowerCase() === 'visual';

/**
 * LAS DOS PROTECCIONES, EN LA MISMA LLAMADA QUE COLOCA.
 *
 * Van juntas a proposito: no se puede colocar bien y filtrar mal, porque es el mismo sitio.
 * Estaban separadas y un camino se quedo sin ninguna de las dos —13 de 40 tarjetas de un export
 * real cayeron sobre un Visual, dos de ellas clavadas encima.
 *
 *  1) LOS VISUALES FUERA DEL EMPAREJAMIENTO. Cuando el backend no manda un `graphicAbsoluteStart`
 *     se usa el clip emparejado como respaldo. Si ese clip puede ser un Visual, el respaldo
 *     coloca la tarjeta EXACTAMENTE encima: no es que faltara la exclusion, es que la rompia
 *     activamente y luego la exclusion tenia que deshacerlo.
 *  2) LAS QUE CAEN SOBRE UN VISUAL SE DESCARTAN, y se cuentan para el aviso.
 *
 * Lo que NO entra aqui: de donde sale la lista de clips, si el timeline se reemplaza o se
 * amplia, y que pasa si el proyecto cambia a mitad. Eso es distinto en cada camino —uno lee del
 * estado de React y otro de un array local que aun no esta en el estado— y forzar una funcion
 * comun sobre ello devolveria el bug: el que lee del estado lo leeria SIN los Visuales.
 *
 * Devuelve las crudas supervivientes, no clips de timeline: construir el objeto (con su id
 * aleatorio y su nombre) es cosa del renderer, y dejarlo fuera mantiene esto puro y probable.
 */
export function colocarYFiltrarTarjetas(
  crudas: TarjetaCruda[], clipsDelTimeline: ClipDelTimeline[]
): {
  quedan: Colocada[]; descartadas: Descartada<Colocada>[];
  aviso: string; total: number; conRespaldo: number;
} {
  const lista = Array.isArray(crudas) ? crudas.filter(c => c && c.graphicData) : [];
  const clips = Array.isArray(clipsDelTimeline) ? clipsDelTimeline : [];

  // PROTECCION 1: los Visuales no son candidatos a emparejar, solo a tapar.
  const candidatos = clips.filter(c => c && !esVisual(c));
  const visuales = clips.filter(c => c && esVisual(c));

  let conRespaldo = 0;
  const colocadas: Colocada[] = lista.map(c => {
    const par = candidatos.find(tc => (c.id && tc.id === c.id) || (c.name && tc.name === c.name));
    // Se exige NUMERO FINITO, no solo "no nulo". Un NaN pasaria el `??` y se colaria hasta
    // startSeconds, y `solapa` conserva la tarjeta ante un dato no numerico: entraria al video
    // colocada en ninguna parte.
    const abs = typeof c.graphicAbsoluteStart === 'number' && Number.isFinite(c.graphicAbsoluteStart)
      ? c.graphicAbsoluteStart : null;
    if (abs === null) conRespaldo++;
    const dur = typeof c.graphicDuration === 'number' && Number.isFinite(c.graphicDuration)
      ? c.graphicDuration
      : Math.min(2.0, Number(par?.durationSeconds) > 0 ? Number(par?.durationSeconds) : 2.0);
    return {
      cruda: c,
      startSeconds: abs !== null ? abs : (Number(par?.startSeconds) || 0),
      durationSeconds: dur,
      usaRespaldo: abs === null
    };
  });

  // PROTECCION 2.
  const { quedan, descartadas } = excluirSobreVisuales(colocadas, visuales);
  return {
    quedan, descartadas, total: colocadas.length, conRespaldo,
    aviso: avisoDeExclusion(descartadas.length, colocadas.length)
  };
}

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
