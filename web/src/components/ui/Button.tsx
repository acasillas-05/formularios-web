import { Loader2, type LucideIcon } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-bg-primary hover:bg-accent/90',
  secondary: 'bg-bg-surface text-text border border-border hover:border-accent/40',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
  ghost: 'bg-transparent text-text hover:bg-bg-surface/60',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const ICON_SIZES: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    className,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const iconSize = ICON_SIZES[size];
  const isDisabled = disabled || loading;
  const renderIcon = loading ? (
    <Loader2 size={iconSize} className="animate-spin" />
  ) : Icon ? (
    <Icon size={iconSize} />
  ) : null;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-accent/40',
        isDisabled && 'opacity-50 cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {iconPosition === 'left' && renderIcon}
      {children}
      {iconPosition === 'right' && renderIcon}
    </button>
  );
});
