# Spike de hero asset — entrada manual requerida

Este directorio prepara la comparación visual de seis celdas del renderer real
`visual_escena`; no es un almacén de assets ni un importador.

Para ejecutar el spike faltan estos archivos manuales, descargados por el usuario:

- `openmoji-food-sweet.svg` o `openmoji-food-sweet.png`, desde
  <https://openmoji.org/library/#group=food-drink%2Ffood-sweet> (CC-BY-SA-4.0).
- `bypeople-person.png`, un recorte de persona descargado oficialmente desde ByPeople.
- `bypeople-object.png`, un recorte de objeto descargado oficialmente desde ByPeople.

No se automatiza ByPeople, no se usa login ni scraping y no se redistribuye material
de ByPeople sin su permiso contractual. Cuando existan los tres archivos, el spike
los colocará mediante la ranura `heroe` ya declarada por la estructura; su SHA-256
viajará en `extra.hero` para que nunca haya mismo hash con píxeles distintos.
