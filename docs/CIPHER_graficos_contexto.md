# CIPHER Studio — Gráficos: contexto completo para continuar
### 3 agosto 2026 · Sube este documento al chat nuevo y di "sigo desde aquí"

---

## 0. LO QUE HAY QUE ENTENDER PRIMERO

**Son DOS tipos de gráfico distintos que van a CONVIVIR**, no uno que sustituye al otro:

| | Tarjetas actuales | Gráficos nuevos |
|---|---|---|
| Qué son | tarjeta pequeña abajo | pantalla completa |
| Dónde van | **ENCIMA** del video, que sigue viéndose detrás | **REEMPLAZAN** al video 2-3s, como un clip más |
| Necesitan alpha | **SÍ** | **NO** |
| Estado hoy | 17 tipos construidos, se ven en el preview pero **NO se exportan** | no existen todavía |
| En el mix | van encima, no ocupan slot | ocuparían slot junto a Original/Stock/IA |

**REGLA DE DISEÑO YA DECIDIDA:** las tarjetas y los gráficos de pantalla completa **se excluyen mutuamente en el tiempo**. Nunca una tarjeta encima de un gráfico de pantalla completa. Si un tramo lleva gráfico de pantalla completa, ahí no va tarjeta.

**El problema que se resuelve:** hoy los gráficos son HTML del renderer. Se ven en el preview y desaparecen del video final.

---

## 1. LA VÍA G — el hallazgo que lo hace viable

### El supuesto que se rompió

Todas las comparativas (HyperFrames, Remotion) asumen capturar Chromium **desde fuera** con screenshots por CDP. Ese es el cuello de botella: ~6 capturas/segundo → 90 frames = ~15s por gráfico.

**Pero CIPHER *es* Electron.** La animación vive en nuestro propio Chromium: se puede codificar **desde dentro**.

```
Capturar por screenshots (HyperFrames/Remotion):  ~15s por gráfico
Vía G (offscreen desde dentro):                    2.5s por gráfico   ← 6× más rápido
```

**Precedente que lo valida:** CasparCG (broadcast, open source) lleva años renderizando templates HTML vía CEF y mezclándolos en señal de TV **en vivo**, con fill & key para el alpha. HTML animado no es lento por naturaleza — es lento cuando lo capturas por screenshots.

**Consecuencia:** no hace falta HyperFrames ni Remotion. Ni dependencias externas, ni Node 22 en la máquina del usuario final, ni rehacer los templates. Se capturan los componentes que ya existen.

### Comparativa que se descartó (por si se retoma)
- HyperFrames y Remotion **rinden igual**: el cuello es la captura del Chromium headless en ambos.
- HyperFrames: 60s vs 162s de Remotion (+4 min de build inicial). Archivo 4MB vs 14MB.
- HyperFrames es Apache 2.0 (gratis siempre); Remotion cobra licencia de empresa al crecer.
- **La vía G los hace innecesarios.**

### Otras vías evaluadas y descartadas

| Vía | Qué es | Coste | Por qué se descartó |
|-----|--------|-------|---------------------|
| A | PNG único + movimiento con ffmpeg (zoom, pan, fade) | ~1s/gráfico | sin barras que crecen ni contadores |
| B | Composición por capas: 3-5 PNG animados con `overlay` y expresiones en `t` | ~3s/gráfico | punto medio, quedó como plan B |
| C | Frame a frame con virtual time (`Emulation.setVirtualTimePolicy`) | ~15s/gráfico | resuelve determinismo, no velocidad |
| D | Salir de Chromium: resvg (Rust), @napi-rs/canvas, ThorVG | ~10ms/frame | requiere rediseñar templates a SVG/canvas |
| E | Pre-hornear la animación a WebM alfa, componer solo el dato | ~0s/gráfico | la animación no puede depender del dato |
| F | WebCodecs en el renderer | rápido | codifica canvas, no DOM → reescribir templates |

**Descartado también: modelo de IA local.** Lento, no determinista, y no escribe "87%" de forma fiable. Serviría para *diseñar* templates, no para renderizarlos.

---

## 2. LO QUE YA ESTÁ CONSTRUIDO Y VERIFICADO

| Pieza | Estado | Commit |
|---|---|---|
| El prop `t` — los gráficos son funciones puras del tiempo | ✅ 18/18 idénticos sin el prop | `bcc707b` |
| `AnimatedGraphic` extraído a su propio módulo | ✅ 18/18 contra HEAD anterior | `f65a783` |
| Entry point aislado (`grafico.html` + `grafico.tsx`) + arreglo del número | ✅ | `993de27` |

### Los 8 detalles técnicos de la vía G (obligatorios, medidos)

**a) Handshake por frame, NUNCA un temporizador.** OSR no genera frames si la página no cambia → con intervalo fijo salen duplicados y negros.

