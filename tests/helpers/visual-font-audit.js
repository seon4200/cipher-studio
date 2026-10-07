const fs = require('fs')
const path = require('path')
const { auditWoff2Font } = require('./woff2-font-audit')

function fontFacesFromCss (repoRoot) {
  const css = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'src', 'styles', 'globals.css'), 'utf8')
  const faces = []
  for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const block = match[1]
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1]
    const rawWeight = block.match(/font-weight:\s*([0-9]+)(?:\s+([0-9]+))?/)
    const source = block.match(/url\('\/fonts\/([^']+)'\)/)?.[1]
    if (family && rawWeight && source) faces.push({
      family,
      minWeight: Number(rawWeight[1]),
      maxWeight: Number(rawWeight[2] || rawWeight[1]),
      source,
    })
  }
  return faces
}

/** Cross-checks requested TypographyLook weights against CSS and physical OS/2/fvar tables. */
function auditTypographyLookFonts (repoRoot, looks) {
  const faces = fontFacesFromCss(repoRoot)
  const requests = new Map()
  for (const look of Object.values(looks)) {
    for (const [role, family, weight] of [
      ['keyword', look.keywordFamily, look.keywordWeight],
      ['connector', look.connectorFamily, look.connectorWeight],
      ['closing', look.closingFamily, look.closingWeight],
    ]) requests.set(`${family}|${weight}`, { role, family, requestedWeight: weight })
  }
  return [...requests.values()].sort((left, right) => left.family.localeCompare(right.family, 'en'))
    .map(request => {
      const face = faces.find(candidate => candidate.family === request.family &&
        request.requestedWeight >= candidate.minWeight && request.requestedWeight <= candidate.maxWeight)
      if (!face) return { ...request, certificable: false, synthesisRequired: true, reason: 'CSS_FACE_MISSING' }
      const file = path.join(repoRoot, 'public', 'fonts', face.source)
      const physical = auditWoff2Font(file)
      const physicalMatch = physical.weightRange
        ? request.requestedWeight >= physical.weightRange.min && request.requestedWeight <= physical.weightRange.max
        : request.requestedWeight === physical.os2Weight
      return {
        ...request,
        file: face.source,
        cssWeight: face.minWeight === face.maxWeight ? face.minWeight : [face.minWeight, face.maxWeight],
        physical,
        synthesisRequired: !physicalMatch,
        certificable: physicalMatch,
      }
    })
}

module.exports = { fontFacesFromCss, auditTypographyLookFonts }
