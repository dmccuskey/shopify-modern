import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import shopify from 'vite-plugin-shopify'
import pelago from '@pelagojs/vite-plugin'

export default defineConfig({
  plugins: [shopify({ sourceCodeDir: 'src' }), vue(), pelago()],
})
