import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config/appConfig';
import logoMuusic from '../assets/logo-muusic.png';

const LOCAL_AGENT_URL = 'http://127.0.0.1:43821';
const STATUS_POLL_MS = 15_000;

function formatTimestamp(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return null;
  }
}

function buildDesktopState({ localStatus, devices, error }) {
  if (error) {
    return {
      label: 'Erro',
      className: 'account-bridge-status is-error',
      description: error
    };
  }

  if (localStatus?.paired) {
    return {
      label: 'Pareado',
      className: 'account-bridge-status is-on',
      description: localStatus.hasNowPlaying
        ? 'Bridge pareado e sincronizando em background.'
        : 'Bridge pareado e aguardando o Spotify desktop começar a tocar.'
    };
  }

  if (localStatus?.running && localStatus?.launchAtLoginEnabled) {
    return {
      label: 'Rodando',
      className: 'account-bridge-status is-warn',
      description: 'Bridge detectado localmente e já configurado para iniciar com o macOS.'
    };
  }

  if (localStatus?.running) {
    return {
      label: 'Instalado',
      className: 'account-bridge-status',
      description: 'Bridge detectado neste Mac, mas ainda sem pareamento ativo.'
    };
  }

  if (devices.length > 0) {
    return {
      label: 'Erro',
      className: 'account-bridge-status is-error',
      description: 'Existe um dispositivo pareado no Muusic, mas o agente local não está respondendo neste Mac agora.'
    };
  }

  return {
    label: 'Não instalado',
    className: 'account-bridge-status',
    description: 'Baixe o Muusic Bridge para macOS, abra o app uma vez e volte aqui para parear.'
  };
}

