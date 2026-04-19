import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:    'bg-primary/15 text-primary',
        secondary:  'bg-muted text-muted-foreground',
        destructive:'bg-red-50 text-red-600',
        outline:    'border border-border text-foreground bg-transparent',
        success:    'bg-emerald-50 text-emerald-700',
        warning:    'bg-amber-50 text-amber-700',
        pending:    'bg-amber-50 text-amber-700',
        approved:   'bg-emerald-50 text-emerald-700',
        cancelled:  'bg-red-50 text-red-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
