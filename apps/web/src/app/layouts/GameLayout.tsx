import { defineComponent } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useGame } from '../../shared/composables/useGame'
import { useLanguage } from '../../shared/composables/useLanguage'

interface Props {}

export default defineComponent<Props>(
  () => {
    const { t, label } = useLanguage()
    const route = useRoute()
    const { game, gameId } = useGame()

    return () => (
      <>
        <div>
          <img
            class='h-25 w-60 max-w-full object-contain object-left'
            src={game.value?.logo}
            alt={label(game.value?.name)}
          />
        </div>
        <nav
          t-data='section-nav'
          class='mt-3 mb-8 flex gap-6 border-b border-outline-variant'
          aria-label={t('เมนูเกม', 'Game navigation')}
        >
          <RouterLink
            class='state-layer py-2 aria-[current=page]:border-b-2 aria-[current=page]:border-current aria-[current=page]:text-primary'
            to={{ name: 'characters', params: { game: gameId.value } }}
            aria-current={!route.path.includes('/teams') ? 'page' : undefined}
          >
            {t('ตัวละคร', 'Characters')}
          </RouterLink>
          <RouterLink
            class='state-layer py-2 aria-[current=page]:border-b-2 aria-[current=page]:border-current aria-[current=page]:text-primary'
            to={{ name: 'teams', params: { game: gameId.value } }}
            aria-current={route.path.includes('/teams') ? 'page' : undefined}
          >
            {t('ทีม', 'Teams')}
          </RouterLink>
        </nav>
        <RouterView key={gameId.value} />
      </>
    )
  },
  { name: 'GameLayout' },
)
