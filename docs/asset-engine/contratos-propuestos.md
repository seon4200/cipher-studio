# Contratos conceptuales del futuro Asset Engine

**Sólo diseño documental.** No se importa desde `src/`, no cambia estado de proyecto ni habilita descargas.

## Responsabilidades

| Concepto | Responde | No contiene |
|---|---|---|
| `AssetIntent` | qué requiere expresar el subclip | URL, archivo, geometría o licencia resuelta |
| `AssetCandidate` | una respuesta remota posible | bytes locales/uso de escena |
| `DownloadRequest` | una descarga y límites | posición/escala |
| `DownloadedAsset` | bytes temporales obtenidos | aprobación/referencia |
| `AssetValidation` | qué se comprobó de bytes | política/timeline |
| `AssetSourceRecord` | URL, licencia, atribución, riesgo | geometría |
| `ProjectAsset` | archivo aprobado del proyecto | semántica de subclip |
| `SceneHeroReference` | contenido del Hero y píxeles | posición/escala |
| `ProviderPolicy` | capacidad, evidencia y política | archivo/candidato |

## Forma mínima

```ts
type AssetIntent = {
  id: string
  query: string
  kind: 'icon' | 'illustration' | 'transparent-png' | 'photo'
  relation: string
  allowedProviders: string[]
  fallback: 'solar' | 'emoji' | 'no-hero'
}
type AssetCandidate = {
  provider: string; remoteId?: string; sourceUrl: string; downloadUrl?: string
  declaredMime?: string; licenseClaim?: string; attribution?: string
  rightsRisk: 'low' | 'medium' | 'high'
}
type AssetValidation = {
  accepted: boolean; mime: string; byteLength: number; width?: number; height?: number
  hasAlpha?: boolean; alphaUseful?: boolean; contentSha256?: string; reason?: string
}
type ProjectAsset = {
  id: string; relativeFile: string; sha256: string; mime: string; provider: string
  validation: AssetValidation; source: AssetSourceRecord
}
type SceneHeroReference = {
  state: 'present' | 'missing' | 'none'; assetId?: string; sha256?: string
  kind?: 'photo-cutout' | 'illustration' | 'icon'; tint: 'none' | 'accent'
}
```

`AssetSourceRecord` conserva procedencia/licencia/fecha/riesgo. `ProviderPolicy` adopta estados de verificación del ejemplo `docs/spike-hero/provider-contract.ts.example`: capacidad técnica, permiso declarado y habilitación del producto son distintos.

## Lifecycle

1. Semántica existente deriva `AssetIntent` antes de construir `graphicData`.
2. Resolver busca `ProjectAsset` válido y luego candidates de provider permitido.
3. Descarga escribe temporalmente.
4. Validador clasifica MIME/magic, límites, dimensiones, alpha/SVG, SHA y riesgo.
5. Sólo asset aprobado publica a `materiales/assets/<provider>/` y manifest propuesto.
6. Constructor escribe `SceneHeroReference` (SHA/estado/tinte) en `extra.hero`.
7. `hashGrafico` canoniza ese extra (`src/main/index.ts:1157–1190`).
8. Escena resuelve ruta relativa y pinta dentro de Hero de estructura.
9. Falta/fracaso cambia estado, emite aviso y usa fallback; no reutiliza hash de presente.

La estructura conserva `heroe:{x,y,relacion}`, cámara y animación; el asset nunca duplica geometría. V1 no crea clip de imagen: el Hero vive dentro del MP4 de `visual_escena`, como el Visual de hoy.

## Seguridad y caché

Validar `relativeFile` contra raíz de proyecto tras `resolve/realpath`; rechazar absolutos, `..` y symlinks externos. URLs HTTPS/allowlist; validar respuesta antes de publicar. SVG: sólo OpenMoji pinneado sin scripts/recursos externos, o rasterización/sanitización controlada. IA nunca entrega ruta/URL/nombre de archivo. `present+SHA` y `missing` son identidades distintas; ruta distinta con mismos bytes no lo es.
