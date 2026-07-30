# CIPHER Studio — Plan Maestro de Implementación
### Proyectos: A) Transiciones al exportar · B) Gráficos como clips (HyperFrames) · C) Vibes AI
### Creado: 24 julio 2026 · Última actualización: 24 julio 2026 (sesión Claude Code)
### Documento portátil: sirve para continuar en CUALQUIER chat nuevo. Sube este archivo y di "vamos en la Fase X del Proyecto Y".

> **NOTA:** este archivo no existía en `C:\Proyectos\mi-app\cipher-studio`. Se creó ahí el 24/07/2026 a partir del texto pegado en el chat, más lo hecho en esa sesión. Si tienes otra copia en otra PC, esta es ahora la buena: la del repo.

---

## 0. CONTEXTO DEL PROYECTO (leer siempre al retomar)

**CIPHER Studio**: editor de video IA de escritorio. Stack: Electron + React + TypeScript + Vite + Tailwind.
- Frontend: `src/renderer/src/main.tsx` (~6800 líneas)
- Backend: `src/main/index.ts` (~2790 líneas)
- Repo: GitHub `seon4200/cipher-studio`
- **Ruta local: `C:\Proyectos\mi-app\cipher-studio`** (fuera de OneDrive)
- Log de debug: `cipher-studio/generation-debug.log`

**Flujo de trabajo**: el usuario NO edita código. Usa un agente IA (Antigravity, o Claude Code que lee/edita/ejecuta directo).

**REGLAS DE ORO (no negociables):**
1. Un cambio a la vez. Probar entre fases. Nunca mezclar fases.
2. Verificar duplicados después de CADA cambio. Al reemplazar un bloque, eliminar el viejo por completo.
3. Commit después de cada fase **verificada**. `git push` al cerrar sesión.
4. Si algo se rompe: `git checkout -- <archivo>`. Revertir SOLO lo de la fase actual. **Antes de revertir, comprobar qué se perdería y guardar el diff como patch** (ver Lección 1 abajo).
5. Producto comercial: nada puede romper el export. Todo fallo debe degradar elegante, nunca crashear.
6. **Compilar no es funcionar.** Verificar el comportamiento real, no el build.

**Estado verificado (commits en master, 24 julio 2026):**
```
6294a8f fix: repartir las transiciones a lo largo del video, no amontonadas al inicio
50ea4ac fix: DeepSeek retiro deepseek-chat — migrar a deepseek-v4-pro sin razonamiento
ebfca7b feat: A1 mapa de transiciones por indice en export (solo lectura + logs)
eb6b66e feat: XFADE_MAP + assignedTransitions/transitionDuration llegan al export   <- FASE A0
15e9bde feat: modales de export en gris profesional
b0c1bb1 feat: modal de progreso de exportacion
3517e96 feat: export con normalizacion individual + concat remux
```
Working tree limpio salvo `dist/index.html`, que es artefacto de build trackeado en git y se ensucia en cada `npm run build` (preexistente, sin arreglar).

**Export actual (funciona, medido):** 76-79 clips → ~37-41s, 54-81MB según contenido.

**Líneas clave en `src/main/index.ts`** (verificar con Select-String, se mueven):
- ~1331: handler `export-video`
- ~1334-1352: `XFADE_MAP` (**38** transiciones, no 37) + `mapTransition()` + `trDuration` + `hasTransitions`
- ~1443-1445: `const videoOnly` (filtra `c.path && type!=='audio' && type!=='graphic' && category!=='v2_overlay'`)
- ~1447-1473: **`transitionByIndex` + logs `[EXPORT-TR]`** (FASE A1)
- ~1490-1520: loop de normalización (`normalizedPaths`)
- ~1525-1560: lista concat + comando final (`-c copy` + audio maestro)

**Frontend (`main.tsx`), sistema de transiciones (NO TOCAR los nombres):**
- L500 `transitionDuration` (0.5) · L511 `assignedTransitions` (keys `idClipA->idClipB`)
- L513-524 `selectedTransitions` (38 nombres GL custom — hay previews CSS y 2 paneles duplicados que dependen de ellos)
- L2780 `handleClearTransitions` · L2785 `handleBuildTransitions`
- L2466 `handleExportClick` — ya envía `assignedTransitions` y `transitionDuration`

