# A.2: impacto real y precondicion de A.3

No es una prueba de las «828 cajas»: esa muestra no esta identificada. El commit
`10000a980d6f89431eb1141d3ac262622744fe80` dice «828 palabras reales», sobre
`mapa`, y da 509/847 cajas fuera de zona para etiquetas medias/largas. No son
828 cajas de `escena`. El commit versiona cuatro ficheros, ninguno con ese corpus;
`tests/mapa.js` usa semillas sinteticas. No se inventa un fixture sustituto.

Este arnes importa las funciones de los bundles; no copia anchoCaja, la puerta
ni el recorte. No renderiza ni abre la app. Cada bundle se importa en un proceso
Electron separado, con perfil/cwd temporal y fetch bloqueado, antes de app.ready.
Importarlos juntos fallo por registro IPC duplicado; no produjo una medicion.

## Repetir

En el repo A.2 compilado, indicando un checkout **compilado** de `84062d7` como base:

```powershell
node node_modules/electron/cli.js tests/aceptacion/impacto-cota-a2.cjs . C:/ruta/base-compilada tests/aceptacion/plan-a2-impacto-20260905/etiquetas.json C:/ruta-temporal/impacto.json
```

La base usada fue `C:/graphify/cipher-plan-a0-verificacion-20260904`, HEAD
`84062d7`; su anchoCaja/puerta no cambiaron hasta A.1. La diferencia de energia
de deriva no participa en esta medicion. Los SHA-256 de ambos bundles quedan
en `resultados.json`; la rama medida fue `ea741c3`, antes de subir tamano alguno.

El fixture congela solo las lineas de conceptos y resumen de la generacion de
03/09/2026 02:37:47.705–02:43:02.489 UTC. Para volver a extraer ESA generacion:

```powershell
node tests/aceptacion/impacto-cota-a2.cjs --extraer generation-debug.log C:/ruta-temporal/etiquetas.json
```

El SHA-256 del fixture describe los bytes del checkout: LF y CRLF dan hashes
distintos. La primera repeticion detecto esa diferencia tras git apply; se
comprobo igualdad del JSON y de todas las mediciones y se registro el hash CRLF.

Se registran SHA-256 del log y numeros de linea. El log publica la etiqueta
con `slice(0,24)`; si alguna tiene 24 caracteres el arnes FALLA por censura,
no concluye que originalmente media 24. En esta muestra ninguna llega al corte.
Los 107 sub-clips con conceptos son un **superconjunto**, no 107 Visuales.
Ninguna etiqueta rechazada en el conjunto implica ninguna rechazada por A.2 en
los Visuales de ese conjunto; no permite estimar otras generaciones.

La foto preexistente examinada es `plan-a2-20260905/limite-24-arrobas.png`:
1080x1920, t=2.999 s/ciclo 3 s, memoria, ondas/constelacion/quieto/media/regular/
archivo, sistema voltaje. Se cruzan sus centros DOM registrados con los intervalos
de la cota. Se llama a acotarPuntos por ambos extremos para comprobar el recorte
real. Es diagnostico del x=50, no nueva prueba de completitud ni de separacion.

Este arnes A.2 no mide +20/+35/+50 ni modifica produccion.
~~A.3 queda pendiente de resolver la poblacion historica.~~ Retirada por decision
explicita del 05/09/2026: no se busca mas. Procedencia historica: mensaje de
10000a9, palabras de mapa. La nueva base A.3 es la de 321 etiquetas versionada
en 4c3c060, no las 828; reproduccion y condiciones en README-a3.md.
