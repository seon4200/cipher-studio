# CIPHER Studio — base común

Estado vigente: `docs/estado-cipher-animation-unificada.md`. Inventario de archivos heredados conservados: `docs/retired-visual-files-preserved-20261007.md`.

## Repositorio y trabajo futuro
- Repositorio: https://github.com/seon4200/cipher-studio.git; rama oficial protegida `master`.
- Base común de salida: etiqueta `cipher-animation-unified-v1`; comprueba que el tag remoto exista antes de usarlo. La PR contra `master` sigue el procedimiento protegido normal.
- Cada chat trabaja en una rama/worktree propios, desde la etiqueta común; nunca se edita simultáneamente la carpeta compartida.
- Ejemplo PowerShell para iniciar trabajo aislado (elige un `$tema` único):
  ```powershell
  $tema = "mi-tarea"
  git fetch origin --tags
  git worktree add "..\cipher-studio-work-$tema" -b "work/$tema" cipher-animation-unified-v1
  ```
- Excluye proyectos/medios de usuario, audios/videos privados, referencias privadas, credenciales y trazas. Antes de publicar, revisar `git status` y añadir rutas explícitas.

## Instalar y abrir
Desde la raíz, en PowerShell:
```powershell
npm ci
npm run build
npm test
npx electron .
```
FFmpeg y ffprobe requieren `PATH`; Animation admite `FFMPEG_PATH`. Para el bot Vibes, crea un venv e instala `requirements-vibes.txt`; consulta el documento de estado para asignar `CIPHER_VIBES_PYTHON`.

## Visuales y Animation
- Mantén Original, Stock, IA y Visuales como cuatro cuotas funcionales. Visuales no se redistribuye ni se pone en cero.
- Una cuota Visuales positiva fluye desde Construir al planificador Animation. Animation es la única ruta de creación de Visuales nuevos; nunca volver al catálogo/render heredado como fallback.
- Después de planificar slots, Construir genera y aplica en serie cada Visual pendiente mediante Animation, por su ID estable. Si el proyecto ya tiene mezcla y slots, reanuda solo esos pendientes y no vuelve a cortar ni seleccionar medios.
- Antes de despachar, la cola espera trabajos Animation activos y recupera borradores compatibles; puede regenerar el MP4 desde el plan/código guardado sin volver a llamar al modelo. Un fallo conserva el diagnóstico y deja el slot reintentable, sin sustituirlo por Original, Stock ni una pantalla vacía.
- Cada plan conserva el perfil vigente, la cita literal temporizada, el contexto vecino separado, el intervalo, la duración, el formato y referencias privadas del proyecto. El slot solo cuenta aplicado cuando tiene render y vínculo Animation persistidos.
- Perfil activo: `cipher-editorial-sapphire-v1` en `src/shared/animation-style-profile-sapphire-v1.json` y `src/shared/animation-style-profile-v1.ts`.
- Canvas/fuentes: `public/animation-canvas/`; planes y módulos reutilizables por proyecto: `materiales/animation/library/`; admite regeneración offline desde el plan persistido.
- Los motores/catálogos antiguos permanecen en disco por ahora; consulta el inventario. No borrar por coincidencia de nombre ni reactivar sus conexiones. Conserva geometría, gráficos, fuentes, paletas, cámara y movimiento compartidos que se usan.
- Conserva proyectos y clips materializados. Si un medio falta y requiere un motor retirado, explica la incompatibilidad sin fallback ni conversión silenciosa.

## Vibes, multimedia y Control
- Vibes permanece en IA, con panel, servicio, IPC y bot Python en `vibes_clips/`; dependencias declaradas en `requirements-vibes.txt`.
- Perfil independiente: `vibes-editorial-photographic-paper@2.0.0` en `src/shared/vibes-editorial-photographic-paper-v2.ts`.
- Construir distingue crear imágenes de animar la imagen elegida; recupera resultados/trabajos válidos y persiste estado/IDs para evitar solicitudes duplicadas.
- Movimiento Vibes: protagonista completo, fondo y cámara inmóviles; solo se animan los apoyos indicados.
- Cipher Control tiene repo separado. Studio conserva `control-adapter.html`; coordina los cambios del enlace/build esperado en el repo y PR propios de Control. Ver estado para la configuración inspeccionada y sus pendientes de interfaz.
- `photo-cutout` sigue en un resolver heredado desconectado; no retires procesamiento general de imagen, FFmpeg, audio ni exportación.

## Estado de la continuación Construir → Animation
- La rama `work/animation-auto-visuals-20261007` parte de la corrección de navegación `3ddbf01c948dfc138a2217e7178cd3061f5c6432`; retorno: etiqueta local `checkpoint/animation-auto-before-20261007`.
- El resumen y las verificaciones de esta continuación están en `docs/animation-build-auto-20261007.md`. La prueba de aceptación desde la interfaz Electron sigue pendiente cuando Computer Use no expone la ventana.

## Continuación fase 1: integridad de Construir
- Estado y límites: `docs/fase-1-construir-integridad.md`. Esta rama continúa `98521eb`;
  no volver a la etiqueta común anterior sin integrar la continuación pertinente.
- Cuotas nuevas: restos mayores entre cuatro fuentes; un cero no recibe espacios ni despachos.
  No cambiar de origen automáticamente ante un fallo, aunque la alternativa tenga peso positivo.
- Construir guarda el plan antes de preparar medios. La cola común reintenta por ID/intervalo/plan,
  conserva resultados terminados y guarda recibos del mismo trabajo. Después continúa Animation.
- El audio usa procedencia explícita y segmentos vinculados; no nombres visibles ni igualdad de listas.
- «Listo» requiere medios y guardado; exportación es una acción distinta. Preservar errores pendientes.
- Añadir `npm run test:build-integrity` a las verificaciones afectadas. La aceptación visible de
  la interfaz sigue pendiente; el estado de las suites Electron está en el documento de fase.
- Las migraciones OpenAI/DeepSeek, Vibes/MiniMax, Estilos y retirada de motores son fases posteriores.
