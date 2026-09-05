// LA COMPROBACION FIABLE DE LAS FUENTES DEL RENDER.
//
// `document.fonts.check()` no basta: devuelve true si no existe ninguna cara que cargar y puede
// devolver false para un peso declarado pero aun no usado. La evidencia es geometrica: medir la
// misma cadena con la familia pedida y con una familia imposible. Si dan el mismo ancho, el
// navegador esta pintando el respaldo.
//
// `grafico.tsx` conserva el bloqueo completo --fonts.load, fonts.ready y fonts.check-- porque el
// lazo de captura no puede fotografiar antes de tiempo. El banco NO bloquea: llama solo a esta
// comprobacion y avisa mientras lo que se ve no sea fiable. Extraer, no copiar.

export const MUESTRA_FUENTES = 'AÁÉÍÓÚÜÑ aáéíóúüñ 0123456789'

export const FUENTES_RENDER = [
  { familia: 'Outfit', peso: 700 },
  { familia: 'Archivo', peso: 700 },
  { familia: 'Anton', peso: 400 },
  { familia: 'Archivo Black', peso: 400 },
  { familia: 'Barlow Condensed', peso: 700 },
  { familia: 'Bebas Neue', peso: 400 },
  { familia: 'Caveat', peso: 700 },
  { familia: 'DM Serif Display', peso: 400 },
  { familia: 'IBM Plex Sans Condensed', peso: 700 },
  { familia: 'Playfair Display', peso: 800 },
  { familia: 'Space Mono', peso: 700 }
] as const

function anchoConFuente(familia: string, peso: number): number {
  const s = document.createElement('span')
  s.style.cssText = `position:absolute;left:-9999px;top:0;white-space:nowrap;` +
    `font:${peso} 100px "${familia}", serif`
  s.textContent = MUESTRA_FUENTES
  document.body.appendChild(s)
  const ancho = s.getBoundingClientRect().width
  s.remove()
  return ancho
}

/** Null significa que la familia produce geometria propia; texto significa que cae al respaldo. */
export function faltaLaFuentePorAncho(familia: string, peso: number): string | null {
  // El nombre no puede existir ni por casualidad: si existiera, se compararian dos fuentes reales
  // y la comprobacion diria que todo va bien aunque la familia pedida faltara.
  const respaldo = anchoConFuente('__cipher_no_existe_zz__', peso)
  const propia = anchoConFuente(familia, peso)
  if (Math.abs(propia - respaldo) < 0.5) {
    return `${familia}: el ancho es identico al respaldo (${propia.toFixed(1)}px), no esta cargada`
  }
  return null
}
