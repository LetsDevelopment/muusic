import { Card, CardContent } from './Card';
import { cn } from '../../lib/utils';

export default function KpiCard({ label, value, hint = '', align = 'center', size = 'default' }) {
  const isLeft = align === 'left';
  const compact = size === 'compact';

  return (
    <Card
      className={cn(
        'border-0 bg-card/85 shadow-none transition duration-200 hover:-translate-y-0.5',
        compact ? 'min-h-[124px]' : 'min-h-[152px]'
      )}
    >
      <CardContent className={cn('flex h-full p-6 items-center justify-center')}>
        <div className={cn(compact ? 'text-center' : isLeft ? 'text-left' : 'text-center')}>
          <span className={cn('block font-semibold tracking-tight text-foreground', compact ? 'text-[32px] leading-[36px]' : 'text-4xl')}>
            {value}
          </span>
          <p className={cn('text-muted-foreground', compact ? 'mt-3 text-sm' : 'mt-4 text-sm')}>{label}</p>
          {hint ? <p className={cn('text-muted-foreground/80', compact ? 'mt-2 text-sm' : 'mt-2 text-xs')}>{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
