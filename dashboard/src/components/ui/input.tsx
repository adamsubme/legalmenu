import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border px-3 py-1 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      style={{
        backgroundColor: 'var(--mc-bg)',
        borderColor: 'var(--mc-border)',
        color: 'var(--mc-text)',
        '--tw-placeholder-color': 'var(--mc-text-muted)',
      } as React.CSSProperties}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
