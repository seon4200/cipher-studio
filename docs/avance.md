# AVANCE — dónde vamos

> **3.4A — persistencia V1 integrada y comprobada (07/09/2026).**
> Merge local `8760491` de `asset-persistence-3-4a`. Estado versionado V1,
> migración legacy en memoria, ProjectSubstrate null/validado sin consumo visual,
> manifest vacío para nuevos proyectos, rutas confinadas y JSON recuperable con
> backup. Los legacy sin manifest abren sin crearlo. Guardado conserva campos
> desconocidos; Guardar como captura el origen antes del diálogo.
> Clon NUEVO de `6b8dddf`: npm ci, tsc, build por ficheros y **10/10 suites**;
> suite nueva de persistencia/assets con 25 grupos sobre consumidores compilados.
> Los commits posteriores a ese árbol ejecutable son sólo documentación. Los 61
> estados reales mantienen SHA, tamaño y fecha. Evidencia y limitaciones:
> `docs/asset-engine/persistencia-assets-v1.md`.
> El retorno `v-persistencia-assets-v1` apunta al cierre documental final. Versión
> 12 y visual_escena intactas. Sin OpenMoji, Hero ni imágenes; siguiente código
> **3.4B**. Las referencias históricas inferiores a 3.4A describen master previo.

**Regla:** un punto solo se marca ✅ con **evidencia** — hash del commit, suites
verdes desde clon limpio, o el artefacto mirado. Nunca por "creo que está hecho".

