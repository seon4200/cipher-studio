# Pruebas de aceptación

Dos arneses que ejecutan el **handler real** `generate-timeline-assets` de principio a fin, con
las respuestas de DeepSeek interceptadas.

No son suites de `npm test` y no deben serlo todavía: cada una necesita Electron, un vídeo de
entrada y varios minutos, mientras que las suites del conjunto tardan segundos. Convertirlas es
otra conversación. Que **existan y sean repetibles por cualquiera** es esta.

## Por qué están aquí y no en el scratchpad de alguien

Estos dos arneses cazaron **tres defectos que ninguna suite habría visto**, porque ninguna suite
ejecuta el handler:

1. El resumen decía «Todo cuadra» sobre una generación **fallida** — de ahí salió el campo
   `completa`.
2. Faltaba el **sexto motivo** de respaldo: la causa principal del 25/8 no estaba en ninguno de
   los cinco puntos de *fallback*, sino antes, en el reparto.
3. Un bug de **orden**: la anotación de degradación corría antes de la asignación de Visuales y
   marcaba clips que después se promovían, produciendo un «−3» fantasma.

Hasta este commit vivían en un directorio temporal fuera del repositorio. Una prueba que sólo
una persona puede correr no es una prueba.

## Cómo se corren

Hace falta el bundle compilado; los arneses importan de `dist-electron/main/index.js` y **no
reimplementan nada** del proyecto.

```bash
npm run build
```

```bash
npx electron tests/aceptacion/25-agosto.js
```

```bash
npx electron tests/aceptacion/degenerados.js
```

Salen con **0** si todo pasa y con **1** si algo falla, así que se pueden encadenar.

### El vídeo de entrada

Si no se le da ninguno, cada arnés genera uno sintético con `ffmpeg` en el directorio temporal
del sistema, la primera vez (unos segundos). Para usar otro:

```bash
CIPHER_VIDEO=/ruta/a/tu/video.mp4 npx electron tests/aceptacion/25-agosto.js
```

El fixture es sintético a propósito: lo que estos arneses miden es el **contable** —objetivo
contra real por origen— y para eso da igual lo que se vea. Un vídeo de verdad los haría más
lentos y menos repetibles sin probar nada más.

## No cuestan dinero

`fetch` está interceptado: ninguna llamada a `api.deepseek.com` sale a la red, y el reparto va
con IA a 0, así que tampoco se toca fal.ai. `25-agosto.js` imprime cuántas llamadas interceptó
para que se pueda comprobar en cada tirada.

---

## `25-agosto.js` — el incidente

Reproduce el 25 de agosto de 2025: DeepSeek devolvió **402 por saldo agotado** cinco veces, se
perdieron 21 clips de stock y 10 Visuales, y la app dijo «éxito, 78 de 78». Era verdad —salieron
78 clips— pero 31 se habían degradado en silencio.

Imprime **literalmente** lo que el canal `generation-aviso` manda a la ventana, pintado como lo
pintaría la interfaz. La salida esperada, hoy:

```
  [ ERROR ]  DeepSeek rechazó la petición por saldo agotado. Sin él no hay palabras clave,…  (x5)

  Resumen de la generación: 57 clips.
    original: se pidieron 28 y salieron 28
    stock: se pidieron 11 y salieron 0  (-11)
    IA: se pidieron 0 y salieron 0
    Visual: se pidieron 18 y salieron 18
  11 clips no salieron como se pidió y se rellenaron con otra cosa:
    11 — clips de stock que se quedaron sin palabra clave y se dejaron como vídeo original
  El vídeo NO salió como se pidió. Revisa los avisos de arriba antes de exportar.
```

Comprueba, y falla si no se cumple: que el 402 produce un aviso de error; que los cinco fallos
se agregan en **una** línea; que llega resumen; que el resumen **no** dice que cuadra; y que los
Visuales salen los que se pidieron —esto último es la regresión del bug de orden.

## `degenerados.js` — los tres casos que el camino feliz no prueba

- **A) Cero fallos** → el resumen sale igual y dice que todo cuadró. Un resumen que sólo apareciera
  cuando hay problemas entrena a no leerlo, y el día que aparezca tampoco se lee.
- **B) La generación aborta** → el resumen sale igual, con lo que haya, y dice que **no** terminó.
  Por eso va en un `finally`. Aquí se ve por qué hizo falta `completa`: sin él, cero pedidos
  contra cero salidos empata en todas las filas y el resumen diría «todo cuadra» sobre una
  generación fallida.
- **C) La ventana cerrada al emitir** → `send` sobre un `webContents` destruido revienta de verdad;
  el emisor se traga la excepción y el aviso no se pierde en silencio porque el log lo tiene igual.

## Lo que esto todavía NO cubre

El bug de **orden** del punto 3 es de orden *dentro del handler*. Lo caza `25-agosto.js`, que es
una prueba **manual**: hay que acordarse de correrla. No hay ninguna suite de `npm test` que
ejecute `generate-timeline-assets`, así que si alguien mueve esas líneas otra vez, el conjunto
sigue verde. Está anotado en `docs/deuda-graficos.md`.
