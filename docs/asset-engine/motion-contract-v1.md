# Motion Contract V1 — especificación, sin implementación

Toda función de render futuro depende de tiempo dirigido y presets versionados; no de reloj real, azar sin semilla o carga de red. Se usa el renderer existente y su ciclo (`src/shared/ciclo.ts:29`, `fraccion`).

## Tipos y dominios

```ts
type U01 = number // finito, 0..1; validación obligatoria
type Intensity = 'subtle' | 'medium' | 'strong'
type CycleDivisor = 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12
type Window = { start: U01; duration: U01 } // duration > 0; suma <= 1
type EntryPreset = 'fade-in' | 'fade-slide' | 'slide-left' | 'slide-right' |
  'slide-up' | 'slide-down' | 'scale-in' | 'scale-overshoot' | 'whip-in'
type CyclicPreset = 'float' | 'breathe' | 'soft-rotate' | 'parallax-drift' | 'slow-zoom' | 'sway'
type ExitPreset = 'fade-out' | 'scale-down' | 'scale-cover' | 'slide-out-left' |
  'slide-out-right' | 'slide-out-up' | 'slide-out-down' | 'whip-out'
type EmphasisPreset = 'punch' | 'bounce' | 'shake-short' | 'pulse' | 'tilt-hit' | 'flash'
type EmphasisTrigger =
  | { kind: 'keyword-hit'; normalizedTime: U01; wordId?: string }
  | { kind: 'hero-entry' }
  | { kind: 'manual'; normalizedTime: U01 }
  | { kind: 'narration-pause'; normalizedTime: U01; pauseId?: string }
type AssetEmphasis = {
  preset: EmphasisPreset
  trigger: EmphasisTrigger
  duration: U01
  intensity: Intensity
  reason: string
}
type Sustain =
  | ({ preset: CyclicPreset; cycleDivisor: CycleDivisor; intensity: Intensity } & Window)
  | { preset: 'hold'; start: U01; duration: U01;
      reason: 'narration-pause' | 'dramatic-emphasis' | 'manual' }
  | { preset: 'none' }
type AssetMotionRecipe = {
  entry: Window & { preset: EntryPreset; intensity: Intensity }
  sustain: Sustain
  emphasis: AssetEmphasis[] // longitud 0..1, máximo UNO en toda la escena V1
  exit: ({ preset: ExitPreset; intensity: Intensity } & Window) | { preset: 'none' }
  visibility: { start: U01; end: U01 }
}
```

`emphasis: []` es la representación canónica de none; no se admite además un emphasis con preset none. No hay entrada none en este vocabulario; para 3.6A estático sólo se materializa contenido y visibility, y aún no se declara soporte de este contrato.

## Semántica temporal

Origen 0 = inicio del Visual, 1 = final; se rechazan NaN/infinito/fuera de rango. Visibility exige start < end. Entry y exit deben caber dentro de visibility; sustain inicia al acabar entry y termina antes de exit. Emphasis debe ocurrir durante visibility, sin competir con exit; si no cabe se replantea la receta, no se recorta en secreto.

`hero-entry` significa fin de la entrada del Hero resuelto, nunca requiere normalizedTime. Si no hay Hero (fallback), se elimina ese trigger al compilar la nueva receta. Keyword-hit usa la marca de la palabra dentro del subclip dividida por su duración. Los ejemplos son timings editoriales hipotéticos, no alineación de voz medida. Narration-pause requiere intervalo observado y puede iniciar hold.

Duraciones normalizadas editoriales no autorizan CSS con segundos literales. Al compilar una ventana a animación, se resuelve a un divisor legal del ciclo y se guarda el timing efectivo en RenderSpec; si la cuantización ya no cabe, se replantea o rechaza. No estirar el ciclo para encajar. Las entradas/salidas/énfasis son envolventes de una pasada; no necesitan igualar primer/último frame. El sustain cíclico conserva período global `ciclo / cycleDivisor`, incluso dentro de una ventana de visibilidad; jamás período libre ni período calculado sobre ventana recortada. Hold/visibility son ventanas de estado, no duraciones de CSS inventadas.

