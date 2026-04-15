import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, MessageCircleMore, RadioTower, Users2, Wifi } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import KpiCard from '../../components/ui/KpiCard';
import LoadingState from '../../components/ui/LoadingState';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import StatusDot from '../../components/ui/StatusDot';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import {
  calculateDashboardKpis,
  DASHBOARD_CITY_SORT_OPTIONS,
  DASHBOARD_MUSIC_SORT_OPTIONS,
  DASHBOARD_PERIOD_OPTIONS,
  DASHBOARD_REGION_OPTIONS,
  DASHBOARD_TAB_OPTIONS,
  DASHBOARD_USER_SORT_OPTIONS,
  DASHBOARD_VOLUME_OPTIONS,
  fetchUsersMock,
  mockDashboardCities,
  mockDashboardMusic,
  mockUsers
} from '../../mocks/adminUsers';

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDuration(minutes) {
  const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  const totalSeconds = Math.round(safeMinutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${mins}m ${String(seconds).padStart(2, '0')}s`;
}

function formatPercent(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${safe}%`;
}

function getPeriodMultiplier(period) {
  if (period === '24h') return 0.28;
  if (period === '7d') return 0.64;
  return 1;
}

function applyVolumeFilter(rows, value, key) {
  if (value === 'all') return rows;
  if (value === 'high') return rows.filter((row) => row[key] >= 15000 || row[key] >= 500);
  if (value === 'medium') return rows.filter((row) => row[key] >= 5000 && row[key] < 15000);
  return rows.filter((row) => row[key] < 5000);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [period, setPeriod] = useState('24h');
  const [region, setRegion] = useState('all');
  const [volume, setVolume] = useState('all');
  const [sortBy, setSortBy] = useState('plays');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const payload = await fetchUsersMock({ users: mockUsers });
    setUsers(Array.isArray(payload?.users) ? payload.users : mockUsers);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'users') setSortBy('plays');
    if (activeTab === 'music') setSortBy('plays');
    if (activeTab === 'cities') setSortBy('plays');
  }, [activeTab]);

  const dashboardKpis = useMemo(() => calculateDashboardKpis(users), [users]);
  const percentageBase = Math.max(dashboardKpis.totalUsers, 1);

  const userRows = useMemo(() => {
    const multiplier = getPeriodMultiplier(period);
    const term = search.trim().toLowerCase();
    const filtered = users
      .filter((user) => {
        if (region !== 'all' && user.region !== region) return false;
        if (!term) return true;
        return `${user.name} ${user.cityState}`.toLowerCase().includes(term);
      })
      .map((user) => ({
        ...user,
        periodPlays: Math.round(user.playsCount * multiplier),
        periodActivity: Math.round(user.activityCount * multiplier)
      }))
      .sort((a, b) => {
        if (sortBy === 'activity') return b.periodActivity - a.periodActivity;
        return b.periodPlays - a.periodPlays;
      });

    const withVolume = applyVolumeFilter(filtered, volume, sortBy === 'activity' ? 'periodActivity' : 'periodPlays');
    return withVolume.slice(0, 12);
  }, [period, region, search, sortBy, users, volume]);

  const musicRows = useMemo(() => {
    const multiplier = getPeriodMultiplier(period);
    const term = search.trim().toLowerCase();
    const filtered = mockDashboardMusic
      .filter((item) => {
        if (region !== 'all' && item.region !== region) return false;
        if (!term) return true;
        return `${item.title} ${item.topCityState}`.toLowerCase().includes(term);
      })
      .map((item) => ({
        ...item,
        periodPlays: Math.round(item.plays * multiplier),
        periodSimultaneousNow: Math.round(item.simultaneousNow * (0.75 + multiplier / 4)),
        periodPeak: Math.round(item.peakSimultaneous * (0.8 + multiplier / 5))
      }))
      .sort((a, b) => {
        if (sortBy === 'live') return b.periodSimultaneousNow - a.periodSimultaneousNow;
        if (sortBy === 'peak') return b.periodPeak - a.periodPeak;
        return b.periodPlays - a.periodPlays;
      });

    return applyVolumeFilter(filtered, volume, sortBy === 'live' ? 'periodSimultaneousNow' : sortBy === 'peak' ? 'periodPeak' : 'periodPlays');
  }, [period, region, search, sortBy, volume]);

  const cityRows = useMemo(() => {
    const multiplier = getPeriodMultiplier(period);
    const term = search.trim().toLowerCase();
    const filtered = mockDashboardCities
      .filter((item) => {
        if (region !== 'all' && item.region !== region) return false;
        if (!term) return true;
        return item.cityState.toLowerCase().includes(term);
      })
      .map((item) => ({
        ...item,
        periodPlays: Math.round(item.plays * multiplier),
        periodSimultaneousNow: Math.round(item.simultaneousNow * (0.75 + multiplier / 4)),
        periodPeak: Math.round(item.peakSimultaneous * (0.8 + multiplier / 5))
      }))
      .sort((a, b) => {
        if (sortBy === 'live') return b.periodSimultaneousNow - a.periodSimultaneousNow;
        if (sortBy === 'peak') return b.periodPeak - a.periodPeak;
        return b.periodPlays - a.periodPlays;
      });

    return applyVolumeFilter(filtered, volume, sortBy === 'live' ? 'periodSimultaneousNow' : sortBy === 'peak' ? 'periodPeak' : 'periodPlays');
  }, [period, region, search, sortBy, volume]);

  const sortOptions = activeTab === 'users' ? DASHBOARD_USER_SORT_OPTIONS : activeTab === 'music' ? DASHBOARD_MUSIC_SORT_OPTIONS : DASHBOARD_CITY_SORT_OPTIONS;

  const kpiCards = [
    { label: 'Total de usuários', value: formatNumber(dashboardKpis.totalUsers), icon: Users2 },
    {
      label: 'Usuários ativos',
      value: formatNumber(dashboardKpis.activeUsers),
      hint: formatPercent(Math.round((dashboardKpis.activeUsers / percentageBase) * 100)),
      icon: Activity
    },
    {
      label: 'Usuários online',
      value: formatNumber(dashboardKpis.onlineUsers),
      hint: formatPercent(Math.round((dashboardKpis.onlineUsers / percentageBase) * 100)),
      icon: Wifi
    },
    {
      label: 'Usuários interagindo',
      value: formatNumber(dashboardKpis.interactingUsers),
      hint: formatPercent(Math.round((dashboardKpis.interactingUsers / percentageBase) * 100)),
      icon: RadioTower
    },
    { label: 'Tempo médio de sessão', value: formatDuration(dashboardKpis.avgSessionMinutes), icon: Clock3 },
    { label: 'Sessões de chat abertas', value: formatNumber(dashboardKpis.openChatSessions), icon: MessageCircleMore }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Geral"
        subtitle="Visão macro e data-driven da plataforma para leitura rápida, priorização e tomada de decisão."
      />

      <section className="grid gap-4 xl:grid-cols-6 md:grid-cols-3">
        {kpiCards.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} size="compact" align="left" />
        ))}
      </section>

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Leitura operacional</CardTitle>
              <p className="text-sm text-muted-foreground">Listas leves, filtros rápidos e ordenação por prioridade de análise.</p>
            </div>
            <Badge variant="neutral">Fonte: Mock</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_TAB_OPTIONS.map((tab) => {
              const active = tab.value === activeTab;
              return (
                <Button key={tab.value} type="button" variant={active ? 'secondary' : 'ghost'} className={active ? 'border border-sky-300/20 bg-sky-300/10 text-sky-50' : ''} onClick={() => setActiveTab(tab.value)}>
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.9fr)_170px_170px_minmax(260px,0.9fr)]">
            <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, música ou cidade" />
            <Select ariaLabel="Filtrar por período" value={period} onValueChange={setPeriod} options={DASHBOARD_PERIOD_OPTIONS} />
            <Select ariaLabel="Filtrar por região" value={region} onValueChange={setRegion} options={DASHBOARD_REGION_OPTIONS} />
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-2">
              <Select ariaLabel="Filtrar por volume" value={volume} onValueChange={setVolume} options={DASHBOARD_VOLUME_OPTIONS} />
              <Select ariaLabel="Ordenar por" value={sortBy} onValueChange={setSortBy} options={sortOptions} />
            </div>
          </div>

          {loading ? (
            <LoadingState title="Carregando dashboard" description="Consolidando indicadores, listas e leituras operacionais." rows={5} />
          ) : activeTab === 'users' && userRows.length === 0 ? (
            <EmptyState title="Sem usuários para este recorte" description="Ajuste os filtros para visualizar outro grupo de usuários." />
          ) : activeTab === 'music' && musicRows.length === 0 ? (
            <EmptyState title="Sem músicas para este recorte" description="Ajuste período, região ou volume para comparar outro grupo." />
          ) : activeTab === 'cities' && cityRows.length === 0 ? (
            <EmptyState title="Sem cidades para este recorte" description="Tente ampliar o filtro para exibir mais regiões." />
          ) : (
            <div className="rounded-2xl border border-border">
              <Table>
                {activeTab === 'users' ? (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Reproduções</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Cidade-estado</TableHead>
                        <TableHead>Online</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRows.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                          <TableCell>{formatNumber(user.periodPlays)}</TableCell>
                          <TableCell>{formatNumber(user.periodActivity)}</TableCell>
                          <TableCell>{user.cityState}</TableCell>
                          <TableCell>{user.isOnline ? <StatusDot variant="success" size="xs" /> : <StatusDot variant="neutral" size="xs" />}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                ) : null}

                {activeTab === 'music' ? (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Música</TableHead>
                        <TableHead>Total de reproduções</TableHead>
                        <TableHead>Ouvintes agora</TableHead>
                        <TableHead>Pico simultâneo</TableHead>
                        <TableHead>Cidade-estado líder</TableHead>
                        <TableHead>Online</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {musicRows.map((song) => (
                        <TableRow key={song.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{song.title}</span>
                              {song.isNew ? <Badge variant="accent">Inédita</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>{formatNumber(song.periodPlays)}</TableCell>
                          <TableCell>{formatNumber(song.periodSimultaneousNow)}</TableCell>
                          <TableCell>{formatNumber(song.periodPeak)}</TableCell>
                          <TableCell>{song.topCityState}</TableCell>
                          <TableCell>{song.isOnline ? <StatusDot variant="success" size="xs" /> : <StatusDot variant="neutral" size="xs" />}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                ) : null}

                {activeTab === 'cities' ? (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cidade-estado</TableHead>
                        <TableHead>Reproduções</TableHead>
                        <TableHead>Ouvintes agora</TableHead>
                        <TableHead>Pico simultâneo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cityRows.map((city) => (
                        <TableRow key={city.id}>
                          <TableCell className="font-medium text-foreground">{city.cityState}</TableCell>
                          <TableCell>{formatNumber(city.periodPlays)}</TableCell>
                          <TableCell>{formatNumber(city.periodSimultaneousNow)}</TableCell>
                          <TableCell>{formatNumber(city.periodPeak)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                ) : null}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
