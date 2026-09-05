# Coste M7 con una escena real

No es parte de `npm test`: separa coste y correccion. Importa
`renderGraphicClip`, `direccionDe`, `semillaDe` y los contadores del bundle
compilado. Comprueba el DOM despues de cada clip para rechazar un respaldo.

## Ejecutar

Desde un repositorio compilado:

```powershell
npx electron tests/rendimiento/escena-m7.cjs . C:\graphify\m7-otra-tirada
```

Los argumentos son repositorio compilado y carpeta de salida. Sin argumentos
usa este repositorio y una carpeta temporal nueva. Elegir siempre una carpeta
de salida nueva: no sobrescribir la evidencia versionada.
Electron crea un perfil y proyecto aislados en temporal, bloquea fetch y HTTP(S)
y conserva los seis MP4 alli para inspeccion; no genera guion, voz, stock ni IA.
El PNG y resultado.json quedan en la carpeta de salida.

Seis clips iguales de 3 s, 90 frames, 1080x1920, sistema voltaje; la palabra,
conceptos y resto de graphicData exactos estan en el arnes y en el JSON.
Solo `extra.pos` cambia para impedir aciertos de cache sin cambiar el dibujo.
Usa una ventana reutilizada, como el lote real. Los tres primeros clips se
informan separados de los tres ultimos; no se promete que tres muestras basten
para establecer un equilibrio termico de la maquina.

Exit 0: todas las muestras cumplen 1,30 intentos/frame. Exit 2: M7 incumplido.
Exit 1: fallo del arnes/render. Exit 124: watchdog de 120 s.
No cambia ni el lazo ni MAX_INTENTOS_FRAME ni la suite de correccion.
Los PNG no son una comparacion de reproducibilidad; son evidencia visual del
contenido medido, capturada despues del intervalo cronometrado.

## A.0: verificacion anterior a la medicion (04/09/2026)

Clon nuevo: C:\graphify\cipher-plan-a0-verificacion-20260904.
No existia node_modules en C:\graphify ni C:\. La verificacion anterior del
lote usaba un worktree: se repitio con git clone --no-hardlinks y npm ci.
Commit 84062d76c5b878c8a7766ea4c17e16b9dcd461e3; arbol
e69d531789d0d9ca73a220a8b78626df556de632.
npm ci: 0; npx tsc -p tsconfig.json: 0; npm run build: 0, tres pasos.
npm test: 9/9, exit 0 en la primera tirada, sin crash de exclusion.
Aviso de npm ci: 20 vulnerabilidades (2 moderadas, 17 altas, 1 critica);
no se aplico audit fix ni se cambio el lockfile.

Artefactos del build, comprobados en disco (bytes):

```text
dist/grafico.html                                750
dist/index.html                                  613
dist/assets/AnimatedGraphic-1ksd6rq0.js         246973
dist/assets/AnimatedGraphic-CqO20Z1i.css        104084
dist/assets/grafico-DRWFk0YK.js                   2404
dist/assets/principal-BCSCZARv.js              219090
dist/fonts/anton-400.woff2                      18612
dist/fonts/archivo-var.woff2                    34928
dist/fonts/outfit-var.woff2                     32292
dist-electron/main/index.js                   374314
dist-electron/main/index.js.map               841546
dist-electron/preload/index.js                  4981
dist-electron/preload/index.js.map              8512
```

Cero banco-*.js. Merge --no-ff A.0: d0dae0dbcd95f9cbcc372c2917bee1f3c8b1b382;
su arbol coincide exactamente con el verificado. La deuda pendiente se conservo
sin alterar y se commiteo aparte en plan-A-cajas (366b6bb).

El plan aplicado es 1PLAN COMPLETO  Cipher.txt, SHA256
AD3B0D85D0AE85B49C05C05C976CB81F9F2A73A1AD28A7FE4FF1CCF5C4F53472.
La Fase A no se declara cerrada: la medicion posterior incumplio T6/M7.
Datos y PNG: ../aceptacion/plan-a0-m7-20260904/.
