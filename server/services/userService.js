import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { getPrisma } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_USERS_PATH = path.join(__dirname, '..', 'data', 'local-users.json');

function parseUsersPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.users)) return payload.users;
  return [];
}

function sanitizeUsername(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function deriveUsername(name, email) {
  const fromName = sanitizeUsername(name);
  if (fromName.length >= 3) return fromName;
  const fromEmail = sanitizeUsername(String(email || '').split('@')[0]);
  if (fromEmail.length >= 3) return fromEmail;
  return `user_${Date.now().toString().slice(-6)}`;
}

function normalizeTrackKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatHistoryDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function buildHistoryCover(entry, index) {
  if (entry?.albumImageUrl) return entry.albumImageUrl;
  return `https://picsum.photos/seed/user-history-${index + 1}/200/200`;
}

function mapMusicHistoryEntry(entry, index = 0) {
  return {
    id: entry.id || `history-${index + 1}`,
    title: entry.trackName || 'Faixa desconhecida',
    artist: entry.artistName || 'Artista nao informado',
    date: formatHistoryDate(entry.playedAt || entry.createdAt || new Date()),
    cover: buildHistoryCover(entry, index),
    playedAt: entry.playedAt ? new Date(entry.playedAt).toISOString() : null,
    source: entry.source || 'spotify',
    bridgeMode: entry.bridgeMode || null,
    externalUrl: entry.externalUrl || null
  };
}

function formatBridgeDeviceSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    deviceName: session.deviceName || 'Dispositivo sem nome',
    platform: session.platform || null,
    createdAt: session.createdAt ? new Date(session.createdAt).toISOString() : null,
    lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
    revokedAt: session.revokedAt ? new Date(session.revokedAt).toISOString() : null
  };
}

function formatNowPlayingSnapshot(entry) {
  if (!entry) return null;
  return {
    trackId: entry.spotifyTrackId || null,
    trackName: entry.trackName || '',
    artistName: entry.artistName || '',
    albumImageUrl: entry.albumImageUrl || null,
    source: entry.source || 'spotify',
    bridgeMode: entry.bridgeMode || null,
    externalUrl: entry.externalUrl || null,
    latitude: typeof entry.latitude === 'number' ? entry.latitude : null,
    longitude: typeof entry.longitude === 'number' ? entry.longitude : null,
    startedAt: entry.startedAt ? new Date(entry.startedAt).toISOString() : null,
    expiresAt: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null
  };
}

function buildMusicProfileFromEntries(entries = [], recentLimit = 6) {
  const musicHistory = entries.map((entry, index) => mapMusicHistoryEntry(entry, index));
  const recentTracks = entries
    .map((entry) => entry?.trackName || '')
    .filter(Boolean)
    .filter((track, index, array) => array.indexOf(track) === index)
    .slice(0, recentLimit);

  return {
    recentTracks,
    musicHistory
  };
}

class UserService {
  constructor() {
    this.localUsersCache = null;
    this.localUsersCacheLoadedAt = 0;
    this.localUsersCacheTtlMs = Number(process.env.LOCAL_USERS_CACHE_TTL_MS || 5000);
    this.bridgeDeviceSessions = new Map();
  }

