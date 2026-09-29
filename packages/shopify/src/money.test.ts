import { beforeEach, describe, expect, it, vi } from 'vitest'

// fresh modules per test, so the stores read the global data island again
let formatMoney: typeof import('./money.js').formatMoney

beforeEach(async () => {
  vi.resetModules()
  document.body.innerHTML = ''
  ;({ formatMoney } = await import('./money.js'))
})

describe('formatMoney', () => {
  it.each([
    ['${{amount}}', 123456789, '$1,234,567.89'],
    ['${{amount_no_decimals}}', 123456789, '$1,234,568'],
    ['{{amount_with_comma_separator}} €', 123456, '1.234,56 €'],
    ['{{amount_no_decimals_with_comma_separator}} kr', 123456, '1.235 kr'],
    ['CHF {{amount_with_apostrophe_separator}}', 123456, "CHF 1'234.56"],
    ['{{amount_no_decimals_with_space_separator}} Kč', 123456, '1 235 Kč'],
    ['{{amount_with_space_separator}} €', 123456, '1 234,56 €'],
    ['{{amount_with_period_and_space_separator}} €', 123456, '1 234.56 €'],
  ])('formats %s', (format, cents, expected) => {
    expect(formatMoney(cents, format)).toBe(expected)
  })

  it('formats small and zero amounts', () => {
    expect(formatMoney(5, '${{amount}}')).toBe('$0.05')
    expect(formatMoney(0, '${{amount}}')).toBe('$0.00')
    expect(formatMoney(100000, '${{amount}}')).toBe('$1,000.00')
    expect(formatMoney(99999, '${{amount}}')).toBe('$999.99')
  })

  it('rounds fractions of a cent and whole units without decimals', () => {
    expect(formatMoney(1999.6, '${{amount}}')).toBe('$20.00')
    expect(formatMoney(150, '${{amount_no_decimals}}')).toBe('$2')
    expect(formatMoney(149, '${{amount_no_decimals}}')).toBe('$1')
  })

  it('puts the sign of a negative amount first, and leaves it off a zero', () => {
    expect(formatMoney(-123456, '${{amount}}')).toBe('-$1,234.56')
    expect(formatMoney(-40, '${{amount_no_decimals}}')).toBe('$0')
    expect(formatMoney(-1000, '{{price}}')).toBe('{{price}}')
  })

  it('allows spaces inside the placeholder', () => {
    expect(formatMoney(1000, '${{ amount }}')).toBe('$10.00')
  })

  it('returns a format with an unknown placeholder, or none, as it is', () => {
    expect(formatMoney(1000, '{{price}}')).toBe('{{price}}')
    expect(formatMoney(1000, 'free')).toBe('free')
  })

  it("defaults to the shop's money format from the global data island", () => {
    document.body.innerHTML = `<script type="application/json" data-island-props="global">
      {"locale": {"moneyFormat": "£{{amount}}"}}</script>`
    expect(formatMoney(1050)).toBe('£10.50')
  })

  it('defaults to the amount alone without a global data island', () => {
    expect(formatMoney(1050)).toBe('10.50')
  })
})
