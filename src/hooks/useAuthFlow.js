import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config/appConfig';
import { readSessionUser, STORAGE_SESSION_KEY } from '../lib/storage';

function isSameNowPlaying(prev, next) {
  if (!prev && !next) return true;
  if (!prev || !next) return false;

  return (
    prev.trackName === next.trackName &&
    prev.artistName === next.artistName &&
    prev.artists === next.artists &&
    prev.albumImage === next.albumImage &&
    prev.artistImage === next.artistImage &&
    prev.isPlaying === next.isPlaying &&
    Number(prev.durationMs || 0) === Number(next.durationMs || 0) &&
    prev.externalUrl === next.externalUrl &&
    prev.source === next.source
  );
}

export function useAuthFlow() {
  const [initialSession] = useState(() => readSessionUser());
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    resetToken: '',
    resetPassword: '',
    resetConfirmPassword: ''
  });
  const [authError, setAuthError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [authUser, setAuthUser] = useState(initialSession);
  const [authBooting, setAuthBooting] = useState(Boolean(initialSession?.token));
  const [spotifyError, setSpotifyError] = useState('');
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);
  const [lastfmError, setLastfmError] = useState('');
  const [lastfmConnecting, setLastfmConnecting] = useState(false);

  const persistSession = useCallback((session) => {
    if (!session) {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      return;
    }
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
  }, []);

  const normalizeSession = useCallback((baseUser, extras = {}) => ({
    ...baseUser,
    spotify: extras.spotify ?? baseUser?.spotify ?? null,
    spotifyToken: extras.spotifyToken ?? baseUser?.spotifyToken ?? '',
    spotifyConnectedAt: extras.spotifyConnectedAt ?? baseUser?.spotifyConnectedAt ?? null,
    lastfm: extras.lastfm ?? baseUser?.lastfm ?? null,
    lastfmConnectedAt: extras.lastfmConnectedAt ?? baseUser?.lastfmConnectedAt ?? baseUser?.lastfm?.connectedAt ?? null,
    musicProvider: extras.musicProvider ?? baseUser?.musicProvider ?? null,
    onboardingMusicCompleted:
      typeof extras.onboardingMusicCompleted === 'boolean'
        ? extras.onboardingMusicCompleted
        : Boolean(baseUser?.onboardingMusicCompleted),
    nowPlaying: extras.nowPlaying ?? baseUser?.nowPlaying ?? null
  }), []);

  useEffect(() => {
    if (!initialSession?.token) {
      setAuthBooting(false);
      return;
    }
    if (initialSession.token === 'guest-local') {
      setAuthUser(initialSession);
      setAuthBooting(false);
      return;
    }

    let cancelled = false;

    const validateSession = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/local/me`, {
          headers: {
            Authorization: `Bearer ${initialSession.token}`,
            'x-session-id': initialSession.sessionId || ''
          }
        });
        if (!response.ok) {
          if (!cancelled) {
            persistSession(null);
            setAuthUser(null);
          }
          return;
        }
        const payload = await response.json();
        if (!cancelled) {
          const session = {
            ...normalizeSession(payload.user, {
              spotify: initialSession.spotify || null,
              spotifyToken: initialSession.spotifyToken || '',
              spotifyConnectedAt: initialSession.spotifyConnectedAt || null,
              nowPlaying: initialSession.nowPlaying || null,
              lastfm: payload.user?.lastfm || initialSession.lastfm || null,
              lastfmConnectedAt: payload.user?.lastfm?.connectedAt || initialSession.lastfmConnectedAt || null,
              musicProvider: payload.user?.musicProvider || initialSession.musicProvider || null,
              onboardingMusicCompleted:
                typeof payload.user?.onboardingMusicCompleted === 'boolean'
                  ? payload.user.onboardingMusicCompleted
                  : Boolean(initialSession.onboardingMusicCompleted)
            }),
            token: initialSession.token,
            sessionId: payload.sessionId || initialSession.sessionId || ''
          };
          setAuthUser(session);
          persistSession(session);
        }
      } catch {
        if (!cancelled) {
          persistSession(null);
          setAuthUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthBooting(false);
        }
      }
    };

    validateSession();
    return () => {
      cancelled = true;
    };
  }, [initialSession, normalizeSession, persistSession]);

  function updateAuthField(field, value) {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  }

  function openForgotMode() {
    setForgotMode(true);
    setResetMode(false);
    setAuthError('');
    setForgotMessage('');
  }

  function closeForgotMode() {
    setForgotMode(false);
    setResetMode(false);
    setAuthError('');
    setForgotMessage('');
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError('');
    setForgotMessage('');
    const name = authForm.name.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    const confirmPassword = authForm.confirmPassword;

    if (!email || !password || (authMode === 'register' && !name)) {
      setAuthError('Preencha os campos obrigatorios.');
      return;
    }

    if (authMode === 'register') {
      if (password.length < 6) {
        setAuthError('Senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('A confirmacao de senha nao confere.');
        return;
      }
      try {
        const response = await fetch(`${API_URL}/auth/local/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, confirmPassword })
        });
        const payload = await response.json();
        if (!response.ok) {
          setAuthError(payload.error || 'Falha ao criar conta.');
          return;
        }
        const session = {
          ...normalizeSession(payload.user, { onboardingMusicCompleted: Boolean(payload.user?.onboardingMusicCompleted) }),
          token: payload.token,
          sessionId: payload.sessionId || ''
        };
        setAuthUser(session);
        persistSession(session);
        setAuthForm({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          resetToken: '',
          resetPassword: '',
          resetConfirmPassword: ''
        });
        return;
      } catch {
        setAuthError('Nao foi possivel conectar ao servidor.');
        return;
      }
    }

    try {
      const response = await fetch(`${API_URL}/auth/local/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAuthError(payload.error || 'Credenciais invalidas.');
        return;
      }
      const session = {
        ...normalizeSession(payload.user, { onboardingMusicCompleted: Boolean(payload.user?.onboardingMusicCompleted) }),
        token: payload.token,
        sessionId: payload.sessionId || ''
      };
      setAuthUser(session);
      persistSession(session);
      setAuthForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        resetToken: '',
        resetPassword: '',
        resetConfirmPassword: ''
      });
    } catch {
      setAuthError('Nao foi possivel conectar ao servidor.');
    }
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    setAuthError('');
    setForgotMessage('');
    const email = authForm.email.trim().toLowerCase();
    if (!email) {
      setAuthError('Informe seu e-mail para recuperar a senha.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/local/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAuthError(payload.error || 'Nao foi possivel recuperar senha.');
        return;
      }
      if (payload.resetToken) {
        setAuthForm((prev) => ({ ...prev, resetToken: payload.resetToken }));
      }
      setForgotMessage(payload.message || 'Link de recuperacao enviado.');
      setResetMode(true);
    } catch {
      setAuthError('Nao foi possivel conectar ao servidor.');
    }
  }

  async function submitResetPassword(event) {
    event.preventDefault();
    setAuthError('');
    setForgotMessage('');

    const token = authForm.resetToken.trim();
    const password = authForm.resetPassword;
    const confirmPassword = authForm.resetConfirmPassword;
    if (!token || !password || !confirmPassword) {
      setAuthError('Preencha token e nova senha.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/local/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAuthError(payload.error || 'Nao foi possivel redefinir senha.');
        return;
      }
      setForgotMessage(payload.message || 'Senha redefinida com sucesso.');
      setResetMode(false);
      setForgotMode(false);
      setAuthMode('login');
      setAuthForm((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
        resetPassword: '',
        resetConfirmPassword: ''
      }));
    } catch {
      setAuthError('Nao foi possivel conectar ao servidor.');
    }
  }

  async function logout() {
    const session = authUser;
    try {
      if (session?.token) {
        await fetch(`${API_URL}/auth/local/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'x-session-id': session.sessionId || ''
          },
          body: JSON.stringify({ sessionId: session.sessionId || '' })
        });
      }
    } catch {
      // Ignore network errors and clear local session.
    } finally {
      persistSession(null);
      setAuthUser(null);
      setAuthBooting(false);
    }
  }

  function quickEnter() {
    const session = {
      id: `guest-${Date.now()}`,
      name: 'Convidado',
      email: '',
      token: 'guest-local',
      sessionId: '',
      spotify: null,
      spotifyToken: '',
      spotifyConnectedAt: null,
      lastfm: null,
      lastfmConnectedAt: null,
      musicProvider: null,
      onboardingMusicCompleted: true,
      nowPlaying: null
    };
    setAuthUser(session);
    setAuthBooting(false);
    try {
      persistSession(session);
    } catch {
      // Ignore storage errors and keep in-memory session.
    }
  }

  const connectSpotify = useCallback(async (roomId = 'global') => {
    if (!authUser?.token || authUser.token === 'guest-local') {
      setSpotifyError('Faca login com conta para conectar Spotify.');
      return;
    }

    setSpotifyError('');
    setSpotifyConnecting(true);
    try {
      const response = await fetch(`${API_URL}/auth/spotify/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authUser.token}`,
          'x-session-id': authUser.sessionId || ''
        },
        body: JSON.stringify({ roomId })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.url) {
        setSpotifyError(payload?.error || 'Falha ao iniciar conexao com Spotify.');
        return;
      }

      window.location.assign(payload.url);
    } catch {
      setSpotifyError('Nao foi possivel conectar ao Spotify agora.');
    } finally {
      setSpotifyConnecting(false);
    }
  }, [authUser]);

  const connectLastfm = useCallback(async () => {
    if (!authUser?.token || authUser.token === 'guest-local') {
      setLastfmError('Faca login com conta para conectar Last.fm.');
      return;
    }

    setLastfmError('');
    setLastfmConnecting(true);
    try {
      const response = await fetch(`${API_URL}/auth/lastfm/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authUser.token}`,
          'x-session-id': authUser.sessionId || ''
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        setLastfmError(payload?.error || 'Falha ao iniciar conexao Last.fm.');
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setLastfmError('Nao foi possivel conectar ao Last.fm agora.');
    } finally {
      setLastfmConnecting(false);
    }
  }, [authUser]);

  const applySpotifyToken = useCallback(async (spotifyToken) => {
    if (!spotifyToken) return false;
    try {
      const response = await fetch(`${API_URL}/auth/spotify/me`, {
        headers: {
          Authorization: `Bearer ${spotifyToken}`
        }
      });
      const payload = await response.json();
      if (!response.ok) {
        setSpotifyError(payload?.error || 'Token Spotify inválido.');
        return false;
      }

      setAuthUser((prev) => {
        if (!prev) return prev;
        const next = normalizeSession(prev, {
          spotify: payload.spotify || null,
          spotifyToken,
          spotifyConnectedAt: new Date().toISOString(),
          musicProvider: prev?.musicProvider || 'spotify',
          onboardingMusicCompleted: true,
          nowPlaying: payload.nowPlaying || null
        });
        persistSession(next);
        return next;
      });
      setSpotifyError('');
      if (authUser?.token && authUser.token !== 'guest-local') {
        fetch(`${API_URL}/auth/local/music-onboarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authUser.token}`,
            'x-session-id': authUser.sessionId || ''
          },
          body: JSON.stringify({ completed: true })
        }).catch(() => {});
      }
      return true;
    } catch {
      setSpotifyError('Falha ao validar a conexao Spotify.');
      return false;
    }
  }, [authUser?.sessionId, authUser?.token, normalizeSession, persistSession]);

  const exchangeSpotifyCode = useCallback(
    async (spotifyCode) => {
      const code = String(spotifyCode || '').trim();
      if (!code) return false;
      if (!authUser?.token || authUser.token === 'guest-local') return false;

      try {
        const response = await fetch(`${API_URL}/auth/spotify/exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authUser.token}`,
            'x-session-id': authUser.sessionId || ''
          },
          body: JSON.stringify({ code })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.spotifyToken) {
          setSpotifyError(payload?.error || 'Codigo Spotify invalido.');
          return false;
        }
        return applySpotifyToken(payload.spotifyToken);
      } catch {
        setSpotifyError('Falha ao trocar codigo do Spotify.');
        return false;
      }
    },
    [authUser?.token, authUser?.sessionId, applySpotifyToken]
  );

  const exchangeLastfmCode = useCallback(async (lastfmCode) => {
    const code = String(lastfmCode || '').trim();
    if (!code || !authUser?.token || authUser.token === 'guest-local') return false;

    try {
      const response = await fetch(`${API_URL}/auth/lastfm/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authUser.token}`,
          'x-session-id': authUser.sessionId || ''
        },
        body: JSON.stringify({ code })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.lastfm) {
        setLastfmError(payload?.error || 'Codigo Last.fm invalido.');
        return false;
      }

      setAuthUser((prev) => {
        if (!prev) return prev;
        const next = normalizeSession(prev, {
          lastfm: payload.lastfm,
          lastfmConnectedAt: payload.lastfm?.connectedAt || new Date().toISOString(),
          musicProvider: payload.musicProvider || 'lastfm',
          onboardingMusicCompleted: payload.onboardingMusicCompleted !== false,
          nowPlaying: payload.nowPlaying || null
        });
        persistSession(next);
        return next;
      });
      setLastfmError('');
      return true;
    } catch {
      setLastfmError('Falha ao trocar codigo do Last.fm.');
      return false;
    }
  }, [authUser?.sessionId, authUser?.token, normalizeSession, persistSession]);

  const refreshSpotifyNowPlaying = useCallback(async () => {
    if (!authUser?.spotifyToken) return null;

    try {
      const response = await fetch(`${API_URL}/auth/spotify/now-playing`, {
        headers: {
          Authorization: `Bearer ${authUser.spotifyToken}`
        }
      });
      const payload = await response.json();
      if (!response.ok) {
        return null;
      }
      setAuthUser((prev) => {
        if (!prev) return prev;
        const nextNowPlaying = payload.nowPlaying || null;
        const nextSpotifyToken = payload.spotifyToken || prev.spotifyToken;
        if (isSameNowPlaying(prev.nowPlaying || null, nextNowPlaying) && prev.spotifyToken === nextSpotifyToken) {
          return prev;
        }
        const next = {
          ...prev,
          nowPlaying: nextNowPlaying,
          spotifyToken: nextSpotifyToken
        };
        persistSession(next);
        return next;
      });
      return payload.nowPlaying || null;
    } catch {
      return null;
    }
  }, [authUser?.spotifyToken, persistSession]);

  const refreshLastfmNowPlaying = useCallback(async () => {
    if (!authUser?.token || authUser.token === 'guest-local' || !authUser?.lastfm?.username) return null;

    try {
      const response = await fetch(`${API_URL}/auth/lastfm/now-playing`, {
        headers: {
          Authorization: `Bearer ${authUser.token}`,
          'x-session-id': authUser.sessionId || ''
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return null;

      setAuthUser((prev) => {
        if (!prev) return prev;
        const nextNowPlaying = payload.nowPlaying || null;
        if (isSameNowPlaying(prev.nowPlaying || null, nextNowPlaying)) return prev;
        const next = {
          ...prev,
          nowPlaying: nextNowPlaying
        };
        persistSession(next);
        return next;
      });
      return payload.nowPlaying || null;
    } catch {
      return null;
    }
  }, [authUser?.lastfm?.username, authUser?.sessionId, authUser?.token, persistSession]);

  const completeMusicOnboarding = useCallback(async (completed = true) => {
    if (!authUser?.token || authUser.token === 'guest-local') return false;
    try {
      const response = await fetch(`${API_URL}/auth/local/music-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authUser.token}`,
          'x-session-id': authUser.sessionId || ''
        },
        body: JSON.stringify({ completed })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.user) return false;

      setAuthUser((prev) => {
        if (!prev) return prev;
        const next = normalizeSession(
          {
            ...prev,
            ...payload.user
          },
          {
            spotify: prev.spotify,
            spotifyToken: prev.spotifyToken,
            spotifyConnectedAt: prev.spotifyConnectedAt,
            lastfm: prev.lastfm,
            lastfmConnectedAt: prev.lastfmConnectedAt,
            musicProvider: prev.musicProvider,
            nowPlaying: prev.nowPlaying
          }
        );
        persistSession(next);
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }, [authUser?.sessionId, authUser?.token, normalizeSession, persistSession]);

  const disconnectLastfm = useCallback(async () => {
    if (!authUser?.token || authUser.token === 'guest-local') return false;
    try {
      const response = await fetch(`${API_URL}/auth/lastfm/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authUser.token}`,
          'x-session-id': authUser.sessionId || ''
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLastfmError(payload?.error || 'Falha ao desconectar Last.fm.');
        return false;
      }

      setAuthUser((prev) => {
        if (!prev) return prev;
        const next = normalizeSession(
          {
            ...prev,
            ...(payload.user || {})
          },
          {
            lastfm: null,
            lastfmConnectedAt: null,
            musicProvider: payload?.user?.musicProvider || (prev.musicProvider === 'lastfm' ? (prev.spotify ? 'spotify' : null) : prev.musicProvider),
            nowPlaying: prev.nowPlaying?.source === 'lastfm' ? null : prev.nowPlaying
          }
        );
        persistSession(next);
        return next;
      });
      setLastfmError('');
      return true;
    } catch {
      setLastfmError('Falha ao desconectar Last.fm.');
      return false;
    }
  }, [authUser?.sessionId, authUser?.token, normalizeSession, persistSession]);

  const disconnectSpotify = useCallback(() => {
    setAuthUser((prev) => {
      if (!prev) return prev;
      const next = normalizeSession(prev, {
        spotify: null,
        spotifyToken: '',
        spotifyConnectedAt: null,
        musicProvider: prev.musicProvider === 'spotify' ? (prev.lastfm ? 'lastfm' : null) : prev.musicProvider,
        nowPlaying: prev.nowPlaying?.source === 'spotify' ? null : prev.nowPlaying
      });
      persistSession(next);
      return next;
    });
    setSpotifyError('');
    return true;
  }, [normalizeSession, persistSession]);

  return {
    authMode,
    setAuthMode,
    authForm,
    authError,
    forgotMode,
    resetMode,
    forgotMessage,
    authBooting,
    authUser,
    setAuthUser,
    updateAuthField,
    submitAuth,
    submitForgotPassword,
    submitResetPassword,
    openForgotMode,
    closeForgotMode,
    quickEnter,
    logout,
    connectSpotify,
    connectLastfm,
    applySpotifyToken,
    exchangeSpotifyCode,
    exchangeLastfmCode,
    refreshSpotifyNowPlaying,
    refreshLastfmNowPlaying,
    completeMusicOnboarding,
    disconnectLastfm,
    disconnectSpotify,
    spotifyError,
    spotifyConnecting,
    lastfmError,
    lastfmConnecting
  };
}
