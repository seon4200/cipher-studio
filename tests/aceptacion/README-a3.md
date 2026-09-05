# A.3 — tamaño de etiquetas sobre contenido real

## Corrección de cierre — 05/09/2026

**Rectificación posterior: +7%, NO +20.** El control de 17 añadió solape a +20.
La evidencia actual es plan-a3-mas7-20260905/medidas.json; las hojas +20/+35
se conservan como decisiones retiradas. Ver README-solapes-a3.md.

+35% queda DESCARTADO por la comparación entre vecinos. El tamaño elegido es
+20% (3.48 cqmin); evidencia aplicada en plan-a3-mas20-20260905/medidas.json.
Ver README-solapes-a3.md para el corpus reconstruido, el barrido temporal y T8.
La hoja +35 y el control causal de mapa siguientes se conservan como historia:
el control describe el árbol ACOPLADO anterior a T8; ya no debe esperarse rojo.

Procedencia: código de partida **4c3c060** en plan-A-cajas; único cambio de
producción medido: fuenteCqmin 2.9 -> 3.915 en metricas-caja.ts. Cada JSON guarda
el commit de partida y los SHA-256 de fuente, código de métrica, arnés, fixture
y bundle. El cambio queda SIN COMMIT: npm test dio 8/9, no se cierra A.3.
La metrica comun aumenta tambien la reserva de mapa, cuyo CSS sigue en 2.9cqw.
El detalle y las citas estan en deuda-graficos.md, entrada A.3.

Control causal del bloqueo, sobre ese mismo checkout compilado:

```powershell
node node_modules/electron/cli.js tests/aceptacion/control-mapa-a3.cjs . 2.9
node node_modules/electron/cli.js tests/aceptacion/control-mapa-a3.cjs . 3.915
```

Se espera exit 0 con 2.9 y exit 1 con 3.915. Importa y ejecuta tests/mapa.js,
no copia sus aserciones ni modifica ficheros. No sirve para dar verde a A.3:

Población: **321 etiquetas / 107 sub-clips** de la generación real de
03/09/2026 02:37:47.705–02:43:02.489 UTC. Fixture versionado en
plan-a2-impacto-20260905/etiquetas.json (incorporado por 4c3c060).
No son 107 Visuales: son los grupos válidos antes del reparto.
El corte del log es 24; si alguna etiqueta llega a él, este arnés falla por
censura. No extrapola esta generación al idioma ni a otros vídeos.

## Repetir

Compilar primero el checkout que se quiere medir. Desde su raíz, sin abrir la app:

```powershell
node node_modules/electron/cli.js tests/aceptacion/medir-tamanos-a3.cjs . C:/ruta-temporal/a3-sondeo
node node_modules/electron/cli.js tests/aceptacion/medir-tamanos-a3.cjs . C:/ruta-temporal/a3-aplicado --aplicado
```

El primer modo es un **sondeo**: varía la métrica del bundle en un proceso puro
(restaurándola en finally) y el font-size del elemento real en una ventana
offscreen. NO se presenta como cuatro builds de producción.
Importa anchoCaja/cabeLaEtiqueta y constantes del bundle: no reimplementa el
modelo. Recorre la puerta con textos crecientes y mide las cajas en el DOM con
la fuente REAL cargada por __listo. Confronta los límites enteros de ambos.
La cota y el intervalo no son mediciones de desplazamiento observado: son el
espacio de colocación reservado por el modelo real del layout.

El segundo modo NO sustituye ni CSS ni registro: comprueba el tamaño compilado,
las etiquetas reales, los caracteres en la frontera, la referencia de 17 y
el siguiente carácter. Captura la composición real mediante __montar/__setT.
La hoja junta esos PNG; no vuelve a dibujar ni derivar las escenas.

Condiciones: visual_escena, 1080x1920, memoria, ondas/constelacion/quieto/media/
regular/archivo, voltaje, t=2.999 s, ciclo 3 s, Archivo 700, kerning y ligaduras
desactivados, letter-spacing .01em. Electron 31.7.7 / Chromium 126.0.6478.234,
Windows x64. La hoja muestra cada captura al 45%. Los otros conceptos son
archivo y conexion, con sus emojis. GraphicData exacto y DOM en aplicado.json.
No llama a FFmpeg, proveedores ni cache de gráficos: perfil/cwd temporales,
fetch prohibido y HTTP(S)/WS bloqueados en la ventana.

## Evidencia conservada

- sondeo.json: baseline y +20/+35/+50, caja DOM y puerta del bundle.
- aplicado.json: +35 compilado sin sustituciones; capturas y avisos reales.
- referencia-17.png, limite.png, limite-mas-uno.png: lienzo completo.
- hoja-a3-etiquetas-mas35.png: artefacto inspeccionado, no certificado de completitud.

La comparación final contra el sondeo conservó todos los límites, intervalos
y recuentos. +35 admite 17, NO 17.8 caracteres: la frontera se encuentra entre
17 @ (864.390625 px reales) y 18 @ (907.140625), con zona 900.072 px.
La cota para 17 reserva 865.659528: quedan 34.412472 px de intervalo.
Ese es margen positivo, **no otro carácter entero**. +50 rechaza la referencia.
La distribución real (nearest-rank, repeticiones incluidas) es 6/10/12/15
(mediana/p90/p99/máximo), no un corpus cuyo techo sea 17.

Los solapes entre vecinos siguen siendo deuda de B. Mirar los PNG tras dos rAF,
invalidación y 150 ms NO demuestra completitud del compositor (L9).
Incidente: un intento sobre el clon A.2 consumido falló por no tener el fixture
de impacto; quedó abierto y se terminó ese proceso. Se añadió salida roja
también para excepciones previas a ready. Repetido el fixture ausente: exit 1
en 0.43 s, sin dejar proceso. La medición buena usa el árbol que sí lo versiona.
El sondeo emitió dos mensajes GPU state invalid al desmontar, con exit 0;
no se ocultan ni se atribuyen a los tamaños.

test:ciclo contrasta registro y SHA de fuente con aplicado.json estático; NO
vuelve a medir fuentes en la suite. Los datos históricos A.2 no se sobrescriben.
A.3 es intrarrama; no cierra la fase A ni sustituye su futura verificación desde
clon NUEVO.
