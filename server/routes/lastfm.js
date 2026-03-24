import { Router } from 'express';
import jwt from 'jsonwebtoken';

export function createLastFmRouter({
  jwtSecret,
  frontendUrl,
  lastfmCallbackUrl,
  readAuthSession,
  sessionService,
  userService,
  getLastFmSession,
  getLastFmUserInfo,
  getLastFmNowPlaying,
  cleanupLastFmExchangeCodes,
  lastfmExchangeCodes,
  lastfmExchangeTtlMs,
  lastfmApiKey
}) {
  const router = Router();
  const toSafeUser = (user) => ({
    id: user?.id,
    name: user?.name || user?.displayName || user?.username || 'Usuario',
    email: user?.email || '',
    role: user?.role === 'ADMIN' ? 'ADMIN' : 'USER',
    avatarUrl: user?.avatarUrl || null,
    musicProvider: user?.musicProvider || null,
    onboardingMusicCompleted: Boolean(user?.onboardingMusicCompleted),
    lastfm: user?.lastfmUsername
      ? {
          username: user.lastfmUsername,
          connectedAt: user.lastfmConnectedAt || null,
          profileUrl: `https://www.last.fm/user/${encodeURIComponent(user.lastfmUsername)}`
        }
      : null
  });

  router.post('/auth/lastfm/connect', async (req, res) => {
    try {
      if (!lastfmApiKey) {
        return res.status(503).json({ error: 'Last.fm nao configurado no servidor.' });
      }

      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const flow = jwt.sign(
        {
          type: 'lastfm-connect',
          userId: auth.user.id,
          sessionId: auth.sessionId
        },
        jwtSecret,
        { expiresIn: '10m' }
      );

      const callbackUrl = new URL(lastfmCallbackUrl);
      callbackUrl.searchParams.set('flow', flow);

      const authUrl = new URL('https://www.last.fm/api/auth/');
      authUrl.searchParams.set('api_key', lastfmApiKey);
      authUrl.searchParams.set('cb', callbackUrl.toString());

      return res.json({ url: authUrl.toString() });
    } catch (error) {
      return res.status(500).json({ error: `Falha ao iniciar conexao Last.fm: ${error.message}` });
    }
  });

  router.get('/auth/lastfm/callback', async (req, res) => {
    try {
      cleanupLastFmExchangeCodes();
      const token = String(req.query?.token || '').trim();
      const flow = String(req.query?.flow || '').trim();
      if (!token || !flow) {
        return res.redirect(`${frontendUrl}?lastfm_error=missing_token`);
      }

      let decoded = null;
      try {
        decoded = jwt.verify(flow, jwtSecret);
      } catch {
        return res.redirect(`${frontendUrl}?lastfm_error=invalid_flow`);
      }

      if (decoded?.type !== 'lastfm-connect') {
        return res.redirect(`${frontendUrl}?lastfm_error=invalid_flow`);
      }

      const sessionId = String(decoded.sessionId || '');
      if (sessionId) {
        const session = await sessionService.get(sessionId);
        if (!session?.userId || session.userId !== decoded.userId) {
          return res.redirect(`${frontendUrl}?lastfm_error=session_expired`);
        }
      }

      const lastfmSession = await getLastFmSession(token);
      if (!lastfmSession?.name || !lastfmSession?.key) {
        return res.redirect(`${frontendUrl}?lastfm_error=session_failed`);
      }

      const profile = await getLastFmUserInfo(lastfmSession.name);
      await userService.updateUserById(decoded.userId, {
        lastfmUsername: lastfmSession.name,
        lastfmSessionKey: lastfmSession.key,
        lastfmConnectedAt: new Date().toISOString(),
        musicProvider: 'lastfm',
        onboardingMusicCompleted: true
      });

      const nowPlaying = await getLastFmNowPlaying(lastfmSession.name).catch(() => null);
      const exchangeCode = Math.random().toString(36).slice(2, 12);
      lastfmExchangeCodes.set(exchangeCode, {
        userId: decoded.userId,
        lastfm: {
          username: lastfmSession.name,
          connectedAt: new Date().toISOString(),
          profileUrl: profile?.url || `https://www.last.fm/user/${encodeURIComponent(lastfmSession.name)}`
        },
        musicProvider: 'lastfm',
        onboardingMusicCompleted: true,
        nowPlaying,
        expiresAt: Date.now() + lastfmExchangeTtlMs
      });

      const redirect = new URL(frontendUrl);
      redirect.searchParams.set('lastfm_code', exchangeCode);
      redirect.searchParams.set('lastfm_connected', '1');
      return res.redirect(redirect.toString());
    } catch (error) {
      return res.redirect(`${frontendUrl}?lastfm_error=${encodeURIComponent(error.message || 'callback_failed')}`);
    }
  });

  router.post('/auth/lastfm/exchange', async (req, res) => {
    try {
      cleanupLastFmExchangeCodes();
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const code = String(req.body?.code || '').trim();
      if (!code) return res.status(400).json({ error: 'Codigo Last.fm invalido.' });

      const pending = lastfmExchangeCodes.get(code);
      lastfmExchangeCodes.delete(code);
      if (!pending || pending.userId !== auth.user.id || Number(pending.expiresAt || 0) <= Date.now()) {
        return res.status(400).json({ error: 'Codigo Last.fm expirado.' });
      }

      const updatedUser = await userService.findById(auth.user.id);
      return res.json({
        user: toSafeUser(updatedUser),
        lastfm: pending.lastfm,
        musicProvider: pending.musicProvider,
        onboardingMusicCompleted: pending.onboardingMusicCompleted,
        nowPlaying: pending.nowPlaying
      });
    } catch (error) {
      return res.status(500).json({ error: `Falha ao trocar codigo Last.fm: ${error.message}` });
    }
  });

  router.get('/auth/lastfm/me', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });
      if (!auth.user?.lastfmUsername) {
        return res.status(404).json({ error: 'Last.fm nao conectado.' });
      }

      return res.json({
        lastfm: {
          username: auth.user.lastfmUsername,
          connectedAt: auth.user.lastfmConnectedAt || null,
          profileUrl: `https://www.last.fm/user/${encodeURIComponent(auth.user.lastfmUsername)}`
        },
        musicProvider: auth.user.musicProvider || null
      });
    } catch (error) {
      return res.status(500).json({ error: `Falha ao carregar Last.fm: ${error.message}` });
    }
  });

  router.get('/auth/lastfm/now-playing', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });
      if (!auth.user?.lastfmUsername) {
        return res.status(404).json({ error: 'Last.fm nao conectado.' });
      }

      const nowPlaying = await getLastFmNowPlaying(auth.user.lastfmUsername);
      return res.json({ nowPlaying });
    } catch (error) {
      return res.status(500).json({ error: `Falha ao sincronizar Last.fm: ${error.message}` });
    }
  });

  router.post('/auth/lastfm/disconnect', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const nextProvider = auth.user?.musicProvider === 'lastfm' ? null : auth.user?.musicProvider || null;
      await userService.updateUserById(auth.user.id, {
        lastfmUsername: null,
        lastfmSessionKey: null,
        lastfmConnectedAt: null,
        musicProvider: nextProvider
      });

      const updatedUser = await userService.findById(auth.user.id);
      return res.json({ ok: true, user: toSafeUser(updatedUser) });
    } catch (error) {
      return res.status(500).json({ error: `Falha ao desconectar Last.fm: ${error.message}` });
    }
  });

  router.post('/auth/local/music-onboarding', async (req, res) => {
    try {
      const auth = await readAuthSession(req);
      if (auth.error) return res.status(401).json({ error: auth.error });

      const completed = req.body?.completed !== false;
      const updatedUser = await userService.updateUserById(auth.user.id, {
        onboardingMusicCompleted: completed
      });
      return res.json({
        ok: true,
        user: toSafeUser(updatedUser)
      });
    } catch (error) {
      return res.status(500).json({ error: `Falha ao salvar onboarding musical: ${error.message}` });
    }
  });

  return router;
}
