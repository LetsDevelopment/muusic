import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import KpiCard from '../../components/ui/KpiCard';
import LoadingState from '../../components/ui/LoadingState';
import StatusDot from '../../components/ui/StatusDot';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import TableEmptyRow from '../../components/ui/TableEmptyRow';
import Tooltip from '../../components/ui/Tooltip';

function formatUptime(sec) {
  const total = Number(sec || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}

function statusColorClass(level) {
  if (level === 'critical') return 'danger';
  if (level === 'attention') return 'warning';
  return 'success';
}

function metricLevel(value, { attention, critical }) {
  const numeric = Number(value || 0);
  if (numeric >= critical) return 'critical';
  if (numeric >= attention) return 'attention';
  return 'healthy';
}

function MetricRow({ label, description, value, level = 'healthy' }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <StatusDot variant={statusColorClass(level)} className="h-[6px] w-[6px]" />
      <Tooltip content={description}>
        <span className="cursor-help text-muted-foreground">{label}:</span>
      </Tooltip>
      <span className="font-medium text-white">{value}</span>
    </p>
  );
}

export default function PerformancePage({ apiFetch }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        if (!apiFetch) throw new Error('API administrativa indisponível.');
        const payload = await apiFetch('/admin/performance');
        if (!mounted) return;
        setSnapshot(payload);
        setError('');
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError.message || 'Falha ao carregar métricas de performance.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const intervalId = window.setInterval(load, 10000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [apiFetch]);

  const topRoutes = useMemo(() => snapshot?.http?.topRoutes || [], [snapshot?.http?.topRoutes]);
  const topSocketEvents = useMemo(() => snapshot?.socket?.events || [], [snapshot?.socket?.events]);

  return (
    <div className="space-y-6">
      <PageHeader title="Performance" subtitle="Métricas técnicas reais do servidor e da API da aplicação." />

      {error ? <Alert>{error}</Alert> : null}

      {loading && !snapshot ? <LoadingState title="Carregando métricas" description="Coletando indicadores do servidor, cache, HTTP e socket." rows={4} /> : null}

      {snapshot ? (
        <>
          <section className="grid gap-4 lg:grid-cols-6">
            <KpiCard align="left" label="RPS (1 min)" value={snapshot.http?.rpsLast1m ?? 0} />
            <KpiCard align="left" label="Latência p95 (ms)" value={snapshot.http?.p95Ms ?? 0} />
            <KpiCard align="left" label="Socket p95 (ms)" value={snapshot.socket?.p95Ms ?? 0} />
            <KpiCard align="left" label="Eventos socket/s" value={snapshot.socket?.eventsPerSecLast1m ?? 0} />
            <KpiCard align="left" label="FPS cliente p95" value={snapshot.clientFps?.p95 ?? 0} />
            <KpiCard align="left" label="Cache hit rate (%)" value={snapshot.cache?.hitRatePct ?? 0} />
            <KpiCard align="left" label="Uptime" value={formatUptime(snapshot.process?.uptimeSec)} />
            <KpiCard align="left" label="Heap usado (MB)" value={snapshot.process?.heapUsedMb ?? 0} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Processo / Sistema</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <MetricRow label="PID" description="Identificador único do processo em execução." value={snapshot.process?.pid} />
                <MetricRow label="Node" description="Versão do Node.js usada pela aplicação." value={snapshot.process?.nodeVersion} />
                <MetricRow
                  label="RSS"
                  description="Memória total residente ocupada pelo processo."
                  value={`${snapshot.process?.rssMb} MB`}
                  level={metricLevel(snapshot.process?.rssMb, { attention: 700, critical: 1200 })}
                />
                <MetricRow
                  label="Heap total"
                  description="Tamanho total do heap alocado pelo V8."
                  value={`${snapshot.process?.heapTotalMb} MB`}
                  level={metricLevel(snapshot.process?.heapTotalMb, { attention: 350, critical: 700 })}
                />
                <MetricRow
                  label="Load avg (1m/5m/15m)"
                  description="Carga média do sistema nas janelas de 1, 5 e 15 minutos."
                  value={`${snapshot.system?.loadAvg1m} / ${snapshot.system?.loadAvg5m} / ${snapshot.system?.loadAvg15m}`}
                  level={metricLevel(Number(snapshot.system?.loadAvg1m) / Math.max(Number(snapshot.system?.cpuCount || 1), 1), {
                    attention: 0.8,
                    critical: 1
                  })}
                />
                <MetricRow label="CPU cores" description="Quantidade de núcleos de CPU disponíveis no host." value={snapshot.system?.cpuCount} />
                <MetricRow
                  label="Memória livre"
                  description="Memória disponível versus memória total do servidor."
                  value={`${snapshot.system?.freeMemGb} GB / ${snapshot.system?.totalMemGb} GB`}
                  level={metricLevel(
                    1 - Number(snapshot.system?.freeMemGb || 0) / Math.max(Number(snapshot.system?.totalMemGb || 1), 1),
                    { attention: 0.8, critical: 0.9 }
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Loop / HTTP</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
                <MetricRow
                  label="Event loop médio"
                  description="Tempo médio de atraso no event loop."
                  value={`${snapshot.eventLoop?.meanMs} ms`}
                  level={metricLevel(snapshot.eventLoop?.meanMs, { attention: 40, critical: 80 })}
                />
                <MetricRow
                  label="Event loop p95"
                  description="Atraso no percentil 95 do event loop."
                  value={`${snapshot.eventLoop?.p95Ms} ms`}
                  level={metricLevel(snapshot.eventLoop?.p95Ms, { attention: 80, critical: 150 })}
                />
                <MetricRow
                  label="Event loop max"
                  description="Maior atraso observado no event loop."
                  value={`${snapshot.eventLoop?.maxMs} ms`}
                  level={metricLevel(snapshot.eventLoop?.maxMs, { attention: 200, critical: 400 })}
                />
                <MetricRow
                  label="Latência média HTTP"
                  description="Tempo médio de resposta das requisições HTTP."
                  value={`${snapshot.http?.avgMs} ms`}
                  level={metricLevel(snapshot.http?.avgMs, { attention: 350, critical: 700 })}
                />
                <MetricRow label="Amostra HTTP" description="Quantidade de requisições consideradas na janela recente." value={`${snapshot.http?.sampleSize} req`} />
                <MetricRow label="Status 2xx" description="Respostas HTTP bem-sucedidas." value={snapshot.http?.byStatus?.s2xx ?? 0} />
                <MetricRow
                  label="Status 4xx"
                  description="Respostas de erro por requisição inválida ou não autorizada."
                  value={snapshot.http?.byStatus?.s4xx ?? 0}
                  level={metricLevel(snapshot.http?.byStatus?.s4xx, { attention: 1, critical: 10 })}
                />
                <MetricRow
                  label="Status 5xx"
                  description="Respostas de erro interno do servidor."
                  value={snapshot.http?.byStatus?.s5xx ?? 0}
                  level={metricLevel(snapshot.http?.byStatus?.s5xx, { attention: 1, critical: 3 })}
                />
                <MetricRow
                  label="Socket p95"
                  description="Latência p95 dos handlers de eventos de socket."
                  value={`${snapshot.socket?.p95Ms ?? 0} ms`}
                  level={metricLevel(snapshot.socket?.p95Ms, { attention: 120, critical: 300 })}
                />
                <MetricRow
                  label="Socket erros"
                  description="Total de eventos de socket com falha na janela recente."
                  value={snapshot.socket?.errorCount ?? 0}
                  level={metricLevel(snapshot.socket?.errorCount, { attention: 1, critical: 5 })}
                />
                <MetricRow
                  label="FPS cliente p95"
                  description="Percentil 95 dos reports de FPS enviados pelo frontend."
                  value={snapshot.clientFps?.p95 ?? 0}
                  level={metricLevel(Math.max(0, 60 - Number(snapshot.clientFps?.p95 || 0)), { attention: 20, critical: 30 })}
                />
                <MetricRow
                  label="FPS cliente último"
                  description="Último FPS reportado pelo frontend."
                  value={snapshot.clientFps?.latest ?? 0}
                  level={metricLevel(Math.max(0, 60 - Number(snapshot.clientFps?.latest || 0)), { attention: 20, critical: 30 })}
                />
                <MetricRow
                  label="Cache hit rate"
                  description="Taxa total de acerto de cache (redis + local) na janela recente."
                  value={`${snapshot.cache?.hitRatePct ?? 0}%`}
                  level={metricLevel(Math.max(0, 100 - Number(snapshot.cache?.hitRatePct || 0)), { attention: 40, critical: 60 })}
                />
                <MetricRow
                  label="Cache lookups/s"
                  description="Total de consultas de cache por segundo no ultimo minuto."
                  value={snapshot.cache?.lookupsPerSecLast1m ?? 0}
                />
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Top rotas (janela recente)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rota</TableHead>
                    <TableHead>Requisições</TableHead>
                    <TableHead>Média (ms)</TableHead>
                    <TableHead>P95 (ms)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topRoutes.map((route) => (
                    <TableRow key={route.route}>
                      <TableCell className="font-medium">{route.route}</TableCell>
                      <TableCell>{route.count}</TableCell>
                      <TableCell>{route.avgMs}</TableCell>
                      <TableCell>{route.p95Ms}</TableCell>
                    </TableRow>
                  ))}
                  {!topRoutes.length ? <TableEmptyRow colSpan={4} title="Sem tráfego suficiente" description="Ainda não há volume suficiente para exibir rotas nesta janela." /> : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top eventos socket (janela recente)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Ocorrências</TableHead>
                    <TableHead>Média (ms)</TableHead>
                    <TableHead>P95 (ms)</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSocketEvents.map((event) => (
                    <TableRow key={event.event}>
                      <TableCell className="font-medium">{event.event}</TableCell>
                      <TableCell>{event.count}</TableCell>
                      <TableCell>{event.avgMs}</TableCell>
                      <TableCell>{event.p95Ms}</TableCell>
                      <TableCell>{event.errors}</TableCell>
                    </TableRow>
                  ))}
                  {!topSocketEvents.length ? (
                    <TableEmptyRow colSpan={5} title="Sem eventos suficientes" description="Ainda não há eventos de socket suficientes para esta janela." />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cache por escopo/camada</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Camada</TableHead>
                    <TableHead>Lookups</TableHead>
                    <TableHead>Hits</TableHead>
                    <TableHead>Misses</TableHead>
                    <TableHead>Hit rate (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(snapshot.cache?.stats || []).map((row) => (
                    <TableRow key={`${row.scope}-${row.layer}`}>
                      <TableCell className="font-medium">{row.scope}</TableCell>
                      <TableCell>{row.layer}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.hits}</TableCell>
                      <TableCell>{row.misses}</TableCell>
                      <TableCell>{row.hitRatePct}</TableCell>
                    </TableRow>
                  ))}
                  {!snapshot.cache?.stats?.length ? (
                    <TableEmptyRow colSpan={6} title="Sem dados de cache" description="Ainda não há dados suficientes de cache para esta janela." />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
