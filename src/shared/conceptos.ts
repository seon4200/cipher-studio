// LOS TRES CONCEPTOS DE UN VISUAL, saneados.
//
// Vienen de DeepSeek, que puede devolver dos en vez de tres, una etiqueta de doce palabras, un
// emoji vacio o una clave de mas. Nada de eso puede llegar a la composicion ni al hash.
//
// POR QUE IMPORTA EL HASH: los conceptos van dentro de `extra`, que `canonizar` proyecta en la
// clave del MOV. Una clave de mas —{emoji, etiqueta, confianza: 0.9}— cambiaria el hash SIN
// cambiar un pixel, y la cache dejaria de reutilizar ficheros identicos. Por eso se PROYECTA a
// los campos exactos que puede usar el renderer en vez de copiar el objeto.
//
// NO LANZA NUNCA. Matar el render convierte "un Visual feo" en "un Visual ausente", y un Visual
// que falta descuadra la aritmetica de frames: medido, el -shortest del mux se comio 3.24 s de
// narracion por esa via. Un dato malo se corrige o se descarta; nunca se revienta.

/** `emoji` es el respaldo visible; `icono` nombra Solar cuando el renderer lo resuelve. */
export type Concepto = { emoji: string; etiqueta: string; icono?: string; ic?: string };

export const CUANTOS_CONCEPTOS = 3;
export const MAX_PALABRAS_ETIQUETA = 2;

/**
 * El primer grafema de una cadena, que es lo que hace falta para "UN emoji".
 *
 * Un emoji no es un caracter: "👩‍🌾" son cuatro puntos de codigo unidos por ZWJ, y cortarlo con
 * `[0]` o con `Array.from(...)[0]` lo parte y deja un glifo distinto o medio. `Intl.Segmenter`
 * es la unica forma correcta; se protege con try por si el entorno no lo trae.
 */
function primerGrafema(s: string): string {
  try {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    for (const g of seg.segment(s)) return g.segment;
    return '';
  } catch (e) {
    return Array.from(s)[0] ?? '';
  }
}

/** 1 o 2 palabras. Se corta por PALABRAS y no por caracteres: cortar por caracteres parte la
 *  ultima a mitad y deja "Industri". */
function recortarEtiqueta(v: unknown): string {
  const partes = String(v ?? '').trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, MAX_PALABRAS_ETIQUETA).join(' ');
}

/**
 * Devuelve EXACTAMENTE tres conceptos, o null.
 *
 * NULL CUANDO NO HAY TRES USABLES, y es una decision, no una carencia. La alternativa era
 * rellenar con un hueco neutro, y eso pinta una caja vacia en pantalla: peor que no pintar el
 * mecanismo. Es la misma regla que ya sigue el Visual de texto —"sin palabra con significado el
 * Visual se DESCARTA y su hueco cae a original. No se inventa una palabra"—: cuando falta
 * contenido se cae a algo que si funciona, no se rellena con nada.
 *
 * Quien llame decide que hacer con el null. Hoy nadie lo consume todavia.
 */
export function sanearConceptos(v: unknown): Concepto[] | null {
  if (!Array.isArray(v)) return null;
  const buenos: Concepto[] = [];
  for (const c of v) {
    if (!c || typeof c !== 'object') continue;
    // El try envuelve la LECTURA de las propiedades, no solo su conversion. Leer `c.emoji`
    // puede ejecutar codigo —un getter que lance—, y entonces la excepcion sale de esta funcion
    // y mata el render. Lo cazo una prueba con un objeto hostil; la promesa de "no lanza nunca"
    // no se sostenia sola. Un dato imposible no puede costar un Visual entero.
    let emoji = '', etiqueta = '', icono = '';
    try {
      emoji = primerGrafema(String((c as any).ic ?? (c as any).emoji ?? '').trim());
      etiqueta = recortarEtiqueta((c as any).etiqueta);
      icono = String((c as any).icono ?? '').trim();
    } catch (e) { continue; }
    // Los dos tienen que existir: media caja no es un concepto.
    if (!emoji || !etiqueta) continue;
    // Se PROYECTA a los cuatro campos dibujables. Cualquier campo extra que traiga el modelo se
    // queda fuera por construccion, que es justo lo que protege la clave del hash.
    buenos.push({ emoji, etiqueta, ...(icono ? { icono, ic: emoji } : {}) });
    if (buenos.length === CUANTOS_CONCEPTOS) break;   // si vienen cinco, los tres primeros
  }
  return buenos.length === CUANTOS_CONCEPTOS ? buenos : null;
}
