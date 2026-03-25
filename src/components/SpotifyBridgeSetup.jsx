import { useCallback, useMemo, useState } from 'react';
import { API_URL } from '../config/appConfig';

export default function SpotifyBridgeSetup({ authPayload, initialConnectedAt = null, onDesktopSyncResult }) {
  const [bookmarkletCode, setBookmarkletCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [connectedAt, setConnectedAt] = useState(initialConnectedAt);
  const [desktopMessage, setDesktopMessage] = useState('');
  const [agentStatus, setAgentStatus] = useState(null);
  const LOCAL_AGENT_URL = 'http://127.0.0.1:43821';

  const connectedLabel = useMemo(() => {
    if (!connectedAt) return 'Não configurado';
    try {
      return `Ativado em ${new Date(connectedAt).toLocaleString('pt-BR')}`;
    } catch {
      return 'Ativado';
    }
  }, [connectedAt]);

  const fetchSetup = useCallback(async () => {
    if (!authPayload?.token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/bridge/setup`, {
        headers: {
          Authorization: `Bearer ${authPayload.token}`,
          'x-session-id': authPayload.sessionId || ''
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível gerar o atalho.');
      }
      setBookmarkletCode(payload.bookmarkletCode || '');
      setConnectedAt(payload.connectedAt || connectedAt || new Date().toISOString());
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível gerar o atalho.');
    } finally {
      setLoading(false);
    }
  }, [authPayload?.sessionId, authPayload?.token, connectedAt]);

  const handleCopy = useCallback(() => {
    if (!bookmarkletCode) return;
    navigator.clipboard.writeText(bookmarkletCode).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setError('Não foi possível copiar o atalho.');
    });
  }, [bookmarkletCode]);

  const handleRevoke = useCallback(async () => {
    if (!authPayload?.token) return;
    setRevoking(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/bridge/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authPayload.token}`,
          'x-session-id': authPayload.sessionId || ''
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível desativar o sync.');
      }
      setBookmarkletCode('');
      setConnectedAt(null);
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível desativar o sync.');
    } finally {
      setRevoking(false);
    }
  }, [authPayload?.sessionId, authPayload?.token]);

  const handleDesktopSync = useCallback(async () => {
    if (!authPayload?.token) return;
    setDesktopLoading(true);
    setDesktopMessage('');
    setError('');
    try {
      const statusResponse = await fetch(`${LOCAL_AGENT_URL}/status`);
      const statusPayload = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) {
        throw new Error('Muusic Bridge para macOS não encontrado em 127.0.0.1:43821.');
      }
      setAgentStatus(statusPayload);

      const sessionResponse = await fetch(`${API_URL}/api/bridge/device/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authPayload.token}`,
          'x-session-id': authPayload.sessionId || ''
        },
        body: JSON.stringify({
          deviceName: 'Muusic Bridge Mac',
          platform: 'macos'
        })
      });
      const sessionPayload = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || !sessionPayload?.deviceToken) {
        throw new Error(sessionPayload?.error || 'Não foi possível criar a sessão do app instalado.');
      }

      const pairResponse = await fetch(`${LOCAL_AGENT_URL}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiBaseUrl: API_URL || window.location.origin,
          deviceId: sessionPayload.deviceId,
          deviceToken: sessionPayload.deviceToken,
          deviceName: sessionPayload.deviceName
        })
      });
      const pairPayload = await pairResponse.json().catch(() => ({}));
      if (!pairResponse.ok) {
        throw new Error(pairPayload?.error || 'Não foi possível parear o Muusic Bridge local.');
      }

      const response = await fetch(`${LOCAL_AGENT_URL}/sync-once`, {
        method: 'POST'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível ler o app Spotify instalado.');
      }

      onDesktopSyncResult?.(payload.nowPlaying || null);
      setDesktopMessage(
        payload?.nowPlaying?.trackName
          ? 'Leitura do app instalado concluída. O card de now playing foi atualizado.'
          : 'Pareado com sucesso, mas nenhuma faixa foi detectada no app Spotify agora.'
      );
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível ler o app Spotify instalado.');
    } finally {
      setDesktopLoading(false);
    }
  }, [authPayload?.sessionId, authPayload?.token, onDesktopSyncResult]);

  if (!authPayload?.token) return null;

  return (
    <section className="account-bridge-section">
      <div className="account-bridge-head">
        <div>
          <h3>Spotify Web Sync</h3>
          <p>
            Use o Spotify Web Player sem login Spotify no Muusic. O atalho lê a faixa tocando em
            `open.spotify.com` e envia a presença para o mapa.
          </p>
        </div>
        <span className={connectedAt ? 'account-bridge-status is-on' : 'account-bridge-status'}>
          {connectedLabel}
        </span>
      </div>

      <ol className="account-bridge-steps">
        <li>Abra o Spotify Web Player em uma aba do navegador.</li>
        <li>Gere o atalho abaixo e arraste para a barra de favoritos.</li>
        <li>Clique no favorito com o Spotify Web aberto para iniciar o sync.</li>
      </ol>

      <div className="account-bridge-actions">
        <button type="button" className="account-primary-btn" onClick={fetchSetup} disabled={loading}>
          {loading ? 'Gerando atalho...' : connectedAt ? 'Mostrar atalho' : 'Gerar atalho'}
        </button>
        {connectedAt ? (
          <button type="button" className="account-secondary-btn" onClick={handleRevoke} disabled={revoking}>
            {revoking ? 'Desativando...' : 'Desativar sync'}
          </button>
        ) : null}
      </div>

      {bookmarkletCode ? (
        <div className="account-bridge-bookmarklet">
          <a
            href={bookmarkletCode}
            className="account-bridge-link"
            draggable
            onClick={(event) => {
              event.preventDefault();
              handleCopy();
            }}
          >
            Muusic Sync
          </a>
          <p className="account-bridge-hint">
            {copied ? 'Atalho copiado. Você também pode arrastar para favoritos.' : 'Arraste para favoritos ou clique para copiar.'}
          </p>
        </div>
      ) : null}

      <div className="account-bridge-desktop">
        <h4>Spotify App instalado</h4>
        <p>
          Para este MVP macOS, rode o Muusic Bridge localmente no seu Mac e use este botão para
          parear o agente com o site e testar a leitura do app Spotify instalado.
        </p>
        <p className="account-bridge-hint">
          Baixe o app macOS:
          {' '}
          <a className="account-bridge-download" href="/downloads/Muusic%20Bridge.app.zip" download>
            Muusic Bridge.app.zip
          </a>
          {' '}e extraia o `.app` antes de abrir.
        </p>
        <div className="account-bridge-actions">
          <button type="button" className="account-secondary-btn" onClick={handleDesktopSync} disabled={desktopLoading}>
            {desktopLoading ? 'Pareando e lendo app...' : 'Conectar app instalado'}
          </button>
        </div>
        {agentStatus?.paired ? <p className="account-bridge-hint">Agente local detectado em 127.0.0.1:43821.</p> : null}
        {desktopMessage ? <p className="account-bridge-hint">{desktopMessage}</p> : null}
      </div>

      {error ? <p className="account-bridge-error">{error}</p> : null}
    </section>
  );
}
