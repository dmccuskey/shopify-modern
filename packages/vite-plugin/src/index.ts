import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { normalizePath, type Plugin, type ResolvedConfig, type ViteDevServer } from 'vite'
import type { IslandSize } from '@pelagojs/islands/inspector'
import { dataIslandSnippet, dataIslandSnippetFile } from '@pelagojs/islands/snippet'
import { settingsTypes } from './settings.js'
import { islandSizes, type OutputBundle } from './sizes.js'
import { translations, translationsSnippetFile } from './translations.js'

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
   * Where to write the types of the settings in the `{% schema %}` of the theme's sections and blocks,
   * relative to Vite's root, or `false` to not write them. Default: `src/sections.d.ts`.
   */
  settingsTypes?: string | false
  /**
   * The prefix of the built files in `assets/`. Old files with this prefix are deleted after each build,
   * so it must not match the theme's own assets. Default: `vite-`.
   */
  assetPrefix?: string
  /**
   * Show the island inspector, an overlay of each island's loading rule, props size, mount time and bundle size,
   * in `vite dev`. Builds never include it. Default: `true`.
   */
  inspector?: boolean
  /**
   * The strings of the theme's `locales/*.json` for `t()` in `@pelagojs/shopify`, or `false` to leave them out.
   * The plugin finds the `t('…')` calls in the island code and writes `snippets/pelago-translations.liquid`,
   * which renders those strings in the request's locale, and the types of the keys.
   */
  translations?: TranslationsOptions | false
}

export interface TranslationsOptions {
  /** The folder to scan for `t('…')` calls, relative to Vite's root. Default: `src`. */
  scanDir?: string
  /** Keys to render even when the scan doesn't find them, such as keys built at runtime. */
  include?: string[]
  /** Where to write the types of the keys, relative to Vite's root, or `false`. Default: `src/translations.d.ts`. */
  types?: string | false
}

const defaultAdapters: Record<string, AdapterImport> = {
  '.vue': { from: '@pelagojs/vue', name: 'vueAdapter' },
}

const virtualId = 'virtual:islands'
const resolvedVirtualId = '\0' + virtualId

/**
 * The Pelago Vite plugin. It generates the island registry (`import { islands } from 'virtual:islands'`)
 * from the island folder, writes the data island snippet and the types of the section settings into the theme,
 * and deletes old built files from `assets/`.
 */
export default function pelago(options: PelagoOptions = {}): Plugin {
  const adapters = options.adapters ?? defaultAdapters
  const assetPrefix = options.assetPrefix ?? 'vite-'
  let config: ResolvedConfig
  let islandsDir: string
  let themeDir: string

  function writeSettingsTypes() {
    if (options.settingsTypes === false) return
    const { source, warnings } = settingsTypes(themeDir)
    for (const warning of warnings) config.logger.warn(`[pelago] ${warning}`)
    writeIfChanged(path.resolve(config.root, options.settingsTypes ?? 'src/sections.d.ts'), source)
  }

  /** Writes the translations snippet and types; warns only when the warnings change, as dev runs this on every save. */
  let translationWarnings = ''
  function writeTranslations() {
    if (options.translations === false) return
    const { scanDir = 'src', include, types: typesFile } = options.translations ?? {}
    const { snippet, types, warnings } = translations({
      themeDir,
      scanDir: path.resolve(config.root, scanDir),
      include,
    })
    if (warnings.join('\n') !== translationWarnings)
      for (const warning of warnings) config.logger.warn(`[pelago] ${warning}`)
    translationWarnings = warnings.join('\n')
    writeIfChanged(path.join(themeDir, 'snippets', translationsSnippetFile), snippet)
    if (typesFile !== false)
      writeIfChanged(path.resolve(config.root, typesFile ?? 'src/translations.d.ts'), types)
  }

  const sizesFile = () => path.join(config.cacheDir, 'pelago-sizes.json')

  /** The island sizes from the last build, if there was one. */
  function readSizes(): Record<string, IslandSize> | undefined {
    try {
      return JSON.parse(readFileSync(sizesFile(), 'utf8')) as Record<string, IslandSize>
    } catch {
      return undefined
    }
  }

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
      themeDir = path.resolve(config.root, options.themeRoot ?? '.')
    },

    buildStart() {
      writeSettingsTypes()
      writeTranslations()
      if (options.snippet === false) return
      writeIfChanged(path.join(themeDir, 'snippets', dataIslandSnippetFile), dataIslandSnippet)
    },

    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId
    },

    load(id) {
      if (id !== resolvedVirtualId) return
      const islands = findIslands(islandsDir, adapters)
      const inspector = config.command === 'serve' && options.inspector !== false
      return registryModule(islands, adapters, inspector ? { sizes: readSizes() } : undefined)
    },

    configureServer(server) {
      // a new or deleted island changes the registry
      const onChange = (file: string) => {
        if (path.dirname(file) === islandsDir && path.extname(file) in adapters)
          reloadRegistry(server)
      }
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)

      // a changed schema changes the settings types
      const onThemeChange = (file: string) => {
        const folder = path.relative(themeDir, path.dirname(file))
        if ((folder === 'sections' || folder === 'blocks') && path.extname(file) === '.liquid')
          writeSettingsTypes()
      }
      server.watcher.on('add', onThemeChange)
      server.watcher.on('change', onThemeChange)
      server.watcher.on('unlink', onThemeChange)

      // a changed island or locale file changes the translations
      const onTranslationsChange = (file: string) => {
        if (options.translations === false) return
        const scanDir = path.resolve(config.root, options.translations?.scanDir ?? 'src')
        const inScanDir = !path.relative(scanDir, file).startsWith('..')
        const isLocale = path.relative(themeDir, path.dirname(file)) === 'locales'
        if ((inScanDir && !file.endsWith('.d.ts')) || (isLocale && file.endsWith('.json')))
          writeTranslations()
      }
      server.watcher.on('add', onTranslationsChange)
      server.watcher.on('change', onTranslationsChange)
      server.watcher.on('unlink', onTranslationsChange)
    },

    writeBundle(outputOptions, bundle) {
      // for the inspector in the next `vite dev`
      const islands = findIslands(islandsDir, adapters)
      const sizes = islandSizes(
        bundle as unknown as OutputBundle,
        new Map(islands.map((island) => [island.file, island.name])),
      )
      writeIfChanged(sizesFile(), JSON.stringify(sizes, null, 2) + '\n')

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

/**
 * The source of `virtual:islands`. Each adapter is imported lazily, so its framework loads only on pages with its islands.
 * With `inspector`, it also starts the island inspector.
 */
export function registryModule(
  islands: IslandFile[],
  adapters: Record<string, AdapterImport>,
  inspector?: { sizes?: Record<string, IslandSize> },
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
  if (inspector) {
    const options = JSON.stringify({ islands: islands.map((island) => island.name), ...inspector })
    lines.push(`import('@pelagojs/islands/inspector').then((m) => m.startInspector(${options}))`)
  }
  return lines.join('\n') + '\n'
}

/** Writes a file unless it already has this content: rewriting an unchanged file would make Shopify CLI upload it again. */
function writeIfChanged(file: string, content: string) {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

function reloadRegistry(server: ViteDevServer) {
  const module = server.moduleGraph.getModuleById(resolvedVirtualId)
  if (!module) return
  server.moduleGraph.invalidateModule(module)
  server.ws.send({ type: 'full-reload' })
}
