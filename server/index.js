import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { customAlphabet } from 'nanoid';
import { randomBytes } from 'crypto';
import userService from './services/userService.js';
import showService from './services/showService.js';
import showCacheService from './services/showCache.js';
import redisService from './services/redis.js';
import sessionService from './services/session.js';
import passwordResetService from './services/passwordResetService.js';
import cacheMiddleware from './middleware/cache.js';
import { createLocalAuth } from './middleware/localAuth.js';
import { createAdminRouter } from './routes/admin.js';
import mapRoutes from './routes/map.js';
import { createLocalAuthRouter } from './routes/localAuth.js';
import { createPublicRouter } from './routes/public.js';
import { createSpotifyRouter } from './routes/spotify.js';
import { createBridgeRouter } from './routes/bridge.js';
import geolocationService from './services/geolocation.js';
import accountSettingsService from './services/accountSettingsService.js';
import trendingPlaybackService from './services/trendingPlaybackService.js';
import performanceService from './services/performanceService.js';
import { createRealtimeClusterService } from './services/realtimeClusterService.js';
import { createSocketRateLimiter } from './services/socketRateLimiter.js';
import { createSpotifyApiService } from './services/spotifyApiService.js';
import { disconnectPrisma } from './services/db.js';
import {
  determineRoleForNewUser,
  hashPassword,
  issueLocalAuthToken,
  sanitizeRole,
  sanitizeUserResponse,
  verifyPassword
} from './utils/authLocal.js';
import { parseListQuery, parseShowPayload, sanitizeShowResponse } from './utils/showPayload.js';

function loadEnvironmentFiles() {
  const appMode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const rootDir = process.cwd();
  const candidates = [
    `.env.${appMode}.local`,
    '.env.local',
    `.env.${appMode}`,
    '.env'
  ];

  for (const fileName of candidates) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    dotenv.config({ path: filePath });
  }
}

loadEnvironmentFiles();

const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URLS = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const FRONTEND_URL = FRONTEND_URLS[0] || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production';
const configuredJwtSecret = String(process.env.SPOTIFY_JWT_SECRET || '').trim();
if (isProduction && (!configuredJwtSecret || configuredJwtSecret === 'change_me_super_secret')) {
  throw new Error('SPOTIFY_JWT_SECRET obrigatorio em producao.');
}
const JWT_SECRET = configuredJwtSecret || 'local-dev-secret';
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 24);
const allowedOrigins = new Set([...FRONTEND_URLS, 'http://localhost:5173', 'http://127.0.0.1:5173']);
const spotifyExchangeCodes = new Map();
const SPOTIFY_EXCHANGE_TTL_MS = 2 * 60 * 1000;
const SOCKET_GEO_CELL_DEG = Math.max(1, Math.min(30, Number(process.env.SOCKET_GEO_CELL_DEG || 8)));
const PRESENCE_PATCH_FLUSH_MS = Math.max(80, Math.min(1000, Number(process.env.PRESENCE_PATCH_FLUSH_MS || 350)));
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

