# Aceptación — Visual MVP productivo

Este directorio prueba la vía productiva, no la rama experimental:

```text
ProjectAsset verificado
→ extra.sceneSpec + RenderBindings
→ grafico.html / AnimatedGraphic / visual_escena
→ renderGraphicClip
→ clips MP4
→ export-video / timeline
```

Se ejecuta con:

```bash
npm run accept:visual-asset-mvp
```

La prueba crea un proyecto marcado bajo el directorio temporal del sistema,
publica allí tres SVG desde el catálogo OpenMoji local, bloquea red, genera la
hoja y siete clips, exporta el vídeo y elimina el fixture. Nunca usa los tres
proyectos reales. No se versiona ningún SVG ni manifest del fixture.

## Artefactos

- `contact-sheet.png`: doce casos renderizados por `grafico.html` con
  ProjectAsset, RenderSpec y RenderBindings reales.
- `production/visual-asset-mvp-v1.mp4`: siete Visuales, 720×1280, H.264,
  montados por el canal real de exportación.
- `evidence.json`: SHA, procedencia/licencia de los tres assets, QC dinámico,
  prueba de red, ffprobe, rendimiento y regresión legacy.
- `legacy-baseline-b735.png`: salida legacy de la base productiva exacta
  `b735f05c8c7df11a5bdc33a1fcf10f4caf4ea903`, generada con el mismo Electron,
  fixture, instante y renderer.

La comparación legacy usa tolerancia de píxeles, nunca igualdad del archivo
PNG. La referencia se puede reconstruir desde un checkout ya compilado de esa
base con:

```bash
electron capturar-legacy-baseline.cjs CHECKOUT_B735 RUTA_SALIDA_PNG
```

La evaluación humana, arquitectura y límites están en
`docs/asset-engine/visual-asset-mvp-v1.md`.

