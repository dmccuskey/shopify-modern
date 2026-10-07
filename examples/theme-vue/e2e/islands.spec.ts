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

// The product-form island mounts inside the section's Liquid product form, next to the payment button.

test('product-form picks a variant and adds it to the cart, which opens the drawer', async ({
  page,
}) => {
  await page.goto(`/products/${products.variants}`)
  const form = page.locator('form:has([data-island="product-form"])')
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

test('product-form keeps the dynamic checkout buttons in step with the chosen variant', async ({
  page,
}) => {
  await page.goto(`/products/${products.variants}`)
  const form = page.locator('form:has([data-island="product-form"])')
  const select = form.getByRole('combobox').first()
  await expect(select).toBeVisible()
  await expect(form.locator('[data-shopify="payment-button"]')).toBeAttached()

  await select.selectOption((await select.locator('option').allTextContents()).at(-1)!)
  await expect(page).toHaveURL(/[?&]variant=\d+/)
  const variant = new URL(page.url()).searchParams.get('variant')
  await form.getByRole('spinbutton').fill('2')

  // what the payment button reads when it's clicked
  const fields = await form.evaluate((el: HTMLFormElement) => {
    const data = new FormData(el)
    return { id: data.getAll('id'), quantity: data.getAll('quantity') }
  })
  expect(fields).toEqual({ id: [variant], quantity: ['2'] })
})

test('cart-drawer changes the quantity and removes the line', async ({ page }) => {
  await page.goto(`/products/${products.single}`)
  const form = page.locator('form:has([data-island="product-form"])')
  await expect(form.getByRole('combobox')).toHaveCount(0)
  await form.getByRole('button', { name: 'Add to cart' }).click()

  const drawer = page.getByRole('dialog', { name: 'Cart' })
  const count = page.locator('[data-island="cart-drawer"] > a sup')
  await expect(drawer.getByRole('heading')).toHaveText('Cart 1 item')
  await drawer.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(count).toHaveText('2')
  // the plural form for the count, from t()
  await expect(drawer.getByRole('heading')).toHaveText('Cart 2 items')

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
    .locator('form:has([data-island="product-form"])')
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
    page
      .locator('form:has([data-island="product-form"])')
      .getByRole('button', { name: 'Sold out' }),
  ).toBeDisabled()
})

test('the cart count follows cart changes made by apps, with fetch or XHR', async ({ page }) => {
  await page.goto(`/products/${products.single}`)
  const form = page.locator('form:has([data-island="product-form"])')
  await expect(form.getByRole('button', { name: 'Add to cart' })).toBeVisible()
  // the drawer loads when the browser is idle; wait for it to replace the Liquid link
  await expect(page.getByRole('dialog', { name: 'Cart', includeHidden: true })).toBeAttached()
  const count = page.locator('[data-island="cart-drawer"] > a sup')
  await expect(count).toHaveCount(0)

  // what an app does: call the Ajax Cart API itself, without the theme's cart client
  const variant = await form.evaluate((el: HTMLFormElement) => new FormData(el).get('id'))
  await page.evaluate(async (id) => {
    await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, quantity: 1 }),
    })
  }, variant)
  await expect(count).toHaveText('1')

  await page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/cart/change.js')
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.addEventListener('loadend', resolve)
        xhr.send(JSON.stringify({ id, quantity: 3 }))
      }),
    variant,
  )
  await expect(count).toHaveText('3')
})

test('hello-island shows the greeting from its section settings', async ({ page }) => {
  const response = await page.goto('/')
  // the island replaces its children when it mounts, props included, so read them from the served page
  const html = (await response?.text()) ?? ''
  const json = /<div data-island="hello-island"[\s\S]*?data-island-props="[^"]*">([^<]*)</.exec(
    html,
  )?.[1]
  const props = JSON.parse(json ?? '{}')
  const island = page.locator('[data-island="hello-island"]')
  await expect(island.getByRole('button')).toBeVisible()
  await expect(island).toContainText(
    `${props.greeting || 'Hello'} from ${props.name}, mounted by Vue.`,
  )
})

