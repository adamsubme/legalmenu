import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        {
          'text-zinc-900': variant === 'default',
          'text-zinc-300': variant === 'secondary',
          'text-zinc-400 border': variant === 'outline',
          'text-red-400': variant === 'destructive',
          'text-emerald-400': variant === 'success',
          'text-amber-400': variant === 'warning',
          'text-blue-400': variant === 'info',
        },
        className
      )}
      style={{
        backgroundColor:
          variant === 'default' ? 'var(--mc-text)' :
          variant === 'secondary' ? 'var(--mc-bg-tertiary)' :
          variant === 'outline' ? 'transparent' :
          variant === 'destructive' ? 'rgba(239,68,68,0.15)' :
          variant === 'success' ? 'rgba(34,197,94,0.15)' :
          variant === 'warning' ? 'rgba(234,179,8,0.15)' :
          variant === 'info' ? 'rgba(59,130,246,0.15)' :
          undefined,
        borderColor:
          variant === 'outline' ? 'var(--mc-border)' :
          variant === 'destructive' ? 'rgba(239,68,68,0.2)' :
          variant === 'success' ? 'rgba(34,197,94,0.2)' :
          variant === 'warning' ? 'rgba(234,179,8,0.2)' :
          variant === 'info' ? 'rgba(59,130,246,0.2)' :
          undefined,
      }}
      {...props}
    />
  );
}
