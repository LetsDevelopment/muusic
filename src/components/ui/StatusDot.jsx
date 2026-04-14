import { cn } from '../../lib/utils';

const variants = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  info: 'bg-sky-400',
  neutral: 'bg-slate-500'
};

export default function StatusDot({ variant = 'neutral', pulse = false, className }) {
  const color = variants[variant] || variants.neutral;

  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5 shrink-0', className)} aria-hidden="true">
      {pulse ? <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', color)} /> : null}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)} />
    </span>
  );
}
