/*
 * CALIBRATION CORPUS — Semantic Asset Relevance Gate V1.
 *
 * Congelado ANTES de calibrar los umbrales del gate.
 *
 * Cada fila es NARRACION + RESPUESTA REAL DEL PROVEEDOR. Los tags no estan escritos a mano:
 * salen de consultas de solo lectura a la API publica de Pixabay, construidas con las MISMAS
 * queries que produce buildPixabayImageSearchPlansV1 (espanol, con el adorno "aislado").
 *
 * Las dos primeras filas son los assets que la app acepto de verdad en la escena visual-2:1 del
 * proyecto dfgdfg-1789093808740; su reconstruccion esta en
 * tests/aceptacion/semantic-relevance-gate-v1/README.md.
 *
 * `expected` es el veredicto de producto, no una regla: el gate NO puede leer este fichero.
 */
function row (value) {
  return Object.freeze({ ...value, candidate: Object.freeze({ ...value.candidate }) })
}

const SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1 = Object.freeze([
  row({
    id: "prod-desperanza-arbol", concept: "desperanza", expected: "reject",
    note: "Ilustracion de arbol de fantasia aceptada en produccion por coincidir con \"aislado\".",
    candidate: { id: "1511604", query: "desperanza. aislado", type: "illustration",
      width: 6000, height: 4500,
      tags: "árbol, fantasía, escalera de caracol, cuento de hadas, sin hojas, deshojado, arte digital, aislado, treehouse" },
  }),
  row({
    id: "prod-trabajar-nube-palabras", concept: "trabajar", expected: "reject",
    note: "Nube de palabras sobre refugio animal; score 3 por \"aislado\" + \"trabajar como voluntario\" en posicion 19.",
    candidate: { id: "2696823", query: "trabajar aislado", type: "illustration",
      width: 3500, height: 2942,
      tags: "nube de palabra, las manos, bienestar de los animales, refugio de animales, aislado, mano, ayuda, apoyo, donación, a través de, esperanza, presentación, humano, patria, animal, animales, amor, tiempo, trabajar como voluntario, mantenimiento, vigilar, seguridad, información, gente, personal, estar de pie" },
  }),
  row({
    id: "neg-desperanza-anzuelo", concept: "desperanza", expected: "reject",
    note: "Anzuelo de pesca para un token roto del transcript.",
    candidate: { id: "7418284", query: "desperanza. aislado", type: "photo",
      width: 4016, height: 6016,
      tags: "gancho, pesca, anzuelo de pesca, aislado en negro, gancho, pesca, pesca, pesca, pesca, pesca" },
  }),
  row({
    id: "neg-desperanza-cabana", concept: "desperanza", expected: "reject",
    note: "Cabana en el bosque, sin relacion alguna.",
    candidate: { id: "2955582", query: "desperanza. aislado", type: "photo",
      width: 5112, height: 3145,
      tags: "cabaña, árboles, sendero, rastro, casa, jardín, hierba, paisaje, aislado, naturaleza, casa, casa, casa, casa, casa" },
  }),
  row({
    id: "neg-potencial-anzuelo", concept: "potencial", expected: "reject",
    note: "El mismo anzuelo reaparece para otra consulta abstracta.",
    candidate: { id: "7418284", query: "potencial aislado", type: "photo",
      width: 4016, height: 6016,
      tags: "gancho, pesca, anzuelo de pesca, aislado en negro, gancho, pesca, pesca, pesca, pesca, pesca" },
  }),
  row({
    id: "neg-trabajar-rompecabezas", concept: "trabajar", expected: "reject",
    note: "Manos con piezas de rompecabezas: relleno conceptual de stock.",
    candidate: { id: "20333", query: "trabajar aislado", type: "photo",
      width: 5184, height: 3456,
      tags: "las manos, piezas de rompecabezas, conectar, conexión, cooperación, tenencia, aislado, rompecabezas, unirse, camaradería, gente, piezas, trabajo en equipo, dos, unidad, monocromo, ocurrencia, concepto, en blanco y negro, conectar, conectar, conectar, conexión, cooperación, rompecabezas, rompecabezas, rompecabezas, rompecabezas, rompecabezas, gente, gente, gente, gente, piezas, dos, dos, unidad, unidad, unidad, unidad, concepto" },
  }),
  row({
    id: "neg-libertad-pajaro", concept: "libertad", expected: "reject",
    note: "Pajaro en paisaje montanoso; \"libertad\" es la ultima etiqueta de 19.",
    candidate: { id: "10324879", query: "libertad aislado", type: "photo",
      width: 6252, height: 3702,
      tags: "pájaro, montaña, kea, paisaje montañoso, nieve, volador, cielo, gris, desierto, paisaje natural, invierno, nueva zelanda, gran altitud, vida silvestre, frío, panorama, naturaleza, niebla, libertad" },
  }),
  row({
    id: "pos-perro-labrador", concept: "perro", expected: "hero",
    note: "Labrador real para el concepto perro.",
    candidate: { id: "2253166", query: "perro aislado", type: "photo",
      width: 3174, height: 2403,
      tags: "aislado, labrador, naturaleza, mascota, perro, animal, perro de raza pura, cachorro" },
  }),
  row({
    id: "pos-camara-digital", concept: "camara", expected: "hero",
    note: "Camara digital para el concepto camara.",
    candidate: { id: "1362419", query: "camara aislado", type: "photo",
      width: 4314, height: 2857,
      tags: "cámara, digital, fotografía, tecnología, clásico, fujfilm, foto, fotógrafo, dslr, aislado, cámara, cámara, cámara, cámara, cámara" },
  }),
  row({
    id: "pos-tren-locomotora", concept: "tren", expected: "hero",
    note: "Locomotora para el concepto tren.",
    candidate: { id: "2501397", query: "tren aislado", type: "photo",
      width: 3786, height: 2338,
      tags: "tráfico, ferrocarril, locomotora, tren, transporte, aislado, modelo de tren, locomotora, locomotora, locomotora, locomotora, locomotora, tren" },
  }),
  row({
    id: "pos-reloj-pulsera", concept: "reloj", expected: "hero",
    note: "Reloj de pulsera para el concepto reloj.",
    candidate: { id: "3230523", query: "reloj aislado", type: "photo",
      width: 6240, height: 4160,
      tags: "aislado, reloj, reloj de pulsera, rolex" },
  }),
  row({
    id: "pos-pan-blanco", concept: "pan", expected: "hero",
    note: "Pan para el concepto pan.",
    candidate: { id: "3277831", query: "pan aislado", type: "photo",
      width: 5184, height: 2656,
      tags: "comida, pan, aislado, pan blanco, panadero, pan, pan, pan, pan, pan, pan blanco" },
  }),
  row({
    id: "pos-hospital-quirofano", concept: "hospital", expected: "hero",
    note: "Quirofano para el concepto hospital.",
    candidate: { id: "1807543", query: "hospital", type: "photo",
      width: 5000, height: 3607,
      tags: "operación, sala de operaciones, cirugía, mesa de operaciones, hospital, healthcare, sala de emergencias, médico, cirujano, trabajadores del hospital, hospital, hospital, hospital, hospital, hospital" },
  }),
  row({
    id: "pos-protesta-manifestacion", concept: "protesta", expected: "hero",
    note: "Manifestacion real para el concepto protesta.",
    candidate: { id: "5963963", query: "protesta", type: "photo",
      width: 5616, height: 3744,
      tags: "mujeres, multitud, protesta, manifestantes, gente, protestando, choque de prendas, dhaka, bangladesh, trabajadoras, mujeres, mujeres, mujeres, mujeres, mujeres, protesta, protesta, protesta, bangladesh" },
  }),
  row({
    id: "pos-bicicleta-deporte", concept: "bicicleta", expected: "hero",
    note: "Bicicleta para el concepto bicicleta.",
    candidate: { id: "2677579", query: "bicicleta aislado", type: "photo",
      width: 7087, height: 2362,
      tags: "deportes, bicicleta, monociclo, sillín, pedales, neumático, aislado, ciclismo, multicolor, bicicleta, bicicleta, bicicleta, bicicleta, bicicleta, monociclo, monociclo, ciclismo, ciclismo, ciclismo" },
  }),
  row({
    id: "meta-tecnologia-camara", concept: "tecnologia", expected: "support",
    note: "El ejemplo del producto: camara para TECNOLOGIA es defendible como Support.",
    candidate: { id: "1362419", query: "tecnologia aislado", type: "photo",
      width: 4314, height: 2857,
      tags: "cámara, digital, fotografía, tecnología, clásico, fujfilm, foto, fotógrafo, dslr, aislado, cámara, cámara, cámara, cámara, cámara" },
  }),
  row({
    id: "meta-tecnologia-brazo-robotico", concept: "tecnologia", expected: "support",
    note: "Brazo robotico para TECNOLOGIA.",
    candidate: { id: "2658318", query: "tecnologia aislado", type: "photo",
      width: 2560, height: 1600,
      tags: "brazo robotico, mecánica, tecnología, industria, mecánicamente, desarrollo, aislado" },
  }),
  row({
    id: "meta-tecnologia-equipo", concept: "tecnologia", expected: "support",
    note: "Equipo electronico para TECNOLOGIA.",
    candidate: { id: "3251165", query: "tecnologia aislado", type: "photo",
      width: 5279, height: 3524,
      tags: "equipo, aislado, poder, zumbido, tecnología" },
  }),
  row({
    id: "meta-potencial-bombilla", concept: "potencial", expected: "support",
    note: "Bombilla etiquetada \"potencial\": metafora visual legitima.",
    candidate: { id: "4827304", query: "potencial aislado", type: "photo",
      width: 5472, height: 3648,
      tags: "bombilla, conocer, ocurrencia, potencial, capacitación, información, luz, concepto, electricidad, electrónica, símbolo, potencial, potencial, potencial, potencial, potencial" },
  }),
  row({
    id: "meta-crecimiento-bonsai", concept: "crecimiento", expected: "support",
    note: "Bonsai en la mano para CRECIMIENTO.",
    candidate: { id: "1868109", query: "crecimiento aislado", type: "photo",
      width: 5362, height: 3574,
      tags: "adulto, bonsai, naturaleza, mano, planta, retrato, sombra, silueta, árbol, retener, tenencia, crecimiento, monocromo, en blanco y negro, concepto, ocurrencia, aislado" },
  }),
  row({
    id: "meta-brote-gotas", concept: "brote", expected: "support",
    note: "Brote con gotas de agua para BROTE.",
    candidate: { id: "7351888", query: "brote aislado", type: "photo",
      width: 3827, height: 4196,
      tags: "gotas de agua, sale de, follaje, brote, naturaleza, aislado en negro" },
  }),
])

if (SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1.length !== 21)
  throw new Error('El corpus de calibracion debe permanecer congelado en 21 casos')

module.exports = { SEMANTIC_RELEVANCE_GATE_CALIBRATION_V1 }
