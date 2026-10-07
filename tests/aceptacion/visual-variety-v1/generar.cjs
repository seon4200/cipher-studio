const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const CORPUS = path.join(REPO_ROOT, 'tests', 'aceptacion', 'visual-composition-v2', 'corpus-50.json')
const OUTPUT = __dirname
const JSON_FILE = path.join(OUTPUT, 'baseline-v13.json')
const MARKDOWN_FILE = path.join(OUTPUT, 'baseline-v13.md')

function writeJson (file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function observationFor (row) {
  const hero = row.provider === 'openmoji' ? 'present' : row.provider === 'solar' ? 'procedural' : null
  return {
    materialized: row.rendered === true,
    sceneSpec: {
      visualMode: row.visualMode,
      direccion: { estructura: row.structure },
      text: {
        fontPairId: row.structure === 'editorial' ? 'editorial-black' : 'technical-black',
        alignment: row.structure === 'editorial' ? 'left' : 'center',
      },
      slots: hero ? [{ role: 'hero', state: hero }] : [],
    },
  }
}

app.whenReady().then(() => {
  try {
    const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'))
    if (!Array.isArray(corpus.rows)) throw new Error('El corpus V13 no contiene rows')
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    const metrics = bundle.measureVisualVarietyV1(corpus.rows.map(observationFor))
    const evidence = {
      schemaVersion: 1,
      source: 'tests/aceptacion/visual-composition-v2/corpus-50.json',
      corpusRows: corpus.rows.length,
      materializedOnly: true,
      metric: metrics,
      notes: [
        'Diagnóstico puro: no participa en PixelIdentity, hash ni renderer.',
        'Estructura efectiva combina modo visual, envelope Hero y región de texto; no cuenta IDs nominales sin materialización.',
        'Keyword typeface cuenta la familia realmente usada por V13, no el número de fontPairId.',
      ],
    }
    writeJson(JSON_FILE, evidence)
    const lines = [
      '# Línea base de variedad visual V1',
      '',
      'Fuente: corpus reproducible V13 de composición visual. Sólo cuenta Visuales materializados.',
      '',
      '| Métrica | Valor |',
      '| --- | ---: |',
      `| distinctStructures | ${metrics.distinctStructures} |`,
      `| dominantStructureShare | ${metrics.dominantStructureShare}% |`,
      `| distinctHeroPlacements | ${metrics.distinctHeroPlacements} |`,
      `| distinctKeywordTypefaces | ${metrics.distinctKeywordTypefaces} |`,
      `| materializedVisuals | ${metrics.materializedVisuals} |`,
      '',
      'La métrica es diagnóstica y no es una evaluación estética.',
      '',
    ]
    fs.writeFileSync(MARKDOWN_FILE, lines.join('\n'), 'utf8')
    console.log('VARIETY_BASELINE=' + JSON.stringify(metrics))
    app.exit(0)
  } catch (error) {
    console.error(error && error.stack || error)
    app.exit(1)
  }
})
