import { cn } from '../../lib/utils';

export function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-auto rounded-xl border border-border">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border sticky top-0 z-10 bg-card', className)} {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn('border-b border-border transition-colors duration-150 hover:bg-secondary/40', className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return <th className={cn('h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)} {...props} />;
}

export function TableCell({ className, ...props }) {
  return <td className={cn('p-4 align-middle', className)} {...props} />;
}
