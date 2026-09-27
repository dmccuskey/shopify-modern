#!/usr/bin/env node
import { init } from './init.js'

const usage = `Usage: npx @shopify-modern/islands init [theme folder] [--force]

Writes snippets/data-island.liquid into the theme (default: the current folder).
Themes built with @shopify-modern/vite-plugin don't need this: the plugin writes it.`

const args = process.argv.slice(2)
const [command, themeDir = '.'] = args.filter((arg) => !arg.startsWith('-'))

if (command !== 'init' || args.includes('--help') || args.includes('-h')) {
  console.log(usage)
  process.exitCode = command === 'init' || !command ? 0 : 1
} else {
  try {
    console.log(init(themeDir, { force: args.includes('--force') }))
  } catch (error) {
    console.error((error as Error).message)
    process.exitCode = 1
  }
}
