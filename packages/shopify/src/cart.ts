import { maxSections, renderSections, type SectionsHtml } from './sections.js'
import { $cart, $locale } from './stores.js'

/** A line in the cart. The fields most islands need; the Ajax Cart API returns more. */
export interface CartItem {
  /** the variant ID */
  id: number
  /** identifies the line, including its properties; use it to change a line */
  key: string
  quantity: number
  variant_id: number
  product_id: number
  title: string
  product_title: string
  variant_title: string | null
  handle: string
  url: string
  image: string | null
  sku: string | null
  vendor: string
  /** in cents, like every price below */
  price: number
  original_price: number
  final_price: number
  line_price: number
  original_line_price: number
  final_line_price: number
  properties: Record<string, string> | null
  options_with_values: { name: string; value: string }[]
  requires_shipping: boolean
}

/** The cart, as `/cart.js` returns it. The fields most islands need; the API returns more. */
export interface Cart {
  /** missing from the cart in the global data island: the example theme's `cart-json` snippet leaves it out */
  token?: string
  note: string | null
  attributes: Record<string, string>
  item_count: number
  items: CartItem[]
  currency: string
  /** in cents, like every price below */
  total_price: number
  original_total_price: number
  items_subtotal_price: number
  total_discount: number
  requires_shipping: boolean
}

/** A line to add: the variant ID and a quantity (1 if left out). */
export interface CartAddItem {
  id: number
  quantity?: number
  properties?: Record<string, string>
  selling_plan?: number
}

/** A change to one line, found by its `key` (or its variant `id`, or its 1-based `line`). */
export type CartChange = ({ id: string | number } | { line: number }) & {
  quantity?: number
  properties?: Record<string, string>
  selling_plan?: number | null
}

/** Changes to several lines, the note or the attributes at once. */
export interface CartUpdate {
  /** quantities by line key or variant ID; 0 removes the line */
  updates?: Record<string, number>
  note?: string
  attributes?: Record<string, string>
}

/**
 * Sections to render with a cart change (the Ajax Cart API's `sections` option),
 * which saves a Section Rendering API request after it.
 */
export interface CartSectionsOptions {
  /** section IDs; Shopify renders five with the change, and the rest take a `renderSections` call after it */
  sections: string[]
  /** the page to render them in the context of (the current one by default) */
  sectionsUrl?: string
}

/** The cart, with the sections asked for. */
export type CartWithSections = Cart & { sections: SectionsHtml }

/** The lines added, with the sections asked for. */
export interface CartAddWithSections {
  items: CartItem[]
  sections: SectionsHtml
}

/** An error from the Ajax Cart API, such as an item that is out of stock. */
export class CartError extends Error {
  override name = 'CartError'

  constructor(
    /** the HTTP status, such as 422 */
    readonly status: number,
    message: string,
    /** Shopify's explanation, fit to show to the customer */
    readonly description: string | null,
  ) {
    super(message)
  }
}

/** The cart client's own requests, which the cart sync (sync.ts) leaves alone: they update `$cart` themselves. */
export const ownRequests = new WeakSet<RequestInit>()

// Responses can arrive out of order; only the newest request's cart is kept.
let lastSent = 0
let lastApplied = 0

async function request<T>(path: string, body?: unknown): Promise<T> {
  const url = $locale.get().rootUrl.replace(/\/$/, '') + path
  const init: RequestInit = {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
  ownRequests.add(init)
  const response = await fetch(url, init)
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (json ?? {}) as { message?: string; description?: string | null }
    throw new CartError(
      response.status,
      error.message ?? response.statusText,
      error.description ?? null,
    )
  }
  return json as T
}

async function cartRequest(
  path: string,
  body?: object,
  options?: CartSectionsOptions,
): Promise<Cart | CartWithSections> {
  const sent = ++lastSent
  const { sections, ...cart } = await request<Cart & { sections?: SectionsHtml }>(
    path,
    withSections(body, options),
  )
  if (sent > lastApplied) {
    lastApplied = sent
    $cart.set(cart)
  }
  return options ? { ...cart, sections: await withRest(sections, options) } : cart
}

// Shopify drops every section, silently, when asked for more than five; the rest are rendered after.
function withSections<T extends object | undefined>(body: T, options?: CartSectionsOptions): T {
  const first = options?.sections.slice(0, maxSections) ?? []
  if (first.length === 0) return body
  return { ...body, sections: first, sections_url: options?.sectionsUrl } as T
}

async function withRest(
  sections: SectionsHtml | undefined,
  options: CartSectionsOptions,
): Promise<SectionsHtml> {
  const rest = options.sections.slice(maxSections)
  if (rest.length === 0) return sections ?? {}
  return { ...sections, ...(await renderSections(rest, options.sectionsUrl)) }
}

/** Fetches the cart (`/cart.js`) and updates `$cart`. */
export function refreshCart(): Promise<Cart> {
  return cartRequest('/cart.js')
}

/**
 * Adds one or more lines to the cart (`/cart/add.js`), then refreshes `$cart`.
 * Returns the lines added, or, with `sections`, the lines and the sections' HTML. Throws a `CartError` if Shopify refuses, for example when an item is sold out.
 * `$cart` is refreshed even then, because a refusal can still add part of the quantity
 * ("Only 50 items were added to your cart due to availability."). A failed refresh is logged, not thrown.
 * A refused add renders no sections.
 */
export async function addToCart(items: CartAddItem | CartAddItem[]): Promise<CartItem[]>
export async function addToCart(
  items: CartAddItem | CartAddItem[],
  options: CartSectionsOptions,
): Promise<CartAddWithSections>
export async function addToCart(
  items: CartAddItem | CartAddItem[],
  options?: CartSectionsOptions,
): Promise<CartItem[] | CartAddWithSections> {
  try {
    const added = await request<{ items: CartItem[]; sections?: SectionsHtml }>(
      '/cart/add.js',
      withSections({ items: Array.isArray(items) ? items : [items] }, options),
    )
    if (!options) return added.items
    return { items: added.items, sections: await withRest(added.sections, options) }
  } finally {
    await refreshCart().catch((error: unknown) => console.error('[pelago]', error))
  }
}

/**
 * Changes one line's quantity or properties (`/cart/change.js`); quantity 0 removes it. Updates `$cart`.
 * Returns the cart, with the sections' HTML when `sections` is given.
 */
export function changeCart(change: CartChange): Promise<Cart>
export function changeCart(
  change: CartChange,
  options: CartSectionsOptions,
): Promise<CartWithSections>
export function changeCart(change: CartChange, options?: CartSectionsOptions): Promise<Cart> {
  return cartRequest('/cart/change.js', change, options)
}

/**
 * Changes several lines, the note or the attributes (`/cart/update.js`). Updates `$cart`.
 * Returns the cart, with the sections' HTML when `sections` is given.
 */
export function updateCart(update: CartUpdate): Promise<Cart>
export function updateCart(
  update: CartUpdate,
  options: CartSectionsOptions,
): Promise<CartWithSections>
export function updateCart(update: CartUpdate, options?: CartSectionsOptions): Promise<Cart> {
  return cartRequest('/cart/update.js', update, options)
}

/**
 * Removes every line from the cart (`/cart/clear.js`). Updates `$cart`.
 * Returns the cart, with the sections' HTML when `sections` is given.
 */
export function clearCart(): Promise<Cart>
export function clearCart(options: CartSectionsOptions): Promise<CartWithSections>
export function clearCart(options?: CartSectionsOptions): Promise<Cart> {
  return cartRequest('/cart/clear.js', {}, options)
}
