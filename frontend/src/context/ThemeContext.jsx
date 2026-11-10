import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

/**
 * Permanent Light Mode ThemeProvider.
 * FindAI operates in high-clarity Light Mode across all modules.
 */
export function ThemeProvider({ children }) {
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
      localStorage.removeItem('findai-theme');
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {}, setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
