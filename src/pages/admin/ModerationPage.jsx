import { useMemo, useState } from 'react';
import { EyeOff, Flag, ShieldMinus, ShieldAlert, TriangleAlert } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import KpiCard from '../../components/ui/KpiCard';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
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
      <mark key={`${part}-${index}`} className="rounded bg-sky-500/12 px-1 py-0.5 text-sky-700 dark:text-sky-200">
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

    return {
      total,
      totalPct: '100%',
      reported,
      reportedPct: `${Math.round((reported / total) * 100)}%`,
      critical,
      criticalPct: `${Math.round((critical / total) * 100)}%`,
      suspicious,
      suspiciousPct: `${Math.round((suspicious / total) * 100)}%`
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderação"
        subtitle="Fila otimizada para leitura rápida, priorização de conteúdo crítico e ação em poucos cliques."
      />

      <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <KpiCard label="Mensagens totais" value={kpis.total} hint={kpis.totalPct} icon={ShieldAlert} size="compact" />
        <KpiCard label="Denúncias" value={kpis.reported} hint={kpis.reportedPct} icon={Flag} size="compact" />
        <KpiCard label="Termos suspeitos" value={kpis.suspicious} hint={kpis.suspiciousPct} icon={TriangleAlert} size="compact" />
        <KpiCard label="Críticas" value={kpis.critical} hint={kpis.criticalPct} icon={ShieldAlert} size="compact" />
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
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_220px]">
            <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuário, origem, texto ou termo suspeito" />
            <Select ariaLabel="Filtrar por tipo" value={typeFilter} onValueChange={setTypeFilter} options={moderationTypeOptions} />
          </div>

          <div className="flex flex-wrap gap-2">
            {moderationPriorityOptions.map((option) => {
              const active = option.value === priorityFilter;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? 'secondary' : 'ghost'}
                  className={active ? 'border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-100' : ''}
                  onClick={() => setPriorityFilter(option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
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
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-border bg-card/70 p-5 transition-colors"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-4">
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
                      </div>

                      <div className="flex w-full shrink-0 flex-col gap-3 xl:w-[220px]">
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
