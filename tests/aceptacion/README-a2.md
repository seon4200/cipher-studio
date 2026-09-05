# A.2: cota real de cajas, conteo e aislamiento

No hace llamadas a proveedores. El medidor usa grafico.html compilado y la guarda
__listo del proyecto; no FFmpeg. Importa la aritmetica del bundle en un proceso
que termina antes de app.ready. Los PNG son capturas del renderer real, no otro
dibujo. Requiere el build y Electron instalados.

Desde la raiz del repo (PowerShell; destino fuera del repo):
```powershell
node node_modules/electron/cli.js tests/aceptacion/medir-cajas-a2.cjs . "$env:TEMP/cipher-a2-medicion"
node node_modules/electron/cli.js tests/aceptacion/medir-cajas-a2.cjs . "$env:TEMP/cipher-a2-negativo" --cota-rota
node node_modules/electron/cli.js tests/aceptacion/desglosar-instancias-a2.cjs . "$env:TEMP/cipher-a2-conteo.json"
node tests/aceptacion/auditar-cache-a2.cjs . "$env:TEMP/cipher-a2-cache"
```

La segunda orden DEBE salir 1: cambia la cota a 0,58 em SOLO en el proceso lector.
No edita fuente ni bundle y no contamina la siguiente ejecucion.

La ultima orden SI renderiza seis clips LOCALES del arnes M7 existente, con red
bloqueada y proyecto/userData/cwd temporales. Se usa para demostrar el aislamiento;
no mide anchos ni pertenece a npm test. Conserva auditoria.json completo y
resumen.json compacto, con hashes de los inventarios. Una notificacion durante
la vigilancia o un cambio de fichero da rojo; no se ignora como ruido.

## Que se mide

Archivo 700 real y con su espaciado. 111 caracteres: ASCII imprimible mas acentos
castellanos, diaeresis, eñe y signos de apertura. Maximo @=1,001015625 em,
redondeado por arriba a 1,002. No se extrapola esta metrica a otra familia.
La tabla guarda el asset SHA-256. La suite contrasta registro/fixture/asset:
no depende de volver a medir fuentes con otra version de Chromium.

La ranura del emoji, gap, borde, padding y tamaño de etiqueta se comparten entre
CSS y anchoCaja. La etiqueta desactiva kerning/ligaduras. Se comprueban 111 cajas
de 24 caracteres y casos manuales, sobre DOM real, contra la funcion del bundle.
Las otras escrituras caen al respaldo: no se finge conocer su ancho.

Los degenerados se vuelven a montar por la entrada REAL, sin sustituir parametros
ni eludir puedeDibujar: cero conceptos, uno, 56 W, 25 @, 24 @ y texto no medido.
Cada captura lleva su graphicData en medidas.json; los avisos se limpian por caso.

La hoja compuesta coloca los PNG originales al 45%, 486x864 por celda. Los PNG
individuales son 1080x1920, sin la sonda de 8 px. No es una medida de variedad.

## Lo que NO prueba

No demuestra ausencia de solapes entre cajas: 24 @ toca archivo y se conserva
asi en la evidencia. Tampoco cierra M3 con camaras: esta medida usa quieto.
No establece tasa de respaldo de produccion: 4/6 casos son rechazos deliberados.
No es un modelo universal Unicode ni una cota para diez fuentes inexistentes.
La metrica es CODIGO: no entra sola en extra ni en hashGrafico. Durante A–E
solo se dibuja con destinos temporales. La subida 8→9 del mismo merge final
invalida estos pixeles; volver a cambiar una metrica ya publicada exige otra
invalidacion deliberada. No basta regenerar el JSON para cambiar la clave.


Para añadir una metrica: empaquetar/cargar/verificar la cara, medirla con su
peso/espaciado/transformacion REALES, guardar su fixture, registrar una cota propia
y ejercitar su borde. No copiar el numero de Archivo. La tipografia del pie
sigue separada de la fuente de las etiquetas.

## Incidentes conservados

La primera auditoria mezclaba vigilancia e inventario: dos eventos, hashes y
mtimes iguales. Se separaron las fases; no se atribuyo el evento al motor.
La primera importacion del bundle tras ready abrio la app: se detuvo. Ahora el
lector sale antes de ready y fetch esta bloqueado.
CDP no produjo la captura del grafico dentro del watchdog; se usa offscreen.
Una captura sin espera estaba atrasada respecto al DOM. Se retiro y se añadieron
dos rAF, invalidacion y 100 ms, y se miraron los PNG. No convertir esa espera en
garantia general de captura: el renderer de video sigue usando su propio lazo.
