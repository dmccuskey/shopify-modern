import { afterEach, describe, expect, it } from 'vitest'
import { readProps } from './props.js'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('readProps', () => {
  it('parses the data island with the given id', () => {
    document.body.innerHTML = `
      <script type="application/json" data-island-props="other">{"name": "other"}</script>
      <script type="application/json" data-island-props="template--1__main">{"name": "main"}</script>`
    expect(readProps('template--1__main')).toEqual({ name: 'main' })
  })

  it('returns null if the data island is missing or empty', () => {
    document.body.innerHTML =
      '<script type="application/json" data-island-props="empty">  </script>'
    expect(readProps('missing')).toBeNull()
    expect(readProps('empty')).toBeNull()
  })

  it('throws if the JSON is invalid', () => {
    document.body.innerHTML =
      '<script type="application/json" data-island-props="bad">{name}</script>'
    expect(() => readProps('bad')).toThrow(SyntaxError)
  })

  it('matches ids that would need escaping in a selector', () => {
    document.body.innerHTML =
      '<script type="application/json" data-island-props="a&quot;b">1</script>'
    expect(readProps('a"b')).toBe(1)
  })
})
