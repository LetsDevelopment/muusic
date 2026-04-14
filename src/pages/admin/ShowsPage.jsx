import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download, MapPin, Music4, Pencil, Plus } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import KpiCard from '../../components/ui/KpiCard';
import LoadingState from '../../components/ui/LoadingState';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { buildCityOptions, DEFAULT_SHOWS_PAGE_SIZE, fetchShowsFromApi, fetchShowsMock, getShowStatus, mockShows } from '../../mocks/adminShows';

const EMPTY_FORM = {
  artist: '',
  venue: '',
  city: '',
  country: 'Brasil',
  address: '',
  description: '',
  startsAt: '',
  latitude: '',
  longitude: '',
  thumbUrl: '',
  ticketUrl: ''
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function exportShowsCsv(items) {
  const header = ['artist', 'venue', 'city', 'country', 'startsAt', 'ticketUrl'];
  const rows = items.map((item) => [item.artist, item.venue, item.city, item.country, item.startsAt, item.ticketUrl || '']);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'shows.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function ShowsPage({ apiFetch }) {
  const [shows, setShows] = useState(mockShows);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [source, setSource] = useState('mock');
  const [kpis, setKpis] = useState({ total: 0, upcoming: 0, cities: 0 });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = useState(false);

  const shouldFail = useMemo(() => typeof window !== 'undefined' && window.location.search.includes('adminError=1'), []);
  const cityOptions = useMemo(() => buildCityOptions(shows), [shows]);
  const isEditing = Boolean(editingId);

  const loadData = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError('');
      try {
        let payload;
        if (apiFetch) {
          try {
            payload = await fetchShowsFromApi({ apiFetch, search, city: cityFilter, page: nextPage, pageSize: DEFAULT_SHOWS_PAGE_SIZE });
            setSource('api');
            setShows(payload.shows || []);
          } catch {
            payload = await fetchShowsMock({ shows: mockShows, search, city: cityFilter, page: nextPage, pageSize: DEFAULT_SHOWS_PAGE_SIZE, shouldFail });
            setSource('mock');
            setShows(mockShows);
          }
        } else {
          payload = await fetchShowsMock({ shows: mockShows, search, city: cityFilter, page: nextPage, pageSize: DEFAULT_SHOWS_PAGE_SIZE, shouldFail });
          setSource('mock');
          setShows(mockShows);
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
    [apiFetch, cityFilter, page, search, shouldFail]
  );

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  useEffect(() => {
    setPage(1);
  }, [search, cityFilter]);

  function closeEditor() {
    setEditorOpen(false);
    setEditingId('');
    setForm(EMPTY_FORM);
    setError('');
  }

  function startCreate() {
    setFeedback('');
    setError('');
    setEditingId('');
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  }

  function startEdit(show) {
    setFeedback('');
    setError('');
    setEditingId(show.id);
    setForm({
      artist: show.artist || '',
      venue: show.venue || '',
      city: show.city || '',
      country: show.country || 'Brasil',
      address: show.address || '',
      description: show.description || '',
      startsAt: toDateTimeLocalValue(show.startsAt),
      latitude: Number.isFinite(Number(show.latitude)) ? String(show.latitude) : '',
      longitude: Number.isFinite(Number(show.longitude)) ? String(show.longitude) : '',
      thumbUrl: show.thumbUrl || '',
      ticketUrl: show.ticketUrl || ''
    });
    setEditorOpen(true);
  }

  async function submitShow(event) {
    event.preventDefault();
    setFeedback('');
    setError('');

    if (!apiFetch) {
      setError('Cadastro/edicao de show disponivel apenas com API ativa.');
      return;
    }

    const payload = {
      artist: form.artist.trim(),
      venue: form.venue.trim(),
      city: form.city.trim(),
      country: (form.country || 'Brasil').trim() || 'Brasil',
      address: form.address.trim(),
      description: form.description.trim(),
      startsAt: form.startsAt,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      thumbUrl: form.thumbUrl.trim(),
      ticketUrl: form.ticketUrl.trim()
    };

    if (!payload.artist || !payload.venue || !payload.city || !payload.startsAt) {
      setError('Artista, local, cidade e data/hora sao obrigatorios.');
      return;
    }
    if (!Number.isFinite(payload.latitude) || payload.latitude < -90 || payload.latitude > 90) {
      setError('Latitude invalida.');
      return;
    }
    if (!Number.isFinite(payload.longitude) || payload.longitude < -180 || payload.longitude > 180) {
      setError('Longitude invalida.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/admin/shows/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setFeedback('Show atualizado com sucesso.');
      } else {
        await apiFetch('/admin/shows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        setFeedback('Show criado com sucesso.');
      }

      closeEditor();
      await loadData(1);
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar show.');
    } finally {
      setSaving(false);
    }
  }

  if (editorOpen) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={isEditing ? 'Editar show' : 'Novo show'}
          subtitle="Preencha os dados e salve para atualizar o mapa."
          actions={
            <Button variant="ghost" onClick={closeEditor} disabled={saving}>
              Cancelar
            </Button>
          }
        />

        {error ? <Alert>{error}</Alert> : null}

        <Card>
          <CardContent className="pt-6">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={submitShow}>
              <Input value={form.artist} onChange={(event) => setForm((prev) => ({ ...prev, artist: event.target.value }))} placeholder="Artista" required />
              <Input value={form.venue} onChange={(event) => setForm((prev) => ({ ...prev, venue: event.target.value }))} placeholder="Local" required />
              <Input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="Cidade" required />
              <Input value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} placeholder="Pais" />
              <Input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Endereco exato" />
              <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))} required />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
                  placeholder="Latitude"
                  required
                />
                <Input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={form.longitude}
                  onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
                  placeholder="Longitude"
                  required
                />
              </div>
              <Input value={form.ticketUrl} onChange={(event) => setForm((prev) => ({ ...prev, ticketUrl: event.target.value }))} placeholder="URL do ingresso (opcional)" />
              <Input value={form.thumbUrl} onChange={(event) => setForm((prev) => ({ ...prev, thumbUrl: event.target.value }))} placeholder="URL da imagem (opcional)" />
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Descricao ampla do show"
                className="md:col-span-2 min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving} className={!isEditing ? 'admin-cta-new' : ''}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" variant="secondary" onClick={closeEditor} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shows"
        subtitle="Registros de eventos cadastrados no sistema"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="admin-cta-new" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Novo show
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <KpiCard icon={Music4} label="Total de shows" value={kpis.total} />
        <KpiCard icon={CalendarClock} label="Proximos shows" value={kpis.upcoming} />
        <KpiCard icon={MapPin} label="Cidades ativas" value={kpis.cities} />
      </section>

      {feedback ? <Alert variant="success">{feedback}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl">Shows cadastrados</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="neutral">{source === 'api' ? 'API' : 'Mock'}</Badge>
              <span className="text-sm text-muted-foreground">{total} registros</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <SearchInput value={search} placeholder="Buscar artista, local ou cidade..." onChange={(event) => setSearch(event.target.value)} aria-label="Buscar shows" />
            <Select ariaLabel="Filtrar por cidade" value={cityFilter} onValueChange={setCityFilter} options={cityOptions} />
            <Button variant="secondary" className="md:ml-auto" onClick={() => exportShowsCsv(items)}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {loading ? (
            <LoadingState title="Carregando shows" description="Atualizando a listagem de eventos e os filtros disponíveis." rows={3} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum show encontrado"
              description="Nao ha registros de shows para os filtros selecionados."
              actionLabel="Limpar filtros"
              onAction={() => {
                setSearch('');
                setCityFilter('all');
              }}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artista</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ingresso</TableHead>
                    <TableHead>Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((show) => {
                    const status = getShowStatus(show.startsAt);
                    return (
                      <TableRow key={show.id}>
                        <TableCell className="font-medium">{show.artist}</TableCell>
                        <TableCell>{show.venue}</TableCell>
                        <TableCell>{show.city}</TableCell>
                        <TableCell>{formatDate(show.startsAt)}</TableCell>
                        <TableCell>
                          <Badge variant={status === 'proximo' ? 'success' : 'neutral'}>{status}</Badge>
                        </TableCell>
                        <TableCell>
                          {show.ticketUrl ? (
                            <a href={show.ticketUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                              abrir
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(show)}>
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
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
