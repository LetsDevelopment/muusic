import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, Download, Laptop2, Radio } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import KpiCard from '../../components/ui/KpiCard';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Skeleton from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { DEFAULT_USERS_PAGE_SIZE, fetchUsersFromApi, fetchUsersMock, mockUsers, USER_ROLE_OPTIONS } from '../../mocks/adminUsers';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatSourceLabel(source, bridgeMode) {
  if (source === 'bridge' && bridgeMode === 'desktop') return 'App instalado';
  if (source === 'bridge' && bridgeMode === 'browser') return 'Navegador';
  if (source === 'bridge') return 'Bridge';
  if (source === 'spotify') return 'Spotify OAuth';
  return source || '-';
}

function getMusicStatus(user) {
  const nowPlaying = user?.music?.nowPlaying;
  if (!nowPlaying?.trackName && !nowPlaying?.artistName) return 'Sem leitura ativa';
  return `${nowPlaying.trackName || 'Faixa desconhecida'} • ${nowPlaying.artistName || 'Artista nao informado'}`;
}

function getUserMeta(user) {
  const totalReproductions = Number(user?.music?.historyCount || 0);
  if (totalReproductions === 1) return '1 reproducao salva';
  return `${totalReproductions} reproducoes salvas`;
}

function isUserPlayingNow(user) {
  const expiresAt = user?.music?.nowPlaying?.expiresAt ? new Date(user.music.nowPlaying.expiresAt).getTime() : 0;
  if (!Number.isFinite(expiresAt) || !expiresAt) return false;
  return expiresAt > Date.now();
}

