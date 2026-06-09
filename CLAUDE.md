# REGLAS PARA EDITAR CIPHER STUDIO

Lee este archivo SIEMPRE antes de hacer cualquier cambio.

---

## LO QUE FUNCIONA — NO TOCAR

### Audio y transcripción
- Whisper transcribe el video original con timestamps {start, end, text}
- DeepSeek reescribe el guión usando el prompt maestro
- ElevenLabs genera la voz clonada
- Whisper transcribe el audio nuevo de ElevenLabs con 3 reintentos
- Si Whisper falla 3 veces → error visible al usuario (NO fallback silencioso)

### Timeline y clips
- Cálculo de clips basado en frases del audio nuevo
- Sub-segmentación de frases largas (>4s en sub-clips de máximo 3s)
- Duración variable por clip según duración real de la frase
- Sincronización con timestamps reales del audio
- Mezcla de tipos: original + stock + IA intercalados
- Arrastrar y mover clips manualmente
- Pista g1 con clips de gráficos arrastrables
- Sequencer con evento ended
- Stock de Pexels con caché _raw.mp4 y recorte dinámico
- Clips IA con fal.ai/MiniMax video-01

### Sistema
- Pantalla de proyectos con persistencia
- Sistema de Undo/Redo con milestones
- Importar video local
- Autoguardado en project-state.json

---

## BUG ACTIVO A ARREGLAR

Los gráficos animados muestran solo un emoji genérico (📊) igual en todos.

Causa: el prompt actual mezcla decisión de clips y decisión de gráficos en una sola llamada a DeepSeek.

Solución aprobada — DOS llamadas separadas:
1. Llamada 1 — Solo clips visuales (lógica simple)
2. Llamada 2 — Solo gráficos con análisis profundo (lógica compleja)

---

## REGLAS DE EDICIÓN

1. Mostrar plan completo antes de implementar
2. Ejecutar npx tsc --noEmit después de cada cambio
3. NO hacer commit hasta aprobación del usuario
4. Si un cambio puede afectar algo de la lista NO TOCAR → avisar primero
5. Si hay duda → preguntar al usuario

---

## ARCHIVOS CLAVE

- src/main/index.ts — Backend Electron
- src/renderer/src/main.tsx — UI React
- src/preload/index.ts — Puente IPC
- src/preload/types.d.ts — Tipos
- src/main/services/ffmpeg.ts — FFmpeg

---

## COMMITS IMPORTANTES

- db2cefb — Estado actual funcional (clips bien)
- 66708c0 — Último estado bueno de gráficos

Si algo se rompe volver a db2cefb.
