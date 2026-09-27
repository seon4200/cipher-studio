# Pruebas de la decisión editorial ordinaria

Compilar primero (`tsc --noEmit`, `npm run build`). Los arneses cargan el bundle main.
Usar `node_modules/electron/dist/electron.exe` y esperar su **salida real**, no la
terminación inmediata de una consola que lo lance. En PowerShell:
`Start-Process -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput ... -RedirectStandardError ...`.

Variables explícitas (no escribir secretos en comandos ni logs):

- `CIPHER_EDITORIAL_MODULAR_CATALOG_PATH`: catálogo activo compatible, sólo lectura.
- `CIPHER_DECISION_EVIDENCE`: carpeta externa nueva por ejecución.
- `CIPHER_FFMPEG_EXE`: FFmpeg local; agregar su directorio al PATH del proceso para
  fijar también el encoder usado por la ruta ordinaria. No comparar SHA de MP4 sin
  registrar la versión: los píxeles pueden coincidir y los metadatos no.

Arneses:

| Archivo | Alcance |
|---|---|
| `decisions.cjs` | Contratos, recuperación, enums, omisiones y mocks acotados; verifica SHA de assets |
| `decisions.cjs --real` | Sólo decisiones con API existente; requiere autorización de envío y `CIPHER_DECISION_CASES`. No prueba UI/render. Resultado puede contener rechazos aunque el proceso termine 0 |
| `prepare-cases.cjs sources.json cases.json` (Node) | Extrae seis intervalos desde copias indicadas y añade holdout fijo; no escribe fuentes. `sources` contiene project, review y clipIds |
| `render-contracts.cjs` | Fixture dirigido Hero+un apoyo+relación; dos formatos, QC, frames y rechazo de relación forjada. No prueba selección automática |
| `replay.cjs` | Carga SceneSpec/ProjectAssets guardados; tres caches independientes por formato, red y lecturas externas bloqueadas, igualdad de contextos y MP4 |
| `compare-history.cjs before after ffmpeg output.json` (Node) | Identidad, SHA de contenedor, PNG y hash de TODOS los frames RGBA. No actualiza baselines |
| `ui-session.cjs` | Abre app real con copia y userData temporales. Nunca pulsa botones ni llama handlers por su cuenta |

Replay necesita `CIPHER_REPLAY_SOURCE_PROJECT` (proyecto materializado por render-contracts),
`CIPHER_REPLAY_SCENE_FILE` (su scene.json) y variables anteriores.
UI necesita `CIPHER_UI_SOURCE` (proyecto fuente sólo leído) y carpeta de evidencia.
Sus diálogos apuntan a la copia y a una exportación nueva. No usar originales como destino.

Guardar resultados, logs, SHA del bundle y comando/entorno de prueba. Nunca subir
casos privados, proyectos, MP4, .env ni respuestas con datos privados al repositorio.
Una prueba offline o IPC no acredita clics UI, semántica real ni sincronía perceptual.
