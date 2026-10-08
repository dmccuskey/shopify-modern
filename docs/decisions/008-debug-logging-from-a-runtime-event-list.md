# ADR 008: Debug Logging from a Runtime Event List

**Status:** Accepted

## Context

A developer learning the code, or working out why an island didn't mount, has little to go on. The runtime prints a warning for an unknown loading rule and an error when a mount fails, and nothing else. The island inspector shows where each island stands now, but not what happened or in what order: that a section reload unmounted two islands and mounted two new ones, or that an island waited four seconds for `visible`.

The constraints:

- **Size.** The runtime's entry is a few kilobytes and runs on every page of a store. Logging libraries such as winston are built for Node (files, transports) and are many times that size.
- **Nothing in builds.** Lines meant for a developer must not reach a store's customers, in the console or in the bundle.
- **The reader arrives late.** Development tools are loaded with a dynamic `import()` after the islands start, as the inspector is, so they don't delay the page. By then the runtime has already found the islands and started the eager ones.
- **More than one reader.** The inspector already reads the runtime's island records and is told when they change (`onRecordsChange`). An event log in the inspector is a planned idea, and would need the same events as the console.

The browser console already has what a logger would add: levels (`console.debug` is hidden until "Verbose" is turned on), filtering by text, and objects that expand.

## Decision

The runtime keeps a list of events, and debug logging is a development-only module that prints them.

### The Event List

`records.ts` gains the list next to the island records, in the same object on `globalThis` (`Symbol.for('pelago.records')`), so every copy of the module shares it:

```ts
interface RuntimeEvent {
  area: 'islands' // later also 'editor', 'cart', 'stores', 'i18n'
  type: string
  /** `performance.now()` when it happened. */
  time: number
}

export const events: RuntimeEvent[]
export function emit(event: RuntimeEvent): void
export function onEvent(listener: (event: RuntimeEvent) => void): () => void
```

- `emit` adds the event to `events` and calls each listener with it.
- `events` holds the last 200 events; older ones are dropped. A reader that starts late prints the list first, then listens.
- `onEvent` replaces `onRecordsChange`, and `emit` replaces `recordsChanged`: every change to an island record is one of the events below. The inspector listens with `onEvent` and redraws as before.
- A listener that throws doesn't stop the runtime: `emit` catches the error and reports it with `console.error`.

The list is internal, like the records: it isn't exported from the package's main entry, and its shape can change in any release.

### The `islands` Events

| type | when | data |
|---|---|---|
| `found` | a pass over the page or a section scheduled islands, or met names it doesn't know | `root`, `islands` (the records scheduled), `unknown` (the `data-island` names with no entry in the registry) |
| `loading` | an island's loading rule fired and its component started loading | `island` (its record) |
| `mounted` | its adapter finished mounting it | `island` |
| `failed` | loading or mounting threw | `island`, `error` |
| `cancelled` | it was unmounted before it mounted (still waiting or loading) | `island` |
| `unmounted` | it was unmounted after it mounted | `island` |

`found` is emitted after the records are in place and before any of its islands starts loading, so the lines read in order. A pass that finds nothing new emits nothing.

The times and the props size stay on the record, as now. The warning for an unknown loading rule and the error for a failed mount stay as they are, always on, in builds too.

### The Console Reader

A new entry, `@pelagojs/islands/debug`, exports `startDebug(options?: { areas?: (DebugArea | '*')[] }): () => void`. It prints the events already in the list, then each new one, through `console.debug`, with the data as a second argument to expand:

```text
[pelago:islands] +112 ms found 3 islands {islands: Array(3), unknown: Array(0)}
[pelago:islands] +113 ms cart-drawer: loading (eager) {…}
[pelago:islands] +151 ms cart-drawer: mounted in 37 ms {load: 31, mount: 6, props: 448, el: div}
[pelago:islands] +4208 ms product-form: loading (visible, waited 4095 ms) {…}
```

The time is the event's own, in milliseconds since the page started loading, because the lines from the list are printed later than they happened. `failed` prints no line, because the runtime's error is already in the console at that point.

It is turned on in two ways:

- **The plugin option** `pelago({ debug: true })`, or a list of areas, `pelago({ debug: ['islands'] })`. Default: `false`.
- **The `localStorage` key** `pelago-debug`, for turning it on without restarting Vite: `*` for every area, a list separated by commas (`islands,cart`), or `0` for none. When the key is set, it wins over the option.

In `vite dev`, the plugin adds `import('@pelagojs/islands/debug')` to `virtual:islands`, as it does for the inspector, and passes it the option's areas (`['*']` for `true`, none for `false`). The reader checks the key itself, and does nothing when neither asks for an area. Builds never include it.

### Not Included

- **The Vite plugin's own messages** (what it wrote, which islands it found) run in Node, not the browser. They go through Vite's logger, separately.
- **On a built theme.** A problem that shows only on the live store can't use this yet. The list is already kept there, so a later change can add a small check to the production entry that loads the reader.

## Consequences

- One stream of events serves the console now, and the inspector's event log later, with no second set of hooks in the runtime.
- The runtime grows by `emit`, the list and one object per event: no formatting, no strings, no level checks. The cost in a build is a few objects per island on a page.
- The list keeps the records of its last 200 events, and with them their elements. In the theme editor, where sections reload many times, up to that many detached elements stay in memory until newer events push them out.
- The event names and data are a contract between the runtime and its readers. They ship in the same package at the same version, so they change together; nothing outside the package may rely on them.
- An area is added by emitting its events and teaching the reader its lines. Until then, asking for it prints nothing.
- Lines are hidden until the developer turns on "Verbose" in the console's levels. The docs must say so, or `debug: true` looks broken.
