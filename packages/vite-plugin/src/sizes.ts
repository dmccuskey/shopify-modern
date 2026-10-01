import { gzipSync } from 'node:zlib'
import type { IslandSize } from '@pelagojs/islands/inspector'

/** The parts of Vite's output bundle that sizing needs. */
interface OutputChunk {
  type: 'chunk'
  code: string
  facadeModuleId: string | null
  isEntry: boolean
  isDynamicEntry: boolean
  imports: string[]
  viteMetadata?: { importedCss: Set<string> }
}

interface OutputAsset {
  type: 'asset'
  source: string | Uint8Array
}

export type OutputBundle = Record<string, OutputChunk | OutputAsset>

/**
 * Each island's share of a build, by island name: its chunk, the chunks only it imports, and their CSS.
 * Code shared with the entry, the adapter or other islands isn't counted, as the page loads it anyway.
 * `islands` maps each island's component file to its name.
 */
export function islandSizes(
  bundle: OutputBundle,
  islands: Map<string, string>,
): Record<string, IslandSize> {
  const chunks = Object.entries(bundle).filter(
    (entry): entry is [string, OutputChunk] => entry[1].type === 'chunk',
  )
  const sizes: Record<string, IslandSize> = {}
  for (const [fileName, chunk] of chunks) {
    const name = chunk.facadeModuleId ? islands.get(chunk.facadeModuleId) : undefined
    if (!name) continue

    // everything the other entry points (entries, the adapter, other islands) load statically
    const shared = new Set<string>()
    for (const [other, otherChunk] of chunks) {
      if (other !== fileName && (otherChunk.isEntry || otherChunk.isDynamicEntry))
        reach(bundle, other, shared)
    }
    const own = [...reach(bundle, fileName, new Set())].filter((file) => !shared.has(file))
    const files = new Set(own)
    for (const file of own) {
      const ownChunk = bundle[file]
      if (ownChunk?.type === 'chunk')
        for (const css of ownChunk.viteMetadata?.importedCss ?? []) files.add(css)
    }

    const size = { size: 0, gzip: 0 }
    for (const file of files) {
      const output = bundle[file]
      if (!output) continue
      const content = Buffer.from(output.type === 'chunk' ? output.code : output.source)
      size.size += content.length
      size.gzip += gzipSync(content).length
    }
    sizes[name] = size
  }
  return sizes
}

/** Adds `fileName` and the chunks it imports statically, directly or not, to `found`. */
function reach(bundle: OutputBundle, fileName: string, found: Set<string>): Set<string> {
  const chunk = bundle[fileName]
  if (found.has(fileName) || chunk?.type !== 'chunk') return found
  found.add(fileName)
  for (const file of chunk.imports) reach(bundle, file, found)
  return found
}