  async readJSON() {
    const now = Date.now();
    if (this.localUsersCache && now - this.localUsersCacheLoadedAt < this.localUsersCacheTtlMs) {
      return this.localUsersCache;
    }
    try {
      const raw = await fs.readFile(LOCAL_USERS_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      const users = parseUsersPayload(parsed);
      this.localUsersCache = users;
      this.localUsersCacheLoadedAt = now;
      return users;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async writeJSON(users) {
    await fs.mkdir(path.dirname(LOCAL_USERS_PATH), { recursive: true });
    await fs.writeFile(LOCAL_USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
    this.localUsersCache = Array.isArray(users) ? users : [];
    this.localUsersCacheLoadedAt = Date.now();
  }

  toAppUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.displayName || user.name || user.username || 'Usuario',
      username: user.username,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      avatarUrl: user.avatarUrl || null,
      spotifyId: user.spotifyId || null,
      spotifyBridgeConnectedAt: user.spotifyBridgeConnectedAt
        ? new Date(user.spotifyBridgeConnectedAt).toISOString()
        : null,
      recentTracks: Array.isArray(user.recentTracks) ? user.recentTracks : [],
      musicHistory: Array.isArray(user.musicHistory) ? user.musicHistory : [],
      passwordHash: user.passwordHash,
      createdAt: user.createdAt
    };
  }

  async ensureUniqueUsername(baseUsername, prismaClient) {
    let attempt = sanitizeUsername(baseUsername);
    if (!attempt) attempt = `user_${Date.now().toString().slice(-6)}`;

    for (let i = 0; i < 50; i += 1) {
      const candidate = i === 0 ? attempt : `${attempt}_${i}`;
      if (prismaClient) {
        const existing = await prismaClient.user.findUnique({ where: { username: candidate } });
        if (!existing) return candidate;
      } else {
        const users = await this.readJSON();
        if (!users.some((user) => user.username === candidate)) return candidate;
      }
    }
    return `${attempt}_${Date.now().toString().slice(-4)}`;
  }

  async createUser(data) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const username = await this.ensureUniqueUsername(data.username || deriveUsername(data.displayName || data.name, data.email), prismaClient);
      const created = await prismaClient.user.create({
        data: {
          email: data.email,
          username,
          role: data.role === 'ADMIN' ? 'ADMIN' : 'USER',
          passwordHash: data.passwordHash,
          displayName: data.displayName || data.name || null,
          avatarUrl: data.avatarUrl || null,
          spotifyId: data.spotifyId || null,
          spotifyBridgeKey: data.spotifyBridgeKey || null,
          spotifyBridgeConnectedAt: data.spotifyBridgeConnectedAt ? new Date(data.spotifyBridgeConnectedAt) : null
        }
      });
      return this.toAppUser(created);
    }

    const users = await this.readJSON();
    const username = await this.ensureUniqueUsername(data.username || deriveUsername(data.displayName || data.name, data.email), null);
    const user = {
      id: data.id || `u-${Date.now()}`,
      name: data.name || data.displayName || username,
      username,
      email: data.email,
      role: data.role === 'ADMIN' ? 'ADMIN' : 'USER',
      passwordHash: data.passwordHash,
      spotifyId: data.spotifyId || null,
      spotifyBridgeKey: data.spotifyBridgeKey || null,
      spotifyBridgeConnectedAt: data.spotifyBridgeConnectedAt || null,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await this.writeJSON(users);
    return this.toAppUser(user);
  }

  async findByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const user = await prismaClient.user.findUnique({ where: { email: normalized } });
      return this.toAppUser(user);
    }

