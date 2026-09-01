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
| **3** | Banco + hoja de contactos | 🟨 1/2 · `v-fase3-banco` |
| 4 | Vocabulario mínimo | ⬜ 0/6 |
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

**El motor combinatorio, dentro y apagado.** Registro de piezas por eje con
contrato tipado —añadir una pieza y olvidar su dibujo **no compila**—, cuatro
capas con cámara, `direccionDe(semilla)`, ranura de héroe reservada, `cqmin` con
`container-type: size`, duraciones en `calc(var(--ciclo) / n)`, `rangos` de
instancia y `combinacionesLegales()` devolviendo **dos** números.

El interruptor es `COMPOSICION_VISUAL` en `src/main/index.ts`, hoy `'visual_mapa'`,
aislado en `261269d`. Se mueve en la Fase 4.

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

## Los tres números del motor

```
identidades          2
instancias   1.176.000     ← PROVISIONAL, inflado
```

Un millón de dibujos sobre **dos** cosas distintas de ver. **Lo que multiplica no
son los parámetros: son las piezas.** El millón está inflado porque dos instancias
de la misma identidad *"se parecen demasiado"*: `pasos` declara escalones que el
ojo no distingue. Se calibra contra la hoja de contactos de la Fase 3.

**Coste:** 1.60–1.73 intentos/frame contra el listón de 1.30. De ese +0.35, la
cámara solo cuesta **0.11** → las 16 cámaras no están amenazadas. Falta medir **la
pendiente**, no el desnivel: cuánto sube el coste por elemento añadido.

---

## FASE 3 · Banco + hoja de contactos — en curso

*Escribir una pieza es barato; **mirarla** cuesta un render, y eso se repite 65
veces.*

- ✅ 3.5 **El banco de pruebas**: monta la composición **real**, sin lazo de
  captura ni FFmpeg. No un serializador, no un segundo emisor
- ⬜ 3.6 **Hoja de contactos** + calibrar `pasos` contra ella

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

**Siguiente:** 3.6, hoja de contactos y calibración perceptiva de `pasos`.

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
