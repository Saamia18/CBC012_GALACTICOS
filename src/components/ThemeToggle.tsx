import React from 'react';
import { Moon, Sun } from 'lucide-react';

export type AppTheme = 'dark' | 'light';

interface ThemeToggleProps {
  theme: AppTheme;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className="theme-toggle inline-flex h-10 w-10 items-center justify-center rounded-full border transition"
    title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
  >
    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
  </button>
);
