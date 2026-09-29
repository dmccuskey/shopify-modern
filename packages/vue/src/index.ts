import { createApp, type Component } from 'vue'
import type { Adapter } from '@shopify-modern/islands'

export { useStore } from '@nanostores/vue'
export { useCart, useCartOpen, useCustomer, useLocale } from './stores.js'

export const vueAdapter: Adapter = {
  mount(el, component, props) {
    const app = createApp(component as Component, props as Record<string, unknown>)
    app.mount(el)
    return () => app.unmount()
  },
}
