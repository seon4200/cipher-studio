# Fase 2A — piloto editorial híbrido V1

Este es un piloto de presentación, no una aprobación estética ni un nuevo resolver. El corpus de 12 escenas principales y 4 casos de resistencia es **sintético y curado**; no son escenas de un proyecto del usuario. La escena contextual se ajustó durante el piloto de «hospital» (icono razonable) a una protesta en una plaza para probar honestamente full-raster; por ello el corpus no es un holdout imparcial.

## Activación en la app

En la configuración de la construcción del timeline IA, dejar una proporción de **Visuales** mayor que cero y elegir **Estilo de Visuales (piloto) → Editorial híbrido V1 (experimental)** antes de construir. **V15 actual** mantiene el comportamiento existente. La elección se guarda en el estado del proyecto y en el contexto moderno de cada Visual generado; regenerar ese Visual conserva el perfil. No se activa globalmente ni migra proyectos antiguos. En la TV actual puede seguir vigente el problema independiente de alcance/scroll del panel izquierdo, pospuesto por el usuario; aquí no se modifica el layout del editor.

## Contrato y alcance

- Perfil explícito `editorial-hybrid-v1`, revisión `editorial-hybrid-pilot-2026-09-v1`. La ausencia del campo conserva render e identidad V15 históricos. Cualquier modificación futura de sus píxeles requiere **otra revisión**.
- Seis familias piloto: `editorial`, `marcoPoster`, `partidoVertical`, `cintaDiagonal`, `cuaderno`, `lineaTiempo`. La elegibilidad V4 sigue mandando; comparación prefiere split y secuencia sólo usa timeline con tres slots reales. Las otras once familias conservan su presentación.
- Mismos conceptos, provider, slots, SHA, tint y texto para los ocho A/B controlados. No hubo sustituciones de assets en esos pares. Las decisiones semánticas, Hygiene, Relevance Gate y CutoutTransform no se editaron.
- El dato `72%` proviene literalmente de la narración local; el indicador no inventa denominador ni tendencia. Si no hay dato confirmado no aparece gráfico.
- Fondo negro y Color System V1 continúan. OpenMoji y fotos conservan color original; Solar conserva su tratamiento. Sólo el perfil nuevo recibe geometría, texto sin tarjeta universal, marcas y movimiento finito de entrada/énfasis/salida.

## Evidencia reproducible

Después de `npm run build`, ejecutar `node_modules/.bin/electron.cmd --force-device-scale-factor=1 tests/aceptacion/editorial-motion-pilot-v1/generar.cjs` desde la raíz. El arnés fija userData/proyecto temporal, bloquea red, usa respuestas Pixabay capturadas y tres fotografías locales ya validadas en `_spike-runtime` (sus SHA están en `evidence.json`). No requiere ni demuestra una búsqueda live. Nunca usa ni altera proyectos reales. Si faltan esas fuentes, la aceptación debe fallar en vez de reemplazarlas silenciosamente.

- `ab-same-assets-1..4.png`: ocho pares con mismo contenido, rol, duración y SHA.
- `main-scenes-1..3.png`: doce escenas; `stress-vertical.png` y `stress-horizontal.png`: cuatro resistencias en ambos formatos.
- `motion-entry.png`, `motion-stable.png`, `motion-exit.png`: tres instantes de la primera escena; un frame de entrada oscuro no implica opacidad baja permanente.
- `editorial-pilot-12-vertical.mp4` y `editorial-pilot-6-horizontal.mp4`: 24 fps, respectivamente 12 y 6 escenas consecutivas.
- `evidence.json`: identidad antes/después, opciones resueltas, QC, tiempos de render y RSS del proceso principal. Los nombres de clips/frames son diagnósticos del arnés temporal, no contrato de render ni PixelIdentity. La memoria del renderer no está incluida; estas mediciones no son un benchmark de toda la app.

## Estado y límites para reanudar

La cobertura final materializada incluye foto cutout de objeto, foto cutout de persona y objeto secundario, full-raster contextual, OpenMoji, Solar, dato literal, comparación, secuencia y editorial sin recurso justificable. QC de las 16 escenas pasó en vertical y de las cuatro resistencias en horizontal. La fotografía contextual disponible enfatiza a una persona en primer plano más que la protesta: límite de recurso/encuadre, no prueba de mejor semántica. Algunas composiciones con sólo iconos todavía se ven sencillas; la elegancia requiere revisión humana.

El arnés fuerza escala 1 sólo para la captura de Electron en esta TV (DPI observado 300%). El runner histórico sin ese ajuste y varias suites antiguas también exigen que `project-state.json` no exista en la raíz, aunque el archivo ya estaba allí antes del piloto y debe conservarse. No se corrigieron ni ocultaron esos gates de entorno. La deuda de semántica/retrieval y la licencia de pesos de cutout siguen pendientes en sus fases respectivas. No continuar automáticamente a 2B.
