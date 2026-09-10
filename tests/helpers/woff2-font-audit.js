const fs = require('fs')
const zlib = require('zlib')

const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
]

function readBase128 (buffer, cursor) {
  let value = 0
  for (let index = 0; index < 5; index++) {
    if (cursor.offset >= buffer.length) throw new Error('WOFF2_BASE128_TRUNCATED')
    const byte = buffer[cursor.offset++]
    if (index === 0 && byte === 0x80) throw new Error('WOFF2_BASE128_LEADING_ZERO')
    if (value & 0xfe000000) throw new Error('WOFF2_BASE128_OVERFLOW')
    value = (value << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) return value >>> 0
  }
  throw new Error('WOFF2_BASE128_TOO_LONG')
}

function fixed16_16 (buffer, offset) {
  return buffer.readInt32BE(offset) / 65536
}

/** Reads physical OpenType weight evidence from a WOFF2 without trusting its filename or CSS. */
function auditWoff2Font (file) {
  const input = fs.readFileSync(file)
  if (input.toString('ascii', 0, 4) !== 'wOF2') throw new Error('WOFF2_SIGNATURE_INVALID:' + file)
  const numTables = input.readUInt16BE(12)
  const totalCompressedSize = input.readUInt32BE(20)
  const cursor = { offset: 48 }
  const tables = []
  for (let index = 0; index < numTables; index++) {
    const flags = input[cursor.offset++]
    const tagIndex = flags & 0x3f
    const transformVersion = flags >>> 6
    const tag = tagIndex === 0x3f
      ? input.toString('ascii', cursor.offset, (cursor.offset += 4))
      : KNOWN_TAGS[tagIndex]
    if (!tag) throw new Error('WOFF2_TAG_INVALID:' + tagIndex)
    const originalLength = readBase128(input, cursor)
    const transformed = tag === 'glyf' || tag === 'loca'
      ? transformVersion === 0
      : transformVersion !== 0
    const storedLength = transformed ? readBase128(input, cursor) : originalLength
    tables.push({ tag, originalLength, storedLength })
  }
  const compressed = input.subarray(cursor.offset, cursor.offset + totalCompressedSize)
  const stream = zlib.brotliDecompressSync(compressed)
  let streamOffset = 0
  const decoded = new Map()
  for (const table of tables) {
    decoded.set(table.tag, stream.subarray(streamOffset, streamOffset + table.storedLength))
    streamOffset += table.storedLength
  }
  const os2 = decoded.get('OS/2')
  if (!os2 || os2.length < 6) throw new Error('WOFF2_OS2_MISSING:' + file)
  const os2Weight = os2.readUInt16BE(4)
  let weightRange = null
  const fvar = decoded.get('fvar')
  if (fvar && fvar.length >= 16) {
    const axesOffset = fvar.readUInt16BE(4)
    const axisCount = fvar.readUInt16BE(8)
    const axisSize = fvar.readUInt16BE(10)
    for (let index = 0; index < axisCount; index++) {
      const offset = axesOffset + index * axisSize
      if (offset + 16 > fvar.length) throw new Error('WOFF2_FVAR_TRUNCATED:' + file)
      if (fvar.toString('ascii', offset, offset + 4) === 'wght') {
        weightRange = {
          min: fixed16_16(fvar, offset + 4),
          default: fixed16_16(fvar, offset + 8),
          max: fixed16_16(fvar, offset + 12),
        }
        break
      }
    }
  }
  return { os2Weight, weightRange }
}

module.exports = { auditWoff2Font }
