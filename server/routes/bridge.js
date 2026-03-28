import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import redisService from '../services/redis.js';
const FALLBACK_BRIDGE_STORE = new Map();
const BRIDGE_TTL_SECONDS = 45;
const BRIDGE_STALE_MS = 30_000;
const DEVICE_ACTIVE_MS = 90_000;

function normalizeBridgeMode(value) {
  return value === 'desktop' ? 'desktop' : 'browser';
}

function bridgeRedisKey(userId, mode = 'browser') {
  return `bridge:now-playing:${userId}:${normalizeBridgeMode(mode)}`;
}

function buildApiBaseUrl(req, fallbackUrl = '') {
  const fallback = String(fallbackUrl || '').replace(/\/+$/, '');
  const origin = String(req.headers.origin || '').trim();
  if (origin) return origin.replace(/\/+$/, '');

  if (fallback) return fallback;

  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = protoHeader || req.protocol || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').trim();
  if (host) return `${proto}://${host}`;
  return fallback;
}

function buildBookmarklet(apiBaseUrl, userId, bridgeKey) {
  const pushUrl = `${apiBaseUrl}/api/bridge/push`;
  const safePushUrl = JSON.stringify(pushUrl);
  const safeUserId = JSON.stringify(String(userId));
  const safeBridgeKey = JSON.stringify(String(bridgeKey));

  return (
    `javascript:(function(){` +
    `var A=${safePushUrl},U=${safeUserId},K=${safeBridgeKey};` +
    `function artworkUrl(m){` +
    `try{var a=m&&m.metadata&&m.metadata.artwork;if(!a||!a.length)return null;return a[0].src||null;}catch(e){return null;}` +
    `}` +
    `function push(){` +
    `var m=navigator.mediaSession;` +
    `if(!m||!m.metadata){` +
    `fetch(A+'?uid='+encodeURIComponent(U)+'&key='+encodeURIComponent(K),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(function(){});` +
    `return;` +
    `}` +
    `fetch(A+'?uid='+encodeURIComponent(U)+'&key='+encodeURIComponent(K),{` +
    `method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({` +
    `trackName:m.metadata.title||'',artistName:m.metadata.artist||'',albumName:m.metadata.album||'',albumImage:artworkUrl(m),isPlaying:m.playbackState==='playing',bridgeMode:'browser'` +
    `})}).catch(function(){});` +
    `}` +
    `clearInterval(window.__muusicBridge);window.__muusicBridge=setInterval(push,5000);push();console.log('[Muusic] Spotify Web sync ativo');` +
    `})()`
  );
}

function hashDeviceToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function normalizeBridgeNowPlaying(payload = {}) {
  const trackName = String(payload.trackName || '').trim();
  const artistName = String(payload.artistName || '').trim();
  if (!trackName && !artistName) return null;

  return {
    source: 'bridge',
    bridgeMode: payload.bridgeMode === 'desktop' ? 'desktop' : 'browser',
    trackId: null,
    artistId: null,
    trackName,
    artistName,
    artists: artistName,
    albumName: String(payload.albumName || '').trim(),
    albumImage: payload.albumImage ? String(payload.albumImage) : null,
    artistImage: null,
    externalUrl: payload.externalUrl ? String(payload.externalUrl) : null,
    isPlaying: Boolean(payload.isPlaying),
    progressMs: 0,
    durationMs: 0,
    updatedAt: Date.now()
  };
}

async function writeBridgeNowPlaying(userId, nowPlaying) {
  const updatedAt = Date.now();
  const payload = { nowPlaying, updatedAt };
  const mode = normalizeBridgeMode(nowPlaying?.bridgeMode);
  if (redisService.enabled) {
    await redisService.set(bridgeRedisKey(userId, mode), payload, BRIDGE_TTL_SECONDS);
    return payload;
  }
  FALLBACK_BRIDGE_STORE.set(`${String(userId)}:${mode}`, payload);
  return payload;
}

