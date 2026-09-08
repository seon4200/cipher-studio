// Exercises the actual compiled main-process catalog. Fixtures are generated in
// os.tmpdir(); no OpenMoji binary and no project state is written by this suite.
const { app } = require('electron')
const assert = require('assert/strict')
const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..')
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
// index.ts opens its normal window when imported. Do not let a transient close
// event end this synchronous catalog suite before all 25 cases complete.
app.quit = () => {}

process.once('exit', () => {
  if (completed) return
  console.error('FALLO: el arnés OpenMoji terminó antes de completar los 25 casos; completados=' + passed)
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

function makeFixture({ entries = [fixtureEntry()], withSvg = true, version = '17.0.0', colorSvgCount = entries.length } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-openmoji-catalog-'))
  fs.mkdirSync(path.join(root, 'data'), { recursive: true })
  fs.mkdirSync(path.join(root, 'color', 'svg'), { recursive: true })
  fs.writeFileSync(path.join(root, 'LICENSE.txt'), 'CC-BY-SA-4.0 fixture')
  fs.writeFileSync(path.join(root, 'data', 'openmoji.json'), JSON.stringify(entries))
  fs.writeFileSync(path.join(root, 'catalog-resource.json'), JSON.stringify({
    resourceFormatVersion: 1,
    provider: 'openmoji',
    sourceKind: 'official-npm',
    sourcePackage: 'openmoji',
    catalogVersion: version,
    metadataRelativeFile: 'data/openmoji.json',
    svgDirectory: 'color/svg',
    licenseRelativeFile: 'LICENSE.txt',
    entryCount: entries.length,
    colorSvgCount,
    knownMissingSvgHexcodes: [],
  }))
  if (withSvg) for (const entry of entries) {
    fs.writeFileSync(path.join(root, 'color', 'svg', entry.hexcode + '.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  }
  return root
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
    test('2 the generated local metadata loads and is nonempty', () => {
      const started = process.hrtime.bigint()
      catalog = b.loadOpenMojiCatalog()
      loadMs = Number(process.hrtime.bigint() - started) / 1e6
      assert(catalog.entries.length > 0)
      assert.equal(catalog.warnings.length, 0)
      console.log('MEDICION openmoji cold-load-ms=' + loadMs.toFixed(1))
    })
    test('3 the real transformation does not mutate official metadata', () => {
      const rawPath = path.join(runtimeRoot, 'data', 'openmoji.json')
      const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
      const before = JSON.stringify(raw)
      const transformed = b.transformOpenMojiMetadata(raw)
      assert(transformed.length > 0)
      assert.equal(JSON.stringify(raw), before)
    })
    test('4 stable IDs and hexcodes are unique', () => {
      assert.equal(new Set(catalog.entries.map(entry => entry.stableId)).size, catalog.entries.length)
      assert.equal(new Set(catalog.entries.map(entry => entry.hexcode)).size, catalog.entries.length)
    })
    test('5 every indexed entry resolves a local color SVG', () => {
      for (const entry of catalog.entries) {
        const svg = b.resolveOpenMojiSvgCatalogPath(entry)
        assert.equal(path.extname(svg).toLowerCase(), '.svg')
        assert(fs.statSync(svg).size > 0)
      }
    })
    test('6 every resolved SVG path stays under the catalog root', () => {
      const root = fs.realpathSync(runtimeRoot)
      for (const entry of catalog.entries) {
        const relative = path.relative(root, b.resolveOpenMojiSvgCatalogPath(entry))
        assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative))
      }
    })
    test('7 exact annotation returns birthday cake', () => {
      const result = b.searchOpenMoji('birthday cake')
      assert.equal(result[0].entry.hexcode, '1F382')
      assert.equal(result[0].matchReason, 'annotation-exact')
      assert.equal(b.getOpenMojiEntry(result[0].entry.stableId).annotation, 'birthday cake')
    })
    test('8 exact emoji returns birthday cake', () => {
      const result = b.searchOpenMoji('🎂')
      assert.equal(result[0].entry.hexcode, '1F382')
      assert.equal(result[0].matchReason, 'emoji-exact')
    })
    test('9 exact hexcode normalizes case and returns birthday cake', () => {
      const result = b.searchOpenMoji('1f382')
      assert.equal(result[0].entry.annotation, 'birthday cake')
      assert.equal(result[0].matchReason, 'hexcode-exact')
      assert.equal(b.getOpenMojiEntryByHexcode('1f382').stableId, result[0].entry.stableId)
    })
    test('10 Spanish alias returns a documented candidate', () => {
      const result = b.searchOpenMoji('pastel de cumpleaños')
      assert.equal(result[0].entry.hexcode, '1F382')
      assert.equal(result[0].matchReason, 'alias-exact')
      for (const query of ['pastel', 'torta', 'tarta', 'pastel de cumpleaños', 'cumpleaños', 'cupcake', 'dona', 'donut', 'rosquilla', 'galleta', 'chocolate', 'caramelo', 'dulce', 'piruleta', 'helado'])
        assert(b.searchOpenMoji(query).length > 0, 'sin candidato para ' + query)
      assert(b.searchOpenMoji('helado').length > 1)
    })
    test('11 token search uses metadata tags without fuzzy matching', () => {
      const result = b.searchOpenMoji('birthday sweet')
      assert.equal(result[0].entry.hexcode, '1F382')
      assert.equal(result[0].matchReason, 'all-tokens')
      assert.equal(b.searchOpenMoji('lollip')[0].matchReason, 'token-prefix')
    })
    test('12 the same query has a stable deterministic order', () => {
      const started = process.hrtime.bigint()
      const first = b.searchOpenMoji('sweet', { group: 'food-drink', subgroup: 'food-sweet', limit: 50 })
      const second = b.searchOpenMoji('sweet', { group: 'food-drink', subgroup: 'food-sweet', limit: 50 })
      assert.deepEqual(first.map(result => [result.score, result.entry.stableId]), second.map(result => [result.score, result.entry.stableId]))
      const elapsed = Number(process.hrtime.bigint() - started) / 1e6
      console.log('MEDICION openmoji two-searches-ms=' + elapsed.toFixed(3) + ' cold-load-ms=' + loadMs.toFixed(1))
    })
    test('13 an empty query is rejected instead of listing the catalog', () => {
      code(() => b.searchOpenMoji('   '), 'OPENMOJI_QUERY_INVALID')
    })
    test('14 invalid or unsafe limits are rejected explicitly', () => {
      code(() => b.searchOpenMoji('cake', { limit: 0 }), 'OPENMOJI_QUERY_INVALID')
      code(() => b.searchOpenMoji('cake', { limit: 51 }), 'OPENMOJI_QUERY_INVALID')
    })
    test('15 groups and subgroups list and filter deterministically', () => {
      assert(b.listOpenMojiGroups().includes('food-drink'))
      assert(b.listOpenMojiSubgroups('food-drink').includes('food-sweet'))
      const result = b.searchOpenMoji('sweet', { group: 'food-drink', subgroup: 'food-sweet', limit: 50 })
      assert(result.length > 0)
      assert(result.every(item => item.entry.group === 'food-drink' && item.entry.subgroup === 'food-sweet'))
    })
    test('16 food-drink/food-sweet has its measured catalog results', () => {
      const sweets = catalog.entries.filter(entry => entry.group === 'food-drink' && entry.subgroup === 'food-sweet')
      assert.equal(sweets.length, 14)
      assert(sweets.some(entry => entry.annotation === 'birthday cake'))
    })
    test('17 birthday cake localizes its official color SVG', () => {
      const cake = b.getOpenMojiEntryByHexcode('1F382')
      const svg = b.resolveOpenMojiSvgCatalogPath(cake)
      assert.match(svg.replace(/\\/g, '/'), /color\/svg\/1F382\.svg$/)
    })
    test('18 an alias to a nonexistent stable ID fails validation', () => {
      const root = makeFixture()
      try {
        code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [{ alias: 'fantasma', language: 'es', stableIds: ['openmoji:dead'] }] }), 'OPENMOJI_ALIAS_INVALID')
      } finally { fs.rmSync(root, { recursive: true, force: true }) }
    })
    test('19 an incompatible resource version fails before use', () => {
      const root = makeFixture({ version: '17.0.1' })
      try { code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_VERSION_MISMATCH') }
      finally { fs.rmSync(root, { recursive: true, force: true }) }
    })
    test('20 duplicate stable IDs in metadata fail deterministically', () => {
      const root = makeFixture({ entries: [fixtureEntry(), fixtureEntry({ annotation: 'duplicate tube' })] })
      try { code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_DUPLICATE_ID') }
      finally { fs.rmSync(root, { recursive: true, force: true }) }
    })
    test('21 a missing color SVG fails reproducibly', () => {
      const root = makeFixture({ withSvg: false })
      try { code(() => b.loadOpenMojiCatalog({ resourceRoot: root, aliases: [] }), 'OPENMOJI_SVG_NOT_FOUND') }
      finally { fs.rmSync(root, { recursive: true, force: true }) }
    })
    test('22 traversal and absolute path injection are rejected', () => {
      const cake = b.getOpenMojiEntryByHexcode('1F382')
      code(() => b.resolveOpenMojiSvgCatalogPath({ ...cake, svgRelativeFile: '../outside.svg' }), 'OPENMOJI_PATH_OUTSIDE_CATALOG')
      code(() => b.resolveOpenMojiSvgCatalogPath({ ...cake, svgRelativeFile: 'C:\\outside.svg' }), 'OPENMOJI_PATH_OUTSIDE_CATALOG')
    })
    test('23 attribution is a single immutable authority for callers', () => {
      const first = b.getOpenMojiCatalogInfo()
      first.attributionText = 'mutated by caller'
      const second = b.getOpenMojiCatalogInfo()
      assert.match(second.attributionText, /OpenMoji 17\.0\.0/)
      assert.equal(second.attributionRevision, 'openmoji-catalog-v1')
    })
    test('24 search and load run while fetch/http/https are blocked', () => {
      assert.equal(b.searchOpenMoji('galleta')[0].entry.annotation, 'cookie')
      assert.equal(networkAttempts, 0)
    })
    test('25 build resource and packaged resolver are explicit and cwd-independent', () => {
      assert.equal(runtimeRoot, expectedRoot)
      assert(fs.existsSync(path.join(runtimeRoot, 'catalog-resource.json')))
      assert(fs.existsSync(path.join(runtimeRoot, 'LICENSE.txt')))
      assert.equal(b.resolveOpenMojiCatalogResourceRoot({ packaged: true, resourcesPath: 'C:\\Cipher\\resources' }), path.join('C:\\Cipher\\resources', 'openmoji'))
    })
    assert.equal(passed, 25)
    console.log('TODO CORRECTO: 25 casos OpenMoji offline.')
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
