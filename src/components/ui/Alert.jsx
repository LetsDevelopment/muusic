import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

const variants = {
  error: {
    icon: AlertTriangle,
    className: 'border-rose-400/25 bg-rose-400/10 text-rose-100'
  },
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
  },
  info: {
    icon: Info,
    className: 'border-sky-400/25 bg-sky-400/10 text-sky-100'
  }
};

export default function Alert({ className, children, variant = 'error' }) {
  const current = variants[variant] || variants.error;
  const Icon = current.icon;

  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm', current.className, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
