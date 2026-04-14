import { useCallback, useEffect, useMemo, useState } from 'react';
import { Radio, Users2 } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import KpiCard from '../../components/ui/KpiCard';
import LoadingState from '../../components/ui/LoadingState';
import StatusDot from '../../components/ui/StatusDot';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { fetchUsersFromApi, fetchUsersMock, mockUsers } from '../../mocks/adminUsers';

const RANDOM_CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Goiânia', 'Recife', 'Salvador', 'Florianópolis', 'Brasília'];

function isUserStreamingNow(user) {
  const expiresAt = user?.music?.nowPlaying?.expiresAt ? new Date(user.music.nowPlaying.expiresAt).getTime() : 0;
  if (!Number.isFinite(expiresAt) || !expiresAt) return false;
  return expiresAt > Date.now();
}

function getFallbackCity(userId) {
  const text = String(userId || '');
  const seed = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return RANDOM_CITIES[seed % RANDOM_CITIES.length];
}

export default function DashboardPage({ apiFetch }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('mock');
  const [users, setUsers] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let payload;
      if (apiFetch) {
        try {
          payload = await fetchUsersFromApi({ apiFetch, search: '', role: 'all', page: 1, pageSize: 500 });
          setSource('api');
        } catch {
          payload = await fetchUsersMock({ users: mockUsers, search: '', role: 'all', page: 1, pageSize: 500 });
          setSource('mock');
        }
      } else {
        payload = await fetchUsersMock({ users: mockUsers, search: '', role: 'all', page: 1, pageSize: 500 });
        setSource('mock');
      }

      setUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeStreamingUsers = useMemo(
    () =>
      users
        .filter((user) => isUserStreamingNow(user))
        .sort((a, b) => {
          const aStarted = a?.music?.nowPlaying?.startedAt ? new Date(a.music.nowPlaying.startedAt).getTime() : 0;
          const bStarted = b?.music?.nowPlaying?.startedAt ? new Date(b.music.nowPlaying.startedAt).getTime() : 0;
          return bStarted - aStarted;
        }),
    [users]
  );

  const kpis = useMemo(
    () => [
      { key: 'usuarios', label: 'Total de usuários', value: users.length, icon: Users2 },
      { key: 'streaming', label: 'Usuários em streaming', value: activeStreamingUsers.length, icon: Radio }
    ],
    [activeStreamingUsers.length, users.length]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão rápida dos usuários e da atividade musical acontecendo agora" />

      <section className="grid gap-4 lg:grid-cols-2">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} icon={kpi.icon} label={kpi.label} value={kpi.value} />
        ))}
      </section>

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Usuários em reprodução agora</CardTitle>
              <p className="text-sm text-muted-foreground">Lista ao vivo com quem está tocando música neste momento.</p>
            </div>
            <div className="text-xs text-muted-foreground">{source === 'api' ? 'Fonte: API' : 'Fonte: Mock'}</div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? <Alert>{error}</Alert> : null}

          {loading ? (
            <LoadingState title="Carregando atividade ao vivo" description="Buscando os usuários com reprodução ativa neste momento." rows={3} />
          ) : activeStreamingUsers.length === 0 ? (
            <EmptyState
              title="Nenhum usuário em streaming"
              description="Quando houver reprodução ativa, a lista aparecerá aqui."
              actionLabel="Atualizar"
              onAction={() => loadData()}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Artista</TableHead>
                  <TableHead>Música</TableHead>
                  <TableHead>Cidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStreamingUsers.map((user) => {
                  const nowPlaying = user?.music?.nowPlaying || {};
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || 'Usuário'}</TableCell>
                      <TableCell>{nowPlaying.artistName || 'Artista não informado'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusDot variant="success" pulse />
                          <span>{nowPlaying.trackName || 'Faixa desconhecida'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.city || getFallbackCity(user.id)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
