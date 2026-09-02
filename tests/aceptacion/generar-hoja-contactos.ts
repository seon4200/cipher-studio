import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ESTRUCTURAS, instanciaDe,
  type Direccion, type Parametros
} from '../../src/shared/escena'

// Corpus cerrado y versionado: sustantivos y conceptos breves en castellano, del mismo tipo
// que DeepSeek entrega como palabra de un Visual. No se descarga nada y el orden es parte de la
// busqueda: los empates se resuelven por la primera aparicion.
const PALABRAS = [
  'memoria', 'tiempo', 'ciudad', 'agua', 'libertad', 'historia', 'futuro', 'cambio',
  'energia', 'musica', 'familia', 'trabajo', 'mundo', 'verdad', 'poder', 'vida',
  'mente', 'cuerpo', 'luz', 'sombra', 'camino', 'viaje', 'lluvia', 'fuego',
  'tierra', 'aire', 'mar', 'montana', 'bosque', 'rio', 'oceano', 'espacio',
  'planeta', 'estrella', 'universo', 'ciencia', 'arte', 'cultura', 'sociedad', 'tecnologia',
  'educacion', 'salud', 'dinero', 'mercado', 'empresa', 'equipo', 'idea', 'sueno',
  'miedo', 'amor', 'paz', 'guerra', 'justicia', 'ley', 'orden', 'caos',
  'red', 'conexion', 'sistema', 'proceso', 'origen', 'destino', 'problema', 'solucion',
  'pregunta', 'respuesta', 'riesgo', 'oportunidad', 'crecimiento', 'caida', 'movimiento', 'equilibrio',
  'fuerza', 'velocidad', 'distancia', 'sonido', 'silencio', 'color', 'forma', 'imagen',
  'palabra', 'concepto', 'archivo', 'recuerdo', 'senal', 'mapa', 'ruta', 'puente',
  'puerta', 'ventana', 'casa', 'edificio', 'calle', 'barrio', 'jardin', 'comida',
  'cafe', 'libro', 'escuela', 'hospital', 'fabrica', 'oficina', 'pantalla', 'camara',
  'telefono', 'computadora', 'robot', 'animal', 'persona', 'infancia', 'comunidad', 'pais',
  'naturaleza', 'clima', 'tormenta', 'desierto', 'isla', 'playa', 'nube', 'noche',
  'dia', 'amanecer', 'atardecer', 'secreto', 'decision', 'estrategia', 'juego', 'regla',
  'ritmo', 'densidad', 'estructura', 'fondo', 'centro', 'borde', 'circulo', 'linea'
] as const

const IDENTIDAD: Direccion = {
  fondo: 'liso', estructura: 'constelacion', camara: 'quieto',
  densidad: 'media', ritmo: 'regular'
}
const CONTROL = 'memoria'
const UNICAS = 11

type Evaluada = { palabra: string; parametros: Parametros }
const evaluadas: Evaluada[] = PALABRAS.map(palabra => ({
  palabra,
  parametros: instanciaDe(palabra, IDENTIDAD).estructura
}))

const roles = new Map<string, string[]>()
const marcar = (palabra: string, rol: string) => {
  const lista = roles.get(palabra) ?? []
  lista.push(rol)
  roles.set(palabra, lista)
}

for (const rango of ESTRUCTURAS.constelacion.rangos) {
  const minimo = evaluadas.reduce((a, b) =>
    b.parametros[rango.id] < a.parametros[rango.id] ? b : a)
  const maximo = evaluadas.reduce((a, b) =>
    b.parametros[rango.id] > a.parametros[rango.id] ? b : a)
  marcar(minimo.palabra, `${rango.id}:min-alcanzable`)
  marcar(maximo.palabra, `${rango.id}:max-alcanzable`)
}

const elegidas: string[] = [...roles.keys()]
if (!elegidas.includes(CONTROL)) elegidas.push(CONTROL)
for (const palabra of PALABRAS) {
  if (elegidas.length >= UNICAS) break
  if (!elegidas.includes(palabra)) elegidas.push(palabra)
}
if (elegidas.length !== UNICAS) throw new Error(`se esperaban ${UNICAS} palabras unicas`)

const palabras = [...elegidas, CONTROL]
const casos = palabras.map((palabra, i) => {
  const instancia = instanciaDe(palabra, IDENTIDAD)
  return {
    casilla: i + 1,
    palabra,
    roles: roles.get(palabra) ?? (palabra === CONTROL ? ['control'] : ['relleno']),
    semillas: instancia.semillas,
    parametrosEstructura: instancia.estructura
  }
})

const primeraControl = palabras.indexOf(CONTROL) + 1
const fixture = {
  version: 1,
  composicion: 'visual_escena',
  identidad: IDENTIDAD,
  tiempoSegundos: 1.5,
  miniatura: { ancho: 162, alto: 288, escala: 0.15 },
  busqueda: {
    fuente: 'PALABRAS en tests/aceptacion/generar-hoja-contactos.ts',
    candidatas: PALABRAS.length,
    criterio: 'argmin y argmax alcanzables por cada rango de constelacion; empates por orden del corpus',
    palabrasUnicas: UNICAS
  },
  control: { palabra: CONTROL, casillas: [primeraControl, 12] },
  casos
}

const destino = resolve(process.cwd(), 'tests', 'aceptacion', 'fixtures', 'hoja-contactos-instancias.json')
writeFileSync(destino, JSON.stringify(fixture, null, 2) + '\n', 'utf8')
console.log(`Fixture escrito: ${destino}`)
console.log(`${PALABRAS.length} candidatas -> ${casos.length} casillas; control ${primeraControl} y 12`)
