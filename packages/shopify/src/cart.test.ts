import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let cart: typeof import('./cart.js')
let stores: typeof import('./stores.js')

const emptyCart = { token: 'abc', item_count: 0, items: [] }
const fullCart = { token: 'abc', item_count: 1, items: [{ id: 1, key: '1:x', quantity: 1 }] }

let fetch: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>

function body(call: number): unknown {
  return JSON.parse(fetch.mock.calls[call]![1].body as string)
}

beforeEach(async () => {
  vi.resetModules()
  // a cart in the global data island, so using $cart doesn't fetch it
  document.body.innerHTML = `<script type="application/json" data-island-props="global">
    {"locale": {"rootUrl": "/fr"}, "cart": ${JSON.stringify(emptyCart)}}</script>`
  fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  cart = await import('./cart.js')
  stores = await import('./stores.js')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cart client', () => {
  it('fetches the cart under the locale root and updates $cart', async () => {
    fetch.mockResolvedValueOnce(Response.json(fullCart))
    await expect(cart.refreshCart()).resolves.toEqual(fullCart)
    expect(fetch.mock.calls[0]![0]).toBe('/fr/cart.js')
    expect(stores.$cart.get()).toEqual(fullCart)
  })

  it('adds items, then refreshes $cart', async () => {
    fetch
      .mockResolvedValueOnce(Response.json({ items: fullCart.items }))
      .mockResolvedValueOnce(Response.json(fullCart))
    await expect(cart.addToCart({ id: 1, quantity: 1 })).resolves.toEqual(fullCart.items)
    expect(fetch.mock.calls[0]![0]).toBe('/fr/cart/add.js')
    expect(fetch.mock.calls[0]![1].method).toBe('POST')
    expect(body(0)).toEqual({ items: [{ id: 1, quantity: 1 }] })
    expect(fetch.mock.calls[1]![0]).toBe('/fr/cart.js')
    expect(stores.$cart.get()).toEqual(fullCart)
  })

  it('throws a CartError with Shopify’s message, and leaves $cart alone', async () => {
    fetch.mockResolvedValueOnce(
      Response.json(
        { status: 422, message: 'Cart Error', description: 'The product is already sold out.' },
        { status: 422 },
      ),
    )
    const error = await cart.addToCart({ id: 1 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(cart.CartError)
    expect(error).toMatchObject({
      status: 422,
      message: 'Cart Error',
      description: 'The product is already sold out.',
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(stores.$cart.get()).toEqual(emptyCart)
  })

  it('throws a CartError for a response that isn’t JSON', async () => {
    fetch.mockResolvedValueOnce(new Response('oops', { status: 500, statusText: 'Server Error' }))
    await expect(cart.refreshCart()).rejects.toMatchObject({
      status: 500,
      message: 'Server Error',
      description: null,
    })
  })

  it('changes, updates and clears the cart, updating $cart', async () => {
    fetch.mockImplementation(() => Promise.resolve(Response.json(fullCart)))
    await cart.changeCart({ id: '1:x', quantity: 2 })
    await cart.updateCart({ note: 'gift' })
    await cart.clearCart()
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/fr/cart/change.js',
      '/fr/cart/update.js',
      '/fr/cart/clear.js',
    ])
    expect(body(0)).toEqual({ id: '1:x', quantity: 2 })
    expect(body(1)).toEqual({ note: 'gift' })
    expect(stores.$cart.get()).toEqual(fullCart)
  })

  it('keeps the newest request’s cart when responses arrive out of order', async () => {
    let answerFirst!: (response: Response) => void
    fetch
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce(Response.json(fullCart))
    const first = cart.changeCart({ line: 1, quantity: 0 })
    await cart.changeCart({ line: 1, quantity: 1 })
    answerFirst(Response.json(emptyCart))
    await first
    expect(stores.$cart.get()).toEqual(fullCart)
  })
})
