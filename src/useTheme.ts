import { useLayoutEffect, useState } from "react";

type Theme = "day" | "night";
const THEME_KEY = "uniway.theme";

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "day" || saved === "night") return saved;
  } catch {
    // Appearance still works when browser storage is unavailable.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "night"
    : "day";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme =
    theme === "night" ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "night" ? "#111c27" : "#f5f6f2");
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useLayoutEffect(() => applyTheme(theme), [theme]);

  function toggleTheme() {
    const next = theme === "day" ? "night" : "day";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Keep the selected appearance for this visit without persistence.
    }
  }

  return { theme, toggleTheme };
}
