import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';

export function createSpotifyRouter({
  jwtSecret,
  frontendUrl,
  nanoid,
  randomBytes,
  readAuthSession,
  sessionService,
  trendingPlaybackService,
  fetchSpotifyNowPlaying,
  refreshSpotifyAccessToken,
  buildSpotifyBasicHeader,
  fetchSpotifyArtist,
  searchSpotifyArtist,
  fetchSpotifyAlbumTracks,
  fetchSpotifyArtistTopTracks,
  cleanupSpotifyExchangeCodes,
  spotifyExchangeCodes,
  spotifyExchangeTtlMs
}) {
  const router = Router();

  function formatDuration(durationMs) {
    const totalSeconds = Math.max(0, Math.floor(Number(durationMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function normalizeTrack(track, fallbackAlbum = null) {
    if (!track?.id) return null;
    return {
      id: track.id,
      title: track.name || 'Faixa',
      artists: Array.isArray(track.artists) ? track.artists.map((artist) => artist.name).filter(Boolean).join(', ') : '',
      duration: formatDuration(track.duration_ms),
      album: track.album?.name || fallbackAlbum?.name || '',
      coverImage: track.album?.images?.[0]?.url || fallbackAlbum?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null,
      previewUrl: track.preview_url || null
    };
  }

  router.post('/auth/spotify/connect', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const stateToken = jwt.sign(
        {
          type: 'spotify-connect',
          userId: auth.user.id,
          roomId: String(req.body?.roomId || 'global'),
          sessionId: auth.sessionId,
          nonce: nanoid()
        },
        jwtSecret,
        { expiresIn: '10m' }
      );

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.SPOTIFY_CLIENT_ID || '',
        scope: 'user-read-private user-read-email user-read-currently-playing user-read-playback-state',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
        state: stateToken
      });
      return res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
    } catch {
      return res.status(500).json({ error: 'Falha ao iniciar conexao Spotify.' });
    }
  });

  router.get('/auth/spotify/login', (req, res) => {
    const { userId = 'user', roomId = 'global' } = req.query;
    const state = Buffer.from(JSON.stringify({ userId, roomId, nonce: nanoid() })).toString('base64url');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID || '',
      scope: 'user-read-private user-read-email user-read-currently-playing user-read-playback-state',
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
      state
    });
    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  });

  router.get('/auth/spotify/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) return res.status(400).send('Missing code/state');

      let decoded = null;
      try {
        const payload = jwt.verify(String(state), jwtSecret);
        if (payload?.type === 'spotify-connect') decoded = payload;
      } catch {
        // fallback for legacy state format
      }
      if (!decoded) decoded = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));

      const sessionId = String(decoded.sessionId || '');
      if (sessionId) {
        const session = await sessionService.get(sessionId);
        if (!session || session.userId !== decoded.userId) {
          return res.status(401).send('Sessao local invalida para conectar Spotify.');
        }
      }

      const tokenRes = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI || ''
        }).toString(),
        {
          headers: {
            Authorization: buildSpotifyBasicHeader(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const accessToken = tokenRes.data.access_token;
      const refreshToken = tokenRes.data.refresh_token || null;
      const expiresIn = Number(tokenRes.data.expires_in || 3600);
      const tokenExpiresAt = Date.now() + expiresIn * 1000;
      const profileRes = await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const spotifyProfile = {
        id: profileRes.data.id,
        display_name: profileRes.data.display_name,
        email: profileRes.data.email,
        product: profileRes.data.product,
        image: profileRes.data.images?.[0]?.url || null
      };
      const nowPlaying = await fetchSpotifyNowPlaying(accessToken);
      if (nowPlaying?.isPlaying && nowPlaying?.trackName && nowPlaying?.artistName) {
        try {
          await trendingPlaybackService.enqueuePlayback({
            userId: decoded.userId,
            artistId: nowPlaying.artistId || null,
            artistName: nowPlaying.artistName,
            trackId: nowPlaying.trackId || null,
            trackName: nowPlaying.trackName,
            timestamp: new Date().toISOString(),
            isPlaying: true
          });
        } catch {
          // non-blocking telemetry
        }
      }

      const appToken = jwt.sign(
        {
          type: 'spotify-auth',
          userId: decoded.userId,
          roomId: decoded.roomId,
          spotify: spotifyProfile,
          accessToken,
          refreshToken,
          tokenExpiresAt,
          nowPlaying
        },
        jwtSecret,
        { expiresIn: '8h' }
      );

      cleanupSpotifyExchangeCodes();
      const exchangeCode = randomBytes(24).toString('hex');
      spotifyExchangeCodes.set(exchangeCode, {
        userId: decoded.userId,
        spotifyToken: appToken,
        expiresAt: Date.now() + spotifyExchangeTtlMs
      });

      const redirect = new URL(frontendUrl);
      redirect.searchParams.set('spotify_code', exchangeCode);
      redirect.searchParams.set('spotify_connected', '1');
      redirect.searchParams.set('room', decoded.roomId);
      redirect.searchParams.set('user', decoded.userId);
      res.redirect(redirect.toString());
    } catch (error) {
      res.status(500).send(`Spotify callback error: ${error.message}`);
    }
  });

  router.post('/auth/spotify/exchange', async (req, res) => {
    try {
      cleanupSpotifyExchangeCodes();
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const code = String(req.body?.code || '').trim();
      if (!code) return res.status(400).json({ error: 'Codigo ausente.' });

      const pending = spotifyExchangeCodes.get(code);
      spotifyExchangeCodes.delete(code);
      if (!pending) return res.status(400).json({ error: 'Codigo invalido ou expirado.' });
      if (pending.expiresAt <= Date.now()) return res.status(400).json({ error: 'Codigo expirado.' });
      if (pending.userId !== auth.user.id) return res.status(403).json({ error: 'Codigo nao pertence ao usuario autenticado.' });

      return res.json({ spotifyToken: pending.spotifyToken });
    } catch (error) {
      return res.status(500).json({ error: `Falha ao trocar codigo Spotify: ${error.message}` });
    }
  });

  router.get('/auth/spotify/me', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    try {
      const payload = jwt.verify(token, jwtSecret);
      if (payload?.type !== 'spotify-auth') {
        return res.status(401).json({ error: 'Invalid token type' });
      }
      return res.json({
        userId: payload.userId,
        roomId: payload.roomId,
        spotify: payload.spotify,
        nowPlaying: payload.nowPlaying || null,
        tokenExpiresAt: payload.tokenExpiresAt || null
      });
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

  router.get('/auth/spotify/now-playing', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    try {
      const payload = jwt.verify(token, jwtSecret);
      if (payload?.type !== 'spotify-auth') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      let accessToken = payload.accessToken;
      let refreshToken = payload.refreshToken || null;
      let tokenExpiresAt = Number(payload.tokenExpiresAt || 0);
      if (!accessToken) {
        return res.status(400).json({ error: 'Spotify token payload missing access token' });
      }
      if (tokenExpiresAt && Date.now() >= tokenExpiresAt - 30_000) {
        const refreshed = await refreshSpotifyAccessToken(refreshToken);
        if (refreshed?.accessToken) {
          accessToken = refreshed.accessToken;
          refreshToken = refreshed.refreshToken;
          tokenExpiresAt = Date.now() + refreshed.expiresIn * 1000;
        }
      }

      const nowPlaying = await fetchSpotifyNowPlaying(accessToken);
      if (nowPlaying?.isPlaying && nowPlaying?.trackName && nowPlaying?.artistName) {
        try {
          await trendingPlaybackService.enqueuePlayback({
            userId: payload.userId,
            artistId: nowPlaying.artistId || null,
            artistName: nowPlaying.artistName,
            trackId: nowPlaying.trackId || null,
            trackName: nowPlaying.trackName,
            timestamp: new Date().toISOString(),
            isPlaying: true
          });
        } catch {
          // non-blocking telemetry
        }
      }

      const response = { nowPlaying };
      if (refreshToken && accessToken !== payload.accessToken) {
        response.spotifyToken = jwt.sign(
          {
            ...payload,
            accessToken,
            refreshToken,
            tokenExpiresAt,
            nowPlaying
          },
          jwtSecret,
          { expiresIn: '8h' }
        );
      }
      return res.json(response);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

  router.get('/auth/spotify/artist-tracks', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    try {
      const payload = jwt.verify(token, jwtSecret);
      if (payload?.type !== 'spotify-auth') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      let accessToken = payload.accessToken;
      let refreshToken = payload.refreshToken || null;
      let tokenExpiresAt = Number(payload.tokenExpiresAt || 0);
      if (!accessToken) {
        return res.status(400).json({ error: 'Spotify token payload missing access token' });
      }
      if (tokenExpiresAt && Date.now() >= tokenExpiresAt - 30_000) {
        const refreshed = await refreshSpotifyAccessToken(refreshToken);
        if (refreshed?.accessToken) {
          accessToken = refreshed.accessToken;
          refreshToken = refreshed.refreshToken;
          tokenExpiresAt = Date.now() + refreshed.expiresIn * 1000;
        }
      }

      const queryArtistId = String(req.query.artistId || '').trim();
      const queryArtistName = String(req.query.artistName || '').trim();
      const queryAlbumId = String(req.query.albumId || '').trim();

      let artist = queryArtistId ? await fetchSpotifyArtist(accessToken, queryArtistId) : null;
      if (!artist && queryArtistName) {
        artist = await searchSpotifyArtist(accessToken, queryArtistName);
      }

      let album = null;
      let tracks = [];

      if (queryAlbumId) {
        album = await fetchSpotifyAlbumTracks(accessToken, queryAlbumId);
        tracks = Array.isArray(album?.tracks?.items)
          ? album.tracks.items.map((track) => normalizeTrack(track, album)).filter(Boolean)
          : [];
      }

      if (!tracks.length && artist?.id) {
        const topTracks = await fetchSpotifyArtistTopTracks(accessToken, artist.id);
        tracks = topTracks.map((track) => normalizeTrack(track)).filter(Boolean);
      }

      if (!tracks.length) {
        return res.status(404).json({ error: 'Nenhuma faixa encontrada para este artista.' });
      }

      const response = {
        artist: {
          id: artist?.id || queryArtistId || null,
          name: artist?.name || queryArtistName || '',
          image: artist?.images?.[0]?.url || null
        },
        source: album?.id ? 'album' : 'artist-top-tracks',
        album: album
          ? {
              id: album.id,
              name: album.name || '',
              image: album.images?.[0]?.url || null,
              releaseDate: album.release_date || ''
            }
          : null,
        tracks
      };

      if (refreshToken && accessToken !== payload.accessToken) {
        response.spotifyToken = jwt.sign(
          {
            ...payload,
            accessToken,
            refreshToken,
            tokenExpiresAt
          },
          jwtSecret,
          { expiresIn: '8h' }
        );
      }

      return res.json(response);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  });

  return router;
}
