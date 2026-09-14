import { computed, onUnmounted, ref, watch } from 'vue'
import type { Text } from '../../../core/types/text'
import type { Team } from '../types/team'
import { getTeam, getTeams } from '../services/teams'
import { useLanguage } from '../../../shared/composables/useLanguage'
import { useGame } from '../../../shared/composables/useGame'
import { defineComponent } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

interface Props {}

export default defineComponent<Props>(
  () => {
    const { lang } = useLanguage()
    const route = useRoute()
    const { gameId: game } = useGame()
    const t = (th: string, en: string) => (lang.value === 'th' ? th : en)
    const label = (value: Text) => value[lang.value] || value.en || value.th || ''
    const id = computed(() => (typeof route.params.teamId === 'string' ? route.params.teamId : ''))
    const items = ref<Team[]>([])
    const team = ref<Team | null>(null)
    const loading = ref(false)
    const error = ref('')
    const page = ref(0)
    const total = ref(0)
    let controller: AbortController | undefined

    async function load() {
      controller?.abort()
      const current = new AbortController()

      controller = current
      loading.value = true
      error.value = ''
      team.value = null
      items.value = []
      try {
        if (id.value) {
          const data = await getTeam(game.value, id.value, current.signal)

          if (!current.signal.aborted) team.value = data
        } else {
          const data = await getTeams(game.value, page.value, current.signal)

          if (current.signal.aborted) return
          items.value = data.items
          total.value = data.total
        }
      } catch (e) {
        if (!current.signal.aborted) error.value = String(e)
      } finally {
        if (!current.signal.aborted) loading.value = false
      }
    }

    watch(
      id,
      () => {
        page.value = 0
        load()
      },
      { immediate: true },
    )
    watch(page, load)
    onUnmounted(() => controller?.abort())

    return () => (
      <>
        {' '}
        <div class='mb-7.5 flex items-end justify-between gap-7.5 max-[580px]:block'>
          <div>
            <p class='mb-3 text-label-s-emphasized text-primary'>TEAM ARCHIVE / 02</p>
            <h1 class='text-display-s max-[580px]:text-headline-l'>{t('ทีมและลำดับการเล่น', 'Teams & rotations')}</h1>
            <p class='mt-2 text-body-m text-on-surface-variant'>
              {t('สมาชิกทีมและโน้ตการเล่นของคุณ', 'Your team members and play notes')}
            </p>
          </div>
        </div>
        {id.value
          ? (
              <RouterLink
                to={{ name: 'teams', params: { game: game.value } }}
                t-data='back-link'
                class='state-layer mb-6 inline-block text-body-s text-primary'
              >
                {'← '}
                {t('กลับไปรายการทีม', 'Back to teams')}
              </RouterLink>
            )
          : null}
        {loading.value
          ? (
              <div
                role='status'
                class='rounded-xl border border-dashed border-outline-variant bg-surface-container px-6 py-12.5 text-center text-on-surface'
              >
                {t('กำลังโหลดทีม…', 'Loading teams…')}
              </div>
            )
          : error.value
            ? (
                <div
                  role='alert'
                  class='rounded-xl border border-dashed border-error bg-error-container px-6 py-12.5 text-center text-on-error-container'
                >
                  <h2 class='text-title-l'>
                    {error.value.includes('404')
                      ? t('ไม่พบทีมนี้', 'Team not found')
                      : t('โหลดทีมไม่ได้', 'Unable to load teams')}
                  </h2>
                  <button onClick={load}>{t('ลองใหม่', 'Retry')}</button>
                </div>
              )
            : team.value
              ? (
                  <article class='max-w-250 rounded-lg border border-outline-variant bg-surface-container p-[clamp(20px,3vw,32px)] text-body-l'>
                    <p class='mb-3 text-label-s-emphasized text-primary'>{label(team.value.game_name)}</p>
                    <h2 class='text-headline-s'>{label(team.value.name)}</h2>
                    <div
                      t-data='team-members'
                      class='m-[1rem_0_1.5rem] flex flex-wrap gap-3'
                    >
                      {team.value.characters.map(member => (
                        <RouterLink
                          class='state-layer rounded-lg border border-outline-variant px-3 py-2 text-body-l'
                          key={member.id}
                          to={`/game/${encodeURIComponent(game.value)}/characters/${encodeURIComponent(member.id)}`}
                        >
                          {label(member.name)}
                          {' ↗'}
                        </RouterLink>
                      ))}
                    </div>
                    <h3 class='mb-3 text-title-l'>{t('รายละเอียดและลำดับการเล่น', 'Details & rotation')}</h3>
                    <p
                      t-data='team-description'
                      class='wrap-anywhere whitespace-pre-wrap'
                    >
                      {label(team.value.description) || t('ยังไม่มีรายละเอียด', 'No details yet')}
                    </p>
                  </article>
                )
              : (
                  <>
                    {!items.value.length
                      ? (
                          <div class='rounded-xl border border-dashed border-outline-variant bg-surface-container px-6 py-12.5 text-center text-on-surface'>
                            {t('ยังไม่มีทีม', 'No teams yet')}
                          </div>
                        )
                      : (
                          <section class='grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[580px]:grid-cols-1'>
                            {items.value.map(item => (
                              <article
                                key={item.id}
                                t-data='team-card'
                                class='rounded-lg border border-outline-variant bg-surface-container p-5 text-body-l'
                              >
                                <p class='mb-3 text-label-s-emphasized text-primary'>{label(item.game_name)}</p>
                                <h2 class='text-title-l'>
                                  <RouterLink
                                    class='state-layer'
                                    to={`/game/${encodeURIComponent(game.value)}/teams/${encodeURIComponent(item.id)}`}
                                  >
                                    {label(item.name)}
                                    {' →'}
                                  </RouterLink>
                                </h2>
                                <div
                                  t-data='team-members'
                                  class='m-[1rem_0_1.5rem] flex flex-wrap gap-3'
                                >
                                  {item.characters.map(member => (
                                    <RouterLink
                                      class='state-layer rounded-lg border border-outline-variant px-3 py-2 text-body-l'
                                      key={member.id}
                                      to={`/game/${encodeURIComponent(game.value)}/characters/${encodeURIComponent(member.id)}`}
                                    >
                                      {label(member.name)}
                                      {' ↗'}
                                    </RouterLink>
                                  ))}
                                </div>
                                <p class='[display:-webkit-box] overflow-hidden text-body-l whitespace-pre-wrap [-webkit-box-orient:vertical] [-webkit-line-clamp:3]'>
                                  {label(item.description)}
                                </p>
                                <RouterLink
                                  to={`/game/${encodeURIComponent(game.value)}/teams/${encodeURIComponent(item.id)}`}
                                  t-data='back-link'
                                  class='state-layer mb-6 inline-block text-body-s text-primary'
                                >
                                  {t('ดูรายละเอียด', 'View details')}
                                  {' →'}
                                </RouterLink>
                              </article>
                            ))}
                          </section>
                        )}
                    {total.value > 24
                      ? (
                          <nav class='mt-5 flex items-center justify-center gap-5'>
                            <button
                              disabled={page.value === 0}
                              onClick={() => {
                                page.value--
                              }}
                            >
                              {t('ก่อนหน้า', 'Previous')}
                            </button>
                            <span>{page.value + 1}</span>
                            <button
                              disabled={(page.value + 1) * 24 >= total.value}
                              onClick={() => {
                                page.value++
                              }}
                            >
                              {t('ถัดไป', 'Next')}
                            </button>
                          </nav>
                        )
                      : null}
                  </>
                )}
        {' '}
      </>
    )
  },
  { name: 'TeamsPage' },
)
