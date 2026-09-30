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
        // The preload is emitted as CommonJS with a `.cjs` extension on
        // purpose. A *sandboxed* preload is run as plain JavaScript with no ESM
        // context — Electron's own docs are explicit that "sandboxed preload
        // scripts can't use ESM imports". Since this package is
        // `"type": "module"`, a bare `.js` would be parsed as ESM anyway, hence
        // `.cjs`. Staying ESM here would force `sandbox: false` in `window.ts`
        // and give up renderer sandboxing for no benefit.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
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
