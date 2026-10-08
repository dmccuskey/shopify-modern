import type { LoadingRule } from './islands.js'

/**
 * What the runtime knows about each island it scheduled, for the island inspector (`@pelagojs/islands/inspector`).
 * Internal: shared by the runtime and the inspector, not exported from the package's main entry.
 */
export interface IslandRecord {
  el: HTMLElement
  name: string
  /** The loading rule it was scheduled with, after falling back to `eager` for an unknown one. */
  rule: LoadingRule
  /** `performance.now()` when it was scheduled. */
  scheduled: number
  /** When its loading rule fired and its component started loading. */
  triggered?: number
  /** When its component and adapter finished loading. */
  loaded?: number
  /** When its adapter finished mounting it. */
  mounted?: number
  /** The size of its data island in bytes, as read when it mounted. A data island inside the mount element is gone after that. */
  props?: number
  failed?: boolean
}

/**
 * Something the runtime did, for its readers: the island inspector, and the debug log (`@pelagojs/islands/debug`).
 * Internal, like the records. See ADR 008.
 */
export type RuntimeEvent = {
  area: 'islands'
  /** `performance.now()` when it happened. */
  time: number
} & (
  | {
      /** A pass over the page or a section scheduled islands, or met names it doesn't know. */
      type: 'found'
      root: ParentNode
      islands: IslandRecord[]
      /** The `data-island` names with no entry in the registry. */
      unknown: string[]
    }
  // loading: its loading rule fired. cancelled: unmounted before it mounted. unmounted: after.
  | { type: 'loading' | 'mounted' | 'cancelled' | 'unmounted'; island: IslandRecord }
  | { type: 'failed'; island: IslandRecord; error: unknown }
)

interface Shared {
  records: Map<HTMLElement, IslandRecord>
  events: RuntimeEvent[]
  listeners: Set<(event: RuntimeEvent) => void>
}

// One set of records per page, whatever the number of copies of this module: Vite's dev server can hand
// the runtime and the inspector a copy each, when it prebundles them in separate runs.
const key = Symbol.for('pelago.records')
const global = globalThis as { [key]?: Shared }
const shared: Shared = (global[key] ??= { records: new Map(), events: [], listeners: new Set() })

/** The scheduled and mounted islands. An island leaves when it's unmounted or cancelled. */
export const records = shared.records

const maxEvents = 200

/** The last events, oldest first, for a reader that starts after the runtime. */
export const events = shared.events

const listeners = shared.listeners

/** Calls `listener` with each event, which is also each change to `records`. Returns a function that stops it. */
export function onEvent(listener: (event: RuntimeEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emit(event: RuntimeEvent) {
  events.push(event)
  if (events.length > maxEvents) events.shift()
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      // a broken reader must not stop the islands
      console.error('[pelago] an event listener failed', error)
    }
  }
}
