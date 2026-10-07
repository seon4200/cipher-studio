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

---

# Resultados

## CALIBRATION (21 casos, congelados antes de calibrar)

| | antes (regla de 88ee9ed) | despues (gate) |
|---|---|---|
| candidatos admitidos | 21 / 21 | 14 / 21 |
| admitidos que eran malos | 7 | **0** |
| BAD_ASSET_RATE | 0.333 | **0.000** |

Acuerdo con el veredicto de producto: **21/21 (1.000)**.
Clases: EXACT 2 · STRONG 8 · RELATED 4 · WEAK 0 · UNRELATED 7.

La regla anterior admitia **todos** los candidatos del corpus, incluidos los siete
conocidos como malos. Los siete quedan en UNRELATED con focus 0: no los rechaza un
umbral, los rechaza la ausencia total de descriptor coincidente.

## HOLDOUT (20 casos, conceptos disjuntos, congelado antes del primer run)

Barra declarada ANTES de ejecutarlo: 0.80 de acuerdo.

| | antes | despues |
|---|---|---|
| candidatos admitidos | 19 / 20 | 17 / 20 |
| admitidos que eran malos | 5 | 3 |
| BAD_ASSET_RATE | 0.263 | **0.176** |

Acuerdo: **17/20 = 0.850**. Tras observarlo no se ha tocado ningun umbral, regla,
lexicon ni scoring.

### Los tres fallos del holdout dicen todos lo mismo

`hold-bastante-puente`, `hold-resulta-calculadora` y `hold-mercado-modelo3d`.

Los dos primeros son **conceptos basura**: el adverbio *"bastante"* y la forma verbal
*"resulta"*, tomados como concepto. Pixabay devuelve imagenes literalmente etiquetadas
con esas palabras, y el gate —correctamente— dice que candidato y concepto coinciden.

**El gate comprueba si el candidato corresponde al concepto; no puede arreglar un
concepto que no deberia existir.** Es el mismo fallo de raiz que la reconstruccion de
arriba: con `localSemantic.concepts` vacio el sistema cae a tokens crudos del
transcript. Eso es seleccion de concepto, aguas arriba de esta fase.

### Sesgo observado hacia Hero

Cinco casos que se esperaban Support salieron Hero (`abeja-avispon`,
`ambulancia-historica`, `barco-grua`, `justicia-balanza`, `montana-pajaro`). Cuentan
como acuerdo —se admiten, que es la decision binaria que mide el holdout— pero indican
que el gate es mas generoso que el criterio editorial al repartir Hero vs Support.

## Estado de las suites de render historico

`test:v15-color-system-v1` caso 15 (*D-Final historico mantiene pixelDiff cero*) es
**inestable en la rama base**, antes de este cambio:

- base `88ee9ed` en solitario: 2 verdes / 2 rojas (diffs 7782 y 47854)
- con el gate en solitario: 3 verdes / 2 rojas (diffs **7782 y 47854**, identicos)

El gate no puede alcanzar ese render: el caso construye la SceneSpec con el helper de
fixture sobre assets OpenMoji publicados a mano, sin pasar por retrieval. Los valores
de fallo coinciden exactamente con los de la base.

`test:background-black-foundation-v1` en solitario: **4/4 verdes con
HISTORICAL_PIXEL_DIFF=0**; solo cae dentro de la pasada completa, igual que la anterior.

Suite completa con el gate: una pasada **26/26 verdes**, otras dos con una de esas dos
suites en rojo. Es inestabilidad de entorno preexistente en los dos tests de render
historico, no una regresion. No se arregla aqui: tocar el renderer esta fuera de fase.
