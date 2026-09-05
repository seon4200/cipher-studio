# Deuda de los gráficos

Deuda específica del bloque de gráficos. La deuda general del proyecto se resume en
`avance.md`; las fases y sus riesgos viven en `plan-maestro.md`.

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

**DECIDIDO: se empaqueta ENTERA, sin subsetear.** 1.96 MB en woff2. Un subconjunto de los 118
emoji de hoy sería frágil porque el guion siguiente pedirá otros, y el ahorro no compensa un fallo
que se manifiesta como tofu silencioso. El «~10 MB» que se venía citando era el `.ttf`.

Pero antes de vender, esto no es opcional.

---

## 🐛 `sanearConceptos` NO COMPRUEBA DUPLICADOS — el mapa pinta dos cajas iguales

Medido sobre los 107 sub-clips con 3 conceptos de la generación del 2026-08-21:

| | |
|---|---|
| con **emoji repetido** | **5 — 4.7 %** |
| con **etiqueta repetida** | **5 — 4.7 %** |

Son los mismos cinco, y todos del mismo tramo del guion —el de los relojes de Huygens—:

```
27:1   🕰️ reloj | 🕰️ reloj | 🔋 batería
29:1   🪑 silla | 🪑 silla | 🕰️ reloj
31:0   🕰️ reloj | 🕰️ reloj | 🔗 cadena
33:0   🕰️ reloj | 🕰️ reloj | 🔀 mezclador
34:0   🕰️ reloj | 🕰️ reloj | 🔗 cadena
```

**No es un fallo del modelo, es una omisión del saneado.** `sanearConceptos` comprueba que hay
tres, que cada uno tiene emoji y etiqueta, y que la etiqueta no pasa de dos palabras. No compara
los tres entre sí. Y con la decisión de v1 —cada nodo del mapa **es** su emoji— dos cajas
idénticas no son un detalle: el mapa afirma dos veces la misma cosa y pierde un tercio de su
contenido.

Y es defendible que el modelo lo devuelva: la frase habla de **dos relojes** sincronizándose. El
saneado es el sitio donde se decide si eso se pinta o no.

**No se arregla aquí porque no está decidido qué hacer**: rechazar el trío entero —y caer a
`visual_texto`— es tirar dos conceptos buenos por uno repetido; deduplicar y quedarse con dos
rompe el contrato de que son exactamente tres. Cualquiera de las dos cambia píxeles y exige subir
`VERSION_PLANTILLAS`.

---

## 🐛 EL LOTE 4 BAJÓ AL 84.6 % DE KEYWORD PROPIO — y es el MISMO evento que los NULL

| lote | sub-clips | sin kw propio | conceptos NULL | largo medio de frase |
|---|---|---|---|---|
| 1 | 31 | 1 | 1 | 80 |
| 2 | 29 | 1 | 1 | 80 |
| 3 | 28 | 1 | 1 | 80 |
| **4** | **26** | **4** | **4** | 76 |

**`sin kw propio` y `NULL` coinciden sub-clip a sub-clip en los cuatro lotes.** No son dos
problemas: cuando DeepSeek omite los campos de un sub-clip, se pierde el `keyword` **y** los
`conceptos` a la vez. El lote 4 concentra 4 de los 7 NULL del vídeo.

Lo que tiene de distinto ese lote:

- **es el último**, y el más corto (26 sub-clips contra 31/29/28)
- contiene **el final de la transcripción**, donde Whisper degrada. Dos de los cuatro fallos son
  el mismo sub-clip partido en dos: `45:1` y `45:2` comparten la frase
  `"tan valiante que comienzan de sincronizadamente."` — 46 caracteres, y mal transcrita.

O sea: la señal apunta a **calidad de la entrada al final del audio**, no a un límite del lote ni
a truncado de la respuesta (`finish_reason=length`: **0 ocurrencias**).

**No se arregla porque el 93.9 % global está en banda** (93.6-98.8 %) y porque la causa está
aguas arriba, en la transcripción. Queda anotado para que, si el porcentaje baja, se mire aquí
primero y no en el prompt.

---

## 📌 A) EL FONDO TIENE QUE RESPONDER A LO QUE SE DICE — sin implementar

Hoy el fondo del mapa lo decide **la semilla**: `angFondo`, `estrellas`, `escMalla` y los dos
degradados salen de `receta(value)`. Varía por palabra pero **no por significado**, y por eso los
31 Visuales del último vídeo se parecen entre sí: cambia el tono, no la escena.

**La vía**: un campo `ambiente` en FASE 2 con **vocabulario cerrado** de diez o doce opciones
—`lluvia, noche, agua, fuego, ciudad, campo, mecanico, espacio, multitud, frio, calor, neutro`—
viajando en `extra` junto a los conceptos. Es descriptivo y local, el mismo tipo de tarea en la
que ya está medido que acierta, y cuesta ~5 tokens por sub-clip.

Al ir en `extra` entra en la clave del hash, así que dos Visuales con ambiente distinto dejan de
compartir fichero por construcción.

**Y lo que pinta cada ambiente no hay que inventarlo.** Segun el usuario, en su laboratorio
`lab-acabado.html` las escenas **RED**, **EXPANSION** y **MALLA** no son escenas: son **fondos**. La malla
que se hunde donde hay masa, los anillos con gradiente de temperatura, la esfera de nodos con
profundidad. Detrás del mapa son exactamente «el fondo tiene vida».

> ~~⚠️ **`labacabado.html` NO ESTA EN EL REPO NI EN Descargas.** Lo de arriba viene de lo que el
> usuario conto, no de haberlo leido. Antes de implementar esto hay que pedirle el fichero y
> guardarlo en `docs/motion/`, como se hizo con `generador-clips.html`. Sin el, esta nota es una
> intencion, no una especificacion.~~
>
> **CERRADO el 28/08/2026 en `757b6cc`:** la referencia está versionada como
> `docs/motion/lab-acabado.html`.

Lo que SI esta en `docs/motion/`: `generador-clips.html`, `lab-volumen.html`,
`lab-materia.html`, `lab-3d-guion.html`, `cipher-motion-loop.html`, `cipher-motion-loop-2.html`.

---

## 📌 B) UN CATÁLOGO DE VISUALES QUE ROTA, no sólo el mapa — sin implementar

Al usuario le sirven las composiciones de `lab-graficos.html`: el anillo que se dibuja con el
74 %, el dato grande con revelado, las barras en carrera, las capas isométricas — **sin palabra
principal y centradas**, como el mapa queda tras el paso 9.

> ~~⚠️ **`labgraficos.html` TAMPOCO ESTA**, ni en el repo ni en Descargas. Mismo aviso: hay que
> pedirlo antes de trabajar sobre el.~~
>
> **CERRADO el 28/08/2026 en `757b6cc`:** la referencia está versionada como
> `docs/motion/lab-graficos.html`.

**La infraestructura ya lo soporta**, y esto es lo que hace la nota barata:

- `COMPOSICIONES` es un registro por nombre, no un switch.
- `type` está en la clave del hash, así que dos composiciones distintas no pueden compartir MOV.
- `puedeDibujar` es lo que lo hace seguro: **una composición de número sólo se elige cuando hay
  número**, y si no, cae a `visual_texto` y lo dice en el log.

El único cambio estructural es que `COMPOSICION_VISUAL` deje de ser una constante y pase a ser
una **elección por clip**.

**Y los datos ya existen**: el último vídeo generó `decorativo_emoji` 11, `frase_clave` 4 y
`contador` 1 por el camino de las tarjetas. Esos son exactamente los tipos que alimentarían un
catálogo rotativo.

**NO se implementa todavía, y la razón es la de siempre**: primero se deja UNO impecable. Con
cinco composiciones a medias se replican los mismos defectos cinco veces, y entonces cada arreglo
cuesta cinco veces más.

---

## 🐛 `pintaPie` MIENTE — `true` significa «no pinto ninguno»

Desde el paso 9, `mapa` declara `pintaPie: true` y **no pinta ningún pie**. Lo que el campo
pregunta de verdad es *«¿se salta `AnimatedGraphic` el suyo?»*, no *«¿pintas tú uno?»*.

Quien lea `pintaPie: true` y busque el pie del mapa no lo va a encontrar. Y el error natural
—«pues lo pongo en `false`»— trae de vuelta la palabra grande de `AnimatedGraphic`, que es
exactamente la que el paso 9 quitó.

Nombre honesto: `omitePieDeAnimatedGraphic`, o darle la vuelta al booleano. **Renombrar no mueve
un píxel**, pero toca el contrato de `Composicion` y las dos composiciones, así que va cuando se
toque ese fichero por otra razón.

### Y está FUERA de la clave del hash, igual que `puedeDibujar`

Comprobado, no supuesto: `hashGrafico` proyecta seis campos de `graphicData` —`type`, `value`,
`label`, `unit`, `emoji`, `extra`— más ancho, alto, duración, fps, `VERSION_PLANTILLAS`, modo,
códec y sistema. `pintaPie` **no es un campo de `graphicData`**: vive en el objeto `Composicion`,
en el renderer. Grep sobre `src/main/index.ts`: **cero usos fuera de un comentario**.

Así que **cambiarlo mueve píxeles sin mover la clave**, y la caché devolvería para siempre los
MOV con el pie que ya no toca. El aviso está escrito en la definición del campo, junto al de
`puedeDibujar`.

---

## 🧹 `SISTEMA_VISUAL` NO AFECTA A NINGÚN PÍXEL DEL MAPA — eso es lo muerto, no las paletas

Conviene no confundir las dos cosas, porque en su momento se dijo mal:

**Las PALETAS están vivas.** `P.a`, `P.b`, `P.ac`, `P.f1` y `P.f2` tienen 10 usos en `mapa.tsx` y
colorean los nodos, las aristas, los pulsos, el ancla, los dos degradados del fondo, la malla, el
destello y el halo. No son código muerto ni de lejos.

**Lo que quedó sin efecto es el SISTEMA DE COLOR.** `SISTEMA_VISUAL` va fijo a `'voltaje'` en
`src/main/index.ts`, viaja hasta `AnimatedGraphic`, que publica `--fondo`, `--sup`, `--texto`,
`--acento` y `--apoyo` como variables CSS… y `mapa.tsx` **no lee ninguna**. La última que quedaba
era `color: var(--texto)` en `.cm-pal`, la palabra del pie, y el paso 9 se llevó el pie por
delante. Hoy no queda ni un `var(--texto)` ejecutable en el fichero.

