import { MapPin, Music2, Radio, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/admin/PageHeader';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import LoadingState from '../../components/ui/LoadingState';
import { trendingsService } from '../../services/trendingsService';

function TrendList({ title, icon: Icon, items = [], totalPlays = 0, emptyText = 'Sem dados de reprodução ainda.' }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <span className="text-xs text-muted-foreground">Total: {totalPlays}</span>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        {items.length === 0 ? (
          <EmptyState title="Sem dados disponíveis" description={emptyText} />
        ) : (
          items.map((item, index) => (
            <div key={`${item.id || item.name}-${index}`} className="rounded-lg border border-border bg-background/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-sm font-semibold">{item.count}</p>
              </div>
              {item.artistName ? <p className="truncate text-xs text-muted-foreground">{item.artistName}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">{item.percent}%</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function TrendingsPage({ apiFetch }) {
  const [snapshot, setSnapshot] = useState({
    totalPlays: 0,
    artists: [],
    tracks: [],
    topFans: [],
    regions: [],
    updatedAt: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('artists');
  const [artistQuery, setArtistQuery] = useState('');
  const [trackQuery, setTrackQuery] = useState('');
  const [fanQuery, setFanQuery] = useState('');
  const [regionQuery, setRegionQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const payload = await trendingsService.getSnapshot({ apiFetch, days: 7, limit: 20 });
        if (!mounted) return;
        setSnapshot(payload);
        setError('');
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError.message || 'Falha ao carregar trendings.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    refresh();
    const intervalId = window.setInterval(refresh, 10000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [apiFetch]);

  const topArtists = useMemo(() => snapshot.artists.slice(0, 20), [snapshot.artists]);
  const topTracks = useMemo(() => snapshot.tracks.slice(0, 20), [snapshot.tracks]);
  const topFans = useMemo(() => snapshot.topFans.slice(0, 20), [snapshot.topFans]);
  const topRegions = useMemo(() => snapshot.regions.slice(0, 20), [snapshot.regions]);
  const artistSuggestions = useMemo(() => topArtists.map((item) => item.name).filter(Boolean), [topArtists]);
  const trackSuggestions = useMemo(() => topTracks.map((item) => item.name).filter(Boolean), [topTracks]);
  const fanSuggestions = useMemo(() => topFans.map((item) => item.name).filter(Boolean), [topFans]);
  const regionSuggestions = useMemo(() => topRegions.map((item) => item.name).filter(Boolean), [topRegions]);
  const filteredArtists = useMemo(() => {
    const q = artistQuery.trim().toLowerCase();
    if (!q) return topArtists;
    return topArtists.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [artistQuery, topArtists]);
  const filteredTracks = useMemo(() => {
    const q = trackQuery.trim().toLowerCase();
    if (!q) return topTracks;
    return topTracks.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [trackQuery, topTracks]);
  const filteredFans = useMemo(() => {
    const q = fanQuery.trim().toLowerCase();
    if (!q) return topFans;
    return topFans.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [fanQuery, topFans]);
  const filteredRegions = useMemo(() => {
    const q = regionQuery.trim().toLowerCase();
    if (!q) return topRegions;
    return topRegions.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [regionQuery, topRegions]);

  const tabItems = [
    { key: 'artists', label: 'Top Artistas', icon: Radio },
    { key: 'tracks', label: 'Top Músicas', icon: Music2 },
    { key: 'fans', label: 'Top Fãs', icon: Users },
    { key: 'regions', label: 'Região', icon: MapPin }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trendings"
        subtitle="Captura de reproduções para análise de tendências da plataforma"
        actions={
          <Button variant="outline" type="button">
            Análise Comparativa
          </Button>
        }
      />
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <LoadingState title="Carregando trendings" description="Consolidando as reproduções recentes para gerar os rankings." rows={3} /> : null}

      <section className="space-y-4">
        <div className="admin-trendings-tabs flex flex-wrap gap-2 rounded-lg border border-border bg-card p-2" role="tablist" aria-label="Abas de trendings">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                className={
                  selected
                    ? 'admin-trendings-tab is-active inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-white'
                    : 'admin-trendings-tab inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-white'
                }
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'artists' ? (
          <>
            <Input
              type="search"
              value={artistQuery}
              onChange={(event) => setArtistQuery(event.target.value)}
              list="trendings-artists-suggestions"
              placeholder="Pesquisar artista..."
              aria-label="Pesquisar artista"
            />
            <datalist id="trendings-artists-suggestions">
              {artistSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <TrendList title="Artistas mais reproduzidos" icon={Radio} items={filteredArtists} totalPlays={snapshot.totalPlays} />
          </>
        ) : null}
        {activeTab === 'tracks' ? (
          <>
            <Input
              type="search"
              value={trackQuery}
              onChange={(event) => setTrackQuery(event.target.value)}
              list="trendings-tracks-suggestions"
              placeholder="Pesquisar música..."
              aria-label="Pesquisar música"
            />
            <datalist id="trendings-tracks-suggestions">
              {trackSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <TrendList title="Músicas mais reproduzidas" icon={Music2} items={filteredTracks} totalPlays={snapshot.totalPlays} />
          </>
        ) : null}
        {activeTab === 'fans' ? (
          <>
            <Input
              type="search"
              value={fanQuery}
              onChange={(event) => setFanQuery(event.target.value)}
              list="trendings-fans-suggestions"
              placeholder="Pesquisar fã..."
              aria-label="Pesquisar fã"
            />
            <datalist id="trendings-fans-suggestions">
              {fanSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <TrendList
              title="Top fãs"
              icon={Users}
              items={filteredFans}
              totalPlays={snapshot.totalPlays}
              emptyText="Sem ouvintes ativos suficientes para gerar ranking."
            />
          </>
        ) : null}
        {activeTab === 'regions' ? (
          <>
            <Input
              type="search"
              value={regionQuery}
              onChange={(event) => setRegionQuery(event.target.value)}
              list="trendings-regions-suggestions"
              placeholder="Pesquisar cidade..."
              aria-label="Pesquisar cidade"
            />
            <datalist id="trendings-regions-suggestions">
              {regionSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <TrendList title="Top cidades por reprodução" icon={MapPin} items={filteredRegions} totalPlays={snapshot.totalPlays} />
          </>
        ) : null}
      </section>
    </div>
  );
}
