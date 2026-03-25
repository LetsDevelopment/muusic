export const USER_ROLE_OPTIONS = [
  { value: 'all', label: 'Todos os perfis' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'USER', label: 'Usuario' }
];

export const mockUsers = [
  { id: 'u-1', name: 'Marcelo Demari', email: 'marcelo.demari@leanwork.com.br', role: 'ADMIN', createdAt: '2026-02-10T09:10:00.000Z' },
  { id: 'u-2', name: 'Ana Luiza', email: 'ana.luiza@hotmail.com', role: 'USER', createdAt: '2026-02-09T14:22:00.000Z' },
  { id: 'u-3', name: 'Rafael Matos', email: 'rafael.matos@gmail.com', role: 'USER', createdAt: '2026-02-08T18:03:00.000Z' },
  { id: 'u-4', name: 'Sofia Brand', email: 'sofia@brandroom.app', role: 'USER', createdAt: '2026-02-06T11:32:00.000Z' },
  { id: 'u-5', name: 'Debora Reis', email: 'debora.reis@gmail.com', role: 'ADMIN', createdAt: '2026-02-03T19:05:00.000Z' }
];

export const DEFAULT_USERS_PAGE_SIZE = 8;

function getLatestMusicTimestamp(user) {
  const nowPlayingStartedAt = user?.music?.nowPlaying?.startedAt ? new Date(user.music.nowPlaying.startedAt).getTime() : 0;
  const latestHistoryPlayedAt = Array.isArray(user?.music?.musicHistory) && user.music.musicHistory.length > 0
    ? new Date(user.music.musicHistory[0]?.playedAt || 0).getTime()
    : 0;
  return Math.max(
    Number.isFinite(nowPlayingStartedAt) ? nowPlayingStartedAt : 0,
    Number.isFinite(latestHistoryPlayedAt) ? latestHistoryPlayedAt : 0
  );
}

function isUserActiveNow(user) {
  const expiresAt = user?.music?.nowPlaying?.expiresAt ? new Date(user.music.nowPlaying.expiresAt).getTime() : 0;
  if (!Number.isFinite(expiresAt) || !expiresAt) return false;
  return expiresAt > Date.now();
}

export function calculateUsersKpis(users) {
  const topMusicUser = users.reduce(
    (best, user) => {
      const count = Number(user?.music?.historyCount || 0);
      if (count > best.count) {
        return {
          name: user.name || user.email || 'Usuario',
          count
        };
      }
      return best;
    },
    { name: 'Sem dados', count: 0 }
  );

  return {
    total: users.length,
    admins: users.filter((user) => user.role === 'ADMIN').length,
    standard: users.filter((user) => user.role !== 'ADMIN').length,
    topMusicUser
  };
}

export function queryUsers({ users, search = '', role = 'all', page = 1, pageSize = DEFAULT_USERS_PAGE_SIZE }) {
  const term = search.trim().toLowerCase();

  const filtered = users
    .filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      if (!term) return true;
      return user.email.toLowerCase().includes(term) || String(user.name || '').toLowerCase().includes(term);
    })
    .sort((a, b) => {
      const activeDiff = Number(isUserActiveNow(b)) - Number(isUserActiveNow(a));
      if (activeDiff !== 0) return activeDiff;

      const latestMusicDiff = getLatestMusicTimestamp(b) - getLatestMusicTimestamp(a);
      if (latestMusicDiff !== 0) return latestMusicDiff;

      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page: safePage,
    totalPages
  };
}

export async function fetchUsersMock({ users = mockUsers, search, role, page, pageSize, shouldFail = false }) {
  await new Promise((resolve) => setTimeout(resolve, 360));
  if (shouldFail) {
    throw new Error('Nao foi possivel carregar usuarios.');
  }

  return {
    users,
    kpis: calculateUsersKpis(users),
    ...queryUsers({ users, search, role, page, pageSize })
  };
}

export async function fetchUsersFromApi({ apiFetch, search, role, page, pageSize }) {
  const payload = await apiFetch('/admin/users?page=1&limit=500');
  const users = Array.isArray(payload?.users) ? payload.users : [];
  return {
    users,
    kpis: calculateUsersKpis(users),
    ...queryUsers({ users, search, role, page, pageSize })
  };
}
