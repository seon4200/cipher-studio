# Modern Visual Pack V1

Base: e706c9a4e613c2ba2c6b917d1bc2595111b87c64. Rama: v15-modern-visual-pack-v1.
Backup completo: C:/graphify/_safety-backups/cipher-before-modern-visual-pack-20260918-224109.bundle.
337189718 bytes; SHA256 94A6682A674CF7403E436A76D79097F8EA37B3D5CD583172BE92E86EA40A922B; bundle verify PASS.
Backup en C: no constituye redundancia física. project-state.json.bak permanece fuera de commits.

## Contrato

Pack opt-in independiente de presentación: modern-pack-100-v1 / 2026-09-v1.
95 SVG: Fluent oficial flat 35, Iconify curado 39 (MingCute solid, Phosphor regular, Lucide), Tabler outline 21.
No se importan previews, fotografías del inventario, weak/wrong ni el inventario completo.
El loader indexa el manifest; ninguna lista de assets vive en el renderer. Las fuentes y sus notices
se empaquetan en public y el build las copia a dist. No hay red en resolución/materialización/render del pack.

La política fotográfica decide primero. Sólo al llegar a icon/symbolic puede competir el pack local.
Las elecciones directas quedan intactas. Solar tiene prioridad en su vía simbólica existente.
Fluent conserva color, mono usa el system-tint existente (Porcelain cuando el perfil es Porcelain).
Tabler es support-only en V1: no se habilita una excepción Hero sin evidencia de geometría.
Hygiene y Relevance conservan reglas/umbrales. Sólo se amplía el tipo de proveedor del evaluador.
Aliases del catálogo son metadatos curados, no expansiones del ConceptLexicon ni cambios de conceptos.

SceneSpec añade únicamente catalogAsset opcional (id de pack, revisión, assetId) al slot nuevo.
SHA y tratamiento ya pertenecían a identidad. Ausencia del campo conserva la ruta histórica.
Contexto de regeneración persiste pack y elección; restore comprueba SHA/tint/rol contra el catálogo.
Provenance, URLs y licencias quedan fuera de PixelIdentity.

## Curación y límites

Se excluyeron coincidencias engañosas del inventario: computer-disk no es computer, fire-engine no es engine,
wash-machine no es machine, user-hide no representa ocultar genérico, space no prueba espacio exterior.
No se inventa un asset para historia/proyecto/resultado/construcción/uncertainty: si no hay literal
defendible se conserva Solar/OpenMoji/editorial/foto según autoridades actuales.
Variedad sólo entre candidatos de igual prioridad admisible; no se sacrifica relevancia.
Sin descargas en generación, sin SQLite, sin embeddings. Preparado para índices mayores con la misma API.

## Activación

Proyecto temporal → Biblioteca de Visuales → Modern Pack 100 V1 (experimental).
Estilo de Visuales es independiente: elegir Porcelain Editorial V1 para el piloto.
Proyectos sin visualAssetPack siguen en V15 clásica. No se migran escenas ya persistidas.

## Evidencia ejecutada

TypeScript y build: exit 0. Bundle evaluado SHA256:
fb33cedc6628d056a67bcaa90593dd8366b785e654946e74247c1956dc1aea5f.
Artefactos comprobados: main 1,400,956 bytes, preload 4,981 bytes, index.html 613 bytes;
95 assets copiados a dist. Medición sobre la base citada más los cambios de esta rama,
identificados por ese hash de bundle, no atribuida falsamente al commit base.
Prueba dirigida final: exit 0; 95 hashes/avisos, 28 escenas, rutas explícitas,
color, límites de slots, integridad de publicación, índice literal, antirrepetición entre
alternativas equivalentes, identidad y regeneración (mismos bytes MP4 cacheados).

UI real compilada + preload + IPC: proyecto nuevo temporal; legacy por defecto, selección
modern-pack persistida en disco e independiente de premium-type-color-v1. Comprobación
automatizada, no revisión estética humana. Selector dentro del viewport de prueba (739 px altos).

Aceptación sintética congelada: 20 principales + 8 resistencias en 540x960 y 960x540, 24 fps,
2 s por escena, DPR simulado 2.25. Seis comparaciones complementarias, separadas del corpus,
aseguran 13 A/B con cambio efectivo de asset y exactamente igual presentación.
29 pares tienen presentación idéntica en total; 16 de ellos preservan el asset anterior.
Cinco pares ganan Supports y por tanto NO se presentan como A/B de geometría fija.
No hay SceneSpecs finales construidas a mano: se usa contexto semántico controlado,
materializador/compositor real y ProjectAssets. Los MP4 son demostraciones visuales sin audio.

102 archivos de escena producidos; cero visual-sin-fichero, errores QC y peticiones de red
durante render. Todos los casos regenerados conservaron identidad. Las fotos usan respuestas
capturadas y fuentes locales opacas ya existentes; no se afirma búsqueda fotográfica en vivo.
Un Hero cutout y un Hero full-raster sobreviven. El tramo moderno reutilizó el recorte
materializado por el tramo legacy: no se cuenta ese uso como inferencia nueva.

## Métricas (universo principal: 28 escenas, sin sumar el suplemento)

| Métrica | Resultado |
|---|---:|
| Conceptos del catálogo / aliases ES+EN | 63 / 95 |
| Fluent Hero / Support | 9 / 4 |
| Iconify Hero / Support | 1 / 4 |
| Tabler Hero / Support | 0 / 3 |
| Modern Hero / Support | 10 / 11 |
| OpenMoji fallback / elección directa conservada | 4 / 1 |
| Solar / fotos (cutout + full-raster) | 3 / 2 |
| Candidatos locales evaluados / rechazados por Relevance | 33 / 0 |
| Original-color / mono tintado del pack | 20 / 8 |
| SVG inválidos / SHA duplicados / rechazos por licencia del subset | 0 / 0 / 0 |

