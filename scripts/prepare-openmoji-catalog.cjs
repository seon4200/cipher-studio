/* Build-only copier for the exact official dependency. It never copies assets to
 * projects and its output is ignored by Git. */
const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..')
const PACKAGE_ROOT = path.join(REPO_ROOT, 'node_modules', 'openmoji')
const OUTPUT_ROOT = path.join(REPO_ROOT, 'dist-electron', 'openmoji')
const EXPECTED_VERSION = '17.0.0'

function fail(message) { throw new Error('[prepare-openmoji-catalog] ' + message) }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function normalizedHexcode(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, '-')
  return /^(?:[0-9A-F]{2,8})(?:-[0-9A-F]{2,8})*$/.test(normalized) ? normalized : undefined
}
function directoryBytes(root) {
  let bytes = 0, files = 0
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const current = path.join(root, item.name)
    if (item.isDirectory()) { const nested = directoryBytes(current); bytes += nested.bytes; files += nested.files }
    else if (item.isFile()) { bytes += fs.statSync(current).size; files += 1 }
  }
  return { bytes, files }
}

function main() {
  const started = process.hrtime.bigint()
  const packageJsonPath = path.join(PACKAGE_ROOT, 'package.json')
  const metadataPath = path.join(PACKAGE_ROOT, 'data', 'openmoji.json')
  const licensePath = path.join(PACKAGE_ROOT, 'LICENSE.txt')
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(metadataPath) || !fs.existsSync(licensePath))
    fail('Falta openmoji@17.0.0 o uno de sus recursos obligatorios en node_modules.')
  const pkg = readJson(packageJsonPath)
  if (pkg.name !== 'openmoji' || pkg.version !== EXPECTED_VERSION)
    fail('Se esperaba openmoji@' + EXPECTED_VERSION + ', llegó ' + String(pkg.name) + '@' + String(pkg.version))
  const metadata = readJson(metadataPath)
  if (!Array.isArray(metadata)) fail('data/openmoji.json no es un array.')
  const seen = new Set()
  const files = []
  for (const entry of metadata) {
    const hexcode = normalizedHexcode(entry && entry.hexcode)
    if (!hexcode || seen.has(hexcode)) fail('Hexcode inválido o duplicado en metadata: ' + String(entry && entry.hexcode))
    seen.add(hexcode)
    const source = path.join(PACKAGE_ROOT, 'color', 'svg', hexcode + '.svg')
    if (!fs.existsSync(source) || fs.statSync(source).size === 0) fail('Falta SVG color oficial: ' + hexcode)
    files.push({ hexcode, source })
  }
  const temporary = path.join(path.dirname(OUTPUT_ROOT), '.openmoji-catalog-' + process.pid + '-' + Date.now() + '.tmp')
  fs.rmSync(temporary, { recursive: true, force: true })
  fs.mkdirSync(path.join(temporary, 'data'), { recursive: true })
  fs.mkdirSync(path.join(temporary, 'color', 'svg'), { recursive: true })
  fs.copyFileSync(metadataPath, path.join(temporary, 'data', 'openmoji.json'))
  fs.copyFileSync(licensePath, path.join(temporary, 'LICENSE.txt'))
  for (const item of files) fs.copyFileSync(item.source, path.join(temporary, 'color', 'svg', item.hexcode + '.svg'))
  const resourceManifest = {
    resourceFormatVersion: 1,
    provider: 'openmoji',
    sourceKind: 'official-npm',
    sourcePackage: 'openmoji',
    catalogVersion: pkg.version,
    metadataRelativeFile: 'data/openmoji.json',
    svgDirectory: 'color/svg',
    licenseRelativeFile: 'LICENSE.txt',
    entryCount: metadata.length,
    colorSvgCount: files.length,
    knownMissingSvgHexcodes: []
  }
  fs.writeFileSync(path.join(temporary, 'catalog-resource.json'), JSON.stringify(resourceManifest, null, 2) + '\n')
  // The target is an ignored, fixed build directory; deleting it prevents stale
  // SVGs from a prior catalog version from looking like current output.
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true })
  fs.renameSync(temporary, OUTPUT_ROOT)
  const result = directoryBytes(OUTPUT_ROOT)
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
  console.log('[openmoji] recurso local generado: ' + files.length + ' SVG color, ' + result.files + ' archivos, ' + result.bytes + ' bytes, ' + elapsedMs.toFixed(1) + ' ms')
}

main()
