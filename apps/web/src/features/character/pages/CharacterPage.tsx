import clsx from 'clsx'
import { groupEffects } from '../utils/groupEffects'
import { computed, defineComponent, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useLanguage } from '../../../shared/composables/useLanguage'
import { useGame } from '../../../shared/composables/useGame'
import { useCharacterLabels } from '../composables/useCharacterLabels'
import CharacterPageHeader from '../components/CharacterPageHeader'
import CombatEffectCard from '../components/CombatEffectCard'
import StatusRules from '../components/StatusRules'
import type { Detail } from '../types/character'
import { getCharacter } from '../services/characters'

interface Props {}

export default defineComponent<Props>(() => {
  const { t, label } = useLanguage()
  const { awakeningLabel } = useCharacterLabels()
  const route = useRoute()
  const { gameId: game } = useGame()
  const detail = ref<Detail | null>(null)
  const loading = ref(false)
  const error = ref('')
  const selected = computed(() => (typeof route.params.characterId === 'string' ? route.params.characterId : ''))
  let controller: AbortController | undefined

  async function load() {
    controller?.abort()
    const request = new AbortController()

    controller = request
    detail.value = null
    error.value = ''
    loading.value = true
    try {
      const result = await getCharacter(game.value, selected.value, 0, request.signal)

      if (!request.signal.aborted) detail.value = result
    } catch (e) {
      if (!request.signal.aborted) error.value = String(e)
    } finally {
      if (!request.signal.aborted) loading.value = false
    }
  }

  watch([selected, game], load, { immediate: true })
  onUnmounted(() => controller?.abort())
  const groups = computed(() =>
    groupEffects(detail.value?.effect_variants ?? detail.value?.effects ?? []).map(entries => ({
      key: entries[0].id,
      entries,
    })),
  )

  function skillText(text: string) {
    const names = [
      ...new Set(
        (detail.value?.statuses ?? [])
          .flatMap(status => [status.name.en, status.name.th])
          .filter((name): name is string => !!name),
      ),
    ].sort((a, b) => b.length - a.length)

    if (!names.length) return [{ text, status: false }]
    const escaped = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    return text
      .split(new RegExp('(' + escaped.join('|') + ')', 'gu'))
      .filter(Boolean)
      .map(part => ({ text: part, status: names.includes(part) }))
  }

  return () => (
    <>
      <CharacterPageHeader title={t('รายละเอียดตัวละคร', 'Character details')} />
      <RouterLink
        to={{ name: 'characters', params: { game: game.value } }}
        t-data='back-link'
        class='state-layer mb-6 inline-block text-body-s text-primary'
      >
        ←
        {' '}
        {t('กลับไปตัวละครทั้งหมด', 'Back to characters')}
      </RouterLink>
      {loading.value
        ? (
            <p
              role='status'
              class='p-6 text-body-m'
            >
              {t('กำลังโหลดรายละเอียด…', 'Loading character…')}
            </p>
          )
        : error.value
          ? (
              <div
                role='alert'
                class='rounded-lg bg-error-container p-6 text-on-error-container'
              >
                <h2 class='text-title-l'>
                  {error.value.includes('404')
                    ? t('ไม่พบตัวละครนี้', 'Character not found')
                    : t('โหลดรายละเอียดไม่ได้', 'Unable to load details')}
                </h2>
                <button onClick={load}>{t('ลองใหม่', 'Retry')}</button>
              </div>
            )
          : detail.value
            ? (
                <article class='grid grid-cols-[16rem_1fr] gap-7 max-[900px]:grid-cols-1'>
                  <aside
                    t-data='profile-panel'
                    class='sticky top-5 self-start rounded-xl border border-outline-variant bg-surface-container p-5.5 max-[900px]:static max-[900px]:block'
                  >
                    <div
                      class={clsx(
                        'relative mt-2.5 mb-6 flex h-37 items-center justify-center bg-radial from-primary/20 to-transparent text-display-l text-primary',
                        '[&.ge-light]:bg-radial [&.ge-light]:from-secondary/20 [&.ge-light]:to-transparent [&.ge-light]:text-secondary',
                        '[&.ge-dark]:bg-radial [&.ge-dark]:from-tertiary/20 [&.ge-dark]:to-transparent [&.ge-dark]:text-tertiary',
                        'max-[900px]:h-25',
                        `ge-${detail.value.element_code}`,
                      )}
                    >
                      {detail.value.name.en?.slice(0, 1)}
                      <span class='absolute bottom-0 text-body-s text-on-surface-variant'>
                        {'BREAKER / '}
                        {detail.value.rarity}
                      </span>
                    </div>
                    <h2 class='text-headline-s'>{label(detail.value.name)}</h2>
                    <p class='mt-2 text-body-s text-on-surface-variant'>{detail.value.name.en}</p>
                    <div class='my-5 flex flex-wrap gap-2'>
                      <span class='rounded-md bg-surface-container-highest px-2.5 py-1.5 text-body-s'>
                        {label(detail.value.element_name)}
                      </span>
                      <span class='rounded-md bg-surface-container-highest px-2.5 py-1.5 text-body-s'>
                        {label(detail.value.class_name)}
                      </span>
                      <span class='rounded-md bg-surface-container-highest px-2.5 py-1.5 text-body-s'>
                        {label(detail.value.race)}
                      </span>
                    </div>
                    <p class='mt-2 text-body-l text-on-surface-variant'>{label(detail.value.notes)}</p>
                  </aside>
                  <div class='grid min-w-0 gap-8'>
                    <section>
                      <h2 class='text-title-l'>{t('บัฟและผลต่อการต่อสู้', 'Buffs & combat effects')}</h2>
                      <p class='mt-2 text-body-m text-on-surface-variant'>
                        {t(
                          'แสดงค่าปกติและ Awakening พร้อมกัน ค่าแทนที่ไม่บวกรวมกับค่าเดิม',
                          'Base and Awakening values are shown together. Replacement values do not add to the original.',
                        )}
                      </p>
                      <div class='mt-4 grid grid-cols-2 gap-3 max-[580px]:grid-cols-1'>
                        {groups.value.map(g => (
                          <CombatEffectCard
                            key={g.key}
                            entries={g.entries}
                            game={game.value}
                          />
                        ))}
                      </div>
                    </section>
                    <section>
                      <h2 class='text-title-l'>
                        {t('สกิลหลัก', 'Skills')}
                        {' '}
                        ·
                        {detail.value.skills.length}
                        {' '}
                        / 6
                      </h2>
                      <div class='mt-4 grid gap-3'>
                        {detail.value.skills.map(skill => (
                          <section
                            key={skill.id}
                            class='rounded-lg border border-outline-variant bg-surface-container p-5'
                          >
                            <h3 class='text-title-m-emphasized'>{label(skill.name)}</h3>
                            <div class='my-2 flex gap-3 text-label-m text-on-surface-variant'>
                              {skill.has_hold
                                ? (
                                    <span
                                      t-data='hold-badge'
                                      class='rounded bg-secondary-container px-2 text-on-secondary-container'
                                    >
                                      {t('มีการกดค้าง', 'HOLD')}
                                    </span>
                                  )
                                : null}
                              {skill.cooldown_seconds !== null
                                ? (
                                    <span>
                                      {skill.cooldown_seconds}
                                      s CD
                                    </span>
                                  )
                                : null}
                            </div>
                            <p class='text-body-m whitespace-pre-line'>
                              {skillText(label(skill.description)).map((part, i) =>
                                part.status
                                  ? (
                                      <mark
                                        key={i}
                                        class='rounded bg-secondary-container px-0.5 text-on-secondary-container'
                                      >
                                        {part.text}
                                      </mark>
                                    )
                                  : (
                                      part.text
                                    ),
                              )}
                            </p>
                          </section>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h2 class='text-title-l'>Awakening</h2>
                      <div class='mt-4 grid grid-cols-2 gap-3 max-[580px]:grid-cols-1'>
                        {detail.value.awakenings.map(a => (
                          <section
                            key={a.level}
                            t-data='awakening-description'
                            class='rounded-lg bg-primary-container p-5 text-on-primary-container'
                          >
                            <span class='text-label-l-emphasized'>{awakeningLabel(a.level)}</span>
                            <h3 class='mt-2 text-title-m'>{label(a.name)}</h3>
                            <p class='mt-2 text-body-m whitespace-pre-line'>{label(a.description)}</p>
                          </section>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h2 class='text-title-l'>{t('สถานะและกฎแต่ละระดับ', 'Statuses and rules by awakening')}</h2>
                      <div class='mt-4 grid gap-4'>
                        {detail.value.statuses.map(status => (
                          <section
                            key={status.id}
                            class='rounded-lg border border-outline-variant p-4'
                          >
                            <h3 class='text-title-m'>{label(status.name)}</h3>
                            <p class='my-2 text-body-s whitespace-pre-line'>{label(status.description)}</p>
                            <StatusRules rules={status.rules ?? (status.rule ? [status.rule] : [])} />
                            {status.completeness === 'partial'
                              ? (
                                  <p class='mt-2 text-body-s text-on-surface-variant'>
                                    {t('ข้อมูลบางส่วนยังไม่ทราบ', 'Some mechanics remain unknown')}
                                  </p>
                                )
                              : null}
                          </section>
                        ))}
                      </div>
                    </section>
                    {detail.value.reaction_pairs?.length
                      ? (
                          <section t-data='reaction-pairs'>
                            <h2 class='text-title-l'>{t('คู่ธาตุสำหรับ Fusion', 'Fusion element pairs')}</h2>
                            {detail.value.reaction_pairs.map(pair => (
                              <div
                                key={pair.element_a + pair.element_b}
                                class='mt-3 text-body-m'
                              >
                                <p>
                                  {pair.element_a}
                                  {' '}
                                  ↔
                                  {pair.element_b}
                                </p>
                                <p>{pair.description ? label(pair.description) : ''}</p>
                              </div>
                            ))}
                            <p class='mt-2 text-body-s text-on-surface-variant'>
                              {t(
                                'ใช้สกิลธาตุของ A → สลับไป B ที่เป็นธาตุคู่กัน → เกิด Reaction โดย B ไม่ต้องกดสกิลธาตุ',
                                'Use A’s Elemental Skill → switch to B of the paired element → receive the Reaction. B does not need to cast an Elemental Skill.',
                              )}
                            </p>
                          </section>
                        )
                      : null}
                  </div>
                </article>
              )
            : null}
    </>
  )
})
