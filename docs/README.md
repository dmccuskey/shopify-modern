# Pelago Documentation

shopify-modern publishes Pelago (`@pelagojs/*`), an island runtime for Shopify themes. New here? Start with the [Quick Start](../README.md#quick-start).

## Use

- [Tutorial](tutorial.md): how a Pelago theme works: the files, which part does what, a walk-through of one island, and the dev loop

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
│   ├── tutorial.md
│   ├── architecture.md
│   ├── development.md
│   └── decisions/          # ADRs
├── .github/workflows/      # CI
├── package.json            # npm workspaces and the scripts
├── LICENSE
└── README.md
```
