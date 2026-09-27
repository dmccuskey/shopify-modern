import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startIslands, type Adapter, type IslandRegistry, type Islands } from './islands.js'

// a fake adapter that records mounts, and writes the props into the element
const mounts: { el: HTMLElement; props: object }[] = []
const unmounts: HTMLElement[] = []
const adapter: Adapter = {
  mount(el, _component, props) {
    mounts.push({ el, props })
    el.textContent = `mounted ${JSON.stringify(props)}`
    return () => unmounts.push(el)
  },
}

const registry: IslandRegistry = {
  greeting: { load: async () => ({ default: 'Greeting' }), adapter },
}

// lets the lazy imports resolve
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

let islands: Islands | undefined

function start(html: string, reg: IslandRegistry = registry) {
  document.body.innerHTML = html
  islands = startIslands(reg)
  return islands
}

const island = (id: string) => document.getElementById(id) as HTMLElement

beforeEach(() => {
  mounts.length = 0
  unmounts.length = 0
})

afterEach(() => {
  islands?.stop()
  islands = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('startIslands', () => {
  it('mounts each island with the props from its data island', async () => {
    start(`
      <div id="a" data-island="greeting" data-island-id="section-a"><p>fallback</p></div>
      <script type="application/json" data-island-props="section-a">{"name": "a"}</script>
      <div id="b" data-island="greeting"></div>`)
    await settle()
    expect(mounts).toEqual([
      { el: island('a'), props: { name: 'a' } },
      { el: island('b'), props: {} },
    ])
    expect(island('a').textContent).toBe('mounted {"name":"a"}')
  })

  it('finds a data island inside the mount element', async () => {
    start(`
      <div id="a" data-island="greeting" data-island-id="section-a">
        <script type="application/json" data-island-props="section-a">{"name": "a"}</script>
      </div>`)
    await settle()
    expect(mounts[0]?.props).toEqual({ name: 'a' })
  })

  it('skips islands that are not in the registry', async () => {
    start('<div data-island="unknown"></div>')
    await settle()
    expect(mounts).toEqual([])
  })

  it('mounts each island once', async () => {
    const islands = start('<div id="a" data-island="greeting"></div>')
    islands.mountIslands()
    await settle()
    islands.mountIslands()
    await settle()
    expect(mounts).toHaveLength(1)
  })

  it('waits for DOMContentLoaded while the document is loading', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    start('<div data-island="greeting"></div>')
    await settle()
    expect(mounts).toHaveLength(0)
    document.dispatchEvent(new Event('DOMContentLoaded'))
    await settle()
    expect(mounts).toHaveLength(1)
  })

  it('logs an island that fails to load, and mounts the others', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    start('<div data-island="broken"></div><div id="a" data-island="greeting"></div>', {
      ...registry,
      broken: { load: () => Promise.reject(new Error('404')), adapter },
    })
    await settle()
    expect(mounts.map((m) => m.el)).toEqual([island('a')])
    expect(error).toHaveBeenCalledWith(
      '[shopify-modern] island "broken" failed to mount',
      expect.any(Error),
    )
  })

  it('loads a lazy adapter with the component', async () => {
    const loadAdapter = vi.fn(async () => adapter)
    start('<div id="a" data-island="lazy"></div><div id="b" data-island="lazy"></div>', {
      lazy: { load: async () => ({ default: 'Lazy' }), adapter: loadAdapter },
    })
    await settle()
    expect(mounts.map((m) => m.el)).toEqual([island('a'), island('b')])
    expect(loadAdapter).toHaveBeenCalledTimes(2)
  })

  it('logs an island whose adapter fails to load, and keeps its fallback markup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    start('<div id="a" data-island="lazy"><p>fallback</p></div>', {
      lazy: {
        load: async () => ({ default: 'Lazy' }),
        adapter: () => Promise.reject(new Error('404')),
      },
    })
    await settle()
    expect(mounts).toEqual([])
    expect(island('a').innerHTML).toBe('<p>fallback</p>')
    expect(error).toHaveBeenCalledWith(
      '[shopify-modern] island "lazy" failed to mount',
      expect.any(Error),
    )
  })

  it('does not mount an island unmounted while its component loads', async () => {
    let resolve: (module: { default: unknown }) => void = () => {}
    const islands = start('<div data-island="slow"></div>', {
      slow: { load: () => new Promise((r) => (resolve = r)), adapter },
    })
    islands.unmountIslands()
    resolve({ default: 'Slow' })
    await settle()
    expect(mounts).toEqual([])
  })

  it('unmounts every island on stop', async () => {
    const islands = start('<div id="a" data-island="greeting"></div>')
    await settle()
    islands.stop()
    expect(unmounts).toEqual([island('a')])
  })
})

