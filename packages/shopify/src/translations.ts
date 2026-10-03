import { $locale, $translations } from './stores.js'

/**
 * The theme's translation keys and the variables of each, from its `locales/*.default.json`.
 * Empty here: the Vite plugin fills it in the theme's `src/translations.d.ts`, so `t()` checks its keys.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TranslationKeys {}

/** A key of the theme's `locales/*.json`, such as `cart.title`; any string until the theme's keys are generated. */
export type TranslationKey = keyof TranslationKeys extends never
  ? string
  : Extract<keyof TranslationKeys, string>

/** The variables of a translation, such as `{ count: 3 }` for `"{{ count }} items"`. */
export type TranslationVars<K extends string = string> = K extends keyof TranslationKeys
  ? TranslationKeys[K]
  : Record<string, string | number>

// the plural forms of Shopify's locale files, as Intl.PluralRules names them
const pluralForms = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])
const warned = new Set<string>()

/**
 * Looks up a string of the theme's `locales/*.json`, as Liquid's `t` filter does: `t('cart.title')`.
 * The strings are those the islands use, rendered by Liquid into the global data island in the request's locale.
 *
 * `{{ name }}` placeholders are filled from `vars`. With a `count`, a key with plural forms
 * (`one`, `other`, ...) picks the form for the count in the request's language.
 * A key ending in `_html` returns HTML, with the variables escaped, for `v-html`; any other key returns plain text.
 * A key the page doesn't have returns the key itself, with a warning.
 */
export function t<K extends TranslationKey>(key: K, vars?: TranslationVars<K>): string {
  const strings = $translations.get()
  const values = (vars ?? {}) as Record<string, string | number>
  let found: string | undefined = key
  if (typeof values.count === 'number') {
    const form = new Intl.PluralRules($locale.get().language).select(values.count)
    found = [`${key}.${form}`, `${key}.other`].find((plural) => available(strings, plural)) ?? found
  }
  if (!found || !available(strings, found)) {
    if (!warned.has(key)) {
      warned.add(key)
      console.warn(`[pelago] no translation for "${key}" on this page`)
    }
    return key
  }

  const html = isHtmlKey(key)
  // Liquid's t filter escapes the strings of keys without _html: back to plain text
  const text = html ? strings[found]! : unescapeHtml(strings[found]!)
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, name: string) => {
    if (!(name in values)) return match
    const value = String(values[name])
    return html ? escapeHtml(value) : value
  })
}

function available(strings: Record<string, string>, key: string): boolean {
  const value = strings[key]
  // a plural form the locale doesn't have renders as "Translation missing: ..."
  return value !== undefined && !value.startsWith('Translation missing: ')
}

/** Whether a key returns HTML: its name, or the name before its plural form, ends in `_html`, as with Liquid's `t` filter. */
export function isHtmlKey(key: string): boolean {
  const parts = key.split('.')
  if (parts.length > 1 && pluralForms.has(parts.at(-1)!)) parts.pop()
  return parts.at(-1)!.endsWith('_html')
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function unescapeHtml(html: string): string {
  return html.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match
    const code =
      entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : +entity.slice(1)
    return String.fromCodePoint(code)
  })
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' }[c]};`,
  )
}
