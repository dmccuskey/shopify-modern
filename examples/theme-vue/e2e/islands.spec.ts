import { expect, test } from '@playwright/test'

// Products from Shopify's sample data on a development store; override them for another store.
const products = {
  /** several variants, all available */
  variants: process.env.PRODUCT_VARIANTS ?? 'the-complete-snowboard',
  /** only the default variant, available */
  single: process.env.PRODUCT_SINGLE ?? 'the-videographer-snowboard',
  /** sold out */
  soldOut: process.env.PRODUCT_SOLD_OUT ?? 'the-out-of-stock-snowboard',
}

test('product-form picks a variant and adds it to the cart, which opens the drawer', async ({
  page,
}) => {
  await page.goto(`/products/${products.variants}`)
  const form = page.locator('[data-island="product-form"] form')
  const select = form.getByRole('combobox').first()
  await expect(select).toBeVisible()

  const options = await select.locator('option').allTextContents()
  const last = options.at(-1)!
  await select.selectOption(last)
  await expect(page).toHaveURL(/[?&]variant=\d+/)

  await form.getByRole('button', { name: 'Add to cart' }).click()
  const drawer = page.getByRole('dialog', { name: 'Cart' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('listitem')).toHaveCount(1)
  await expect(drawer.getByRole('listitem')).toContainText(last)
  await expect(page.locator('[data-island="cart-drawer"] > a sup')).toHaveText('1')
})

test('cart-drawer changes the quantity and removes the line', async ({ page }) => {
  await page.goto(`/products/${products.single}`)
  const form = page.locator('[data-island="product-form"] form')
  await expect(form.getByRole('combobox')).toHaveCount(0)
  await form.getByRole('button', { name: 'Add to cart' }).click()

  const drawer = page.getByRole('dialog', { name: 'Cart' })
  const count = page.locator('[data-island="cart-drawer"] > a sup')
  await drawer.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(count).toHaveText('2')

  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await page.getByRole('link', { name: 'Cart', exact: true }).click()
  await expect(drawer).toBeVisible()

  await drawer.getByRole('button', { name: 'Remove' }).click()
  await expect(drawer).toContainText('Your cart is empty')
  await expect(count).toHaveCount(0)
})

test('the cart count comes from the global data island after a reload', async ({ page }) => {
  await page.goto(`/products/${products.single}`)
  await page
    .locator('[data-island="product-form"] form')
    .getByRole('button', { name: 'Add to cart' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Cart' })).toBeVisible()

  const cartRequests: string[] = []
  // the store's Ajax Cart API, not a module of the same name from the Vite dev server
  const store = new URL(page.url()).origin
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === store && url.pathname.endsWith('/cart.js')) cartRequests.push(request.url())
  })
  await page.reload()
  // the drawer loads when the browser is idle; wait for it to replace the Liquid link
  await expect(page.getByRole('dialog', { name: 'Cart', includeHidden: true })).toBeAttached()
  await expect(page.locator('[data-island="cart-drawer"] > a sup')).toHaveText('1')
  expect(cartRequests).toEqual([])
})

test('product-form shows a sold-out product as sold out', async ({ page }) => {
  await page.goto(`/products/${products.soldOut}`)
  await expect(
    page.locator('[data-island="product-form"] form').getByRole('button', { name: 'Sold out' }),
  ).toBeDisabled()
})
