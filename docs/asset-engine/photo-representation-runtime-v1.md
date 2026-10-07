# Photo Representation + Productive Runtime V1

Estado: desarrollo interno V15. No autoriza distribución comercial de pesos.

## Causa y corrección de runtime

El sidecar, worker y pesos `u2netp` ya existían, pero el proceso main no recibía
`CIPHER_CUTOUT_PYTHON` ni `CIPHER_CUTOUT_MODEL_CACHE`. Por eso
`configuredCutoutRuntimeV1()` devolvía `null` antes de cualquier inferencia y
la generación persistía `CUTOUT_RUNTIME_UNAVAILABLE`.

La configuración local usa el loader `.env` ya existente. No se adivina un
Python global, no se depende de un runtime privado de Codex, no se descarga un
modelo durante generación y no se versionan rutas locales ni secretos.
`diagnoseCutoutRuntimeV1()` expone únicamente el estado: configurado,
intérprete ejecutable, worker disponible, modelo disponible y código de error.

## Autoridad de representación

La procedencia decide qué significa una pista iconográfica:

1. Una elección persistida/directa de provider, asset o representación se
   restaura sin abrir fotografía.
2. Un hexcode/direct OpenMoji conserva su resolución directa.
3. Un emoji semántico del mismo subclip conserva el candidato iconográfico,
   pero no se interpreta como una elección del usuario.
4. Si ese concepto tiene evidencia física concreta, la ruta automática puede
   intentar `photo-cutout` antes del icono.
5. Si es símbolo/abstracto o no hay evidencia física, no se abre una foto
   arbitraria.

No se cambia el significado ni la procedencia de VisualConceptSet. Hygiene
continúa validando fallbacks lexicales y Semantic Asset Relevance Gate sigue
exigiendo `EXACT|STRONG` para Hero y `EXACT|STRONG|RELATED` para Support.

## Presupuesto y fallbacks

Cada escena comparte como máximo 4 peticiones fotográficas, 4 descargas y 2
transformaciones. Los límites son techos, no objetivos. Un rechazo de
relevancia ocurre antes de descargar/recortar cuando la evidencia basta. Un
fallo de runtime, cutout o presupuesto conserva los fallbacks existentes:
full raster defendible, otro concepto, OpenMoji, Solar o editorial.

Las métricas distinguen oportunidades, planes, peticiones, reintentos,
candidatos, rechazos, descargas, alpha existente, inferencias rembg, cache,
errores, Hero/Support, assets únicos/reutilizados y tiempos. Un uso repetido no
cuenta como inferencia nueva.

## Compatibilidad

No cambia VisualSceneSpecV2, RenderBindingsV2, MotionGraphicV15, renderer,
geometría, familias, fondo, color ni motion. `VERSION_PLANTILLAS` permanece en
15: cambia qué SceneSpec se materializa para una decisión automática, no cómo
se dibuja una SceneSpec ya persistida.

`CUTOUT_WEIGHT_LICENSE_GATE = PENDING_BEFORE_COMMERCIAL_DISTRIBUTION` sigue
vigente. No se publican ni empaquetan pesos en esta fase.