---

# PROYECTO A — TRANSICIONES AL EXPORTAR

**Objetivo:** las transiciones asignadas se ven en el video EXPORTADO. Preview no importa. Audio jamás se desincroniza. Escalable a 560+ clips.

**Decisión de diseño (auditada):** NO usar un `filter_complex` gigante (Windows corta comandos en 32K chars). En su lugar: **mini-renders xfade independientes**.

**La matemática que garantiza sincronización:**
```
body_A = slotA − 0.25s  |  transición = 0.5s  |  body_B = slotB − 0.25s
(slotA − 0.25) + 0.5 + (slotB − 0.25) = slotA + slotB  → duración EXACTA
```
Material del solape con **frame clonado** (`tpad`). **offset=0 SIEMPRE** en cada mini-xfade → cero error acumulado.

---

### FASE A0 — Commit del estado actual — ✅ HECHA
Commit `eb6b66e`. XFADE_MAP + firma + envío desde frontend guardados.
**Checkpoint A0:** ☑ commit hecho

---

### FASE A1 — Mapear transiciones a pares de índices — ✅ HECHA Y VERIFICADA
Commit `ebfca7b`. Se construye `transitionByIndex` tras la declaración de `videoOnly`, solo lectura + logs.

Se implementó la **variante con log ampliado** (no la del plan original), que distingue los tres modos de fallo posibles en vez de solo contar pares.

**Resultado real medido (export del 25/07 03:23 UTC, 76 clips, 50%):**
```
[EXPORT-TR] Pares con transicion: 38 de 75 cortes. Detalle: 0:smoothup, 1:fadegrays, 2:pixelize, ...
[EXPORT-TR] DIAG huerfanas: 0/38 | ordenado por startSeconds: true | v2_overlay excluidos: 0 | sin path excluidos: 0
```
Los IDs cuadran perfecto entre frontend y backend. **Luz verde para A2.**

**Reparto verificado en la app (export del 25/07 19:01, 79 clips, 50%):** `Detalle: 1:pixelize, 3:diagtl, 5:hblur, 7:wipeleft, 9:radial...` — índices salteados de dos en dos, ya no consecutivos. 39 de 78 cortes, último en el corte 77 de 77. Confirma el fix `6294a8f`.

**Checkpoint A1:** ☑ log correcto · ☑ reparto verificado en la app · ☑ commit · ☐ **regresión al 0% SIGUE PENDIENTE**

> Comprobado el 29/07: el log **no se escribe desde el 25/07 14:02**. La línea `[EXPORT] Transiciones asignadas` (~L1352) se emite **antes** del diálogo de guardar, así que hasta un export cancelado dejaría rastro. No hay ninguno → el handler de export no se ha invocado. La regresión al 0% no se ha corrido todavía.

**Riesgos que A1 despejó (documentar por si reaparecen):**
- El filtro del frontend (`handleBuildTransitions`) y el del backend NO son idénticos: el backend además exige `c.path`, excluye `v2_overlay` y **no ordena**. En este proyecto coincidieron, pero en un proyecto de Sync Perfecta las transiciones se asignan entre clips `v2_overlay` (L4120) que el backend descarta → saldría `Pares: 0`. El DIAG lo distingue.

---

### FASE A2 — Normalización consciente de transiciones — ⬜ SIGUIENTE

**Qué:** dentro del loop de normalización, cuando el clip i tiene transición DESPUÉS (`transitionByIndex[i]`) o ANTES (`transitionByIndex[i-1]`), producir:
- `tail_i.mp4` (0.5s): últimos 0.25s + 0.25s de frame clonado → `tpad=stop_mode=clone:stop_duration=0.25`
- `head_i.mp4` (0.5s): frame clonado 0.25s + primeros 0.25s → `tpad=start_mode=clone:start_duration=0.25`
- El `body` se recorta: `-ss 0.25` si tiene head, `-t (dur − 0.25)` si tiene tail.
- Clips SIN transición: exactamente igual que hoy.

