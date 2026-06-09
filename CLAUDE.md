# CIPHER Studio — Guía para Claude

## Qué es esta app

**CIPHER Studio** es un editor de video con IA para escritorio, construido con Electron.
Su propósito es automatizar la creación de videos cortos (reels/shorts) en un flujo completo:
transcripción → reescritura de guion → síntesis de voz → montaje automático con clips originales, stock e IA → exportación.

Autor: **John Benites**
Versión: 1.0.0
Licencia: MIT

---

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime de escritorio | Electron | 31 |
| UI | React | 19 |
| Lenguaje | TypeScript | 5.4 |
| Build / Dev server | Vite + vite-plugin-electron | 5.2 / 0.28 |
| Estilos | Tailwind CSS | 4 |
| Iconos | Lucide React | 0.475 |
| Estado global | Zustand | 5 |
| Font | Outfit (Google Fonts) | — |
| Paleta principal | `#0f172a` (fondo) · `#00d4ff` (acento cyan) · `#7F77DD` (acento violeta) | — |

---

## Estructura de archivos fuente

```
cipher-studio/
├── src/
│   ├── main/
│   │   ├── index.ts              ← Proceso principal Electron (2082 líneas). TODO el IPC vive aquí.
│   │   ├── services/
│   │   │   └── ffmpeg.ts         ← getVideoDuration, generateVideoThumbnail, formatTimeMinutesSeconds
│   │   ├── ipc/
│   │   │   ├── ai.ts             ← Vacío (reservado para refactor futuro)
│   │   │   ├── files.ts          ← Vacío (reservado para refactor futuro)
│   │   │   └── video.ts          ← Vacío (reservado para refactor futuro)
│   │   └── utils/index.ts        ← Vacío (reservado para utilidades futuras)
│   ├── preload/
│   │   ├── index.ts              ← contextBridge: expone window.electronAPI al renderer
│   │   └── types.d.ts            ← Tipos TypeScript de window.electronAPI
│   └── renderer/
│       ├── index.html            ← Entry HTML (monta #root)
│       ├── vite.config.ts        ← Config Vite del renderer
│       └── src/
│           ├── main.tsx          ← UI completa (5478 líneas). Un único componente App + AnimatedGraphic.
│           └── styles/globals.css ← Tailwind + animaciones custom para gráficos
├── proyectos/                    ← Proyectos del usuario (cada uno es una carpeta con project-state.json)
├── banco-clips/                  ← Clips globales: originales/, stock/, veo3/, thumbnails/
├── .env                          ← API keys (NO commitear)
├── vite.config.ts                ← Config Vite raíz (entry: src/main/index.ts + src/preload/index.ts)
├── package.json
├── tsconfig.json
└── CLAUDE.md                     ← Este archivo
```

---

## APIs integradas

Todas las keys viven en `.env` en la raíz. El proceso principal las carga manualmente con `loadEnv()` porque Electron no procesa `.env` automáticamente.

| Variable | Servicio | Para qué se usa |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek (`deepseek-chat`) | Reescribir guion, decidir tipo de clip por fragmento, generar datos para gráficos animados, regenerar gráficos |
| `ELEVENLABS_API_KEY` | ElevenLabs | Síntesis de voz TTS. Voz clonada principal: ID `c9cmyX6CFsCvEKNVoCZ1` |
| `FAL_KEY` | fal.ai / MiniMax `video-01` | Generación de clips de video por IA (6s → recortados a 3s) |
| `PEXELS_API_KEY` | Pexels Videos API | Descarga de clips B-roll de stock según keyword |

---

## Flujo de producción completo

```
1. Usuario importa video original
        ↓
2. Whisper (local, modelo tiny, español)
   → Transcripción con timestamps → transcriptSegments[]
        ↓
3. DeepSeek rewrite-transcript
   → Reescribir guion según prompt-maestro.txt
   → cleanMarkdown() limpia el output antes de mostrarlo
        ↓
4. ElevenLabs generate-voice
   → TTS del guion reescrito
   → Guarda MP3 en proyectos/<id>/voices/
   → Retorna filePath + audioUrl (base64) + durationSeconds
        ↓
5. DeepSeek generate-timeline-assets (el handler más complejo)
   FASE 1: Calcular totalClips = ceil(audioDuration / 3)
   FASE 2: DeepSeek decide para cada fragmento:
           type: 'original' | 'stock' | 'ia'
           + timestamp (para original)
           + keyword (para stock, búsqueda Pexels en inglés)
           + prompt (para IA, generación MiniMax)
           + graphic: datos del gráfico animado superpuesto (puede ser null)
   FASE 3: Procesamiento paralelo con pool de 3 workers:
           - 'original' → FFmpeg: corta 3s desde timestamp del video original
           - 'stock'    → Pexels API → descarga → FFmpeg: recorta/escala a 3s
           - 'ia'       → fal.ai/MiniMax → descarga → FFmpeg: recorta a 3s
           (fallback automático a 'original' si falla stock o IA)
   FASE 4: Rellenar con duplicados si faltan clips
   FASE 5: Ensamblar timeline secuencial, recortar último clip al audio,
           crear clips de tipo 'graphic' paralelos a los clips de video
        ↓
6. Timeline resultante en el renderer
   → Clips de video (type: 'video') alineados magnéticamente
   → Clips de audio (type: 'audio') con la voz generada
   → Clips de gráfico (type: 'graphic') superpuestos, duración 2s
        ↓
7. Usuario edita manualmente (drag, trim, split, delete, undo/redo)
        ↓
8. Exportar → FFmpeg concat + crop + scale → MP4 o MOV
```

