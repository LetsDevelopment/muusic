import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SidebarNavLite from './components/SidebarNavLite';
import ChatListLite from './components/ChatListLite';
import NotificationsListLite from './components/NotificationsListLite';
import LiveNotificationToastLite from './components/LiveNotificationToastLite';
import GlobalSearchLite from './components/GlobalSearchLite';
import RealFeedLite from './components/RealFeedLite';
import EventFeedLite from './components/EventFeedLite';
import MyAccountPage from './pages/MyAccountPage';
import AuthPage from './components/AuthPage';
import { MAPBOX_TOKEN } from './config/appConfig';
import { buildSimulatedPoints, DESKTOP_PERF, MOBILE_PERF } from './lib/mapSimulation';
import { readMapVisibility, saveMapVisibility, STORAGE_SESSION_KEY } from './lib/storage';
import { useAuthFlow } from './hooks/useAuthFlow';
import { useRealtimePresence } from './hooks/useRealtimePresence';
import { useMapEngine } from './hooks/useMapEngine';
import { accountService, DEFAULT_ACCOUNT_SETTINGS } from './services/accountService';
import { API_URL, MAP_USERS_POLL_INTERVAL_MS, MAP_USERS_REQUEST_LIMIT, MAP_USERS_SCAN_PAGES } from './config/appConfig';
import { trendingsService } from './services/trendingsService';

const ACCOUNT_PATH = '/minha-conta';
const MUSIC_MATCH_WINDOW_MS = 2 * 60 * 1000;
const MUSIC_MATCH_TOAST_COOLDOWN_MS = 45 * 1000;

function getAdaptivePollingDelay(nowPlaying) {
  if (!nowPlaying) return 30000;
  if (!nowPlaying.isPlaying) return 25000;

  const progress = Number(nowPlaying.progressMs || 0);
  const duration = Number(nowPlaying.durationMs || 0);
  const remaining = duration > progress ? duration - progress : 0;

  if (remaining > 0 && remaining <= 15000) {
    return Math.max(3000, remaining + 1000);
  }
  return 7000;
}

function normalizeArtistKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRealtimeNowPlayingPayload(nowPlaying) {
  if (!nowPlaying || typeof nowPlaying !== 'object') return null;
  return {
    artistId: nowPlaying.artistId || null,
    artistName: nowPlaying.artistName || '',
    artists: nowPlaying.artists || nowPlaying.artistName || '',
    trackId: nowPlaying.trackId || null,
    trackName: nowPlaying.trackName || '',
    progressMs: Number(nowPlaying.progressMs || 0) || 0,
    durationMs: Number(nowPlaying.durationMs || 0) || 0,
    isPlaying: Boolean(nowPlaying.isPlaying),
    albumImage: nowPlaying.albumImage || null,
    artistImage: nowPlaying.artistImage || null,
    externalUrl: nowPlaying.externalUrl || null,
    updatedAt: Date.now()
  };
}

function slugifyArtist(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artista';
}

