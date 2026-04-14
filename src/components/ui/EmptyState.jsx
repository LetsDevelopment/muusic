import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-card/70 p-10 text-center">
      <div className="max-w-sm space-y-3">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-border bg-secondary/70">
          <Inbox className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="text-[18px] font-semibold leading-[26px] text-foreground">{title}</h3>
        <p className="text-[14px] leading-[22px] text-muted-foreground">{description}</p>
        {actionLabel ? (
          <Button variant="secondary" className="mt-2" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
