import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  placeholder?: string;
  options: readonly { value: string; label: string }[];
};

const BASE =
  'w-full bg-bg-surface border border-border rounded-lg pl-3 pr-9 py-2 text-text text-sm ' +
  'transition-colors appearance-none ' +
  'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, options, placeholder, value, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        value={value ?? ''}
        className={cn(BASE, invalid && 'border-danger focus:border-danger focus:ring-danger/30', className)}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
});
