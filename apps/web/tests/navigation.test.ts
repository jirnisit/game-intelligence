import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App as VueApp } from 'vue'
import App from '../src/app/App'
import { router } from '../src/app/router'

vi.mock('../src/core/config/games', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/core/config/games')>()

  return {
    ...actual,
    games: [...actual.games, { ...actual.games[0], id: 'second-game', name: { en: 'Second Game' } }],
  }
})

const character = {
  game_id: 'limit-zero-breakers',
  id: 'mei',
  name: { en: 'Mei', th: 'เมย์' },
  class_name: { en: 'Breaker' },
  element_name: { en: 'Light' },
  rarity: 'SSR',
  element_code: 'light',
  class_code: 'breaker',
  race: { en: 'Human' },
  notes: {},
  has_hold: true,
  buffs: [],
}
const team = {
  game_id: 'limit-zero-breakers',
  id: 'sample-team',
  game_name: { en: 'Limit Zero Breakers' },
  name: { en: 'Sample team', th: 'ทีมตัวอย่าง' },
  description: { en: '1. Prepare\n2. Switch' },
  characters: [character],
}
let app: VueApp
let root: HTMLDivElement
const requests: string[] = []

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 25))
  await nextTick()
}

async function click(selector: string) {
  const element = root.querySelector<HTMLElement>(selector)

  expect(element).not.toBeNull()
  element!.click()
  const href = element!.getAttribute('href')

  if (href) await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(href))
}

function change(selector: string, value: string) {
  const element = root.querySelector<HTMLSelectElement>(selector)!

  element.value = value
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(async () => {
  requests.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      requests.push(input)
      const url = new URL(input, 'http://localhost')
      let data: unknown

      if (url.pathname.endsWith('/meta'))
        data = {
          games: [],
          reactions: [
            {
              id: 'fusion',
              game_id: 'limit-zero-breakers',
              name: { en: 'Fusion' },
              pairs: [
                {
                  game_id: 'limit-zero-breakers',
                  reaction_id: 'fusion',
                  element_a: 'earth',
                  element_b: 'grass',
                },
              ],
            },
          ],
          elements: [
            {
              game_id: 'limit-zero-breakers',
              code: 'earth',
              name: { en: 'Earth' },
            },
            {
              game_id: 'limit-zero-breakers',
              code: 'grass',
              name: { en: 'Grass' },
            },
            {
              game_id: 'limit-zero-breakers',
              code: 'light',
              name: { en: 'Light' },
            },
          ],
          classes: [],
          buffStats: ['crit_dmg'],
          debuffStats: ['def', 'dmg_bonus'],
        }
      else if (url.pathname === '/api/characters') data = { items: [character], total: 1 }
      else if (url.pathname === '/api/characters/mei')
        data = {
          ...character,
          awakening: 0,
          effects: [],
          statuses: [],
          awakenings: [],
          skills: [
            {
              id: 'mei-normal',
              category: 'normal_attack',
              name: { en: 'Normal Attack' },
              description: { en: 'Hold to attack' },
              has_hold: true,
              cooldown_seconds: null,
            },
          ],
        }
      else if (url.pathname === '/api/teams') data = { items: [team], total: 1 }
      else if (url.pathname === '/api/teams/sample-team') data = team
      else return { ok: false, status: 404, json: async () => ({}) }

      return { ok: true, status: 200, json: async () => data }
    }),
  )
  await router.push('/')
  root = document.createElement('div')
  document.body.append(root)
  app = createApp(App).use(router)
  app.mount(root)
  await settle()
})
afterEach(() => {
  app.unmount()
  root.remove()
  vi.unstubAllGlobals()
})

describe('Kab Game navigation and TSX', () => {
  it('shows the frontend game catalogue without fetching data, then filters within the game', async () => {
    expect(root.textContent).toContain('Kab Game')
    expect(requests).toEqual([])
    expect(root.querySelector<HTMLImageElement>('[t-data="game-art"] img')!.getAttribute('src')).toBe(
      '/limit-zero-breakers-logo.png',
    )
    await click('[t-data="game-card"]')
    await settle()
    expect(router.currentRoute.value.path).toBe('/game/limit-zero-breakers/characters')
    expect(root.querySelectorAll('[t-data="character-card"]')).toHaveLength(1)
    expect(root.querySelectorAll('select[aria-label="Awakening"] option')).toHaveLength(0)
    expect(requests.some(url => url.includes('game=limit-zero-breakers'))).toBe(true)
    change('[t-data="buff-filter"]', 'crit_dmg')
    change('[t-data="debuff-filter"]', 'def')
    change('[t-data="target-filter"]', 'all_allies')
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(requests.at(-1)).not.toContain('awakening=')
    expect(requests.at(-1)).toContain('buff=crit_dmg')
    expect(requests.at(-1)).toContain('debuff=def')
    expect(requests.at(-1)).toContain('target=all_allies')
    await click('[t-data="text-button"]')
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(requests.at(-1)).toContain('game=limit-zero-breakers')
    expect(requests.at(-1)).not.toContain('buff=')
    expect(root.querySelector('[t-data="debuff-filter"]')?.getAttribute('aria-label')).toBe('ดีบัพ')
  })

  it('opens all character variants without an awakening selector and returns through router links', async () => {
    await router.push('/game/limit-zero-breakers/characters')
    await settle()
    await click('[t-data="character-card"]')
    await settle()
    expect(router.currentRoute.value.path).toBe('/game/limit-zero-breakers/characters/mei')
    expect(root.querySelectorAll('[t-data="hold-badge"]')).toHaveLength(1)
    expect(root.querySelector('select[aria-label="Awakening"]')).toBeNull()
    expect(requests).toContain('/api/characters/mei?awakening=0')
    await click('a[href="/game/limit-zero-breakers/characters"][t-data="back-link"]')
    await settle()
    expect(root.querySelector('[t-data="character-card"]')).not.toBeNull()
    await click('[t-data="brand"]')
    await settle()
    expect(router.currentRoute.value.path).toBe('/')
    expect(document.title).toBe('Kab Game')
  })

  it('supports direct team URLs, member links and a persistent language switch', async () => {
    await click('[t-data="lang-button"]')
    await settle()
    expect(document.documentElement.lang).toBe('en')
    await router.push('/game/limit-zero-breakers/teams')
    await settle()
    expect(requests).toContain('/api/teams?game=limit-zero-breakers&limit=24&offset=0')
    expect(root.querySelectorAll('[t-data="team-card"]')).toHaveLength(1)
    await click('[t-data="team-card"] h2 a')
    await settle()
    expect(root.querySelector('[t-data="team-description"]')!.textContent).toBe('1. Prepare\n2. Switch')
    await click('[t-data="team-members"] a')
    await settle()
    expect(root.querySelector('h1')!.textContent).toBe('Character details')
    await router.push('/game/limit-zero-breakers/characters/missing')
    await settle()
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('Character not found')
    await router.push('/unknown')
    await settle()
    expect(root.textContent).toContain('Page not found')
  })
})

