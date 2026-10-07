const { app, session, ipcMain } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { createHash } = require('node:crypto'), { execFileSync } = require('node:child_process')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture.js')
const root = path.resolve(__dirname, '../../..')
const catalogRoot = path.resolve(root, '../_cipher-editorial-catalog-v1-250')
const batchFolder = path.resolve(root, '../_cipher-editorial-catalog-1265/library-extension/batches/batch-p20-21')
const evidence = path.resolve(root, '../_cipher-editorial-catalog-1265/evidence/batch-p20-21-active-390')
const ffmpeg = process.env.CIPHER_FFMPEG_EXE ||
  path.resolve(root, '../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
const fixture = createTestFixture('editorial-catalog-p20-21-active')
const projectRoot = path.join(fixture, 'project')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
app.setPath('userData', path.join(fixture, 'userData'))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
process.chdir(fixture)

app.whenReady().then(async () => {
  let exitCode = 1
  try {
    assert(fs.existsSync(ffmpeg), 'FFMPEG_MISSING')
    fs.mkdirSync(evidence, { recursive: true })
    const b = require(path.join(root, 'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices', () => ({ success: true, voices: [] }))
    const catalog = new b.CuratedModularCatalogV2(catalogRoot)
    const legacy = new b.CuratedModularCatalogV1(catalogRoot)
    const manifest = JSON.parse(fs.readFileSync(path.join(batchFolder, 'manifest.json'), 'utf8'))
    assert.equal(manifest.entries.length, 20)
    assert.equal(catalog.entries().length, 390)
    assert.equal(legacy.entries().length, 250)
    const health = catalog.verifyAll()
    assert.deepEqual([health.listed, health.verified, health.failures.length], [390, 390, 0], JSON.stringify(health.failures))
    for (const entry of manifest.entries) {
      assert.equal(sha(catalog.resolveAsset(entry.assetId)), entry.sha256, entry.assetId)
      assert(catalog.searchEditorialLocalV2(entry.primaryWordEs, entry.role).some(item =>
        item.asset.assetId === entry.assetId), `SEARCH:${entry.assetId}`)
    }

    b.createProjectFiles(projectRoot, { id: 'editorial-catalog-p20-21-active', clips: [],
      timelineVideoClips: [], aiScript: 'Un cromatógrafo líquido analiza muestras con precisión.' })
    const sentence = 'El cromatógrafo líquido analiza un vial de muestra con la micropipeta automática y el medidor de pH; la hoja de registro de análisis químico conserva los resultados.'
    const semantic = b.createLocalSceneSemanticV1({ sceneId: 'p20-21-active-chromatograph', start: 0, end: 3,
      transcriptSegments: [{ start: 0, end: 3, text: sentence }], anchor: 'cromatógrafo líquido',
      concepts: ['cromatógrafo líquido', 'vial de muestra', 'micropipeta automática', 'medidor de pH',
        'hoja de registro de análisis químico'].map(label => ({ label, scope: 'scene' }))
        .concat([{ label: 'papel marfil de análisis', scope: 'context' }]), globalText: sentence })
    const result = b.selectEditorialLocalBankV3Detailed({ catalog, semantic,
      selectionRevision: b.EDITORIAL_LOCAL_BANK_V3_2.revision })
    assert.equal(result.trace.outcome, 'SELECTED', JSON.stringify(result.trace))
    assert.deepEqual(result.trace.missingTerms, [], 'SELECTED_REAR_PAPER_IS_NOT_MISSING')
    const selected = result.selection
    assert.equal(selected.heroId, 'editorial-hero-cromatografo-liquido-001')
    assert.equal(selected.rearId, 'editorial-paper-registro-analisis-quimico-001')
    assert.equal(selected.accentId, 'editorial-accent-masa-analitica-asimetrica-001')
    assert.equal(selected.backgroundId, 'editorial-background-papel-lab-celulas-marfil-001')
    assert(selected.supportIds.length >= 2 && selected.supportIds.length <= 4)
    const ids = [selected.heroId, ...selected.supportIds, selected.rearId,
      selected.accentId, selected.backgroundId].filter(Boolean)
    const imported = Object.fromEntries([...new Set(ids)].map(id => [id, catalog.publish(projectRoot, id)]))
    for (const id of ids) assert.equal(imported[id].asset.sha256, catalog.getById(id).sha256)
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: /^https?:/i.test(details.url) }))
    let networkAttempts = 0
    global.fetch = async url => { networkAttempts++; throw Error('NETWORK_FORBIDDEN:' + String(url)) }
    const context = b.createModernVisualGenerationContextV2({ sceneId: semantic.sceneId, duration: 3,
      localSemantic: semantic, keywordCandidates: [{ keyword: 'CROMATÓGRAFO', source: 'scene-semantic' }],
      preferredVisualMode: 'editorial-text', sistema: 'editorial', direction: {
        fondo: 'ondas', estructura: 'editorial', camara: 'quieto', densidad: 'media',
        ritmo: 'simultaneo', semilla: 52121 }, videoStyleId: 'cream-editorial' })
    const template = (await b.resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot }))[0].resolved.compiled
    const built = b.bindEditorialLocalBankV2({ template, catalog, imported, selection: selected,
      color: '#A83B19', contract: b.EDITORIAL_LOCAL_BANK_V3_2,
      headline: { connector: 'El', keyword: 'CROMATÓGRAFO', closing: 'analiza cada muestra.' } })
    const frozenV31 = b.bindEditorialLocalBankV2({ template, catalog, imported, selection: selected,
      color: '#A83B19', contract: b.EDITORIAL_LOCAL_BANK_V3,
      headline: { connector: 'El', keyword: 'CROMATÓGRAFO', closing: 'analiza cada muestra.' } })
    assert.deepEqual(frozenV31.sceneSpec.editorialBankV2.layers.find(x => x.id === 'idea-rear').rect,
      { x: -8, y: -4, width: 116, height: 108 })
    assert.deepEqual(frozenV31.sceneSpec.editorialBankV2.layers.find(x => x.id === 'idea-accent').rect,
      { x: 18, y: 18, width: 64, height: 64 })
    assert.notDeepEqual(built.pixelIdentity, frozenV31.pixelIdentity, 'V3_2_MUST_HAVE_NEW_PIXEL_IDENTITY')
    assert.equal(built.sceneSpec.editorialBankV2.revision, 'editorial-local-bank-2026-09-v3.2')
    b.validateVisualSceneSpecV2(built.sceneSpec)
    b.validateRenderBindingsAny(built.renderBindings, built.sceneSpec)
    const outputs = []
    for (const orientation of ['portrait', 'landscape']) {
      b.prepareGraphicForVisualRender({ graphicData: built.graphicData, projectRoot,
        renderBindings: built.renderBindings })
      let qc = null
      const rendered = await b.renderGraphicClip(built.graphicData, {
        ancho: orientation === 'portrait' ? 720 : 1280,
        alto: orientation === 'portrait' ? 1280 : 720,
        fps: 24, duracion: 3, modo: 'pantalla', sistema: 'editorial', projectRoot,
        renderBindings: built.renderBindings, onQcReport: value => { qc = value },
        onQcFailure: value => { qc = value },
      })
      assert(rendered && fs.existsSync(rendered), `VISUAL_SIN_FICHERO:${orientation}:${JSON.stringify(qc)}`)
      const mp4 = path.join(evidence, `active-390-${orientation}.mp4`)
      const frame = path.join(evidence, `active-390-${orientation}-stable.png`)
      fs.copyFileSync(rendered, mp4)
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '1.8', '-i', mp4, '-frames:v', '1', frame])
      const findings = Array.isArray(qc) ? qc.flatMap(item => item.findings ?? []) : qc?.findings ?? []
      assert.deepEqual(findings, [], `QC:${orientation}`)
      outputs.push({ orientation, mp4, frame, mp4Sha256: sha(fs.readFileSync(mp4)),
        frameSha256: sha(fs.readFileSync(frame)) })
    }
    assert.equal(networkAttempts, 0)
    const report = { passed: true, catalogListed: 390, catalogVerified: health.verified,
      selected, pixelIdentity: built.pixelIdentity, networkAttempts, visualSinFichero: 0,
      renderCount: outputs.length, outputs }
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ passed: true, catalogListed: 390, selected,
      renderCount: outputs.length, evidence }, null, 2))
    exitCode = 0
  } catch (error) { console.error(error?.stack || error) }
  finally { try { cleanupTestFixture(fixture) } catch (error) { console.error(error) }; app.exit(exitCode) }
}).catch(error => { console.error(error); app.exit(1) })
