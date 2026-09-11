/* Records the fixed technical/visual rubric after reviewing the frozen sheet.
 * It deliberately changes no model parameter or product code. */

const fs = require('fs')
const path = require('path')

const GATE_RUNTIME = process.env.CUTOUT_FINAL_GATE_ROOT || 'C:\\graphify\\_spike-runtime\\photo-cutout-final-gate-v1'
const RUN_ROOT = process.env.CUTOUT_FINAL_GATE_RUN || path.join(GATE_RUNTIME, 'runs', '2026-09-11-20-07-30-104')
const EVIDENCE_ROOT = path.join(RUN_ROOT, 'evidence')
const DRAFT = path.join(EVIDENCE_ROOT, 'cutout-final-gate-results.draft.json')

// A null criterion is genuinely not applicable to that subject; it is not a
// disguised zero. The numeric mean only considers applicable criteria.
const REVIEWS = Object.freeze([
  {
    case: 'bicycle-holes',
    u2netp: { subjectCompleteness: 3, edgeQuality: 2, hairFurQuality: null, internalHoles: 1, backgroundLeak: 1, classification: 'BAD', motionGraphicsUse: 'KEEP_FULL_RASTER' },
    isnet: { subjectCompleteness: 3, edgeQuality: 2, hairFurQuality: null, internalHoles: 3, backgroundLeak: 3, classification: 'GOOD', motionGraphicsUse: 'GOOD_CUTOUT_CANDIDATE' },
    winner: 'isnet-general-use', differenceMeaningful: true,
    note: 'ISNet elimina el naranja de las ruedas/radios; U2NetP conserva fuga de fondo en huecos.'
  },
  {
    case: 'chair-holes',
    u2netp: { subjectCompleteness: 3, edgeQuality: 2, hairFurQuality: null, internalHoles: 3, backgroundLeak: 3, classification: 'GOOD', motionGraphicsUse: 'GOOD_CUTOUT_CANDIDATE' },
    isnet: { subjectCompleteness: 3, edgeQuality: 3, hairFurQuality: null, internalHoles: 3, backgroundLeak: 3, classification: 'GOOD', motionGraphicsUse: 'GOOD_CUTOUT_CANDIDATE' },
    winner: 'isnet-general-use', differenceMeaningful: false,
    note: 'Borde ISNet algo más limpio; ambos preservan patas y hueco central de forma utilizable.'
  },
  {
    case: 'person-fine-hair',
    u2netp: { subjectCompleteness: 3, edgeQuality: 2, hairFurQuality: 2, internalHoles: null, backgroundLeak: 2, classification: 'ACCEPTABLE', motionGraphicsUse: 'CONDITIONAL_CUTOUT' },
    isnet: { subjectCompleteness: 3, edgeQuality: 2, hairFurQuality: 3, internalHoles: null, backgroundLeak: 1, classification: 'ACCEPTABLE', motionGraphicsUse: 'CONDITIONAL_CUTOUT' },
    winner: 'tie', differenceMeaningful: false,
    note: 'ISNet conserva más hebras, pero conserva contaminación/masa de fondo; ninguna salida domina para un Hero sin revisión.'
  },
  {
    case: 'animal-fur',
    u2netp: { subjectCompleteness: 3, edgeQuality: 2, hairFurQuality: 2, internalHoles: null, backgroundLeak: 3, classification: 'GOOD', motionGraphicsUse: 'GOOD_CUTOUT_CANDIDATE' },
    isnet: { subjectCompleteness: 3, edgeQuality: 3, hairFurQuality: 3, internalHoles: null, backgroundLeak: 3, classification: 'GOOD', motionGraphicsUse: 'GOOD_CUTOUT_CANDIDATE' },
    winner: 'isnet-general-use', differenceMeaningful: false,
    note: 'ISNet es más fino en pelo y contorno, pero la diferencia no cambia la utilidad a escala Motion Graphics.'
  },
  {
    case: 'complex-object',
    u2netp: { subjectCompleteness: 3, edgeQuality: 2, hairFurQuality: null, internalHoles: 3, backgroundLeak: 3, classification: 'GOOD', motionGraphicsUse: 'GOOD_CUTOUT_CANDIDATE' },
    isnet: { subjectCompleteness: 3, edgeQuality: 3, hairFurQuality: null, internalHoles: 3, backgroundLeak: 3, classification: 'GOOD', motionGraphicsUse: 'GOOD_CUTOUT_CANDIDATE' },
    winner: 'isnet-general-use', differenceMeaningful: false,
    note: 'ISNet limpia detalles ligeramente mejor; U2NetP ya es apto para Hero/Support.'
  },
])

