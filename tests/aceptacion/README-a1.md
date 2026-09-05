# A.1 — reglas emitidas y energia de deriva

## Repetir

En el repositorio compilado, abrir `npm run banco`. En otra terminal:

```powershell
node node_modules/electron/cli.js tests/aceptacion/medir-a1.cjs . C:\graphify\a1-otra-medicion
```

Usar una carpeta de salida nueva. El arnes carga el banco real, permite solo
su servidor local, espera SU aviso fiable de fuentes y guarda JSON + PNG.
No llama a renderGraphicClip, FFmpeg ni APIs. Para las funciones puras importa
el bundle compilado: no copia transform ni combinacionesLegales.

## Condiciones y resultados (04/09/2026)

Arbol base: A.0 `d0dae0d`; cambios A.1 en `plan-A-cajas`.
Fixture: `fixtures/lote-estructuras-1.json`; palabra memoria; conceptos
recuerdo / archivo / conexion con los emojis del fixture. Fondo ondas,
camara quieto, densidad media, ritmo regular, Archivo, sistema voltaje.
Seis estructuras; lienzo 1080x1920, escala 0,45 (486x864), ciclo 3 s,
t dirigido 2,7 s; viewport 1620x2400, DPR 1. Electron 31.7.7 / Chromium 126,
Windows x64. Archivo, Anton y Outfit verificadas por el aviso geometrico del banco.

Evidencia final: `plan-a1-20260904/resultado.json` y su PNG de hoja completa.
Las ramas/source y el bundle se identifican por hashes en el JSON; el commit
anotado es el HEAD previo al commit A.1, pues se midio el cambio aplicado.

### Las 154 reglas, termino a termino

Fuente: `src/renderer/src/composiciones/escena.tsx`.
Comunes por casilla: ondas 11 (lineas 158-169), decoradores 5 (467-476),
pie 1 (483-487), quieto 0 (510-514): **17**.

| estructura | propias, segun las llamadas kf | esperado | CSS real |
|---|---|---:|---:|
| constelacion | 3 nodos + 3 aristas + 1 heroe (256,267,282) | 24 | 24 |
| capasApiladas | 3 planos + 3 etiquetas (299,308) | 23 | 23 |
| redNodos | 22 nodos + 3 cajas (337,354) | 42 | 42 |
| lineaTiempo | 1 eje + 3 cajas (371,379) | 21 | 21 |
| corteTransversal | 3 bandas + 3 cajas (402,407) | 23 | 23 |
| partidoVertical | 1 corte + 3 cajas (429,433) | 21 | 21 |
| total | 6x17 + 52 propias | **154** | **154** |

Cero referencias sin regla. Cero colisiones de nombre con CSS distinto en ESTA
hoja; no es una prueba universal de aislamiento de keyframes entre identidades.

### Deriva: energia 1

Referencia aprobada: `docs/motion/lab-camara-2.html:90-91`. Una vuelta suave,
sin rotacion, zoom constante, no un acercamiento que crezca con el tiempo.
La envolvente contractual medida llama al transform del bundle en 401 tiempos
u=i/400, f=1 y parametros en su limite declarado (no es una palabra/instancia
fabricada para el banco): +/-43,2 px X, +/-32,4 px Y, escala constante 1,06.
La estructura recibe f=0,50: +/-21,6 y +/-16,2 px; el pie f=0,20: +/-8,64 y
+/-6,48 px. Los limites de los rangos y la transformacion NO se cambiaron.
El lab da +/-32,4 y +/-20,52 px; travelling, tambien energia 1 en el plan,
llega a +/-70,2 px X (`lab-camara-2.html:108-109`). Se clasifica deriva como
movimiento bajo, no como energia 2. Es una decision apoyada en recorrido y
tipo de movimiento, no un umbral psicofisico validado.

Catalogo completo de cinco ejes, proyeccion segun `docs/plan-maestro.md:169-174`:
energia 1 -> 163 pares fondo/camara -> 69.275; energia 2 -> 151 -> 64.175.
No incluye tipografia. No son piezas ya implementadas ni variedad percibida.

Bundle actual, tras energia 1: 48 identidades / 3.782.310 instancias nominales.
Incluyendo pruebas: 210 / 4.114.656. Antes: 36 / 166.470 y 182 / 452.160.
No se amplian rangos; los pasos provisionales siguen sin certificar percepcion.

### Limite del contador: pendiente de C.4

La regla de energia solo filtra combinacionesLegales; direccionDe no la
consulta, direccionDesde valida ids y puedeDibujar valida texto/conceptos.
Antes de reclasificar deriva, 40/136 palabras del corpus versionado sorteaban
pares que sumaban 4. Despues: 0/136 (todas las parejas actuales caben).
Es un cambio de clasificacion, NO dibujos nuevos. Al crecer el catalogo, C.4
debe comprobar tambien el sorteo real: un contador correcto no lo demuestra.
El JSON previo se conserva en `plan-a1-20260904/antes-energia.json`.

### Incidencias del instrumento, no ocultadas

La primera medicion mezclo banco de fuentes actuales y bundle local atrasado:
se descartan sus cifras de combinaciones; se recompilo y se anadio la guarda
que exige las seis estructuras del fixture en el bundle. La primera captura
quedo recortada por la ventana de Windows. Al ampliar via protocolo de Chromium
ANTES de loadURL, dos ejecuciones terminaron con -36861 y crashpad not connected,
sin resultados. Conectar DESPUES de cargar dio las dos mediciones completas
(antes/despues de energia). No se atribuye ese fallo al motor de captura.

A.0 ya verifico el lote desde clon nuevo sin node_modules padre; no se repite
esa verificacion para fingir un clon nuevo. El cierre de la Fase A requerira
otro clon. A.1 no cierra la Fase A ni arregla las cajas: siguen A.2-A.5.
