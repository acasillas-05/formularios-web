import { ChevronDown, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '../../lib/cn';

type Option = { value: string; label: string };

type SearchableSelectProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: readonly Option[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  invalid?: boolean;
  id?: string;
};

const BASE =
  'w-full bg-bg-surface border border-border rounded-lg pl-3 pr-9 py-2 text-text text-sm ' +
  'placeholder:text-muted/50 transition-colors ' +
  'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  isLoading,
  invalid,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // Click fuera cierra
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reset search cuando cierra
  useEffect(() => {
    if (!open) setSearch('');
    else setHighlighted(0);
  }, [open]);

  // Scroll del highlighted a la vista
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  function choose(opt: Option): void {
    onChange(opt.value);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear(): void {
    onChange(undefined);
    setSearch('');
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlighted((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlighted];
      if (opt) choose(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  const displayValue = open ? search : selected?.label ?? '';
  const effectivePlaceholder = isLoading ? 'Cargando catalogo...' : placeholder ?? 'Buscar...';

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={displayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => {
          if (!disabled && !isLoading) setOpen(true);
        }}
        onKeyDown={handleKey}
        placeholder={effectivePlaceholder}
        disabled={disabled || isLoading}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
        className={cn(BASE, invalid && 'border-danger focus:border-danger focus:ring-danger/30')}
      />

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-muted">
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : selected && !open ? (
          <button
            type="button"
            onClick={clear}
            className="p-1 hover:text-text transition-colors rounded"
            aria-label="Limpiar"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={16} />
        )}
      </div>

      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          className={cn(
            'absolute z-40 mt-1 left-0 right-0 bg-bg-card border border-border rounded-lg',
            'shadow-xl shadow-black/50 max-h-64 overflow-y-auto py-1',
          )}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted/70">Sin resultados</li>
          ) : (
            filtered.map((o, i) => {
              const isSelected = o.value === value;
              const isHighlighted = i === highlighted;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    // mousedown para evitar blur antes del click
                    e.preventDefault();
                    choose(o);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={cn(
                    'px-3 py-1.5 text-sm cursor-pointer truncate',
                    isSelected && 'text-accent',
                    isHighlighted && 'bg-bg-surface',
                  )}
                >
                  {o.label}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
