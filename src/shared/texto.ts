// EL RECORTE DEL TEXTO DE UN VISUAL.
//
// 90 caracteres, elegido con la distribucion real delante y no a ojo. Medido sobre los dos
// proyectos representativos —423 y 80 frases de narracion—: mediana 45 caracteres, p90 59, y
// la MAXIMA 75. Asi que 90 deja margen y casi nunca se activa. No es un limite de diseño sino
// una red: lo que no cabe, no cabe.
//
// NO se encoge la letra cuando el texto es largo. Un Visual con letra pequeña deja de ser un
// Visual: su razon de ser es que sustituye al plano y se lee de un vistazo.
//
// Vive aqui, puro y compartido, porque lo usan DOS: el componente, para garantizar que lo que
// pinta cabe, y la generacion de Visuales, para recortar ANTES de hashear. Si solo recortara
// el componente, dos textos largos distintos que se recortan igual darian dos claves para el
// mismo fotograma y se renderizaria dos veces.
export const MAX_CARACTERES_VISUAL = 90;

export function recortarTexto(t: unknown, max: number = MAX_CARACTERES_VISUAL): string {
  const s = String(t ?? '').trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;

  const corte = s.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(' ');
  // Sin ningun espacio en los primeros `max` caracteres —una palabra kilometrica, una URL—
  // se corta a pelo: una palabra partida es mejor que un texto que se sale del cuadro.
  const base = ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : corte;
  // Se limpia la puntuacion que queda colgando del corte: "algo, …" o "algo - …" quedan mal y
  // no aportan nada.
  return base.replace(/[\s,;:.·—–-]+$/, '') + '…';
}
