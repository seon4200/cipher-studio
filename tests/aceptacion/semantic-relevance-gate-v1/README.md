# Semantic Relevance Gate V1 — caso real reconstruido

Reconstruido ANTES de escribir el gate, desde traza de produccion persistida.
No es una hipotesis: cada dato de abajo sale de un fichero del repositorio o de
una consulta de solo lectura a la API publica de Pixabay.

## Origen

- Proyecto real: `cipher-studio/proyectos/dfgdfg-1789093808740`
- Diagnostico: `materiales/diagnostics/visual-decisions/visual-decisions-1789094291881-ab998655-9d1d-4b3f-b903-fc66bc8a5121.json`
- Manifiesto: `materiales/assets/manifest.json`
- Escena: `visual-2:1`
- Narracion: *"desperanza. Trabajar en tecnologia y en particular, la inteligencia
  artificial es visto por las generaciones"*

## Lo que decidio la app

| Slot | Concepto | Proveedor | Identidad | Score | Veredicto humano |
|---|---|---|---|---|---|
| hero | `tecnologia` | solar | `monitor-bold-duotone` | 3 | **defendible** |
| support-1 | `desperanza` | pixabay-images | `734af7ee…` (id 1511604) | 2 | **incorrecto** |
| support-2 | `trabajar` | pixabay-images | `718cf12f…` (id 2696823) | 3 | **relleno** |

El Hero defendible NO vino de retrieval V15 (`retrievalCandidates: []`) sino de una
metafora declarada por el resolver V1: `selectedMetaphor: "technology-computer"`,
`SOLAR_RESOLVED:exacto`. Es una correspondencia **curada por el sistema**, no una
coincidencia de metadata de terceros. El gate debe conservarla.

## Que son realmente esas dos imagenes

Consulta de solo lectura a la API publica de Pixabay (un GET por id, sin enviar
ningun dato del usuario), para recuperar los tags que la traza no persistio:

- **1511604** — *"arbol, fantasia, escalera de caracol, cuento de hadas, sin hojas,
  deshojado, arte digital, aislado, treehouse"*
  Ilustracion de un arbol de fantasia con una escalera de caracol.
- **2696823** — *"nube de palabra, las manos, bienestar de los animales, refugio de
  animales, aislado, mano, ayuda, apoyo, donacion, a traves de, esperanza,
  presentacion, humano, patria, animal, animales, amor, tiempo, trabajar como
  voluntario, mantenimiento, vigilar, seguridad, informacion, gente, personal,
  estar de pie"*
  Nube de palabras sobre proteccion animal.

Ninguna de las dos tiene relacion con tecnologia ni con inteligencia artificial.

## Por que pasaron el filtro — mecanismo exacto

`src/main/assets/pixabay-images.ts` `candidateFromHit`:

```ts
const target   = words(plan.query).filter(word => word !== 'isolated')
const tagWords = new Set(tags.flatMap(words))
const matching = target.filter(word => tagWords.has(word)).length
const score = matching === target.length && target.length
    ? levelScore(plan.level) : matching ? 2 : 1
```

`buildPixabayImageSearchPlansV1` decora la query con `isolated` en ingles y con
**`aislado` en espanol**. El filtro `word !== 'isolated'` es **ciego al idioma**:
elimina la decoracion inglesa y deja pasar la espanola al `target`.

- Concepto `desperanza` -> query `"desperanza. aislado"` -> `target = [desperanza, aislado]`.
  Los tags de 1511604 contienen **`aislado`** -> `matching = 1` -> rama `matching ? 2 : 1`
  -> **score 2** -> supera el umbral `>= 2` -> **aceptado como Support**.
- Concepto `trabajar` -> query `"trabajar aislado"` -> `target = [trabajar, aislado]`.
  Los tags de 2696823 contienen **`aislado`** y **`trabajar`** (dentro de
  *"trabajar como voluntario"*) -> `matching = 2 = target.length`
  -> **score 3, el maximo posible** -> **aceptado como Support**.

Es decir: **la imagen fue admitida por coincidir con el adorno de la busqueda, no
con el concepto.** Y en el segundo caso el adorno mas una coincidencia de token en
la posicion 19 de 25 produjeron la puntuacion maxima.

## Correccion al analisis previo

La Fase 1 supuso que el fallo era "una etiqueta suelta del dominio vale EXACT"
(p. ej. un gato etiquetado `technology`). El mecanismo real es mas basico:

1. `localSemantic.concepts` llego **vacio**: sin conceptos estructurados, el
   sistema cayo a tokens crudos del transcript (`desperanza.` con punto incluido,
   y el verbo `Trabajar`). `weakTokenShadowedByStructuredConcept` no protegio
   porque exige que **otro** rol tenga evidencia `direct-timed-concept`, y los
   tres roles eran `direct-timed-token`.
2. Esos tokens basura se buscaron literalmente en Pixabay, en espanol.
3. La decoracion `aislado` hizo de puente entre una query sin sentido y cualquier
   foto de stock.

La conclusion de diseno no cambia, se refuerza: hay que medir **que proporcion de
la evidencia del candidato pertenece al concepto**, comparando terminos del
concepto contra descriptores del candidato — **nunca palabras de la query contra
tags**, porque la query lleva adornos que no significan nada.
