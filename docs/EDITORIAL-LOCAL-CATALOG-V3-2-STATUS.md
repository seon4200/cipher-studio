# Catálogo editorial local · revisión V3.2 y punto de reanudación

Fecha: 2026-09-25. Esta nota documenta una entrega parcial del objetivo de 1.265 recursos; no declara completado el catálogo.

## Estado verificable

- Raíz de catálogo: `C:\graphify\_cipher-editorial-catalog-v1-250`, con `inventory.json` y `extension-v2/active.json`.
- Activos: 250 base + 140 extensiones = 390. Por rol: 102 Supports, 207 Heroes, 33 papeles traseros, 15 collages frontales, 26 máscaras de acento, 7 fondos.
- Faltan 875 respecto a 1.265. P20-22 está pausado y no figura en el puntero activo. Su plan, masters, rechazos y prompts literales viven en `C:\graphify\_cipher-editorial-catalog-1265\library-extension\batches\batch-p20-22`.
- Galería activa buscable: `C:\graphify\_cipher-editorial-catalog-v1-250\CATALOGO-COMPLETO-VIGENTE-390.html`. Los candidatos pausados no aparecen como admitidos.

## Inserción productiva

El proveedor V2 carga el índice/metadata del puntero activo sin decodificar todos los PNG por cada escena; `resolveAsset()` y `verifyAll()` siguen comprobando SHA y contenido antes del uso/activación. IDs repetidos entre base y extensiones se rechazan. El perfil editorial local continúa opt-in y utiliza las seis familias conectadas; no se añadió otro renderer ni se tocó la biblioteca histórica de 250.

La nueva revisión `editorial-local-bank-2026-09-v3.2` congela geometría más visible del papel/acento y permite envolver etiquetas largas de Supports. Sólo las generaciones nuevas usan V3.2; SceneSpecs con V3/V3.1 mantienen sus rectángulos y presentación previos. La selección de acento por relación semántica se activa únicamente si el llamador pide V3.2. La selección antigua continúa usando afinidad de aspecto. La identidad contiene la revisión y geometría visibles.

## Evidencia y límite

`C:\graphify\_cipher-editorial-catalog-1265\evidence\batch-p20-21-active-390\results.json` contiene 390/390 hashes verificados, selección contextual de cromatógrafo, MP4 corto vertical/horizontal, QC sin findings y cero intentos de red tras materialización. La galería y los fotogramas deben revisarse visualmente; el pase técnico no implica aprobación estética. El Support «micropipeta automática» dejó de cortarse en vertical tras el ajuste versionado.

P20-22 generó seis archivos para cuatro conceptos: un Hero y una diapositiva se conservan como candidatos sin importar; borrador, puntero y pantalla se rechazaron por recorte. La pantalla volvió a fallar tras un retry con margen explícito. Detener la admisión aquí evita contar imágenes incompletas y replicar el defecto en cientos de Supports. El ledger externo fija SHA, prompt literal y motivo por intento.

## Recuperación

Backup del repositorio anterior al trabajo: `C:\graphify\_cipher-editorial-catalog-1265\pre-catalog-1265.bundle`. Copia del puntero activo previo a P20-21: `C:\graphify\_cipher-editorial-catalog-v1-250\extension-v2\active-before-p20-21-20260925-093603.json`. No cambiar el puntero sin repetir preview, verificación completa y render dirigido. Los proyectos reales y `project-state.json.bak` no forman parte de esta entrega.

## Pendiente antes de continuar

Resolver la calidad de los iconos al borde con cambios de encuadre o sustituir conceptos por otros útiles, sin aceptar recortes; completar P20-22 (8/9/1/1/1), validar/importar como lote atómico y seguir el presupuesto exacto del ledger externo. Las 11 familias no conectadas, el flujo narrado completo y la aprobación estética humana quedan fuera del alcance validado aquí.
