import type { InjectionKey, Ref } from "vue";
export type Language = "th" | "en";
export const languageKey: InjectionKey<Ref<Language>> = Symbol("language");
