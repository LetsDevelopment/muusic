import { useMemo, useState } from 'react';
import { Flag, Search, ShieldCheck, Trash2 } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import KpiCard from '../../components/ui/KpiCard';
import PreviewPanel from '../../components/ui/PreviewPanel';
import Select from '../../components/ui/Select';
import { mockModerationContent, moderationTypeOptions } from '../../mocks/moderationContent';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function ModerationPage() {
  const [items, setItems] = useState(mockModerationContent);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [feedback, setFeedback] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!q) return true;
      const hay = `${item.user} ${item.text} ${item.source}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, typeFilter]);

  const kpis = useMemo(() => {
    const total = items.length;
    const reported = items.filter((item) => item.reports > 0).length;
    const posts = items.filter((item) => item.type === 'post').length;
    return { total, reported, posts };
  }, [items]);

  function removeContent(itemId) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setFeedback('Conteúdo removido da visualização de moderação (mock).');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Moderação" subtitle="Remoção administrativa de conteúdos publicados por usuários (modo mock)." />

      <section className="grid gap-4 lg:grid-cols-3">
        <KpiCard icon={ShieldCheck} label="Conteúdos monitorados" value={kpis.total} />
        <KpiCard icon={Flag} label="Com denúncias" value={kpis.reported} />
        <KpiCard icon={Search} label="Posts no conjunto" value={kpis.posts} />
      </section>

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl">Fila de moderação</CardTitle>
            <Badge variant="neutral">Mock</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por usuário, origem ou texto..." aria-label="Buscar conteúdo" />
            <Select ariaLabel="Filtrar por tipo" value={typeFilter} onValueChange={setTypeFilter} options={moderationTypeOptions} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Nenhum conteúdo encontrado"
              description="Ajuste os filtros para visualizar itens na moderação."
              actionLabel="Limpar filtros"
              onAction={() => {
                setQuery('');
                setTypeFilter('all');
              }}
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map((item) => (
                <PreviewPanel
                  key={item.id}
                  title={item.user}
                  description={item.text}
                  eyebrow={formatDate(item.createdAt)}
                  footer={
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Denúncias: {item.reports}</span>
                      <Button type="button" variant="outline" className="admin-cta-new" onClick={() => removeContent(item.id)}>
                        <Trash2 className="h-4 w-4" />
                        Apagar conteúdo
                      </Button>
                    </div>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={item.reports > 0 ? 'warning' : 'neutral'}>{item.type}</Badge>
                    <Badge variant="outline">{item.source}</Badge>
                  </div>
                </PreviewPanel>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
