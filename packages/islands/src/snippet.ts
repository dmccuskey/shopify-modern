/** The file name of the data island snippet, in the theme's `snippets/` folder. */
export const dataIslandSnippetFile = 'data-island.liquid'

/**
 * The data island snippet: renders an island's props as a JSON script tag that `readProps` finds.
 * The Vite plugin writes it on every dev run and build; `npx @shopify-modern/islands init` writes it once.
 */
export const dataIslandSnippet = `{% doc %}
  Renders an island's props as a JSON data island, read by the island with the same data-island-id.

  Written by @shopify-modern/vite-plugin on every dev run and build, or once by
  npx @shopify-modern/islands init.

  @param {string} id - The island's data-island-id, usually section.id
  @param {string} json - The props, as JSON built in Liquid

  @example
  {% render 'data-island', id: section.id, json: props %}
{% enddoc %}
<script type="application/json" data-island-props="{{ id }}">{{ json }}</script>
`