function average (score) {
  const values = Object.values(score).filter(value => typeof value === 'number')
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}
function tally (key) {
  return ['GOOD', 'ACCEPTABLE', 'BAD'].reduce((result, classification) => {
    result[classification] = REVIEWS.filter(row => row[key].classification === classification).length
    return result
  }, {})
}
function writeJson (file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n') }

if (!fs.existsSync(DRAFT)) throw new Error('CUTOUT_FINAL_GATE_DRAFT_MISSING:' + DRAFT)
const draft = JSON.parse(fs.readFileSync(DRAFT, 'utf8'))
const results = {
  schemaVersion: 1,
  purpose: 'Final gate: license provenance and difficult-case comparison only; no automatic cutout selector.',
  draft,
  licenseAudit: {
    rembgCode: { license: 'MIT', commercialUse: 'YES', redistributionAllowed: 'YES', attributionRequired: 'YES', source: 'https://github.com/danielgatis/rembg/blob/main/LICENSE.txt', risk: 'LOW' },
    rembgPackage: { license: 'MIT', commercialUse: 'YES', redistributionAllowed: 'YES', attributionRequired: 'YES', source: 'https://pypi.org/pypi/rembg/2.0.84/json', risk: 'LOW' },
    onnxRuntime: { license: 'MIT', commercialUse: 'YES', redistributionAllowed: 'YES', attributionRequired: 'YES', source: 'https://github.com/microsoft/onnxruntime/blob/main/LICENSE', risk: 'LOW' },
    models: {
      u2netp: {
        codeLicense: 'Apache-2.0 (U-2-Net source)', weightsLicense: 'LICENSE_UNRESOLVED',
        commercialUse: 'UNRESOLVED', redistributionAllowed: 'UNRESOLVED', attributionRequired: 'UNRESOLVED',
        source: ['https://github.com/xuebinqin/U-2-Net/blob/master/LICENSE', 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx'],
        risk: 'HIGH', rationale: 'El ONNX exacto de release no contiene una concesión/licencia de pesos separada verificable.'
      },
      isnetGeneralUse: {
        codeLicense: 'Apache-2.0 (DIS source)', weightsLicense: 'LICENSE_UNRESOLVED',
        commercialUse: 'UNRESOLVED', redistributionAllowed: 'UNRESOLVED', attributionRequired: 'UNRESOLVED',
        source: ['https://github.com/xuebinqin/DIS/blob/main/LICENSE.md', 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx'],
        risk: 'HIGH', rationale: 'El ONNX exacto de release no contiene una concesión/licencia de pesos separada verificable.'
      },
      evidenceRule: 'La documentación de rembg declara que los pesos tienen licencias independientes; la licencia MIT del wrapper no se propaga automáticamente.'
    }
  },
  rubric: { range: '0..3; mayor es mejor', nullMeans: 'not applicable', criteria: ['subjectCompleteness', 'edgeQuality', 'hairFurQuality', 'internalHoles', 'backgroundLeak'] },
  comparisons: REVIEWS.map(row => ({
    ...row,
    u2netpScore: average(row.u2netp),
    isnetScore: average(row.isnet),
  })),
  summary: {
    u2netp: tally('u2netp'), isnetGeneralUse: tally('isnet'),
    meaningfulIsnetWins: REVIEWS.filter(row => row.winner === 'isnet-general-use' && row.differenceMeaningful).length,
    totalCases: REVIEWS.length,
    performanceReference: draft.performanceReference,
  },
  recommendation: {
    currentStrategy: 'E_NO_MODEL_READY',
    reason: 'Ambos ONNX tienen LICENSE_UNRESOLVED para uso comercial y redistribución.',
    ifLicenseGatePasses: 'A_U2NETP_DEFAULT_ONLY',
    conditionalDefaultModel: 'u2netp',
    conditionalFallbackModel: null,
    conditionalRationale: 'ISNet mejora de modo significativo 1/5 casos y exige ~39x más bytes de modelo y ~2.5x RAM; el caso U2NetP malo debe quedar como raster/icono hasta que exista QC de calidad, no como fallback automático.',
    futureAssetClass: '3D_OBJECT',
  },
  gates: {
    licenseGate: 'CONDITIONAL', qualityGate: 'PASS', cutoutProductReady: 'CONDITIONAL',
    technicalVerdict: 'PASS', visualVerdict: 'PENDING_HUMAN_REVIEW',
  },
}
const output = path.join(EVIDENCE_ROOT, 'cutout-final-gate-results.json')
writeJson(output, results)
console.log('CUTOUT_FINAL_GATE_RESULTS=' + output)
