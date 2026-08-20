# AUDITORÍA DE CIPHER STUDIO

**Fecha:** 17 de agosto de 2026
**Commit auditado:** `8d0dbb8`
**Para:** alguien que no conoce el proyecto y tiene que retomarlo.

> **Cómo leer este documento.** Cada afirmación va respaldada por una línea de código o por una
> medición. Cuando algo no se sabe, lo dice. Se usan tres marcas y no son intercambiables:
>
> - **✅ VERIFICADO** — medido sobre datos reales o cubierto por una prueba que lo ejercita.
> - **⚙️ COMPILA** — escrito y sin errores de tipos, pero nadie lo ha visto funcionar.
> - **📐 DISEÑADO** — decidido y documentado, sin implementar.

---

# 1. QUÉ ES LA APP

CIPHER Studio es una **aplicación de escritorio (Electron) que monta vídeos verticales narrados
de forma automática**. El usuario importa un vídeo suyo, la app lo transcribe, escribe un guion,
genera la voz y **construye una línea de tiempo mezclando cuatro orígenes de imagen** —el vídeo
original, vídeo de stock descargado, vídeo generado por IA y «Visuales» a pantalla completa—,
les superpone tarjetas de datos animadas y **exporta un `.mp4` sincronizado con la narración**.

Está pensada para **creadores de contenido vertical** que hoy montarían eso a mano. El resultado
final es un único fichero de vídeo listo para publicar. **Es un producto que se va a vender**, y
esa es la razón de la cultura de guardas y mediciones que se ve por todo el código.

---

# 2. EL MAPA DE FICHEROS

## Los dos ficheros grandes

| fichero | líneas | responsabilidad |
|---|---|---|
| **`src/main/index.ts`** | **5 486** | El proceso principal de Electron. **Todo el backend está aquí**: 27 handlers IPC, el pipeline de generación (FASES 1-5), el export completo, el render de gráficos, la caché por hash, las llamadas a DeepSeek / ElevenLabs / Pexels / fal.ai y todos los comandos de ffmpeg. |
| **`src/renderer/src/main.tsx`** | **7 291** | La interfaz entera, en un componente. Estado, línea de tiempo, biblioteca, controles, y los tres caminos que construyen gráficos. |

**Esos dos ficheros son el 92% del código**, y su tamaño es en sí mismo la deuda estructural
principal: no hay separación por módulos, así que cualquier cambio obliga a navegar miles de
líneas y **la misma lógica acaba escrita en dos sitios** (ver §7).

## Lo que sí está extraído

| fichero | líneas | qué es |
|---|---|---|
| `src/shared/reparto.ts` | 131 | La aritmética de los cuatro porcentajes. `repartoObjetivos`, `repartirPesos`, `normalizarPesos`, `PESOS_POR_DEFECTO = [40,30,30,0]`. |
| `src/shared/exclusion.ts` | 154 | La exclusión mutua tarjeta/Visual y las tres protecciones de `colocarYFiltrarTarjetas`. |
| `src/shared/palabra.ts` | 58 | `tieneSignificado`, `palabraDelTramo`: qué palabra pinta un Visual. |
| `src/shared/texto.ts` | 29 | `recortarTexto`, `MAX_CARACTERES_VISUAL = 90`. |
| `src/shared/ciclo.ts` | 114 | ⚙️ El candado del ciclo de animación. **Sin commitear.** |
| `src/shared/semilla.ts` | 67 | ⚙️ La semilla derivada de la palabra. **Sin commitear.** |
| `src/renderer/src/AnimatedGraphic.tsx` | 613 | Los 17 tipos de tarjeta + el Visual de texto + el despacho a composiciones. Función pura de `t`. |
| `src/renderer/src/grafico.tsx` | 152 | Punto de entrada aislado que carga la ventana offscreen. Expone `__montar`, `__setT`, `__listo`. |
| `src/renderer/src/sistemas.ts` | 28 | Los cuatro sistemas de color y `ZONA_SEGURA = {900, 1400}`. |
| `src/renderer/src/composiciones/` | 240 | ⚙️ Registro de composiciones + EXTRUSION. **Sin commitear.** |
| `src/preload/types.d.ts` | 51 | El contrato IPC. Es el índice más rápido de lo que la app sabe hacer. |

## Pruebas (7 suites, todas en verde sobre `8d0dbb8` + árbol actual)

| suite | líneas | qué cubre |
|---|---|---|
| `tests/graficos.js` | 610 | Render real: el MOV existe, dura lo que toca, conserva alfa, frames distintos, caché por hash. |
| `tests/materiales.js` | 338 | Carpetas de proyecto, qué se borra y qué no. |
| `tests/ciclo.js` | 263 | ⚙️ Candado del ciclo + semilla. Aritmética pura. |
| `tests/exclusion.js` | 248 | Tarjeta sobre Visual, incluidas las tres protecciones en una sola llamada. |
| `tests/persistencia.js` | 229 | El proyecto se guarda y se recupera. |
| `tests/reparto.js` | 211 | Los cuatro pesos, con los casos rotos que cazaron el NaN. |
| `tests/via4.js` | 166 | El audio maestro no acaba fuera del proyecto. |

**Todas se importan del bundle compilado, no reimplementan la lógica.** Es deliberado: una
prueba que copiara la regla probaría su copia.

## Documentación