Consecuencias, las dos anotadas para que nadie las descubra depurando:

1. **El prop `sistema` llega a `mapa.render` y no se desestructura.** No es código muerto —forma
   parte del contrato compartido con `extrusion`, que sí lo usa— pero en esta composición no
   hace nada.
2. **`sistema` SÍ está en la clave del hash.** O sea que hoy dos Visuales idénticos con sistemas
   distintos ocupan **dos ficheros** y pintan **lo mismo**. Es desperdicio de caché, no
   incorrección: la clave describe de más, nunca de menos.

**No se arregla porque es una decisión de diseño sin tomar**: o las paletas se derivan del
sistema —y se pierden las cinco, que son el motor de variedad— o se acepta que el mapa tenga
identidad de color propia y entonces habría que sacar `sistema` de la clave para los Visuales de
mapa. La segunda es la que ahorra ficheros, y la que exige subir `VERSION_PLANTILLAS`.

---

## 🧨 `v-antes-visual-mapa` NO ERA UNA RED DE SEGURIDAD, y ahora hay medida que lo prueba

El repositorio no compilaba desde un clon limpio, y no se veia porque la comprobacion miraba el
sitio equivocado: el worktree. En `node_modules` del worktree habia un `playwright` **fantasma**
—instalado en algun momento, nunca declarado en `package.json`— asi que `tsc` resolvia el import
y daba 0. Cualquiera que clonara el repositorio se encontraba otra cosa.

### La medida, no la suposicion

`src/main/providers/vibes-bot.ts` hacia `import { Page } from 'playwright'`, y `playwright` no
estaba en `package.json` ni en `package-lock.json`. En un clon real, `npx tsc -p tsconfig.json`
daba estos tres errores, literales:

```
src/main/providers/vibes-bot.ts(1,22): error TS2307: Cannot find module 'playwright' or its corresponding type declarations.
src/main/providers/vibes-bot.ts(290,26): error TS7006: Parameter 'text' implicitly has an 'any' type.
src/main/providers/vibes-bot.ts(302,30): error TS7006: Parameter 'text' implicitly has an 'any' type.
```

**Los tres eran el mismo problema, comprobado y no supuesto.** Sin el tipo `Page`, la variable
`page` cae a `any`, y entonces los callbacks de `page.evaluate((text) => …)` de las lineas 290 y
302 pierden el tipo contextual de su parametro. Al declarar la dependencia, `tsc` pasa a **0**
errores sin tocar esas dos lineas: ni un `any` a mano, ni un `@ts-ignore`.

### Hasta donde llega hacia atras: la etiqueta misma, medida directamente

El plan de este paso decia comprobarlo en `HEAD~5` y deducir de ahi que el defecto era anterior a
la etiqueta. **Esa deduccion no se sostiene, y por eso no se hizo asi.** `v-antes-visual-mapa`
(`8804e0a`) es *ancestro* de `HEAD~5` (`93e519d`): un fallo en el descendiente no dice nada del
antepasado. La flecha del tiempo apunta al reves.

Asi que se midio **en la etiqueta**, que es lo que de verdad prueba la afirmacion. Los tres
clones son el mismo `package-lock.json` —identico en las tres revisiones, comprobado con
`git diff`— asi que un solo `npm ci` vale para las tres:

| revision | que es | `tsc` |
|---|---|---|
| `8804e0a` | `v-antes-visual-mapa` | los 3 errores, exit 2 |
| `93e519d` | `HEAD~5` | los 3 errores, exit 2 |
| `626d3e4` | `master` antes del arreglo | los 3 errores, exit 2 |

Y el origen exacto: `vibes-bot.ts` entro en `bfd0d8d` (2026-07-22), **antes** de la etiqueta.
`git show v-antes-visual-mapa:package.json | grep playwright` no devuelve nada.

**Conclusion: `v-antes-visual-mapa` no compila desde un clon limpio.** No era el punto de retorno
que creiamos. Un punto de retorno que no compila no es una red: es la creencia de tener una.

---

## 📏 LA REGLA DEL CLON LIMPIO, escrita como regla

> Un clon limpio es **`git clone` + `npm ci` en un directorio SIN `node_modules` en ningun
> directorio padre**. Nada mas cuenta.

**Un `git worktree` NO sirve.** Comparte el `node_modules` de la copia de trabajo, que es
exactamente donde viven los paquetes fantasma. Esa confusion es la que oculto que el repositorio
llevaba mas de cien commits sin compilar desde cero.

Tampoco sirve el worktree para "comprobar si un test falla de verdad". Si una suite pasa en el
worktree y falla en el clon, **el clon tiene razon**: la diferencia es el hallazgo, no el ruido.
Un binario que falta, una ruta absoluta o un fichero que nunca se anadio a git son el mismo tipo
de defecto que este, y se reportan igual.

---

## ⏱️ «✓ built in 19ms» NO ES UN BUILD VACIO — el build son TRES pasos, y ese es el tercero

Anotado porque asusta, y con razon: diecinueve milisegundos no parecen un build de una app
Electron + React. La sospecha era legitima y se midio. **El build produce todo; los 19 ms eran una
medicion parcial** —la ultima linea de una salida que tiene tres bloques—.

`npm run build` es `tsc && vite build`, y ese `vite build` dispara **tres builds de Vite
encadenados**, porque `vite.config.ts` registra `vite-plugin-electron` con dos entradas ademas de
la del renderer:

| # | que compila | modulos | tiempo |
|---|---|---|---|
| 1 | el renderer (React), dos entradas HTML | **1611** | ~10 s |
| 2 | `src/main/index.ts` -> `dist-electron/main` | 83 | ~0.6 s |
| 3 | `src/preload/index.ts` -> `dist-electron/preload` | **1** | **~16-19 ms** |

El tercero compila **un solo modulo**, el preload. Que tarde milisegundos es exactamente lo que
debe pasar. Si alguien mira solo el final de la salida, ve el 19 ms y cree que no se construyo
nada.

### ~~El conteo de módulos subió sin cambios de aplicación~~ — ✅ CERRADO el 31/08/2026

~~Entre dos verificaciones el renderer pasó de 1613 a 1614 módulos y main de 84 a 85, aunque en
medio solo entraron documentación y pruebas. El número aislado parecía indicar un import o una
dependencia nueva.~~

**CERRADO en este mismo commit:** los artefactos desmienten un cambio de contenido.
`dist-electron/main/index.js` mide **367037 bytes** en las dos mediciones, y
`AnimatedGraphic-2o-fi4MF.js` conserva tanto el **mismo hash de contenido en el nombre** como sus
**235416 bytes**. El módulo adicional es telemetría del recorrido de Vite, no contenido añadido al
bundle.

**Criterio para futuras verificaciones: EL HASH DE CONTENIDO MANDA SOBRE EL CONTEO DE MÓDULOS.**
El conteo sirve como pista; un artefacto con el mismo hash y tamaño es la evidencia de contenido.

**Como comprobarlo de verdad: no mires el tiempo, mira los ficheros.** Tras `rm -rf dist
dist-electron && npm run build`, quedan **13 ficheros**, 645 KB en `dist/` y 1.1 MB en
`dist-electron/`:

```
    351943  dist-electron/main/index.js
    768494  dist-electron/main/index.js.map
      4463  dist-electron/preload/index.js
      7758  dist-electron/preload/index.js.map
    223861  dist/assets/AnimatedGraphic-7kbxuJhU.js
    103681  dist/assets/AnimatedGraphic-C_rEsOcp.css
      2343  dist/assets/grafico-DZcwwXWL.js
    217106  dist/assets/principal-QHhP90cP.js
     18612  dist/fonts/anton-400.woff2
     34928  dist/fonts/archivo-var.woff2
     32292  dist/fonts/outfit-var.woff2
       750  dist/grafico.html
       613  dist/index.html
```

Tres cosas que conviene reconocer en esa lista:

1. **Son DOS entradas HTML, no una.** `index.html` (la app) y `grafico.html` (la ventana
   offscreen que pinta los Visuales). Estan declaradas a mano en `rollupOptions.input`, y el
   propio comentario del `vite.config.ts` avisa de por que: al declarar input explicito, Vite deja
   de detectar `index.html` solo.
2. **`dist/fonts/` no lo genera el build: lo COPIA** desde `public/fonts/`, que es el `publicDir`.
   Los tres `woff2` estan en git. Por eso reaparecen tras un `rm -rf dist` **conservando su fecha
   original** —15:57 cuando todo lo demas marca 17:52—: es una copia, no una compilacion. No es un
   resto sin borrar.
3. **`main` y `preload` llevan `minify: false` y `sourcemap: true`** por configuracion. De ahi que
   el `.map` del main pese el doble que el `.js`.

**La etiqueta `v-paso9-mapa-sin-palabra` queda verificada por los ficheros, no por el exit 0.**
Un `exit 0` sobre una carpeta vacia no probaria nada, y ese era justamente el riesgo.

---

## 🤖 `vibes-bot.ts`: por que se conserva un fichero que probablemente nunca se ejecute

**Que pretendia.** Automatizar vibes.ai (Meta) para generar imagenes gratis.

**Por que esta por el camino equivocado.** La herramienta real de ese metodo es una **extension de
Chrome (WXT)**: corre **DENTRO** del navegador, sobre la sesion que el usuario ya tiene iniciada.
Playwright hace lo contrario: lanza un navegador **DESDE FUERA**, limpio y sin sesion. No son dos
formas de hacer lo mismo, son **arquitecturas incompatibles para este fin**. El fichero es un
intento por la via que no era.

**Consecuencia practica: la promocion de `playwright-core` a `playwright` probablemente NUNCA
haga falta.** Por eso se declara `playwright-core`, que no descarga navegadores, y no
`playwright`, que se lleva 18 MB en el `npm ci` de cualquiera que clone —por un fichero que no
importa nadie y que no se ejecuta. La dependencia esta ahi **solo para que el typecheck
resuelva**.

**El fichero no se borra: es trabajo que se quiere conservar.**

**La decision de diseno es un CONTRATO DE CARPETA.** La extension corre **por fuera** de CIPHER y
produce una carpeta con `images/` y `videos/`. CIPHER **lee esa carpeta y no sabe que Vibes
existe**. Ningun codigo de CIPHER conduce un navegador, y ese es justamente el punto: el limite
entre los dos mundos es un directorio en disco, no una API.

