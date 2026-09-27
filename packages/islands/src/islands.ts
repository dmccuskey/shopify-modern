import { readProps } from './props.js'

/**
 * Mounts a component on an element. Each framework adapter implements this.
 * Returns a function that unmounts the component.
 */
export interface Adapter {
  mount(el: HTMLElement, component: unknown, props: object): () => void
}

/** How to load one island: a lazy import of its component, and the adapter that mounts it. */
export interface IslandEntry {
  load: () => Promise<{ default: unknown }>
  /** The adapter, or a lazy import of it, so a framework loads only on pages with its islands. */
  adapter: Adapter | (() => Promise<Adapter>)
}

/** Island names, as used in `data-island="…"`, mapped to their entries. */
export type IslandRegistry = Record<string, IslandEntry>

/** When an island mounts, set with `data-island-load`. */
export type LoadingRule = 'eager' | 'visible' | 'idle' | 'interaction'

/** The running island loader, returned by `startIslands`. */
export interface Islands {
  /** Schedules every island in `root` (including `root` itself) that isn't already scheduled or mounted. */
  mountIslands(root?: ParentNode): void
  /** Unmounts every island in `root` (including `root` itself), and cancels those not mounted yet. */
  unmountIslands(root?: ParentNode): void
  /** Unmounts every island and stops listening to the theme editor. */
  stop(): void
}

const loadingRules: readonly string[] = ['eager', 'visible', 'idle', 'interaction']
const interactionEvents = ['pointerenter', 'focusin', 'click'] as const

/**
 * Starts the island loader: mounts the islands on the page by their loading rules,
 * and remounts them when the theme editor loads or unloads a section.
 */
export function startIslands(registry: IslandRegistry): Islands {
  // each scheduled or mounted island, with the function that cancels or unmounts it
  const islands = new Map<HTMLElement, () => void>()

  function schedule(el: HTMLElement) {
    const name = el.dataset.island
    if (!name || islands.has(el)) return
    const entry = registry[name]
    if (!entry) return

    let unmount: (() => void) | undefined
    let cancel = () => {}
    const dispose = () => {
      cancel()
      unmount?.()
      islands.delete(el)
    }
    islands.set(el, dispose)

    const mount = async () => {
      try {
        const [{ default: component }, adapter] = await Promise.all([
          entry.load(),
          typeof entry.adapter === 'function' ? entry.adapter() : entry.adapter,
        ])
        // unmounted or remounted while loading
        if (islands.get(el) !== dispose) return
        const id = el.dataset.islandId
        const props = (id ? readProps<object>(id) : null) ?? {}
        unmount = adapter.mount(el, component, props)
      } catch (error) {
        if (islands.get(el) === dispose) islands.delete(el)
        console.error(`[shopify-modern] island "${name}" failed to mount`, error)
      }
    }
    cancel = whenReady(el, mount)
  }

  function mountIslands(root: ParentNode = document) {
    for (const el of findIslands(root)) schedule(el)
  }

  function unmountIslands(root: ParentNode = document) {
    for (const [el, dispose] of islands) {
      if (root === el || root.contains(el)) dispose()
    }
  }

  const onSectionLoad = (event: Event) => {
    if (event.target instanceof HTMLElement) mountIslands(event.target)
  }
  const onSectionUnload = (event: Event) => {
    if (event.target instanceof HTMLElement) unmountIslands(event.target)
  }
  document.addEventListener('shopify:section:load', onSectionLoad)
  document.addEventListener('shopify:section:unload', onSectionUnload)

  const onReady = () => mountIslands()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true })
  } else {
    onReady()
  }

  return {
    mountIslands,
    unmountIslands,
    stop() {
      document.removeEventListener('DOMContentLoaded', onReady)
      document.removeEventListener('shopify:section:load', onSectionLoad)
      document.removeEventListener('shopify:section:unload', onSectionUnload)
      unmountIslands()
    },
  }
}

function findIslands(root: ParentNode): HTMLElement[] {
  const found = [...root.querySelectorAll<HTMLElement>('[data-island]')]
  if (root instanceof HTMLElement && root.matches('[data-island]')) found.unshift(root)
  return found
}

/** Calls `mount` when the island's loading rule says so. Returns a function that cancels it. */
function whenReady(el: HTMLElement, mount: () => void): () => void {
  const rule = el.dataset.islandLoad || 'eager'
  if (!loadingRules.includes(rule)) {
    console.warn(`[shopify-modern] unknown data-island-load "${rule}", loading eagerly`)
  }

  switch (rule as LoadingRule) {
    case 'visible': {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          mount()
        }
      })
      observer.observe(el)
      return () => observer.disconnect()
    }
    case 'idle': {
      // Safari has no requestIdleCallback
      if ('requestIdleCallback' in window) {
        const handle = requestIdleCallback(mount)
        return () => cancelIdleCallback(handle)
      }
      const handle = setTimeout(mount, 200)
      return () => clearTimeout(handle)
    }
    case 'interaction': {
      const remove = () => {
        for (const type of interactionEvents) el.removeEventListener(type, onInteraction)
      }
      const onInteraction = () => {
        remove()
        mount()
      }
      for (const type of interactionEvents) el.addEventListener(type, onInteraction)
      return remove
    }
    default:
      mount()
      return () => {}
  }
}
