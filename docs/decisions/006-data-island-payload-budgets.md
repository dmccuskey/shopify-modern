# ADR 006: Data Island Payload Budgets

**Status:** Accepted

## Context

Data islands ([ADR 001](001-islands-in-a-liquid-first-theme.md)) are inline JSON in the HTML, so every byte is downloaded and parsed on every page view, whether an island uses it or not. `{{ product | json }}` includes the description HTML, every image and media item, and every variant: for a product with many variants this can be hundreds of kilobytes. Collections and search results could grow the same way.

The question during planning was whether large data needs custom pagination. Mostly it doesn't: Shopify already paginates lists, and the rest can be controlled with how the JSON is built and when it is fetched.

## Decision

Data size is controlled in four ways:

- **Explicit shapes.** Data islands are built in Liquid with only the fields the island reads, not `| json` of whole objects. The docs and the example theme show this pattern.
- **Shopify's own pagination.** Lists use `{% paginate %}` (for example `{% paginate collection.products by 24 %}`), so a data island never holds more than one page. "Load more" fetches the next page with `?page=2&section_id=<id>` for HTML or `?page=2&view=data` for JSON.
- **Fetching on demand.** Islands that load `visible` or on `interaction` embed no data and fetch it when they mount. For products with very many variants, the page embeds only the selected variant and fetches the rest when an option changes, as Dawn does.
- **A budget in CI.** A Playwright check loads sample pages of the example theme and fails if the total size of `script[data-island-props]` on a page exceeds the budget: 30 KB per page to start, to be tuned once real pages are measured.

## Consequences

- No custom pagination system to build or document.
- Page weight stays visible: an island that serializes too much fails CI instead of slowing stores down.
- Authors write explicit JSON in Liquid instead of one `| json` filter, which is more code per island. The typed props generated from section schemas help keep the shapes and types in step.
- The budget only checks the example theme's pages; users' themes need their own checks. Budgets for users' themes are planned for v2.1 ("Performance limits in CI").
