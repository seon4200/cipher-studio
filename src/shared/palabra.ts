// ELEGIR LA PALABRA QUE PINTA UN VISUAL.
//
// La lista de palabras vacias estaba DUPLICADA en main/index.ts (:4407 y :4567). Aqui vive una
// sola vez: copiarla a un tercer sitio era el patron que ya mordio con la aritmetica del
// reparto, donde el mismo calculo en dos lugares daba resultados distintos y nada lo decia.
export const PALABRAS_VACIAS = [
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'en', 'y', 'a', 'que', 'se', 'es',
  'por', 'con', 'su', 'sus', 'lo', 'le', 'les', 'me', 'te', 'nos', 'para', 'como', 'pero',
  'mas', 'más', 'si', 'no', 'ya'
];

// El filtro anterior hacia replace(/[^a-záéíóúñ]/g,'') y con eso "48.6%" se convertia en CADENA
// VACIA — justo el dato que mas merece un Visual. Medido: los 4 tramos "sin palabra con
// significado" de un proyecto real eran TODOS cifras ("un 48.6%.", "de 88 al 92%.").
// Aqui solo se quita la puntuacion de los bordes y los digitos se conservan.
const limpiar = (w: unknown): string =>
  String(w ?? '').trim().toLowerCase().replace(/^[^\wáéíóúñ]+|[^\wáéíóúñ]+$/g, '');

export function tieneSignificado(w: unknown): boolean {
  const c = limpiar(w);
  if (c.length < 3) return false;
  if (/\d/.test(c)) return true;               // una cifra SIEMPRE vale
  return !PALABRAS_VACIAS.includes(c);
}

export type PalabraConTiempo = { word: string; start: number; end: number };

/**
 * La palabra del tramo [ini, fin) que pinta el Visual, o null si no hay ninguna con
 * significado — menos del 1% de los tramos, medido sobre tres proyectos reales.
 *
 * LA MAS LARGA, no la primera. Medido: los dos criterios coinciden solo en el 17-28% de los
 * casos, y la mas larga da el termino del tema mientras que la primera da el verbo o un
 * generico: son->inteligencia, ira->desesperanza, gente->ingenieria.
 */
export function palabraDelTramo(
  words: PalabraConTiempo[] | null | undefined, ini: number, fin: number
): string | null {
  if (!Array.isArray(words) || !words.length) return null;
  // Solapa, no contiene: una palabra que empieza antes del tramo y termina dentro TAMBIEN
  // suena durante el.
  const dentro = words.filter(w =>
    typeof w?.start === 'number' && typeof w?.end === 'number' &&
    w.end > ini && w.start < fin && tieneSignificado(w.word));
  if (!dentro.length) return null;
  const elegida = dentro.reduce((m, w) =>
    limpiar(w.word).length > limpiar(m.word).length ? w : m);
  return String(elegida.word).trim();
}

/**
 * ¿Se pueden hacer Visuales con estos segmentos? Necesitan `words`, que solo existen si la
 * transcripcion se hizo con --word_timestamps. Un proyecto transcrito ANTES de ese cambio no
 * los tiene, y sin esto el usuario moveria el slider de Visuales y no pasaria nada.
 */
export function hayTiemposPorPalabra(segs: any[] | null | undefined): boolean {
  return Array.isArray(segs) && segs.some(s => Array.isArray(s?.words) && s.words.length > 0);
}