function buildArtistSections(name) {
  const safeName = name || 'Artista';
  const baseKey = slugifyArtist(safeName);
  return {
    albums: [
      { id: `${baseKey}-album-1`, title: 'Herança Boiadeira Rodeio (Ao Vivo)', subtitle: 'Último lançamento', meta: '2025', image: 'https://picsum.photos/seed/artist-album-1/520/520' },
      { id: `${baseKey}-album-2`, title: 'Lets Go Rodeo', subtitle: 'Álbum', meta: '2025', image: 'https://picsum.photos/seed/artist-album-2/520/520' },
      { id: `${baseKey}-album-3`, title: 'Boiadeira Internacional', subtitle: 'Ao vivo', meta: '2024', image: 'https://picsum.photos/seed/artist-album-3/520/520' },
      { id: `${baseKey}-album-4`, title: 'Estrada e Coração', subtitle: 'Sessão especial', meta: '2023', image: 'https://picsum.photos/seed/artist-album-4/520/520' }
    ],
    tracks: [
      { id: `${baseKey}-track-1`, title: 'Solteiro Forçado', subtitle: safeName, meta: '3:01', image: 'https://picsum.photos/seed/artist-track-1/520/520' },
      { id: `${baseKey}-track-2`, title: 'Minha Herança', subtitle: safeName, meta: '2:54', image: 'https://picsum.photos/seed/artist-track-2/520/520' },
      { id: `${baseKey}-track-3`, title: 'Tô Voltando', subtitle: safeName, meta: '3:18', image: 'https://picsum.photos/seed/artist-track-3/520/520' },
      { id: `${baseKey}-track-4`, title: 'Rodeio em Mim', subtitle: safeName, meta: '2:47', image: 'https://picsum.photos/seed/artist-track-4/520/520' }
    ],
    singles: [
      { id: `${baseKey}-single-1`, title: 'Coração Sertanejo', subtitle: 'Single', meta: '2025', image: 'https://picsum.photos/seed/artist-single-1/520/520' },
      { id: `${baseKey}-single-2`, title: 'Mapa do Amor', subtitle: 'Single', meta: '2024', image: 'https://picsum.photos/seed/artist-single-2/520/520' },
      { id: `${baseKey}-single-3`, title: 'Noite no Interior', subtitle: 'Single', meta: '2024', image: 'https://picsum.photos/seed/artist-single-3/520/520' },
      { id: `${baseKey}-single-4`, title: 'Cavalo de Fogo', subtitle: 'Single', meta: '2023', image: 'https://picsum.photos/seed/artist-single-4/520/520' }
    ],
    shows: [
      { id: `${baseKey}-show-1`, title: 'Arena Goiânia', subtitle: 'Goiânia, Brasil', meta: '28 mar', image: 'https://picsum.photos/seed/artist-show-1/520/520' },
      { id: `${baseKey}-show-2`, title: 'Villa Country', subtitle: 'São Paulo, Brasil', meta: '04 abr', image: 'https://picsum.photos/seed/artist-show-2/520/520' },
      { id: `${baseKey}-show-3`, title: 'Espaço Hall', subtitle: 'Rio de Janeiro, Brasil', meta: '11 abr', image: 'https://picsum.photos/seed/artist-show-3/520/520' },
      { id: `${baseKey}-show-4`, title: 'Mineirão Sessions', subtitle: 'Belo Horizonte, Brasil', meta: '18 abr', image: 'https://picsum.photos/seed/artist-show-4/520/520' }
    ]
  };
}

function buildArtistDetail(payload = {}) {
  const name = payload.name || payload.artistName || payload.artist || 'Artista';
  return {
    id: payload.id || payload.artistId || `artist:${slugifyArtist(name)}`,
    name,
    heroImage: payload.heroImage || payload.artistImage || payload.albumImage || payload.thumbUrl || null,
    listenersLabel: payload.listenersLabel || '68.598 ouvintes no mapa',
    initialTab: payload.initialTab || 'albums',
    sections: payload.sections || buildArtistSections(name)
  };
}

