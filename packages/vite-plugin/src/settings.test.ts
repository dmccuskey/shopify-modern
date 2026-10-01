// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { format } from 'prettier'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseSchema, settingType, settingsTypes } from './settings.js'

let theme: string

function write(file: string, content: string) {
  mkdirSync(path.dirname(path.join(theme, file)), { recursive: true })
  writeFileSync(path.join(theme, file), content)
}

function schema(json: unknown) {
  return `<div>{{ section.id }}</div>\n\n{% schema %}\n${JSON.stringify(json, null, 2)}\n{% endschema %}\n`
}

beforeEach(() => {
  theme = mkdtempSync(path.join(tmpdir(), 'settings-'))
})

afterEach(() => rmSync(theme, { recursive: true, force: true }))

describe('parseSchema', () => {
  it('reads the JSON in the schema tag', () => {
    expect(parseSchema('a {%- schema -%} {"name": "A"} {%- endschema -%} b')).toEqual({ name: 'A' })
  })

  it('returns null without a schema tag', () => {
    expect(parseSchema('<div></div>')).toBeNull()
  })

  it('returns an error for invalid JSON or a schema that is not an object', () => {
    expect(parseSchema('{% schema %}{ name: 1 }{% endschema %}')).toBeInstanceOf(Error)
    expect(parseSchema('{% schema %}[]{% endschema %}')).toBeInstanceOf(Error)
  })
})

describe('settingType', () => {
  it('types each kind of setting', () => {
    expect(settingType({ type: 'checkbox' })).toEqual(['boolean'])
    expect(settingType({ type: 'range' })).toEqual(['number'])
    expect(settingType({ type: 'number' })).toEqual(['number', 'null'])
    expect(settingType({ type: 'text' })).toEqual(['string', 'null'])
    expect(settingType({ type: 'richtext' })).toEqual(['string', 'null'])
    expect(settingType({ type: 'text_alignment' })).toEqual(["'left'", "'center'", "'right'"])
    expect(settingType({ type: 'product' })).toEqual(['unknown'])
    expect(settingType({ type: 'color' })).toEqual(['unknown'])
    expect(settingType({ type: 'some_future_type' })).toEqual(['unknown'])
  })

  it('types a select or radio as the union of its option values', () => {
    const options = [{ value: 'small' }, { value: "it's" }, { value: 'small' }]
    expect(settingType({ type: 'select', options })).toEqual(["'small'", '"it\'s"'])
    expect(settingType({ type: 'radio', options: [] })).toEqual(['string'])
  })
})

describe('settingsTypes', () => {
  it('types the settings of sections, theme blocks and the blocks defined in sections', async () => {
    write(
      'sections/hello-world.liquid',
      schema({
        name: 'Hello',
        settings: [
          { type: 'header', content: 'Heading' },
          { type: 'text', id: 'heading', label: 'Heading' },
          { type: 'checkbox', id: 'show_button', label: 'Button', default: true },
        ],
        blocks: [
          { type: '@theme' },
          { type: 'slide', name: 'Slide', settings: [{ type: 'image_picker', id: 'image' }] },
          { type: 'spacer', name: 'Spacer' },
        ],
      }),
    )
    write('sections/404.liquid', schema({ name: '404', settings: [] }))
    write('sections/notes.txt', 'not a section')
    write(
      'blocks/text.liquid',
      schema({
        name: 'Text',
        settings: [
          {
            type: 'select',
            id: 'text_style',
            options: [
              'title',
              'subtitle',
              'normal',
              'caption',
              'small',
              'large',
              'extra-large',
            ].map((value) => ({ value: `text--${value}`, label: value })),
          },
        ],
      }),
    )

    const { source, warnings } = settingsTypes(theme)
    expect(warnings).toEqual([])
    expect(source).toContain(
      [
        'export interface SectionSettings {',
        "  '404': {}",
        "  'hello-world': {",
        '    heading: string | null',
        '    show_button: boolean',
        '  }',
        '}',
      ].join('\n'),
    )
    expect(source).toContain(
      [
        'export interface SectionBlockSettings {',
        "  'hello-world': {",
        '    slide: {',
        '      image: unknown',
        '    }',
        '    spacer: {}',
        '  }',
        '}',
      ].join('\n'),
    )
    expect(source).toContain("      | 'text--extra-large'\n")
    // the file is written as prettier writes it, so it passes a format check
    expect(
      await format(source, {
        parser: 'typescript',
        semi: false,
        singleQuote: true,
        printWidth: 100,
      }),
    ).toBe(source)
  })

  it('writes empty interfaces for a theme without sections or blocks', async () => {
    const { source } = settingsTypes(theme)
    expect(source).toContain('export interface SectionSettings {}')
    expect(source).toContain('export interface BlockSettings {}')
    expect(source).toContain('export interface SectionBlockSettings {}')
  })

  it('skips a file whose schema is not valid JSON, with a warning', () => {
    write('sections/broken.liquid', '{% schema %}{ "name": }{% endschema %}')
    write('sections/footer.liquid', schema({ name: 'Footer', settings: [] }))
    const { source, warnings } = settingsTypes(theme)
    expect(warnings).toEqual([
      expect.stringMatching(/^sections\/broken\.liquid: the schema is not valid JSON/),
    ])
    expect(source).not.toContain('broken')
    expect(source).toContain('  footer: {}')
  })
})
