# Manual de estilo del motion de los Visuales

`cipher-motion-loop.html` y `cipher-motion-loop-2.html` son la **referencia de estilo** de los
Visuales —los gráficos a pantalla completa que sustituyen al plano—. Trece escenas entre los
dos, cada una demostrando una técnica.

> **NO son para implementar todavía.** Hoy solo existe `visual_texto`, que es texto sobre el
> fondo del sistema y nada más. Estas reglas se aplicarán cuando llegue el bloque de
> composiciones de Visuales. Están aquí para que ese bloque no empiece de cero y para que las
> reglas no haya que deducirlas leyendo el HTML.

Los dos ficheros se abren en cualquier navegador: traen un deslizador de `t`, un botón de
reproducir y un **Verificar bucle** que alterna entre `t=0` y `t=11.999`. Si en una escena
marcada *bucle* se ve un salto, alguna duración no divide 12.

---

## 1. Ciclo maestro — y **se ajusta al clip, no al revés**

La regla es una sola: **toda duración de una animación debe dividir el ciclo exacto.** Si no, el
frame final no empata con el primero y el corte del bucle se ve.

**El ciclo es la duración del Visual.** Los 12 s de los ficheros de referencia son una elección
de *ese laboratorio*, para que el movimiento respire al mirarlo en una rejilla de miniaturas.
**No forman parte de la regla.**

| duración del Visual | ciclo | duraciones legales |
|---|---|---|
| 3 s | 3 s | 3 · 1.5 · 1 · 0.75 · 0.6 |
| 2 s | 2 s | 2 · 1 · 0.5 · 0.4 |
| 12 s (los ficheros) | 12 s | 12 · 6 · 4 · 3 · 2 · 1.5 · 1.2 · 1 · 0.75 · 0.6 |

El principio es idéntico en los tres; solo cambia el número maestro. Lo prohibido no es «el 5 y
el 7» en abstracto: es **cualquier duración que no divida el ciclo vigente**. Con ciclo de 12,
el 5 y el 7 son ilegales; con ciclo de 2, también lo son el 1.5 y el 0.75, que sí valían antes.

En los ficheros de referencia vive como variable CSS y como una lista fija en el JS:

```css
:root{ --ciclo:12s }
```
```js
const LEGAL = [1.5, 2, 3, 4, 6];   // divisores de 12
```

### La consecuencia, y es la que importa

**Si el ciclo se calcula, las duraciones legales también.** Un `animation-duration:1.5s`
escrito a mano es **correcto** para un ciclo de 3 s y **falso** para uno de 2 s: 1.5 no divide
2, y ese bucle daría un salto visible.

Así que en las composiciones reales las duraciones **tendrán que derivarse del ciclo** —una
variable CSS con `calc()`, o calculadas al montar— y **nunca escribirse a mano**:

```css
/* así NO: solo vale si el ciclo resulta ser 3, 6 o 12 */
animation-duration: 1.5s;

/* así SÍ: fracción del ciclo, sea cual sea */
animation-duration: calc(var(--ciclo) / 2);
```

Es **el mismo patrón que ya nos mordió** con las constantes duplicadas: un número escrito a mano
que solo vale para un caso, y que sigue compilando —y pareciendo correcto— cuando el caso
cambia. Aquí el fallo además sería **silencioso**: el vídeo sale, el bucle salta, y nada lo
dice.

## 2. Desfase negativo

`animation-delay` **negativo**, con una duración legal. En `t=0` nada arranca desde cero: cada
elemento ya está a media respiración.

```html
<line class="b" style="animation-name:respira; animation-duration:3s;
      animation-delay:-0.286s">
```

Es lo que separa *"se acomodó"* de *"está vivo"*. Con delay 0 todo el conjunto arranca a la vez
y el primer segundo se ve artificial.

## 3. Duraciones desiguales del conjunto legal

Si todas duran lo mismo, se ve como **una persiana**. Desiguales **nunca se sincronizan en
medio**, pero como todas dividen el ciclo, **cierran todas a la vez** al final.

El «conjunto legal» no es una lista fija: son los divisores del ciclo vigente (regla 1). En los
ficheros de referencia el ciclo es 12 y por eso la lista es `[1.5, 2, 3, 4, 6]`.

```js
const DUR = [2,3,4,6];
const d = DUR[Math.floor(rnd()*4)];
// ...animation-duration:${d}s; animation-delay:-${(rnd()*d).toFixed(2)}s
```

El desfase se sortea **dentro del propio periodo** (`rnd()*d`), no en un rango fijo: así ningún
elemento empieza fuera de su ciclo.

## 4. Bucle contra narrativa

Dos clases, y son **dos formas de pensar el clip**:

```css
.b{ animation-fill-mode:both; animation-iteration-count:infinite;
    animation-timing-function:ease-in-out }        /* BUCLE: se repite para siempre */
.a{ animation-fill-mode:both;
    animation-timing-function:cubic-bezier(.2,.88,.3,1) }  /* NARRATIVA: corre UNA vez */
.lin{ animation-timing-function:linear }           /* modificador: giros y derivas */
```

