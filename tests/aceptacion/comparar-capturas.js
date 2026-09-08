// COMPARAR DOS CAPTURAS: pixeles distintos, delta, y un VEREDICTO de tres estados.
//
// SUSTITUYE A LA IGUALDAD BYTE A BYTE en el diff de comportamiento de los merges.
//
// POR QUE HIZO FALTA. Comparar dos renders al byte parecia la prueba mas dura que existe, y
// resulto ser inservible: de seis tiradas del MISMO clip, cinco salieron identicas y una no. Con
// igualdad estricta esa sexta convierte cualquier merge en rojo y no dice de que. Peor: no
// distingue "se ha movido un elemento" -- que es un cambio de verdad -- de "el rasterizado ha
// salido medio nivel distinto", que es ruido.
//
// EL HISTOGRAMA ES EL DISCRIMINADOR, y es lo que hace utilizable la comparacion:
//
//   pocos pixeles  + delta enorme              -> algo SE MOVIO. Cambio real.
//   muchos pixeles + delta <= 4, ninguno > 64  -> RASTERIZADO. Ruido.
//
// Un elemento desplazado deja pocos pixeles cambiados pero con delta de cientos: donde antes
// habia fondo ahora hay figura. Un rasterizado ligeramente distinto deja muchisimos pixeles
// cambiados con delta de uno o dos: los mismos bordes, medio nivel corridos. Son firmas opuestas
// y por eso se pueden separar.
//
// USO
//   node tests/aceptacion/comparar-capturas.js a.raw b.raw
//   node tests/aceptacion/comparar-capturas.js a.mp4 b.mp4 [--frames 0,39,77]
//
//   Con ficheros .raw compara directamente (RGBA crudo, mismo tamaño).
//   Con videos extrae los frames con ffmpeg y compara cada uno.
//
//   Sale con 0 si el veredicto es IGUAL o EQUIVALENTE, y con 1 si es DISTINTO.
//
// Tambien se puede importar: `const { comparar, veredicto, UMBRALES } = require('./comparar-capturas')`

const fs = require('fs')
const os = require('os')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../helpers/safe-fixture')
const { execSync } = require('child_process')

// ── LOS UMBRALES, Y DE DONDE SALEN ──────────────────────────────────────────────────────────
//
// NO SON REDONDOS PORQUE SI. Salen de la unica anomalia medida hasta hoy: la tirada `5cb7d33`
// contra las otras cinco, sobre `visual_mapa` a 1080x1920.
//
//   frame 39:  28.674 px distintos (1,38%)   delta max = 16   delta medio = 1,6
//   frame 77: 247.745 px distintos (11,9%)   delta max = 37   delta medio = 2,0
//   reparto: el 99% de los pixeles cambiados en 1-4 niveles; CERO por encima de 64.
//
// EL PORCENTAJE NO DISCRIMINA NADA, y esta version existe para quitarlo. La anterior mandaba a
// DISTINTO cualquier cosa que cambiara mas del 5% de la pantalla, y con eso el frame 77 de esa
// anomalia -- 11,9% de pixeles cambiados y NI UNO por encima de delta 64, o sea ruido puro --
// salia DISTINTO y habria puesto un merge en rojo. Un rasterizado medio nivel corrido afecta a
// TODOS los bordes de la imagen a la vez: que cubra mucha pantalla es lo NORMAL en el caso
// benigno, no una señal de alarma. Lo que separa las dos familias es la MAGNITUD del delta.
//
// DELTA_RUIDO = 64. La anomalia real no paso de 37, asi que 64 deja casi el doble de margen y
// sigue MUY por debajo de lo que produce un desplazamiento: mover un elemento sobre un fondo
// oscuro da deltas de 150-250. Es un hueco ancho, no una linea fina, y por eso el umbral no es
// delicado.
//
// MEDIA_RUIDO = 8. Segundo criterio para el caso que DELTA_RUIDO solo no cubre: una desviacion
// SISTEMATICA y suave -- toda la imagen cinco niveles mas clara, por ejemplo -- no dispararia
// ningun pixel por encima de 64 y sin embargo es un cambio real. La anomalia benigna dio medias
// de 1,6 y 2,0, asi que 8 esta a cuatro veces de lo medido: otro hueco ancho. La media se toma
// SOBRE LOS PIXELES QUE CAMBIAN, no sobre la imagen entera; promediar sobre los 2 millones
// diluiria cualquier cosa hasta cero y el criterio no serviria para nada.
//
// LOS DOS SON `O`: basta uno para DISTINTO. Cubren cambios distintos -- uno localizado y fuerte,
// otro repartido y suave -- y ninguno de los dos implica al otro.
const UMBRALES = {
  DELTA_RUIDO: 64,
  MEDIA_RUIDO: 8
}

/** Compara dos buffers RGBA del mismo tamaño. El alfa NO entra: se comparan R, G y B. */
function comparar (bufA, bufB) {
  if (bufA.length !== bufB.length) {
    return { error: `tamaños distintos: ${bufA.length} vs ${bufB.length} bytes` }
  }
  const total = bufA.length / 4
  let pix = 0, maxD = 0, suma = 0
  const hist = { '1-4': 0, '5-16': 0, '17-64': 0, '65+': 0 }
  for (let i = 0; i < bufA.length; i += 4) {
    let d = 0
    for (let c = 0; c < 3; c++) {
      const x = Math.abs(bufA[i + c] - bufB[i + c])
      if (x > d) d = x
    }
    if (d === 0) continue
    pix++; suma += d
    if (d > maxD) maxD = d
    if (d <= 4) hist['1-4']++
    else if (d <= 16) hist['5-16']++
    else if (d <= 64) hist['17-64']++
    else hist['65+']++
  }
  return {
    pix, total,
    pct: total ? (pix * 100 / total) : 0,
    maxD,
    media: pix ? suma / pix : 0,
    hist
  }
}

