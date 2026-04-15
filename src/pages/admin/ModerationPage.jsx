import { useMemo, useState } from 'react';
import { EyeOff, Flag, ShieldAlert, ShieldMinus, Siren, TriangleAlert } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import KpiCard from '../../components/ui/KpiCard';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import StatusDot from '../../components/ui/StatusDot';
import { mockModerationContent, moderationPriorityOptions, moderationTypeOptions } from '../../mocks/moderationContent';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function highlightTerms(text, terms) {
  if (!terms.length) return text;
  const escapedTerms = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  return text.split(regex).map((part, index) => {
    const match = terms.find((term) => term.toLowerCase() === part.toLowerCase());
    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <mark key={`${part}-${index}`} className="rounded bg-amber-400/15 px-1 py-0.5 text-amber-100">
        {part}
      </mark>
    );
  });
}

export default function ModerationPage() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const moderationItems = useMemo(() => {
    const term = query.trim().toLowerCase();

    return mockModerationContent
      .filter((item) => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
        if (!term) return true;

        return `${item.userName} ${item.user} ${item.source} ${item.text} ${item.suspiciousTerms.join(' ')}`.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const priorityWeight = { critical: 3, warning: 2, normal: 1 };
        const severityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (severityDiff !== 0) return severityDiff;
        return b.reports - a.reports;
      });
  }, [priorityFilter, query, typeFilter]);

  const kpis = useMemo(() => {
    const total = mockModerationContent.length;
    const reported = mockModerationContent.filter((item) => item.reports > 0).length;
    const critical = mockModerationContent.filter((item) => item.priority === 'critical').length;
    const suspicious = mockModerationContent.filter((item) => item.suspiciousTerms.length > 0).length;

    return { total, reported, critical, suspicious };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderação"
        subtitle="Fila otimizada para leitura rápida, priorização de conteúdo crítico e ação em poucos cliques."
      />

      <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <KpiCard label="Conteúdos monitorados" value={kpis.total} size="compact" align="left" />
        <KpiCard label="Denunciados" value={kpis.reported} size="compact" align="left" />
        <KpiCard label="Prioridade crítica" value={kpis.critical} size="compact" align="left" />
        <KpiCard label="Termos suspeitos" value={kpis.suspicious} size="compact" align="left" />
      </section>

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Fila moderável</CardTitle>
              <p className="text-sm text-muted-foreground">Posts e comentários com leitura rápida, contexto e ações operacionais.</p>
            </div>
            <Badge variant="neutral">Tempo real mockado</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_220px_220px]">
            <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuário, origem, texto ou termo suspeito" />
            <Select ariaLabel="Filtrar por tipo" value={typeFilter} onValueChange={setTypeFilter} options={moderationTypeOptions} />
            <Select ariaLabel="Filtrar por prioridade" value={priorityFilter} onValueChange={setPriorityFilter} options={moderationPriorityOptions} />
          </div>

          {moderationItems.length === 0 ? (
            <EmptyState
              title="Nenhum conteúdo encontrado"
              description="Ajuste os filtros para inspecionar outro recorte da fila."
              actionLabel="Limpar filtros"
              onAction={() => {
                setQuery('');
                setTypeFilter('all');
                setPriorityFilter('all');
              }}
            />
          ) : (
            <div className="space-y-3">
              {moderationItems.map((item) => {
                const isReported = item.reports > 0;
                const isCritical = item.priority === 'critical';

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-border bg-card/70 p-5 transition-colors"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {isReported ? (
                            <Badge variant={isCritical ? 'warning' : 'info'}>
                              <Flag className="mr-1 h-3 w-3" />
                              Denunciado
                            </Badge>
                          ) : null}
                          {item.suspiciousTerms.length > 0 ? (
                            <Badge variant="outline">
                              <TriangleAlert className="mr-1 h-3 w-3" />
                              Termos suspeitos
                            </Badge>
                          ) : null}
                          <Badge variant="neutral">{item.contentLabel}</Badge>
                          <Badge variant="origin">{item.source}</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                              {item.userName
                                .split(' ')
                                .map((token) => token[0])
                                .slice(0, 2)
                                .join('')}
                            </span>
                            <div className="space-y-0.5">
                              <div>{item.userName}</div>
                              <div className="text-xs text-muted-foreground">
                                @{item.user} • {item.cityState}
                              </div>
                            </div>
                          </div>
                          <span>{formatDate(item.createdAt)}</span>
                          <span>{item.reports} denúncias</span>
                        </div>

                        <div className="max-w-4xl text-[15px] leading-7 text-foreground">{highlightTerms(item.text, item.suspiciousTerms)}</div>

                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                          <div className="rounded-xl border border-border bg-background/30 p-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              <Siren className="h-4 w-4" />
                              Termos suspeitos
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.suspiciousTerms.length > 0 ? (
                                item.suspiciousTerms.map((term) => (
                                  <Badge key={term} variant="warning">
                                    {term}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">Nenhum termo suspeito identificado.</span>
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-border bg-background/30 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Motivos da sinalização</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.reportReasons.length > 0 ? (
                                item.reportReasons.map((reason) => (
                                  <Badge key={reason} variant="outline">
                                    {reason}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">Sem denúncia formal, apenas varredura por termos.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[220px]">
                        <div className="rounded-xl border border-border bg-background/30 p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            <StatusDot variant={isCritical ? 'warning' : isReported ? 'info' : 'neutral'} />
                            Prioridade
                          </div>
                          <div className="mt-2 text-sm font-medium text-foreground">
                            {isCritical ? 'Crítica' : isReported ? 'Revisar agora' : 'Monitoramento'}
                          </div>
                        </div>

                        <Button type="button" variant="secondary" className="justify-start">
                          <EyeOff className="h-4 w-4" />
                          Ocultar conteúdo
                        </Button>
                        <Button type="button" variant="outline" className="justify-start">
                          <ShieldMinus className="h-4 w-4" />
                          Bloquear usuário
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
