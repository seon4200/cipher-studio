# MVP motor — progreso
Encargo: `C:\Users\John Benites\OneDrive\Documents\ENCARGO ÚNICO deja el motor de Visu.txt`
Adendas: conversación de esta tarea — «ADENDA 1 AL ENCARGO» y «ancla contra la compactación».

- [x] 1 · cerrar A.5 y A.6 — comprobado en `7bb62c7`, `53005aa`
- [x] 2 · B.1 contrato — `d754bf3`, `946b8cf` · tag `v-mvp-contrato`
- [x] 3 · las 43 piezas — implementadas y verificadas en este commit
- [x] 4 · las 4 paletas por vídeo — selección estable por proyecto y hash encadenado
- [x] 5 · las ~8 tipografías — 10 familias locales, métricas y SHA-256 versionados
- [x] 6 · densidades y ritmos — densidad derivada del contenido; cinco perfiles legales del ciclo
- [x] 7 · dejarlo usable (a…g) — merge `d4e11ce` (versión 9), mix `1f1a6cb`, vídeo real con 42 Visuales; evidencia e incidencias en `tests/aceptacion/mvp-paso7/INFORME.md`.

Notas de una línea (lo que vi mal y no toqué):
- Energía: el contador filtra, el selector no; 26/42 Visuales reales superan fondo+camara=3. No corregido en este cierre.
- Producción: 4/46 Visuales sin palabra (8,70%); IA 0/21, petición rechazada con Forbidden; el mix objetivo no se cumplió.
- Coste real: 51,524 ms/frame frente a 40,84; 1,567 intentos/frame; cero pérdidas y cero frames en el quinto intento. Condiciones distintas de la referencia.
- Emoji: Chrome 152 y Electron/Chromium 126 usan Segoe UI Emoji, pero dibujan versiones distintas; tres glifos comprobados, ninguno tofu.
- Tamaño de etiqueta y proximidad/solape entre vecinos siguen pendientes; una captura por pieza no certifica todos los contenidos.
- Peso visual desigual: cristales/rayosImpacto dominan; ranura del héroe y tiempo legible no calibrados.
- Contraste: clinico/calido con ondas muestran tinta oscura sobre cajas oscuras; visible en cobertura-sistema-45pct.png, sin corregir.
- Contraste entre Visuales consecutivos y fidelidad completa en movimiento quedan sin calibrar; no se confunden 41 identidades distintas con 41 diseños percibidos.
- El 4% es un umbral geométrico de ingeniería, no perceptual; la distancia implementada es media con emparejamiento voraz, no un mínimo global.

## Encargo 2 — significado

Encargo: `C:\Users\John Benites\.codex\attachments\1142dc2c-65eb-4775-ad31-6c7509e1a45e\pasted-text.txt`

- [x] 0 · fijar ANTES — `1f1a6cb`; MP4, hoja 45% y tabla ligados por los 42 hashes del vídeo real
- [x] A · energía y contraste — pares sorteables legales y caja opaca medida desde el registro compartido
- [x] B · palabra, iconos Solar y héroe — este commit; la semilla es palabra + posición estable, Solar cae a emoji y el héroe/relación salen del registro
- [x] C · contrato semántico y selección por relación — este commit; IA cerrada a enums, relación válida → estructura legal, semántica inválida cae al sorteo
- [x] cierre · DESPUÉS, comparación y clon limpio — este commit; MP4, hojas 45%, muestra desenfocada y 9/9 desde clon desechable.

Notas de una línea (lo que vi mal y no toqué):
- El paquete ANTES se reconstruyó desde los fotogramas extraídos del export original; no se volvió a renderizar ni a llamar a red.
- Solar importa su catálogo local completo (10.55 MB minificados en renderer) para mantener nombres libres sin red; queda medido, no se optimiza dentro de este encargo.
