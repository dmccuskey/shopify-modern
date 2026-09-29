# Smoke Tests

Playwright tests for the example theme's islands, run in a real browser against a store. They check that the islands mount and work with Shopify's real Ajax Cart API; the packages' logic is covered by the unit tests (`npm test`).

They need a development store and the Shopify CLI's login, so they aren't part of `npm run check` or CI. To run them:

1. Start the preview with `npm run dev` (see [Running the Example Theme on a Store](../../../docs/development.md#running-the-example-theme-on-a-store)).
2. The first time, install the browser: `npx playwright install chromium` (from `examples/theme-vue/`).
3. Run `npm run test:e2e` from the repository root.

Each test starts with an empty cart of its own. The tests use products from Shopify's sample data (`the-complete-snowboard`, `the-videographer-snowboard`, `the-out-of-stock-snowboard`). On a store without them, set `PRODUCT_VARIANTS`, `PRODUCT_SINGLE` and `PRODUCT_SOLD_OUT` to the handles of a product with several variants, one with only the default variant, and one that is sold out. `THEME_URL` changes the preview's address.
