// 3.4C exercises the compiled publisher with a real temporary Cipher project.
// It never uses a real project, a global active project or network access.
const { app } = require('electron')
const assert = require('assert/strict')
const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = createTestFixture('openmoji-asset-roundtrip')
const CASOS_ESPERADOS = 50
let passed = 0
let completed = false
let networkAttempts = 0
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
const originalAppQuit = app.quit.bind(app)
const blockNetwork = () => {
  networkAttempts += 1
  throw new Error('RED BLOQUEADA POR TEST OPENMOJI ASSET ROUNDTRIP')
}

global.fetch = blockNetwork
http.request = blockNetwork
https.request = blockNetwork
app.quit = () => {}

process.once('exit', () => {
  if (completed) return
  console.error('FALLO: round trip OpenMoji incompleto; completados=' + passed + ' esperados=' + CASOS_ESPERADOS)
  process.exitCode = 1
})

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function snapshotProjectFiles() {
  const projects = path.join(REPO_ROOT, 'proyectos')
  const rows = []
  const walk = dir => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile() && (entry.name === 'project-state.json' || entry.name === 'project-state.json.bak' || entry.name === 'manifest.json')) {
        const stat = fs.statSync(target)
        rows.push([path.relative(REPO_ROOT, target).replace(/\\/g, '/'), sha256(target), stat.size, stat.mtimeMs])
      }
    }
  }
  walk(projects)
  return rows.sort((a, b) => a[0].localeCompare(b[0]))
}

const projectBaseline = JSON.stringify(snapshotProjectFiles())
const rootStateFiles = [
  path.join(REPO_ROOT, 'project-state.json'),
  path.join(REPO_ROOT, 'project-state.json.bak'),
]

function assertNoRepositoryState() {
  for (const file of rootStateFiles) assert(!fs.existsSync(file), 'la suite no puede crear ' + file)
}

function test(name, fn) {
  fn()
  passed += 1
  console.log('OK ' + name)
}

function expectCode(fn, expected) {
  assert.throws(fn, error => error && error.code === expected)
}

function svg(body = '<path d="M0 0"/>', attrs = 'viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"') {
  return Buffer.from('<svg ' + attrs + '>' + body + '</svg>', 'utf8')
}

function countSvgFiles(root) {
  let count = 0
  const walk = dir => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) count += 1
    }
  }
  walk(root)
  return count
}

