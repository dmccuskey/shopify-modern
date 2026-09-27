# Example Theme: Vue

Shopify's skeleton theme with Vue islands, built with Vite. It shows the island pattern in a minimal theme, and runs the packages from this repository exactly as users install them.

To run it on a development store, see [Running the Example Theme on a Store](../../docs/development.md#running-the-example-theme-on-a-store).

## What's Here

| Path | Holds |
|---|---|
| `src/entrypoints/theme.ts` | The entry script, loaded by `layout/theme.liquid` |
| `src/islands/` | One Vue component per island |
| `vite.config.ts` | Vite with `vite-plugin-shopify`, `@vitejs/plugin-vue` and `@shopify-modern/vite-plugin` |
| `shopify.theme.example.toml` | The store settings for the Shopify CLI; copy it to `shopify.theme.toml` (gitignored) |
| everything else | The theme itself: `assets/`, `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/` |

## Based on Shopify's Skeleton Theme

The theme files come from [Shopify/skeleton-theme](https://github.com/Shopify/skeleton-theme) at commit `a4f32d3` (2026-02-26), under Shopify's license in [LICENSE.md](LICENSE.md). Changes from it:

- `layout/theme.liquid` renders the `vite-tag` snippet, which loads the built scripts.
- `sections/hello-world.liquid` has a `hello-island` mount element, with its props (the shop's name) in a data island inside it.
- `.shopifyignore` leaves out Vite's build manifest.

To update from the skeleton theme, compare its files at a newer commit with these, and copy over the changes by hand.
