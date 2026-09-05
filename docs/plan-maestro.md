# PLAN MAESTRO — Motor combinatorio de Visuales

Punto de partida verificado: **`v-paso9-mapa-sin-palabra`** (`757b6cc`).
Estado y etiquetas al día: ver `avance.md` y `puntos-retorno.md`.

**Errata de procedencia, 05/09/2026 — A.3 del plan A–F externo.**
La muestra citada allí como «828 cajas» se RETIRA: el mensaje de
`10000a980d6f89431eb1141d3ac262622744fe80` habla de palabras/valores sobre
`mapa`, con etiquetas medias/largas; no de cajas de `escena`.
Los 509/847 fuera de zona son recuentos históricos sin denominador de cajas
recuperable ni arnés versionado. No son una tasa sobre 828 cajas.
A.3 usa, por decisión explícita, 321 etiquetas de 107 sub-clips: fixture de
`4c3c060`, generación del 03/09/2026, pruebas en `visual_escena`.
El inventario de las copias externas y la medición nueva están en
`deuda-graficos.md`. Este archivo del repo no contenía la instrucción de las 828.

**Procedencia obligatoria también para cifras heredadas:** qué instrumento,
composición y commit las midieron, pegados a cada cita. Si no consta, no se usa
como resultado verificable. Se conserva la historia tachada y su corrección.

**T8 del plan A–F, decisión 05/09/2026.** Mapa se CONSERVA desacoplada: su
modelo y CSS históricos quedan como en master d0dae0d; la cota por fuente de
escena deja de importarse por mapa. No se retira mapa ni se amplía su texto
para reparar una suite. Evidencia del acoplamiento y del sondeo: deuda-graficos.md,
A.3; instrumentos y corpus en tests/aceptacion/README-solapes-a3.md.
~~Tamaño elegido: +20%.~~ Retirado el 05/09/2026: el control real de 17 se
solapa a +20 aunque las 321 no. Se elige +7%, sin pares en control ni muestra;
+8% ya intersecta el control. No se confunde aumento pequeño con legibilidad
resuelta. Procedencia: 35a9ca8 + corrección, README-solapes-a3.md y JSON con SHA.
Esta decisión no cierra A.4/A.5 ni certifica legibilidad fuera de la muestra.

---

# 0 · EL PROBLEMA Y LA SOLUCIÓN

**Lo que funciona:** `mapa`, una composición escrita a mano.
**El problema:** `mapa` es *una* escena. Añadir escenas a mano **suma**.
**La solución:** una composición **genérica** que combina piezas de vocabularios
cerrados. Cinco ejes que **multiplican**.

| eje | piezas | estado |
|---|---|---|
| estructura | 17 | ✅ aprobadas en lab |
| fondo | 22 | ✅ aprobados en lab |
| cámara | 16 | ✅ aprobadas en lab |
| densidad | 5 | ✅ |
| ritmo de entrada | 5 | ✅ |
| paleta · tipografía · acabado | ~20 | ⏳ Fase 8 |

**65 piezas → 17 × 22 × 16 × 5 × 5 = 149.600 identidades.**

**La meta se entrega al cerrar la Fase 6.** Las fases 7 a 10 añaden intención
(que la IA elija un estilo que pegue con el contenido, no más estilos), imágenes y
formato horizontal.

---

# 1 · LAS LEYES QUE NO SE TOCAN

Romper cualquiera **no da error**: da un vídeo malo con el log en verde.

**1.1 · El ciclo.** Toda duración divide el ciclo exacto: `ciclo / n`, n entero.
Funciones reales: `fraccion()`, `ajustar()`, `divisoresDe()` en `shared/ciclo.ts`.
Se escribe `calc(var(--ciclo) / n)` — **división, no multiplicación**: `/ n` no
puede expresar una duración ilegal, `* 0.333` sí. Propiedades largas
(`animationDuration`), nunca el atajo `animation:`, que es donde se cuela un
`${d}s` sin que nadie lo vea. **Ni un valor en segundos dentro del `<style>`.**

