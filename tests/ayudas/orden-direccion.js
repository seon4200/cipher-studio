// Ejecuta direccionDe y sus helpers EXTRAIDOS del bundle, no una copia de su algoritmo.
// Solo se sustituyen sus entradas: generador y catalogos. No hay costura en produccion.
const fs = require('fs')
const vm = require('vm')
const ts = require('typescript')
const assert = require('node:assert/strict')

module.exports = function comprobarOrdenDireccion (bundle, archivo, ok) {
  const ast = ts.createSourceFile(archivo, fs.readFileSync(archivo, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const funciones = new Map(ast.statements.filter(ts.isFunctionDeclaration)
    .filter(n => n.name).map(n => [n.name.text, n]))
  const raiz = funciones.get(bundle.direccionDe.name)
  assert(raiz, 'La exportacion real debe apuntar a una funcion del bundle')
  assert.equal(raiz.getText(ast), bundle.direccionDe.toString(),
    'Se prueba exactamente la funcion exportada, no otra con nombre parecido')

  const dependencias = new Map()
  const identificadores = new Set()
  function incluir (n) {
    if (dependencias.has(n.name.text)) return
    dependencias.set(n.name.text, n)
    function visitar (x) {
      if (ts.isIdentifier(x)) identificadores.add(x.text)
      if (ts.isCallExpression(x) && ts.isIdentifier(x.expression)) {
        const nombre = x.expression.text
        if (!/^generador(?:\$\d+)?$/.test(nombre) && funciones.has(nombre))
          incluir(funciones.get(nombre))
      }
      ts.forEachChild(x, visitar)
    }
    visitar(n)
  }
  incluir(raiz) // Incluye elige y repertorio reales, incluso si Vite renombra sus bindings.
  function binding (nombre) {
    const encontrados = [...identificadores].filter(n =>
      n === nombre || new RegExp('^' + nombre + '\\$\\d+$').test(n))
    assert.equal(encontrados.length, 1, 'Binding unico de ' + nombre)
    return encontrados[0]
  }
  const ejes = ['fondo', 'estructura', 'camara', 'densidad', 'ritmo', 'tipografia']
  const nombres = ['FONDOS', 'ESTRUCTURAS', 'CAMARAS', 'DENSIDADES', 'RITMOS', 'TIPOGRAFIAS']
  const retorno = raiz.body.statements.find(ts.isReturnStatement)
  assert(retorno && ts.isObjectLiteralExpression(retorno.expression))
  const objeto = retorno.expression
  const propiedades = [...objeto.properties]
  assert.deepEqual(propiedades.map(p => p.name.getText(ast)), ejes,
    'Orden declarado: fondo, estructura, camara, densidad, ritmo, tipografia')
  const helpers = [...dependencias.values()].filter(n => n !== raiz).map(n => n.getText(ast))
  const fuente = raiz.getText(ast)

  function ejecutar (n, codigo = fuente) {
    const contexto = {}
    const llamadas = []
    let consumos = 0
    contexto[binding('generador')] = semilla => {
      llamadas.push(semilla)
      return () => {
        assert(consumos < ejes.length, 'No puede haber un septimo sorteo')
        // Seis entradas conocidas: el sorteo i cae en la casilla i del catalogo de prueba.
        return (consumos++ + 0.5) / n
      }
    }
    nombres.forEach((nombre, i) => {
      const ids = Array.from({ length: n }, (_, j) => ejes[i] + '-' + j)
      contexto[binding(nombre)] = i === 3 || i === 4 ? ids :
        Object.fromEntries(ids.map(id => [id, nombre === 'ESTRUCTURAS'
          ? { id, tipografias: ['neutral', 'condensada'] }
          : nombre === 'TIPOGRAFIAS' ? { id, rol: 'neutral' } : { id }]))
    })
    const d = vm.runInNewContext(helpers.join('\n') + '\n' + codigo + '\n' +
      raiz.name.text + '(1729)', contexto, { timeout: 1000 })
    assert.deepEqual(llamadas, [1729], 'Un solo generador con la semilla recibida')
    assert.equal(consumos, 6, 'Exactamente seis sorteos sobre ese generador')
    return ejes.every((eje, i) => d[eje] === eje + '-' + i)
  }

  // Catalogos sinteticos con varias opciones TAMBIEN en densidad/ritmo: sus registros
  // actuales tienen una sola y ocultarian un intercambio. No dependen de piezas futuras.
  for (const n of [6, 11]) {
    ok(ejecutar(n), 'orden de los seis sorteos, catalogos de ' + n + ' opciones')
    let detectados = 0
    for (let a = 0; a < ejes.length; a++) for (let b = a + 1; b < ejes.length; b++) {
      const invertidas = propiedades.map(p => p.getText(ast))
      ;[invertidas[a], invertidas[b]] = [invertidas[b], invertidas[a]]
      // Mutacion SOLO en memoria, sobre limites del AST. Ningun fichero se modifica.
      const inicio = objeto.getStart(ast) - raiz.getStart(ast)
      const fin = objeto.end - raiz.getStart(ast)
      const rota = fuente.slice(0, inicio) + '{' + invertidas.join(',\n') + '}' + fuente.slice(fin)
      if (!ejecutar(n, rota)) detectados++
    }
    ok(detectados === 15, 'control negativo: detecta los 15 intercambios de ejes (' + n + ' opciones)',
      detectados + '/15; incluye densidad/ritmo y tipografia contra cada eje')
  }
}