function corsOriginValidator(origin, callback) {
  if (!origin || allowedOrigins.has(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Not allowed by CORS'));
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clampLat(lat) {
  return Math.max(-90, Math.min(90, lat));
}

function normalizeLng(lng) {
  if (!Number.isFinite(lng)) return 0;
  let normalized = lng;
  while (normalized < -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return normalized;
}

function resolveAreaRoomId(baseRoomId, lat, lng) {
  const safeLat = safeNumber(lat);
  const safeLng = safeNumber(lng);
  if (safeLat === null || safeLng === null) return null;
  const clampedLat = clampLat(safeLat);
  const clampedLng = normalizeLng(safeLng);
  const latBucket = Math.floor((clampedLat + 90) / SOCKET_GEO_CELL_DEG);
  const lngBucket = Math.floor((clampedLng + 180) / SOCKET_GEO_CELL_DEG);
  return `geo:${String(baseRoomId)}:${latBucket}:${lngBucket}`;
}

function toPresenceUserSummary(user) {
  if (!user) return null;
  return {
    id: user.id || '',
    name: user.name || 'Usuario',
    spotify: user.spotify || null,
    nowPlaying: user.nowPlaying || null,
    location: user.location || null,
    connectedAt: user.connectedAt || Date.now()
  };
}

function sanitizeNowPlayingPayload(nowPlaying) {
  if (!nowPlaying || typeof nowPlaying !== 'object') return null;
  const artistName = String(nowPlaying.artistName || nowPlaying.artists || '').trim();
  const trackName = String(nowPlaying.trackName || '').trim();

  return {
    artistId: nowPlaying.artistId || null,
    artistName: artistName || '',
    artists: String(nowPlaying.artists || artistName || '').trim(),
    trackId: nowPlaying.trackId || null,
    trackName: trackName || '',
    progressMs: Math.max(0, Number(nowPlaying.progressMs || 0) || 0),
    durationMs: Math.max(0, Number(nowPlaying.durationMs || 0) || 0),
    isPlaying: Boolean(nowPlaying.isPlaying),
    albumImage: nowPlaying.albumImage || null,
    artistImage: nowPlaying.artistImage || null,
    externalUrl: nowPlaying.externalUrl || null,
    source: nowPlaying.source === 'bridge' ? 'bridge' : 'spotify',
    updatedAt: Date.now()
  };
}

const presencePatchQueues = new Map();
const presencePatchTimers = new Map();

function queuePresencePatch({ roomId, patch, ioInstance, cluster }) {
  const targetRoom = String(roomId || '');
  if (!targetRoom || !patch) return;

  const queue = presencePatchQueues.get(targetRoom) || new Map();
  const patchType = String(patch.type || '');
  if (patchType === 'remove') {
    const id = String(patch.userId || '');
    if (!id) return;
    queue.set(id, { type: 'remove', userId: id, at: patch.at || Date.now() });
  } else if (patchType === 'upsert') {
    const id = String(patch.user?.id || '');
    if (!id) return;
    queue.set(id, { type: 'upsert', user: patch.user, at: patch.at || Date.now() });
  } else {
    return;
  }
  presencePatchQueues.set(targetRoom, queue);

  if (presencePatchTimers.has(targetRoom)) return;
  const timerId = setTimeout(async () => {
    presencePatchTimers.delete(targetRoom);
    const current = presencePatchQueues.get(targetRoom);
    if (!current || current.size === 0) return;
    presencePatchQueues.delete(targetRoom);
    const payload = {
      patches: Array.from(current.values()),
      at: Date.now()
    };
    ioInstance.to(targetRoom).emit('presence:batch', payload);
    await cluster.broadcast('presence:batch', targetRoom, payload);
  }, PRESENCE_PATCH_FLUSH_MS);
  presencePatchTimers.set(targetRoom, timerId);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: Array.from(allowedOrigins),
    credentials: true
  },
  transports: ['websocket'],
  perMessageDeflate: false
});

const bridgePushCors = cors({
  origin: true,
  credentials: false,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
});

app.options('/api/bridge/push', bridgePushCors);
app.use('/api/bridge/push', bridgePushCors);

if (!isProduction) {
  app.use(cors({ origin: true, credentials: true }));
} else {
  app.use(cors({ origin: corsOriginValidator, credentials: true }));
}
app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  const startedAt = performance.now();
  res.on('finish', () => {
    const durationMs = performance.now() - startedAt;
    performanceService.recordRequest({
      method: req.method,
      path: req.path || req.originalUrl || '/',
      statusCode: res.statusCode,
      durationMs,
      at: Date.now()
    });
  });
  next();
});

