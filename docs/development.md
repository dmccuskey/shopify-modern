# Development

How to work on Pelago (shopify-modern v2): building and testing, branches, the roadmap, and ideas that aren't decided yet.

## Build and Test

You need Node 22.12 or newer (`node --version`). The repository's `.nvmrc` pins Node 22, so with [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the repository first.

```bash
npm install
npm run check
```

`npm run check` runs everything CI runs, in order, and stops at the first failure:

| Command | What it does |
|---|---|
| `npm run format:check` | Checks formatting with Prettier (`npm run format` fixes it). Markdown and the theme's Liquid and JSON are left out. |
| `npm run lint` | ESLint on the TypeScript and Vue files |
| `npm run typecheck` | Builds the packages' types with `tsc -b`, checks the packages' tests (`tsconfig.test.json`), then checks the example theme with `vue-tsc` and its smoke tests with `tsc` |
| `npm test` | Unit tests with Vitest (`npm run test:watch` to rerun on changes) |
| `npm run build` | Builds the packages into their `dist/` folders, then the example theme's assets |
| `npm run theme-check` | Runs Shopify's Theme Check on the example theme. Run it after a build, because the theme renders the generated `vite-tag` and `data-island` snippets. |

### The Monorepo

The repository uses npm workspaces: the packages in `packages/` and the example theme in `examples/theme-vue/` (see [Packages](architecture.md#packages)). The example depends on the packages through the workspace, and imports their built `dist/` output, the same files users install, so build the packages (`npx tsc -b`) after changing them.

### Running the Example Theme on a Store

This needs a Shopify development store; one can be created for free with a [Shopify Partner](https://www.shopify.com/partners) account.

1. Copy `examples/theme-vue/shopify.theme.example.toml` to `shopify.theme.toml` in the same folder, and set your store. The copy is gitignored.
2. Run `npm run dev` from the repository root. It builds the packages, then starts the Vite dev server and `shopify theme dev` together. The Shopify CLI asks you to log in the first time.
3. Open the preview URL that `shopify theme dev` prints (usually `http://127.0.0.1:9292`). Changes to Liquid and to the islands reload in the browser.
4. The `◆ islands` button in the corner (or Alt+Shift+I) opens the [island inspector](architecture.md#island-inspector): each island's loading rule, mount time, props size and bundle size. Bundle sizes need a `npm run build` before `npm run dev`.

`npm run deploy -w examples/theme-vue` builds the assets and runs `shopify theme push`.

### Smoke Tests

`npm run test:e2e` runs Playwright smoke tests of the example theme's islands against the running preview: adding to the cart, the cart drawer, and a sold-out product. They need a store, so they aren't part of `npm run check` or CI. See [`examples/theme-vue/e2e/README.md`](../examples/theme-vue/e2e/README.md).

## Branches

The default branch is `master`. Until the v2.0 release it holds the v1 code, because people who find the repository through its stars clone it (see [ADR 004](decisions/004-rewrite-in-the-same-repository.md)).

| Branch or tag | Holds |
|---|---|
| `master` | v1, plus a README line pointing to `v2`, until the v2.0 release |
| `v2` | v2 in development: every v2 change merges here |
| `legacy/v1`, tag `v1` | the last v1 commit (2017), kept for reference |

Each change is made on a short-lived branch named for it, started from `v2`:

```text
feat/<name>    new behavior
fix/<name>     bug fixes
docs/<name>    documentation only
```

A branch holds one change, is tested, and is merged back into `v2` with `git merge --no-ff`, so it stays visible as one merge in the history. CI runs on `v2` and on pull requests into it.

At the v2.0 release, `v2` is merged into `master` once with `--no-ff` and tagged `v2.0.0`, and the `v2` branch is deleted. From then on, branches start from `master` and merge back into it.

## Roadmap

What v2 is planned to include, by release. There are no dates: releases ship when they're done. Features can move between releases once the core is in use.

### v2.0

| Feature | What it does | Why it matters |
|---|---|---|
| Core runtime | Data island props, loading rules, the theme editor lifecycle, and shared stores ([Architecture](architecture.md)) | The foundation; nothing maintained does all of this today |
| Vue adapter | Mounts Vue 3 islands and binds the shared stores | Vue first; the other adapters follow in v2.1 ([ADR 002](decisions/002-framework-agnostic-core-and-nanostores.md)) |
| Example theme | Shopify's skeleton theme with the `product-form` and `cart-drawer` islands, and smoke tests on a dev store | Shows the pattern end to end ([ADR 005](decisions/005-example-theme-on-skeleton-any-theme-supported.md)) |
| Cart sync with apps | Watches `fetch` and XHR calls to `/cart/*` and refreshes the shared cart store after each | Apps change the cart behind the theme's back, leaving drawers and counts stale |
| Typed props from section schemas | Reads each section's `{% schema %}` and generates TypeScript types for its `settings` | Autocomplete, and a renamed setting fails at build time instead of in the store |
| Island inspector (development only) | An overlay showing each island's loading rule, props size, mount time and bundle size | Makes performance visible while building |

### v2.1

| Feature | What it does | Why it matters |
|---|---|---|
| React, Svelte and web component adapters | One adapter each, plus store bindings | Islands in any of these frameworks can share one page and one cart ([ADR 002](decisions/002-framework-agnostic-core-and-nanostores.md)) |
| Live theme editor updates | Passes setting changes into running islands, handles `shopify:block:select`, and exposes design mode | Smoother editing than a full remount, such as pausing autoplay while editing |
| Performance limits in CI | Budgets for data island size, JavaScript per island, and Lighthouse score, usable in any theme | Backs a claim of passing the Theme Store's performance checks ([ADR 006](decisions/006-data-island-payload-budgets.md)) |
| Safe deploy | A `deploy` command and GitHub Action that pull the live `templates/*.json` and `config/settings_data.json` before pushing code | Stops deploys from wiping the merchant's theme editor changes ([forum thread](https://community.shopify.dev/t/optimizing-shopify-theme-development-with-vite-deployment-challenges-workflow-suggestions/9438)) |
| "Add to Dawn" and "Add to Horizon" guides | Step-by-step adoption in Shopify's previous and current default themes | Shows v2 working in real themes, not only the example |

### v2.2

| Feature | What it does | Why it matters |
|---|---|---|
| Local development with fixtures | Snapshots real data island JSON, and renders islands locally or in Storybook | A faster loop than round trips to a store |
| State-preserving section re-render | Merges HTML from the Section Rendering API into the page in place instead of replacing it | Filters and variant pickers keep their state (see [below](#state-preserving-section-re-render)) |
| Theme app extension support | Runs the same runtime inside app blocks | Reaches app developers too ([forum thread](https://community.shopify.com/t/use-react-in-app-block-theme-extension/175347)) |
| Docs for AI agents | `llms.txt`, copy-paste recipes, and a skill that scaffolds a section, island, types and fixtures | Agents are becoming a main way people adopt libraries |

### State-Preserving Section Re-Render

Themes refresh parts of a page with the Section Rendering API and usually set `innerHTML`. That resets open dropdowns, focus, scroll position and typed input, and destroys mounted islands. The fix is to merge the new HTML into the page in place, changing only what differs, for example with [idiomorph](https://github.com/bigskysoftware/idiomorph), which Hotwire Turbo uses. The merge skips the inside of mounted islands and passes changed JSON to them as new props. It's in v2.2 because it has edge cases (stable IDs for list items, third-party scripts) and needs a lot of testing in real stores.

## Possible Future Changes

Ideas that are not decided. Each needs discussion and a concrete use case before it is worked on. Decided work is in the [Roadmap](#roadmap).

### Write Markup Once

Each island is written twice: as server-rendered fallback markup in Liquid, and as a component ([ADR 001](decisions/001-islands-in-a-liquid-first-theme.md)). A build step could turn simple components into static Liquid fallback markup, so the markup is written once. It's a hard problem (component logic doesn't map onto Liquid in general) and may not work out, so it's research, not a planned feature.
