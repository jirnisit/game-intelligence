import clsx from 'clsx'
import { defineComponent, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import Logo from './components/Logo'
import { provideLanguage } from './providers/language'
import { useThemePreference } from './providers/theme'

import { Icon } from '@iconify/vue'
import menuIcon from '@iconify-icons/material-symbols/menu'
import closeIcon from '@iconify-icons/material-symbols/close'
import contrastIcon from '@iconify-icons/material-symbols/contrast'
import lightModeIcon from '@iconify-icons/material-symbols/light-mode-outline'
import darkModeIcon from '@iconify-icons/material-symbols/dark-mode-outline'

interface Props {}

export default defineComponent<Props>(
  () => {
    const lang = provideLanguage()
    const theme = useThemePreference()
    const menuOpen = ref(false)
    const menuButton = ref<HTMLButtonElement | null>(null)

    return () => (
      <div>
        <header class='flex items-center justify-between gap-5 border-b border-outline-variant bg-surface-container-low px-[max(24px,calc((100vw-1240px)/2))] py-5.5 max-[580px]:flex-wrap max-[580px]:p-4'>
          <RouterLink
            to='/'
            t-data='brand'
            class='state-layer flex items-center gap-3.5 text-label-m-emphasized max-[580px]:min-w-0 max-[580px]:flex-1 max-[580px]:text-label-s'
            onClick={() => {
              menuOpen.value = false
            }}
          >
            <Logo class='size-11 shrink-0 max-[580px]:size-9' />
            <span>
              Kab Game
              <small class='mt-1.5 block text-on-surface-variant max-[580px]:text-label-s'>
                {lang.value === 'th' ? 'คลังข้อมูลเกมและตัวละคร' : 'GAME & CHARACTER ARCHIVE'}
              </small>
            </span>
          </RouterLink>
          <button
            ref={menuButton}
            type='button'
            t-data='mobile-menu-toggle'
            class='hidden size-11 shrink-0 items-center justify-center p-0 max-[580px]:inline-flex'
            aria-label={lang.value === 'th'
              ? (menuOpen.value ? 'ปิดเมนู' : 'เปิดเมนู')
              : (menuOpen.value ? 'Close menu' : 'Open menu')}
            aria-expanded={menuOpen.value}
            aria-controls='header-preferences'
            onClick={() => {
              menuOpen.value = !menuOpen.value
            }}
          >
            <Icon
              icon={menuOpen.value ? closeIcon : menuIcon}
              width={24}
              height={24}
              aria-hidden='true'
            />
          </button>
          <nav
            id='header-preferences'
            t-data='header-preferences'
            onKeydown={event => {
              if (event.key === 'Escape' && menuOpen.value) {
                menuOpen.value = false
                menuButton.value?.focus()
              }
            }}
            aria-label={lang.value === 'th' ? 'เมนูหลัก' : 'Main navigation'}
            class={clsx(
              'flex flex-wrap items-center justify-end gap-3 max-[580px]:w-full max-[580px]:justify-start max-[580px]:border-t max-[580px]:border-outline-variant max-[580px]:pt-4',
              !menuOpen.value && 'max-[580px]:hidden',
            )}
          >
            <div
              role='group'
              aria-label={lang.value === 'th' ? 'ธีม' : 'Theme'}
              class='flex gap-1 rounded-full border border-outline-variant p-1'
            >
              {(
                [
                  {
                    value: 'system',
                    icon: contrastIcon,
                    th: 'ตามระบบ',
                    en: 'System',
                  },
                  {
                    value: 'light',
                    icon: lightModeIcon,
                    th: 'สว่าง',
                    en: 'Light',
                  },
                  { value: 'dark', icon: darkModeIcon, th: 'มืด', en: 'Dark' },
                ] as const
              ).map(option => (
                <button
                  key={option.value}
                  type='button'
                  t-data={`theme-${option.value}`}
                  aria-pressed={theme.value === option.value}
                  aria-label={lang.value === 'th' ? option.th : option.en}
                  title={lang.value === 'th' ? option.th : option.en}
                  onClick={() => {
                    theme.value = option.value
                  }}
                  class={clsx(
                    'state-layer inline-flex size-11 items-center justify-center rounded-full border-0 p-0',
                    theme.value === option.value
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-transparent text-on-surface-variant',
                  )}
                >
                  <Icon
                    icon={option.icon}
                    width={24}
                    height={24}
                    aria-hidden='true'
                  />
                </button>
              ))}
            </div>
            <button
              t-data='lang-button'
              class='text-label-m whitespace-nowrap'
              onClick={() => {
                lang.value = lang.value === 'th' ? 'en' : 'th'
              }}
              aria-label={lang.value === 'th' ? 'เปลี่ยนภาษาเป็นอังกฤษ' : 'Switch language to Thai'}
            >
              {lang.value === 'th' ? 'EN / ไทย' : 'TH / English'}
            </button>
          </nav>
        </header>
        <main class='mx-auto min-h-[80vh] max-w-310 px-6 pt-10.5 pb-17.5 max-[580px]:px-4 max-[580px]:py-7'>
          <RouterView />
        </main>
        <footer class='flex justify-between border-t border-outline-variant px-[max(24px,calc((100vw-1192px)/2))] py-6 text-label-s text-on-surface-variant max-[580px]:gap-4.5 max-[580px]:px-4 max-[580px]:py-5.5'>
          Kab Game
          {' '}
          <span>{lang.value === 'th' ? 'อ่านเงื่อนไขก่อนจัดทีมเสมอ' : 'Every effect has a context.'}</span>
        </footer>
      </div>
    )
  },
  { name: 'App' },
)
