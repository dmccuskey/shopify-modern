import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { $cart, $cartOpen, $customer, $locale } from '@pelagojs/shopify'
import type { Cart } from '@pelagojs/shopify'
import { useCart, useCartOpen, useCustomer, useLocale, vueAdapter } from './index.js'

const cart = { token: 'abc', item_count: 2, items: [] } as unknown as Cart

beforeEach(() => {
  // the stores seed themselves from the global data island on first use; with a cart there, none is fetched
  document.body.innerHTML = `<script type="application/json" data-island-props="global">${JSON.stringify(
    {
      locale: { language: 'fr', currency: 'EUR' },
      customer: { id: 1, email: 'a@example.com', firstName: 'A', lastName: 'B' },
      cart,
    },
  )}</script>`
})

function mount(setup: () => () => ReturnType<typeof h>) {
  const el = document.createElement('div')
  const unmount = vueAdapter.mount(el, defineComponent({ setup }), {})
  return { el, unmount }
}

describe('store composables', () => {
  it('read the stores, seeded from the global data island', () => {
    const { el, unmount } = mount(() => {
      const cart = useCart()
      const customer = useCustomer()
      const locale = useLocale()
      return () =>
        h(
          'p',
          `${cart.value?.item_count} ${customer.value?.email} ${locale.value.language} ${locale.value.currency}`,
        )
    })
    expect(el.textContent).toBe('2 a@example.com fr EUR')
    unmount()
  })

  it('update the component when a store changes', async () => {
    const { el, unmount } = mount(() => {
      const cart = useCart()
      return () => h('p', String(cart.value?.item_count))
    })
    $cart.set({ ...cart, item_count: 5 })
    await nextTick()
    expect(el.textContent).toBe('5')
    unmount()
  })

  it('write $cartOpen through useCartOpen', async () => {
    $cartOpen.set(false)
    let open: ReturnType<typeof useCartOpen> | undefined
    const { el, unmount } = mount(() => {
      open = useCartOpen()
      return () => h('p', String(open!.value))
    })
    expect(el.textContent).toBe('false')
    open!.value = true
    expect($cartOpen.get()).toBe(true)
    await nextTick()
    expect(el.textContent).toBe('true')
    unmount()
  })

  it('unsubscribe when the island unmounts', () => {
    const { unmount } = mount(() => {
      useCart()
      useCartOpen()
      useCustomer()
      useLocale()
      return () => h('p')
    })
    expect([$cart, $cartOpen, $customer, $locale].map((store) => store.lc)).toEqual([1, 1, 1, 1])
    unmount()
    expect([$cart, $cartOpen, $customer, $locale].map((store) => store.lc)).toEqual([0, 0, 0, 0])
  })
})
