# IDEA — ensamblaje editorial (piloto opt-in)

La revisión `editorial-idea-assembly-2026-09-v1` es una escena sintética de autoría acotada, no una nueva política automática de retrieval. Reutiliza el resolver V15 para el Hero, publica diez PNG generados con ChatGPT como `ProjectAsset`, compila `VisualSceneSpecV2`/`RenderBindingsV2` y renderiza con `MotionGraphicV15`/`renderGraphicClip`. Una vez publicados los bytes, el render bloquea HTTP.

## Contrato

- `hero` sigue siendo un único slot semántico: busto de piedra. `idea-rear`, `idea-accent`, `idea-bulb` e `idea-front` son componentes *internos*, no Supports. `idea-background` es la textura raster del lienzo.
- Sólo esta revisión admite `support-1` a `support-4`: PERSONAS, DATOS, SOLUCIONES e IMPACTO. Las escenas históricas continúan con máximo dos Supports. El compilador exige los cuatro ProjectAssets curados y la preparación falla si falta cualquier pieza.
- La `ideaAssembly` congela SHA, geometría local, z-order, tiempos normalizados 0..1, desplazamientos, pivote y tratamiento de acento. `RenderBindingsV2` conserva los locators fuera de `PixelIdentity`.
- El filtro de tono se permite únicamente sobre la capa `idea-accent`. Piedra, bombilla, papeles neutros y fondo nunca se tintan. Los cuatro iconos tienen acentos propios y pueden seguir la variante.
- Las geometrías vertical y horizontal se almacenan por separado en la misma SceneSpec. La revisión histórica V3 no cambia de despacho ni de píxeles.
- 80 fotogramas a 24 fps = 3,333 s. Los tiempos de entrada/salida son fracciones de esa duración, no segundos ni timestamps de audio. No hay narración; no se ha validado sincronización vocal.

## Reproducción

1. `npm run build`.
2. Ejecutar `npm run accept:editorial-idea-assembly-v1` en un entorno que permita Electron offscreen y `ffmpeg` en `PATH`.
3. Revisar el último `run-*` bajo `C:\graphify\_cipher-idea-assembly-v1\runs`.

El arnés usa un proyecto y `userData` temporales. No consulta ni modifica proyectos reales. La carpeta externa `masters/` conserva los originales; `runtime/` contiene los derivados seleccionados. `evidence.json` registra SHA, SceneSpec, bindings, QC e identidad. Los HTML de comparación identifican V3 como comparación artística, no como A/B controlado de los mismos assets.

## Fronteras deliberadas

El adaptador es para este piloto fijo; la generación normal no elige cuatro Supports de forma automática. Escalarlo requeriría política de selección y validación semántica de cuatro roles. El fondo y todas las piezas usan la ruta ProjectAsset raster ya existente; no se amplió el manifest de Local Visual Library. No se ha integrado esta escena en el selector de la UI. La aprobación estética queda pendiente de revisión humana.