**1.2 · La zona segura.** `ZONA` acota **centros de caja**, no bordes — por eso una
caja ancha se sale con el centro dentro. Cada pieza acota por su **borde**:
`centro ± semiancho`, con el caso degenerado del intervalo vacío resuelto.

**1.3 · El hash.** `hashGrafico` proyecta `type, value, label, unit, emoji, extra`
+ `ancho, alto, duracion, fps, VERSION_PLANTILLAS, modo, codec, sistema`.
- `COMPOSICION_VISUAL` acaba en `type` (`index.ts:4551` → `:1124`): cambiar de
  composición **ya cambia la clave**; subir `VERSION_PLANTILLAS` además invalida
  las tarjetas para nada.
- **Para `canonizar`, `null` NO es lo mismo que ausente.** Escribir un campo a
  `null` "por simetría" invalida la caché entera.
- Antes de añadir un campo a un objeto, **traza si llega a `canonizar`** y
  demuéstralo midiendo la cadena antes y después.
- El peor resultado posible es **misma clave con píxeles distintos**.

**1.4 · Solo React pinta.** Los painters de canvas no se invocan nunca.

**1.5 · Los keyframes van antes del `return`.** El `<style>` es el primer hijo; lo
que se emita después no llega a la hoja y el elemento se queda quieto **sin dar
error**. La forma de que no vuelva a pasar no es acordarse: es que el JSX **no
pueda** llamar a nada que emita — solo consume constantes ya construidas.

**1.6 · La sonda valida el TIEMPO, no el CONTENIDO.** Valida su propia franja de
8 px; un frame incompleto la pasa.

**1.7 · Un solo emisor de píxeles.** Nada de segundos renderizadores "para
previsualizar": en cuanto dos caminos producen imagen se separan y el barato
miente. El banco de pruebas monta **la composición real**.

**1.8 · Ningún arnés reimplementa una función del proyecto.** Se importa del
bundle compilado. Una prueba que copia la regla prueba su copia y sigue verde con
la regla rota.

**1.9 · Un rango es de instancia, nunca de identidad.** Si un rango llega tan lejos
que cambia lo que la pieza **es**, ahí hay dos piezas — y meterlas como rango las
esconde del recuento de identidades.

**1.10 · Las entradas no son cíclicas.** Van de 0 a 1 y se quedan. El primer y el
último frame **no** empatan, y es correcto. Lo que cierra son las capas de
iteración infinita.

**1.11 · `n=2` no es evidencia.** Una comparación pareada no prueba
reproducibilidad; hace falta una tercera tirada como árbitro. Y entre renders se
compara **con tolerancia**, nunca por igualdad de bytes.

---

# 2 · LOS DOS NÚMEROS

`combinacionesLegales()` devuelve **dos**, y confundirlos ya costó un error de 10×:

- **Identidades** = producto de los cinco ejes. Finito. Impide que todo *se vea
  igual*.
- **Instancias** = dentro de una identidad, la pieza se dibuja distinta según la
  semilla. Impide ver *esta escena exacta* otra vez.

Hacen falta las dos. Solo con ejes, dos vídeos con la misma combinación salen
idénticos; solo con rangos, todo se ve igual aunque nunca se repita. **Las
instancias se suman por combinación, no se multiplican en bloque.**

Medido con una pieza real y una de prueba por eje: **2 identidades, 1.176.000
instancias.** Un millón de dibujos sobre dos cosas distintas de ver. **Lo que
multiplica es escribir piezas.**

**El otro techo no es combinatorio, es de coste:** 1.60–1.73 intentos/frame contra
un listón de 1.30. De ese +0.35, la cámara solo cuesta 0.11.

---

# 3 · LA ARQUITECTURA

**Cuatro capas, una cámara, factores distintos.** fondo 1.00 · estructura
0.45-0.60 · decoradores 0.55 · texto 0.20. La misma cámara mueve cada capa a
distinta velocidad — **eso es la profundidad**; si todo se mueve igual, es una foto
deslizándose.

