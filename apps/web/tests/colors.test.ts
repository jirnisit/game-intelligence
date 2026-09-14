// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises'
import { compile } from 'tailwindcss'
import { expect, it } from 'vitest'

const source = new URL('../src/', import.meta.url)
const styles = new URL('app/styles/', source)
const read = (file: string) => readFile(new URL(file, styles), 'utf8')
const luminance = (hex: string) => {
  const rgb = [0, 2, 4]
    .map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))

  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

it('maps every semantic role to primitives and maintains readable text contrast in both themes', async () => {
  const palette = await read('palette.css')
  const colors = await read('colors.css')
  const values = Object.fromEntries(
    [...palette.matchAll(/--palette-([\w-]+):\s*#([\da-f]{6})/g)].map(m => [m[1], m[2]]),
  )

  for (const family of ['primary', 'secondary', 'tertiary', 'neutral', 'error']) {
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      expect(values[`${family}-${shade}`]).toBeDefined()
    }
  }
  const roles = [...colors.matchAll(/--color-([\w-]+):\s*var\(--sys-/g)].map(m => m[1])

  expect(roles).toHaveLength(26)
  for (const theme of ['light', 'dark']) {
    const block = colors.replaceAll("'", '"').split(`:root[data-theme="${theme}"]`)[1].split('}')[0]
    const mapping = Object.fromEntries(
      [...block.matchAll(/--sys-([\w-]+):\s*var\(--palette-([\w-]+)\)/g)].map(m => [m[1], m[2]]),
    )

    for (const role of roles) expect(values[mapping[role]], `${theme}: ${role}`).toBeDefined()
    const pairs = ['primary', 'secondary', 'tertiary', 'error'].flatMap(role => [
      [role, `on-${role}`],
      [`${role}-container`, `on-${role}-container`],
    ])

    for (const surface of roles.filter(role => role.startsWith('surface'))) {
      pairs.push([surface, 'on-surface'], [surface, 'on-surface-variant'])
    }
    for (const [background, foreground] of pairs) {
      const a = luminance(values[mapping[background]])
      const b = luminance(values[mapping[foreground]])

      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        `${theme}: ${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  }
})
it('compiles semantic colors and independent interaction states without primitive utilities', async () => {
  const compiler = await compile(
    `${await read('palette.css')}\n${await read('colors.css')}\n${await read('states.css')}\n@tailwind utilities;`,
  )
  const css = compiler.build([
    'bg-primary',
    'text-on-primary',
    'dark:bg-primary',
    'bg-surface',
    'text-on-surface-variant',
    'state-layer',
    'bg-primary-500',
    'text-neutral-900',
  ])

  expect(css).toContain('background-color: var(--sys-primary)')
  expect(css).toContain('.dark\\:bg-primary')
  expect(css).toContain('[data-theme="dark"]')
  expect(css).not.toContain('prefers-color-scheme')
  expect(css).toContain('color: var(--sys-on-primary)')
  expect(css).toContain('var(--state-hover-opacity)')
  expect(css).toContain('var(--state-pressed-opacity)')
  expect(css).toContain(':disabled')
  expect(css).not.toContain('.bg-primary-500')
  expect(css).not.toContain('.text-neutral-900')
})
it('keeps raw color values and primitive shades out of components', async () => {
  async function inspect(directory: URL) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)

      if (entry.isDirectory()) await inspect(url)
      else if (entry.name.endsWith('.tsx')) {
        const content = await readFile(url, 'utf8')

        expect(content, url.pathname).not.toMatch(
          /#[\da-f]{3,8}\b|(?:rgb|hsl|oklch)\(|--palette-|(?:text|bg|border|ring|accent)-(?:primary|secondary|tertiary|neutral|error|slate|gray|red|teal)-(?:50|[1-9]00|950)\b/,
        )
      }
    }
  }

  await inspect(source)
})
