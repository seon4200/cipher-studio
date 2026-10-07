# Estado de Cipher Studio unificado

## Base de publicación
- Repositorio confirmado: https://github.com/seon4200/cipher-studio.git; rama oficial protegida: `master`.
- Base común: etiqueta `cipher-animation-unified-v1` sobre la rama de integración `integration/cipher-animation-publish-20261007`. La PR de Studio [#1](https://github.com/seon4200/cipher-studio/pull/1) está abierta contra `master`; la etiqueta se fijará al commit final y se comprobará en el remoto. `master` continúa en `2e1b3f13dbe04463771ad166a689f39691416729` hasta completar el merge protegido.
- Punto público previo a la integración: `checkpoint/cipher-studio-public-base-20261007`, sobre `2e1b3f13dbe04463771ad166a689f39691416729`.
- Checkout principal de esta consolidación: `C:\graphify\cipher-studio-publish-20261007`. Los chats siguientes deben crear ramas/worktrees propios desde la etiqueta común; no editar esta carpeta compartida.

## Instalar, verificar y abrir
Desde la raíz del repositorio, en PowerShell:
```powershell
npm ci
npm run build
npm test
npx electron .
```
Para el bot de Vibes:
```powershell
python -m venv .venv-vibes
.\.venv-vibes\Scripts\python.exe -m pip install -r requirements-vibes.txt
$env:CIPHER_VIBES_PYTHON = "$PWD\.venv-vibes\Scripts\python.exe"
```
`npm run dev` inicia Vite; para el escritorio se requiere build y `npx electron .`. FFmpeg/ffprobe se buscan en `PATH`; Animation acepta `FFMPEG_PATH`. El bot permite configurar el intérprete con `CIPHER_VIBES_PYTHON`.

## Funciones y rutas
- Reparto con cuatro categorías funcionales: Original, Stock, IA y Visuales. El valor inicial es `[24, 18, 18, 40]`; Visuales conserva su cuota, sin redistribuirla ni fijarla en cero.
- Una cuota Visuales positiva en Construir prepara ventanas de Animation, pasa el peso al planificador normal, crea slots pendientes `category: visual`/`animationPending`, los excluye de la cola heredada y abre Animation en el primer slot. El resumen los cuenta como pendientes, y exportar un slot vacío se bloquea.
- Animation es la única ruta de creación de Visuales nuevos. Perfil `cipher-editorial-sapphire-v1` en `src/shared/animation-style-profile-sapphire-v1.json` y `src/shared/animation-style-profile-v1.ts`; Canvas y fuentes en `public/animation-canvas/`; biblioteca procedural y módulos reutilizables por proyecto en `materiales/animation/library/`. Los planes guardados permiten regeneración offline sin proveedor.
- Vibes permanece en IA: panel, servicio, IPC y bot Python en `vibes_clips/`, con dependencias declaradas en `requirements-vibes.txt`. El perfil `vibes-editorial-photographic-paper@2.0.0` es independiente del perfil Animation. Se conservan preparación de prompts DeepSeek, creación de imágenes, animación explícita de una imagen seleccionada, recuperación/descarga/importación al timeline y estado/IDs persistidos.
- Movimiento Vibes acordado: protagonista completo; fondo y cámara inmóviles; se animan solo los apoyos indicados.
- Se conservan proyectos y clips materializados, audio, transcripción, timeline, Original, Stock, gráficos, transiciones, exportación y conexiones de Studio con Cipher Control. La carpeta `round-d` y su sidecar privado permanecen intactos; no se repitió su lote.
- Los archivos del motor/catálogo anterior rechazados para borrado permanecen en el checkout. La lista de 476 rutas preservadas está en `docs/retired-visual-files-preserved-20261007.md`; las 26 suites históricas siguen en disco y están declaradas inactivas. La inspección de imports no encontró entradas desde los entrypoints activos al catálogo/resolver/render heredados. `visual-render.ts` rechaza SceneSpec/`visual_*`; el publicador OpenMoji retenido falla cerrando. El renderer genérico de gráficos, fuentes y recursos compartidos se conserva.
- No se encontró un eliminador de fondos autónomo activo: `photo-cutout` sigue en el resolver heredado desconectado. FFmpeg y procesamiento común de imágenes continúan disponibles para Vibes, Stock y exportación.

## Retorno y privacidad
- `cipher-before-animation-cleanup-20261007.bundle` conserva refs e historial (132 refs), verificable con `git bundle verify <bundle>`. Los cambios sin commit se respaldaron por separado antes de integrar; los sidecars privados `cipher-studio-round-d-prepublication-20261007-140450` y `vibes-animation-return-20261007` guardan parches, hashes e inventario de archivos sin seguimiento para restaurar cada estado en su checkout original.
- El sidecar de round-d se aplica únicamente sobre HEAD `e73dc272` de `vibes-images-only-ui-v1`: parches staged y working tree, luego copia de `untracked/`. No aplicarlo sobre la base unificada.
- Proyectos, audios/videos privados, `.env`, referencias privadas, credenciales y evidencias/trazas locales no se publican. Los JSON de evidencia sueltos del checkout siguen sin seguimiento y excluidos de los commits.

## Verificación
### Clon limpio y servicios
- Clon limpio del commit de código `80c5cd54da2e900b060df4825ca5107b7a49fbc6`: `npm ci`, `npm run build` y `npm test` completados; 13/13 suites declaradas pasan. `test:ventana` sigue excluida por su fallo conocido documentado.
- Se retiraron del manifiesto raíz `@iconify-json/solar` y la dependencia directa `@xmldom/xmldom`; las fuentes heredadas se conservan. Solar tiene una declaración solo de tipos para que las fuentes preservadas sigan compilándose y conserva atribución CC-BY-4.0 en `src/shared/solar-nombres.ts`. `@xmldom/xmldom` aún aparece transitivamente bajo herramientas de empaquetado de desarrollo (`electron-builder` → `app-builder-lib` → `@electron/osx-sign` → `plist`); no se importa desde rutas activas. `npm audit --omit=dev` reportó 4 moderadas, 0 altas y 0 críticas; la auditoría completa reportó 9 moderadas, 20 altas y 1 crítica, principalmente en dependencias de desarrollo, pendiente actualizar sin cambios mayores automáticos.
- En el clon limpio y venv Python 3.11: `pip install -r requirements-vibes.txt` correcto, `python -m unittest discover -s tests/vibes_clips -v` 17/17 y `python -m vibes_clips --help` correcto; no se usaron credenciales ni proveedores.
- Servicio Animation sobre una copia de proyecto: una escena de 90 frames con el perfil guardado se creó, aplicó, persistió y reabrió por servicio; tras retirar únicamente su MP4 de caché se regeneró offline desde el plan. No se creó un lote.
- Servicio Vibes sobre copia: se revisaron imágenes, voz, manifiestos/perfil y controles existentes; una sola imagen existente se animó, descargó, incorporó al timeline, guardó y reabrió. No se volvió a enviar el lote.
- La ruta de Construir→Animation se confirmó por inspección de los entrypoints activos y las pruebas de reparto: `weights[3] > 0` activa ventanas; `repartoObjetivos` consume ese peso; el backend crea placeholders de Animation y excluye `visual` de la cola común; el renderer selecciona el slot y el callback de Animation permite aplicarlo al timeline. Esto es revisión de código/servicios, no una comprobación mediante clics en la UI.

### Interfaz y funciones pendientes de interfaz
- No se ejecutó la aplicación ni se hicieron clics en esta sesión; la automatización nativa de UI no estuvo disponible. Quedan por comprobar en UI: Construir con una cuota positiva, crear/aplicar/guardar/reabrir un slot, y abrir resultados Vibes existentes.
- También quedan por comprobar desde UI proyectos históricos, Original, Stock, gráficos, transiciones y exportación. Las suites y servicios cubren contratos afectados, pero no sustituyen esos recorridos visuales.
- Cipher Control, repo separado: la configuración inspeccionada en `feat/connected-download-auth` (HEAD `9d3c142`) usa como fallback `C:\graphify\_cipher-studio-control-adapter-visual-20261005` (HEAD `502293e`) aunque espera `b93a6aa`; el checkout separado `cipher-control-adapter-current-20261005` está en `b93a6aa`. No se encontró override de `CIPHER_STUDIO_PATH` ni proceso Electron/Node/Python visible, así que la configuración se inspeccionó pero su apertura real no se probó. La corrección de validación del mix está en [PR #1 de Cipher Control](https://github.com/seon4200/cipher-control-web/pull/1), pendiente de merge; no se modificó el enlace activo durante esta consolidación.

## Pendientes de cierre
- PR de Studio [#1](https://github.com/seon4200/cipher-studio/pull/1) abierta contra `master`; revisar sus checks y completar el merge protegido. `master` aún no está actualizado.
- Verificar SHA remoto de rama y etiqueta final contra el commit entregado.
- Hacer el recorrido acotado de UI indicado arriba cuando haya una sesión de aplicación disponible; no generar otro lote.
- Coordinar en la rama/PR de Cipher Control la corrección de ruta y build esperado, y probar su apertura real.
- Resolver las vulnerabilidades restantes de dependencias de desarrollo en una actualización separada revisada.
