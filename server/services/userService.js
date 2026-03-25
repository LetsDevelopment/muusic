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
}

const userService = new UserService();
export default userService;