> **Estado auditado al 07/09/2026 — este bloque manda sobre el texto histórico
> inferior.** El checkpoint integrado `v-densidad-solar-instrumentado` conserva
> `COMPOSICION_VISUAL='visual_escena'` y deja `VERSION_PLANTILLAS=12` por el cambio
> de resolución Solar que puede mover
> píxeles de `extra` ya existente. El catálogo activo
> contiene 17 estructuras, 22 fondos, 16 cámaras, 5 densidades, 5 ritmos y 10
> tipografías (`src/shared/escena.ts:281–971`). `combinacionesLegales()` devuelve
> 692.750 identidades legales; las 618.389.000 instancias nominales no son una
> medida de variedad percibida. Procedencia: `tests/aceptacion/mvp-paso7/inventario.json`
> de `1f1a6cb`.
>
> Fases reales: 0–3 cerradas; el catálogo completo, densidad/ritmo y el
> interruptor se implementaron en los commits MVP (`260198f`–`d4e11ce`);
> selección semántica parcial en `16bf7a6`; paletas por proyecto y diez
> tipografías implementadas. La Fase 9 de imágenes sigue sin implementar y debe
> reevaluarse antes de continuar el plan antiguo: la prioridad de producto ahora
> son motion graphics con recortes/imágenes protagonistas. No se inicia aquí.
>
> **Densidad y Solar (integrados desde `5388088`).** La densidad deja de partir de tres
> conceptos fijos: deriva de frase, palabra y etiquetas. En la traza real de 42
> Visuales de `mvp-paso7`, `alta 42` se recalcula como `media 2 · alta 26 ·
> saturada 14`; es una medición de esa traza, no una promesa de distribución general.
> Solar conserva `68/188` como agregado histórico irrecuperable y mide un corpus
> nuevo, versionado, de 158 solicitudes: `43/158 → 72/158`. No son muestras
> comparables.
>
> **Auditoría 3.3 integrada (`993a123`).** Los documentos de `docs/asset-engine/`
> trazan proyecto, materiales, stock, descarga, timeline y hash. Estado auditado
> antes de 3.4A (`c0a9c78`): rutas mayormente absolutas, sin schema/migraciones ni
> manifiesto productivo de assets. 3.4A incorpora schema V1 y un manifest mínimo
> para proyectos nuevos; no migra rutas legacy ni implementa OpenMoji o Photo Hero.
> Retorno de la auditoría: `v-auditoria-pipeline-assets`.
> **3.3.5 integrada documentalmente:** merge local `1d8415a` desde la base
> `291069e` / `v-auditoria-pipeline-assets`, conserva `74d1572` y corrección
> `140ed8e`. Retorno de cierre: `v-scene-recipe-editorial-v1`.
> Scene Recipe + ProjectSubstrate separan identidad/locator y fijan una única
> proyección `extra.sceneSpec`. Validador documental: 18 ejemplos (16 asset-led,
> 2 editorial-text), 6 hard cuts y 5 Heroes sin salida; no prueba calidad visual.
> Fuente: `docs/asset-engine/validar-scene-recipe-v1.cjs`, corpus de `140ed8e`.
> No existe OpenMoji integrado ni Photo Hero. `materiales/assets/` y su manifest
> existen sólo como cimiento vacío de proyectos V1; no descargan ni validan assets.
> No se implementó movimiento nuevo. 3.4A ya cerró schema/migración legacy,
> ProjectSubstrate, manifest V1, rutas confinadas, escritura recuperable y
> recuperación; siguiente código recomendado: **3.4B, catálogo OpenMoji pinneado**.
>
> **Spike limpio de proveedores (`c94cc3f`).** Se conserva evidencia sin binarios:
> OpenMoji oficial (SVG válido), PurePNG como muestra secundaria con alpha útil y
> PNGImages pendiente por alpha no útil. El renderer, Photo Hero y Asset Engine no
> se implementaron. El flujo por vídeo hacia `materiales/assets/` es una propuesta
> auditada en 3.3, pendiente de validar schema e implementación; Git no
> guarda ni redistribuye assets crudos de terceros.
>
> Evidencia real conservada: `tests/aceptacion/mvp-paso7/` documenta un MP4 de
> producción de `1f1a6cb` con 42 Visuales, 41 palabras y 41 direcciones distintas.
> Prueba que el camino funcionó entonces; no certifica variedad perceptual ni una
> nueva generación después de `44ca34a`. El contraste global se corrigió en
> `c7f3777` y está guardado por ≥3:1 contra caja y fondo dominante en `tests/ciclo.js`.
>
> Sigue abierto: separación entre cajas vecinas, tamaño de etiqueta, coste y
> respaldo de producción, paridad emoji, peso/tiempo/variedad perceptiva y los
> 1.154 huérfanos. El peor par admisible solapa 95,169543% de la caja menor incluso
> a tamaño base (`tests/aceptacion/plan-a3-peor-par-cero-20260905/solapes.json`).

---

## Resumen

| fase | tema | avance |
|---|---|---|
| — | Diseño e implementación del vocabulario | ✅ 6 ejes activos · 75 piezas de registro |
| **0** | Preparar el terreno | ✅ 4/4 |
| **1** | El esqueleto | ✅ 10/10 · `v-fase1-escena-inactiva` |
| **2** | Hacer visibles los fallos | ✅ 4/4 · `v-fase2-avisos` |
| **puente** | El suelo de las pruebas | ✅ · `v-puente-suelo` (`4157e0c`) |
| **3** | Banco + hoja de contactos | ✅ 2/2 · `v-fase3-hoja` |
| 4 | Vocabulario + interruptor | ✅ catálogo completo e interruptor activo |
| 5 | Densidad y ritmo | ✅ cinco perfiles, densidad derivada del contenido |
| 6 | Resto del vocabulario | ✅ piezas portadas; calibración perceptiva pendiente |
| 7 | La IA elige | 🟨 relación/contrato/fallback implementados; calidad no certificada |
| 8 | Moduladores | 🟨 4 paletas por proyecto + 10 tipografías; sin acabado |
| 9 | Imágenes | ⬜ 0/8 |
| 10 | YouTube 16:9 | ⬜ 0/4 |

El texto posterior conserva el plan y sus mediciones intermedias. Las marcas `0/…`,
versiones 8 y frases como "siguiente: Fase 4" que no hayan sido corregidas son
históricas; no describen el estado auditado de arriba.

