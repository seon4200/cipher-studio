// Fixed retrieval corpus. Rows are concepts, never scene IDs or human-answer lookups.
// `expectedMode` says whether a concrete one-Hero V14 projection is currently appropriate.
const BENCHMARK_CONCEPTS_V1 = Object.freeze([
  ['avión', 'airplane', 'hero'], ['puente', 'bridge', 'hero'], ['policía', 'police officer', 'editorial'],
  ['trabajador', 'construction worker', 'editorial'], ['construcción', 'building construction', 'hero'],
  ['fútbol', 'football', 'hero'], ['estadio', 'stadium', 'hero'], ['protesta', 'protest', 'hero'],
  ['dinero', 'money', 'hero'], ['reloj', 'clock', 'hero'], ['agua', 'water', 'hero'], ['incendio', 'fire', 'hero'],
  ['naturaleza', 'nature', 'hero'], ['hospital', 'hospital', 'hero'], ['computadora', 'computer', 'hero'],
  ['teléfono', 'mobile phone', 'hero'], ['científico', 'scientist', 'editorial'], ['planeta', 'planet', 'hero'],
  ['bandera', 'flag', 'hero'], ['México', 'mexico', 'hero'], ['tren', 'train', 'hero'], ['barco', 'ship', 'hero'],
  ['bicicleta', 'bicycle', 'hero'], ['automóvil', 'car', 'hero'], ['ambulancia', 'ambulance', 'hero'],
  ['escuela', 'school', 'hero'], ['libro', 'book', 'hero'], ['cámara', 'camera', 'hero'],
  ['micrófono', 'microphone', 'hero'], ['música', 'music', 'hero'], ['bosque', 'forest', 'hero'],
  ['árbol', 'tree', 'hero'], ['flor', 'flower', 'hero'], ['perro', 'dog', 'hero'], ['gato', 'cat', 'hero'],
  ['pez', 'fish', 'hero'], ['pájaro', 'bird', 'hero'], ['sol', 'sun', 'hero'], ['luna', 'moon', 'hero'],
  ['estrella', 'star', 'hero'], ['lluvia', 'rain', 'hero'], ['nieve', 'snow', 'hero'], ['montaña', 'mountain', 'hero'],
  ['playa', 'beach', 'hero'], ['casa', 'house', 'hero'], ['edificio', 'building', 'hero'],
  ['fábrica', 'factory', 'hero'], ['iglesia', 'church', 'hero'], ['mercado', 'market', 'hero'],
  ['comida', 'food', 'hero'], ['pan', 'bread', 'hero'], ['café', 'coffee', 'hero'], ['cerveza', 'beer', 'hero'],
  ['pastel', 'birthday cake', 'hero'], ['medicina', 'medicine', 'hero'], ['vacuna', 'vaccine', 'hero'],
  ['lupa', 'magnifying glass', 'hero'], ['mapa', 'map', 'hero'], ['brújula', 'compass', 'hero'],
  ['calendario', 'calendar', 'hero'], ['documento', 'document', 'hero'], ['llave', 'key', 'hero'],
  ['candado', 'lock', 'hero'], ['corazón', 'heart', 'hero'], ['ojo', 'eye', 'hero'], ['mano', 'hand', 'hero'],
  ['bombilla', 'lightbulb', 'hero'], ['cohete', 'rocket', 'hero'], ['astronauta', 'astronaut', 'hero'],
  ['satélite', 'satellite', 'hero'], ['robot', 'robot', 'hero'], ['internet', 'internet', 'hero'],
  ['datos', 'data', 'hero'], ['gráfico', 'chart', 'hero'], ['moneda', 'coin', 'hero'], ['banco', 'bank', 'hero'],
  ['billetera', 'wallet', 'hero'], ['nube', 'cloud', 'hero'], ['rayo', 'lightning', 'hero'],
  ['viento', 'wind', 'hero'], ['brote', 'seedling', 'hero'], ['hoja', 'leaf', 'hero'],
  ['telescopio', 'telescope', 'hero'], ['microscopio', 'microscope', 'hero'], ['laboratorio', 'laboratory', 'hero'],
  ['graduación', 'graduation cap', 'hero'], ['lápiz', 'pencil', 'hero'], ['tijeras', 'scissors', 'hero'],
  ['martillo', 'hammer', 'hero'], ['engranaje', 'gear', 'hero'], ['balanza', 'scale', 'hero'],
  ['advertencia', 'warning', 'hero'], ['escudo', 'shield', 'hero'], ['semáforo', 'traffic light', 'hero'],
  ['ubicación', 'map pin', 'hero'], ['mensaje', 'message', 'hero'], ['correo', 'email', 'hero'],
  ['carrito', 'shopping cart', 'hero'], ['regalo', 'gift', 'hero'], ['celebración', 'celebration', 'hero'],
  ['audífonos', 'headphones', 'hero'], ['altavoz', 'speaker', 'hero'], ['batería', 'battery', 'hero'],
  ['enchufe', 'plug', 'hero'], ['wifi', 'wifi', 'hero'], ['película', 'film', 'hero'], ['periódico', 'newspaper', 'hero'],
].map(([term, canonical, expectedMode]) => Object.freeze({ term, canonical, expectedMode })))

if (BENCHMARK_CONCEPTS_V1.length < 100) throw new Error('El corpus V1 debe contener al menos 100 conceptos')

module.exports = { BENCHMARK_CONCEPTS_V1 }
