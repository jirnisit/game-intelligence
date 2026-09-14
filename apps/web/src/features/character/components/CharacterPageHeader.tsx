import { defineComponent } from 'vue'
import { useLanguage } from '../../../shared/composables/useLanguage'

interface Props {
  title: string
}

export default defineComponent<Props>(
  props => {
    const { t } = useLanguage()

    return () => (
      <header class='mb-7.5'>
        <p class='mb-3 text-label-s-emphasized text-primary'>BREAKER ARCHIVE / 01</p>
        <h1 class='text-display-s max-[580px]:text-headline-l'>{props.title}</h1>
        <p class='mt-2 text-body-m text-on-surface-variant'>
          {t(
            'สำรวจค่าปกติและความสามารถที่ปลดล็อกด้วย Awakening',
            'Explore base effects and abilities unlocked through Awakening.',
          )}
        </p>
      </header>
    )
  },
  { props: ['title'] },
)
