# Decisión vigente — almacenamiento de assets por proyecto

**Estado 3.4A integrado:** persistencia mínima V1 en master desde el merge
`8760491`. Autoridades reales y garantías:
[persistencia-assets-v1.md](persistencia-assets-v1.md). Ruta fija
`materiales/assets/manifest.json`, sin referencia duplicada de ruta en
`project-state`. ProjectSubstrate vive sólo en el estado versionado.
**Historia:** la comparación inferior recoge la auditoría `c0a9c78` y la propuesta
3.3.5 anterior al código. Sus afirmaciones de ausencia de schema/manifest
describen aquel estado, no el V1 integrado. OpenMoji y su primer archivo real
siguen sin implementar.

## Evidencia: auditoría base y límite actual

En `c0a9c78`, `project-state.json` guardaba el timeline desde
`src/renderer/src/main.tsx:1730–1760` y main lo persistía sin schema. Sus rutas
eran mayormente absolutas y no había SHA, licencia, validación o inventario de
material. 3.4A sustituye esa ausencia sólo para el nuevo sustrato V1: no cambia
las rutas históricas ni añade un proveedor o asset real. El disco contiene bytes,
pero no puede derivar procedencia ni si un archivo está aprobado.

No se propone una segunda fuente de verdad para el mismo hecho:

- **Timeline / estado:** qué clip se usa, cuándo y con qué montaje.
- **Manifest de assets:** qué archivo pertenece al proyecto, ruta relativa, SHA, validación y procedencia.
- **Disco:** bytes que deben coincidir con la SHA del manifest.

## Opciones

| Opción | Ventaja | Problema visto en código | Decisión |
|---|---|---|---|
| A. Ampliar `project-state.json` | un archivo | antes de 3.4A no tenía schema/migración; mezcla inventario repetible y timeline con escrituras distintas | No como inventario único. |
| B. Manifest bajo `materiales/`, referenciado por estado | propiedad por proyecto, auditoría, rutas relativas, licencia junto a bytes | V1 ya escribe cada JSON de forma recuperable, pero no ofrece transacción conjunta ni validación de bytes | **Implementado como cimiento mínimo.** |
| C. Derivar sólo del disco | sin JSON adicional | no conserva URL/licencia/SHA esperada/estado parcial | Descartado. |
| D. Reutilizar índice existente | no duplicar | no existe: banco global enumera sólo vídeo | No disponible. |

## Recomendación materializada en 3.4A

Cierre 3.4A materializa `materiales/assets/manifest.json`, con
`assetManifestVersion`; los futuros archivos aprobados vivirán en
`materiales/assets/<provider>/`. `relativeFile` se resuelve desde la raíz del
proyecto (no desde la carpeta del manifest). `project-state.json` introduce
`schemaVersion`, `projectSubstrate` versionado y referencias de uso/timeline; no
duplica metadata de archivo. El manifest V1 es autoridad de la metadata mínima
del archivo; el estado conserva identidad editorial y montaje.
La identidad visual compilada se proyectará únicamente a extra.sceneSpec,
sustituyendo la propuesta anterior extra.hero. Ver scene-recipe-v1.md.
No se declaran implementados adquisición, asset real, Recipe compiler ni render.

### Ejemplo documental, no productivo

```json
{
  "assetManifestVersion": 1,
  "assets": [{
    "id": "hero-openmoji-<sha12>",
    "relativeFile": "materiales/assets/openmoji/<sha>.svg",
    "sha256": "<sha256 de bytes>",
    "mime": "image/svg+xml",
    "provider": "openmoji",
    "sourceUrl": "https://…",
    "validation": { "mime": "ok", "svgPolicy": "openmoji-pinned" }
  }]
}
```

No guarda posición/escala: pertenecen a `HeroEstructura` (`src/shared/escena.ts:362–393`). No guarda ruta absoluta como identidad.

## Límites vivos y qué queda por probar

V1 ya define schema/migración legacy, validación de rutas relativas confinadas,
auditoría física/estructural mínima y escritura recuperable de cada JSON. Falta
transacción conjunta estado+manifest, SHA real del archivo, MIME/magic, SVG seguro,
alpha y recuperación de `list-projects`. No corrige las rutas absolutas de clips
existentes; esa migración es aparte. No anticipa banco global: duplicados entre
proyectos son coste V1 reconocido hasta medir volumen/licencias.

## Inserción recomendada: OpenMoji y PNG

**OpenMoji:** recomiendo una **release oficial pinneada disponible localmente para la app**, con metadata y SVGs de versión fija; no CDN durante render ni SVGs sueltos en Git. Satisface offline, búsqueda reproducible y atribución. Al construir vídeo se selecciona por metadata y se copia sólo el SVG elegido al proyecto, registrando versión/URL/SHA/licencia. Esta auditoría no verificó paquete/release concreto ni tamaño de build: la integración debe probarlo.

**PNG transparente:** requiere `ProviderSearch → AssetCandidate → DownloadRequest → DownloadedAsset → AssetValidation`. El stock actual aporta orquestación, no un downloader seguro: la nueva capa debe escribir temporal, verificar HTTP/MIME/magic, tamaño, dimensiones, alpha útil y SHA antes de publicar. Si falla, fallback/aviso; nunca HTML como PNG ni Hero ausente con estado de presente.

## Portabilidad y hash

V1 resuelve sólo rutas relativas al proyecto; al moverlo, viajan manifest y bytes. `localFile` no entra en hash; la SHA, estado de presencia y tinte que mueve píxeles sí. Esto impide que ruta distinta invalide identidad y que archivo perdido conserve una clave de imagen presente.