    const users = await this.readJSON();
    const found = users.find((user) => user.email === normalized);
    return this.toAppUser(found);
  }

  async findById(id) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const user = await prismaClient.user.findUnique({ where: { id } });
      return this.toAppUser(user);
    }
    const users = await this.readJSON();
    const found = users.find((user) => user.id === id);
    return this.toAppUser(found);
  }

  async listUsers(options = {}) {
    const page = Number.isFinite(Number(options.page)) ? Math.max(1, Number(options.page)) : 1;
    const limit = Number.isFinite(Number(options.limit)) ? Math.min(200, Math.max(1, Number(options.limit))) : 50;
    const search = String(options.search || '').trim();
    const skip = (page - 1) * limit;

    const prismaClient = await getPrisma();
    if (prismaClient) {
      const where = search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } }
            ]
          }
        : undefined;

      const [users, total] = await Promise.all([
        prismaClient.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prismaClient.user.count({ where })
      ]);

      return {
        items: users.map((user) => this.toAppUser(user)),
        total,
        page,
        limit
      };
    }

    const users = await this.readJSON();
    const normalizedSearch = search.toLowerCase();
    const filtered = users
      .slice()
      .filter((user) => {
        if (!normalizedSearch) return true;
        const haystack = `${user.email || ''} ${user.username || ''} ${user.name || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map((user) => this.toAppUser(user));

    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);
    return {
      items,
      total,
      page,
      limit
    };
  }

  async listUsersCursor(options = {}) {
    const limit = Number.isFinite(Number(options.limit)) ? Math.min(500, Math.max(1, Number(options.limit))) : 200;
    const cursor = String(options.cursor || '').trim() || null;
    const search = String(options.search || '').trim();

    const prismaClient = await getPrisma();
    if (prismaClient) {
      const where = search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } }
            ]
          }
        : undefined;

      const rows = await prismaClient.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          displayName: true,
          avatarUrl: true,
          passwordHash: true,
          createdAt: true
        },
        orderBy: { id: 'asc' },
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        take: limit + 1
      });

      const hasMore = rows.length > limit;
      const slice = hasMore ? rows.slice(0, limit) : rows;
      return {
        items: slice.map((row) => this.toAppUser(row)),
        nextCursor: hasMore ? slice[slice.length - 1]?.id || null : null,
        hasMore
      };
    }

    const users = await this.readJSON();
    const normalizedSearch = search.toLowerCase();
    const filtered = users
      .slice()
      .filter((user) => {
        if (!normalizedSearch) return true;
        const haystack = `${user.email || ''} ${user.username || ''} ${user.name || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));

    let startIndex = 0;
    if (cursor) {
      const idx = filtered.findIndex((user) => user.id === cursor);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const chunk = filtered.slice(startIndex, startIndex + limit + 1);
    const hasMore = chunk.length > limit;
    const slice = hasMore ? chunk.slice(0, limit) : chunk;
    return {
      items: slice.map((user) => this.toAppUser(user)),
      nextCursor: hasMore ? slice[slice.length - 1]?.id || null : null,
      hasMore
    };
  }

  async countUsers() {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      return prismaClient.user.count();
    }
    const users = await this.readJSON();
    return users.length;
  }

  async updateUserById(id, data) {
    const prismaClient = await getPrisma();
    const nextRole = data.role === 'ADMIN' ? 'ADMIN' : data.role === 'USER' ? 'USER' : undefined;

    if (prismaClient) {
      const payload = {};
      if (typeof data.email === 'string') payload.email = data.email;
      if (typeof data.displayName === 'string') payload.displayName = data.displayName;
      if (typeof data.avatarUrl === 'string' || data.avatarUrl === null) payload.avatarUrl = data.avatarUrl;
      if (typeof data.passwordHash === 'string') payload.passwordHash = data.passwordHash;
      if (typeof data.spotifyId === 'string' || data.spotifyId === null) payload.spotifyId = data.spotifyId;
      if (typeof data.spotifyBridgeKey === 'string' || data.spotifyBridgeKey === null) payload.spotifyBridgeKey = data.spotifyBridgeKey;
      if (data.spotifyBridgeConnectedAt instanceof Date) payload.spotifyBridgeConnectedAt = data.spotifyBridgeConnectedAt;
      else if (typeof data.spotifyBridgeConnectedAt === 'string') payload.spotifyBridgeConnectedAt = new Date(data.spotifyBridgeConnectedAt);
      else if (data.spotifyBridgeConnectedAt === null) payload.spotifyBridgeConnectedAt = null;
      if (typeof nextRole === 'string') payload.role = nextRole;

      const updated = await prismaClient.user.update({
        where: { id },
        data: payload
      });
      return this.toAppUser(updated);
    }

    const users = await this.readJSON();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) return null;

    if (typeof data.email === 'string') users[index].email = data.email;
    if (typeof data.displayName === 'string') users[index].name = data.displayName;
    if (typeof data.avatarUrl === 'string' || data.avatarUrl === null) users[index].avatarUrl = data.avatarUrl;
    if (typeof data.passwordHash === 'string') users[index].passwordHash = data.passwordHash;
    if (typeof data.spotifyId === 'string' || data.spotifyId === null) users[index].spotifyId = data.spotifyId;
    if (typeof data.spotifyBridgeKey === 'string' || data.spotifyBridgeKey === null) users[index].spotifyBridgeKey = data.spotifyBridgeKey;
    if (data.spotifyBridgeConnectedAt instanceof Date) users[index].spotifyBridgeConnectedAt = data.spotifyBridgeConnectedAt.toISOString();
    else if (typeof data.spotifyBridgeConnectedAt === 'string' || data.spotifyBridgeConnectedAt === null) users[index].spotifyBridgeConnectedAt = data.spotifyBridgeConnectedAt;
    if (typeof nextRole === 'string') users[index].role = nextRole;

    await this.writeJSON(users);
    return this.toAppUser(users[index]);
  }

  async deleteUserById(id) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const deleted = await prismaClient.user.delete({ where: { id } });
      return this.toAppUser(deleted);
    }

    const users = await this.readJSON();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) return null;
    const [deleted] = users.splice(index, 1);
    await this.writeJSON(users);
    return this.toAppUser(deleted);
  }

  async updatePasswordById(id, passwordHash) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const updated = await prismaClient.user.update({
        where: { id },
        data: { passwordHash }
      });
      return this.toAppUser(updated);
    }

    const users = await this.readJSON();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) return null;
    users[index].passwordHash = passwordHash;
    await this.writeJSON(users);
    return this.toAppUser(users[index]);
  }

  async getSpotifyBridgeByUserId(id) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const user = await prismaClient.user.findUnique({
        where: { id },
        select: {
          spotifyBridgeKey: true,
          spotifyBridgeConnectedAt: true
        }
      });
      if (!user) return null;
      return {
        key: user.spotifyBridgeKey || null,
        connectedAt: user.spotifyBridgeConnectedAt ? new Date(user.spotifyBridgeConnectedAt).toISOString() : null
      };
    }

    const users = await this.readJSON();
    const user = users.find((item) => item.id === id);
    if (!user) return null;
    return {
      key: user.spotifyBridgeKey || null,
      connectedAt: user.spotifyBridgeConnectedAt || null
    };
  }

  async createBridgeDeviceSession({ userId, deviceName, platform, tokenHash }) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      return prismaClient.bridgeDeviceSession.create({
        data: {
          userId,
          deviceName: deviceName || null,
          platform: platform || null,
          tokenHash
        }
      });
    }

    const id = `bridge-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const record = {
      id,
      userId,
      deviceName: deviceName || null,
      platform: platform || null,
      tokenHash,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null
    };
    this.bridgeDeviceSessions.set(id, record);
    return record;
  }

  async findBridgeDeviceSessionByTokenHash(tokenHash) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      return prismaClient.bridgeDeviceSession.findFirst({
        where: {
          tokenHash,
          revokedAt: null
        }
      });
    }

    return Array.from(this.bridgeDeviceSessions.values()).find(
      (item) => item.tokenHash === tokenHash && !item.revokedAt
    ) || null;
  }

  async touchBridgeDeviceSession(id) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      return prismaClient.bridgeDeviceSession.update({
        where: { id },
        data: { lastSeenAt: new Date() }
      });
    }

    const record = this.bridgeDeviceSessions.get(id);
    if (!record) return null;
    record.lastSeenAt = new Date().toISOString();
    this.bridgeDeviceSessions.set(id, record);
    return record;
  }

  async listBridgeDeviceSessionsByUserId(userId) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      return prismaClient.bridgeDeviceSession.findMany({
        where: {
          userId,
          revokedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    return Array.from(this.bridgeDeviceSessions.values())
      .filter((item) => item.userId === userId && !item.revokedAt)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  async revokeBridgeDeviceSession({ id, userId }) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      return prismaClient.bridgeDeviceSession.updateMany({
        where: {
          id,
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    const record = this.bridgeDeviceSessions.get(id);
    if (!record || record.userId !== userId || record.revokedAt) return null;
    record.revokedAt = new Date().toISOString();
    this.bridgeDeviceSessions.set(id, record);
    return record;
  }

  async getUserMusicProfile(userId, { limit = 12, recentLimit = 6 } = {}) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const rows = await prismaClient.userMusicHistory.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        take: limit
      });
      return buildMusicProfileFromEntries(rows, recentLimit);
    }

    const users = await this.readJSON();
    const user = users.find((item) => item.id === userId);
    const rows = Array.isArray(user?.musicHistory)
      ? user.musicHistory
          .slice()
          .sort((a, b) => String(b.playedAt || '').localeCompare(String(a.playedAt || '')))
          .slice(0, limit)
      : [];
    return buildMusicProfileFromEntries(rows, recentLimit);
  }

  async getAdminMusicSnapshotByUserIds(userIds = [], { historyLimit = 20, recentLimit = 6 } = {}) {
    const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (ids.length === 0) return new Map();

    const prismaClient = await getPrisma();
    if (prismaClient) {
      const [users, nowPlayingRows, historyRows, deviceRows, historyCounts] = await Promise.all([
        prismaClient.user.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            spotifyId: true,
            spotifyBridgeConnectedAt: true
          }
        }),
        prismaClient.nowPlaying.findMany({
          where: { userId: { in: ids } }
        }),
        prismaClient.userMusicHistory.findMany({
          where: { userId: { in: ids } },
          orderBy: { playedAt: 'desc' }
        }),
        prismaClient.bridgeDeviceSession.findMany({
          where: {
            userId: { in: ids },
            revokedAt: null
          },
          orderBy: { lastSeenAt: 'desc' }
        }),
        prismaClient.userMusicHistory.groupBy({
          by: ['userId'],
          where: { userId: { in: ids } },
          _count: {
            _all: true
          }
        })
      ]);

      const usersById = new Map(users.map((user) => [user.id, user]));
      const nowPlayingByUserId = new Map(nowPlayingRows.map((row) => [row.userId, row]));
      const historyByUserId = new Map();
      for (const row of historyRows) {
        const bucket = historyByUserId.get(row.userId) || [];
        if (bucket.length < historyLimit) bucket.push(row);
        historyByUserId.set(row.userId, bucket);
      }
      const devicesByUserId = new Map();
      for (const row of deviceRows) {
        const bucket = devicesByUserId.get(row.userId) || [];
        bucket.push(formatBridgeDeviceSession(row));
        devicesByUserId.set(row.userId, bucket);
      }
      const historyCountByUserId = new Map(historyCounts.map((row) => [row.userId, row._count?._all || 0]));

      return new Map(
        ids.map((id) => {
          const user = usersById.get(id);
          const history = historyByUserId.get(id) || [];
          const profile = buildMusicProfileFromEntries(history, recentLimit);
          return [
            id,
            {
              spotifyId: user?.spotifyId || null,
              spotifyBridgeConnectedAt: user?.spotifyBridgeConnectedAt
                ? new Date(user.spotifyBridgeConnectedAt).toISOString()
                : null,
              nowPlaying: formatNowPlayingSnapshot(nowPlayingByUserId.get(id) || null),
              recentTracks: profile.recentTracks,
              musicHistory: profile.musicHistory,
              historyCount: historyCountByUserId.get(id) || 0,
              bridgeDevices: devicesByUserId.get(id) || []
            }
          ];
        })
      );
    }

    const users = await this.readJSON();
    const usersById = new Map(users.map((user) => [user.id, user]));
    return new Map(
      ids.map((id) => {
        const user = usersById.get(id);
        const historyRows = Array.isArray(user?.musicHistory)
          ? user.musicHistory
              .slice()
              .sort((a, b) => String(b.playedAt || '').localeCompare(String(a.playedAt || '')))
              .slice(0, historyLimit)
          : [];
        const fullHistoryCount = Array.isArray(user?.musicHistory) ? user.musicHistory.length : 0;
        const profile = buildMusicProfileFromEntries(historyRows, recentLimit);
        return [
          id,
          {
            spotifyId: user?.spotifyId || null,
            spotifyBridgeConnectedAt: user?.spotifyBridgeConnectedAt || null,
            nowPlaying: formatNowPlayingSnapshot(user?.nowPlayingRecord || null),
            recentTracks: profile.recentTracks,
            musicHistory: profile.musicHistory,
            historyCount: fullHistoryCount,
            bridgeDevices: []
          }
        ];
      })
    );
  }

  async upsertNowPlayingForUser({ userId, trackId, trackName, artistName, albumImageUrl, source, bridgeMode, externalUrl, latitude = null, longitude = null }) {
    const safeTrackName = String(trackName || '').trim();
    const safeArtistName = String(artistName || '').trim();
    if (!safeTrackName && !safeArtistName) return null;

    const prismaClient = await getPrisma();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    if (prismaClient) {
      return prismaClient.nowPlaying.upsert({
        where: { userId },
        update: {
          spotifyTrackId: trackId || null,
          trackName: safeTrackName,
          artistName: safeArtistName,
          albumImageUrl: albumImageUrl || null,
          source: source || 'spotify',
          bridgeMode: bridgeMode || null,
          externalUrl: externalUrl || null,
          latitude,
          longitude,
          startedAt: new Date(),
          expiresAt
        },
        create: {
          userId,
          spotifyTrackId: trackId || null,
          trackName: safeTrackName,
          artistName: safeArtistName,
          albumImageUrl: albumImageUrl || null,
          source: source || 'spotify',
          bridgeMode: bridgeMode || null,
          externalUrl: externalUrl || null,
          latitude,
          longitude,
          expiresAt
        }
      });
    }

    const users = await this.readJSON();
    const index = users.findIndex((item) => item.id === userId);
    if (index === -1) return null;
    users[index].nowPlayingRecord = {
      spotifyTrackId: trackId || null,
      trackName: safeTrackName,
      artistName: safeArtistName,
      albumImageUrl: albumImageUrl || null,
      source: source || 'spotify',
      bridgeMode: bridgeMode || null,
      externalUrl: externalUrl || null,
      latitude,
      longitude,
      startedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    await this.writeJSON(users);
    return users[index].nowPlayingRecord;
  }

  async clearNowPlayingForUser(userId) {
    const prismaClient = await getPrisma();
    if (prismaClient) {
      await prismaClient.nowPlaying.deleteMany({ where: { userId } });
      return;
    }

    const users = await this.readJSON();
    const index = users.findIndex((item) => item.id === userId);
    if (index === -1) return;
    delete users[index].nowPlayingRecord;
    await this.writeJSON(users);
  }

  async recordUserMusicHistory({ userId, trackId, trackName, artistName, albumImageUrl, source, bridgeMode, externalUrl, playedAt = new Date() }) {
    const safeTrackName = String(trackName || '').trim();
    const safeArtistName = String(artistName || '').trim();
    if (!safeTrackName && !safeArtistName) return null;

    const normalizedTrackKey = normalizeTrackKey(trackId || safeTrackName);
    const normalizedArtistKey = normalizeTrackKey(safeArtistName);
    const compareThreshold = Date.now() - 15 * 60 * 1000;
    const prismaClient = await getPrisma();
    if (prismaClient) {
      const latest = await prismaClient.userMusicHistory.findFirst({
        where: { userId },
        orderBy: { playedAt: 'desc' }
      });

      const sameAsLatest =
        latest &&
        normalizeTrackKey(latest.spotifyTrackId || latest.trackName) === normalizedTrackKey &&
        normalizeTrackKey(latest.artistName) === normalizedArtistKey &&
        Number(new Date(latest.playedAt).getTime()) >= compareThreshold;

      if (sameAsLatest) {
        return prismaClient.userMusicHistory.update({
          where: { id: latest.id },
          data: {
            playedAt: playedAt instanceof Date ? playedAt : new Date(playedAt),
            albumImageUrl: albumImageUrl || latest.albumImageUrl || null,
            source: source || latest.source || 'spotify',
            bridgeMode: bridgeMode || latest.bridgeMode || null,
            externalUrl: externalUrl || latest.externalUrl || null
          }
        });
      }

      return prismaClient.userMusicHistory.create({
        data: {
          userId,
          spotifyTrackId: trackId || null,
          trackName: safeTrackName,
          artistName: safeArtistName,
          albumImageUrl: albumImageUrl || null,
          source: source || 'spotify',
          bridgeMode: bridgeMode || null,
          externalUrl: externalUrl || null,
          playedAt: playedAt instanceof Date ? playedAt : new Date(playedAt)
        }
      });
    }

    const users = await this.readJSON();
    const index = users.findIndex((item) => item.id === userId);
    if (index === -1) return null;
    const history = Array.isArray(users[index].musicHistory) ? users[index].musicHistory.slice() : [];
    const latest = history[0] || null;
    const sameAsLatest =
      latest &&
      normalizeTrackKey(latest.spotifyTrackId || latest.trackName) === normalizedTrackKey &&
      normalizeTrackKey(latest.artistName) === normalizedArtistKey &&
      Number(new Date(latest.playedAt).getTime()) >= compareThreshold;

    if (sameAsLatest) {
      latest.playedAt = playedAt instanceof Date ? playedAt.toISOString() : new Date(playedAt).toISOString();
      latest.albumImageUrl = albumImageUrl || latest.albumImageUrl || null;
      latest.source = source || latest.source || 'spotify';
      latest.bridgeMode = bridgeMode || latest.bridgeMode || null;
      latest.externalUrl = externalUrl || latest.externalUrl || null;
      history[0] = latest;
    } else {
      history.unshift({
        id: `history-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        spotifyTrackId: trackId || null,
        trackName: safeTrackName,
        artistName: safeArtistName,
        albumImageUrl: albumImageUrl || null,
        source: source || 'spotify',
        bridgeMode: bridgeMode || null,
        externalUrl: externalUrl || null,
        playedAt: playedAt instanceof Date ? playedAt.toISOString() : new Date(playedAt).toISOString(),
        createdAt: new Date().toISOString()
      });
    }

    users[index].musicHistory = history.slice(0, 50);
    await this.writeJSON(users);
    return users[index].musicHistory[0];
  }
}

const userService = new UserService();
export default userService;
