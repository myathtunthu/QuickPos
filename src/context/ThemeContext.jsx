import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'theme';
const DARK_CLASS = 'dark';

const getInitialTheme = () => {
  try {
    const savedTheme = window.localStorage?.getItem(STORAGE_KEY);

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
};

const applyTheme = (theme) => {
  const isDarkMode = theme === 'dark';
  document.documentElement.classList.toggle(DARK_CLASS, isDarkMode);

  try {
    window.localStorage?.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme should still apply even if localStorage is unavailable.
  }
};

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setDarkMode = useCallback((enabled) => {
    setTheme(enabled ? 'dark' : 'light');
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDarkMode: theme === 'dark',
      toggleTheme,
      setTheme,
      setDarkMode,
    }),
    [theme, toggleTheme, setDarkMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
