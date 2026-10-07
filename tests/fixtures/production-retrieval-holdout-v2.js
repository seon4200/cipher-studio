/*
 * D-Final phrase holdout. Frozen before its first execution and never used as a
 * ConceptLexicon tuning list. It tests evidence ordering, role promotion and
 * legitimate editorial fallback with scenes not copied from either V15 video.
 */

const rows = [
  ['La enfermera abrió el botiquín antes de entrar', 'entrar', [['enfermera', '👩‍⚕️', 'user'], ['botiquín', '🧰', 'case'], ['medicina', '💊', 'medicine']], true],
  ['Aunque tú dudabas, el tren ya cruzaba el valle', 'tú', [['tren', '🚆', 'tram'], ['valle', '🏞️', 'mountains'], ['viaje', '🧳', 'suitcase']], true],
  ['Las abejas rodearon la flor al amanecer', 'las', [['abeja', '🐝', 'bug'], ['flor', '🌼', 'flower'], ['amanecer', '🌅', 'sun']], true],
  ['De pronto la ambulancia llegó al hospital', 'de', [['ambulancia', '🚑', 'ambulance'], ['hospital', '🏥', 'hospital'], ['emergencia', '🚨', 'siren']], true],
  ['Ella guardó el pasaporte dentro de la maleta', 'ella', [['pasaporte', '🛂', 'document'], ['maleta', '🧳', 'suitcase'], ['viajera', '🧍‍♀️', 'user']], true],
  ['Lo que haces con el martillo cambia la pared', 'haces', [['martillo', '🔨', 'hammer'], ['pared', '🧱', 'wall'], ['obra', '🏗️', 'buildings']], true],
  ['En la tormenta el paraguas protegía al niño', 'en', [['paraguas', '☂️', 'umbrella'], ['tormenta', '⛈️', 'cloud-storm'], ['niño', '👦', 'user']], true],
  ['La fotógrafa levantó la cámara frente al volcán', 'la', [['cámara', '📷', 'camera'], ['volcán', '🌋', 'mountains'], ['fotógrafa', '👩', 'user']], true],
  ['Nosotros escuchamos la guitarra junto al fuego', 'nosotros', [['guitarra', '🎸', 'music-note'], ['fuego', '🔥', 'fire'], ['música', '🎵', 'music-note']], true],
  ['Que el imán atraiga la pieza explica el mecanismo', 'que', [['imán', '🧲', 'magnet'], ['pieza', '🧩', 'widget'], ['mecanismo', '⚙️', 'settings']], true],
  ['Se abrió una farmacia detrás del mercado', 'se', [['farmacia', '⚕️', 'health'], ['mercado', '🏪', 'shop'], ['medicina', '💊', 'medicine']], true],
  ['Vas a ver el telescopio apuntando a Saturno', 'vas', [['telescopio', '🔭', 'telescope'], ['Saturno', '🪐', 'planet'], ['noche', '🌙', 'moon']], true],
  ['La maestra dibujó un átomo sobre la pizarra', 'la', [['maestra', '👩‍🏫', 'user'], ['átomo', '⚛️', 'atom'], ['pizarra', '🖊️', 'pen']], true],
  ['Como una llave, la contraseña abrió el sistema', 'como', [['llave', '🔑', 'key'], ['contraseña', '🔐', 'lock'], ['sistema', '💻', 'monitor']], true],
  ['El pan salió del horno y llenó la cocina', 'el', [['pan', '🍞', 'bread'], ['horno', '♨️', 'fire'], ['cocina', '🍳', 'chef-hat']], true],
  ['Por la ventana vimos caer la nieve', 'por', [['ventana', '🪟', 'window'], ['nieve', '❄️', 'snowflake'], ['invierno', '⛄', 'snowflake']], true],
  ['Tiene una brújula pero todavía busca dirección', 'tiene', [['brújula', '🧭', 'compass'], ['dirección', '📍', 'map-point'], ['camino', '🛣️', 'map']], true],
  ['El violinista recibió una medalla al terminar', 'el', [['violín', '🎻', 'music-note'], ['medalla', '🏅', 'medal'], ['músico', '🧑', 'user']], true],
  ['Una científica observó ADN en el laboratorio', 'una', [['científica', '👩‍🔬', 'user'], ['ADN', '🧬', 'dna'], ['laboratorio', '🧪', 'test-tube']], true],
  ['Y entonces la bicicleta quedó junto al puente', 'y', [['bicicleta', '🚲', 'bicycle'], ['puente', '🌉', 'bridge'], ['río', '🌊', 'water']], true],
  ['La relación entre ambos argumentos sigue siendo ambigua', 'relación', [], false],
  ['Eso fue importante por razones difíciles de resumir', 'importante', [], false],
  ['El proceso continúa aunque todavía no sepamos cómo', 'proceso', [], false],
  ['Quizá todo dependa de una contradicción interna', 'todo', [], false],
]

const PRODUCTION_RETRIEVAL_HOLDOUT_V2 = Object.freeze(rows.map((row, index) => Object.freeze({
  id: `dfinal-holdout-${String(index + 1).padStart(3, '0')}`,
  localText: row[0],
  textKeyword: row[1],
  concepts: Object.freeze(row[2].map(([label, emoji, canonicalHint]) => Object.freeze({ label, emoji, canonicalHint }))),
  requiresVisualAnchor: row[3],
})))

if (PRODUCTION_RETRIEVAL_HOLDOUT_V2.length !== 24) throw new Error('D-Final holdout debe permanecer congelado en 24 escenas')

module.exports = { PRODUCTION_RETRIEVAL_HOLDOUT_V2 }