**Obligatorio:**
- Tails/heads se generan DESDE el clip ya normalizado (mismo fps/res/codec).
- **`setsar=1` en la normalización antes de cualquier xfade** (si un clip trae SAR ≠ 1:1, xfade falla o da artefactos aunque las dimensiones coincidan).
- Si el clip dura < 1.0s → NO aplicar transición en ese lado (corte seco).

> ### ✅ PREMISA DEL SLOT — MEDIDA Y RESUELTA (29/07/2026)
> Se midieron con `ffprobe` los **79 clips** del proyecto `jhjhgjh-1785005691088` (el del export del 25/07) contra su `durationSeconds`.
>
> **El archivo dura MÁS que el slot, no menos** (la hipótesis inicial tenía el signo invertido): 49 de 79 más largos, 29 exactos, 1 más corto.
>
> | categoría | n | delta medio | máx | exactos |
> |---|---|---|---|---|
> | **original** (`-c copy`, ~L2340) | 19 | **+0.110s** | +0.167s | **0 de 19** |
> | **stock** (recodificado, ~L2313) | 60 | +0.011s | +0.04s | 29 de 60 |
>
> **Causa:** `ffmpeg -ss X -i v -t D -c copy` no puede cortar en un punto arbitrario; se extiende hasta el siguiente keyframe y el archivo sale **largo**. Por eso los originales fallan en 19 de 19 y el stock (que se recodifica) acierta en la mitad.
>
> **Consecuencia para el diseño de A2 — el `tpad` con frame clonado es CORRECTO:** hay sobrante, pero **ningún clip alcanza los 0.25s** que harían falta por lado. Máximo 0.167s, medio 0.035s, y 30 clips tienen exactamente cero. Handles reales desde la fuente **no son viables** con este material.

> ### 🛑 BLOQUEANTE DE A2 — DERIVA ACUMULADA DE 2.758s (descubierta el 29/07/2026)
> La normalización del export mete el **archivo entero sin `-t`**, así que cada clip empuja al siguiente:
> ```
> suma de slots (durationSeconds) = 210.811s
> suma de archivos reales         = 213.569s
> audio maestro                   = 210.700s
> DERIVA                          =   2.758s
> ```
> Es **progresiva y monótona**: `idx 19 → +0.91s · idx 39 → +1.74s · idx 59 → +2.42s · idx 78 → +2.76s`.
>
> **Al final del video la imagen va 2.76s por detrás de la narración**, y el `-shortest` del concat recorta los últimos ~2.9s de video en silencio. Es exactamente la prueba definitiva que describe A4 ("los labios/voz cuadran en el último minuto"): **hoy no cuadran**. Es un bug de producto que ya existe, sin transiciones de por medio.
>
> **Por qué bloquea A2:** `body = slot − 0.25` asume que el clip normalizado dura el slot. Hoy no. Si se hace A2 encima, el `-t` entraría solo en los clips **con** transición y el resto seguiría derivando → desincronización desigual, más difícil de diagnosticar. **Decisión tomada: arreglar la deriva primero, como cambio propio y verificable (duración del export == audio ±0.1s), y luego A2 sobre base sólida.**
>
> **Pendiente de decidir antes de escribir A2:** 18 de 78 clips tienen `durationSeconds` distinto del hueco entre `startSeconds` consecutivos. Hay que fijar cuál manda como "slot".

**Checkpoint A2:** ☑ premisa del slot verificada · ☐ **deriva arreglada (previo)** · ☐ tails/heads solo donde corresponde · ☐ regresión 0% OK · ☐ commit

---

### FASE A3 — Mini-renders xfade (el corazón) — ⬜
```
ffmpeg -y -i tail_i.mp4 -i head_(i+1).mp4 -filter_complex "[0][1]xfade=transition=<transitionByIndex[i]>:duration=0.5:offset=0" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an transition_i.mp4
```
- offset=0 SIEMPRE. try/catch por render: si falla UNO → log + corte seco. El export NUNCA se rompe.
- Progreso vía `export-progress` con `step: 'transitions'`.
- Optimización opcional: paralelizar de a 3 con `Promise.all` por lotes.

**Checkpoint A3:** ☐ renders creados · ☐ fallo simulado degrada a corte seco · ☐ commit

---

