import { defineComponent } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { provideLanguage } from "./providers/language";
import { useThemePreference } from "./providers/theme";
import { isThemePreference } from "../core/config/theme";
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
            <label class="text-label-m text-on-surface-variant grid gap-1">
              {lang.value === "th" ? "ธีม" : "Theme"}
              <select
                t-data="theme-select"
                value={theme.value}
                onChange={(event) => {
                  const value = (event.target as HTMLSelectElement).value;
                  if (isThemePreference(value)) theme.value = value;
                }}
              >
                <option value="system">
                  {lang.value === "th" ? "ตามระบบ" : "System"}
                </option>
                <option value="light">
                  {lang.value === "th" ? "สว่าง" : "Light"}
                </option>
                <option value="dark">
                  {lang.value === "th" ? "มืด" : "Dark"}
                </option>
              </select>
            </label>
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
        <footer class="text-label-s flex justify-between border-t border-outline-variant px-[max(24px,calc((100vw_-_1192px)/2))] py-6 text-on-surface-variant max-[580px]:gap-[18px] max-[580px]:px-4 max-[580px]:py-[22px]">
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
