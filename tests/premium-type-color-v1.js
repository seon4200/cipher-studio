const { app, session } = require('electron')
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const repo = path.resolve(__dirname, '..')
const fixture = createTestFixture('premium-type-color-v1')
const project = path.join(fixture, 'project')
let bundle; let finished = false
app.commandLine.appendSwitch('force-device-scale-factor', '2.25')
app.setPath('userData', path.join(fixture, 'user-data'))
process.chdir(fixture)
process.once('exit', () => { if (!finished) process.exitCode = 1 })
async function close (code) {
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(fixture)); cleanupTestFixture(fixture) } catch (error) {
    console.error('Fixture retained:', error.message)
  }
  app.exit(code)
}
app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: /^https?:/i.test(details.url) }))
    bundle = require(path.join(repo, 'dist-electron', 'main', 'index.js'))
    assert.equal(Object.keys(bundle.PORCELAIN_PALETTES).length, 4)
    assert.equal(Object.keys(bundle.PREMIUM_TYPE_THEMES).length, 5)
    assert.equal(bundle.WORD_TREATMENTS.length, 6)
    const families = bundle.COLOR_PALETTE_FAMILY_IDS_V1.map(id => bundle.selectPremiumStyleV1(id, 'protagonist'))
    for (const style of families) assert.deepEqual(bundle.validatePremiumStyleV1(style), style)
    assert.equal(new Set(families.map(value => value.typographyTheme)).size, 5)
    assert.equal(new Set(families.map(value => value.porcelainPalette)).size, 4)
    assert.equal(bundle.selectPremiumStyleV1('green-nature', 'typographic', 'CERTEZA').signatureAccent, true)
    assert.equal(bundle.selectPremiumStyleV1('green-nature', 'typographic', 'EXTRAORDINARIAMENTE').signatureAccent, false)
    assert.equal(bundle.selectPremiumStyleV1('green-nature', 'datum', '72%').signatureAccent, false)
    bundle.createProjectFiles(project, { id: 'premium-temp', clips: [], timelineVideoClips: [], aiScript: 'synthetic' })
    const semantic = bundle.createLocalSceneSemanticV1({ sceneId: 'robot-premium', start: 0, end: 2,
      transcriptSegments: [{ start: 0, end: 2, text: 'Un robot analiza los datos con precisión' }],
      concepts: [{ label: 'robot', emoji: '🤖', start: .1, end: .4 }], anchor: 'robot',
      relation: 'analiza', globalText: 'Un robot analiza los datos con precisión',
      globalHints: [], globalContextRef: 'synthetic:premium' })
    const common = { sceneId: 'robot-premium', duration: 1.5, localSemantic: semantic,
      keywordCandidates: [{ keyword: 'ROBOT', source: 'scene-semantic' }], preferredVisualMode: 'auto',
      sistema: 'editorial', direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
        densidad: 'media', ritmo: 'simultaneo', semilla: 151255 }, videoStyleId: 'cream-editorial' }
    const original = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [
      bundle.createModernVisualGenerationContextV2(common)], projectRoot: project }))[0]
    const premium = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [
      bundle.createModernVisualGenerationContextV2({ ...common,
        presentationProfile: bundle.PREMIUM_TYPE_COLOR_PROFILE_V1 })], projectRoot: project }))[0]
    const spec = premium.resolved.compiled.sceneSpec
    assert.equal(spec.colorPalette, undefined, 'Vivid V1 scene tokens are not visible in Porcelain PixelIdentity')
    assert.deepEqual(original.resolved.choices.map(x => [x.slotId, x.asset?.sha256 ?? x.solarIcon]),
      premium.resolved.choices.map(x => [x.slotId, x.asset?.sha256 ?? x.solarIcon]))
    assert(spec.premiumStyle && spec.presentationProfile.revision === bundle.PREMIUM_TYPE_COLOR_PROFILE_V1.revision)
    assert.notEqual(bundle.sceneSpecPixelIdentityAny(original.resolved.compiled.sceneSpec),
      bundle.sceneSpecPixelIdentityAny(spec))
    assert.throws(() => bundle.validateVisualSceneSpecV2({ ...spec, premiumStyle: undefined }), /PREMIUM_STYLE_INVALID/)
    const repeat = (await bundle.resolveModernVisualGenerationBatchV2({
      contexts: [premium.context], projectRoot: project }))[0]
    assert.equal(bundle.sceneSpecPixelIdentityAny(spec),
      bundle.sceneSpecPixelIdentityAny(repeat.resolved.compiled.sceneSpec))
    let qc
    const file = await bundle.renderGraphicClip(premium.resolved.compiled.graphicData, {
      ancho: 540, alto: 960, fps: 24, duracion: 1.5, modo: 'pantalla', sistema: 'editorial',
      projectRoot: project, renderBindings: premium.resolved.compiled.renderBindings,
      onQcReport: value => { qc = value }, onQcFailure: value => { qc = value },
    })
    if (!file || !fs.existsSync(file)) console.error('PREMIUM_QC', JSON.stringify(qc?.findings ?? []))
    assert(file && fs.existsSync(file))
    assert.equal(qc?.findings.filter(x => x.level === 'error').length, 0)
    assert(qc.snapshots.every(x => !x.textFitFailed && !x.textOverflow && !x.keywordOverflow))
    console.log('PREMIUM_TYPE_COLOR_OK', JSON.stringify({ palette: spec.premiumStyle.porcelainPalette,
      theme: spec.premiumStyle.typographyTheme, bytes: fs.statSync(file).size }))
    finished = true; await close(0)
  } catch (error) { console.error(error); finished = true; await close(1) }
}).catch(async error => { console.error(error); finished = true; await close(1) })
