import sapphireStyleProfile from './animation-style-profile-sapphire-v1.json'

/**
 * A textual, versioned art-direction profile for procedural Animation scenes.
 * Reference pixels are never copied into a scene or shipped as visual assets.
 */
export const CIPHER_ANIMATION_STYLE_PROFILE_V1 = Object.freeze({
  schema: 'cipher-animation-style-profile-v1',
  id: 'cipher-editorial-motion-v1',
  version: 1,
  title: 'Editorial técnico sobre papel',
  reference: { kind: 'project-local-private-reference' },
  direction: {
    palette: { paper: '#E8E5DF', ink: '#171614', orange: '#F26735', muted: '#77736D', white: '#FAF9F6' },
    typography: {
      titleFontFamily: 'Instrument Serif',
      bodyFontFamily: 'DM Sans',
      labelFontFamily: 'DM Sans',
      titleScale: 1.08,
      labelScale: 1.12,
      hierarchy: 'Titular editorial grande; etiquetas breves en mayúsculas con seguimiento amplio; cifras sólo si las respalda la narración.',
    },
    background: 'Papel cálido con retícula geométrica tenue dibujada en Canvas; sin fondo raster.',
    linework: 'Tinta oscura de grosor legible, nodos y piezas geométricas limpias; acento naranja reservado para activación, cambio o resultado.',
    composition: 'Usar el eje central vertical y variar de retícula a objeto, comparación, diagrama o tarjeta; mantener márgenes seguros y no fijar todos los elementos arriba.',
    motion: 'Entradas cortas que se asientan; activar antes del recorrido; transformar el grupo cuando cambia la explicación; reservar lectura final. Cámara sólo si revela un detalle o relación.',
    finish: 'Sombras suaves cortas para separar planos; superficies claras; grano y temblor no son obligatorios; ningún panel negro translúcido detrás del texto.',
    mobile: 'Priorizar un verbo/acción y un resultado legibles a 360 px; evitar etiquetas secundarias pequeñas.',
    forbidden: ['No importar píxeles de las referencias.', 'No convertir el titular y una figura abstracta creciente en la solución por defecto.', 'No añadir flechas, partículas ni cámara sin función semántica.', 'No inventar cantidades, causalidad, comparación ni participantes.'],
  },
  parameters: {
    paletteId: 'paper',
    titleFontFamily: 'Instrument Serif',
    bodyFontFamily: 'DM Sans',
    titleScale: 1.08,
    labelScale: 1.12,
    gridOpacity: 0.11,
    accentColor: '#F26735',
    movementIntensity: 'restrained',
  },
} as const)

export const CIPHER_ANIMATION_STYLE_PROFILE_SAPPHIRE_V1 = Object.freeze(sapphireStyleProfile)

export const CIPHER_ANIMATION_STYLE_PROFILES_V1 = Object.freeze([
  CIPHER_ANIMATION_STYLE_PROFILE_V1,
  CIPHER_ANIMATION_STYLE_PROFILE_SAPPHIRE_V1,
])
export const CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1 = CIPHER_ANIMATION_STYLE_PROFILE_SAPPHIRE_V1

export type CipherAnimationStyleProfileV1 = typeof CIPHER_ANIMATION_STYLE_PROFILE_V1 | typeof CIPHER_ANIMATION_STYLE_PROFILE_SAPPHIRE_V1

export function getCipherAnimationStyleProfileV1(id: string): CipherAnimationStyleProfileV1 | undefined {
  return CIPHER_ANIMATION_STYLE_PROFILES_V1.find(profile => profile.id === id)
}

