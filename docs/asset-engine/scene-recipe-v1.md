# Scene Recipe V1 — cuatro capas y un solo dibujo

Especificación propuesta, no contrato de producción. No se modifican prompts ni código. La guía editorial es el encargo 3.3.5; las compatibilidades son hipótesis a probar con el renderer real.

## Separación y autoridad

| Capa | Contiene | Excluye |
|---|---|---|
| SceneIntent | frase, idea, concepto abstracto, metáfora concreta, palabra fuerte | proveedor, URL, archivo, SHA, geometría |
| SceneRecipe | referencia a Intent/sustrato, estilo variante, layout intent, texto, slots, motion, timing, fallback | proveedores, URLs, paths, bytes, licencias resueltas, coordenadas |
| ResolvedScenePlan | Recipe + assets concretos por slot; assetId, SHA, MIME, estado, procedencia y resultados de validación | React/CSS; ruta como identidad |
| RenderSpec | resultado determinista ya seleccionado: dirección completa, contenido efectivo, fuentes, timing, assets/SHA/tinte, tier y revisiones | consultas, proveedores como criterio de dibujo, URLs, rutas |

La receta referencia SceneIntent en vez de copiar narrative: `keyword` y texto visible se resuelven desde la misma intención. Así no pueden divergir dos palabras fuertes. El RenderSpec conserva el texto materializado que realmente se dibuja.

```ts
type SceneIntent = {
  sceneIntentVersion: 1
  id: string
  phrase: string
  idea: string
  abstractConcept: string
  concreteMetaphor?: string
  keyword: string
}
type LayoutIntent = 'sandwich' | 'hero-bottom' | 'negative-space' |
  'editorial-left' | 'object-dominant' | 'evidence-board'
type BackgroundFamily = 'technical-grid' | 'aged-paper' | 'radial-gradient' |
  'dark-lines' | 'soft-editorial'
type SceneStyleVariant = {
  layoutIntent: LayoutIntent
  energy: 'low' | 'medium' | 'high'
  textureVariant?: 'base' | 'fine' | 'coarse'
  motionFamily?: 'measured' | 'organic' | 'impact'
}
type VisualMode = 'asset-led' | 'editorial-text'
type SceneRecipe = {
  sceneRecipeVersion: 1
  visualMode: VisualMode
  id: string
  sceneIntentRef: string
  projectSubstrateRef: string
  styleVariant: SceneStyleVariant
  densityIntent: 'minima' | 'baja' | 'media' | 'alta' | 'saturada'
  text: {
    connector?: string
    closing?: string
    alignment: 'left' | 'center'
    maxLines: 2 | 3
    timing: { connectorStart?: U01; keywordStart: U01; closingStart?: U01 }
  }
  assetSlots: SceneAssetSlot[]
  backgroundIntent: { family: BackgroundFamily; motion: 'slow-zoom' | 'slow-pan' | 'none' }
  transitionIntent: SceneTransitionIntent
  fallback: NullAssetStrategy
}
type SceneAssetSlot = {
  id: string
  role: 'hero' | 'support' | 'decorator' | 'badge' | 'texture'
  intent: string
  preferredKind: 'icon' | 'illustration' | 'photo-cutout' | 'procedural'
  importance: 'primary' | 'secondary' | 'ambient'
  optional: boolean
  motion: AssetMotionRecipe
  fallback: SlotFallback[]
}
```

`U01`, motion, triggers y reglas numéricas: motion-contract-v1.md. Tipos de fallback: null-asset-strategy-v1.md. No hay enums implementados por crear estos textos. `densityIntent` es una decisión semántica justificada por roles/contenido, no un sorteo para cubrir cinco valores.

## Resolución y modo efectivo

`asset-led` exige exactamente un Hero obligatorio. `editorial-text` tiene cero
Hero: slots vacíos o sólo texture/decorator procedural opcional; fallback
editorial, sin fingir metáfora ni mantener una ranura vacía. El modo efectivo
persiste en ResolvedScenePlan y RenderSpec. La tabla de densidad asset-led no
obliga a añadir objetos a una escena tipográfica.

```ts
type Resolution<T> = { requested: T; effective: T; reason: string }
type ResolvedSlot =
  | { slotId: string; state: 'present'; assetId: string; sha256: string;
      mime: string; kind: 'photo-cutout' | 'illustration' | 'icon';
      bounds: SubjectBounds; sourceRef: string; validationRef: string }
  | { slotId: string; state: 'procedural'; presetId: string; revision: string }
  | { slotId: string; state: 'missing'; reason: MissingReason }
  | { slotId: string; state: 'omitted'; reason: 'optional' }
type ResolvedScenePlan = {
  recipeRef: string
  visualMode: VisualMode // efectivo
  slots: ResolvedSlot[]
  densityResolution: Resolution<Densidad>
  paletteResolution: Resolution<NombreSistema>
  fontPairResolution: Resolution<FontPairId>
  layoutResolution: { requested: LayoutIntent; structureId: string; reason: string }
  fallbackDecision: { strategy: 'none' | 'editorial-text'; reason?: MissingReason }
}
```