### FASE A4 — Ensamblado final — ⬜
Lista concat intercalando `body_0, transition_0, body_1, ...`. El resto del comando NO cambia. Limpiar tails/heads/transitions en el cleanup.

> ### ⚠️ BLOQUEANTE CONOCIDO DE A4 — `normalizedPaths` SE COMPACTA
> `transitionByIndex` se indexa contra **`videoOnly`**, pero la lista de concat se construye desde **`normalizedPaths`**, que **se compacta**:
> - `~L1492`: `if (!(await exists(clip.path))) continue;` — salta sin hacer push
> - `~L1511`: el `catch` de error de normalización tampoco hace push
>
> Si UN solo clip falla, todos los índices posteriores se desplazan y las transiciones caen en cortes equivocados. **Es el mismo bug del array compactado que ya se arregló en FASE 4 de la generación** (`results[item.index - 1]` posicional). Hay que resolverlo en A4: rellenar el slot fallido en su posición o mantener un mapa índice→ruta.

**Checkpoint A4:** ☐ compactación resuelta · ☐ duración == audio (±0.1s) · ☐ transiciones visibles · ☐ audio sincronizado · ☐ commit

---

### FASE A5 — Pruebas escalonadas — ⬜
1. Regresión 0% → idéntico al export actual (~37s para 79 clips)
2. 50% → medir tiempo (esperado +30-60s)
3. 100% → todo corte con transición salvo degradados
4. Video largo (15-20 min) → escala sin crash
**Checkpoint A5:** ☐ 4 pruebas · ☐ commit final · ☐ `git push`

---

## ARREGLOS FUERA DEL PROYECTO A hechos el 24/07/2026

### 1. DeepSeek retiró `deepseek-chat` — commit `50ea4ac` ✅
**Síntoma:** al construir el timeline solo salían clips originales, cero stock. Log: `weights: original=28, stock=48` pero `Decisiones: Stock: 0, Original: 76`.

**Causa raíz:** la API de DeepSeek dejó de aceptar el modelo `deepseek-chat` y devuelve **HTTP 400**. Las 4 llamadas hacían `if (dsResp.ok) {...}` **sin rama `else`**, así que el error se tragaba en silencio; las frases caían al relleno hardcodeado `type: 'original'` de `~L1779`. Ni siquiera se disparaba el fallback de `~L1896`, porque `sanitizedPhrases` sí se rellenaba.

**Arreglo, en las 4 llamadas** (`rewrite-transcript`, FASE 2, REGEN gráficos, FASE 2 de regeneración):
- `model` → **`deepseek-v4-pro`**
- **`thinking: { type: 'disabled' }`** — los modelos v4 razonan por defecto. Con lotes de 25 frases quemaban 14.7K tokens de razonamiento y truncaban el JSON a los 148s. Valores válidos: `adaptive|enabled|disabled`. (`reasoning_effort` acepta `high|low|medium|max|xhigh`, no se puede poner en "none".)
- `max_tokens: 8000` explícito
- rama `else` que loggea status HTTP + cuerpo
- aviso cuando `finish_reason === 'length'`

**Medido (lote real de 25 frases):** 148.9s truncado → **16.0s con 25/25 OK**. FASE 2 completa pasó de ~16s (modelo viejo) a ~32s.

### 2. Transiciones amontonadas al inicio — commit `6294a8f` ✅
**Causa:** `step = Math.floor(totalCortes / cortesConTransicion)`; con porcentajes altos `step` vale 1, así que TODOS los cortes calificaban hasta agotar el cupo.

**Medido al 50% con 75 cortes:** la fórmula vieja asignaba los cortes **0..37** (38 en la primera mitad, **0 en la segunda**). Coincide con el `Detalle` observado en `[EXPORT-TR]`: `0,1,2,3,4,5,6,7,8,9...`

**Arreglo:** la transición n cae en `floor((n+0.5)*total/cantidad)` → al 50% da `0,2,4,...,74` con 19 y 19 por mitad. El bloque estaba **triplicado** y se corrigió en los 3 sitios: FASE 3 al construir timeline (~L2747), `handleBuildTransitions` (~L2815), Sync Perfecta v2_overlay (~L4147). El caso especial `transitionsPercent === 100` dejó de hacer falta.

