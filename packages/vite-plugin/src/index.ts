import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { normalizePath, type Plugin, type ResolvedConfig, type ViteDevServer } from 'vite'
import { dataIslandSnippet, dataIslandSnippetFile } from '@pelagojs/islands/snippet'

/** Where an adapter comes from: `import { [name] } from '[from]'`. */
export interface AdapterImport {
  from: string
  name: string
}

export interface PelagoOptions {
  /** The folder of island components, relative to Vite's root. Default: `src/islands`. */
  islandsDir?: string
  /** The adapter for each component file extension. Default: `.vue` files use `@pelagojs/vue`. */
  adapters?: Record<string, AdapterImport>
  /** The theme's folder, relative to Vite's root. Default: Vite's root. */
  themeRoot?: string
  /** Write `snippets/data-island.liquid` into the theme on every dev run and build. Default: `true`. */
  snippet?: boolean
  /**
   * The prefix of the built files in `assets/`. Old files with this prefix are deleted after each build,
   * so it must not match the theme's own assets. Default: `vite-`.
   */
  assetPrefix?: string
}

const defaultAdapters: Record<string, AdapterImport> = {
  '.vue': { from: '@pelagojs/vue', name: 'vueAdapter' },
}

const virtualId = 'virtual:islands'
const resolvedVirtualId = '\0' + virtualId

/**
 * The Pelago Vite plugin. It generates the island registry (`import { islands } from 'virtual:islands'`)
 * from the island folder, writes the data island snippet into the theme, and deletes old built files from `assets/`.
 */
export default function pelago(options: PelagoOptions = {}): Plugin {
  const adapters = options.adapters ?? defaultAdapters
  const assetPrefix = options.assetPrefix ?? 'vite-'
  let config: ResolvedConfig
  let islandsDir: string

  return {
    name: 'pelago',

    config(userConfig) {
      const build = userConfig.build
      // name the built files so old ones can be found, unless the theme names them itself
      const output = build?.rolldownOptions?.output ?? build?.rollupOptions?.output
      return {
        build: {
          // the output folder is the theme's assets/, which holds the theme's own files too
          emptyOutDir: build?.emptyOutDir ?? false,
          rollupOptions: output
            ? {}
            : {
                output: {
                  entryFileNames: `${assetPrefix}[name]-[hash].js`,
                  chunkFileNames: `${assetPrefix}[name]-[hash].js`,
                  assetFileNames: `${assetPrefix}[name]-[hash][extname]`,
                },
              },
        },
      }
    },

    configResolved(resolved) {
      config = resolved
      islandsDir = path.resolve(config.root, options.islandsDir ?? 'src/islands')
    },

    buildStart() {
      if (options.snippet === false) return
      const file = path.resolve(
        config.root,
        options.themeRoot ?? '.',
        'snippets',
        dataIslandSnippetFile,
      )
      // rewriting an unchanged file would make Shopify CLI upload it again
      if (existsSync(file) && readFileSync(file, 'utf8') === dataIslandSnippet) return
      writeFileSync(file, dataIslandSnippet)
    },

    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId
    },

    load(id) {
      if (id !== resolvedVirtualId) return
      return registryModule(findIslands(islandsDir, adapters), adapters)
    },

    configureServer(server) {
      // a new or deleted island changes the registry
      const onChange = (file: string) => {
        if (path.dirname(file) === islandsDir && path.extname(file) in adapters)
          reloadRegistry(server)
      }
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
    },

    writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir
      if (!outDir || !assetPrefix || !existsSync(outDir)) return
      for (const file of readdirSync(outDir)) {
        if (file.startsWith(assetPrefix) && !(file in bundle)) rmSync(path.join(outDir, file))
      }
    },
  }
}

interface IslandFile {
  name: string
  file: string
  extension: string
}

/** Finds the island components: the files directly in the island folder with an adapter for their extension. */
export function findIslands(
  islandsDir: string,
  adapters: Record<string, AdapterImport>,
): IslandFile[] {
  if (!existsSync(islandsDir)) return []
  const islands: IslandFile[] = []
  const files = new Map<string, string>()
  for (const entry of readdirSync(islandsDir, { withFileTypes: true })) {
    const extension = path.extname(entry.name)
    if (!entry.isFile() || !(extension in adapters)) continue
    const name = islandName(path.basename(entry.name, extension))
    const other = files.get(name)
    if (other) throw new Error(`[pelago] ${other} and ${entry.name} are both island "${name}"`)
    files.set(name, entry.name)
    islands.push({ name, file: normalizePath(path.join(islandsDir, entry.name)), extension })
  }
  return islands.sort((a, b) => a.name.localeCompare(b.name))
}

/** The island name for a component's file name, as used in `data-island`: `ProductForm` becomes `product-form`. */
export function islandName(fileName: string): string {
  return fileName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

/** The source of `virtual:islands`. Each adapter is imported lazily, so its framework loads only on pages with its islands. */
export function registryModule(
  islands: IslandFile[],
  adapters: Record<string, AdapterImport>,
): string {
  const used = [...new Set(islands.map((island) => island.extension))]
  const adapterVars = new Map(used.map((extension, i) => [extension, `adapter${i}`]))
  const lines = used.map((extension) => {
    const { from, name } = adapters[extension]!
    if (!/^[A-Za-z_$][\w$]*$/.test(name))
      throw new Error(`[pelago] adapter name "${name}" is not an identifier`)
    return `const ${adapterVars.get(extension)} = () => import(${JSON.stringify(from)}).then((m) => m.${name})`
  })
  lines.push('export const islands = {')
  for (const { name, file, extension } of islands) {
    lines.push(
      `  ${JSON.stringify(name)}: { load: () => import(${JSON.stringify(file)}), adapter: ${adapterVars.get(extension)} },`,
    )
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

function reloadRegistry(server: ViteDevServer) {
  const module = server.moduleGraph.getModuleById(resolvedVirtualId)
  if (!module) return
  server.moduleGraph.invalidateModule(module)
  server.ws.send({ type: 'full-reload' })
}
