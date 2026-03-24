import axios from 'axios';

export function createSpotifyApiService({ spotifyClientId, spotifyClientSecret, artistImageTtlMs = 10 * 60 * 1000 }) {
  const artistImageCache = new Map();

  function buildSpotifyBasicHeader() {
    return `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64')}`;
  }

  async function fetchSpotifyArtistImage(accessToken, artistId) {
    if (!artistId) return null;
    const cached = artistImageCache.get(artistId);
    if (cached?.expiresAt > Date.now()) {
      return cached.image || null;
    }

    try {
      const response = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true
      });
      if (response.status >= 400) return null;
      const image = response.data?.images?.[0]?.url || null;
      artistImageCache.set(artistId, { image, expiresAt: Date.now() + artistImageTtlMs });
      return image;
    } catch {
      return null;
    }
  }

  async function fetchSpotifyNowPlaying(accessToken) {
    try {
      const playbackRes = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true
      });

      if (playbackRes.status === 204) return null;
      if (playbackRes.status >= 400) return null;
      const item = playbackRes.data?.item;
      if (!item) return null;

      const primaryArtist = Array.isArray(item.artists) ? item.artists[0] : null;
      const primaryArtistId = primaryArtist?.id || null;
      const artistImage = await fetchSpotifyArtistImage(accessToken, primaryArtistId);
      const artists = Array.isArray(item.artists)
        ? item.artists.map((artist) => artist.name).join(', ')
        : null;

      return {
        source: 'spotify',
        trackId: item.id || null,
        trackName: item.name || null,
        artistId: primaryArtistId,
        artistName: primaryArtist?.name || artists || null,
        artists,
        artistImage,
        albumImage: item.album?.images?.[0]?.url || null,
        externalUrl: item.external_urls?.spotify || null,
        isPlaying: Boolean(playbackRes.data?.is_playing),
        progressMs: typeof playbackRes.data?.progress_ms === 'number' ? playbackRes.data.progress_ms : null,
        durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : null
      };
    } catch {
      return null;
    }
  }

  async function refreshSpotifyAccessToken(refreshToken) {
    if (!refreshToken) return null;
    try {
      const tokenRes = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: String(refreshToken)
        }).toString(),
        {
          headers: {
            Authorization: buildSpotifyBasicHeader(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        accessToken: tokenRes.data.access_token,
        refreshToken: tokenRes.data.refresh_token || refreshToken,
        expiresIn: Number(tokenRes.data.expires_in || 3600)
      };
    } catch {
      return null;
    }
  }

  async function fetchSpotifyArtist(accessToken, artistId) {
    if (!artistId) return null;
    try {
      const response = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true
      });
      if (response.status >= 400) return null;
      return response.data || null;
    } catch {
      return null;
    }
  }

  async function searchSpotifyArtist(accessToken, artistName) {
    const query = String(artistName || '').trim();
    if (!query) return null;
    try {
      const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: query,
          type: 'artist',
          limit: 1
        },
        validateStatus: () => true
      });
      if (response.status >= 400) return null;
      return response.data?.artists?.items?.[0] || null;
    } catch {
      return null;
    }
  }

  async function fetchSpotifyAlbumTracks(accessToken, albumId) {
    if (!albumId) return null;
    try {
      const response = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { market: 'BR' },
        validateStatus: () => true
      });
      if (response.status >= 400) return null;
      return response.data || null;
    } catch {
      return null;
    }
  }

  async function fetchSpotifyArtistTopTracks(accessToken, artistId) {
    if (!artistId) return [];
    try {
      const response = await axios.get(`https://api.spotify.com/v1/artists/${artistId}/top-tracks`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { market: 'BR' },
        validateStatus: () => true
      });
      if (response.status >= 400) return [];
      return Array.isArray(response.data?.tracks) ? response.data.tracks : [];
    } catch {
      return [];
    }
  }

  return {
    fetchSpotifyNowPlaying,
    refreshSpotifyAccessToken,
    buildSpotifyBasicHeader,
    fetchSpotifyArtist,
    searchSpotifyArtist,
    fetchSpotifyAlbumTracks,
    fetchSpotifyArtistTopTracks
  };
}
