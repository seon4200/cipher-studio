# Integración editorial modular: seis familias

Revisión opt-in: `editorial-modular-families-v1` / `editorial-modular-families-2026-09-v1`. No modifica los perfiles IDEA V1–V4.1, Modular Catalog V1 ni las revisiones históricas de V15. La ausencia del perfil conserva el dispatch anterior. El perfil nuevo reutiliza `VisualSceneSpecV2`, `RenderBindingsV2`, `MotionGraphicV15`, `ProjectAsset` y la captura DPI-safe; no abre otro renderer.

## Autoridad y ruta

- El catálogo curado externo contiene 250 PNG aprobados técnicamente (150 Hero, 50 Support, 20 collage trasero, 15 delantero, 15 máscaras de acento). `CuratedModularCatalogV1` comprueba manifest y SHA antes de publicar cada recurso como `ProjectAsset`. Todos los IDs se pueden buscar por su palabra primaria; esto no certifica que todos combinen entre sí.
- En generación normal, `generate-timeline-assets` reutiliza la segmentación/semántica vigente, resuelve un candidato exacto de Hero y Supports de la escena, elige una familia elegible y congela su plan en `sceneSpec.editorialFamily`. Si no hay Hero exacto, usa `editorial` tipográfica; no añade iconos para rellenar. La variante `inverse` se usa ante un Hero ancho o texto largo en pausa editorial. La repetición inmediata entre `marcoPoster` y `cuaderno` se evita sólo cuando ambas son elegibles. No es un director narrativo completo.
- Las capas adicionales del catálogo carecen aún de compatibilidad Hero↔collage aprobada. La selección automática no las combina por índice o azar. Los 30 casos dirigidos sí fijan sus pares explícitos en el fixture, pendientes de revisión humana. Materializar/regenerar no requiere la ruta del inventario en `PixelIdentity`; el plan guarda IDs y SHA, geometría, color, entradas, relaciones y efectos visibles. Los bindings localizan archivos dentro del proyecto.
- En la UI se ofrecen perfil, familia/automático, acento de video y efectos apagados/sutiles; se guardan y restauran. Los controles de selección de recurso del viejo piloto modular existen, pero **todavía no sustituyen individualmente el Hero, Support o capa de un clip generado con este perfil**.

## Familias y gramáticas conectadas

| Familia | Uso opt-in | Restricción comprobable |
| --- | --- | --- |
| `marcoPoster` | Hero y titular dominante | Hero obligatorio; 0–4 Supports |
| `editorial` | Pausa de tipografía | sin Hero ni Supports ficticios |
| `partidoVertical` | Hero y campo explicativo lateral | Hero obligatorio; comparación visual no implica que existan dos objetos equivalentes |
| `cuaderno` | Objeto con anotaciones periféricas | Hero obligatorio |
| `constelacion` | Entidad y nodos | Hero y al menos dos Supports |
| `cascada` | Pasos sucesivos | Hero y al menos dos Supports |

Cada una tiene geometría 9:16 y 16:9, con variante `base`/`inverse`; `inverse` cambia la colocación y alineación, no refleja el raster. Las otras once familias V15 siguen disponibles históricamente pero **no están adaptadas** a este perfil.

Las once pendientes son `cintaDiagonal`, `anillosConcentricos`, `rayosImpacto`, `capasApiladas`, `redNodos`, `lineaTiempo`, `corteTransversal`, `abanicoTarjetas`, `engranajes`, `mundoIsometrico` y `pilaVertical`. No se cuentan como nuevas familias ni se les atribuye un render editorial de este bloque.

La composición mantiene papel marfil limpio, grid tenue o papel blanco suave; Fraunces variable (rango comprobado 100–900), DM Sans variable (100–1000) e IBM Plex Sans Condensed 400 local. El texto usa Text Fit V2 y permanece legible durante la fase estable. El Hero conserva RGB original; Supports usan máscara alfa, con tarjeta de papel, medallón oscuro, tile de acento o icono aislado. No se tintan piedra, metal o vidrio.

