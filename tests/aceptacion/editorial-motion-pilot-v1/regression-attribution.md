# Fase 2A — atribución de los 16 rojos del runner original

Comparación realizada **antes del afinado visual**. Los dos worktrees detached (`db0353f` y `3512ab3`) se compilaron separadamente y usaron el mismo `package-lock.json` (SHA-256 `ce5272e1a59b3e5ce540d218d92a7846ace5b478659963bebf5c76f6d56ddc5f`), la misma instalación Electron/fuentes del equipo, `--force-device-scale-factor=1`, AppData aislado por checkout y ningún `.env`. Cada suite seleccionó sus propios tamaños de viewport; no se cambió el zoom ni se midió su valor efectivo dentro de cada ventana. Ningún checkout temporal contenía `project-state.json` ni `.bak`. Los códigos y colas de salida están en `regression-attribution-raw.json`. El runner original, ejecutado en el checkout de trabajo con escala de TV y estados de raíz preexistentes, había dado 14/30.

| Suite | Error/aserción original | Base equivalente | Piloto equivalente | Clasificación | Acción necesaria |
|---|---|---:|---:|---|---|
| asset-resolver-v1 | exige ausencia de `project-state.json/.bak` en raíz | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final de ambos estados |
| assets-persistencia | `assertNoRepositoryProjectState` exige raíz vacía | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| background-black-foundation-v1 | aserción final de ausencia de `project-state.json` | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| graficos | `devuelve una ruta`: render devolvió nulo sin escala 1:1 | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | fijar escala sólo en runner de tests |
| motion-graphics-v15 | aserción final de ausencia de estados de raíz | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| openmoji-asset-roundtrip | `assertNoRepositoryState` exige raíz vacía | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| persistencia | `MUESTRA` no cubre `visualPresentationProfile` | 0 | 1 | REGRESIÓN DEL PILOTO | incluir valor no predeterminado y verificar guardado/reapertura |
| photo-cutout-production-v1 | `assert(clip && fs.existsSync(clip))` falla sin escala 1:1 | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | fijar escala sólo en runner |
| photo-cutout-spike-v1 | `assert(clip && fs.existsSync(clip))` falla sin escala 1:1 | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | fijar escala sólo en runner |
| production-retrieval-final | aserción final de ausencia de `project-state.json` | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| v15-color-system-v1 | runner original: aserción de raíz; en base limpia: `pixelDiff=7782` frente a baseline; piloto: 0 | 1 | 0 | FALLO PREEXISTENTE REPRODUCIDO | conservar evidencia roja y diagnosticar estabilidad por separado; no cambiar baseline |
| visual-asset-mvp | aserción final de ausencia de estados de raíz | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| visual-composition-v2 | aserción final de ausencia de estados de raíz | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| visual-functional-baseline-v1 | `El render normal de control no produjo un MP4` sin escala 1:1; también aserción final de raíz | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | fijar escala de test y comparar huella |
| visual-layout-typography-v3 | aserción final de ausencia de estados de raíz | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |
| visual-retrieval-engine-v1 | aserción final de ausencia de estados de raíz | 0 | 0 | PRECONDICIÓN/CONTAMINACIÓN DEL ARNÉS | comparar huella inicial/final |

`project-state.json` (ignorado por Git) y `project-state.json.bak` (untracked) existían antes del piloto: 970 bytes cada uno, SHA-256 `F24A2BF434DB6601785AA5F62B0427E67DA85655B22C9776A6DEE8BE984FF66B`. La copia externa `.bak` coincide. El fallo de píxeles en la **base** no demuestra una causa GPU; sólo demuestra que esa aserción histórica puede fallar sin el piloto bajo estas condiciones. No se borraron estados, no se bajaron umbrales y no se regeneraron baselines.

## Reparación del arnés y verificación

`tests/helpers/repository-state-guard.js` captura existencia, tamaño, SHA y mtime de ambos estados de raíz; las suites afectadas comparan la huella final con la inicial. Una prueba en fixture temporal demuestra que detecta mutaciones tanto del estado como del `.bak`. El runner conserva `npm run test:*` como autoridad, pero añade `--force-device-scale-factor=1` sólo a Electron en tests. La muestra de persistencia incluye el perfil editorial no predeterminado y verifica su ida y vuelta. No se tocó código productivo ni estado real para resolver estos rojos.

Tras `npm run build`, `npm test` terminó con **código 0, 30/30 suites verdes** en el checkout de trabajo, conservando ambos archivos de raíz. Esta pasada no elimina el registro de que la base limpia produjo una discrepancia histórica de 7 782 píxeles una vez; su causa específica continúa sin demostrarse y el baseline visual no se actualizó.
