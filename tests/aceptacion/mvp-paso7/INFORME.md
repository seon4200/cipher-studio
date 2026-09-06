# Paso 7 — entrega e incidencias

Medido el 05/09/2026, hora de Bogotá (algunas evidencias llevan 06/09 en UTC). Windows 10.0.26200, AMD Ryzen AI 9 365 / Radeon 880M, 20 procesadores lógicos, 27,61 GiB de RAM. Código de producción: `1f1a6cb9ecf4871110554f7922b02c5b3aad0fec`. La cobertura y las guardias adicionales viven en el commit que contiene este informe. No se ha hecho push.

## Entrega

- Master anterior: `d0dae0dbcd95f9cbcc372c2917bee1f3c8b1b382`.
- Merge: `d4e11ceee15d62920ab0aa1429a9ea79632d0b5b`; segundo padre `dd5a5b3ba32c7427b042cfb578f26ede1356241b` (`plan-A-cajas`). Sin conflictos.
- `--no-ff --no-commit`: VERSION_PLANTILLAS pasó de 8 a 9 **dentro del merge**, no después (`src/main/index.ts:1069`). Invalida también las tarjetas sin cambios, coste aceptado. No hubo commit de producción con píxeles nuevos y versión 8.
- Mix: Original **24**, Stock **18**, IA **18**, Visuales **40**. Commit `1f1a6cb`. Los tres primeros conservan la proporción 4:3:3. El 40% deja margen respecto a veinte Visuales en este proyecto de 114 posiciones: objetivo 46, resultado 42. No garantiza veinte en un vídeo arbitrariamente corto.
- Se cambió el valor compartido (`src/shared/reparto.ts:63`), sus consumidores de inicio/creación y el estado del proyecto utilizado. Premisa corregida: había más de un valor anterior; el proyecto elegido tenía 22/30/0/48 y el constructor de proyectos 40/30/20/10, no un único 40/30/30/0.
- Se reconstruyó antes de generar. El aviso de tres líneas «ya se puede usar» se envió al terminar el bloque A, antes de la verificación B.

## Vídeo de producción, no simulación

Proyecto existente: `C:\Proyectos\mi-app\cipher-studio\proyectos\video-3-1788402898964` (`video 3`). Se reutilizaron su guion, sus 47 segmentos de transcripción, su fuente y la voz `materiales/audio/maestro.m4a` (285,955 s). No se inventó contenido.

Salida para que Jairo la vea entera:

`C:\Proyectos\mi-app\cipher-studio\proyectos\video-3-1788402898964\mvp-paso7\cipher-mvp-1788651762739.mp4`

74.621.552 bytes; H.264, 1080×1920, 30 fps, 8.578 frames, 285,922 s de vídeo y audio AAC. Generación y exportación por los handlers reales, APIs y caché de producción. El arnés solo sustituye el diálogo de destino por una ruta nueva. El estado anterior queda respaldado en `mvp-paso7/estado-antes-*.json`, y el timeline nuevo es una versión adicional del proyecto.

**42 Visuales, 41 palabras distintas, 41 direcciones distintas.** Los 42 hashes reconstruidos desde palabra/conceptos/dirección/duración/sistema coinciden con los nombres de los clips realmente exportados. Son diferencias de datos comprobadas, no un certificado de variedad perceptual. Todos usan la paleta `editorial`, resuelta una vez para este proyecto; los cuatro sistemas se comprobaron aparte en el banco.

Se extrajo un frame de cada Visual del MP4 final, al 60% de su duración con tope de 1,5 s desde su inicio. Se miró la hoja y muestras a 1080×1920, entre ellas `desorden`, `simultáneos`, `restringir` y `tambaleo`. No afirmo haber visto entero el vídeo en movimiento. Condiciones, posiciones absolutas y hashes: [video.json](video.json). Artefacto: [42 fotogramas del vídeo, escala 30%](video-fotogramas-30pct.png).

### Incidencias de producción, no ocultadas por la exportación correcta