---

## Gráficos animados (AnimatedGraphic)

El componente `AnimatedGraphic` renderiza 17 tipos de gráficos animados superpuestos en el canvas de preview durante la reproducción:

`barra_horizontal` · `barra_vertical` · `barras_comparativas` · `donut` · `contador` · `comparacion_antes_despues` · `lista_numerada` · `checklist` · `pasos_proceso` · `flecha_crecimiento` · `flecha_caida` · `multiplicador` · `fraccion` · `ranking_top3` · `dato_grande` · `frase_clave` · `decorativo_emoji`

Los gráficos se muestran al inicio de cada clip (fade in 1.7s → fade out a 2s) solo durante reproducción activa.

---

## Manejo de proyectos

- Cada proyecto es una carpeta en `proyectos/<slug-nombre>-<timestamp>/`
- Contiene `project-state.json` con todo el estado serializable
- Carpetas internas: `voices/`, `temp/originales/`, `temp/remotion/`, `temp/hyperframes/`, `temp/minimax/`, `temp/stock/`, `temp/thumbnails/`
- `temp/` se limpia automáticamente al cargar o cerrar un proyecto (`cleanupProjectTemp`)
- `activeProjectPath` es una variable de módulo en el proceso principal que persiste entre llamadas IPC

---

## IPC completo (window.electronAPI)

Todos los handlers están en `src/main/index.ts`. El preload los expone vía `contextBridge`:

| Handle / Event | Dirección | Descripción |
|---|---|---|
| `start-transcription` | send → on | Inicia Whisper con streaming de progreso |
| `transcription-update` | main → renderer | Progreso y resultado de Whisper |
| `rewrite-transcript` | invoke | Reescribir guion con DeepSeek |
| `generate-voice` | invoke | TTS con ElevenLabs |
| `generate-minimax-video` | invoke | Generar un clip de video con fal.ai/MiniMax |
| `generate-timeline-assets` | invoke | Pipeline completo de montaje automático |
| `generation-progress` | main → renderer | Progreso clip a clip del pipeline |
| `regenerate-graphics` | invoke | Regenerar solo los gráficos del timeline con DeepSeek |
| `cut-video-clips` | invoke | Cortar video en segmentos de 3s con FFmpeg |
| `load-bank-clips` | invoke | Listar clips de una categoría del banco |
| `delete-bank-clip` | invoke | Eliminar clip del banco |
| `export-video` | invoke | Exportar timeline a archivo final con FFmpeg |
| `list-projects` | invoke | Listar proyectos guardados |
| `create-project` | invoke | Crear nuevo proyecto |
| `load-project` | invoke | Cargar proyecto existente |
| `close-project` | invoke | Cerrar proyecto activo y limpiar temp |
| `delete-project` | invoke | Eliminar proyecto (carpeta completa) |
| `delete-all-projects` | invoke | Eliminar todos los proyectos |
| `save-project-state` | invoke | Guardar estado JSON del proyecto activo |
| `load-project-state` | invoke | Cargar estado JSON del proyecto activo |
| `save-project-as` | invoke | Guardar con diálogo de sistema |
| `open-project` | invoke | Abrir con diálogo de sistema |
| `clear-global-stock-cache` | invoke | Limpiar banco global de stock |
| `read-file-as-blob` | invoke | Leer archivo local como buffer (bypass webSecurity) |
| `get-elevenlabs-voices` | invoke | Listar voces disponibles en ElevenLabs |
| `save-before-close` | main → renderer | Pedir guardado antes de cerrar |
| `ready-to-close` | send | Renderer confirma que puede cerrarse |

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+B` | Cortar clip en el playhead |
| `Ctrl+Z` | Deshacer (milestone history) |
| `Ctrl+Y` | Rehacer |
| `Ctrl+A` | Seleccionar todos los clips de video |
| `Delete` / `Backspace` | Eliminar clips seleccionados |
| `Ctrl++` | Zoom in en timeline |
| `Ctrl+-` | Zoom out en timeline |
| `Ctrl+Scroll` | Zoom in/out en timeline (no-passive wheel) |

---

## Dependencias externas requeridas en el sistema

Estos binarios deben estar instalados y en el PATH del sistema para que la app funcione:

| Binario | Para qué |
|---|---|
| `ffmpeg` | Cortar, concatenar, escalar y exportar videos |
| `ffprobe` | Obtener duración de videos |
| `whisper` | Transcripción de audio local (modelo tiny, español) |

---

## ⚠️ REGLAS — Qué NUNCA debes tocar o romper

### 1. El archivo `.env` — solo leer, nunca modificar ni commitear
Las keys de DeepSeek, ElevenLabs, fal.ai y Pexels están ahí. Si necesitas agregar una key nueva, agrégala. Nunca elimines las existentes ni las expongas en código fuente.

### 2. La función `loadEnv()` en `src/main/index.ts`
Es el mecanismo que carga el `.env` manualmente porque Electron no tiene dotenv incorporado. No la elimines, no la reemplaces con `import 'dotenv/config'` sin verificar que funcione en el contexto empaquetado. Se llama con `force=true` en handlers que necesitan keys frescas.

### 3. El `contextBridge` en `src/preload/index.ts`
Es la única puerta entre el renderer y el proceso principal. `nodeIntegration: false` + `contextIsolation: true` es intencional por seguridad. Nunca actives `nodeIntegration: true`. Si agregas un nuevo handler IPC en `main/index.ts`, debes exponerlo también aquí y en `types.d.ts`.

### 4. `webSecurity: false` en la ventana
Está activado deliberadamente para poder reproducir archivos locales con `file:///` URLs en el `<video>` del renderer. No lo cambies sin resolver primero el acceso a archivos locales de otra manera.

