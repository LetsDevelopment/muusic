import { Router } from 'express';
import {
  parseAccountSettingsInput,
  parseChangePasswordInput,
  parseForgotPasswordInput,
  parseLoginInput,
  parseRegisterInput,
  parseResetPasswordInput,
  parseTrendingPlaybackInput
} from '../utils/routeSchemas.js';

export function createLocalAuthRouter({
  jwtSecret,
  nanoid,
  adminEmails,
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
}) {
  const router = Router();

  async function serializeUser(user) {
    const musicProfile = user?.id ? await userService.getUserMusicProfile(user.id) : { recentTracks: [], musicHistory: [] };
    return {
      ...sanitizeUserResponse(user),
      recentTracks: musicProfile.recentTracks,
      musicHistory: musicProfile.musicHistory
    };
  }

  router.post('/auth/local/register', async (req, res) => {
    try {
      const parsed = parseRegisterInput(req.body);
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
        role: await determineRoleForNewUser(parsed.email, adminEmails, userService),
        passwordHash: hashPassword(parsed.password)
      });

      const sessionId = await sessionService.create(user.id);
      const token = issueLocalAuthToken(user, sessionId, jwtSecret);
      return res.status(201).json({
        token,
        sessionId,
        user: await serializeUser(user)
      });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao registrar: ${error.message}` });
    }
  });

  router.post('/auth/local/login', async (req, res) => {
    try {
      const parsed = parseLoginInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const normalizedEmail = String(parsed.email || '').trim().toLowerCase();
      let user = await userService.findByEmail(normalizedEmail);
      if (!user || !verifyPassword(parsed.password, user.passwordHash)) {
        return res.status(401).json({ error: 'Credenciais invalidas.' });
      }

      if (adminEmails.has(normalizedEmail) && user.role !== 'ADMIN') {
        user = await userService.updateUserById(user.id, { role: 'ADMIN' });
      }

      const sessionId = await sessionService.create(user.id);
      const token = issueLocalAuthToken(user, sessionId, jwtSecret);
      return res.json({
        token,
        sessionId,
        user: await serializeUser(user)
      });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao autenticar: ${error.message}` });
    }
  });

  router.post('/auth/local/forgot-password', async (req, res) => {
    try {
      const parsed = parseForgotPasswordInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const user = await userService.findByEmail(parsed.email);
      if (!user) {
        return res.json({
          ok: true,
          message: 'Se o e-mail existir, enviaremos instrucoes de recuperacao.'
        });
      }

      await passwordResetService.deleteByUserId(user.id);
      const { token } = await passwordResetService.issue(user.id);
      const response = {
        ok: true,
        message: 'Se o e-mail existir, enviaremos instrucoes de recuperacao.'
      };
      if (!isProduction) response.resetToken = token;
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: `Erro ao processar recuperacao: ${error.message}` });
    }
  });

  router.post('/auth/local/reset-password', async (req, res) => {
    try {
      const parsed = parseResetPasswordInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const payload = await passwordResetService.consume(parsed.token);
      if (!payload?.userId) {
        return res.status(400).json({ error: 'Token de recuperacao invalido ou expirado.' });
      }

      await userService.updatePasswordById(payload.userId, hashPassword(parsed.password));
      await sessionService.destroyByUserId(payload.userId);
      return res.json({ ok: true, message: 'Senha atualizada com sucesso.' });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao redefinir senha: ${error.message}` });
    }
  });

  router.post('/auth/local/change-password', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const parsed = parseChangePasswordInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (!verifyPassword(parsed.currentPassword, auth.user.passwordHash)) {
        return res.status(401).json({ error: 'Senha atual invalida.' });
      }

      await userService.updatePasswordById(auth.user.id, hashPassword(parsed.newPassword));
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao alterar senha: ${error.message}` });
    }
  });

  router.get('/auth/local/me', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });
      return res.json({
        user: await serializeUser(auth.user),
        sessionId: auth.sessionId
      });
    } catch {
      return res.status(401).json({ error: 'Sessao invalida.' });
    }
  });

  router.get('/auth/local/account-settings', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });
      const settings = await accountSettingsService.getByUserId(auth.user.id);
      return res.json({
        settings,
        avatarUrl: auth.user.avatarUrl || null
      });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao carregar configuracoes: ${error.message}` });
    }
  });

  router.patch('/auth/local/account-settings', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const parsed = parseAccountSettingsInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const settings = await accountSettingsService.updateByUserId(auth.user.id, {
        city: parsed.city,
        bio: parsed.bio,
        locationEnabled: parsed.locationEnabled,
        showMusicHistory: parsed.showMusicHistory,
        cityCenterLat: parsed.cityCenterLat,
        cityCenterLng: parsed.cityCenterLng
      });

      if (typeof req.body?.avatarUrl === 'string' || req.body?.avatarUrl === null) {
        await userService.updateUserById(auth.user.id, {
          avatarUrl: parsed.avatarUrl || null
        });
      }

      const updatedUser = await userService.findById(auth.user.id);
      return res.json({
        settings,
        avatarUrl: updatedUser?.avatarUrl || null
      });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao salvar configuracoes: ${error.message}` });
    }
  });

  router.post('/api/trendings/playback', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const parsed = parseTrendingPlaybackInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (!parsed.isPlaying) return res.json({ ok: true, recorded: false, reason: 'not-playing' });

      const result = await trendingPlaybackService.enqueuePlayback({
        userId: auth.user.id,
        artistId: parsed.artistId,
        artistName: parsed.artistName,
        trackId: parsed.trackId,
        trackName: parsed.trackName,
        timestamp: parsed.timestamp,
        isPlaying: true
      });
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({ error: `Erro ao registrar reproducao: ${error.message}` });
    }
  });

  router.post('/auth/local/logout', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) {
        const sessionId = String(req.headers['x-session-id'] || req.body?.sessionId || '');
        if (sessionId) await sessionService.destroy(sessionId);
        return res.json({ ok: true });
      }
      await sessionService.destroy(auth.sessionId);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Falha ao encerrar sessao.' });
    }
  });

  return router;
}