Source/validation refs resuelven registros de procedencia y validación del
inventario, no criterios de React. Todo desvío exige motivo no vacío; incluso
coincidencia usa razón de compatibilidad. No se sortean densidades por cuota.
Missing no conserva SHA de presente. Un Hero obligatorio no resuelto obliga a
compilar una receta editorial nueva, no a dejar asset-led roto.

El compilador futuro materializa layoutIntent → estructura real;
densityIntent → direccion.densidad; fontPairId → fuentes efectivas por rol;
paletteId → sistema. Sólo el resultado efectivo gobierna píxeles. Por ejemplo,
baja→saturada o clinico→otro sistema sin motivo es inválido. La keyword efectiva
se copia de SceneIntent.keyword; Recipe sólo tiene sceneIntentRef, sin keywordRef
literal ni segunda keyword. Cambio de fuente keyword necesita decisión explícita
y materialización; direccion.tipografia debe concordar con el rol keyword.

## Identidad visual y localización de bytes

```ts
type RenderMotion =
  | { motionRevision: 'static-spike-v1'; visibility: { start: 0; end: 1 } }
  | { motionRevision: string; recipe: AssetMotionRecipe }
type RenderAssetIdentity =
  | { slotId: string; role: SceneAssetSlot['role']; state: 'present'; sha256: string; mime: string;
      kind: 'photo-cutout' | 'illustration' | 'icon'; bounds: SubjectBounds;
      fitPolicy: FitPolicy; tint: 'none' | 'accent'; motion: RenderMotion }
  | { slotId: string; role: SceneAssetSlot['role']; state: 'procedural'; presetId: string; revision: string;
      motion: RenderMotion }
  | { slotId: string; role: SceneAssetSlot['role']; state: 'missing' | 'omitted' }
type RenderAssetLocator = { slotId: string; assetId: string; relativeFile: string }
type RenderBindings = { assets: RenderAssetLocator[] }
type RenderSpec = {
  renderSpecVersion: 1
  visualMode: VisualMode
  renderTier: 'standard' | 'reduced'
  revisions: {
    motionPresetRevision: string; layoutCompatibilityRevision: string
    boundsMeasurementRevision: string; textLayoutRevision: string
    fitPolicyRevision: string; tintRevision: string
    fontMetricsRevision: string; paletteRevision: string
  }
  sistema: NombreSistema // efectivo; única autoridad de paleta
  direccion: Direccion // IDs efectivos de estructura/fondo/cámara/densidad/ritmo/tipografía
  fontIds: { connector?: string; keyword: string; closing?: string }
  semilla: number // uint32 finito
  instanceParameters: Record<string, number> // claves/rangos cerrados por pieza; no números libres
  text: {
    connector?: string; keyword: string; closing?: string
    alignment: 'left' | 'center'; maxLines: 2 | 3
    timing: { connectorStart?: U01; keywordStart: U01; closingStart?: U01 }
  }
  slots: RenderAssetIdentity[]
  fallbackVisual: 'none' | 'editorial-text'
}
type CompiledScene = { visual: RenderSpec; bindings: RenderBindings }
```

Tipos conceptuales, no importables por producción. El caso estático se discrimina
por motionRevision exacta; el catálogo animado excluye ese ID reservado y exige
recipe. Los IDs de fuentes son IDs reales, no familias libres. Bounds lleva
boundsMeasurementRevision (definido en layouts-editoriales-v1.md), que debe
coincidir con la revisión de RenderSpec. No se duplica una segunda densidad:
únicamente direccion.densidad; densityResolution es traza de compilación.

CompiledScene.visual → graphicData.extra.sceneSpec → canonizar/hashGrafico →
clave React → composición real → MP4/MOV → timeline.
CompiledScene.bindings sólo localiza bytes: relativeFile es relativo a la raíz
del proyecto, confinado tras resolve/realpath. Hay exactamente un locator por
slot present y ninguno para missing/omitted/procedural. Antes del render,
verificar presencia, MIME y SHA contra la identidad; mantener esos bytes
verificados disponibles durante toda la captura. Ni una nueva ruta ni assetId
administrativo cambian identidad si los bytes y el spec coinciden.

`extra.sceneSpec` es la única proyección visual nueva. No duplicar en
extra.hero, extra.collage ni extra.direccionNueva. La propuesta 3.3 extra.hero
queda sustituida, no simultánea. La direccion existente se consume/adapta desde
sceneSpec, nunca se vuelve a sortear. Si las props heredadas necesitan sistema,
direccion o tipografía, se proyectan desde spec y se comprueba igualdad;
no se aceptan dos autoridades contradictorias. El renderer NO reinterpreta
layoutIntent, densityIntent, preferredKind, allowedProviders, metáfora, perfil
ni aliases. Estructura/presets versionados son el único emisor de geometría.

