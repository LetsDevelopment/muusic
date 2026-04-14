import { cn } from '../../lib/utils';

const variants = {
  default: 'border-transparent bg-secondary text-secondary-foreground',
  outline: 'border border-border bg-transparent text-foreground',
  neutral: 'border border-border bg-secondary/60 text-secondary-foreground',
  success: 'border border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
  warning: 'border border-amber-400/25 bg-amber-400/10 text-amber-100',
  danger: 'border border-rose-400/25 bg-rose-400/10 text-rose-100',
  info: 'border border-sky-400/25 bg-sky-400/10 text-sky-100',
  accent: 'border border-sky-300/30 bg-sky-300/12 text-sky-50',
  origin: 'border border-border bg-background text-muted-foreground'
};

export default function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
