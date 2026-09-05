# AVANCE — dónde vamos

**Regla:** un punto solo se marca ✅ con **evidencia** — hash del commit, suites
verdes desde clon limpio, o el artefacto mirado. Nunca por "creo que está hecho".

---

## Resumen

| fase | tema | avance |
|---|---|---|
| — | Diseño del vocabulario | ✅ 5 de 8 ejes · 65 piezas |
| **0** | Preparar el terreno | ✅ 4/4 |
| **1** | El esqueleto | ✅ 10/10 · `v-fase1-escena-inactiva` |
| **2** | Hacer visibles los fallos | ✅ 4/4 · `v-fase2-avisos` |
| **puente** | El suelo de las pruebas | ✅ · `v-puente-suelo` (`4157e0c`) |
| **3** | Banco + hoja de contactos | ✅ 2/2 · `v-fase3-hoja` |
| 4 | Vocabulario mínimo | 🟨 · interruptor activo desde `v-fase4f-interruptor` (`8f7004c`) |
| 5 | Densidad y ritmo | ⬜ 0/4 |
| 6 | Resto del vocabulario | ⬜ 0/4 · **aquí se entrega la meta** |
| 7 | La IA elige | ⬜ 0/7 |
| 8 | Moduladores | ⬜ 0/4 |
| 9 | Imágenes | ⬜ 0/8 |
| 10 | YouTube 16:9 | ⬜ 0/4 |

**La meta —variedad casi ilimitada— se entrega al cerrar la Fase 6.**
El tramo es 1 → 2 → 3 → 4 → 5 → 6. Las fases 7 a 10 añaden intención, color,
imágenes y formato horizontal: cosas distintas, no más variedad.

---

## Lo que ya está en `master`

**El motor combinatorio, activo desde `8f7004c`.** Registro de piezas por eje con
contrato tipado —añadir una pieza y olvidar su dibujo **no compila**—, cuatro
capas con cámara, `direccionDe(semilla)`, ranura de héroe reservada, `cqmin` con
`container-type: size`, duraciones en `calc(var(--ciclo) / n)`, `rangos` de
instancia y `combinacionesLegales()` devolviendo **dos** números.

El interruptor es `COMPOSICION_VISUAL` en `src/main/index.ts`, hoy `'visual_escena'`.
La direccion entra en `extra` y en el hash desde `v-fase4f-interruptor`; version 8.
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

**48 identidades legales.** Procedencia: contador del bundle en A.1,
`825b8d3`, repertorio de escena con energía de deriva=1.
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
Hoy `COMPOSICION_VISUAL='visual_escena'` y `VERSION_PLANTILLAS=8`.

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

**Siguiente:** Fase 4, vocabulario mínimo e interruptor todavía separado.

## Fases 4 a 10

Ver `plan-maestro.md`.
**4 (0/6)** las piezas · **5 (0/4)** densidad y ritmo · **6 (0/4) la meta** ·
7 (0/7) la IA · 8 (0/4) moduladores · 9 (0/8) imágenes · 10 (0/4) YouTube.

---

## Deuda abierta

- ⬜ Rotar las 6 claves de API (1 de 6). **Rotar primero, reescribir el historial
  después** — al revés no sirve de nada
- ⬜ `writeDebugLog` crece sin límite (`index.ts:185-201`, sin rotación)
- ⬜ Autoguardado con temporal + rename
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

### Plan A.2 — ancho de cajas (05/09/2026, sin merge)

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
