import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'ale.theme';

function preferred(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Private browsing can throw on read; fall through to the OS preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Applied to the root element so CSS variables switch, rather than being
 * threaded through React. Anything that needs a resolved colour (the debug
 * overlay, the PNG export ground) reads it from computed style.
 */
function apply(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
}

export interface ThemeControl {
  theme: AppTheme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeControl | null>(null);

/**
 * One source of theme state for the whole app.
 *
 * It lives above the router so every route — including the public share page,
 * which has no masthead of its own — gets the viewer's choice applied.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return createElement(ThemeContext.Provider, { value: useThemeState() }, children);
}

export function useAppTheme(): ThemeControl {
  const ctx = useContext(ThemeContext);
  if (ctx === null) throw new Error('useAppTheme must be used inside <ThemeProvider>');
  return ctx;
}

function useThemeState(): ThemeControl {
  const [theme, setTheme] = useState<AppTheme>(preferred);

  useEffect(() => {
    apply(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not being able to remember the choice is not worth breaking the page.
    }
  }, [theme]);

  // Follow the OS only while the viewer has not made a choice of their own.
  useEffect(() => {
    let chosen = false;
    try {
      chosen = window.localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      chosen = false;
    }
    if (chosen) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent): void => setTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}

/** Resolves a token to a concrete colour, for canvas and SVG consumers. */
export function tokenColor(name: string, fallback = '#000000'): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw === '' ? fallback : `rgb(${raw})`;
}
