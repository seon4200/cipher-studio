// Exercises the actual compiled main-process catalog. Fixtures are generated in
// marked os.tmpdir() roots; no OpenMoji binary and no project state is written by this suite.
const { app } = require('electron')
const assert = require('assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')

const RAIZ = path.resolve(__dirname, '..')
const CASOS_ESPERADOS = 30
let passed = 0
let networkAttempts = 0
let completed = false
const originalFetch = global.fetch
const originalHttpRequest = http.request
const originalHttpsRequest = https.request
const originalAppQuit = app.quit.bind(app)
const blockedNetwork = () => {
  networkAttempts += 1
  throw new Error('RED BLOQUEADA POR TEST OPENMOJI')
}

global.fetch = blockedNetwork
http.request = blockedNetwork
https.request = blockedNetwork
// index.ts registers its normal window startup when imported. Do not let a
// transient close event end this synchronous catalog suite prematurely.
app.quit = () => {}

process.once('exit', () => {
  if (completed) return
  console.error('FALLO: el arnés OpenMoji terminó antes de completar los casos; completados=' + passed + ' esperados=' + CASOS_ESPERADOS)
  process.exitCode = 1
})

function test(name, fn) {
  fn()
  passed += 1
  console.log('OK ' + name)
}

function code(fn, expected) {
  assert.throws(fn, error => error && error.code === expected)
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function resourceFingerprint(manifest) {
  return sha256(Buffer.from([
    'openmoji',
    manifest.catalogVersion,
    manifest.metadataSha256,
    manifest.fileListSha256,
    manifest.generatorRevision,
  ].join('\n'), 'utf8'))
}

function fixtureEntry(overrides = {}) {
  return {
    emoji: '🧪',
    hexcode: '1F9EA',
    group: 'objects',
    subgroups: 'science',
    annotation: 'test tube',
    tags: 'experiment, science, test',
    openmoji_tags: '',
    ...overrides,
  }
}

function makeFixture({
  entries = [fixtureEntry()],
  withSvg = true,
  version = '17.0.0',
  svgContent = '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  manifestOverrides = {},
} = {}) {
  const root = createTestFixture('openmoji-catalog')
  fs.mkdirSync(path.join(root, 'data'), { recursive: true })
  fs.mkdirSync(path.join(root, 'color', 'svg'), { recursive: true })
  const metadataBytes = Buffer.from(JSON.stringify(entries), 'utf8')
  fs.writeFileSync(path.join(root, 'LICENSE.txt'), 'Creative Commons Attribution-ShareAlike 4.0 International fixture')
  fs.writeFileSync(path.join(root, 'data', 'openmoji.json'), metadataBytes)
  if (withSvg) for (const entry of entries) {
    fs.writeFileSync(path.join(root, 'color', 'svg', entry.hexcode + '.svg'), svgContent)
  }
  const fileList = entries
    .map(entry => 'color/svg/' + entry.hexcode + '.svg|' + Buffer.byteLength(svgContent))
    .sort()
    .join('\n')
  const manifest = {
    resourceSchemaVersion: 1,
    provider: 'openmoji',
    sourceKind: 'official-npm',
    sourcePackage: 'openmoji',
    catalogVersion: version,
    metadataRelativeFile: 'data/openmoji.json',
    svgRootRelative: 'color/svg',
    licenseRelativeFile: 'LICENSE.txt',
    entryCount: entries.length,
    svgCount: entries.length,
    knownMissingSvgHexcodes: [],
    metadataSha256: sha256(metadataBytes),
    fileListSha256: sha256(Buffer.from(fileList, 'utf8')),
    generatorRevision: 'fixture-openmoji-catalog-v1',
  }
  Object.assign(manifest, manifestOverrides)
  if (!Object.prototype.hasOwnProperty.call(manifestOverrides, 'resourceFingerprint'))
    manifest.resourceFingerprint = resourceFingerprint(manifest)
  fs.writeFileSync(path.join(root, 'catalog-resource.json'), JSON.stringify(manifest))
  return root
}

function normalizedPath(value) {
  return typeof value === 'string' ? value.replace(/\\/g, '/').toLowerCase() : ''
}

function trackFilesystem(fn) {
  const originals = {
    statSync: fs.statSync,
    lstatSync: fs.lstatSync,
    realpathSync: fs.realpathSync,
    readdirSync: fs.readdirSync,
    readFileSync: fs.readFileSync,
    openSync: fs.openSync,
  }
  const tracker = {
    svgPaths: new Set(),
    metadataReads: 0,
    operations: [],
  }
  const record = (operation, value) => {
    const file = normalizedPath(value)
    if (file.includes('/color/svg/') || file.endsWith('/color/svg')) tracker.svgPaths.add(file)
    if (operation === 'readFileSync' && file.endsWith('/data/openmoji.json')) tracker.metadataReads += 1
    tracker.operations.push({ operation, file })
  }
  fs.statSync = (...args) => {
    record('statSync', args[0])
    return originals.statSync(...args)
  }
  fs.lstatSync = (...args) => {
    record('lstatSync', args[0])
    return originals.lstatSync(...args)
  }
  fs.realpathSync = (...args) => {
    record('realpathSync', args[0])
    return originals.realpathSync(...args)
  }
  fs.readdirSync = (...args) => {
    record('readdirSync', args[0])
    return originals.readdirSync(...args)
  }
  fs.readFileSync = (...args) => {
    record('readFileSync', args[0])
    return originals.readFileSync(...args)
  }
  fs.openSync = (...args) => {
    record('openSync', args[0])
    return originals.openSync(...args)
  }
  try {
    return fn(tracker)
  } finally {
    fs.statSync = originals.statSync
    fs.lstatSync = originals.lstatSync
    fs.realpathSync = originals.realpathSync
    fs.readdirSync = originals.readdirSync
    fs.readFileSync = originals.readFileSync
    fs.openSync = originals.openSync
  }
}

const b = require(path.join(RAIZ, 'dist-electron/main/index.js'))
const expectedRoot = path.join(RAIZ, 'dist-electron', 'openmoji')
const runtimeRoot = b.resolveOpenMojiCatalogResourceRoot({
  packaged: false,
  compiledMainDir: path.join(RAIZ, 'dist-electron', 'main'),
})
let catalog
let loadMs = 0

try {
  test('1 info declares the exact official version and attribution', () => {
    const info = b.getOpenMojiCatalogInfo()
    assert.equal(info.provider, 'openmoji')
    assert.equal(info.catalogVersion, '17.0.0')
    assert.equal(info.license, 'CC-BY-SA-4.0')
    assert.equal(info.attributionRequired, true)
    assert.match(info.attributionText, /OpenMoji 17\.0\.0/)
  })
  test('2 runtime loads metadata and aliases without touching SVG files', () => {
    b.clearOpenMojiCatalogCacheForTests()
    trackFilesystem(tracker => {
      const started = process.hrtime.bigint()
      catalog = b.loadOpenMojiCatalog()
      loadMs = Number(process.hrtime.bigint() - started) / 1e6
      assert.equal(catalog.entries.length, 4495)
      assert.equal(catalog.warnings.length, 0)
      assert.equal(tracker.svgPaths.size, 0)
      console.log('MEDICION openmoji first-process-load-ms=' + loadMs.toFixed(1) + ' svg-inspections=' + tracker.svgPaths.size)
    })
  })
  test('3 the real transformation does not mutate official metadata', () => {
    const rawPath = path.join(runtimeRoot, 'data', 'openmoji.json')
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
    const before = JSON.stringify(raw)
    const transformed = b.transformOpenMojiMetadata(raw)
    assert.equal(transformed.length, 4495)
    assert.equal(JSON.stringify(raw), before)
  })
  test('4 stable IDs and hexcodes are unique', () => {
    assert.equal(new Set(catalog.entries.map(entry => entry.stableId)).size, catalog.entries.length)
    assert.equal(new Set(catalog.entries.map(entry => entry.hexcode)).size, catalog.entries.length)
  })
  test('5 manifest declarations match the generated catalog without enumerating SVG files', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'catalog-resource.json'), 'utf8'))
    assert.equal(manifest.entryCount, 4495)
    assert.equal(manifest.svgCount, 4495)
    assert.match(manifest.metadataSha256, /^[0-9a-f]{64}$/)
    assert.match(manifest.fileListSha256, /^[0-9a-f]{64}$/)
    assert.match(manifest.resourceFingerprint, /^[0-9a-f]{64}$/)
  })
  test('6 load, search and list APIs inspect zero SVG files', () => {
    b.clearOpenMojiCatalogCacheForTests()
    trackFilesystem(tracker => {
      const loaded = b.loadOpenMojiCatalog()
      assert.equal(b.searchOpenMoji('birthday cake')[0].entry.hexcode, '1F382')
      assert.equal(b.getOpenMojiEntry('openmoji:1f382').annotation, 'birthday cake')
      assert.equal(b.getOpenMojiEntryByHexcode('1F382').annotation, 'birthday cake')
      assert(b.listOpenMojiGroups().includes('food-drink'))
      assert(b.listOpenMojiSubgroups('food-drink').includes('food-sweet'))
      assert.equal(loaded.entries.length, 4495)
      assert.equal(tracker.svgPaths.size, 0)
    })
  })
  test('7 cache returns one immutable catalog and does not reparse metadata', () => {
    b.clearOpenMojiCatalogCacheForTests()
    trackFilesystem(tracker => {
      const first = b.loadOpenMojiCatalog()
      const started = process.hrtime.bigint()
      const second = b.loadOpenMojiCatalog()
      const third = b.loadOpenMojiCatalog()
      const cachedLoadMs = Number(process.hrtime.bigint() - started) / 1e6
      assert.strictEqual(first, second)
      assert.strictEqual(second, third)
      assert.deepEqual(b.searchOpenMoji('sweet').map(result => result.entry.stableId), b.searchOpenMoji('sweet').map(result => result.entry.stableId))
      assert.equal(tracker.metadataReads, 1)
      assert.equal(tracker.svgPaths.size, 0)
      console.log('MEDICION openmoji cached-in-process-load-ms=' + cachedLoadMs.toFixed(3) + ' metadata-reads=' + tracker.metadataReads)
    })
  })
  test('8 cache can be reset explicitly for isolated fixtures', () => {
    b.clearOpenMojiCatalogCacheForTests()
    const first = b.loadOpenMojiCatalog()
    b.clearOpenMojiCatalogCacheForTests()
    const second = b.loadOpenMojiCatalog()
    assert.notStrictEqual(first, second)
    assert.deepEqual(first.entries.map(entry => entry.stableId), second.entries.map(entry => entry.stableId))
  })
  test('9 exact annotation returns birthday cake', () => {
    const result = b.searchOpenMoji('birthday cake')
    assert.equal(result[0].entry.hexcode, '1F382')
    assert.equal(result[0].matchReason, 'annotation-exact')
    assert.equal(b.getOpenMojiEntry(result[0].entry.stableId).annotation, 'birthday cake')
  })
  test('10 exact emoji returns birthday cake', () => {
    const result = b.searchOpenMoji('🎂')
    assert.equal(result[0].entry.hexcode, '1F382')
    assert.equal(result[0].matchReason, 'emoji-exact')
  })
  test('11 exact hexcode normalizes case and returns birthday cake', () => {
    const result = b.searchOpenMoji('1f382')
    assert.equal(result[0].entry.annotation, 'birthday cake')
    assert.equal(result[0].matchReason, 'hexcode-exact')
    assert.equal(b.getOpenMojiEntryByHexcode('1f382').stableId, result[0].entry.stableId)
  })
  test('12 Spanish aliases return documented candidates without silent selection', () => {
    const result = b.searchOpenMoji('pastel de cumpleaños')
    assert.equal(result[0].entry.hexcode, '1F382')
    assert.equal(result[0].matchReason, 'alias-exact')
    for (const query of ['pastel', 'torta', 'tarta', 'pastel de cumpleaños', 'cumpleaños', 'cupcake', 'dona', 'donut', 'rosquilla', 'galleta', 'chocolate', 'caramelo', 'dulce', 'piruleta', 'helado'])
      assert(b.searchOpenMoji(query).length > 0, 'sin candidato para ' + query)
    assert(b.searchOpenMoji('helado').length > 1)
  })
  test('13 token search uses metadata tags without fuzzy matching', () => {
    const result = b.searchOpenMoji('birthday sweet')
    assert.equal(result[0].entry.hexcode, '1F382')
    assert.equal(result[0].matchReason, 'all-tokens')
    assert.equal(b.searchOpenMoji('lollip')[0].matchReason, 'token-prefix')
  })
  test('14 the same query has a stable deterministic order', () => {
    const started = process.hrtime.bigint()
    const first = b.searchOpenMoji('sweet', { group: 'food-drink', subgroup: 'food-sweet', limit: 50 })
    const second = b.searchOpenMoji('sweet', { group: 'food-drink', subgroup: 'food-sweet', limit: 50 })
    assert.deepEqual(first.map(result => [result.score, result.entry.stableId]), second.map(result => [result.score, result.entry.stableId]))
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6
    console.log('MEDICION openmoji two-searches-ms=' + elapsed.toFixed(3) + ' first-process-load-ms=' + loadMs.toFixed(1))
  })
  test('15 an empty query is rejected instead of listing the catalog', () => {
    code(() => b.searchOpenMoji('   '), 'OPENMOJI_QUERY_INVALID')
  })
  test('16 invalid or unsafe limits are rejected explicitly', () => {
    code(() => b.searchOpenMoji('cake', { limit: 0 }), 'OPENMOJI_QUERY_INVALID')
    code(() => b.searchOpenMoji('cake', { limit: 51 }), 'OPENMOJI_QUERY_INVALID')
  })
  test('17 groups and subgroups list and filter deterministically', () => {
    assert(b.listOpenMojiGroups().includes('food-drink'))
    assert(b.listOpenMojiSubgroups('food-drink').includes('food-sweet'))
    const result = b.searchOpenMoji('sweet', { group: 'food-drink', subgroup: 'food-sweet', limit: 50 })
    assert(result.length > 0)
    assert(result.every(item => item.entry.group === 'food-drink' && item.entry.subgroup === 'food-sweet'))
  })
  test('18 food-drink/food-sweet has its measured catalog results', () => {
    const sweets = catalog.entries.filter(entry => entry.group === 'food-drink' && entry.subgroup === 'food-sweet')
    assert.equal(sweets.length, 14)
    assert(sweets.some(entry => entry.annotation === 'birthday cake'))
  })
  test('19 resolving birthday cake validates only its selected SVG lazily', () => {
    b.clearOpenMojiCatalogCacheForTests()
    trackFilesystem(tracker => {
      const cake = b.searchOpenMoji('birthday cake')[0].entry
      const started = process.hrtime.bigint()
      const svg = b.resolveOpenMojiSvgCatalogPath(cake)
      const selectedSvgValidationMs = Number(process.hrtime.bigint() - started) / 1e6
      assert.match(svg.replace(/\\/g, '/'), /color\/svg\/1F382\.svg$/)
      assert.deepEqual([...tracker.svgPaths], [svg.replace(/\\/g, '/').toLowerCase()])
      console.log('MEDICION openmoji selected-svg-validation-ms=' + selectedSvgValidationMs.toFixed(3) + ' inspections=' + tracker.svgPaths.size)
    })
  })
  test('20 an alias to a nonexistent stable ID fails validation', () => {
    const root = makeFixture()
    try {
      code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [{ alias: 'fantasma', language: 'es', stableIds: ['openmoji:dead'] }] }), 'OPENMOJI_ALIAS_INVALID')
    } finally { cleanupTestFixture(root) }
  })
  test('21 an incompatible resource version fails before use', () => {
    const root = makeFixture({ version: '17.0.1' })
    try { code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_VERSION_MISMATCH') }
    finally { cleanupTestFixture(root) }
  })
  test('22 duplicate stable IDs in metadata fail deterministically', () => {
    const root = makeFixture({ entries: [fixtureEntry(), fixtureEntry({ annotation: 'duplicate tube' })] })
    try { code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_DUPLICATE_ID') }
    finally { cleanupTestFixture(root) }
  })
  test('23 a missing selected color SVG fails lazily, not during catalog load', () => {
    const root = makeFixture({ withSvg: false })
    try {
      const fixtureCatalog = b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] })
      assert.equal(fixtureCatalog.entries.length, 1)
      code(() => b.resolveOpenMojiSvgCatalogPath(fixtureCatalog.entries[0], { resourceRoot: root, aliases: [] }), 'OPENMOJI_SVG_NOT_FOUND')
    } finally { cleanupTestFixture(root) }
  })
  test('24 traversal and absolute path injection are rejected', () => {
    const cake = b.getOpenMojiEntryByHexcode('1F382')
    code(() => b.resolveOpenMojiSvgCatalogPath({ ...cake, svgRelativeFile: '../outside.svg' }), 'OPENMOJI_PATH_OUTSIDE_CATALOG')
    code(() => b.resolveOpenMojiSvgCatalogPath({ ...cake, svgRelativeFile: 'C:\\outside.svg' }), 'OPENMOJI_PATH_OUTSIDE_CATALOG')
  })
  test('25 selected SVG with an invalid preamble fails lazy validation', () => {
    const root = makeFixture({ svgContent: '<html>not svg</html>' })
    try {
      const fixtureCatalog = b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] })
      code(() => b.resolveOpenMojiSvgCatalogPath(fixtureCatalog.entries[0], { resourceRoot: root, aliases: [] }), 'OPENMOJI_SVG_NOT_FOUND')
    } finally { cleanupTestFixture(root) }
  })
  test('26 an invalid manifest schema is rejected', () => {
    const root = makeFixture({ manifestOverrides: { resourceSchemaVersion: 2 } })
    try { code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_METADATA_INVALID') }
    finally { cleanupTestFixture(root) }
  })
  test('27 metadata SHA mismatch is rejected without inspecting SVG files', () => {
    const root = makeFixture({ manifestOverrides: { metadataSha256: '0'.repeat(64) } })
    try {
      trackFilesystem(tracker => {
        code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_METADATA_INVALID')
        assert.equal(tracker.svgPaths.size, 0)
      })
    } finally { cleanupTestFixture(root) }
  })
  test('28 resource fingerprint inconsistency is rejected', () => {
    const root = makeFixture({ manifestOverrides: { resourceFingerprint: 'f'.repeat(64) } })
    try { code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_METADATA_INVALID') }
    finally { cleanupTestFixture(root) }
  })
  test('29 attribution is a single immutable authority for callers', () => {
    const first = b.getOpenMojiCatalogInfo()
    first.attributionText = 'mutated by caller'
    const second = b.getOpenMojiCatalogInfo()
    assert.match(second.attributionText, /OpenMoji 17\.0\.0/)
    assert.equal(second.attributionRevision, 'openmoji-catalog-v1')
  })
  test('30 search and load run while fetch/http/https are blocked', () => {
    assert.equal(b.searchOpenMoji('galleta')[0].entry.annotation, 'cookie')
    assert.equal(networkAttempts, 0)
    assert.equal(runtimeRoot, expectedRoot)
    assert(fs.existsSync(path.join(runtimeRoot, 'catalog-resource.json')))
    assert(fs.existsSync(path.join(runtimeRoot, 'LICENSE.txt')))
    assert.equal(b.resolveOpenMojiCatalogResourceRoot({ packaged: true, resourcesPath: 'C:\\Cipher\\resources' }), path.join('C:\\Cipher\\resources', 'openmoji'))
  })
  assert.equal(passed, CASOS_ESPERADOS)
  console.log('CASOS_COMPLETADOS=' + passed)
  console.log('CASOS_ESPERADOS=' + CASOS_ESPERADOS)
  console.log('TODO CORRECTO: ' + CASOS_ESPERADOS + ' casos OpenMoji offline.')
  completed = true
} catch (error) {
  console.error(error && error.stack || error)
  process.exitCode = 1
} finally {
  global.fetch = originalFetch
  http.request = originalHttpRequest
  https.request = originalHttpsRequest
  app.quit = originalAppQuit
  app.exit(process.exitCode || 0)
}
