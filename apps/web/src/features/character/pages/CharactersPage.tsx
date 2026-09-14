import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLanguage } from '../../../shared/composables/useLanguage'
import { useGame } from '../../../shared/composables/useGame'
import { useCharacterLabels } from '../composables/useCharacterLabels'
import CharacterPageHeader from '../components/CharacterPageHeader'
import CharacterCard from '../components/CharacterCard'
import type { Character, Meta } from '../types/character'
import { getCharacters, getCharacterMeta } from '../services/characters'

interface Props {}

export default defineComponent<Props>(
  () => {
    const { t, label } = useLanguage()
    const { stats } = useCharacterLabels()
    const q = ref('')
    const element = ref('')
    const classCode = ref('')
    const buff = ref('')
    const debuff = ref('')
    const recipient = ref('')
    const hold = ref(false)
    const includePartners = ref(false)
    const page = ref(0)
    const items = ref<Character[]>([])
    const total = ref(0)
    const meta = ref<Meta>({ games: [], elements: [], classes: [], buffStats: [] })
    const loading = ref(false)
    const error = ref('')
    const { gameId: game } = useGame()
    const visibleElements = computed(() => meta.value.elements.filter(e => !game.value || e.game_id === game.value))
    const visibleClasses = computed(() => meta.value.classes.filter(e => !game.value || e.game_id === game.value))
    let listController: AbortController | undefined
    let timer: ReturnType<typeof setTimeout>

    async function loadList() {
      listController?.abort()
      const controller = new AbortController()

      listController = controller
      loading.value = true
      error.value = ''
      const params = new URLSearchParams({
        limit: '24',
        offset: String(page.value * 24),
      })

      for (const [key, value] of Object.entries({
        q: q.value,
        game: game.value,
        element: element.value,
        include_partners: element.value && includePartners.value ? 'true' : '',
        class: classCode.value,
        buff: buff.value,
        debuff: debuff.value,
        target: recipient.value,
        hold: hold.value ? 'true' : '',
      }))
        if (value) params.set(key, value)
      try {
        const result = await getCharacters(params, controller.signal)

        if (!controller.signal.aborted) {
          items.value = result.items
          total.value = result.total
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          items.value = []
          error.value = String(e)
        }
      } finally {
        if (!controller.signal.aborted) loading.value = false
      }
    }

    async function loadMeta() {
      try {
        meta.value = await getCharacterMeta()
      } catch {
        error.value = 'metadata'
      }
    }

    function reset() {
      q.value = ''
      element.value = ''
      includePartners.value = false
      classCode.value = ''
      buff.value = ''
      debuff.value = ''
      recipient.value = ''
      hold.value = false
    }

    watch([q, game, element, classCode, buff, debuff, recipient, hold, includePartners], () => {
      page.value = 0
      clearTimeout(timer)
      timer = setTimeout(loadList, 200)
    })
    watch(element, () => {
      includePartners.value = false
    })
    watch(game, () => {
      element.value = ''
      includePartners.value = false
      classCode.value = ''
    })
    watch(page, loadList)
    onMounted(() => {
      loadMeta()
      loadList()
    })
    onUnmounted(() => {
      clearTimeout(timer)
      listController?.abort()
    })

    return () => (
      <>
        {' '}
        <CharacterPageHeader title={t('ค้นหาตัวละครที่ใช่', 'Find your next teammate')} />
        <section
          aria-label={t('ตัวกรองตัวละคร', 'Character filters')}
          t-data='filters'
          class='grid grid-cols-[1.4fr_1.4fr_1fr] gap-4.5 rounded-xl border border-outline-variant bg-surface-container p-5.5 max-[900px]:grid-cols-2 max-[580px]:gap-3.5 max-[580px]:p-4'
        >
          <label class='grid gap-2 text-body-s text-on-surface-variant max-[580px]:col-span-full'>
            {t('ค้นหาชื่อ', 'Search name')}
            <input
              value={q.value}
              onInput={event => {
                q.value = (event.target as HTMLInputElement).value
              }}
              type='search'
              placeholder={t('เช่น Mei, เฮเลน…', 'Mei, Helen…')}
            >
            </input>
          </label>
          <label class='grid gap-2 text-body-s text-on-surface-variant'>
            {t('ธาตุ', 'Element')}
            <select
              t-data='element-filter'
              value={element.value}
              onChange={event => {
                element.value = (event.target as HTMLSelectElement).value
              }}
            >
              <option value=''>{t('ทุกธาตุ', 'All elements')}</option>
              {visibleElements.value.map(e => (
                <option
                  key={e.game_id + e.code}
                  value={e.code}
                >
                  {label(e.name)}
                </option>
              ))}
            </select>
          </label>
          {element.value
            ? (
                <div class='flex min-h-11 items-center gap-3 self-end'>
                  <button
                    type='button'
                    role='switch'
                    aria-checked={includePartners.value}
                    aria-label={t('รวมธาตุคู่ Fusion', 'Include Fusion partner elements')}
                    t-data='reaction-filter'
                    onClick={() => {
                      includePartners.value = !includePartners.value
                    }}
                    class={`state-layer relative inline-flex h-8 min-h-0 w-13 shrink-0 items-center rounded-full border-2 p-1 ${includePartners.value ? 'border-primary bg-primary text-on-primary' : 'border-outline bg-surface-container-high text-on-surface-variant'}`}
                  >
                    <span
                      aria-hidden='true'
                      class={`h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${includePartners.value ? 'translate-x-5 bg-on-primary' : 'translate-x-0 bg-outline'}`}
                    />
                  </button>
                  <span class='text-body-s text-on-surface'>
                    {t('รวมธาตุคู่ Fusion', 'Include Fusion partner elements')}
                  </span>
                </div>
              )
            : null}
          <label class='grid gap-2 text-body-s text-on-surface-variant'>
            {t('คลาส', 'Class')}
            <select
              value={classCode.value}
              onChange={event => {
                classCode.value = (event.target as HTMLSelectElement).value
              }}
            >
              <option value=''>{t('ทุกคลาส', 'All classes')}</option>
              {visibleClasses.value.map(c => (
                <option
                  key={c.game_id + c.code}
                  value={c.code}
                >
                  {label(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label class='grid gap-2 text-body-s text-on-surface-variant'>
            {t('บัพ', 'Buff')}
            <select
              value={buff.value}
              onChange={event => {
                buff.value = (event.target as HTMLSelectElement).value
              }}
              aria-label={t('บัพ', 'Buff')}
              t-data='buff-filter'
            >
              <option value=''>{t('ทุกบัพ', 'Any buff')}</option>
              {meta.value.buffStats.map(s => (
                <option
                  key={s}
                  value={s}
                >
                  {stats[s] || s}
                </option>
              ))}
            </select>
          </label>
          <label class='grid gap-2 text-body-s text-on-surface-variant'>
            {t('ดีบัพ', 'Debuff')}
            <select
              t-data='debuff-filter'
              aria-label={t('ดีบัพ', 'Debuff')}
              value={debuff.value}
              onChange={event => {
                debuff.value = (event.target as HTMLSelectElement).value
              }}
            >
              <option value=''>{t('ทุกดีบัพ', 'Any debuff')}</option>
              {(meta.value.debuffStats ?? []).map(stat => (
                <option
                  key={stat}
                  value={stat}
                >
                  {stat === 'dmg_bonus'
                    ? t('DMG ที่ได้รับ', 'DMG Taken')
                    : stat === 'break_gauge'
                      ? t('Break DMG ที่ได้รับ', 'Break DMG Taken')
                      : stats[stat] || stat}
                </option>
              ))}
            </select>
          </label>
          <label class='grid gap-2 text-body-s text-on-surface-variant'>
            {t('ผู้รับบัพ', 'Buff recipient')}
            <select
              value={recipient.value}
              onChange={event => {
                recipient.value = (event.target as HTMLSelectElement).value
              }}
              aria-label={t('ผู้รับบัพ', 'Buff recipient')}
              t-data='target-filter'
            >
              <option value=''>{t('ทั้งหมด', 'Any recipient')}</option>
              <option value='self'>{t('เฉพาะตัวเอง', 'Self only')}</option>
              <option value='all_allies'>{t('แจกทั้งทีม', 'All allies')}</option>
            </select>
          </label>
          <div class='col-span-full flex items-center justify-between border-t border-outline-variant pt-3.5'>
            <label class='flex items-center gap-2.5 text-body-s text-on-surface-variant'>
              <input
                class='min-h-auto w-4 accent-primary'
                checked={hold.value}
                onChange={event => {
                  hold.value = (event.target as HTMLInputElement).checked
                }}
                type='checkbox'
              >
              </input>
              {t('มีท่าที่ต้องกดค้าง', 'Has a hold action')}
            </label>
            <button
              onClick={reset}
              t-data='text-button'
              class='bg-transparent text-body-s text-primary [border:0]'
            >
              {t('ล้างตัวกรอง', 'Reset filters')}
            </button>
          </div>
        </section>
        <div class='mt-8 mb-4.5 flex items-center justify-between gap-5 max-[580px]:items-start'>
          <h2 class='text-title-l'>
            {t('ตัวละคร', 'Characters')}
            {' '}
            <span class='ml-2 rounded-md bg-surface-container-high px-2 py-1 text-label-m'>{total.value}</span>
          </h2>
          <p class='text-body-s text-on-surface-variant max-[580px]:max-w-40 max-[580px]:text-right'>
            {t(
              'รวมบัพและดีบัพทุกระดับ Awakening • ต้องทำตามเงื่อนไขสกิล',
              'Includes all Awakening levels • Skill conditions still apply',
            )}
          </p>
        </div>
        <div
          t-data='character-results'
          class='min-h-125'
        >
          {error.value
            ? (
                <div
                  role='alert'
                  class='rounded-xl border border-dashed border-error bg-error-container px-6 py-12.5 text-center text-on-error-container'
                >
                  <h2 class='text-title-l'>{t('ยังโหลดข้อมูลไม่ได้', 'Unable to load characters')}</h2>
                  <p class='mt-4 mb-5.5'>
                    {t('ลองอีกครั้งเมื่อระบบข้อมูลพร้อม', 'Please try again when the data service is available.')}
                  </p>
                  <button
                    onClick={() => {
                      loadMeta()
                      loadList()
                    }}
                  >
                    {t('ลองใหม่', 'Retry')}
                  </button>
                </div>
              )
            : loading.value && !items.value.length
              ? (
                  <div
                    role='status'
                    class='rounded-xl border border-dashed border-outline-variant bg-surface-container px-6 py-12.5 text-center text-on-surface'
                  >
                    {t('กำลังค้นหาตัวละคร…', 'Loading characters…')}
                  </div>
                )
              : !items.value.length
                  ? (
                      <div class='rounded-xl border border-dashed border-outline-variant bg-surface-container px-6 py-12.5 text-center text-on-surface'>
                        <h2 class='text-title-l'>{t('ไม่พบตัวละครตามเงื่อนไข', 'No matching characters')}</h2>
                        <p class='mt-4 mb-5.5'>
                          {t(
                            'ลองเปลี่ยนบัพ ดีบัพ หรือผู้รับบัพ หากยังไม่มีข้อมูล ให้เพิ่มข้อมูลตัวละครก่อน',
                            'Try another buff, debuff or recipient. If the archive is empty, add character data first.',
                          )}
                        </p>
                        <button onClick={reset}>{t('ล้างตัวกรอง', 'Reset filters')}</button>
                      </div>
                    )
                  : (
                      <section
                        aria-busy={loading.value}
                        class='grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[580px]:grid-cols-1'
                      >
                        {items.value.map(c => (
                          <CharacterCard
                            key={c.id}
                            character={c}
                            game={game.value}
                          />
                        ))}
                      </section>
                    )}
        </div>
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
        <p class='mt-6.5 text-body-s text-on-surface-variant'>
          {t(
            'ตัวกรองบัพแยกจากการฟื้น HP และการเพิ่มดาเมจเฉพาะสกิล ส่วนบัพที่ต้องผสมสถานะแสดงในหน้ารายละเอียด',
            'Buffs are separate from healing and skill damage bonuses. Conversion-dependent buffs appear in character details.',
          )}
        </p>
      </>
    )
  },
  { name: 'CharactersPage' },
)
