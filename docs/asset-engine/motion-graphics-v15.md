# Motion Graphics productivo V15 — Ronda D

> Estado: puertas técnicas completas en `motion-graphics-productivo-v15`, sin
> merge, tag ni push. `visualVerdict=PENDING_HUMAN_REVIEW`.

## Base y alcance

La ronda parte exactamente de `754ac864bab05f9cecd13702a1426ce0b2ac795d`
(`visual-retrieval-engine-v1`). El commit productivo `3b310af` reúne de forma
atómica el renderer moderno, sus contratos y el único incremento
`VERSION_PLANTILLAS=14 → 15`.

V15 convierte los tres conceptos recuperados por C en una composición moderna
de hasta tres recursos semánticos:

```text
LocalSceneSemantic / VisualConceptSet
→ recuperación y ranking de C
→ decisiones Hero / Support
→ publicación o reutilización de ProjectAsset
→ VisualSceneSpec V2 + RenderBindings V2
→ PixelIdentity
→ AnimatedGraphic / visual_escena
→ QC de DOM y frames
→ MP4
```

No existe renderer por proveedor. OpenMoji y raster entran como ProjectAsset;
Solar conserva su slot procedimental. El renderer no busca ni descarga nada.

## Contrato multiasset

`VisualSceneSpecV2` es una revisión aditiva. Permite:

- exactamente cero o un slot `hero`;
- cero, uno o dos slots `support-1` / `support-2`;
- máximo tres assets semánticos;
- estados `present`, `procedural`, `missing` y `omitted`;
- SVG, PNG, JPEG y WebP declarados, con límites y verificación previa;
- SubjectBounds, fit, crop, envelope, z-order, tratamiento y motion por slot.

`asset-led` exige Hero. `editorial-text` no reserva assets. No se aceptan slots,
bindings ni identidades semánticas duplicadas. Si desaparece el Hero, se
materializa un fallback editorial con identidad nueva; si desaparece un Support,
la composición se reduce a una familia todavía elegible.

`RenderBindingsV2` localiza cada asset persistido mediante `slotId`, `assetId` y
`relativeFile`. Esos datos, el proyecto, provider, URL, licencia, query, score y
traza quedan fuera de PixelIdentity.

## Materialización de recursos

El materializador V15 consume la decisión de C y no vuelve a resolver semántica.
Puede reutilizar o publicar OpenMoji, conservar Solar procedimental y preparar
Pixabay Images antes de cerrar el spec. La integración Pixabay:

1. busca y rankea antes del render;
2. descarga sólo el candidato seleccionado;
3. limita bytes y redirecciones;
4. comprueba magic bytes, MIME, dimensiones y alpha real;
5. calcula SHA-256 y SubjectBounds;
6. publica atómicamente un ProjectAsset dentro del proyecto explícito;
7. vuelve a leer y verificar bytes/SHA/MIME al preparar el render.

`colors=transparent` sigue siendo sólo una preferencia de consulta. La muestra
de aceptación demostró alpha útil sobre bytes reales. El raster se lee mediante
un verificador neutral al provider después de convertirse en ProjectAsset.

ByPeople permanece `planned-not-audited`: no busca, descarga ni renderiza. Una
futura biblioteca local puede entrar por el mismo ProjectAsset/raster sin crear
otro SceneSpec o renderer.

## Política de color y estilo de vídeo

Los specs nuevos usan intención explícita:

- OpenMoji: `original-color` por defecto;
- Pixabay/raster: `original-color` por defecto;
- Solar: `system-tint`;
- `duotone` y `accent-mask` permanecen para reproducir specs históricos.

`VideoVisualStyleV1` se selecciona una vez por vídeo. La aceptación usa
`cream-editorial`, con cuatro variantes quietas (`ivory`, `warm-cream`, `paper`,
`soft-sand`), paleta común, decoradores mínimos y motion de fondo `none`. El
estilo gobierna el entorno; no recolorea assets original-color.

## Familias y eligibility

Las 17 familias tienen adapter moderno y eligibility explícita. Certificar una
familia significa que existe un fixture semánticamente apropiado y que su DOM
efectivo pasa QC; no significa forzarla en cualquier escena.

