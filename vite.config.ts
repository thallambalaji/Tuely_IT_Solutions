import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

// For ESM, we need to define __dirname manually
const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        services: resolve(__dirname, 'services.html'),
        careers: resolve(__dirname, 'careers.html'),
        contact: resolve(__dirname, 'contact.html'),
      },
    },
  },
})
