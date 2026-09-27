import { vueAdapter } from '@shopify-modern/vue'
import HelloIsland from '../islands/HelloIsland.vue'

// A stand-in until the island loader exists: mounts every hello-island on the page.
for (const el of document.querySelectorAll<HTMLElement>('[data-island="hello-island"]')) {
  vueAdapter.mount(el, HelloIsland, { name: 'shopify-modern' })
}
