import { canonicalNarrativeTerm } from './asset-intent'
import type { VisualConceptSubjectV1 } from './visual-concepts'
import { narrativeTermFormsV1 } from './narrative-term-forms'

/** A bounded ES/EN lexical layer for retrieval, never a scene-to-asset lookup table. */
export const CONCEPT_LEXICON_VERSION = 1 as const

export type ConceptExpansionLevelV1 = 'exact' | 'synonym' | 'related' | 'context'
export type ConceptProviderBiasV1 = 'openmoji' | 'solar' | 'pixabay-images' | 'editorial'

export type ConceptLexiconEntryV1 = {
  id: string
  canonical: string
  subject: VisualConceptSubjectV1
  providerBias: ConceptProviderBiasV1
  synonyms: readonly string[]
  related: readonly string[]
  context: readonly string[]
  emoji: readonly string[]
  solarBases: readonly string[]
  pixabayTerms: readonly string[]
}

export type ConceptLexiconExpansionV1 = {
  entry: ConceptLexiconEntryV1
  term: string
  level: ConceptExpansionLevelV1
}

function entry(
  canonical: string,
  subject: VisualConceptSubjectV1,
  providerBias: ConceptProviderBiasV1,
  synonyms: readonly string[] = [],
  related: readonly string[] = [],
  context: readonly string[] = [],
  emoji: readonly string[] = [],
  solarBases: readonly string[] = [],
  pixabayTerms: readonly string[] = [],
): ConceptLexiconEntryV1 {
  const normalized = canonicalNarrativeTerm(canonical)
  return Object.freeze({
    id: normalized.replace(/\s+/g, '-'), canonical: normalized, subject, providerBias,
    synonyms: Object.freeze([...new Set(synonyms.map(canonicalNarrativeTerm).filter(Boolean))]),
    related: Object.freeze([...new Set(related.map(canonicalNarrativeTerm).filter(Boolean))]),
    context: Object.freeze([...new Set(context.map(canonicalNarrativeTerm).filter(Boolean))]),
    emoji: Object.freeze([...new Set(emoji.map(value => value.normalize('NFC')).filter(Boolean))]),
    solarBases: Object.freeze([...new Set(solarBases.map(canonicalNarrativeTerm).filter(Boolean))]),
    pixabayTerms: Object.freeze([...new Set((pixabayTerms.length ? pixabayTerms : [canonical]).map(canonicalNarrativeTerm).filter(Boolean))]),
  })
}

/*
 * This is a lexicon of reusable concepts, not a corpus of scenes.  Every row is bidirectional:
 * Spanish and English terms resolve to one canonical concept, and related/context terms remain
 * intentionally weaker than exact or synonym evidence.
 */
