# shopify-modern Documentation

shopify-modern v2 is being built on the `v2` branch. A Quick Start comes with the first working release; until then, start with the [architecture](architecture.md).

## Internals

- [Architecture](architecture.md): how v2 works: data islands, the island runtime, shared state, and the build
- [Architecture Decisions](decisions/): the project's decision records (ADRs)

## Contribute

- [Development](development.md): branches and possible future changes
- Planned work is tracked in [GitHub issues](https://github.com/dmccuskey/shopify-modern/issues)

## Project Structure

Planned for v2.0 (see [Packages](architecture.md#packages)); the v1 code is still in place until the repository is scaffolded.

```text
shopify-modern/
├── packages/
│   ├── islands/          # @shopify-modern/islands: the core runtime
│   ├── shopify/          # @shopify-modern/shopify: Shopify helpers, shared stores
│   ├── vue/              # @shopify-modern/vue: the Vue 3 adapter
│   └── vite-plugin/      # @shopify-modern/vite-plugin
├── examples/
│   └── theme-vue/        # example theme on Shopify's skeleton theme
├── docs/
│   ├── README.md         # this page
│   ├── architecture.md
│   ├── development.md
│   └── decisions/        # ADRs
├── LICENSE
└── README.md
```