export function validateCipherAnimationStyleProfileV1(value: unknown): CipherAnimationStyleProfileV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ANIMATION_STYLE_PROFILE_INVALID')
  const candidate = value as any
  const registered = getCipherAnimationStyleProfileV1(candidate.id)
  const custom = !registered && /^style-[a-f0-9]{20}$/.test(String(candidate.id || ''))
  const referenceMatches = (!!registered || custom) && (!candidate.reference || typeof candidate.reference === 'object')
  const defaults = { ...CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1.parameters, ...(registered?.parameters || {}) }
  const parameters = { ...defaults, ...(candidate.parameters || {}) }
  const direction = candidate.direction
  const directionFields = ['background', 'linework', 'composition', 'motion', 'finish', 'mobile']
  const directionValid = direction && typeof direction === 'object' && direction.palette &&
    typeof direction.palette === 'object' && !Array.isArray(direction.palette) &&
    directionFields.every(key => typeof direction[key] === 'string' && direction[key].length > 0 && direction[key].length <= 700) &&
    directionFields.slice(0, 1).every(key => typeof direction[key] === 'string') &&
    direction.typography && typeof direction.typography === 'object' &&
    typeof direction.typography.hierarchy === 'string' && direction.typography.hierarchy.length <= 500 &&
    (direction.forbidden === undefined || (Array.isArray(direction.forbidden) && direction.forbidden.length <= 20 &&
      direction.forbidden.every((item: unknown) => typeof item === 'string' && item.length <= 240))) &&
    Object.entries(direction.palette).length >= 2 && Object.entries(direction.palette).length <= 16 &&
    Object.entries(direction.palette).every(([key, color]) => /^[A-Za-z][A-Za-z0-9]{0,31}$/.test(key) &&
      typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color))
  const customMetadataValid = !custom || (candidate.schema === 'cipher-animation-style-profile-v1' &&
    Number.isInteger(candidate.version) && candidate.version >= 1 && candidate.version <= 10000 &&
    typeof candidate.title === 'string' && candidate.title.trim().length > 0 && candidate.title.length <= 80 &&
    typeof candidate.description === 'string' && candidate.description.length <= 1200 && directionValid)
  if ((!registered && !custom) || (registered && (candidate.schema !== registered.schema || candidate.version !== registered.version)) ||
      !customMetadataValid || !referenceMatches ||
      !candidate.direction || !candidate.parameters ||
      !['paper', 'night', 'garden', 'sapphire'].includes(parameters.paletteId) ||
      !['Instrument Serif', 'DM Sans'].includes(parameters.titleFontFamily) ||
      !['Instrument Serif', 'DM Sans'].includes(parameters.bodyFontFamily) ||
      !Number.isFinite(parameters.titleScale) || parameters.titleScale < .6 || parameters.titleScale > 1.6 ||
      !Number.isFinite(parameters.labelScale) || parameters.labelScale < .6 || parameters.labelScale > 1.6 ||
      !Number.isFinite(parameters.gridOpacity) || parameters.gridOpacity < 0 || parameters.gridOpacity > .3 ||
      !Number.isFinite(parameters.textureStrength) || parameters.textureStrength < 0 || parameters.textureStrength > .2 ||
      !Number.isFinite(parameters.surfaceDepth) || parameters.surfaceDepth < .5 || parameters.surfaceDepth > 1.5 ||
      !Number.isFinite(parameters.shadowStrength) || parameters.shadowStrength < 0 || parameters.shadowStrength > 1 ||
      !Number.isFinite(parameters.cameraDrift) || parameters.cameraDrift < 0 || parameters.cameraDrift > .08 ||
      (parameters.accentColor !== undefined && (typeof parameters.accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(parameters.accentColor))) ||
      (parameters.secondaryColor !== undefined && (typeof parameters.secondaryColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(parameters.secondaryColor))) ||
      (parameters.movementIntensity !== undefined && !['restrained', 'balanced', 'dynamic'].includes(parameters.movementIntensity)))
    throw new Error('ANIMATION_STYLE_PROFILE_INVALID')
  return { ...(registered || {}), ...candidate, direction: { ...direction }, parameters } as CipherAnimationStyleProfileV1
}
