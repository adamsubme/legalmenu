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
          'bg-zinc-50 text-zinc-900': variant === 'default',
          'bg-zinc-800 text-zinc-300': variant === 'secondary',
          'border border-zinc-700 text-zinc-400': variant === 'outline',
          'bg-red-500/15 text-red-400 border border-red-500/20': variant === 'destructive',
          'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20': variant === 'success',
          'bg-amber-500/15 text-amber-400 border border-amber-500/20': variant === 'warning',
          'bg-blue-500/15 text-blue-400 border border-blue-500/20': variant === 'info',
        },
        className
      )}
      {...props}
    />
  );
}
