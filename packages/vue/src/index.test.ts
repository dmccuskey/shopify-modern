import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { vueAdapter } from './index.js'

const Greeting = defineComponent({
  props: { name: { type: String, required: true } },
  setup: (props) => () => h('p', `Hello, ${props.name}`),
})

describe('vueAdapter', () => {
  it('mounts a component with props, replacing the fallback markup', () => {
    const el = document.createElement('div')
    el.innerHTML = '<p>fallback</p>'
    const unmount = vueAdapter.mount(el, Greeting, { name: 'island' })
    expect(el.textContent).toBe('Hello, island')
    unmount()
    expect(el.textContent).toBe('')
  })
})
