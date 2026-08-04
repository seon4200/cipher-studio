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

**Estado verificado (commits en master, 31 julio 2026 — todo pusheado a GitHub):**
```
6afeb90 feat: quitar las cuotas de tipo del prompt y pedir keyword para todos los clips
2a7c4ce chore: dejar de trackear .env — contiene las claves de API
c849003 fix: no reutilizar la misma fuente de stock en un mismo montaje
ed2ebfc feat: cuota exacta de tipos y reparto con racha minima demostrable
6455626 feat: A2 genera los tails/heads para las transiciones (sin cambiar el export)
7270b95 fix: escalonar los timestamps de los sub-clips 'original' dentro de su frase
83a92ff fix: cada clip normalizado dura exactamente su slot — elimina la deriva video/audio
6294a8f fix: repartir las transiciones a lo largo del video, no amontonadas al inicio
50ea4ac fix: DeepSeek retiro deepseek-chat — migrar a deepseek-v4-pro sin razonamiento
ebfca7b feat: A1 mapa de transiciones por indice en export (solo lectura + logs)
eb6b66e feat: XFADE_MAP + assignedTransitions/transitionDuration llegan al export   <- FASE A0
```
Working tree limpio salvo `dist/index.html` y `project-state.json`: los dos están en `.gitignore` pero **trackeados**, así que el `.gitignore` no les afecta y ensucian todo `git status`. Mismo caso que tenía `.env`, que ya se destrackeó en `2a7c4ce`. Se limpian con `git rm --cached` cuando se quiera.

**AVISO DE SEGURIDAD:** el `.env` estuvo trackeado desde el `initial commit`, así que las claves de DeepSeek, ElevenLabs, fal.ai, Pexels, Pixabay y Coverr **están en la historia ya publicada**. El repo es privado, pero destrackearlo no las borra del pasado: **hay que rotarlas en cada proveedor.**

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

# SESIÓN 3 AGOSTO 2026 — CIMIENTOS: ESTRUCTURA, RUTAS Y PERSISTENCIA

> **Por qué esta sesión no fue sobre gráficos.** Se iba a integrar los gráficos y aparecieron tres fallos que los habrían contaminado: los proyectos se autodestruían al abrirlos, las urls no funcionaban con acentos, y nada de lo que decide el vídeo exportado se guardaba. Construir los gráficos encima habría multiplicado los tres.

## 1. `temp/` → `materiales/` + `cache/` (`527f15b`)

**El fallo de origen: `temp/` se diseñó como área de trabajo desechable pero los clips acabaron viviendo ahí.** Lo delatan el comentario *"recreate empty temp directories"* y las carpetas `temp/hyperframes` y `temp/remotion` creadas vacías para un HyperFrames que nunca se hizo. Una carpeta declarada desechable pasó a ser el único hogar de datos irreemplazables — y el propio código la borraba.

**Medido:** de 44 proyectos con clips, 19 tenían ficheros ausentes y **el 100% de los que faltaban estaban dentro de `temp/`**. Y `banco-clips/originales` está **VACÍO**: los clips del usuario solo existen en `temp/originales`, sin copia en ningún sitio.

```
materiales/   audio  voices  originales  stock  ia  pista-v2   ← permanente, nunca automático
cache/        thumbnails  graficos                              ← regenerable, caduca
```

**La regla vive en la estructura, no en la disciplina de quien lea el código.** `sync-perfecta` subió a `materiales/` tras comprobar que guarda clips de fal.ai que costaron dinero.

**Y `abrir` un proyecto lo destruía** (`5961f13`): `load-project` hacía `initProjectDirs → cleanupProjectTemp(projectPath) → initProjectDirs`, o sea borrar los clips y recrear las carpetas vacías. Había **dos** caminos de carga con el mismo patrón; arreglar solo uno lo habría dejado vivo.

## 2. El audio maestro se extrae al proyecto (`c987cce`)

**Por qué extraer y no copiar el vídeo:** el pipeline **ya corta** el fuente a `materiales/originales`, y después nadie lo necesita. El vídeo solo hacía falta para dar su pista de audio. Medido: **4.46 MB la pista frente a 102 MB el fichero** — 97.5 MB menos por proyecto. Copiar el vídeo sería pagar por una capacidad (recortar planos nuevos de un proyecto viejo) que John no usa: cuando hay que cambiar algo, reconstruye el timeline.

El `url` era un **`blob:`** de `URL.createObjectURL`, que muere con la página. Por eso al reabrir no había audio aunque el fichero existiera.

## 3. Las 14 urls `file://` (`6a06d63` backend, `8074522` frontend)

**Sin esto, ningún usuario con acentos en su ruta vería NADA** — ni preview, ni librería, ni transiciones. Y `C:\Users\José\` o `C:\Archivos de programa\` es lo normal en Windows en español.

Concatenar la ruta **no carga**. Medido en Chromium real:

| forma | resultado |
|---|---|
| `` `file:///${ruta}` `` | **MEDIA_ELEMENT_ERROR** |
| `encodeURI(ruta)` | **falla** (no escapa `#`, que corta la url como ancla) |
| `pathToFileURL` | **carga** |

**Backend:** `pathToFileURL` de Node. **Frontend:** implementación manual por segmentos — el preload va en **sandbox** y su `require('url')` devuelve un polyfill de navegador **sin** `pathToFileURL`; la función existe y revienta al llamarla. La manual sobre-escapa `& + = [ ]` y eso es **inocuo**: medido cargando ficheros reales, las dos formas cargan igual.

