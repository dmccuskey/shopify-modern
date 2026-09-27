/**
 * Mounts a component on an element. Each framework adapter implements this.
 * Returns a function that unmounts the component.
 */
export interface Adapter {
  mount(el: HTMLElement, component: unknown, props: object): () => void
}