| fichero | líneas | qué es |
|---|---|---|
| `CIPHER_plan_maestro_transiciones_graficos_vibes.md` | 942 | El plan maestro. **Su tabla «DEUDA ABIERTA, por gravedad» es la fuente de verdad** de la deuda del proyecto. |
| `docs/deuda-graficos.md` | 922 | Deuda específica de gráficos y Visuales, 14 entradas. |
| `docs/CIPHER_graficos_contexto.md` | 543 | Contexto del bloque de gráficos. |
| `docs/motion/README.md` | 408 | Manual de estilo del motion: 12 reglas y los cuatro motores. |
| `docs/motion/*.html` | 5 ficheros | Los laboratorios. `lab-volumen` y `lab-materia` son los **motores**; los otros tres, aplicaciones. |

---

# 3. EL FLUJO COMPLETO

## 3.1 Importar

**Usuario:** arrastra un `.mp4` a la biblioteca.
**Debajo:** el vídeo **NO se copia** al proyecto. Es una decisión cerrada, no un descuido: la
biblioteca apunta al fichero del usuario.
**Riesgo asumido:** si el usuario mueve o borra ese fichero, el proyecto se queda sin material y
**hoy la app no avisa** — es la PIEZA A de la deuda, gravedad ALTA.

## 3.2 Recortar

**Usuario:** ajusta el recorte y pulsa transcribir.
**Debajo:** `recortarFuente` materializa **un fichero real** en
`materiales/originales/fuente_recortada.mp4`.
**Por qué existe:** ✅ **medido** — Whisper transcribía **1048 s de un vídeo recortado a 580 s**.
El recorte era solo del editor y seis consumidores leían el original.
**Deuda:** ese fichero **no lo borra nadie**. 26 MB por un recorte de 9:40 sobre un fuente de
45 MB, medido.

## 3.3 Transcribir

**Usuario:** «Transcribir».
**Debajo:** Whisper local, modelo `base` (`MODELO_WHISPER`), con `--word_timestamps True`.
**Produce:** `transcriptSegments` con `start`, `end`, `text` y **`words`** con tiempo por palabra.
**Coste medido:** ✅ **+9%** de tiempo. **145 bytes por palabra** en el `project-state.json`
—~2.2 MB extra en un proyecto de 423 segmentos, un **+17%** sobre 13.4 MB.
**Efecto lateral verificado:** cambia la segmentación, y el texto **sale mejor**.
**Precio de bajar a `tiny`, medido:** pierde entre el **6.5% y el 11.5%** de la narración.

## 3.4 Generar guion

**Usuario:** «Reescribir».
**Debajo:** DeepSeek reescribe la transcripción.
**Produce:** `aiScript`.

## 3.5 Generar voz

**Usuario:** elige voz y parámetros.
**Debajo:** ElevenLabs → `newAudioSegments` con sus propios tiempos.
**Alternativa:** «Usar Audio Original», que extrae `materiales/audio/maestro.m4a` con
`extraerAudioMaestro`, **una función con dos llamadores** — el botón y la sincronía perfecta.
Antes estaba duplicada y ese fue el bug de la Vía 4 (§7.1).

## 3.6 Los porcentajes del mix

Ver §4 entero.

## 3.7 Transiciones

**Usuario:** elige tipos y un porcentaje.
**Debajo:** `assignedTransitions` mapea pares de clips consecutivos → tipo. El export las
renderiza con `xfade`.

## 3.8 Gráficos

Ver §5.

## 3.9 Construir Timeline IA

El camino principal. `handleBuildIATimeline` en `main.tsx`:

1. `generateTimelineAssets({ scriptText, weights, graphicsPercent: 0, … })` — el cero **es
   intencional** desde `e145119`, que partió la construcción en tres fases.
2. **FASE 1** — se calcula el total de clips desde `newAudioSegments`.
3. **FASE 2** — DeepSeek decide tipo, keyword y prompt de cada sub-clip. Después la **cuota**
   (`repartoObjetivos`) corrige los tipos para cumplir los porcentajes.
4. **FASE 3** — se produce cada clip: cortar el original con ffmpeg, descargar de Pexels,
   generar con fal.ai, o renderizar un Visual.
5. **FASE 4** — rellenar los slots fallidos **sin compactar**: el hueco se queda en su sitio.
6. **FASE 5** — ensamblar el timeline secuencial.
7. Después, en el frontend, la fase de gráficos (`regenerateGraphics`) y la de transiciones.

## 3.10 Sincronía Perfecta

Vía alternativa: `generate-perfect-sync` produce un clip V1 y clips V2 de overlay.
**No tiene Visuales** — su reparto es de dos términos y está anotado como deuda.

## 3.11 Exportar

Ver §6.

---

# 4. EL REPARTO DE PORCENTAJES

## De dónde sale cada origen

| origen | de dónde sale el material |
|---|---|
| **Original** | Cortes del vídeo del usuario con ffmpeg. **Es obligatorio**: de él sale el audio. |
| **Stock** | Pexels, por `keyword`. |
| **IA** | fal.ai, por `prompt`. |
| **Visuales** | Se renderizan en una ventana offscreen. **No se descargan.** |

## El orden real, que es lo que importa

1. **Se parte cada frase en sub-clips** — `index.ts:3826`:
   ```ts
   const numClipsExpected = phraseDuration > 4.0 ? Math.ceil(phraseDuration / 3.0) : 1;
   ```
2. **Después** se asignan los tipos, con la cuota de FASE 2 (`index.ts:4148`).

**La consecuencia:** cuando se decide cuánto dura un sub-clip **todavía no se sabe de qué tipo
va a ser**. No hay dónde poner «si va a ser Visual, dale más tiempo».

