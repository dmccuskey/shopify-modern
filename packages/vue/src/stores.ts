import { useStore } from '@nanostores/vue'
import { $cart, $cartOpen, $customer, $locale } from '@pelagojs/shopify'
import type { Cart, Customer, Locale } from '@pelagojs/shopify'
import { computed, type DeepReadonly, type Ref, type WritableComputedRef } from 'vue'

// Vue bindings for the shared stores in @pelagojs/shopify: see "Shared State" in docs/architecture.md.
// Each one subscribes for the life of the component (or effect scope) that calls it.

/** The cart, as the Ajax Cart API returns it; `null` until it's known. Change it with the cart functions. */
export function useCart(): Readonly<Ref<DeepReadonly<Cart> | null>> {
  return useStore($cart)
}

/** Whether the cart drawer is open. Writable, so it works with `v-model`. */
export function useCartOpen(): WritableComputedRef<boolean> {
  // not @nanostores/vue's useVModel: its types are wrong for an atom without keys
  const open = useStore($cartOpen)
  return computed({ get: () => open.value, set: (value) => $cartOpen.set(value) })
}

/** The logged-in customer, or `null`. */
export function useCustomer(): Readonly<Ref<DeepReadonly<Customer> | null>> {
  return useStore($customer)
}

/** The request's locale and money format. */
export function useLocale(): Readonly<Ref<DeepReadonly<Locale>>> {
  return useStore($locale)
}
