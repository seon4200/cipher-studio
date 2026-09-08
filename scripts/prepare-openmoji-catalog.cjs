/* Build-only copier for the exact official dependency. It never copies assets to
 * projects and its output is ignored by Git. */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..')
const PACKAGE_ROOT = path.join(REPO_ROOT, 'node_modules', 'openmoji')
const OUTPUT_ROOT = path.join(REPO_ROOT, 'dist-electron', 'openmoji')
const EXPECTED_VERSION = '17.0.0'
const EXPECTED_ENTRY_COUNT = 4495
const RESOURCE_SCHEMA_VERSION = 1
const GENERATOR_REVISION = 'openmoji-catalog-v1-build-validation-r2'

function fail(message) { throw new Error('[prepare-openmoji-catalog] ' + message) }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex') }
function readJson(bytes, label) {
  try { return JSON.parse(bytes.toString('utf8')) }
  catch (error) { fail(label + ' no contiene JSON válido: ' + error.message) }
}
function normalizedHexcode(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, '-')
  return /^(?:[0-9A-F]{2,8})(?:-[0-9A-F]{2,8})*$/.test(normalized) ? normalized : undefined
}
function relativeInside(root, candidate, label) {
  const relative = path.relative(root, candidate)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    fail(label + ' queda fuera de la raíz esperada.')
  return relative.replace(/\\/g, '/')
}
function checkedRegularFile(root, candidate, label) {
  let real
  try { real = fs.realpathSync(candidate) }
  catch { fail(label + ' no existe.') }
  relativeInside(root, real, label)
  const stat = fs.statSync(real)
  if (!stat.isFile() || stat.size <= 0) fail(label + ' no es un archivo regular no vacío.')
  return { real, size: stat.size }
}
function svgLooksLikeSvg(file) {
  const descriptor = fs.openSync(file, 'r')
  try {
    const bytes = Buffer.alloc(512)
    const read = fs.readSync(descriptor, bytes, 0, bytes.length, 0)
    if (read === 0) return false
    const start = bytes.subarray(0, read).toString('utf8').replace(/^\uFEFF/, '')
    return /^\s*(?:<\?xml[^>]*\?>\s*)?<svg(?:\s|>)/i.test(start)
  } finally { fs.closeSync(descriptor) }
}
function resourceFingerprint({ catalogVersion, metadataSha256, fileListSha256, generatorRevision }) {
  return sha256(Buffer.from([
    'openmoji',
    catalogVersion,
    metadataSha256,
    fileListSha256,
    generatorRevision,
  ].join('\n'), 'utf8'))
}

