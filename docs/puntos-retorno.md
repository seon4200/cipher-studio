# PUNTOS DE RETORNO

Etiquetas a las que se puede volver, y qué está probado de cada una.

---

## `v-visuales-produccion-usable`

**`44ca34adbcc53c871198e8fddc68543a29a926bf`** · merge de
`ajuste-contraste-global` (`c7f3777`). Es el punto de retorno funcional auditado
antes de sincronizar la documentación con GitHub.

**Qué contiene.** `visual_escena` es la composición de producción;
`VERSION_PLANTILLAS=11`; hay 17 estructuras, 22 fondos, 16 cámaras, 5 densidades,
5 ritmos, 10 tipografías y 4 paletas por proyecto. Incluye el catálogo completo,
selección semántica/relación con respaldo determinista, la dirección en el hash y
la corrección de contraste global. La evidencia de producción versionada más
cercana es `tests/aceptacion/mvp-paso7/`: 42 Visuales en un MP4 real de `1f1a6cb`.

**Qué está comprobado.** El catálogo y las guardias están cubiertos por las suites;
el MP4 citado prueba que el camino real funcionó en ese commit. El cambio de
contraste está protegido por la guardia 3:1 contra caja y fondo dominante.

**Qué NO está comprobado.** No hay una generación real nueva específica de
`44ca34a`; no se certifican variedad perceptual, legibilidad/vecindad de todas las
cajas, coste en las mismas condiciones de la referencia, paridad exacta de emoji
ni calidad semántica humana. Imágenes/recortes, acabado y 16:9 quedan fuera.

**Volver aquí:** conserva el motor activo y todo el trabajo funcional posterior a
`v-fase3-banco`; se perderían los commits posteriores de documentación/sincronía,
no el código del motor. La etiqueta no mueve ninguno de los checkpoints previos.

---

## `v-antes-del-interruptor`

**`94685f2c9097d5afcb64342d4eff7b3210b4f7e7`** · ultimo `master` con
`COMPOSICION_VISUAL='visual_mapa'` y `VERSION_PLANTILLAS=8`.

Es el retorno inmediato si activar `visual_escena` degrada una generacion real. Conserva el
motor combinatorio registrado, el tono claro y las 36 identidades verificadas, pero deja el
motor nuevo apagado.

**Que queda despues de esta etiqueta:** el paso `v-fase4f-interruptor` resuelve la direccion
completa antes de renderizar, la incorpora a `graphicData.extra` —y por tanto al hash— y cambia
el selector a `visual_escena`. No persiste la especificacion: reabrir conserva el MP4; regenerar
el timeline vuelve a sortear con el catalogo vigente, por decision de producto.

---

## `v-fase4d-tono-claro`

Merge `--no-ff` del lote de tono claro y parejas: tinta declarada por cada sistema,
`tramaTejida` portada de `lab-fondos-2.html:318-333`, parejas desacopladas de constelacion
y guardia del orden de sorteo sobre el bundle. Produccion sigue en `visual_mapa`, version 8.
Repertorio medido: **36 identidades / 166.470 instancias**, con 4/4/4 de capasApiladas
todavia provisionales. La excepcion del emoji del heroe fuera de `caja()` queda anotada.

**Verificacion exigida para etiquetar:** clon nuevo de master, `npm ci`, typecheck,
build por ficheros de renderer/main/preload y las nueve suites con `npm test`.
La etiqueta es local: este cierre NO autoriza push.

**Que queda despues de esta etiqueta:** calibrar los pasos pendientes, completar vocabulario
y mover el interruptor EN EL MISMO PASO que incorpora la direccion resuelta al hash.
Volver aqui conserva tono claro y parejas, pero NO activa `visual_escena` ni resuelve
la tasa real de respaldo del pie. Ver la precondicion en `deuda-graficos.md`.

---

## `v-fase4a-primeras-piezas`

La primera estructura nueva (`capasApiladas`) y dos fondos nuevos (`tunel`, `skyline`) entran
junto con `ondas` corregida contra su lab. La hoja de seis identidades demuestra que el eje
fondo y el eje estructura producen geometrias distintas. `visual_escena` sigue registrada e
inactiva: `COMPOSICION_VISUAL='visual_mapa'`, `VERSION_PLANTILLAS=8`.

**Qué hay después de la etiqueta:** faltan las piezas restantes del vocabulario minimo, la
conexion de fondos claros con tinta y el interruptor de la Fase 4. Volver aqui conserva el
primer lote real y deja fuera todo eso.

