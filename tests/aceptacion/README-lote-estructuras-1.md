# Lote de estructuras 1 — inspeccion, no activacion

Base: master `8f7004c`. `lineaTiempo`, `corteTransversal` y `partidoVertical`
entran con `prueba: true`, fuera del sorteo. No se cambian fuentes, tamanos,
aritmetica de caja, camaras ni el interruptor.

## Repetir la hoja

Desde la raiz: `npm ci`, `npm run banco`; abrir
`http://127.0.0.1:5174/banco.html?vista=lote`.
Tambien se llega desde el selector Vista del banco. Esperar el aviso verde de
fuentes (comparacion de anchuras, no solo fonts.check). Capturar la pagina completa
sin reducir zoom: `lote-estructuras-1-45pct.png`. Hay desplazamiento horizontal
si la ventana mide menos de 1584 px: no se encoge la escala para hacerla caber.

Condiciones versionadas en `fixtures/lote-estructuras-1.json`: memoria; conceptos
recuerdo/archivo/conexion con sus emojis; ondas, quieto, media, regular, Archivo;
voltaje; ciclo 3 s, t dirigido 2.700 s; lienzo 1080x1920 y escala 0.45
(486x864 por escena). La fila superior es repertorio; la inferior, el lote.
Se monta AnimatedGraphic, igual que el banco individual. No se encoda video.
Las tres familias locales se verificaron; los emojis siguen siendo del sistema.

## Procedencia y adaptaciones visibles

- lineaTiempo: `docs/motion/lab-estructuras.html:297-312`, sucesion sobre un eje.
- corteTransversal: `docs/motion/lab-estructuras.html:284-295`, estratos frontales.
- partidoVertical: `docs/motion/lab-estructuras-2.html:145-163`, campos opuestos.

Se miraron los labs, no se uso constelacion como plantilla. Se conservan eje e
hitos, bandas que entran en horizontal y corte vertical al 52%, respectivamente.
Los campos se limitan a la zona de estructura para reservar el pie. La paleta y
el pie son los del sistema; TODAS las etiquetas usan caja(). No se portan las
fuentes particulares ni el titulo central del segundo lab. Por tanto es un porte
de geometria al contrato actual, no una replica pixel a pixel de esos HTML.
Sin rangos nuevos: no hay escalones perceptivos calibrados que multiplicar.

## Evidencia del 04/09/2026

Banco local de Codex en Windows; medidas DOM divididas por la escala declarada.
Las seis escenas miden 486x864 CSS px. Reglas @keyframes por celda, en orden del
fixture: 24, 23, 42, 21, 23, 21 (154 total). El t de todas es el mismo.
Con la palabra/conceptos del fixture, el borde inferior de las cajas nuevas cae
en 1271.74 / 1233.34 / 1175.74 px; el pie empieza en 1390.34 px. No se solapan.
Un concepto: puerta true y una caja en las tres nuevas. Cero: puerta false y
cero cajas. No se ha corregido el solape recorte-camara de las piezas existentes.

Inventario desde el bundle: repertorio {identidades:36,instancias:166470},
sin cambio. Incluyendo pruebas: antes {identidades:104,instancias:449280};
despues {identidades:182,instancias:452160}. El contador incluye tipografia,
sexto eje con dos opciones. No es directamente el techo de cinco ejes del plan.
Otra discrepancia existente: el plan-maestro (tabla de energia, linea 172) pone
deriva en energia 1; CAMARAS.deriva declara 2. El recuento anterior es el del
codigo, no una extrapolacion del techo teorico. No se cambia esa energia aqui.

## Limite encontrado: el modelo NO garantiza el borde real

No confundir las aserciones aritmeticas de test:ciclo con mediciones del DOM.
En el banco individual, memoria, ondas, quieto, Archivo, voltaje, t=2.999 s,
con la primera etiqueta formada por 56 W y las otras archivo/conexion:
cabeLaEtiqueta acepta, pero la caja mide 1845.42 px nativos. La zona disponible
es 900.07 px. El modelo anchoCaja devuelve 82.572% (891.78 px), aproximadamente
la mitad. Se reprodujo tambien en constelacion, cuyo emisor no cambia en este lote:
bordes -386.87 y 1458.55 px. Captura `limite-etiqueta-56w-previo.png` (banco al 36%).

Es un caso adverso sintetico, NO una tasa de incidencia en transcripciones.
La puerta cuenta caracteres y el modelo lineal no cubre todos los glifos.
No se arregla aqui: el prompt prohibe tocar anchoCaja/altoCaja/tamanos.
El lote queda para revision, no con una promesa de seguridad universal.
Para repetir: vista individual, constelacion, camara quieto, tiempo posicionar
2.999, primera etiqueta `W` repetida 56 veces; medir `.es-caja` respecto al
lienzo y dividir por .36. La captura muestra la puerta true junto al desborde.