### 5. El pipeline `generate-timeline-assets` — no romper el contrato de retorno
El renderer espera `{ success: boolean, clips: TimelineClip[] }` donde cada clip tiene `id`, `name`, `path`, `url`, `startSeconds`, `durationSeconds`, `type`, `thumbnailUrl`, y opcionalmente `graphicData`. Cambiar esta forma rompe el montaje automático completo.

### 6. La voz clonada de John — ID `c9cmyX6CFsCvEKNVoCZ1`
Este voice_id es el clon de voz personal del usuario. Es el valor por defecto hardcodeado en múltiples lugares. Si refactorizas la selección de voz, asegúrate de que este ID siga siendo el default cuando ElevenLabs no devuelva la lista.

### 7. `activeProjectPath` en el proceso principal
Es la fuente de verdad sobre qué proyecto está activo. Todos los handlers de IPC la usan para saber dónde escribir archivos. Nunca la resetees a `null` en un handler que no sea `close-project` o `delete-project`.

### 8. La lógica magnética del timeline (`applyMagneticLayout`)
Los clips de video se reordenan automáticamente sin gaps. Los clips de tipo `'audio'` y `'graphic'` se excluyen de este cálculo. No cambies este comportamiento sin entender que el renderer depende de que `startSeconds` sea continuo para la reproducción sincronizada.

### 9. Los 17 tipos de gráficos en `AnimatedGraphic`
DeepSeek genera los `type` de gráficos como strings. Si renombras un tipo en el componente React, debes actualizar también el prompt que se le manda a DeepSeek en `generate-timeline-assets` y `regenerate-graphics`, o los gráficos se romperán silenciosamente (caen al `default` del switch).

### 10. La carpeta `temp/` dentro de cada proyecto
Se limpia automáticamente al abrir y al cerrar un proyecto. Nunca guardes archivos que el usuario deba conservar en `temp/`. Los archivos definitivos van en `voices/` (voces generadas) o en el banco global `banco-clips/` (stock cacheado).

### 11. El sistema de milestone history (undo/redo)
`pushMilestone` guarda snapshots de estado completo. No uses `setTimelineVideoClips` directamente en operaciones de edición sin llamar `pushHistory` después, o el undo/redo quedará inconsistente.

### 12. `prompt-maestro.txt`
Es el prompt del sistema que controla el estilo del guion reescrito. Está en `src/prompt-maestro.txt`. No lo elimines ni lo muevas sin actualizar las rutas de búsqueda en el handler `rewrite-transcript`.
