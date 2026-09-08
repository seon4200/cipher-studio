# Plan V1 — orden de ejecución después de 3.3.5

Base de código `291069e`, tag `v-auditoria-pipeline-assets`. Hecho documental no
significa función implementada. 3.3.5 integrada con merge local `1d8415a` y cierre
`v-scene-recipe-editorial-v1`; su aceptación visual aún no se ha realizado.

- [x] 3.3 — Auditoría de pipeline, integrada con `993a123`; cierre `291069e`.
- [x] 3.3.5 — Especificación documental cerrada en `v-scene-recipe-editorial-v1`: Scene Recipe + ProjectSubstrate, 18 ejemplos y validador; sin renderer nuevo.
- [ ] 3.4A — Persistencia mínima: schemaVersion, migración/default legacy, ProjectSubstrate en project-state, AssetManifest, rutas relativas, escritura atómica, validación al abrir y recuperación.
- [ ] 3.4B — Catálogo OpenMoji pinneado: elegir release/paquete, metadata local, nombres/grupos/aliases, atribución y modo offline.
- [ ] 3.4C — Round trip: resolver birthday cake, copiar un solo SVG, validar, SHA, manifest, cerrar y reabrir offline resolviendo el mismo asset.
- [ ] 3.5 — Asset Resolver: proyecto primero; candidato, descarga, validación, referencias relativas, plan resuelto y fallback trazable.
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

## Alcance inmediato de 3.4A

Formalizar persistencia mínima de ProjectSubstrate dentro de la estructura real
del proyecto y relación con manifest propuesto; decidir versión oficial/pin de
OpenMoji desde evidencia, validar un asset por necesidad y reapertura offline.
Los contratos 3.3.5 son el destino: 3.4 no debe implementar Recipe compiler,
Photo Hero, motion, Support ni nuevos layouts. No copiar una release completa a
cada proyecto; distinguir índice/dependencia pinneada de material elegido por vídeo.

## Límites de no-regresión

- No segundo renderer ni clip de imagen paralelo al Visual V1.
- No catálogo completo ni binarios de terceros en Git.
- No dos autoridades para el mismo metadato.
- No Hero presente/ausente con igual hash.
- No confundir auditoría actual de clips con validación de imagen.
