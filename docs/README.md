# Pelago Documentation

Pelago is shopify-modern v2, published to npm as `@pelagojs/*` and built on the `v2` branch. A Quick Start comes with the first working release; until then, start with the [architecture](architecture.md).

## Internals

- [Architecture](architecture.md): how v2 works: data islands, the island runtime, shared state, and the build
- [Architecture Decisions](decisions/): the project's decision records (ADRs)

## Contribute

- [Example theme](../examples/theme-vue/README.md): what the example contains, and what it changes from Shopify's skeleton theme
- [Development](development.md): building and testing, branches, the [roadmap](development.md#roadmap), and possible future changes

## Project Structure

```text
shopify-modern/
├── packages/
│   ├── islands/            # @pelagojs/islands: the core runtime
│   ├── shopify/            # @pelagojs/shopify: Shopify helpers, shared stores
│   ├── vue/                # @pelagojs/vue: the Vue 3 adapter
│   └── vite-plugin/        # @pelagojs/vite-plugin
├── examples/
│   └── theme-vue/          # example theme on Shopify's skeleton theme
│       └── shopify.theme.toml  # you create (gitignored): your store
├── docs/
│   ├── README.md           # this page
│   ├── architecture.md
│   ├── development.md
│   └── decisions/          # ADRs
├── .github/workflows/      # CI
├── package.json            # npm workspaces and the scripts
├── LICENSE
└── README.md
```