**b) PERO el handshake solo NO BASTA.** `invalidate() → paint` entrega un frame **anterior** al estado fijado — desfase de 4 frames, ninguno de los 90 exacto. Medido: el frame 45 marcaba 79% cuando tocaba 87%. **La solución es cerrar el lazo:** leer una sonda del bitmap y reintentar hasta que llegue el frame pedido. Subir el framerate acelera pero empeora la exactitud.

**c) El bitmap es BGRA, no RGBA.** A ffmpeg: `-f rawvideo -pix_fmt bgra -s 1920x1080 -r 30 -i -` por stdin. Sin PNG, sin base64, sin disco.

**d) `getBitmap()` NO COPIA los datos.** Hay que usar el Buffer en el **mismo tick** del event loop o pueden cambiar/destruirse (hubo un use-after-free en Electron por esto). Usar `Buffer.from(image.getBitmap())` ANTES de cualquier `await`.

**e) Backpressure del pipe:** `if (!stdin.write(buf)) await once(stdin, 'drain')`.

**f) El reloj no cubre todo.** `document.getAnimations()` solo controla CSS y Web Animations API. GSAP o `requestAnimationFrame` a mano NO se pausan. **Y SMIL de SVG tampoco** (`<animate>`, `<animateTransform>` siguen su propio reloj) — medido.

**g) Preflight antes del frame 0:** `await document.fonts.ready` y esperar que las imágenes estén decodificadas.

**h) Medir el coste de ARRANCAR la ventana offscreen aparte del coste por frame.** Reutilizar UNA ventana para los 20 gráficos amortiza los ~150ms.

### El pipe NO es el cuello de botella
Un pipe mueve GB/s: 750 MB es menos de un segundo de memcpy. Escribir a disco sería estrictamente peor (mismos bytes + I/O). Si algún día lo fuera, la salida es bajar bytes en origen: encoder por hardware (`h264_nvenc`/`h264_qsv`) o la ruta `useSharedTexture` sin copia a CPU.

### El alpha: funciona, con matices

```
Alpha en el bitmap:  SÍ (0 de 1600 píxeles opacos en zona vacía)
Viene PREMULTIPLICADO → overlay=...:alpha=premultiplied
```

| Códec | Conserva alpha |
|---|---|
| **mov / qtrle** | ✅ verificado píxel a píxel |
| WebM/VP9 | declara `alpha_mode=1` pero sale `yuv420p` → perdido |
| H264 | perdido (esperado) |

*Nota honesta: VP9 **puede** con alpha (pesaría ~100× menos: 104 KB vs 10.8 MB), pero no se encontró el comando que lo consigue. Hoy el que funciona es qtrle.*

**Si algún día el alpha fallara:** plan B = **fill & key** (truco de broadcast): renderizar color sobre negro + máscara b/n, unir con `alphamerge`. Son DOS pasadas de render, no el doble del coste total (el encode es barato).

**Y la carta estratégica:** el alpha solo importa para las tarjetas. Los gráficos de pantalla completa NO lo necesitan.

### Las duraciones deben elegirse EN FRAMES, no en segundos
0.2s=6 frames · 0.3s=9 · 0.4s=12 · 0.5s=15. **0.25s serían 7.5 y no existe** — elegir valores que no caen en frame entero reintroduce la cuantización que costó días eliminar.

---

## 3. LOS NÚMEROS MEDIDOS

### Coste por tipo de gráfico (con `graphicData` real)

```
Media ponderada por el reparto real:  1634 ms por gráfico
Media simple:                         1951 ms
Réplica cargada (blur 90px, gradientes, backdrop-filter):  2.5s
```

*La media ponderada sale POR DEBAJO de la simple porque el 84% son `decorativo_emoji`, que es de los baratos.*

### El coste total en un video real

```
Proyecto típico (19 gráficos):
  Renderizar los MOV:     ~31s
  Superponer (todo):       41.4s
  Superponer (troceado):   33.5s   ← 74.5% del video se queda en copia
  
  Export:  2m01s  →  3m13s
```

**Estimación fallida que conviene recordar:** se estimó +60-100s para el overlay; medido son 41.4s. El compositing encima es casi gratis.

### Por qué TROCEAR y no recodificar todo
19 gráficos son 38s de 286, o sea el **13% del video**. Recodificar el 87% restante para pegar gráficos que ocupan el 13% es degradar calidad regalada — inaceptable en un producto que se vende.

---

## 4. LA DECISIÓN CLAVE: troceado, NO overlay en A4

Se evaluó superponer en A4 (donde ya se recodifican los bodies, coste marginal casi nulo). **Se descartó**, y la razón es de modo de fallo:

> Si un recorte falla, A4 revierte a bodies enteros sin transiciones — y ahí los gráficos **desaparecerían del video entero, en silencio**.