El grafo `relations` congela origen, destino, significado y ventana normalizada posterior al asentamiento de ambos extremos. `transfers` añade un token finito sobre una curva. El adaptador calcula anclas sobre el icono visible o tarjeta y considera el titular y los demás slots al escoger una curva. **La puntuación geométrica no es todavía un router con garantía matemática de ausencia de colisiones**, ni dispone de negociación con un plan de poses múltiples. Si la semántica no prueba causalidad, un selector futuro debe omitirla; el corpus dirigido sí describe relaciones revisadas para cada caso.

La cámara `quiet-drift` es un desplazamiento 2D muy breve del conjunto Hero/collage durante la entrada, no una vista 3D ni iluminación nueva. Texto y tarjetas quedan quietos en lectura. `dust` y `ticks` son marcas procedurales discretas con tiempo y cantidad congelados; no representan las partículas informativas observadas en la referencia. No hay simulación física.

## Referencia audiovisual inspeccionada

Se comprobó el MP4 local con SHA-256 `148cc9380fc279cc06bfc08d247d8c08f0a8827379d410ddfaab74e72eecec36`: 720×1280, 24 fps, 142,755 s. Se abrieron las hojas generales y de 4 fotogramas/s en 00:12–00:18, 00:52–01:01 y 01:30–01:35. Directamente se observan frases por partes, un objeto naranja que se redistribuye con iconos, selección 98→100 en la matriz humana, persistencia del elemento elegido, moneda que recorre una curva hacia una planta, y cambio de nodos humanos a robots con puntos en enlaces. Esos fotogramas **no prueban curvas de easing, capas internas ni sincronía con la voz**. La implementación adapta entrada escalonada, relación y token de transferencia al material marfil aprobado; no copia contenido, rostros ni cifras de la referencia.

## Evidencia y límites de certificación

El fixture `tests/aceptacion/editorial-modular-families-v1/corpus.cjs` define R01–R30 (cinco por familia). Es **cobertura dirigida**, no demostración de que el selector automático invente treinta relatos. `generar.cjs` usa el compositor/encoder real en un proyecto temporal, con 24 fps, duración dependiente de texto y número de Supports, ambos formatos, red bloqueada tras materialización y SHA por clip. Puede reanudar sin repetir un MP4 cuya identidad y SHA guardados coincidan; un cambio de código de render sin cambio de identidad exige `CASE_FORCE_RENDER=1` durante esta revisión. La carpeta externa de evidencia incluye MP4, PNG, JSON, galería offline y contactos; no se incluyen imágenes privadas ni todo el catálogo en Git.

`app-route.cjs` verifica proyecto temporal, guardar/reabrir, regeneración V3 del perfil y exportación del video desde el IPC real. `spoken-route.cjs` usa sólo un audio hablado y transcripción de una aceptación local anterior; verifica la exportación con pista de audio y límites de segmento, sin afirmar sincronía por palabra. Ninguna de estas pruebas llama a DeepSeek/TTS de pago; por ello **el tramo automático de guion libre antes de la semántica no queda certificado end-to-end**.

Pendiente antes de declarar completa la dirección para videos largos:

1. Editor por escena para sustituir Hero/Supports/collage con compatibilidad y preview, manteniendo la identidad del resto.
2. Poses y beats múltiples con objeto compartido a través del corte, con propiedad/fase persistidas; el montaje actual concatena clips independientes.
3. Router de Connector Semantics con exclusión formal de obstáculos, ruta alternativa/fallback y cabeza direccional inequívoca para todas las relaciones.
4. Política multiescena que use historia, densidad y recursos previos sin inventar relaciones; metadatos focales curados para los Heroes del corpus.
5. Prueba completa desde generación normal de guion+voz autorizada (sin servicios pagos añadidos), además del caso con audio local.

No se generaron imágenes nuevas. La calidad estética y la semejanza con la referencia requieren revisión humana de los montajes y de los clips individuales.