- **`.b` — bucle.** Primer y último frame idénticos. Rotaciones, respiraciones, flujos.
- **`.a` — narrativa.** Tiene arco: empieza, cuenta algo y termina. *Escuela* escribe línea por
  línea y luego traza la curva; *Viaje* dibuja la ruta y suelta el pin al final.

Un bucle se puede cortar por cualquier sitio; una narrativa no.

## 5. Determinismo con semilla

Generador congruencial, y **`semilla(n)` antes de cada escena**:

```js
let _s = 20260809;
const rnd = () => (_s = _s*16807 % 2147483647) / 2147483647;
const semilla = s => { _s = s; };
// semilla(101) Psicología · 202 Amor · 303 Guerra · 404 Universo · 505 Escuela
// 606 Dinero · 707 Música · 808 Ciudad · 909 Lluvia · 1010 Viaje
```

`Math.random()` daría una composición distinta en cada recarga y, **al capturar frame a frame,
parpadeo**. Con semilla fija el frame 118 es idéntico las mil veces que se renderice.

La semilla por escena importa: sin reiniciarla, añadir un elemento a una escena cambiaría todas
las siguientes.

## 6. La estela son copias, no blur

Siete copias del mismo elemento con **30 ms de retraso** entre sí y opacidad y escala
decrecientes:

```js
R(7, i => `<div class="capa b lin" style="animation-name:girZ; animation-duration:3s;
   animation-delay:-${(i*0.03).toFixed(2)}s">
   <div class="p" style="opacity:${(0.95-i*0.13).toFixed(2)};
        transform:translateY(-17cqw) scale(${(2.6-i*0.28).toFixed(2)})"></div>
 </div>`)
```

**Borroso no es lo mismo que rápido.** Un `filter:blur` dice "está desenfocado"; siete copias
retrasadas dicen "va rápido".

## 7. Rotación diferencial

Anillos a **velocidades distintas**, decrecientes hacia afuera:

```js
const VEL = [2,3,4,6,12];   // el interno da 6 vueltas mientras el externo da 1
```

Con una velocidad única el conjunto **parece un engranaje**: rígido, mecánico. Con velocidades
distintas parece una galaxia, que es como giran de verdad.

## 8. Flujo continuo

Contenedor al **200 %** con la trama **duplicada**, y un desplazamiento del **50 %**:

```css
@keyframes deriva { to{ transform:translateY(-50%) } }
```
```html
<div class="capa b lin" style="animation-name:deriva; animation-duration:12s;
     top:0; height:200%">
  <!-- la trama, repetida DOS veces: R(n*2, ...) -->
```

Al terminar, la copia de abajo está exactamente donde estaba la de arriba: **el bucle es
perfecto por construcción**, no por ajustar números. Sirve en vertical (*Dinero*, *Lluvia*) y
girado en horizontal (*Guerra*).

Dos capas del mismo flujo a distinta velocidad —2 s y 4 s en *Lluvia*— dan **paralaje**, que es
profundidad sin 3D.

## 9. Moiré

Dos rejillas **casi idénticas** a velocidades distintas, girando en sentidos opuestos:

```html
<div class="capa b lin" style="animation-name:girZ;    animation-duration:12s">  <!-- 48 marcas -->
<div class="capa b lin" style="animation-name:girZinv; animation-duration:6s">   <!-- 45 marcas -->
```

**El patrón emerge del cruce, no se dibuja.** Es la técnica más barata que hay para generar
movimiento complejo: dos capas y dos duraciones. Como 6 divide 12, en `t=12` las dos han dado
vueltas enteras y cierra.

---

## Detalles de implementación que conviene no perder

**El encuadre coincide con el nuestro.** El pie de las escenas usa exactamente la zona segura
que ya está en `sistemas.ts`:

```css
.pie{ left:8.33%; right:8.33%; bottom:13.54% }
```

**Todo se mide en `cqw`**, con `container-type:inline-size` en el marco. Así la escena es
independiente del tamaño del contenedor — que es justo lo que hace falta para renderizar a
1080×1920 lo que se diseñó en una miniatura.

**El tiempo se posiciona, no corre.** Es el mismo mecanismo que ya usa `AnimatedGraphic`:

```js
function irA(t){
  for(const a of document.getAnimations()){ a.pause(); a.currentTime = t*1000 }
}
```

Eso es lo que hace los ficheros capturables frame a frame, y lo que garantiza que lo que se ve
en el navegador es lo que sale en el vídeo.

**La paleta de los ficheros NO es la nuestra.** Usan `--acento:#F0A020` y `--sup:#121212`, que
no coinciden con ningún sistema de `sistemas.ts` (`voltaje` es `#FF3B1F` y `#1A1A1A`). Son
parecidos a `voltaje` pero no iguales. **La autoridad sobre el color es `sistemas.ts`**; estos
ficheros son la referencia de **movimiento**, no de color.

**El ciclo de un Visual es su propia duración**, que es lo que dura su sub-clip: la mediana
medida es **2.6 s**. Ver la regla 1 — el ciclo se ajusta al clip, y de él salen las duraciones
legales. Los 12 s de estos ficheros no se heredan.