export default function SpotifyBridgeSetup({ authPayload, initialConnectedAt = null, onDesktopSyncResult }) {
  const [bookmarkletCode, setBookmarkletCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [desktopLoading, setDesktopLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [connectedAt, setConnectedAt] = useState(initialConnectedAt);
  const [desktopMessage, setDesktopMessage] = useState('');
  const [localStatus, setLocalStatus] = useState(null);
  const [devices, setDevices] = useState([]);

  const connectedLabel = useMemo(() => {
    if (!connectedAt) return 'Não configurado';
    const formatted = formatTimestamp(connectedAt);
    return formatted ? `Ativado em ${formatted}` : 'Ativado';
  }, [connectedAt]);

  const desktopState = useMemo(
    () => buildDesktopState({ localStatus, devices, error: '' }),
    [devices, localStatus]
  );

  const latestSeenAt = useMemo(() => {
    const deviceSeenAt = devices[0]?.lastSeenAt || null;
    return formatTimestamp(localStatus?.lastHeartbeatAt || localStatus?.lastSyncAt || deviceSeenAt);
  }, [devices, localStatus]);

  const installSteps = useMemo(() => ([
    {
      title: 'Baixar',
      description: 'Baixe o Muusic Bridge para macOS e extraia o app.'
    },
    {
      title: 'Abrir',
      description: 'Abra o app uma vez para registrar o bridge e ativar o auto-start.'
    },
    {
      title: 'Parear',
      description: 'Volte ao Muusic e conecte o dispositivo instalado neste Mac.'
    }
  ]), []);

  const installChecklist = useMemo(() => ([
    {
      label: 'Bridge detectado neste Mac',
      done: Boolean(localStatus?.running)
    },
    {
      label: 'Inicialização automática ativa',
      done: Boolean(localStatus?.launchAtLoginEnabled)
    },
    {
      label: 'Dispositivo pareado com o Muusic',
      done: Boolean(localStatus?.paired)
    }
  ]), [localStatus]);

  const refreshRemoteDevices = useCallback(async () => {
    if (!authPayload?.token) return [];
    const response = await fetch(`${API_URL}/api/bridge/device/status`, {
      headers: {
        Authorization: `Bearer ${authPayload.token}`,
        'x-session-id': authPayload.sessionId || ''
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Não foi possível consultar o status do bridge.');
    }
    const nextDevices = Array.isArray(payload.devices) ? payload.devices : [];
    setDevices(nextDevices);
    return nextDevices;
  }, [authPayload?.sessionId, authPayload?.token]);

  const readLocalStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      const response = await fetch(`${LOCAL_AGENT_URL}/status`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao consultar o Muusic Bridge local.');
      }
      setLocalStatus(payload);
      return payload;
    } catch (nextError) {
      setLocalStatus(null);
      if (!silent) {
        throw new Error(nextError.message || 'Muusic Bridge não detectado neste Mac.');
      }
      return null;
    }
  }, []);

  const refreshDesktopStatus = useCallback(async ({ silent = true } = {}) => {
    try {
      await Promise.all([refreshRemoteDevices(), readLocalStatus({ silent: true })]);
    } catch (nextError) {
      if (!silent) {
        setError(nextError.message || 'Não foi possível atualizar o status do bridge.');
      }
    }
  }, [readLocalStatus, refreshRemoteDevices]);

  useEffect(() => {
    if (!authPayload?.token) return undefined;
    refreshDesktopStatus();
    const timer = window.setInterval(() => {
      refreshDesktopStatus();
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [authPayload?.token, refreshDesktopStatus]);

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
      const statusPayload = await readLocalStatus();
      if (!statusPayload?.ok) {
        throw new Error('Muusic Bridge não detectado em 127.0.0.1:43821.');
      }

      const sessionResponse = await fetch(`${API_URL}/api/bridge/device/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authPayload.token}`,
          'x-session-id': authPayload.sessionId || ''
        },
        body: JSON.stringify({
          deviceName: statusPayload.deviceName || 'Muusic Bridge Mac',
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
      await refreshDesktopStatus({ silent: false });
      setDesktopMessage(
        payload?.nowPlaying?.trackName
          ? 'Bridge pareado. O app instalado já pode sincronizar sozinho em background.'
          : 'Bridge pareado com sucesso. Assim que o Spotify desktop tocar, o Muusic recebe a presença automaticamente.'
      );
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível conectar o app instalado.');
    } finally {
      setDesktopLoading(false);
    }
  }, [authPayload?.sessionId, authPayload?.token, onDesktopSyncResult, readLocalStatus, refreshDesktopStatus]);

  const handleDesktopRevoke = useCallback(async () => {
    if (!authPayload?.token) return;
    setDeviceLoading(true);
    setDesktopMessage('');
    setError('');
    try {
      const activeDeviceId = localStatus?.deviceId || devices[0]?.id || '';
      if (activeDeviceId) {
        const response = await fetch(`${API_URL}/api/bridge/device/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authPayload.token}`,
            'x-session-id': authPayload.sessionId || ''
          },
          body: JSON.stringify({ deviceId: activeDeviceId })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Não foi possível desconectar o dispositivo.');
        }
      }

      await fetch(`${LOCAL_AGENT_URL}/unpair`, { method: 'POST' }).catch(() => null);
      onDesktopSyncResult?.(null);
      await refreshDesktopStatus({ silent: false });
      setDesktopMessage('Bridge desconectado. O agente continua instalado, mas sem um dispositivo pareado.');
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível desconectar o dispositivo.');
    } finally {
      setDeviceLoading(false);
    }
  }, [authPayload?.sessionId, authPayload?.token, devices, localStatus?.deviceId, onDesktopSyncResult, refreshDesktopStatus]);

  if (!authPayload?.token) return null;

  return (
    <section className="account-bridge-section">
      <div className="account-bridge-card">
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
      </div>

      <div className="account-bridge-card account-bridge-desktop">
        <div className="account-bridge-head">
          <div>
            <h3>Spotify App instalado</h3>
            <p>
              O Muusic Bridge para macOS roda em background, inicia com o sistema e sincroniza o
              Spotify desktop sem depender de Terminal ou login Spotify dentro do Muusic.
            </p>
          </div>
          <span className={desktopState.className}>{desktopState.label}</span>
        </div>

        <div className="account-bridge-installer">
          <div className="account-bridge-installer-badge">Instalação oficial do bridge</div>
          <div className="account-bridge-installer-main">
            <div className="account-bridge-installer-icon">
              <img src={logoMuusic} alt="Muusic Bridge" />
            </div>
            <div className="account-bridge-installer-copy">
              <h4>Muusic Bridge para macOS</h4>
              <p>
                Este agente roda em background no seu Mac, inicia com o sistema e mantém a
                sincronização do Spotify desktop ativa sem depender de Terminal aberto.
              </p>
            </div>
          </div>
        </div>

        <div className="account-bridge-downloads">
          <a className="account-primary-btn account-bridge-download-btn" href="/downloads/Muusic%20Bridge.app.zip" download>
            Baixar Muusic Bridge para macOS
          </a>
          <p className="account-bridge-hint">
            Fallback avançado:
            {' '}
            <a className="account-bridge-download" href="/downloads/muusic-bridge-macos.command" download>
              .command
            </a>
            {' '}+{' '}
            <a className="account-bridge-download" href="/downloads/muusic-bridge-macos.mjs" download>
              .mjs
            </a>
          </p>
        </div>

        <div className="account-bridge-install-steps">
          {installSteps.map((step, index) => (
            <article key={step.title} className="account-bridge-step-card">
              <span className="account-bridge-step-index">0{index + 1}</span>
              <div>
                <h5>{step.title}</h5>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="account-bridge-meta">
          <div className="account-bridge-meta-item">
            <span className="account-bridge-meta-label">Status</span>
            <strong>{desktopState.description}</strong>
          </div>
          <div className="account-bridge-meta-item">
            <span className="account-bridge-meta-label">Bridge local</span>
            <strong>{localStatus?.running ? 'Detectado neste Mac' : 'Não detectado'}</strong>
          </div>
          <div className="account-bridge-meta-item">
            <span className="account-bridge-meta-label">Inicialização no login</span>
            <strong>{localStatus?.launchAtLoginEnabled ? 'Ativa' : 'Aguardando primeira abertura do app'}</strong>
          </div>
          <div className="account-bridge-meta-item">
            <span className="account-bridge-meta-label">Último sinal recebido</span>
            <strong>{latestSeenAt || 'Sem sinal recente'}</strong>
          </div>
        </div>

        <div className="account-bridge-checklist">
          {installChecklist.map((item) => (
            <div key={item.label} className={item.done ? 'account-bridge-check account-bridge-check-done' : 'account-bridge-check'}>
              <span className="account-bridge-check-mark" aria-hidden="true">{item.done ? '●' : '○'}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="account-bridge-actions">
          <button type="button" className="account-primary-btn" onClick={handleDesktopSync} disabled={desktopLoading}>
            {desktopLoading ? 'Conectando bridge...' : localStatus?.paired ? 'Reconectar dispositivo' : 'Conectar'}
          </button>
          <button
            type="button"
            className="account-secondary-btn"
            onClick={handleDesktopRevoke}
            disabled={deviceLoading || (!localStatus?.paired && devices.length === 0)}
          >
            {deviceLoading ? 'Desconectando...' : 'Desconectar dispositivo'}
          </button>
        </div>

        {localStatus?.appVersion ? (
          <p className="account-bridge-hint">
            Bridge detectado em 127.0.0.1:43821. Versão local: {localStatus.appVersion}.
          </p>
        ) : null}
        {desktopMessage ? <p className="account-bridge-hint">{desktopMessage}</p> : null}
      </div>

      {error ? <p className="account-bridge-error">{error}</p> : null}
    </section>
  );
}