El troceado es una pasada posterior: si falla, tienes el video correcto sin gráficos. **Modo de fallo seguro.** El modo de fallo pesa más que los 30 segundos.

### Hallazgo que queda guardado para el futuro (variante B)
Si algún día se hace el overlay en A4: con el gráfico **solo en los bodies**, desaparece durante la transición — 15 frames en blanco en plena animación (medido, visto en el frame 90). La solución es superponer **también en tails y heads**: el `xfade` mezcla gráfico con gráfico, así el fondo se funde y la tarjeta no.

**Y el reparto tendría que hacerse DESPUÉS de decidir la degradación, no antes.**

### Confirmado: sobre el video ya concatenado no hay problema
Se verificó mirando el frame: una tarjeta superpuesta sobre el fundido ya horneado se ve **sólida a plena opacidad**, visualmente igual que la variante B. El defecto de la variante A era específico de superponer ANTES del xfade.

---

## 5. LAS PIEZAS DE INTEGRACIÓN (lo que falta)

> **Las 4 cosas de la sección 6 NO son una lista aparte: cada una tiene su pieza.**
> Están marcadas abajo con `[COBERTURA]`. Si una pieza se cierra sin su cobertura, el bug entra.

### ⚠️ Pieza 0 (G0) — Los clips `graphic` en `auditarClips` — VA ANTES QUE TODO
**Hallazgo verificado sobre el código, 3 ago.** La auditoría de materiales de la PIEZA A (`index.ts:404`) hace:

```
if (!c || !c.path) { sinRuta.push(ficha); continue; }
```

No mira el `type`. Y los clips de tipo `graphic` **no llevan `path`** — se construyen en `main.tsx:2479-2487` sin él. Consecuencia: cada gráfico del timeline entra en `sinRuta`, `hayProblema` se vuelve `true`, y **la guarda del export bloquea el export diciendo que falta material que no falta**. Con el reparto real: *"faltan 19 de N clips"* siendo todos correctos.

*Pendiente de confirmar:* si el array `clips` que llega a `export-video` contiene ya los objetos de tipo `graphic`. Los de `main.tsx:2479` llevan `id` con `Math.random()`, lo que sugiere objetos de vista no persistidos. Si los contiene, el fallo es de **hoy**; si no, es de en cuanto se integren. En ambos casos hay que arreglarlo antes de la pieza 1.

**El arreglo obvio es el equivocado.** Excluir `type === 'graphic'` a secas deja el sitio vacío: después de la pieza 1 esos clips **sí** tendrán un MOV en `cache/graficos/`, y ese MOV es material que puede desaparecer. Excluirlos sin más te quita el aviso justo donde la COBERTURA 2 lo exige.

**Decisión:** bucket propio para los `graphic`. No entran en `sinRuta` ni en `faltan`. Hoy, sin MOV, no dispara nada ni toca `hayProblema`. Queda el enganche para cuando exista `graphicMovPath`: entonces será aviso propio y **no bloqueante** (perder un gráfico no es perder un clip de vídeo).

*El test no lo cubría porque el fixture de 623 clips no tenía ni un `graphic`. Añadir clips `graphic` sin `path` al fixture y asertar que un proyecto sano CON gráficos no dispara la guarda.*

### Pieza 1 — `renderGraphicClip(graphicData, opciones)` en el backend
Ventana offscreen **reutilizada** (una para todos, amortiza los ~150ms de arranque), carga `dist/grafico.html`, lazo cerrado con la sonda, salida `.mov` qtrle con alpha.

**Caché por hash de `graphicData` + WxH + duración + fps.** El WxH en la clave es obligatorio: al generar no se sabe si se exportará 1080p, 720p o 4K. Si al exportar el formato no coincide → fallo de caché y se rehace. **Lo que no puede pasar es escalar un MOV de 1080 a 4K.**

Fallback a `null`: si un gráfico falla, se pierde ese gráfico, no el export. ~150 líneas. **Aquí está todo el riesgo técnico; el resto es fontanería.**

`[COBERTURA 1 — INVALIDACIÓN]` **El tiempo de inicio NO va en el hash.** El hash contesta *"¿son estos los píxeles correctos?"*; la colocación contesta *"¿dónde lo pego?"*. Son preguntas distintas y solo una va en la clave. Los píxeles de un MOV dependen de `graphicData` + WxH + duración + fps — **no de dónde se coloque en el timeline**. Meter el inicio en la clave haría que mover un clip 0.1s provocara fallo de caché y re-renderizara un fichero byte a byte idéntico: con 19 gráficos, reordenar el timeline una vez costaría 31s de render para no cambiar ni un píxel.

**La invalidación se cubre en la pieza 3, no aquí:** garantizando que el export lea `inicioSegundos` y `duración` **del clip, en el momento de exportar**, y nunca de algo guardado junto al MOV. Si se leen frescos, mover un clip es automáticamente correcto y no hay nada que invalidar.

