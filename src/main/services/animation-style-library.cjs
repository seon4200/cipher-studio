'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const safeId = value => /^(?:cipher-editorial-(?:motion|sapphire)-v1|style-[a-f0-9]{20})$/.test(String(value || ''))
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

function styleDirectory(root, id) {
  if (!safeId(id)) throw new Error('ANIMATION_STYLE_ID_INVALID')
  const base = path.resolve(root)
  const target = path.resolve(base, id)
  const relative = path.relative(base, target)
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('ANIMATION_STYLE_PATH_INVALID')
  return target
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.' + crypto.randomUUID() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, file)
}

function readProfile(dir) {
  const file = path.join(dir, 'style.json')
  if (!fs.existsSync(file)) return null
  if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('ANIMATION_STYLE_SYMLINK_REJECTED')
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!safeId(profile.id) || path.basename(dir) !== profile.id || profile.schema !== 'cipher-animation-style-profile-v1')
    throw new Error('ANIMATION_STYLE_RECORD_INVALID')
  return profile
}

function listStyles(root, builtins) {
  fs.mkdirSync(root, { recursive: true })
  for (const profile of builtins || []) {
    const dir = styleDirectory(root, profile.id)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      atomicJson(path.join(dir, 'style.json'), { ...profile, deletable: false })
    }
  }
  const styles = []
  for (const name of fs.readdirSync(root)) {
    if (!safeId(name)) continue
    const dir = styleDirectory(root, name)
    if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw new Error('ANIMATION_STYLE_DIRECTORY_INVALID')
    const profile = readProfile(dir)
    if (profile) styles.push({ ...profile, deletable: profile.deletable !== false,
      referenceFiles: Array.isArray(profile.referenceFiles) ? profile.referenceFiles : [] })
  }
  return styles.sort((a, b) => String(a.title).localeCompare(String(b.title)) || a.id.localeCompare(b.id))
}

function saveStyle(root, input, mode, referenceFrames = [], builtins = []) {
  fs.mkdirSync(root, { recursive: true })
  const inputId = String(input?.id || '')
  const updating = mode === 'update'
  if (mode !== 'new' && !updating) throw new Error('ANIMATION_STYLE_SAVE_MODE_INVALID')
  let id, previous = null
  if (updating) {
    if (!safeId(inputId) || inputId.startsWith('cipher-editorial-')) throw new Error('ANIMATION_BUILTIN_STYLE_READ_ONLY')
    id = inputId
    const dir = styleDirectory(root, id)
    if (!fs.existsSync(dir)) throw new Error('ANIMATION_STYLE_NOT_FOUND')
    previous = readProfile(dir)
    if (!previous || previous.deletable === false) throw new Error('ANIMATION_BUILTIN_STYLE_READ_ONLY')
    const historyFile = path.join(dir, 'versions', 'v' + previous.version + '.json')
    if (!fs.existsSync(historyFile)) atomicJson(historyFile, previous)
  } else {
    id = 'style-' + crypto.randomBytes(10).toString('hex')
  }

  const dir = styleDirectory(root, id)
  fs.mkdirSync(dir, { recursive: true })
  const version = previous ? Number(previous.version) + 1 : 1
  const referenceDirectory = path.join(dir, 'references')
  fs.mkdirSync(referenceDirectory, { recursive: true })
  const referenceFiles = [...(previous?.referenceFiles || [])]
  for (const source of (referenceFrames || []).slice(0, 24)) {
    const sourcePath = path.resolve(String(source?.path || ''))
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) throw new Error('ANIMATION_STYLE_REFERENCE_MISSING')
    const ext = path.extname(sourcePath).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) throw new Error('ANIMATION_STYLE_REFERENCE_FORMAT_UNSUPPORTED')
    const bytes = fs.readFileSync(sourcePath)
    if (bytes.length <= 0 || bytes.length > 20 * 1024 * 1024) throw new Error('ANIMATION_STYLE_REFERENCE_SIZE_UNSUPPORTED')
    const sha256 = digest(bytes)
    const fileName = sha256 + ext
    const target = path.join(referenceDirectory, fileName)
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes, { mode: 0o600, flag: 'wx' })
    if (!referenceFiles.some(item => item.sha256 === sha256)) referenceFiles.push({
      name: String(source.name || path.basename(sourcePath)).slice(0, 160),
      sha256, timeSec: Number.isFinite(Number(source.timeSec)) ? Number(source.timeSec) : 0,
      file: path.relative(dir, target).replace(/\\/g, '/'),
    })
  }
  const profile = { ...input, id, version, schema: 'cipher-animation-style-profile-v1',
    reference: { kind: 'style-library', count: referenceFiles.length }, referenceFiles,
    createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), deletable: true }
  atomicJson(path.join(dir, 'style.json'), profile)
  return profile
}

