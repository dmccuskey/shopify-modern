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
  failed?: boolean
}

/** The scheduled and mounted islands. An island leaves when it's unmounted or cancelled. */
export const records = new Map<HTMLElement, IslandRecord>()

const listeners = new Set<() => void>()

/** Calls `listener` after each change to `records`. Returns a function that stops it. */
export function onRecordsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function recordsChanged() {
  for (const listener of listeners) listener()
}