Lo que sí invalida de verdad y ya está en la clave: **la duración** (2s ≠ 3s son animaciones distintas) y el `graphicData`.

**⚠️ PRIMER CAMBIO DE ESTA PIEZA — sacar `graficos` de `SUB_CACHE`.** `cache/graficos` está en `SUB_CACHE` (`index.ts:355`) y `cleanupProjectTemp` (`index.ts:435-447`) la borra entera. Sin esto: renderizas, cierras, reabres, exportas → **no hay gráficos**, o hay que re-renderizar 31s.

*Va en la pieza 1 y no en la 2 porque **la pieza 1 es la primera que escribe en esa carpeta** y la primera que monta caché por hash. Si se deja para después, la caché parece funcionar dentro de una sesión y se evapora al cerrar y reabrir el proyecto — persiguiendo fallos de caché fantasma toda la tarde. Debe estar antes de dar por verificada la caché de la pieza 1.*

**Decisión tomada:** sacarlo de `SUB_CACHE`. NO moverlo a `materiales/` (no es irreemplazable, solo caro de regenerar). *Consecuencia: nada borrará `cache/graficos` hasta la PIEZA B (caducidad), anotado en la deuda.*

*`cleanupProjectTemp` tiene **cinco** puntos de llamada — `:109` (cierre de ventana), `:538` (create-project), `:567` (load-project), `:590` (close-project), `:798` (open-project). Comprobar que ninguno borra `cache/graficos` por otra vía.*

### Pieza 2 — Renderizar al pulsar "Generar Gráficos"
Después de `regenerate-graphics`, renderizar cada tarjeta y guardar la ruta en el clip. Con progreso (~31s para 19). ~40 líneas.

**Por qué al generar y no al exportar:** el coste se paga ahí y el export solo compone. Y ves los gráficos listos antes de exportar.

*La verificación de la pieza 1 sobre `SUB_CACHE` se cierra aquí: renderizar, cerrar el proyecto, reabrir, y comprobar que los MOV siguen estando.*

`[COBERTURA 3 — PREVIEW vs ARCHIVO]` Al regenerar, **invalidar el MOV de todo gráfico cuyo `graphicData` haya cambiado**. Si el preview dibuja algo distinto de lo que hay en el MOV, se exporta lo que no se ve.

`[COBERTURA 4 — ACUMULACIÓN]` Al regenerar, **borrar los MOV huérfanos** (los que ya no corresponden a ningún gráfico del timeline). Sin esto: 431 MB por tanda en un proyecto grande, tres tandas 1.3 GB.

### Pieza 3 — El export recoge las tarjetas
Hoy `videoOnly` las excluye con `c.type !== 'graphic'` (`index.ts:1761-1762`) — **eso no se toca**. Se recogen aparte, en una lista de `{mov, inicioSegundos, duración}`. La aritmética de frames no se entera. ~20 líneas.

`[COBERTURA 1 — INVALIDACIÓN]` `inicioSegundos` y `duración` se leen **del clip, aquí, en el momento de exportar**. Nunca de un fichero de metadatos guardado junto al MOV ni de nada persistido al renderizar. Es lo que hace que mover un clip sea correcto sin invalidar nada.

`[COBERTURA 2 — FALLO SILENCIOSO]` Contar **cuántas tarjetas hay en el timeline y cuántas tienen MOV**. Si no coinciden, avisar antes de exportar — como la guarda de materiales de la PIEZA A. Nunca 17 de 19 en silencio.

### Pieza 4 — La pasada de troceado, después del concat
Trocear por keyframes con el muxer `segment`, recodificar solo los tramos con tarjeta, concatenar.

**La propiedad que la hace segura:** si el recuento de frames no cuadra con el objetivo, se descarta la pasada y se queda el video sin tarjetas. **El export nunca entrega un video desincronizado.** Es la misma degradación todo-o-nada que ya usa A4. ~120 líneas.

`[COBERTURA 2 — bis]` Si la pasada se descarta, **decirlo**. Un video sin gráficos que debería tenerlos es exactamente el fallo silencioso que hay que evitar.

### Pieza 5 — Limpieza
Borrado con los temporales del proyecto, y huérfanos al regenerar gráficos.

---

## 6. LAS 4 COSAS QUE HAY QUE CUBRIR — y en qué pieza va cada una

