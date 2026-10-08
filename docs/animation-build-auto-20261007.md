# Construir → Animation: estado de implementación

## Base y retorno

- Repositorio: `https://github.com/seon4200/cipher-studio.git`; rama oficial: `master`.
- Rama aislada de esta continuación: `work/animation-auto-visuals-20261007`.
- Base local: commit `3ddbf01c948dfc138a2217e7178cd3061f5c6432`, con la corrección de navegación transcripción → guion → audio → estilo.
- Retorno completo previo a los cambios: etiqueta `checkpoint/animation-auto-before-20261007`, apuntando a esa misma base. Esta etiqueta conserva HEAD; el worktree queda separado y los proyectos de aceptación están fuera de Git.
- Los próximos chats deben crear una rama/worktree propios desde la versión acordada; no compartir una carpeta activa.

## Comportamiento implementado

- Construir en un proyecto nuevo conserva la planificación normal y, después de asignar la mezcla, procesa en serie los slots Visuales pendientes por Animation.
- En un proyecto con mezcla existente, Construir salta la planificación, el corte y la selección de medios. Continúa únicamente sus slots pendientes.
- La cola espera trabajos Animation activos y busca borradores válidos para el mismo ID, intervalo, narración y perfil antes de llamar al modelo. Si falta el MP4, vuelve a renderizar desde el código/plan persistido sin repetir la dirección del modelo.
- Cada solicitud recibe la cita literal con sus tiempos, contexto vecino separado, ID e intervalo exactos, duración, formato, perfil de Animation y referencias privadas del proyecto. La dirección exige Canvas procedural y descarta el catálogo antiguo.
- La salida se valida contra el slot, se aplica por ID aunque cambie la selección de la interfaz y se guarda antes de continuar al siguiente. El estado registra cola, generación, render, aplicación, éxito o error. Un fallo deja el slot pendiente y diagnosticado; no lo sustituye por Original, Stock ni un placeholder exportable.
- El botón Cancelar Animation detiene nuevos despachos, solicita cancelar solo el trabajo de esta cola y deja el slot recuperable. Cambiar de proyecto invalida las escrituras y las aplicaciones tardías.
- Las escrituras automáticas tienen alcance al proyecto que inició la tarea; el IPC rechaza una ruta distinta si el usuario cambió de proyecto. El estado del timeline se fusiona con el más reciente para conservar otros medios y ediciones concurrentes.

## Instalación y arranque

Desde `C:\cipher-control-web\_studio-work-animation-build-20261007` en PowerShell:

```powershell
npm ci
npm run build
npx electron .
```

El build deja `dist/` y `dist-electron/` dentro de esta misma carpeta. Para abrir la copia de aceptación se debe seleccionar su proyecto desde la aplicación; su carpeta no forma parte del repositorio.

## Verificación y pendientes

- Prueba automática de cola: secuencia, exclusión de Stock, cuota de perfil/referencias/formato, espera de tareas activas, recuperación de plan, replay offline, aplicación por ID, reintento de errores y protección al cambiar de proyecto.
- También se ejecutaron los contratos de navegación Animation y del chat/director existente.
- `npm run build` terminó correctamente en el worktree aislado.
- La copia autocontenida de aceptación conserva 22 entradas de timeline, 16 clips de video, cuota Visuales positiva (33%) y cinco slots Visuales pendientes; sus 13 referencias de medios resuelven dentro de la copia. La fuente permanece intacta. Los datos privados de proyecto y medios quedan fuera del repositorio.
- La aceptación real en Electron está pendiente: Computer Use devolvió `apps: []`, por lo que no fue posible confirmar ni controlar una ventana. El build y los contratos no demuestran una generación desde la interfaz.
- No se enviaron solicitudes a Codex ni a proveedores de medios durante estas pruebas; generación/render/aplicación reales son 0/0/0. Vibes, IA, Stock y MiniMax quedaron fuera de esta continuación.
- Pendiente de interfaz: desde Construir, completar los cinco slots del proyecto de aceptación; comprobar cinco MP4 reproducibles en sus intervalos, guardado/reapertura, segunda ejecución sin nuevas llamadas y conservación de los demás medios. No declarar esos Visuales completados antes de esa prueba.
- No se declara aceptación ni publicación en `master` hasta completar la prueba de interfaz. La etiqueta de retorno local conserva exactamente el HEAD previo a esta implementación; cualquier rama de revisión debe indicar que la aceptación Electron sigue pendiente.
