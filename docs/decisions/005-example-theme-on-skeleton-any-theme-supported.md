# ADR 005: The Example Theme on Shopify's Skeleton Theme, With Support for Any OS 2.0 Theme

**Status:** Accepted

## Context

v1 vendored Shopify's Slate theme, which is now deprecated (it uses `include` and markup for Internet Explorer 9).

Most merchants start from a Theme Store theme, Dawn or a paid one, and customize it. Agencies building for larger brands often build a custom theme, usually starting from Dawn. So most people who would use shopify-modern are adding islands to a theme they already have, not starting a new one.

The example theme has two jobs: to show the island pattern clearly, and to run the smoke tests. A full theme such as Dawn would bury the pattern in unrelated code.

## Decision

- The packages work in any Online Store 2.0 theme. Nothing in them assumes the example theme's files or structure; the only theme file they may add is the optional `data-island.liquid` snippet ([ADR 003](003-monorepo-of-packages-and-example-theme.md)).
- The example theme, `examples/theme-vue`, is based on Shopify's minimal [skeleton theme](https://github.com/Shopify/skeleton-theme), with the reference islands `product-form` and `cart-drawer`.
- "Add to Dawn" and "Add to Horizon" guides come in v2.1, to show adoption in real themes.

## Consequences

- The example stays small enough to read in one sitting.
- The example alone doesn't prove the packages work in a large theme; the v2.1 guides cover that.
- The example follows the skeleton theme's updates only when they are pulled in by hand.