| # | Qué | Dónde se cubre |
|---|-----|----------------|
| 1 | **INVALIDACIÓN.** Si mueves un clip o cambias duraciones, el MOV podría apuntar a un tiempo que ya cambió | **Pieza 3** — leer inicio y duración del clip al exportar, nunca de algo guardado junto al MOV. La **duración** sí va en el hash de la pieza 1; **el inicio no** |
| 2 | **FALLO SILENCIOSO.** Verías 19 gráficos y saldrían 17 sin enterarte | **Pieza 3** (contar y avisar) + **Pieza 4** (avisar si se descarta la pasada) |
| 3 | **PREVIEW vs ARCHIVO.** El preview dibuja en vivo, el MOV se renderizó antes | **Pieza 2** — invalidar al regenerar |
| 4 | **ACUMULACIÓN.** Los MOV viejos se apilan al regenerar | **Pieza 2** — borrar huérfanos |

**El principio que las une**, ya escrito en el plan: *"el export cuenta cuántas esperaba y cuántas compuso, y lo dice. Nunca 17 de 19 en silencio."*

### Tamaños medidos (qtrle es sin pérdida)
```
1.65 MB por gráfico de 2s
19 gráficos  →  ~31 MB
34 gráficos  →  ~56 MB
261 gráficos →  ~431 MB   ← un proyecto grande real
```
Van a `proyectos/<id>/cache/graficos/`.

---

## 7. LOS GRÁFICOS DE PANTALLA COMPLETA — lo que falta DECIDIR

Todo lo anterior es sobre las **tarjetas actuales**. Los de pantalla completa comparten la infraestructura (vía G, prop `t`, entry point) pero tienen decisiones propias **sin tomar**:

### a) El sistema de porcentajes
Hoy el mix es **Original / Stock / IA sumando 100**, y los gráficos van aparte porque se superponen. Si los de pantalla completa ocupan slot, **cada uno desplaza un clip de video** y tienen que entrar en ese reparto.

Eso no es mover un slider: es cambiar cómo se reparte el timeline. **Sin decidir.**

### b) Quién decide dónde van
Las tarjetas ya tienen su camino (DeepSeek las propone, el botón ⟳ las genera). Para los de pantalla completa:
- ¿Los decide DeepSeek en FASE 2 como un tipo más de clip?
- ¿Los coloca el usuario a mano?
- ¿Un porcentaje como el de transiciones?

Sin esto, la pieza que los genere no sabe cuántos hacer ni en qué frases. **Sin decidir.**

### c) Entran en las transiciones

Si son clips normales, participan en el `xfade` como cualquier otro — y eso es lo que se quiere: una transición entrando a un gráfico es mejor que un corte seco. **La condición** es que el MP4 salga ya normalizado (1080×1920, 30fps, h264, yuv420p, SAR 1:1); entonces el pipeline ni se entera de que es un gráfico.

**⚠️ Corregido 3 ago: no es una línea, son diecinueve.** La versión anterior de este documento decía *"es una línea, pero es la línea"*. Verificado sobre el código: la exclusión de `'graphic'` está en `index.ts:1676`, `:1761` y `:1798` en el backend, y en `main.tsx:261, :359, :364, :772, :2466, :2500, :2555, :2566, :2612, :2636, :3770, :6369, :6375, :6591` en el frontend. Dieciséis sitios en total, más los tres del backend.

Si los de pantalla completa se marcan como `type: 'graphic'`, quedarían **fuera del export en todos ellos** y habría que revisarlos uno a uno.

**Eso abre una opción que el plan daba por descartada: darles un `type` distinto.** Marcarlos como `fullscreen`, o como `video` con una bandera, los dejaría dentro del pipeline de vídeo desde el principio — sin tocar ninguno de los diecinueve. La aritmética de frames los trataría como clips normales, que es exactamente lo que se quiere para los de pantalla completa (a diferencia de las tarjetas, que sí van por encima). **Decidir esto antes de construirlos.**

### d) El diseño visual — no existe todavía
Hay paleta de colores y algunas fuentes, pero **no hay composiciones diseñadas**. Y hay un límite técnico que condiciona lo que se puede diseñar:

> **REGLA DE DISEÑO: todo template debe ser función pura de `t`.**
> Permitido: `@keyframes` de CSS, transformaciones, opacidades, filtros, SVG estático.
> **Prohibido:** `transition` de CSS (no se puede posicionar en el tiempo), `requestAnimationFrame`, `setTimeout`, GSAP sin adaptar, y SMIL de SVG (`<animate>`, `<animateTransform>` — siguen su propio reloj).
> Si se diseña con esas herramientas, se captura **congelado**.

*Esto se descubrió con las barras: no animaban con JavaScript sino con una `transition` de CSS, y una transición no existe en el timeline hasta que el valor cambia.*

### f) DÓNDE se aplica la exclusión mutua — sin resolver
La regla está decidida (nunca una tarjeta encima de un gráfico de pantalla completa), pero **falta el punto concreto donde se cruzan**: las tarjetas las decide el botón ⟳ Generar y los de pantalla completa se decidirían en otro momento del pipeline.

Sin un sitio donde comparar ambas listas, la regla no se puede implementar. Candidatos:
- Al generar los de pantalla completa: descartar las tarjetas que solapen
- Al generar las tarjetas: saltar los tramos ya ocupados
- En el export, como último filtro

