import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-zinc-50 text-zinc-900 hover:bg-zinc-200': variant === 'default',
            'border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800': variant === 'outline',
            'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100': variant === 'ghost',
            'bg-red-600 text-zinc-50 hover:bg-red-700': variant === 'destructive',
            'bg-zinc-800 text-zinc-300 hover:bg-zinc-700': variant === 'secondary',
          },
          {
            'h-9 px-4 py-2': size === 'default',
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-6': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
