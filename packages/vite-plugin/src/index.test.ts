// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dataIslandSnippet } from '@pelagojs/islands/snippet'
import pelago, { findIslands, islandName, registryModule, type AdapterImport } from './index.js'
import { settingsTypes } from './settings.js'

let theme: string

function write(file: string, content: string) {
  mkdirSync(path.dirname(path.join(theme, file)), { recursive: true })
  writeFileSync(path.join(theme, file), content)
}

beforeEach(() => {
  theme = mkdtempSync(path.join(tmpdir(), 'vite-plugin-'))
})

afterEach(() => rmSync(theme, { recursive: true, force: true }))

const adapters: Record<string, AdapterImport> = {
  '.vue': { from: '@pelagojs/vue', name: 'vueAdapter' },
}

describe('islandName', () => {
  it('turns file names into kebab-case island names', () => {
    expect(islandName('ProductForm')).toBe('product-form')
    expect(islandName('cartDrawer')).toBe('cart-drawer')
    expect(islandName('size_guide')).toBe('size-guide')
    expect(islandName('ABTest')).toBe('ab-test')
    expect(islandName('product-form')).toBe('product-form')
  })
})

describe('findIslands', () => {
  it('finds the components directly in the folder that have an adapter', () => {
    write('src/islands/ProductForm.vue', '')
    write('src/islands/CartDrawer.vue', '')
    write('src/islands/helpers.ts', '')
    write('src/islands/parts/Price.vue', '')
    const dir = path.join(theme, 'src/islands')
    expect(findIslands(dir, adapters).map(({ name, extension }) => ({ name, extension }))).toEqual([
      { name: 'cart-drawer', extension: '.vue' },
      { name: 'product-form', extension: '.vue' },
    ])
  })

  it('rejects two files with the same island name', () => {
    write('src/islands/ProductForm.vue', '')
    write('src/islands/product-form.vue', '')
    expect(() => findIslands(path.join(theme, 'src/islands'), adapters)).toThrow(
      'both island "product-form"',
    )
  })

  it('finds nothing when the folder is missing', () => {
    expect(findIslands(path.join(theme, 'src/islands'), adapters)).toEqual([])
  })
})

describe('registryModule', () => {
  it('imports each component and each adapter lazily', () => {
    const code = registryModule(
      [{ name: 'product-form', file: '/theme/src/islands/ProductForm.vue', extension: '.vue' }],
      adapters,
    )
    expect(code).toBe(
      [
        'const adapter0 = () => import("@pelagojs/vue").then((m) => m.vueAdapter)',
        'export const islands = {',
        '  "product-form": { load: () => import("/theme/src/islands/ProductForm.vue"), adapter: adapter0 },',
        '}',
        '',
      ].join('\n'),
    )
  })

  it('starts the inspector when asked, with the island names and sizes', () => {
    const code = registryModule(
      [{ name: 'product-form', file: '/theme/src/islands/ProductForm.vue', extension: '.vue' }],
      adapters,
      { sizes: { 'product-form': { size: 100, gzip: 50 } } },
    )
    expect(code).toContain(
      `import('@pelagojs/islands/inspector').then((m) => m.startInspector({"islands":["product-form"],"sizes":{"product-form":{"size":100,"gzip":50}}}))`,
    )
    expect(registryModule([], adapters)).not.toContain('inspector')
  })

  it('rejects an adapter name that is not an identifier', () => {
    const island = { name: 'a', file: '/a.vue', extension: '.vue' }
    expect(() =>
      registryModule([island], { '.vue': { from: 'x', name: 'default-adapter' } }),
    ).toThrow('not an identifier')
  })
})