## Cómo se traduce mover un slider

`repartoObjetivos(weights, total)` reparte los cuatro porcentajes en cuentas enteras. El residuo
va a **original**, que es el origen que siempre puede llenar.

**Regla de producto:** cuando un origen no puede cubrir su parte **se avisa, no se sustituye en
silencio**. ✅ Verificado en el log real:
`[FASE 2] Visuales: se pidieron N pero solo habia M`.

## Lo medido en un proyecto real

Proyecto `kl-1786725625006`, pesos `[21, 60, 0, 19]`, 114 clips:

| origen | pedido | real | | diferencia |
|---|---|---|---|---|
| original | 21% | 27 | 23.7% | +2.7 |
| stock | 60% | 68 | 59.6% | −0.4 |
| ia | 0% | 0 | 0.0% | — |
| visual | 19% | 19 | 16.7% | −2.3 |

Los 2.3 puntos que le faltan a Visuales **son los 3 que se convirtieron en original** por no
tener ninguna palabra con significado en su tramo. Cuadra exacto.

## ⚠️ Un fallo conocido del reparto

**El reparto de cortes del stock deja huecos al principio.** Con stock al 39%, un proyecto real
salió con **los primeros 23 clips —56 segundos— sin un solo plano de stock**. Los totales lo
escondían: 38.6% frente al 39% pedido.

**La causa, reproducida en simulación:** el algoritmo **minimiza la RACHA y no mide el HUECO**.
El log decía `racha stock: alcanzada=1 ideal=1 (optimo)` — cierto según su propio criterio, pero
23 clips seguidos sin stock le parecían óptimos.

**No aparece siempre:** con stock al 60% el sesgo casi desaparece (18/25/25). Falla la
combinación de peso bajo + huecos sin keyword.

---

# 5. GRÁFICOS Y VISUALES — dos cosas distintas

| | **GRÁFICOS (tarjetas)** | **VISUALES** |
|---|---|---|
| qué son | Una tarjeta de datos **ENCIMA** del vídeo | Una pantalla completa que **SUSTITUYE** al plano |
| `type` del clip | `'graphic'` | `'video'` con `category: 'visual'` |
| modo de render | `overlay` | `pantalla` |
| formato | **`.mov` qtrle/argb** — con alfa | **`.mp4` libx264/yuv420p** — opaco |
| dónde viven | `cache/graficos/` | **`materiales/visual/`** |
| ¿se pueden perder? | Sí: falta una tarjeta y el vídeo sigue bien | **NO**: es un clip del timeline; si falta, el hueco descuadra y **el `-shortest` recorta el AUDIO**. ✅ Medido: **3.24 s de narración perdidos** por esa vía |
| entran en el vídeo | Composición aparte, tras el concat | Como un clip más del concat |
| ocupan slider | No. Tienen su propio `graphicsPercent` | **Sí**: son el cuarto peso |

**Por eso `visual` no está en `SUB_CACHE`:** un fichero regenerable cuya ausencia **corrompe** el
resultado no es caché, es material.

## La caché por hash

El **nombre del fichero ES la clave**. `hashGrafico` (`index.ts:1048`) mezcla:

```
type, value, label, unit, emoji, extra,   ancho, alto, duracion, fps,
VERSION_PLANTILLAS, modo, codec, sistema
```

**Lo que no está ahí, no distingue dos ficheros.** ✅ Verificado en datos reales: 37 clips de
Visual y **36 ficheros** — dos clips de la misma palabra y misma duración comparten `.mp4`. Y
**20 de 37 (54%)** comparten duración con otro.

## El lazo cerrado del render

El render **no confía en `paint`**. La página pinta una franja de 8 px —la «sonda»— codificando
`round(t*30)%255`, y el proceso principal **solo acepta el bitmap cuyo índice coincide** con el
`t` que acaba de fijar.

**Por qué existe:** ✅ medido — sin él, `paint` entregaba un frame **~4 atrasado**, y salían
**0 de 90 exactos**.

**Lo que la sonda NO comprueba: el contenido.** Valida *cuándo*, no *qué*. Un canvas en blanco o
un emoji tofu pasan la comprobación (§7.4).

## La exclusión mutua

Una tarjeta sobre un Visual no aporta nada: taparía lo único que se ve. `colocarYFiltrarTarjetas`
hace **tres cosas en la misma llamada**: saca los Visuales del emparejamiento, descarta las que
solapan más de `SOLAPE_MINIMO_S = 0.15`, y devuelve el recuento para el aviso.

---

# 6. EL EXPORT

## Las fases, en orden

| # | fase | qué hace | qué puede fallar |
|---|---|---|---|
| 1 | **P0: cálculo de slots** | `frameTargets` desde `durationSeconds` de cada clip, arrastrando el error en frames enteros | Un clip sin slot válido → `0` = sin recorte (degradación elegante) |
| 2 | **Normalización** | Cada clip a su slot EXACTO, `-colorspace bt709`, `-video_track_timescale 30000` | Falta metraje → `tpad` clona hasta `MAX_CLONADO = 10 s`; más → **AVISO B1** |
| 3 | **A4: transiciones** | `xfade` entre pares, bodies recortados | — |
| 4 | **Concat** | `-c:v copy`. Con tarjetas va a `base_sin_graficos.mp4` sin audio | Mezclar escalas de tiempo → **derrumbe de pts** |
| 5 | **Composición de tarjetas** | Trocea en segmentos de 10 s, compone los overlays, reconcatena | Muchas cosas — ver las guardas |
| 6 | **Mux** | Audio con `-c:v copy -shortest` | `-shortest` corta por la pista más corta |

