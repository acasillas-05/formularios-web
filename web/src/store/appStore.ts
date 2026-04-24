import { create } from 'zustand';

type Theme = 'dark' | 'light';

const THEME_KEY = 'formularios-web:theme';
const SIDEBAR_KEY = 'formularios-web:sidebar-collapsed';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

function readSidebar(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_KEY) === 'true';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

type AppState = {
  theme: Theme;
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
};

export const useAppStore = create<AppState>((set, get) => {
  // Aplica el tema inicial al <html> para evitar flashes al primer paint.
  const initialTheme = readTheme();
  if (typeof document !== 'undefined') applyTheme(initialTheme);

  return {
    theme: initialTheme,
    sidebarCollapsed: readSidebar(),
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      set({ theme: next });
    },
    setTheme: (theme) => {
      window.localStorage.setItem(THEME_KEY, theme);
      applyTheme(theme);
      set({ theme });
    },
    toggleSidebar: () => {
      const next = !get().sidebarCollapsed;
      window.localStorage.setItem(SIDEBAR_KEY, String(next));
      set({ sidebarCollapsed: next });
    },
  };
});
