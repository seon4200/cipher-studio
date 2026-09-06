# Reproducir la evidencia del paso 7

Ejecutar desde la raíz del repositorio con dependencias instaladas y build actual. Las medidas corresponden a la revisión indicada en `INFORME.md`; ejecutar con otro código, fuente, proyecto o versión de Chromium produce otra medición.

## Banco y emoji — sin vídeo ni APIs

En una terminal:

```powershell
npm run banco -- --port 5176
```

En otra:

```powershell
node tests/aceptacion/mvp-cobertura.cjs
npx --no-install electron tests/aceptacion/mvp-emoji.cjs
```

La cobertura usa Chrome instalado en `C:/Program Files/Google/Chrome/Application/chrome.exe` y `playwright-core` del repo. La paridad compara ese navegador con Electron y `dist/grafico.html`. Red externa bloqueada. La hoja se vuelve a guardar en esta carpeta: conservar la evidencia anterior si se quiere comparar. Cerrar Vite con Ctrl+C al terminar.

Vista manual: `http://127.0.0.1:5176/banco.html?vista=cobertura&eje=estructura&caso=estructura:constelacion&t=1.5`. Cambiar eje/caso mediante sus enlaces; `escala=1` permite inspección a 1080×1920. Las listas salen de los registros, no de un catálogo duplicado. Cada documento monta el `AnimatedGraphic` real.

## Inventario y guardias — sin render

```powershell
npx --no-install electron tests/aceptacion/mvp-inventario.cjs
npx --no-install electron tests/aceptacion/mvp-guardias.cjs nominal
npx --no-install electron tests/aceptacion/mvp-guardias.cjs controles
```

Inventario sale con 0 y requiere el proyecto local `video-3-1788402898964` para la muestra real de palabras. Las dos mutaciones deben salir con **1**: ejecutan `tests/ciclo.js` contra un contador alterado en memoria, sin editar el bundle. No forman parte de `npm test`: son pruebas negativas explícitas.

## Inspeccionar el vídeo ya generado — sin nuevas APIs

```powershell
npx --no-install electron tests/aceptacion/mvp-video.cjs
```

Requiere FFmpeg/ffprobe en PATH, el proyecto y exportación citados en `INFORME.md`, su `mvp-paso7/generar.json` y el tramo correspondiente de `generation-debug.log`. Reconstruye datos con el bundle y exige coincidencia de los 42 hashes antes de dar por buenas las condiciones. Extrae frames del MP4: **no genera otro vídeo**. El proyecto y los logs no se publican en Git porque son material local y pueden contener datos de servicios.

## Generación real — CON COSTE y cambios en el proyecto

No ejecutar esto para mirar la hoja. Solo con autorización para volver a gastar y regenerar:

```powershell
npx --no-install electron tests/aceptacion/mvp-produccion.cjs "C:\Proyectos\mi-app\cipher-studio\proyectos\video-3-1788402898964" generar
```

Reutiliza guion/voz/transcripción existentes, llama a los handlers reales de corte, generación y exportación, guarda una nueva versión del timeline y usa **caché de producción**. Conserva copias `estado-antes-*` y no sobrescribe el MP4 anterior. El modo `mix`, en vez de `generar`, solo persiste los pesos actuales del código. Watchdog de cuatro minutos sin progreso; un frame que agota cinco intentos sin validarse provoca salida 3. Un resultado de generación no vuelve deterministas las APIs ni el rasterizado: conservar cada medición con sus condiciones.