`src/main/index.ts:1157` hashea extra y sistema;
`src/renderer/src/composiciones/escena.tsx:706` usa además claveDe.
Ambas claves futuras deben consumir la misma proyección visual. No basta
actualizar la caché de archivo y dejar antigua la del árbol React.

SHA es del contenido validado realmente renderizado. Si se deriva/rasteriza,
el SHA original queda en procedencia y el derivado en RenderSpec. Si falta o
cambia el archivo tras resolver: aviso, invalidar binding y volver a resolver;
rechazar esa captura o recompilar fallback con otra identidad, nunca pintar
sin Hero bajo present. Proveedor, URL, licencia, fecha y ruta no entran en hash;
atribución visible sí se materializa como texto efectivo. Orden estable de slots
por ID; orden de capas por estructura/rol, no por llegada de descargas.

Roles efectivos se guardan en cada identidad, no se infieren del nombre del slot.
Decorator/texture families se compilan a presets/revisiones procedurales concretos
o al fondo efectivo; no quedan IDs editoriales por interpretar. El estado asset-led
requiere Hero presente/procedural; un Hero missing obliga a modo editorial-text.
Los estados missing/omitted sólo documentan slots que no dibujan, nunca autorizan
al renderer a buscar un sustituto.

BrandMark se resuelve como slot SHA/preset versionado, no ID opaco. Tamaños,
tratamientos y distribución de texto derivan de estructura+revisión+fuentes;
si no quedan determinados, se materializan antes del hash. Lo mismo para
parámetros de instancia: sólo claves/rangos legales de pieza, no CSS.
renderTier se decide antes del hash. Cambio por rendimiento exige nueva spec,
aviso y clave; nunca degradación silenciosa por carga de máquina.
Duración/fps/dimensiones/modo/codec/VERSION_PLANTILLAS siguen en parámetros del
hash existente. Nada de esta cadena nueva está implementado.

## Versiones y revisiones

| Campo | Autoridad / efecto en identidad |
|---|---|
| sceneIntentVersion | schema semántico; no hash si el resultado visual no cambia |
| sceneRecipeVersion | schema editorial; no hash por sí solo, resultado materializado sí |
| projectSubstrateVersion | schema de estado; compilar IDs/revisiones efectivos, no duplicar snapshot semántico en spec |
| assetManifestVersion | schema inventario; no hash, contenido validado sí |
| openmojiCatalogVersion | procedencia/selección pinneada; SHA final identifica bytes, cambios de elección se materializan |
| renderSpecVersion | entra en extra.sceneSpec, contrato visual |
| motionPresetRevision | amplitudes/easings/continuidad/timing efectivo; entra en spec |
| layoutCompatibilityRevision | selección y contrato geométrico versionado; entra en spec |
| boundsMeasurementRevision | algoritmo y bounds utilizados; entra en spec |
| textLayoutRevision | presupuesto, métricas y distribución; entra en spec |
| fitPolicyRevision | subject-fit/contain/etc.; entra en spec |
| tintRevision, fontMetricsRevision, paletteRevision | algoritmos de tinte, archivos/métricas de fuentes y sistema de color; entran en spec |

Mismo PNG + nuevo subject-fit, easing, bounds, tinte o métrica puede cambiar
píxeles: SHA sola no basta. Las revisiones se fijan al compilar, no se leen de
un catálogo mutable durante render. Cambios sólo de evidencia/licencia no
invalidan imagen salvo que modifiquen texto visible. No se sube versión
productiva por crear esta especificación.

## Roles y densidades

| Rol | Función y jerarquía |
|---|---|
| Hero | objeto simbólico dominante, profundidad principal entre objetos, entrada y énfasis principal |
| Support | completa metáfora con menor escala/contraste/movimiento, no compite |
| Decorator | flechas, líneas, cruces, código o cinta; aporta relación sin inventar contenido |
| Badge | firma/marca editorial secundaria, nunca prueba de autoridad ficticia |
| Texture | patrón de fondo; no objeto dominante ni atajo para aumentar semántica |

Mayor profundidad del Hero es intención futura: hoy comparte capa con estructura. No se inventan coordenadas ni profundidades en el asset.

| Densidad | Presupuesto editorial propuesto |
|---|---|
| minima | 1 Hero + 1 detalle gráfico pequeño |
| baja | 1 Hero + Support opcional |
| media | 1 Hero + 1 Support + 1 Decorator |
| alta | 1 Hero + 1 Support + hasta 2 Decorators |
| saturada | máximo 4 elementos semánticos; aumenta textura, líneas, relaciones y motion acotado |

Hipótesis perceptiva, no medición. Elemento semántico = entidad que comunica información independiente, aunque se etiquete decorator; textura repetida no cuenta. No esconder objetos extras en una textura. Badge opcional ocupa presupuesto si añade información independiente.

Hoy `DENSIDAD_A_N` (`src/shared/escena.ts:965`) devuelve 1/3/5/8/14 decoradores; no es el número de assets. El adaptador futuro debe separar presupuesto semántico y decoración procedural antes de aplicar esta tabla. Fallback tipográfico puede tener cero assets y queda exento del requisito Hero.