export const CONCEPT_LEXICON_V1: readonly ConceptLexiconEntryV1[] = Object.freeze([
  entry('airplane', 'object', 'openmoji', ['avion', 'avión', 'plane', 'aircraft', 'airliner'], ['jet'], ['flight', 'vuelo'], ['✈', '✈️'], ['airplane'], ['airplane', 'aircraft']),
  entry('bridge', 'place', 'openmoji', ['puente', 'footbridge', 'suspension bridge', 'crossing'], ['viaduct'], ['cross'], [], ['bridge'], ['bridge', 'suspension bridge']),
  entry('police officer', 'person', 'editorial', ['policia', 'policía', 'officer', 'police'], ['law enforcement'], ['security'], ['👮', '👮‍♀️', '👮‍♂️'], ['police'], ['police officer']),
  entry('construction worker', 'person', 'editorial', ['trabajador', 'trabajadores', 'worker', 'laborer', 'builder', 'obrero'], ['construction worker'], ['labor'], ['👷', '👷‍♀️', '👷‍♂️'], ['user'], ['construction worker']),
  entry('building construction', 'event', 'openmoji', ['construccion', 'construcción', 'construir', 'obras', 'construction'], ['building site'], ['development'], ['🏗', '🏗️'], [], ['building construction']),
  entry('football', 'object', 'openmoji', ['futbol', 'fútbol', 'soccer', 'soccer ball'], ['stadium', 'match'], ['sports'], ['⚽'], [], ['soccer ball', 'football stadium']),
  entry('stadium', 'place', 'openmoji', ['estadio', 'stadiums', 'arena'], ['sports venue'], ['match'], ['🏟', '🏟️'], ['stadium'], ['stadium']),
  entry('protest', 'event', 'openmoji', ['protesta', 'protestas', 'demonstration', 'rally', 'march', 'manifestacion', 'manifestación'], ['flag', 'megaphone'], ['politics'], ['✊', '📣'], ['flag'], ['protest crowd']),
  entry('money', 'symbol', 'solar', ['dinero', 'cash', 'currency', 'economia', 'economía'], ['coin', 'wallet'], ['finance'], ['💰', '💵', '💸'], ['wallet'], ['money', 'cash']),
  entry('clock', 'symbol', 'solar', ['reloj', 'time', 'tiempo', 'watch', 'stopwatch'], ['hourglass', 'calendar'], ['duration'], ['🕐', '⏱', '⏰'], ['clock', 'stopwatch'], ['clock']),
  entry('water', 'object', 'openmoji', ['agua', 'water drop', 'drop', 'droplet'], ['river', 'ocean'], ['rain'], ['💧', '🌊'], [], ['water splash']),
  entry('fire', 'event', 'openmoji', ['incendio', 'fuego', 'flame'], ['fire truck'], ['emergency'], ['🔥'], ['fire'], ['fire']),
  entry('nature', 'object', 'openmoji', ['naturaleza', 'natural', 'environment'], ['forest', 'tree', 'leaf'], ['ecology'], ['🌿'], ['leaf'], ['nature forest']),
  entry('hospital', 'place', 'openmoji', ['hospitales', 'medical center', 'clinic'], ['medicine'], ['health'], ['🏥'], ['hospital'], ['hospital']),
  entry('computer', 'object', 'openmoji', ['computadora', 'ordenador', 'desktop computer', 'pc'], ['laptop', 'monitor'], ['technology'], ['🖥', '💻'], ['monitor'], ['computer']),
  entry('mobile phone', 'object', 'openmoji', ['telefono', 'teléfono', 'telephone', 'phone', 'smartphone'], ['call'], ['communication'], ['📱', '☎️'], [], ['mobile phone']),
  entry('scientist', 'person', 'editorial', ['cientifico', 'científico', 'researcher'], ['laboratory', 'microscope'], ['science'], ['🧑‍🔬', '👩‍🔬', '👨‍🔬'], ['test-tube'], ['scientist laboratory']),
  entry('planet', 'symbol', 'solar', ['planeta', 'world', 'earth', 'globe'], ['space', 'satellite'], ['universe'], ['🌍', '🪐'], ['planet'], ['planet earth']),
  entry('flag', 'symbol', 'solar', ['bandera', 'banner'], ['country flag'], ['national'], ['🚩', '🏳️'], ['flag'], ['flag']),
  entry('mexico', 'place', 'openmoji', ['méxico', 'mexicanos', 'mexican', 'flag mexico', 'mexico flag'], [], ['country'], ['🇲🇽'], [], ['mexico flag']),
  entry('train', 'object', 'openmoji', ['tren', 'railway', 'locomotive'], ['subway'], ['transport'], ['🚆', '🚇'], ['tram'], ['train']),
  entry('ship', 'object', 'openmoji', ['barco', 'buque', 'boat', 'vessel'], ['sailboat', 'ferry'], ['sea'], ['🚢', '⛵'], ['ship'], ['ship']),
  entry('bicycle', 'object', 'openmoji', ['bicicleta', 'bike', 'cycle'], ['cycling'], ['transport'], ['🚲'], ['bicycle'], ['bicycle']),
  entry('car', 'object', 'openmoji', ['coche', 'auto', 'automovil', 'automóvil', 'vehicle'], ['taxi', 'traffic'], ['transport'], ['🚗'], ['car'], ['car']),
  entry('ambulance', 'object', 'openmoji', ['ambulancia', 'emergency vehicle'], ['hospital'], ['emergency'], ['🚑'], ['ambulance'], ['ambulance']),
  entry('school', 'place', 'openmoji', ['escuela', 'college', 'classroom'], ['education'], ['learning'], ['🏫'], ['square-academic-cap'], ['school']),
  entry('book', 'object', 'openmoji', ['libro', 'books', 'notebook'], ['document'], ['reading'], ['📖', '📚'], ['book'], ['book']),
  entry('camera', 'object', 'openmoji', ['camara', 'cámara', 'photograph', 'photo'], ['video camera'], ['media'], ['📷', '📹'], ['camera'], ['camera']),
  entry('microphone', 'object', 'openmoji', ['microfono', 'micrófono', 'mic'], ['podcast'], ['audio'], ['🎤'], ['microphone'], ['microphone']),
  entry('music', 'symbol', 'solar', ['musica', 'música', 'song', 'melody'], ['headphones', 'speaker'], ['audio'], ['🎵', '🎶'], ['music-note'], ['music']),
  entry('forest', 'place', 'openmoji', ['bosque', 'woods', 'jungle'], ['tree'], ['nature'], ['🌲'], ['tree'], ['forest']),
  entry('tree', 'object', 'openmoji', ['arbol', 'árbol', 'trees'], ['forest'], ['nature'], ['🌳', '🌴'], ['tree'], ['tree']),
  entry('flower', 'object', 'openmoji', ['flor', 'flowers', 'blossom'], ['plant'], ['nature'], ['🌸', '🌼'], ['flower'], ['flower']),
  entry('dog', 'object', 'openmoji', ['perro', 'dogs', 'puppy'], ['pet'], ['animal'], ['🐶'], ['dog'], ['dog']),
  entry('cat', 'object', 'openmoji', ['gato', 'cats', 'kitten'], ['pet'], ['animal'], ['🐱'], ['cat'], ['cat']),
  entry('fish', 'object', 'openmoji', ['pez', 'peces', 'fishing'], ['ocean'], ['animal'], ['🐟', '🎣'], ['fish'], ['fish']),
  entry('bird', 'object', 'openmoji', ['pajaro', 'pájaro', 'birds'], ['flight'], ['animal'], ['🐦'], ['bird'], ['bird']),
  entry('sun', 'symbol', 'solar', ['sol', 'sunshine'], ['weather'], ['day'], ['☀', '☀️'], ['sun'], ['sun']),
  entry('moon', 'symbol', 'solar', ['luna', 'moonlight'], ['night'], ['space'], ['🌙'], ['moon'], ['moon']),
  entry('star', 'symbol', 'solar', ['estrella', 'stars'], ['sparkles'], ['space'], ['⭐', '✨'], ['star'], ['star']),
  entry('rain', 'event', 'openmoji', ['lluvia', 'rainfall'], ['cloud rain'], ['weather'], ['🌧', '☔'], ['cloud-rain'], ['rain']),
  entry('snow', 'event', 'openmoji', ['nieve', 'snowfall'], ['winter'], ['weather'], ['❄️'], ['snowflake'], ['snow']),
  entry('mountain', 'place', 'openmoji', ['montaña', 'montana', 'mountains'], ['hiking'], ['nature'], ['⛰', '🏔'], ['mountains'], ['mountain']),
  entry('beach', 'place', 'openmoji', ['playa', 'coast', 'shore'], ['ocean'], ['travel'], ['🏖', '🏝'], ['water'], ['beach']),
  entry('house', 'place', 'openmoji', ['casa', 'home', 'housing'], ['building'], ['life'], ['🏠', '🏡'], ['home'], ['house']),
  entry('building', 'place', 'openmoji', ['edificio', 'edificios', 'buildings'], ['architecture'], ['city'], ['🏢'], ['buildings'], ['building']),
  entry('factory', 'place', 'openmoji', ['fabrica', 'fábrica', 'industrial plant'], ['industry'], ['work'], ['🏭'], ['buildings'], ['factory']),
  entry('church', 'place', 'openmoji', ['iglesia', 'temple', 'cathedral'], ['religious building'], ['religion'], ['⛪'], ['buildings'], ['church']),
  entry('market', 'place', 'openmoji', ['mercado', 'store', 'shop'], ['shopping'], ['commerce'], ['🏪'], ['shop'], ['market']),
  entry('food', 'object', 'openmoji', ['comida', 'meal', 'cuisine'], ['restaurant'], ['eating'], ['🍽'], ['chef-hat'], ['food']),
  entry('bread', 'object', 'openmoji', ['pan', 'loaf'], ['bakery'], ['food'], ['🍞'], ['bread'], ['bread']),
  entry('coffee', 'object', 'openmoji', ['cafe', 'café', 'cup coffee'], ['tea'], ['drink'], ['☕'], ['cup'], ['coffee']),
  entry('beer', 'object', 'openmoji', ['cerveza', 'alcohol', 'beer mug'], ['bar'], ['drink'], ['🍺'], ['beer'], ['beer']),
  entry('birthday cake', 'object', 'openmoji', ['pastel', 'torta', 'cumpleanos', 'cumpleaños', 'cake'], ['birthday'], ['celebration'], ['🎂'], ['cup'], ['birthday cake']),
  entry('medicine', 'object', 'openmoji', ['medicina', 'medical', 'pill'], ['hospital'], ['health'], ['💊'], ['medicine'], ['medicine']),
  entry('vaccine', 'object', 'openmoji', ['vacuna', 'vaccination', 'syringe'], ['medicine'], ['health'], ['💉'], ['syringe'], ['vaccine']),
  entry('magnifying glass', 'object', 'openmoji', ['lupa', 'evidencia', 'investigacion', 'investigación'], ['search'], ['evidence'], ['🔍'], ['magnifer'], ['magnifying glass']),
  entry('map', 'symbol', 'solar', ['mapa', 'map'], ['location'], ['direction'], ['🗺', '📍'], ['map'], ['map']),
  entry('compass', 'symbol', 'solar', ['brujula', 'brújula', 'direccion', 'dirección'], ['navigation'], ['direction'], ['🧭'], ['compass'], ['compass']),
  entry('calendar', 'symbol', 'solar', ['calendario', 'date', 'year'], ['schedule'], ['time'], ['📅'], ['calendar'], ['calendar']),
  entry('document', 'symbol', 'solar', ['documento', 'paper', 'report'], ['file'], ['evidence'], ['📄'], ['document'], ['document']),
  entry('key', 'object', 'openmoji', ['llave', 'keys'], ['lock'], ['access'], ['🔑'], ['key'], ['key']),
  entry('lock', 'symbol', 'solar', ['candado', 'locked'], ['security'], ['privacy'], ['🔒'], ['lock'], ['lock']),
  entry('heart', 'symbol', 'solar', ['corazon', 'corazón', 'love'], ['emotion'], ['care'], ['❤', '❤️'], ['heart'], ['heart']),
  entry('eye', 'symbol', 'solar', ['ojo', 'vision', 'visión'], ['look'], ['observation'], ['👁', '👀'], ['eye'], ['eye']),
  entry('hand', 'object', 'openmoji', ['mano', 'hands'], ['gesture'], ['action'], ['✋', '🤝'], ['hand'], ['hand']),
  entry('lightbulb', 'symbol', 'solar', ['bombilla', 'idea', 'light bulb'], ['innovation'], ['thinking'], ['💡'], ['lightbulb'], ['light bulb']),
  entry('rocket', 'object', 'openmoji', ['cohete', 'launch'], ['space'], ['progress'], ['🚀'], ['rocket'], ['rocket']),
  entry('astronaut', 'person', 'openmoji', ['astronauta', 'space traveler'], ['space'], ['universe'], ['🧑‍🚀'], ['astronaut'], ['astronaut']),
  entry('satellite', 'object', 'openmoji', ['satelite', 'satélite'], ['spacecraft'], ['space'], ['🛰'], ['satellite'], ['satellite']),
  entry('robot', 'object', 'openmoji', ['robot', 'android'], ['automation'], ['technology'], ['🤖'], ['robot'], ['robot']),
  entry('internet', 'symbol', 'solar', ['internet', 'web', 'network'], ['wifi', 'link'], ['technology'], ['🌐'], ['global'], ['internet network']),
  entry('data', 'symbol', 'solar', ['datos', 'database', 'information'], ['chart', 'server'], ['technology'], ['💾'], ['database'], ['data visualization']),
  entry('chart', 'symbol', 'solar', ['grafico', 'gráfico', 'graph', 'statistics'], ['trend'], ['data'], ['📈', '📊'], ['chart'], ['chart']),
  entry('coin', 'object', 'openmoji', ['moneda', 'coins'], ['money'], ['finance'], ['🪙'], ['coin'], ['coin']),
  entry('bank', 'place', 'solar', ['banco', 'banking'], ['money'], ['finance'], ['🏦'], ['buildings'], ['bank']),
  entry('wallet', 'object', 'solar', ['billetera', 'cartera'], ['money'], ['finance'], ['👛'], ['wallet'], ['wallet']),
  entry('cloud', 'symbol', 'solar', ['nube', 'clouds'], ['weather'], ['sky'], ['☁️'], ['cloud'], ['cloud']),
  entry('lightning', 'event', 'openmoji', ['rayo', 'lightning bolt'], ['storm'], ['weather'], ['⚡'], ['bolt'], ['lightning']),
  entry('wind', 'event', 'openmoji', ['viento', 'air current'], ['weather'], ['air'], ['🌬'], ['wind'], ['wind']),
  entry('seedling', 'object', 'openmoji', ['brote', 'semilla', 'growth'], ['leaf'], ['nature'], ['🌱'], ['leaf'], ['seedling']),
  entry('leaf', 'object', 'openmoji', ['hoja', 'leaves'], ['plant'], ['nature'], ['🍃'], ['leaf'], ['leaf']),
  entry('telescope', 'object', 'solar', ['telescopio', 'observatory'], ['astronomy'], ['science'], ['🔭'], ['telescope'], ['telescope']),
  entry('microscope', 'object', 'openmoji', ['microscopio', 'laboratory microscope'], ['science'], ['research'], ['🔬'], ['microscope'], ['microscope']),
  entry('laboratory', 'place', 'solar', ['laboratorio', 'lab'], ['science'], ['research'], ['🧪'], ['test-tube'], ['laboratory']),
  entry('graduation cap', 'object', 'openmoji', ['graduacion', 'graduación', 'degree'], ['education'], ['school'], ['🎓'], ['square-academic-cap'], ['graduation cap']),
  entry('pencil', 'object', 'solar', ['lapiz', 'lápiz', 'pen'], ['writing'], ['document'], ['✏️'], ['pen'], ['pencil']),
  entry('scissors', 'object', 'openmoji', ['tijeras', 'cut'], ['craft'], ['document'], ['✂️'], ['scissors'], ['scissors']),
  entry('hammer', 'object', 'openmoji', ['martillo', 'tool'], ['construction'], ['work'], ['🔨'], ['hammer'], ['hammer']),
  entry('gear', 'symbol', 'solar', ['engranaje', 'settings'], ['mechanism'], ['technology'], ['⚙️'], ['settings'], ['gear']),
  entry('scale', 'symbol', 'solar', ['balanza', 'scales', 'justice'], ['law'], ['balance'], ['⚖️'], ['scale'], ['balance scale']),
  entry('warning', 'symbol', 'solar', ['advertencia', 'warning sign', 'alert'], ['danger'], ['risk'], ['⚠️'], ['danger'], ['warning']),
  entry('shield', 'symbol', 'solar', ['escudo', 'protection'], ['security'], ['safety'], ['🛡️'], ['shield'], ['shield']),
  entry('traffic light', 'object', 'openmoji', ['semaforo', 'semáforo', 'traffic signal'], ['road'], ['transport'], ['🚦'], ['traffic'], ['traffic light']),
  entry('map pin', 'symbol', 'solar', ['ubicacion', 'ubicación', 'location pin'], ['place'], ['map'], ['📍'], ['map-point'], ['map pin']),
  entry('message', 'symbol', 'solar', ['mensaje', 'chat', 'conversation'], ['speech bubble'], ['communication'], ['💬'], ['chat-round'], ['message']),
  entry('email', 'symbol', 'solar', ['correo', 'email', 'mail'], ['message'], ['communication'], ['✉️'], ['letter'], ['email']),
  entry('shopping cart', 'object', 'openmoji', ['carrito', 'shopping', 'purchase'], ['market'], ['commerce'], ['🛒'], ['cart'], ['shopping cart']),
  entry('gift', 'object', 'openmoji', ['regalo', 'present'], ['celebration'], ['party'], ['🎁'], ['gift'], ['gift']),
  entry('celebration', 'event', 'openmoji', ['celebracion', 'celebración', 'party', 'cheering', 'party popper'], ['confetti', 'gift'], ['event'], ['🎉', '🥳'], [], ['celebration confetti']),
  entry('headphones', 'object', 'solar', ['audifonos', 'audífonos', 'headset'], ['music'], ['audio'], ['🎧'], ['headphones'], ['headphones']),
  entry('speaker', 'object', 'solar', ['altavoz', 'speaker'], ['sound'], ['audio'], ['🔊'], ['volume'], ['speaker']),
  entry('battery', 'object', 'solar', ['bateria', 'batería', 'power'], ['energy'], ['technology'], ['🔋'], ['battery'], ['battery']),
  entry('plug', 'object', 'solar', ['enchufe', 'plug'], ['electricity'], ['energy'], ['🔌'], ['plug'], ['plug']),
  entry('wifi', 'symbol', 'solar', ['wifi', 'wi fi', 'wireless'], ['internet'], ['network'], ['📶'], ['wifi-router'], ['wifi']),
  entry('film', 'object', 'openmoji', ['pelicula', 'película', 'movie', 'cinema'], ['video'], ['media'], ['🎬'], ['video-frame'], ['film']),
  entry('newspaper', 'object', 'openmoji', ['periodico', 'periódico', 'news'], ['journalism'], ['media'], ['📰'], ['document'], ['newspaper']),
])