El suplemento tiene seis Heroes Fluent adicionales; no se mezcla con los conteos anteriores.
Hay 11 términos distintos sin coincidencia local, no 11 fallos de escena:
maquina, resultado, scientist, archivo, peligro, proyecto, plan, incertidumbre, violin,
1f382 y birthday cake. Los dos últimos son consultas auxiliares; la ruta directa 1F382
sigue resolviéndose con OpenMoji. Máquina mantiene el bloqueo de promoción del gate existente.

Rendimiento sobre 13 pares A/B sin cache, misma resolución/duración/paleta:
51.05 ms/frame legacy y 50.22 modern. Incluye preparación y encoder; diferencia pequeña,
sin afirmar mejora de velocidad. Todos los casos usan Porcelain Cobalt.

## Artefactos y reproducción

Raíz externa: `C:/graphify/_modern-visual-pack-evidence/`.

- `modern-vs-legacy.html`: 13 cambios de asset controlados y cinco ampliaciones separadas.
- `final/modern-pack-100-catalog.html`: catálogo completo y hashes.
- `final/fluent-gallery.html`, `iconify-gallery.html`, `tabler-support-gallery.html`,
  `openmoji-fallback-gallery.html`: revisión por fuente.
- `final/modern-pack-vertical.mp4`, `modern-pack-horizontal.mp4`: 12 escenas, 24 fps, 24 s.
- `final/frames/`: corpus principal y resistencias en ambos formatos.
- `final/evidence.json`, `supplementary-isolated/evidence.json`, `summary.json`, `ui-check.json`.

Después de `npm run build`, ejecutar serialmente:

```powershell
npm run test:modern-visual-pack-v1
.\node_modules\.bin\electron.cmd tests/aceptacion/modern-visual-pack-v1/generar.cjs C:\graphify\_modern-visual-pack-new-evidence
.\node_modules\.bin\electron.cmd tests/aceptacion/modern-visual-pack-v1/ui-check.cjs
npm test
```

El generador rechaza sobrescribir evidence.json. El corpus fotográfico local del spike debe
existir para reproducir esta aceptación sin descargas; no es una dependencia del producto.
Las fuentes productivas del pack sí quedan incluidas en dist y el empaquetado existente.

## Incidencias conservadas y límites

1. Primera aceptación: falló una aserción del arnés que asumía geometría fija en los primeros
   12 casos. Cinco casos incorporan Supports antes ausentes. Se conservó progress.json y se
   separaron esos cambios de los A/B; no se modificó layout ni se falseó la comparación.
2. Durante revisión se detectó que aliases amplios podían proponer microscope para scientist.
   El adaptador nuevo quedó limitado a identidad literal del concepto + aliases curados del pack,
   no aliases metafóricos del retrieval. Relevance/Hygiene y corpus original no se modificaron.
3. Primer suplemento: 18 archivos correctos pero exit 1 offline por carga de voces ElevenLabs
   de la UI. Log preservado. El arnés ahora aísla sólo get-elevenlabs-voices; toda la red sigue
   denegada. Repetición del suplemento: exit 0, cero intentos HTTP.
4. Dos pruebas iniciales de UI tuvieron timeout de automatización: selector del botón Guardar
   y throttling de la ventana oculta. Se corrigió sólo el arnés; la prueba final pasa.
5. El primer runner detectó que la muestra de roundtrip de persistencia no incluía el nuevo
   campo visualAssetPack. Se amplió la muestra; no se desactivó su comprobación exhaustiva
   de campos, restauración y dependencias de guardado.

Fluent es Flat SVG, no una promesa de 3D ni una certificación de estilo adulto/premium.
Las composiciones y tamaños actuales de fotos permanecen; esta entrega no los rediseña.
No se amplían conceptos para cubrir vacíos ni se fuerza que toda escena use un asset nuevo.
La variedad rota sólo alternativas de igual prioridad; no sacrifica fuente/coherencia por variedad.
VERSION_PLANTILLAS=15. Perfiles/familias/motion/cutout y políticas semánticas no cambian.
Deudas previas semánticas y licencias de pesos cutout permanecen abiertas.

Runner global inicial: 34/35, exit 1, única falta: muestra de persistencia sin el nuevo campo.
Roundtrip ampliado standalone: exit 0. Runner global final: 35/35, exit 0,
`C:/graphify/_modern-visual-pack-evidence/global-after-persistence.log`.
No se repitió hasta elegir un verde: hubo una corrección explícita de cobertura de prueba,
sin cambios productivos entre los dos runners. Se conserva global-final.log (primer resultado).
La exclusión preexistente de test:ventana no se alteró ni se añadieron exclusiones.

D-Final, Hygiene, Relevance, Photo Cutout, Photo Representation, Editorial Pilot, Motion Graphics,
Black Foundation, Color System, Visual Recovery/Text Fit y Premium Type & Color: PASS.
Históricos: fixtures de identidad/píxeles PASS; no reapareció la intermitencia histórica conocida
en estas ejecuciones, lo que no equivale a declarar que nunca pueda repetirse.
El guard de aislamiento del runner mantuvo project-state.json/.bak y estados de proyectos reales.
SHA .bak final: F24A2BF434DB6601785AA5F62B0427E67DA85655B22C9776A6DEE8BE984FF66B.

technicalVerdict = PASS.
visualVerdict = PENDING_HUMAN_REVIEW.
