# CÓMO SE TRABAJA EN ESTE REPOSITORIO

Léelo entero antes de tocar nada. No son preferencias de estilo: cada regla está
aquí porque su ausencia ya costó tiempo o rompió algo en silencio.

**El modo de fallo de este proyecto no es escribir mal código. Es no ver que algo
está mal.** 125 commits que no compilaban, una app que dijo "éxito, 78 de 78"
mientras media hora de vídeo se degradaba, un arnés de pruebas que verificaba su
propia copia de una función. Los tres pasaron con el log en verde.

---

## 1 · El ritmo

- **Los pasos mecanicos van en lote, con UN COMMIT POR TAREA.** Bisecar y revertir
  una tarea no debe llevarse las otras. Los pasos que DECIDEN algo siguen solos.
  Informe y PARA: no empieces la fase siguiente "ya que estabas".
- **Condicionales, no afirmaciones.** Si el arquitecto no ve el codigo, pide:
  "Comprueba si X; di que encontraste, citado; si X, haz Y". La comprobacion se
  reporta SIEMPRE, incluso negativa. Una premisa equivocada no debe gastar otra vuelta.
- **Enseña el código antes de aplicarlo** cuando el paso lo pida.
- **Fuera de alcance = se dice, no se hace.** Si un cambio pertenece a otra fase,
  señálalo y para. Aunque sepas hacerlo. Aunque sea una línea.
  *Precedente: el commit `9d4fcce` adelantó trabajo de la Fase 7 dentro de la
  Fase 1. Resultó inerte, pero eso se supo midiendo, después, y podría no haberlo
  sido.*
- **Corrige el estado por delante.** Si el prompt describe un estado que ya no es
  el real (commits que ya hiciste, trabajo ya entregado), **dilo primero y no
  ejecutes a ciegas**.
- **Un paso no es una pieza.** Cuando el contrato está cerrado, un paso puede ser
  un lote de 3-4 piezas más su hoja de imágenes.

## 2 · Git

- **Rama por experimento.** Nada se escribe en `master` sin decisión explícita.
- **Merge con `--no-ff`**: que se vea dónde empieza y acaba cada fase.
- **Commits separados por naturaleza.** Una limpieza no viaja con una
  funcionalidad: hay que poder revertir una sin la otra.
- **Nunca dar algo por commiteado** sin `git status --porcelain` vacío.
- Las etiquetas son la red de último recurso. Confírmalas con `ls-remote`, no las
  asumas.

## 3 · Verificar

- **La verificacion completa es de los MERGES:** clon limpio, `npm ci`, build
  por ficheros y las nueve suites. Dentro del lote bastan `npx tsc` y `npm test`
  sobre el bundle actualizado. En los merges es innegociable: descubrio 125
  commits que no compilaban.
- **Clon nuevo, no worktree.** `git clone` + `npm ci` en un directorio **sin
  `node_modules` padre**. Un worktree comparte `node_modules` y miente.
  *Precedente: esa confusión ocultó 125 commits que no compilaban, porque un
  `playwright` fantasma vivía en el `node_modules` del padre.*
- **Un clon con borradores dentro deja de ser un clon limpio.** Se consume; usa
  otro.
- **`exit 0` no prueba nada.** El build son **tres pasos** (renderer, main,
  preload). Verifica **por ficheros**: cuenta los artefactos y mira sus tamaños.
- **Ningún arnés reimplementa una función del proyecto. Se importa del bundle
  compilado.**
  *Precedente: un arnés con su propia copia de `anchoCaja` "verificó" un tope de
  56 que en realidad valía 500. Lo cazó el render, no la verificación.*
- **Nunca aceptes una tabla sin mirar el artefacto.** Si el paso produce imagen,
  hay que mirar la imagen.
- **Una medición sin sus condiciones registradas no es una medición: es un número
  suelto que va a mentir la próxima vez que alguien lo compare.** Toda cifra de
  rendimiento se anota con composición, duración, frames, sistema y número de
  muestras.
  *Precedente: se compararon 62,17 ms/frame de clips de 1 s / 30 frames contra un
  listón de 50,30 medido a 3 s / 90 frames. Parecía una regresión del 24%; al
  igualar las condiciones quedó en 51,51, un 2,4%.*
