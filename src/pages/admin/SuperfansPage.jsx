import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Trophy, Users2 } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import KpiCard from '../../components/ui/KpiCard';
import StatusDot from '../../components/ui/StatusDot';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { mockUsers } from '../../mocks/adminUsers';

const PERIOD_TABS = [
  { value: 'all', label: 'Todo o período', multiplier: 1.24 },
  { value: '7d', label: 'Última semana', multiplier: 0.34 },
  { value: '15d', label: 'Últimos 15 dias', multiplier: 0.55 },
  { value: '30d', label: 'Último mês', multiplier: 0.78 }
];

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function movementMeta(value) {
  if (value > 0) {
    return {
      label: `+${value}`,
      icon: ArrowUpRight,
      className: 'text-emerald-600 dark:text-emerald-400'
    };
  }

  if (value < 0) {
    return {
      label: String(value),
      icon: ArrowDownRight,
      className: 'text-rose-600 dark:text-rose-400'
    };
  }

  return {
    label: '0',
    icon: Minus,
    className: 'text-muted-foreground'
  };
}

export default function SuperfansPage() {
  const [period, setPeriod] = useState('all');
  const activePeriod = PERIOD_TABS.find((tab) => tab.value === period) || PERIOD_TABS[0];

  const rows = useMemo(() => {
    return mockUsers
      .map((user, index) => {
        const score = Math.round((user.activityCount * 1.45 + user.playsCount * 0.62) * activePeriod.multiplier);
        const plays = Math.round(user.playsCount * activePeriod.multiplier);
        const movement = ((index * 7) % 9) - 4;

        return {
          ...user,
          score,
          plays,
          movement
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((user, index) => ({
        ...user,
        rank: index + 1
      }));
  }, [activePeriod]);

  const kpis = useMemo(() => {
    const online = rows.filter((user) => user.isOnline).length;
    const avgScore = rows.length ? Math.round(rows.reduce((sum, user) => sum + user.score, 0) / rows.length) : 0;
    const topCity = rows[0]?.cityState || '-';

    return {
      total: rows.length,
      online,
      avgScore,
      topCity
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Superfãs" subtitle="Ranking dos usuários mais ativos na plataforma, com leitura rápida de posição, atividade e movimento." />

      <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <KpiCard label="Usuários no ranking" value={kpis.total} icon={Users2} size="compact" />
        <KpiCard label="Online agora" value={kpis.online} hint={`${Math.round((kpis.online / Math.max(kpis.total, 1)) * 100)}%`} icon={Users2} size="compact" />
        <KpiCard label="Score médio" value={kpis.avgScore} icon={Trophy} size="compact" />
        <KpiCard label="Cidade líder" value={kpis.topCity} icon={Trophy} size="compact" />
      </section>

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Ranking de atividade</CardTitle>
              <p className="text-sm text-muted-foreground">Top 50 usuários com maior atividade combinada na plataforma.</p>
            </div>
            <Badge variant="neutral">Fonte: Mock</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PERIOD_TABS.map((tab) => {
              const active = tab.value === period;
              return (
                <Button
                  key={tab.value}
                  type="button"
                  variant={active ? 'secondary' : 'ghost'}
                  className={active ? 'border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-100' : ''}
                  onClick={() => setPeriod(tab.value)}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Reproduções</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Cidade-estado</TableHead>
                <TableHead>Movimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const movement = movementMeta(user.movement);
                const MovementIcon = movement.icon;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="w-[72px] font-medium text-foreground">{user.rank}</TableCell>
                    <TableCell className="min-w-[280px]">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                          {user.avatarInitials}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{user.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <StatusDot variant={user.isOnline ? 'success' : 'neutral'} size="sm" />
                            @{user.email.split('@')[0]}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(user.score)}</TableCell>
                    <TableCell>{formatNumber(user.plays)}</TableCell>
                    <TableCell>{formatNumber(user.activityCount)}</TableCell>
                    <TableCell>{user.cityState}</TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center gap-1 text-sm font-medium ${movement.className}`}>
                        <MovementIcon className="h-4 w-4" />
                        <span>{movement.label}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
