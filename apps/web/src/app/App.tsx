import { defineComponent } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { provideLanguage } from "./providers/language";
import { useThemePreference } from "./providers/theme";

import { Icon } from "@iconify/vue";
import contrastIcon from "@iconify-icons/material-symbols/contrast";
import lightModeIcon from "@iconify-icons/material-symbols/light-mode-outline";
import darkModeIcon from "@iconify-icons/material-symbols/dark-mode-outline";

interface Props {}

export default defineComponent<Props>(
  () => {
    const lang = provideLanguage();
    const theme = useThemePreference();
    return () => (
      <div>
        <header class="border-b border-outline-variant flex justify-between items-center p-[22px_max(24px,_calc((100vw_-_1240px)_/_2))] gap-5 bg-surface-container-low max-[580px]:p-4">
          <RouterLink
            to="/"
            t-data="brand"
            class="state-layer text-label-m-emphasized flex items-center gap-3.5 [&_small]:block [&_small]:text-on-surface-variant [&_small]:mt-[5px] max-[580px]:text-label-s max-[580px]:[&_small]:text-label-s"
          >
            <img
              class="w-11 h-11 object-contain max-[580px]:w-9 max-[580px]:h-9"
              src="/logo.svg"
              alt=""
            />
            <span>
              Kab Game
              <small>
                {lang.value === "th"
                  ? "คลังข้อมูลเกมและตัวละคร"
                  : "GAME & CHARACTER ARCHIVE"}
              </small>
            </span>
          </RouterLink>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <div role="group" aria-label={lang.value === "th" ? "ธีม" : "Theme"}
              class="flex gap-1 rounded-full border border-outline-variant p-1">
              {([
                { value: "system", icon: contrastIcon, th: "ตามระบบ", en: "System" },
                { value: "light", icon: lightModeIcon, th: "สว่าง", en: "Light" },
                { value: "dark", icon: darkModeIcon, th: "มืด", en: "Dark" },
              ] as const).map(option => <button key={option.value} type="button"
                t-data={`theme-${option.value}`} aria-pressed={theme.value === option.value}
                aria-label={lang.value === "th" ? option.th : option.en}
                title={lang.value === "th" ? option.th : option.en}
                onClick={() => { theme.value = option.value; }}
                class={["state-layer inline-flex size-11 items-center justify-center rounded-full border-0 p-0", theme.value === option.value ? "bg-secondary-container text-on-secondary-container" : "bg-transparent text-on-surface-variant"]}>
                <Icon icon={option.icon} width={24} height={24} aria-hidden="true" />
              </button>)}
            </div>
            <button
              t-data="lang-button"
              class="text-label-m whitespace-nowrap"
              onClick={() => {
                lang.value = lang.value === "th" ? "en" : "th";
              }}
              aria-label={
                lang.value === "th"
                  ? "เปลี่ยนภาษาเป็นอังกฤษ"
                  : "Switch language to Thai"
              }
            >
              {lang.value === "th" ? "EN / ไทย" : "TH / English"}
            </button>
          </div>
        </header>
        <main class="mx-auto min-h-[80vh] max-w-[1240px] px-6 pt-[42px] pb-[70px] max-[580px]:px-4 max-[580px]:py-7">
          <RouterView />
        </main>
        <footer class="text-label-s flex justify-between border-t border-outline-variant px-[max(24px,calc((100vw-1192px)/2))] py-6 text-on-surface-variant max-[580px]:gap-[18px] max-[580px]:px-4 max-[580px]:py-[22px]">
          Kab Game{" "}
          <span>
            {lang.value === "th"
              ? "อ่านเงื่อนไขก่อนจัดทีมเสมอ"
              : "Every effect has a context."}
          </span>
        </footer>
      </div>
    );
  },
  { name: "App" },
);
