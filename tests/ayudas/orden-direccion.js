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
  // Densidad no es un sorteo: procede del contenido. La guardia protege exactamente los cinco
  // consumos de semilla que quedan y falla si alguien vuelve a convertirla en un sexto dado.
  const sorteos = [
    ['fondo', 'FONDOS'], ['estructura', 'ESTRUCTURAS'], ['camara', 'CAMARAS'],
    ['ritmo', 'RITMOS'], ['tipografia', 'TIPOGRAFIAS']
  ]
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
        assert(consumos < sorteos.length, 'No puede haber un sexto sorteo')
        // Cinco entradas conocidas: el sorteo i cae en la casilla i del catalogo de prueba.
        return (consumos++ + 0.5) / n
      }
    }
    sorteos.forEach(([eje, nombre], i) => {
      const ids = Array.from({ length: n }, (_, j) => eje + '-' + j)
      contexto[binding(nombre)] = nombre === 'RITMOS' ? ids :
        Object.fromEntries(ids.map(id => [id, nombre === 'ESTRUCTURAS'
          ? { id, tipografias: ['neutral', 'condensada'] }
          : nombre === 'TIPOGRAFIAS' ? { id, rol: 'neutral' } : { id }]))
    })
    const d = vm.runInNewContext(helpers.join('\n') + '\n' + codigo + '\n' +
      raiz.name.text + '(1729)', contexto, { timeout: 1000 })
    assert.deepEqual(llamadas, [1729], 'Un solo generador con la semilla recibida')
    assert.equal(consumos, 5, 'Exactamente cinco sorteos sobre ese generador')
    return sorteos.every(([eje], i) => d[eje] === eje + '-' + i) && d.densidad === 'minima'
  }

  // Catalogos sinteticos con varias opciones en los cinco sorteos: no dependen de piezas futuras.
  for (const n of [6, 11]) {
    ok(ejecutar(n), 'orden de los cinco sorteos, catalogos de ' + n + ' opciones')
    let detectados = 0
    const indicesSorteo = [0, 1, 2, 4, 5]
    for (let ia = 0; ia < indicesSorteo.length; ia++) for (let ib = ia + 1; ib < indicesSorteo.length; ib++) {
      const a = indicesSorteo[ia], b = indicesSorteo[ib]
      const invertidas = propiedades.map(p => p.getText(ast))
      ;[invertidas[a], invertidas[b]] = [invertidas[b], invertidas[a]]
      // Mutacion SOLO en memoria, sobre limites del AST. Ningun fichero se modifica.
      const inicio = objeto.getStart(ast) - raiz.getStart(ast)
      const fin = objeto.end - raiz.getStart(ast)
      const rota = fuente.slice(0, inicio) + '{' + invertidas.join(',\n') + '}' + fuente.slice(fin)
      if (!ejecutar(n, rota)) detectados++
    }
    ok(detectados === 10, 'control negativo: detecta los 10 intercambios de sorteos (' + n + ' opciones)',
      detectados + '/10; densidad queda fuera porque procede del contenido')
  }
}