**La ranura del héroe, reservada desde el principio.** Hoy un emoji, mañana un PNG
recortado. Misma ranura, mismo factor, misma posición: convierte la Fase 9 en
rellenar un hueco, no abrirlo.

**El registro de piezas.** Tres registros (`FONDOS`, `ESTRUCTURAS`, `CAMARAS`)
resueltos por `direccion`. **Cero llamadas directas por nombre dentro de
`render`.** Metadatos y dibujo atados por el tipo: añadir una pieza y olvidar su
dibujo **no compila**.

**El contrato de pieza:** `id`, `descripcion` (una frase, para la IA de la Fase 7),
`energia`, `formatos`, `rangos`, `emite(kf, params)`; más `tono` solo en fondos, y
`minConceptos` + `presupuestoTexto` solo en estructuras. **Lo que no aplica a un
eje, no está.**

**La caché de árbol.** `claveDe` indexa `texto + conceptos`, FIFO, `CACHE_MAX = 4`.
**Si el árbol pasa a depender de algo más, ampliarla es lo primero.**

---

# 4 · FORMATOS

**9:16 vertical ahora, 16:9 preparado.**

`cqmin` es el menor de ancho y alto: en vertical `cqmin == cqw`; en 16:9 la
tipografía pasa a escalar con el alto, que es lo correcto. **`cqmin` exige
`container-type: size`, no `inline-size`** — con `inline-size` la unidad no
resuelve y el tamaño colapsa al valor de reserva.

**Los dos formatos casi sin tocar (8):** constelación, cinta diagonal, anillos
concéntricos, rayos de impacto, mundo isométrico, engranajes, red de nodos,
partido vertical.
**Necesitan variante horizontal (5):** línea de tiempo, editorial, abanico, marco
póster, cuaderno.
**Vertical y punto (4):** pila vertical, cascada, corte transversal, capas
apiladas — apilar hacia arriba **es** su identidad.

Los 22 fondos funcionan en los dos (son `inset: 0`) salvo skyline. Las 16 cámaras,
en los dos sin tocar nada. `ancho` y `alto` están en la clave: añadir un formato
**no corrompe la caché**.

**Aviso de alcance:** los Visuales en 16:9 son baratos; **la app** en 16:9 es otro
proyecto — stock filtrado por orientación, 88 medidas en píxeles fijos, reparto y
export a 1080×1920.

---

# 5 · REGLAS DE COMPATIBILIDAD

**5.1 · Energía.** `fondo.energia + camara.energia <= 3`

| energía | fondos | cámaras |
|---|---|---|
| 0 | trama tejida, amanecer, caústicas | quieto |
| 1 | ondas, cristales, panal, comida en familia | deriva, travelling, grúa, cámara en mano |
| 2 | malla, túnel, circuito, skyline, cuerdas, mosaico, multitud, orden espontáneo, marino, darwin, animal, vía láctea | acercamiento, alejamiento, picado, contrapicado, inclinación, órbita, barrido, rebote |
| 3 | warp estelar, lluvia de datos, demolición | temblor, saltos, vértigo |

A.1 (04/09/2026): `deriva` queda en energia 1 tambien en el registro; ver
`tests/aceptacion/README-a1.md` para amplitudes y evidencia. Esta tabla da
3x16 + 4x13 + 12x5 + 3x1 = 163 pares legales de fondo/camara; con 17 estructuras,
5 densidades y 5 ritmos: **69.275 identidades de cinco ejes**, no variedad percibida.
Si deriva fuese energia 2 serian 151 pares y 64.175. No incluye tipografia ni
sus compatibilidades. Es proyeccion del catalogo completo, NO repertorio actual.

**5.2 · Tono.** Cada fondo declara `oscuro` o `claro`. **El claro obliga a texto en
tinta.** Claros: trama tejida, amanecer, comida en familia. **Son el contrapeso.**

**5.3 · Color libre o ligado.** Lluvia de datos es verde **porque es código**:
cambiarlo no lo hace variado, lo rompe.

**5.4 · Estructura y tipografía.** Cada estructura declara qué familias acepta.

