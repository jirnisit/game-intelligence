import { provide, ref, watch } from "vue";
import { languageKey, type Language } from "../../core/config/language";
export function provideLanguage() {
  const lang = ref<Language>("th");
  provide(languageKey, lang);
  watch(
    lang,
    (value) => {
      document.documentElement.lang = value;
    },
    { immediate: true },
  );
  return lang;
}
