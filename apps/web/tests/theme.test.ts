import html from '../index.html?raw'
import { createApp, defineComponent, h } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useThemePreference } from '../src/app/providers/theme'
import { themeStorageKey } from '../src/core/config/theme'

interface Props {}

let dispose = () => {}

afterEach(() => {
  dispose()
  localStorage.clear()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.theme
})
it('switches light/dark, restores saved preference, and follows OS changes only in system mode', () => {
  let dark = true
  let listener: () => void = () => {}
  const remove = vi.fn()

  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark
    },
    addEventListener: (_: string, callback: () => void) => {
      listener = callback
    },
    removeEventListener: remove,
  }))
  localStorage.setItem(themeStorageKey, 'light')
  let theme!: ReturnType<typeof useThemePreference>
  const root = document.createElement('div')
  const app = createApp(
    defineComponent<Props>(() => {
      theme = useThemePreference()

      return () => h('div')
    }),
  )

  app.mount(root)
  dispose = () => app.unmount()
  expect(document.documentElement.dataset.theme).toBe('light')
  theme.value = 'dark'
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem(themeStorageKey)).toBe('dark')
  dark = false
  listener()
  expect(document.documentElement.dataset.theme).toBe('dark')
  theme.value = 'system'
  expect(localStorage.getItem(themeStorageKey)).toBeNull()
  expect(document.documentElement.dataset.theme).toBe('light')
  dark = true
  listener()
  expect(document.documentElement.dataset.theme).toBe('dark')
  app.unmount()
  dispose = () => {}
  expect(remove).toHaveBeenCalled()
})

it('applies the saved or system theme in the head before the app mounts', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]
  const initialize = new Function('window', 'document', 'localStorage', script)

  for (const [stored, systemDark, expected] of [
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    [null, true, 'dark'],
    [null, false, 'light'],
    ['system', true, 'dark'],
    ['invalid', false, 'light'],
  ] as const) {
    initialize({ matchMedia: () => ({ matches: systemDark }) }, document, {
      getItem: () => stored,
    })
    expect(document.documentElement.dataset.theme).toBe(expected)
  }
  initialize({ matchMedia: () => ({ matches: true }) }, document, {
    getItem: () => {
      throw new Error('Storage unavailable')
    },
  })
  expect(document.documentElement.dataset.theme).toBe('dark')
})