**Verificado con la app "instalada" en `C:\Usuarios\José Ángel\Mis Aplicaciones\`**: crear proyecto, cortar, extraer audio, reproducir, exportar y reproducir el resultado. 8 de 8.

## 4. La persistencia (`7d5d2ec` + el test)

De las **ocho** entradas de `export-video`, solo `clips` sobrevivía. **`aspectRatio` era el peligroso**: no aparece en el modal de exportación, así que un proyecto vertical reabría en horizontal y se exportaba mal **sin que nada lo dijera**. Y entra en `generate-timeline-assets` y `generate-perfect-sync`, donde los clips se cortan al formato equivocado y **eso queda escrito en disco**.

Los otros seis se persisten igual por decisión de producto: que el usuario abra su proyecto y vea que perdió el recorte y las transiciones le lleva a concluir que la app no guarda bien.

**Dos hallazgos que el plan no preveía:**

- El payload estaba **duplicado en tres sitios**. Por eso cada función nueva nacía sin persistencia: había que acordarse tres veces. Ahora lo construye `construirEstadoAGuardar()`.
- **Las listas de dependencias** de los `useEffect` que guardan no incluían los campos nuevos. **El build no ve eso**: cambiar el formato no disparaba el autoguardado y al cerrar se escribía el valor anterior.

**El test** (`npm run test:persistencia`) comprueba las dos formas de olvido leyendo el código, y hace el viaje real campo a campo. Al ejecutarlo por primera vez encontró que el autoguardado no vigilaba `newAudioSegments`, `activeProjectId` ni `activeProjectName`.

---

# DECISIONES TOMADAS — no rediscutir

| decisión | por qué |
|---|---|
| **Proyecto autocontenido** (opción 1, no referencias) | CIPHER ya es un producto de copia: descarga el stock dentro, genera la IA dentro, corta los originales dentro. **111 de 112 clips ya estaban dentro.** La referencia suelta no era arquitectura, era una inconsistencia. Premiere/Resolve referencian porque manejan terabytes; iMovie y CapCut copian porque su usuario mueve archivos sin pensar. CIPHER es lo segundo. |
| **El crop solo a clips `original`** (opción B) | Cuando el usuario aplica el crop, **el stock y la IA todavía no existen**: se descargan al construir. Su vídeo es lo único que hay. Y es lo que ya hacía el preview, así que preview y archivo coinciden **por construcción**. |
| **Los gráficos por troceado, no dentro de A4** | A4 sale más barato (ya recodifica los bodies) pero mete aritmética nueva donde un error desincroniza el audio, y tiene una trampa: si A4 degrada, los tails/heads con gráfico se descartan y **los gráficos desaparecerían en silencio**. El troceado es una pasada posterior: si falla, queda el vídeo correcto sin gráficos. **Mejor modo de fallo gana a mejor rendimiento.** |
| **No copiar el vídeo importado** | El pipeline lo corta y después nadie lo necesita. La dependencia externa se queda y se resuelve **avisando** (PIEZA A), no copiando 500 MB. |
| **Se descartó la opción C del mecanismo de persistencia** | Declarar la persistencia en el propio `useState` es la solución buena (~95%), pero exige tocar **23 declaraciones** — el refactor del núcleo, justo antes de integrar los gráficos. Se eligió el **test** en su lugar: ataca los dos fallos que sí han ocurrido, no defiende contra efímeros colados, que no han ocurrido nunca. |
| **`webUtils.getPathForFile` antes que `File.path`** | Las dos funcionan en Electron 31.7.7 y devuelven la misma ruta, pero `File.path` está retirado desde la 32. Actualizar Electron no romperá la importación. |

---

# PLAN DE LOS GRÁFICOS — medido, listo para ejecutar

## La Vía G: renderizar desde dentro de Electron

Ventana `BrowserWindow` con `offscreen: true`, se capturan los frames por el evento `paint` y se meten a ffmpeg por stdin. **Renderiza el DOM completo**, así que reutiliza el componente `AnimatedGraphic` que ya existe — sin reescribir plantillas y sin HyperFrames ni Node 22 en la máquina del usuario.

**Los 8 detalles que no se pueden saltar:**

1. **El handshake `invalidate()` → `paint` NO basta.** Medido: entrega un frame **~4 atrasado**, 0 de 90 exactos. Subir el framerate del compositor acelera pero **empeora** la exactitud. Lo único que funciona es el **lazo cerrado**: leer una sonda del bitmap y reintentar hasta que llegue el frame pedido. **90/90 exactos, 3.7 intentos por frame.**
2. **El bitmap es BGRA**, se declara así a ffmpeg.
3. **`getBitmap()` no copia**: hay que hacer `Buffer.from` en el mismo tick. Cuesta 2.9 ms/frame, el 39% del total.
4. **Backpressure del pipe**: `if (!stdin.write(buf)) await once(stdin,'drain')`. Medido: nunca fue cuello.
5. **El reloj no cubre todo.** `getAnimations()` controla CSS y WAAPI pero **no** rAF ni GSAP. Lo que dependa de JS tiene que ser **función pura de t**.
6. **Preflight**: `await document.fonts.ready` (1.9 ms).
7. **El arranque de la ventana son 150 ms** y se amortiza: **una sola ventana para todos los gráficos**.
8. **`paint` entrega el frame COMPLETO**, no el área sucia. Verificado con un testigo en la esquina opuesta: 0 parciales en 270 frames.

**Y un hallazgo que entierra la vía de `drawtext`: el emoji sale a color.**

## El alpha

**El bitmap SÍ trae alpha real** (zona vacía A=0, 0/1600 píxeles opacos) pero **premultiplicado** — se compone con `overlay=...:alpha=premultiplied`.

| códec | alpha | encode |
|---|---|---|
| **mov / qtrle** | **conservado** | 1078 ms · 10.8 MB |
| webm / vp9 | perdido con el comando probado | 2031 ms · 104 KB |
| mp4 / h264 | perdido (control) | 322 ms |

*No está demostrado que VP9 no pueda; está demostrado que mi comando no lo consiguió.*

## Los datos reales (13 proyectos, 579 gráficos)

| tipo | % |
|---|---|
| `decorativo_emoji` | **83.8%** |
| `frase_clave` | 8.5% |
| el resto (5 tipos) | 7.7% |

**Duración: 2.00 s exactos en los 579** → 60 frames. La caché por hash ahorra **0-9% dentro de un proyecto**: su valor real es el **re-export**, no la deduplicación.

## Coste medido

| | |
|---|---|
| Por gráfico (ponderado por el reparto real) | **1634 ms** |
| 19 gráficos | render **31.2 s** |
| Pasada de overlay entera | 45.5 s (recodifica el 100%) |
| **Troceado** | **33.5 s**, solo **25.5%** recodificado, **74.5% en copia** |
| **Total añadido al export de 121 s** | **+72 s** → ~193 s |

**El troceado necesita el muxer `segment`.** Cortar con `-ss`/`-to` por trozo da 17.1 s pero produce **8707 frames en vez de 8579** — descalificatorio. Con `segment`: **frames exactos**, verificado.

## Las 5 piezas

1. **`renderGraphicClip(graphicData, opciones)`** — ventana offscreen reutilizada, lazo cerrado, salida `.mov` qtrle, caché por `hash(graphicData + WxH + duración + fps)`, fallback a `null`.
2. **Renderizar al pulsar "Generar Gráficos"**, no al exportar. El coste se paga ahí y el export solo compone.
3. **El export recoge las tarjetas aparte** — `videoOnly` las sigue excluyendo, la aritmética de frames no se entera.
4. **La pasada de troceado**, después del concat. **Si el recuento de frames no cuadra, se descarta la pasada** y queda el vídeo sin tarjetas.
5. **Limpieza** — barrido de los `.mov` cuyo hash ya no esté en el conjunto actual.

## Las 4 cosas que hay que cubrir

1. **Invalidación** — mover un clip **no** invalida: la posición vive en el clip. Sí invalidan `graphicData`, la duración y `WxH`, y por eso los tres entran en la clave del hash.
2. **Fallo silencioso** — el export **cuenta** cuántas esperaba y cuántas compuso, y lo dice. Nunca 17 de 19 en silencio.
3. **Preview vs archivo** — el `.mov` se llama como su hash: un `graphicData` distinto es un fallo de caché detectable, no un MOV viejo compuesto sin avisar.
4. **Acumulación** — el barrido de la pieza 5. Tres tandas no se apilan.

**Tamaño:** ~1.65 MB por gráfico → 19 gráficos ≈ **31 MB**; el proyecto de 261 gráficos ≈ 431 MB.

---

# DEUDA ABIERTA, por gravedad

| gravedad | qué |
|---|---|
| **ALTA** | **Vía 4** — `generate-perfect-sync` devuelve el `v1Clip` y el `audioClip` apuntando **fuera del proyecto**. Es el mismo bug que cerró M1, por una tercera puerta: si usas sincronía perfecta, el audio vuelve a depender de un fichero externo. |
| **ALTA** | **PIEZA A** — avisar al abrir: cuántos materiales faltan, **de dónde** (`originales` no vuelve, `stock` es re-cortable, `ia` costó dinero) y **cuántos clips tienen categoría no reconocida**, que es un fallo igual de silencioso. Hoy la app se queda vacía sin decir nada. |
| **MEDIA** | **PIEZA B** — caducidad de `cache/`. **Nada borra desde que se arregló la limpieza**: ni `temp/originales`, ni `banco-clips/stock` (18.7 GB medidos), ni los restos de exports interrumpidos en `banco-clips/temp_export`. Cada proyecto nuevo son ~221 MB que nadie recoge. |
| **MEDIA** | **`project-state.json` de 18 MB** — el 49% son **miniaturas en base64** embebidas, y las voces generadas meten el MP3 entero como data URI. Se lee y escribe completo en cada guardado. |
| **MEDIA** | **El prompt de gráficos** — `decorativo_emoji` sale el 84% por tres razones medidas: el **único ejemplo del `FORMATO`** es de ese tipo, la puerta es *"si hay datos / si no hay datos"*, y los 7 tipos de TIPO A son **solo nombres sin descripción**. Además **8 de los 17 tipos no se mencionan** y son inalcanzables. **Decidido: el prompt va ANTES que el movimiento** — invertir en animar los dos tipos que dominan sería circular, porque dominan *porque* el prompt los empuja. |
| **BAJA** | La pestaña de la librería **ES** la ruta de la carpeta (`libraryTab.toLowerCase()`). Renombrarla a "IA Video" crearía `materiales/ia video` en silencio. |
| **BAJA** | `'vacio'` es una categoría que miente: esos clips contienen stock real descargado. |
| **BAJA** | El canal IPC `generate-minimax-video` sigue con nombre de proveedor. |
| **BAJA** | `handleDeleteProject` (individual) tiene el mismo `catch` mudo que se arregló en "Eliminar todo". |
| **BAJA** | El vídeo importado sigue **fuera** del proyecto (decidido: se avisa, no se copia). *"Consolidar proyecto"* queda como función futura. |

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

### MEJORA FUTURA — duraciones variables por tipo de transición

Idea de John: que cada transición dure lo que le pega (un `fade` corto, un `pixelize` más largo) en vez de 0.5s para todas. Se hará **después** de tener A3 verificado con duración fija, para que si algo falla se sepa de qué parte viene.

> ### ⚠️ REGLA: SOLO VALORES QUE CAIGAN EN FRAME ENTERO
> A 30fps un frame dura 33.3ms. La duración hay que elegirla **en frames**, no en segundos sueltos, o se reintroduce la cuantización que se eliminó en `83a92ff`.
>
> | duración | frames | reparto tail+head |
> |---|---|---|
> | 0.2s | **6** | 3 + 3 |
> | 0.3s | **9** | 4 + 5 |
> | 0.4s | **12** | 6 + 6 |
> | 0.5s | **15** | 7 + 8 |
>
> **0.25s serían 7.5 frames y no existe.** Cualquier valor que no dé entero queda descartado.
>
> Al hacerlo hay que tocar A2 **y** A3 a la vez: los `FRAMES_TAIL` / `FRAMES_HEAD` dejan de ser constantes y pasan a calcularse por par según el nombre de la transición. Y A4 tendrá que recortar cada body con el valor de su propio par, no con 7+8 fijo.

### 🐛 BUG — el crop y el zoom del vídeo importado no llegan al timeline ni al export — ✅ RESUELTO (`6b8a0de` → `df951b7`, 31/07/2026)

**Reportado por John el 31/07/2026. La sospecha era correcta:** era solo una transformación CSS del reproductor, sin contrapartida en ffmpeg.

**Cómo se resolvió: en la NORMALIZACIÓN del export, no al confirmar el crop.** Se descartó recodificar el vídeo fuente de forma destructiva. El crop viaja hasta el export y se compone en la cadena `-vf` del bucle de normalización.

**Opción B — solo los clips de categoría `original`.** Lo que cierra la decisión: cuando John aplica el crop, los clips de stock y de IA **todavía no existen**, se descargan al construir. Su vídeo es lo único que hay en ese momento. Y es lo que ya hacía el preview, así que preview y archivo coinciden **por construcción** — que era la divergencia de fondo. Si hay ajustes y ningún clip `original`, el export **se bloquea** antes de normalizar en vez de salir en silencio sin el ajuste.

**Estado: pasos 1, 2 y 3 completados.** Verificado por John sobre un export real: el crop se ve en el archivo y solo en sus clips.

| paso | qué | commit |
|---|---|---|
| 1 | `construirVF` sustituye la cirugía de `slice` | `6b8a0de` |
| 2 | `construirAjustes()` + condición por categoría + bloqueo | `e07d285` |
| 3 | El frontend manda `ajustesVideo` + guarda del zoom epsilon | `df951b7` |
| 4 | **PENDIENTE** — persistencia de los ajustes en el estado del proyecto | — |
| 5 | **PENDIENTE** — control de fondo (blur/negro) y modal del fotograma, desde `stash@{0}` | — |

**Dónde entra el crop en el pipeline** (confirmado leyendo el código): la normalización es el **único** sitio donde aparece un crop del usuario. A2 (`index.ts:1746`), A3 (`:1810`) y A4 (`:1845`) leen todos de `normPorIndice` y solo recortan en el **tiempo** con `trim`, nunca en el espacio. Los tails/heads salen ya del clip recortado y el `xfade` opera sobre el encuadre final. El `overlay` sustituyó al `pad`, así que la salida conserva W×H con recorte o sin él y el `xfade` nunca ve dimensiones distintas.

**Consecuencia asumida de la opción B:** en una transición entre un clip propio y uno de stock se funden **dos encuadres distintos**. Es inherente al diseño —solo el material del usuario se reencuadra— y lo que lo suaviza es el fondo: con `blur` los dos lados del `xfade` son imágenes a sangre; con negro se ve el stock invadir los bordes vacíos. Se decide en el paso 5.

**Pendiente del paso 4:** hasta que exista, los ajustes viven **solo en memoria**. Al cerrar y reabrir el proyecto se pierden y el export vuelve a salir sin crop. El pan debe persistirse como **fracción**, nunca en píxeles de pantalla, y al cargar hay que reconstruir `panOffset` en píxeles esperando a que la caja del preview sea medible.

### 🐛 BUG — el crop se ve desincronizado en el preview durante las transiciones

**Detectado el 31/07/2026 al cerrar el paso 3. NO afecta al archivo exportado.**

Durante una transición, el vídeo original vuelve a verse **sin recortar** en la previsualización. El archivo sale correcto.

El segundo `<video>` (`preview-video-2`, `main.tsx:5082`) **sí tiene** su propia lógica de crop, con la misma condición por categoría que el primero. El problema es de **qué índice** depende: su estilo se calcula con `sortedVideoClips[currentClipIndex + 1]` (L5089 y L5097), mientras que su `src` viene de `transitionNextUrl`, que se fija en otro momento (`main.tsx:1555`, al quedar 1.5s). Cuando `currentClipIndex` avanza, el estilo pasa a mirar al clip *siguiente al nuevo* mientras el elemento todavía muestra los frames del anterior: si ese nuevo siguiente es stock, se pinta sin recorte enseñando aún el original.

**Mecanismo deducido de leer el código, no medido** — encaja con el síntoma y con los índices, pero no se ha reproducido con la app delante.

No toca al archivo: esos dos `<video>` son marcado del renderer con CSS, y el archivo lo produce el pipeline del proceso principal a partir de `normPorIndice`, que no los consulta jamás.

### 🔁 DEUDA — la pestaña de la librería ES la ruta de la carpeta

`loadClipsForCategory(libraryTab.toLowerCase())` (`main.tsx:2107`) convierte la **etiqueta visible** de la pestaña en el nombre de la carpeta que lee el backend. Hoy funciona porque la pestaña se llama `IA` y la carpeta `materiales/ia`, pero el día que alguien la renombre a "IA Video" el backend buscará `materiales/ia video` y **creará esa carpeta vacía sin avisar** (`index.ts:1139`).

**Desacoplar en un cambio aparte**, con su propia verificación: la pestaña debe llevar `{ etiqueta, categoria }` y no una sola cadena que haga de las dos cosas.

### 🔁 DEUDA — `'vacio'` es una categoría que miente

`sync-perfecta`/`pista-v2` marca clips como `type: 'vacio'` (`index.ts:3563`) para forzar un déficit, pero la condición de `index.ts:3644` es verdadera para ese valor, así que **descarga stock de Pexels igualmente** y guarda el clip con `category: 'vacio'`. Un clip etiquetado "vacío" contiene stock real.

Ninguna lógica que filtre por categoría lo reconoce: no recibe crop (correcto, no es material del usuario) y no se colorea en el timeline. Está bien FUERA de las listas `isTempCategory`, que son nombres de carpeta, pero el nombre debería decir lo que es.

### 🔁 DEUDA menor — el canal IPC `generate-minimax-video`

La carpeta, la categoría y la UI ya son `ia`. El canal IPC y el método del preload siguen llamándose por el proveedor. No afecta a rutas ni a datos guardados; se cambia cuando se toque el preload por otra cosa.

### 🛑 DEUDA — la persistencia se enumera a mano y va perdiendo funciones

`handleSaveProjectDirectly` construye el estado a guardar **enumerando 21 variables a mano**. La app tiene **118 piezas de estado**. Cada función nueva nace sin persistencia salvo que alguien se acuerde de añadirla a esa lista, y desde que se escribió se han añadido transiciones, crop, formato de export y modo de sincronía sin tocarla.

**No es una lista de olvidos: es el mecanismo.** Arreglar una variable deja el problema intacto para la siguiente.

**Rompen el vídeo resultante:**

| estado | qué pierdes al reabrir |
|---|---|
| `aspectRatio` | **el formato del vídeo** — vuelve al valor por defecto |
| `exportResolution`, `exportFormat`, `exportQuality` | los ajustes de exportación |
| `assignedTransitions`, `transitionDuration`, `transitionsPercent` | **las transiciones asignadas** |
| `activeCrop`, `zoom`, `panOffset`, `isMirrored`, `cropRect` | los ajustes de encuadre |
| `perfectSyncMode`, `syncWeights` | el modo de sincronía y sus pesos |
| `iaStyle` | el estilo de generación IA |

**Molestan pero no rompen:** `videoTrackVolume`, `audioTrackVolume`, `timelineZoom`, `durationSeconds`, `milestoneHistory`/`milestoneIndex` (el deshacer/rehacer se pierde entero), y los campos del panel Crear (`crearIdea`, `crearTone`, `crearDuration`, `crearFormat`, `appMode`).

**Antes de arreglar variable por variable**, decidir si el payload sigue enumerándose a mano o pasa a derivarse de una lista declarada junto a los propios estados. Lo segundo es lo que impide que vuelva a pasar.

### 🔮 FUNCIÓN FUTURA — restaurar la posición del cursor al reabrir

Hoy `currentTime` no se persiste y el proyecto reabre **siempre al principio**, con el preview en el primer clip. Es coherente y no engaña, pero volver donde lo dejaste sería mejor. Va con la deuda de persistencia de arriba, no aparte.

### 🔮 FUNCIÓN FUTURA — crop/zoom por clip individual, estilo CapCut

**Pedida por John el 31/07/2026. NO ahora.**

Seleccionar un clip concreto del timeline ya construido y aplicarle recorte o zoom **solo a él**. Es **distinto** del crop global: aquel reencuadra el material del usuario antes de construir; este actuaría sobre un clip ya generado, sea original, stock o IA.

Implicaría guardar los ajustes **por clip** en `timelineVideoClips` y que la normalización del export los lea de cada uno en vez de un ajuste único. `construirAjustes()` ya sirve tal cual —es pura y recibe los ajustes como parámetro—; lo que cambiaría es de dónde salen.

### 🔁 DEUDA — las transiciones se repiten: 38 asignadas, solo 21 efectos distintos — ✅ RESUELTO (`c72cbfd`, 31/07/2026)

**Resuelto:** los 38 nombres internos apuntan ahora a 38 destinos distintos. Los 17 que cambiaron se validaron **ejecutando xfade de verdad** sobre un tail/head reales (38 de 38 dan 15 frames), no solo comprobando que salen en el listado.

**Medido con 110 transiciones al 100%: 38 efectos distintos, el máximo posible.** El reparto es óptimo — 34 efectos salen 3 veces y 4 salen 2, así que entre el más y el menos usado hay 1 de diferencia. Con 110 transiciones y 38 efectos, `ceil(110/38) = 3` es el mínimo inevitable.

Quedan 20 destinos sin usar por si hay que afinar: `coverleft/right/up/down`, `revealleft/right/up/down`, `wipedown`, `wipetl/tr/bl/br`, `slideup`, `horzopen/close`, `diagbr`, `hrslice`, `vuslice`, `vdwind`.

<details><summary>Contexto original del problema</summary>

Medido en el export de A4: las 38 transiciones del vídeo usan **solo 21 nombres xfade distintos**. `circleopen` sale **5 veces**, `pixelize` 4, y `circleclose`, `dissolve`, `fadegrays` y `hblur` 3 cada una.

**La causa NO es el sorteo del frontend.** `handleBuildTransitions` reparte correctamente 38 nombres internos sin repetir (Fisher-Yates + cola que se rellena al agotarse). **El colapso está en `XFADE_MAP`** (`src/main/index.ts` ~L1334): sus 38 entradas apuntan a solo 21 destinos.

Ejemplos del colapso:
- `CrossZoom`, `rotate_scale_fade`, `kaleidoscope`, `SimpleZoom`, `zoomInOut` → **todos `circleopen`**
- `fadegrayscale`, `colorphase`, `HSVfade` → **todos `fadegrays`**
- `pixelize`, `randomsquares`, `TVStatic`, `mosaic_transition` → **todos `pixelize`**

**Arreglo:** repartir los 38 nombres internos sobre destinos xfade distintos. El build de ffmpeg 8.1.1 soporta bastantes más de 21 (`wiperight`, `slideup`, `circlecrop`, `rectcrop`, `distance`, `vertopen`, `vertclose`, `horzopen`, `horzclose`, `hlslice`, `hrslice`, `vuslice`, `vdslice`, `squeezeh`, `squeezev`, `zoomin`, `hlwind`, `hrwind`…). Hay que **listar los soportados con `ffmpeg -h filter=xfade`** y reasignar el mapa para que cada nombre interno tenga el destino más parecido a su efecto real, sin duplicar.

**Ojo:** los 38 nombres internos NO se pueden renombrar — hay previews CSS y dos paneles duplicados en el frontend que dependen de ellos. Solo cambia el destino en `XFADE_MAP`.

</details>

### 🔍 DEUDA — déficit de 6 frames (0.2s), preexistente a A4

El archivo final tiene **5976 frames de los 5982** contabilizados. **No lo introdujo A4:** el mismo proyecto exportado justo antes ya daba 5977 de 5981, así que el déficit venía de antes y A4 solo lo hace algo mayor (4 → 6 frames).

Es el mismo residuo que apareció como "13 frames" en el proyecto de 17 minutos, y que **no ocurre siempre**: el proyecto de 50 clips dio 3912 de 3912, déficit cero.

**Sospecha sin verificar:** algún `norm_*.mp4` sale con un frame menos de lo que pide P0 pese al `tpad`, y un `tail` construido sobre ese norm produce una transición de 14 frames en vez de 15. La contabilidad de A4 no lo detecta porque suma `frameTargets`, no los frames reales de los ficheros.

**Cómo cerrarlo (gratis):** parsear el `frame=N` que ffmpeg ya devuelve en el callback del `exec` de la normalización —hoy se descarta— y loggear solo los clips cuyo conteo real no cuadre con `frameTargets[i]`. Cero procesos extra y señala el clip exacto.

**Impacto:** ~0.2s de desfase acumulado al final de un vídeo de 3.3 minutos. El audio sale íntegro.

### MEJORA FUTURA — handles reales en vez de frames clonados (anotada el 31/07/2026)

Hoy el material del solape se fabrica clonando el último/primer frame (`tpad`), así que **el plano saliente queda congelado durante la segunda mitad del fundido**. Los editores profesionales usan *handles*: metraje real sobrante a cada lado del corte.

Implica tocar tres sitios a la vez:
- **FASE 3 (generación):** cortar ~8 frames extra por lado (~0.27s). Los clips `original` cortados con `-c copy` ya traen +0.11s de regalo por la imprecisión de keyframe.
- **A2:** usar ese metraje real en vez de `tpad` clonado.
- **Escalonado de timestamps:** descontar el handle para no duplicar material entre clips vecinos del mismo vídeo fuente.

**Decisión de John: evaluar solo después de ver A4 funcionando, y únicamente si el congelado molesta de verdad al ver el vídeo.**

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

### FASE A4 — Ensamblado final — ✅ HECHA Y VERIFICADA (`fea9eac`, 31/07/2026)

**Las transiciones ya se ven en el vídeo exportado.** Verificado visualmente en la app.

Cada body se recorta según sus vecinas: **8 frames del inicio** si tiene transición antes, **7 del final** si la tiene después. Los clips sin vecinas no se re-encodean. La lista de concat se arma recorriendo **índices** (gracias a P3), intercalando `body_i + transition_i`.

**El punto crítico:** el recorte y la inserción leen la **misma** fuente de verdad — que `transition_i.mp4` exista de verdad en disco, no que esté en `transitionByIndex`. A2 pudo descartar el par por clip corto y A3 pudo fallar el render; recortar por el mapa habría dejado 15 frames de menos por cada transición inexistente.

**Degradación todo-o-nada:** si falla un recorte o la contabilidad no cuadra con el objetivo de P0, se exporta **sin ninguna transición** en vez de recuperar corte a corte. Un body ya recortado junto a una transición anulada sumaría frames y desincronizaría el audio, que es lo único intocable.

**Interruptor de emergencia:** `CIPHER_SIN_TRANSICIONES=1` en el `.env` apaga A2, A3 y A4 sin revertir nada. Se relee con `loadEnv(true)` en cada export, así que basta alternar entre `1` y `0` **sin reabrir la app**.

**Medido** (76 clips, 38 transiciones): bodies 5412 + transiciones 570 = **5982**, igual al objetivo P0. A4 tarda **25.4s**; el export completo pasa de 66.5s a **93.0s**.

El log lista **el segundo y el índice** de cada transición (`[12] 26.3s circleopen`), en el mismo espacio de índices que `EXPORT-TR` y el timeline, para poder saltar a verificarlas.

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

## 🛑 DEUDA CRÍTICA — el vídeo no cubre el audio (detectada el 31/07/2026)

Al generar un vídeo de 28 minutos, el montaje solo llegaba a los ~17 minutos y el último clip aparecía estirado a 648 segundos. Son **tres defectos encadenados**, ninguno introducido por el trabajo de estos días.

### A — la transcripción no corresponde al audio del timeline (CAUSA RAÍZ, en el frontend)

> **CORRECCIÓN (31/07/2026):** esto se anotó como *"`newAudioSegments` obsoleto"* y **era incorrecto**. En el proyecto de 28 minutos `newAudioSegments` está **vacío**. El array que llegó truncado era `transcriptSegments`.

**Diagnóstico probado:**
- La transcripción **no es progresiva**: los segmentos se asignan una sola vez en `status === 'success'` (`main.tsx` L1810). Un array corto no puede venir de generar mientras Whisper trabajaba.
- La fusión del backend **no trunca**: simulada sobre la transcripción guardada, `523 → 463 segmentos cubriendo 0 → 1681.92s`, cobertura íntegra.
- Pero FASE 1 recibió **235 acabando en 1045.06s**. Ni el conteo ni el final coinciden con lo que daría la transcripción guardada. Y ese **463 es exactamente lo que recibió FASE 1 en el primer run de 28 min, el que salió bien**.

**Conclusión: la transcripción usada al generar era completa pero de OTRO audio**, uno de ~17.4 minutos. Nadie comprueba que los segmentos correspondan al audio del timeline: se mandaron 1045s de transcripción con un audio de 1690s, y FASE 5 remató estirando el último clip 645 segundos.

**Mitigado el 31/07/2026** con una guarda en `handleBuildIATimeline` que bloquea la generación si el desfase supera 10s (el mismo `MAX_CLONADO` del export: el punto donde el `tpad` deja de poder taparlo). **Es una mitigación, no la cura**: impide producir el vídeo roto, pero no evita que ambos se desalineen.

### A1 — DEUDA: el nombre del clip como fuente de verdad
`handleBuildIATimeline` (`main.tsx` ~L2574) decide qué segmentos mandar comparando el **nombre** del clip de audio con la cadena literal `'Voz - Audio Original'`:
```ts
const isUsingOriginalAudio = voiceClip?.name === 'Voz - Audio Original';
```
Si ese nombre cambia por cualquier vía, la rama se invierte **en silencio** y se manda el array equivocado. Debería apoyarse en una marca explícita del clip, no en su texto.

### A2 — DEUDA: el reset por clip de librería desincroniza
El `useEffect` de `main.tsx` L1788 vacía `transcriptSegments` cuando cambia `firstLibraryClipId`, pero **no toca el audio del timeline**. Es una vía directa para que la transcripción y el audio dejen de corresponderse sin que nada avise.

### A3 — DEUDA menor: no se bloquea generar sin transcripción
Con audio original y `transcriptSegments` vacío, `handleBuildIATimeline` sigue adelante (el guard de L2579 solo cubre el caso de voz generada). La guarda nueva tampoco lo ataja, porque exige `finSegmentos > 0`. Es el mismo fallo llevado al extremo.

---

<details><summary>Contexto original (redacción incorrecta, se conserva por trazabilidad)</summary>

El frontend manda a generar un array de segmentos que **no corresponde a la transcripción actual**.

| | vídeo 17 min | vídeo 28 min |
|---|---|---|
| `transcriptSegments` | 215 (0 → 1044.22s) | **523 (0 → 1681.92s)** |
| frases que recibió FASE 1 | 207 | **235** |
| última frase termina en | 1044.22s | **1045.06s** |
| audio | 1048.31s | **1690.48s** |
| déficit | 4.09s | **645.4s** |

**Los dos runs se paran en ~1044-1045s.** En el de 17 min es el final natural del audio; en el de 28 min es un corte a los 17.4 minutos.

</details>

### B1 — El `tpad` limitado a 1s hace que el export pierda narración
En la normalización del export, `tpad=stop_mode=clone:stop_duration=1` solo puede clonar **1 segundo**. Si el slot de un clip es mayor que su metraje más ese segundo, el clip sale corto y el vídeo entero se acorta. Como el concat usa `-shortest`, **el audio se recorta para igualar**.

Medido en el export del vídeo de 17 min (410 clips):
```
objetivo del export (log P0) : 1048.667s  (31.460 frames)
audio del timeline           : 1048.310s
EXPORT REAL                  : 1045.067s  (31.353 frames)  ← faltan 107 frames
pista de audio del export    : 1045.060s  ← se perdieron 3.24s de narración
freezedetect                 : congelado el ultimo 1.03s (justo el tpad)
```
**No es solo un fallo visual: se pierde contenido hablado.**

### ✅ B1 RESUELTO — `58e8d79` (31/07/2026)
`MAX_CLONADO = 10` segundos, y aviso en el log si el desfase lo supera. Medido en el mismo proyecto: déficit de 107 → 13 frames, y **la pista de audio pasa de recortada a 1045.06s a íntegra en 1048.311s**. No se pierde narración.

**Por qué 10 y no 5:** el desfase es el silencio tras la última palabra transcrita, una propiedad de la **grabación**, no de su duración. Medido en 26 proyectos, tres vídeos fuente dan −0.07s, +0.06s y +3.11s con independencia de que el audio dure 199s o 286s. El máximo conocido es 4.09s. Pasarse del tope cuesta narración; quedarse largo no cuesta nada, porque `tpad` solo genera los frames que `-frames:v` consume.

> ### 🔍 PENDIENTE MENOR — los 13 frames sin explicar
> Tras B1 quedan **13 frames (0.43s)** de déficit sin causa probada. Descartado: no es el clip final desbordando el tope (no hay `AVISO B1`) ni clips sin slot válido. **Sospecha no verificada:** clips cuyo material fuente tiene una tasa de frames rara y pierden alguno al convertir a 30fps.
>
> **Cómo cerrarlo, cuando se quiera** (dos opciones, de menor a mayor coste):
> 1. **Parsear la salida de ffmpeg, gratis.** El `exec` de la normalización ya recibe `stdout`/`stderr` en el callback y hoy se descartan. ffmpeg reporta `frame=N` en su última línea de estadísticas: comparar ese N con `frameTargets[i]` y loggear **solo los que no cuadren** identifica los clips culpables sin un solo proceso extra.
> 2. **Export de diagnóstico.** Una variable de entorno tipo `CIPHER_KEEP_TEMP=1` que salte el `unlink` del cleanup, para poder medir los `norm_*.mp4` con `ffprobe` una vez. Son ~3 líneas, pero deja cientos de ficheros en `temp_export` que hay que borrar a mano.
>
> **La opción 1 es mejor**: no cuesta nada, no deja basura, y señala el clip exacto en vez de obligar a medir cientos. No es urgente: el contenedor conserva el audio completo, así que no se pierde nada.

### B2 — FASE 5 estira el último clip sin tope ni aviso
```ts
const slotEnd = isLast ? audioTotal : finalClips[i + 1].startSeconds;
finalClips[i].durationSeconds = slotEnd - finalClips[i].startSeconds;
```
Al último clip le asigna **todo lo que falte hasta el final del audio**, sin límite y sin loggearlo. Con 4s de déficit no se nota; con 645s convierte un clip de 2.5s en uno de 648s. **Está activo en todos los vídeos**, y aunque se arregle A seguiría degradando en silencio ante cualquier desfase futuro. Necesita un tope y una línea de log.

**Orden recomendado:** B1 (1 línea, protege hoy mismo) → B2 (hace el fallo detectable) → A (elimina la causa).

---

## PENDIENTES NUEVOS (deuda detectada el 24/07/2026)

### P1 — cuota y reparto de tipos — ✅ RESUELTO el 30-31/07/2026
Se resolvió por completo en `ed2ebfc` (cuota exacta + reparto con racha mínima demostrable) y `6afeb90` (quitar las cuotas de tipo del prompt). Ver la sección "Calidad del montaje" más abajo. Se deja el contexto original por el valor de los intentos fallidos.

**Contexto de cuando se aplazó:** con la tercera muestra el desvío fue de **+1**, así que parecía varianza. La cuarta muestra volvió a +19 y se retomó.

| run | pedido stock | obtenido | desvío |
|---|---|---|---|
| 25/07 03:05 | 46 | 63 | +17 |
| 25/07 03:17 | 47 | 59 | +12 |
| 30/07 05:01 | 47 | 48 | **+1** |

**Diseño ya acordado, por si se retoma** (~55 líneas, entre el sanitizado y el aplanado de `generate-timeline-assets`): forzar los conteos contra el total real, convirtiendo el excedente con reparto uniforme `floor((n+0.5)·k/m)`. **La guarda es por DIRECCIÓN, no por estado del lote** (idea de John, mejor que la primera propuesta):
- `stock → original`: siempre permitido, solo necesita `timestamp` — y desde `7270b95` ya no hace falta recalcularlo, porque la pasada de escalonado va después y lo corrige. Requiere que exista `videoPath`.
- `original → stock`: solo si el clip trae `keyword` propio distinto de `'broll'`; si no, se salta ese clip.

Esta regla cubre por construcción el caso de DeepSeek caído (produce todo `original` con `'broll'`, dirección que la guarda restringe).

**Intento fallido, NO repetir:** se probó pedir en el prompt un `keyword` para todos los tipos, como prerrequisito. Resultado: el modelo interpretó que todo debía ser stock y pasó de 63/13 a **76/0**, cero clips originales. Revertido sin commitear. El prompt es sensible; la corrección de cuota debe ser determinista en código.

### P1b — `v4-pro` se pasa de stock (contexto original)
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

## CALIDAD DEL MONTAJE — resuelto el 30-31/07/2026

Tres problemas distintos que se confundían entre sí: **cantidad** (salía menos original del pedido), **distribución** (los tipos se amontonaban en bloques) y **repetición** (el mismo vídeo aparecía varias veces).

| métrica | antes | ahora |
|---|---|---|
| racha máxima del mismo tipo | **28** | **3** |
| rachas de 4 o más | 4 | **0** |
| clips con keyword propio | 66% | **100%** |
| conteos vs sliders | 19 de 33 pedidos | **clavados** |
| primer clip 'original' | 68.8s | 6.5s |
| fuentes de stock repetidas | 5 (una ×4) | **0** |
| reparto por quintos | 0%-83% | 38%-50% |

**Cómo se llegó, y por qué importa el orden:**

1. **`ed2ebfc` — la asignación de tipos pasa al código.** Los objetivos se calculan desde los pesos contra el total REAL de sub-clips (reescalar los `target*` previos daba `NaN` si `totalVisualClipsCount` era 0). Solo se pone `stock` donde hay keyword propio; `original` puede ir en cualquier posición porque solo necesita timestamp. Para minimizar la racha se usa **búsqueda binaria** sobre `r`: un tramo de longitud `L` necesita `f ≥ (L − r)/(r + 1)` cortes. Es el óptimo demostrable, y el log reporta `alcanzada` junto al `ideal` del ratio para saber si el límite es del algoritmo o del material.

2. **`6afeb90` — quitar las cuotas de tipo del prompt.** Era el techo real: DeepSeek solo generaba keyword para los clips que él marcaba como stock (66%), y el 34% restante quedaba como original forzado, creando rachas que ningún algoritmo podía romper. Al pedir keyword para todos y no pedir tipos, el reparto pasó a tener libertad total.

**Validado a escala:** vídeos de 623 y 410 sub-clips, 19 y 10 lotes, sin un solo lote fallido ni truncamiento. El riesgo de truncamiento se descartó **midiendo antes de probar**: el peor lote real (25 frases, 44 sub-clips) consume 1.579 tokens de 8.000, un 20%. El techo teórico (75 sub-clips) serían ~2.700, un 34%. No hizo falta bajar `BATCH_SIZE`.

**Intentos fallidos, documentados para no repetirlos:**
- **Pedir keyword para todos SIN quitar las cuotas de tipo**: el modelo interpretó que todo debía ser stock. Pasó de 63/13 a **76/0**, cero originales. La lección no era "no pedir keyword a todos", era que **no se pueden pedir las dos cosas a la vez**.
- **Elegir candidatos evitando los aislados**: mejor que el reparto uniforme, pero no crea intercalado donde DeepSeek no lo puso.
- **Buscar el clip con keyword más cercano a cada posición ideal**: O(n²) y además peor, porque amontona los stock en el borde del grupo.
- **`avance % margen` para el offset al reutilizar una fuente**: colisiona. Con consumo 2.5 y margen 5, el uso 1 cae en 2.5 y el uso 3 en `7.5%5 = 2.5`. Se sustituyó por van der Corput, verificado sin colisiones en 4.096 usos.

---

## LECCIONES DE LA SESIÓN DEL 24/07/2026

**Lección 1 — Comprobar antes de revertir.** Se pidió `git checkout -- src/main/index.ts src/renderer/src/main.tsx` sospechando del código nuevo. La verificación mostró que: (a) `main.tsx` **ni siquiera estaba modificado**, (b) el cambio de A1 vivía entero dentro de `export-video`, que no corre al generar el timeline, y (c) el código de FASE 2 en disco era **idéntico al de HEAD**. El revert habría borrado A1 sin arreglar nada. La causa era externa (DeepSeek cambió su API). **Guardar el diff como patch antes de descartar trabajo.**

**Lección 2 — "El código manda" también aplica a las APIs de terceros.** El código no cambió; cambió el proveedor. Cualquier fallo que aparezca "sin que nadie tocara nada" merece mirar primero las dependencias externas.

**Lección 3 — Los logs de diagnóstico se pagan solos.** El log ampliado de A1 (huérfanas / orden / exclusiones) no solo verificó A1: destapó el bug del reparto de transiciones al mostrar índices consecutivos `0,1,2,3...` donde debían ir salteados.

---

# PROYECTO B — GRÁFICOS COMO CLIPS (HyperFrames)

**Objetivo:** clips de motion graphics (2-3s) generados por código, como CUARTA categoría (Original/Stock/IA/Gráfico), exportados por el pipeline existente.

> ## ⚠️ REGLA DE DISEÑO — todo template debe ser FUNCIÓN PURA DE `t`
>
> **Vale para cualquier gráfico nuevo, y para tocar los que ya existen.** Un template que no cumpla esto no se puede capturar, ni previsualizar en un fotograma suelto, ni recorrer con el cursor del timeline.
>
> **PROHIBIDO** — nada de esto se puede posicionar en un instante `t`:
> - `requestAnimationFrame` y bucles propios.
> - `setTimeout` / `setInterval` para disparar estados.
> - `transition` de CSS. **Es la trampa menos evidente**: una transición no existe en el timeline hasta que cambia el valor, nace en el reloj de pared, y al arrastrar el cursor hacia atrás dispara transiciones inversas. Fue lo que obligó a reescribir las barras.
> - **SMIL de SVG** (`<animate>`, `<animateTransform>`). Medido: `getAnimations()` devuelve `CSSAnimation` y `CSSTransition` pero **no** las SMIL, y al fijar `currentTime` el elemento animado con SMIL **no se mueve** — sigue su propio reloj. Si un gráfico necesita animar un atributo SVG, se hace con `@keyframes` sobre una propiedad CSS (`stroke-dashoffset`, `transform`, `opacity`), no con SMIL.
> - Vídeo o GIF incrustados: corren con su reloj.
> - `Math.random()` en el render: dos capturas del mismo gráfico saldrían distintas. Si hace falta variedad, que se derive del `graphicData`.
>
> **PERMITIDO:**
> - `@keyframes` de CSS y Web Animations API: `getAnimations({subtree:true})` las pausa y las coloca en `currentTime`. El componente se fija su propio subárbol, sin depender de que alguien lo pause desde fuera.
> - Cualquier valor derivado de `t` con aritmética. Si hace falta una curva de CSS, se resuelve la `cubic-bezier` de verdad (hay un solver Newton-Raphson en `AnimatedGraphic.tsx`) en vez de aproximarla: aproximar reintroduce la divergencia preview/archivo.
>
> **Si más adelante se usa GSAP**, hay que darle reloj manual (`gsap.ticker` a mano, o parchear `performance.now` + rAF). Con su reloj propio se capturarían N frames idénticos.
>
> **Pendiente de medir — `@property` para animar números desde CSS.** Registrando una custom property con `@property --n { syntax: '<number>'; ... }` se puede animar un valor numérico con `@keyframes` en vez de calcularlo en JS. Si funciona, permitiría que una barra o un contador dependientes del dato se animaran con CSS y quedaran posicionables como cualquier otra `@keyframes`, en lugar de necesitar una función tipo `valorEn`. **NO verificado**: hay que comprobar que aparece en `getAnimations()` y que responde a `currentTime`.
>
> ### Lección 1 — el valor rampado también alimenta el TEXTO
> Al convertir una animación en función de `t`, el valor deja de ser el número final y pasa a ser el intermedio. Si ese valor se pinta como texto, hay que **redondearlo**, o donde debía poner `87%` sale `86.65878666273098%`. Pasó de verdad, en `barra_horizontal`, `barra_vertical` y `donut`.
>
> Y el redondeo va **condicionado al modo dirigido**, nunca a secas: sin el prop, un dato con decimales (`87.5`) debe seguir mostrándose con ellos. Redondear sin condición cambia el comportamiento de siempre.
>
> ### Lección 2 — hay que MIRAR un frame, no solo medirlo
> Las aserciones numéricas (bytes del buffer, píxeles opacos, huella del canal alfa) dieron **"EL ENTRY POINT FUNCIONA"** con el número roto en pantalla. El fallo solo apareció al abrir el PNG.
>
> El reverso también: una imagen mala puede venir del **instrumento**. Editar el script de prueba con PowerShell corrompió el emoji del propio test (`🚀` → `ðŸš€`) y el frame parecía denunciar un fallo del componente que no existía. Antes de arreglar nada por lo que se ve en una imagen, comprobar de dónde sale.
>
> **Toda verificación de un gráfico lleva las dos cosas: aserciones y al menos un fotograma mirado.**

> ## PIEZA A — qué tiene que contar el aviso al abrir un proyecto
>
> No solo **ficheros ausentes**. También **clips con categoría no reconocida**, porque ese es un fallo igual de silencioso: un clip cuya categoría no empieza por `original` no recibe el crop, y hoy nadie lo dice. Casos reales medidos: un clip con `category` vacía (1 de 112 en un proyecto guardado) y los clips `'vacio'` de `pista-v2`.
>
> El aviso debe distinguir **de dónde** falta cada cosa, porque decide si se puede recuperar: `originales/` no vuelve sin reimportar el vídeo, `stock/` es re-cortable desde `banco-clips`, e `ia/` y `pista-v2/` costaron dinero.

> ## ⚠️ REGLA DE PRODUCTO — tarjetas y pantalla completa se EXCLUYEN EN EL TIEMPO
>
> Los dos tipos de gráfico **conviven en el mismo vídeo**, pero **nunca a la vez**.
>
> - **Tarjetas actuales** (`AnimatedGraphic` con alpha): apoyo visual ENCIMA del vídeo, que se sigue viendo detrás. **No se reemplazan ni se retiran**: son la forma principal y se seguirán usando.
> - **Gráficos de pantalla completa**: opción ADICIONAL, ocupan su propio tramo como un clip más.
>
> **La exclusión:** si un tramo lleva gráfico de pantalla completa, ahí **no va tarjeta**. Nunca una tarjeta superpuesta sobre un gráfico de pantalla completa.
>
> Consecuencia para el reparto: al colocar los gráficos hay que reservar los tramos de pantalla completa y excluirlos de los candidatos a tarjeta, no repartir cada tipo por su cuenta y confiar en que no coincidan.

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
| **P0 deriva 2.758s** | ☑ | 29/07/2026 | `83a92ff` · frames enteros por slot · 2.758s → 0.102s · verificado con ffprobe (0 ms de error en 3 casos límite) |
| — escalonado de timestamps | ☑ | 30/07/2026 | `7270b95` · **18 de 28 originales (64%) repetían metraje** · verificado visualmente |
| — cuota de stock (ARREGLO 1) | ⏸ | 30/07/2026 | **aplazado**: 3ª muestra en +1 → varianza, no sesgo. Diseño acordado en P1 |
| A2 body+tail/head | ☑ | 30/07/2026 | `6455626` · 38 pares, 0 descartados, `temp_export` limpio · reordenado: A2 solo genera, el recorte va en A4 |
| — cuota y reparto de tipos | ☑ | 30/07/2026 | `ed2ebfc` · conteos exactos · racha mínima demostrable por búsqueda binaria |
| — dedup de fuentes de stock | ☑ | 31/07/2026 | `c849003` · 62→57 fuentes distintas pasó a 367→367 · van der Corput para el offset al reutilizar |
| — prompt sin cuotas de tipo | ☑ | 31/07/2026 | `6afeb90` · **keywords 66% → 100%** · racha 28 → 3 · `alcanzada=2 ideal=2 (optimo)` |
| A3 mini-renders | ☑ | 31/07/2026 | `bb4fd98` · 38 de 38, 0.276s/render · nombres y cadena validados antes de escribir el código |
| **B1** tope de clonado | ☑ | 31/07/2026 | `58e8d79` · 10s · déficit 107 → 13 frames · **audio íntegro, no se pierde narración** |
| **P3** índice por posición | ☑ | 31/07/2026 | `2b7e2de` · `normPorIndice` · desbloquea A4 |
| **A4 ensamblado** | ☑ | 31/07/2026 | `fea9eac` · **las transiciones se ven en el vídeo** · 5412+570=5982 = objetivo P0 · +25.4s |
| — deuda: 38 transiciones, 21 efectos | ⬜ | 31/07/2026 | `XFADE_MAP` colapsa 38 nombres en 21 destinos · `circleopen` ×5 |
| — deuda: déficit de 6 frames | ⬜ | 31/07/2026 | 0.2s · **preexistente a A4** (4 frames antes) · no ocurre siempre |
| **A / B2 (crítica)** | ⬜ | 31/07/2026 | **el vídeo no cubre el audio** · ver la sección de deuda crítica · orden: B2 → A |
| A5 pruebas | ⬜ | | |
| B1-B5 | ⬜ | | |
| C1-C5 | ⬜ | | falta `GEMINI_API_KEY` |
| D1-D6 | ⬜ | | |

# CÓMO RETOMAR EN UN CHAT NUEVO

1. Sube este documento (o ábrelo desde el repo).
2. Di: "Estoy en la Fase __ del Proyecto __. Lo último que pasó fue: __".
3. El chat debe: leer la sección 0 → **verificar el estado real con `git log` y `Select-String` antes de asumir nada** → continuar con las reglas de oro.
4. Al terminar cada fase: marcar el registro, commit, y actualizar este documento.
