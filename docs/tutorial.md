# Tutorial: How a Pelago Theme Works

How the example theme works, for a theme developer: which files you write and which are generated, what each part does on a page load, and the dev loop. A walk-through of one section, the announcement countdown, shows each step in the code.

This takes about 30 minutes. It goes further than the README's [Quick Start](../README.md#quick-start) and [Add an Island](../README.md#add-an-island), so do those first: you need the example theme running with `npm run dev`, and the preview open at `http://127.0.0.1:9292`.

## The Files

Everything is in `examples/theme-vue/`. Most of it is an ordinary Shopify theme; Pelago adds `src/`, a few lines in `layout/theme.liquid`, and the generated files.

```text
examples/theme-vue/
├── layout/theme.liquid      # you: loads the entry script, renders the global data island
├── sections/                # you: sections, some with mount elements and data islands
│   └── announcement-countdown.liquid
├── templates/index.json     # you or the theme editor: which sections the home page has
├── src/
│   ├── entrypoints/theme.ts # you: the entry script, starts the islands
│   ├── islands/             # you: one component per island, named for it
│   │   └── AnnouncementCountdown.vue
│   └── sections.d.ts        # generated: types of the section settings (committed)
├── snippets/
│   ├── data-island.liquid   # generated: the JSON script tag (gitignored)
│   └── vite-tag.liquid      # generated: the <script> tags for the entry (gitignored)
├── assets/vite-*            # generated: the built JavaScript and CSS (gitignored)
└── vite.config.ts           # you, once: the three Vite plugins
```

The files you write:

- **Sections** render the page in Liquid, as in any theme. A section that hosts an island adds a **mount element** (`<div data-island="…">`) with fallback markup inside it, and a **data island**: a `<script type="application/json">` tag holding the island's props.
- **`src/islands/`** holds the components. Each file directly in it is an island, named after the file in kebab case: `AnnouncementCountdown.vue` is `announcement-countdown`. Components in subfolders aren't islands, so an island's parts can sit next to it.
- **`src/entrypoints/theme.ts`** is the one script every page loads. It's three lines, and you rarely change it:

  ```ts
  import { startIslands } from '@pelagojs/islands'
  import { islands } from 'virtual:islands'

  startIslands(islands)
  ```

- **`layout/theme.liquid`** loads that script with `{% render 'vite-tag' with 'theme.ts' %}`, and renders the **global data island**: the locale, customer and cart, which the shared stores read.

The generated files, which you never edit:

- **`virtual:islands`** isn't a file on disk. The Vite plugin builds it from `src/islands/`: a map from each island name to a function that imports its component, and one that imports its adapter.
- **`snippets/data-island.liquid`** renders the data island's script tag. The plugin writes it on every dev run and build.
- **`snippets/vite-tag.liquid`** is written by `vite-plugin-shopify`. In `npm run dev` it points at the Vite dev server, after a build at the hashed files in `assets/`.
- **`src/sections.d.ts`** holds TypeScript types for every section's settings, read from each `{% schema %}`. It's committed, because `npm run check` type-checks before it builds.

## Which Part Does What

What happens when a customer opens the home page:

1. **Liquid (Shopify).** Shopify renders the layout and the sections. The HTML is complete: the announcement bar already says "Ends October 1 at 11:59 PM." It also holds a mount element and a data island for each island, and the global data island.
2. **The entry script.** `vite-tag` loads `theme.ts`, a few KB. It calls `startIslands`.
3. **The runtime (`@pelagojs/islands`).** `startIslands` finds every `[data-island]` element and waits for each one's loading rule: at once, when it scrolls into view, when the browser is idle, or on the first interaction.
4. **The registry (from `@pelagojs/vite-plugin`).** When an island is due, the runtime imports its component, and the adapter if it isn't loaded yet. That is when Vue loads, and only on pages that have a Vue island.
5. **Props.** The runtime reads the island's data island with `readProps(id)`, where `id` is the mount element's `data-island-id`.
6. **The adapter (`@pelagojs/vue`).** It mounts the component on the mount element with those props, replacing the fallback markup.
7. **Shared state (`@pelagojs/shopify`).** Islands that use `useCart()` or the cart functions share one cart store, seeded from the global data island. A change made in one island, or by an app, updates the others.
8. **The theme editor.** When a merchant edits a section, Shopify renders it again and fires `shopify:section:unload` and `shopify:section:load`. The runtime unmounts the section's islands and mounts the new ones, with the new props.

