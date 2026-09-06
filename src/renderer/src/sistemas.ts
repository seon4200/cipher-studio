// El registro vive en shared: main, renderer y la guardia de contraste deben hablar
// de los mismos colores, no de tres copias que puedan desviarse silenciosamente.
export { SISTEMAS, type NombreSistema } from '../../shared/sistemas'

// ZONA SEGURA: 900x1400 centrado en 1080x1920. Margenes 8.33% a los lados y 13.54% arriba y
// abajo. Nada de la composicion sale de aqui.
export const ZONA_SEGURA = { ancho: 900, alto: 1400 }
