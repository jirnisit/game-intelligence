// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { compile } from 'tailwindcss'
import { expect, it } from 'vitest'

it('compiles all 30 Material 3 roles with size, line height, tracking and weight', async () => {
  const theme = await readFile(new URL('../src/app/styles/typography.css', import.meta.url), 'utf8')
  const roles = ['display', 'headline', 'title', 'body', 'label'].flatMap(role =>
    ['s', 'm', 'l'].flatMap(size => [`${role}-${size}`, `${role}-${size}-emphasized`]),
  )
  const compiler = await compile(`${theme}\n@tailwind utilities;`)
  const css = compiler.build(roles.map(role => `text-${role}`))

  for (const role of roles) {
    expect(css).toContain(`.text-${role} {`)
    const block = css.split(`.text-${role} {`)[1].split('}')[0]

    for (const property of ['font-size', 'line-height', 'letter-spacing', 'font-weight']) {
      expect(block).toContain(`${property}:`)
    }
  }
  expect(css).toContain('--text-display-l: 3.5625rem')
  expect(css).toContain('--text-display-l--line-height: 4rem')
  expect(css).toContain('--text-display-l-emphasized--font-weight: 500')
  expect(css).toContain('--text-label-m-emphasized--font-weight: 700')
})
