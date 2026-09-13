import { createApp, defineComponent, h } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { useThemePreference } from "../src/app/providers/theme";
import { themeStorageKey } from "../src/core/config/theme";
interface Props {}

let dispose = () => {};
afterEach(() => {
  dispose();
  localStorage.clear();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});
it("switches light/dark, restores saved preference, and follows OS changes only in system mode", () => {
  let dark = true;
  let listener: () => void = () => {};
  const remove = vi.fn();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_: string, callback: () => void) => {
      listener = callback;
    },
    removeEventListener: remove,
  }));
  localStorage.setItem(themeStorageKey, "light");
  let theme!: ReturnType<typeof useThemePreference>;
  const root = document.createElement("div");
  const app = createApp(
    defineComponent<Props>(() => {
      theme = useThemePreference();
      return () => h("div");
    }),
  );
  app.mount(root);
  dispose = () => app.unmount();
  expect(document.documentElement.dataset.theme).toBe("light");
  theme.value = "dark";
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem(themeStorageKey)).toBe("dark");
  dark = false;
  listener();
  expect(document.documentElement.dataset.theme).toBe("dark");
  theme.value = "system";
  expect(document.documentElement.dataset.theme).toBe("light");
  dark = true;
  listener();
  expect(document.documentElement.dataset.theme).toBe("dark");
  app.unmount();
  dispose = () => {};
  expect(remove).toHaveBeenCalled();
});
