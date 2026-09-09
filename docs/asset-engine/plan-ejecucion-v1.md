# Plan V1 — orden de ejecución después del Visual MVP productivo

Base documental `291069e`, tag `v-auditoria-pipeline-assets`; ejecución actualizada
con el merge 3.4A `8760491`. Hecho documental no significa función implementada.
3.3.5 integrada con merge local `1d8415a` y cierre
`v-scene-recipe-editorial-v1`; su aceptación visual aún no se ha realizado.

- [x] 3.3 — Auditoría de pipeline, integrada con `993a123`; cierre `291069e`.
- [x] 3.3.5 — Especificación documental cerrada en `v-scene-recipe-editorial-v1`: Scene Recipe + ProjectSubstrate, 18 ejemplos y validador; sin renderer nuevo.
- [x] 3.4A — Persistencia mínima integrada con merge `8760491` y retorno `v-persistencia-assets-v1`. Código `6b8dddf`: schema/migración, ProjectSubstrate, manifest V1, rutas confinadas y backup; clon nuevo con npm ci, tsc, build y 10/10. Evidencia: persistencia-assets-v1.md. No incluye catálogo ni asset real.
- [x] 3.4B — Catálogo OpenMoji oficial pinneado, integrado con merge `5bf8635` y cierre de aislamiento `23ed2c2`; retorno `v-openmoji-catalog-v1`. Metadata local, SVG color, nombres/grupos/aliases, atribución y búsqueda offline. La validación exhaustiva queda en build; carga/búsqueda runtime no inspeccionan SVG y la resolución valida sólo el SVG elegido. Reconciliación 3.4B.1: fixtures bajo `%TEMP%`, 30/30 casos, 11/11 suites y los tres proyectos actuales con huella idéntica antes/después. No copia assets a proyectos ni implementa Hero. Evidencia: `openmoji-catalog-v1.md`.
- [x] 3.4C — Round trip OpenMoji integrado con merge `04cba197` y retorno `v-openmoji-asset-roundtrip-v1`: birthday cake/1F382, validación profunda, SHA, publicación atómica, AssetManifest real e inspección offline en proyecto temporal. Un clon nuevo pasó catálogo 30/30, round trip 50/50 y runner 12/12. No dibuja ni publica assets en proyectos reales. Evidencia: `openmoji-asset-roundtrip-v1.md`.
- [x] Puerta visual / 3.4D — La rama experimental midió 42 escenas y tratamientos; no se fusiona su ruta data URI. La aceptación productiva posterior confirma la decisión con ProjectAsset real.
- [x] 3.6A — Hero estático productivo mínimo: una ranura OpenMoji, bytes verificados, RenderSpec/RenderBindings y coherencia de hash + clave React; sin resolver automático.
- [x] 3.6B — Motion MVP: `fade-slide`, `scale-in`, `float`, `breathe`, `fade-out`, `scale-down` y un `punch`; no cierra el contrato de motion completo.
- [x] 3.6C — QC mínimo de frame roto: archivo/SHA/MIME, bounds durante motion, texto, solape y contraste local; hoja y vídeo productivos revisados.
- [x] 3.7A — Texto editorial MVP: connector/keyword/closing, dos pares existentes, ocho palabras y dos líneas. Sin sincronía exacta de voz.
- [ ] 3.5B — **Siguiente: GRAN RONDA 3/3.** Asset Resolver mínimo: proyecto primero, OpenMoji, continuidad/variedad y fallback trazable; sin ampliar proveedores todavía.
- [ ] 3.5A — AttentionIntent calibrado después de evidencia visual: pregunta del espectador, emoción objetivo, mecanismo de atención, restricción de verdad, propósito y texto; sin llamada IA en 3.4B–3.4D.
- [ ] 3.7B — Texto editorial posterior: sincronía de keyword con voz, calibración ampliada y más pares sólo con evidencia.
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
3.4C está integrado y certificado en proyecto temporal. La puerta visual y el
Visual MVP productivo ya prueban, sin resolver automático, ProjectAsset →
RenderSpec/Bindings → visual_escena → vídeo/timeline, con Hero, texto, motion y
QC mínimos. El siguiente límite es 3.5B, Asset Resolver mínimo automático.

## Límites de no-regresión

- No segundo renderer ni clip de imagen paralelo al Visual V1.
- No catálogo completo ni binarios de terceros en Git.
- No dos autoridades para el mismo metadato.
- No Hero presente/ausente con igual hash.
- No confundir auditoría actual de clips con validación de imagen.