## Las guardas, y qué detecta cada una

| guarda | qué detecta | qué hace | estado |
|---|---|---|---|
| **Tamaño del bitmap** | La ventana no mide lo pedido | Aborta antes de escribir un MOV cortado | ✅ |
| **Sonda del lazo cerrado** | El frame no corresponde al `t` | Reintenta, tope 5 | ✅ 1.63–1.82 intentos/frame medidos |
| **`segDir` vacío antes de trocear** | Segmentos sobrantes de una pasada anterior | Los borra y lo dice | ✅ **cazó el fallo real** |
| **Recuento del troceado** | `frames(segmentos) ≠ frames(original)` | Descarta la pasada | ✅ **saltó de verdad**: leyó 8507 contra 5979 |
| **Frames tras componer** | Un segmento perdió frames | Descarta | ✅ |
| **`verificarTiempos` del compuesto** | pts no monótonos, último pts, coherencia interna | **Descarta la pasada** | ✅ **cazó el derrumbe**: 1174 pts no monótonos |
| **`verificarTiempos` del final** | Lo mismo sobre el fichero entregado | **AVISA, no descarta** | ✅ |
| **COBERTURA 2** | Tarjetas esperadas vs compuestas | Lo dice explícitamente | ✅ |
| **AVISO B1** | Slot mayor que el metraje por más de 10 s | Avisa | ⚠️ **no salta por un segundo**: se midieron 9.00 s congelados |

**El principio, y está escrito en el código:** cuando la pasada de tarjetas falla, **el vídeo
sale sin ellas pero correcto y sincronizado**. Nunca sale un vídeo roto.

## Coste medido de las guardas

`verificarTiempos` corre dos veces por export. ✅ **16 969 ms** leyendo 6323 frames y **16 495 ms**
leyendo 5977 — **33.5 s** sobre un export cuya composición fueron ~100 s. Un tercio del tiempo
se va en leer pts.

---

# 7. LOS PATRONES DE FALLO — la sección más valiosa

## 7.1 LAS DOS PUERTAS

**La misma lógica escrita en dos caminos. Se arregla uno y el otro queda abierto.**

Ha mordido **cuatro veces**: dos botones de audio, tres caminos de gráficos, seis consumidores
del recorte, y la exclusión de tarjetas.

**Ejemplo real, el último:** hay **tres** caminos que construyen tarjetas. La exclusión mutua
estaba en dos. El tercero —el bloque `if (graphicsPercent > 0)` de `handleBuildIATimeline`, que
es **el que fabrica las tarjetas de verdad**— no tenía **ninguna** de las dos protecciones.

✅ **Resultado medido:** **13 de 40 tarjetas** cayeron sobre un Visual, **2 clavadas exactamente
encima** porque el respaldo emparejaba contra una lista que incluía los Visuales.

**El arreglo que se eligió, y por qué:** no unificar el flujo —los caminos **no** son
equivalentes: uno lee del estado de React y reemplaza, el otro lee de un array local y añade, y
el segundo **no puede** leer del estado porque el `setState` no ha corrido todavía—. Se unificó
**la protección**, metiendo las tres cosas en la misma llamada que coloca, para que no se pueda
colocar bien y filtrar mal.

## 7.2 CONSTANTES DUPLICADAS

**Un número escrito a mano que solo vale para un caso, y que sigue compilando cuando el caso
cambia.**

**Ejemplo real:** el ciclo de las animaciones. Un `animation-duration: 1.5s` es **correcto** para
un ciclo de 3 s y **falso** para uno de 2.6 s, que es la mediana real de un Visual. El bucle
salta y **nada lo dice**.

**El arreglo:** `fraccion(ciclo, n)` es legal para cualquier ciclo **por construcción**, y
`ajustar()` **corrige** en vez de solo avisar. ✅ Probado: 100 pares ciclo×duración, ninguno sale
ilegal.

**Sigue vivo en otro sitio:** `SISTEMAS_VALIDOS` está repetido en `main` y en `renderer` porque
se compilan por separado y no comparten módulo. Está anotado en el propio código.

## 7.3 PROTECCIONES EN CÓDIGO MUERTO

**Peor que no tener protección: no protege, y además convence de que no hace falta buscar más.**

**Ejemplo real:** `handleBuildIATimeline` llama a `generateTimelineAssets` con
**`graphicsPercent: 0` cableado**. Ese cero es intencional. Pero la rama que recibe gráficos de
esa llamada —y **su `excluirSobreVisuales`**— **recibe siempre una lista vacía**.

El resultado: un `grep` de `excluirSobreVisuales` daba un resultado tranquilizador **en el mismo
fichero, a cuarenta líneas** del camino que no la tenía. Por eso el bug de las 13 tarjetas tardó
en verse.

## 7.4 FALLOS SILENCIOSOS

**Sale mal y el sistema afirma activamente que ha funcionado.** El peor modo de fallo que hay.

