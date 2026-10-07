# Licencias del pack modern-pack-100-v1

Los avisos completos se distribuyen junto a los assets en public/modern-pack-100-v1/notices.
provenance.json registra origen y SHA de notices y origen de cada muestra. Iconify no es una licencia global.

| Colección | Licencia | Autoridad primaria | Uso |
|---|---|---|---|
| Microsoft Fluent Emoji Flat | MIT | https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE | 35 SVG descargados del commit oficial registrado |
| Tabler outline | MIT | https://github.com/tabler/tabler-icons/blob/main/LICENSE | 21 SVG oficiales |
| MingCute fill | Apache-2.0 | https://github.com/Richard9394/MingCute/blob/main/LICENSE | subset curado distribuido por Iconify |
| Phosphor regular | MIT | https://github.com/phosphor-icons/core/blob/main/LICENSE | subset curado distribuido por Iconify |
| Lucide | ISC, aviso derivado Feather incluido | https://github.com/lucide-icons/lucide/blob/main/LICENSE | subset curado distribuido por Iconify |

Los SVG de Iconify se copian sin alterar de la muestra con SHA comprobado. Conservan los avisos upstream.
Fluent se baja del repositorio oficial, no se atribuye el SVG transformado de Iconify al original.
No se incluyen marcas, logos, Openverse, Wikimedia, fotografías ni fuentes de licencia incierta.
Las licencias permiten redistribución bajo sus condiciones; mantener íntegros estos avisos.
No se afirma que toda futura colección o todos los pesos del recortador compartan estas licencias.

Los 21 SVG Tabler oficiales traían un comentario XML inicial que el validador estático existente
rechaza. Se retiró únicamente ese comentario durante empaquetado (sin modificar paths, strokes
ni colores), conservando la licencia completa junto al pack. provenance.json registra
upstreamSha256, transformación strip-xml-comments-only y SHA final. No se relajó el validador.
MingCute corresponde al material público Apache-2.0, no al catálogo Pro comercial.
