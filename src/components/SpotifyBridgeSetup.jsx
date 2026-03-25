import { useCallback, useMemo, useState } from 'react';
import { API_URL } from '../config/appConfig';

export default function SpotifyBridgeSetup({ authPayload, initialConnectedAt = null }) {
  const [bookmarkletCode, setBookmarkletCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [connectedAt, setConnectedAt] = useState(initialConnectedAt);

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

      {error ? <p className="account-bridge-error">{error}</p> : null}
    </section>
  );
}