- **Casos degenerados desde el principio**, no al final: cero elementos, uno,
  textos larguísimos, el camino que aborta, la ventana cerrada.

## 4 · Dinero

- **Nunca renderices ni exportes "para comprobar"** sin que te lo pidan.
- Las llamadas a API cuestan. Si necesitas reproducir un fallo de proveedor,
  **intercepta `fetch`**; no salgas a la red.

## 5 · Lo que rompe en silencio

### El hash
`hashGrafico` proyecta `type, value, label, unit, emoji, extra` + `ancho, alto,
duracion, fps, VERSION_PLANTILLAS, modo, codec, sistema`.

- Todo lo que decide píxeles está en la clave, **o** sube `VERSION_PLANTILLAS`.
- `COMPOSICION_VISUAL` acaba dentro de `type`: cambiarlo **ya** cambia la clave.
  Subir `VERSION_PLANTILLAS` además invalida las tarjetas, que no han cambiado.
- **El paso que mueve `COMPOSICION_VISUAL` va SOLO**, sin lote y con verificacion
  completa: toca produccion y cache a la vez.
- **Una pieza nueva entra como `prueba: true` cuando el interruptor ya este
  movido.** `repertorio()` la excluye del sorteo: se mira en el banco y pasa las
  suites sin salir en un video. Quitar la marca es otro commit, despues de mirarla.
  Escribir se batea; aprobar se mira.
- **Para `canonizar`, `null` NO es lo mismo que ausente.** Escribir un campo a
  `null` "por simetría" invalida la caché entera.
- Antes de añadir un campo a cualquier objeto, **traza si ese objeto llega a
  `canonizar`**. Y demuéstralo midiendo la cadena antes y después, no razonando.
- El peor resultado posible es **misma clave con píxeles distintos**: la caché
  sirviendo un fichero que ya no corresponde a su nombre. Cuando toques algo del
  camino de render, compara **píxeles**, no solo la clave.

### El ciclo
- Toda duración divide el ciclo exacto: `ciclo / n`, n entero. Funciones reales:
  `fraccion()`, `ajustar()`, `divisoresDe()` en `shared/ciclo.ts`.
- Las duraciones se escriben `calc(var(--ciclo) / n)`. **División, no
  multiplicación**: `/ n` no puede expresar una duración ilegal, `* 0.333` sí.
- **Ni un valor en segundos dentro del `<style>`.** Usa las propiedades largas
  (`animationDuration`), nunca el atajo `animation:`, que es donde se cuela un
  `${d}s` sin que nadie lo vea.
- **Las entradas no son cíclicas**: van de 0 a 1 y se quedan. El primer y el
  último frame **no** empatan, y es correcto. Lo que tiene que cerrar son las
  capas de iteración infinita.

### El atomo visual compartido
- **Toda pieza dibuja sus cajas y sus emojis llamando a la funcion compartida `caja()`.
  Ninguna se dibuja la suya.** El atomo caja + emoji cambiara a silueta o icono; centralizarlo
  permite cambiar una funcion, no recorrer las 65 piezas.
- Excepcion existente, detectada el 02/09/2026 y pendiente, no un permiso para repetirla:
  el heroe de `constelacion` dibuja su emoji directamente. Las cajas de las cuatro estructuras
  actuales si llaman a `caja()`; este cierre no cambia la ranura del heroe ni sus pixeles.

### Los keyframes
- **Todo lo que emita `@keyframes` va antes del `return`.** El `<style>` es el
  primer hijo del JSX; lo que se emita después no llega a la hoja, y el elemento
  se queda quieto **sin dar error**.
- La forma de que no vuelva a pasar no es acordarse: es que el JSX **no pueda**
  llamar a nada que emita. Solo consume constantes ya construidas.
- Verificación: deriva del código cuántas reglas debería haber, con la aritmética
  término a término, y compárala con el conteo real.

