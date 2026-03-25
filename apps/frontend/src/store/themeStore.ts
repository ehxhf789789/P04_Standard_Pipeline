import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggle: () => {
        const next = !get().isDark;
        set({ isDark: next });
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", next);
        }
      },
      setDark: (dark: boolean) => {
        set({ isDark: dark });
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", dark);
        }
      },
    }),
    {
      name: "theme-preference",
      skipHydration: true,
    }
  )
);
