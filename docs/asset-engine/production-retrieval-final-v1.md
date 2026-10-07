# D-Final — recuperación productiva de iconos y assets

## Alcance

Este cierre corrige la selección y preparación de recursos antes del render. No cambia `MotionGraphicV15`, `VisualSceneSpecV2`, `RenderBindingsV2`, fondos, familias ni la forma de dibujar una SceneSpec existente. `VERSION_PLANTILLAS` permanece en 15.

Base: `e6aae78e399419417e029eca0d35490d9effd961`, rama `motion-graphics-productivo-v15`.

## Causa confirmada

`createVisualConceptSetV1` mezclaba la keyword textual, tokens pronunciados y conceptos estructurados sin preservar de forma inequívoca el origen de escena de estos últimos. Palabras funcionales o verbos genéricos podían ocupar los tres puestos y dejar fuera evidencias de DeepSeek del mismo subclip. Además, el primer concepto conservaba de facto la autoridad de Hero aunque un concepto posterior tuviera un recurso literal mejor.

## Autoridad corregida

La keyword editorial y la consulta visual son decisiones separadas. La recuperación aplica este orden:

1. concepto visual estructurado del mismo `visualClip`;
2. emoji o hint explícito de ese concepto;
3. concepto normalizado por `ConceptLexicon`;
4. token local visualmente significativo;
5. fallback léxico.

Los conceptos V15 creados por `createModernVisualGenerationContextV2` quedan marcados con `scope: "scene"`. El comportamiento temporal de contextos históricos sin scope sigue preservado. `visual-term-filter.ts` aporta stopwords españolas y una categoría reusable de términos genéricos; no altera el texto que aparece en pantalla.

Los términos de persona ya no implican editorial por sí solos. OpenMoji, Pixabay y un futuro adapter local pueden representarlos. El candidato defendible de `secondary` o `tertiary` puede ascender a Hero, con razón persistida. Los Supports materializados se normalizan a slots contiguos para que la ausencia de un concepto intermedio no produzca una SceneSpec inválida.

## OpenMoji y Solar

La búsqueda directa por emoji/hexcode/metadata local conserva prioridad. Un OpenMoji literal no pierde frente a un Solar de coincidencia débil. Todo OpenMoji nuevo compilado por V15 mantiene `treatment: "original-color"`; no se cambió el renderer ni la política cromática.

## Pixabay Images

El transporte usa `User-Agent: Cipher-Studio/15 Pixabay-Images/1.0`, máximo dos peticiones concurrentes, dos reintentos de 429 y `Retry-After` con espera máxima local de 2 s. Si el servidor exige más espera, no se reintenta antes de tiempo: se devuelve `HTTP_429` con `retryDeferred`.

Los resultados distinguen `HTTP_429`, `TIMEOUT`, `NETWORK_ERROR`, `NO_RESULTS`, `INVALID_RESPONSE` y `NO_USABLE_RESULT`. `ConceptLexicon.pixabayTerms` es la única evidencia para declarar inglés; una cadena ASCII española ya no se manda con `lang=en`. Ejemplos certificados:

- `mujer` → `woman isolated`, `woman portrait isolated`, `woman transparent`;
- `inteligencia artificial` → términos ingleses específicos del lexicón;
- un término sin entrada conserva consulta y `lang=es`.

`colors=transparent` sigue siendo preferencia. Magic bytes, MIME, dimensiones y alpha útil se verifican sobre los bytes descargados antes de publicar un `ProjectAsset` por SHA.

## Métricas

### Corpus real congelado de dos vídeos V15 (12 escenas)

| Métrica | Antes | Después |
|---|---:|---:|
| 0 assets | 10 | 1 |
| 1 asset | 1 | 1 |
| 2 assets | 1 | 0 |
| 3 assets | 0 | 10 |
| Hero | 2 | 11 |
| Supports | 1 | 20 |
| BAD_EDITORIAL | 10 | 1 |
| OpenMoji materializados | 3 | 30 |
| Solar materializados | 0 | 1 |
| Pixabay materializados | 0 | 0 |

La única escena real congelada todavía sin ancla es `hambre`, cuyo registro histórico no contiene conceptos estructurados. No se añadió una respuesta al lexicón después de observarla.

### Holdout original de 72

El fixture y su SHA permanecen intactos. Resultado antes y después: Top-1 `0/72`, Top-5 `5/72`, sin resultados `67/72`, ambiguos `2/72`. Este holdout lexical-only no contiene la evidencia estructurada que corrige D-Final y no fue usado para ampliar el lexicón.

### Segundo holdout, congelado antes de su primera ejecución

24 frases nuevas: 20 requerían ancla visual y 4 eran editoriales legítimas. Primera ejecución: Hero `20/20`, misses `0`, editorial legítimo `4/4`; distribución: 20 escenas con tres assets y 4 con cero; 58 elecciones OpenMoji y 2 Solar. Producción no se modificó después de ver este resultado. Los hashes de congelación normalizan CRLF/LF; el saneamiento final sólo retiró una línea vacía terminal y no alteró ninguna entrada ni respuesta.

## Pixabay en vivo y end-to-end

La sonda acotada real buscó `airplane isolated`, obtuvo 20 candidatos, descargó un único PNG seleccionado (`id=10365947`, 1280×1280, alpha útil), verificó SHA y lo publicó sólo en un proyecto temporal.

La aceptación productiva usa:

`semantic output → createVisualConceptSetV1 → retrieval/ranking → resolver → ProjectAsset → VisualSceneSpecV2 → RenderBindingsV2 → MotionGraphicV15 → QC → MP4`.

No construye SceneSpecs ni publica assets manualmente. Sus siete escenas produjeron seis Heroes y un editorial legítimo, 15 OpenMoji original-color, un raster Pixabay original-color y cero rechazos QC. El render bloquea red.

## Identidad y compatibilidad

No hay cambios en `src/renderer`, `visual-render.ts` ni los contratos V2. Dos renders de la misma SceneSpec produjeron la misma PixelIdentity y `pixelDiff=0`. Provider, URL, path, trace y errores de transporte continúan fuera de PixelIdentity.

## Evidencia

- `tests/fixtures/production-retrieval-real-v15.js`
- `tests/fixtures/production-retrieval-holdout-v2.js`
- `tests/production-retrieval-final.js`
- `tests/aceptacion/production-retrieval-final/evidence.json`
- `tests/aceptacion/production-retrieval-final/pixabay-live-probe.json`
- `tests/aceptacion/production-retrieval-final/production-retrieval-final.png`
- `tests/aceptacion/production-retrieval-final/production-retrieval-final.mp4`

## Veredictos

- `technicalVerdict = PASS`
- `productionRetrievalVerdict = PASS` para generación moderna con semántica estructurada del subclip.
- `pixabayVerdict = PASS`
- `visualVerdict = PENDING_HUMAN_REVIEW`

Deuda explícita: el holdout lexical-only de 72 sigue mostrando cobertura pobre sin conceptos/emoji estructurados. No se ocultó ni se convirtió en una expansión oportunista del lexicón.