- **Respaldo Visual: 4/46 = 8,70%**, frente a 3/55 = 5,45% heredado (+3,24 puntos porcentuales). Los cuatro son `visual-sin-palabra`; ninguna caída por longitud ni fallo de dibujo registrado. Muestras diferentes: no atribuyo el aumento al motor ni lo descarto. El resultado no es 46/46.
- **IA: 0 frente a objetivo 21**. Una solicitud acabó en `Forbidden`, registrada como `ia-fallida`. No se generaron las otras veinte imágenes. La exportación se completó con material de respaldo, pero no reproduce el mix solicitado. No se tocó el camino IA para arreglarlo.
- El resumen real dice `completa: true`, **`cuadra: false`**. Sus filas Original 46 / Stock 21 / IA 0 / Visual 42 no suman las 114 posiciones exportadas. Se conserva el resumen en `video.json`: no se sustituye por una tabla inventada que cuadre.
- Las 42 direcciones resultaron de densidad `alta`: el contenido de este vídeo no demuestra reparto entre las cinco densidades. Las cinco sí dibujaron en la cobertura explícita.

## Coste y pérdida

Una generación real: 42 renders, 3.168 frames, 163.228 ms acumulados, 4.964 intentos. Electron 31.7.7 / Chromium 126.0.6478.234; escenas, duraciones y tipografías variadas, paleta editorial. Se cerró el banco durante el render. No es un A/B controlado con el fixture histórico de 3 s; no se declara una regresión causal a partir de esta comparación.

| Medida | Resultado | Referencia del encargo |
| --- | ---: | ---: |
| Pérdidas por cinco intentos sin frame válido | **0** | 0 |
| Frames aceptados en el quinto intento | **0** | objetivo 0 |
| ms/frame (suma ms / suma frames) | **51,524** | 40,84: **+26,16%** |
| Intentos/frame | **1,5669** | 1,644: **−4,69%** |

Se cruzan tanto +25% como 50,3 ms/frame. Decisión: continuar y entregar el dato, porque es presupuesto informativo y no hubo pérdida; no declararlo rendimiento aprobado contra la base. La distinción rescate/pérdida está en `src/main/index.ts:1469` y `:1474`. Datos originales: `mvp-paso7/generar.json` del proyecto; resumen versionado en `video.json`. El arnés vigila el log y sale con 3 ante el mensaje de cinco intentos agotados.

## Inventario y aritmética real

Repertorio activo 9:16: **17 estructuras, 22 fondos, 16 cámaras, 5 densidades, 5 ritmos, 10 tipografías**. Cuatro paletas por proyecto, fuera del producto combinatorio dentro de un vídeo. Controles excluidos del sorteo: `unaCaja`, `liso`, `derivaMinima`. Nombres completos: [inventario.json](inventario.json).

Fondos por energía 0/1/2/3: **3/4/12/3**. Cámaras: **1/4/8/3**. No se eligieron nuevos valores de energía en este cierre; se midió el reparto recibido de la rama.

```text
Pares legales = 3×16 + 4×13 + 12×5 + 3×1 = 163 (de 22×16 = 352)
Identidades   = 163×17×5×5×10 = 692.750
Producto crudo sin regla    = 1.496.000
combinacionesLegales()     = { identidades: 692750, instancias: 618389000 }
```

El nominal de instancias es `5164 × 4790 × 25 = 618.389.000`: peso legal fondo×cámara, por peso estructura×familias compatibles, por densidades×ritmos. **No mide diseños percibidos**. Su reparto por cada par, no solo el total, está en `inventario.json:repartoNominalPorPar`. Con controles, 895.500 identidades.

**Hallazgo: contador correcto, selector incorrecto respecto a la regla energética.** `combinacionesLegales` descarta energía >3 (`src/shared/escena.ts:1098`), pero `direccionDe` elige fondo y cámara independientemente (`:985`). Hay **178/346** palabras significativas únicas de esta transcripción que sortean fuera de la regla; en los clips exportados, **26/42**. La regla no está impuesta en el sorteo de producción. No se ha arreglado ni se vende el conteo legal como descripción de todas las salidas posibles. No provocó pérdidas en esta generación.

`lectura` es descriptivo: las declaraciones están en `src/shared/escena.ts:347` y en los registros; no hay consumidor que derive dibujo de ese enum. Las disposiciones llaman a sus propias funciones. Compartir el rótulo no despacha una geometría común por él.

## Cobertura y hoja completa

[Hoja completa al 45%](hoja-completa-45pct.png): **2052×24780 px**, escenas de **486×864 px**, sin reescalar al montar el PNG. Escala y condiciones escritas en la propia imagen.