it('reads game params when switching contexts and rejects unknown or mismatched games', async () => {
  await router.push('/game/limit-zero-breakers/characters')
  await settle()
  await router.push('/game/second-game/characters')
  await settle()
  expect(requests.some(url => url.includes('game=second-game'))).toBe(true)
  expect(root.querySelector('[t-data="character-card"]')!.getAttribute('href')).toBe('/game/second-game/characters/mei')
  expect(root.querySelector('[t-data="section-nav"] a:last-child')!.getAttribute('href')).toBe(
    '/game/second-game/teams',
  )
  await router.push('/game/second-game/teams')
  await settle()
  expect(requests).toContain('/api/teams?game=second-game&limit=24&offset=0')
  await router.push('/game/second-game/characters/mei')
  await settle()
  expect(root.querySelector('[role="alert"]')).not.toBeNull()
  expect(root.querySelector('[t-data="profile-panel"]')).toBeNull()
  await router.push('/game/second-game/teams/sample-team')
  await settle()
  expect(root.querySelector('[role="alert"]')).not.toBeNull()
  const count = requests.length

  await router.push('/game/unknown/characters')
  await settle()
  expect(router.currentRoute.value.name).toBe('not-found')
  expect(requests).toHaveLength(count)
})

it('loads only detail data on direct character entry and reloads when the ID changes', async () => {
  await router.push('/game/limit-zero-breakers/characters/mei')
  await settle()
  expect(requests).toEqual(['/api/characters/mei?awakening=0'])
  expect(root.querySelector('[t-data="filters"]')).toBeNull()
  expect(root.querySelector('select[aria-label="Awakening"]')).toBeNull()
  await router.push('/game/limit-zero-breakers/characters/missing')
  await settle()
  expect(requests.at(-1)).toBe('/api/characters/missing?awakening=0')
  expect(root.querySelector('[t-data="profile-panel"]')).toBeNull()
  expect(root.querySelector('[role="alert"]')).not.toBeNull()
  await router.push('/game/limit-zero-breakers/characters')
  await settle()
  const checkbox = root.querySelector<HTMLInputElement>('input[type="checkbox"]')!

  expect(checkbox).not.toBeNull()
  checkbox.checked = true
  checkbox.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise(resolve => setTimeout(resolve, 250))
  expect(requests.at(-1)).toContain('hold=true')
})

it('switches the app theme through the header without changing route or typography', async () => {
  const headingClass = root.querySelector('h1')!.className

  await click('[t-data="theme-dark"]')
  await settle()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(root.querySelector('[t-data="theme-dark"]')?.getAttribute('aria-pressed')).toBe('true')
  expect(localStorage.getItem('kab-game-theme')).toBe('dark')
  await click('[t-data="theme-light"]')
  await settle()
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(root.querySelector('h1')!.className).toBe(headingClass)
  expect(router.currentRoute.value.name).toBe('home')
  localStorage.removeItem('kab-game-theme')
})

it('searches Fusion partners using the selected element and resets the pairing', async () => {
  await router.push('/game/limit-zero-breakers/characters')
  await settle()
  expect(root.querySelector('[t-data="reaction-filter"]')).toBeNull()
  change('[t-data="element-filter"]', 'earth')
  await new Promise(resolve => setTimeout(resolve, 250))
  expect(requests.at(-1)).toContain('element=earth')
  expect(requests.at(-1)).not.toContain('include_partners=')
  await click('[t-data="reaction-filter"]')
  await new Promise(resolve => setTimeout(resolve, 250))
  expect(requests.at(-1)).toContain('include_partners=true')
  expect(requests.at(-1)).not.toContain('awakening=')
  await click('[t-data="text-button"]')
  await new Promise(resolve => setTimeout(resolve, 250))
  expect(requests.at(-1)).not.toContain('include_partners=')
})
