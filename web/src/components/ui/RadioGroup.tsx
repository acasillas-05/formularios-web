import { cn } from '../../lib/cn';

type RadioGroupProps = {
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
  invalid?: boolean;
  columns?: 1 | 2 | 3;
};

export function RadioGroup({ name, value, onChange, options, disabled, invalid, columns = 1 }: RadioGroupProps) {
  const gridClass = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  return (
    <div role="radiogroup" aria-invalid={invalid || undefined} className={cn('grid gap-2', gridClass)}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
              'text-sm',
              checked
                ? 'border-accent bg-accent/10 text-text'
                : 'border-border bg-bg-surface text-muted hover:border-accent/40 hover:text-text',
              disabled && 'opacity-50 cursor-not-allowed',
              invalid && !checked && 'border-danger/40',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span
              className={cn(
                'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                checked ? 'border-accent' : 'border-muted/40',
              )}
            >
              {checked ? <span className="w-2 h-2 rounded-full bg-accent" /> : null}
            </span>
            <span className="truncate">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