- 18 estructuras (17 + control), 23 fondos (22 + control), 17 cámaras (16 + control), 10 tipografías, 5 densidades, 5 ritmos y 4 paletas: **82/82 casos**.
- Ninguna pieza del registro quedó sin montar/dibujar en la muestra. No hubo errores JavaScript, ni respaldo en estas condiciones; cada celda tiene palabra y keyframes reales. `redNodos` y `cuaderno` no salieron en el vídeo aleatorio, pero sí en el banco.
- Condiciones comunes: `visual_escena`, palabra `memoria`, conceptos 🧠 recuerdo / 🗂️ archivo / 🔗 conexion, `t=1,5 s`, ciclo 3 s, resolución 1080×1920. Identidad de base ondas/constelacion/quieto/media/simultaneo/archivo; se sustituye solo el eje inspeccionado. Cada celda lleva su dirección completa y sistema.
- Chrome 152.0.7977.82, DPR 1, fuentes comprobadas por geometría. Una composición por documento fresco evita compartir nombres de keyframes entre identidades. El montaje de la hoja solo pega capturas, no redibuja escenas.
- Alcance: **una muestra estática por pieza**, no toda combinación, contenido o ciclo. Miradas las siete hojas por eje; efectos de aparición/movimiento requieren el banco en marcha o el vídeo. Las primeras capturas instrumentales incompletas no se dieron por evidencia: se comprobó tamaño real de cada PNG y se sustituyó el método de captura, no el renderer.

Hojas separadas: [estructuras](cobertura-estructura-45pct.png), [fondos](cobertura-fondo-45pct.png), [cámaras](cobertura-camara-45pct.png), [tipografías](cobertura-tipografia-45pct.png), [densidades](cobertura-densidad-45pct.png), [ritmos](cobertura-ritmo-45pct.png), [paletas](cobertura-sistema-45pct.png). Datos por caso: [cobertura.json](cobertura.json).

## Emoji: no hay paridad visual exacta

La premisa de dos fuentes distintas no se cumple: ambos caminos usan **Segoe UI Emoji del sistema** (`isCustomFont:false`, un glifo efectivo por nodo, consultado vía CDP). Noto Color Emoji no está empaquetada. Sin embargo, Chrome 152 y Electron/Chromium 126 **dibujan variantes distintas**: se miraron los tres recortes, no solo sus hashes. No es la firma pequeña de ruido de rasterizado.

| Emoji | Píxeles distintos en recorte 62×45 | Δ máximo | Δ medio en píxel cambiado |
| --- | ---: | ---: | ---: |
| 🧠 | 1.527 | 213 | 54,35 |
| 🗂️ | 1.790 | 166 | 31,45 |
| 🔗 | 1.039 | 147 | 42,13 |

No hay tofu en estos tres glifos, pero **el banco no prueba el aspecto exacto del emoji de producción**. No se generaliza a todo Unicode. Resolución/tamaño y fuente real guardados en [emoji.json](emoji.json); PNG `emoji-1/2/3-banco.png` y `-render.png`. La hoja lleva la advertencia visible. No se empaquetaron fuentes nuevas para ocultar la diferencia.

## Cadena del hash

La ruta corta aplicada es `activeProjectPath → SHA256(id)[0] % 4 → sistema`, una vez por lote (`src/main/index.ts:4644`, función `:1138`). No se creó un UUID de generación ni se cambió el esquema del proyecto. Misma ruta de proyecto, misma paleta; moverlo de ruta puede cambiarla. No es una rotación forzosamente sin repeticiones entre vídeos.

**El id bruto no llega a `canonizar`.** Llega su resultado `sistema`, como parte independiente de `hashGrafico` (`:1168`). `extra.direccion` sí llega a `canonizar(g.extra)` (`:1153`; constructor `:4737`). La cadena termina en SHA-1 de las partes, truncada a 12 hex.

Control con mismo graphicData `memoria`, 1080×1920, 3 s, 30 fps, pantalla, **versión 9 en ambos lados**; se aísla el transporte de la paleta, no se presenta como hash histórico de versión 8:

```text
Antes: sistema fijo voltaje                    → aae3160cd710
Después: video-a/video-b → editorial           → 904d38f3ef79
Después: video-c/video-d → clinico             → ac027af74d03
Después: video-e         → calido              → 4f2382e024e4
Después: ruta del proyecto usado → editorial   → 904d38f3ef79
```

Dos ids que dan la misma paleta reutilizan la clave del mismo contenido deliberadamente. Eso no es envenenamiento: producen los mismos píxeles por esta decisión. Fixture exacto en `inventario.json:hash`.

