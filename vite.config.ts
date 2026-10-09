import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import fs from 'node:fs'

export default defineConfig(({ mode }) => {
  return {
    root: path.join(__dirname, 'src/renderer'),
    publicDir: path.join(__dirname, 'public'),
    server: {
      watch: {
        ignored: ['**/project-state.json']
      },
    },
    plugins: [
      react(),
      electron([
      {
        entry: path.join(__dirname, 'src/main/index.ts'),
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/main'),
            minify: false,
            sourcemap: true,
          },
          plugins: [{
            name: 'copy-cipher-animation-tools-runtime',
            closeBundle() {
              const sourceDir = path.join(__dirname, 'src/main/animation')
              const targetDir = path.join(__dirname, 'dist-electron/main/animation')
              fs.mkdirSync(targetDir, { recursive: true })
              for (const file of ['cipher-animation-tools-server.cjs', 'scene-module-contract.cjs', 'scene-template-source-edits.cjs', 'contract-v1.cjs'])
                fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file))
              const serviceSourceDir = path.join(__dirname, 'src/main/services')
              const serviceTargetDir = path.join(__dirname, 'dist-electron/main')
              fs.copyFileSync(path.join(serviceSourceDir, 'animation-style-library.cjs'),
                path.join(serviceTargetDir, 'animation-style-library.cjs'))
            },
          }],
        },
      },
      {
        entry: path.join(__dirname, 'src/preload/index.ts'),
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron/preload'),
            minify: false,
            sourcemap: true,
          },
        },
      },
      ]),
      renderer(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer/src'),
      },
    },
    build: {
      outDir: path.join(__dirname, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        // Al declarar input explicito Vite deja de detectar index.html solo: hay que
        // listar los DOS o la app se queda sin punto de entrada.
        input: {
          principal: path.join(__dirname, 'src/renderer/index.html'),
          grafico: path.join(__dirname, 'src/renderer/grafico.html'),
          controlAdapter: path.join(__dirname, 'src/renderer/control-adapter.html'),
        },
      },
    },
  }
})
