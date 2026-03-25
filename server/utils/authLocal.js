import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash).split(':');
  if (!salt || !key) return false;
  const hashBuffer = Buffer.from(key, 'hex');
  const candidate = scryptSync(password, salt, 64);
  if (hashBuffer.length !== candidate.length) return false;
  return timingSafeEqual(hashBuffer, candidate);
}

export function issueLocalAuthToken(user, sessionId, jwtSecret) {
  return jwt.sign(
    {
      type: 'local-auth',
      sessionId,
      userId: user.id,
      name: user.name || user.displayName || user.username || 'Usuario',
      email: user.email,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'USER'
    },
    jwtSecret,
    { expiresIn: '8h' }
  );
}

export function sanitizeRole(rawRole) {
  return rawRole === 'ADMIN' ? 'ADMIN' : 'USER';
}

export function sanitizeUserResponse(user) {
  return {
    id: user.id,
    name: user.name || user.displayName || user.username || 'Usuario',
    email: user.email,
    role: sanitizeRole(user.role),
    avatarUrl: user.avatarUrl || null,
    spotifyBridgeConnectedAt: user.spotifyBridgeConnectedAt || null
  };
}

export async function determineRoleForNewUser(email, adminEmails, userService) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (adminEmails.has(normalizedEmail)) return 'ADMIN';
  const totalUsers = await userService.countUsers();
  return totalUsers === 0 ? 'ADMIN' : 'USER';
}
