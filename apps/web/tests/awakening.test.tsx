import { afterEach, expect, it } from 'vitest'
import { createApp, type App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import CombatEffectCard from '../src/features/character/components/CombatEffectCard'
import CharacterCard from '../src/features/character/components/CharacterCard'
import StatusRules from '../src/features/character/components/StatusRules'
import type { Character, Effect, StatusRule } from '../src/features/character/types/character'

let app: App | undefined
let root: HTMLDivElement

afterEach(() => {
  app?.unmount()
  root?.remove()
})
const effect = (level: number, value: number): Effect => ({
  id: `atk-${level}`,
  awakening_from: level,
  awakening_until: level === 0 ? 2 : null,
  effect_type: 'stat_increase',
  stat_code: 'atk',
  target: 'self',
  value,
  unit: 'percent',
  per_stack: true,
  status_id: 'shared',
  skill_id: null,
  status_name: { en: 'Shared buff' },
  skill_name: {},
  description: { en: 'Attack increase' },
  directly_granted: true,
  condition: {},
  scaling_stat: null,
  scaling_character_id: null,
  element_code: null,
  applications: [],
  required_statuses: [],
})

function mount(component: Parameters<typeof createApp>[0], props: Record<string, unknown>) {
  root = document.createElement('div')
  document.body.append(root)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
  })

  app = createApp(component, props).use(router)
  app.mount(root)
}

it('shows base and A2 values together with stack units and distinct labels', () => {
  mount(CombatEffectCard, {
    entries: [effect(0, 5), effect(2, 6)],
    game: 'test-game',
  })
  expect(root.querySelectorAll('[t-data="effect-variant"]')).toHaveLength(2)
  expect(root.textContent).toContain('5% / stack')
  expect(root.textContent).toContain('6% / stack')
  expect([...root.querySelectorAll('[t-data="effect-awakening"]')].map(e => e.textContent)).toEqual([
    'ปกติ',
    'Awakening 2',
  ])
})
it('shows a compact label for an awakening-only ATK buff', () => {
  const character: Character = {
    game_id: 'test',
    id: 'test',
    name: { en: 'Test' },
    class_name: { en: 'Class' },
    element_name: { en: 'Earth' },
    rarity: 'S',
    element_code: 'earth',
    class_code: 'destruction',
    race: { en: 'Human' },
    notes: {},
    has_hold: false,
    buffs: [effect(2, 20)],
  }

  mount(CharacterCard, { character, game: 'test' })
  expect(root.querySelector('[t-data="buff-label"]')?.textContent.trim()).toBe('ATK - เฉพาะตัวเอง')
  expect(root.textContent).not.toContain('20%')
})
it('displays replacement rule caps together instead of hiding the base cap', () => {
  const rule = (from: number, cap: number): StatusRule => ({
    id: `r-${from}`,
    awakening_from: from,
    awakening_until: from === 0 ? 5 : null,
    max_stacks: cap,
    duration_kind: 'unlimited',
    duration_seconds: null,
    refresh_on_stack: false,
    mechanics: { clear_all_stacks: true },
  })

  mount(StatusRules, { rules: [rule(0, 10), rule(5, 5)] })
  expect(root.textContent).toContain('10 stacks')
  expect(root.textContent).toContain('5 stacks')
  expect(root.textContent).toContain('Awakening 5')
})
it('describes Resonance dependency without a Sun/Moon conversion message', () => {
  const e = effect(0, 10)

  e.condition = {
    requires_statuses: ['resonance'],
    required_status_target: 'enemy',
  }
  e.required_statuses = [{ code: 'resonance', providers: [] }]
  mount(CombatEffectCard, { entries: [e], game: 'test' })
  expect(root.querySelector('[t-data="effect-condition"]')?.textContent).toContain('ศัตรูต้องมี Resonance')
  expect(root.textContent).not.toContain('Sun')
  expect(root.textContent).not.toContain('Eclipse')
})