app.whenReady().then(() => {
  const b = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  const createProject = label => {
    const root = path.join(FIXTURE_ROOT, label)
    b.createProjectFiles(root, { id: 'fixture-' + label, clips: [], timelineVideoClips: [], aiScript: 'fixture' })
    return root
  }
  const publishCake = root => b.publishOpenMojiAsset({ projectRoot: root, stableId: 'openmoji:1f382' })
  const cakeEntry = () => b.getOpenMojiEntry('openmoji:1f382')

  try {
    assertNoRepositoryState()
    const validProject = createProject('valid-project')

    test('1 rejects missing projectRoot', () => expectCode(() => b.publishOpenMojiAsset({ stableId: 'openmoji:1f382' }), 'ASSET_PROJECT_ROOT_REQUIRED'))
    test('2 rejects null projectRoot', () => expectCode(() => b.publishOpenMojiAsset({ projectRoot: null, stableId: 'openmoji:1f382' }), 'ASSET_PROJECT_ROOT_REQUIRED'))
    test('3 rejects an empty projectRoot', () => expectCode(() => b.publishOpenMojiAsset({ projectRoot: '', stableId: 'openmoji:1f382' }), 'ASSET_PROJECT_ROOT_REQUIRED'))
    test('4 rejects a relative projectRoot', () => expectCode(() => b.publishOpenMojiAsset({ projectRoot: '.', stableId: 'openmoji:1f382' }), 'ASSET_PROJECT_ROOT_INVALID'))
    test('5 rejects process.cwd() as projectRoot', () => expectCode(() => b.publishOpenMojiAsset({ projectRoot: process.cwd(), stableId: 'openmoji:1f382' }), 'ASSET_PROJECT_ROOT_IS_REPOSITORY'))
    test('6 rejects the repository root as projectRoot', () => expectCode(() => b.publishOpenMojiAsset({ projectRoot: REPO_ROOT, stableId: 'openmoji:1f382' }), 'ASSET_PROJECT_ROOT_IS_REPOSITORY'))
    test('7 rejects a directory containing .git', () => {
      const root = path.join(FIXTURE_ROOT, 'contains-git')
      fs.mkdirSync(path.join(root, '.git'), { recursive: true })
      fs.writeFileSync(path.join(root, 'project-state.json'), JSON.stringify({ schemaVersion: 1, projectSubstrate: null }))
      expectCode(() => publishCake(root), 'ASSET_PROJECT_ROOT_IS_REPOSITORY')
    })
    test('8 rejects a junction used as projectRoot', () => {
      const target = path.join(FIXTURE_ROOT, 'junction-root-target')
      const link = path.join(FIXTURE_ROOT, 'junction-root-link')
      fs.mkdirSync(target)
      fs.writeFileSync(path.join(target, 'project-state.json'), JSON.stringify({ schemaVersion: 1, projectSubstrate: null }))
      fs.symlinkSync(target, link, 'junction')
      expectCode(() => publishCake(link), 'ASSET_PROJECT_ROOT_INVALID')
    })
    test('9 rejects a directory without project-state.json', () => {
      const root = path.join(FIXTURE_ROOT, 'no-state')
      fs.mkdirSync(root)
      expectCode(() => publishCake(root), 'ASSET_PROJECT_STATE_INVALID')
    })
    test('10 rejects a project with a future state schema', () => {
      const root = path.join(FIXTURE_ROOT, 'future-state')
      fs.mkdirSync(root)
      fs.writeFileSync(path.join(root, 'project-state.json'), JSON.stringify({ schemaVersion: 99, projectSubstrate: null }))
      expectCode(() => publishCake(root), 'ASSET_PROJECT_STATE_INVALID')
    })
    test('11 rejects a nonexistent stableId', () => expectCode(() => b.publishOpenMojiAsset({ projectRoot: validProject, stableId: 'openmoji:dead' }), 'OPENMOJI_ASSET_NOT_FOUND'))
    test('12 resolves birthday cake locally as 1F382', () => {
      assert.equal(cakeEntry().hexcode, '1F382')
      assert.match(b.resolveOpenMojiSvgCatalogPath(cakeEntry()), /1F382\.svg$/i)
    })
    test('13 accepts the selected real SVG with the deep policy', () => {
      const source = fs.readFileSync(b.resolveOpenMojiSvgCatalogPath(cakeEntry()))
      const validation = b.validateOpenMojiSvgBytes(source)
      assert.equal(validation.validationRevision, 'openmoji-svg-v1')
      assert.match(validation.viewBox, /^0\s+0\s+72\s+72$/)
    })

    const result = publishCake(validProject)
    const manifestPath = path.join(validProject, 'materiales', 'assets', 'manifest.json')
    test('14 publishes an image/svg+xml ProjectAssetRecord', () => assert.equal(result.asset.mime, 'image/svg+xml'))
    test('15 records an exact lower-case SHA-256', () => assert.match(result.asset.sha256, /^[a-f0-9]{64}$/))
    test('16 writes under materiales/assets/openmoji by SHA', () => {
      assert.equal(result.status, 'created')
      assert.match(result.absoluteFile.replace(/\\/g, '/'), /materiales\/assets\/openmoji\/[a-f0-9]{64}\.svg$/)
      assert(fs.existsSync(result.absoluteFile))
    })
    test('17 records a confined relativeFile', () => assert.equal(result.asset.relativeFile, 'materiales/assets/openmoji/' + result.asset.sha256 + '.svg'))
    test('18 writes exactly one manifest record', () => assert.equal(b.readAssetStorage(validProject).manifest.assets.length, 1))
    test('19 records complete local-catalog provenance', () => {
      const source = result.asset.source
      assert.equal(source.providerVersion, '17.0.0')
      assert.equal(source.licenseClaim, 'CC-BY-SA-4.0')
      assert.match(source.sourceUrl, /^https:/)
      assert.match(source.fileUrl, /^https:/)
      assert.match(source.licenseUrl, /^https:/)
      assert.match(source.fetchedAt, /^\d{4}-\d\d-\d\dT/)
    })
    test('20 uses the central OpenMoji attribution authority', () => assert.equal(result.asset.source.attribution, b.getOpenMojiCatalogInfo().attributionText))
    test('21 second publication is idempotent and reused', () => assert.equal(publishCake(validProject).status, 'reused'))
    test('22 upper-case stableId maps to the same record without duplication', () => {
      const again = b.publishOpenMojiAsset({ projectRoot: validProject, stableId: 'OPENMOJI:1F382' })
      assert.equal(again.status, 'reused')
      assert.equal(again.asset.id, result.asset.id)
    })
    test('23 idempotence leaves one active record', () => assert.equal(b.readAssetStorage(validProject).manifest.assets.length, 1))
    test('24 idempotence leaves one final SVG', () => assert.equal(countSvgFiles(path.join(validProject, 'materiales', 'assets', 'openmoji')), 1))
    test('25 reopens the manifest from disk with no in-memory asset authority', () => {
      b.clearOpenMojiCatalogCacheForTests()
      const reopened = b.readAssetStorage(validProject)
      assert.equal(reopened.status, 'valid')
      assert.equal(reopened.manifest.assets[0].id, result.asset.id)
    })
    test('26 reopens and verifies the exact bytes offline', () => {
      const record = b.readAssetStorage(validProject).manifest.assets[0]
      assert.equal(b.verifyProjectAssetContent(validProject, record).sha256, record.sha256)
    })
    test('27 detects a missing published file', () => {
      const root = createProject('missing-file')
      const published = publishCake(root)
      fs.unlinkSync(published.absoluteFile)
      expectCode(() => b.verifyProjectAssetContent(root, published.asset), 'PROJECT_ASSET_MISSING')
    })
    test('28 detects same-size altered bytes by SHA', () => {
      const root = createProject('altered-file')
      const published = publishCake(root)
      const bytes = fs.readFileSync(published.absoluteFile)
      bytes[bytes.length - 1] ^= 1
      fs.writeFileSync(published.absoluteFile, bytes)
      expectCode(() => b.verifyProjectAssetContent(root, published.asset), 'PROJECT_ASSET_SHA_MISMATCH')
    })
    test('29 detects an altered byteLength', () => {
      const root = createProject('size-file')
      const published = publishCake(root)
      fs.appendFileSync(published.absoluteFile, 'x')
      expectCode(() => b.verifyProjectAssetContent(root, published.asset), 'PROJECT_ASSET_SIZE_MISMATCH')
    })
    test('30 rejects traversal in a ProjectAsset relativeFile', () => {
      expectCode(() => b.verifyProjectAssetContent(validProject, { ...result.asset, relativeFile: 'materiales/assets/openmoji/../escape.svg' }), 'PROJECT_ASSET_OUTSIDE_PROJECT')
    })
    test('31 rejects a junction inside the asset route', () => {
      const root = createProject('junction-file')
      const outside = path.join(FIXTURE_ROOT, 'junction-outside')
      const link = path.join(root, 'materiales', 'assets', 'openmoji', 'linked')
      fs.mkdirSync(outside)
      fs.mkdirSync(path.dirname(link), { recursive: true })
      fs.symlinkSync(outside, link, 'junction')
      expectCode(() => b.verifyProjectAssetContent(root, { ...result.asset, relativeFile: 'materiales/assets/openmoji/linked/asset.svg' }), 'PROJECT_ASSET_OUTSIDE_PROJECT')
    })
    test('32 rejects SVG script before publication', () => expectCode(() => b.validateOpenMojiSvgBytes(svg('<script>alert(1)</script>')), 'OPENMOJI_SVG_FORBIDDEN_ELEMENT'))
    test('33 rejects SVG foreignObject before publication', () => expectCode(() => b.validateOpenMojiSvgBytes(svg('<foreignObject/>')), 'OPENMOJI_SVG_FOREIGN_OBJECT'))
    test('34 rejects SVG DOCTYPE before publication', () => {
      expectCode(() => b.validateOpenMojiSvgBytes(Buffer.from('<!DOCTYPE svg><svg viewBox="0 0 1 1"/>')), 'OPENMOJI_SVG_DOCTYPE_FORBIDDEN')
    })
    test('35 rejects SVG ENTITY before publication', () => expectCode(() => b.validateOpenMojiSvgBytes(Buffer.from('<!ENTITY x "y"><svg viewBox="0 0 1 1"/>')), 'OPENMOJI_SVG_ENTITY_FORBIDDEN'))
    test('36 rejects external href resources before publication', () => expectCode(() => b.validateOpenMojiSvgBytes(svg('<image href="https://example.test/a.png"/>')), 'OPENMOJI_SVG_EXTERNAL_RESOURCE'))
    test('37 rejects external CSS url resources before publication', () => expectCode(() => b.validateOpenMojiSvgBytes(svg('<path style="fill:url(https://example.test/a)"/>')), 'OPENMOJI_SVG_EXTERNAL_RESOURCE'))
    test('38 rejects SVG event handlers before publication', () => expectCode(() => b.validateOpenMojiSvgBytes(svg('<path onclick="alert(1)"/>')), 'OPENMOJI_SVG_EVENT_HANDLER'))
    test('39 rejects an SVG without a viewBox', () => expectCode(() => b.validateOpenMojiSvgBytes(svg('', 'xmlns="http://www.w3.org/2000/svg"')), 'OPENMOJI_SVG_VIEWBOX_INVALID'))
    test('40 rejects an oversized SVG before publication', () => {
      const tooLarge = Buffer.concat([svg('<path/>'), Buffer.alloc(b.MAX_OPENMOJI_SVG_BYTES + 1)])
      expectCode(() => b.validateOpenMojiSvgBytes(tooLarge), 'OPENMOJI_SVG_TOO_LARGE')
    })
    test('41 manifest failure preserves the previous manifest and rolls back a new file', () => {
      const root = createProject('manifest-failure-new')
      const before = fs.readFileSync(path.join(root, 'materiales', 'assets', 'manifest.json'), 'utf8')
      const backupDirectory = path.join(root, 'materiales', 'assets', 'manifest.json.bak')
      fs.mkdirSync(backupDirectory)
      expectCode(() => publishCake(root), 'OPENMOJI_ASSET_MANIFEST_WRITE_FAILED')
      assert.equal(fs.readFileSync(path.join(root, 'materiales', 'assets', 'manifest.json'), 'utf8'), before)
      assert.equal(countSvgFiles(path.join(root, 'materiales', 'assets', 'openmoji')), 0)
    })
    test('42 manifest failure never deletes a pre-existing matching file', () => {
      const root = createProject('manifest-failure-existing')
      const source = fs.readFileSync(b.resolveOpenMojiSvgCatalogPath(cakeEntry()))
      const validation = b.validateOpenMojiSvgBytes(source)
      const destination = path.join(root, 'materiales', 'assets', 'openmoji', validation.sha256 + '.svg')
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.writeFileSync(destination, source)
      fs.mkdirSync(path.join(root, 'materiales', 'assets', 'manifest.json.bak'))
      expectCode(() => publishCake(root), 'OPENMOJI_ASSET_MANIFEST_WRITE_FAILED')
      assert.equal(sha256(destination), validation.sha256)
    })
    test('43 an incomplete temporary is never recorded as an asset', () => {
      const root = createProject('orphan-temporary')
      const temporary = path.join(root, 'materiales', 'assets', 'openmoji', '.orphan.cipher-fixture.tmp')
      fs.mkdirSync(path.dirname(temporary), { recursive: true })
      fs.writeFileSync(temporary, '<svg')
      const published = publishCake(root)
      const assets = b.readAssetStorage(root).manifest.assets
      assert.equal(assets.length, 1)
      assert(!assets.some(asset => asset.relativeFile.includes('.tmp')))
      assert.equal(b.verifyProjectAssetContent(root, published.asset).sha256, published.asset.sha256)
    })
    test('44 no fetch, http or https request was attempted', () => assert.equal(networkAttempts, 0))
    test('45 no root project-state files were created', () => assertNoRepositoryState())
    test('46 the three real project states and manifests stay byte-identical', () => assert.equal(JSON.stringify(snapshotProjectFiles()), projectBaseline))
    test('47 no SVG under proyectos is tracked by Git', () => {
      const listed = childProcess.spawnSync('git', ['ls-files', '--', 'proyectos'], { cwd: REPO_ROOT, encoding: 'utf8' })
      assert.equal(listed.status, 0)
      assert(!String(listed.stdout).split(/\r?\n/).some(line => line.toLowerCase().endsWith('.svg')))
    })
    test('48 temporary publication did not add an SVG to a real project', () => {
      assert.equal(countSvgFiles(path.join(REPO_ROOT, 'proyectos')), 0)
    })
    test('49 the manifest remains structurally and physically valid', () => {
      const storage = b.readAssetStorage(validProject)
      assert.equal(storage.audit.status, 'valid')
      assert.equal(fs.existsSync(manifestPath), true)
    })
    test('50 package publication does not make the local catalog a project asset', () => {
      assert.equal(b.readAssetStorage(validProject).manifest.assets[0].source.providerVersion, '17.0.0')
      assert.equal(networkAttempts, 0)
    })

    assert.equal(passed, CASOS_ESPERADOS)
    console.log('CASOS_COMPLETADOS=' + passed)
    console.log('CASOS_ESPERADOS=' + CASOS_ESPERADOS)
    console.log('TODO CORRECTO: ' + CASOS_ESPERADOS + ' casos OpenMoji asset round trip offline.')
    completed = true
  } catch (error) {
    console.error(error && error.stack || error)
    process.exitCode = 1
  } finally {
    global.fetch = originalFetch
    http.request = originalHttpRequest
    https.request = originalHttpsRequest
    app.quit = originalAppQuit
    const exitCode = process.exitCode || 0
    assertNoRepositoryState()
    cleanupTestFixture(FIXTURE_ROOT)
    app.exit(exitCode)
  }
}).catch(error => {
  console.error(error && error.stack || error)
  process.exitCode = 1
  process.chdir(path.dirname(FIXTURE_ROOT))
  cleanupTestFixture(FIXTURE_ROOT)
  app.exit(1)
})