describe('build', () => {
  // a theme whose islands are plain modules, mounted by a local adapter, so the test needs no framework
  function setUpTheme() {
    write('snippets/.keep', '')
    write('assets/critical.css', 'body {}')
    write('assets/vite-old-1234.js', 'old build')
    write('src/adapter.js', 'export const testAdapter = { mount: () => () => {} }')
    write('src/islands/ProductForm.js', 'export default "ProductForm"')
    write('src/theme.js', "import { islands } from 'virtual:islands'\nconsole.log(islands)")
    write(
      'sections/hello.liquid',
      '{% schema %}{ "settings": [{ "type": "text", "id": "heading" }] }{% endschema %}',
    )
  }

  async function buildTheme() {
    await build({
      root: theme,
      configFile: false,
      logLevel: 'silent',
      build: { outDir: 'assets', rollupOptions: { input: path.join(theme, 'src/theme.js') } },
      plugins: [pelago({ adapters: { '.js': { from: '/src/adapter.js', name: 'testAdapter' } } })],
    })
  }

  it('builds the registry into lazy chunks, writes the snippet, and deletes old built files', async () => {
    setUpTheme()
    await buildTheme()

    const assets = readdirSync(path.join(theme, 'assets'))
    expect(assets).toContain('critical.css')
    expect(assets).not.toContain('vite-old-1234.js')
    expect(
      assets
        .filter((file) => file.startsWith('vite-'))
        .map((file) => file.replace(/-[\w-]{8}\.js$/, '')),
    ).toEqual(expect.arrayContaining(['vite-theme', 'vite-ProductForm', 'vite-adapter']))
    const entry = assets.find((file) => file.startsWith('vite-theme-'))!
    const code = readFileSync(path.join(theme, 'assets', entry), 'utf8')
    expect(code).toContain('"product-form"')
    expect(code).not.toContain('mount:')

    expect(readFileSync(path.join(theme, 'snippets/data-island.liquid'), 'utf8')).toBe(
      dataIslandSnippet,
    )

    expect(readFileSync(path.join(theme, 'src/sections.d.ts'), 'utf8')).toBe(
      settingsTypes(theme).source,
    )

    // no t() calls and no locales: an empty object, so the layout's render still works
    expect(readFileSync(path.join(theme, 'snippets/pelago-translations.liquid'), 'utf8')).toMatch(
      /\n\{\}\n$/,
    )
    expect(existsSync(path.join(theme, 'src/translations.d.ts'))).toBe(true)
  })

  it('writes no settings types or translations when turned off', async () => {
    setUpTheme()
    await build({
      root: theme,
      configFile: false,
      logLevel: 'silent',
      build: { outDir: 'assets', rollupOptions: { input: path.join(theme, 'src/theme.js') } },
      plugins: [
        pelago({
          adapters: { '.js': { from: '/src/adapter.js', name: 'testAdapter' } },
          settingsTypes: false,
          translations: false,
        }),
      ],
    })
    expect(existsSync(path.join(theme, 'src/sections.d.ts'))).toBe(false)
    expect(existsSync(path.join(theme, 'snippets/pelago-translations.liquid'))).toBe(false)
    expect(existsSync(path.join(theme, 'src/translations.d.ts'))).toBe(false)
  })

  it('records the size of each island, without the code it shares', async () => {
    setUpTheme()
    // so Vite's cache is in node_modules/.vite, as in a theme
    write('package.json', '{}')
    write('src/shared.js', `export const shared = "${'s'.repeat(2000)}"`)
    write('src/only-cart.js', `export const onlyCart = "${'c'.repeat(3000)}"`)
    write('src/islands/cart.css', `.cart { color: red; }`)
    write(
      'src/islands/CartDrawer.js',
      "import { shared } from '../shared.js'\nimport { onlyCart } from '../only-cart.js'\nimport './cart.css'\nexport default shared + onlyCart",
    )
    write(
      'src/islands/ProductForm.js',
      "import { shared } from '../shared.js'\nexport default shared",
    )
    await buildTheme()

    const sizes = JSON.parse(
      readFileSync(path.join(theme, 'node_modules/.vite/pelago-sizes.json'), 'utf8'),
    )
    expect(Object.keys(sizes)).toEqual(['cart-drawer', 'product-form'])
    // the cart's own code is in its size, the code shared with the product form isn't
    expect(sizes['cart-drawer'].size).toBeGreaterThan(3000)
    expect(sizes['cart-drawer'].size).toBeLessThan(5000)
    expect(sizes['product-form'].size).toBeLessThan(1000)
    expect(sizes['cart-drawer'].gzip).toBeLessThan(sizes['cart-drawer'].size)
  })

  it('keeps the files of the current build when built again', async () => {
    setUpTheme()
    await buildTheme()
    const first = readdirSync(path.join(theme, 'assets'))
    await buildTheme()
    expect(readdirSync(path.join(theme, 'assets'))).toEqual(first)
    expect(existsSync(path.join(theme, 'assets/critical.css'))).toBe(true)
  })
})
