/*
 * Valida evidencia del spike sin red. Los binarios no pertenecen al repositorio:
 * si una muestra está ausente, eso es esperado y no equivale a haberla revalidado.
 *
 * Uso:
 *   node docs/spike-hero/validar-provider-assets.cjs
 *   node docs/spike-hero/validar-provider-assets.cjs --samples-dir "RUTA"
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const raiz = path.resolve(__dirname, '..', '..')
const manifestPath = path.join(__dirname, 'provider-manifest.json')
const argumentos = process.argv.slice(2)
const indiceMuestras = argumentos.indexOf('--samples-dir')
if (indiceMuestras !== -1 && (!argumentos[indiceMuestras + 1] || argumentos.length !== 2)) {
  throw new Error('Uso: node validar-provider-assets.cjs [--samples-dir RUTA]')
}
if (indiceMuestras === -1 && argumentos.length) throw new Error('Argumentos no reconocidos')
const directorioMuestras = indiceMuestras === -1
  ? path.join(__dirname, 'downloaded')
  : path.resolve(argumentos[indiceMuestras + 1])

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex') }
function u32(bytes, offset) { return bytes.readUInt32BE(offset) }
function esPng(bytes) { return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }

function leerPng(bytes) {
  if (!esPng(bytes)) throw new Error('cabecera PNG inválida')
  let cursor = 8; let ihdr; let trns; const idat = []
  while (cursor + 12 <= bytes.length) {
    const longitud = u32(bytes, cursor); const tipo = bytes.toString('ascii', cursor + 4, cursor + 8)
    const datos = bytes.subarray(cursor + 8, cursor + 8 + longitud)
    if (tipo === 'IHDR') ihdr = datos
    if (tipo === 'tRNS') trns = datos
    if (tipo === 'IDAT') idat.push(datos)
    cursor += longitud + 12
  }
  if (!ihdr || ihdr.length !== 13) throw new Error('IHDR ausente')
  const width = u32(ihdr, 0); const height = u32(ihdr, 4); const bitDepth = ihdr[8]; const colorType = ihdr[9]
  const hasAlpha = colorType === 4 || colorType === 6 || Boolean(trns)
  const info = { mime: 'image/png', width, height, hasAlpha, alphaUseful: false }
  if (!hasAlpha || bitDepth !== 8 || ![4, 6].includes(colorType)) return info
  const channels = colorType === 6 ? 4 : 2; const stride = width * channels; const raw = zlib.inflateSync(Buffer.concat(idat))
  let previous = Buffer.alloc(stride); let rawCursor = 0; let transparent = false; let visible = false
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawCursor++]; const row = Buffer.from(raw.subarray(rawCursor, rawCursor + stride)); rawCursor += stride
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0; const up = previous[x]; const upLeft = x >= channels ? previous[x - channels] : 0
      if (filter === 1) row[x] = (row[x] + left) & 255
      else if (filter === 2) row[x] = (row[x] + up) & 255
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) {
        const p = left + up - upLeft; const a = Math.abs(p - left); const b = Math.abs(p - up); const c = Math.abs(p - upLeft)
        row[x] = (row[x] + (a <= b && a <= c ? left : b <= c ? up : upLeft)) & 255
      } else if (filter !== 0) throw new Error(`filtro PNG desconocido: ${filter}`)
    }
    for (let x = channels - 1; x < stride; x += channels) { transparent ||= row[x] < 255; visible ||= row[x] > 0 }
    previous = row
  }
  return { ...info, alphaUseful: transparent && visible }
}

function leerSvg(bytes) {
  const texto = bytes.toString('utf8'); const svg = texto.match(/<svg\b[^>]*>/i)
  if (!svg) throw new Error('no parece un SVG')
  return {
    mime: 'image/svg+xml', width: null, height: null, hasAlpha: true, alphaUseful: true,
    viewBox: svg[0].match(/\bviewBox=["']([^"']+)["']/i)?.[1] ?? null,
  }
}

function inspeccionar(bytes) { return esPng(bytes) ? leerPng(bytes) : leerSvg(bytes) }
function iguales(campo, esperado, observado) { return esperado === null || esperado === observado }

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.assets) || !manifest.assets.length) {
  throw new Error('provider-manifest.json no tiene la estructura de evidencia esperada')
}

let errores = 0
console.log(`EVIDENCIA: ${manifest.assets.length} muestras · directorio local: ${directorioMuestras}`)
for (const asset of manifest.assets) {
  const requeridos = ['provider', 'sampleFileName', 'sha256', 'mime', 'sourceUrl', 'storedInGit', 'localFileAvailableAtValidationTime']
  const faltan = requeridos.filter(campo => asset[campo] === undefined || asset[campo] === '')
  if (faltan.length || asset.storedInGit !== false || path.basename(asset.sampleFileName) !== asset.sampleFileName) {
    console.log(`${asset.provider}: MANIFEST INVÁLIDO · ${faltan.join(', ') || 'archivo de muestra no seguro'}`); errores += 1; continue
  }
  const archivo = path.join(directorioMuestras, asset.sampleFileName)
  if (!fs.existsSync(archivo)) {
    console.log(`${asset.provider}: EVIDENCIA REGISTRADA · muestra local ausente · no revalidada en esta ejecución`)
    continue
  }
  try {
    const bytes = fs.readFileSync(archivo)
    if (!bytes.length) throw new Error('archivo vacío')
    const actual = inspeccionar(bytes)
    const coincide = sha256(bytes) === asset.sha256 && actual.mime === asset.mime &&
      iguales('width', asset.width, actual.width) && iguales('height', asset.height, actual.height) &&
      actual.hasAlpha === asset.hasAlpha && actual.alphaUseful === asset.alphaUseful
    if (!coincide) throw new Error('SHA, MIME, dimensiones o alpha no coinciden con la evidencia')
    console.log(`${asset.provider}: MUESTRA LOCAL PRESENTE · SHA coincide · ${actual.mime} válido · alpha ${actual.alphaUseful ? 'útil' : 'no útil'}`)
  } catch (error) {
    console.log(`${asset.provider}: MUESTRA LOCAL PRESENTE · REVALIDACIÓN FALLÓ · ${error.message}`); errores += 1
  }
}
if (errores) process.exitCode = 1