---

## Lo que ya está en `master`

**El motor combinatorio, activo desde `8f7004c`.** Registro de piezas por eje con
contrato tipado —añadir una pieza y olvidar su dibujo **no compila**—, cuatro
capas con cámara, `direccionDe(semilla)`, ranura de héroe reservada, `cqmin` con
`container-type: size`, duraciones en `calc(var(--ciclo) / n)`, `rangos` de
instancia y `combinacionesLegales()` devolviendo **dos** números.

El interruptor es `COMPOSICION_VISUAL` en `src/main/index.ts`, hoy `'visual_escena'`.
La dirección entra en `extra` y en el hash desde `v-fase4f-interruptor`; la versión
vigente es 12 tras los merges `d4e11ce` (9), `16bf7a6` (10), `44ca34a` (11) y el
checkpoint de densidad/Solar (12).
A.0 incorporo el lote `84062d7` con merge `d0dae0d`: tres estructuras de prueba,
fuera del sorteo. El plan A-F posterior se trabaja en `plan-A-cajas`; A no esta cerrada.

**Los fallos se ven.** La app ya no puede decir *"éxito, 78 de 78"* mientras la
mitad del vídeo se degrada: avisos tipados con código estable y contador, resumen
por origen con la columna respaldo desglosada por motivo, y sale **también si la
generación aborta**.

**El suelo de las pruebas.** `npm test` corre las nueve y devuelve error si alguna
falla, con un seguro que salta si alguien añade una suite sin engancharla. Los
arneses de aceptación versionados, con su propio fixture. Y un comparador de
capturas con tolerancia.

**El banco de Visuales.** `npm run banco` abre la composición real en
`http://127.0.0.1:5174/banco.html`, sin Electron, captura ni FFmpeg. Monta
`AnimatedGraphic` directamente, permite fijar los ejes y el tiempo, comprueba las
fuentes por geometría y superpone la zona segura. El banco no entra en el build de
producción.

---

## Recuento operativo

**692.750 identidades legales.** Procedencia: inventario de `1f1a6cb`, sobre el
catálogo completo y la regla de energía actual: 163 pares fondo×cámara × 17
estructuras × 5 densidades × 5 ritmos × 10 tipografías.
No se cita el nominal de instancias como cabecera: su reparto por par y el
instrumento están en deuda-graficos.md y en desglosar-instancias-a2.cjs,
incorporados por `ea741c3`. La cifra nominal no acredita variedad perceptible
ni calibra los rangos provisionales de capasApiladas.

`v-fase4d-tono-claro` incorpora tinta por sistema para fondos claros, `tramaTejida` y parejas
por rangos del registro con extremos versionados. La guardia prueba el orden de los seis
sorteos desde el bundle (tipografia ultima), no salidas congeladas del catalogo.
Capturas: `tests/aceptacion/tono-oscuro-claro.png`, `trama-tejida-lab-pieza.png` y las tres
`capas-pareja-*.png`. El grano mas marcado y la calibracion pendiente estan documentados.
Aquella etiqueta tenia `visual_mapa`; el interruptor se movio despues, en `8f7004c`.
Hoy `COMPOSICION_VISUAL='visual_escena'`; `5388088` está integrado y
`VERSION_PLANTILLAS=12`.

**Coste vigente (A.0, condiciones y JSON en `tests/rendimiento/README-m7.md`):**
40,84 ms/frame y 1,644 intentos/frame en regimen; seis clips completos, 0/540
frames aceptados en el quinto intento. M7a1: agotar intentos SIN bitmap valido
para; M7a2: quinto intento valido mide margen, no perdida. M7b: +25% de 40,84
o superar 50,3 obliga a informar/decidir; M7c es informativo. 1,30 no es umbral.
No se compara 40,84 contra 50,3 como A/B. Sigue pendiente medir la pendiente por elemento.