**5.5 · Las estructuras NO se mezclan entre sí.** Una ocupa el cuadro; dos compiten
y sale ruido. Excepción con lista cerrada: principal + elemento prestado.

**5.6 · La densidad NO se elige al azar.** Estructura, cámara y ritmo salen de la
semilla. **La densidad sale del contenido**: decir la verdad.

---

# 6 · LAS FASES

Cada fase: **rama propia**, las suites verdes **desde clon limpio**, y **hojas PNG
que hay que mirar**.

## FASE 0 · Preparar el terreno — ✅
Labs en `docs/motion/` · comandos reales · `extra` llega intacto (medido) · el
listón: 50.3 ms/frame, 1.30 intentos/frame.

## FASE 1 · El esqueleto — ✅
Composición nueva sin tocar `mapa` · cuatro capas · ranura de héroe ·
`direccionDe(semilla)` · `cqmin` + `container-type: size` · el registro y el
contrato · `rangos` e instancias. **Entra INACTIVA.**

## FASE 2 · Hacer visibles los fallos — ✅
Avisos tipados con contador · resumen por origen con respaldo desglosado por
motivo · sale también si aborta · `graphicsDecision` borrado.

## PUENTE · El suelo de las pruebas — ✅
`npm test` con seguro de conteo · arneses versionados · comparador con tolerancia.

## FASE 3 · Las dos herramientas

*Escribir una pieza es barato; **mirarla** cuesta un render, y eso se repite 65
veces. Va **antes** del vocabulario, no después.*

- [ ] 3.1 Verificar el `.mp4`: frames no vacíos, distintos entre sí, **las capas
      cíclicas cierran** (§1.10), contenido en la zona segura.
- [ ] 3.2 Si falla → se descarta y entra el respaldo que **ya existe**.
- [ ] 3.3 Reutilizar lo que ya hace `tests/graficos.js`.
- [ ] 3.4 Dejar el **gancho de medición de píxeles** abierto (lo usa 9.8).
- [ ] 3.5 **El banco de pruebas**: importa la composición **real** y la monta con
      `u` recorriendo el ciclo, **sin lazo de captura ni FFmpeg** (§1.7). Con
      selector de pieza por eje y de semilla.
      **Hecho cuando** cambiar una combinación se ve **sin renderizar un `.mp4`**.
- [ ] 3.6 **Hoja de contactos**: una rejilla con N combinaciones a la vez. Es lo
      que convierte "mirar 65 piezas" en mirar una imagen. Y con ella se calibra
      `pasos`, hoy inflado.
- [ ] 3.7 **Medir la pendiente**, no el desnivel: densidad baja contra alta.

## FASE 4 · El vocabulario mínimo

- [ ] 4.1 Cuatro estructuras muy distintas: **mundo isométrico**, **cascada**,
      **línea de tiempo**, **constelación**, cada una con `minConceptos` y
      `presupuestoTexto`.
- [ ] 4.2 Cuatro fondos que cubren los cuatro casos: **ondas** (neutro), **malla**
      (medio), **amanecer** (claro), **multitud** (temático).
- [ ] 4.3 Las 16 cámaras con sus factores por capa.
- [ ] 4.4 La regla de energía como filtro.
- [ ] 4.5 Ajustes: **lluvia de datos a pantalla completa**; **revisar amplitud de
      temblor y saltos**; **subir el contraste de los anillos**, hoy casi
      invisibles; **los decoradores se leen como polvo**, no como densidad.
- [ ] 4.6 **Mover el interruptor**: `COMPOSICION_VISUAL` → `'visual_escena'`, en
      commit aislado.

**Hecho cuando:** ≥256 identidades, la hoja de contactos mirada, un vídeo real con
≥20 Visuales distintos, coste dentro del listón, suites verdes.

## FASE 5 · Densidad y ritmo

- [ ] 5.1 Cinco densidades, con las piezas **adaptándose**.
- [ ] 5.2 Densidad **derivada del contenido**, no de la semilla.
- [ ] 5.3 Cinco ritmos que reparten instantes de entrada.
- [ ] 5.4 **Cada ritmo pasa por `ajustar()`**.

