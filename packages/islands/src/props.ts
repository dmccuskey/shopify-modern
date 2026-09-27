/**
 * Reads the props of an island from its JSON data island,
 * `<script type="application/json" data-island-props="{id}">`.
 * Returns `null` if the tag is missing or empty. Throws if the JSON is invalid.
 */
export function readProps<T = unknown>(id: string, root: ParentNode = document): T | null {
  // compared directly, so the id needs no escaping in a selector
  const el = [...root.querySelectorAll('script[data-island-props]')].find(
    (script) => script.getAttribute('data-island-props') === id,
  )
  const json = el?.textContent?.trim()
  if (!json) return null
  return JSON.parse(json) as T
}
