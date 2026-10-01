# ADR 007: The Pelago Name and the @pelagojs npm Scope

**Status:** Accepted

## Context

[ADR 003](003-monorepo-of-packages-and-example-theme.md) planned to publish the packages as `@shopify-modern/*`, and to rename them if the scope wasn't available. Before publishing, two problems with that name came up:

- **Shopify's trademark rules.** Shopify's pages don't cover open source packages, but the nearest rules point against it: third-party apps must "never use the word 'Shopify' in the name" ([Polaris naming](https://polaris-react.shopify.com/content/naming)), and partners should "always lead with their own brand" ([partner branding](https://help.shopify.com/en/partners/partner-program/shopify-branding)).
- **It would look official.** No npm scope starts with `@shopify-` yet. Next to Shopify's own `@shopify/*` packages, such as `@shopify/cli`, a `@shopify-modern/*` package would look like one of them.

The repository's name is a separate matter. It has had stars and inbound links since 2017, and keeping them is why v2 is a rewrite in the same repository ([ADR 004](004-rewrite-in-the-same-repository.md)).

## Decision

- The project is named **Pelago**, from "archipelago": a chain of islands, like the islands in a page.
- The packages are published under the npm scope **`@pelagojs`**. The `@pelago` scope was taken, so this follows projects such as `@vuejs` and `@sveltejs`. The scope is an npm organization, owned by the maintainer's npm account.

  | package | was |
  |---|---|
  | `@pelagojs/islands` | `@shopify-modern/islands` |
  | `@pelagojs/shopify` | `@shopify-modern/shopify` |
  | `@pelagojs/vue` | `@shopify-modern/vue` |
  | `@pelagojs/vite-plugin` | `@shopify-modern/vite-plugin` |
  | `@pelagojs/example-theme-vue` (private) | `@shopify-modern/example-theme-vue` |

- The v2.1 adapters follow the same pattern: `@pelagojs/react`, `@pelagojs/svelte`, `@pelagojs/wc`.
- In code, the name is `pelago`: the Vite plugin's `name` and default export, the `[pelago]` prefix on console messages, and the `pelago.cart-sync` symbol.
- The repository keeps the name `shopify-modern`, at the same URL. "Shopify" goes after the project's name in descriptions, as in "islands for Shopify themes".

## Consequences

- The package names follow Shopify's rules as far as they go, and don't look like Shopify's own packages.
- The repository and the packages have different names. The README has to explain that Pelago is shopify-modern v2, so people arriving from old links aren't confused.
- ADRs 001 to 006 still use the old package names, because accepted ADRs aren't rewritten. This ADR maps the old names to the new ones.