| Part | Runs | Does |
|---|---|---|
| Liquid | on Shopify, for every request | the page, the fallback markup, the props as JSON |
| `@pelagojs/vite-plugin` | in `vite dev` and `vite build` | the island registry, the `data-island` snippet, the settings types, the inspector in dev |
| `@pelagojs/islands` | in the browser, on every page | finding islands, loading rules, reading props, the theme editor events |
| `@pelagojs/vue` | in the browser, once a Vue island is due | mounting and unmounting Vue components, the store composables |
| `@pelagojs/shopify` | in the browser, in islands that import it | the cart client, `formatMoney`, the shared stores, cart sync with apps |

The details of each are in [Architecture](architecture.md).

## Walk-Through: The Announcement Countdown

The home page starts with an announcement bar: "Free shipping on every order today. Ends in 5h 34m 53s." The message is plain Liquid. Only the time left is an island, because only that part changes in the browser. This walks through its two files, in the order you would write them.

### 1. The Section's Settings

Open `sections/announcement-countdown.liquid` and scroll to its `{% schema %}`. It has four settings that a merchant can change in the theme editor:

```json
{
  "name": "Announcement countdown",
  "settings": [
    { "type": "text", "id": "message", "label": "Message", "default": "Free shipping on every order today." },
    { "type": "text", "id": "ends_at", "label": "Ends at", "info": "As YYYY-MM-DD HH:MM, in the store's time zone. Leave empty to count down to midnight." },
    { "type": "text", "id": "ended_message", "label": "Message once it has ended", "default": "This offer has ended." },
    { "type": "checkbox", "id": "show_seconds", "label": "Show seconds", "default": true }
  ],
  "presets": [{ "name": "Announcement countdown", "category": "Demo" }]
}
```

When you save a section file, the Vite plugin reads its schema and updates `src/sections.d.ts`:

```ts
'announcement-countdown': {
  message: string | null
  ends_at: string | null
  ended_message: string | null
  show_seconds: boolean
}
```

A text setting can be empty, so it's `string | null`; a checkbox is always a `boolean`. The other setting types are in [Settings Types](architecture.md#settings-types).

### 2. The Fallback Markup

The top of the section works out the end time, and renders the bar:

```liquid
{%- liquid
  if section.settings.ends_at != blank
    assign ends_at = section.settings.ends_at
  else
    assign ends_at = 'now' | date: '%Y-%m-%d 23:59:59'
  endif
  assign ends_at_seconds = ends_at | date: '%s'
-%}

<div class="announcement">
  <p>
    {{ section.settings.message }}
    <span data-island="announcement-countdown" data-island-id="{{ section.id }}" data-island-load="idle">
      Ends {{ ends_at | date: '%B %-d at %-I:%M %p' }}.
    </span>
  </p>
</div>
```

The `<span>` is the **mount element**:

- `data-island` names the island, so the runtime imports `AnnouncementCountdown.vue`.
- `data-island-id` says which data island holds its props. The section's ID is unique on the page, even when a merchant adds the section twice.
- `data-island-load="idle"` mounts it when the browser is idle. The fallback already shows the end time, so the countdown isn't urgent, and the product form and other eager islands go first.

Its content is the **fallback markup**: what customers see before the island mounts, and if JavaScript fails. Here it's the end time, which Liquid can work out; the time left changes every second, so only the island can show it.

**Try it:** view the page's source (Cmd+Option+U in Chrome). The bar there says "Ends October 1 at 11:59 PM.", with today's date: that's the page as Liquid rendered it, before any JavaScript ran.

### 3. The Data Island

Below the bar, the section builds the island's props as JSON and renders them with the `data-island` snippet:

