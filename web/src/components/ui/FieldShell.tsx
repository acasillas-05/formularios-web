import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

type FieldShellProps = {
  label: string;
  htmlFor?: string;
  description?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Wrapper comun de controles de formulario: label + required asterisk +
 * description + children + error. Mantiene espaciado y tipografia consistentes.
 */
export function FieldShell({
  label,
  htmlFor,
  description,
  required,
  error,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
        {label}
        {required ? <span className="text-danger ml-1" aria-hidden="true">*</span> : null}
      </label>
      {description ? <p className="text-xs text-muted/80 -mt-0.5">{description}</p> : null}
      {children}
      {error ? (
        <p className="text-xs text-danger mt-0.5" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
