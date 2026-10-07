/**
 * Reads the props of an island from its JSON data island,
 * `<script type="application/json" data-island-props="{id}">`.
 * Returns `null` if the tag is missing or empty. Throws if the JSON is invalid.
 */
export function readProps<T = unknown>(id: string, root: ParentNode = document): T | null {
  const json = readPropsText(id, root)
  if (!json) return null
  return JSON.parse(json) as T
}

/** The trimmed text of an island's data island, or `undefined` if the tag is missing. Internal. */
export function readPropsText(id: string, root: ParentNode = document): string | undefined {
  // compared directly, so the id needs no escaping in a selector
  const el = [...root.querySelectorAll('script[data-island-props]')].find(
    (script) => script.getAttribute('data-island-props') === id,
  )
  return el?.textContent?.trim()
}
