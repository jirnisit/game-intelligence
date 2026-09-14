import clsx from 'clsx'
import { useCharacterLabels } from '../composables/useCharacterLabels'
import { computed, defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import type { Character } from '../types/character'
import { useLanguage } from '../../../shared/composables/useLanguage'

interface Props {
  character: Character
  game: string
}

export default defineComponent<Props>(
  props => {
    const { t, label } = useLanguage()
    const { stats, target } = useCharacterLabels()
    const labels = computed(() => {
      const unique = new Map<string, { key: string, text: string, debuff: boolean }>()

      for (const [effects, debuff] of [
        [props.character.buffs, false],
        [props.character.debuffs ?? [], true],
      ] as const) {
        for (const effect of effects) {
          const key = [
            debuff,
            effect.effect_type,
            effect.stat_code,
            effect.target,
            effect.element_code,
            effect.condition?.metric,
            effect.stat_code ? null : effect.status_id,
          ].join(':')
          const stat
            = effect.condition?.metric === 'elemental_skill_gauge_auto_recovery'
              ? t('ฟื้นเกจสกิลธาตุอัตโนมัติ', 'Elemental Gauge Auto Recovery')
              : (effect.stat_code && (stats[effect.stat_code] || effect.stat_code))
                || (effect.name ? label(effect.name) : t('เอฟเฟกต์', 'Effect'))
          const name
            = effect.effect_type === 'damage_taken_increase'
              ? t('DMG ที่ได้รับ', 'DMG Taken')
              : effect.effect_type === 'break_damage_taken_increase'
                ? t('Break DMG ที่ได้รับ', 'Break DMG Taken')
                : effect.element_code
                  ? `${effect.element_code.toUpperCase()} ${stat}`
                  : stat

          unique.set(key, {
            key,
            debuff,
            text: debuff ? name : `${name} - ${target(effect.target)}`,
          })
        }
      }

      return [...unique.values()]
    })

    return () => (
      <RouterLink
        to={`/game/${encodeURIComponent(props.game)}/characters/${encodeURIComponent(props.character.id)}`}
        t-data='character-card'
        class='state-layer rounded-xl border border-outline-variant bg-surface-container p-5.5'
      >
        <div class='flex items-center justify-between'>
          <span
            class={clsx(
              'rounded-md bg-surface-container-highest px-2.5 py-1.5 text-body-s',
              '[&.ge-light]:bg-secondary-container [&.ge-light]:text-on-secondary-container',
              '[&.ge-dark]:bg-tertiary-container [&.ge-dark]:text-on-tertiary-container',
              `ge-${props.character.element_code}`,
            )}
          >
            {label(props.character.element_name)}
          </span>
          <span class='text-label-l-emphasized text-secondary'>{props.character.rarity}</span>
        </div>
        <div
          class={clsx(
            'relative mt-2.5 mb-6 flex h-37 items-center justify-center bg-radial from-primary/20 to-transparent text-display-l text-primary',
            '[&.ge-light]:bg-radial [&.ge-light]:from-secondary/20 [&.ge-light]:to-transparent [&.ge-light]:text-secondary',
            '[&.ge-dark]:bg-radial [&.ge-dark]:from-tertiary/20 [&.ge-dark]:to-transparent [&.ge-dark]:text-tertiary',
            'max-[580px]:h-29',
            `ge-${props.character.element_code}`,
          )}
        >
          {props.character.name.en?.slice(0, 1)}
          <span class='absolute bottom-0 text-body-s text-on-surface-variant'>BREAKER</span>
        </div>
        <div class='flex items-center justify-between'>
          <h3 class='text-title-l'>{label(props.character.name)}</h3>
          <span class='text-on-surface-variant'>↗</span>
        </div>
        <p class='mt-1.5 text-body-s text-on-surface-variant'>
          {label(props.character.class_name)}
          {' · '}
          {label(props.character.race)}
        </p>
        <div class='flex min-h-22 flex-wrap content-start gap-2 py-5'>
          {labels.value.map(item => (
            <span
              key={item.key}
              t-data={item.debuff ? 'debuff-label' : 'buff-label'}
              aria-label={`${item.debuff ? t('ดีบัฟ', 'Debuff') : t('บัฟ', 'Buff')}: ${item.text}`}
              class={clsx(
                'inline-flex rounded-md px-2.5 py-1.5 text-label-m whitespace-nowrap',
                item.debuff
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-primary-container text-on-primary-container',
              )}
            >
              {item.text}
            </span>
          ))}
          {!labels.value.length
            ? (
                <span class='text-body-s text-on-surface-variant'>
                  {t('ยังไม่มีบัฟหรือดีบัฟที่ยืนยัน', 'No documented buffs or debuffs')}
                </span>
              )
            : null}
        </div>
        <div class='flex justify-between border-t border-outline-variant pt-4 text-label-s text-on-surface-variant'>
          <span>
            {props.character.has_hold ? t('มีท่ากดค้าง', 'Hold action') : t('ดูสกิลและเงื่อนไข', 'Skills & conditions')}
          </span>
          <span class='text-primary'>
            {t('ดูรายละเอียด', 'View details')}
            {' →'}
          </span>
        </div>
      </RouterLink>
    )
  },
  { name: 'CharacterCard', props: ['character', 'game'] },
)
