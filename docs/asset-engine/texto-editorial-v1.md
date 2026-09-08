# Texto editorial V1 — propuesta para 3.7

Conector ligero (serif/manuscrito/cursivo sólo si existe el archivo verificado), palabra fuerte bold/black y cierre opcional. Espacio negativo y legibilidad antes que cantidad. Fuente por `fontPairId` del ProjectSubstrate, nunca familia/peso libre desde IA o escena.

## Presupuesto verificable propuesto

- Objetivo 6 palabras o menos; máximo absoluto 8 palabras visibles entre connector + keyword resuelta + closing. Frase de narración queda fuera de este conteo.
- Máximo 2 líneas por defecto; 3 sólo si layout y caja tipográfica medidos lo admiten. El límite no es permiso automático para achicar texto.
- Alineación left/center elegida por presupuesto de estructura.
- 2–3 colores dominantes para tratamiento editorial, tomados del sistema vigente. Assets multicolor deben evaluarse; tint no garantiza por sí mismo ese presupuesto.
- Contraste local donde se pinta cada glifo durante lectura, además de contraste global; revisar al menos el listón de producto actual 3:1 (`src/shared/sistemas.ts:19`). No presentarlo como umbral universal para todo tamaño.
- Keyword no tapa Hero y Hero no tapa texto. Medir con fuentes cargadas, saltos reales, bounds y envolventes temporales.
- Palabra fuerte sincronizable con palabra de narración, sin cambiar la hora del clip completo.

## Timing y fallbacks

`connectorStart <= keywordStart <= closingStart` cuando existen; si coinciden, lectura simultánea explícita. Si connector se omite, omitir su tiempo. Emphasis keyword-hit se refiere al mismo hito, no a otro reloj. Texto de cierre no visible hasta su evento; guardar timing materializado en RenderSpec.

No truncar una idea para conseguir verde. Si no cabe, reducir texto semánticamente con nueva Recipe o elegir otro layout; último recurso editorial tipográfico. Tiempo mínimo legible queda pendiente de medición perceptiva para cada par/tamaño: duración 2–3 s no demuestra lectura.

Los actuales `textoPie` y etiquetas Archivo no implementan estos tres niveles. Los diez IDs de fuentes empaquetadas no equivalen a pares medidos. No cambiar tamaños ni prompts como parte de esta especificación.
