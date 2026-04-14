import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { cn } from '../../lib/utils';

export default function PreviewPanel({ title, description, eyebrow, footer, className, contentClassName, children }) {
  return (
    <Card className={cn('bg-card/70', className)}>
      <CardHeader className="space-y-1 pb-4">
        {eyebrow ? <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p> : null}
        {title ? <CardTitle>{title}</CardTitle> : null}
        {description ? <p className="text-[14px] leading-[22px] text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className={cn('space-y-4', contentClassName)}>
        {children}
        {footer ? <div className="border-t border-border pt-4">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
