# Provider Access Spike — evidencia sin redistribuir binarios

**Condiciones.** Evidencia obtenida el 07/09/2026 sobre el árbol base
`94fc00e`, sin tocar `src/`, `visual_escena` ni `VERSION_PLANTILLAS=12`. Se
localizaron páginas públicas y se descargó una muestra individual de OpenMoji,
PNGImages y PurePNG. Los binarios se retiraron del repositorio y no pertenecen a
esta rama. Los SHA, MIME, dimensiones y resultados de alpha quedan en
`provider-manifest.json`; la disponibilidad local posterior es opcional.

## Qué se probó

| proveedor | acceso/localización | descarga limitada | archivo válido | alpha útil | licencia/riesgo | resultado |
|---|---|---:|---:|---:|---|---|
| OpenMoji | biblioteca oficial → `birthday cake` | 1 SVG oficial | sí | sí | CC BY-SA 4.0, bajo | aprobado y obligatorio |
| PNGImages.com | topic Food → ficha `Cute Cartoon Pineapple` | 1 PNG | sí | no | claim no versionado, medio | pendiente de más muestras |
| PurePNG | category Animals → ficha `Dog` | 1 PNG | sí | sí | claim del portal, medio | secundario condicionado |
| FreeForCommercialUse.net | índice público | 0 | — | — | mezcla marcas/franquicias, alto | no base / no automático |
| Pexels | no probada | 0 | — | — | key ausente | aplazado |
| Pixabay | no probada | 0 | — | — | key ausente | aplazado |
| Wikimedia | opcional | 0 | — | — | por archivo | aplazado por alcance |
| ByPeople | prohibido en este spike | 0 | — | — | premium futuro | aplazado |
| IA / FLUX | fuera de alcance | 0 | — | — | último fallback | no implementado |

### Evidencia retenida

- **OpenMoji:** [ficha](https://openmoji.org/library/emoji-1F382/) y
  [SVG oficial](https://openmoji.org/data/color/svg/1F382.svg), SHA
  `7bf070f25b485cbd47dd30ff48711403b6ffc1d7d6011217eb9488270bc60008`,
  `image/svg+xml`, `viewBox="0 0 72 72"`, alpha útil. CC BY-SA 4.0, atribución
  requerida, riesgo bajo.
- **PNGImages:** [ficha](https://pngimages.com/png/cute-cartoon-pineapple-nt779qeojlzol0qm.html),
  SHA `1a471799bb1408a61a012b9bc20cd876afe529a7a12e186c3f04628453857728`,
  PNG 340×340, canal alpha sin transparencia útil. Riesgo medio; no está aprobado
  como cutout sólo por esta muestra.
- **PurePNG:** [ficha](https://purepng.com/photo/30366/dog), SHA
  `5fcea4b50ff39f5842c9011facd9f27b5793e5d9cb3a454e73b0e06c3d874763`, PNG
  733×720, alpha útil. Riesgo medio: la ficha declara uso comercial/sin
  atribución, pero la procedencia se revisa por archivo antes de usarlo.

## Regla definitiva de producto

La app futura resuelve por vídeo y por necesidad:

1. Analiza guion/transcripción e intención visual por subclip.
2. Busca en el proyecto y después en `materiales/` existentes.
3. Consulta proveedores y descarga sólo el asset necesario.
4. Valida el archivo y guarda metadata.
5. Lo deja bajo una ubicación de proyecto equivalente a
   `proyectos/<id>/materiales/assets/<provider>/` y lo registra en un manifiesto
   de proyecto cuya forma final queda pendiente de auditar la arquitectura actual.
6. Photo Hero/timeline lo reutilizan dentro del mismo proyecto.

No hay catálogo completo ni `CipherData`. Esta es una propuesta de flujo, no una
decisión cerrada de esquema: antes de implementarla se auditan `project-state.json`,
`materiales/stock/` y los almacenes existentes. Git conserva código, contratos,
validadores y manifiestos de evidencia; no PNG/JPG/SVG crudos de proveedores.
OpenMoji se integrará mediante paquete, release, repositorio o CDN oficial
pinneado. PurePNG es secundario; PNGImages necesita más validación; FFCU no es
proveedor base; ByPeople queda premium futuro y no se automatiza.

## Qué no se probó

No se integró render, Photo Hero, Asset Engine, búsqueda automática por guion,
almacenamiento de proyecto, Pexels/Pixabay sin keys, Wikimedia, ByPeople,
removedor de fondo ni IA. Tampoco se descargaron catálogos ni se hicieron nuevas
descargas en la reconstrucción limpia.
