# Deuda de los gráficos

Deuda específica del bloque de gráficos. La deuda del proyecto entero vive en la tabla
"DEUDA ABIERTA, por gravedad" de `CIPHER_plan_maestro_transiciones_graficos_vibes.md`.

---

## 🐛 BUG DE CONTENIDO — las rampas son segundos absolutos, no fracción de la duración

**Detectado el 6 de agosto de 2026, leyendo el código. Sin arreglar a propósito.**

`AnimatedGraphic` anima sus valores numéricos con rampas escritas en **segundos fijos**. Si el
gráfico dura menos que la rampa, el valor se congela a mitad de camino y **eso es lo que queda
grabado en el vídeo**.

### Lo medido

Calculado con la implementación exacta de `cubicBezier` del fichero
([AnimatedGraphic.tsx:52-68](../src/renderer/src/AnimatedGraphic.tsx#L52)):

| t | `contador` | `donut` | `barra_*` |
|---|---|---|---|
| 0.50 s | 33.3% | 50.0% | 87.0% |
| 0.75 s | 50.0% | 87.1% | 97.2% |
| **1.00 s** | **66.7%** | **100%** | **99.6%** |
| 1.35 s | 90.0% | 100% | 100% |
| 1.50 s | 100% | 100% | 100% |

### Por gravedad

- **`contador` — el grave.** Rampa lineal `tt / 1.5`, completa a los 1.5 s. En un gráfico de
  1 s se queda en **66.7%**: un valor de 87 se graba como **58**. No es una animación cortada,
  es **un dato FALSO en el vídeo**. Y el número se pinta con `Math.round`, así que sale limpio
  y creíble.
- **`donut` — menor.** Completa en 1.0 s exacto, así que solo se corta por debajo de esa
  duración.
- **`barra_horizontal` / `barra_vertical` — no es problema.** Llega al 90% en t=0.546 y al 99%
  en t=0.894; un gráfico de 1 s corta un 0.4%, invisible. La curva
  `cubic-bezier(0.16, 1, 0.3, 1)` es agresiva al principio y eso la salva.

Cada tipo tiene **su propia** rampa, en tres sitios distintos, sin nada que las relacione con
la duración del clip ([AnimatedGraphic.tsx:90-100](../src/renderer/src/AnimatedGraphic.tsx#L90)):

| tipo | rampa | completa en |
|---|---|---|
| `contador` | lineal `tt/1.5` | 1.5 s |
| `barra_horizontal` / `barra_vertical` | `EASE_BARRA((tt−0.15)/1.2)` | 1.35 s |
| `donut` | `EASE_DONUT(tt/1)` | 1.0 s |
| los demás | ninguna: `return parsedNum` | instantáneo |

### Ningún test lo detecta, y no es un descuido del test

`npm run test:graficos` comprueba que el MOV existe, que dura lo que toca, que tiene los frames
contados, que sus frames son **distintos entre sí** y que el alpha es real. **Un gráfico con el
contador congelado en 58 pasa las cinco cosas.** Los frames siguen siendo distintos —el emoji y
el glow se mueven— y el número equivocado es un número perfectamente válido.

Solo se ve **sabiendo qué número esperabas**, que es información que el test no tiene y el
renderizador tampoco.

### Por qué no se arregla ahora

El componente **no conoce la duración**: su firma es `{ graphic: GraphicData; t?: number }`
([AnimatedGraphic.tsx:77](../src/renderer/src/AnimatedGraphic.tsx#L77)), solo recibe `t` en
segundos absolutos. El arreglo pasa por **pasarle la duración y expresar las rampas como
fracción** en vez de en segundos.

Eso toca `AnimatedGraphic.tsx`, que está verificado y es el fichero del que dependen los 17
tipos y el preview. **Va cuando se toquen los templates, no antes.** Y el orden ya decidido es
*prompt → movimiento*, así que este arreglo entra con el movimiento.

### El supuesto de los 2 segundos no lo garantiza nadie

El plan dice "duración: 2.00 s exactos en los 579". **Eso describe lo que produjo DeepSeek, no
lo que garantiza el código.**

- Flujo activo, el del botón ⟳
  ([index.ts:3837](../src/main/index.ts#L3837)):
  `const durSec = Math.min(2.0, (p.graphic.graphicEnd || graphicStart + 2) - (p.graphic.graphicStart || 0))`
  — el `Math.min` acota **por arriba** y **nada por abajo**. Quien decide es el modelo: el
  prompt le pide `graphicEnd = graphicStart + 2.0`
  ([index.ts:3766](../src/main/index.ts#L3766)) y si obedece salen 2.0; si devuelve un tramo
  más corto, el gráfico dura menos y nadie lo corrige.
- Flujo de FASE 2, hoy desconectado con `graphicsPercent: 0`
  ([index.ts:3601](../src/main/index.ts#L3601)):
  `const durSec = phrase.graphic.graphicEnd - phrase.graphic.graphicStart`
  — **ni siquiera tiene ese `Math.min`**. Antes se recorta `end` a `phraseDuration`
  ([index.ts:2759](../src/main/index.ts#L2759)) y después al audio restante
  ([index.ts:3609](../src/main/index.ts#L3609)): una frase corta da un gráfico corto.
### ⚠️ El respaldo del frontend es CÓDIGO MUERTO, y leerlo induce a error

En las dos puertas del frontend ([main.tsx:2646](../src/renderer/src/main.tsx#L2646) y
[main.tsx:2483](../src/renderer/src/main.tsx#L2483)) está esto:

```js
durationSeconds: c.graphicDuration ?? Math.min(2.0, matchingVideo?.durationSeconds || 2.0)
```

**Leído deprisa parece decir que un clip de vídeo corto produce un gráfico corto. No es
cierto: ese respaldo no se alcanza nunca.** Es una trampa real — se cayó en ella durante la
sesión que escribió este documento, y por eso queda anotada.

El `??` solo cae al respaldo si `graphicDuration` llega **indefinido**, y el backend lo pone
**siempre junto a `graphicData`**, en el mismo bloque
([index.ts:3846-3851](../src/main/index.ts#L3846)):

```js
if (targetClip) {
  targetClip.graphicData = p.graphic;
  ...
  targetClip.graphicDuration = durSec;
}
```

Y el filtro de las dos puertas es `.filter(c => c.graphicData)`: si un clip lo pasa, tiene
`graphicData`, luego tiene `graphicDuration`, luego el `??` no cae.

Lo único que podría romper ese razonamiento —que la mutación no viajara al frontend— está
comprobado que no lo rompe: [index.ts:3730-3731](../src/main/index.ts#L3730) hace
`let generatedClips = clips.map(c => ({...c})); const clipsRef = generatedClips;`, **misma
referencia**, así que lo que se muta en `targetClip` sale en `res.clips`.

**Consecuencia:** la duración del clip de vídeo **no influye** en la del gráfico. El único
mecanismo vivo es el tramo que devuelve el modelo.

Es decir: hoy el bug está latente porque el modelo viene devolviendo 2.0, no porque el código
lo impida. En cuanto se toque el prompt —que es el paso siguiente al de la integración— deja de
ser latente.

---

## ⚠️ Lo que deja abierto el enchufe de los tres caminos

**Anotado el 7 de agosto de 2026, al extraer `renderizarYSellar` y cablear A, B y C.**

### a) El camino A aborta el build ENTERO si cambia el proyecto, y eso son minutos

Si el usuario abre otro proyecto mientras corre `handleBuildIATimeline`, `renderizarYSellar`
devuelve `null` y la función **retorna sin escribir nada**. Eso es correcto —meter esos clips
en el timeline del proyecto equivocado sería peor— pero **el precio no es comparable al de C**:

| | qué se pierde |
|---|---|
| **C** (`⟳ Generar`) | solo los gráficos. Los MOV quedan en `cache/graficos` del proyecto correcto y volver a pulsar allí los recupera a **~2 ms cada uno** por la caché del hash. |
| **A** (`Construir Timeline IA`) | **el build entero**: cortar el vídeo, DeepSeek, descargar el stock, generar la IA. **Minutos.** Los clips de vídeo **no tienen caché por hash**, así que rehacerlo cuesta lo mismo que la primera vez. |

**Queda como algo a mejorar, no como resuelto.** Lo que habría que buscar es una salida que
conserve el trabajo sin escribirlo donde no toca — por ejemplo, guardar el resultado contra el
proyecto de origen en vez de descartarlo, o avisar al usuario y dejarle decidir. Ninguna de las
dos está diseñada.

### b) Ninguna suite ejercita `handleBuildIATimeline`

Las cuatro en verde dicen que **no se rompió nada de lo que ya estaba cubierto**, no que A y B
funcionen. Ese camino es frontend y depende de DeepSeek, Pexels y fal.ai, así que ningún test
lo recorre. Lo verificado es que compila, que la persistencia aguanta y que el lote al que
llama está probado por `npm run test:graficos`.

### c) Y A no se puede probar hoy ni a mano

FASE 2 manda **`graphicsPercent: 0` fijo** ([main.tsx:2405](../src/renderer/src/main.tsx#L2405)),
así que `generate-timeline-assets` nunca asigna gráficos y el camino A siempre recibe una lista
vacía — lo confirma el log con `Gráficos asignados: 0`. **Queda cableado pero sin ejercitar**
hasta que ese cero se reconecte. Cuando se haga, A es lo primero que hay que mirar.

### d) El assert de los 5000 ms es el candidato número uno a fallo intermitente

En `tests/graficos.js`, `el primero tarda menos de 5000 ms` **ya falló una vez** y pasó al
repetir sin tocar nada. Los renders de 60 frames a 1080×1920 medidos en la misma sesión van de
**2551 a 4284 ms** — un factor 1.7 con el mismo código, según lo cargada que esté la máquina.

**No se sube el umbral.** Se eligió holgado a propósito como detector de degradación, y
ensancharlo porque ha fallado una vez le quita el propósito. Pero que quede escrito: **si esta
suite falla, mírese esto antes que el código**, y compruébese que los intentos por frame siguen
en su banda de 1.3-1.8 — eso es lo que distingue "máquina ocupada" de "el lazo cerrado se ha
degradado".

---

## 📌 Lo que hereda la PIEZA 3 del enchufe del botón ⟳

**Anotado el 6 de agosto de 2026, al enchufar la PIEZA 2 al botón. Tres cosas sin arreglar.**

### a) La ausencia de `graphicMovHash` agrupa tres causas distintas

Un clip de tipo `graphic` sin el campo puede serlo por tres motivos que el dato no distingue:

1. **El render falló** — `renderGraphicClip` devolvió `null`.
2. **El lote se canceló** y ese gráfico quedó en `sinIntentar`: nunca se llegó a pedir.
3. **Vino del camino de FASE 2** ([main.tsx:2489](../src/renderer/src/main.tsx#L2489)), que construye
   clips de gráfico y **no llama al lote**.

Para el mensaje de la COBERTURA 2 da igual —lo accionable es que no hay MOV— y para recuperarse
también: volver a pulsar ⟳ re-renderiza, y los que ya estaban son aciertos de caché a ~2 ms.
Pero **si algún día hay que decir *por qué* falta, este diseño no lo sabe**. Se eligió así a
propósito: un campo de estado extra sería una segunda fuente de verdad que habría que limpiar
al re-renderizar y que se quedaría obsoleta en el `project-state.json`.

### b) La PIEZA 3 tiene que comprobar que el fichero EXISTE

**No basta con que `graphicMovHash` esté puesto.** Un hash apuntando a un MOV borrado contaría
como compuesto y no lo estaría — y nada borra `cache/graficos` hoy, pero el usuario puede
vaciarla a mano, y un proyecto copiado a medias también la dejaría incompleta.

Es exactamente el error que `auditarClips` ya evita para los materiales: **clasifica por si el
fichero está, no por si el campo está**. La PIEZA 3 debe hacer lo mismo antes de contar un
gráfico como compuesto, o la COBERTURA 2 dirá "19 de 19" sobre un vídeo al que le faltan.

### c) El descarte por cambio de proyecto no queda registrado en ningún sitio consultable

Cuando el usuario cambia de proyecto durante los ~50 s de un lote, el enchufe **descarta el
resultado y no escribe el timeline** — que es lo correcto. Pero esa decisión se toma **en el
renderer**, y solo queda en un `console.warn`.

**No hay canal para que el renderer escriba en `generation-debug.log`.** Se revisó el preload
entero: sus veinticuatro métodos son handlers de trabajo, suscripciones a eventos y gestión de
proyecto, y **ninguno escribe en el log del backend**. No se inventó uno.

Resultado: el usuario esperó ~50 s, no hay gráficos, y **el caso no se puede consultar después**.
El log del backend registra el trabajo hecho (`[GRAFICO] RENDER <hash>`, `[GRAFICOS-LOTE] …`)
pero no la decisión de tirarlo, porque ocurre después y en el otro proceso.

Si alguna vez se añade un canal genérico de log desde el renderer, este es su primer cliente.

---

## ~~🔌 La PIEZA 2 existe pero NO LA LLAMA NADIE~~ — ✅ RESUELTO el 6/08/2026

*Se anotó el 6 de agosto y se cerró el mismo día al enchufar el botón ⟳.*
`handleRegenerateGraphics` llama ahora a `renderGraphicsBatch` antes de escribir el timeline y
guarda el hash de cada MOV en `graphicMovHash`.

**Se conserva la entrada porque su razón de ser sigue siendo cierta:** durante un rato la
PIEZA 2 estuvo escrita, probada y con handler, y aun así **los gráficos no salían en el vídeo**,
porque nadie la invocaba. Infraestructura verificada no es funcionalidad entregada, y esa
distinción es fácil de perder de vista cuando la suite está en verde.

**Lo que sigue sin verificar:** el enchufe es frontend y necesita DeepSeek, así que ninguna
suite lo recorre. La primera prueba real es pulsar ⟳ en un proyecto con guion y mirar
`cache/graficos`.

---

## 🧪 La cancelación por cambio de proyecto no tiene test en su rama real

La comparación `activeProjectPath !== proyectoDelLote` **dentro del bucle** del lote no está
cubierta por ningún test, y es deliberado.

`activeProjectPath` es una variable de módulo que solo se mueve a través de handlers
**asíncronos** — `close-project` la pone a `null` *después* de su `await cleanupProjectTemp`.
No existe ningún camino síncrono. El único punto de enganche es el callback de progreso, que
se llama dentro del bucle justo antes del `await`, pero disparar `close-project` desde ahí sin
esperarlo deja una carrera: ~5 ms del handler contra los ~2700 ms del gráfico siguiente.

Margen de 500x, sí, pero **un test que puede fallar al azar envenena la confianza en toda la
suite**, así que se prefirió no tenerlo.

**Lo que sí está cubierto:** la rama de cancelación por falta de proyecto activo, que recorre
el mismo código —`cancelado`, `motivo`, `sinIntentar`, el array completo a `null`— entrando por
la puerta de arriba en vez de por la de en medio. Lo único sin verificar es la comparación
concreta de dentro del bucle.

---

## ⚠️ Qué pasa con el resultado cuando el frontend desaparece a mitad

**Anotado el 6 de agosto de 2026 al diseñar la PIEZA 2. Sin arreglar a propósito: los dos son
del frontend, no del lote.**

Un lote de 19 gráficos son ~50 s de reloj, y durante ese rato la interfaz **no está
bloqueada** — `isGeneratingAssets` solo deshabilita los botones que lanzan trabajo, no hay
overlay modal. El usuario puede hacer cualquier cosa. Hay dos formas de que el trabajo se
complete y el resultado se pierda o acabe en el sitio equivocado.

### a) Los gráficos del proyecto A aterrizan en el B

`handleRegenerateGraphics` hace
`setTimelineVideoClips([...nonGraphicClips, ...newGraphicClips])`
([main.tsx:2652](../src/renderer/src/main.tsx#L2652)) **cuando vuelve el `await`**, sobre el
estado que haya **en ese momento**. Si el usuario abrió otro proyecto durante los ~50 s, los
gráficos del A se inyectan en el timeline del B — y `timelineVideoClips` está en las dos listas
de dependencias del autoguardado, así que **se persisten ahí**.

**Ya pasa hoy, sin la PIEZA 2.** El lote del backend cancela por su lado al detectar que
`activeProjectPath` cambió, pero eso no cubre esto: el bug está en el frontend, en el instante
de escribir el estado.

### b) La ventana muere a los 4 s y los MOV quedan invisibles

El manejador de cierre ([index.ts:107-123](../src/main/index.ts#L107)) hace `preventDefault`,
manda `save-before-close` y **destruye la ventana a los 4 segundos pase lo que pase**. Un lote
de 50 s no cabe en esa ventana de tiempo.

Cerrar la app a mitad deja: el renderer muerto, el `await` que iba a recibir los clips sin
nadie que lo reciba, y **los MOV escritos en `cache/graficos` pero invisibles** — al reabrir el
proyecto no hay gráficos aunque los ficheros estén ahí, porque los clips nunca llegaron al
estado ni al `project-state.json`.

El daño está acotado por la caché: los MOV siguen en disco y la siguiente generación los
reutiliza en ~2 ms cada uno, así que **no se pierde el trabajo, se pierde la sesión**.

*(Al diseñar esto se consideró una guarda en `before-quit` para rescatar la ventana offscreen.
No hace falta: si la app se cierra, el proceso se lleva la ventana igual. No hay huérfana que
rescatar — el `finally` del lote cubre el caso real.)*

---

## ⚠️ Un MOV truncado cuenta como acierto de caché

**Anotado el 6 de agosto de 2026 al escribir la caché por hash. Sin arreglar a propósito.**

El acierto de caché comprueba que el fichero existe y que **pesa más de cero**
([index.ts, `renderGraphicClip`](../src/main/index.ts)). Eso cubre el MOV de 0 bytes de un
render interrumpido, y hay un test que lo fija.

**Lo que no cubre: un MOV cortado a mitad con más de 0 bytes.** El camino de fallo de
`renderGraphicClip` borra el fichero parcial, así que un error normal de ffmpeg no lo deja —
pero un corte de luz, un cierre forzado o un `kill` del proceso a mitad del render sí. Ese
fichero quedaría con unos cuantos frames, pesaría más de cero, y **la siguiente llamada lo
daría por bueno**: el gráfico saldría cortado en el vídeo exportado sin que nada avise.

Validar cada acierto con `ffprobe` —comprobando que el número de frames es el esperado—
costaría **~40 ms por gráfico**, o sea ~0.8 s en un proyecto de 19. Es asumible, pero es
pagar en todos los aciertos por un fallo que solo ocurre tras una interrupción anormal.

Alternativa más barata si alguna vez molesta: escribir a un `.mov.parcial` y renombrarlo al
nombre definitivo solo cuando ffmpeg cierra con código 0. Un rename es atómico, así que un
fichero con el nombre del hash sería, por construcción, un fichero completo. No se ha hecho
porque no ha ocurrido nunca.

---

## Lo que hay que medir para saber si ya está pasando

**La medición correcta es sobre los gráficos, no sobre los clips de vídeo:** cuántos tienen
`graphicEnd − graphicStart < 1.5` en un proyecto real. Ese es el número que decide si el
`contador` ya se está grabando con datos falsos o si de momento es teórico.

Contar clips cortos del timeline **no sirve**, y creerlo fue consecuencia de leer mal el
respaldo de la sección anterior: la duración del clip de vídeo no entra en la del gráfico.

Todavía no se puede medir: en `proyectos/` solo queda un proyecto, con un único clip de
199.25 s sin cortar y ningún gráfico. Los 44 proyectos que midió el plan ya no están en disco.
**Se mide en cuanto se vuelvan a generar gráficos en un proyecto de verdad.**

---

# EL TONO DE UN DATO: bueno, malo o neutro — DISEÑO PENDIENTE

Hoy el acento es fijo por sistema de color, así que **una mejora y una caída se pintan igual**.
Falta decir si el dato es positivo o negativo.

## El tono es una MARCA, no un color

Decidido: el signo lo dan la **flecha**, el **`+`/`-`** y, si hace falta, un **fondo teñido**
detrás del dato. El dato conserva el acento de su sistema.

**El motivo no es estético.** Rojo/verde es la peor pareja posible: el daltonismo rojo-verde
afecta a cerca del **8% de los hombres**, que no distinguirían la mejora de la caída. Una
marca de forma —la dirección de la flecha, el signo— la ve todo el mundo, y sobrevive además
a que el vídeo se vea en blanco y negro.

Hay una razón técnica que lo refuerza. La alternativa era que **cada sistema declarase tres
tonos** (`positivo`, `negativo`, `neutro`) en vez de un solo acento, lo que resolvería de paso
un choque real: en **voltaje** el acento ya es rojo (`#FF3B1F`) y en **cálido** naranja
(`#E2571F`), así que un dato malo y uno neutro se verían **iguales** en esos dos. Pero eso toca
`SISTEMAS`, y el nombre del sistema **ya entra en la clave del hash**: cambiarlo invalidaría
todo lo renderizado. Se hará, si se hace, cuando el sistema visual esté cerrado.

## El tono es DEDUCIBLE en dos tipos: gratis y determinista

Antes de preguntarle nada al modelo, hay dos sitios donde el tono ya está en los datos:

- **`flecha_crecimiento` / `flecha_caida`** — el tipo **es** el signo. No hace falta ningún
  campo nuevo: la pareja de tipos ya lo codifica.
- **`barras_comparativas`** — comparando `value` con `extra.rightValue`. Hoy **no se compara
  nada**: pinta la izquierda en `#00d4ff` y la derecha en `#7F77DD` siempre, así que
  **un 42→87 y un 87→42 salen idénticos**. Es el caso más claro de dato sin sentido.

Empezar por aquí no cuesta ninguna llamada y no puede equivocarse.

## Un campo `tono` del modelo: solo para el resto, y MIDIENDO antes

Haría falta únicamente para los tipos donde el signo no se puede deducir del número:
**`donut`, `contador`, `dato_grande`**. Un donut al 87% puede ser cuota ganada o cuota perdida.

Añadirlo al prompt de gráficos (`main/index.ts`, el `sectionPrompt`) cuesta **dos líneas** —una
de instrucción y el campo en el ejemplo del `FORMATO`, que es lo que el modelo copia— y **no
exige ninguna llamada nueva**.

**Pero antes hay que MEDIR cuántos vienen bien clasificados.** Este prompt ya colapsó una vez:
pedirle cuotas de tipo dejó el reparto en **76 stock / 0 original** (ver el comentario de
`main/index.ts:3186`, "el prompt es sensible y la correccion tiene que ser determinista, en
codigo"). Un `tono` mal clasificado pinta una caída como una mejora, que es peor que no pintar
nada.

Y dos cosas que no son del prompt y hay que hacer a propósito:

- **El sanitizado.** El bucle que valida `type`, `graphicStart` y `graphicEnd` no conoce
  `tono`: sin añadirlo allí, un `"positivo!"` o un valor inventado llega hasta el render.
  Por defecto, `neutro`.
- **La clave del hash.** `tono` cambia los píxeles sin cambiar nada más, así que entra igual
  que `modo`, `codec` y `sistema`. **No entra solo:** `canonizar` proyecta únicamente las seis
  claves que lee el componente (`type, value, label, unit, emoji, extra`), así que hay que
  añadirlo a la lista de `partes` explícitamente. Eso es deliberado —lo que no se añade a mano
  queda fuera por construcción— pero significa que olvidarlo no da error: da una caché que
  devuelve el tono equivocado diciendo ACIERTO.

---

# BUG: `flecha_caida` escribe el signo a mano

`AnimatedGraphic.tsx:319`, en la rama de `flecha_caida`:

```tsx
<span className="text-5xl font-black text-rose-500 animate-number-glow">-{value}{unit}</span>
```

El `-` está **cableado en la plantilla** y `value` se pinta tal cual. La plantilla da por hecho
que el modelo manda el valor en positivo (`12` para "cayó un 12%"). **Si mandara `-12`, saldría
`--12`.**

`flecha_crecimiento` tiene el mismo patrón con `+{value}`.

Nada lo normaliza: el sanitizado de `generate-timeline-assets` valida `type`, `graphicStart` y
`graphicEnd`, pero **`value` pasa en crudo**. Es un fallo latente, no observado todavía: depende
de que el modelo decida mandar el signo, y hoy no lo hace.

No se arregla ahora. Cuando se toque, la decisión es dónde vive el signo —en el dato o en la
plantilla— y **no puede estar en los dos**.

## Lo que NO es un bug, para que nadie lo vuelva a mirar

`flecha_crecimiento` aparece **dos veces** en `AnimatedGraphic.tsx`: en la línea 159 y en la
309. **No es un duplicado.** Son dos `switch (type)` distintos, en dos funciones distintas:
`getAnimationClass()` (línea 156), que elige la clase de animación, y `renderContent()` (línea
181), que pinta el contenido. Cada tipo aparece una vez en cada uno, que es lo esperado.

Queda escrito porque se dio por un bug al leer los dos bloques seguidos en un `grep`, y el
error es fácil de repetir.

---

# EL REPARTO DE `generate-perfect-sync` NO TIENE VISUALES

Al añadir el cuarto peso (V3) la aritmética se sacó a **una** función,
`repartoObjetivos` en `src/shared/reparto.ts`, y los dos sitios que la duplicaban en
`generate-timeline-assets` pasaron a llamarla. **Queda un tercero sin tocar**, en
`generate-perfect-sync`:

```ts
const stockWeight = syncWeights[1] ?? 35;
let targetStockClips = Math.round((stockWeight / 100) * totalVisualClipsCount);
let targetIaClips    = Math.round((iaWeight    / 100) * totalVisualClipsCount);
if (targetStockClips + targetIaClips > totalVisualClipsCount) { …reescalado de DOS términos… }
const targetVacioSlots = totalVisualClipsCount - targetStockClips - targetIaClips;
```

**No es una copia del mismo dato.** Usa `syncWeights`, que es **otro estado**
(`useState([40, 35, 25])`) con sus propios sliders y su propio `handleSyncWeightChange`. Por
eso no se tocó: cambiarlo sería añadir Visuales a la sincronía perfecta, que es una
funcionalidad, no un refactor.

**El día que Visuales entre en la sincronía perfecta hay que repetir todo esto allí**, y no
basta con llamar a `repartoObjetivos`:

- `syncWeights` tendría que pasar a cuatro posiciones, y su `handleSyncWeightChange` tiene el
  mismo `[0,1,2]` escrito a mano que tenía `handleWeightChange` — el mismo error esperando.
- El residuo allí **no es `original`**, es `targetVacioSlots`: huecos que se rellenan con el
  vídeo del usuario por otra vía. La semántica del cuarto término no es la misma.
- El reescalado es de dos términos, así que con un tercero `targetVacioSlots` podría salir
  **negativo**, exactamente el fallo que V3 corrigió en el otro sitio.

Mientras tanto, el riesgo real es **cero**: sin Visuales en esa vía, el reescalado de dos
términos es correcto para los dos pesos que hay.

---

# EL VISUAL DE TEXTO SE VE SOSO — FALTA CONTENIDO VISUAL

La estructura de V4a es correcta —tamaño de letra, altura fija, zona segura, sistema de
color— pero el resultado es **texto sobre un fondo plano, y eso no es un Visual**. Le falta
movimiento y elementos gráficos que le den vida. Un Visual sustituye a un plano de vídeo: si
lo que aparece es menos interesante que el plano al que sustituye, no está haciendo su
trabajo.

**Lo que falta es contenido visual ENCIMA de la estructura**, no cambiar la estructura.

**Y no toca el pipeline.** Son formas y animaciones en el fondo, **todo CSS**: gradientes,
figuras geométricas, movimiento sutil detrás del texto. Se pinta en `AnimatedGraphic` en modo
pantalla y se captura con el mismo lazo cerrado de siempre, así que ni el render, ni el hash,
ni el export se enteran. El coste por frame ya está medido y es el del lazo de captura, no el
del contenido: un fondo más elaborado no debería cambiarlo, aunque **eso no está medido**.

**NO CONFUNDIR con ilustraciones o dibujos.** Eso necesitaría imágenes generadas —otra API,
otro coste, otra caché, y ficheros que pueden faltar— y es una pieza distinta con sus propios
problemas. Lo de aquí es CSS y nada más.

---

# EL VISUAL DE UNA FRASE PARTIDA PINTA LA FRASE ENTERA

Una frase de narración de más de 4 s se trocea en `ceil(dur/3)` sub-clips, pero **el texto no
se trocea**: los sub-clips comparten la frase entera y el texto ni siquiera viaja en el item de
la cola de FASE 3.

Así que un Visual que sustituye a **un** sub-clip de una frase partida pinta **toda** la frase,
aunque solo cubra un tercio de su duración: se lee texto que aún no se ha dicho, o que ya pasó.

**Cuánto pasa, medido:** 25 de 423 frases (**6%**) en el proyecto de 9 minutos, y 8 de 80
(10%) en el otro. En el 94% restante la frase no se parte y no hay desajuste.

**La mejora natural ya tiene los datos**: `newAudioSegments[i].words` **existe** con `start` y
`end` por palabra, así que se puede pintar solo el fragmento que suena durante el Visual. No se
hizo en V4a porque es más trabajo del que vale con un 6% de casos afectados.

---

# HAY UNA POBLACIÓN DE FRASES LARGAS QUE SALDRÍA TRUNCADA CASI SIEMPRE

El recorte a 90 caracteres se eligió con la distribución de los dos proyectos representativos:
mediana **45**, p90 **59**, máxima **75**. Ahí el recorte casi nunca se activa.

Pero existe otra población. El proyecto `hgjh`: 23 frases, mediana **165** caracteres, p90
**285**, y una de **602** —119 palabras, 28 segundos—, con el **100%** de sus frases partidas
en varios sub-clips.

Con esas frases, **todos** los Visuales de texto saldrían truncados, y además arrastrarían el
problema de la sección anterior en todos los casos en vez de en el 6%.

**No se diseña para ella**, pero queda dicho: si aparece un proyecto así, los Visuales de texto
mostrarán trozos de frase. La causa de esas frases tan largas —otra tirada de Whisper, otro
audio, otro modelo— no se ha investigado.

---

# EL CRITERIO "LA PALABRA MÁS LARGA" TIENE DOS RESERVAS

Un Visual pinta la palabra **más larga con significado** del tramo que cubre. El criterio
funciona —en la primera generación real ganó en 4 de 5: `inaccesibles` sobre `construir`,
`obligando` sobre `pasaron`, `supuestamente` sobre `naciones`— pero tiene dos límites que
conviene tener escritos antes de darlo por definitivo.

## 1. Atrae los errores de transcripción

Los fallos de Whisper tienden a producir **palabras largas y raras**, y el criterio de la
longitud las **prefiere** precisamente por eso.

Ejemplo real, de la primera generación con Visuales: se eligió **`imaginante`**, que no es una
palabra. Es *"su imagen ante el mundo"* mal transcrito. Al ser un pegote largo, ganó a todas
las candidatas legítimas de su tramo.

No es un caso raro: es **sistemático**. Cuanto peor transcribe Whisper un fragmento, más
probable es que produzca el pegote que este criterio va a elegir y poner a pantalla completa.

## 2. La longitud es un proxy de relevancia, no una medida

En el tramo de `"...Estados Unidos está en guerra con naciones que supuestamente invita a
jugar en su casa..."` el criterio eligió **`supuestamente`**: gana en letras, pero es un
adverbio. El término del tema era `naciones`, o `guerra`.

La longitud correlaciona con la relevancia lo bastante para ser un buen primer criterio, pero
no la mide. Un adverbio largo siempre le va a ganar a un sustantivo corto que sí es el tema.

## La vía de mejora: que la palabra la elija DeepSeek

**Dos líneas de prompt y ninguna llamada nueva.** El prompt de FASE 2 ya recorre cada sub-clip
y ya devuelve un `keyword` por cada uno; pedirle además cuál de las palabras que suenan en ese
tramo es la que merece pantalla completa cabe en la misma petición.

Un modelo resuelve las dos reservas de golpe: descarta `imaginante` porque no significa nada, y
prefiere `naciones` sobre `supuestamente` porque entiende de qué va la frase.

Antes de hacerlo hay que **medir cuántas viene bien elegidas**, como con todo lo que sale de
este prompt: ya colapsó una vez al pedirle cuotas de tipo (76 stock / 0 original). Y el criterio
de la longitud se queda como respaldo para cuando el modelo no conteste o devuelva una palabra
que no está en el tramo.

---

# EL REPARTO DE CORTES DEL STOCK DEJA HUECOS AL PRINCIPIO

Con el stock al 39% y Visuales al 24%, un proyecto real salió con **los primeros 23 clips —56
segundos— sin un solo plano de stock**, y el resto concentrado después:

```
tercio 1:  8 stock      tercio 2: 18      tercio 3: 18
secuencia: OVOVOOVOOVOVOOVOVOOVOOO SOSVSOSOSVSOSVSOS...
                                  ↑ el primer stock, en el clip 23
```

Los conteos globales lo escondían: 44 clips de stock sobre 114, un 38.6% frente al 39% pedido.
El reparto **total** es correcto; lo que falla es **dónde** cae.

## El mecanismo, reproducido en simulación

Los cortes que sobran cuando la racha objetivo **ya está alcanzada** se amontonan en los
primeros tramos, por el criterio con el que se elige a quién dárselos:

```ts
const val = Math.ceil((tramos[i].len - alloc[i]) / (alloc[i] + 1));
if (val > peorVal) { peorVal = val; peor = i; }
```

Con la racha ya conseguida en todos los tramos ese criterio deja de discriminar, y los
sobrantes caen sobre los dos primeros:

```
tramos: len10/cortes10(+5)  len14/cortes12(+5)  len14/cortes7  len14/cortes7 …
```

Al primer tramo de 10 le meten **10 cortes de 10**: lo vacía entero de stock.

**Medido en simulación** —reimplementando el algoritmo, que vive en línea dentro del handler y
no se puede llamar—: con 114 sub-clips, 7 sin keyword repartidos y stock 44, salen tercios
**8 / 18 / 18**, exactamente lo del proyecto real.

## Las tres condiciones, y ninguna basta sola

- **El 39% no falla solo.** Con los 114 candidatos con keyword, el 39% da tercios 15/14/15 y el
  primer stock en el índice 0. Sin huecos.
- **Los huecos sin keyword no fallan solos.** Son los que parten la lista en tramos, pero con
  stock al 60% y los mismos 7 huecos el sesgo casi desaparece: 18/25/25.
- **Falla la combinación**: bajar el peso del stock hace que la racha alcanzable pase de 2 a 1,
  y con racha 1 **sobran muchos más cortes** — 63 disponibles frente a 51 necesarios. Ahí es
  cuando el reparto de sobrantes se comporta mal.

## Esto estaba antes de los Visuales

No lo causan: lo **destapan**. Los Visuales bajan el peso del stock del 60% al 39%, y ese es el
régimen en el que el fallo aparece. Cualquiera que hubiera puesto stock al 39% sin Visuales lo
habría visto igual. Los tres proyectos anteriores tenían stock al 59-61%, **racha alcanzada 2**,
y su primer clip de stock en el índice 0.

## Y detrás hay algo más grande que el reparto de sobrantes

**El algoritmo minimiza la RACHA y no mide el HUECO.** En el proyecto real la racha máxima de
stock es 1 —nunca hay dos seguidos— y el log dice `racha stock: alcanzada=1 ideal=1 (optimo)`.
Es cierto según su propio criterio. Pero **23 clips seguidos sin stock le parecen óptimos**,
porque el hueco no entra en la métrica.

Arreglar el reparto de sobrantes quita el síntoma medido. Medir también el hueco es la decisión
de fondo, y es más grande: cambia qué se considera un buen reparto.

---

# EN `perfectSyncMode`, `original` SE PINTA DEL MISMO COLOR QUE `stock`

**Anotado el 14 de agosto de 2026, al dar color propio a los Visuales. Sin arreglar a propósito:
no se pidió y no es el caso que estábamos mirando.**

La cadena que decide el color de cada barra de la línea de tiempo
([main.tsx:6687](../src/renderer/src/main.tsx#L6687)) tiene una rama condicional:

```tsx
if (cat === 'original' || cat === 'originales') {
  bgClass = perfectSyncMode
    ? 'bg-sky-500/25 …'      // ← el MISMO sky que stock
    : 'bg-emerald-500/25 …';
} else if (cat === 'stock') {
  bgClass = 'bg-sky-500/25 …';
}
```

Con la sincronía perfecta activada, **`original` y `stock` son indistinguibles**: los dos sky.
Fuera de ese modo no pasa, porque `original` es verde.

**Es exactamente el mismo fallo que acabamos de arreglar en `visual`**, y por eso queda escrito:
la línea de tiempo es lo único que dice de dónde sale cada plano, y dos orígenes del mismo color
la convierten en una fuente de conclusiones falsas. En el caso de `visual` costó creer que
faltaba stock donde no faltaba.

**Por qué no se arregla ahora:** no está medido si en `perfectSyncMode` llegan a convivir clips
`original` y `stock` en el mismo timeline. Si no conviven, la colisión es teórica y el coste de
tocarlo no se justifica; si conviven, es el mismo bug con otro nombre. **Esa es la medición que
decide**, y es barata: contar categorías en un proyecto generado por la vía de sincronía
perfecta.

## El mapa completo, para no volver a deducirlo

| category | color |
|---|---|
| `original` / `originales` | **emerald** — o **sky** si `perfectSyncMode` ⚠️ |
| `stock` | **sky** |
| `ia` | **amber** |
| `visual` | **zinc** (gris, el del slider) |
| cualquier otra | sky / violeta **alternando por `index % 2`** |

El comodín de la última fila es la trampa: no falla, **acierta a medias**, y un origen sin rama
propia sale con el color de otro la mitad de las veces. Cualquier categoría nueva necesita su
rama el mismo día que se crea.

---

# 💀 CÓDIGO MUERTO: el camino A de gráficos no se ejecuta nunca

**Anotado el 14 de agosto de 2026. No se borra a propósito.**

`handleBuildIATimeline` llama a `generateTimelineAssets` con **`graphicsPercent: 0` cableado**
([main.tsx:2486](../src/renderer/src/main.tsx#L2486)). Ese cero **es intencional**: el commit
`e145119 feat: Construir en 3 fases secuenciales` (9/07/2026) sacó los gráficos de esa llamada y
los movió a su propia fase, el bloque `if (graphicsPercent > 0)` de
[main.tsx:2579](../src/renderer/src/main.tsx#L2579). El cero significa *"en esta llamada no, los
pido luego"*.

**Lo que quedó muerto es lo que había antes de ese troceado:**

- la rama `if (clipInfo.type === 'graphic')` del bucle que reparte `res.clips`
  ([main.tsx:2504](../src/renderer/src/main.tsx#L2504)),
- el array `newGraphicClips` que llena,
- la llamada a `renderizarYSellar` sobre él,
- y su `excluirSobreVisuales`.

Con `graphicsPercent: 0`, FASE 2 del backend no asigna ni un gráfico, así que **ese camino recibe
siempre una lista vacía**.

## Por qué importa, y no es una curiosidad

**Esto es lo que hizo invisible el bug de las 13 tarjetas sobre Visuales.** La exclusión mutua
estaba puesta ahí —en la rama muerta— y por eso al leer el fichero parecía que el camino de
construir el timeline ya estaba cubierto. El camino vivo, la fase de gráficos de
[2579](../src/renderer/src/main.tsx#L2579), **no tenía ninguna de las dos protecciones**, y nadie
lo miró porque el `grep` de `excluirSobreVisuales` daba un resultado tranquilizador en el mismo
fichero, a cuarenta líneas de distancia.

**Una protección en código muerto es peor que ninguna:** no protege, y además convence de que no
hace falta buscar más.

## Por qué no se borra

Es el único camino que quedaría si ese cero se reconecta alguna vez —la fase de tres pasos podría
volver a fusionarse—, y borrarlo obligaría a reescribirlo. **Lo que se hace en su lugar es
decirlo**: hay un comentario en el propio `graphicsPercent: 0` y otro sobre su
`excluirSobreVisuales`, los dos apuntando aquí.

**Si algún día se reconecta**, lo primero que hay que comprobar es que camino A use
`colocarYFiltrarTarjetas` como los otros dos, y no su `excluirSobreVisuales` a pelo: hoy no lo
necesita porque sus tarjetas llegan ya colocadas de FASE 2 y sin paso de emparejamiento, pero eso
es cierto **solo mientras el camino esté muerto**.

---

# 🖌️ LOS PINTORES NO FUNCIONAN, Y EL RENDER LO DARÍA POR BUENO

**Anotado el 15 de agosto de 2026, al preparar la entrada de las composiciones de
`docs/motion`. Sin arreglar: queda fuera del alcance de ese cambio.**

De los cuatro motores del sistema de motion, el **motor 2 — pintores** no tiene por dónde
entrar. Un pintor es una función `(t) => void` que dibuja en un `<canvas>`, y hoy `__setT` solo
renderiza React:

```js
;(window as any).__setT = (t: number) => {
  const v = Math.round((t * 30) % 255)
  sonda.style.background = `rgb(${v},${v},${v})`
  pintar(t)                      // ← solo React. Ningun canvas se entera.
}
```

`AnimatedGraphic` posiciona animaciones con `getAnimations({subtree:true})`, que sirve para
animaciones **CSS**. Un canvas no tiene animaciones que posicionar: hay que **volver a
dibujarlo**, y nadie lo pide.

## Lo grave no es que no funcione: es cómo falla

**El canvas se quedaría en blanco y el render lo daría por bueno.** El lazo cerrado de la sonda
comprueba que el frame capturado corresponde al `t` que se fijó — y un canvas vacío en el frame
correcto **pasa esa comprobación**. `verificarTiempos` cuenta pts. El test de gráficos comprueba
que los frames son **distintos entre sí**, y lo serían: el pie y el fondo del sistema sí se
animan.

Así que saldría un MOV válido, con su hash, contando como ACIERTO de caché para siempre, con un
agujero negro donde debía estar la escena. Es el mismo patrón que ya mordió con el contador
congelado en 58: **un fallo que pasa todas las comprobaciones porque ninguna sabe qué esperaba
ver**.

## Cuánto descarta

**12 de las 29 escenas de `docs/motion` son pintores — el 41%.** Entre ellas están las que
justifican el motor: `RELIEVE`, `GIROIDE`, `LIQUIDO`, `ACUÍFERO` y `GOTA`. Todo el raymarching y
todos los terrenos quedan fuera hasta que esto se arregle.

## Qué haría falta

Poco de fontanería y una decisión de coste:

1. **Un registro de pintores** y que `pintar(t)` los invoque, igual que hace `irA` en los
   laboratorios: `for (const p of PINTORES) p(t)`.
2. **Después del `flushSync`, no dentro.** Un pintor dibuja fuera de React; si se ejecuta dentro
   del commit, el canvas puede no existir todavía en el DOM.
3. **La resolución, que es la decisión de verdad.** Los laboratorios pintan a 64×114 y escalan
   con `image-rendering: pixelated` — es rápido **y** es un estilo. Nuestro lienzo es
   1080×1920: el raymarching del giroide marcha 7.296 píxeles y a resolución completa serían
   2.073.600, **unas 284 veces más**. Esa decisión hay que heredarla del laboratorio, no
   descubrirla midiendo con el render ya escrito.
4. **Y una guarda que cierre el agujero del apartado anterior**: comprobar que el canvas no está
   en blanco antes de dar el frame por bueno. Sin eso, arreglar los pintores solo cambia el modo
   de fallar en silencio.

---

# 🎬 LO QUE LE FALTA A LOS VISUALES — tres piezas, en orden

**Anotado el 15 de agosto de 2026, con EXTRUSION ya funcionando y su semilla derivada de la
palabra. Ninguna está implementada.** Van en este orden porque cada una necesita la anterior.

## 1. VARIEDAD — una sola composición no sostiene un vídeo

La semilla da a cada Visual su propia disposición —capas, ancho, amplitud, cabeceo—, y eso
resuelve que dos seguidos no salgan calcados. **No resuelve la monotonía.**

**El caso que lo rompe está a un slider de distancia:** con Visuales al 100 % el vídeo entero
serían Visuales. Un vídeo de 9 minutos son del orden de **200 escenas**, todas el mismo hexágono
extruido girando. Variar el ancho un 40 % no salva eso — sigue siendo la misma idea doscientas
veces.

Hacen falta **varias composiciones y una regla de rotación**. Y la regla no es trivial: alternar
en ciclo fijo se nota como patrón, y al azar puede repetir la misma dos veces seguidas, que es
justo lo que se intenta evitar. Es el mismo problema que el reparto de cortes del stock ya tiene
resuelto a medias —minimiza la racha pero no mide el hueco—, y conviene mirarlo antes de
inventar otro algoritmo.

## 2. SENTIDO — un sólido girando no dice de qué se habla

Hoy la escena es la misma sea cual sea la palabra. **Un sólido girando no significa
«universidades» ni «guerra»**: es un fondo bonito con una palabra encima. Para que el Visual
haga su trabajo, la escena tiene que decir algo de la palabra.

Eso exige **elegir cuál va con cuál**, y hay dos vías:

- **DeepSeek**, que ya recorre cada frase y podría devolver qué composición pide. Es una línea
  de prompt más.
- **Deducción** en código, por familias de palabra.

Antes de cualquiera de las dos hay que **medir cuántas viene bien elegidas**, como con todo lo
que sale de ese prompt: ya colapsó una vez al pedirle cuotas de tipo (76 stock / 0 original).
Y la regla 12 del manual acota el problema: **solo palabras con imagen**. «Pirámide», «grieta»,
«represa» tienen escena posible; «impacto», «sistema», «decisión» no la tienen, y para esas el
Visual de texto es la respuesta correcta, no un fallo.

## 3. MEMORIA — que el sistema aprenda a ELEGIR, nunca a dibujar

Un banco donde el usuario marca qué Visuales funcionaron, para que el sistema elija mejor.

**Y aquí hay una línea que no se puede cruzar, por una razón de arquitectura y no de gusto:
puede aprender a ELEGIR, jamás a DIBUJAR.**

La clave del MOV se construye con `graphicData` —las seis claves que lee el componente— más
`ancho`, `alto`, `duracion`, `fps`, `modo`, `sistema` y `VERSION_PLANTILLAS`. **Nada de lo
aprendido está en esa clave.** Si el aprendizaje cambiara cómo se dibuja, el mismo
`graphicData` produciría MOVs distintos según lo que el sistema hubiera aprendido, y la caché
devolvería el primero diciendo **ACIERTO**. El fichero dejaría de ser el que su nombre promete.

Es exactamente el mismo razonamiento por el que la semilla sale de la palabra y no del índice
del clip: **lo que decide los píxeles tiene que estar en la clave**.

La elección, en cambio, ocurre **antes** de construir `graphicData`: decide qué `type` se pide.
Eso queda fuera de la clave por construcción, y por eso sí puede aprender. Si algún día hiciera
falta que aprenda a dibujar, la salida no es romper la caché: es **meter lo aprendido en la
clave** —como entraron `modo` y `sistema`— y aceptar que cambiarlo invalida lo renderizado.

---

# 😀 LOS EMOJIS DEPENDEN DE LA FUENTE DEL SISTEMA

**Medido el 17 de agosto de 2026, antes de construir el motor de Visuales que los usa como
icono de cada concepto. Hoy FUNCIONAN. La deuda es que funcionan por casualidad.**

## Lo medido

Cinco emojis renderizados de verdad en la ventana offscreen, 1080×1920, modo pantalla:

| emoji | px pintados | px saturados | resultado |
|---|---|---|---|
| ☀️ | 7 129 | 7 089 | sol naranja y amarillo |
| ☁️ | 6 202 | 1 596 | nube blanca, correcta |
| 🌧️ | 7 018 | 2 432 | nube blanca + gotas azules |
| 🏞️ | 9 274 | 8 580 | montañas, cielo, agua |
| 🌊 | 6 858 | 6 703 | ola azul |
| *control: texto «AGUA»* | 10 906 | 1 596 | — |

**Ni un tofu.** Windows 11 trae *Segoe UI Emoji* y Chromium la encuentra sin ayuda.

## Por qué es deuda aunque funcione

**La fuente no es nuestra, es del sistema.** No se empaqueta nada. En otra máquina —otro
Windows, un Linux, la máquina de un cliente cuando esto se venda— la fuente puede no estar, y
entonces:

- salen **cuadrados**,
- **no hay error**,
- la sonda valida el `t`, no el contenido, así que el frame se da por bueno,
- el MOV se escribe, se cachea por su hash, y cuenta como ACIERTO para siempre.

Es **exactamente** el modo de fallo del canvas en blanco de los pintores, y el del contador
congelado en 58: pasa todas las comprobaciones porque ninguna sabe qué esperaba ver.

**Y el aspecto cambia con la plataforma.** El mismo `🏞️` se dibuja distinto en Windows, Mac y
Android. Para un producto con identidad visual eso es una fuga de estilo que no controla nadie.

## Las dos salidas, con su precio

- **Empaquetar *Noto Color Emoji*: ~10 MB.** Elimina la dependencia y fija el aspecto. Es la
  diferencia entre «funciona en tu máquina» y «funciona».
- **Sustituir por iconos SVG.** Cierra además la fuga de estilo, pero cuesta **un fichero por
  concepto** y deja de ser gratis: hay que dibujarlos y mantenerlos.

Y en cualquiera de los dos casos falta **una guarda que compruebe que el glifo se pintó**. Sin
ella, cambiar de fuente solo cambia el modo de fallar en silencio.

## Aviso sobre cómo se mide esto, porque casi me engaña

El criterio «contar píxeles saturados» **clasifica mal los emojis que son intrínsecamente
monocromos**. ☁️ marcó 1 596 saturados: exactamente el mismo número que el control de texto
plano. Parecía tofu.

No lo era. **1 596 son los píxeles de la barra de acento** que pinta el Visual de texto, no del
emoji — y ☁️ es blanca por diseño. El veredicto correcto solo salió al **mirar los PNG**.

Queda escrito porque quien repita esta medición va a caer en lo mismo: **la saturación detecta
que un emoji de color se pintó, pero no puede descartar el tofu en los que no llevan color.**
Para eso hay que mirar, o comparar contra un render de referencia.

---

# 📊 LA APP NO SABE LO QUE GASTA EN DEEPSEEK

**Anotado el 19 de agosto de 2026, al medir el gasto para decidir sobre los conceptos.**

Hay **cuatro** llamadas a DeepSeek, todas con `deepseek-v4-pro` y `max_tokens: 8000`:

| línea | qué hace | `temperature` |
|---|---|---|
| `index.ts:1782` | reescribir el guion | 0.7 |
| `index.ts:3793` | FASE 2 — keyword y timestamp | 0.2 |
| `index.ts:5037` | gráficos — 1 tarjeta por sección | 0.3 |
| `index.ts:5243` | sincronía perfecta — su propia FASE 2 | 0.2 |

**Las cuatro descartan `usage`.** La respuesta de la API trae `prompt_tokens`, `completion_tokens`
y `total_tokens` **exactos**, y el código solo lee `data.choices[0].message.content`. Medido:
**cero apariciones de `usage` en todo `index.ts`**.

Consecuencia: **todo lo que sabemos del gasto son estimaciones a 3.5 caracteres/token.** Y ya se
demostró que se quedan cortas — estimé la salida del guion en ~1 294 tokens usando la
transcripción como referencia, y el guion real salió de 5 789 caracteres, **~1 654: un 28% más**.

Cuesta **dos líneas por llamada**:

```ts
const u = data?.usage
if (u) await writeDebugLog(`[DEEPSEEK] guion: ${u.prompt_tokens} ent / ${u.completion_tokens} sal`)
```

DeepSeek desglosa además los **aciertos de caché de contexto**, que deberían ser altos porque
`prompt-maestro.txt` viaja idéntico en cada llamada. Sin leer `usage` eso tampoco se ve.

---

# 🔇 `rewrite-transcript` NO ESCRIBE NADA EN EL LOG

**Anotado el 19 de agosto de 2026.**

`index.ts:1744-1813` son 70 líneas **sin una sola** llamada a `logMessage` ni `writeDebugLog`.
Ni al empezar, ni al terminar, ni en ninguno de sus **cinco caminos de error**:

```ts
if (!(await exists(promptPath)))  return { success: false, error: 'No se encontró…' }
if (!apiKey)                      return { success: false, error: 'No se configuró…' }
if (!response.ok)                 return { success: false, error: `Error de API DeepSeek (${status})…` }
if (!content)                     return { success: false, error: 'La respuesta no contiene…' }
catch (err)                       return { success: false, error: err.message }
```

Los cinco viajan al frontend y **ninguno al log**. Al comprobar una reescritura real hubo que
deducir que la llamada había ocurrido **por el resultado** —un texto de 5 789 caracteres que
ningún camino local puede fabricar—, porque en `generation-debug.log` no había nada.

Es el mismo agujero que `[DIAG-GRAFICO]`: **el error existe, pero en un sitio que nadie consulta
después.** Y aquí es peor, porque este handler habla con una API de pago.

## Y de paso: la reescritura del guion SÍ FUNCIONA

**Verificado el 19 de agosto de 2026** sobre un vídeo de 4 minutos:

| | |
|---|---|
| `originalTranscriptText` | 4 530 caracteres |
| `aiScript` | **5 789 caracteres** |
| difieren desde | **el carácter 0** |

No es una limpieza: **reordena la narración** —la transcripción empieza por la segunda ley de la
termodinámica y el guion arranca por el Millenium Bridge, con gancho—, corta en frases cortas y
**corrige errores de Whisper** (`es desperarse` → redactado bien).

Queda escrito porque una medición anterior encontró `aiScript` **idéntico** a la transcripción en
**seis** proyectos, y eso se presentó como si dijera algo del código. No lo decía: **en esos seis
nadie pulsó el botón**. El dato era correcto; la conclusión que sugería, no.

---

## 📌 EL PASO 5 NO ES SOLO CARGAR LOS woff2: INCLUYE RE-MEDIR

Queda anotado porque es fácil dar el paso por cerrado en cuanto las fuentes se vean en pantalla,
y entonces el paso siguiente empieza pidiendo otra ronda de mediciones.

**Tres cosas dependen del rasterizado del texto y hay que volver a medirlas con Archivo y Anton
ya cargadas:**

1. **El residuo de `test:ventana`.** Hoy `visual_mapa` da 6.602.267 subpíxeles con delta 51 entre
   dos predecesores distintos. La causa está identificada —elementos bajo escala animada— y lo
   que se rasteriza dentro de esas capas **es texto**. Cambiar la fuente cambia el mecanismo. El
   umbral o el arreglo (`will-change`, promoción de capa) **se deciden después de re-medir**, no
   antes: probarlos ahora es trabajo que habría que repetir. Ver `10 septies` de `AUDITORIA.md`.

2. **El modelo de ancho de caja**, `12.7 + 1.44 × caracteres`, medido contra **la sans del
   sistema** porque `grafico.html` no declara ninguna fuente. Hace falta el modelo nuevo con
   ancho **y alto** para etiquetas de 3, 5, 7, 9, 12 y 15 caracteres con emoji, más el ancla sin
   emoji, en minúsculas y en MAYÚSCULAS.

3. **Las cuatro constantes que salen de ese modelo** y que hoy están heredadas del laboratorio:
   `dx < 33` y `dy < 9.5` en `separados()`, y los recortes `k1 = 10` y `k2 = 17` de `flecha()`.
   Se calibran **juntas y después** de las fuentes. Calibrarlas antes obliga a repetirlas.

**El orden es no negociable:** fuentes → re-medir → constantes → `VERSION_PLANTILLAS` a 7 **una
sola vez** para los tres cambios que mueven píxeles (fuentes, constantes, y el tiempo de entrada
de la palabra del `10 sexies`).

---

## 🔴 BLOQUEANTE DE LANZAMIENTO — la fuente de emoji no es nuestra, y ahora el emoji ES el contenido

**No bloquea el port. Bloquea vender la app.**

### Qué cambió el perfil de riesgo

Antes, un emoji salía suelto en alguna tarjeta: si fallaba, se veía un cuadrado feo al lado de un
texto que seguía comunicando. Con la decisión de v1 del port de `visual_mapa`, **cada nodo del
mapa y el remate grande final SON emojis** — se descartaron los iconos Solar porque DeepSeek no
devuelve nombres de icono.

Así que si la fuente de emoji falta, **el Visual no comunica nada**: el dibujo *es* el emoji.

### Y la fuente es la del sistema

El §30 lo deja dicho: el render usa la fuente de emoji **del sistema operativo**. En un Windows
recortado, en Linux, o en la máquina de quien compre la app, el fallo es **tofu sin error**.

Ya hay prueba, y está en `10 quinquies`: la bandera de Rusia sale como las letras `RU` en gris.
Ninguna de las nueve guardas lo detecta.

### Lo medido

| | |
|---|---|
| emoji **distintos** en el último guion | **118** |
| puntos de código que suman | 138 |
| de ellos, banderas (tofu seguro en Windows) | **3** — 🇷🇺 🇺🇸 🇲🇽 |
| **Noto Color Emoji**, los 10 subconjuntos woff2 de Google | **1.96 MB** |

El «~10 MB» que se venía citando es el `.ttf` completo. **El woff2 pesa 1.96 MB**, y eso cambia la
decisión: empaquetar la fuente entera es asumible sin subsetear. Subsetear a los 118 usados sería
además frágil — el guion siguiente pedirá otros.

### Por qué no se hace ahora

Es un paquete aparte del paso 5 (que carga Outfit, Archivo y Anton, 83.8 KB en total). Meter
1.96 MB más y una fuente de color con su propio formato es otro cambio, y **mueve píxeles**: iría
con su subida de `VERSION_PLANTILLAS`.

Pero antes de vender, esto no es opcional.
