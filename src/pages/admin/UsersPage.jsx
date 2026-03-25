import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, Download, Laptop2, Radio, Shield, UserCircle2, Users } from 'lucide-react';
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

export default function UsersPage({ apiFetch }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('mock');
  const [kpis, setKpis] = useState({ total: 0, admins: 0, standard: 0 });
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
      <PageHeader
        title="Usuarios"
        subtitle="Gestao de acesso administrativo e cadastro de contas"
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <KpiCard icon={Users} label="Total de usuarios" value={kpis.total} />
        <KpiCard icon={Shield} label="Administradores" value={kpis.admins} />
        <KpiCard icon={UserCircle2} label="Usuarios padrao" value={kpis.standard} />
      </section>

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl">Usuarios</CardTitle>
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
                    <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Musica agora</TableHead>
                  <TableHead>Historico</TableHead>
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
                          <TableCell className="font-medium">{user.name || 'Usuario'}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'ADMIN' ? 'success' : 'outline'}>{user.role === 'ADMIN' ? 'admin' : 'usuario'}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(user.createdAt)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{getMusicStatus(user)}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatSourceLabel(nowPlaying?.source, nowPlaying?.bridgeMode)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-3">
                              <span className="text-xs text-muted-foreground">
                                {music.historyCount || 0} registros
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedUserId((current) => (current === user.id ? null : user.id))}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                Detalhes
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {isExpanded ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6} className="bg-secondary/20">
                              <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                                <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-foreground">Leitura atual</div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {nowPlaying ? 'Estado atual persistido no banco' : 'Sem leitura musical ativa neste momento'}
                                      </div>
                                    </div>
                                    <Badge variant="outline">{formatSourceLabel(nowPlaying?.source, nowPlaying?.bridgeMode)}</Badge>
                                  </div>

                                  {nowPlaying ? (
                                    <div className="flex gap-4">
                                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/50">
                                        {nowPlaying.albumImageUrl ? (
                                          <img src={nowPlaying.albumImageUrl} alt={nowPlaying.trackName || 'Capa'} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                            <Radio className="h-6 w-6" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0 space-y-2">
                                        <div className="truncate text-lg font-semibold text-foreground">{nowPlaying.trackName || 'Faixa desconhecida'}</div>
                                        <div className="text-sm text-muted-foreground">{nowPlaying.artistName || 'Artista nao informado'}</div>
                                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                          <span>Inicio: {formatDate(nowPlaying.startedAt)}</span>
                                          <span>Expira: {formatDate(nowPlaying.expiresAt)}</span>
                                          {nowPlaying.externalUrl ? (
                                            <a
                                              href={nowPlaying.externalUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-primary underline-offset-4 hover:underline"
                                            >
                                              Abrir origem
                                            </a>
                                          ) : null}
                                        </div>
                                        {typeof nowPlaying.latitude === 'number' && typeof nowPlaying.longitude === 'number' ? (
                                          <div className="text-xs text-muted-foreground">
                                            Localizacao: {nowPlaying.latitude.toFixed(4)}, {nowPlaying.longitude.toFixed(4)}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-border bg-background/40 p-3">
                                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conexao</div>
                                      <div className="mt-2 space-y-2 text-sm text-foreground">
                                        <div>Spotify ID: <span className="text-muted-foreground">{music.spotifyId || 'nao conectado'}</span></div>
                                        <div>Bridge conectado em: <span className="text-muted-foreground">{formatDate(music.spotifyBridgeConnectedAt)}</span></div>
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-background/40 p-3">
                                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dispositivos do bridge</div>
                                      <div className="mt-2 space-y-2">
                                        {bridgeDevices.length === 0 ? (
                                          <div className="text-sm text-muted-foreground">Nenhum dispositivo ativo.</div>
                                        ) : (
                                          bridgeDevices.map((device) => (
                                            <div key={device.id} className="rounded-lg border border-border/80 bg-card/70 p-2">
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

                                <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-foreground">Historico musical</div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {music.historyCount || 0} registros carregados neste usuario
                                      </div>
                                    </div>
                                  </div>

                                  {music.recentTracks?.length ? (
                                    <div className="rounded-xl border border-border bg-background/40 p-3">
                                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Faixas recentes</div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {music.recentTracks.map((track) => (
                                          <span key={track} className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
                                            {track}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="space-y-3">
                                    {musicHistory.length === 0 ? (
                                      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                        Nenhum historico musical salvo para este usuario.
                                      </div>
                                    ) : (
                                      musicHistory.map((entry) => (
                                        <div key={entry.id} className="flex gap-3 rounded-xl border border-border bg-background/40 p-3">
                                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40">
                                            {entry.cover ? (
                                              <img src={entry.cover} alt={entry.title} className="h-full w-full object-cover" />
                                            ) : null}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-foreground">{entry.title}</div>
                                            <div className="truncate text-sm text-muted-foreground">{entry.artist}</div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                              <span className="inline-flex items-center gap-1">
                                                <Clock3 className="h-3.5 w-3.5" />
                                                {formatDate(entry.playedAt)}
                                              </span>
                                              <Badge variant="outline">{formatSourceLabel(entry.source, entry.bridgeMode)}</Badge>
                                              {entry.externalUrl ? (
                                                <a
                                                  href={entry.externalUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="text-primary underline-offset-4 hover:underline"
                                                >
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
