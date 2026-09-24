# Selección editorial local — corrección dirigida

Base: `e15051ea1d6968e3f4ca093fe853c6c2a618c9b6`. No se modificaron el inventario PNG250, imágenes, renderer, familias ni escenas históricas.

## Fallo observado, no inferido

El log local `cipher-studio/generation-debug.log` registra a las `2026-09-24T12:03:11Z` 19 subclips y la cuota Original 0 / Stock 7 / IA 0 / Visual 12. La construcción del proveedor termina inmediatamente con `MODULAR_ROOT_INVALID`, antes de materializar y renderizar los doce Visuales. `12/12` es el conteo de **decisiones de reparto** en el resumen incompleto; no acredita doce archivos ni clips insertados. El `project-state.json` del proyecto que antecede al intento (última escritura `12:02:20Z`, leído sin editar) guarda `visualPresentationProfile=editorial-local-bank-v2` y `modularCatalogRoot` vacío. No se comprobó la ruta del ejecutable que estaba abierto en aquel momento.

La raíz vacía viene del estado/UI por defecto si todavía no se ha elegido una biblioteca. `CuratedModularCatalogV1` exige una ruta absoluta con `inventory.json` fijado; el catálogo PNG válido está en `C:\graphify\_cipher-editorial-catalog-v1-250`. No es la biblioteca SVG del Modern Pack. Los 250 PNG siguen bajo validación de manifiesto/rol/SHA/alpha al usarse; no se desactivó ninguna guarda.

## Cambio acotado

- La UI permite seleccionar una carpeta mediante diálogo y la recuerda. Antes de cortar clips o invocar DeepSeek comprueba la biblioteca si se solicita cuota de Visuales; muestra el requisito concreto y vuelve a estado libre ante error. Con Visuales en cero no exige catálogo.
- El handler principal comprueba el catálogo después de calcular la cuota y **antes** de planificación semántica/descargas. Reutiliza ese proveedor en la fase de materialización. IPC no puede saltarse la validación de raíz.
- Sólo el selector editorial local V2 busca también pares singular/plural inequívocos y toma los conceptos explícitos del subclip aunque su etiqueta no aparezca literalmente en la transcripción. No introduce equivalencias difusas ni modifica el `search()` histórico. Registra por escena términos, candidatos por rol, match y razón de fallback, fuera de PixelIdentity.
- Gráficos sigue siendo una fase de tarjetas independiente. La regeneración de Visuales ya guardados utiliza SceneSpec/RenderBindings y ProjectAssets persistidos; no vuelve a consultar la raíz. Al abrir un proyecto, la UI recupera su raíz guardada o la preferencia local.

## Prueba acotada

El harness de selección usó frases **sintéticas** y una frase derivada de conceptos del log; no reprodujo la llamada DeepSeek de la sesión original. Para llegar al compositor usó un fixture temporal mínimo de ProjectAssets (el contrato del renderer exige `project-state.json`), no un proyecto del usuario, narración ni timeline largo. Evidencia: `C:\graphify\_cipher-editorial-selection-fix\evidence\selection-result.json`, `selection-visible.mp4`, `selection-visible-stable.png`.

| Consulta | Candidatos pertinentes | Decisión | Resultado |
| --- | --- | --- | --- |
| `Idea, Personas, Datos` | Hero h001; Supports personas/datos | Hero + 2 Supports + 3 capas | 3 s renderizados; frame estable inspeccionado; QC 0; red 0 |
| `Señal, redes, cámaras, datos` | Hero h011; Supports red/cámara/datos (plurales) | Selección automática | No se renderizó otro clip |
| `forest fire raging; bosque, incendio, temperatura` | Hero h063 bosque; 0 Supports relevantes | Fallback explicado `INSUFFICIENT_SUPPORTS` | No se inventaron incendio/temperatura |
| `quimera, salto` | Ninguno | Fallback explicado `NO_HERO` | No se afirmó asset inexistente |

La primera selección materializó seis archivos con IDs/SHA: Hero h001, Supports personas/datos y rear/accent/front l001/l036/l021; SceneSpec y RenderBindings validaron, la identidad sobrevivió serialización, y el fotograma muestra efectivamente busto/bombilla, papel y ambos iconos. Esto prueba la ruta aislada del compositor, no que el video fallido del usuario ya se haya regenerado ni que la selección semántica de todas sus frases sea rica.

## Verificación de producto pendiente del usuario

En `C:\graphify\cipher-studio-round-d`: `npm run build` y `npm run dev`. Abrir el proyecto en **esta** build, pulsar «Seleccionar carpeta» bajo «Editorial local», elegir `C:\graphify\_cipher-editorial-catalog-v1-250`, pulsar «Verificar manifiesto, PNG y SHA» y después repetir «Construir Timeline IA». Si faltan transcripción/audio/timestamps, la UI los sigue exigiendo. Revisar el número de clips `category=visual`, archivos producidos y avisos finales; no usar el conteo de cuota como prueba de render. No se cambió el proyecto existente ni se repitió su generación durante esta corrección.
