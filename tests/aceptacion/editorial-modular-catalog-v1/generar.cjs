const { app, session, ipcMain } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const root = path.resolve(__dirname, '../../..')
const catalogRoot = process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH || path.resolve(root, '../_cipher-editorial-catalog-v1-250')
const pilotAssets = path.resolve(root, '../_cipher-idea-assembly-v3/runtime')
const outputRoot = path.join(catalogRoot, 'evidence', 'renderer-gate')
const fixture = createTestFixture('editorial-modular-catalog-v1')
const projectRoot = path.join(fixture, 'project')
const ffmpeg = process.env.CIPHER_FFMPEG_EXE || 'ffmpeg'
process.env.PATH = path.dirname(ffmpeg) + path.delimiter + process.env.PATH
app.setPath('userData', path.join(fixture, 'userData'))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
process.chdir(fixture)
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const cases = [
  { code: 'h001', heroId: 'editorial-hero-h001-v1', rearId: 'editorial-layer-l001-v1',
    accentId: 'editorial-layer-l036-v1', frontId: 'editorial-layer-l021-v1', recipe: 'vertical', theme: 'orange' },
  { code: 'h011', heroId: 'editorial-hero-h011-v1', rearId: 'editorial-layer-l001-v1',
    accentId: 'editorial-layer-l036-v1', recipe: 'vertical', theme: 'teal' },
  { code: 'h101', heroId: 'editorial-hero-h101-v1', rearId: 'editorial-layer-l001-v1',
    accentId: 'editorial-layer-l036-v1', recipe: 'compact', theme: 'crimson' },
  { code: 'h061', heroId: 'editorial-hero-h061-v1', rearId: 'editorial-layer-l001-v1',
    accentId: 'editorial-layer-l036-v1', recipe: 'organic', theme: 'orange' },
  { code: 'h104', heroId: 'editorial-hero-h104-v1', rearId: 'editorial-layer-l002-v1',
    accentId: 'editorial-layer-l038-v1', recipe: 'wide', theme: 'orange' },
]
const activeCases = process.env.MODULAR_GATE_CASE ? cases.filter(item => item.code === process.env.MODULAR_GATE_CASE) : cases
const supports = ['idea-support-personas-v1', 'idea-support-datos-v1',
  'editorial-support-s011-v1', 'editorial-support-s012-v1']
const uniqueIds = [...new Set([...supports, ...cases.flatMap(c => [c.heroId, c.rearId, c.accentId, c.frontId].filter(Boolean))])]
const colors = { orange: '#C5481E', teal: '#238C87', crimson: '#B8444F' }