**Verificado** con barrido de 1 a 300 cortes × 0-100%: conteo exacto, sin duplicados ni fuera de rango, el 100% siempre cubre todo. **Falta verlo en la app** (el `Detalle` debe salir salteado, no consecutivo).

---

## PENDIENTES NUEVOS (deuda detectada el 24/07/2026)

### P1 — `v4-pro` se pasa de stock (prioridad media)
Con `deepseek-chat` la asignación siempre quedaba **corta**; con `v4-pro` se **pasa**:

| modelo | pedido stock | obtenido | desvío |
|---|---|---|---|
| `deepseek-chat` (5 runs) | 45-48 | 34-45 | −2 a −14, nunca por encima |
| `v4-pro` run 1 | 46 | 63 | **+17** |
| `v4-pro` run 2 | 47 | 59 | **+12** |

2 de 2 pasándose contra 5 de 5 quedándose corto → **sistemático del modelo, no varianza**. En la práctica: pediste 30 clips originales y te dio 13.

**Arreglo propuesto:** aplicar en la FASE 2 principal el bloque *"Forzar porcentajes post-DeepSeek"* que **ya existe** en el otro handler (~L2925) y que la FASE 2 principal no tiene. Patrón ya probado en el propio código.

### P2 — La degradación silenciosa sigue viva (prioridad alta para producto comercial)
El bug de fondo no era el modelo, era `if (dsResp.ok)` sin `else`. El relleno hardcodeado a `'original'` de `~L1779` sigue ahí: **si DeepSeek falla por cualquier otra razón, el usuario final verá un video de puros clips originales sin saber por qué.** Ahora al menos queda en el log, pero **no avisa en la UI**. Para un producto que se vende, esto debería mostrarse al usuario.

### P0 — DERIVA DE 2.758s ENTRE VIDEO Y AUDIO (BLOQUEANTE de A2, bug de producto HOY)
La normalización del export usa el archivo entero sin `-t`. Los clips duran más que su slot (media +0.035s, los `original` +0.110s por el `-c copy` de FASE 3), y el error se **acumula**: al final del video la imagen va **2.76s** por detrás de la narración. El `-shortest` del concat recorta los últimos ~2.9s sin avisar.

**Es el fallo más grave detectado hasta ahora**, porque contradice la premisa central del proyecto ("el audio es el reloj maestro"). **Arreglo acordado: `-t <slot>` en la normalización para TODOS los clips**, antes de tocar A2. Verificación: `ffprobe` de la duración del export == duración del audio (±0.1s). Ver el recuadro de la FASE A2.

Fuente de la imprecisión aguas arriba: `ffmpeg -ss ${ts} -i "${video}" -t ${item.duration} -c copy` (~L2340) — `-c copy` no corta en puntos arbitrarios. Arreglarlo ahí también es opción, pero recodificar los originales cuesta tiempo de generación; recortar en el export es más barato y no toca el pipeline de generación.

### P3 — `normalizedPaths` se compacta (BLOQUEANTE de A4)
Ver el recuadro de la FASE A4. Mismo bug del array compactado ya corregido en FASE 4 de la generación.

### P4 — `dist/` está trackeado en git (cosmético)
`dist/index.html` se ensucia en cada `npm run build`. Aparecerá en todo `git status`. Preexistente.

### P5 — Asimetría menor introducida en `50ea4ac`
El aviso de `finish_reason === 'length'` solo se puso en la FASE 2 principal (~L1754), no en la de regeneración (~L2899). Improbable ahora que el razonamiento está apagado.

---

## LECCIONES DE LA SESIÓN DEL 24/07/2026

**Lección 1 — Comprobar antes de revertir.** Se pidió `git checkout -- src/main/index.ts src/renderer/src/main.tsx` sospechando del código nuevo. La verificación mostró que: (a) `main.tsx` **ni siquiera estaba modificado**, (b) el cambio de A1 vivía entero dentro de `export-video`, que no corre al generar el timeline, y (c) el código de FASE 2 en disco era **idéntico al de HEAD**. El revert habría borrado A1 sin arreglar nada. La causa era externa (DeepSeek cambió su API). **Guardar el diff como patch antes de descartar trabajo.**

