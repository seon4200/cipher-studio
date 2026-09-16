# Photo Representation + Runtime V1 — aceptación

Aceptación pequeña en proyecto temporal con respuestas de Pixabay capturadas.
Recorre la ruta productiva desde semántica estructurada hasta SceneSpec, QC y
MP4. No construye SceneSpecs finales ni elige IDs de assets manualmente.

Casos:

- cámara real recortada como Hero;
- la misma cámara reutilizada por cache como Support de un Hero Solar;
- taza resuelta como OpenMoji cuando el icono sigue siendo suficiente;
- hexcode OpenMoji directo como control de autoridad.

La fotografía fuente es JPG opaca local. La primera cámara ejecuta `u2netp`;
la segunda reutiliza el ProjectAsset derivado. Tras materializar assets se
bloquea red para renderer, QC y MP4.

La política de representación se calibra aparte sobre un fixture congelado de
43 escenas del video real auditado. El baseline medido tenía 12 oportunidades
fotográficas; la política ampliada detecta 24 sin cambiar conceptos, providers
ni umbrales de relevancia. La selección mantiene un presupuesto compartido por
escena (4 peticiones, 4 descargas y 2 transformaciones), reserva capacidad para
un segundo concepto físico y evita repetir un ID o SHA reciente únicamente
cuando existe una alternativa con la misma relevancia y puntuación defendible.

Artefactos:

- `contact-sheet-photo-representation-runtime-v1.png`
- `photo-representation-runtime-v1.mp4`
- `evidence.json`
