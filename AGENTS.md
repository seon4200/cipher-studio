# CIPHER Studio — base común

Estado vigente: `docs/estado-cipher-animation-unificada.md`. Inventario de archivos heredados conservados: `docs/retired-visual-files-preserved-20261007.md`.

## Repositorio y trabajo futuro
- Repositorio: https://github.com/seon4200/cipher-studio.git; rama oficial `master`.
- La base común es `cipher-animation-unified-v1` una vez verificados el tag y el SHA remotos.
- Los próximos chats crean su propia rama o worktree desde esa etiqueta; nunca editan la carpeta compartida.
- Excluye proyectos/medios de usuario, audios/videos privados, referencias privadas, credenciales y trazas.

## Instalar y abrir (PowerShell desde la raíz)
```powershell
npm ci
npm run build
npm test
npx electron .
```
`npm run dev` inicia Vite. Para escritorio usa `npx electron .` después del build. FFmpeg/ffprobe requieren `PATH`; Animation acepta `FFMPEG_PATH`.

## Visuales y Animation
- Mantén Original, Stock, IA y Visuales como las cuatro cuotas. Una cuota Visuales positiva crea slots Animation desde Construir; no la redistribuyas ni pongas en cero.
- Construir selecciona el primer slot y abre Animation. El slot sigue pendiente hasta crear/aplicar la escena; no es un MP4 ni se exporta vacío.
- Animation es el único motor para Visuales nuevos; no consulta el catálogo heredado ni usa su renderer como fallback.
- Perfil activo: `cipher-editorial-sapphire-v1` en `src/shared/animation-style-profile-sapphire-v1.json` y `src/shared/animation-style-profile-v1.ts`.
- Canvas/fuentes: `public/animation-canvas/`; planes y módulos reutilizables por proyecto: `materiales/animation/library/`; regeneración offline desde el plan persistido.
- Conserva proyectos y clips materializados; avisa si un clip perdido requiere un motor retirado.

## Vibes, multimedia y Control
- Vibes permanece en IA, con panel, servicio, IPC y bot Python: `vibes_clips/`, `requirements-vibes.txt`.
- Perfil independiente: `vibes-editorial-photographic-paper@2.0.0` en `src/shared/vibes-editorial-photographic-paper-v2.ts`.
- Construir distingue crear imágenes de animar la imagen elegida; recupera trabajos/resultados válidos y persiste estados/IDs para no duplicar solicitudes.
- Movimiento Vibes: protagonista completo, fondo y cámara inmóviles; solo se animan los apoyos indicados.
- No se encontró un eliminador de fondos autónomo activo. `photo-cutout` sigue en el resolver heredado desconectado; conserva raster general, FFmpeg, audio y exportación.
- Cipher Control tiene repo separado. Studio conserva `control-adapter.html`. Configuración inspeccionada: el fallback apunta a `cipher-studio-control-adapter-visual-20261005` (HEAD `502293e`) pero espera `b93a6aa`; no se actualizó el enlace ni se probó desde UI. Coordina la corrección en el repo/PR separado de Control.