**Lección 2 — "El código manda" también aplica a las APIs de terceros.** El código no cambió; cambió el proveedor. Cualquier fallo que aparezca "sin que nadie tocara nada" merece mirar primero las dependencias externas.

**Lección 3 — Los logs de diagnóstico se pagan solos.** El log ampliado de A1 (huérfanas / orden / exclusiones) no solo verificó A1: destapó el bug del reparto de transiciones al mostrar índices consecutivos `0,1,2,3...` donde debían ir salteados.

---

# PROYECTO B — GRÁFICOS COMO CLIPS (HyperFrames)

**Objetivo:** clips de motion graphics (2-3s) generados por código, como CUARTA categoría (Original/Stock/IA/Gráfico), exportados por el pipeline existente.

**Por qué HyperFrames** (`github.com/heygen-com/hyperframes`): HTML+CSS+GSAP/Lottie/Three.js → MP4 determinista. **Apache 2.0 → gratis y comercializable.** CLI no-interactivo. Requiere Node 22 + FFmpeg.

**Nota comercial crítica:** verificar en B1 si el render funciona en la máquina del usuario FINAL al empaquetar (¿usa el Node del sistema o hay que embeberlo?).

**Estado:** `initProjectDirs` ya crea `temp/hyperframes` y `temp/remotion` (vacías). `graphicData` ya existe. FASE 2 del backend envía `graphicsPercent: 0` FIJO.

