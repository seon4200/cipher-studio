# IDEA Assembly V3 — secuencia causal de conectores

La revisión `editorial-idea-assembly-2026-09-v3` es un ajuste opt-in del
pilot IDEA. Conserva sin cambios los recursos, las tarjetas, el Hero, la
tipografía, el color y la geometría estable aprobados en V2. Sólo congela una
secuencia de conectores causal, persistida en `ideaAssembly.connectorSequence`.

## Reloj del piloto

El piloto tiene 80 frames a 24 fps (3,333 s). Cada tarjeta completa su entrada
tres frames antes de comenzar la ruta asociada. Los trazos se entregan con un
único frame entre el final de uno y el inicio del siguiente:

| Ruta | Asentamiento | Trazo | Dirección |
| --- | ---: | ---: | --- |
| 1 | f23 | f26–f29 | PERSONAS → Hero |
| 2 | f27 | f30–f33 | DATOS → Hero |
| 3 | f31 | f34–f37 | Hero → SOLUCIONES |
| 4 | f35 | f38–f41 | SOLUCIONES → IMPACTO |

La composición completa queda estable desde f42 (~1,75 s) hasta f72 (~3,00 s).
Los trazos terminados permanecen visibles durante ese tramo para conservar las
relaciones legibles; el solape máximo de las **animaciones de trazado** es un
frame, no se ocultan las relaciones ya construidas.

## Rutas y dirección

Las rutas portrait/landscape y sus puntas mínimas se persisten en el
`SceneSpec`; no se infieren desde la ventana ni desde un proveedor. En
landscape, la última relación bordea el exterior derecho de las dos tarjetas
para no cruzarlas. Las rutas de PERSONAS y DATOS mantienen carriles separados
hacia el Hero.

La punta es un punto de tinta de radio reducido y sólo aparece al completar
cada trazo. No se introducen flechas grandes ni movimiento continuo.

## Compatibilidad

V1 y V2 no admiten `settle` ni `connectorSequence`; su validación y renderer
históricos permanecen separados. V3 reutiliza exactamente la geometría V2,
pero su revisión, beats y rutas participan en la identidad del `SceneSpec`.
Los recursos siguen materializándose localmente y el render bloquea red tras
esa materialización.

## Nota de regresión registrada

En la comprobación posterior a V3, V1 reprodujo sus frames estables portrait y
landscape con SHA idéntico. V2 portrait y V3 portrait también lo hicieron. Las
rutas landscape V2 y V3 produjeron dos firmas de frame estable entre ejecuciones
aisladas con el mismo build, viewport y recursos; una repetición V2 volvió
exactamente a la firma histórica. La diferencia queda registrada como variación
intermitente de render/captura, no se cambió baseline, tolerancia ni
comportamiento V2/V3 para ocultarla.

## Aceptación

Ejecutar, después de `npm run build`:

```powershell
npm run accept:editorial-idea-assembly-v3
```

La aceptación genera MP4 vertical/horizontal, keyframes de los cuatro trazos,
comparación V2/V3 y `evidence.json` en la carpeta externa
`C:\graphify\_cipher-idea-assembly-v3\runs\`.
