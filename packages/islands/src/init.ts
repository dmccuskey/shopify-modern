import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataIslandSnippet, dataIslandSnippetFile } from './snippet.js'

/**
 * Writes the data island snippet into a theme's `snippets/` folder.
 * Returns what it did; an existing snippet that differs is replaced only with `force`.
 */
export function init(themeDir: string, { force = false } = {}): string {
  const snippetsDir = join(themeDir, 'snippets')
  if (!existsSync(snippetsDir)) {
    throw new Error(`${snippetsDir} not found: run this in the theme's folder, or pass it`)
  }
  const file = join(snippetsDir, dataIslandSnippetFile)
  if (existsSync(file)) {
    if (readFileSync(file, 'utf8') === dataIslandSnippet) return `${file} is up to date`
    if (!force) throw new Error(`${file} exists and differs: pass --force to replace it`)
  }
  writeFileSync(file, dataIslandSnippet)
  return `wrote ${file}`
}
