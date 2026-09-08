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
type SceneRecipe = {
  id: string
  sceneIntentRef: string
  projectSubstrateRef: string
  styleVariant: SceneStyleVariant
  densityIntent: 'minima' | 'baja' | 'media' | 'alta' | 'saturada'
  text: {
    connector?: string
    keywordRef: 'SceneIntent.keyword'
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

## Resolución propuesta

```ts
type ResolvedSlot =
  | { slotId: string; state: 'present'; assetId: string; sha256: string;
      mime: string; kind: string; bounds: SubjectBounds; source: AssetSourceRecord }
  | { slotId: string; state: 'procedural'; presetId: string; revision: string }
  | { slotId: string; state: 'missing'; reason: MissingReason }
  | { slotId: string; state: 'omitted'; reason: 'optional' }
type ResolvedScenePlan = {
  recipeRef: string
  slots: ResolvedSlot[]
  fallbackDecision: string
}
```

El resolver valida bytes y conserva procedencia en el inventario propuesto. Missing no admite SHA/assetId de un supuesto presente. Los roles obligatorios ausentes fuerzan nueva receta de fallback; no se entrega una composición rota.

RenderSpec conceptual: `specVersion`, `renderTier` (`standard | reduced`), snapshot visual del sustrato, `direccion` completa (estructura/fondo/cámara/densidad/ritmo/tipografía), semilla/instancia y parámetros resueltos, texto y tiempos normalizados, slots efectivos (estado, SHA, MIME, bounds usados, fitPolicy, tint y motion), decisión de fallback visual. La estructura sigue produciendo toda geometría final. Presets y revisiones cerrados; sin CSS libre.

```ts
type RenderAsset =
  | { slotId: string; state: 'present'; sha256: string; mime: string;
      kind: 'photo-cutout' | 'illustration' | 'icon'; bounds: SubjectBounds;
      fitPolicy: FitPolicy; tint: 'none' | 'accent'; motion: AssetMotionRecipe }
  | { slotId: string; state: 'procedural'; presetId: string; revision: string;
      motion: AssetMotionRecipe }
  | { slotId: string; state: 'missing' | 'omitted' }
type RenderSpec = {
  specVersion: 'scene-render-v1'
  renderTier: 'standard' | 'reduced'
  presetRevision: string
  substrateVisual: ProjectSubstrate
  direccion: Direccion // tipo vigente; IDs de registros existentes
  semilla: number // uint32 finito
  text: { connector?: string; keyword: string; closing?: string;
    alignment: 'left' | 'center'; maxLines: 2 | 3;
    timing: { connectorStart?: U01; keywordStart: U01; closingStart?: U01 } }
  slots: RenderAsset[]
  fallbackVisual: 'none' | 'editorial-text'
}
```

Forma conceptual aún sin consumidor. ID administrativo/assetId se usa para resolver
y trazar en ResolvedScenePlan; RenderSpec puede omitirlo y usar SHA/slotId para no
invalidar al renombrar un registro. Ordenar slots por ID estable y ordenar capas por
rol/estructura, nunca por orden de llegada de descargas. Si la instancia no se deriva
íntegramente de dirección+semilla+revisión, sus parámetros deben materializarse también.
`substrateVisual.brandMarkId` no basta para una marca externa: compilarla como slot
con SHA o preset procedural versionado antes de aceptar el spec.

`extra.sceneSpec` sería la única representación nueva del resultado. No duplicarlo también en `extra.hero` y `extra.direccion`: el adaptador futuro deberá definir una proyección canónica única hacia las props existentes. 3.3 propuso extra.hero para un spike simple; 3.3.5 generaliza a roles y sustituye esa propuesta al implementarse. Nada de esto existe en main actualmente.

## Cadena de identidad propuesta

`Intent → Recipe → selección/validación → ResolvedScenePlan → RenderSpec → graphicData.extra → canonizar/hashGrafico → escena real → MP4 → timeline`.

`src/main/index.ts:1157` hashea todo extra y sistema; `src/renderer/src/composiciones/escena.tsx:706` tiene además `claveDe` para el árbol React. Ambos consumidores deben ver la proyección visual. Un hash nuevo de archivo no corrige por sí solo una clave React incompleta.

SHA se calcula sobre contenido validado antes de RenderSpec. Si hay rasterización, conservar SHA original en procedencia y SHA del derivado realmente renderizado en RenderSpec. Bounds que afectan el ajuste también se incluyen, con versión de medición; mismo SHA con distintos bounds puede cambiar píxeles. Ruta, fuente URL y licencia permanecen fuera de identidad, salvo texto de atribución visible que sí se materializa.

Revalidar presencia antes de consumir material en render. Si desaparece o cambia, resolver nuevamente, emitir aviso y construir otra identidad; nunca conservar present mientras se omite imagen. Bytes verificados deben mantenerse disponibles durante la captura. Un cambio de tier requiere decisión explícita, nueva spec/hash y aviso; no degradación oculta.

Sin colores hex por escena. La paleta del sustrato se pasa como sistema del hash existente; duración/fps/dimensiones/modo/codec/versión siguen siendo parámetros externos del hash.

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