---

## FASE 3 · Banco + hoja de contactos — cerrada

*Escribir una pieza es barato; **mirarla** cuesta un render, y eso se repite 65
veces.*

- ✅ 3.5 **El banco de pruebas**: monta la composición **real**, sin lazo de
  captura ni FFmpeg. No un serializador, no un segundo emisor
- ✅ 3.6 **Hoja de contactos** + calibrar `pasos` contra ella

> **Una herramienta se construye cuando el trabajo que ahorra ya duele, no cuando
> se puede imaginar que dolerá.**

El verificador de artefacto ya no bloquea la Fase 4. Con el banco, mirar cada pieza
es barato y en la Fase 4 se miran todas de todos modos. Protege el momento en que se
deja de mirar una por una: antes de la Fase 6, cuando entran 31 piezas por lotes.

**Orden operativo actualizado:**

1. Banco de pruebas — hecho.
2. Hoja de contactos y calibración perceptiva.
3. Fase 4 — piezas mínimas y mover el interruptor.
4. Fase 5 — densidad y ritmo.
5. Puente antes de la Fase 6: cerrar los 1.154 huérfanos; construir el verificador
   de artefacto (antiguos 3.1–3.4); medir la pendiente, densidad baja contra alta
   (antiguo 3.7).
6. Fase 6 — resto del vocabulario por lotes.

*El antiguo punto 3.0 (determinismo del render) se retiró: resultó no ser
bloqueante. Ver `puntos-retorno.md`.*

**Siguiente:** decidir si la prioridad de imágenes/recortes adelanta la Fase 9;
no iniciar implementación desde este documento. La calibración de disposición de
cajas sigue siendo deuda independiente.

## Fases 4 a 10

Ver `plan-maestro.md`.
El resumen auditado de arriba sustituye estos contadores históricos.

---

## Deuda abierta

- ⬜ Rotar las 6 claves de API (1 de 6). **Rotar primero, reescribir el historial
  después** — al revés no sirve de nada
- ⬜ `writeDebugLog` crece sin límite (`index.ts:185-201`, sin rotación)
- ✅ ~~Autoguardado con temporal + rename~~ — cerrado en 3.4A para
  `project-state.json`: temporal en el mismo directorio, `fsync`, publicación sin
  borrar el principal y backup recuperable. Límites vivos: no hay transacción
  conjunta estado+manifest, bloqueo multiproceso, medición de JSON grande,
  recuperación de backups en `list-projects` ni aviso específico de recuperación
  en UI.
- ⬜ `node_modules` fuera del historial de git
- ⬜ Registrar `usage` de las APIs
- ⬜ Los **1.154 huérfanos** (`VisualEngine.ts`, `visual-holograms.tsx`) →
  **antes de la Fase 6**
- ⬜ `mapa` acota por centro, no por borde. El arreglo allí es `layoutSeguro`,
  **no** `acotar()` — lo usan cuatro familias
- ⬜ La anomalía de rasterizado: 1 de 6 tiradas. Escrita, **no se persigue** salvo
  que vuelva
- ⬜ El bug de orden del `−3`: cubierto por el arnés de aceptación, no por una
  suite
- ⬜ Empaquetar Noto Color Emoji · Desfase de tarjetas · `__montar` sin `sistema`

## Pregunta de producto abierta

Las **tarjetas de gráficos solo salen si se piden a mano**, desde junio y por
diseño (`fc4313a` movió esa vía a `regenerate-graphics`). ¿Se quiere que vuelvan a
salir solas durante la generación? Sería una fase propia.

### Registro histórico del Plan A — ancho de cajas (05/09/2026)

