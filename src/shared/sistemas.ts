// Paletas de los Visuales. Es un modulo compartido porque el color decide pixeles
// y la guardia de contraste debe comprobar el mismo registro que pinta el renderer.
export const SISTEMAS = {
  editorial: { fondo: '#080E14', sup: '#161C26', texto: '#F2F4F7', acento: '#FFD400', apoyo: '#8A94A6',
    luz: { texto: '#F2F4F7', caja: '#161C26' },
    tinta: { sup: '#FFFFFF', texto: '#161C26', acento: '#806000', apoyo: '#525C6E' } },
  clinico: { fondo: '#F7F6F3', sup: '#FFFFFF', texto: '#14171C', acento: '#1857D6', apoyo: '#6B6862',
    luz: { texto: '#F7F6F3', caja: '#14171C' },
    tinta: { sup: '#FFFFFF', texto: '#14171C', acento: '#1857D6', apoyo: '#6B6862' } },
  voltaje: { fondo: '#0A0A0A', sup: '#1A1A1A', texto: '#FAFAFA', acento: '#FF3B1F', apoyo: '#8C8C8C',
    luz: { texto: '#FAFAFA', caja: '#1A1A1A' },
    tinta: { sup: '#FFFFFF', texto: '#1A1A1A', acento: '#B52B16', apoyo: '#595959' } },
  calido: { fondo: '#FBF3E8', sup: '#F3E4D2', texto: '#2B2118', acento: '#E2571F', apoyo: '#7A6A58',
    luz: { texto: '#FBF3E8', caja: '#2B2118' },
    tinta: { sup: '#FBF3E8', texto: '#2B2118', acento: '#A53B12', apoyo: '#7A6A58' } }
} as const

export type NombreSistema = keyof typeof SISTEMAS
export const CONTRASTE_MINIMO_CAJA = 3
export const CONTRASTE_MINIMO_ESCENA = 3
export type TonoDominante = 'claro' | 'oscuro' | 'sistema'

// Son las superficies mas exigentes que hoy declaran los fondos claros y oscuros.
// La guarda evalua contra estos limites, no contra una caja opaca: el pie queda sobre
// el fondo desnudo. Si un fondo futuro aclara su campo oscuro o ensombrece el claro,
// debe actualizar este registro junto con su pieza para que la guarda siga midiendo
// el clip completo.
const FONDO_DOMINANTE_LIMITE = {
  claro: '#9BDCD4', // causticas
  oscuro: '#0D5F7A' // ecosistemaMarino
} as const

function canal(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(limpio.slice(i, i + 2), 16) / 255) as [number, number, number]
}
function lineal(v: number): number { return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }
function luminancia(hex: string): number {
  const [r, g, b] = canal(hex).map(lineal)
  return .2126 * r + .7152 * g + .0722 * b
}

/** Contraste WCAG de los dos colores OPACOS que realmente usa `.es-caja`. */
export function contraste(hexA: string, hexB: string): number {
  const [a, b] = [luminancia(hexA), luminancia(hexB)].sort((x, y) => y - x)
  return (a + .05) / (b + .05)
}

/** La caja es opaca: asi el contraste no depende del fotograma que haya debajo. */
export function coloresCaja(sistema: NombreSistema, tono: 'oscuro' | 'claro') {
  const s = SISTEMAS[sistema]
  return tono === 'claro' ? { texto: s.tinta.texto, caja: s.tinta.sup } : { texto: s.texto, caja: s.sup }
}

/**
 * Texto y superficie efectivos de una escena. Un fondo de color propio puede ser oscuro
 * aunque la paleta del video sea clara; en ese caso no se hereda tinta oscura sobre un clip
 * oscuro. Los fondos que realmente usan `--fondo` declaran `sistema` y conservan la paleta.
 */
export function coloresEscena(sistema: NombreSistema, tono: TonoDominante) {
  const s = SISTEMAS[sistema]
  if (tono === 'claro') return { texto: s.tinta.texto, caja: s.tinta.sup, sup: s.tinta.sup,
    acento: s.tinta.acento, apoyo: s.tinta.apoyo }
  if (tono === 'oscuro') return { texto: s.luz.texto, caja: s.luz.caja, sup: s.luz.caja,
    acento: s.acento, apoyo: s.apoyo }
  return { texto: s.texto, caja: s.sup, sup: s.sup, acento: s.acento, apoyo: s.apoyo }
}

/** Contraste del texto contra el fondo dominante real, no contra la caja. */
export function contrasteTextoEscena(sistema: NombreSistema, tono: TonoDominante): number {
  const fondo = tono === 'sistema' ? SISTEMAS[sistema].fondo : FONDO_DOMINANTE_LIMITE[tono]
  return contraste(coloresEscena(sistema, tono).texto, fondo)
}
