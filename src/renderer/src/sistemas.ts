// LOS CUATRO SISTEMAS DE COLOR de los Visuales —graficos a pantalla completa que sustituyen
// al plano—. Se elige uno por tema del video.
//
// Cada uno son cinco PAPELES, no cinco colores sueltos:
//   fondo   el cuadro entero. En modo pantalla lo pinta el COMPONENTE, no la ventana.
//   sup     la superficie sobre la que va el texto. NUNCA texto sobre el fondo desnudo.
//   texto   sobre `sup`.
//   acento  UNO SOLO por composicion, reservado al dato clave. Usarlo para dos cosas lo
//           convierte en decoracion y deja de señalar nada.
//   apoyo   lo secundario: unidades, etiquetas, el arco vacio del anillo.
//
// LOS NOMBRES SON LA CLAVE DEL HASH y estan repetidos en main/index.ts (SISTEMAS_VALIDOS),
// porque main y renderer se compilan por separado y hoy no comparten ningun modulo. Si se
// añade uno aqui y no alli, renderGraphicClip lo rechaza y cae a voltaje dejandolo en el
// log: fallo ruidoso, que es el que se quiere. Al reves —alli y no aqui— el componente cae a
// voltaje por el ?? de abajo.
export const SISTEMAS = {
  editorial: { fondo: '#080E14', sup: '#161C26', texto: '#F2F4F7', acento: '#FFD400', apoyo: '#8A94A6' },
  clinico:   { fondo: '#F7F6F3', sup: '#FFFFFF', texto: '#14171C', acento: '#1857D6', apoyo: '#6B6862' },
  voltaje:   { fondo: '#0A0A0A', sup: '#1A1A1A', texto: '#FAFAFA', acento: '#FF3B1F', apoyo: '#8C8C8C' },
  calido:    { fondo: '#FBF3E8', sup: '#F3E4D2', texto: '#2B2118', acento: '#E2571F', apoyo: '#7A6A58' }
} as const

export type NombreSistema = keyof typeof SISTEMAS

// ZONA SEGURA: 900x1400 centrado en 1080x1920. Margenes 8.33% a los lados y 13.54% arriba y
// abajo. Nada de la composicion sale de aqui.
export const ZONA_SEGURA = { ancho: 900, alto: 1400 }
