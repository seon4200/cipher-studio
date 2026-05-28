# CIPHER Studio Creative Style Configuration

Este archivo define las especificaciones de diseño y estilo visual de **CIPHER Studio**. El motor de renderizado de Remotion debe leer y aplicar estrictamente esta configuración antes de generar cualquier escena visual, gráfico o tipografía cinética.

## Paleta de Colores Core (Hexadecimal)
- **Fondo General (Background):** `#020712`
- **Color Primario (Índigo):** `#6366f1`
- **Color Secundario (Púrpura):** `#c084fc`
- **Color de Datos (Verde Datos):** `#34d399`

## Tipografías y Estilos
- **Títulos y Encabezados (Header Typography):** Sans-Serif Bold (font-weight: 700/800)
- **Datos y Métricas (Data Typography):** Monospace (para valores numéricos, duraciones e indicadores de procesamiento)

## Reglas de Renderizado en Remotion
1. Toda escena debe iniciar con un fundido suave sobre el fondo de color `#020712`.
2. Las animaciones de texto cinético deben usar transiciones elásticas alternando entre `#6366f1` y `#c084fc`.
3. Todos los datos de análisis y métricas del video deben mostrarse en tipografía Monospace de color `#34d399`.
