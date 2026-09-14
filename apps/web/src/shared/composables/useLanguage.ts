import { inject, ref } from 'vue'
import type { Text } from '../../core/types/text'
import { languageKey } from '../../core/config/language'

export function useLanguage() {
  const lang = inject(languageKey, ref<'th' | 'en'>('th'))
  const t = (th: string, en: string) => (lang.value === 'th' ? th : en)
  const label = (value?: Text) => value?.[lang.value] || value?.en || value?.th || '—'

  return { lang, t, label }
}
