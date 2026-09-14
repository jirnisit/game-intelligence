import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import { useLanguage } from '../../shared/composables/useLanguage'

interface Props {}

export default defineComponent<Props>(
  () => {
    const { t } = useLanguage()

    return () => (
      <section class='rounded-xl border border-dashed border-outline-variant bg-surface-container px-6 py-12.5 text-center text-on-surface'>
        <h1 class='text-display-s max-[580px]:text-headline-l'>404</h1>
        <p class='mt-4 mb-5.5'>{t('ไม่พบหน้าที่คุณต้องการ', 'Page not found')}</p>
        <RouterLink
          to='/'
          t-data='back-link'
          class='state-layer mb-6 inline-block text-body-s text-primary'
        >
          {t('กลับหน้าหลัก', 'Back to home')}
          {' '}
          →
        </RouterLink>
      </section>
    )
  },
  { name: 'NotFoundPage' },
)
