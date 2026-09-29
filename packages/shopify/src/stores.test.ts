import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let stores: typeof import('./stores.js')

const cart = { token: 'abc', item_count: 2, items: [] }

function renderGlobal(props: unknown): void {
  document.body.innerHTML = `<script type="application/json" data-island-props="global">${JSON.stringify(props)}</script>`
}

beforeEach(async () => {
  vi.resetModules()
  document.body.innerHTML = ''
  stores = await import('./stores.js')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('stores', () => {
  it('are seeded from the global data island when first used', () => {
    renderGlobal({
      locale: { language: 'fr', currency: 'EUR', rootUrl: '/fr' },
      customer: { id: 1, email: 'a@example.com', firstName: 'A', lastName: 'B' },
      cart,
    })
    expect(stores.$locale.get()).toEqual({
      language: 'fr',
      country: '',
      currency: 'EUR',
      moneyFormat: '{{amount}}',
      rootUrl: '/fr',
    })
    expect(stores.$customer.get()?.email).toBe('a@example.com')
    expect(stores.$cart.get()).toEqual(cart)
    expect(stores.$cartOpen.get()).toBe(false)
  })

  it('keep their values after the global data island changes', () => {
    renderGlobal({ locale: { language: 'fr' } })
    expect(stores.$locale.get().language).toBe('fr')
    renderGlobal({ locale: { language: 'de' } })
    expect(stores.$locale.get().language).toBe('fr')
  })

  it('fetch the cart when the global data island has none', async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json(cart)))
    vi.stubGlobal('fetch', fetch)
    renderGlobal({ customer: null })
    const unsubscribe = stores.$cart.subscribe(() => {})
    expect(stores.$customer.get()).toBeNull()
    await vi.waitFor(() => expect(stores.$cart.get()).toEqual(cart))
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0]).toEqual(['/cart.js', expect.objectContaining({ method: 'GET' })])
    unsubscribe()
  })
})