| caso | qué pasaba | por qué nada lo decía | estado |
|---|---|---|---|
| **Derrumbe de pts** | Concatenar ficheros con escalas de tiempo distintas comprimía los tiempos. **84 s de narración perdidos** | La guarda contaba **frames**, y los 8581 estaban todos. Lo roto era *cuándo* se muestra cada uno | ✅ arreglado, 6 sitios + guarda de tiempos |
| **`segDir` envenenado** | Un export fallido dejaba 29 segmentos «conservados para diagnóstico»; el siguiente escribía 20 y los 9 sobrantes sumaban. **8507 frames contra 5979** | El síntoma acusaba **al troceado**, que era la parte que funcionaba | ✅ arreglado y reproducido con ffmpeg |
| **Caché con diseño viejo** | Cambiar el CSS no cambia el hash → devuelve el MOV antiguo diciendo **ACIERTO** | El CSS no puede entrar en el hash | ✅ mitigado con `VERSION_PLANTILLAS` |
| **Contador congelado** | Rampa de 1.5 s en un gráfico de 1 s → un **87 se graba como 58** | Los frames son distintos, el número es válido. Las cinco comprobaciones pasan | ❌ **abierto**, latente |
| **Pintores** | El canvas quedaría **en blanco** | La sonda valida el `t`, no el contenido | ❌ **abierto**. Descarta **12 de 29** escenas |
| **Emojis tofu** | Si falta la fuente del sistema, salen cuadrados | Igual: nada mira el contenido | ❌ **abierto**. ✅ Hoy funcionan en Windows 11 |
| **Slider a NaN** | El slider de Visuales corrompía el proyecto | La suite tenía 74 088 casos, **todos bien formados** | ✅ arreglado + casos rotos añadidos |

**La lección transversal, y está escrita en `tests/ciclo.js`:** *un test que solo prueba el camino
feliz lo prueba dos veces.* Los casos degenerados van **desde el principio**, no después.

---

# 8. LO QUE ESTÁ A MEDIAS

## 8.1 Aplicado y SIN COMMITEAR

El árbol de trabajo sobre `8d0dbb8` tiene **el bloque de composiciones de Visuales entero**:

```
?? src/renderer/src/composiciones/    (registro + EXTRUSION, 240 líneas)
?? src/shared/ciclo.ts                (candado del ciclo)
?? src/shared/semilla.ts              (semilla desde la palabra)
?? tests/ciclo.js                     (7ª suite)
 M src/main/index.ts                  (VERSION_PLANTILLAS=3, COMPOSICION_VISUAL, canal de avisos)
 M src/renderer/src/AnimatedGraphic.tsx
 M src/renderer/src/grafico.tsx       (la duración viaja a la página)
 M package.json                       (test:ciclo)
 M docs/deuda-graficos.md             (3 entradas nuevas)
```

✅ **Verificado con render real**: EXTRUSION se genera, se ve, y el coste es **3403 ms** de
mediana contra **3569 ms** del Visual de texto — la composición es **más barata**.

**Se dejó sin commitear a petición del usuario**, para ver más generaciones antes.

## 8.2 Commiteado y SIN PROBAR EN LA APP

- **El recorte antes de transcribir** (`trim-left`) se commiteó **explícitamente marcado como no
  verificado en la app**. La lógica está, el recorrido de interfaz no se probó.

## 8.3 Empezado y sin terminar

- **Los Visuales tienen UNA sola composición.** 📐 Con Visuales al 100% un vídeo de 9 minutos
  serían ~200 escenas del mismo hexágono. Falta variedad y una regla de rotación.
- **La composición no significa la palabra.** Un sólido girando no dice «universidades».
- **La posición en el hash**: 📐 **decidido y sin implementar** — entra por `extra`, con
  `phraseIdx` + `clipIndexInPhrase`, y `VERSION_PLANTILLAS` arriba. Se acepta perder el
  reaprovechamiento: 37 de 37 ficheros, ~11 min en un proyecto de 200.
- **Instrumentación temporal viva:** el bloque `[EXPORT-MUX] TEMPORAL` sigue en el código, marcado
  para quitar. Su pregunta **ya está cerrada** (§10).
- **`[DIAG-GRAFICO]` no sirve:** es un `console.log` del renderer y la ventana es offscreen. Su
  salida **no llega al log**.

---

# 9. LA DEUDA TÉCNICA, por gravedad

## 🔴 ALTA — antes de lanzar

1. **SEIS CLAVES DE API EN EL HISTORIAL PÚBLICO.** DeepSeek, ElevenLabs, fal.ai, Pexels, Pixabay
   y Coverr, en `167097a`, `834bc43` y `2a7c4ce`, **ya publicadas** en GitHub. Se recuperan con
   `git show 167097a:.env`. **ORDEN OBLIGATORIO: rotar las seis PRIMERO, reescribir el historial
   DESPUÉS.**
2. **PÉRDIDA DE DATOS SILENCIOSA AL CERRAR.** Un proyecto de 107 MB perdió el guion, la
   transcripción y 148 clips de gráfico. Dos causas: el cierre **destruye la ventana a los 4 s
   pase lo que pase**, y `save-project-state` escribe **directamente sobre el fichero real**, sin
   temporal + rename, así que una interrupción **trunca el original**. La salida es escribir a
   `.tmp` y renombrar.
3. **El repo pesa 218 MB** porque `node_modules` estuvo commiteado. Misma reescritura.
4. **PIEZA A** — avisar al abrir qué materiales faltan y de dónde.

## 🟠 MEDIA

5. **Rampas en segundos absolutos** → un dato falso grabado en el vídeo.
6. **El prompt de gráficos está sesgado**: `decorativo_emoji` sale el **84%**, y **8 de los 17
   tipos son inalcanzables**.
