import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let translations: typeof import('./translations.js')

// as Liquid renders them: `| t` escapes the strings of keys without _html
const strings = {
  'cart.title': 'Cart',
  'cart.terms': 'Tom &amp; Jerry&#39;s &lt;terms&gt;',
  'cart.item_count.one': '{{ count }} item',
  'cart.item_count.few': 'Translation missing: en.cart.item_count.few',
  'cart.item_count.other': '{{ count }} items',
  'blog.article_metadata_html': '{{ date }} by <b>{{ author }}</b>',
  'gift_card.expires_on': 'Expires on {{expires_on}}',
  'missing.key': 'Translation missing: en.missing.key',
}

function renderGlobal(language = 'en'): void {
  document.body.innerHTML = `<script type="application/json" data-island-props="global">${JSON.stringify({ locale: { language }, translations: strings })}</script>`
}

beforeEach(async () => {
  vi.resetModules()
  translations = await import('./translations.js')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('t', () => {
  it('looks up strings from the global data island', () => {
    renderGlobal()
    expect(translations.t('cart.title')).toBe('Cart')
  })

  it('returns plain text for keys without _html', () => {
    renderGlobal()
    expect(translations.t('cart.terms')).toBe("Tom & Jerry's <terms>")
  })

  it('fills placeholders, with or without spaces', () => {
    renderGlobal()
    expect(translations.t('gift_card.expires_on', { expires_on: 'May 1' })).toBe('Expires on May 1')
    expect(translations.t('gift_card.expires_on')).toBe('Expires on {{expires_on}}')
  })

  it('escapes the variables of _html keys', () => {
    renderGlobal()
    expect(
      translations.t('blog.article_metadata_html', { date: 'May 1', author: '<i>A & B</i>' }),
    ).toBe('May 1 by <b>&lt;i&gt;A &amp; B&lt;/i&gt;</b>')
  })

  it('picks the plural form for the count', () => {
    renderGlobal()
    expect(translations.t('cart.item_count', { count: 1 })).toBe('1 item')
    expect(translations.t('cart.item_count', { count: 0 })).toBe('0 items')
    expect(translations.t('cart.item_count', { count: 3 })).toBe('3 items')
  })

  it('falls back to "other" when the locale lacks the form', () => {
    // Polish uses "few" for 3; this page only has "one" and "other"
    renderGlobal('pl')
    expect(translations.t('cart.item_count', { count: 3 })).toBe('3 items')
  })

  it('returns the key, and warns once, for a string the page lacks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderGlobal()
    expect(translations.t('nope.nothing')).toBe('nope.nothing')
    expect(translations.t('nope.nothing')).toBe('nope.nothing')
    expect(translations.t('missing.key')).toBe('missing.key')
    expect(warn).toHaveBeenCalledTimes(2)
  })
})

describe('isHtmlKey', () => {
  it('reads _html from the key, or from the key before its plural form', () => {
    expect(translations.isHtmlKey('search.no_results_html')).toBe(true)
    expect(translations.isHtmlKey('search.results_html.other')).toBe(true)
    expect(translations.isHtmlKey('search.title')).toBe(false)
    expect(translations.isHtmlKey('html.title')).toBe(false)
  })
})
