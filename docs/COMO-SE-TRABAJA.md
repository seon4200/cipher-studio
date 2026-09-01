# CÓMO SE TRABAJA EN ESTE REPOSITORIO

Léelo entero antes de tocar nada. No son preferencias de estilo: cada regla está
aquí porque su ausencia ya costó tiempo o rompió algo en silencio.

**El modo de fallo de este proyecto no es escribir mal código. Es no ver que algo
está mal.** 125 commits que no compilaban, una app que dijo "éxito, 78 de 78"
mientras media hora de vídeo se degradaba, un arnés de pruebas que verificaba su
propia copia de una función. Los tres pasaron con el log en verde.

---

## 1 · El ritmo

- **Un paso por turno. Informe y PARA.** No encadenes. No empieces la fase
  siguiente "ya que estabas".
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

| documento | qué contiene |
|---|---|
| `plan-maestro-motor-visuales.md` | las leyes, las fases, los riesgos |
| `avance.md` | qué está hecho y con qué evidencia |
| `punto-retorno-paso9.md` | las etiquetas y cómo volver |
| `docs/deuda-graficos.md` | lo que se sabe roto y aún no se ha tocado |
| `docs/motion/lab-*.html` | los ocho labs: el vocabulario visual aprobado |

Los comentarios del código llevan **el porqué escrito encima**. Cuando encuentres
uno que documenta una trampa, léelo: probablemente estás a punto de caer en ella.
