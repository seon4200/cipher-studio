// EL EJECUTOR DEL CONJUNTO. `npm test`.
//
// POR QUE EXISTE. Hasta hoy "las suites verdes" significaba una persona escribiendo un bucle a
// mano, suite por suite. Nunca fallo, pero el dia que se olvidara una nadie se enteraria -- y eso
// es, palabra por palabra, el modo de fallo que la Fase 2 existe para impedir, aplicado a las
// propias pruebas: algo que hay que acordarse de mirar es algo que un dia deja de mirarse.
//
// DEVUELVE DISTINTO DE CERO SI ALGUNA FALLA. Es lo unico que lo hace util para un CI o un hook
// mañana. Un ejecutor que imprime rojo y sale con 0 no sirve de nada.
//
// NO REIMPLEMENTA NADA: lanza los propios `npm run test:*`. Si alguien cambia lo que hace
// `test:mapa`, esto corre lo cambiado. La alternativa -- invocar electron con la ruta a mano --
// crearia una segunda definicion de cada suite que se separaria de la primera en silencio.

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

// El ejecutor también es una barrera: las suites verdes no pueden haber escrito la raíz del repo
// ni cambiado o eliminado estados de proyectos reales. Las suites mutables usan fixtures en tmp,
// pero esta huella detecta una regresión aunque alguien se salte ese helper en el futuro.
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fileFingerprint = file => fs.existsSync(file)
  ? { sha256: sha256(file), size: fs.statSync(file).size, mtimeMs: fs.statSync(file).mtimeMs }
  : null;
function projectFingerprint () {
  const root = path.join(RAIZ, 'proyectos');
  const files = [];
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && (entry.name === 'project-state.json' || entry.name === 'project-state.json.bak')) {
        files.push([path.relative(RAIZ, target).replace(/\\/g, '/'), fileFingerprint(target)]);
      }
    }
  };
  walk(root);
  return files.sort((a, b) => a[0].localeCompare(b[0]));
}
const repositoryStateBaseline = JSON.stringify({
  rootState: fileFingerprint(path.join(RAIZ, 'project-state.json')),
  rootBackup: fileFingerprint(path.join(RAIZ, 'project-state.json.bak')),
  projects: projectFingerprint(),
});
const verifyRepositoryState = () => JSON.stringify({
  rootState: fileFingerprint(path.join(RAIZ, 'project-state.json')),
  rootBackup: fileFingerprint(path.join(RAIZ, 'project-state.json.bak')),
  projects: projectFingerprint(),
}) === repositoryStateBaseline;

// ── LO QUE SE EXCLUYE, Y POR QUE, ESCRITO AQUI Y NO EN LA CABEZA DE NADIE ────────────────────
//
// `ventana` esta ROJA A PROPOSITO: documenta un fallo real todavia sin arreglar. Un ejecutor que
// la incluyera naceria rojo para siempre, y un ejecutor siempre rojo entrena a no mirarlo -- con
// lo que el dia que se ponga roja una de verdad, tampoco se mira. Se excluye para que el verde
// signifique algo.
//
// NO se arregla, NO se borra y NO se desactiva: se corre a mano con `npm run test:ventana`.
const EXCLUIDAS = {
  ventana: 'roja a proposito: documenta un fallo real sin arreglar. Se corre a mano.'
};

// ── CUANTAS SUITES SE ESPERAN ───────────────────────────────────────────────────────────────
//
// ESTE NUMERO ES EL SEGURO. Sin el, el ejecutor hereda el problema que arregla: alguien añade
// `tests/nueva.js`, se olvida de engancharla, y el ejecutor sigue diciendo "todo verde" sobre un
// conjunto que ya no es el conjunto. Con el, el numero no cuadra y salta.
//
// SUBIRLO A MANO ES EL PUNTO. Es la linea que obliga a pararse a pensar "¿la he enganchado?".
const ESPERADAS = 18;

const rojo = s => '\x1b[31m' + s + '\x1b[0m';
const verde = s => '\x1b[32m' + s + '\x1b[0m';
const gris = s => '\x1b[90m' + s + '\x1b[0m';

// ── (1) LO QUE HAY EN DISCO CONTRA LO QUE HAY ENGANCHADO ─────────────────────────────────────
//
// Las dos direcciones, porque los dos descuadres son reales y distintos: un fichero de suite sin
// script es una prueba que NADIE corre; un script sin fichero es un script que revienta el dia
// que se lance. Ninguno de los dos avisa por su cuenta.
const enDisco = fs.readdirSync(path.join(RAIZ, 'tests'))
  .filter(f => f.endsWith('.js') && f !== 'todas.js')
  .map(f => f.slice(0, -3))
  .sort();