---

## 📏 EL LISTÓN — la línea base contra la que se mide el motor de motion nuevo

Antes de tocar nada del motor de Visuales ampliado, esto es lo único medido hasta hoy sobre
el coste del lazo de captura, y lo que falta por medir.

**Lo medido**, [main/index.ts:1340-1345](../src/main/index.ts#L1340), sobre composiciones ligeras
—`mapa` y `extrusion`, sin imágenes, sin blur, sin filtros de compositing—:

```
caliente   Visual voltaje 3s   90f   4500 ms   50.3 ms/frame   0.08 MB
caliente   Visual clinico 3s   90f   4471 ms   49.2 ms/frame   0.13 MB
caliente   tarjeta 2s          60f   3036 ms   50.1 ms/frame   2.14 MB
```

**50.3 ms/frame y 1.30 intentos/frame** son los dos números de referencia. **El coste vive en el
LAZO DE CAPTURA** —`capturePage()` más los reintentos de la sonda— **y no en el DOM ni en el
encoder**: el contenido apenas influye (voltaje y clínico, con fondos opuestos, difieren un
2.3%), y codificar es la parte barata frente a capturar.

**Lo que NO está medido, y hay que decirlo antes de empezar**: nadie ha medido cómo escalan
estos dos números con un DOM más pesado —más nodos, imágenes, filtros de `blur`—. Los tres
casos de arriba son todos composiciones ligeras y comparables entre sí; ninguno lleva una
imagen ni un `filter: blur(...)`.

**El blur importa más que el resto**: es la operación de compositing más cara que existe en
CSS —fuerza al compositor a resolver una convolución sobre toda el área afectada, no una
transformación barata como `translate`/`opacity`— y **nunca se ha probado en este lazo**. Una
capa de acabado con glow en dos niveles + profundidad de campo por Z (blur variable) es
exactamente el escenario que puede hacer que estos números dejen de valer.

**MEDIR INTENTOS/FRAME, NO SÓLO ms/frame.** Son dos preguntas distintas: ms/frame dice cuánto
tarda un render completo; intentos/frame dice si la sonda consigue sincronizar el frame a la
primera. El segundo es el que importa cuando se degrada: `MAX_INTENTOS_FRAME` es un tope
([main/index.ts:1412-1414](../src/main/index.ts#L1412)) — si un frame no llega tras agotarlo,
**el clip entero falla**, no sale más lento. Un DOM más pesado podría seguir dando un ms/frame
razonable y aun así perder clips enteros si tarda más en estabilizarse entre el `__setT(t)` y
la captura, empujando los intentos hacia el tope. La medida de éxito de la Fase 0 no es sólo
"¿cuánto tarda?", es "¿sigue synchronizando a la primera o segunda vez?".

---

## 🐛 EL ACOTADO MIRA EL CENTRO Y LO QUE SE SALE ES EL BORDE — `mapa` sigue con el agujero

Lo encontro la revision de la Fase 1 midiendo `escena`, pero **no es un defecto de `escena`: es el
mismo que `mapa` lleva dentro**, y `separados()` en `src/shared/mapa.ts` ya lo dice con todas
las letras:

> OJO, Y ESTA SIN RESOLVER: la comprobacion de zona mira EL CENTRO del nodo, no la caja. Una
> caja de 30% centrada en x=86 llega a x=101, fuera del cuadro.

`acotar()` acota **centros** a `ZONA` (13..87). Una caja de concepto mide `12.18 + 1.257 * c`
por ciento del ancho, asi que su borde esta en `centro ± ancho/2`. Con una etiqueta de 17
caracteres —`anchoCaja(17) = 33.5 %`— un centro en 75, **que acotar considera correcto**, pone
el borde derecho en 91.8: fuera de la zona segura, que acaba en 91.67.

**No da error.** El nodo sale en el video, medio pisado por la interfaz de la plataforma, y nadie
se entera hasta verlo.

### En `escena` esta cerrado, en `mapa` NO

`escena` lo cierra en la funcion generica `acotarPuntos`: acota cada x a
`[8.33 + semi, 91.67 - semi]` y, si ese intervalo queda vacio, centra en 50;
`MAX_CARACTERES_ETIQUETA = 56` hace que ese caso ni llegue a pintarse. Medido otra vez contra
el bundle en la Fase 4a: la caja maxima mide 82,572 %; su centro pasa de 72 a 50,384 y el borde
derecho queda exactamente en 91,67 % (990,036 px de 1080), desborde 0 px. Esta deuda es de
`mapa`, no de `escena`.

**`mapa` NO se ha tocado** —sigue vivo y etiquetado, y tocarlo pedia re-medir sus cuatro
familias— asi que **conserva el agujero**. Cuando le toque, el arreglo NO es cambiar `acotar()`:
es que `layoutSeguro` acote por borde igual que hace `escena`, porque `acotar()` tambien lo usan
las cuatro familias y cambiarlo moveria todos los dibujos a la vez.

### Y cuanto muerde, honestamente

`sanearConceptos` recorta a `MAX_PALABRAS_ETIQUETA = 2`, asi que hacen falta dos palabras que
sumen 17+ caracteres —"energia renovable" son 17— para dispararlo. **Con que frecuencia pasa de
verdad no se ha medido**: haria falta el corpus de etiquetas de una generacion real, y no se ha
contado. Lo que si esta medido es el umbral: 17 caracteres.


---

## 📏 REGLA PERMANENTE: NINGUN ARNES REIMPLEMENTA UNA FUNCION DEL PROYECTO

Las nueve suites ya lo hacen bien y lo dicen en su cabecera:

> Se importa del BUNDLE COMPILADO, no se reimplementa: una prueba que copiara la regla probaria
> su copia y seguiria verde con la regla rota.

**Los arnes sueltos tienen que cumplir lo mismo, y uno no lo cumplio.** Al verificar el acotado
por borde de caja de la Fase 1, el arnes copio `anchoCaja` escribiendola para recibir **un
numero**. La real recibe **la etiqueta** y mide `String(etiqueta).length` por dentro. Dos
consecuencias, y las dos pasaron:

1. El tope `MAX_CARACTERES_ETIQUETA` se derivaba con `anchoCaja(c + 1)`, o sea midiendo
   `String(57).length` = 2 caracteres. El tope real quedo en **500**, no en 56, y la puerta no se
   disparaba nunca. Lo cazo el render: una etiqueta de 60 caracteres dibujandose y saliendose.
2. El **"0 de 9000 fuera de zona"** salio del MISMO arnes, asi que tampoco valia: verificaba su
   propia copia. Se rehizo importando `anchoCaja`, `altoCaja` y `acotarPuntos` del bundle, y
   entonces si: 0 de 9000 en X y 0 pisando el pie, de 4 a 56 caracteres.

**Un arnes que reimplementa no verifica el codigo: verifica la copia.** Si hace falta ejecutar
algo del proyecto fuera de las suites, se ejecuta bajo `electron` contra
`dist-electron/main/index.js`, como hacen las nueve.

---

## 🎲 EL RECUENTO DE INSTANCIAS ESTA INFLADO Y A LA VEZ OMITE VARIACION

`dispersionX` declara `min: 1`, `max: 5` y `pasos: 5`, pero sobre un campo de 100 unidades
solo cambia la amplitud maxima del desplazamiento entre 1 % y 5 % del ancho: los escalones
contados pueden no distinguirse a simple vista. `dispersionY` tiene el mismo problema.

Ademas, esos valores no son la posicion final. Cada amplitud alimenta otro sorteo,
`entre(rnd, -dispersion, +dispersion)`, y esa variacion interna que si puede cambiar el dibujo
no aparece en `pasos` ni entra en `combinacionesLegales()`. Por tanto, el numero provisional de
instancias falla en las dos direcciones: **cuenta escalones que el ojo puede no distinguir y no
cuenta el sorteo que produce la posicion visible**.

No se corrige a ciegas. Se calibra con la hoja de contactos de la Fase 3: un rango solo compra
instancias cuando sus escalones producen diferencias perceptibles, y el recuento debe representar
la variacion efectiva de la pieza, no solo la forma de su configuracion.

---

## 🎨 LO QUE LA FASE 1 DEJA FEO A PROPOSITO — para la Fase 4 y la Fase 8

Anotado, NO arreglado: con una pieza por eje no tiene sentido pulir el aspecto. Pero se ve en el
render y conviene que este escrito antes de que alguien lo redescubra.

**Los anillos del fondo son casi invisibles.** Son `var(--acento)` a opacidad 0.20-0.30 sobre
`var(--fondo)`, o sea rojo oscuro sobre negro en `voltaje`. **El fondo es el eje que MAS variedad
tiene que dar** -- 22 piezas previstas contra 17 de estructura -- y hoy es el que menos se ve. Un
eje que no se percibe no multiplica nada: da la misma escena con otro nombre.

**Los decoradores se leen como polvo.** Cinco puntos de 1.6 cqmin en `var(--apoyo)` gris. La
densidad no se lee como densidad, se lee como **suciedad** en el fondo. `densidad: media` deberia
cambiar la sensacion de la escena y hoy solo anade motas. Cuando la Fase 5 derive la densidad del
contenido, esto tiene que ser algo que se vea.

**El acento no se relaciona con el heroe.** El emoji tiñe el heroe y los emojis de los nodos
--son glifos de color, traen el suyo-- pero los anillos, las aristas y los bordes de caja siguen
en `var(--acento)` del sistema. Con el cerebro rosa y con la gota azul, **el rojo es el mismo**.
La escena no tiene una identidad de color: tiene dos, y no se hablan. Es el mismo problema que
`SISTEMA_VISUAL` ya tiene anotado en `mapa`, pero aqui es peor porque el heroe es el elemento
dominante del cuadro.

---

## ⏱️ LA CAMARA NO ES DE DONDE SALEN LOS INTENTOS/FRAME — medido, y contradice la hipotesis

El liston son **50.3 ms/frame y 1.30 intentos/frame**. `escena` con una pieza por eje da
**~51 ms/frame y ~1.65 intentos/frame**: el tiempo aguanta, los intentos suben un tercio.

La sospecha era la camara -- cuatro envoltorios con `transform` animado y `will-change` --. **Se
midio y NO es.** A/B con la misma palabra y la misma semilla, cambiando UNA pieza del registro
(`camara: deriva` contra `camara: quieto`, que con `transform: null` no emite ningun @keyframes
ni pone `will-change`):

```
  LISTON       50.3 ms/frame      1.30 intentos/frame
  deriva       51.8 ms/frame      1.69 intentos/frame
  quieto       50.1 ms/frame      1.60 intentos/frame
  DIFERENCIA    1.8 ms/frame      0.09 intentos/frame
```

Dos tiradas independientes dan lo mismo. **La camara cuesta 0.09 intentos/frame: casi nada.** El
tercio de margen comido viene de OTRO SITIO -- el DOM en general, `container-type: size`, o el
peso de los glifos de emoji-- y eso hay que medirlo ANTES de la Fase 8, que es la que mete blur.

Dos avisos sobre este numero:
- **La muestra es pequeña**: 4 clips pedidos por tirada y el lector de log recogio 3 y 2. El log
  se escribe en cola y el ultimo no habia bajado a disco. La conclusion aguanta porque las dos
  tiradas coinciden, pero para decidir sobre la Fase 8 hace falta una medicion con mas clips.
- **Que la camara sea gratis NO significa que 16 camaras lo sean.** `deriva` es un `translate`
  mas un `scale`, que el compositor resuelve sin repintar. Una camara futura que anime `filter`
  o `clip-path` es otra cosa entera.


---

## 🔍 PENDIENTE: el −3 de Visual, y por que NO se persiguio en la Fase 2

En la prueba de aceptacion de los avisos, el resumen dijo:

```
    Visual: se pidieron 18 y salieron 15  (-3)
```

y el desglose por motivo **no explicaba esos tres**. Se investigo hasta cierto punto y **ahi se
paro a proposito**. Lo que queda descartado, mirando el log de la tirada:

- **NO es falta de palabra**: no salto la linea `[FASE 3] N de M Visuales sin palabra con
  significado en su tramo`.
- **NO es infra-asignacion**: no salto `[FASE 2] Visuales: se pidieron X pero solo habia Y slots
  de 'original' que ceder`. O sea que la cuota si asigno los 18.
- **NO es el defecto de orden que si se encontro y se arreglo** — la anotacion de
  `stock-sin-keyword` corria ANTES de la asignacion de Visuales y marcaba como "stock caido" a
  tres clips que despues se promovian a Visual. Corregido moviendola detras. Tras el arreglo el
  resumen da `Visual: 18 y 18`, asi que ese −3 concreto **era artefacto de ese bug**.

**Queda pendiente comprobar si reaparece en una generacion REAL.** Y se persigue entonces, no
antes, por dos razones:

1. **El resumen ya hizo su trabajo**: marco la desviacion y se NEGO a inventar un motivo. Un
   resumen que rellena huecos con conjeturas es peor que uno con huecos honestos.
2. **La prueba corria sobre un fixture**: un video sintetico hecho con ffmpeg y segmentos
   inventados. Perseguir ahi un defecto de GENERACION puede ser perseguir un artefacto de la
   prueba -- y ademas es el mismo desvio de alcance que ya se cometio una vez.

Cuando se persiga, se persigue **con la herramienta que esta fase construye**: el resumen sobre
una generacion de verdad. Ese es el sentido de haberla construido.


---

## 🎲 EL RENDER: una tirada de seis salio distinta

**NO es bloqueante y NO es el cimiento de la Fase 3.** Se llego a escribir aqui que "un
verificador de artefacto no puede existir si dos renders del mismo clip difieren", y es falso: el
verificador de la Fase 3 compara frames **dentro de un mismo video** -- no vacios, distintos
entre si, capas ciclicas que cierran, contenido en zona segura -- y ninguna de esas cuatro
comprobaciones necesita que dos renders coincidan. Era una molestia de herramientas convertida en
cimiento. Queda escrito y **se retoma solo si vuelve a aparecer**.

Esta seccion se ha reescrito dos veces. La primera version decia "el render no es reproducible",
sacado de UNA pareja de tiradas de la que una era justo la anomala.

### Las seis tiradas

Un Visual real (`value: 'agua'`, `pos: '3:1'`, tres conceptos, 2.6 s, 1080x1920, 30 fps, clave
`db7cb15ea714`), renderizado seis veces, frames crudos RGBA comparados **byte a byte**:

```
  c11226f · 3b24804 · BIS · P1 · P2     -> IDENTICAS entre si, las cinco, en f0, f39 y f77
  5cb7d33                               -> distinta de las cinco, en f39 y f77 (f0 igual)
```

**Cinco de seis coinciden al byte.** El render **no** es no-determinista: es determinista con una
anomalia intermitente, medida una vez de seis.

### Cuanto se desvio la anomala

```
  frame  0 : IDENTICO
  frame 39 :  28.674 px de 2.073.600 (1,38%)   delta max=16   medio=1,6
  frame 77 : 247.745 px de 2.073.600 (11,9%)   delta max=37   medio=2,0
  reparto del delta -> 99% de los cambiados en 1-4 niveles;  CERO por encima de 64
```

### EL DISCRIMINADOR, que es lo que vale de todo esto

```
  pocos pixeles  + delta enorme              -> algo SE MOVIO. Cambio real.
  muchos pixeles + delta <= 4, ninguno > 64  -> RASTERIZADO. Ruido.
```

Un elemento desplazado deja pocos pixeles cambiados con delta de cientos: donde habia fondo hay
figura. Un rasterizado ligeramente distinto deja muchisimos pixeles con delta de uno o dos: los
mismos bordes, medio nivel corridos. **Son firmas opuestas**, y por eso se pueden separar. La
anomalia medida es, sin ambiguedad, la segunda.

Esto convierte la comparacion de pixeles de inservible en fiable **con tolerancia**, y esta
versionado en `tests/aceptacion/comparar-capturas.js`, con sus umbrales justificados. **Sustituye
a la igualdad byte a byte** en el diff de comportamiento de los merges.

> **EL PORCENTAJE NO DISCRIMINA, y se quito.** Una primera version mandaba a DISTINTO todo lo que
> cambiara mas del 5% de la pantalla, y con eso el frame 77 de esta misma anomalia -- 11,9% de
> pixeles cambiados y NI UNO por encima de delta 64, o sea ruido puro -- salia DISTINTO y habria
> puesto un merge en rojo. Medido con un control positivo sintetico (el mismo frame corrido 4 px):
> el caso MOVIDO cambia el 25,9% de la pantalla y el benigno el 11,9%, asi que el porcentaje los
> ordena mal y los ordenaria mal con cualquier umbral. Lo que los separa limpiamente es 3.586
> pixeles por encima de 64 contra CERO. Un rasterizado medio nivel corrido toca todos los bordes a
> la vez: cubrir mucha pantalla es lo NORMAL en el caso benigno.

### Lo que esta DESCARTADO, con linea

- **El reloj de las animaciones no es la causa.** `grafico.tsx:193` recorre
  `document.getAnimations()`, **pausa** cada una y le fija `currentTime` a un valor **absoluto**
  (`t * 1000`). No se espera a un rAF ni se captura "lo que haya".
- **El lazo de reintentos no es la causa.** `index.ts:1408` llama a `__setT(t)` **una vez por
  frame, FUERA** del lazo (1413-1427). Un reintento solo repite `capturePage()` sobre el **mismo
  estado del DOM**: no reposiciona el tiempo, y si lo hiciera daria el mismo valor por ser
  absoluto. La hipotesis del "reintento que captura en otro instante" queda **falsada**.
- **No hay `Math.random`, `Date.now`, `performance.now` ni `new Date()`** en la ruta de
  composicion, y la semilla sale SOLO de `value` (`shared/semilla.ts`), que esta en la clave.

### Los sospechosos que quedan: RASTERIZADO

Presentes en `visual_mapa`; los tres primeros fuerzan capa de composicion por si solos:

| sospechoso | donde |
|---|---|
| `backdrop-filter: blur(.19cqw)` | `composiciones/mapa.tsx:202` |
| `mix-blend-mode: screen` | `composiciones/mapa.tsx:206` |
| `filter: blur(3cqw)` | `composiciones/mapa.tsx:212` |
| `<svg viewBox>` como capa | `composiciones/mapa.tsx:537` |
| gradientes | 8 apariciones en `mapa.tsx` |
| `will-change: transform` | `composiciones/escena.tsx:286` — `escena` esta INACTIVA, hoy no entra |

Y un detalle del mecanismo: **la sonda valida su propia franja, no el frame entero.** Son 8 px
pintados por DOM directo y sincrono, fuera de React. Que la sonda llegue al compositor demuestra
que hubo un frame nuevo; no demuestra que una capa promovida a GPU haya terminado de repintarse.
Encaja con que el frame 0 sea siempre identico y la diferencia crezca con el tiempo del clip.

### La pista de cuando pasa — DOS observaciones, todavia no una causa

La tirada anomala fue **el primer render en un clon recien instalado con `npm ci`**: Electron
nuevo, cache de fuentes fria, cache de shaders fria. Las cinco que coinciden se hicieron sobre
arboles ya usados.

Hay una segunda observacion independiente de que el primer render puede comportarse distinto:
`test:graficos`, con el banco de Visuales abierto a la vez, midio **7075 ms** en su primer render
contra un limite de 5000 ms y se puso roja. Al cerrar el banco, tres tiradas consecutivas dieron
**3941, 3525 y 3612 ms** para el primero; los segundos renders dieron **4844, 4111 y 3201 ms**.
El 7075 es 2,6 veces el liston historico aproximado de 2,7 s.

Esto **refuerza la pista**, no demuestra la causa: la tirada lenta tenia dos factores mezclados,
arranque de la ventana y una maquina ocupada por Vite y el banco. No separa cache fria de
competencia de recursos, y no se persigue aqui.

### Tercer montaje de `skyline`: anomalia por BrowserWindow, no por ruta (03/09/2026)

**Condiciones:** `visual_escena`, palabra `cualitativamente`, fondo `skyline`, 1080x1920,
30 fps, ciclo 3 s, sistema `voltaje`; frames 0, 39 y 77; misma hoja de estilos
(`SHA-256 9a1a790970163dc8bbc9c0d546ab71b468d65c4aabbde9ac9158f5b24c449000`), fuentes
verificadas por geometria, animaciones pausadas y posicionadas en tiempo absoluto. Se probaron
las secuencias A-A-A, A-B-A-B y A-A-B-B, desmontando el arbol entre clips.

El **tercer montaje** dentro de una ventana reutilizada cambia de forma reproducible solo la
parte inferior de `skyline`; los montajes 1, 2 y 4 coinciden. Frame 39: **11.050 px**, filas
1824-1919, delta maximo 7 y medio 1,705. Frame 77: **58.480 px**, filas 1772-1919, delta
maximo 10 y medio 1,910. Cero pixeles superan delta 64. El frame 0 es identico.

El control decisivo cerro la BrowserWindow sin reiniciar Electron y repitio los montajes 1 y 2:
volvieron a coincidir al pixel. El estado es **por ventana, no por proceso**. Se descartan la
ruta de direccion, el orden A/B, las fuentes —la palabra no cambia ningun pixel— y la colision
de keyframes —un solo `<style>`, mismo hash y arbol desmontado—. La causa sigue desconocida;
como hipotesis, no hecho, el compositor de Chromium cambia de estrategia tras varias montas de
barras animadas por `scaleY` sobre degradado.

Consecuencia: es subperceptual y no se persigue. Dos renders del mismo Visual pueden no ser
identicos byte a byte, pero la cache no depende de los pixeles sino de su clave. El arnes
`tests/aceptacion/interruptor-direccion.js` abre una ventana fresca por pareja y fija el ordinal.

~~`tests/graficos.js` mezcla correccion y rendimiento: `TOPE_MS = 5000` se aplica al primer~~
~~render y al segundo por separado; 4844 ms dejo una tirada descargada a 156 ms del rojo. Tambien~~
~~exige que un acierto de cache tarde menos de 100 ms y que la sonda no pase de cinco intentos.~~

**CERRADO en la rama `separa-rendimiento-graficos`:** los tiempos del primero, segundo, cache y
lectura de la sonda se imprimen pero no deciden el verde. La cache se demuestra por el contador
autoritativo del lote (`aciertos === 1`, `renderizados === 2`), no porque haya sido rapida. La
suite conserva un watchdog de 90 s contra bloqueo; el liston de producto vive en
`npm run bench:graficos`, con seis muestras y dos resumenes separados: las tres de arranque y
las tres de regimen asentado, cada uno con mediana y p95 de ms/frame e intentos/frame.

### El supuesto efecto observador y la supuesta regresion de 62 contra 50 — descartados

El primer banco nuevo midio clips de **1 s / 30 frames** y mezclo el calentamiento en una sola
mediana: **62,17 ms/frame** contra un liston historico de **50,30**. La comparacion no era valida:
el liston se midio a **3 s / 90 frames**, y el coste fijo pesa tres veces mas por frame en el clip
corto.

El observador tampoco corre dentro del lazo: `emitirMedicionRenderGrafico()` se invoca **una vez
por clip**, despues de escribir todos los frames y cerrar FFmpeg; `ms` se captura antes de llamar
al observador. Un A/B de seis renders activos contra seis inactivos, con el mismo arbol y semilla
dentro de cada par y alternando el orden, no mostro penalizacion consistente. En regimen asentado
el lado activo fue incluso **5,13 ms/frame mas rapido**, signo de ruido, no de coste causal. La
diferencia entre el tiempo exterior y el `ms` interno en las seis muestras activas fue solo
**1-3 ms por render completo** (aprox. **0,02 ms/frame**) e incluye tambien el log: es una cota
superior, no 9-12 ms/frame.

Repetido en la condicion demostrable del liston --`visual_mapa`, voltaje, 1080x1920, 3 s, 90
frames--, el regimen asentado dio **51,51 ms/frame de mediana y 52,31 de p95**: x1,02, no x1,24.
Los intentos asentados dieron **1,63 de mediana y 1,69 de p95** contra el 1,30 historico, sin
frames en el tope. La posible regresion de intentos queda **ni confirmada ni descartada**: el
`graphicData` exacto del arnes de 2026-08-08 no quedo en Git, solo su composicion, duracion,
frames y sistema. El numero actual queda escrito, pero la comparacion clip-a-clip historica no
se puede reconstruir honestamente. Desde ahora el benchmark versiona su fixture completo y la
regla que sustituye `{id}` para evitar la cache.

### Lo que NO se ha demostrado, y no debe escribirse como si si

- **Que no haya micro-tembleque en el video entregado.** Es **probable** -- delta medio 2 sobre
  255 y nada desplazado -- pero lo medido son **dos renders distintos**, no frames consecutivos
  dentro de una tirada. El tembleque seria que un elemento quieto cambie entre frames del MISMO
  video, y eso no se ha mirado. Probable, no demostrado.
- **La correlacion entre frames reintentados y frames que difieren.** Sigue teniendo sentido -- un
  reintento indica que el compositor iba retrasado, que es justo cuando una capa podria estar sin
  repintar -- pero hace falta registrar los intentos POR FRAME, y eso es tocar el lazo de captura.

---

## ⚖️ REGLA: una comparacion pareada no prueba reproducibilidad

Sale de este episodio y vale para cualquier medida futura.

La "prueba de pixeles" de la Fase 1 comparo **dos** tiradas, salieron identicas y se dieron por
buenas. Despues otra pareja salio distinta y se **retiro** la primera. **Ninguna de las dos decia
nada**: con una anomalia cada seis, dos muestras no distinguen la suerte de la ley. Hizo falta
una tercera tirada de arbitro -- y al final seis -- para ver que la anomala era una y no cinco.

**Con n=2, "identico" e "distinto" son igual de poco informativos.** Toda afirmacion de
reproducibilidad necesita una TERCERA tirada como minimo, y decir cuantas se hicieron.



## 🕳️ DOS AGUJEROS DE COBERTURA — uno sigue abierto y el otro está cerrado

Se preguntaron al cerrar la Fase 2 y las dos respuestas eran que no. La cobertura del
handler sigue abierta; el suelo de pruebas se cerró en el puente y se conserva tachado.

### 1. El bug de ORDEN del −3 no lo caza ninguna suite

El defecto que se arreglo en la Fase 2 —anotar la degradacion de stock ANTES de la asignacion de
Visuales, de forma que tres clips anotados se promovian despues— **era de orden dentro del
handler**, y lo cazo la prueba de aceptacion, no una suite.

Comprobado sobre el arbol:

- **Ninguna suite invoca `generate-timeline-assets`.** Ni una.
- **Ninguna suite menciona `origenPedido` ni `motivoRespaldo`.**
- Lo que `tests/avisos.js` congela es el **TEXTO** del resumen a partir de conteos sinteticos:
  ejercita `coleccionDeAvisos`, `armarResumen` y `textoResumen`, que son puros. **No vuelve a
  ejecutar el handler**, asi que el orden de las anotaciones le es invisible.

**Si manana alguien mueve esas lineas otra vez, el bug vuelve y nada lo detecta.**

~~Y hay un agravante: **el arnes de aceptacion no esta en el repo**. Vive en un directorio temporal
fuera del proyecto, o sea que hoy nadie mas puede repetir la prueba que es la unica cobertura que
existe. Estado real: **cubierto por la prueba de aceptacion manual, no por una suite** — y esa
prueba manual, ademas, no esta versionada.~~

**CERRADO el 31/08/2026 en `2956925`:** el arnés y su README están versionados en
`tests/aceptacion/`. Sigue siendo una prueba de aceptación manual, no una suite automática;
el agujero de cobertura del orden del handler sigue abierto.

### ~~2. No existe "lo que ejecuta el conjunto"~~ — ✅ CERRADO el 31/08/2026

~~Se pregunto si `test:avisos` esta enganchada al ejecutor del conjunto. **No hay ejecutor del
conjunto.** No hay script `test`, no hay `.github/`, no hay `.husky/`. Las diez suites son diez
scripts sueltos de `package.json` y el "conjunto" es una persona escribiendo un bucle a mano.~~

~~`test:avisos` esta exactamente igual de enganchada que las otras nueve, que es decir **nada**. El
problema no es la novena: son las diez.~~

~~Es, palabra por palabra, el modo de fallo que la Fase 2 existe para impedir —algo que hay que
acordarse de mirar es algo que un dia deja de mirarse y nadie se entera— aplicado a las propias
pruebas. Cuando se arregle, hay una decision de diseno que tomar y no es automatica: **`test:ventana`
esta roja A PROPOSITO**, asi que un ejecutor que la incluya nace rojo para siempre y entrena a no
mirarlo, y uno que la excluya tiene que dejar escrito por que.~~

**CERRADO en `6c20996`:** `npm test` ejecuta las nueve suites verdes, declara que espera nueve,
cruza los scripts con los ficheros para detectar una suite no enganchada y excluye
`test:ventana` con el motivo escrito en el propio ejecutor.

---

## Crash inexplicado de `test:exclusion` durante el desmontaje

**Estado: inexplicado y sin atribuir.** En una ejecución apareció el código de salida
`3221225477` (`0xC0000005`, *access violation*) durante el desmontaje del proceso, después de
que todas las aserciones hubieran impreso verde. No hubo ninguna aserción fallada asociada.

Condiciones observadas: rama `separa-rendimiento-graficos`, **1 crash / 12 ejecuciones**;
`master`, **0 / 10**. Diez muestras por lado no distinguen estadísticamente una tasa del 0 %
de una del 8 %, así que se deja de muestrear por esa vía; **no porque el problema se haya
resuelto**.

También se descartó el criterio «el diff no toca la suite»: `tests/exclusion.js:238` carga
`dist-electron/main/index.js`, el bundle entero generado desde `src/main/index.ts`, y la rama sí
modifica ese fichero. La instrumentación añadida no deja un recurso nativo vivo: no crea
`PerformanceObserver`, temporizadores ni listeners; mantiene callbacks en un `Set` y su único
consumidor (`tests/rendimiento/graficos.js:80-91`) retira la suscripción dentro de un `finally`,
también si el render falla. Esto **no demuestra** la causa del crash.

La decisión que queda en pie: **una suite que crashea es roja aunque las aserciones hayan
pasado**. Si reaparece, se investiga como fallo, no como ruido.

---

## Delta de HTML observado tras extraer `instanciaDe`

Al extraer la derivación de instancia desde `escena.tsx` a la función pura compartida
`instanciaDe`, el build de producción cambió `dist/index.html` de 613 a 601 bytes (**−12**) y
`dist/grafico.html` de 750 a 737 bytes (**−13**). Se esperaba que cambiara el chunk de la
composición; estos dos deltas de HTML están **observados y sin explicar**. No se atribuyen a una
causa inventada y no se persiguen en el paso de la hoja de contactos.

---

## Hoja de contactos: rasterizado subpixel y calibracion de los cuatro rangos

**Condiciones de la medida (01/09/2026):** composicion `visual_escena`; identidad
`liso / constelacion / quieto / media / regular`; tres conceptos (`recuerdo`, `archivo`,
`conexion`); `t = 1.500 s`; lienzo nativo 1080x1920; miniatura 162x288 (`scale(.15)`);
comparador `tests/aceptacion/comparar-capturas.js`. El fixture sale de un corpus cerrado de
136 palabras reales en castellano y guarda los extremos alcanzados, no los limites declarados.
**`liso` es una pieza de prueba:** `direccionDe` no la sortea. Aquella hoja midio instancias
sobre un control deliberadamente neutro, no sobre un fondo que pueda salir por loteria.

### El control repetido es equivalente en miniatura por posicion, no por palabra

`memoria` lleva exactamente las mismas cuatro semillas y los mismos parametros en las dos
casillas. En 9/12 dio **EQUIVALENTE**: 15.825 px cambiados de 46.656, delta maximo 41,
media 5,9 y **cero** por encima de 64. Se movieron temporalmente los casos completos a 10/11,
regenerando el fixture para no desalinear palabra, semillas y parametros: volvio a dar
**EQUIVALENTE**, 15.721 px cambiados, delta maximo 51, media 5,8 y **cero** por encima de 64.
La diferencia sigue a la posicion de una escena escalada al 15 %. La misma palabra a tamano
completo ya habia dado **IGUAL**. Diagnostico: rasterizado subpixel, no cambio del dibujo.

La limitacion queda visible en el banco: la hoja sirve para comparar variedad a ojo; la igualdad
exacta se comprueba a tamano completo. No se corrige ni se rebaja el comparador.

### Cuanto mueven realmente los rangos alcanzados

En vertical, `1cqmin = 10,8 px`; un punto porcentual horizontal son 10,8 px y uno vertical son
19,2 px. Los cuatro parametros se aislaron temporalmente despues de consumir el generador en su
orden real: misma palabra `memoria`, mismas semillas y mismos otros tres parametros. Se usaron
los valores reales alcanzados por el fixture.

**Limite de esta evidencia:** estos cuatro aislamientos se midieron UNA vez con instrumentacion
no versionada, retirada antes del commit. Los numeros orientan y demostraron que los cuatro
rangos viven, pero **no son reproducibles hoy** y no se presentan como una medicion establecida.

- **`dispersionX`**: 1,122452 (`decision`) -> 4,969762 (`camara`). En
  `src/shared/escena.ts`, `p.x + entre(rnd, -dispersionX, dispersionX)` usa el parametro como
  amplitud, no como posicion. La amplitud pasa de **12,12 px a 53,67 px**; con el mismo sorteo,
  la diferencia maxima de centro es **41,55 px** (el ancho total del sobre crece 83,10 px).
  Aislado a 1080x1920: **DISTINTO**; 71.625 px cambiados, 21.644 por encima de 64,
  delta maximo 255, media 61,2.
- **`dispersionY`**: 1,054821 (`montana`) -> 3,994710 (`animal`). En la misma funcion,
  `p.y + entre(rnd, -dispersionY, dispersionY)`. La amplitud pasa de **20,25 px a 76,70 px**;
  diferencia maxima de centro **56,45 px** (el sobre crece 112,89 px).
  Aislado: **DISTINTO**; 86.821 px cambiados, 23.896 por encima de 64,
  delta maximo 255, media 61,5.
- **`curva`**: 2,038310 (`miedo`) -> 7,998856 (`recuerdo`). En
  `src/renderer/src/composiciones/escena.tsx`, se resta al `y` del punto de control de cada
  Bezier cuadratica. El control se desplaza **114,44 px**; por el peso maximo 0,5 del control
  en una Bezier cuadratica, el trazo se separa como maximo **57,22 px** cerca del centro.
  Aislado: **DISTINTO**; 34.425 px cambiados, 5.317 por encima de 64,
  delta maximo 204, media 31,2.
- **`escalaHero`**: 22,036069 (`empresa`) -> 29,998680 (`cambio`). En
  `src/renderer/src/composiciones/escena.tsx` llega directamente a
  `fontSize: escalaHero + 'cqmin'`. El `font-size` pasa de **237,99 px a 323,99 px**:
  **86,00 px** de diferencia. En la hoja al 15 % son 12,90 px de `font-size`, antes de contar
  que la tinta real del emoji ocupa solo una parte del em. Aislado: **DISTINTO**;
  121.895 px cambiados, 29.898 por encima de 64, delta maximo 255, media 59,2.

**Respuesta sobre `escalaHero`:** no es ninguna de las dos hipotesis planteadas. Los extremos
alcanzados son practicamente los declarados **y** el parametro llega al dibujo sin que otra regla
lo pise. Lo que fallo fue la lectura en una miniatura al 15 %: el parametro vive a tamano completo,
pero esa hoja no permite juzgar honestamente su magnitud mirando solo el cerebro reducido.

**`curva`, en observacion:** declara cuatro pasos, pero en las parejas reales al 45 % no se
distinguen a ojo ni los extremos 2,04 y 8,00: las lineas se leen rectas en ambos. Su aislamiento
fue tambien la medicion mas debil de los cuatro rangos (34.425 px cambiados y solo 5.317 por
encima de delta 64). No se toca ahora; se decide cuando se reescriba `constelacion`.

Los cuatro pares de palabras del fixture, comparados directamente, tambien dieron DISTINTO, pero
esa pasada **no atribuye causalidad**: cambia el pie, las semillas de puntos y los otros tres
parametros. Por eso los veredictos anteriores proceden del aislamiento con la misma palabra.

Se decidio NO construir un gancho permanente para repetir aquel aislamiento. El gancho habria
metido una puerta de pruebas capaz de alterar pixeles dentro del camino de dibujo de produccion,
aunque entrara correctamente en `hashGrafico` y en `claveDe`. Ese coste solo compraba repetir un
diagnostico que ya no decide nada: la pregunta abierta es si un espectador distingue dos
instancias REALES, y se responde con la vista de pareja del banco, usando dos palabras reales.
Cuando repetir el aislamiento ahorre trabajo que ya duela, se construira entonces.

---

## Primera estructura y primer fondo nuevos: alcance de la hoja de identidades

**Condiciones (01/09/2026):** banco local, composicion `visual_escena`, palabra `memoria`,
conceptos `recuerdo / archivo / conexion`, camara `quieto`, densidad `media`, ritmo `regular`,
`t = 1.500 s`. La primera captura tenia cuatro lienzos 1080x1920 a escala 0,45 y vive en
`tests/aceptacion/hoja-identidades-extremos.png`.

La hoja cruza los fondos reales `ondas / tunel` con las estructuras reales
`constelacion / capasApiladas`. Es una **COTA SUPERIOR**: las piezas se eligieron por ser
deliberadamente opuestas. Que las cuatro se distingan demuestra el techo del mecanismo, no que
dos piezas vecinas se distingan. La prueba dura pendiente es `constelacion` contra `red de nodos`.

Los casos degenerados se midieron con `tunel / capasApiladas / quieto` y el limite real de tres
conceptos. Una etiqueta cabe dentro de la zona; etiqueta de 80 caracteres, cero conceptos, texto
vacio y emoji ausente dan `puedeDibujar: false` y cero cajas. La primera pasada descubrio que
`AnimatedGraphic` no pasaba `extra.direccion` a `puedeDibujar`: el banco decia `true`, pero la
puerta derivaba otra estructura y caia a respaldo. Se corrigio pasando a la puerta la misma
direccion que ya recibe el dibujo y que ya forma parte del hash.

**Catorce no son conceptos.** `CUANTOS_CONCEPTOS = 3` es contrato de producto. Los catorce son
decoradores del eje densidad y se prueban en la Fase 5; no se amplia aqui el contrato de conceptos.

### Cierre de la Fase 4a: el eje fondo carga identidad

La captura `tests/aceptacion/hoja-identidades-seis.png` cruza `ondas / tunel / skyline` con
`constelacion / capasApiladas`: seis lienzos 1080x1920 a escala 0,45, misma palabra `memoria`,
mismos conceptos, `quieto / media / regular`, sistema `voltaje` y `t = 1,500 s`.

`ondas` se corrigio para portar las once lineas sinusoidales de
`docs/motion/lab-fondos.html:90-108`; antes dibujaba anillos y contaminaba la comparacion con
`tunel`. `skyline` porta las 22 barras de `docs/motion/lab-fondos-2.html:237-251`. Ninguna
declara rangos sin haber mirado extremos, por lo que el recuento baja honestamente a 8
identidades legales y 60.320 instancias.

Los tres rangos de `capasApiladas` (`anchoPlano`, `inclinacion`, `flotacion`) siguen con cuatro
pasos **provisionales**. Esta hoja muestra una sola instancia por identidad y no enfrenta los
extremos de esos rangos, de modo que no permite contar escalones distinguibles sin adivinar. Se
calibran cuando exista una pareja u hoja especifica de `capasApiladas`; hasta entonces no se toca
ni el numero ni `tests/ciclo.js` por esta causa.

### Fondo claro: `tono` existe, pero todavia no gobierna la tinta

~~`MetaFondo` declara `tono: 'oscuro' | 'claro'`, pero ninguna ruta de dibujo lo lee.
`AnimatedGraphic.tsx:499-515` toma `--fondo`, `--sup`, `--texto`, `--acento` y `--apoyo`
exclusivamente de `SISTEMAS[sistema]`. Por tanto, marcar un fondo como claro no cambia el texto
a tinta. Tres fondos del catalogo dependen de resolver como conviven sistema y tono: trama
tejida, amanecer y comida en familia. Se aplaza a un paso propio para no confundir la prueba de
identidad del eje fondo con una decision de arquitectura de color.~~

CERRADO el 02/09/2026, en el commit de tono claro y trama tejida: cada sistema declara su
tinta; escena la aplica fuera de la cache del arbol cuando el fondo es claro. Cambian texto,
superficie, acento, apoyo y sombra del pie. Los cinco colores originales quedan intactos;
`clinico` y `calido` ya tenian texto oscuro. El tono no decide una paleta por su cuenta.

Evidencia: `tests/aceptacion/tono-oscuro-claro.png`, palabra memoria, constelacion/quieto/media/
regular/Archivo, voltaje, t=1.500 s, ciclo 3 s, lienzos 1080x1920 a escala 0.45.
Cajas claras: fondo #FFFFFF, texto #1A1A1A; oscuras: rgba(9,12,20,.9), texto #FAFAFA.
Fuentes verificadas por geometria. `trama-tejida-lab-pieza.png` enfrenta lab y banco a 1.503 s
(el lab avanza en pasos de .0167 s), con las dimensiones escritas en la imagen.
Porte de `lab-fondos-2.html:318-333`: el grano fijo de .7px se convierte a .294cqmin tomando
el ancho minimo de 238px del lab. Se ve algo mas marcado en el banco; no se afirma igualdad
de rasterizado entre esas escalas. Hilos, colores y desplazamiento conservan la referencia.
Recuento importado del bundle: 36 identidades / 166.470 instancias, incluyendo los pasos
provisionales de capasApiladas; con piezas de prueba: 104 / 449.280. Interruptor en mapa, version 8.

### Deudas observadas al portar el primer vecino del catalogo

- **`skyline` tiene variacion fija, por decision consciente.** Su dibujo usa `generador(29)` y
  por tanto las 22 alturas y fases son iguales en todos los videos. No se añade un rango sin
  mirar extremos: hacerlo ahora repetiria la inflacion de pasos que ya se encontro en
  `capasApiladas`.
- ~~**La vista PAREJA sigue acoplada a `constelacion`.** Sus selectores conocen solo
  `dispersionX / dispersionY / curva / escalaHero`. Desacoplarla es trabajo propio; hasta
  entonces los pasos 4 x 4 x 4 de `capasApiladas` siguen provisionales y el recuento de 60.450
  los incluye.~~ CERRADO el 02/09/2026 en el commit de parejas por registro. El selector lee
  los rangos de la estructura activa; los extremos viven en `parejas-estructuras.json`,
  buscados deterministamente en las 136 palabras del generador, sin otra derivacion.
  Esto cierra el acoplamiento, NO la calibracion de pasos.

  Medicion visual de capasApiladas: `liso` (pieza de prueba), quieto/media/regular/Archivo,
  voltaje, t=1.5 s, ciclo 3 s, 1080x1920 a 0.45. Capturas `capas-pareja-*.png`:
  anchoPlano: decision/camara, 38.306130/47.924406 cqmin; inclinacion: montana/animal,
  52.219284/63.978841 grados; flotacion: miedo/recuerdo, 0.506385/1.499809 cqmin.
  Ancho e inclinacion se distinguen entre extremos. La flotacion no puede juzgarse aislada
  en esta vista: tambien cambian los otros parametros y semillas. Dos extremos NO demuestran
  cuatro escalones intermedios: no se pueden contar honestamente para ninguno de los tres.
  Se mantienen 4/4/4 PROVISIONALES, sin afirmar que esten calibrados. El nuevo recuento
  36 / 166.470 cambia por tramaTejida, no por esta tarea.

  Verificacion del lote, 02/09/2026: tsc y build exit 0; npm test 8/9, exit 1.
  test:ciclo falla en tres vectores (semillas 0, 1, 42) congelados contra master 3ea5c6d:
  "los cinco sorteos anteriores no cambian". Esa guardia de la introduccion de tipografia
  tambien fija el catalogo de fondos antiguo; al añadir tramaTejida cambian sus elecciones.
  ~~Pendiente antes del merge: sustituir los vectores congelados sin confundir ampliacion de
  repertorio con desplazamiento del orden del generador.~~ CERRADO el 02/09/2026 en el commit
  de la guardia de orden: `tests/ayudas/orden-direccion.js` ejecuta la funcion y sus helpers
  del bundle, con generador controlado y catalogos sinteticos de 6 y 11 opciones por eje.
  Comprueba seis consumos sobre un solo generador, en orden fondo/estructura/camara/densidad/
  ritmo/tipografia; los 15 intercambios posibles se rechazan como controles negativos por
  cada catalogo. Ni nueva entrada de prueba ni cambios en el codigo de produccion.
- **`ANILLOS_FONDO` y `faseAnillo()` estan huerfanas.** No tienen consumidores bajo `src/` ni
  `tests/` desde que `ondas` dejo de ser anillos. No se borran en este paso: se incorporan al
  mismo inventario de deuda que las 1.154 lineas huerfanas ya conocidas.
- **`C:\\graphify\\fase4a-edit` es un clon consumido.** Contuvo borradores y no vuelve a usarse
  para verificar nada. `calibracion-capaspiladas.patch` si se aplico: su nota esta en este
  documento desde `17b89ce`.

### Prueba visual de porte contra los labs aprobados

**Condiciones (02/09/2026):** banco y labs servidos solo en local, sin red, APIs, render de video
ni exportacion; sistema `voltaje`; palabra `memoria`; conceptos `recuerdo / archivo / conexion`.
Los lienzos del banco miden 389x691 px y los de los labs 381x677 px. Para estructuras se uso
camara `deriva`, fondo `liso` en el banco, `t = 1,498 s`; para `skyline`, camara `quieto`,
estructura de prueba `unaCaja`, `t = 1,503 s`. Las seis capturas viven en:

- `tests/aceptacion/porte-red-nodos-lab.png` y `porte-red-nodos-banco.png`;
- `tests/aceptacion/porte-capas-apiladas-lab.png` y `porte-capas-apiladas-banco.png`;
- `tests/aceptacion/porte-skyline-lab.png` y `porte-skyline-banco.png`.

`redNodos` porta `docs/motion/lab-estructuras.html:314-331`: esfera giratoria, profundidad,
22 nodos y **cero aristas**. `capasApiladas` se contrasta con el mismo lab, lineas 198-213, y
`skyline` con `docs/motion/lab-fondos-2.html:237-251`. La ficha de `red de nodos` prometia
aristas que el lab nunca dibujo; se corrigio en el mismo commit porque el lab es la fuente que
manda.

**Recomprobacion de las capturas (02/09/2026):** los seis ficheros versionados son distintos
por contenido y por SHA-256. Se inspeccionaron las tres parejas una al lado de otra: cada
`-banco.png` contiene el pie minusculo, la barra roja y la paleta `voltaje` del banco; cada
`-lab.png` contiene la ancla versal de Anton propia del lab. La captura de `skyline` del banco se
rehizo desde `npm run banco`, a `t = 1,503 s`, y se sustituyo para eliminar cualquier ambiguedad
del informe anterior.

**`redNodos` admite un concepto.** El lab presenta siempre tres, pero la esfera de 22 nodos se
dibuja con independencia de las etiquetas (`escena.tsx`, pieza `redNodos`); las cajas son una
capa separada. No habia una decision registrada que justificara `minConceptos: 3`, asi que se
corrigio a `1`: con cero conceptos cae al respaldo; con uno o mas conserva su identidad y pinta
las etiquetas disponibles.

---

### PRECONDICION del paso que mueve COMPOSICION_VISUAL: direccion en el hash

El constructor del Visual en `src/main/index.ts` (bloque `extra`, alrededor de 4708) no escribe
`direccion`: solo `pos` y `conceptos`. La escena deriva su direccion en el renderer desde la
palabra; el hash de fichero NO ve esa direccion implicita. `direccionDe` sortea listas cuyo
tamano cambia al incorporar piezas: una misma palabra ya puede producir otro dibujo con la
misma clave. Inofensivo para el producto mientras `visual_escena` siga apagada; seria
envenenamiento silencioso al encenderla.

**La direccion resuelta debe viajar en extra y en el hash EN EL MISMO PASO que mueve el
interruptor.** No se escribe antes sobre los mapas: cambiaria sus claves para nada.
Cuando viaje, añadir una pieza invalidara los Visuales cuya direccion resuelta cambie.
ESO ES LO QUE DEBE PASAR; no implica invalidar tarjetas ni palabras cuya direccion no cambie.
Tambien siguen necesitando versionado los cambios de pixeles internos de una pieza con el
mismo id: serializar su nombre no convierte el codigo en parte del hash.

**CERRADA en `fase-4f-interruptor`.** El constructor calcula una sola vez el `value` recortado,
resuelve `direccionDe(semillaDe(value))`, guarda el resultado en `extra.direccion` y activa
`visual_escena` en el mismo cambio. Seis palabras, cada una renderizada con direccion explicita
y con la derivacion del renderer, deben dar cero pixeles distintos. `VERSION_PLANTILLAS` sigue
en 8: el cambio de `type` ya invalida los Visuales y no toca la cache de tarjetas.

### El respaldo de composiciones no respaldaba (03/09/2026)

**PREVIO al interruptor.** Medido sobre `master` `94685f2`, con `visual_mapa`, palabra
`memoria`, cero conceptos, 1080x1920, 30 fps, 1 s y sistema `voltaje`: el render produjo MP4 y
el aviso afirmo que caia a `visual_texto`, pero el DOM contenia literalmente
`Tipo no soportado` y ninguna composicion. `AnimatedGraphic` calculaba `puedeDibujar=false`,
pero despues llamaba `renderContent()` con el `type` original.

El log conserva 1.774 lineas de respaldo de mapa, pero son avisos acumulados que se vuelven a
escribir en cada clip, no 1.774 Visuales. Emparejando el ultimo aviso anterior a cada linea
`RENDER`, tomando su hash y comprobando el fichero fisico, quedan **113 MP4 sospechosos en
cuatro proyectos existentes**, correspondientes a **105 claves unicas**; ocho artefactos estan
duplicados entre proyectos. Reparto: `gwcjmqfgjtkqfgj-1787387347117` 21,
`hgfghfgh-1787528236727` 33, `kliulyh-1787527765340` 35 y
`lklkl-1787678269969` 24. Son ficheros existentes que pueden contener el cartel; no se afirma
que todos sigan colocados en un timeline exportable.

**CERRADO en el primer commit de `fase-4f-interruptor`.** Cuando una composicion rechaza los
datos, el tipo efectivo pasa a `visual_texto` antes de `renderContent`. Un tipo desconocido
deposita un aviso y tambien cae al Visual de texto: el diagnostico nunca vuelve a pintarse en el
video. `tests/graficos.js` protege las dos rutas. No se sube `VERSION_PLANTILLAS`: el arreglo se
mergea junto al cambio de `type` a `visual_escena`, que hace inalcanzables las claves antiguas;
si ambos cambios se separaran, esta decision dejaria de ser valida.

### PREGUNTA DE PRODUCTO ABIERTA: regenerar no persiste la direccion

Se acepta el re-sorteo actual. La estabilidad que importa al abrir o exportar ya existe: tras el
render, `src/main/index.ts` sustituye `graphicData` por un clip de video con su ruta, y ese MP4 se
guarda en `timelineVideoClips`. Regenerar el timeline vuelve a construir los Visuales —normalmente
porque cambio el guion— y sortea otra direccion con el catalogo vigente.

Si en el futuro se exige que una regeneracion reproduzca la direccion original, hay que
persistir `direccion` junto al MP4. Hoy `graphicData` se descarta al sustituirlo por el clip.
No se amplio el esquema del proyecto en el paso del interruptor: mezclar persistencia, hash y
activacion en el mismo cambio habria aumentado el riesgo del paso mas delicado del motor.

### El benchmark de graficos mide el respaldo, no `mapa`

**ABIERTO.** `tests/rendimiento/graficos.js` declara `extra.conceptos` como tres cadenas en su
fixture. `mapa.puedeDibujar` exige objetos con `emoji` y `etiqueta`, de modo que ese banco cae al
Visual de texto: las cifras historicas atribuidas a `visual_mapa` no miden la composicion mapa.

El control previo al interruptor uso tres conceptos validos, 1080x1920, 30 fps, 3 s/90 frames,
sistema `voltaje`, seis muestras alternadas por composicion. En regimen asentado: mapa
**4451 ms/clip, 49,46 ms/frame y 1,81 intentos/frame**; escena **3740 ms/clip, 41,56 ms/frame y
1,59 intentos/frame**, sin frames en `MAX_INTENTOS_FRAME`. No se arregla el benchmark en este
paso; queda separado porque el interruptor no debe arrastrar herramientas de rendimiento.

### Particion tipografica pendiente

`responsabilidades` puede partirse visualmente como `responsabilidade / s` por
`overflow-wrap:anywhere`. La puerta garantiza el presupuesto de dos lineas, no una particion
linguistica agradable. Se observa y no se corrige en el paso del interruptor.

### Metrica del pie: estimacion sustituida por maximos medidos (02/09/2026)

~~El estimador Archivo 800 de 0.58 em permitia garantizar 31 caracteres en dos lineas.~~
CERRADO en el commit del modulador: `tests/aceptacion/medir-tipografias.js` carga las fuentes
locales reales con la guarda de `grafico.__listo`, sin montar graficos ni acceder a la red.
El fixture `tests/aceptacion/fixtures/metricas-tipografias.json` guarda cada caracter, los
hashes de las fuentes y las condiciones: Electron 31.7.7, Chromium 126.0.6478.234, Windows,
1000 px, A-Z, vocales acentuadas, dieresis, enye, digitos y minusculas para Archivo.

Archivo 800: maximo **0.979 em (W)**, NO coincide con 0.58. Anton 400 en versal: maximo
**0.74609375 em (M)**. `maxCaracteresPie` redondea POR LINEA antes de multiplicar por dos:
**18 caracteres en Archivo y 24 en Anton**. Redondear la suma de dos lineas podia permitir
un caracter que necesitara una tercera. Las cajas conservan Archivo, `anchoCaja`,
`cabeLaEtiqueta` y el limite 56. Fuera del alfabeto medido no se afirma una garantia de ancho.

Capturas `tests/aceptacion/tipografias-archivo-anton.png` y `tipografias-limites.png`:
`visual_escena`, ondas/constelacion/quieto/media/regular, sistema voltaje, ciclo 3 s,
t=1.500 s, lienzo 1080x1920 a escala 0.45 (486x864), navegador local. La pareja usa `memoria`
en ambos lados; el degenerado usa W x 18 y M x 24. Conceptos: recuerdo/archivo/conexion.
Las dos familias pasan la guarda geometrica; las seis cajas siguen en Archivo. Dos lineas
por fuente, sin desbordamiento horizontal: anchos reales 856.44 y 870.25 px frente a 900.07
disponibles. Bordes X 111.78..968.22 y 104.87..975.13 frente a zona 89.964..990.036.
Los rectangulos tipograficos incluyen ascensos/descensos, no solo tinta: `scrollHeight`
190/211 frente a caja de 185 px NO se presenta como prueba de recorte. Se inspeccionaron
las imagenes: ambas lineas y la barra permanecen en la zona segura.

El repertorio con tipografia pasa de 12/60.450 a **24 identidades / 120.900 instancias**;
los pasos provisionales de `capasApiladas` siguen incluidos, no se han calibrado aqui.
`COMPOSICION_VISUAL = 'visual_mapa'` y `VERSION_PLANTILLAS = 8` permanecen intactos.

### Cierre del modulador: maximo conservador y tasa real de respaldo pendiente (02/09/2026)

Se conserva el maximo medido. El corpus pasa **136/136 en Archivo (tope 18)** y
**136/136 en Anton (tope 24)**, pero no establece la tasa de produccion ni una
garantia universal de composicion tipografica.

Condiciones: corpus cerrado PALABRAS de `tests/aceptacion/generar-hoja-contactos.ts`,
136 palabras reales, longitud maxima 11; comprobacion contra `cabeEnElPie` y
`maxCaracteresPie` importadas del bundle de `4fc4782`, sin render ni llamadas a API.
Ninguna palabra del corpus alcanza 12 caracteres. Por eso todas pasan: el dato no
demuestra que la puerta nunca vaya a rechazar palabras de una transcripcion real.

`value` NO procede de DeepSeek: `src/main/index.ts:4666` elige `palabraDelTramo`
sobre las palabras temporizadas de la transcripcion y `:4701` aplica
`recortarTexto`. `src/shared/texto.ts:15-28` corta a 90 y añade "…": puede devolver
91 caracteres. No hay una cota de origen menor que los topes 18/24 que haga
imposible el respaldo.

**ABIERTO, primera medicion al mover el interruptor:** tasa real de respaldo con
palabras de transcripciones reales. El respaldo ya se registra en el log
(`src/renderer/src/AnimatedGraphic.tsx:543-554`); se medira sobre una generacion
real, no inventando un corpus largo para anticiparla.

Se descarta sumar anchos reales: no aporta una mejora medible sobre este corpus.
Una herramienta se construye cuando el trabajo que ahorra ya duele. No se
implemento la suma ni se alteraron los topes.

Quedan sin medir el kerning de cadenas completas y los anchos del espacio y del
guion; tampoco se amplio la medicion al efecto de `letter-spacing`. No se
persiguen en este paso por falta de beneficio medido, y NO se afirma que solo
puedan provocar rechazos de mas. En el CSS actual del pie no se declara
`letter-spacing`; el `.01em` pertenece a `.es-etq`, las etiquetas, no al pie.

`overflow-wrap:anywhere` permite partir la palabra de `.es-pie-tit`, pero NO
impone dos lineas. La puerta responde de ese presupuesto; quitar la propiedad
desconectaria la aritmetica del dibujo. Su advertencia queda junto al CSS.

**Regla:** Cuando se cierra una deuda, se tacha en el MISMO commit que la cierra.

### Excepcion al atomo compartido: heroe de constelacion (02/09/2026)

Las cuatro estructuras de `src/renderer/src/composiciones/escena.tsx` llaman a `caja()`
para las etiquetas: constelacion, capasApiladas, redNodos y unaCaja (pieza de prueba).
El emoji grande de constelacion se inserta directamente en `.es-hero`, no mediante `caja()`.
Es una excepcion EXISTENTE a la nueva regla, no una caja duplicada. Pendiente unificar el
atomo cuando se cambie el heroe por icono/silueta: no se altera su geometria en este cierre.

### Solape recorte-camara: estructura contra pie (03/09/2026)

**ANOTADO, SIN URGENCIA.** `acotarPuntos` (`src/shared/escena.ts:713-730`) recorta el borde
inferior de cada caja contra la posicion ESTATICA del pie (`presupuestoTexto`), pero la camara
mueve estructura y pie a profundidades distintas: 0.50 y 0.20 respectivamente
(`PROFUNDIDAD`, `src/shared/escena.ts:674-680`). El recorte no reserva margen para esa deriva
relativa.

Condiciones de la medicion: camara `deriva`, ciclo de 3 s, `t = 2.999 s`, lienzo 1080x1920,
estructura frente a texto. La estructura puede derivar 16.2 px y el pie 6.48 px; la deriva
relativa maxima hacia abajo es **9.72 px**. Se reprodujo en el banco con zona segura visible,
en `constelacion` y `redNodos`. Por ello el alcance es la interaccion generica recorte-camara,
no las coordenadas crudas de una pieza concreta.

No se arregla aqui y no bloquea 3b. Antes de cerrar una Fase 4 que anada camaras de energia
mayor o igual que 2, revisar este margen: justo entonces puede crecer la deriva.

### Sin `generationId` estable en `generate-timeline-assets` (03/09/2026)

**ANOTADO, SIN URGENCIA.** Existe un identificador de proyecto, creado como
`slugify(nombre)-Date.now()` (`src/main/index.ts:649`) y capturado por los lotes mediante
`activeProjectPath` (`src/main/index.ts:1552`). Sin embargo,
`generate-timeline-assets` (`src/main/index.ts:3783`) no recibe ni `projectId` ni un
`generationId` estable.

Esto bloquea la regla decidida para `texto.acento` y, a futuro, para la paleta de Fase 8:
fijarlos POR VIDEO y no por subclip exige que los subclips del mismo video compartan una
identidad estable de generacion. Condicion confirmada: `sistema` si entra hoy en
`hashGrafico` (`src/main/index.ts:1136`), asi que una paleta distinta invalida correctamente
los Visuales de ese video.

No se arregla aqui y no bloquea 3b ni Fase 4. Es relevante para quien abra Fase 8.