### La zona segura
- `ZONA` acota **centros de caja**, no bordes. Una caja ancha se sale con el
  centro dentro. Cada pieza acota por su **borde**: `centro ± semiancho`.

### El aplanado
- `flattenedClips.push({...})` construye objetos **nuevos con claves nombradas a
  mano**. Lo que anotes sobre el objeto anterior se pierde ahí, sin error y sin
  log. Si añades un campo aguas arriba, **compruébalo aguas abajo**.

### Los avisos
- El log no es la interfaz. Un aviso es un **evento tipado** con código estable y
  contador: 200 fallos iguales son **una** línea con un 200.
- Los avisos se limpian al empezar cada generación: *un aviso viejo colgado de una
  generación previa miente igual que no avisar.*
- El resumen sale **siempre**: con cero fallos dice que todo cuadró, y si la
  generación aborta dice que **no llegó a terminar**. Un resumen que solo aparece
  en el camino feliz no sirve — el camino feliz es justo el que mintió.
- **Un resumen que rellena huecos con conjeturas es peor que uno con huecos
  honestos.** Si una desviación no tiene motivo conocido, se dice que no se sabe.

---

## 6 · Cómo se informa

- **Informe corto, diff COMPLETO.** No se pierden hallazgos y decisiones, numeros
  medidos, cualquier premisa rota del prompt ni el diff entero. Las capturas
  siempre. Sobran la salida entera del build y el listado de suites: "9/9 verdes"
  basta, sin ocultar ningun fallo.
- **Evidencia, no afirmaciones.** Ruta y línea, hash del commit, la cadena medida.
  "Lo comprobé" no vale; "`index.ts:1124`, esta línea" sí.
- **Mide, no razones.** Especialmente sobre el hash y sobre el coste.
- **Di lo que no sabes.** Un hueco declarado vale más que un motivo inventado.
- **Reconoce tus propios errores por delante**, antes de que se pregunten.
- **Lleva la contraria cuando toque.** Si el prompt contiene un error de hecho, un
  razonamiento inválido o una instrucción contradictoria, **dilo y para**. Este
  proyecto ha corregido varias decisiones equivocadas justo así.

---

## 7 · Dónde está el contexto

- **Nunca se referencia un documento, un fichero o una función sin comprobar que existe.**

| documento | qué contiene |
|---|---|
| `plan-maestro.md` | las leyes, las fases, los riesgos |
| `avance.md` | qué está hecho y con qué evidencia |
| `puntos-retorno.md` | las etiquetas y cómo volver |
| `docs/deuda-graficos.md` | lo que se sabe roto y aún no se ha tocado |
| `docs/motion/` | los ocho labs de la Fase 0: el vocabulario visual aprobado |

Los ocho labs que definen el vocabulario aprobado son, exactamente:
`lab-camara.html`, `lab-camara-2.html`, `lab-estructuras.html`,
`lab-estructuras-2.html`, `lab-densidad-ritmo.html`, `lab-fondos.html`,
`lab-fondos-2.html` y `lab-fondos-3.html`. Los otros seis `lab-*.html` son
referencias anteriores; no son el vocabulario aprobado.

- **El commit de una pieza nueva nombra el lab y la linea de donde sale.** Quedan decenas de
  piezas por portar; sin esa cita una implementacion puede desviarse en silencio y el
  vocabulario aprobado deja de ser una especificacion verificable.
- **Cuando la ficha y el lab discrepan, manda el lab.** La ficha se corrige en el MISMO commit;
  no se inventa geometria para hacer coincidir el codigo con un resumen posterior.
- **Una pieza no se da por portada sin haberla mirado al lado de su lab: geometria Y peso.**
  Compilar demuestra el contrato; la pareja visual comprueba tanto la silueta como que el fondo
  conserve su jerarquia de saturacion, contraste y opacidad en vez de competir con el contenido.

Los comentarios del código llevan **el porqué escrito encima**. Cuando encuentres
uno que documenta una trampa, léelo: probablemente estás a punto de caer en ella.
