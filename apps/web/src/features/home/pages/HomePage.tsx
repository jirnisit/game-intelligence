import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import { games } from '../../../core/config/games'
import { useLanguage } from '../../../shared/composables/useLanguage'

interface Props {}

export default defineComponent<Props>(
  () => {
    const { t, label } = useLanguage()

    return () => (
      <>
        <div class='mt-6 mb-9 flex items-end justify-between gap-7.5 max-[580px]:block'>
          <div>
            <p class='mb-3 text-label-s-emphasized text-primary'>KAB GAME / HOME</p>
            <h1 class='text-display-s max-[580px]:text-headline-l'>{t('เลือกเกมที่คุณเล่น', 'Choose your game')}</h1>
            <p class='mt-2 text-body-m text-on-surface-variant'>
              {t('ข้อมูลตัวละคร สกิล และทีม รวมไว้ในที่เดียว', 'Characters, skills and teams, all in one place.')}
            </p>
          </div>
        </div>
        <section
          class='grid grid-cols-2 gap-6 max-[580px]:grid-cols-1'
          aria-label={t('รายการเกม', 'Games')}
        >
          {games.map(game => (
            <RouterLink
              key={game.id}
              to={{ name: 'characters', params: { game: game.id } }}
              t-data='game-card'
              class='state-layer overflow-hidden rounded-2xl border border-outline-variant bg-surface-container'
            >
              <div
                t-data='game-art'
                class='flex min-h-60 items-center justify-center bg-radial from-surface-container-highest to-surface-container-low p-8 max-[580px]:min-h-50 max-[580px]:p-6'
              >
                <img
                  class='h-45 w-full max-w-90 object-contain'
                  src={game.logo}
                  alt={label(game.name)}
                />
              </div>
              <div class='p-6'>
                <h2 class='text-title-l'>{label(game.name)}</h2>
                <p class='mt-2 text-body-m text-on-surface-variant'>{label(game.description)}</p>
                <span class='mt-6 block text-body-m text-primary'>
                  {t('ดูข้อมูลเกม', 'Explore game')}
                  {' '}
                  →
                </span>
              </div>
            </RouterLink>
          ))}
        </section>
      </>
    )
  },
  { name: 'HomePage' },
)
