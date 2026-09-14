import { onUnmounted, ref, watch } from 'vue'
import { isThemePreference, themeStorageKey, type ThemePreference } from '../../core/config/theme'

export function useThemePreference() {
  let initial: ThemePreference = 'system'

  try {
    const stored = localStorage.getItem(themeStorageKey)

    if (isThemePreference(stored)) initial = stored
  } catch {
    /* Storage may be unavailable; theme switching still works. */
  }
  const preference = ref<ThemePreference>(initial)
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    document.documentElement.dataset.theme
      = preference.value === 'system' ? (system.matches ? 'dark' : 'light') : preference.value
  }

  apply()
  watch(
    preference,
    value => {
      apply()
      try {
        if (value === 'system') localStorage.removeItem(themeStorageKey)
        else localStorage.setItem(themeStorageKey, value)
      } catch {
        /* Keep the in-memory preference. */
      }
    },
    { flush: 'sync' },
  )
  system.addEventListener('change', apply)
  onUnmounted(() => system.removeEventListener('change', apply))

  return preference
}
