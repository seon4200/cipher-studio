/*
 * FROZEN HOLDOUT — Semantic Asset Relevance Gate V1.
 *
 * Conceptos DISTINTOS a los del corpus de calibracion, capturados por separado y congelados
 * ANTES de la primera ejecucion final del gate.
 *
 * REGLA: despues de observar este holdout NO se tocan umbrales, reglas, lexicon ni scoring.
 * Si lo hicieramos dejaria de ser un holdout y pasaria a ser un segundo set de calibracion.
 *
 * Los tags salen de consultas de solo lectura a la API publica de Pixabay, con las mismas
 * queries que construye buildPixabayImageSearchPlansV1.
 */
function row (value) {
  return Object.freeze({ ...value, candidate: Object.freeze({ ...value.candidate }) })
}

const SEMANTIC_RELEVANCE_GATE_HOLDOUT_V1 = Object.freeze([
  row({
    id: "hold-abeja-flor", concept: "abeja", expected: "hero",
    note: "Abeja sobre flor; el sujeto encabeza la lista.",
    candidate: { id: "1502283", query: "abeja aislado", type: "photo",
      width: 3431, height: 1929,
      tags: "abeja, miel de abeja, abeja en flor amarilla, abeja y flor, abeja en flor aislado, insecto, polinización, cerrar" },
  }),
  row({
    id: "hold-abeja-avispon", concept: "abeja", expected: "support",
    note: "Avispon/abeja en arbol: el sujeto no encabeza pero esta presente.",
    candidate: { id: "8457976", query: "abeja aislado", type: "photo",
      width: 6720, height: 4480,
      tags: "árbol, avispón, abeja, aislado, caza, parásito, escarabajo, naturaleza, insecto, fauna silvestre, exterior" },
  }),
  row({
    id: "hold-ambulancia-vendedor", concept: "ambulancia", expected: "reject",
    note: "Falso amigo: \"vendedor ambulante\" en un mercado de Marruecos.",
    candidate: { id: "123965", query: "ambulancia aislado", type: "photo",
      width: 3008, height: 2000,
      tags: "marruecos, áfrica, desierto, marroc, arena, paisaje, naturaleza, vendedor ambulante, poblado, mercado, vendedor, la venta ambulante, gente, mujeres, pobreza, pueblo, soledad, solitud, aislado, aislados, ambulante, venta" },
  }),
  row({
    id: "hold-ambulancia-historica", concept: "ambulancia", expected: "support",
    note: "Ambulancia historica de caballos: relacionada, no literal.",
    candidate: { id: "3600613", query: "ambulancia aislado", type: "photo",
      width: 3504, height: 2956,
      tags: "historia, vehículos históricos, transporte de pacientes, histórico de la ambulancia, ambulancia, lugares de interés, suelo de madera carroza, carruaje tirado por caballos, carro de madera, transporte, aislado" },
  }),
  row({
    id: "hold-barco-velero", concept: "barco", expected: "hero",
    note: "Velero decorativo para el concepto barco.",
    candidate: { id: "1330746", query: "barco aislado", type: "photo",
      width: 2296, height: 3264,
      tags: "barco, decoración, velero, aislado, blanco, azul, lienzo, madera, barco, barco, barco, barco, barco, velero, lienzo" },
  }),
  row({
    id: "hold-barco-grua", concept: "barco", expected: "support",
    note: "Grua portuaria de barco: contexto defendible como Support.",
    candidate: { id: "2648672", query: "barco aislado", type: "photo",
      width: 3963, height: 3456,
      tags: "grua, grúa portuaria, grua de barco, izar, viejo, transmisión, engranajes, aislado" },
  }),
  row({
    id: "hold-bastante-puente", concept: "bastante", expected: "reject",
    note: "Concepto basura: adverbio del transcript.",
    candidate: { id: "4457345", query: "bastante aislado", type: "photo",
      width: 4256, height: 2832,
      tags: "puente, bastante, calma, tranquilo, aislado, escondite, agua, lago, río, estado animico, el verano, exterior, tranquilidad, misterio" },
  }),
  row({
    id: "hold-costumbre-pantalones", concept: "costumbre", expected: "support",
    note: "Traje tradicional para COSTUMBRE.",
    candidate: { id: "2903226", query: "costumbre aislado", type: "photo",
      width: 1967, height: 1967,
      tags: "pantalones de cuero, disfraz, ropa, tradicion, costumbres regionales, bávaro, baviera, cuero, pantalones, asterisco, costura, bordado, aislado, cortar" },
  }),
  row({
    id: "hold-equilibrio-piedras", concept: "equilibrio", expected: "hero",
    note: "Piedras apiladas para EQUILIBRIO; el concepto encabeza.",
    candidate: { id: "242223", query: "equilibrio aislado", type: "photo",
      width: 2736, height: 3648,
      tags: "equilibrio, balance, meditación, piedras, torre, apilados, aislado, relajarse, relajación, bienestar" },
  }),
  row({
    id: "hold-guitarra-acustica", concept: "guitarra", expected: "hero",
    note: "Guitarra acustica para el concepto guitarra.",
    candidate: { id: "2119", query: "guitarra aislado", type: "photo",
      width: 4284, height: 2856,
      tags: "guitarra, acústico, instrumento, instrumento musical, guitarra acustica, de madera de la guitarra, clásico, guitarrista, aislado, melodía, musical, instrumentos de cuerda, música, instrumento de cuerda, guitarra, guitarra, guitarra, guitarra, guitarra" },
  }),
  row({
    id: "hold-justicia-balanza", concept: "justicia", expected: "support",
    note: "Balanza y subasta para JUSTICIA.",
    candidate: { id: "2532037", query: "justicia aislado", type: "photo",
      width: 2700, height: 1573,
      tags: "aislado, subasta, plato, párrafos, ley, jurisdicción, subastador, justicia, subasta, justicia, justicia, justicia, justicia, justicia" },
  }),
  row({
    id: "hold-llave-inglesa", concept: "llave", expected: "hero",
    note: "Llave inglesa para el concepto llave.",
    candidate: { id: "789887", query: "llave aislado", type: "photo",
      width: 3648, height: 2736,
      tags: "llave inglesa, herramienta, llave francesa, clave, metal, equipo, trabajo, reparar, cromo, mecánico, taller, aislado, fondo blanco, mantenimiento, arreglar, llave inglesa, llave inglesa, llave inglesa, llave inglesa, llave inglesa, llave francesa" },
  }),
  row({
    id: "hold-memoria-usb", concept: "memoria", expected: "hero",
    note: "Memoria flash para el concepto memoria.",
    candidate: { id: "1306886", query: "memoria aislado", type: "photo",
      width: 4608, height: 3072,
      tags: "memoria flash, memoria usb, tarjeta de memoria, altas tecnologías, electrónica, ordenadores, accesorios de computador, equipo de fotógrafo, macro, aislado, medios modernos, memoria blanca, memoria usb, memoria usb, memoria usb, memoria usb, memoria usb" },
  }),
  row({
    id: "hold-mercado-modelo3d", concept: "mercado", expected: "reject",
    note: "Modelo 3d generico de stock.",
    candidate: { id: "1834122", query: "mercado aislado", type: "photo",
      width: 8000, height: 8000,
      tags: "hombre blanco, modelo 3d, aislado, 3d, modelo, todo el cuerpo, blanco, mercado, vendedor, venta, manzanas, puesto en el mercado, ladrones, fueron, servicios, vendedor, vendedor, vendedor, vendedor, vendedor, venta" },
  }),
  row({
    id: "hold-montana-pajaro", concept: "montana", expected: "support",
    note: "Kea en paisaje montanoso: montana presente pero no es el sujeto.",
    candidate: { id: "10324879", query: "montana aislado", type: "photo",
      width: 6252, height: 3702,
      tags: "pájaro, montaña, kea, paisaje montañoso, nieve, volador, cielo, gris, desierto, paisaje natural, invierno, nueva zelanda, gran altitud, vida silvestre, frío, panorama, naturaleza, niebla, libertad" },
  }),
  row({
    id: "hold-paraguas-animal", concept: "paraguas", expected: "reject",
    note: "Animal domestico sin relacion con paraguas.",
    candidate: { id: "1238983", query: "paraguas aislado", type: "photo",
      width: 2764, height: 2148,
      tags: "animal, atractivo, hermosa, brown, queso, cerrar, conceptual, criatura, bicho, linda, doméstico, orejas, ojos, rostro, mujer, comida, divertido, pelo, peludo, jerbo, niña, precioso, hámster, saludable, aislado, cocina, encantador, macro, ratones, ratón, nariz, parásito, mascota, bonita, rata, relajarse, roedor, pequeño, el verano, cola, sombrilla, arriba, alimañas, bigotes, blanco, joven, azul de la cocina, azul divertido, azul saludable, azul mascotas, paraguas azul" },
  }),
  row({
    id: "hold-puente-fulda", concept: "puente", expected: "hero",
    note: "Puente de acero para el concepto puente.",
    candidate: { id: "2527577", query: "puente aislado", type: "photo",
      width: 5184, height: 3456,
      tags: "puente, fulda, construcción de acero, planchar, la carretera, puente de arco, remachados, aislado, puente, puente, puente, puente, puente" },
  }),
  row({
    id: "hold-resulta-calculadora", concept: "resulta", expected: "reject",
    note: "Concepto basura: forma verbal del transcript.",
    candidate: { id: "2825179", query: "resulta aislado", type: "photo",
      width: 6000, height: 4000,
      tags: "maquina calculadora, resulta, viejo, antiguo, vieja maquina de calcular, resultado 7" },
  }),
  row({
    id: "hold-silencio-lago", concept: "silencio", expected: "reject",
    note: "Lago de montana sin evidencia alguna de silencio.",
    candidate: { id: "4487292", query: "silencio aislado", type: "photo",
      width: 5950, height: 3974,
      tags: "mountain lake, agua, cabaña, niebla, piedras, místico, naturaleza, lago, paisaje, reflexión, cabaña, cabaña, cabaña, cabaña, cabaña" },
  }),
  row({
    id: "hold-telescopio-mirador", concept: "telescopio", expected: "hero",
    note: "Telescopio de mirador para el concepto telescopio.",
    candidate: { id: "2731792", query: "telescopio aislado", type: "photo",
      width: 2408, height: 1607,
      tags: "punto de vista, telescopio, prismáticos, mirador, telescopio de monedas, visión distante, panorama, previsión, reloj, extensión, distancia, óptica, aislado, cortar" },
  }),
])

if (SEMANTIC_RELEVANCE_GATE_HOLDOUT_V1.length !== 20)
  throw new Error('El holdout debe permanecer congelado en 20 casos')

module.exports = { SEMANTIC_RELEVANCE_GATE_HOLDOUT_V1 }
