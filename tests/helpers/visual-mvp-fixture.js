/** Data-only fixture builder. Validation, identity, motion and rendering remain product code. */
function sceneSpec (bundle, asset, options = {}) {
  const visualMode = options.visualMode || (asset ? 'asset-led' : 'editorial-text')
  const connector = options.connector === undefined ? 'La señal es' : options.connector
  const keyword = options.keyword || 'EVIDENCIA'
  const closing = options.closing
  const text = {
    ...(connector ? { connector } : {}),
    keyword,
    ...(closing ? { closing } : {}),
    alignment: options.alignment || 'left',
    maxLines: 2,
    fontPairId: options.fontPairId || 'technical-black',
    timing: {
      connectorStart: .04,
      keywordStart: .16,
      ...(closing ? { closingStart: .32 } : {}),
    },
  }
  return bundle.validateVisualSceneSpec({
    renderSpecVersion: bundle.VISUAL_RENDER_SPEC_VERSION,
    visualMode,
    renderTier: 'standard',
    sistema: options.sistema || 'editorial',
    direccion: {
      fondo: options.fondo || 'ondas',
      estructura: options.estructura || 'constelacion',
      camara: options.camara || 'quieto',
      densidad: options.densidad || 'media',
      ritmo: options.ritmo || 'simultaneo',
      semilla: options.semilla || 73041,
    },
    text,
    slots: visualMode === 'asset-led' ? [{
      slotId: 'hero',
      role: 'hero',
      state: 'present',
      sha256: asset.sha256,
      mime: 'image/svg+xml',
      kind: options.kind || 'simple-icon',
      bounds: bundle.fullSubjectBounds(options.aspectRatio || 1),
      fitPolicy: options.fitPolicy || 'contain',
      tint: { treatment: options.treatment || 'accent-mask' },
      motion: bundle.createMvpMotion(
        options.entry || 'fade-slide',
        options.sustain || 'float',
        options.exit || 'fade-out',
        !!options.emphasis,
      ),
    }] : (options.missingSlot ? [{ slotId: 'hero', role: 'hero', state: 'missing' }] : []),
    revisions: bundle.visualMvpRevisions(),
    fallbackVisual: 'editorial-text',
  })
}

const graphicFor = spec => ({ type: 'visual_escena', extra: { sceneSpec: spec } })
const bindingsFor = asset => ({
  assets: [{ slotId: 'hero', assetId: asset.id, relativeFile: asset.relativeFile }],
})

module.exports = { sceneSpec, graphicFor, bindingsFor }