- **B1** — Prueba aislada: `node --version` (22+), `npx hyperframes init test-video --example play-mode`, MP4 vertical 1080x1920 2.5s 30fps. ☐
- **B2** — Templates en `src/main/templates/hyperframes/`: `barra_dato`, `contador`, `comparacion`, `dato_emoji`, `tendencia`. Estética gris (#1C1C1E, #3a3a3c). ☐
- **B3** — `hyperframesRenderer.ts` con `renderGraphicClip(graphicData, outPath)`, **caché por hash**, timeout + fallback a null. ☐
- **B4** — Cuarta categoría: slots `type: 'graphic'` → `results[]` posicional (respetando el fix sin compactar). Decidir si `graphicsPercent` sigue aparte (recomendado) o entra como cuarto slider. Reconectar el valor real. ☐
- **B5** — Export sin cambios (son MP4). Probar 20% gráficos. ☐

---

# PROYECTO C — VIBES AI

**Objetivo:** frase → imagen (Nano Banana / Gemini) → animación (vibes.ai vía Playwright) → clip MP4.

**ADVERTENCIA COMERCIAL:** `vibes-bot.ts` automatiza vibes.ai con Playwright (scraping de UI). Para uso personal funciona; para PRODUCTO VENDIDO es frágil y probablemente contra sus ToS. **Vibes = proveedor experimental/personal con fallback SIEMPRE activo.** Nano Banana con API oficial SÍ es comercializable.

**Estado (en master, commit 3517e96, SIN probar):** `styleGuide.json`, `stylePromptBuilder.ts`, `nanoBananaProvider.ts`, `vibes-bot.ts`, VibesQueue, `handleStockFallback`, contadores de cuota. `vibesProviderReady = !!process.env.GEMINI_API_KEY` → **hoy false (falta la key; el `.env` tiene DEEPSEEK, ELEVENLABS, FAL, PEXELS, PIXABAY, COVERR pero NO GEMINI)**.

- **C1** — Auditoría contra `hans1801/vibes-content-generator`: selectores, polling, sesión, descarga CDN. ☐
- **C2** — Nano Banana aislado: `GEMINI_API_KEY` en `.env`, PNG 9:16, rate limits. ☐
- **C3** — Vibes-bot aislado: sesión persistente, `animateImage`, medir tiempo y tasa de éxito. ☐
- **C4** — Flujo completo + estilo + cuotas + fallback. ☐
- **C5** — Export con clips IA. ☐

---

# PROYECTO D — SMART CUT (edición de video grabado)

**Objetivo:** detectar y PROPONER cortes (silencios, muletillas, repeticiones). 100% local, sin APIs. Mejor gancho del plan gratuito.

**REGLA DE DISEÑO CRÍTICA:** nada se corta automáticamente. Se proponen, el usuario aprueba, y recién ahí se aplican.

- **D1** — Silencios: huecos de Whisper + `ffmpeg -af silencedetect=n=-30dB:d=0.5`. ☐
- **D2** — Muletillas (lista española EDITABLE: eh, em, mmm, este, o sea, pues, digamos, entonces, bueno, ¿no?, ¿sabes?, tipo). ☐
- **D3** — Repeticiones: palabras consecutivas iguales + frases reiniciadas (difflib). ☐
- **D4** — Panel de revisión con preview por fragmento. ☐
- **D5** — Aplicar cortes. **PUNTO CRÍTICO: toca la sincronización audio-video.** ☐
- **D6** — Buscar frase hablada. ☐

---

# ANÁLISIS DE COMPETENCIA (julio 2026)

### AutoFaceless Studio — el más parecido
| Plan | Precio | Límite |
|---|---|---|
| Gratis | $0 | 30 min export/mes, 720p con marca de agua, 2 nichos |
| Creador en Ascenso | $14.99/mes | 4h export/mes, 1080p sin marca, BYOK |
| Creador Pro | $24.99/mes | Ilimitado, claves incluidas |

- **Métrica de cobro = TIEMPO DE VIDEO EXPORTADO.** El log `[EXPORT] Completado en Xs` ya es la base del medidor.
- 10 nichos preconfigurados = su mejor onboarding. Stack Python+Flask+PyInstaller. GitHub Releases + LemonSqueezy.

### RapCut AI — otro modelo
- $99/año o **$299 de por vida**. Pitch *"reemplazo tu stack"* + calculadora de ahorro. Licencia artesanal por WhatsApp. Se controla conversando vía MCP. **No genera imágenes ni video con IA.**

### Posicionamiento de CIPHER
- Sincronización palabra por palabra + control del mix por porcentaje: **más sofisticado que AutoFaceless**. 4 proveedores de stock con ranking.
- **El diferenciador NO es "hago videos faceless"** — es la precisión de sincronización y el control del mix.
- Cortos: subtítulos ya son requisito de entrada, no diferenciador. Falta música de fondo, nichos, empaquetado, licencias, Mac.

---

# BACKLOG PRIORIZADO

### ALTA — habilitan el freemium
| Qué | Por qué |
|---|---|
| **Voces gratis de fallback** (Edge TTS / SAPI) | Sin ElevenLabs key no hay voz. **Lo más urgente.** |
| **LLM gratis de fallback** (Pollinations) | Ver P2: hoy si DeepSeek falla, degrada en silencio |
| **Nichos preconfigurados** | Onboarding sin campo vacío |
| **Marca de agua en plan gratis** | Requisito para monetizar |
| **Medidor de minutos exportados** | Define cómo se cobra |
| **Ducking de audio** (`sidechaincompress`) | Suena profesional |
| **Progreso real de FFmpeg** (`-progress pipe:1 -nostats`) | Mejora el modal ya construido |

### MEDIA — diferenciadores
Cortes al ritmo de la música · Detección de escenas (`scdet`) · Ken Burns con easing cúbico (`zoompan=z='1+0.15*(1-pow(1-on/d,3))'`) · Investigación del tema antes del guion · Música de dominio público (archive.org) · Deshacer/rehacer con snapshots JSON · Presets de export por plataforma · **Subtítulos ASS quemados** (`-vf ass=archivo.ass` con tags `{\k}`, NO drawtext)

### Distribución y negocio
GitHub Releases · LemonSqueezy · **Licencia Ed25519 offline** (`PREFIJO.payload_b64.firma_b64`, JSON canónico `sort_keys=True, separators=(',',':')` o la firma falla) · **Proxy de APIs para premium** (Cloudflare Worker, validar firma SERVER-SIDE) · Tabla comparativa + calculadora de ahorro · Certificado de firma de código (~200€ OV / ~400€ EV) · **Build reducido de FFmpeg** (~200MB → ~40MB)

### NO copiar
Clonación de voz y separación de stems · Grabador de pantalla + teleprompter · Chroma key y keyframes manuales · Control por MCP (posicionaría a CIPHER en el terreno de RapCut)

### Nota técnica heredada
- **`setsar=1` obligatorio** antes de cualquier xfade → incorporado a A2.
- La fórmula `offset_i = suma(duraciones 0..i) − (i+1) × fundido` de la competencia acorta el video progresivamente → **inservible para CIPHER** (el audio es el reloj maestro). Nuestro `offset=0` por mini-render lo evita.

---

# PROYECTO E (futuro) — VEO 3 COMO GENERADOR IA COMERCIAL
Vibes queda como herramienta PERSONAL. Para el producto vendido, generación de video IA con cuentas de Veo 3.

# PROYECTO F (futuro) — PUENTE MÓVIL Y PUBLICACIÓN
**Son TRES productos distintos.** Separarlos es lo que lo hace viable.
- **F.1 Bot de Telegram** (viable YA): funciona por *polling*, el PC se conecta HACIA AFUERA. Sin puertos, sin IP fija, sin servidor. Restricción: el PC debe estar encendido.
- **F.2 Publicación automática:** el cuello de botella no es programar, es la revisión de cada plataforma (YouTube ~6 uploads/día, verificación OAuth de semanas; TikTok ~15/día con auditoría; IG 100/día con App Review; X $0.01/post). **ATAJO: APIs unificadas** (Blotato, Postproxy, bundle.social) — una integración, se salta todas las colas.
- **F.3 Nube:** otro negocio. Solo con ingresos y datos reales.

---

# ORDEN GLOBAL

```
PROYECTO A (transiciones)  ← EN CURSO. A0 ✅  A1 ✅  A2 ⬅ SIGUIENTE
        ↓
PROYECTO B (gráficos)      ← usa el export ya estable de A
        ↓
PROYECTO C (Vibes)         ← PERSONAL. Puede intercalarse si A se bloquea
PROYECTO D (Smart Cut)     ← INDEPENDIENTE. No toca el export. Mejor gancho del plan gratuito
PROYECTO E (Veo 3)         ← futuro comercial
BACKLOG                    ← las ALTA antes de empaquetar y vender
```

# REGISTRO DE AVANCE

| Fase | Estado | Fecha | Notas / mediciones |
|------|--------|-------|--------------------|
| A0 commit estado | ☑ | 24/07/2026 | `eb6b66e` |
| A1 mapa transiciones | ☑ | 24/07/2026 | `ebfca7b` · **38 de 75 pares** · 0 huérfanas · ordenado ✓ · **regresión 0% NO corrida** |
| — fix DeepSeek | ☑ | 24/07/2026 | `50ea4ac` · 148.9s truncado → 16.0s con 25/25 |
| — fix reparto transiciones | ☑ | 24/07/2026 | `6294a8f` · 50%: `0..37` → `0,2,4..74` · **verificado en la app 25/07**: `1,3,5,7,9...` |
| — premisa del slot (A2) | ☑ | 29/07/2026 | archivo **más largo** que el slot (no más corto) · sobrante máx 0.167s < 0.25s → **tpad clonado correcto** |
| **P0 deriva 2.758s** | ⬜ | 29/07/2026 | **BLOQUEANTE de A2** · video 213.57s vs audio 210.70s · acordado: `-t` en la normalización |
| A2 body+tail/head | ⬜ | | **bloqueado por P0 (deriva)** |
| A3 mini-renders | ⬜ | | |
| A4 ensamblado | ⬜ | | **bloqueado por P3 (normalizedPaths compacta)** |
| A5 pruebas | ⬜ | | |
| B1-B5 | ⬜ | | |
| C1-C5 | ⬜ | | falta `GEMINI_API_KEY` |
| D1-D6 | ⬜ | | |

# CÓMO RETOMAR EN UN CHAT NUEVO

1. Sube este documento (o ábrelo desde el repo).
2. Di: "Estoy en la Fase __ del Proyecto __. Lo último que pasó fue: __".
3. El chat debe: leer la sección 0 → **verificar el estado real con `git log` y `Select-String` antes de asumir nada** → continuar con las reglas de oro.
4. Al terminar cada fase: marcar el registro, commit, y actualizar este documento.