test('announcement-countdown counts down to the end, then shows the ended message', async ({
  page,
}) => {
  const html = (await (await page.request.get('/')).text()) ?? ''
  const json = /<script[^>]*data-island-props="[^"]*__announcement"[^>]*>([^<]*)</.exec(html)?.[1]
  const props = JSON.parse(json ?? '{}')
  expect(props.endsAt).toBeGreaterThan(0)
  // the fallback, before the island mounts
  expect(html).toMatch(/data-island="announcement-countdown"[^>]*>\s*Ends \w+ \d+ at/)

  // the page's clock stands 1 day, 2 hours, 3 minutes and 4 seconds before the end; timers still run
  await page.clock.setFixedTime(props.endsAt - (26 * 3600 + 3 * 60 + 4) * 1000)
  await page.goto('/')
  const island = page.locator('[data-island="announcement-countdown"]')
  await expect(island).toHaveText(props.show_seconds ? 'Ends in 1d 2h 3m 4s.' : 'Ends in 1d 2h 3m.')
  await page.clock.setFixedTime(props.endsAt)
  await expect(island).toHaveText(props.ended_message)
})

// The island inspector runs in `npm run dev` only; Playwright's locators reach into its shadow root.

test('the island inspector lists the islands on the page, and opens with Alt+Shift+I', async ({
  page,
}) => {
  await page.goto(`/products/${products.variants}`)
  const inspector = page.locator('#pelago-inspector')
  await expect(inspector.getByRole('button', { name: '◆ 2 islands' })).toBeVisible()

  await page.keyboard.press('Alt+Shift+KeyI')
  const row = inspector.getByRole('row').filter({ hasText: 'product-form' })
  await expect(row).toContainText('eager')
  await expect(row).toContainText(/\d+ ms/)
  await expect(inspector).toContainText('Data islands on this page:')
})

test('the island inspector shows the props size of an island that replaced its data island', async ({
  page,
}) => {
  await page.goto('/')
  const island = page.locator('[data-island="hello-island"]')
  await expect(island.getByRole('button')).toBeVisible()
  await expect(island.locator('script[data-island-props]')).toHaveCount(0)

  const inspector = page.locator('#pelago-inspector')
  await page.keyboard.press('Alt+Shift+KeyI')
  const row = inspector.getByRole('row').filter({ hasText: 'hello-island' })
  await expect(row).toContainText(/\d+ B/)
})

test('the global data island has the strings the islands use', async ({ page }) => {
  await page.goto('/')
  const global = JSON.parse(
    await page
      .locator('script[data-island-props="global"]')
      .textContent()
      .then((text) => text!),
  ) as { translations: Record<string, string> }
  expect(global.translations).toMatchObject({
    'cart.title': 'Cart',
    'cart.item_count.one': '{{ count }} item',
    'cart.item_count.other': '{{ count }} items',
    'product.add_to_cart': 'Add to cart',
  })
  // only the keys the islands' t() calls use, not the whole locale file
  expect(Object.keys(global.translations)).not.toContain('404.title')
})

test('the cart in the global data island matches /cart.js', async ({ page }) => {
  await page.goto(`/products/${products.variants}`)
  // lines with and without a variant title
  await page.evaluate(
    async (handles) => {
      const ids = await Promise.all(
        handles.map(
          async (handle) => (await (await fetch(`/products/${handle}.js`)).json()).variants[0].id,
        ),
      )
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: ids.map((id) => ({ id, quantity: 2 })) }),
      })
    },
    [products.variants, products.single],
  )

  const html = (await (await page.goto('/'))?.text()) ?? ''
  const json = /<script[^>]*data-island-props="global"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1]
  const { cart } = JSON.parse(json ?? '{}')
  const ajax = await page.evaluate(async () => (await fetch('/cart.js')).json())

  // the island holds a subset of the fields, each one as /cart.js has it; images come from the
  // shop's own CDN path instead of cdn.shopify.com, so they're compared by file
  const file = (url: unknown) => (typeof url === 'string' ? url.split('/').at(-1) : url)
  const pick = (from: Record<string, unknown>, like: Record<string, unknown>) =>
    Object.fromEntries(
      Object.keys(like).map((key) => [key, key === 'image' ? file(from[key]) : from[key]]),
    )
  for (const item of cart.items) item.image = file(item.image)
  expect(cart.items).toHaveLength(2)
  expect(cart).toEqual({
    ...pick(ajax, cart),
    items: ajax.items.map((item: Record<string, unknown>, i: number) => pick(item, cart.items[i])),
  })
  expect(Object.keys(cart.items[0])).toHaveLength(22)
})
