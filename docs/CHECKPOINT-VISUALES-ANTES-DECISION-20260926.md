# Punto de retorno: Visuales antes de la siguiente decisión

Este checkpoint conserva el código y las pruebas pendientes sobre `bea5d5d3303e7919663c7d20fba171d645d53b5c` en una rama nueva. No representa la aprobación editorial del producto.

## Estado funcional comprobado

- La ruta ordinaria de Cipher construyó y exportó, desde copias temporales de dos proyectos, videos con audio de 30 y 19 clips. Los Visuales materializados fueron 16/16 y 11/11; ninguno quedó sin MP4. Se probaron guardado, reapertura y regeneración de esos 27 Visuales.
- El flujo editorial continúa **PARTIAL**: 21 de 27 escenas Visuales quedaron tipográficas, sólo seis usaron Hero, una usó Support y ninguna incorporó rear/front. Hay extractos gramaticalmente incompletos, selección Stock todavía poco contextual y un gráfico cuya cifra discrepa de la voz.
- `tsc --noEmit`, `vite build`, 13 comprobaciones dirigidas del contrato nuevo, crop Stock 9:16/16:9 y paridad histórica V3 se reportaron PASS sobre este contenido pendiente antes del commit. El runner global final, un video nuevo ciego completo y reproducción perceptual integral con audio **no** se certificaron.
- El informe y los artefactos de esas comprobaciones permanecen fuera del repositorio en `C:\graphify\_cipher-scene-corrections-20260927\INFORME-ETAPA-1.md` y sus subcarpetas. Los resultados previos no sustituyen verificaciones futuras de una mejora nueva.

## Catálogo externo utilizado

La ubicación de prueba es `C:\graphify\_cipher-editorial-catalog-v1-250`. El nombre histórico de carpeta no define el tamaño: el inventario registrado contiene **390 activos** (250 base y 140 de 20 lotes activos). Revisión de ampliación: `editorial-modular-catalog-2026-09-ext-v2`.

| Manifiesto o índice | SHA-256 |
|---|---|
| `inventory.json` | `AB3957A29D0A18540770AFBFC2EB9F9565E00E4FDF3CC24C249CF07C7994FF79` |
| `extension-v2/active.json` | `045505406EA8F8081A060A268E7A61A03B3E94591B4E428FDF22F12DE97CDED9` |
| `inventario-vigente-390.json` (índice informativo) | `442BE74CFCF4330100443224898EAF1D39CDF2FD0940683E1A876B2D09833080` |

Cada SHA declarado por `active.json` coincidió con su manifiesto físico al crear este checkpoint:

```text
batch-p20-01 fff0a239f57c5cd4c5b8633fbdf14288a4f9507afeb336adcdd7043d3af6a1bb
batch-p20-02 8706e5187892c41e850e75939d99c86a3b41e2f773dd00f7df7485e90ac0bfc7
batch-p20-03 689a9a35bbcaab241cd07329349e6d14fadcabd3e2e2f689f2a19b2adf4cdfc6
batch-p20-04 47c3e4e86f3f6b9479741628cc1189cdc7cb844fb2b9adbc96d59b693b3b5765
batch-p20-05 62b4feac49e803b65a0b19734f83bb6812f9e11014799a822518183be3f82a9b
batch-p20-06 069bd3cf5c0fd8622b5a35f66817efab5b4bf1cd6bc6cd14e8160357d0bdac01
batch-p20-07 1c6fcc4dd468cc6ec7fe48339cba1a32d0ad6f24e40c2232b587ee41a1057786
batch-p20-10 71072721f3e4e4bd83e219487853b55df947bac176ab192aefefaf367266a0f6
batch-p20-09 026efa92c3145a64394de24aeecf55830097d01a9545376b725284fec3607325
batch-p20-11 c98f4138e1e8f755025020cee8b7053fabf3e72c946d9f1085e3e12c925d34d0
batch-p20-12 4c30c52b5f1b2c987be4da0d6579495ec39d5c4449d42e49cc46bbc130612b0d
batch-p20-13 a1fd9c2047479f146495f596bd0b471536749b0985e0c3d77fb9715402946fd9
batch-p20-14 d0a4f7cfdc698e40743ee5b699ea150b2d5fdf5bf13b7df3580e7bebe53d38c5
batch-p20-15 f841cf4ee4d64f8b265e696d7f0785c4c6e8f9ce5fefd0f0c79b645432521a1a
batch-p20-16 3edc6f72b1d54e915cdc827a5af5ebd08912cb5777e12bdc435dd00b7c4a658d
batch-p20-17 c469cd529b386631e0061f15f20a04bbb6cdb32aa9329369d5d5e5c10e336a19
batch-p20-18 99beaaacb303f29751713261e884839976318f1104e4bb88d257f3b15b77279e
batch-p20-19 1567b1133d398b3c98dbbc4820955d9020fd2432829af526c13c80fc5c9ce383
batch-p20-20 0cdca391e7e205276bff6d3d1f9d54ab7d048de19a8286782d465eb2df1b12e4
batch-p20-21 d214b4b51c8055b57bc86e4b9d3c58d5169d79b5a1c71d5b7c89f4ad4f0d6e0b
```

La copia local complementaria está en `C:\graphify\_cipher-checkpoint-visuales-20260926-bea5d5d`: `pending-files/` conserva los 25 archivos pendientes previos al commit, `catalog-manifests/` conserva el índice y los 20 manifiestos activos, y `base-all-refs.bundle` conserva la historia Git anterior. El bundle se verificó y su SHA-256 es `4C01B6DDE17CCD01DB968A7403257ED530E979FBDDF99B4DC50F4DA064354371`.

**GitHub no contiene el catálogo raster externo, los masters, proyectos reales, MP4, audio, logs ni configuraciones/credenciales locales.** El código del checkpoint requiere un catálogo compatible y verificable para reproducir escenas que no hayan materializado ya sus ProjectAssets. Tampoco publica `project-state.json.bak`, el documento local preexistente `COMO-FUNCIONA-CIPHER-DE-PROYECTO-A-VIDEO.md` ni el arnés `ui-session.cjs` que nombra proyectos privados; esos tres archivos quedaron en `pending-files/` y permanecen intactos en el checkout.