**Decidir antes de construir los de pantalla completa**, no después.

### e) Más movimiento cuesta más
La réplica cargada con blur de 90px y gradientes costaba 2.5s; las tarjetas simples 1.6s. **Más efectos = más tiempo de render**, y eso va directo al tiempo de export.

---

## 8. EL PROBLEMA DEL PROMPT (antes de rediseñar nada)

### Los datos
```
84% de los gráficos generados son decorativo_emoji
92.3% entre decorativo_emoji + frase_clave
8 de los 17 tipos NI SE MENCIONAN en el prompt → inalcanzables por construcción
```

### Las causas, en orden de peso
1. **El único ejemplo del formato es `decorativo_emoji`.** Con `temperature: 0.3` (conservadora, copia patrones), ese ancla es lo más determinante. No hay ejemplo de ningún otro tipo.
2. **Los 7 tipos de TIPO A son solo nombres.** Una lista pelada, sin decir qué dato necesita cada uno. TIPO B en cambio es una receta.
3. El reparto A/B (92/8) **sí** puede venir del contenido; el reparto dentro de B (91/9) **no** — ambos están disponibles para cualquier frase.

### ⚠️ EL ORDEN CORRECTO (razonamiento circular detectado y corregido)
Decir *"trabaja solo decorativo_emoji y frase_clave porque son el 92%"* es **circular**: son el 92% PORQUE el prompt los empuja. Si se arregla el prompt, ese reparto cambia.

Y un emoji con etiqueta es un gráfico pobre por diseño, por muy bien que se anime. **La animación multiplica sustancia: multiplicando cero da cero.**

```
ORDEN CORRECTO:
1. Integración (que se exporten)          ← lo que falta hoy
2. Prompt de gráficos (decide QUÉ tipos aparecen)
3. Movimiento (sobre los tipos que realmente salgan)
```

### Antes de tocar el prompt, medir
**Cuánta de la narración lleva datos.** Sale de las transcripciones. Decide si el paso 2 es "desbloquear gráficos de datos" o "mejorar las opciones sin datos" — son trabajos distintos.

### Y cada tipo nuevo que se desbloquee
Hay que renderizarlo con datos reales **y mirarlo** antes de darlo por bueno.

---

## 9. LOS 17 TIPOS ACTUALES

```
barra_horizontal · barra_vertical · barras_comparativas · donut · contador
comparacion_antes_despues · flecha_crecimiento · flecha_caida · multiplicador
fraccion · ranking_top3 · dato_grande · frase_clave · decorativo_emoji
lista_numerada · checklist · pasos_proceso
```

**Solo 9 los pide la IA.** `ranking_top3` y `lista_numerada` no aparecen en ningún proyecto pese a estar permitidos.

**Bug conocido sin arreglar:** `barras_comparativas` (anotado, no tocado).

**Los datos ya existen:** `graphicData` con `{ type, value, label, unit, emoji, extra }`, generado por DeepSeek.

**El flujo real es el botón ⟳ Generar** (`handleRegenerateGraphics`), no FASE 2 — esa envía `graphicsPercent: 0` fijo y está desconectada.

---

## 10. AVISOS PARA NO PERDER HORAS

**⚠️ La deriva de 2.758s — probablemente resuelta por `83a92ff`, SIN verificar con export medido.** Los gráficos se componen a tiempos absolutos sobre el video concatenado, así que una deriva del video respecto al audio los pondría sobre el plano equivocado.

El commit `83a92ff` (*"cada clip normalizado dura exactamente su slot — elimina la deriva video/audio"*) puso el recorte en frames enteros arrastrando el error acumulado — `index.ts:1821-1843`, aplicado en `:1911-1912`. **No la cerró la Vía 4**, que solo tocó la ruta del clip de audio en `generate-perfect-sync`.

**Pero esto es código leído, no export medido.** El mecanismo que la causaba ya no está; nadie ha exportado un video largo y comprobado que la duración cuadra con el audio. Se verifica sola la primera vez que exportes largo con gráficos y mires si caen donde deben. **Hasta entonces: si aparecen desplazados al final de un video largo, sospechar de esto antes que de los gráficos.**

*Las secciones del plan maestro que marcan A2 como "SIGUIENTE" y el bloque "🛑 BLOQUEANTE DE A2 — DERIVA ACUMULADA" están obsoletas: `git log -S "frameTargets"` devuelve `83a92ff`, `6455626` (A2), `58e8d79` (B1) y `fea9eac` (A4), todos anteriores, y el propio plan marca A4 como hecha y verificada. El plan se contradice a sí mismo.*

**⚠️ Las listas de dependencias de los `useEffect`.** Un estado nuevo puede tener el payload correcto y el autoguardado roto. Ese fallo compila y solo aparece al cerrar la app. Hay test: `npm run test:persistencia` — **si tocas lo que se guarda, córrelo.**