app.whenReady().then(async () => {
  let code = 1
  try {
    assert(fs.existsSync(pilotAssets), 'V4_PILOT_ASSETS_MISSING')
    fs.mkdirSync(outputRoot, { recursive: true })
    const b = require(path.join(root, 'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    // La consulta de voces pertenece al arranque de la app, no al render offline.
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices', () => ({ success: true, voices: [] }))
    b.createProjectFiles(projectRoot, { id: 'modular-catalog-fixture', clips: [], timelineVideoClips: [],
      aiScript: 'synthetic editorial modular catalog acceptance' })
    let networkAttempts = 0
    global.fetch = () => { networkAttempts++; throw new Error('NETWORK_FORBIDDEN_MODULAR') }
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) { networkAttempts++; callback({ cancel: true }) }
      else callback({ cancel: false })
    })
    const catalog = new b.CuratedModularCatalogV1(catalogRoot)
    assert(catalog.search(['idea'], 'hero-core').some(a => a.assetId === 'editorial-hero-h001-v1'))
    assert(catalog.search(['IDEA'], 'support').some(a => a.assetId === 'editorial-support-s011-v1'))
    assert.throws(() => catalog.resolveAsset('editorial-hero-outside-curated-roster-v1'), /MODULAR_ASSET_NOT_CURATED/)
    const imported = Object.fromEntries(uniqueIds.map(id => [id, catalog.publish(projectRoot, id)]))
    const template = await b.generateIdeaColorPilotV4({ projectRoot, assetRoot: pilotAssets,
      color: { supportSource: 'ink', heroMode: 'recolorable', heroPrimary: colors.orange },
      orientation: 'portrait', render: b.renderGraphicClip })
    assert(template.file && fs.existsSync(template.file), 'V4_TEMPLATE_RENDER_MISSING')
    const historicalSpec = JSON.stringify(template.sceneSpec)
    const contractBase = b.bindEditorialModularCatalogV1({ template, imported,
      heroId: cases[0].heroId, supportIds: supports, rearId: cases[0].rearId,
      accentId: cases[0].accentId, frontId: cases[0].frontId, recipe: 'vertical', accentTheme: 'orange',
      color: { supportSource: 'ink', heroMode: 'recolorable', heroPrimary: colors.orange } })
    const changedTint = b.bindEditorialModularCatalogV1({ template, imported,
      heroId: cases[0].heroId, supportIds: supports, rearId: cases[0].rearId,
      accentId: cases[0].accentId, frontId: cases[0].frontId, recipe: 'vertical', accentTheme: 'orange',
      color: { supportSource: 'custom', customColor: '#7B4EA3', heroMode: 'recolorable', heroPrimary: colors.orange } })
    const changedRecipe = b.bindEditorialModularCatalogV1({ template, imported,
      heroId: cases[0].heroId, supportIds: supports, rearId: cases[0].rearId,
      accentId: cases[0].accentId, frontId: cases[0].frontId, recipe: 'compact', accentTheme: 'orange',
      color: { supportSource: 'ink', heroMode: 'recolorable', heroPrimary: colors.orange } })
    assert.notEqual(contractBase.pixelIdentity, changedTint.pixelIdentity, 'TINT_NOT_IN_PIXEL_IDENTITY')
    assert.notEqual(contractBase.pixelIdentity, changedRecipe.pixelIdentity, 'RECIPE_NOT_IN_PIXEL_IDENTITY')
    assert.equal(JSON.stringify(template.sceneSpec), historicalSpec, 'V4_TEMPLATE_MUTATED')
    assert(!contractBase.pixelIdentity.includes(catalogRoot) && !contractBase.pixelIdentity.includes(projectRoot),
      'PHYSICAL_PATH_IN_PIXEL_IDENTITY')
    assert.throws(() => b.bindEditorialModularCatalogV1({ template, imported,
      heroId: cases[0].heroId, supportIds: [cases[0].heroId, ...supports.slice(1)],
      recipe: 'vertical', accentTheme: 'orange',
      color: { supportSource: 'ink', heroMode: 'recolorable', heroPrimary: colors.orange } }),
      /MODULAR_SELECTION_UNAUTHORIZED/)
    const results = []
    for (const item of activeCases) for (const orientation of ['portrait', 'landscape']) {
      const built = b.bindEditorialModularCatalogV1({ template, imported, heroId: item.heroId,
        supportIds: supports, rearId: item.rearId, accentId: item.accentId, frontId: item.frontId,
        recipe: item.recipe, accentTheme: item.theme,
        color: { supportSource: 'ink', heroMode: 'recolorable', heroPrimary: colors[item.theme] } })
      assert.equal(built.sceneSpec.presentationProfile.revision, b.EDITORIAL_MODULAR_CATALOG_V1.revision)
      let qc
      const file = await b.renderGraphicClip(built.graphicData, {
        ancho: orientation === 'portrait' ? 720 : 1280,
        alto: orientation === 'portrait' ? 1280 : 720,
        fps: 24, duracion: 80 / 24, modo: 'pantalla', sistema: 'editorial', projectRoot,
        renderBindings: built.renderBindings,
        onQcReport: report => { qc = report }, onQcFailure: report => { qc = report },
      })
      assert(file && fs.existsSync(file), `MODULAR_VISUAL_SIN_FICHERO:${item.code}:${orientation}:${JSON.stringify(qc?.findings)}`)
      const destination = path.join(outputRoot, `${item.code}-${orientation}.mp4`)
      fs.copyFileSync(file, destination)
      results.push({ code: item.code, orientation, file: destination, sha256: sha(fs.readFileSync(destination)),
        pixelIdentitySha256: sha(Buffer.from(built.pixelIdentity)), qc: qc?.findings ?? [] })
    }
    assert.equal(networkAttempts, 0, 'MODULAR_NETWORK_AFTER_MATERIALIZATION')
    fs.writeFileSync(path.join(outputRoot, 'result.json'), JSON.stringify({ passed: true, cases: results,
      imported: uniqueIds, networkAttempts, visualSinFichero: 0,
      contract: { historicalTemplateUnchanged: true, tintAffectsIdentity: true,
        recipeAffectsIdentity: true, noPhysicalPathInIdentity: true, unauthorizedRoleRejected: true } }, null, 2))
    console.log(JSON.stringify({ passed: true, results: results.length, imported: uniqueIds.length,
      networkAttempts, outputRoot }))
    code = 0
  } catch (error) {
    console.error(error?.stack || error)
    fs.mkdirSync(outputRoot, { recursive: true })
    fs.writeFileSync(path.join(outputRoot, 'failure.txt'), String(error?.stack || error))
  } finally {
    try { cleanupTestFixture(fixture) } catch (error) { console.error('fixture-cleanup', error) }
    app.exit(code)
  }
}).catch(error => { console.error(error); app.exit(1) })
