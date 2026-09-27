import { startIslands } from '@shopify-modern/islands'
import { vueAdapter } from '@shopify-modern/vue'

// The island registry. The Vite plugin will generate this from src/islands/.
startIslands({
  'hello-island': { load: () => import('../islands/HelloIsland.vue'), adapter: vueAdapter },
})