| Familia | Support mínimo | Relación/condición principal |
| --- | ---: | --- |
| editorial | 0 | texto como sujeto, sin slots muertos |
| marcoPoster | 0 | Hero dominante |
| partidoVertical | 0 | contraste/comparación |
| cintaDiagonal | 0 | cruce/impulso |
| anillosConcentricos | 0 | foco/órbita |
| rayosImpacto | 0 | impacto/expansión |
| cuaderno | 0 | documento/anotación |
| constelacion | 1 | nodos semánticos conectados |
| capasApiladas | 1 | capas/partes reales |
| redNodos | 2 | tres nodos conectables |
| lineaTiempo | 2 | tres hitos ordenados |
| corteTransversal | 1 | partes/estratos |
| abanicoTarjetas | 2 | tres elementos comparables |
| engranajes | 2 | tres conceptos que interactúan |
| cascada | 2 | cadena causal/secuencial |
| mundoIsometrico | 2 | objetos/contexto de un sistema |
| pilaVertical | 1 | jerarquía/niveles/pasos |

No se crean puntos, tarjetas o supports falsos para satisfacer eligibility.

## Motion, texto y QC

El plan de movimiento es por rol: Hero entra primero, Supports se escalonan,
keyword recibe énfasis y texto secundario permanece más estable. Entry, sustain,
emphasis y exit viven en el spec y por tanto en PixelIdentity. El fondo queda
quieto en el estilo de aceptación.

Los seis TypographyLooks certificados siguen usando archivos locales y
`font-synthesis: none`. En 540×960 la aceptación declara 3.45 cqmin / 3.15 cqmin
para secundarios asset-led y 4 / 3.65 cqmin en editorial.

QC V15 comprueba binding y bytes, SHA/MIME, slots duplicados, alpha cuando se
exige, safe area, clipping, overflow, z-order, Hero demasiado pequeño, Support
dominante, solapes graves, contraste de texto, densidad y composición editorial.
No aplica un umbral de contraste monocromo al interior de OpenMoji multicolor.

## PixelIdentity, hash y compatibilidad

La proyección canónica V2 incluye cantidad/rol/estado de slots, SHA, kind/MIME
visible, SubjectBounds, fit, crop, envelopes, z-order, tratamiento, opacity,
motion, LayoutFamily, VideoVisualStyle, texto, tipografía y revisiones.

Pruebas explícitas demuestran que cambiar SHA de Hero o Support, estado,
posición de Supports, tratamiento, estilo o motion cambia identidad. Cambiar sólo
provider, URL o path no la cambia. La clave React usa la misma proyección.

El control de caché produjo `f24366f27108` para V14 y `2a101f24387e` para V15;
la segunda llamada V15 reutilizó ruta y mtime. El frame histórico V14 obtuvo
`pixelDiff=0`. Legacy obtuvo también cero píxeles diferentes bajo la tolerancia
histórica. No hay migración silenciosa de specs V14.

## Evidencia de aceptación

La secuencia real contiene 20 Visuales / 20 s y pasó 20/20 QC. En ella:

- 9 familias usadas; 17/17 certificadas por la hoja de cobertura;
- familia dominante: 20 %;
- 8 placements de Hero y 2 de Support;
- 2 escenas editoriales; 18 con dos Supports;
- 2.7 assets por escena;
- 49 slots OpenMoji, 4 Solar y 1 Pixabay;
- OpenMoji original-color: 100 %; raster original-color: 100 %;
- 6 looks / 6 familias efectivas de keyword;
- cuatro variantes del mismo estilo crema, consistencia 100 %;
- 0 fondos con motion alto;
- 20 énfasis de keyword, 18 planes Hero y 36 planes Support;
- QC: 20 aceptados, 0 rechazados.

Se midieron 53 clips: 28,638 ms acumulados, mediana 597 ms/clip, p95 815 ms,
mediana 74.625 ms/frame, p95 101.875 ms/frame y 1.255 intentos/frame. Hubo 53
misses de primera generación y un hit de caché explícito.

Artefactos: `tests/aceptacion/motion-graphics-v15/` contiene siete hojas, MP4,
evidencia estructurada y el control V14.

## Holdout congelado y límite conocido

El holdout se fijó en un commit antes de su primera ejecución y no se usó para
ajustar el lexicón. Resultado honesto sobre 72 conceptos inéditos:

- Top-1 razonable: 0/72;
- Top-5 contiene candidato: 5/72;
- sin resultado: 67/72;
- ambiguos: 2/72;
- selección final: 72 editorial-text.

Esto demuestra sobreajuste o cobertura léxica insuficiente en Retrieval C. V15
demuestra el contrato, persistencia y render multiasset, pero no convierte este
holdout en éxito de recuperación. Debe tratarse como deuda funcional previa a
afirmar generalización sobre vídeos reales; el holdout queda congelado.

## Límites de la ronda

No se integran IA/FLUX, removedor de fondo, scraping, biblioteca ByPeople,
providers adicionales, segundo renderer, overlays de timeline ni cambios en
proyectos reales. Las hojas y el MP4 son evidencia para Jairo; no constituyen
aprobación estética.
