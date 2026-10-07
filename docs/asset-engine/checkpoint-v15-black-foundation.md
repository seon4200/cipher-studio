# CHECKPOINT V15 BLACK FOUNDATION

Estado técnico del checkpoint `background-black-foundation-v1`:

- D-Final y su recuperación semántica permanecen sin cambios.
- Hero y hasta dos Supports conservan el contrato V15.
- OpenMoji y raster/Pixabay conservan `original-color`; Solar conserva `system-tint`.
- Las 17 familias modernas permanecen disponibles y usan el mismo compositor.
- `VideoVisualStyle` permanece vigente.
- `BackgroundProfileV1` separa la superficie inferior de composición, decoradores, assets y motion.
- Las escenas V15 nuevas materializan `solid-black-v1` (`#0D0D0F`).
- Las escenas V15 históricas sin `backgroundProfile` conservan su background y sus píxeles anteriores.
- Líneas, bordes, halos, superficies, subrayados, geometría estructural y motion permanecen encima del fondo.
- `VERSION_PLANTILLAS` permanece en 15 porque una misma SceneSpec histórica conserva identidad y píxeles; el perfil explícito de una SceneSpec nueva entra en PixelIdentity.

Evidencia:

- `tests/aceptacion/background-black-foundation-v1/contact-sheet-black-foundation.png`
- `tests/aceptacion/background-black-foundation-v1/evidence.json`
- `tests/aceptacion/background-black-foundation-v1/historical-v15-baseline.png`
- `tests/aceptacion/background-black-foundation-v1/historical-v15-current.png`

Pendiente, sin implementar en este checkpoint:

1. revisión humana del negro;
2. mini ronda de color;
3. imágenes reales/cutouts;
4. revisión o ampliación de familias;
5. Background Library;
6. catálogo de aproximadamente 500 fondos;
7. selector semántico de fondo;
8. anti-repetición.
