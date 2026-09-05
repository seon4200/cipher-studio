/** Criterios del encargo 04/09/2026. Logica de medicion, no del renderer. */
const BASE_M7 = Object.freeze({ msFrame: 40.84, intentosFrame: 1.644, avisoMsFrame: 50.3, subida: 0.25 })

function evaluarM7(r) {
  if (r.error || r.muestras?.length !== 6 || r.muestras.some(m =>
    m.totalFrames !== 90 || !Number.isFinite(m.framesEnElTope))) {
    throw new Error('M7: tirada incompleta o fallida; no se puede declarar cero perdidas')
  }
  const frames = r.muestras.reduce((n, m) => n + m.totalFrames, 0)
  const enTope = r.muestras.reduce((n, m) => n + m.framesEnElTope, 0)
  const ms = r.regimen?.medianaMsFrame
  const intentos = r.regimen?.medianaIntentosFrame
  if (!Number.isFinite(ms) || !Number.isFinite(intentos)) throw new Error('M7: faltan medidas de regimen')
  return {
    M7a1: { clipsCompletados: 6, framesValidos: frames, perdidasDetectadas: 0,
      alcance: 'Solo los seis clips completados por renderGraphicClip, no una tasa universal' },
    M7a2: { framesAceptadosEnElTope: enTope, objetivoCero: enTope === 0, esPerdida: false },
    M7b: { msFrame: ms, base: BASE_M7.msFrame, variacionPorcentaje: (ms / BASE_M7.msFrame - 1) * 100,
      requiereDecision: ms > BASE_M7.msFrame * (1 + BASE_M7.subida) || ms > BASE_M7.avisoMsFrame },
    M7c: { intentosFrame: intentos, base: BASE_M7.intentosFrame, informativo: true }
  }
}
module.exports = { BASE_M7, evaluarM7 }

if (require.main === module) {
  if (process.argv[2]) {
    const r = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'))
    console.log(JSON.stringify(evaluarM7(r), null, 2))
  } else {
    const assert = require('assert/strict')
    const r = { muestras: Array.from({ length: 6 }, () => ({ totalFrames: 90, framesEnElTope: 0 })),
      regimen: { medianaMsFrame: 40.84, medianaIntentosFrame: 1.644 } }
    assert.equal(evaluarM7(r).M7a2.objetivoCero, true)
    r.muestras[0].framesEnElTope = 1
    assert.equal(evaluarM7(r).M7a1.perdidasDetectadas, 0)
    assert.equal(evaluarM7(r).M7a2.objetivoCero, false)
    r.regimen.medianaMsFrame = 70
    assert.equal(evaluarM7(r).M7b.requiereDecision, true)
    assert.throws(() => evaluarM7({ ...r, error: 'frame no llego tras 5 intentos' }), /fallida/)
    assert.throws(() => evaluarM7({ ...r, muestras: r.muestras.slice(1) }), /incompleta/)
    console.log('M7: controles verdes; quinto intento valido != perdida; fallo/incompleto rechaza; coste informa')
  }
}