describe('loading rules', () => {
  it('mounts visible islands when they scroll into view', async () => {
    let report: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          report = callback
        }
        observe() {}
        disconnect = disconnect
      },
    )
    start('<div data-island="greeting" data-island-load="visible"></div>')
    await settle()
    report([{ isIntersecting: false }])
    await settle()
    expect(mounts).toHaveLength(0)
    report([{ isIntersecting: true }])
    await settle()
    expect(mounts).toHaveLength(1)
    expect(disconnect).toHaveBeenCalled()
  })

  it('mounts idle islands when the browser is idle', async () => {
    let idle = () => {}
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => ((idle = callback), 1))
    vi.stubGlobal('cancelIdleCallback', () => {})
    start('<div data-island="greeting" data-island-load="idle"></div>')
    await settle()
    expect(mounts).toHaveLength(0)
    idle()
    await settle()
    expect(mounts).toHaveLength(1)
  })

  it('mounts idle islands after a timeout without requestIdleCallback', async () => {
    vi.useFakeTimers()
    try {
      const original = window.requestIdleCallback
      // @ts-expect-error: removing it, as in Safari
      delete window.requestIdleCallback
      start('<div data-island="greeting" data-island-load="idle"></div>')
      window.requestIdleCallback = original
      await vi.advanceTimersByTimeAsync(100)
      expect(mounts).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(100)
      expect(mounts).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['pointerenter', 'focusin', 'click'])(
    'mounts interaction islands on the first %s',
    async (type) => {
      start(
        '<div id="a" data-island="greeting" data-island-load="interaction"><button>open</button></div>',
      )
      await settle()
      expect(mounts).toHaveLength(0)
      island('a').dispatchEvent(new Event(type))
      island('a').dispatchEvent(new Event(type))
      await settle()
      expect(mounts).toHaveLength(1)
    },
  )

  it('cancels an island that has not mounted yet', async () => {
    const islands = start(
      '<div id="a" data-island="greeting" data-island-load="interaction"></div>',
    )
    islands.unmountIslands()
    island('a').dispatchEvent(new Event('click'))
    await settle()
    expect(mounts).toHaveLength(0)
  })

  it('loads an unknown rule eagerly, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    start('<div data-island="greeting" data-island-load="lazy"></div>')
    await settle()
    expect(mounts).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(
      '[shopify-modern] unknown data-island-load "lazy", loading eagerly',
    )
  })
})

describe('theme editor', () => {
  const section = (id: string, island: string) =>
    `<div id="${id}" class="shopify-section"><div id="${island}" data-island="greeting"></div></div>`

  it('unmounts the islands of an unloaded section only', async () => {
    start(section('s1', 'a') + section('s2', 'b'))
    await settle()
    island('s1').dispatchEvent(new Event('shopify:section:unload', { bubbles: true }))
    expect(unmounts).toEqual([island('a')])
  })

  it('mounts the islands of a loaded section', async () => {
    start(section('s1', 'a'))
    await settle()
    const first = island('a')
    island('s1').dispatchEvent(new Event('shopify:section:unload', { bubbles: true }))
    // the theme editor replaces the section with a new render
    island('s1').outerHTML = section('s1', 'a2')
    island('s1').dispatchEvent(new Event('shopify:section:load', { bubbles: true }))
    await settle()
    expect(mounts.map((m) => m.el)).toEqual([first, island('a2')])
  })

  it('mounts and unmounts a section that is itself an island', async () => {
    const islands = start('<div id="a" data-island="greeting"></div>')
    await settle()
    islands.unmountIslands(island('a'))
    expect(unmounts).toEqual([island('a')])
    islands.mountIslands(island('a'))
    await settle()
    expect(mounts).toHaveLength(2)
  })

  it('stops listening on stop', async () => {
    const islands = start(section('s1', 'a'))
    await settle()
    islands.stop()
    island('s1').dispatchEvent(new Event('shopify:section:load', { bubbles: true }))
    await settle()
    expect(mounts).toHaveLength(1)
  })
})
