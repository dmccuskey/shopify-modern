import { ownRequests, refreshCart } from './cart.js'

// Apps change the cart with their own fetch and XHR calls, behind the theme's back.
// Watching those calls keeps $cart, and every island showing it, up to date.

/** Ajax Cart API calls that change the cart, with or without `.js`, under any locale root. */
const cartChange = /\/cart\/(add|change|update|clear)(\.js)?$/

// Marks a patched `fetch` or `XMLHttpRequest`, so a second copy of this package doesn't patch it again.
const patched = Symbol.for('shopify-modern.cart-sync')

function changesCart(url: string | URL): boolean {
  const resolved = new URL(url, location.href)
  return resolved.origin === location.origin && cartChange.test(resolved.pathname)
}

function refresh(): void {
  refreshCart().catch((error: unknown) => console.error('[shopify-modern]', error))
}

function watchFetch(): void {
  const original = window.fetch as typeof fetch & { [patched]?: true }
  if (original[patched]) return
  const watched: typeof fetch & { [patched]?: true } = (input, init) => {
    const response = original(input, init)
    const url = input instanceof Request ? input.url : input
    if (!(init && ownRequests.has(init)) && changesCart(url)) response.then(refresh, refresh)
    return response
  }
  watched[patched] = true
  window.fetch = watched
}

function watchXhr(): void {
  const proto = XMLHttpRequest.prototype as XMLHttpRequest & { [patched]?: true }
  if (proto[patched]) return
  proto[patched] = true
  const open = proto.open as (this: XMLHttpRequest, ...args: unknown[]) => void
  proto.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    const url = args[1] as string | URL
    if (changesCart(url)) this.addEventListener('loadend', refresh, { once: true })
    open.apply(this, args)
  } as typeof proto.open
}

/**
 * Refreshes `$cart` after each `fetch` or XHR call that changes the cart, other than the cart client's own.
 * Started when `$cart` is first used; patches `fetch` and `XMLHttpRequest` once, and stays on.
 */
export function watchCartRequests(): void {
  if (typeof window.fetch === 'function') watchFetch()
  if (typeof XMLHttpRequest === 'function') watchXhr()
}