it('keeps different recipients on separate compact labels', () => {
  const first = effect(0, 50)
  const second = effect(2, 100)

  first.stat_code = second.stat_code = 'dmg_bonus'
  first.per_stack = second.per_stack = false
  first.condition = second.condition = {
    requires_status: 'awakening',
    target_state: 'break',
  }
  second.target = 'all_allies'
  const character: Character = {
    game_id: 'test',
    id: 'test',
    name: { en: 'Test' },
    class_name: { en: 'Class' },
    element_name: { en: 'Earth' },
    rarity: 'S',
    element_code: 'earth',
    class_code: 'destruction',
    race: {},
    notes: {},
    has_hold: false,
    buffs: [second, first],
  }

  mount(CharacterCard, { character, game: 'test' })
  expect([...root.querySelectorAll('[t-data="buff-label"]')].map(e => e.textContent?.trim())).toEqual([
    'DMG - ทั้งทีม',
    'DMG - เฉพาะตัวเอง',
  ])
})

it('deduplicates the same stat and recipient across skills and awakenings', () => {
  const passive = effect(0, 100)
  const a2 = effect(2, 100)

  passive.skill_id = 'erka-passive'
  passive.status_id = null
  a2.skill_id = null
  a2.status_id = null
  a2.awakening_level = 2
  passive.condition = { requires_status: 'awakening', target_state: 'break' }
  a2.condition = { target_state: 'break' }
  const character: Character = {
    game_id: 'test',
    id: 'test',
    name: { en: 'Test' },
    class_name: {},
    element_name: {},
    rarity: 'S',
    element_code: 'earth',
    class_code: 'destruction',
    race: {},
    notes: {},
    has_hold: false,
    buffs: [passive, a2],
  }

  mount(CharacterCard, { character, game: 'test' })
  expect(root.querySelectorAll('[t-data="buff-label"]')).toHaveLength(1)
})

it('keeps buffs and debuffs distinct and collapses debuff replacement values', () => {
  const debuff = {
    ...effect(0, 10),
    target: 'enemy',
    effect_type: 'stat_decrease',
  }
  const character: Character = {
    game_id: 'test',
    id: 'test',
    name: { en: 'Test' },
    class_name: {},
    element_name: {},
    rarity: 'S',
    element_code: 'earth',
    class_code: 'destruction',
    race: {},
    notes: {},
    has_hold: false,
    buffs: [{ ...effect(0, 20), target: 'all_allies' }],
    debuffs: [debuff, { ...debuff, id: 'a5', awakening_from: 5, value: 30 }],
  }

  mount(CharacterCard, { character, game: 'test' })
  expect(root.querySelector('[t-data="buff-label"]')?.textContent.trim()).toBe('ATK - ทั้งทีม')
  expect(root.querySelectorAll('[t-data="debuff-label"]')).toHaveLength(1)
  expect(root.querySelector('[t-data="debuff-label"]')?.textContent.trim()).toBe('ATK')
  expect(root.querySelector('[t-data="debuff-label"]')?.getAttribute('aria-label')).toContain('ดีบัฟ')
})

it("names Liz's auto recovery metric when the API returns a null stat code", () => {
  const recovery = {
    ...effect(0, 25),
    stat_code: null,
    target: 'all_allies',
    condition: { metric: 'elemental_skill_gauge_auto_recovery' },
  }
  const character = {
    game_id: 'test',
    id: 'liz',
    name: { en: 'Liz' },
    class_name: {},
    element_name: {},
    rarity: 'A',
    element_code: 'water',
    class_code: 'vanguard',
    race: {},
    notes: {},
    has_hold: false,
    buffs: [recovery, { ...recovery, id: 'a5', awakening_from: 5, value: 50 }],
  }

  mount(CharacterCard, { character, game: 'test' })
  expect(root.querySelectorAll('[t-data="buff-label"]')).toHaveLength(1)
  expect(root.querySelector('[t-data="buff-label"]')?.textContent.trim()).toBe('ฟื้นเกจสกิลธาตุอัตโนมัติ - ทั้งทีม')
  expect(root.textContent).not.toContain('null')
})
