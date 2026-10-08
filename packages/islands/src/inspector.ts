import { records, onEvent, type IslandRecord } from './records.js'

/** An island's share of the last build: its own chunks, which no other island or entry loads. */
export interface IslandSize {
  /** Minified bytes. */
  size: number
  /** Gzipped bytes. */
  gzip: number
}

export interface InspectorOptions {
  /** The island names in the registry, to tell an unknown `data-island` from one not scheduled yet. */
  islands?: string[]
  /** Each island's size in the last build, by island name. */
  sizes?: Record<string, IslandSize>
}

/** The budget for the data islands on a page, from ADR 006. */
const propsBudget = 30 * 1024
const storageKey = 'pelago-inspector-open'

/**
 * Starts the island inspector: an overlay showing each island's loading rule, props size, mount time
 * and bundle size. For development only; `@pelagojs/vite-plugin` starts it in `vite dev`.
 * Toggle it with its button or Alt+Shift+I. Returns a function that removes it.
 */
export function startInspector(options: InspectorOptions = {}): () => void {
  const host = document.createElement('div')
  host.id = 'pelago-inspector'
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `<style>${styles}</style><div class="outlines"></div><div class="panel"></div>`
  const outlines = shadow.querySelector<HTMLElement>('.outlines')!
  const panel = shadow.querySelector<HTMLElement>('.panel')!
  document.body.append(host)

  let open = load()
  let highlighted: HTMLElement | undefined
  // the islands with an outline, in the order of the outlines
  let outlined: HTMLElement[] = []
  let frame = 0

  function render() {
    frame = 0
    const islands = findIslands(options.islands)
    // every data island counts toward the budget, including those shared by several islands,
    // and those their island replaced when it mounted
    const onPage = [...document.querySelectorAll('script[data-island-props]')].reduce(
      (sum, script) => sum + byteLength(script.textContent ?? ''),
      0,
    )
    // by id, so one read by two islands before it was replaced counts once
    const replaced = new Map(
      islands.filter((island) => island.replaced).map((island) => [island.id, island.props ?? 0]),
    )
    const propsTotal = [...replaced.values()].reduce((sum, size) => sum + size, onPage)
    const toggle = h('button', { class: 'toggle', title: 'Island inspector (Alt+Shift+I)' }, [
      `◆ ${islands.length} island${islands.length === 1 ? '' : 's'}`,
    ])
    toggle.addEventListener('click', () => setOpen(!open))
    panel.replaceChildren(toggle)
    outlines.replaceChildren()
    outlined = []
    if (!open) return

    const rows = islands.map((island) => {
      const size = options.sizes?.[island.name]
      const row = h('tr', { class: island.state.kind }, [
        h('td', {}, [island.name]),
        h('td', {}, [island.rule ?? '']),
        h('td', { title: island.state.title ?? '' }, [island.state.label]),
        h('td', { class: 'num' }, [island.props === undefined ? '–' : bytes(island.props)]),
        h('td', { class: 'num', title: size ? `${bytes(size.size)} minified` : '' }, [
          size ? bytes(size.gzip) : '–',
        ]),
      ])
      row.addEventListener('pointerenter', () => ((highlighted = island.el), position()))
      row.addEventListener('pointerleave', () => ((highlighted = undefined), position()))
      row.addEventListener('click', () => island.el.scrollIntoView({ block: 'center' }))
      return row
    })
    const sizesNote = options.sizes
      ? 'Bundle: gzipped, from the last build.'
      : 'Bundle: run a build to see sizes.'
    panel.append(
      h('table', {}, [
        h('thead', {}, [
          h(
            'tr',
            {},
            ['Island', 'Rule', 'Mount', 'Props', 'Bundle'].map((t) => h('th', {}, [t])),
          ),
        ]),
        h('tbody', {}, rows),
      ]),
      h('p', { class: propsTotal > propsBudget ? 'over' : '' }, [
        `Data islands on this page: ${bytes(propsTotal)} of ${bytes(propsBudget)}. ${sizesNote}`,
      ]),
    )
    outlined = islands.map((island) => island.el)
    outlines.append(
      ...islands.map((island) =>
        h('div', { class: `outline ${island.state.kind}` }, [
          h('span', {}, [`${island.name} · ${island.rule ?? '?'} · ${island.state.label}`]),
        ]),
      ),
    )
    position()
  }

  // outlines follow their islands as the page scrolls and resizes
  function position() {
    outlined.forEach((el, i) => {
      const outline = outlines.children[i] as HTMLElement
      const rect = el.getBoundingClientRect()
      Object.assign(outline.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
      outline.classList.toggle('highlighted', el === highlighted)
      // labels go above the island, or inside it at the top of the window, and right-aligned in the right half
      outline.classList.toggle('inside', rect.top < 20)
      outline.classList.toggle('right', rect.left + rect.width / 2 > window.innerWidth / 2)
    })
  }

  const update = () => {
    if (!frame) frame = requestAnimationFrame(render)
  }
  const reposition = () => requestAnimationFrame(position)

  function setOpen(value: boolean) {
    open = value
    save(open)
    update()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.altKey && event.shiftKey && event.code === 'KeyI') setOpen(!open)
  }

  const stopRecords = onEvent(update)
  document.addEventListener('keydown', onKey)
  document.addEventListener('shopify:section:load', update)
  document.addEventListener('shopify:section:unload', update)
  window.addEventListener('scroll', reposition, { passive: true, capture: true })
  window.addEventListener('resize', reposition, { passive: true })
  render()

  return () => {
    stopRecords()
    cancelAnimationFrame(frame)
    document.removeEventListener('keydown', onKey)
    document.removeEventListener('shopify:section:load', update)
    document.removeEventListener('shopify:section:unload', update)
    window.removeEventListener('scroll', reposition, { capture: true })
    window.removeEventListener('resize', reposition)
    host.remove()
  }
}

