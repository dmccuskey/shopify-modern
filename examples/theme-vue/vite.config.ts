import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import shopify from 'vite-plugin-shopify'
import shopifyModern from '@shopify-modern/vite-plugin'

export default defineConfig({
  plugins: [shopify({ sourceCodeDir: 'src' }), vue(), shopifyModern()],
  build: {
    // the output folder is the theme's assets/, which holds the theme's own files too
    emptyOutDir: false,
    rollupOptions: {
      // prefix the generated files so they can be gitignored
      output: {
        entryFileNames: 'vite-[name]-[hash].js',
        chunkFileNames: 'vite-[name]-[hash].js',
        assetFileNames: 'vite-[name]-[hash][extname]',
      },
    },
  },
})
