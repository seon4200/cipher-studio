# D-Final production retrieval acceptance

Artefactos generados exclusivamente en un proyecto temporal marcado `.cipher-test-fixture`:

- `production-retrieval-final.mp4`: siete escenas recorridas por el pipeline productivo;
- `production-retrieval-final.png`: frames medios etiquetados para revisión humana;
- `evidence.json`: decisiones, slots, providers, tratamientos, QC e identidades;
- `pixabay-live-probe.json`: sonda acotada y sanitizada del adapter real.

La aceptación no construye SceneSpecs ni publica assets manualmente. Una respuesta Pixabay inyectada y validada permite ejercer el pipeline sin depender de la red durante render. `visualVerdict` queda pendiente de revisión humana.