La ventana start/duration de sustain es asimismo una puerta de visibilidad del
movimiento, no su período CSS. Si un emphasis cae dentro de un hold, esa receta
se rechaza o divide explícitamente el hold en el compilador futuro: quietud y
shake simultáneos no son una lectura válida. Entre fin de sustain e inicio de
exit se conserva el último estado definido; el preset debe asegurar continuidad.

3.6B tendrá que verificar continuidad de fase al entrar/salir de sustain y hold. Una ventana partial no prueba cierre cíclico: el preset completo debe cerrarlo y la envolvente ocultar o enlazar los extremos.

## Presets acotados

Intensidad elige amplitudes de catálogo futuro medidas por preset/rol; no se aceptan amplitudes, ángulos, velocidad o curvas libres en Recipe. Los números de timing pertenecen a U01; los divisores al enum. V1 prioriza transform y opacity; sin blur pesado, morph, displacement o 3D. Shake requiere motivo semántico documentado; no animar todo porque sí.

| Rol | Movimiento deseado |
|---|---|
| Hero | entrada principal, float/scale/parallax, énfasis principal |
| Support | entrada desfasada y amplitud menor, emphasis sólo si Hero no usa ninguno |
| Decorator | pulse, bounce, micro-rotate; line-draw futuro procedural |
| Text | conector antes de keyword, cierre opcional posterior |
| Background | slow zoom/pan, presupuesto visual 30–50% del Hero como hipótesis por calibrar |

`micro-rotate` se mapea a soft-rotate subtle. `line-draw` no se cuela en AssetMotionRecipe: es un preset procedural reservado para líneas de estructura y pendiente de implementación. `slow-pan` de background se traduce a cámara compatible, no segunda cámara libre.

En hold, otra capa conserva micro-movimiento excepto hold dramático explícito de escena; se declara la excepción y su razón. Con Hero inmóvil, la referencia 30–50% corresponde a su presupuesto nominal, no a multiplicar cero. Estas proporciones no son magnitudes físicas ya medidas.

RenderTier: standard/reduced son propuestas de presets soportados. Una modificación por coste necesita aviso y nueva identidad; si no puede renderizarse, fallo explícito/fallback elegido, nunca frames aceptados con contenido omitido.

## Sincronía y transiciones

SceneTransitionIntent = none | hard-cut | scale-cover | whip-pan | flash | match-shape | shrink-to-anchor.
Es una intención entre escenas A y B; no ejecuta por sí misma una transición. El compilador de timeline futuro valida ambas escenas, duración, overlap, continuidad, handles y hash compuesto. No implementarla en el primer Photo Hero.

Exit scale-cover dentro de A no equivale automáticamente a transición A→B scale-cover. Entry/sustain/emphasis/exit son internos. Música y ducking son política futura de audio/timeline, fuera de SceneRecipe.

## Perfil técnico anterior a Motion: 3.6A

3.6A materializará RenderMotion con motionRevision: "static-spike-v1" y
visibility: {start: 0, end: 1}. No entry none ni presets ficticiamente soportados.
La unión animada sólo admite revisiones de catálogo distintas de static-spike-v1
y exige AssetMotionRecipe. 3.6B compilará el ciclo completo y verificará envolventes.
Hard-cut con exit: {preset: "none"} es válido: el corte pertenece al timeline;
no se exige salida visible a todas las escenas.

El validador documental comprueba ventanas finitas y contenidas, sustain después
de entry y antes de exit, emphasis posterior a entry/dentro de visibility/sin
invadir exit. Comprueba intersección de intervalos de hold y emphasis, no rechaza
su mera coexistencia si no se solapan. Un hero-entry requiere Hero y no acepta
normalizedTime; keyword-hit coincide con text.timing.keywordStart del ejemplo.
renderTier y motionPresetRevision se resuelven antes del hash.
