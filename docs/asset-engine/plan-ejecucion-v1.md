# Plan V1 — orden de ejecución después de 3.4A

Base documental `291069e`, tag `v-auditoria-pipeline-assets`; ejecución actualizada
con el merge 3.4A `8760491`. Hecho documental no significa función implementada.
3.3.5 integrada con merge local `1d8415a` y cierre
`v-scene-recipe-editorial-v1`; su aceptación visual aún no se ha realizado.

- [x] 3.3 — Auditoría de pipeline, integrada con `993a123`; cierre `291069e`.
- [x] 3.3.5 — Especificación documental cerrada en `v-scene-recipe-editorial-v1`: Scene Recipe + ProjectSubstrate, 18 ejemplos y validador; sin renderer nuevo.
- [x] 3.4A — Persistencia mínima integrada con merge `8760491` y retorno `v-persistencia-assets-v1`. Código `6b8dddf`: schema/migración, ProjectSubstrate, manifest V1, rutas confinadas y backup; clon nuevo con npm ci, tsc, build y 10/10. Evidencia: persistencia-assets-v1.md. No incluye catálogo ni asset real.
- [x] 3.4B — Catálogo OpenMoji oficial pinneado, integrado con merge `5bf8635` y retorno `v-openmoji-catalog-v1`: metadata local, SVG color, nombres/grupos/aliases, atribución y búsqueda offline. La validación exhaustiva queda en build; carga/búsqueda runtime no inspeccionan SVG y la resolución valida sólo el SVG elegido. No copia assets a proyectos ni implementa Hero. Evidencia: `openmoji-catalog-v1.md`.
- [ ] 3.4C — Round trip: resolver birthday cake, copiar un solo SVG, validar, SHA, manifest, cerrar y reabrir offline resolviendo el mismo asset.
- [ ] 3.5A — AttentionIntent: pregunta del espectador, emoción objetivo, mecanismo de atención, restricción de verdad, propósito de cada elemento y variantes cortas de texto; después de 3.4C, sin llamada IA en 3.4B.
- [ ] 3.5B — Asset Resolver: proyecto primero, OpenMoji, proveedores, continuidad/variedad y fallback trazable; candidato, descarga, validación, referencias relativas y plan resuelto.
- [ ] 3.6A — Hero estático: una ranura real, bytes presentes, RenderSpec y coherencia de ambas cachés; sin nuevos movimientos ni transiciones.
- [ ] 3.6B — Motion Envelope: presets acotados y ciclo legal, bounds durante todo el movimiento, sin geometría duplicada.
- [ ] 3.6C — QC Hero: hoja visual del renderer real, SHA/ausencia/contraste/bounds y aceptación perceptiva.
- [ ] 3.7 — Texto editorial: pares medidos, presupuesto, legibilidad y keyword sincronizable.
- [ ] 3.8 — Support: jerarquía y presupuesto semántico, sin competir con Hero.
- [ ] 3.9 — Collage/layouts: compatibilidad entre intents y las estructuras, texturas/decoradores y density roles; recalibrar límites con evidencia.
- [ ] 3.10 — Sincronización con narración: hit de palabra, entrada y pausa; audio/ducking fuera de Recipe.
- [ ] 3.10.5 — Transiciones A→B: contrato de dos escenas y timeline, identidad del resultado compuesto.
- [ ] 3.11 — PurePNG/PNGImages experimentales: validar archivos individuales, transparencia y riesgo; sin elevación automática a base.
- [ ] 3.12 — APIs fallback de imágenes: Pexels/Pixabay/Wikimedia y controles de consumo.
- [ ] 3.13 — Removedor, sólo cuando no haya cutout útil.
- [ ] 3.14 — ByPeople premium por vía oficial autorizada, sin scraping/login automatizado.
- [ ] 3.15 — IA/FLUX: último fallback; estilo, derechos, coste y caché propios.
- [ ] 3.16 — Endurecimiento: portabilidad, transacciones, ausencias, límites, pruebas y avisos.
- [ ] 3.17 — Aceptación final: vídeo real autorizado y revisión humana; medir variedad, significado, legibilidad, rendimiento y fallback.

Render incremental no es una fase obligatoria: medir antes los aciertos y coste
de la caché existente y la caché React. No inventar otro renderer para optimizar.

## Cierre de 3.4A y siguiente límite

3.4A formalizó persistencia mínima de ProjectSubstrate dentro de la estructura
real del proyecto y un manifest V1 vacío para proyectos nuevos. No valida bytes,
no copia materiales en Guardar como y no hace transacción conjunta entre ambos
JSON. 3.4B ya está integrado: catálogo OpenMoji oficial pinneado,
metadata/aliases/atribución offline, validación de build y carga runtime ligera.
El siguiente límite es 3.4C: un único round trip de SVG al proyecto, sin Hero
todavía.

## Límites de no-regresión

- No segundo renderer ni clip de imagen paralelo al Visual V1.
- No catálogo completo ni binarios de terceros en Git.
- No dos autoridades para el mismo metadato.
- No Hero presente/ausente con igual hash.
- No confundir auditoría actual de clips con validación de imagen.
