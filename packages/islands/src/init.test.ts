// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { init } from './init.js'
import { dataIslandSnippet } from './snippet.js'

let theme: string
const snippet = () => join(theme, 'snippets', 'data-island.liquid')

beforeEach(() => {
  theme = mkdtempSync(join(tmpdir(), 'islands-init-'))
  mkdirSync(join(theme, 'snippets'))
})

afterEach(() => rmSync(theme, { recursive: true, force: true }))

describe('init', () => {
  it('writes the snippet into the theme', () => {
    expect(init(theme)).toBe(`wrote ${snippet()}`)
    expect(readFileSync(snippet(), 'utf8')).toBe(dataIslandSnippet)
    expect(init(theme)).toBe(`${snippet()} is up to date`)
  })

  it('replaces a changed snippet only with force', () => {
    writeFileSync(snippet(), 'changed')
    expect(() => init(theme)).toThrow('exists and differs')
    expect(readFileSync(snippet(), 'utf8')).toBe('changed')
    init(theme, { force: true })
    expect(readFileSync(snippet(), 'utf8')).toBe(dataIslandSnippet)
  })

  it('refuses a folder that is not a theme', () => {
    rmSync(join(theme, 'snippets'), { recursive: true })
    expect(() => init(theme)).toThrow('not found')
  })
})
