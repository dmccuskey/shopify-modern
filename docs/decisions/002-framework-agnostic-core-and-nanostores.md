# ADR 002: A Framework-Agnostic Core With Adapters, and Nanostores for Shared State

**Status:** Accepted

## Context

v1 was Vue only. The islands model of [ADR 001](001-islands-in-a-liquid-first-theme.md) doesn't depend on a framework: finding elements, reading props, choosing when to load and reacting to theme editor events are the same for any of them. Only mounting and unmounting a component differs.

- The users asked about include React and Svelte developers.
- Shopify's current default theme, [Horizon](https://github.com/Shopify/horizon), is built on native web components, so a web component adapter lets v2 layer onto it instead of competing with it.
- Islands on one page need shared state, such as the cart for both a product form and a header count. Pinia is Vue only, so islands in different frameworks couldn't share it.

## Decision

- The core package, `@shopify-modern/islands`, has no framework imports. It owns island discovery, `readProps`, loading rules, the theme editor lifecycle and the adapter interface.
- Each framework has an adapter package that implements one interface: `mount(el, component, props)`, returning an unmount function. [Astro](https://docs.astro.build/en/concepts/islands/) uses the same model.
- Shared state uses [nanostores](https://github.com/nanostores/nanostores): small stores with no framework dependency and official bindings for Vue, React and Svelte. The stores are scoped by domain (`$cart`, `$customer`, `$locale`) and live in `@shopify-modern/shopify`.
- v2.0 ships only the Vue 3 adapter. The React, Svelte and web component adapters come in v2.1.

## Consequences

- A theme can mix frameworks, and a React cart icon and a Vue product form share one cart.
- Adding a framework means one adapter of about 30 to 50 lines, plus store bindings.
- Keeping v2.0 to Vue ships sooner, but the core must stay free of Vue imports so the later adapters don't need a redesign. Tests for the core run without any framework.
- Vue developers use nanostores instead of the more familiar Pinia for shared state; Pinia still works for state inside a single island.