interface InspectedIsland {
  el: HTMLElement
  name: string
  rule?: string
  /** Its `data-island-id`. */
  id?: string
  /** The size of its data island, if it has one. */
  props?: number
  /** Its data island is no longer on the page: `props` is the size the runtime recorded at mount. */
  replaced?: boolean
  state: {
    kind: 'mounted' | 'waiting' | 'loading' | 'failed' | 'unknown'
    label: string
    title?: string
  }
}

/** Every `[data-island]` on the page, in document order, with what the runtime recorded about it. */
function findIslands(registered?: string[]): InspectedIsland[] {
  return [...document.querySelectorAll<HTMLElement>('[data-island]')].map((el) => {
    const name = el.dataset.island ?? ''
    const record = records.get(el)
    const id = el.dataset.islandId
    const json = id
      ? [...document.querySelectorAll('script[data-island-props]')].find(
          (script) => script.getAttribute('data-island-props') === id,
        )?.textContent
      : undefined
    return {
      el,
      name,
      id,
      rule: record?.rule ?? el.dataset.islandLoad,
      // a data island inside the mount element is replaced at mount: the runtime recorded its size
      props: json == null ? record?.props : byteLength(json),
      replaced: json == null && record?.props !== undefined,
      state: record ? state(record) : unscheduled(name, registered),
    }
  })
}

function state(record: IslandRecord): InspectedIsland['state'] {
  const { scheduled, triggered, loaded, mounted, failed } = record
  if (failed) return { kind: 'failed', label: 'failed', title: 'See the console' }
  if (triggered === undefined) return { kind: 'waiting', label: `waiting (${record.rule})` }
  if (mounted === undefined || loaded === undefined) return { kind: 'loading', label: 'loading' }
  return {
    kind: 'mounted',
    label: ms(mounted - triggered),
    title: `load ${ms(loaded - triggered)}, mount ${ms(mounted - loaded)}, waited ${ms(triggered - scheduled)} for "${record.rule}"`,
  }
}

function unscheduled(name: string, registered?: string[]): InspectedIsland['state'] {
  if (registered && !registered.includes(name))
    return {
      kind: 'unknown',
      label: 'not an island',
      title: `No file in src/islands/ for "${name}"`,
    }
  return { kind: 'waiting', label: 'not scheduled' }
}

function h(tag: string, attributes: Record<string, string>, children: (Node | string)[]) {
  const el = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) if (value) el.setAttribute(name, value)
  el.append(...children)
  return el
}

const byteLength = (text: string) => new TextEncoder().encode(text.trim()).length
const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)
const ms = (n: number) => `${Math.round(n)} ms`

function load(): boolean {
  try {
    return localStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

function save(open: boolean) {
  try {
    localStorage.setItem(storageKey, open ? '1' : '0')
  } catch {
    // storage blocked: the inspector starts closed next time
  }
}

const styles = `
:host { all: initial; }
.outlines { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.outline { position: fixed; box-sizing: border-box; border: 2px dashed #7c3aed; }
.outline.mounted { border-style: solid; }
.outline.failed, .outline.unknown { border-color: #dc2626; }
.outline.highlighted { background: rgb(124 58 237 / 0.12); }
.outline span {
  position: absolute; bottom: 100%; left: -2px; padding: 1px 4px; background: #7c3aed; color: #fff;
  font: 11px/1.4 ui-monospace, monospace; white-space: nowrap;
}
.outline.failed span, .outline.unknown span { background: #dc2626; }
.outline.inside span { bottom: auto; top: 0; left: 0; }
.outline.right span { left: auto; right: -2px; }
.outline.inside.right span { right: 0; }
.panel {
  position: fixed; right: 12px; bottom: 12px; z-index: 2147483647; max-width: calc(100vw - 24px);
  max-height: 60vh; overflow: auto; background: #18181b; color: #f4f4f5; border-radius: 6px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.3); font: 12px/1.4 ui-monospace, monospace;
}
.toggle {
  all: unset; display: block; padding: 6px 10px; cursor: pointer; color: #c4b5fd; font: inherit;
}
table { border-collapse: collapse; margin: 0 10px; }
th, td { padding: 3px 8px; text-align: left; white-space: nowrap; }
th { color: #a1a1aa; font-weight: normal; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: #27272a; }
.num { text-align: right; }
tr.failed, tr.unknown { color: #fca5a5; }
tr.waiting, tr.loading { color: #a1a1aa; }
p { margin: 6px 10px 8px; color: #a1a1aa; }
p.over { color: #fca5a5; }
`