```liquid
{%- capture props -%}
  { "endsAt": {{ ends_at_seconds | times: 1000 }}, "ended_message": {{ section.settings.ended_message | json }}, "show_seconds": {{ section.settings.show_seconds | json }} }
{%- endcapture -%}
{% render 'data-island', id: section.id, json: props %}
```

It renders as:

```html
<script type="application/json" data-island-props="template--…__announcement">{ "endsAt": 1790920799000, "ended_message": "This offer has ended.", "show_seconds": true }</script>
```

Three rules show here:

- **Only what the island reads.** The message stays in Liquid, so it isn't in the props. Data islands have a budget of 30 KB per page ([ADR 006](decisions/006-data-island-payload-budgets.md)), so build explicit shapes rather than `{{ section.settings | json }}`.
- **Do the work in Liquid where you can.** Liquid turns the date text into milliseconds, in the store's time zone, so the island doesn't parse dates.
- **Settings keep their names.** `ended_message` and `show_seconds` are named as in the schema, so the component can take their types from `sections.d.ts`. `endsAt` isn't a setting, so it gets its own name.

The data island is outside the mount element, so it stays on the page after the island mounts. One inside the mount element works too, as in `hello-world.liquid`, but the mount replaces it, and the inspector then can't show its size.

### 4. The Component

Open `src/islands/AnnouncementCountdown.vue`:

```vue
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { SectionSettings } from '../sections'

type Settings = SectionSettings['announcement-countdown']

const props = defineProps<{ endsAt: number } & Pick<Settings, 'ended_message' | 'show_seconds'>>()

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
// the theme editor unmounts the island whenever the merchant edits its section
onUnmounted(() => clearInterval(timer))

const left = computed(() => {
  const seconds = Math.max(0, Math.floor((props.endsAt - now.value) / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds / 3600) % 24
  const minutes = Math.floor(seconds / 60) % 60
  let time = `${hours}h ${minutes}m`
  if (props.show_seconds) time += ` ${seconds % 60}s`
  return days > 0 ? `${days}d ${time}` : time
})
const ended = computed(() => now.value >= props.endsAt)
</script>

<template>
  <span v-if="ended">{{ ended_message }}</span>
  <span v-else>Ends in {{ left }}.</span>
</template>
```

It's an ordinary Vue component. What makes it an island:

- **Its file name.** It's directly in `src/islands/`, so the registry has `announcement-countdown`. Adding the file while `npm run dev` runs reloads the page with the new registry.
- **Its props** are the data island's JSON. `Pick<Settings, …>` takes the types of the two settings from the schema.
- **Cleaning up on unmount.** In the theme editor, every edit to the section unmounts the island and mounts a new one. Anything the component starts outside Vue, such as this interval, a listener on `window` or an observer, has to stop in `onUnmounted`.

**Try it:** change `Ends in` to `Only` in the template and save. The bar updates without a reload, as the README's Quick Start showed.

**Try it:** rename `show_seconds` to `seconds` in the schema, and run `npm run typecheck`. It fails in `AnnouncementCountdown.vue`, because `SectionSettings['announcement-countdown']` has no `show_seconds` any more. Put the name back. The type check covers the component, not the Liquid: the JSON in step 3 isn't checked against the types.

### 5. Adding the Section to a Page

A section shows on a page when the page's template lists it. `templates/index.json` puts it above the hello world section:

```json
"sections": {
  "announcement": { "type": "announcement-countdown", "settings": {} },
  "main": { "type": "hello-world", "settings": {} }
},
"order": ["announcement", "main"]
```

`"settings": {}` keeps every default, so it counts down to midnight. Because the schema has a preset, merchants can also add the section to any page in the theme editor, under Demo. The theme editor writes its changes to these JSON files, so on a live store the merchant owns them.

### 6. Checking It

Open the island inspector with the `◆ 3 islands` button in the corner, or Alt+Shift+I. Each island on the page gets an outline and a row:

