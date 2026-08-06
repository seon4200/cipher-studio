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

## Lo que hay que medir para saber si ya está pasando

**La medición correcta es sobre los gráficos, no sobre los clips de vídeo:** cuántos tienen
`graphicEnd − graphicStart < 1.5` en un proyecto real. Ese es el número que decide si el
`contador` ya se está grabando con datos falsos o si de momento es teórico.

Contar clips cortos del timeline **no sirve**, y creerlo fue consecuencia de leer mal el
respaldo de la sección anterior: la duración del clip de vídeo no entra en la del gráfico.

Todavía no se puede medir: en `proyectos/` solo queda un proyecto, con un único clip de
199.25 s sin cortar y ningún gráfico. Los 44 proyectos que midió el plan ya no están en disco.
**Se mide en cuanto se vuelvan a generar gráficos en un proyecto de verdad.**
