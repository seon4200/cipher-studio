const { app, ipcMain } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const root = path.resolve(__dirname, '../../..')
const catalogRoot = process.env.CIPHER_EDITORIAL_MODULAR_CATALOG_PATH || path.resolve(root, '../_cipher-editorial-catalog-v1-250')
const fixture = createTestFixture('editorial-modular-import-all')
const projectRoot = path.join(fixture, 'project')
const outputRoot = path.join(catalogRoot, 'evidence', 'import-all')
app.setPath('userData', path.join(fixture, 'userData'))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
process.chdir(fixture)
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

app.whenReady().then(async () => {
  let code = 1
  try {
    fs.mkdirSync(outputRoot, { recursive: true })
    const b = require(path.join(root, 'dist-electron/main/index.js'))
    app.removeAllListeners('window-all-closed')
    ipcMain.removeHandler('get-elevenlabs-voices')
    ipcMain.handle('get-elevenlabs-voices', () => ({ success: true, voices: [] }))
    b.createProjectFiles(projectRoot, { id:'modular-import-fixture', clips:[], timelineVideoClips:[], aiScript:'' })
    const catalog = new b.CuratedModularCatalogV1(catalogRoot)
    assert.equal(catalog.entries().length, 250)
    const results = []
    for (const entry of catalog.entries()) {
      const imported = catalog.publish(projectRoot, entry.assetId)
      assert.equal(imported.asset.sha256, entry.sha256)
      assert.equal(imported.curated.role, entry.role)
      results.push({ assetId:entry.assetId, role:entry.role, sha256:entry.sha256,
        projectRelativeFile:imported.asset.relativeFile })
    }
    const again = catalog.publish(projectRoot, results[0].assetId)
    assert.equal(again.asset.sha256, results[0].sha256)
    assert.equal(again.asset.relativeFile, results[0].projectRelativeFile)
    assert.equal(catalog.search(['Idea'],'hero-core')[0].assetId, 'editorial-hero-h001-v1')
    assert.throws(() => catalog.resolveAsset('unknown-asset-id'), /MODULAR_ASSET_NOT_CURATED/)
    const inventoryBytes = fs.readFileSync(path.join(catalogRoot,'inventory.json'))
    const inventory = JSON.parse(inventoryBytes.toString('utf8'))
    const isolated = path.join(fixture,'isolated-catalog')
    fs.mkdirSync(path.join(isolated,'runtime'), {recursive:true})
    const target = inventory.entries.find(e=>e.code==='S011')
    const source = fs.readFileSync(path.join(catalogRoot,target.runtimeRef))
    fs.writeFileSync(path.join(isolated,target.runtimeRef), Buffer.concat([source, Buffer.from('tampered')]))
    fs.writeFileSync(path.join(isolated,'inventory.json'), inventoryBytes)
    assert.throws(() => new b.CuratedModularCatalogV1(isolated).resolveAsset(target.assetId), /MODULAR_ASSET_SHA_MISMATCH/)
    const injected = new b.CuratedModularCatalogV1(isolated)
    injected.entriesById.get(target.assetId).runtimeRef='../escape.png'
    assert.throws(() => injected.resolveAsset(target.assetId), /MODULAR_PATH_INVALID/)
    inventory.entries[1].role='hero-core'
    fs.writeFileSync(path.join(isolated,'inventory.json'), JSON.stringify(inventory))
    assert.throws(() => new b.CuratedModularCatalogV1(isolated), /MODULAR_MANIFEST_SHA_MISMATCH/)
    const summary = {passed:true, imported:results.length, roleCounts:Object.fromEntries(
      [...new Set(results.map(r=>r.role))].map(role=>[role,results.filter(r=>r.role===role).length])),
      idempotence:true, tamperRejected:true, traversalRejected:true, unauthorizedManifestRejected:true,
      inventorySha256:sha(fs.readFileSync(path.join(catalogRoot,'inventory.json'))), assets:results}
    fs.writeFileSync(path.join(outputRoot,'result.json'),JSON.stringify(summary,null,2)+'\n')
    console.log(JSON.stringify({passed:true,imported:results.length,outputRoot}))
    code = 0
  } catch (error) {
    fs.mkdirSync(outputRoot, {recursive:true})
    fs.writeFileSync(path.join(outputRoot,'failure.txt'),String(error?.stack||error))
    console.error(error?.stack||error)
  } finally {
    try {cleanupTestFixture(fixture)} catch(error) {console.error('fixture-cleanup',error)}
    app.exit(code)
  }
}).catch(error=>{console.error(error);app.exit(1)})