function levelFor(entry: ConceptLexiconEntryV1, term: string): ConceptExpansionLevelV1 | null {
  // Emoji are deliberately not passed through canonicalNarrativeTerm(): that normalizer
  // is text-only and removes Unicode pictographs.  Direct emoji evidence therefore has
  // to be checked against its NFC form before normalizing narrative text.
  const raw = term.trim().normalize('NFC')
  if (entry.emoji.some(value => value === raw)) return 'exact'
  const normalized = canonicalNarrativeTerm(term)
  if (!normalized) return null
  if (normalized === entry.canonical) return 'exact'
  const forms = narrativeTermFormsV1(normalized)
  if (forms.some(form => form === entry.canonical || entry.synonyms.includes(form))) return 'synonym'
  if (forms.some(form => entry.related.includes(form))) return 'related'
  if (forms.some(form => entry.context.includes(form))) return 'context'
  return null
}

const LEVEL_WEIGHT: Record<ConceptExpansionLevelV1, number> = { exact: 0, synonym: 1, related: 2, context: 3 }

/** Resolves a literal ES/EN term; partial/token fuzzy matching is intentionally not used. */
export function expandConceptLexiconV1(term: unknown): readonly ConceptLexiconExpansionV1[] {
  if (typeof term !== 'string' || !term.trim()) return []
  return CONCEPT_LEXICON_V1
    .map(entry => ({ entry, level: levelFor(entry, term) }))
    .filter((value): value is { entry: ConceptLexiconEntryV1; level: ConceptExpansionLevelV1 } => !!value.level)
    .sort((a, b) => LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level] || a.entry.canonical.localeCompare(b.entry.canonical, 'en'))
    .map(value => ({ entry: value.entry, term: String(term).trim(), level: value.level }))
}

export function expandLexiconTermsV1(entry: ConceptLexiconEntryV1, maxLevel: ConceptExpansionLevelV1 = 'related'): readonly string[] {
  const allowed = LEVEL_WEIGHT[maxLevel]
  const groups: Array<[ConceptExpansionLevelV1, readonly string[]]> = [
    ['exact', [entry.canonical]], ['synonym', entry.synonyms], ['related', entry.related], ['context', entry.context],
  ]
  return Object.freeze([...new Set(groups.filter(([level]) => LEVEL_WEIGHT[level] <= allowed)
    .flatMap(([, terms]) => terms).filter(Boolean))])
}

export function conceptLexiconEntryV1(canonical: unknown): ConceptLexiconEntryV1 | undefined {
  const normalized = canonicalNarrativeTerm(String(canonical ?? ''))
  return CONCEPT_LEXICON_V1.find(entry => entry.canonical === normalized)
}
