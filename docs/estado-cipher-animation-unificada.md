# Estado de Cipher Studio unificado

## Publicación
- Remoto confirmado: https://github.com/seon4200/cipher-studio.git; rama oficial `master`.
- Rama de integración local: `integration/cipher-animation-publish-20261007`.
- SHA remoto de `master` previo: `2e1b3f13dbe04463771ad166a689f39691416729`.
- Etiqueta de la base común: `cipher-animation-unified-v1`; se fija al commit final y se verifica contra el remoto. No declarar `master` actualizado antes del merge protegido.
- Checkout principal: worktree `cipher-studio-publish-20261007`, rama `integration/cipher-animation-publish-20261007`. Próximos chats parten del tag en worktrees propios.

## Comandos
```powershell
npm ci
npm run build
npm test
npx electron .
```
`npm run dev` solo inicia Vite. FFmpeg y ffprobe por `PATH`; Animation acepta `FFMPEG_PATH`.

Vibes en Python aislado:
```powershell
python -m venv .venv-vibes
.\.venv-vibes\Scripts\python.exe -m pip install -r requirements-vibes.txt
$env:CIPHER_VIBES_PYTHON = "$PWD\.venv-vibes\Scripts\python.exe"
```

## Funciones y rutas
- Reparto inicial `[24, 18, 18, 40]`: Original, Stock, IA, Visuales. Visuales conserva su cuota.
- Construir asigna slots pendientes Animation sin catalogación/render heredado y abre Animation en el primer slot. El resumen diferencia planificados de materializados; exportación bloquea placeholders.
- Único motor de Visuales nuevos: Animation; perfil `cipher-editorial-sapphire-v1`; Canvas `public/animation-canvas/`; biblioteca procedural guardada por proyecto en `materiales/animation/library/`.
- Vibes sigue dentro de IA: bot/servicio/IPC/panel, dependencias en `requirements-vibes.txt`, perfil independiente `vibes-editorial-photographic-paper@2.0.0`. Conserva creación de imágenes, animación de imagen existente, recuperación, descarga, timeline y persistencia.
- Movimiento Vibes: sujeto completo, fondo y cámara quietos; solo apoyos especificados.
- Se conserva audio, transcripción, timeline, Original, Stock, gráficos, transiciones, exportación y proyectos históricos.
- No se halló un eliminador de fondos autónomo activo. El código `photo-cutout` está en el resolver heredado desconectado; FFmpeg y procesamiento común de imágenes siguen.

## Código heredado y retorno
- Se restauraron 476 rutas que estaban en el índice pero ausentes del árbol de trabajo; lista exacta: `docs/retired-visual-files-preserved-20261007.md`.
- 26 suites históricas siguen en disco y `tests/todas.js` las declara inactivas, no cobertura actual.
- Los puntos de entrada antiguos no son importados por `src/main/index.ts`. `visual-render.ts` rechaza `visual_*` y SceneSpec; la publicación OpenMoji retenida falla cerrando. @xmldom/xmldom y @iconify-json/solar quedaron solo en devDependencies para compilar fuentes preservadas, no en el runtime de producción.
- Punto de retorno público preintegración: `checkpoint/cipher-studio-public-base-20261007` sobre el HEAD remoto previo; no contiene cambios sin commit. El respaldo privado `cipher-before-animation-cleanup-20261007.bundle` conserva refs e historial (132 refs); verifica con `git bundle verify <bundle>` y clónalo en una carpeta nueva. Los diffs sin commit están en sidecars privados: el WIP Vibes actual `cipher-studio-round-d-prepublication-20261007-140450` conserva `staged.patch`, `working-tree.patch` y los 21 archivos no rastreados; aplica ambos parches, en ese orden, al HEAD `e73dc272` de `vibes-images-only-ui-v1`, después copia `untracked/`. El sidecar anterior `vibes-animation-return-20261007` preserva el proyecto previo y sus hashes. No apliques estos parches sobre la base unificada. El `.env` y el proyecto privado permanecen en sus checkouts originales y no se publican.
- No incluir proyectos, `.env`, referencias privadas, credenciales, trazas ni medios privados.

## Verificación
- `npm run build`: correcto; renderer, main, preload y `control-adapter.html`; advertencia de Vite sobre CommonJS.
- `npm test`: 13/13 suites declaradas verdes; `test:ventana` se excluye por fallo conocido.
- Servicio Animation en copia: escena de 90 frames y perfil activo, guardada; se eliminó solo su MP4 de caché y regeneró offline desde plan. Guardado/reapertura comprobados por servicio, no UI.
- Servicios Vibes en copia: resultados existentes con imágenes, voz, manifiestos/perfil; una única imagen existente se animó, descargó, incorporó y reabrió. No se repitió lote ni se emitió otra solicitud.
- Cuota Visuales positiva: `timelineWeights[3]` activa slots; Construir selecciona el primero y abre Animation; el backend los excluye de la cola heredada. Las suites cubren el reparto, pero el recorrido Construir→chat→aplicar→reabrir no se ha verificado con clics.
- Suites verifican reparto, persistencia, gráficos, ciclo, Animation y Vibes. No equivalen a prueba UI de Original/Stock/transiciones/exportación.
- Control separado: repo `cipher-control-web`, rama oficial remota `main` en `fcd9c19`; configuración inspeccionada desde `feat/connected-download-auth` en `9d3c142`. El fallback del launcher apunta al checkout `cipher-studio-control-adapter-visual-20261005` (HEAD `502293e`), pero `CIPHER_STUDIO_EXPECTED_COMMIT` espera `b93a6aa`; el checkout `cipher-control-adapter-current-20261005` sí está en `b93a6aa`. No se encontró override de `CIPHER_STUDIO_PATH` en proceso/usuario/máquina ni proceso Electron/Node/Python visible. No se cambió el enlace y la apertura real de Control no se probó. La validación temporal de mix quedó corregida en la PR separada #1, pendiente de merge a `feat/connected-download-auth`.

## Pendientes
- Clon limpio con `npm ci`, `npm run build`, `npm test`.
- UI: probar un único slot Visual positivo, crear/aplicar una escena corta y guardar/reabrir; no crear otro lote.
- UI: abrir proyectos históricos y resultados Vibes; verificar Original, Stock, gráficos, transiciones y exportación.
- Cambiar el launcher de Control en su rama y verificar desde UI.
- Confirmar PR/merge y SHA/tag remotos antes de declarar `master` actualizado.

## Trabajo paralelo conservado

El checkout cipher-studio-round-d permanece intacto en ibes-images-only-ui-v1, HEAD 73dc272, con 38 entradas locales (17 rastreadas y 21 no rastreadas) del trabajo de Vibes imágenes-only; su chat relacionado está inactivo. Esa copia no contiene el IPC/UI imagen→video; la rama unificada sí incorpora la ruta explícita desde imagen seleccionada, reanudación, reconciliación e importación con IDs persistidos. No se copió el WIP completo ni se repitió la generación. Su estado exacto queda en el sidecar privado indicado arriba.