**⚠️ PowerShell destroza la codificación** de ficheros con acentos. Pasó tres veces (el emoji, el índice de memoria, `package.json` con BOM que rompió el build entero). Usar las herramientas Read/Write/Edit.

**⚠️ Mirar el código de salida del build**, no las últimas líneas. El test puede pasar sobre el bundle anterior mientras el build está roto.

**⚠️ Comprobar la señal no es comprobar la cosa.** Pasó dos veces: `rutaAUrl` existía como función y reventaba al llamarla; y se descartó una implementación porque las cadenas diferían cuando la pregunta era si carga.

**⚠️ Una constante escrita a mano en un test es una suposición disfrazada de verificación.** Derivar la expectativa del dato real.

**⚠️ Dos cosas del preview que YA estaban rotas** y pueden confundir al verificar gráficos:
- El preview **no muestra el fondo desenfocado** del crop — muestra el negro del contenedor. El archivo exportado sí lo lleva. (Era la "Parte 2" del crop, aplazada.)
- El segundo `<video>` de transiciones (L5082-5105) calcula su estilo con `currentClipIndex + 1` mientras su `src` viene de otro momento → **muestra el crop desincronizado durante la transición**. Es marcado del renderer, **no afecta al archivo**.

**⚠️ El preview y el archivo pueden divergir por diseño.** El preview dibuja el componente en vivo; el MOV se renderizó antes. Es el mismo problema que tuvo el crop y por eso es el punto 3 de la sección 6.

---

## 11. DECISIONES CERRADAS — NO REDISCUTIR

| Decisión | Por qué |
|---|---|
| **Vía G**, no HyperFrames ni Remotion | 6× más rápido, sin dependencias, sin rehacer templates |
| **Troceado**, no overlay en A4 | modo de fallo: A4 puede degradar y los gráficos desaparecerían en silencio |
| **Renderizar al Generar**, no al exportar | el coste se paga ahí, el export solo compone |
| **qtrle** para el alpha | el único verificado que lo conserva |
| **Las tarjetas y los de pantalla completa se excluyen mutuamente** | nunca una tarjeta encima de un gráfico de pantalla completa |
| **Prompt antes que movimiento** | animar los tipos que dominan es circular |
| **Duraciones en frames enteros** | 0.25s no existe a 30fps |
| Proyecto **autocontenido** (opción 1) | ya decidido en la sesión de infraestructura |
| Crop **solo a clips originales** (opción B) | el stock ya viene ajustado al aspecto |

---

## 12. ORDEN GLOBAL — qué va antes de qué

```
EN CURSO (infraestructura)
  PIEZA A: auditoria de materiales + guarda del export
  ├─ Piezas 1 y 3 HECHAS y en verde (auditarClips + guarda del export)
  ├─ A deuda, no bloquean nada: lotear la auditoria con Promise.all,
  │    pieza 2 (aviso al abrir), pieza 4 (relocalizar por carpeta)
  └─ ⚠️ NO es inocua a medias: su guarda reacciona mal a los clips
       'graphic'. Eso es la pieza 0 de aqui abajo, y va SI o SI.

GRAFICOS — las tarjetas actuales (seccion 5)
  Pieza 0 (G0) → 1 → 2 → 3 → 4 → 5, de una en una con su verificacion
  ├─ Bloqueante previo: el bucket de 'graphic' en auditarClips (pieza 0)
  └─ Bloqueante interno: sacar graficos de SUB_CACHE (dentro de la pieza 1)

DESPUES DE LAS TARJETAS
  1. El prompt de graficos (seccion 8) ← ANTES que el movimiento
  2. Mejorar los tipos con movimiento
  3. Los graficos de pantalla completa (seccion 7)
     └─ Requiere decidir antes: porcentajes, quien los coloca, y donde
        se aplica la exclusion mutua

DEUDA QUE NO BLOQUEA NADA DE ESTO
  PIEZA B (caducidad de cache) — pero se vuelve necesaria en cuanto
    cache/graficos deje de borrarse
  project-state.json de 18 MB
  Gestor de espacio tipo CapCut
  Deuda A1, barras_comparativas, el v1Clip externo
```

**⚠️ Corregido 3 ago.** La versión anterior decía que *"lo único que se puede quedar a medias sin consecuencias es la PIEZA A"*. **Ya no es cierto.** Sus piezas pendientes (lote, aviso al abrir, relocalizar) sí son inocuas y pueden esperar indefinidamente — pero lo que ya está commiteado **no lo es**: la guarda del export mete los clips `graphic` en `sinRuta` y bloqueará exports en cuanto haya gráficos. Esa parte no es deuda aplazable, es la pieza 0.

Todo lo de gráficos va en cadena.

