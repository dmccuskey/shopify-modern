import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderSection, renderSections } from './sections.js'

let fetch: ReturnType<typeof vi.fn<(url: URL) => Promise<Response>>>

beforeEach(() => {
  fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  history.replaceState(null, '', '/collections/all?filter.v.availability=1')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('renderSections', () => {
  it('renders sections in the context of the current page', async () => {
    fetch.mockResolvedValueOnce(Response.json({ header: '<header>', missing: null }))
    await expect(renderSections(['header', 'missing'])).resolves.toEqual({
      header: '<header>',
      missing: null,
    })
    const url = fetch.mock.calls[0]![0]
    expect(url.pathname).toBe('/collections/all')
    expect(url.searchParams.get('filter.v.availability')).toBe('1')
    expect(url.searchParams.get('sections')).toBe('header,missing')
  })

  it('takes one request per five sections', async () => {
    fetch.mockImplementation((url) =>
      Promise.resolve(
        Response.json(
          Object.fromEntries(
            url.searchParams
              .get('sections')!
              .split(',')
              .map((id) => [id, id]),
          ),
        ),
      ),
    )
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const html = await renderSections(ids, '/cart')
    expect(html).toEqual(Object.fromEntries(ids.map((id) => [id, id])))
    expect(fetch.mock.calls.map(([url]) => url.searchParams.get('sections'))).toEqual([
      'a,b,c,d,e',
      'f,g',
    ])
    expect(fetch.mock.calls[0]![0].pathname).toBe('/cart')
  })
})

describe('renderSection', () => {
  it('renders one section as HTML', async () => {
    fetch.mockResolvedValueOnce(new Response('<div id="shopify-section-main">'))
    await expect(renderSection('main', '/products/shirt?variant=2')).resolves.toBe(
      '<div id="shopify-section-main">',
    )
    const url = fetch.mock.calls[0]![0]
    expect(url.pathname).toBe('/products/shirt')
    expect(url.searchParams.get('variant')).toBe('2')
    expect(url.searchParams.get('section_id')).toBe('main')
  })

  it('throws if the request fails', async () => {
    fetch.mockResolvedValueOnce(new Response('', { status: 404 }))
    await expect(renderSection('main')).rejects.toThrow('404')
  })
})