async function readBridgeNowPlaying(userId, mode = 'browser') {
  const resolvedMode = normalizeBridgeMode(mode);
  if (redisService.enabled) {
    return redisService.get(bridgeRedisKey(userId, resolvedMode));
  }
  return FALLBACK_BRIDGE_STORE.get(`${String(userId)}:${resolvedMode}`) || null;
}

async function clearBridgeNowPlaying(userId, mode = 'browser') {
  const resolvedMode = normalizeBridgeMode(mode);
  if (redisService.enabled) {
    await redisService.delete(bridgeRedisKey(userId, resolvedMode));
    return;
  }
  FALLBACK_BRIDGE_STORE.delete(`${String(userId)}:${resolvedMode}`);
}

function isFreshBridgeEntry(entry) {
  return Boolean(entry && Date.now() - Number(entry.updatedAt || 0) <= BRIDGE_STALE_MS);
}

function isActiveDeviceSession(session) {
  return Boolean(session?.lastSeenAt && Date.now() - new Date(session.lastSeenAt).getTime() <= DEVICE_ACTIVE_MS);
}

async function readPreferredBridgeNowPlaying(userId) {
  const [desktopEntry, browserEntry] = await Promise.all([
    readBridgeNowPlaying(userId, 'desktop'),
    readBridgeNowPlaying(userId, 'browser')
  ]);

  if (isFreshBridgeEntry(desktopEntry)) return desktopEntry;
  if (isFreshBridgeEntry(browserEntry)) return browserEntry;
  return null;
}