7. **Los pintores no funcionan** — descarta el **41%** de las escenas del manual.
8. **El reparto de cortes del stock deja huecos al principio.**
9. **La cola sin transcribir congela el último fotograma** — 9.00 s medidos, y el aviso B1 no
   salta por un segundo.
10. **`project-state.json` de 18 MB**, el 49% miniaturas en base64.
11. **Los primarios y la curva de color se heredan de la fuente.**
12. **Whisper no es configurable** desde ajustes.

## 🟡 BAJA

13. `fuente_recortada.mp4` no lo borra nadie.
14. **En `perfectSyncMode`, `original` se pinta del mismo color que `stock`.**
15. **El Visual de una frase partida pinta la frase entera** — 6% de los casos, medido.
16. **El criterio «la palabra más larga» atrae errores de transcripción** — eligió `imaginante`.
17. **Los emojis dependen de la fuente del sistema.**
18. `dist/index.html` trackeado pese al `.gitignore`.
19. **La cola del `.gitignore` está en UTF-16LE** — el destrozo de PowerShell, fosilizado.

## Lo que veo yo y no está en las listas

20. **Los dos ficheros de 5 486 y 7 291 líneas son la causa raíz** del patrón de las dos puertas.
21. **`regenerate-graphics` re-transcribe el audio y descarta la lista del frontend.** ✅ Medido:
    produjo **25 segmentos contra los 24** del proyecto. Las tarjetas se colocan indexando en una
    segmentación **que el proyecto no tiene**, y el `phraseIdx` guardado **no se puede auditar
    después**. Cuesta **69 s** por generación.
22. **Las tarjetas se clavan al principio de su frase.** ✅ Medido: `graphicStart` medio **0.22 s**
    sobre frases de mediana **7.1 s**, porque el código coge la **primera** palabra con
    significado. Desfase real contra el instante en que suena el dato: **media +2.24 s**, y **3 de
    6 tarjetas ya habían desaparecido** cuando sonaba su palabra.
23. **`__montar` no recibe `sistema`** aunque el hash **sí lo incluye**. Latente mientras todo sea
    voltaje; el día que haya otro sistema, la caché mentirá.

---

# 10. LOS NÚMEROS MEDIDOS

> Todo lo de aquí está **medido**, no estimado. Nada de esta tabla es una suposición.

## Render de gráficos y Visuales

| qué | valor | fuente |
|---|---|---|
| Visual, coste de render | **3403 ms** mediana | 3 renders alternados, caché fría, con calentamiento descartado |
| Visual de texto, coste | **3569 ms** mediana | igual |
| Coste por frame | **~44 ms** a 1080×1920 | las dos escenas dan lo mismo → **el coste está en el lazo de captura, no en la escena** |
| Lote real de 13 Visuales | **51.0 s** = 3.9 s/Visual | log `[GRAFICOS-LOTE]` |
| Intentos por frame | **1.63–1.82**, 0 en el tope de 5 | log `[GRAFICO] RENDER` |
| Acierto de caché | **0 ms** | primera ejecución del banco |
| Peso de un `.mp4` de Visual | **0.145–0.201 MB**, media 0.169 | 36 ficheros |
| Arranque de la ventana offscreen | **~150 ms**, amortizado | |

## Duraciones

| qué | valor | fuente |
|---|---|---|
| Duración de un Visual | **2.00–2.98 s**, mediana **2.57** | 37 clips |
| Distribución | 15 en 2.0–2.5, 22 en 2.5–3.0 | ninguno fuera |
| Frases de narración | mediana **7.1 s**, min 3.3, max **28.5** | 24 segmentos |
| Coincidencia `.mp4` ↔ slot | **37 de 37** (±0.05 s) | |

## El export

| qué | valor |
|---|---|
| `verificarTiempos` | **16 969 ms** / 6323 frames y **16 495 ms** / 5977 |
| Vídeo que entra al mux | 210.762 s, le faltan **0.14 frames** del objetivo |
| Audio que entra | 210.722 s — **1.20 frames más corto que el vídeo** |
| **Veredicto de los frames que faltan** | **es el `-shortest`, no el concat**. ✅ **cerrado** |
| Deriva sin el recorte por slot | **2.758 s** |
| Narración perdida por un Visual ausente | **3.24 s** |
| Narración perdida por el derrumbe de pts | **84 s** |

## La escala de tiempo

✅ Medido con cuatro trozos de 3 s, 360 frames:

| mezcla | resultado |
|---|---|
| 30000+30000 | 6.000 s ✔ |
| 15360+15360 | 6.000 s ✔ |
| 30000+30000+15360+15360 | **6.127 s** de 12.000 — se comprimen |
| 15360+15360+30000+30000 | **23.44 s** de 12.000 — se estiran |

**Los frames están todos en los cuatro casos. Lo que se rompe son los tiempos.**
Y `-f segment` con `-c copy` **IGNORA** `-video_track_timescale`.

## Encuadre

| qué | valor |
|---|---|
| `FACTOR_ESCALA = 1.6` | `decorativo_emoji` **552 px**, `pasos_proceso` **892 px**, margen lateral **94 px** |
| Por qué no 1.75 | dejaría `pasos_proceso` con ~51 px por lado |
| `ZONA_SEGURA` | 900 × 1400 sobre 1080 × 1920 |

## Emojis

| emoji | px pintados | px saturados |
|---|---|---|
| ☀️ | 7 129 | 7 089 |
| ☁️ | 6 202 | 1 596 |
| 🌧️ | 7 018 | 2 432 |
| 🏞️ | 9 274 | 8 580 |
| 🌊 | 6 858 | 6 703 |

