import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

const BASE =
  'w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm ' +
  'placeholder:text-muted/50 transition-colors ' +
  'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(BASE, invalid && 'border-danger focus:border-danger focus:ring-danger/30', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
