import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  root: path.join(__dirname, 'src/renderer'),
  publicDir: path.join(__dirname, 'public'),
  server: {
    watch: {
      ignored: ['**/project-state.json']
    }
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
      },
    },
  }
})