## Dos guardias: antes, debilitamiento y corrección

En `d0dae0d`, las dos guardias exigían `REP.instancias === 166470` y `PRU.identidades === 182`. La ampliación las dejó en `REP.instancias >= REP.identidades` y `PRU.identidades > REP.identidades`: **aquella sustitución sí era más débil**.

En este cierre se corrigieron, no se defendieron las desigualdades:

1. Nominal **exacto** contra la factorización independiente de pasos declarados, sin llamar a `instanciasDe` ni al contador probado: 5164×4790×25 (`tests/ciclo.js:534`).
2. Controles **exactos** contra histograma de energías y compatibilidad de roles: 895.500 (`tests/ciclo.js:548`).

Además, una guardia de inventario mínimo evita que borrar repertorio reduzca también el esperado y pase inadvertido (`tests/ciclo.js:524`). Se corrompió en memoria cada resultado con **+1**, sin editar producción: las dos ejecuciones de la suite real terminaron **exit 1**, cada una por su aserción correspondiente. Sin mutación, verde. Arnés: `mvp-guardias.cjs`.

### De dónde sale el 4%

Umbral de ingeniería contra el falso cambio de un píxel, **no medición psicofísica ni umbral aprendido de los labs**. La implementación (`tests/ciclo.js:597`) empareja de forma voraz puntos cercanos y promedia distancias sobre coordenadas porcentuales, normalizadas por `hypot(100,100)`. Prueba siete semillas y tres recuentos (21 condiciones por par de estructuras).

0,04×√20000 = **5,6569 unidades porcentuales**: si el cambio fuera solo horizontal son 61,09 px en 1080; si solo vertical, 108,61 px en 1920. Está claramente por encima de 1 px. No es el 4% de la diagonal física rectangular ni una distancia mínima global óptima. **No certifica variedad perceptual ni garantiza separación de cada pareja de cajas.** Es una alarma geométrica limitada; el nombre informal «distancia mínima» no mejora lo que realmente calcula.

## Verificación y límites pendientes

7b (clon nuevo, instalación y nueve suites) ya estaba cerrado y no se repitió. En el árbol final de este paso: `npx tsc -p tsconfig.json` **0**, `npm run build` **0**, `npm test` **9/9 y exit 0**. `test:exclusion` no crasheó en esta ejecución. Logs locales de esta vuelta: `C:\graphify\mvp-build-final.log` y `mvp-test-final.log`.

Build verificado por ficheros: **17 en dist y 4 en dist-electron**, no un código de salida solamente. Cero artefactos banco/MvpCobertura. Los 21 SHA-256 no cambiaron al añadir la vista de cobertura y sus arneses. Muestras de tamaño REAL en disco (no tamaño de texto que imprime Vite):

| Fichero | Bytes | SHA-256 |
| --- | ---: | --- |
| dist/index.html | 601 | f0e4e1ee03fbe82401ae6b731f2fec49d0730f1f5ba0ffff3c886d7ed8de2da8 |
| dist/grafico.html | 737 | 1e5692fd1c2c9011c15d75a94e2f448dc6110f6f09c6ad3373069ec47bbdad35 |
| dist/assets/AnimatedGraphic-Dzmyuefb.js | 280333 | 9478e3ddb8bd9c33871b1deef8ee363ea21b8aca208550f28a6b1024f0a4c7ba |
| dist-electron/main/index.js | 401562 | cf2d52d11b2ea07466b1662c1df9c7e450ae03b43ae03c0a813f0ef6e231f8f3 |

No corregido: tamaño de etiqueta, proximidad/solape entre vecinos, peso desigual de piezas (cristales/rayosImpacto), ranura del héroe, tiempo legible y contraste entre Visuales. La hoja de paletas también muestra tinta oscura sobre cajas oscuras en clinico/calido con ondas: `escena.tsx:112` usa caja oscura por defecto y solo sobrescribe `--caja` cuando el fondo declara tono claro (`:777`). Es una incidencia visible de legibilidad, no un render ausente; queda sin tocar.

También quedan explícitos el selector energético, la paridad de emoji, el coste que cruza presupuesto, el respaldo elevado en esta muestra y el fallo IA. Entrega usable no significa que estas incidencias estén resueltas. Los procesos de captura y el servidor del banco se cerraron al terminar. El estado limpio de Git se comprueba después del commit de evidencia y se entrega en el mensaje final; este fichero no predice un resultado futuro.
