import { readProps } from './props.js'
import { records, recordsChanged, type IslandRecord } from './records.js'

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

    const rule = loadingRule(el)
    const record: IslandRecord = { el, name, rule, scheduled: performance.now() }
    let unmount: (() => void) | undefined
    let cancel = () => {}
    const dispose = () => {
      cancel()
      unmount?.()
      islands.delete(el)
      if (records.get(el) === record) {
        records.delete(el)
        recordsChanged()
      }
    }
    islands.set(el, dispose)
    records.set(el, record)
    recordsChanged()

    const mount = async () => {
      record.triggered = performance.now()
      recordsChanged()
      try {
        const [{ default: component }, adapter] = await Promise.all([
          entry.load(),
          typeof entry.adapter === 'function' ? entry.adapter() : entry.adapter,
        ])
        // unmounted or remounted while loading
        if (islands.get(el) !== dispose) return
        record.loaded = performance.now()
        const id = el.dataset.islandId
        const props = (id ? readProps<object>(id) : null) ?? {}
        unmount = adapter.mount(el, component, props)
        record.mounted = performance.now()
        measure(record)
        recordsChanged()
      } catch (error) {
        if (islands.get(el) === dispose) islands.delete(el)
        record.failed = true
        recordsChanged()
        console.error(`[pelago] island "${name}" failed to mount`, error)
      }
    }
    cancel = whenReady(el, rule, mount)
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

/** The island's loading rule, from `data-island-load`: `eager` if it has none, or one that isn't known. */
function loadingRule(el: HTMLElement): LoadingRule {
  const rule = el.dataset.islandLoad || 'eager'
  if (loadingRules.includes(rule)) return rule as LoadingRule
  console.warn(`[pelago] unknown data-island-load "${rule}", loading eagerly`)
  return 'eager'
}

/** Shows the island's load and mount in the browser's performance timeline (DevTools' Performance panel). */
function measure({ name, triggered, loaded, mounted }: IslandRecord) {
  try {
    performance.measure(`[pelago] ${name}`, {
      start: triggered,
      end: mounted,
      detail: { island: name, load: loaded! - triggered!, mount: mounted! - loaded! },
    })
  } catch {
    // performance.measure with options is missing in old browsers
  }
}

/** Calls `mount` when the island's loading rule says so. Returns a function that cancels it. */
function whenReady(el: HTMLElement, rule: LoadingRule, mount: () => void): () => void {
  switch (rule) {
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