function renameStyle(root, id, title) {
  const dir = styleDirectory(root, id)
  const current = readProfile(dir)
  if (!current) throw new Error('ANIMATION_STYLE_NOT_FOUND')
  if (current.deletable === false) throw new Error('ANIMATION_BUILTIN_STYLE_READ_ONLY')
  const name = String(title || '').trim()
  if (!name || name.length > 80) throw new Error('ANIMATION_STYLE_TITLE_INVALID')
  const historyFile = path.join(dir, 'versions', 'v' + current.version + '.json')
  if (!fs.existsSync(historyFile)) atomicJson(historyFile, current)
  const next = { ...current, title: name, version: Number(current.version) + 1, updatedAt: new Date().toISOString() }
  atomicJson(path.join(dir, 'style.json'), next)
  return next
}

function deleteStyle(root, id) {
  const dir = styleDirectory(root, id)
  const current = readProfile(dir)
  if (!current) throw new Error('ANIMATION_STYLE_NOT_FOUND')
  if (current.deletable === false || id.startsWith('cipher-editorial-')) throw new Error('ANIMATION_BUILTIN_STYLE_READ_ONLY')
  const realRoot = fs.realpathSync(root)
  const realDir = fs.realpathSync(dir)
  const relative = path.relative(realRoot, realDir)
  if (relative !== id || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('ANIMATION_STYLE_PATH_INVALID')
  fs.rmSync(dir, { recursive: true, force: false })
  return { success: true, id }
}

function snapshotStyle(projectRoot, profile, libraryRoot) {
  const project = fs.realpathSync(projectRoot)
  if (!safeId(profile?.id) || !Number.isInteger(profile?.version) || profile.version < 1)
    throw new Error('ANIMATION_STYLE_PROFILE_INVALID')
  const materials = path.join(project, 'materiales')
  fs.mkdirSync(materials, { recursive: true })
  if (fs.lstatSync(materials).isSymbolicLink()) throw new Error('ANIMATION_STYLE_SNAPSHOT_PATH_INVALID')
  const snapshotRoot = path.join(materials, 'animation-style-snapshots-v1')
  fs.mkdirSync(snapshotRoot, { recursive: true })
  if (fs.lstatSync(snapshotRoot).isSymbolicLink()) throw new Error('ANIMATION_STYLE_SNAPSHOT_PATH_INVALID')
  const snapshotDirectory = path.join(snapshotRoot, profile.id, `v${profile.version}`)
  fs.mkdirSync(snapshotDirectory, { recursive: true })
  const realSnapshot = fs.realpathSync(snapshotDirectory)
  const relative = path.relative(snapshotRoot, realSnapshot)
  if (relative !== path.join(profile.id, `v${profile.version}`) || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('ANIMATION_STYLE_SNAPSHOT_PATH_INVALID')
  if (fs.lstatSync(path.join(snapshotRoot, profile.id)).isSymbolicLink() || fs.lstatSync(snapshotDirectory).isSymbolicLink())
    throw new Error('ANIMATION_STYLE_SNAPSHOT_PATH_INVALID')

  const sourceDirectory = styleDirectory(libraryRoot, profile.id)
  const referenceFiles = []
  for (const item of (Array.isArray(profile.referenceFiles) ? profile.referenceFiles : []).slice(0, 24)) {
    const source = path.resolve(sourceDirectory, String(item.file || ''))
    const sourceRelative = path.relative(path.resolve(sourceDirectory), source)
    if (!sourceRelative || sourceRelative.startsWith('..' + path.sep) || path.isAbsolute(sourceRelative) ||
        !fs.existsSync(source) || fs.lstatSync(source).isSymbolicLink() || !fs.statSync(source).isFile())
      throw new Error('ANIMATION_STYLE_REFERENCE_MISSING')
    const extension = path.extname(source).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) throw new Error('ANIMATION_STYLE_REFERENCE_FORMAT_UNSUPPORTED')
    const referenceDirectory = path.join(snapshotDirectory, 'references')
    fs.mkdirSync(referenceDirectory, { recursive: true })
    const target = path.join(referenceDirectory, `${item.sha256}${extension}`)
    if (!fs.existsSync(target)) {
      const temporary = target + '.' + crypto.randomUUID() + '.tmp'
      fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL)
      fs.renameSync(temporary, target)
    }
    referenceFiles.push({ ...item, file: path.relative(snapshotDirectory, target).replace(/\\/g, '/') })
  }
  const snapshot = { ...profile, referenceFiles,
    projectSnapshot: { relativePath: path.relative(project, path.join(snapshotDirectory, 'style.json')).replace(/\\/g, '/'),
      savedAt: new Date().toISOString() } }
  atomicJson(path.join(snapshotDirectory, 'style.json'), snapshot)
  return snapshot
}

module.exports = { safeId, styleDirectory, listStyles, saveStyle, renameStyle, deleteStyle, snapshotStyle }
