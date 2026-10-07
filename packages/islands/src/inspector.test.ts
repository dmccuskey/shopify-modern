import { afterEach, describe, expect, it, vi } from 'vitest'
import { startIslands, type Adapter, type Islands } from './islands.js'
import { startInspector } from './inspector.js'

const adapter: Adapter = { mount: () => () => {} }
const registry = { greeting: { load: async () => ({ default: 'Greeting' }), adapter } }

// lets the lazy imports and the inspector's animation frame run
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

let islands: Islands | undefined
let stop: (() => void) | undefined

function start(html: string, open = true) {
  localStorage.setItem('pelago-inspector-open', open ? '1' : '0')
  document.body.innerHTML = html
  islands = startIslands(registry)
  stop = startInspector({
    islands: ['greeting'],
    sizes: { greeting: { size: 4096, gzip: 1536 } },
  })
}

const shadow = () => document.getElementById('pelago-inspector')!.shadowRoot!
const rows = () =>
  [...shadow().querySelectorAll('tbody tr')].map((row) =>
    [...row.children].map((cell) => cell.textContent),
  )

afterEach(() => {
  stop?.()
  islands?.stop()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('startInspector', () => {
  it('lists each island with its rule, mount time, props size and bundle size', async () => {
    start(`
      <div data-island="greeting" data-island-id="a"></div>
      <script type="application/json" data-island-props="a">{"name": "a"}</script>
      <div data-island="greeting" data-island-load="interaction"></div>
      <div data-island="missing"></div>`)
    await settle()
    expect(rows()).toEqual([
      ['greeting', 'eager', expect.stringMatching(/^\d+ ms$/), '13 B', '1.5 KB'],
      ['greeting', 'interaction', 'waiting (interaction)', '–', '1.5 KB'],
      ['missing', '', 'not an island', '–', '–'],
    ])
    expect(shadow().querySelectorAll('.outline')).toHaveLength(3)
    expect(shadow().querySelector('p')?.textContent).toContain(
      'Data islands on this page: 13 B of 30.0 KB',
    )
  })

  it('shows the size of a data island its island replaced when it mounted', async () => {
    const replacing: Adapter = { mount: (el) => (el.replaceChildren('mounted'), () => {}) }
    localStorage.setItem('pelago-inspector-open', '1')
    document.body.innerHTML = `
      <div data-island="greeting" data-island-id="a">
        <script type="application/json" data-island-props="a">{"name": "a"}</script>
      </div>
      <script type="application/json" data-island-props="global">{"shop": 1}</script>`
    islands = startIslands({
      greeting: { load: async () => ({ default: 'Greeting' }), adapter: replacing },
    })
    stop = startInspector()
    await settle()
    expect(document.querySelector('script[data-island-props="a"]')).toBeNull()
    expect(rows()[0]?.[3]).toBe('13 B')
    expect(shadow().querySelector('p')?.textContent).toContain(
      'Data islands on this page: 24 B of 30.0 KB',
    )
  })

  it('updates when an island mounts', async () => {
    start('<div id="a" data-island="greeting" data-island-load="interaction"></div>')
    await settle()
    document.getElementById('a')!.dispatchEvent(new Event('click'))
    await settle()
    expect(rows()[0]?.[2]).toMatch(/^\d+ ms$/)
  })

  it('starts closed, showing only its button, and opens with Alt+Shift+I', async () => {
    start('<div data-island="greeting"></div>', false)
    await settle()
    expect(shadow().querySelector('.toggle')?.textContent).toBe('◆ 1 island')
    expect(shadow().querySelector('table')).toBeNull()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyI' }),
    )
    await settle()
    expect(shadow().querySelector('table')).not.toBeNull()
    expect(localStorage.getItem('pelago-inspector-open')).toBe('1')
  })

  it('removes itself when stopped', () => {
    start('')
    stop!()
    stop = undefined
    expect(document.getElementById('pelago-inspector')).toBeNull()
  })

  it('works without storage', async () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    stop = startInspector()
    await settle()
    expect(shadow().querySelector('table')).toBeNull()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyI' }),
    )
    await settle()
    expect(shadow().querySelector('table')).not.toBeNull()
  })
})
