import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startIslands, type Adapter, type IslandRegistry, type Islands } from './islands.js'
import { events, onEvent, records, type RuntimeEvent } from './records.js'

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
  // failed islands stay recorded
  records.clear()
  events.length = 0
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
      '[pelago] island "broken" failed to mount',
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
    expect(error).toHaveBeenCalledWith('[pelago] island "lazy" failed to mount', expect.any(Error))
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
    expect(warn).toHaveBeenCalledWith('[pelago] unknown data-island-load "lazy", loading eagerly')
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

describe('island records, for the inspector', () => {
  it('shares the records between copies of the module', async () => {
    vi.resetModules()
    const copy = await import('./records.js')
    expect(copy.records).toBe(records)

    expect(copy.events).toBe(events)

    const listener = vi.fn()
    const stop = onEvent(listener)
    const event: RuntimeEvent = {
      area: 'islands',
      type: 'found',
      time: 0,
      root: document,
      islands: [],
      unknown: [],
    }
    copy.emit(event)
    expect(listener).toHaveBeenCalledExactlyOnceWith(event)
    stop()
  })

  it('records each island from scheduled to mounted', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    start('<div id="a" data-island="greeting" data-island-load="bogus"></div>')
    const record = records.get(island('a'))
    expect(record).toMatchObject({ el: island('a'), name: 'greeting', rule: 'eager' })
    await settle()
    const { scheduled, triggered, loaded, mounted } = record!
    expect(scheduled).toBeLessThanOrEqual(triggered!)
    expect(triggered).toBeLessThanOrEqual(loaded!)
    expect(loaded).toBeLessThanOrEqual(mounted!)
  })

  it('measures each mount in the performance timeline', async () => {
    const measure = vi.spyOn(performance, 'measure')
    start('<div data-island="greeting"></div>')
    await settle()
    expect(measure).toHaveBeenCalledWith('[pelago] greeting', {
      start: expect.any(Number),
      end: expect.any(Number),
      detail: { island: 'greeting', load: expect.any(Number), mount: expect.any(Number) },
    })
  })

  it('keeps a failed island, marked failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    start('<div id="a" data-island="broken"></div>', {
      broken: { load: () => Promise.reject(new Error('404')), adapter },
    })
    await settle()
    expect(records.get(island('a'))).toMatchObject({ failed: true })
    expect(records.get(island('a'))?.mounted).toBeUndefined()
  })

  it('forgets an island when it is unmounted, and tells the listeners', async () => {
    const listener = vi.fn()
    const stop = onEvent(listener)
    const islands = start('<div id="a" data-island="greeting"></div>')
    await settle()
    expect(listener).toHaveBeenCalled()
    listener.mockClear()
    islands.unmountIslands()
    expect(records.has(island('a'))).toBe(false)
    expect(listener).toHaveBeenCalledOnce()
    stop()
  })
})

describe('events, for the debug log and the inspector', () => {
  const types = () => events.map((event) => event.type)

  it('tells what it found before the islands load, then each step', async () => {
    start(`
      <div id="a" data-island="greeting"></div>
      <div id="b" data-island="greeting" data-island-load="interaction"></div>
      <div data-island="unknown"></div>`)
    expect(types()).toEqual(['found', 'loading'])
    expect(events[0]).toMatchObject({
      area: 'islands',
      root: document,
      islands: [
        { el: island('a'), rule: 'eager' },
        { el: island('b'), rule: 'interaction' },
      ],
      unknown: ['unknown'],
    })
    await settle()
    expect(types()).toEqual(['found', 'loading', 'mounted'])
    const record = records.get(island('a'))!
    expect(events[1]).toEqual({
      area: 'islands',
      type: 'loading',
      time: record.triggered,
      island: record,
    })
    expect(events[2]).toEqual({
      area: 'islands',
      type: 'mounted',
      time: record.mounted,
      island: record,
    })
  })

  it('says nothing for a pass that finds nothing new', async () => {
    const islands = start('<div data-island="greeting"></div>')
    await settle()
    events.length = 0
    islands.mountIslands()
    expect(events).toEqual([])
  })

  it('tells a failed island, with its error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('404')
    start('<div id="a" data-island="broken"></div>', {
      broken: { load: () => Promise.reject(error), adapter },
    })
    await settle()
    expect(types()).toEqual(['found', 'loading', 'failed'])
    expect(events[2]).toMatchObject({ island: { el: island('a'), failed: true }, error })
  })

  it('tells an unmounted island from one cancelled before it mounted', async () => {
    const islands = start(`
      <div id="a" data-island="greeting"></div>
      <div id="b" data-island="greeting" data-island-load="interaction"></div>`)
    await settle()
    events.length = 0
    islands.unmountIslands()
    expect(events).toMatchObject([
      { type: 'unmounted', island: { el: island('a') } },
      { type: 'cancelled', island: { el: island('b') } },
    ])
  })

  it('keeps the last 200 events', async () => {
    const { emit } = await import('./records.js')
    for (let time = 0; time < 250; time++) {
      emit({ area: 'islands', type: 'found', time, root: document, islands: [], unknown: [] })
    }
    expect(events).toHaveLength(200)
    expect(events[0]?.time).toBe(50)
  })

  it('carries on when a listener throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stop = onEvent(() => {
      throw new Error('broken reader')
    })
    start('<div data-island="greeting"></div>')
    await settle()
    stop()
    expect(mounts).toHaveLength(1)
    expect(error).toHaveBeenCalledWith('[pelago] an event listener failed', expect.any(Error))
  })
})
