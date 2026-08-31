import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useGetCurrentUser, useUpdateTheme } from "@workspace/api-client-react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSaving: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "dpv-theme";

function resolveSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeToDocument(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && resolveSystemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

// Applies the user's dark/light/system preference to <html>. Logged-in users
// get their choice from (and saved back to) their account via PATCH
// /auth/theme, so it follows them across devices. Logged-out visitors fall
// back to a plain localStorage value so the toggle still works, and no
// account gets created just to remember a color scheme.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: user } = useGetCurrentUser();
  const updateTheme = useUpdateTheme();

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) || "system";
  });

  // Once the account loads, its saved preference takes over as the source
  // of truth (covers the case where this browser's local value is stale —
  // e.g. changed on another device).
  useEffect(() => {
    if (user?.themePreference) {
      setThemeState(user.themePreference);
    }
  }, [user?.themePreference]);

  useEffect(() => {
    applyThemeToDocument(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Keep a "system" selection live if the OS-level preference changes while
  // the tab is open.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyThemeToDocument("system");
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
    if (user) {
      updateTheme.mutate({ data: { theme: next } });
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isSaving: updateTheme.isPending }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
