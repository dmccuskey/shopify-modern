import { afterEach, describe, expect, it, vi } from 'vitest'
import { startDebug } from './debug.js'
import { startIslands, type Adapter, type Islands } from './islands.js'
import { events, records } from './records.js'

const adapter: Adapter = { mount: () => () => {} }
const registry = { greeting: { load: async () => ({ default: 'Greeting' }), adapter } }

// lets the lazy imports resolve
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

let islands: Islands | undefined
let stop: (() => void) | undefined

function start(html: string) {
  document.body.innerHTML = html
  islands = startIslands(registry)
  return islands
}

/** The lines logged so far, without their times. */
function lines(debug: ReturnType<typeof spy>) {
  return debug.mock.calls.map(([line]) => String(line).replace(/\+\d+ ms /, ''))
}

const spy = () => vi.spyOn(console, 'debug').mockImplementation(() => {})

afterEach(() => {
  stop?.()
  stop = undefined
  islands?.stop()
  islands = undefined
  records.clear()
  events.length = 0
  document.body.innerHTML = ''
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('startDebug', () => {
  it('logs a line for each event, with its data', async () => {
    const debug = spy()
    stop = startDebug()
    const { unmountIslands } = start(`
      <div id="a" data-island="greeting" data-island-id="a"></div>
      <script type="application/json" data-island-props="a">{"name": "a"}</script>
      <div data-island="greeting" data-island-load="interaction"></div>`)
    await settle()
    unmountIslands()
    expect(lines(debug)).toEqual([
      '[pelago:islands] found 2 islands',
      '[pelago:islands] greeting: loading (eager)',
      expect.stringMatching(/^\[pelago:islands\] greeting: mounted in \d+ ms$/),
      '[pelago:islands] greeting: unmounted',
      '[pelago:islands] greeting: cancelled before it mounted',
    ])
    expect(debug.mock.calls[0]![0]).toMatch(/^\[pelago:islands\] \+\d+ ms found/)
    const a = document.getElementById('a')
    expect(debug.mock.calls[0]![1]).toMatchObject({
      islands: [
        { name: 'greeting', rule: 'eager', el: a },
        { name: 'greeting', rule: 'interaction' },
      ],
      unknown: [],
      root: document,
    })
    expect(debug.mock.calls[2]![1]).toEqual({
      load: expect.any(Number),
      mount: expect.any(Number),
      props: 13,
      el: a,
    })
  })

  it('logs how long an island waited for its loading rule', async () => {
    const debug = spy()
    stop = startDebug()
    start('<div id="a" data-island="greeting" data-island-load="interaction"></div>')
    document.getElementById('a')!.dispatchEvent(new Event('click'))
    expect(lines(debug)[1]).toMatch(
      /^\[pelago:islands\] greeting: loading \(interaction, waited \d+ ms\)$/,
    )
  })

  it('names the islands that are not in the registry', () => {
    const debug = spy()
    stop = startDebug()
    start('<div data-island="greeting"></div><div data-island="greetings"></div>')
    expect(lines(debug)[0]).toBe(
      '[pelago:islands] found 1 island, and "greetings" not in the registry',
    )
  })

  it('logs what happened before it started', async () => {
    const debug = spy()
    start('<div data-island="greeting"></div>')
    await settle()
    stop = startDebug()
    expect(lines(debug)).toHaveLength(3)
  })

  it('logs no line for a failed island, which has its error', async () => {
    const debug = spy()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stop = startDebug()
    document.body.innerHTML = '<div data-island="broken"></div>'
    islands = startIslands({ broken: { load: () => Promise.reject(new Error('404')), adapter } })
    await settle()
    expect(lines(debug)).toEqual([
      '[pelago:islands] found 1 island',
      '[pelago:islands] broken: loading (eager)',
    ])
  })

  it('logs only the areas asked for', () => {
    const debug = spy()
    stop = startDebug({ areas: [] })
    start('<div data-island="greeting"></div>')
    expect(debug).not.toHaveBeenCalled()
    stop()
    stop = startDebug({ areas: ['islands'] })
    expect(debug).toHaveBeenCalled()
  })

  it('lets the pelago-debug key in localStorage win over the options', () => {
    const debug = spy()
    start('<div data-island="greeting"></div>')
    localStorage.setItem('pelago-debug', '0')
    startDebug({ areas: ['*'] })()
    expect(debug).not.toHaveBeenCalled()
    localStorage.setItem('pelago-debug', 'cart, islands')
    startDebug({ areas: [] })()
    expect(debug).toHaveBeenCalled()
    debug.mockClear()
    localStorage.setItem('pelago-debug', '*')
    startDebug({ areas: [] })()
    expect(debug).toHaveBeenCalled()
  })

  it('stops logging when stopped', () => {
    const debug = spy()
    startDebug()()
    start('<div data-island="greeting"></div>')
    expect(debug).not.toHaveBeenCalled()
  })

  it('works without storage', () => {
    const debug = spy()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    stop = startDebug()
    start('<div data-island="greeting"></div>')
    expect(debug).toHaveBeenCalled()
  })
})
