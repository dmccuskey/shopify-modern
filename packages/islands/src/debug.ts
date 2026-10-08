import { events, onEvent, type RuntimeEvent } from './records.js'

/** A part of the runtime with its own debug lines. */
export type DebugArea = RuntimeEvent['area']

export interface DebugOptions {
  /** The areas to log, or `'*'` for every area. Default: every area. */
  areas?: (DebugArea | '*')[]
}

const storageKey = 'pelago-debug'

/**
 * Starts the debug log: a `console.debug` line for each thing the runtime does, such as
 * `[pelago:islands] +151 ms cart-drawer: mounted in 37 ms`, with its data as an object.
 * For development only; `@pelagojs/vite-plugin` starts it in `vite dev`, with its `debug` option.
 * The `localStorage` key `pelago-debug` wins over `areas`: `*`, a list such as `islands,cart`, or `0` for none.
 * The browser hides the lines until "Verbose" is on in the console's levels. Returns a function that stops it.
 */
export function startDebug(options: DebugOptions = {}): () => void {
  const areas: string[] = stored() ?? options.areas ?? ['*']
  const all = areas.includes('*')
  const print = (event: RuntimeEvent) => {
    if (!all && !areas.includes(event.area)) return
    const line = describe(event)
    if (line) console.debug(`[pelago:${event.area}] +${ms(event.time)} ${line[0]}`, line[1])
  }
  // what happened before the log started
  for (const event of events) print(event)
  return onEvent(print)
}

/** The event's line and its data, or `undefined` for an event with no line. */
function describe(event: RuntimeEvent): [string, object] | undefined {
  if (event.type === 'found') {
    const { root, islands, unknown } = event
    const names = unknown.map((name) => `"${name}"`).join(', ')
    return [
      `found ${count(islands.length)}` + (names && `, and ${names} not in the registry`),
      { islands: islands.map(({ name, rule, el }) => ({ name, rule, el })), unknown, root },
    ]
  }
  const { el, name, rule, scheduled, triggered = 0, loaded = 0, mounted = 0, props } = event.island
  switch (event.type) {
    case 'loading': {
      const waited = triggered - scheduled
      return [
        `${name}: loading (${rule === 'eager' ? rule : `${rule}, waited ${ms(waited)}`})`,
        { rule, waited, el },
      ]
    }
    case 'mounted':
      return [
        `${name}: mounted in ${ms(mounted - triggered)}`,
        { load: loaded - triggered, mount: mounted - loaded, props, el },
      ]
    case 'cancelled':
      return [`${name}: cancelled before it mounted`, { rule, el }]
    case 'unmounted':
      return [`${name}: unmounted`, { el }]
    // failed: the runtime's own error is already in the console
  }
}

const count = (n: number) => `${n} island${n === 1 ? '' : 's'}`
const ms = (n: number) => `${Math.round(n)} ms`

/** The areas in `localStorage`, or `undefined` if the key isn't set. */
function stored(): string[] | undefined {
  try {
    const value = localStorage.getItem(storageKey)?.trim()
    return value ? value.split(',').map((area) => area.trim()) : undefined
  } catch {
    // storage blocked: the options decide
    return undefined
  }
}
