import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  /** ms antes de auto-dismiss. 0 = no auto-dismiss. Default 5000. */
  duration?: number;
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

function makeId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = makeId();
    const toast: Toast = { id, duration: 5000, ...t };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    if (toast.duration && toast.duration > 0) {
      window.setTimeout(() => {
        get().dismiss(id);
      }, toast.duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export function toast(input: Omit<Toast, 'id'>): string {
  return useToastStore.getState().push(input);
}