export default function App() {
  const {
    authMode,
    setAuthMode,
    authForm,
    authError,
    authBooting,
    authUser,
    updateAuthField,
    submitAuth,
    submitForgotPassword,
    submitResetPassword,
    forgotMode,
    resetMode,
    forgotMessage,
    openForgotMode,
    closeForgotMode,
    logout,
    connectSpotify,
    applySpotifyToken,
    exchangeSpotifyCode,
    refreshSpotifyNowPlaying,
    spotifyError,
    spotifyConnecting
  } = useAuthFlow();

  const activeUser = authUser;
  const activeUserId = activeUser?.id || '';
  const activeUserToken = activeUser?.token || '';
  const activeUserSessionId = activeUser?.sessionId || '';
  const activeAuthPayload = useMemo(
    () => (activeUserToken ? { id: activeUserId, token: activeUserToken, sessionId: activeUserSessionId } : null),
    [activeUserId, activeUserToken, activeUserSessionId]
  );

  const { setUsername, users, socketRef, joined } = useRealtimePresence(activeUser);

  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatOpenRequest, setChatOpenRequest] = useState({ name: '', id: 0 });
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [selectedEventFeed, setSelectedEventFeed] = useState(null);
  const [selectedShowDetail, setSelectedShowDetail] = useState(null);
  const [selectedArtistDetail, setSelectedArtistDetail] = useState(null);
  const [selectedSimProfile, setSelectedSimProfile] = useState(null);
  const [accountSettings, setAccountSettings] = useState(DEFAULT_ACCOUNT_SETTINGS);
  const [dbMapUsers, setDbMapUsers] = useState([]);
  const [mapViewport, setMapViewport] = useState(null);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/');
  const [shows, setShows] = useState([]);
  const [mapVisibility, setMapVisibility] = useState(() => readMapVisibility());
  const [isMobileDevice] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [priorityLiveNotification, setPriorityLiveNotification] = useState(null);
  const lastTrendingCaptureRef = useRef({ trackId: '', isPlaying: false });
  const mapUsersRequestRef = useRef(0);
  const lastMatchToastRef = useRef({ signature: '', at: 0 });

  const mapUsers = useMemo(() => {
    const byId = new Map();
    (Array.isArray(dbMapUsers) ? dbMapUsers : []).forEach((user) => {
      byId.set(user.id, {
        id: user.id,
        name: user.name,
        bio: user.bio || '',
        city: user.city || '',
        showMusicHistory: user.showMusicHistory !== false,
        avatarUrl: user.avatarUrl || null,
        location: user.location || null
      });
    });

    (Array.isArray(users) ? users : []).forEach((user) => {
      const existing = byId.get(user.id) || {};
      const isCurrentUser = Boolean(activeUser?.id && user.id === activeUser.id);
      const shouldHideLocation = isCurrentUser && accountSettings.locationEnabled === false;
      byId.set(user.id, {
        ...existing,
        id: user.id,
        name: user.name || existing.name,
        spotify: user.spotify || existing.spotify,
        location: shouldHideLocation ? null : existing.location || user.location || null
      });
    });

    return Array.from(byId.values());
  }, [dbMapUsers, users, activeUser?.id, accountSettings.locationEnabled]);

  const perfProfile = isMobileDevice ? MOBILE_PERF : DESKTOP_PERF;
  const simulatedPoints = useMemo(() => buildSimulatedPoints(perfProfile.points), [perfProfile.points]);
  const handleMapShowSelect = useCallback((show) => {
    setSelectedArtistDetail(null);
    setSelectedSimProfile(null);
    setSelectedShowDetail(show);
    setRightPanelCollapsed(false);
  }, []);

  const resolveUserProfile = useCallback(
    (user) => {
      if (!user) return null;
      const isCurrentUser = Boolean(activeUser?.id && user?.id === activeUser.id);
      const city = isCurrentUser ? accountSettings.city : user?.city || user?.location?.city || 'Cidade indisponivel';
      const avatar = isCurrentUser ? accountSettings.avatarDataUrl || user?.avatarUrl || user?.spotify?.image : user?.avatarUrl || user?.spotify?.image;
      const bio = isCurrentUser ? accountSettings.bio : user?.bio || '';
      const recentTracks = isCurrentUser
        ? accountSettings.showMusicHistory
          ? [user?.spotify?.track || user?.spotify?.trackName || user?.nowPlaying?.trackName || 'Sem historico de musica recente']
          : []
        : user?.showMusicHistory === false
          ? []
          : [user?.spotify?.track || user?.spotify?.trackName || user?.nowPlaying?.trackName || 'Sem historico de musica recente'];
      return {
        id: user?.id || `user-${Date.now()}`,
        name: user?.spotify?.display_name || user?.name || 'Usuario',
        avatar: avatar || `https://i.pravatar.cc/120?u=${encodeURIComponent(user?.id || 'user')}`,
        city,
        bio,
        showMusicHistory: isCurrentUser ? accountSettings.showMusicHistory : user?.showMusicHistory !== false,
        recentTracks,
        coords:
          Number.isFinite(Number(user?.location?.lng)) && Number.isFinite(Number(user?.location?.lat))
            ? [Number(user.location.lng), Number(user.location.lat)]
            : null
      };
    },
    [activeUser?.id, accountSettings]
  );

  const handleMapUserSelect = useCallback(
    (user) => {
      const profile = resolveUserProfile(user);
      if (!profile) return;
      setSelectedArtistDetail(null);
      setSelectedShowDetail(null);
      setSelectedSimProfile(profile);
      setRightPanelCollapsed(false);
    },
    [resolveUserProfile]
  );

  const openUserProfileDetail = useCallback((profile) => {
    if (!profile) return;
    setSelectedArtistDetail(null);
    setSelectedShowDetail(null);
    setSelectedSimProfile({
      ...(profile || {}),
      bio: profile?.bio || '',
      city: profile?.city || 'Cidade indisponivel',
      showMusicHistory: profile?.showMusicHistory !== false,
      recentTracks: profile?.recentTracks || []
    });
    setRightPanelCollapsed(false);
  }, []);


  const openArtistDetail = useCallback(
    (artistPayload) => {
      if (!artistPayload || isMobileDevice) return;
      setSelectedShowDetail(null);
      setSelectedSimProfile(null);
      setSelectedArtistDetail(buildArtistDetail(artistPayload));
      setRightPanelCollapsed(false);
    },
    [isMobileDevice]
  );
  const handleViewportChange = useCallback((nextViewport) => {
    if (!nextViewport) return;
    setMapViewport((prev) => {
      if (!prev) return nextViewport;
      const delta =
        Math.abs(prev.west - nextViewport.west) +
        Math.abs(prev.south - nextViewport.south) +
        Math.abs(prev.east - nextViewport.east) +
        Math.abs(prev.north - nextViewport.north);
      if (delta < 0.08) return prev;
      return nextViewport;
    });
  }, []);

  const {
    mapContainerRef,
    mapWarning,
    fps,
    benchmarkRunning,
    benchmarkResult,
    runBenchmark,
    focusFeedItem
  } = useMapEngine({
    enabled: Boolean(activeUser),
    isMobileDevice,
    perfProfile,
    simulatedPoints,
    shows,
    onShowSelect: handleMapShowSelect,
    onUserSelect: handleMapUserSelect,
    users: mapUsers,
    socketRef,
    mapVisibility,
    onViewportChange: handleViewportChange
  });

  useEffect(() => {
    setNotificationsPanelOpen(false);
  }, []);

  useEffect(() => {
    if (activeUser?.name) {
      setUsername(activeUser.name);
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(activeUser));
    }
  }, [activeUser, setUsername]);

  useEffect(() => {
    saveMapVisibility(mapVisibility);
  }, [mapVisibility]);

  useEffect(() => {
    if (!selectedSimProfile?.id) return;
    if (!activeUser?.id || selectedSimProfile.id !== activeUser.id) return;
    setSelectedSimProfile((prev) =>
      prev
        ? {
            ...prev,
            city: accountSettings.city,
            bio: accountSettings.bio,
            avatar: accountSettings.avatarDataUrl || prev.avatar,
            showMusicHistory: accountSettings.showMusicHistory,
            recentTracks: accountSettings.showMusicHistory ? prev.recentTracks || [] : []
          }
        : prev
    );
  }, [accountSettings, activeUser?.id, selectedSimProfile?.id]);

  useEffect(() => {
    let active = true;
    accountService
      .get(activeAuthPayload)
      .then((settings) => {
        if (active) setAccountSettings(settings);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeAuthPayload]);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!activeUser) return undefined;
    let cancelled = false;
    let intervalId = null;
    const requestId = ++mapUsersRequestRef.current;

    const fetchMapUsers = async () => {
      try {
        const viewport = mapViewport;
        const bbox = viewport
          ? `${viewport.west},${viewport.south},${viewport.east},${viewport.north}`
          : '';
        const merged = new Map();
        let cursor = '';
        let hasMore = true;
        let loops = 0;
        while (hasMore && loops < 8 && merged.size < 800) {
          loops += 1;
          const params = new URLSearchParams({
            limit: String(Math.min(220, Math.max(40, Number(MAP_USERS_REQUEST_LIMIT) || 120))),
            scanPages: String(Math.min(8, Math.max(1, Number(MAP_USERS_SCAN_PAGES) || 3)))
          });
          if (cursor) params.set('cursor', cursor);
          if (bbox) params.set('bbox', bbox);

          const response = await fetch(`${API_URL}/api/map-users?${params.toString()}`, { cache: 'no-store' });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) break;
          const list = Array.isArray(payload?.users) ? payload.users : [];
          list.forEach((user) => {
            if (user?.id) merged.set(user.id, user);
          });
          const nextCursor = payload?.pagination?.nextCursor;
          hasMore = Boolean(payload?.pagination?.hasMore && nextCursor);
          cursor = String(nextCursor || '');
          if (!cursor) hasMore = false;
        }

        if (cancelled || requestId !== mapUsersRequestRef.current) return;
        setDbMapUsers(Array.from(merged.values()));
      } catch {
        if (!cancelled && requestId === mapUsersRequestRef.current) setDbMapUsers([]);
      }
    };

    fetchMapUsers();
    intervalId = window.setInterval(fetchMapUsers, Math.max(15000, Number(MAP_USERS_POLL_INTERVAL_MS) || 60000));
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [activeUser, mapViewport]);

  useEffect(() => {
    if (!activeUser) return;
    const url = new window.URL(window.location.href);
    const spotifyCode = url.searchParams.get('spotify_code');
    const spotifyToken = url.searchParams.get('spotify_token');
    if (!spotifyCode && !spotifyToken) return;

    const consume = spotifyCode ? exchangeSpotifyCode(spotifyCode) : applySpotifyToken(spotifyToken);
    consume.finally(() => {
      url.searchParams.delete('spotify_code');
      url.searchParams.delete('spotify_token');
      url.searchParams.delete('spotify_connected');
      url.searchParams.delete('room');
      url.searchParams.delete('user');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    });
  }, [activeUser, applySpotifyToken, exchangeSpotifyCode]);

  useEffect(() => {
    if (!activeUser?.spotifyToken) return undefined;
    let cancelled = false;
    let timerId = null;

    const schedule = (delay) => {
      timerId = window.setTimeout(async () => {
        const nowPlaying = await refreshSpotifyNowPlaying();
        if (cancelled) return;
        if (joined && socketRef.current) {
          socketRef.current.emit('playback:update', {
            nowPlaying: buildRealtimeNowPlayingPayload(nowPlaying)
          });
        }
        schedule(getAdaptivePollingDelay(nowPlaying));
      }, delay);
    };

    refreshSpotifyNowPlaying()
      .then((nowPlaying) => {
        if (!cancelled) {
          if (joined && socketRef.current) {
            socketRef.current.emit('playback:update', {
              nowPlaying: buildRealtimeNowPlayingPayload(nowPlaying)
            });
          }
          schedule(getAdaptivePollingDelay(nowPlaying));
        }
      })
      .catch(() => {
        if (!cancelled) {
          schedule(30000);
        }
      });

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [activeUser?.spotifyToken, refreshSpotifyNowPlaying, joined, socketRef]);

  useEffect(() => {
    if (!joined || !socketRef.current) return;
    socketRef.current.emit('playback:update', {
      nowPlaying: buildRealtimeNowPlayingPayload(activeUser?.nowPlaying || null)
    });
  }, [activeUser?.nowPlaying, joined, socketRef]);

  useEffect(() => {
    if (!activeUser || !fps || !Number.isFinite(fps)) return undefined;
    const timerId = window.setTimeout(() => {
      const payload = JSON.stringify({ fps: Number(fps) });
      const url = `${API_URL}/api/telemetry/fps`;
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }, 15000);

    return () => window.clearTimeout(timerId);
  }, [activeUser, fps]);

  function handleLogout() {
    logout().catch(() => {});
  }

  function openFeedItem(item) {
    setSelectedEventFeed(item);
  }

  function navigateTo(path) {
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  }

  const handleSearchShowSelect = useCallback((show) => {
    if (!show) return;
    setSelectedArtistDetail(null);
    setSelectedSimProfile(null);
    setSelectedShowDetail(show);
    setRightPanelCollapsed(false);
  }, []);

  const handleSearchUserSelect = useCallback(
    (user) => {
      handleMapUserSelect(user);
    },
    [handleMapUserSelect]
  );

  const handleLocateCurrentUser = useCallback(() => {
    const current = mapUsers.find((user) => user?.id === activeUser?.id);
    const lat = Number(current?.location?.lat);
    const lng = Number(current?.location?.lng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      focusFeedItem({
        coords: [lng, lat],
        city: current?.city || accountSettings.city || '',
        country: 'Brasil'
      });
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const fallbackLat = Number(position?.coords?.latitude);
          const fallbackLng = Number(position?.coords?.longitude);
          if (!Number.isFinite(fallbackLat) || !Number.isFinite(fallbackLng)) return;

          socketRef.current?.emit('location:update', {
            lat: fallbackLat,
            lng: fallbackLng
          });

          focusFeedItem({
            coords: [fallbackLng, fallbackLat],
            city: accountSettings.city || '',
            country: 'Brasil'
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
      );
    }
  }, [mapUsers, activeUser?.id, focusFeedItem, accountSettings.city, socketRef]);

  const spotifyIsPlaying = Boolean(activeUser?.nowPlaying?.isPlaying);
  const spotifyTrackName = activeUser?.nowPlaying?.trackName || '';
  const spotifyArtistName = activeUser?.nowPlaying?.artistName || activeUser?.nowPlaying?.artists || 'Artista indisponivel';
  const hasActiveTrack = Boolean(spotifyTrackName);
  const useMarqueeTitle = spotifyTrackName.length > 34;

  useEffect(() => {
    const nowPlaying = activeUser?.nowPlaying || null;
    if (!nowPlaying) return;
    const trackId = String(nowPlaying.trackId || nowPlaying.trackName || '');
    const isPlaying = Boolean(nowPlaying.isPlaying);
    const previous = lastTrendingCaptureRef.current;

    const shouldCapture = isPlaying && (!!trackId && (previous.trackId !== trackId || previous.isPlaying === false));

    if (shouldCapture) {
      trendingsService
        .recordPlayback({
          authUser: activeAuthPayload,
          playback: {
            artistId: nowPlaying.artistId || null,
            artistName: nowPlaying.artistName || nowPlaying.artists || 'Artista desconhecido',
            trackId: nowPlaying.trackId || null,
            trackName: nowPlaying.trackName || 'Musica desconhecida',
            timestamp: new Date().toISOString(),
            isPlaying: true
          }
        })
        .catch(() => {});
    }

    lastTrendingCaptureRef.current = {
      trackId,
      isPlaying
    };
  }, [activeAuthPayload, activeUser?.nowPlaying]);

  const currentArtistMatch = useMemo(() => {
    const localNowPlaying = activeUser?.nowPlaying;
    if (!localNowPlaying?.isPlaying) return null;

    const localArtistName = localNowPlaying.artistName || localNowPlaying.artists || '';
    const localArtistKey = normalizeArtistKey(localArtistName);
    if (!localArtistKey) return null;

    const now = Date.now();
    const matches = (Array.isArray(users) ? users : [])
      .filter((user) => user?.id && user.id !== activeUser?.id)
      .map((user) => {
        const remoteNowPlaying = user?.nowPlaying || null;
        const remoteArtistName = remoteNowPlaying?.artistName || remoteNowPlaying?.artists || '';
        const remoteArtistKey = normalizeArtistKey(remoteArtistName);
        const updatedAt = Number(remoteNowPlaying?.updatedAt || 0);
        const isFresh = Number.isFinite(updatedAt) && now - updatedAt <= MUSIC_MATCH_WINDOW_MS;
        if (!remoteArtistKey || remoteArtistKey !== localArtistKey) return null;
        if (!remoteNowPlaying?.isPlaying || !isFresh) return null;
        return {
          id: user.id,
          name: user?.spotify?.display_name || user?.name || 'Usuario',
          avatar: user?.spotify?.image || null,
          profile: {
            id: user.id,
            name: user?.spotify?.display_name || user?.name || 'Usuario',
            avatar: user?.spotify?.image || `https://i.pravatar.cc/120?u=${encodeURIComponent(user.id)}`,
            city: user?.location?.city || 'Cidade indisponivel',
            bio: '',
            showMusicHistory: true,
            recentTracks: [remoteNowPlaying?.trackName || 'Musica indisponivel']
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    if (!matches.length) return null;
    return {
      artistName: localArtistName,
      artistKey: localArtistKey,
      users: matches
    };
  }, [activeUser?.id, activeUser?.nowPlaying, users]);

  useEffect(() => {
    if (!currentArtistMatch?.users?.length) return;
    const signature = `${currentArtistMatch.artistKey}:${currentArtistMatch.users.map((user) => user.id).join(',')}`;
    const now = Date.now();
    const previous = lastMatchToastRef.current;
    if (previous.signature === signature && now - previous.at < MUSIC_MATCH_TOAST_COOLDOWN_MS) {
      return;
    }

    lastMatchToastRef.current = { signature, at: now };
    const [firstUser, ...restUsers] = currentArtistMatch.users;
    setPriorityLiveNotification({
      id: `music-match-${now}`,
      kind: 'music-match',
      type: 'music-match',
      variant: 'match',
      artistName: currentArtistMatch.artistName,
      matchUsers: currentArtistMatch.users,
      username: firstUser?.name || 'Usuario',
      profile: firstUser
        ? {
            ...firstUser.profile,
            recentTracks: firstUser.profile?.recentTracks || []
          }
        : null,
      extraMatchesCount: restUsers.length
    });
  }, [currentArtistMatch]);

  if (authBooting) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-pulse" />
      </div>
    );
  }

  if (!activeUser) {
    return (
      <AuthPage
        simpleAccess
        onQuickEnter={() => {
          setAuthMode('login');
          if (window.location.hash !== '#login') {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#login`);
          }
        }}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        authError={authError}
        forgotMode={forgotMode}
        resetMode={resetMode}
        forgotMessage={forgotMessage}
        updateAuthField={updateAuthField}
        submitAuth={submitAuth}
        submitForgotPassword={submitForgotPassword}
        submitResetPassword={submitResetPassword}
        openForgotMode={openForgotMode}
        closeForgotMode={closeForgotMode}
      />
    );
  }

  if (currentPath === ACCOUNT_PATH) {
    return (
      <div className="app-root account-page-open">
        <div ref={mapContainerRef} className="map-canvas" />
        <MyAccountPage
          authUser={activeUser}
          onBack={() => navigateTo('/')}
          onLogout={handleLogout}
          onSettingsChange={setAccountSettings}
        />
      </div>
    );
  }

  return (
    <div className="app-root">
      <div ref={mapContainerRef} className="map-canvas" />
      <GlobalSearchLite
        shows={shows}
        users={mapUsers}
        onFocusItem={focusFeedItem}
        onSelectShow={handleSearchShowSelect}
        onSelectUser={handleSearchUserSelect}
      />
      <LiveNotificationToastLite
        enabled={Boolean(activeUser)}
        paused={notificationsPanelOpen}
        priorityNotification={priorityLiveNotification}
        onCountryClick={(payload) => {
          if (!payload?.coords) return;
          focusFeedItem({
            coords: payload.coords,
            country: payload.country
          });
        }}
        onUserClick={openUserProfileDetail}
      />

      <SidebarNavLite
        onProfileOpen={() => navigateTo(ACCOUNT_PATH)}
        onLocationClick={handleLocateCurrentUser}
        onSpotifyConnect={() => connectSpotify('duo-room')}
        spotifyConnected={Boolean(activeUser?.spotify)}
        spotifyConnecting={spotifyConnecting}
        chatOpen={chatPanelOpen}
        onChatToggle={() => {
          setChatPanelOpen((prev) => {
            const next = !prev;
            if (next) setNotificationsPanelOpen(false);
            return next;
          });
        }}
        notificationsOpen={notificationsPanelOpen}
        onNotificationsToggle={() => {
          setNotificationsPanelOpen((prev) => {
            const next = !prev;
            if (next) setChatPanelOpen(false);
            return next;
          });
        }}
        mapVisibility={mapVisibility}
        onMapVisibilityChange={setMapVisibility}
      />

      <ChatListLite open={chatPanelOpen} onToggle={() => setChatPanelOpen((prev) => !prev)} openChatRequest={chatOpenRequest} onUserClick={openUserProfileDetail} />
      <NotificationsListLite open={notificationsPanelOpen} onToggle={() => setNotificationsPanelOpen(false)} />

      <RealFeedLite
        onFocusItem={focusFeedItem}
        onOpenItem={openFeedItem}
        onArtistClick={openArtistDetail}
        onShowsChange={setShows}
        socketRef={socketRef}
        realtimeReady={joined}
        selectedShowDetail={selectedShowDetail}
        onCloseShowDetail={() => setSelectedShowDetail(null)}
        selectedArtistDetail={selectedArtistDetail}
        onCloseArtistDetail={() => setSelectedArtistDetail(null)}
        selectedUserDetail={selectedSimProfile}
        onCloseUserDetail={() => setSelectedSimProfile(null)}
        onUserClick={(userProfile) => openUserProfileDetail(userProfile)}
        onUserChat={(userName) => {
          setChatOpenRequest({ name: userName || '', id: Date.now() });
          setNotificationsPanelOpen(false);
          setChatPanelOpen(true);
        }}
        collapsed={rightPanelCollapsed}
        onToggleCollapse={() => setRightPanelCollapsed((prev) => !prev)}
      />

      <div className="now-playing-card">
        {activeUser?.spotify && hasActiveTrack ? (
          <div className="now-playing-content">
            {activeUser?.nowPlaying?.artistImage || activeUser?.nowPlaying?.albumImage || activeUser?.spotify?.image ? (
              <img
                src={activeUser.nowPlaying.artistImage || activeUser.nowPlaying.albumImage || activeUser.spotify.image}
                alt={spotifyArtistName || spotifyTrackName}
                className="now-playing-cover"
              />
            ) : (
              <div className="now-playing-cover now-playing-cover-fallback" aria-hidden="true">
                ♪
              </div>
            )}
            <div className="now-playing-copy">
              <div className={spotifyIsPlaying ? 'spotify-eq is-playing' : 'spotify-eq'} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p className={useMarqueeTitle ? 'now-playing-title marquee' : 'now-playing-title'}>
                <span>{spotifyTrackName}</span>
              </p>
              <button
                type="button"
                className={isMobileDevice ? 'now-playing-artist' : 'now-playing-artist now-playing-artist-button'}
                onClick={() =>
                  openArtistDetail({
                    artistId: activeUser?.nowPlaying?.artistId,
                    name: spotifyArtistName,
                    artistImage: activeUser?.nowPlaying?.artistImage,
                    albumImage: activeUser?.nowPlaying?.albumImage,
                    heroImage: activeUser?.nowPlaying?.artistImage || activeUser?.nowPlaying?.albumImage || activeUser?.spotify?.image || null
                  })
                }
                disabled={isMobileDevice}
              >
                {spotifyArtistName}
              </button>
            </div>
          </div>
        ) : (
          <div className="now-playing-content">
            {activeUser?.spotify?.image ? (
              <img src={activeUser.spotify.image} alt={activeUser.spotify.display_name || 'Spotify'} className="now-playing-cover" />
            ) : (
              <div className="now-playing-cover now-playing-cover-fallback" aria-hidden="true">
                ♪
              </div>
            )}
            <div className="now-playing-copy">
              <p className="now-playing-title">Conectar ao Spotify</p>
              <p className="now-playing-empty">Clique no icone do Spotify na barra lateral.</p>
            </div>
          </div>
        )}
      </div>

      <div className="perf-box">
        <p>FPS: {fps}</p>
        <p>{isMobileDevice ? 'Modo mobile otimizado ativo' : 'Modo desktop padrão'}</p>
        {activeUser?.spotify?.display_name && <p>Spotify: {activeUser.spotify.display_name}</p>}
        {spotifyError && <p>{spotifyError}</p>}
        <button type="button" className="bench-btn" onClick={runBenchmark} disabled={benchmarkRunning}>
          {benchmarkRunning ? 'Benchmark em execução...' : 'Rodar benchmark (60s)'}
        </button>
        {benchmarkResult && (
          <div className="bench-result">
            <p>Médio: {benchmarkResult.avgFps}</p>
            <p>Mínimo: {benchmarkResult.minFps}</p>
            <p>1% low: {benchmarkResult.p1LowFps}</p>
          </div>
        )}
      </div>

      {!MAPBOX_TOKEN && <div className="missing-token">Sem token Mapbox: modo fallback ativo.</div>}
      {mapWarning && <div className="missing-token">{mapWarning}</div>}
      <EventFeedLite event={selectedEventFeed} onClose={() => setSelectedEventFeed(null)} onGoToMap={focusFeedItem} />
    </div>
  );
}