export function createBridgeRouter({ readAuthSession, userService, frontendUrl, fetchSpotifyTrackByUrl }) {
  const router = Router();

  async function getMusicProfile(userId) {
    return userId ? userService.getUserMusicProfile(userId) : { recentTracks: [], musicHistory: [] };
  }

  async function persistMusicState(userId, nowPlaying) {
    if (!userId) return { recentTracks: [], musicHistory: [] };
    if (nowPlaying?.trackName && nowPlaying?.artistName) {
      await Promise.all([
        userService.upsertNowPlayingForUser({
          userId,
          trackId: nowPlaying.trackId || null,
          trackName: nowPlaying.trackName,
          artistName: nowPlaying.artistName,
          albumImageUrl: nowPlaying.albumImage || null,
          source: 'bridge',
          bridgeMode: nowPlaying.bridgeMode || 'browser',
          externalUrl: nowPlaying.externalUrl || null
        }),
        nowPlaying.isPlaying
          ? userService.recordUserMusicHistory({
              userId,
              trackId: nowPlaying.trackId || null,
              trackName: nowPlaying.trackName,
              artistName: nowPlaying.artistName,
              albumImageUrl: nowPlaying.albumImage || null,
              source: 'bridge',
              bridgeMode: nowPlaying.bridgeMode || 'browser',
              externalUrl: nowPlaying.externalUrl || null,
              playedAt: new Date()
            })
          : Promise.resolve(null)
      ]);
    } else {
      await userService.clearNowPlayingForUser(userId);
    }
    return getMusicProfile(userId);
  }

  async function enrichBridgeNowPlaying(nowPlaying) {
    if (!nowPlaying || nowPlaying.albumImage || !nowPlaying.externalUrl || typeof fetchSpotifyTrackByUrl !== 'function') {
      return nowPlaying;
    }

    const spotifyTrack = await fetchSpotifyTrackByUrl(nowPlaying.externalUrl);
    if (!spotifyTrack) return nowPlaying;

    return {
      ...nowPlaying,
      trackId: nowPlaying.trackId || spotifyTrack.trackId || null,
      trackName: nowPlaying.trackName || spotifyTrack.trackName || '',
      artistName: nowPlaying.artistName || spotifyTrack.artistName || '',
      artists: nowPlaying.artists || spotifyTrack.artistName || nowPlaying.artistName || '',
      albumImage: spotifyTrack.albumImage || nowPlaying.albumImage || null,
      externalUrl: spotifyTrack.externalUrl || nowPlaying.externalUrl || null
    };
  }

  async function readAndEnrichPreferredBridgeNowPlaying(userId) {
    const preferredEntry = await readPreferredBridgeNowPlaying(userId);
    if (!preferredEntry?.nowPlaying) return null;

    const enrichedNowPlaying = await enrichBridgeNowPlaying(preferredEntry.nowPlaying);
    if (!enrichedNowPlaying) return preferredEntry;

    const albumImageChanged = enrichedNowPlaying.albumImage !== preferredEntry.nowPlaying.albumImage;
    const trackIdChanged = enrichedNowPlaying.trackId !== preferredEntry.nowPlaying.trackId;
    const externalUrlChanged = enrichedNowPlaying.externalUrl !== preferredEntry.nowPlaying.externalUrl;

    if (albumImageChanged || trackIdChanged || externalUrlChanged) {
      const nextEntry = {
        ...preferredEntry,
        nowPlaying: enrichedNowPlaying,
        updatedAt: Date.now()
      };
      await writeBridgeNowPlaying(userId, enrichedNowPlaying);
      return nextEntry;
    }

    return preferredEntry;
  }

  async function syncPersistedNowPlayingFromPreferredBridge(userId) {
    const preferredEntry = await readAndEnrichPreferredBridgeNowPlaying(userId);
    if (preferredEntry?.nowPlaying?.trackName && preferredEntry?.nowPlaying?.artistName) {
      await userService.upsertNowPlayingForUser({
        userId,
        trackId: preferredEntry.nowPlaying.trackId || null,
        trackName: preferredEntry.nowPlaying.trackName,
        artistName: preferredEntry.nowPlaying.artistName,
        albumImageUrl: preferredEntry.nowPlaying.albumImage || null,
        source: 'bridge',
        bridgeMode: preferredEntry.nowPlaying.bridgeMode || 'browser',
        externalUrl: preferredEntry.nowPlaying.externalUrl || null
      });
      return;
    }
    await userService.clearNowPlayingForUser(userId);
  }

  router.get('/api/bridge/setup', async (req, res) => {
    const auth = await readAuthSession(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const current = await userService.getSpotifyBridgeByUserId(auth.user.id);
    const bridgeKey = current?.key || randomBytes(24).toString('hex');
    const connectedAt = current?.connectedAt || new Date().toISOString();

    if (!current?.key) {
      await userService.updateUserById(auth.user.id, {
        spotifyBridgeKey: bridgeKey,
        spotifyBridgeConnectedAt: connectedAt
      });
    }

    const apiBaseUrl = buildApiBaseUrl(req, frontendUrl);
    const bookmarkletCode = buildBookmarklet(apiBaseUrl, auth.user.id, bridgeKey);

    return res.json({
      connectedAt,
      bookmarkletCode
    });
  });

  router.post('/api/bridge/revoke', async (req, res) => {
    const auth = await readAuthSession(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    await userService.updateUserById(auth.user.id, {
      spotifyBridgeKey: null,
      spotifyBridgeConnectedAt: null
    });
    await Promise.all([
      clearBridgeNowPlaying(auth.user.id, 'browser'),
      clearBridgeNowPlaying(auth.user.id, 'desktop'),
      userService.clearNowPlayingForUser(auth.user.id)
    ]);

    return res.json({ ok: true });
  });

  router.post('/api/bridge/push', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const userId = String(req.query.uid || '').trim();
    const bridgeKey = String(req.query.key || '').trim();
    if (!userId || !bridgeKey) {
      return res.status(400).json({ error: 'Missing uid or key' });
    }

    const bridge = await userService.getSpotifyBridgeByUserId(userId);
    if (!bridge?.key || bridge.key !== bridgeKey) {
      return res.status(401).json({ error: 'Invalid bridge key' });
    }

    const normalized = normalizeBridgeNowPlaying(req.body || {});
    const nowPlaying = await enrichBridgeNowPlaying(normalized);
    if (!nowPlaying) {
      await clearBridgeNowPlaying(userId, 'browser');
      await syncPersistedNowPlayingFromPreferredBridge(userId);
      return res.json({ ok: true, nowPlaying: null, ...(await getMusicProfile(userId)) });
    }

    await writeBridgeNowPlaying(userId, nowPlaying);
    const musicProfile = await persistMusicState(userId, nowPlaying);
    return res.json({ ok: true, nowPlaying, ...musicProfile });
  });

  router.options('/api/bridge/push', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  });

  router.get('/api/bridge/now-playing', async (req, res) => {
    const auth = await readAuthSession(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const entry = await readAndEnrichPreferredBridgeNowPlaying(auth.user.id);
    if (!entry) {
      return res.json({ nowPlaying: null, ...(await getMusicProfile(auth.user.id)) });
    }

    return res.json({
      nowPlaying: entry.nowPlaying || null,
      updatedAt: entry.updatedAt || null,
      ...(await getMusicProfile(auth.user.id))
    });
  });

  router.post('/api/bridge/device/session', async (req, res) => {
    const auth = await readAuthSession(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const deviceToken = randomBytes(32).toString('hex');
    const session = await userService.createBridgeDeviceSession({
      userId: auth.user.id,
      deviceName: req.body?.deviceName || 'Muusic Bridge Mac',
      platform: req.body?.platform || 'macos',
      tokenHash: hashDeviceToken(deviceToken)
    });

    return res.json({
      deviceId: session.id,
      deviceToken,
      deviceName: session.deviceName || 'Muusic Bridge Mac',
      platform: session.platform || 'macos'
    });
  });

  router.get('/api/bridge/device/status', async (req, res) => {
    const auth = await readAuthSession(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const sessions = await userService.listBridgeDeviceSessionsByUserId(auth.user.id);
    return res.json({
      activeDeviceCount: sessions.filter(isActiveDeviceSession).length,
      latestSeenAt: sessions[0]?.lastSeenAt || null,
      devices: sessions.map((item) => ({
        id: item.id,
        deviceName: item.deviceName || 'Muusic Bridge Mac',
        platform: item.platform || 'macos',
        createdAt: item.createdAt,
        lastSeenAt: item.lastSeenAt,
        isActive: isActiveDeviceSession(item),
        status: isActiveDeviceSession(item) ? 'online' : 'offline'
      }))
    });
  });

  router.post('/api/bridge/device/heartbeat', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing device token' });
    }

    const session = await userService.findBridgeDeviceSessionByTokenHash(hashDeviceToken(token));
    if (!session?.userId) {
      return res.status(401).json({ error: 'Invalid device token' });
    }

    const touched = await userService.touchBridgeDeviceSession(session.id);
    return res.json({
      ok: true,
      deviceId: session.id,
      userId: session.userId,
      lastSeenAt: touched?.lastSeenAt || new Date().toISOString()
    });
  });

  router.post('/api/bridge/device/revoke', async (req, res) => {
    const auth = await readAuthSession(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const deviceId = String(req.body?.deviceId || '').trim();
    if (!deviceId) return res.status(400).json({ error: 'Missing deviceId' });

    await userService.revokeBridgeDeviceSession({ id: deviceId, userId: auth.user.id });
    return res.json({ ok: true });
  });

  router.post('/api/bridge/device-push', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing device token' });
    }

    const session = await userService.findBridgeDeviceSessionByTokenHash(hashDeviceToken(token));
    if (!session?.userId) {
      return res.status(401).json({ error: 'Invalid device token' });
    }

    const normalized = normalizeBridgeNowPlaying({
      ...(req.body || {}),
      bridgeMode: 'desktop'
    });
    const nowPlaying = await enrichBridgeNowPlaying(normalized);
    if (!nowPlaying) {
      await clearBridgeNowPlaying(session.userId, 'desktop');
      await syncPersistedNowPlayingFromPreferredBridge(session.userId);
      return res.json({ ok: true, nowPlaying: null, ...(await getMusicProfile(session.userId)) });
    }

    await writeBridgeNowPlaying(session.userId, nowPlaying);
    await userService.touchBridgeDeviceSession(session.id);
    const musicProfile = await persistMusicState(session.userId, nowPlaying);
    return res.json({ ok: true, nowPlaying, ...musicProfile });
  });

  return router;
}
