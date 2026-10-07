# Catálogo editorial modular V1 · 250 piezas

Perfil nuevo y opt-in `editorial-modular-catalog-v1` / revisión `editorial-modular-catalog-2026-09-v1`. No sustituye V1–V4.1 ni modifica el selector histórico por defecto. Su fuente de verdad curada son `src/shared/editorial-modular-catalog-v1.registry.json` (250 IDs, roles, SHA de runtime y SHA del manifiesto completo) y el inventario externo del paquete; los PNG **no** se versionan en Git.

## Uso local en Cipher

1. Conservar juntos `inventory.json`, `runtime/`, `masters/`, `prompts/` y la evidencia del paquete externo. No apuntar al directorio padre ni esperar descubrimiento recursivo.
2. Abrir un proyecto de prueba nuevo. Elegir `Catálogo editorial modular V1 — Piloto opt-in`.
3. Introducir la ruta absoluta de la **raíz que contiene `inventory.json`** y pulsar `Validar y listar catálogo`. El panel exige exactamente 250 entradas del registro curado.
4. Indicar la carpeta `runtime` de IDEA V4 para su fondo/plantilla local. Elegir un Hero, cuatro Supports y, opcionalmente, rear-collage, accent-mask y front-collage. Elegir receta (`vertical`, `wide`, `compact`, `organic`), texto corto y tintes.
5. Pulsar `Generar escena modular en timeline`. El proceso materializa los IDs/SHA como `ProjectAsset`, construye `SceneSpecV2`/`RenderBindingsV2` y usa `MotionGraphicV15` con captura DPI-safe. Autosave persiste el clip y su reproducción usa el SceneSpec congelado, no la paleta actual de UI.

El piloto produce **una escena por pulsación**. No es todavía un buscador narrativo automático para un video largo. Ningún proyecto anterior activa este perfil solo. Una ruta física es configuración/binding, nunca identidad. El render posterior a materialización no consulta red.

## Contrato y límites

- `CuratedModularCatalogV1` valida roster completo contra registro local versionado, rol/ID/SHA, nombres de runtime acotados y rutas resueltas dentro de la raíz. Rechaza alteración, traversal, colisión y entradas no autorizadas. Publica por la ruta raster `ProjectAsset` existente; no crea un segundo renderer.
- El mismo compositor V15 conserva un Hero semántico, hasta cuatro Supports de este perfil y capas internas del Hero. `catalogAssetId`, SHA, receta, colores resueltos, título y capa elegida afectan PixelIdentity. URL, master, ruta absoluta, prompt y proveedor no entran en ella.
- Supports y `accent-mask` usan `AlphaMaskRasterV4` productivo. Heroes, papeles neutros y collages fotográficos conservan RGB. La bombilla ámbar H001, lente teal H011 y bloque rojo mate H101 tienen color físico horneado: no se promete recolor de esas superficies.
- El título del perfil nuevo mide la fuente local en su región antes de pintarse. Su tinta de acento legible se deriva y **persiste** separada del HEX exacto de las máscaras. Las escenas históricas continúan en sus ramas de render y validación originales.
- La vista de matriz se compila como página de evidencia que importa el **mismo** `AlphaMaskRasterV4`; no introduce otra política de color.

## Evidencia y deuda deliberada

La raíz externa del paquete contiene `CATALOGO-250.html`, `CATALOGO-250.md`, `inventory.json`, 250 masters/runtime, ledger y prompts, hojas por lotes, 240 vistas estables V15, matriz de cinco tintes, y dos montajes reales de ocho escenas por formato. Los montajes carecen de voz: prueban imagen/movimiento, **no** sincronía de narración.

Las cajas `anchor` y `safeArea` son geométricas, derivadas del alpha. `focalRegions` semánticas de cara/lente/dial y compatibilidades finas Hero-collage todavía requieren curación humana; no deben presentarse como certificadas. El uso libre de cualquier Hero con cualquier capa no garantiza buena composición ni relación semántica. La selección de assets en la UI es explícita, no ranking por LLM. Los alias curados cubren un subconjunto, no comprensión abierta del vocabulario.

**Pendiente obligatorio posterior:** `Connector Semantics V4.2` para dirección/posición de flechas. Esta entrega no cambia rutas ni timing de conectores. Tampoco amplía el catálogo a 500, cambia providers o incluye los PNG en Git. El respaldo de Git no respalda los binarios externos.

## Resultado de cierre

La validación del paquete externo pasó 250/250, SHA runtime únicos 250, sin errores de formato/alpha. La importación temporal de los 250, la ruta Electron/preload de generación/guardado/replay, los 240 fotogramas estables de nuevos assets y 16 escenas de muestra (ambos formatos) pasaron. Las aceptaciones dirigidas V1–V4.1 pasaron. Los MP4 de muestra no contienen audio.

El runner global no quedó verde: primera pasada 39/40 por muestra incompleta en `test:persistencia` (se amplió a 37 campos y pasó dirigida); segunda pasada 39/40 por el conocido pixelDiff intermitente de 7.792 en Black Foundation. Black Foundation sí había pasado en la primera pasada. No se cambiaron baseline, tolerancias ni renderer histórico y no se repitió para seleccionar una pasada verde. La certificación histórica estricta continúa pendiente.
