# Corpus Solar reproducible

No se pudo reconstruir el corpus histórico de 188 solicitudes: el log guardó solo el agregado `68/188`, no los nombres solicitados. Este corpus nuevo mide las 158 solicitudes `ancla` y `concepto` conservadas en `tests/aceptacion/mvp-paso7/video.json`.

`requests.json` fija las solicitudes y el SHA-256 de la fuente. `baseline.json` se genera con el bundle previo a un cambio de resolver; `after.json`, con el bundle posterior. Ambos ejecutan `resolverSolarDetallado` exportado por el bundle, no una copia de la regla:

```text
npx electron tests/aceptacion/solar-resolver-corpus/medir.js baseline
npm run build
npx electron tests/aceptacion/solar-resolver-corpus/medir.js after
```

No compara su resultado con 68/188: son muestras distintas y hacerlo fingiría una mejora que no se puede medir.
