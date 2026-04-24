import { create } from 'zustand';

import type { AuthMeUser, FormListItem, FormSlug } from '../lib/types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

type AuthState = {
  status: AuthStatus;
  user: AuthMeUser | null;
  forms: FormListItem[];
  error: string | null;
  setLoading: () => void;
  setAuthenticated: (user: AuthMeUser, forms: FormListItem[]) => void;
  setError: (message: string) => void;
  reset: () => void;
  /** Utilidad para verificar si el usuario puede ver cierto formulario. */
  canAccess: (slug: FormSlug) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  forms: [],
  error: null,
  setLoading: () => set({ status: 'loading', error: null }),
  setAuthenticated: (user, forms) => set({ status: 'authenticated', user, forms, error: null }),
  setError: (message) => set({ status: 'error', error: message }),
  reset: () => set({ status: 'idle', user: null, forms: [], error: null }),
  canAccess: (slug) => get().forms.some((f) => f.slug === slug),
}));
