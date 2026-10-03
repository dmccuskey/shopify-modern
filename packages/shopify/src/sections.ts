/** Sections' HTML by section ID; a section that doesn't exist on the page is `null`. */
export type SectionsHtml = Record<string, string | null>

/** Shopify renders at most five sections per request, here and with a cart change. */
export const maxSections = 5

/**
 * Renders sections with the Section Rendering API (`?sections=`), in the context of a page
 * (the current one by default), and returns their HTML by section ID.
 * A section that doesn't exist on that page is `null`. More than five sections take several requests.
 */
export async function renderSections(
  ids: string[],
  url: string = location.pathname + location.search,
): Promise<SectionsHtml> {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += maxSections) batches.push(ids.slice(i, i + maxSections))
  const results = await Promise.all(
    batches.map((batch) => fetchSections(url, { sections: batch.join(',') }).then(json)),
  )
  return Object.assign({}, ...results) as SectionsHtml
}

/**
 * Renders one section with the Section Rendering API (`?section_id=`), in the context of a page
 * (the current one by default), and returns its HTML.
 */
export async function renderSection(
  id: string,
  url: string = location.pathname + location.search,
): Promise<string> {
  return fetchSections(url, { section_id: id }).then((response) => response.text())
}

async function fetchSections(url: string, params: Record<string, string>): Promise<Response> {
  const target = new URL(url, location.origin)
  for (const [name, value] of Object.entries(params)) target.searchParams.set(name, value)
  const response = await fetch(target)
  if (!response.ok) throw new Error(`Section Rendering API: ${response.status} ${target.pathname}`)
  return response
}

function json(response: Response): Promise<SectionsHtml> {
  return response.json() as Promise<SectionsHtml>
}
