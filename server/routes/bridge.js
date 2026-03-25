import { Router } from 'express';
import { randomBytes } from 'crypto';
import redisService from '../services/redis.js';

const FALLBACK_BRIDGE_STORE = new Map();
const BRIDGE_TTL_SECONDS = 45;
const BRIDGE_STALE_MS = 30_000;

function bridgeRedisKey(userId) {
  return `bridge:now-playing:${userId}`;
}

function buildApiBaseUrl(req, fallbackUrl = '') {
  const origin = String(req.headers.origin || '').trim();
  if (origin) return origin.replace(/\/+$/, '');

  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = protoHeader || req.protocol || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').trim();
  if (host) return `${proto}://${host}`;
  return String(fallbackUrl || '').replace(/\/+$/, '');
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
    `trackName:m.metadata.title||'',artistName:m.metadata.artist||'',albumName:m.metadata.album||'',albumImage:artworkUrl(m),isPlaying:m.playbackState==='playing'` +
    `})}).catch(function(){});` +
    `}` +
    `clearInterval(window.__muusicBridge);window.__muusicBridge=setInterval(push,5000);push();console.log('[Muusic] Spotify Web sync ativo');` +
    `})()`
  );
}

function normalizeBridgeNowPlaying(payload = {}) {
  const trackName = String(payload.trackName || '').trim();
  const artistName = String(payload.artistName || '').trim();
  if (!trackName && !artistName) return null;

  return {
    source: 'bridge',
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
  if (redisService.enabled) {
    await redisService.set(bridgeRedisKey(userId), payload, BRIDGE_TTL_SECONDS);
    return payload;
  }
  FALLBACK_BRIDGE_STORE.set(String(userId), payload);
  return payload;
}

async function readBridgeNowPlaying(userId) {
  if (redisService.enabled) {
    return redisService.get(bridgeRedisKey(userId));
  }
  return FALLBACK_BRIDGE_STORE.get(String(userId)) || null;
}

async function clearBridgeNowPlaying(userId) {
  if (redisService.enabled) {
    await redisService.delete(bridgeRedisKey(userId));
    return;
  }
  FALLBACK_BRIDGE_STORE.delete(String(userId));
}

export function createBridgeRouter({ readAuthSession, userService, frontendUrl }) {
  const router = Router();

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
    await clearBridgeNowPlaying(auth.user.id);

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

    const nowPlaying = normalizeBridgeNowPlaying(req.body || {});
    if (!nowPlaying) {
      await clearBridgeNowPlaying(userId);
      return res.json({ ok: true, nowPlaying: null });
    }

    await writeBridgeNowPlaying(userId, nowPlaying);
    return res.json({ ok: true, nowPlaying });
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

    const entry = await readBridgeNowPlaying(auth.user.id);
    if (!entry || Date.now() - Number(entry.updatedAt || 0) > BRIDGE_STALE_MS) {
      return res.json({ nowPlaying: null });
    }

    return res.json({
      nowPlaying: entry.nowPlaying || null,
      updatedAt: entry.updatedAt || null
    });
  });

  return router;
}
