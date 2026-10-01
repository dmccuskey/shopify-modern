import { expect, test, type Page } from '@playwright/test'

// The data island budget from ADR 006: the JSON in a page's `script[data-island-props]` tags,
// in total, stays under 30 KB. Tune it once real pages are measured.
const budget = 30 * 1024

const products = {
  variants: process.env.PRODUCT_VARIANTS ?? 'the-complete-snowboard',
  single: process.env.PRODUCT_SINGLE ?? 'the-videographer-snowboard',
}

const pages = [
  '/',
  `/products/${products.variants}`,
  `/products/${products.single}`,
  '/collections/all',
  '/search?q=snowboard',
  '/cart',
]

/** The data islands in a page as served, by id with their size in bytes. Islands replace their
 * children when they mount, data islands included, so they're read from the HTML, not the DOM. */
async function dataIslands(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.ok()).toBe(true)
  const html = (await response?.text()) ?? ''
  const islands = [
    ...html.matchAll(/<script\b[^>]*\bdata-island-props="([^"]*)"[^>]*>([\s\S]*?)<\/script>/g),
  ].map(([, id = '', json = '']) => ({ id, bytes: Buffer.byteLength(json, 'utf8') }))
  const total = islands.reduce((sum, island) => sum + island.bytes, 0)
  test.info().annotations.push({
    type: 'data islands',
    description: `${path}: ${total} bytes (${islands.map((i) => `${i.id} ${i.bytes}`).join(', ')})`,
  })
  return { islands, total }
}

for (const path of pages) {
  test(`the data islands on ${path} stay under the budget`, async ({ page }) => {
    const { islands, total } = await dataIslands(page, path)
    // every page has the global data island; none means the pattern no longer finds them
    expect(islands.map((i) => i.id)).toContain('global')
    expect(total).toBeLessThanOrEqual(budget)
  })
}

test('the data islands stay under the budget with a full cart', async ({ page }) => {
  // the global data island holds the cart, so it grows with every line
  await page.goto(`/products/${products.variants}`)
  const variants = await page.evaluate(async (handle) => {
    const product = await (await fetch(`/products/${handle}.js`)).json()
    return product.variants.map((variant: { id: number }) => variant.id) as number[]
  }, products.variants)
  await page.evaluate(async (ids) => {
    await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: ids.map((id) => ({ id, quantity: 1 })) }),
    })
  }, variants)

  const { islands, total } = await dataIslands(page, `/products/${products.variants}`)
  expect(islands.map((i) => i.id)).toContain('global')
  expect(total).toBeLessThanOrEqual(budget)
})