app.use((req, res, next) => {
  const path = String(req.path || '');
  if (!isProduction && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
  } else if (path.startsWith('/auth/') || path.startsWith('/admin/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use('/api', mapRoutes);

const { readAuthSession, requireAdmin } = createLocalAuth({
  jwtSecret: JWT_SECRET,
  sessionService,
  userService,
  sanitizeRole
});
const { fetchSpotifyNowPlaying, refreshSpotifyAccessToken, buildSpotifyBasicHeader, fetchSpotifyArtist, searchSpotifyArtist, fetchSpotifyAlbumTracks, fetchSpotifyArtistTopTracks } =
  createSpotifyApiService({
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
  });
trendingPlaybackService.startBackgroundWorker({
  flushIntervalMs: Number(process.env.TRENDINGS_FLUSH_INTERVAL_MS || 8000),
  maxBatchSize: Number(process.env.TRENDINGS_BATCH_SIZE || 200)
});

function cleanupSpotifyExchangeCodes() {
  const now = Date.now();
  for (const [code, item] of spotifyExchangeCodes.entries()) {
    if (!item || Number(item.expiresAt || 0) <= now) {
      spotifyExchangeCodes.delete(code);
    }
  }
}
const realtimeCluster = createRealtimeClusterService({
  instanceId: `api-${nanoid(10)}`,
  maxMessages: 200
});
await realtimeCluster.start(io);
const socketRateLimiter = createSocketRateLimiter();
await socketRateLimiter.start();

app.use(
  createPublicRouter({
    isProduction,
    cacheArtistsMiddleware: cacheMiddleware(300),
    parseListQuery,
    showService,
    showCacheService,
    sanitizeShowResponse,
    userService,
    accountSettingsService,
    performanceService
  })
);

app.use(
  createLocalAuthRouter({
    jwtSecret: JWT_SECRET,
    nanoid,
    adminEmails: ADMIN_EMAILS,
    userService,
    sessionService,
    passwordResetService,
    accountSettingsService,
    trendingPlaybackService,
    determineRoleForNewUser,
    hashPassword,
    verifyPassword,
    issueLocalAuthToken,
    sanitizeUserResponse,
    readAuthSession,
    isProduction
  })
);

app.use(
  createAdminRouter({
    requireAdmin,
    nanoid,
    userService,
    sessionService,
    showService,
    showCacheService,
    trendingPlaybackService,
    performanceService,
    sanitizeRole,
    sanitizeUserResponse,
    hashPassword,
    parseListQuery,
    parseShowPayload,
    sanitizeShowResponse,
    io
  })
);

app.use(
  createSpotifyRouter({
    jwtSecret: JWT_SECRET,
    frontendUrl: FRONTEND_URL,
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
    spotifyExchangeTtlMs: SPOTIFY_EXCHANGE_TTL_MS
  })
);

app.use(
  createBridgeRouter({
    readAuthSession,
    userService,
    frontendUrl: FRONTEND_URL
  })
);

io.on('connection', (socket) => {
  let joinedRoom = null;
  let joinedUserId = null;
  let joinedUserName = null;
  let joinedAreaRoom = null;

  socket.on('room:join', async ({ roomId = 'global', userId, name, spotify, nowPlaying, token, sessionId } = {}, ack) => {
    const startedAt = performance.now();
    try {
      const joinLimit = await socketRateLimiter.consume({
        key: `join:${socket.id}`,
        limit: 12,
        windowSec: 60
      });
      if (!joinLimit.allowed) {
        ack?.({ ok: false, error: 'Rate limit exceeded', retryAfterSec: joinLimit.retryAfterSec });
        return;
      }

      if (!token) {
        ack?.({ ok: false, error: 'Auth required' });
        return;
      }

      let finalSpotify = spotify || null;
      let finalUserId = userId || `guest-${socket.id.slice(0, 6)}`;

      const payload = jwt.verify(token, JWT_SECRET);
      if (payload?.type === 'local-auth') {
        const sid = String(payload.sessionId || sessionId || '');
        const session = await sessionService.get(sid);
        if (!sid || !session || session.userId !== payload.userId) {
          throw new Error('Invalid session');
        }
        finalSpotify = spotify || null;
        finalUserId = payload.userId;
        roomId = roomId || 'global';
      } else {
        finalSpotify = payload.spotify || spotify || null;
        finalUserId = payload.userId || finalUserId;
        roomId = payload.roomId || roomId;
      }

      joinedRoom = String(roomId);
      joinedUserId = String(finalUserId);
      joinedUserName = name || finalSpotify?.display_name || `User ${joinedUserId}`;
      socket.join(joinedRoom);

      const presence = await realtimeCluster.upsertUser(
        joinedRoom,
        {
          id: joinedUserId,
          name: joinedUserName,
          spotify: finalSpotify,
          nowPlaying: sanitizeNowPlayingPayload(nowPlaying),
          location: null,
          connectedAt: Date.now()
        },
        { publishPresence: false }
      );
      const selfUser = toPresenceUserSummary(
        presence.find((user) => user?.id === joinedUserId) || {
          id: joinedUserId,
          name: joinedUserName,
          spotify: finalSpotify,
          location: null,
          connectedAt: Date.now()
        }
      );
      const patch = { type: 'upsert', user: selfUser, at: Date.now() };
      queuePresencePatch({
        roomId: joinedRoom,
        patch,
        ioInstance: io,
        cluster: realtimeCluster
      });
      const messages = await realtimeCluster.getMessages(joinedRoom);
      socket.emit('chat:history', messages);
      socket.emit('presence:update', []);
      ack?.({ ok: true, roomId: joinedRoom, userId: joinedUserId });
      performanceService.recordSocketEvent({
        event: 'room:join',
        durationMs: performance.now() - startedAt,
        ok: true
      });
    } catch {
      ack?.({ ok: false, error: 'Join failed' });
      performanceService.recordSocketEvent({
        event: 'room:join',
        durationMs: performance.now() - startedAt,
        ok: false
      });
    }
  });

  socket.on('location:update', async ({ lat, lng } = {}) => {
    const startedAt = performance.now();
    if (!joinedRoom || !joinedUserId) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    try {
      const locationLimit = await socketRateLimiter.consume({
        key: `loc:${joinedUserId}`,
        limit: 30,
        windowSec: 10
      });
      if (!locationLimit.allowed) return;

      const presence = await realtimeCluster.updateLocation(
        joinedRoom,
        joinedUserId,
        {
          lat,
          lng,
          updatedAt: Date.now()
        },
        { publishPresence: false }
      );
      if (!presence) return;
      const selfUser = toPresenceUserSummary(presence.find((user) => user?.id === joinedUserId));
      if (!selfUser) return;
      const upsertPatch = { type: 'upsert', user: selfUser, at: Date.now() };
      const removePatch = { type: 'remove', userId: joinedUserId, at: Date.now() };
      const previousAreaRoom = joinedAreaRoom;
      const nextAreaRoom = resolveAreaRoomId(joinedRoom, lat, lng);
      if (nextAreaRoom && nextAreaRoom !== previousAreaRoom) {
        if (previousAreaRoom) socket.leave(previousAreaRoom);
        socket.join(nextAreaRoom);
        joinedAreaRoom = nextAreaRoom;
      }

      if (joinedAreaRoom) {
        queuePresencePatch({
          roomId: joinedAreaRoom,
          patch: upsertPatch,
          ioInstance: io,
          cluster: realtimeCluster
        });
      } else {
        queuePresencePatch({
          roomId: joinedRoom,
          patch: upsertPatch,
          ioInstance: io,
          cluster: realtimeCluster
        });
      }

      if (previousAreaRoom && previousAreaRoom !== joinedAreaRoom) {
        queuePresencePatch({
          roomId: previousAreaRoom,
          patch: removePatch,
          ioInstance: io,
          cluster: realtimeCluster
        });
      }

      performanceService.recordSocketEvent({
        event: 'location:update',
        durationMs: performance.now() - startedAt,
        ok: true
      });
    } catch {
      performanceService.recordSocketEvent({
        event: 'location:update',
        durationMs: performance.now() - startedAt,
        ok: false
      });
    }
  });

  socket.on('playback:update', async ({ nowPlaying } = {}) => {
    const startedAt = performance.now();
    if (!joinedRoom || !joinedUserId) return;
    try {
      const playbackLimit = await socketRateLimiter.consume({
        key: `playback:${joinedUserId}`,
        limit: 30,
        windowSec: 30
      });
      if (!playbackLimit.allowed) return;

      const sanitizedNowPlaying = sanitizeNowPlayingPayload(nowPlaying);
      const presence = await realtimeCluster.updateNowPlaying(joinedRoom, joinedUserId, sanitizedNowPlaying, { publishPresence: false });
      if (!presence) return;
      const selfUser = toPresenceUserSummary(presence.find((user) => user?.id === joinedUserId));
      if (!selfUser) return;

      queuePresencePatch({
        roomId: joinedRoom,
        patch: { type: 'upsert', user: selfUser, at: Date.now() },
        ioInstance: io,
        cluster: realtimeCluster
      });

      performanceService.recordSocketEvent({
        event: 'playback:update',
        durationMs: performance.now() - startedAt,
        ok: true
      });
    } catch {
      performanceService.recordSocketEvent({
        event: 'playback:update',
        durationMs: performance.now() - startedAt,
        ok: false
      });
    }
  });

  socket.on('chat:message', async ({ text } = {}, ack) => {
    const startedAt = performance.now();
    if (!joinedRoom || !joinedUserId) return;
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) return;
    try {
      const chatLimit = await socketRateLimiter.consume({
        key: `chat:${joinedUserId}`,
        limit: 8,
        windowSec: 10
      });
      if (!chatLimit.allowed) {
        ack?.({ ok: false, error: 'Rate limit exceeded', retryAfterSec: chatLimit.retryAfterSec });
        return;
      }

      const message = {
        id: nanoid(12),
        userId: joinedUserId,
        name: joinedUserName || `User ${joinedUserId}`,
        text: normalized.slice(0, 500),
        createdAt: Date.now()
      };

      await realtimeCluster.appendMessage(joinedRoom, message);
      io.to(joinedRoom).emit('chat:new', message);
      ack?.({ ok: true, id: message.id });
      performanceService.recordSocketEvent({
        event: 'chat:message',
        durationMs: performance.now() - startedAt,
        ok: true
      });
    } catch {
      ack?.({ ok: false, error: 'Message failed' });
      performanceService.recordSocketEvent({
        event: 'chat:message',
        durationMs: performance.now() - startedAt,
        ok: false
      });
    }
  });

  socket.on('disconnect', async () => {
    const startedAt = performance.now();
    if (!joinedRoom || !joinedUserId) return;
    try {
      await realtimeCluster.removeUser(joinedRoom, joinedUserId, { publishPresence: false });
      const removePatch = { type: 'remove', userId: joinedUserId, at: Date.now() };
      if (joinedAreaRoom) {
        queuePresencePatch({
          roomId: joinedAreaRoom,
          patch: removePatch,
          ioInstance: io,
          cluster: realtimeCluster
        });
      } else {
        queuePresencePatch({
          roomId: joinedRoom,
          patch: removePatch,
          ioInstance: io,
          cluster: realtimeCluster
        });
      }
      performanceService.recordSocketEvent({
        event: 'disconnect',
        durationMs: performance.now() - startedAt,
        ok: true
      });
    } catch {
      performanceService.recordSocketEvent({
        event: 'disconnect',
        durationMs: performance.now() - startedAt,
        ok: false
      });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function shutdown() {
  for (const timer of presencePatchTimers.values()) {
    clearTimeout(timer);
  }
  presencePatchTimers.clear();
  presencePatchQueues.clear();
  await trendingPlaybackService.stopBackgroundWorker();
  await geolocationService.disconnect();
  await disconnectPrisma();
  await socketRateLimiter.stop();
  await realtimeCluster.stop();
  await redisService.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
