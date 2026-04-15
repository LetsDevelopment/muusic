import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CalendarClock, Mail, MapPin, ShieldAlert, X } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import KpiCard from '../../components/ui/KpiCard';
import LoadingState from '../../components/ui/LoadingState';
import PreviewPanel from '../../components/ui/PreviewPanel';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import StatusDot from '../../components/ui/StatusDot';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import {
  calculateUsersKpis,
  fetchUsersMock,
  INITIAL_USERS_BATCH,
  mockUsers,
  queryUsers,
  USER_AGE_RANGE_OPTIONS,
  USER_GENDER_OPTIONS
} from '../../mocks/adminUsers';

function MiniAvatar({ initials }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
      {initials}
    </span>
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_USERS_BATCH);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [filters, setFilters] = useState({
    name: '',
    cityState: '',
    ageRange: 'all',
    gender: 'all',
    lastStreamDate: '',
    lastStreamSong: ''
  });

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
    setVisibleCount(INITIAL_USERS_BATCH);
  }, [filters]);

  const filteredUsers = useMemo(() => queryUsers({ users, ...filters }), [filters, users]);
  const visibleUsers = useMemo(() => filteredUsers.slice(0, visibleCount), [filteredUsers, visibleCount]);
  const selectedUser = useMemo(() => visibleUsers.find((user) => user.id === selectedUserId) || filteredUsers.find((user) => user.id === selectedUserId) || null, [filteredUsers, selectedUserId, visibleUsers]);
  const userKpis = useMemo(() => calculateUsersKpis(users), [users]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        subtitle="Base detalhada para leitura compacta, filtros operacionais e investigação individual sem perder contexto."
      />

      <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <KpiCard label="Total de usuários" value={userKpis.total} size="compact" align="left" />
        <KpiCard label="Usuários ativos" value={`${userKpis.active} · ${userKpis.activePercentage}%`} size="compact" align="left" />
        <KpiCard label="Menores de idade" value={`${userKpis.minors} · ${userKpis.minorsPercentage}%`} size="compact" align="left" />
        <KpiCard label="Média de reproduções por usuário" value={userKpis.averagePlays} size="compact" align="left" />
      </section>

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Base de usuários</CardTitle>
              <p className="text-sm text-muted-foreground">Lista compacta com filtros analíticos e acesso rápido ao histórico individual.</p>
            </div>
            <Badge variant="neutral">Fonte: Mock</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-6">
            <SearchInput value={filters.name} onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nome do usuário" />
            <Input value={filters.cityState} onChange={(event) => setFilters((prev) => ({ ...prev, cityState: event.target.value }))} placeholder="Cidade/Estado" />
            <Select ariaLabel="Filtrar por faixa etária" value={filters.ageRange} onValueChange={(value) => setFilters((prev) => ({ ...prev, ageRange: value }))} options={USER_AGE_RANGE_OPTIONS} />
            <Select ariaLabel="Filtrar por sexo" value={filters.gender} onValueChange={(value) => setFilters((prev) => ({ ...prev, gender: value }))} options={USER_GENDER_OPTIONS} />
            <Input value={filters.lastStreamDate} onChange={(event) => setFilters((prev) => ({ ...prev, lastStreamDate: event.target.value }))} placeholder="Último stream (DD/MM/AA)" />
            <Input value={filters.lastStreamSong} onChange={(event) => setFilters((prev) => ({ ...prev, lastStreamSong: event.target.value }))} placeholder="Música do último stream" />
          </div>

          {loading ? (
            <LoadingState title="Carregando usuários" description="Montando a base, filtros e histórico mais recente da audiência." rows={6} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Ajuste os filtros para visualizar outro recorte da base."
              actionLabel="Limpar filtros"
              onAction={() =>
                setFilters({
                  name: '',
                  cityState: '',
                  ageRange: 'all',
                  gender: 'all',
                  lastStreamDate: '',
                  lastStreamSong: ''
                })
              }
            />
          ) : (
            <>
              <div className="rounded-2xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Cidade-estado</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Último stream</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleUsers.map((user) => (
                      <TableRow key={user.id} className="cursor-pointer" onClick={() => setSelectedUserId(user.id)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <MiniAvatar initials={user.avatarInitials} />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">{user.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.cityState}</TableCell>
                        <TableCell>{user.age} anos</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="text-sm text-foreground">{user.lastStream.displayDate}</div>
                            <div className="text-xs text-muted-foreground">{user.lastStream.song}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusDot variant={user.isOnline ? 'success' : 'neutral'} size="xs" />
                            <span className="text-sm text-muted-foreground">{user.isOnline ? 'Online' : 'Offline'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedUserId(user.id);
                            }}
                          >
                            <Ban className="h-4 w-4" />
                            Banir / bloquear
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredUsers.length > visibleCount ? (
                <div className="flex justify-center pt-2">
                  <Button type="button" variant="secondary" onClick={() => setVisibleCount((count) => count + INITIAL_USERS_BATCH)}>
                    Carregar mais 50
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {selectedUser ? (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedUserId(null)}>
          <aside
            className="ml-auto flex h-full w-full max-w-[520px] flex-col overflow-y-auto border-l border-border bg-[var(--color-bg-app)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <MiniAvatar initials={selectedUser.avatarInitials} />
                <div>
                  <div className="text-lg font-semibold text-foreground">{selectedUser.fullName}</div>
                  <div className="text-sm text-muted-foreground">{selectedUser.cityState}</div>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedUserId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              <PreviewPanel
                title="Dados completos"
                description="Registro cadastral principal do usuário selecionado."
                footer={
                  <Button type="button" variant="outline" className="justify-start">
                    <ShieldAlert className="h-4 w-4" />
                    Banir / bloquear usuário
                  </Button>
                }
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/30 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contato</div>
                    <div className="mt-3 space-y-2 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {selectedUser.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {selectedUser.registeredData.cidadeEstado}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/30 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Dados cadastrados</div>
                    <div className="mt-3 space-y-2 text-sm text-foreground">
                      <div>Idade: <span className="text-muted-foreground">{selectedUser.registeredData.idade} anos</span></div>
                      <div>Sexo: <span className="text-muted-foreground">{selectedUser.registeredData.sexo}</span></div>
                      <div>Telefone: <span className="text-muted-foreground">{selectedUser.registeredData.telefone}</span></div>
                    </div>
                  </div>
                </div>
              </PreviewPanel>

              <PreviewPanel title="Logs" description="Eventos principais para auditoria e análise rápida.">
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-background/30 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Aceite dos termos
                    </div>
                    <div className="mt-2 text-sm text-foreground">{formatDateTime(selectedUser.acceptedTermsAt)}</div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/30 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Últimos streams</div>
                    <div className="mt-3 space-y-3">
                      {selectedUser.streams.map((stream) => (
                        <div key={stream.id} className="rounded-lg border border-border/80 bg-card/70 p-3">
                          <div className="font-medium text-foreground">{stream.song}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{stream.displayDate}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </PreviewPanel>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
