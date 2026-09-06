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
  // Densidad no es un sorteo: procede del contenido. Fondo+cámara ahora son UN sorteo sobre
  // pares legales; la guardia protege que no vuelvan a sortearse por separado y reabran energía.
  const sorteos = [
    ['par', 'FONDOS'], ['estructura', 'ESTRUCTURAS'], ['ritmo', 'RITMOS'], ['tipografia', 'TIPOGRAFIAS']
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
        assert(consumos < sorteos.length, 'No puede haber un quinto sorteo')
        // Cuatro entradas conocidas: par legal, estructura, ritmo y tipografía.
        return (consumos++ + 0.5) / n
      }
    }
    const piezasEnergia = Object.fromEntries(Array.from({ length: n }, (_, j) => {
      const id = 'par-' + j
      return [id, { id, energia: 0 }]
    }))
    contexto[binding('FONDOS')] = piezasEnergia
    contexto[binding('CAMARAS')] = piezasEnergia
    sorteos.filter(([, nombre]) => nombre !== 'FONDOS').forEach(([eje, nombre], i) => {
      const ids = Array.from({ length: n }, (_, j) => eje + '-' + j)
      contexto[binding(nombre)] = nombre === 'RITMOS' ? ids :
        Object.fromEntries(ids.map(id => [id, nombre === 'ESTRUCTURAS'
          ? { id, tipografias: ['neutral', 'condensada'] }
          : { id, rol: 'neutral' }]))
    })
    const d = vm.runInNewContext(helpers.join('\n') + '\n' + codigo + '\n' +
      raiz.name.text + '(1729)', contexto, { timeout: 1000 })
    assert.deepEqual(llamadas, [1729], 'Un solo generador con la semilla recibida')
    assert.equal(consumos, 4, 'Exactamente cuatro sorteos sobre ese generador')
    const indicePar = Math.floor((.5 / n) * n * n)
    const fondo = 'par-' + Math.floor(indicePar / n)
    const camara = 'par-' + (indicePar % n)
    return d.fondo === fondo && d.camara === camara && d.estructura === 'estructura-1' &&
      d.ritmo === 'ritmo-2' && d.tipografia === 'tipografia-3' && d.densidad === 'minima'
  }

  // Catalogos sinteticos con varias opciones en los cinco sorteos: no dependen de piezas futuras.
  for (const n of [6, 11]) {
    ok(ejecutar(n), 'orden de par legal, estructura, ritmo y tipografía, catalogos de ' + n + ' opciones')
    // Control negativo 1: invertir estructura y ritmo cambia el ordinal de sus sorteos.
    // Se intercambian EXPRESIONES, no la posicion de propiedades sin efectos como fondo/cámara,
    // que ahora son dos caras del mismo par ya resuelto antes del return.
    const props = propiedades.map(p => p.getText(ast))
    const iE = props.findIndex(p => p.startsWith('estructura:'))
    const iR = props.findIndex(p => p.startsWith('ritmo:'))
    ;[props[iE], props[iR]] = [props[iR], props[iE]]
    const inicio = objeto.getStart(ast) - raiz.getStart(ast)
    const fin = objeto.end - raiz.getStart(ast)
    const ordenRoto = fuente.slice(0, inicio) + '{' + props.join(',\n') + '}' + fuente.slice(fin)
    let detectaOrden = false
    try { detectaOrden = !ejecutar(n, ordenRoto) } catch (_) { detectaOrden = true }
    ok(detectaOrden, 'control negativo: detecta invertir los sorteos de estructura y ritmo (' + n + ' opciones)')
    // Control negativo 2: alterar el repertorio de pares cambia el fondo/cámara resultante.
    const fnPares = binding('paresFondoCamaraLegales')
    const parRoto = fuente.replace(fnPares + '()', fnPares + '().reverse()')
    assert.notEqual(parRoto, fuente, 'La mutacion del repertorio de pares debe tocar la funcion exportada')
    let detectaPar = false
    try { detectaPar = !ejecutar(n, parRoto) } catch (_) { detectaPar = true }
    ok(detectaPar, 'control negativo: detecta alterar el repertorio de pares legales (' + n + ' opciones)')
  }
}