---

## Sobre la reproducibilidad del render — versión definitiva

Esta sección se ha escrito tres veces. Las dos primeras estaban mal, y el motivo
de las dos es el mismo error: **`n=2` no es evidencia.**

**Lo medido, con seis tiradas del mismo clip:**

| tirada | resultado |
|---|---|
| `c11226f` · `3b24804` · `BIS` · `P1` · `P2` | **idénticas al byte** en los tres frames |
| `5cb7d33` | difiere en dos frames |

**Cinco de seis coinciden.** El render **es determinista con una anomalía
intermitente**, no "no reproducible".

**Cuánto difiere la anómala** (frame 77, el peor):
delta **máximo 37**, **medio 2,0**, el **99 % de los píxeles que cambian tienen
delta ≤ 4**, y **cero** píxeles con delta > 64.

**El discriminador que sale de ahí, y que sustituye a la igualdad byte a byte:**

| firma | qué significa |
|---|---|
| pocos píxeles, delta enorme | **algo se movió de sitio** — cambio real |
| muchos píxeles, delta ≤ 4, ninguno > 64 | **rasterizado** — ruido, no cambio |

**Pista, no conclusión:** la tirada anómala fue el **primer render en un clon
recién instalado**, con cachés de fuentes y shaders en frío. Una sola observación.

**Lo que NO es, y yo dije que sí:** no es el cimiento de la Fase 3. El verificador
compara frames **dentro de un mismo vídeo** —no vacíos, distintos entre sí, capas
cíclicas que cierran, contenido en zona segura—; ninguna de esas cuatro cosas
necesita que dos renders coincidan. Era una molestia de herramientas, no un
cimiento.

**Lo que sí queda tocado:** cualquier comparación entre renders se hace **con
tolerancia**, nunca por igualdad de bytes.

**Descartado con línea:** `grafico.tsx:193` pausa cada animación y le fija
`currentTime = t*1000` **absoluto**; `index.ts:1408` llama a `__setT(t)` **una vez
por frame, fuera del lazo de reintentos**. Un reintento repite `capturePage()`
sobre el mismo DOM. **El tiempo no es la causa, y la hipótesis del lazo de
reintentos está muerta.**

**Sospechosos vivos, de rasterizado:** `backdrop-filter` (`mapa.tsx:202`),
`mix-blend-mode` (206), `filter:blur` (212), el SVG (537), ocho gradientes. Y un
detalle del mecanismo: **la sonda valida su propia franja de 8 px, no el frame
entero** — que esa franja llegue al compositor no prueba que una capa de GPU haya
acabado de repintarse.

---

## `v-fase3-banco`

**Merge `581ac6b804edb9607a2c935fcf5f1c6b4a3bb305`** · `--no-ff`.

El banco monta el mismo `AnimatedGraphic` que el render real y permite mirar una
combinación sin captura ni FFmpeg. Se abre con `npm run banco` y la URL
`http://127.0.0.1:5174/banco.html`. El modo `banco` vive en el único
`vite.config.ts`, excluye los plugins que arrancan Electron y produce **cero**
`banco-*.js` en `dist/`.

Incluye la comprobación compartida de fuentes, dirección y semilla visibles, zona
segura, reloj dirigido, registros de piezas y la normalización de aristas SVG con
`pathLength=1`. La composición nueva sigue inactiva:
`COMPOSICION_VISUAL='visual_mapa'` y `VERSION_PLANTILLAS=8`.

**Qué hay después de la etiqueta:** nada de las fases posteriores. El siguiente
paso es 3.6, la hoja de contactos y la calibración perceptiva de `pasos`. Volver a
esta etiqueta conserva el banco y deja fuera ese trabajo.

---

## `v-puente-suelo` — último checkpoint ejecutable

**`4157e0c81687caf4ae263a7e3cd6a239c908e2df`** · merge `--no-ff`.

Añade el suelo de pruebas sin tocar `src/`: `npm test` con nueve suites y seguro de
conteo, arneses de aceptación versionados y comparador de capturas con tolerancia.

**Qué hay después de la etiqueta:** `97cad34` retira el porcentaje del veredicto del
comparador; `56f02ba` incorpora los cuatro documentos canónicos; `86045c6` archiva el
contexto que quedó falso desde la Fase 1; y el commit documental que contiene esta nota
corrige las deudas cerradas y los nombres canónicos. Volver a la etiqueta deja atrás
todo eso, aunque no cambia el código de la app.