function exportUsersCsv(items) {
  const header = ['name', 'email', 'role', 'createdAt', 'spotifyId', 'bridgeConnectedAt', 'nowPlaying', 'musicSource', 'historyCount'];
  const rows = items.map((item) => [
    item.name || '',
    item.email,
    item.role,
    item.createdAt || '',
    item.music?.spotifyId || '',
    item.music?.spotifyBridgeConnectedAt || '',
    getMusicStatus(item),
    formatSourceLabel(item.music?.nowPlaying?.source, item.music?.nowPlaying?.bridgeMode),
    item.music?.historyCount || 0
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'usuarios.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function SourceBadge({ source, bridgeMode }) {
  return <Badge variant="outline">{formatSourceLabel(source, bridgeMode)}</Badge>;
}

function MusicSnapshotCard({ music }) {
  const nowPlaying = music?.nowPlaying || null;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Leitura atual</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {nowPlaying ? 'Estado atual salvo para mapa, feed e historico.' : 'Nenhuma reproducao ativa detectada no momento.'}
          </div>
        </div>
        <SourceBadge source={nowPlaying?.source} bridgeMode={nowPlaying?.bridgeMode} />
      </div>

      {nowPlaying ? (
        <div className="mt-4 flex gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/50">
            {nowPlaying.albumImageUrl ? (
              <img src={nowPlaying.albumImageUrl} alt={nowPlaying.trackName || 'Capa'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Radio className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-foreground">{nowPlaying.trackName || 'Faixa desconhecida'}</div>
            <div className="mt-1 truncate text-sm text-muted-foreground">{nowPlaying.artistName || 'Artista nao informado'}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Inicio: {formatDate(nowPlaying.startedAt)}</span>
              <span>Expira: {formatDate(nowPlaying.expiresAt)}</span>
              {nowPlaying.externalUrl ? (
                <a href={nowPlaying.externalUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                  Abrir origem
                </a>
              ) : null}
            </div>
            {typeof nowPlaying.latitude === 'number' && typeof nowPlaying.longitude === 'number' ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Localizacao: {nowPlaying.latitude.toFixed(4)}, {nowPlaying.longitude.toFixed(4)}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ConnectionSnapshotCard({ music, bridgeDevices }) {
  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="text-sm font-semibold text-foreground">Conexoes e dispositivos</div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta</div>
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <div>Spotify ID: <span className="text-muted-foreground">{music.spotifyId || 'nao conectado'}</span></div>
            <div>Bridge conectado em: <span className="text-muted-foreground">{formatDate(music.spotifyBridgeConnectedAt)}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agentes locais</div>
          <div className="mt-3 space-y-2">
            {bridgeDevices.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum dispositivo ativo.</div>
            ) : (
              bridgeDevices.map((device) => (
                <div key={device.id} className="rounded-lg border border-border/80 bg-card/70 p-2.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Laptop2 className="h-4 w-4 text-muted-foreground" />
                    {device.deviceName}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {device.platform || 'plataforma nao informada'} • ultimo sinal {formatDate(device.lastSeenAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HistoryPanel({ music, musicHistory }) {
  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4">
      <div>
        <div className="text-sm font-semibold text-foreground">Historico musical</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {music.historyCount || 0} reproducoes salvas no banco
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {musicHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum historico musical salvo para este usuario.
          </div>
        ) : (
          musicHistory.map((entry) => (
            <div key={entry.id} className="flex gap-3 rounded-xl border border-border bg-background/40 p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40">
                {entry.cover ? <img src={entry.cover} alt={entry.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{entry.title}</div>
                <div className="truncate text-sm text-muted-foreground">{entry.artist}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(entry.playedAt)}
                  </span>
                  <SourceBadge source={entry.source} bridgeMode={entry.bridgeMode} />
                  {entry.externalUrl ? (
                    <a href={entry.externalUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                      Abrir
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function UsersPage({ apiFetch }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('mock');
  const [kpis, setKpis] = useState({ total: 0, admins: 0, standard: 0, topMusicUser: { name: 'Sem dados', count: 0 } });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState(null);

  const shouldFail = useMemo(() => typeof window !== 'undefined' && window.location.search.includes('adminError=1'), []);

  const loadData = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError('');
      try {
        let payload;
        if (apiFetch) {
          try {
            payload = await fetchUsersFromApi({ apiFetch, search, role: roleFilter, page: nextPage, pageSize: DEFAULT_USERS_PAGE_SIZE });
            setSource('api');
          } catch {
            payload = await fetchUsersMock({ users: mockUsers, search, role: roleFilter, page: nextPage, pageSize: DEFAULT_USERS_PAGE_SIZE, shouldFail });
            setSource('mock');
          }
        } else {
          payload = await fetchUsersMock({ users: mockUsers, search, role: roleFilter, page: nextPage, pageSize: DEFAULT_USERS_PAGE_SIZE, shouldFail });
          setSource('mock');
        }

        setKpis(payload.kpis);
        setItems(payload.items);
        setTotal(payload.total);
        setTotalPages(payload.totalPages);
        setPage(payload.page);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, page, roleFilter, search, shouldFail]
  );

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  useEffect(() => {
    setExpandedUserId(null);
  }, [search, roleFilter, page]);

  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" subtitle="Gestao de acesso administrativo, conexoes musicais e historico dos usuarios" />

      <section className="grid gap-4 lg:grid-cols-4">
        <KpiCard label="Total de usuarios" value={kpis.total} />
        <KpiCard label="Administradores" value={kpis.admins} />
        <KpiCard label="Usuarios padrao" value={kpis.standard} />
        <KpiCard label="Maior volume de reproducoes" value={kpis.topMusicUser?.count || 0} hint={kpis.topMusicUser?.name || 'Sem dados'} align="left" />
      </section>

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Usuarios</CardTitle>
              <p className="text-sm text-muted-foreground">Uma linha limpa por usuario e detalhes expandidos quando voce quiser investigar o historico musical.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{source === 'api' ? 'API' : 'Mock'}</Badge>
              <span className="text-sm text-muted-foreground">{total} registros</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <SearchInput value={search} placeholder="Buscar por nome ou e-mail..." onChange={(event) => setSearch(event.target.value)} aria-label="Buscar usuarios" />
            <Select ariaLabel="Filtrar por perfil" value={roleFilter} onValueChange={setRoleFilter} options={USER_ROLE_OPTIONS} />
            <Button variant="secondary" className="md:ml-auto" onClick={() => exportUsersCsv(items)}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {error ? <Alert>{error}</Alert> : null}

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum usuario encontrado"
              description="Ajuste os filtros para encontrar usuarios cadastrados."
              actionLabel="Limpar filtros"
              onAction={() => {
                setSearch('');
                setRoleFilter('all');
              }}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Status musical</TableHead>
                    <TableHead>Conexao</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((user) => {
                    const isExpanded = expandedUserId === user.id;
                    const music = user.music || {};
                    const nowPlaying = music.nowPlaying || null;
                    const musicHistory = Array.isArray(music.musicHistory) ? music.musicHistory : [];
                    const bridgeDevices = Array.isArray(music.bridgeDevices) ? music.bridgeDevices : [];

                    return (
                      <Fragment key={user.id}>
                        <TableRow>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-foreground">{user.name || 'Usuario'}</div>
                                {isUserPlayingNow(user) ? (
                                  <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-muted-foreground">{getUserMeta(user)}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{getMusicStatus(user)}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm text-foreground">{music.spotifyId ? 'Spotify conectado' : 'Sem Spotify OAuth'}</div>
                              <div className="text-xs text-muted-foreground">
                                {music.spotifyBridgeConnectedAt ? `Bridge desde ${formatDate(music.spotifyBridgeConnectedAt)}` : 'Sem bridge conectado'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant={isExpanded ? 'outline' : 'ghost'}
                              size="sm"
                              onClick={() => setExpandedUserId((current) => (current === user.id ? null : user.id))}
                              aria-expanded={isExpanded}
                              className={isExpanded ? 'text-white hover:text-white' : 'text-white hover:text-white'}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              {isExpanded ? 'Ocultar' : 'Abrir'}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {isExpanded ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={4} className="bg-secondary/15">
                              <div className="space-y-4">
                                <MusicSnapshotCard music={music} />
                                <ConnectionSnapshotCard music={music} bridgeDevices={bridgeDevices} />
                                <HistoryPanel music={music} musicHistory={musicHistory} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