## FASE 6 · El resto del vocabulario — **aquí se entrega la meta**

*Antes de abrirla: cerrar los 1.154 huérfanos.*
*Unidad de paso: **un lote de 3-4 piezas + su hoja de contactos**, no una pieza.*

- [ ] 6.1 Las 13 estructuras restantes.
- [ ] 6.2 Los 18 fondos restantes.
- [ ] 6.3 **Prueba de variedad, por eje.** Sobre 40 escenas seguidas, contar
      repeticiones **de cada eje por separado**. Umbral: no más de dos seguidas
      iguales en ningún eje, y ninguna pieza por encima del 25 %.
- [ ] 6.4 Una medición: bundle antes/después y ms de arranque.

## FASE 7 · La IA elige

Lote de 12 **antes del render** · salida en **enums, no en prosa**, con la
`descripcion` de cada pieza viviendo en el código para que el prompt **se derive
del vocabulario** · dirección macro por vídeo con modelo mejor · capa de corrección
que **corrige, no solo avisa** · **fallback determinista por semilla** · banco por
concepto · `direccion` entra por `extra` → hash.

## FASE 8 · Los moduladores

Paleta (~8) con etiqueta de tono — **que el acento se relacione con el héroe**;
tipografía (~7) con compatibilidad por estructura; acabado (~5) como **eje
propio**; y **medir el blur antes de comprometerse**, en **intentos/frame**.

## FASE 9 · Imágenes

Generación **fuera del render**, en `materiales/` · **al hash entra el hash del
contenido**, nunca la ruta · regenerar es **acción explícita** · `img.decode()` con
**doble guarda** y `complete && naturalWidth > 0`, **sin resolver en error ni por
timeout** · `data:` URI en la ventana offscreen · recorte local con BiRefNet,
verificando el nombre del modelo · imágenes **sobredimensionadas** · y **contraste
medido en el artefacto** (umbral 3:1) con remedio automático.

## FASE 10 · YouTube 16:9

Segunda zona segura · las cinco variantes horizontales · skyline reproporcionado ·
**y el resto de la app**: stock, tarjetas, reparto, export.

---

# 7 · RIESGOS

| riesgo | cómo aparecería | qué lo caza |
|---|---|---|
| Caché de árbol con direcciones viejas | "a veces el fondo no cambia" | §1.3 |
| Segundos dentro de la hoja | dos clips comparten animaciones | grep de `s` |
| Variar sin variar identidad | quintiles planos, todo igual | los dos números + la prueba por eje |
| Duración que no divide el ciclo | tirón en el bucle, sin error | `ajustar()` + `tests/ciclo.js` |
| Keyframes tras el `return` | elemento quieto y descolocado | contar reglas contra la aritmética |
| `cqmin` sin `container-type: size` | tipografía colapsada | §4 |
| Caja acotada por su centro | se sale con el centro dentro | acotar por **borde** |
| Un arnés que reimplementa | verde con la regla rota | §1.8 |
| Estructura sin conceptos suficientes | cuadro vacío que pasa la sonda | `minConceptos` |
| Frame incompleto aceptado | vídeo con huecos, log correcto | el verificador, 3.1 |
| Preview que miente | se itera contra algo que el render no produce | §1.7 |
| Comparar por bytes | falsa alarma 1 de cada 6 | comparador con tolerancia, §1.11 |
| Techo de coste | clips perdidos por `MAX_INTENTOS_FRAME` | medir **intentos**/frame |

---

# 8 · ABIERTO

1. Las seis cámaras originales no se confirmaron explícitamente. Se asumen dentro.
2. Paleta, tipografía y acabado sin diseñar → **Fase 8**.
3. La tabla **tema → cámaras que funcionan** → **Fase 7**.
4. Los **1.154 huérfanos** → **antes de abrir la Fase 6**.
5. `mapa` conserva el agujero del acotado por centro; el arreglo allí es
   `layoutSeguro`, **no** `acotar()`.

---

# 9 · CÓMO SE TRABAJA

Ver `COMO-SE-TRABAJA.md`, que lleva el precedente de cada regla.