**Ni un tofu** en Windows 11. ⚠️ Los 1 596 de ☁️ son **la barra de acento**, no el emoji: el test
de saturación **no puede descartar tofu en emojis monocromos**.

## La semilla

| qué | valor |
|---|---|
| Palabras probadas | **464** del guion |
| Rangos recorridos | capas 28–52, ancho 34.3–49.8, amplitud 22.1–29.8, cabeceo −17.8…−8.2 |
| Primer sorteo en quintiles | 87/107/85/92/93 — **plano** |
| Variación visible medida | píxeles **+78%**, ancho **+32%**, alto **+36%** |
| **Veredicto** | **La semilla llega y varía mucho, pero varía el tamaño, no la identidad.** Los seis son el mismo hexágono |

## Colocación de tarjetas

| tarjeta | aparece | su palabra suena | desfase |
|---|---|---|---|
| Estadios faraónicos | 0.28 s | 2.38 s | **+2.10** |
| Persecución | 23.86 s | 28.12 s | **+4.26** |
| Sports Washing | 36.56 s | 37.96 s | +1.40 |
| Problemas en países | 74.96 s | 76.40 s | +1.44 |
| Milagro y emotividad | 90.80 s | 94.74 s | **+3.94** |
| Contradicción | 129.56 s | 129.84 s | +0.28 |

**Media +2.24 s, siempre por delante. 3 de 6 ya se habían ido** cuando sonaba su palabra.

---

# 10 bis. DEFECTO CONOCIDO — 3 FRAMES PERDIDOS EN EL MUX

**Medido el 20 de agosto de 2026 sobre el export de `jhklj-1787238284463`. NO bloqueante para
publicar.** Se pierden **0.108 s** de cola de palabra al final del vídeo.

## El aviso que lo destapa

```
El video se ha exportado, pero sus tiempos no cuadran: el ultimo pts es 199.159s
y se esperaba 199.267s (5979 frames a 30 fps).
```

Déficit **0.108 s = 3230 ticks** a `time_base 1/30000`. Y **no es un número entero de frames**,
que es lo que hizo pensar en un residuo sub-rejilla.

## La descomposición: son TRES causas, y suman exacto

| ticks | causa |
|---:|---|
| **+3000** | `framesAcum = 5979` contra `nb_frames = 5976` del contenedor final — **3 frames que faltan** |
| **−1000** | el stream arranca en **pts 1000**, y la guarda asume pts 0 |
| **+1230** | deriva sub-rejilla heredada del base |
| **= 3230** | |

**La causa dominante son los 3 frames, no la deriva.** La deriva sub-rejilla aporta el 38% del
déficit y es la parte que menos importa.

## Dónde se pierden — medido, no deducido

| fichero | `nb_frames` | `duration` |
|---|---|---|
| `base_sin_graficos.mp4` | **5979** ✔ | 199.292 s |
| suma de los 20 `seg_*.mp4` | **5979** ✔ | — |
| `con_graficos.mp4` (salida del overlay) | **NO EXISTE** | — |
| **el export final** | **5976** ✘ | 199.251 s |

**El overlay de tarjetas queda exonerado: en este export no llegó a correr.** La pasada se
descartó (`segmento 9: 313 frames tras componer, eran 314`), así que `con_graficos.mp4` nunca se
produjo y el mux tomó el `base` directamente. La cadena real fue **base → mux → final**.

**Los 3 frames se pierden en el MUX.**

Los últimos pts, lado a lado:

```
base_sin_graficos.mp4          el export final
 5975770 = 199.192333s          5972770 = 199.092333s
 5976770 = 199.225667s          5973770 = 199.125667s
 5977770 = 199.259000s          5974770 = 199.159000s
```

El comando es
`ffmpeg -i base -i audio -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest`.

**Y `-shortest` no explica los tres.** El audio acaba en **199.250998 s = 5977530 ticks**:

| frame del base | instante | ¿dentro del audio? |
|---|---|---|
| 5975770 | 199.192333 s | **DENTRO** |
| 5976770 | 199.225667 s | **DENTRO** |
| 5977770 | 199.259000 s | fuera |

**Dos de los tres frames descartados caen DENTRO de la duración del audio.** Un `-shortest` que
cortara en el final del audio habría quitado uno, no tres. El mecanismo exacto —probablemente la
interacción de `-shortest` con `-c:v copy` y los bloques de 1024 muestras del AAC— **no está
medido**, y no se afirma.

## El segundo defecto: la guarda asume `primer pts = 0`

`verificarTiempos` calcula `esperado = (framesEsperados - 1) / fps`, lo que da el pts del último
frame **suponiendo que el primero está en 0**. Medido: **el stream arranca en pts 1000**, o sea
en 0.033333 s.

**Eso mete un frame entero de error en el propio aviso**, siempre y en la misma dirección: el
mensaje exagera el déficit en exactamente 1000 ticks. Los 0.108 s que reporta son en realidad
**0.075 s** de pérdida real más un frame de error de la propia medición.

No se toca aquí. Queda escrito para que quien lo arregle sepa que **hay dos cosas distintas**: los
frames que se pierden de verdad, y la vara con la que se miden.

## Por qué no bloquea

Los 0.108 s que faltan caen en la cola de una palabra que ya está decayendo. Medido con
`volumedetect` sobre el fichero final:

| tramo | `mean_volume` | `max_volume` |
|---|---|---|
| **últimos 0.20 s** | −28.9 dB | **−11.7 dB** |
| −0.50 a −0.20 s | −20.1 dB | −5.1 dB |
| −3.00 a −2.50 s (referencia) | −22.3 dB | −5.0 dB |

**No es silencio** —−11.7 dB de pico es señal clara— pero está 6.7 dB por debajo del tramo
anterior. Se pierde el final de una palabra, no una palabra.

---

# 10 ter. 🔴 DEFECTO CONOCIDO — UN FRAME DESCARTA LAS 28 TARJETAS

**Medido el 20 de agosto de 2026, mismo export. SEVERIDAD ALTA.** No es una décima de segundo:
es **funcionalidad completa ausente**.

```
[EXPORT-G3] DESCUADRE en el segmento 9 (seg_00009.mp4) tras 3 intento(s):
            313 frames tras componer, eran 314. Dura 10.467s, tramo 91.70-102.17s
[EXPORT-G3] PASADA DESCARTADA: segmento 9: 313 frames tras componer, eran 314 (3 intentos).
            El video sale SIN las 28 tarjetas, pero correcto y sincronizado.
```

**Un frame de diferencia en 1 de 20 segmentos descarta la pasada ENTERA.** Los otros 19 segmentos
se compusieron bien y su trabajo se tira. El vídeo se publica sin ninguna tarjeta.

La regla de "todo o nada" es deliberada y su razón sigue siendo buena: un segmento con un frame
de menos desplaza todo lo que viene detrás y descuadra la sincronía con el audio. Lo que está mal
calibrado no es la decisión, es **el precio**: se pagan 28 tarjetas por un frame.

## Lo que lo agrava: el aviso solo vive en el log

**La ventana de export no lo menciona.** Termina con normalidad y el usuario publica un vídeo sin
tarjetas sin enterarse. Para saberlo hay que abrir `generation-debug.log` y buscar
`PASADA DESCARTADA`.

Es el mismo patrón que la sección 7.4: el sistema **afirma que ha funcionado**. Aquí lo afirma
más fuerte que de costumbre, porque el propio mensaje del log dice *"pero correcto y
sincronizado"* — que es cierto y a la vez oculta que faltan 28 gráficos.

## Relación con el defecto de los 3 frames — sin investigar

Los dos defectos son pérdidas de frames en etapas distintas del mismo export:

| etapa | frames perdidos |
|---|---|
| overlay al componer el segmento 9 | **1** |
| mux | **3** |

**Dos sitios perdiendo frames por separado, posible misma raíz.** Lo que hace la coincidencia
sospechosa es que el overlay reintentó **3 veces** el segmento 9 y perdió el mismo frame las tres
—no es una carrera, es determinista— mientras que el mux descarta dos frames que caen **dentro**
de la duración del audio.

**No investigado.** Queda anotado para que quien ataque uno mire el otro antes de dar por buena
una explicación que solo cubra la mitad.

---

# 11. EL ESTADO DE GIT

## Dónde está

| | |
|---|---|
| **Último commit** | `8d0dbb8` — *colocarYFiltrarTarjetas: las tres protecciones en un sitio* |
| **Fecha** | 15 de agosto de 2026, 00:57 |
| **Remoto** | `github.com/seon4200/cipher-studio` |
| **¿Subido?** | ✅ **Sí.** `origin/master` = `8d0dbb8`, **0 adelante / 0 atrás** |
| **Rama** | `master` |

## Etiquetas — desde dónde volver

| etiqueta | commit | qué garantiza |
|---|---|---|
| `v-graficos-render-ok` | `77ae8b3` | Pipeline de gráficos verificado con un vídeo real de **28 minutos**, export incluido |
| `v-graficos-en-el-video` | `7af9e72` | Los gráficos salen en el vídeo exportado — pipeline completo |
| `v-graficos-export-ok` | `ec9a701` | Los gráficos salen en el exportado, al tamaño nuevo |

**Los tres son puntos de retorno con export verificado.** Si algo se rompe, `v-graficos-export-ok`
es el más reciente con vídeo comprobado de punta a punta.

## El árbol de trabajo

**No está limpio.** Además del bloque de composiciones (§8.1), hay dos ficheros que **ensucian
siempre** y no son trabajo:

- `dist/index.html` — trackeado pese al `.gitignore`; cada build cambia su hash.
- `project-state.json` de la raíz — estado de la app, no código.

## Cómo verificar que nada se ha roto

```bash
npm run build && for s in via4 materiales graficos persistencia reparto exclusion ciclo; do npm run test:$s; done
```

Las siete deben salir con código **0**. `test:ciclo` solo existe con el árbol actual.

---

# CIERRE: lo que hay que saber si retomas esto mañana

1. **El export funciona y está protegido por nueve guardas.** Cuatro han cazado fallos reales.
2. **Lo último en marcha son los Visuales con movimiento.** Funciona una composición, verificada
   con render real, **sin commitear**.
3. **El problema abierto de los Visuales no es técnico, es de diseño**: la semilla varía el
   tamaño, no la identidad. Hacen falta **varias composiciones**, no una parametrizada.
4. **Antes de vender hay que rotar seis claves de API** que están publicadas en GitHub.
5. **Y la lección que atraviesa todo el proyecto:** aquí los fallos no gritan, **afirman que han
   funcionado**. Las guardas no sobran — son lo único que distingue un vídeo correcto de uno roto
   con el log en verde.
