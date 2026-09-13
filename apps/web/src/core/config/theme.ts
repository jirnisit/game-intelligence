export type ThemePreference = "system" | "light" | "dark";
export const themeStorageKey = "kab-game-theme";
export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";
