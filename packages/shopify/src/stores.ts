import { atom, onMount } from 'nanostores'
import { readProps } from '@shopify-modern/islands'
import type { Cart } from './cart.js'
import { refreshCart } from './cart.js'

/** The shop's language, country, currency and money format for this request. */
export interface Locale {
  /** `request.locale.iso_code`, such as `en` or `fr-CA` */
  language: string
  /** `localization.country.iso_code`, such as `US` */
  country: string
  /** `cart.currency.iso_code`, such as `USD` */
  currency: string
  /** `shop.money_format`, such as `${{amount}}` */
  moneyFormat: string
  /** `routes.root_url`: `/`, or `/fr` when the store serves the locale from a subfolder */
  rootUrl: string
}

/** The logged-in customer, as the global data island serializes it. */
export interface Customer {
  id: number
  email: string
  firstName: string
  lastName: string
}

/**
 * The props of the global data island, `data-island-props="global"`,
 * rendered once in `layout/theme.liquid` (see "Shared State" in docs/architecture.md).
 * Every field is optional, so a theme can leave out what it doesn't use.
 */
export interface GlobalProps {
  locale?: Partial<Locale>
  customer?: Customer | null
  cart?: Cart | null
}

const defaultLocale: Locale = {
  language: 'en',
  country: '',
  currency: '',
  moneyFormat: '{{amount}}',
  rootUrl: '/',
}

/** The cart, as the Ajax Cart API returns it; `null` until it's known. Updated by the cart client. */
export const $cart = atom<Cart | null>(null)
/** Whether the cart drawer (or whatever shows the cart) is open. */
export const $cartOpen = atom(false)
/** The logged-in customer, or `null`. */
export const $customer = atom<Customer | null>(null)
/** The request's locale and money format. */
export const $locale = atom<Locale>(defaultLocale)

// The stores are seeded from the global data island when first used, not on import,
// so the package has no side effects and the island is read after the DOM is ready.
let seeded = false

function seed(): void {
  if (seeded) return
  seeded = true
  const global = readProps<GlobalProps>('global')
  if (global?.locale) $locale.set({ ...defaultLocale, ...global.locale })
  if (global?.customer) $customer.set(global.customer)
  if (global?.cart) $cart.set(global.cart)
}

onMount($locale, seed)
onMount($customer, seed)
onMount($cart, () => {
  seed()
  // without a cart in the global data island, fetch it
  if (!$cart.get())
    refreshCart().catch((error: unknown) => console.error('[shopify-modern]', error))
})
