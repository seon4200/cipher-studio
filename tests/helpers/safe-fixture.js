const fs = require('fs')
const os = require('os')
const path = require('path')

const MARKER = '.cipher-test-fixture'
const createdFixtures = new Set()

const fail = reason => {
  const error = new Error('FIXTURE_INSEGURO: ' + reason)
  error.code = 'CIPHER_TEST_FIXTURE_UNSAFE'
  throw error
}

const normalized = candidate => path.resolve(candidate)

function inside (parent, candidate) {
  const relative = path.relative(parent, candidate)
  return !!relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)
}

function realDirectory (candidate) {
  try {
    if (!fs.statSync(candidate).isDirectory()) fail('no es un directorio: ' + candidate)
    return fs.realpathSync.native(candidate)
  } catch (error) {
    if (error && error.code === 'CIPHER_TEST_FIXTURE_UNSAFE') throw error
    fail('no se puede resolver el directorio: ' + candidate)
  }
}

function assertSafeFixtureRoot (candidate) {
  const root = normalized(candidate)
  const tempRoot = realDirectory(os.tmpdir())
  const realRoot = realDirectory(root)
  if (!inside(tempRoot, realRoot)) fail('el fixture no está bajo os.tmpdir(): ' + root)
  if (!fs.existsSync(path.join(realRoot, MARKER))) fail('falta el marcador ' + MARKER + ': ' + root)
  for (const forbidden of ['.git', 'src', 'package.json', 'proyectos']) {
    if (fs.existsSync(path.join(realRoot, forbidden))) fail('el fixture contiene ' + forbidden + ': ' + root)
  }
  return realRoot
}

function createTestFixture (label) {
  if (!/^[a-z0-9-]+$/i.test(label)) fail('etiqueta inválida: ' + label)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-test-' + label + '-'))
  fs.writeFileSync(path.join(root, MARKER), 'fixture creado por esta ejecución\n', { encoding: 'utf8', flag: 'wx' })
  const realRoot = assertSafeFixtureRoot(root)
  createdFixtures.add(realRoot)
  return realRoot
}

function assertFixtureChild (fixtureRoot, candidate) {
  const root = assertSafeFixtureRoot(fixtureRoot)
  const target = normalized(candidate)
  if (!inside(root, target)) fail('ruta fuera del fixture: ' + target)
  return target
}

function removeFixtureFile (fixtureRoot, candidate) {
  const target = assertFixtureChild(fixtureRoot, candidate)
  if (!fs.existsSync(target)) return
  const stat = fs.lstatSync(target)
  if (stat.isDirectory() && !stat.isSymbolicLink()) fail('se pidió borrar un directorio como fichero: ' + target)
  fs.unlinkSync(target)
}

function cleanupTestFixture (candidate) {
  const root = assertSafeFixtureRoot(candidate)
  if (!createdFixtures.has(root)) fail('no es el fixture exacto creado por esta ejecución: ' + root)
  try {
    fs.rmSync(root, { recursive: true, force: false })
  } catch (error) {
    // Electron can retain a handle while its process is still unwinding. Retaining this marked
    // temporary fixture is safe; broadening the deletion target to force cleanup is not.
    if (error && (error.code === 'EBUSY' || error.code === 'EPERM')) {
      createdFixtures.delete(root)
      return { removed: false, retained: true, reason: error.code }
    }
    throw error
  }
  createdFixtures.delete(root)
  return { removed: true, retained: false }
}

module.exports = {
  MARKER,
  assertSafeFixtureRoot,
  assertFixtureChild,
  createTestFixture,
  removeFixtureFile,
  cleanupTestFixture,
}