---

## 13. ESTADO DEL PROYECTO AL ESCRIBIR ESTO

**Ruta:** `C:\Proyectos\mi-app\cipher-studio` (rama `master`). **NUNCA** `C:\Proyectos\mi-app`.

**El plan maestro completo está EN EL REPO:** `CIPHER_plan_maestro_transiciones_graficos_vibes.md` — sección "SESIÓN 3 AGOSTO 2026".

**Cerrado y verificado en la sesión de infraestructura:**
- Proyecto A completo (transiciones al exportar: A0→A4 + P0, B1, P3)
- XFADE_MAP: 38 nombres → 38 efectos distintos (antes colapsaban en 21)
- Reestructura `temp/` → `materiales/` + `cache/`
- Abrir un proyecto ya no borra sus clips (era el bug de origen)
- Audio maestro extraído dentro del proyecto
- Las 14 URLs `file://` con acentos — **sin esto ningún usuario con `C:\Users\José\` vería nada**
- Persistencia: 7 ajustes + constructor único + `npm run test:persistencia`
- Crop/zoom aplicado en la normalización del export
- Vía 4 (sincronía perfecta) + `npm run test:via4`

**En curso:** PIEZA A (auditoría de materiales + guarda del export).

**Deuda abierta que NO bloquea los gráficos:**
- PIEZA B: caducidad de caché (nada borra desde que se arregló la limpieza)
- `project-state.json` de 18 MB: 49% son miniaturas en base64 + los MP3 de voz como data URI
- El camino para arreglarlo: dejar de embeber base64 y leer del `.jpg`, que `banco-clips` ya hace
- Gestor de espacio visible tipo CapCut (cuánto ocupa cada proyecto, cuánta la caché)
- Deuda A1: `isUsingOriginalAudio` compara por el **nombre** del clip
- `barras_comparativas` con bug
- El `v1Clip` del video importado apunta fuera **a propósito** (se resuelve avisando)

---

## 14. REGLAS DE TRABAJO (repetir en cada sesión nueva)

```
1. Un cambio a la vez. Muestra el codigo ANTES de aplicarlo.
2. Despues de cada cambio: npm run build. Y MIRA EL CODIGO DE SALIDA.
3. NUNCA dejes codigo viejo junto al nuevo. Verificalo tras editar.
4. No arregles cosas que no pedi. Si ves un bug, dimelo y sigue.
5. Cuando termines, PARA. No avances solo. No commitees sin que lo pida.
6. Verificacion MEDIDA, no afirmada. Que compile no es que funcione.
7. NO uses PowerShell para leer ni escribir ficheros con acentos.
8. Es un producto que voy a VENDER: nada puede romper el export.
```

---

## 15. PROMPT PARA ARRANCAR EL CHAT NUEVO

```
Proyecto: CIPHER Studio, editor de video Electron que voy a VENDER.
Ruta: C:\Proyectos\mi-app\cipher-studio (rama master). NUNCA C:\Proyectos\mi-app.

Te adjunto el contexto completo de los graficos. Leelo entero antes de
proponer nada — tiene los numeros ya medidos, las decisiones cerradas y
los avisos para no perder horas. No re-derives nada de eso.

El plan maestro tambien esta en el repo:
CIPHER_plan_maestro_transiciones_graficos_vibes.md, seccion
"SESION 3 AGOSTO 2026".

REGLAS QUE NO SE NEGOCIAN:
1. Un cambio a la vez. Muestrame el codigo ANTES de aplicarlo.
2. Despues de cada cambio: npm run build. Y MIRA EL CODIGO DE SALIDA.
3. NUNCA dejes codigo viejo junto al nuevo. Verificalo tras editar.
4. No arregles cosas que no pedi. Si ves un bug, dimelo y sigue.
5. Cuando termines, PARA. No avances solo. No commitees sin que lo pida.
6. Verificacion MEDIDA, no afirmada. Que compile no es que funcione.
7. NO uses PowerShell para leer ni escribir ficheros con acentos.

ANTES DE NADA verifica el estado real y dime que encuentras:
- git log --oneline -5 y git status
- npm run build (mirando el codigo de salida)
- npm run test:persistencia y npm run test:via4

El documento dice donde deberiamos estar, pero el codigo manda.

DESPUES: empieza por la PIEZA 0 (G0) de la seccion 5 — el bucket de
los clips 'graphic' en auditarClips. Antes de tocarla, contestame si
el array `clips` que llega a export-video contiene objetos de type
'graphic': eso decide si el fallo es de hoy o preventivo.

Luego PIEZA 1 (renderGraphicClip), cuyo primer cambio es sacar
'graficos' de SUB_CACHE.

Cada pieza lleva marcada su [COBERTURA] — si se cierra sin ella, el bug
entra. Muestrame el codigo antes de aplicar.
```