---

## `v-fase2-avisos`

**`1db2f487dacbd78bc48e0150cca2985a7135b162`** · merge `--no-ff`.
Etiqueta anotada `046fdaf`, confirmada en remoto.

La app ya **no puede** decir *"éxito, 78 de 78"* mientras la mitad del vídeo se
degrada.

| commit | qué |
|---|---|
| `6bc3695` | `shared/avisos.ts` puro + la novena suite, con el 25/8 congelado |
| `0d1d67c` | los seis puntos de anotación + el arrastre en el aplanado |
| `406b4d6` | canal `generation-aviso`, emisor, preload y ventana |
| `5cb7d33` | **aislado**: borrar `graphicsDecision` (−85/+12) |
| `6c70748` | la nota del determinismo, sin una línea de código |

**Verificado desde clon nuevo:** `npm ci` 0 · `tsc` 0 · `build` 0 en tres pasos por
ficheros · nueve suites verdes · hash `db7cb15ea714` · el texto del 25/8 idéntico
palabra por palabra.

**Qué hay después de la etiqueta:** el puente completo (`4157e0c`), el arreglo del
comparador (`97cad34`) y toda la documentación canónica y de retorno posterior. Volver
aquí conserva los avisos, pero pierde el ejecutor del conjunto, los arneses versionados
y el comparador tolerante.

**El texto que produce:**

```
[ ERROR ] DeepSeek rechazó la petición por saldo agotado. Sin él no hay
          palabras clave…  (x5)
Resumen de la generación: 57 clips.
  original: se pidieron 28 y salieron 28
  stock:    se pidieron 11 y salieron 0  (-11)
  IA:       se pidieron 0  y salieron 0
  Visual:   se pidieron 18 y salieron 18
11 clips no salieron como se pidió y se rellenaron con otra cosa:
  11 — clips de stock que se quedaron sin palabra clave y se dejaron como
       vídeo original
El vídeo NO salió como se pidió. Revisa los avisos de arriba antes de exportar.
```

---

## `v-fase1-escena-inactiva`

**`3b248045d00e8d3a903d6518c968e3e7f1799580`**

La composición combinatoria (`escena`) **registrada, verificada e INACTIVA**.
El interruptor: `COMPOSICION_VISUAL` en `src/main/index.ts`, hoy `'visual_mapa'`,
aislado en `261269d` para la Fase 4. `VERSION_PLANTILLAS = 8`.

Cuatro capas · registro de piezas con contrato tipado · `direccionDe(semilla)` ·
ranura de héroe · `cqmin` con `container-type: size` · `calc(var(--ciclo) / n)` ·
`rangos` de instancia · `combinacionesLegales()` con **dos** números
(2 identidades, 1.176.000 instancias — el segundo, inflado).

**Qué hay después de la etiqueta:** toda la Fase 2 (`1db2f48`), el puente
(`4157e0c`) y sus correcciones y documentos posteriores. Volver aquí conserva el motor
nuevo inactivo, pero pierde los avisos y el suelo de pruebas.

---

## `v-paso9-mapa-sin-palabra`

**`757b6ccd9c7e2290d31ca024dc96f2863039b8d2`** — `mapa` funcionando, sin nada del
motor combinatorio. La red de último recurso.

**Qué hay después de la etiqueta:** la Fase 0 (`c11226f`), el motor combinatorio de
la Fase 1 (`3b24804`), los avisos de la Fase 2 (`1db2f48`), el puente (`4157e0c`) y
toda la documentación posterior. Volver aquí pierde el motor nuevo entero, aunque
`visual_mapa` sigue siendo la composición activa en ambos lados.

---

## Cómo volver

```
git checkout <etiqueta>
```

Verificar **desde clon nuevo**: `git clone` + `npm ci` sin `node_modules` padre.
Un worktree NO sirve, y **un clon con borradores dentro deja de ser un clon
limpio** — se consume.

## Lecciones que costaron tiempo

- **`n=2` no es evidencia.** Una comparación pareada no prueba reproducibilidad;
  hace falta una tercera tirada como árbitro. Dos veces se dio por buena y por mala
  la misma medición por no tenerla.
- **El código de salida es la autoridad, no el texto.** Una suite rota llegó a
  imprimir "TODO CORRECTO" y salió en rojo igualmente.
- **Un bundle viejo miente.** Un arnés falló y tenía razón: el `dist-electron` del
  repo de trabajo era anterior al commit que probaba.
