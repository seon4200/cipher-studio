/**
 * Data-only V15 fixture builder. Geometry, motion, validation and identity always come from the
 * compiled product bundle; this file deliberately contains no renderer or QC implementation.
 */
function sceneSpecV15 (bundle, descriptors = [], options = {}) {
  const visualMode = options.visualMode || (descriptors.length ? 'asset-led' : 'editorial-text')
  const seed = options.seed || 91501
  const supportCount = descriptors.filter(value => value.slotId !== 'hero').length
  const family = options.family || (visualMode === 'editorial-text' ? 'editorial' : 'marcoPoster')
  const layout = bundle.createVisualLayoutV4(family, visualMode, supportCount, seed)
  const energy = options.energy || 'medium'
  const slots = descriptors.map(descriptor => {
    const role = descriptor.slotId
    const motion = descriptor.motion || bundle.createRoleMotionV2({ role, energy, emphasis: role === 'hero' })
    if (descriptor.solarIcon) {
      return {
        slotId: role, role, state: 'procedural', kind: 'simple-icon',
        solarIcon: descriptor.solarIcon, solarStyle: descriptor.solarStyle || 'linear',
        bounds: descriptor.bounds || bundle.fullSubjectBounds(), fitPolicy: 'contain',
        tint: { treatment: 'system-tint' }, motion,
      }
    }
    const asset = descriptor.asset
    const mime = descriptor.mime || asset.mime
    const alphaMode = descriptor.alphaMode || (mime === 'image/svg+xml' ? 'vector' : 'useful-alpha')
    return {
      slotId: role, role, state: 'present', sha256: asset.sha256, mime,
      kind: descriptor.kind || (mime === 'image/svg+xml' ? 'complex-illustration' : 'photo-cutout'),
      alphaMode, bounds: descriptor.bounds || bundle.fullSubjectBounds(descriptor.aspectRatio || 1),
      fitPolicy: descriptor.fitPolicy || (alphaMode === 'opaque-rectangle' ? 'cover' : alphaMode === 'useful-alpha' ? 'subject-contain' : 'contain'),
      tint: { treatment: descriptor.treatment || 'original-color' }, motion,
    }
  })
  const keyword = options.keyword || 'CONSTRUYERON'
  const connector = options.connector === undefined ? 'miles de' : options.connector
  const closing = options.closing === undefined ? 'enormes estadios' : options.closing
  const text = {
    ...(connector ? { connector } : {}), keyword, ...(closing ? { closing } : {}),
    alignment: layout.textAlignment, maxLines: options.maxLines || 3,
    typographyLookId: options.typographyLookId || 'editorial-strong',
    timing: { connectorStart: .04, keywordStart: .16, ...(closing ? { closingStart: .32 } : {}) },
    motion: { secondaryPreset: 'fade-slide', keywordPreset: options.keywordPreset || 'slide-reveal', emphasisStart: .52 },
  }
  return bundle.validateVisualSceneSpecV2({
    renderSpecVersion: 2, visualMode, renderTier: 'standard', sistema: options.sistema || 'editorial',
    direccion: {
      fondo: options.fondo || 'ondas', estructura: family, camara: 'quieto',
      densidad: options.density || 'media', ritmo: options.rhythm || 'simultaneo', semilla: seed,
    },
    videoStyle: bundle.materializeVideoVisualStyleV1({
      videoStyleId: options.videoStyleId || 'cream-editorial', sceneId: options.sceneId || 'fixture-v15', seed,
    }),
    ...(options.backgroundProfileId
      ? { backgroundProfile: bundle.materializeBackgroundProfileV1(options.backgroundProfileId) }
      : {}),
    ...(options.colorPalette ? { colorPalette: bundle.validateSceneColorPaletteV1(options.colorPalette) } : {}),
    layout, text, slots, revisions: bundle.visualRevisionsV2(), fallbackVisual: 'editorial-text',
  })
}

function graphicForV15 (spec, extra = {}) {
  return { type: 'visual_escena', value: spec.text.keyword, extra: { ...extra, sceneSpec: spec } }
}

function bindingsForV15 (descriptors) {
  return {
    version: 2,
    assets: descriptors.filter(value => value.asset).map(value => ({
      slotId: value.slotId, assetId: value.asset.id, relativeFile: value.asset.relativeFile,
    })),
  }
}

module.exports = { sceneSpecV15, graphicForV15, bindingsForV15 }
