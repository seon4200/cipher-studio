# A.3: cajas contra cajas, no solo contra encuadre

Procedencia: 4c3c060 más cambios A.3/T8; bundles y arneses identificados por
SHA-256 en corpus-posiciones.json y solapes.json. Fuente Archivo 700: SHA en
plan-a3-mas20-20260905/medidas.json. Windows x64, Electron 31.7.7,
Chromium 126.0.6478.234. Esta evidencia queda incorporada en el commit A.3.

## Reproducir desde el checkout compilado

```powershell
node node_modules/electron/cli.js tests/aceptacion/preparar-solapes-a3.cjs . C:/temporal/a3
node node_modules/electron/cli.js tests/aceptacion/medir-solapes-a3.cjs . C:/temporal/a3
node node_modules/electron/cli.js tests/aceptacion/medir-tamanos-a3.cjs . C:/temporal/a3-tamano --aplicado
```

El primer arnés usa el proyecto original si existe; si no, su extracto versionado
de transcripción, SIN configuración ni credenciales. Las 114 frases registradas
coinciden con 47 segmentos; 107 grupos saneados contienen las 321 etiquetas.
No son 107 Visuales históricos: son contenido anterior al reparto, aquí forzado
a Visual para comparar cada grupo consigo mismo. No se extrapola tasa de vídeo.
El callback conPalabra, recortarTexto y su constante se extraen mediante AST del
bundle real; palabraDelTramo/direccionDe/semillaDe se importan del mismo bundle.
No se copia la selección de intervalos ni la derivación de posiciones.

El segundo monta grafico.html REAL a 1080x1920, ciclo 3 s, sistema voltaje.
Cada grupo conserva palabra, conceptos y dirección en los tres tamaños.
Base 2.9 cqmin, +20% 3.48, +35% 3.915: se cambia un solo literal en COPIAS
temporales del bundle; CSS y layout consumen juntos ese registro. No se usa
un override CSS desacoplado de la reserva de ancho. Con +20 aplicado, la copia
+20 conserva el SHA del chunk original: no hay sustitución efectiva.

91 instantes por grupo: los 90 frames a 30 fps y 2.999 s adicional. Son
29.211 evaluaciones DOM, no vídeos renderizados. No certifica el continuo entre
frames. Se excluyen cajas con opacidad ancestral cero. Los pares son AABB del
DOM: área de intersección / área de la caja menor. Las esquinas redondeadas
pueden hacer menor el área realmente pintada. Para texto se intersecta el span
anterior contra la caja posterior en orden DOM: NO es una máscara de glifos.
Aquí ninguna intersección llega al rectángulo de texto; el PNG se inspeccionó.

Resultado repetido antes/después de T8: base 0/107; +20 0/107; +35 1/107.
Texto intersectado: cero en los tres. Peor par: regular, corazón/estetoscopio,
tunel/constelacion/deriva/media/regular/anton; 26.282118 px², 0.0966851% de la
caja menor, máximo en t=2.999. Se elige +20 por NO añadir ese solape.
El control extremo responsabilidades/archivo de la hoja aún se pisa: no pertenece
a las 321 y no se declara resuelta la vecindad en general. Eso sigue abierto.

Sin API, FFmpeg ni caché de producción: perfiles/dist temporales y red bloqueada.
Watchdog 600 s y salida roja por excepciones. Se evita autoquit entre ventanas:
una ejecución inicial incompleta no se contó como sondeo de los tres tamaños.
Los arneses se copiaron sin cambios semánticos; LF/CRLF explica sus SHA distintos
del borrador. La reproducción desde clon usa los ficheros versionados.

## Control adicional que retira +20% — y tamaño definitivo +7%

El párrafo anterior es histórico: el control de 17 NO se puede apartar por no
pertenecer a las 321. A mismo memoria/ondas/constelacion/quieto/media/regular/
archivo, conceptos responsabilidades/archivo/conexion con sus emojis, ciclo 3 s,
91 instantes y la misma fuente: base 0; +10 3.852517%; +15 13.026209%;
+20 21.832589%; +35 47.584879% de la caja menor. Desde +15 llega al span de texto;
el PNG de +20 muestra letras tapadas. Son medidas de UN control, no tasas de vídeo.
Barrido fino: +5 y +7 no intersectan; +8 0.0619322%; +9 1.9527554%.
Resolución final: un punto porcentual, techo entre +7 y +8, NO 41.4.
Los 107 grupos a +7 se midieron además completos: 0 pares/0 texto, sin mezcla
con ese control. Este es el mayor incremento ENTERO comprobado que pasa ambos.

```powershell
node tests/aceptacion/preparar-control17-a3.cjs . C:/temporal/a3-control
node node_modules/electron/cli.js tests/aceptacion/medir-solapes-a3.cjs . C:/temporal/a3-control --subidas=0,5,7,8,9,10,15,20,35
node node_modules/electron/cli.js tests/aceptacion/medir-solapes-a3.cjs . C:/temporal/a3 --subidas=7
```

Fuentes: plan-a3-control17-20260905 (los dos barridos), plan-a3-pares7-20260905,
plan-a3-mas7-20260905. Se conservan los resultados previos, no se reescriben.
La coincidencia log/transcripción comprobada son los PREFIJOS de 80 caracteres
que el log conserva, por índice; no se afirmó igualdad de texto que no guardó.
La primera hoja +7 salió incompleta al componer PNG completos; se descartó y
repitió en proceso nuevo. Esto es otra inspección de L9, no una guarda de completitud.
