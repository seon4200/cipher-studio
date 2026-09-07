# Spike de proveedores de hero asset

Este directorio contiene documentación, contratos y validadores del spike. **No
contiene assets crudos de terceros.** Las muestras que se descargaron para medir
el acceso son locales y no forman parte de Git; su ausencia en un clon es esperada.

Para revalidar muestras locales, sin red ni descargas:

```powershell
node docs/spike-hero/validar-provider-assets.cjs --samples-dir "RUTA"
```

Sin `--samples-dir`, el validador mira `downloaded/`: informa evidencia registrada
si la muestra no está, y sólo compara SHA/MIME/dimensiones/alpha cuando la encuentra.

El flujo de producción futuro descarga por necesidad de cada vídeo, valida y guarda
el archivo bajo `proyectos/<id>/materiales/assets/<provider>/`, junto a un
`asset-manifest.json` del proyecto. No descarga catálogos completos, no usa Git
como almacén ni redistribuye binarios de proveedores.

OpenMoji es obligatorio, pero su integración se decidirá como paquete, release,
repositorio o CDN oficial **pinneado**, no como SVGs copiados manualmente. ByPeople
continúa fuera: sin compra, login, scraping ni automatización.