const enScripts = Object.keys(pkg.scripts)
  .filter(k => k.startsWith('test:'))
  .map(k => k.slice(5))
  .sort();

const problemas = [];
for (const s of enDisco) {
  if (!enScripts.includes(s)) {
    problemas.push(`tests/${s}.js existe pero NO tiene script "test:${s}": nadie la corre.`);
  }
}
for (const s of enScripts) {
  if (!enDisco.includes(s)) {
    problemas.push(`el script "test:${s}" apunta a tests/${s}.js, que NO existe.`);
  }
}

const aCorrer = enScripts.filter(s => !(s in EXCLUIDAS));

if (aCorrer.length !== ESPERADAS) {
  problemas.push(
    `se esperaban ${ESPERADAS} suites y hay ${aCorrer.length}. ` +
    'Si has añadido una, sube ESPERADAS en tests/todas.js; si has quitado una, bajalo. ' +
    'Este descuadre es el seguro haciendo su trabajo, no un fallo del ejecutor.');
}

console.log('');
console.log('  Suites del conjunto: ' + aCorrer.length + ' (se esperaban ' + ESPERADAS + ')');
for (const [s, motivo] of Object.entries(EXCLUIDAS)) {
  console.log(gris('  Excluida: test:' + s + ' — ' + motivo));
}
console.log('');

if (problemas.length) {
  console.log(rojo('  EL CONJUNTO NO CUADRA. No se corre nada hasta arreglarlo:'));
  for (const p of problemas) console.log(rojo('    · ' + p));
  console.log('');
  process.exit(1);
}

// ── (2) CORRERLAS ────────────────────────────────────────────────────────────────────────────
//
// EN SERIE, no en paralelo: cada suite abre Electron y crea proyectos de prueba en el mismo
// disco. En paralelo se pisarian y los fallos serian irreproducibles, que es lo peor que le
// puede pasar a una prueba.
const resultados = [];
for (const s of aCorrer) {
  const t0 = Date.now();
  process.stdout.write('  ' + ('test:' + s).padEnd(22) + ' ... ');
  const r = spawnSync('npm', ['run', 'test:' + s], {
    cwd: RAIZ, shell: true, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64
  });
  // El codigo de salida es LA AUTORIDAD. Las suites salen con 1 si hay fallos (`app.exit(...)`).
  // Buscar "TODO CORRECTO" en la salida seria mas bonito y menos fiable: una suite que revienta
  // antes de imprimir nada no imprime tampoco su fracaso.
  const stateStayedIntact = verifyRepositoryState();
  const ok = r.status === 0 && stateStayedIntact;
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  const isolationFailure = stateStayedIntact ? ''
    : '\nFALLO DE AISLAMIENTO: la suite cambió project-state.json/.bak en la raíz o dentro de proyectos/.\n';
  resultados.push({ suite: s, ok, code: r.status, seg, salida: (r.stdout || '') + (r.stderr || '') + isolationFailure });
  console.log((ok ? verde('OK') : rojo('FALLA (exit=' + r.status + ')')) + gris('  ' + seg + 's'));
}

// ── (3) EL RESUMEN ───────────────────────────────────────────────────────────────────────────
const fallidas = resultados.filter(r => !r.ok);

console.log('');
console.log('  ' + '─'.repeat(64));
for (const r of resultados) {
  console.log('  ' + (r.ok ? verde('✓') : rojo('✗')) + '  ' + ('test:' + r.suite).padEnd(22) +
    (r.ok ? '' : rojo('exit=' + r.code)));
}
console.log('  ' + '─'.repeat(64));
console.log('  ' + resultados.filter(r => r.ok).length + ' de ' + resultados.length + ' verdes.');

// LA SALIDA DE LAS QUE FALLAN, AL FINAL Y ENTERA. Un ejecutor que se traga la salida obliga a
// volver a correr la suite a mano para saber que paso, y entonces no ha ahorrado nada.
if (fallidas.length) {
  for (const r of fallidas) {
    console.log('');
    console.log(rojo('  ══ SALIDA DE test:' + r.suite + ' ' + '═'.repeat(50)));
    console.log(r.salida.trimEnd());
  }
  console.log('');
  console.log(rojo('  ' + fallidas.length + ' suite(s) en rojo: ' +
    fallidas.map(r => 'test:' + r.suite).join(', ')));
  console.log('');
  process.exit(1);
}

console.log('');
process.exit(0);
