# ProjectSubstrate V1 — especificación documental 3.3.5

Estado: propuesta; no implementado. Base de código: `291069e`, idéntica en producción a `c0a9c78`. Fuente editorial: encargo 3.3C + 3.3.5 de esta conversación; no se encontró una guía Collage Editorial Simbólico separada en docs.

## Identidad del vídeo y variación de escena

```ts
type PrimaryStyle = 'blueprint' | 'tech' | 'authority' | 'investigation' | 'economic' | 'pop'
type ProjectSubstrate = {
  projectSubstrateVersion: 1
  primaryStyle: PrimaryStyle
  paletteId: NombreSistema
  fontPairId: FontPairId
  decoratorFamilyId: DecoratorFamilyId
  textureFamilyId: TextureFamilyId
  brandMarkId?: string // referencia validada; nunca path
}
```

Se fija una instancia por vídeo/montaje, no por subclip. Recomendación 3.4A:
project-state.json versionado es la única autoridad de projectSubstrate, junto
con schemaVersion y referencias de timeline/uso. No es metadata de asset; no
crear visual-substrate.json ni copiarlo al manifest. Si un proyecto conserva
versiones de montaje, su estado conserva el snapshot de cada montaje; no
recalcularlo al reabrir. Esta persistencia todavía no existe.

materiales/assets/manifest.json será autoridad de archivos, SHA, relativeFile,
validación y procedencia/licencia, no del estilo. 3.4A debe introducir
schemaVersion, migración mínima, default determinista para proyectos antiguos,
escritura atómica, validación al abrir y recuperación. Es propuesta documental,
no un archivo creado ni schema productivo.

Paletas existentes: `editorial | clinico | voltaje | calido` en `src/shared/sistemas.ts:3`; el renderer las reexporta. No se copian colores ni se aceptan hex por escena. `sistemaDeGeneracion` (`src/main/index.ts:1149`) elige hoy un sistema para el lote; el nuevo sustrato reutiliza esa decisión y su autoridad de tinta/luz, no crea cuatro paletas nuevas.

`SceneStyleVariant` varía layout, energía, variante de textura y familia de movimiento compatibles. La anti-repetición elige entre estructuras, entrada, salida, motion del Hero y fondos compatibles con el sustrato. No obliga a cambiar primaryStyle. Si no hay alternativa compatible, se conserva identidad y se registra repetición; no se cambia de estilo para cumplir una cuota.

## IDs propuestos, aún sin registro productivo

| Registro documental | IDs cerrados V1 |
|---|---|
| FontPairId | technical-black, editorial-black, manuscript-black |
| DecoratorFamilyId | measurement, circuits, marginalia, evidence, accounting, cut-paper |
| TextureFamilyId | technical-grid, aged-paper, radial-gradient, dark-lines, soft-editorial |

| fontPairId | conector / cierre | keyword |
|---|---|---|
| technical-black | spaceMono | archivoBlack |
| editorial-black | dmSerifDisplay | archivoBlack |
| manuscript-black | caveat | archivoBlack |

Son referencias a IDs reales de TIPOGRAFIAS (`src/shared/escena.ts:281`), no nuevas fuentes ni pesos inventados. Hoy el registro gobierna sólo el pie y las etiquetas siguen Archivo: esta tabla NO declara el texto editorial ya conectado. No sintetizar cursiva o light si no hay archivo de fuente verificado. Presupuesto y métricas por par deberán medirse en 3.7.

Hoy la tipografía puede variar por Visual. El par fijo por vídeo es una decisión
de producto futura del encargo, no descripción del sorteo actual. En el compilador
futuro, `direccion.tipografia` debe coincidir con el ID keyword del par; si una
estructura no admite su rol, se busca otra estructura, no otra fuente silenciosa.
Connector/cierre siguen el otro ID del par. Implementarlo pertenece a 3.7.

BrandMark opcional: una marca visible exige resolución de contenido/SHA como cualquier asset, nunca una cadena opaca que esconda bytes cambiantes. Si no existe, omitirla.

## Reproducibilidad

Recipe refiere el sustrato por ID; no duplica sus colores o fuentes. RenderSpec materializa paletteId, IDs tipográficos y revisiones de registros que determinan píxeles. Si un registro cambia manteniendo ID, la revisión visual/versión de plantilla debe cambiar en la futura integración. IDs administrativos de proyecto no son identidad visual.

Los ejemplos usan seis referencias de sustrato para seis vídeos hipotéticos, con tres escenas cada uno. No son seis estilos alternándose en un mismo vídeo.

El par fija familias permitidas por rol durante el vídeo; no fija el mismo
tamaño, tratamiento, alineación, distribución o entrada para cada escena.
SceneStyleVariant y estructura deciden esos usos dentro del presupuesto medido.
RenderSpec materializa IDs efectivos por rol y revisiones tipográficas;
direccion.tipografia es la proyección del ID keyword. No cambiar pareja por
anti-repetición. Una excepción explícita queda en la traza de resolución.
