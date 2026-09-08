# Decisión propuesta — almacenamiento de assets por proyecto

**Estado:** recomendación basada en `c0a9c78`; no es schema ni implementación aprobada.
**Condición:** validar schema/migración y primer flujo OpenMoji antes de declararla definitiva.

## Evidencia que obliga a separar responsabilidades

`project-state.json` guarda el timeline desde `src/renderer/src/main.tsx:1730–1760` y main lo persiste sin schema (`src/main/index.ts:1736–1747`). En la auditoría, sus rutas son absolutas y no hay SHA, licencia, validación o inventario de material. El disco contiene bytes, pero no puede derivar procedencia ni si un archivo está aprobado. No existe índice/manifiesto de assets reutilizable.

No se propone una segunda fuente de verdad para el mismo hecho:

- **Timeline / estado:** qué clip se usa, cuándo y con qué montaje.
- **Manifest de assets:** qué archivo pertenece al proyecto, ruta relativa, SHA, validación y procedencia.
- **Disco:** bytes que deben coincidir con la SHA del manifest.

## Opciones

| Opción | Ventaja | Problema visto en código | Decisión |
|---|---|---|---|
| A. Ampliar `project-state.json` | un archivo | no schema/migración; mezcla inventario repetible y timeline con escrituras distintas | No como inventario único. |
| B. Manifest bajo `materiales/`, referenciado por estado | propiedad por proyecto, auditoría, rutas relativas, licencia junto a bytes | exige transacción, recuperación y validación nuevas | **Recomendado condicionalmente.** |
| C. Derivar sólo del disco | sin JSON adicional | no conserva URL/licencia/SHA esperada/estado parcial | Descartado. |
| D. Reutilizar índice existente | no duplicar | no existe: banco global enumera sólo vídeo | No disponible. |

## Recomendación

Cierre 3.3.5: la recomendación concreta para 3.4A es
materiales/assets/manifest.json, con assetManifestVersion; los archivos aprobados
en materiales/assets/<provider>/. relativeFile se resuelve desde la raíz del
proyecto (no desde la carpeta del manifest). project-state.json introduce
schemaVersion, projectSubstrate versionado y referencias de uso/timeline; no
duplica metadata de archivo. El manifest es autoridad de SHA, validación,
proveedor/licencia y ruta; el estado de identidad editorial y montaje.
La identidad visual compilada se proyectará únicamente a extra.sceneSpec,
sustituyendo la propuesta anterior extra.hero. Ver scene-recipe-v1.md.
No se implementa ni declara probado este reparto documental.

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

## Qué queda por probar

La implementación deberá definir escritura temporal + rename de bytes/manifiesto, recuperación si uno falla, validación de ruta relativa al abrir, schema/migración y audit específico. No corrige las rutas absolutas de clips existentes; esa migración es aparte. No anticipa banco global: duplicados entre proyectos son coste V1 reconocido hasta medir volumen/licencias.

## Inserción recomendada: OpenMoji y PNG

**OpenMoji:** recomiendo una **release oficial pinneada disponible localmente para la app**, con metadata y SVGs de versión fija; no CDN durante render ni SVGs sueltos en Git. Satisface offline, búsqueda reproducible y atribución. Al construir vídeo se selecciona por metadata y se copia sólo el SVG elegido al proyecto, registrando versión/URL/SHA/licencia. Esta auditoría no verificó paquete/release concreto ni tamaño de build: la integración debe probarlo.

**PNG transparente:** requiere `ProviderSearch → AssetCandidate → DownloadRequest → DownloadedAsset → AssetValidation`. El stock actual aporta orquestación, no un downloader seguro: la nueva capa debe escribir temporal, verificar HTTP/MIME/magic, tamaño, dimensiones, alpha útil y SHA antes de publicar. Si falla, fallback/aviso; nunca HTML como PNG ni Hero ausente con estado de presente.

## Portabilidad y hash

V1 resuelve sólo rutas relativas al proyecto; al moverlo, viajan manifest y bytes. `localFile` no entra en hash; la SHA, estado de presencia y tinte que mueve píxeles sí. Esto impide que ruta distinta invalide identidad y que archivo perdido conserve una clave de imagen presente.
