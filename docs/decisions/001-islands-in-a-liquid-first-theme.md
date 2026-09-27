# ADR 001: Islands in a Liquid-First Theme, Not a Full-Page SPA

**Status:** Accepted

## Context

shopify-modern v1 (2017) mounted one Vue app on a `#vueapp` element that covered the whole page, with `vue-router` choosing a view from the Shopify URL. Liquid serialized the page's data into JSON script tags, and the app read them.

The data half of that idea has become a common pattern: Liquid writes `<script type="application/json">` tags and JavaScript reads them. Shopify's Dawn theme does it itself. The v1 README's alternative of "many anchors" is what is now called islands architecture.

The full-page app half has aged badly:

- The theme editor, sections and app blocks expect Liquid to render the page. A client app that owns the page breaks live editing and hides app blocks.
- Content rendered only by JavaScript hurts SEO and Core Web Vitals.
- In v1, `layout/theme.liquid` rendered both the Vue app and the Liquid header, content and footer, so each page rendered twice.
- The router only covered `/collections/all`, and links were plain `<a href>`, so it only ever picked a view on a full page load. It did the job of Liquid templates, less well.

Stores that want a full custom front end have [Hydrogen](https://hydrogen.shopify.dev/) and the Storefront API, but those lose the theme editor and theme app extensions, and the developer has to host the storefront.

## Decision

- Liquid renders every page. JavaScript only enhances marked regions, called islands: an element with `data-island="<name>"`.
- Each island reads its props from a JSON data island rendered by its own section, keyed by `section.id` (see [Data Islands](../architecture.md#data-islands)).
- One small loader finds the islands on the page and lazily imports only their components, following a loading rule per island (`eager`, `visible`, `idle`, `interaction`).
- The loader unmounts and remounts islands on the theme editor's `shopify:section:load` and `shopify:section:unload` events.
- Each mount element holds server-rendered fallback markup, so the page works without JavaScript.
- No `#vueapp` root, no client router, no client-side navigation between Shopify pages.

## Consequences

- The theme editor, app blocks, SEO and Core Web Vitals work as in any Liquid theme.
- Only pages with islands load component code, and only for the islands on them.
- It fits into an existing OS 2.0 theme instead of replacing it, which is who most users are (see [ADR 005](005-example-theme-on-skeleton-any-theme-supported.md)).
- Interactive parts are written twice: as Liquid fallback markup and as a component. Generating the fallback from the component is a research idea (see [Possible Future Changes](../development.md#possible-future-changes)).
- Anything that wants a single-page app experience across pages is out of scope; Hydrogen covers it.
