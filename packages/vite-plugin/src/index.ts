import type { Plugin } from 'vite'

/** The shopify-modern Vite plugin. The island registry and snippet generation come later. */
export default function shopifyModern(): Plugin {
  return { name: 'shopify-modern' }
}