function main() {
  const started = process.hrtime.bigint()
  let packageRoot
  try { packageRoot = fs.realpathSync(PACKAGE_ROOT) }
  catch { fail('Falta openmoji@17.0.0 en node_modules.') }
  const packageJson = checkedRegularFile(packageRoot, path.join(packageRoot, 'package.json'), 'package.json de OpenMoji')
  const metadataFile = checkedRegularFile(packageRoot, path.join(packageRoot, 'data', 'openmoji.json'), 'metadata OpenMoji')
  const licenseFile = checkedRegularFile(packageRoot, path.join(packageRoot, 'LICENSE.txt'), 'LICENSE.txt OpenMoji')
  const colorSvgRoot = fs.realpathSync(path.join(packageRoot, 'color', 'svg'))
  relativeInside(packageRoot, colorSvgRoot, 'Raíz color/svg de OpenMoji')

  const pkg = readJson(fs.readFileSync(packageJson.real), 'package.json de OpenMoji')
  if (pkg.name !== 'openmoji' || pkg.version !== EXPECTED_VERSION)
    fail('Se esperaba openmoji@' + EXPECTED_VERSION + ', llegó ' + String(pkg.name) + '@' + String(pkg.version))
  const metadataBytes = fs.readFileSync(metadataFile.real)
  const metadata = readJson(metadataBytes, 'data/openmoji.json')
  if (!Array.isArray(metadata) || metadata.length !== EXPECTED_ENTRY_COUNT)
    fail('Se esperaban ' + EXPECTED_ENTRY_COUNT + ' entradas OpenMoji y llegaron ' + (Array.isArray(metadata) ? metadata.length : 'un valor no-array') + '.')
  const licenseBytes = fs.readFileSync(licenseFile.real)
  if (!/Creative Commons Attribution-ShareAlike 4\.0 International/i.test(licenseBytes.toString('utf8')))
    fail('LICENSE.txt no declara Creative Commons Attribution-ShareAlike 4.0 International.')

  const seen = new Set()
  const files = []
  for (const entry of metadata) {
    const hexcode = normalizedHexcode(entry && entry.hexcode)
    if (!hexcode || seen.has(hexcode)) fail('Hexcode inválido o duplicado en metadata: ' + String(entry && entry.hexcode))
    seen.add(hexcode)
    const relative = hexcode + '.svg'
    const inspected = checkedRegularFile(colorSvgRoot, path.join(colorSvgRoot, relative), 'SVG color oficial ' + hexcode)
    if (path.extname(inspected.real).toLowerCase() !== '.svg' || !svgLooksLikeSvg(inspected.real))
      fail('SVG color oficial inválido: ' + hexcode)
    files.push({ hexcode, source: inspected.real, relative: 'color/svg/' + relative, size: inspected.size })
  }
  files.sort((a, b) => a.relative.localeCompare(b.relative, 'en'))
  const metadataSha256 = sha256(metadataBytes)
  const fileListSha256 = sha256(Buffer.from(files.map(file => file.relative + '|' + file.size).join('\n'), 'utf8'))
  const manifest = {
    resourceSchemaVersion: RESOURCE_SCHEMA_VERSION,
    provider: 'openmoji',
    sourceKind: 'official-npm',
    sourcePackage: 'openmoji',
    catalogVersion: pkg.version,
    metadataRelativeFile: 'data/openmoji.json',
    svgRootRelative: 'color/svg',
    licenseRelativeFile: 'LICENSE.txt',
    entryCount: metadata.length,
    svgCount: files.length,
    knownMissingSvgHexcodes: [],
    metadataSha256,
    fileListSha256,
    generatorRevision: GENERATOR_REVISION,
  }
  manifest.resourceFingerprint = resourceFingerprint(manifest)
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  const temporary = path.join(path.dirname(OUTPUT_ROOT), '.openmoji-catalog-' + process.pid + '-' + Date.now() + '.tmp')
  fs.rmSync(temporary, { recursive: true, force: true })
  fs.mkdirSync(path.join(temporary, 'data'), { recursive: true })
  fs.mkdirSync(path.join(temporary, 'color', 'svg'), { recursive: true })
  fs.copyFileSync(metadataFile.real, path.join(temporary, 'data', 'openmoji.json'))
  fs.copyFileSync(licenseFile.real, path.join(temporary, 'LICENSE.txt'))
  for (const item of files) fs.copyFileSync(item.source, path.join(temporary, item.relative))
  fs.writeFileSync(path.join(temporary, 'catalog-resource.json'), manifestBytes)
  // The target is an ignored, fixed build directory; deleting it prevents stale
  // SVGs from a prior catalog version from looking like current output.
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true })
  fs.renameSync(temporary, OUTPUT_ROOT)
  const bytes = metadataBytes.length + licenseBytes.length + manifestBytes.length + files.reduce((sum, file) => sum + file.size, 0)
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
  console.log('[openmoji] recurso validado y generado: ' + files.length + ' SVG color, ' + (files.length + 3) + ' archivos, ' + bytes + ' bytes, ' + elapsedMs.toFixed(1) + ' ms, fingerprint=' + manifest.resourceFingerprint)
}

main()
