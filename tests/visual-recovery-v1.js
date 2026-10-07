const { app, session } = require('electron')
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const repo = path.resolve(__dirname, '..')
const fixture = createTestFixture('visual-recovery-v1')
const project = path.join(fixture, 'project')
let bundle
let finished = false

app.commandLine.appendSwitch('force-device-scale-factor', process.env.CIPHER_RECOVERY_SCALE ?? '1')
app.setPath('userData', path.join(fixture, 'user-data'))
process.chdir(fixture)
process.once('exit', () => { if (!finished) process.exitCode = 1 })

async function close (code) {
  try { bundle?.cerrarVentanaGraficos() } catch {}
  try { process.chdir(path.dirname(fixture)) } catch {}
  try { cleanupTestFixture(fixture) } catch (error) { console.error('Fixture retained:', error.message) }
  app.exit(code)
}

app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: /^https?:/i.test(details.url) }))
    bundle = require(path.join(repo, 'dist-electron', 'main', 'index.js'))
    const themes = new Set(bundle.COLOR_PALETTE_FAMILY_IDS_V1.map(id =>
      bundle.selectVisualRecoveryTypographyV1(id).id))
    assert.equal(themes.size, 5, 'Five deterministic video-level typography themes')
    for (const [id, definition] of Object.entries(bundle.VISUAL_RECOVERY_TYPOGRAPHY_THEMES_V1)) {
      assert(bundle.TYPOGRAPHY_LOOK_IDS_V3.includes(definition.look), id)
      if (id !== 'clean-explainer')
        assert.equal(bundle.typographyLookV3(definition.look).keywordFamily, definition.primary, id)
    }
    const contrastSpec = { layout: { textBounds: { x: 10, y: 10, width: 70, height: 60 },
      slotLayouts: [{ slotId: 'hero', envelope: { x: 10, y: 10, width: 70, height: 60 } }] },
      slots: [{ slotId: 'hero', state: 'present', alphaMode: 'opaque-rectangle' }] }
    const probe = (level, detail = 0) => [{ slotId: 'hero', photoProbe: {
      luminance: Array(16).fill(level), detail: Array(16).fill(detail),
    } }]
    assert.equal(bundle.chooseTextContrastV1(contrastSpec, probe(230)), 'dark-text')
    assert.equal(bundle.chooseTextContrastV1(contrastSpec, probe(30)), 'light-text')
    assert.equal(bundle.chooseTextContrastV1(contrastSpec, probe(110, 60)), 'local-scrim')
    contrastSpec.layout.slotLayouts[0].envelope = { x: 11, y: 11, width: 12, height: 8 }
    assert.equal(bundle.chooseTextContrastV1(contrastSpec, probe(230)), 'black-base',
      'A small photo Support cannot darken text over the black canvas')
    bundle.createProjectFiles(project, { id: 'visual-recovery-temp', clips: [], timelineVideoClips: [], aiScript: 'synthetic' })
    const localSemantic = bundle.createLocalSceneSemanticV1({
      sceneId: 'robot-recovery', start: 0, end: 2,
      transcriptSegments: [{ start: 0, end: 2, text: 'Un robot analiza los datos con precisión', words: [
        { word: 'robot', start: .1, end: .4 }, { word: 'datos', start: .7, end: 1.1 },
        { word: 'precisión', start: 1.4, end: 1.8 },
      ] }],
      concepts: [{ label: 'robot', emoji: '🤖', start: .1, end: .4 }],
      anchor: 'robot', relation: 'analiza', globalText: 'Un robot analiza los datos con precisión',
      globalHints: [], globalContextRef: 'synthetic:recovery',
    })
    const base = bundle.createModernVisualGenerationContextV2({
      sceneId: 'robot-recovery', duration: 1.5, localSemantic,
      keywordCandidates: [{ keyword: 'ROBOT', source: 'scene-semantic' }], preferredVisualMode: 'auto',
      sistema: 'editorial', direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto',
        densidad: 'media', ritmo: 'simultaneo', semilla: 151255 }, videoStyleId: 'cream-editorial',
    })
    const before = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [base], projectRoot: project }))[0]
    const context = bundle.createModernVisualGenerationContextV2({
      ...base, presentationProfile: bundle.VISUAL_RECOVERY_PROFILE_V1,
    })
    const after = (await bundle.resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot: project }))[0]
    assert.deepEqual(before.resolved.choices.map(x => [x.slotId, x.asset?.sha256 ?? x.solarIcon]),
      after.resolved.choices.map(x => [x.slotId, x.asset?.sha256 ?? x.solarIcon]))
    assert.notEqual(bundle.sceneSpecPixelIdentityAny(before.resolved.compiled.sceneSpec),
      bundle.sceneSpecPixelIdentityAny(after.resolved.compiled.sceneSpec))
    const regenerated = (await bundle.resolveModernVisualGenerationBatchV2({
      contexts: [after.context], projectRoot: project,
    }))[0]
    assert.equal(bundle.sceneSpecPixelIdentityAny(after.resolved.compiled.sceneSpec),
      bundle.sceneSpecPixelIdentityAny(regenerated.resolved.compiled.sceneSpec))
    let qc
    const file = await bundle.renderGraphicClip(after.resolved.compiled.graphicData, {
      ancho: 540, alto: 960, fps: 24, duracion: 1.5, modo: 'pantalla', sistema: 'editorial',
      projectRoot: project, renderBindings: after.resolved.compiled.renderBindings,
      onQcReport: value => { qc = value }, onQcFailure: value => { qc = value },
    })
    if (!file || !fs.existsSync(file)) console.error('QC_FAIL', JSON.stringify(qc?.findings ?? []),
      JSON.stringify(qc?.snapshots?.[0] ?? null))
    assert(file && fs.existsSync(file), 'Productive renderer must return a visual clip')
    assert.equal(qc?.findings.filter(x => x.level === 'error').length, 0)
    assert(qc.snapshots.every(x => !x.textFitFailed && !x.textOverflow && !x.keywordOverflow))
    console.log('VISUAL_RECOVERY_TEST_OK', JSON.stringify({ family: after.resolved.compiled.sceneSpec.layout.family,
      look: after.resolved.compiled.sceneSpec.text.typographyLookId, fileBytes: fs.statSync(file).size }))
    finished = true
    await close(0)
  } catch (error) {
    console.error(error)
    finished = true
    await close(1)
  }
}).catch(async error => { console.error(error); finished = true; await close(1) })
