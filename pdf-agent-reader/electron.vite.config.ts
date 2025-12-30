import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    entry: 'src/main/index.ts'
  },
  preload: {
    input: {
      index: resolve(__dirname, 'src/preload/index.ts')
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    },
    plugins: [react()]
  }
})
