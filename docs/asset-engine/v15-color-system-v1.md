# V15 Color System V1

Esta mini-ronda añade color explícito encima de `solid-black-v1` sin cambiar layouts, assets,
retrieval, motion ni el fondo base.

Una generación selecciona una `VideoColorPalettePlanV1` a partir de conceptos ya existentes. El
plan contiene una familia principal y dos compatibles. Cada Visual materializa un
`SceneColorPaletteV1` con familia, variante y seis tokens HEX; esa decisión forma parte del
`VisualSceneSpecV2` y, por tanto, de PixelIdentity. La regeneración persiste plan, índice y decisión
cromática para reproducir la misma SceneSpec.

SceneSpecs históricas sin `colorPalette` conservan la paleta anterior. Las nuevas mantienen fondo
`#0D0D0F`, texto neutro y assets OpenMoji/raster en color original; Solar consume `system-tint`.
Las familias de composición sólo consumen roles de color y no eligen tema.

La evidencia visual queda pendiente de revisión humana. Esta ronda no crea fondos, imágenes,
familias, geometrías ni movimientos nuevos.
