# Layout intents y SubjectBounds — propuesta V1

El layout intent expresa jerarquía editorial. No hay coordenadas finales fuera de ESTRUCTURAS ni otro sistema de cajas. La disposición y `HeroEstructura` (`src/shared/escena.ts:343–393`) son la autoridad geométrica.

## Selector propuesto

`layoutIntent → estructuras candidatas compatibles → relación/contenido/rol tipográfico → estructura real → HeroEstructura + presupuesto de texto → bounds y envolvente de motion/cámara → RenderSpec`.

Desempate determinista con semilla explícita; la selección final se guarda, no se repite aleatoriamente durante render. Respetar la compatibilidad energética vigente fondo+cámara y roles tipográficos; energy editorial low/medium/high no sustituye ni aumenta ese presupuesto.

| Intención | Lectura deseada | Candidatas actuales para probar (no certificación) |
|---|---|---|
| sandwich | texto enmarca objeto sin taparlo | marcoPoster, capasApiladas |
| hero-bottom | objeto domina parte inferior; texto reserva superior | editorial, marcoPoster |
| negative-space | objeto aislado con amplio espacio para texto | editorial, partidoVertical |
| editorial-left | texto lateral con relación al objeto | editorial, cuaderno |
| object-dominant | un objeto concentra atención; pocos apoyos | anillosConcentricos, rayosImpacto |
| evidence-board | entidades enlazadas como evidencias | redNodos, constelacion, cuaderno |

Estos nombres existen en `src/shared/escena.ts:565–781`. Hoy sus ranuras no prometen hero-bottom/sandwich: si ninguna puede cumplir un intent, elegir otro intent explícito con justificación/fallback; no inyectar coordenadas en Recipe. Cambiar una estructura es tarea posterior de layouts. No se marca compatible por la similitud del nombre.

## SubjectBounds (metadata propuesta)

```ts
type Rect01 = { x: number; y: number; width: number; height: number }
type SubjectBounds = {
  alphaBounds: Rect01
  visibleWidthRatio: number
  visibleHeightRatio: number
  centerOfMass: { x: number; y: number }
  aspectRatio: number
  transparentPadding: { top: number; right: number; bottom: number; left: number }
  boundsMeasurementRevision: string
}
type FitPolicy = 'contain' | 'cover' | 'subject-fit' | 'face-fit'
```

Coordenadas normalizadas al lienzo del asset, no al vídeo: x/y/ratios/padding en 0..1, dimensiones positivas, rectángulo dentro de 0..1. aspectRatio es ancho visible/alto visible, no otro tamaño de lienzo; centerOfMass ponderado por alpha. Umbral alpha y algoritmo se fijan en boundsMeasurementRevision, para no cambiar resultados al “mejorar” la medición. Comprobar consistencia de ratios/padding con alphaBounds, no guardar valores independientes incompatibles.

Asset opaco: bounds de lienzo completo; no significa que su fondo sea transparente. Asset totalmente transparente: inválido, sin división por cero ni sujeto imaginario. SVG requiere rasterización de análisis fijada por versión/resolución o extracción conservadora demostrada; estos bounds aún no se calculan en producción.

ProjectAsset conserva bytes originales. No recortar/remuestrear todos los assets para normalizarlos. Si se crea derivado, registra original y derivado por SHA; el render usa el SHA real del derivado.

| fitPolicy | Contrato |
|---|---|
| contain | lienzo completo dentro de ranura, conserva proporción |
| cover | permite recorte, sólo layout que lo autorice; no convierte opaco a cutout |
| subject-fit | ajusta alphaBounds a ranura y considera padding/centro de masa |
| face-fit | sólo si hay bounds de cara verificados; sin detector implementado, no seleccionable en V1 inicial |

fitPolicy se elige en compilador/estructura y se materializa en RenderSpec; no posición arbitraria en assetSlots.

## Safe zones y motion envelope

Envolvente = unión de bounds transformados por estructura, placement, entry/overshoot, sustain, emphasis, exit y cámara a sus extremos. Evaluar también los rectángulos reales del texto y sus capas; no basta el centro ni rectángulo fijo genérico. El panel de zona segura existente es límite exterior, no prueba de no solape entre vecinos.

Salida deliberada fuera de cuadro sólo durante exit/entrada, con clipping y sin invadir texto u objetos; distinguirla de salida accidental durante lectura. En 3.6B se documentará la envolvente exacta por preset; una captura estática no la prueba. Mantener una sola implementación de esa envolvente consumida por QC y renderer.
