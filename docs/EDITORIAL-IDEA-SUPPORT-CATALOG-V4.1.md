# Editorial IDEA Supports V4.1 — importación local segura

V4.1 agrega un microcatálogo opt-in de diez Supports al contrato de IDEA. No cambia las rutas históricas V1–V4 ni activa el perfil en proyectos existentes. El renderer recibe los mismos `ProjectAsset`/bindings de V15 y resuelve los iconos autorizados con una máscara CSS de alpha; el HEX ya canonicalizado es el `backgroundColor` de esa máscara.

## Catálogo del piloto

El manifiesto fuente y allowlist están en `src/main/assets/editorial-idea-support-catalog-v4-1.manifest.json`; el validador/importador está en `src/main/assets/editorial-idea-support-catalog-v4-1.ts`. La lista de IDs y SHA aprobados también está fijada en el módulo compartido. La biblioteca local usada durante la aceptación reside fuera del repositorio en `%CIPHER_LOCAL_ROOT%\_cipher-support-catalog-v4-1`.

| Support | Origen | Procedencia del prompt |
| --- | --- | --- |
| PERSONAS, DATOS, SOLUCIONES, IMPACTO | Conservados byte a byte desde el piloto V4/V3 | Prompt histórico no disponible; no reconstruido |
| CÁMARA, RED, TIEMPO, OBJETIVO, CONEXIÓN, FLUJO | Generación integrada de imágenes de Codex/OpenAI | Literal en el manifiesto |

El run local mantiene masters originales, PNG runtime normalizados a 1024 px, metadatos y carpeta de fixtures rechazados. No se aceptó ningún recurso pictórico externo; las pruebas negativas usan sólo archivos sintéticos aislados.

## Reglas de admisión

- El consumidor selecciona por `assetId` lógico y SHA-256 aprobado, no por nombre físico.
- La ruta relativa local sólo vive en manifiesto/configuración de importación y `RenderBindings`; rutas absolutas, provenance, licencia y ruta de master no entran en SceneSpec ni PixelIdentity.
- La carga vuelve a calcular SHA, valida PNG RGBA, dimensiones, alpha útil y ausencia de fondo cromático en los seis recursos nuevos. Rechaza traversal/rutas no confiables, bytes sustituidos, inyección de IDs no curados, PNG opaco y fixtures con fondo verde.
- Los cuatro PNG históricos están permitidos únicamente por su identidad SHA fijada y curation previa; no se reescriben.
- Los valores HEX se normalizan a mayúsculas antes de persistirse. V4.1 no ofrece segunda máscara Hero: `dual-accent`, `fixed-spectrum` y `hero-secondary` quedan rechazados para esta revisión.
- En el renderer, el alpha del PNG es la máscara y el color es un relleno sólido. No se emplea `hue-rotate`, `saturate` ni `filter` como ruta de tintado.

## Diagnóstico lossless

La aceptación opcionalmente toma `NativeImage.toPNG()` en el frame 61/80 del compositor Electron/Chromium, después de verificar la sonda de frame correcto y antes de FFmpeg. La captura de diagnóstico no modifica píxeles, el hash ni la caché y viaja desde el worker DPI-safe mediante un resultado temporal.

En Windows/Chromium el CSS y la identidad conservan el HEX canónico; el raster RGB decodificado desde `NativeImage` mostró redondeo del compositor de hasta 2 niveles de 8 bits. Por eso la aceptación verifica presencia dentro de ±2 LSB en la captura PNG pre-H.264, y usa igualdad RGB exacta para comparar regiones neutras y todo el fotograma fuera de las máscaras de los cuatro Supports al cambiar el tinte. No se usa esa tolerancia para identidad ni para igualdad de materiales.

## Ejecutar

```powershell
npx tsc --noEmit
npm run build
$env:CIPHER_FFMPEG_EXE='%CIPHER_LOCAL_ROOT%\_tools\ffmpeg-v4\extracted\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe'
node node_modules/electron/cli.js tests/aceptacion/editorial-idea-color-import-v4-1/generar.cjs
```

La aceptación crea un userData/proyecto temporal por corrida, materializa los diez assets, renderiza coberturas V15 portrait/landscape, inspecciona alpha-mask en Electron, verifica repetición raw RGB, `networkAttempts=0` y `visualSinFichero=0`. Las pruebas de V1–V4 se ejecutan por separado y conservan sus fixtures y artefactos previos.

Las capturas, videos, SHA y métricas de una corrida concreta quedan bajo `%CIPHER_LOCAL_ROOT%\_cipher-support-catalog-v4-1\evidence\run-<timestamp>`. La carpeta externa es evidencia de aceptación local, no se copia ni se activa como catálogo de producción para proyectos del usuario.