/**
 * EL VEREDICTO, en tres estados y no en dos.
 *
 * Dos estados obligarian a elegir entre "toda diferencia es un fallo" -- que es lo que ya se
 * probo que no sirve -- y "casi igual pasa", que esconderia un elemento desplazado si fuera
 * pequeño. Tres separan las dos preguntas distintas: ¿es identico? y ¿es el MISMO dibujo?
 */
function veredicto (c) {
  if (c.error) return 'ERROR'
  if (c.pix === 0) return 'IGUAL'
  // UN SOLO PIXEL POR ENCIMA DEL RUIDO YA DICE QUE ALGO SE MOVIO, por pocos que sean: donde
  // habia fondo hay figura. Es el criterio principal y el que decide casi siempre.
  if (c.hist['65+'] > 0) return 'DISTINTO'
  // Y una desviacion sistematica y suave, que no dispara ningun pixel pero corre la imagen
  // entera. Cuantos pixeles cambien NO entra en la decision: un rasterizado medio nivel corrido
  // toca todos los bordes a la vez, asi que cubrir mucha pantalla es lo normal en el caso benigno.
  if (c.media > UMBRALES.MEDIA_RUIDO) return 'DISTINTO'
  return 'EQUIVALENTE'
}

function informe (etiqueta, c) {
  const v = veredicto(c)
  if (c.error) return `  ${etiqueta}: ERROR — ${c.error}`
  if (v === 'IGUAL') return `  ${etiqueta}: IGUAL`
  // LA CIFRA PRINCIPAL VA PRIMERA Y SOLA porque es la unica que decide. El resto -- cuantos
  // pixeles cambian y en que tramos -- es contexto para entender QUE paso, no para el veredicto.
  return `  ${etiqueta}: ${v}\n` +
    `      px con delta > ${UMBRALES.DELTA_RUIDO}: ${c.hist['65+']}   <- la cifra que decide\n` +
    `      ${c.pix} px cambiados de ${c.total}  delta max=${c.maxD}  medio=${c.media.toFixed(1)}\n` +
    `      reparto del delta -> 1-4:${c.hist['1-4']}  5-16:${c.hist['5-16']}  ` +
    `17-64:${c.hist['17-64']}  65+:${c.hist['65+']}` +
    (c.hist['65+'] > 0
      ? `\n      ${c.hist['65+']} pixel(es) por encima de ${UMBRALES.DELTA_RUIDO}: algo SE MOVIO.`
      : (c.media > UMBRALES.MEDIA_RUIDO
          ? `\n      ningun pixel pasa de ${UMBRALES.DELTA_RUIDO}, pero el delta medio es ` +
            `${c.media.toFixed(1)} (limite ${UMBRALES.MEDIA_RUIDO}): desviacion SISTEMATICA.`
          : `\n      ningun pixel pasa de ${UMBRALES.DELTA_RUIDO} y el delta medio es ` +
            `${c.media.toFixed(1)}: firma de RASTERIZADO, no de movimiento.`))
}

/** Extrae un frame crudo RGBA de un video. Usa el ffmpeg del PATH, como el resto del proyecto. */
function sacarFrame (video, n, destino) {
  execSync(`ffmpeg -y -v error -i "${video}" -vf "select=eq(n\\,${n})" -vsync 0 ` +
    `-frames:v 1 -f rawvideo -pix_fmt rgba "${destino}"`, { maxBuffer: 1 << 26 })
  return fs.readFileSync(destino)
}

module.exports = { comparar, veredicto, informe, sacarFrame, UMBRALES }

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2)
  const iF = args.indexOf('--frames')
  const frames = iF >= 0 ? args[iF + 1].split(',').map(Number) : [0, 39, 77]
  // OJO con `iF + 1` cuando no hay --frames: indexOf devuelve -1 y iF+1 vale 0, que es el indice
  // del PRIMER fichero. Sin la guarda, el uso normal se queda sin argumentos.
  const ficheros = args.filter((a, i) => !a.startsWith('--') && !(iF >= 0 && i === iF + 1))

  if (ficheros.length !== 2) {
    console.log('\n  uso: node tests/aceptacion/comparar-capturas.js A B [--frames 0,39,77]')
    console.log('       A y B pueden ser .raw (RGBA crudo) o videos.\n')
    process.exit(2)
  }
  const [A, B] = ficheros
  for (const f of [A, B]) {
    if (!fs.existsSync(f)) { console.log(`\n  no existe: ${f}\n`); process.exit(2) }
  }

  console.log('')
  const peores = []
  if (A.endsWith('.raw') && B.endsWith('.raw')) {
    const c = comparar(fs.readFileSync(A), fs.readFileSync(B))
    console.log(informe(path.basename(A) + ' vs ' + path.basename(B), c))
    peores.push(veredicto(c))
  } else {
    const tmp = createTestFixture('comparar-capturas')
    try {
      for (const n of frames) {
        const c = comparar(sacarFrame(A, n, path.join(tmp, `a${n}.raw`)),
                           sacarFrame(B, n, path.join(tmp, `b${n}.raw`)))
        console.log(informe('frame ' + String(n).padStart(3), c))
        peores.push(veredicto(c))
      }
    } finally {
      cleanupTestFixture(tmp)
    }
  }

  const peor = peores.includes('ERROR') ? 'ERROR'
    : peores.includes('DISTINTO') ? 'DISTINTO'
    : peores.includes('EQUIVALENTE') ? 'EQUIVALENTE' : 'IGUAL'
  console.log(`\n  VEREDICTO: ${peor}\n`)
  process.exit(peor === 'IGUAL' || peor === 'EQUIVALENTE' ? 0 : 1)
}
