import { Router } from 'express';
import { parseAdminUserInput, parseAdminUserPatchInput } from '../utils/routeSchemas.js';

export function createAdminRouter({
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
}) {
  const router = Router();

  router.get('/admin/users', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const { page, limit, search } = parseListQuery(req.query || {});
      const result = await userService.listUsers({ page, limit, search });
      const musicSnapshots = await userService.getAdminMusicSnapshotByUserIds(
        result.items.map((user) => user.id),
        { historyLimit: 20, recentLimit: 6 }
      );
      return res.json({
        users: result.items.map((user) => ({
          id: user.id,
          name: user.name || user.username || 'Usuario',
          email: user.email,
          role: sanitizeRole(user.role),
          createdAt: user.createdAt || null,
          music: musicSnapshots.get(user.id) || {
            spotifyId: user.spotifyId || null,
            spotifyBridgeConnectedAt: user.spotifyBridgeConnectedAt || null,
            nowPlaying: null,
            recentTracks: [],
            musicHistory: [],
            historyCount: 0,
            bridgeDevices: []
          }
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total
        }
      });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao listar usuarios: ${error.message}` });
    }
  });

  router.post('/admin/users', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;

      const parsed = parseAdminUserInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const existingUser = await userService.findByEmail(parsed.email);
      if (existingUser) {
        return res.status(409).json({ error: 'E-mail ja cadastrado.' });
      }

      const user = await userService.createUser({
        id: `u-${Date.now()}-${nanoid(6)}`,
        email: parsed.email,
        name: parsed.name,
        displayName: parsed.name,
        role: sanitizeRole(parsed.role),
        passwordHash: hashPassword(parsed.password)
      });

      return res.status(201).json({ user: sanitizeUserResponse(user) });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao criar usuario: ${error.message}` });
    }
  });

  router.patch('/admin/users/:id', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;

      const userId = String(req.params.id || '').trim();
      if (!userId) return res.status(400).json({ error: 'ID de usuario invalido.' });

      const parsed = parseAdminUserPatchInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const existingByEmail = await userService.findByEmail(parsed.email);
      if (existingByEmail && existingByEmail.id !== userId) {
        return res.status(409).json({ error: 'E-mail ja cadastrado para outro usuario.' });
      }

      const userToUpdate = await userService.findById(userId);
      if (!userToUpdate) {
        return res.status(404).json({ error: 'Usuario nao encontrado.' });
      }

      const role = parsed.role ? sanitizeRole(parsed.role) : undefined;
      if (userToUpdate.id === auth.user.id && role === 'USER') {
        return res.status(400).json({ error: 'Nao e permitido remover seu proprio acesso admin.' });
      }

      const updated = await userService.updateUserById(userId, {
        email: parsed.email,
        displayName: parsed.name,
        role,
        passwordHash: parsed.password ? hashPassword(parsed.password) : undefined
      });
      return res.json({ user: sanitizeUserResponse(updated) });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao atualizar usuario: ${error.message}` });
    }
  });

  router.delete('/admin/users/:id', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const userId = String(req.params.id || '').trim();
      if (!userId) return res.status(400).json({ error: 'ID de usuario invalido.' });
      if (userId === auth.user.id) {
        return res.status(400).json({ error: 'Nao e permitido excluir seu proprio usuario admin.' });
      }

      const deleted = await userService.deleteUserById(userId);
      if (!deleted) return res.status(404).json({ error: 'Usuario nao encontrado.' });
      await sessionService.destroyByUserId(userId);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao excluir usuario: ${error.message}` });
    }
  });

  router.get('/admin/shows', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const { page, limit, search } = parseListQuery(req.query || {});
      const city = String(req.query?.city || '').trim();
      const upcomingOnly = String(req.query?.upcomingOnly || 'false') === 'true';
      const result = await showService.listShows({ page, limit, search, city, upcomingOnly });
      return res.json({
        shows: result.items.map((show) => sanitizeShowResponse(show)).filter(Boolean),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total
        }
      });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao listar shows: ${error.message}` });
    }
  });

  router.get('/admin/trendings', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const days = Number(req.query?.days);
      const limit = Number(req.query?.limit);
      const snapshot = await trendingPlaybackService.getSnapshot({ days, limit });
      return res.json(snapshot);
    } catch (error) {
      return res.status(500).json({ error: `Erro ao carregar trendings: ${error.message}` });
    }
  });

  router.get('/admin/performance', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const snapshot = performanceService.getSnapshot();
      return res.json(snapshot);
    } catch (error) {
      return res.status(500).json({ error: `Erro ao carregar performance: ${error.message}` });
    }
  });

  router.post('/admin/shows', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const payload = parseShowPayload(req.body);
      if (payload.error) return res.status(400).json({ error: payload.error });
      const show = await showService.createShow(payload);
      await showCacheService.invalidateShowsCache();
      const sanitizedShow = sanitizeShowResponse(show);
      io.emit('shows:changed', { type: 'created', showId: show.id, show: sanitizedShow });
      return res.status(201).json({ show: sanitizedShow });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao criar show: ${error.message}` });
    }
  });

  router.patch('/admin/shows/:id', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const showId = String(req.params.id || '').trim();
      if (!showId) return res.status(400).json({ error: 'ID de show invalido.' });

      const payload = parseShowPayload(req.body);
      if (payload.error) return res.status(400).json({ error: payload.error });

      const updated = await showService.updateShowById(showId, payload);
      if (!updated) return res.status(404).json({ error: 'Show nao encontrado.' });

      await showCacheService.invalidateShowsCache();
      const sanitizedShow = sanitizeShowResponse(updated);
      io.emit('shows:changed', { type: 'updated', showId: updated.id, show: sanitizedShow });
      return res.json({ show: sanitizedShow });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao atualizar show: ${error.message}` });
    }
  });

  router.delete('/admin/shows/:id', async (req, res) => {
    try {
      const auth = await requireAdmin(req, res);
      if (!auth) return undefined;
      const showId = String(req.params.id || '').trim();
      if (!showId) return res.status(400).json({ error: 'ID de show invalido.' });

      const deleted = await showService.deleteShowById(showId);
      if (!deleted) return res.status(404).json({ error: 'Show nao encontrado.' });

      await showCacheService.invalidateShowsCache();
      io.emit('shows:changed', { type: 'deleted', showId });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao excluir show: ${error.message}` });
    }
  });

  return router;
}