Cota por fuente y ranura de emoji compartidas por CSS y aritmética. Archivo 700:
24 @ reales = 897,67 px; presupuesto = 898,94 px; zona = 900,07 px.
56 W/25 @ se rechazan con respaldo visible y aviso. Barrido 111 caracteres sin
subestimación y control negativo rojo. Evidencia: tests/aceptacion/plan-a2-20260905.
Persisten solapes ENTRE cajas con etiquetas extremas; no se declara M3 completo.
Política A–E: cachés temporales, sin merge; una subida 8→9 en el merge final.
El cierre de A sigue pendiente y exigirá un clon NUEVO.

~~A.3 detenido hasta identificar el fixture de las 828.~~ Cerrada esa espera
el 05/09/2026 por decisión explícita: muestra RETIRADA, no se busca ni sustituye
en silencio. Procedencia histórica: mensaje de `10000a9`, palabras de mapa.
Nueva base: fixture `4c3c060`, 321 etiquetas/107 grupos de la generación real
del 03/09/2026; no son 107 Visuales.

~~A.3 aplicado provisionalmente: +35%.~~ Retirado por el sondeo de pares de abajo.
Historia del primer ensayo: límite entero 17, sin rechazos
en la muestra y margen de 34,412472 px para la cota de 17 caracteres.
Procedencia: medir-tamanos-a3.cjs / plan-a3-20260905, visual_escena,
`4c3c060` MÁS el cambio pendiente fuenteCqmin=3.915; SHA de código y bundle
en los JSON. NO CERRADO: npm test dio 8/9, test:mapa exit 1. La métrica también
alimenta mapa aunque su CSS conserva 2.9; documentado en deuda-graficos.md.
No se cambió esa suite ni se resolvió el acoplamiento. Sin commit nuevo,
sin merge, versión 8. A sigue pendiente de cierre con clon NUEVO.

A.3, corrección 05/09/2026: +20% (37.584 px), límite 20, 0/321 rechazos.
Pares: base 0/107, +20 0/107, +35 1/107; no alcanza texto. Se midieron 91
instantes de cada grupo; no es una garantía fuera de la muestra. Fuente:
README-solapes-a3.md / plan-a3-pares-20260905, 4c3c060 + cambios A.3/T8,
hashes de bundle y arneses en los JSON. T8 conserva mapa con SU modelo de master.
A.4/A.5 y cierre completo de A siguen pendientes. No se declara M3 global verde:
el control extremo de la hoja aún muestra vecindad sin resolver.
Verificación A.3/T8: tsc exit 0, build por ficheros y 9/9 en clon consumido;
bloqueo de mapa cerrado sin rebajar capas. Cierre de A aún NO declarado.

**Rectificación del propio ejecutor, 05/09/2026:** +20% tampoco es el tamaño
definitivo: el control responsabilidades/archivo pasa de cero solape en base
a 21.83% de la caja menor, alcanzando texto. Era incorrecto elegir usando SOLO
las 321 (máximo 15). El commit 35a9ca8 se conserva como decisión retirada.
+7% no solapa ni ese control ni los 107 grupos, en los 91 instantes; +8% ya
intersecta el control. Queda +7% (33.5124 px), no +20. Es un aumento pequeño,
no una declaración de legibilidad resuelta. Evidencia en README-solapes-a3.md,
plan-a3-control17-20260905 y plan-a3-pares7-20260905; código 35a9ca8 + arnés
y literal fuenteCqmin=3.103, con SHA de bundle en plan-a3-mas7-20260905.

**Rectificación final de A.3, 05/09/2026:** ~~+7% queda aplicado~~. El peor
par que la puerta de +7 admite (tres etiquetas de 22 `@`) solapa texto a t=0.5:
38.290,897676 px² / 95,169543% de la caja menor, en visual_escena 1080×1920,
voltaje, 91 instantes. No se reduce el porcentaje a ojo: se restaura 2.9 cqmin y
A.3 se aplaza a Fase B. Disparador: tras B.1–B.3, repetir peor par y corpus de
321 antes de elegir tamaño. Evidencia versionada:
plan-a3-peor-par-20260905 y README-solapes-a3.md.
