import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let cart: typeof import('./cart.js')
let stores: typeof import('./stores.js')

const emptyCart = { token: 'abc', item_count: 0, items: [] }
const fullCart = { token: 'abc', item_count: 1, items: [{ id: 1, key: '1:x', quantity: 1 }] }

let fetch: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
>

/** A stand-in for the browser's XHR: `send` finishes at once. */
class FakeXhr extends EventTarget {
  url = ''
  open(_method: string, url: string | URL): void {
    this.url = String(url)
  }
  send(): void {
    this.dispatchEvent(new Event('loadend'))
  }
}

function urls(): string[] {
  return fetch.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input))
}

/** Waits until pending promises, such as a refresh, have settled. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve))
}

beforeEach(async () => {
  vi.resetModules()
  // a cart in the global data island, so using $cart doesn't fetch it
  document.body.innerHTML = `<script type="application/json" data-island-props="global">
    {"cart": ${JSON.stringify(emptyCart)}}</script>`
  fetch = vi.fn(() => Promise.resolve(Response.json(fullCart)))
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('XMLHttpRequest', class extends FakeXhr {})
  cart = await import('./cart.js')
  stores = await import('./stores.js')
  // the first use of $cart starts the watcher
  stores.$cart.get()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cart sync', () => {
  it('refreshes $cart after an app changes the cart with fetch', async () => {
    await window.fetch('/cart/add.js', { method: 'POST', body: '{"id":1}' })
    await settle()
    expect(urls()).toEqual(['/cart/add.js', '/cart.js'])
    expect(stores.$cart.get()).toEqual(fullCart)
  })

  it('watches every call that changes the cart, under any locale root, with or without .js', async () => {
    for (const url of [
      '/cart/change.js',
      '/fr/cart/update.js',
      new URL('/cart/clear', location.href),
      new Request(new URL('/cart/add', location.href), { method: 'POST' }),
    ])
      await window.fetch(url)
    await settle()
    expect(urls().filter((url) => url.endsWith('/cart.js'))).toHaveLength(4)
  })

  it('refreshes $cart even when Shopify refuses the change', async () => {
    // a refused add can still add part of the quantity
    fetch.mockResolvedValueOnce(Response.json({ status: 422 }, { status: 422 }))
    await window.fetch('/cart/add.js', { method: 'POST' })
    await settle()
    expect(urls()).toEqual(['/cart/add.js', '/cart.js'])
  })

  it('leaves alone reads, other stores and the cart client’s own calls', async () => {
    await window.fetch('/cart.js')
    await window.fetch('/products/shirt.js')
    await window.fetch('https://example.com/cart/add.js')
    await cart.changeCart({ line: 1, quantity: 0 })
    await settle()
    expect(urls()).toEqual([
      '/cart.js',
      '/products/shirt.js',
      'https://example.com/cart/add.js',
      '/cart/change.js',
    ])
  })

  it('refreshes $cart after an app changes the cart with XHR', async () => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/cart/add.js')
    xhr.send()
    const other = new XMLHttpRequest()
    other.open('GET', '/cart.js')
    other.send()
    await settle()
    expect(urls()).toEqual(['/cart.js'])
    expect(stores.$cart.get()).toEqual(fullCart)
  })

  it('patches fetch and XHR only once', async () => {
    const watched = window.fetch
    const open = XMLHttpRequest.prototype.open
    vi.resetModules()
    await import('./stores.js').then(({ $cart }) => $cart.get())
    expect(window.fetch).toBe(watched)
    expect(XMLHttpRequest.prototype.open).toBe(open)
  })
})
