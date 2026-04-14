import Skeleton from './Skeleton';

export default function LoadingState({ title = 'Carregando dados', description = 'Aguarde um instante enquanto atualizamos esta seção.', rows = 3 }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="mb-4 space-y-1">
        <p className="text-[14px] font-semibold leading-[22px] text-foreground">{title}</p>
        <p className="text-[13px] leading-[20px] text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}
