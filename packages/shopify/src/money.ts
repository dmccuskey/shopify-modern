import { $locale } from './stores.js'

// Shopify's money format placeholders: [decimal places, thousands separator, decimal separator]
const placeholders: Record<string, [number, string, string]> = {
  amount: [2, ',', '.'],
  amount_no_decimals: [0, ',', '.'],
  amount_with_comma_separator: [2, '.', ','],
  amount_no_decimals_with_comma_separator: [0, '.', ','],
  amount_with_apostrophe_separator: [2, "'", '.'],
  amount_no_decimals_with_space_separator: [0, ' ', ','],
  amount_with_space_separator: [2, ' ', ','],
  amount_with_period_and_space_separator: [2, ' ', '.'],
}

/**
 * Formats an amount in cents (Shopify's unit for every price, in every currency)
 * with a Shopify money format such as `${{amount}}` or `{{amount_with_comma_separator}} €`.
 * The format defaults to the shop's, from `$locale`.
 * A format with an unknown placeholder, or none, is returned as it is.
 */
export function formatMoney(
  cents: number,
  moneyFormat: string = $locale.get().moneyFormat,
): string {
  let zero = true
  const money = moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/, (match, name: string) => {
    const rule = placeholders[name]
    if (!rule) return match
    const amount = formatAmount(Math.abs(cents), ...rule)
    zero = !/[1-9]/.test(amount)
    return amount
  })
  // the sign goes before the currency symbol, as with Liquid's money filter; no "-$0.00"
  return cents < 0 && !zero ? '-' + money : money
}

function formatAmount(cents: number, decimals: number, thousands: string, decimal: string): string {
  // whole cents, so the rounding below is exact
  const total = Math.round(cents)
  const units = decimals ? Math.floor(total / 100) : Math.round(total / 100)
  const whole = String(units).replace(/\B(?=(\d{3})+$)/g, thousands)
  return decimals ? whole + decimal + String(total % 100).padStart(2, '0') : whole
}