| Island | Rule | Mount | Props | Bundle |
|---|---|---|---|---|
| cart-drawer | idle | 49 ms | – | 1.7 KB |
| announcement-countdown | idle | 50 ms | 91 B | – |
| hello-island | eager | 295 ms | – | 299 B |

- **Rule** is the loading rule, as the runtime scheduled it.
- **Mount** is the time from the rule firing to the component being on the page.
- **Props** is the size of the island's own data island. It shows "–" for the other two, whose data islands are inside their mount elements (see step 3).
- **Bundle** is the gzipped size of the island's own code, from the last `npm run build`. It shows "–" for an island added since.

The line under the table adds up every data island on the page against the 30 KB budget.

`e2e/islands.spec.ts` has a smoke test for the countdown: it reads the props from the served page, sets the browser's clock to 1 day, 2 hours, 3 minutes and 4 seconds before the end, and expects "Ends in 1d 2h 3m 4s.", then the ended message at the end time.

### 7. In the Theme Editor

The preview at `127.0.0.1:9292` shows the theme as customers see it. To see what a merchant sees, open the theme in the theme editor, which needs the built theme instead of the dev server (see [The Dev Loop](#the-dev-loop)):

1. Stop `npm run dev`, and run `npm run dev:editor`.
2. Open the theme editor link that `shopify theme dev` prints, and select the announcement countdown on the home page.
3. Turn off "Show seconds", or set "Ends at" to a time that has passed. The preview renders the section again and the island remounts with the new props: no seconds, or "This offer has ended."

The changes stay in the editor's draft until you save. Leave without saving, or save on a development theme only.

## Building Your Own

Every island follows the same steps: a schema with the settings a merchant needs, fallback markup in a mount element, a data island with only what the island reads, and a component in `src/islands/`. For a second island in the same section, give it an ID of its own, such as `{{ section.id | append: '-shipping' }}`, as in the README's [Add an Island](../README.md#add-an-island).

## The Dev Loop

Day to day, nothing changes for most work. `npm run dev`, with hot reload on `127.0.0.1:9292`, stays the normal loop: save a component or a section and the preview updates.

You switch to `npm run dev:editor` only when you want to see islands in the theme editor, for example to check that they remount when a merchant edits a section. The editor's preview can't reach the Vite dev server on `localhost` (Chrome's Local Network Access blocks it), so `dev:editor` builds the theme on every change instead, and the Shopify CLI uploads the built files. Reload the editor after each change; hot reload and the inspector aren't there. When you go back to `npm run dev`, run `touch examples/theme-vue/snippets/vite-tag.liquid` if the preview still loads the built files.

The scripts, all run from the repository root:

| Command | When |
|---|---|
| `npm run dev` | Day to day: builds the packages, then runs Vite and `shopify theme dev` with hot reload |
| `npm run dev:editor` | To check islands in the theme editor, instead of `npm run dev` |
| `npm run check` | Before committing: format, lint, type check, unit tests, build and Theme Check, as CI runs them |
| `npm run build` | To build the packages and the theme's assets, for example to update the inspector's bundle sizes. It switches a running `npm run dev` preview to the built files, so restart `npm run dev` afterwards. |
| `npm run test:e2e` | After changing an island: the Playwright smoke tests, against the running preview |
| `npm run deploy -w examples/theme-vue` | To build and push the theme to the store with `shopify theme push` |
| `npm run format`, `npm run test:watch` | Fix formatting; rerun the unit tests on every change |

`npm run deploy` pushes the JSON templates too, and so can overwrite changes a merchant made in the theme editor; push to an unpublished theme, or pull the live templates first. The details of each command are in [Development](development.md#build-and-test).

## Where to Go Next

- [Loading Rules](architecture.md#loading-rules): which rule fits which island.
- [Dynamic Data and Shared State](architecture.md#dynamic-data-and-shared-state): the cart client, the shared stores, and the Section Rendering API.
- [Use It in Your Own Theme](../README.md#use-it-in-your-own-theme): the same setup in Dawn or any Online Store 2.0 theme.
- [Architecture Decisions](decisions/): why it's built this way.
