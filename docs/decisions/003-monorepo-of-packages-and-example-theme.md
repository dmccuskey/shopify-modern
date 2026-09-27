# ADR 003: A Monorepo of npm Packages Plus an Example Theme

**Status:** Accepted

## Context

v1 was a theme to copy: the framework code lived in the theme, so using it meant copying files and merging updates by hand. The v2 runtime ([ADR 001](001-islands-in-a-liquid-first-theme.md), [ADR 002](002-framework-agnostic-core-and-nanostores.md)) is meant to drop into any OS 2.0 theme, so it has to be installable and updatable on its own.

npm can't place Liquid files into a theme's folders, which could make a package awkward for a theme library.

## Decision

- One repository holds the packages and an example theme, as package manager workspaces (npm or pnpm, chosen when the repository is scaffolded):
  - `packages/islands`: `@shopify-modern/islands`, the core
  - `packages/shopify`: `@shopify-modern/shopify`, Shopify helpers and shared stores
  - `packages/vue`: `@shopify-modern/vue`, the Vue adapter (the other adapters follow in v2.1)
  - `packages/vite-plugin`: `@shopify-modern/vite-plugin`
  - `examples/theme-vue`: the example theme
- The example theme depends on the packages through the workspace, so it runs exactly what users install.
- No Liquid file is required at runtime: the JSON data tag can sit inside the island's mount element. The optional `data-island.liquid` snippet is written into the theme's `snippets/` by the Vite plugin on every dev run and build, so it never goes stale. Themes without Vite run `npx @shopify-modern/islands init` once.
- The npm scope `@shopify-modern` is to be claimed before the first release; if it isn't available, the package names change before publishing.

## Consequences

- Users install and update with npm instead of copying files. Setup is `npm install`, one line in the Vite config, then writing components.
- Changes to a package are tested against a real theme in the same commit.
- Releases need versioning and publishing for several packages, and the build tooling has to handle a workspace.
- The example theme shows one framework at a time; examples for the other frameworks (`examples/theme-react` and so on) come with their adapters.
