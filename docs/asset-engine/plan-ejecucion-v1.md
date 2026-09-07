# Plan V1 — Asset Engine (pendiente)

Este checklist no afirma implementación. Procede de auditoría `c0a9c78` y debe revalidarse antes de cada paso.

- [ ] Acordar schema/version/migración y recuperación del manifiesto por proyecto.
- [ ] Crear resolver local por `assetId` y ruta relativa.
- [ ] Integrar OpenMoji pinneado con metadata, atribución y modo offline.
- [ ] Implementar descarga por vídeo, temporal/atómica y con límites.
- [ ] Implementar validación MIME/magic, SHA, dimensiones, alpha útil y SVG permitido.
- [ ] Implementar `materiales/assets/` + manifest sólo después de validación.
- [ ] Conectar `extra.hero` (SHA/estado/tinte) al hash sin rutas.
- [ ] Implementar fallback/aviso de archivo faltante y auditoría de assets.
- [ ] Integrar Photo Hero dentro de `visual_escena`; medir hoja visual antes de producción.
- [ ] Implementar hoja visual de Hero/tinte/fallback.
- [ ] Probar PurePNG experimental por archivo y política de riesgo.
- [ ] Probar PNGImages experimental con varias muestras de alpha útil.
- [ ] Auditar APIs fallback Pexels/Pixabay/Wikimedia y separar downloader de stock.
- [ ] Evaluar removedor de fondo tras medir cutouts transparentes.
- [ ] Evaluar ByPeople oficial/manual, sin scraping.
- [ ] Evaluar IA/FLUX como último fallback con coste, derechos, cache y estilo.

## Límites de no-regresión

- No segundo renderer ni clip de imagen paralelo al Visual V1.
- No catálogo completo ni binarios de terceros en Git.
- No dos autoridades para el mismo metadato.
- No Hero presente/ausente con igual hash.
- No confundir auditoría actual de clips con validación de imagen.
