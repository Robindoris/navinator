import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': r('src/shared') }
    },
    build: {
      outDir: 'out/main',
      rollupOptions: { input: { index: r('src/main/index.ts') } }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': r('src/shared') }
    },
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: r('src/preload/index.ts') },
        // ESM preload (`.mjs`) is the only format that works with a
        // `"type": "module"` package — `.js` would be treated as ESM and
        // break the `require` calls inside the CJS bundle.
        output: { format: 'es', entryFileNames: '[name].mjs' }
      }
    }
  },
  renderer: {
    root: r('src/renderer'),
    // Packaged renderer is loaded from file://, so all asset URLs must be relative.
    base: './',
    resolve: {
      alias: {
        '@': r('src/renderer/src'),
        '@shared': r('src/shared')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      outDir: r('out/renderer'),
      rollupOptions: { input: { index: r('src/renderer/index.html') } }
    }
  }
})
