'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, file)
const { CIPHER_ANIMATION_STYLE_PROFILES_V1, CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1,
  validateCipherAnimationStyleProfileV1 } = require('../../../src/shared/animation-style-profile-v1.ts')
const library = require('../../../src/main/services/animation-style-library.cjs')

const integrationSource = fs.readFileSync(path.join(__dirname, '../../../src/main/services/animation-integration.ts'), 'utf8')
const styleSchemaStart = integrationSource.indexOf('const STYLE_OUTPUT_SCHEMA = {')
const styleSchemaEnd = integrationSource.indexOf('function makeDirectorPrompt', styleSchemaStart)
assert.ok(styleSchemaStart >= 0 && styleSchemaEnd > styleSchemaStart, 'style output schema is present')
const styleSchemaSource = integrationSource.slice(styleSchemaStart, styleSchemaEnd)
assert.doesNotMatch(styleSchemaSource, /minProperties|maxProperties|additionalProperties:\s*\{/,
  'style schema uses Codex strict structured-output keywords')
assert.match(styleSchemaSource, /palette:\s*\{\s*type:\s*'array',\s*minItems:\s*2,\s*maxItems:\s*16/)
assert.match(styleSchemaSource, /required:\s*\['key',\s*'color'\],\s*properties:/)
assert.match(integrationSource, /normalizeStylePalette\(result\.direction\?\.palette\)/,
  'the strict palette entries are normalized into the saved profile map')

const fixture = createTestFixture('animation-style-library')
try {
  const project = path.join(fixture, 'project')
  const libraryRoot = path.join(fixture, 'library')
  fs.mkdirSync(project)
  const builtins = library.listStyles(libraryRoot, CIPHER_ANIMATION_STYLE_PROFILES_V1)
  assert.equal(builtins.length, 2)
  assert.ok(builtins.every(style => style.deletable === false))
  assert.throws(() => library.deleteStyle(libraryRoot, builtins[0].id), /ANIMATION_BUILTIN_STYLE_READ_ONLY/)

  const reference = path.join(fixture, 'reference.png')
  fs.writeFileSync(reference, Buffer.from('reference-frame'))
  const proposed = JSON.parse(JSON.stringify(CIPHER_ANIMATION_STYLE_PROFILE_DEFAULT_V1))
  proposed.id = 'style-0123456789abcdefabcd'
  proposed.version = 1
  proposed.title = 'Editorial azul con capas'
  proposed.description = 'Dirección de prueba con tarjetas, contraste y líneas conectadas.'
  proposed.direction.palette.cyan = '#18A7C8'
  proposed.direction.motion = 'Entradas escalonadas, conexiones trazadas y cambios de composición con propósito.'
  proposed.parameters.movementIntensity = 'dynamic'
  const valid = validateCipherAnimationStyleProfileV1(proposed)
  const tooSmall = JSON.parse(JSON.stringify(proposed))
  tooSmall.direction.palette = { navy: '#102030' }
  assert.throws(() => validateCipherAnimationStyleProfileV1(tooSmall), /ANIMATION_STYLE_PROFILE_INVALID/)
  const tooLarge = JSON.parse(JSON.stringify(proposed))
  tooLarge.direction.palette = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`color${index}`, '#102030']))
  assert.throws(() => validateCipherAnimationStyleProfileV1(tooLarge), /ANIMATION_STYLE_PROFILE_INVALID/)
  const saved = library.saveStyle(libraryRoot, valid, 'new', [{ path: reference, name: 'referencia.mp4', timeSec: 8 }], CIPHER_ANIMATION_STYLE_PROFILES_V1)
  assert.equal(saved.version, 1)
  assert.match(saved.id, /^style-[a-f0-9]{20}$/)
  const snapshot = library.snapshotStyle(project, saved, libraryRoot)
  const snapshotFile = path.join(project, snapshot.projectSnapshot.relativePath)
  assert.ok(fs.existsSync(snapshotFile))
  assert.equal(snapshot.referenceFiles.length, 1)
  const copiedReference = path.join(path.dirname(snapshotFile), snapshot.referenceFiles[0].file)
  assert.ok(fs.existsSync(copiedReference))

  const update = library.saveStyle(libraryRoot, { ...saved, title: 'Azul actualizado' }, 'update', [], CIPHER_ANIMATION_STYLE_PROFILES_V1)
  assert.equal(update.version, 2)
  assert.ok(fs.existsSync(path.join(libraryRoot, saved.id, 'versions', 'v1.json')))
  const renamed = library.renameStyle(libraryRoot, saved.id, 'Azul renombrado')
  assert.equal(renamed.version, 3)
  assert.ok(fs.existsSync(path.join(libraryRoot, saved.id, 'versions', 'v2.json')))

  const sourceVideo = path.join(project, 'video-original.mp4')
  fs.writeFileSync(sourceVideo, Buffer.from('user video'))
  const projectState = path.join(project, 'project-state.json')
  fs.writeFileSync(projectState, JSON.stringify({ styleProfile: snapshot }))
  library.deleteStyle(libraryRoot, saved.id)
  assert.ok(!fs.existsSync(path.join(libraryRoot, saved.id)))
  assert.ok(fs.existsSync(snapshotFile), 'deleting a library style leaves the project style copy intact')
  assert.ok(fs.existsSync(copiedReference), 'deleting a library style leaves project reference frames intact')
  assert.ok(fs.existsSync(sourceVideo), 'deleting a library style never touches project video media')
  assert.deepEqual(JSON.parse(fs.readFileSync(projectState, 'utf8')).styleProfile.id, snapshot.id)
  process.stdout.write('Animation style library: built-ins, versioned edits, reference snapshots and scoped deletion passed.\n')
} finally { cleanupTestFixture(fixture) }
