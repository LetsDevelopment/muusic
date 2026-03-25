import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Upload, UserRound, X } from 'lucide-react';
import { accountService } from '../services/accountService';

const TAB_KEYS = ['perfil', 'seguranca'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

function countBio(value) {
  return String(value || '').length;
}

export default function MyAccountPage({ authUser, onBack, onSettingsChange, onLogout }) {
  const authUserId = authUser?.id || '';
  const authUserToken = authUser?.token || '';
  const authUserSessionId = authUser?.sessionId || '';
  const authPayload = useMemo(
    () => (authUserToken ? { id: authUserId, token: authUserToken, sessionId: authUserSessionId } : null),
    [authUserId, authUserToken, authUserSessionId]
  );

  const [activeTab, setActiveTab] = useState('perfil');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [showMusicHistory, setShowMusicHistory] = useState(true);
  const [cityCenterLat, setCityCenterLat] = useState(null);
  const [cityCenterLng, setCityCenterLng] = useState(null);
  const [detectingCity, setDetectingCity] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef(null);
  const tabRefs = useRef([]);
  const cardRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onBack?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(event.target)) onBack?.();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onBack]);

  useEffect(() => {
    let active = true;
    accountService
      .get(authPayload)
      .then((settings) => {
        if (!active) return;
        setCity(settings.city);
        setBio(settings.bio);
        setAvatarDataUrl(settings.avatarDataUrl);
        setLocationEnabled(settings.locationEnabled);
        setShowMusicHistory(settings.showMusicHistory);
        setCityCenterLat(settings.cityCenterLat);
        setCityCenterLng(settings.cityCenterLng);
      })
      .catch((error) => {
        if (!active) return;
        setFeedback({ type: 'error', message: error.message || 'Falha ao carregar dados da conta.' });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authPayload]);

  const profileDraft = useMemo(
    () => ({
      city: city.trim(),
      bio,
      avatarDataUrl,
      locationEnabled,
      showMusicHistory,
      cityCenterLat,
      cityCenterLng
    }),
    [city, bio, avatarDataUrl, locationEnabled, showMusicHistory, cityCenterLat, cityCenterLng]
  );

  function extractCityFromReverse(payload) {
    const address = payload?.address || {};
    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      address.state_district ||
      ''
    );
  }

  async function detectCurrentCity() {
    if (!navigator.geolocation) {
      setFeedback({ type: 'error', message: 'Geolocalização não suportada no navegador.' });
      return;
    }
    try {
      setDetectingCity(true);
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 })
      );
      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const payload = await response.json().catch(() => ({}));
      const cityFromGeo = extractCityFromReverse(payload);
      if (!cityFromGeo) {
        setFeedback({ type: 'error', message: 'Não foi possível identificar a cidade atual.' });
        return;
      }
      setCity(cityFromGeo);
      setCityCenterLat(lat);
      setCityCenterLng(lng);
      setFeedback({ type: 'success', message: `Cidade detectada: ${cityFromGeo}` });
    } catch {
      setFeedback({ type: 'error', message: 'Falha ao obter cidade atual.' });
    } finally {
      setDetectingCity(false);
    }
  }

  function onKeyDownTabs(event) {
    const idx = TAB_KEYS.indexOf(activeTab);
    if (idx === -1) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = (idx + 1) % TAB_KEYS.length;
      setActiveTab(TAB_KEYS[next]);
      tabRefs.current[next]?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = (idx - 1 + TAB_KEYS.length) % TAB_KEYS.length;
      setActiveTab(TAB_KEYS[prev]);
      tabRefs.current[prev]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveTab(TAB_KEYS[0]);
      tabRefs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = TAB_KEYS.length - 1;
      setActiveTab(TAB_KEYS[last]);
      tabRefs.current[last]?.focus();
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_MIME.includes(file.type)) {
      setFeedback({ type: 'error', message: 'Formato invalido. Envie png, jpg ou webp.' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFeedback({ type: 'error', message: 'A imagem deve ter no maximo 5MB.' });
      return;
    }

    try {
      const nextDataUrl = await fileToDataUrl(file);
      setAvatarDataUrl(nextDataUrl);
      setFeedback({ type: 'success', message: 'Preview de imagem atualizada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao carregar imagem.' });
    }
  }

  async function saveProfile() {
    try {
      setSavingProfile(true);
      const next = await accountService.updateProfile(profileDraft, authUser);
      onSettingsChange?.(next);
      setFeedback({ type: 'success', message: 'Perfil atualizado com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao salvar perfil.' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveSecurity() {
    try {
      setSavingSecurity(true);
      const hasPasswordInput = Boolean(currentPassword || newPassword || confirmPassword);
      if (hasPasswordInput) {
        await accountService.changePassword({
          currentPassword,
          newPassword,
          confirmPassword
        }, authUser);
      }
      const next = await accountService.updatePreferences(
        {
          locationEnabled,
          showMusicHistory
        },
        authUser
      );
      onSettingsChange?.(next);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', message: 'Preferencias de seguranca salvas.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao salvar seguranca.' });
    } finally {
      setSavingSecurity(false);
    }
  }

  async function removeAvatar() {
    setAvatarDataUrl('');
    try {
      const next = await accountService.updateProfile(
        {
          ...profileDraft,
          avatarDataUrl: ''
        },
        authUser
      );
      onSettingsChange?.(next);
      setFeedback({ type: 'success', message: 'Foto removida.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao remover foto.' });
    }
  }

  if (loading) {
    return (
      <main className="account-page">
        <div ref={cardRef} className="account-card account-loading">Carregando Minha Conta...</div>
      </main>
    );
  }

  return (
    <main className="account-page">
      <section ref={cardRef} className="account-card">
        <header className="account-header">
          <button type="button" className="account-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            Voltar
          </button>
          <div className="account-head-copy">
            <h1>Minha Conta</h1>
            <p>{authUser?.name || 'Usuario'}</p>
          </div>
        </header>

        {feedback && <p className={feedback.type === 'error' ? 'account-feedback error' : 'account-feedback success'}>{feedback.message}</p>}

        <div className="account-tabs" role="tablist" tabIndex={0} aria-label="Abas da conta" onKeyDown={onKeyDownTabs}>
          <button
            ref={(node) => {
              tabRefs.current[0] = node;
            }}
            type="button"
            role="tab"
            aria-selected={activeTab === 'perfil'}
            aria-controls="tab-panel-perfil"
            id="tab-perfil"
            className={activeTab === 'perfil' ? 'account-tab active' : 'account-tab'}
            onClick={() => setActiveTab('perfil')}
          >
            Perfil
          </button>
          <button
            ref={(node) => {
              tabRefs.current[1] = node;
            }}
            type="button"
            role="tab"
            aria-selected={activeTab === 'seguranca'}
            aria-controls="tab-panel-seguranca"
            id="tab-seguranca"
            className={activeTab === 'seguranca' ? 'account-tab active' : 'account-tab'}
            onClick={() => setActiveTab('seguranca')}
          >
            Segurança
          </button>
        </div>

        {activeTab === 'perfil' && (
          <div id="tab-panel-perfil" role="tabpanel" aria-labelledby="tab-perfil" className="account-panel">
            <div className="account-avatar-wrap">
              {avatarDataUrl ? <img src={avatarDataUrl} alt="Foto de perfil" className="account-avatar" /> : <div className="account-avatar-fallback"><UserRound size={22} /></div>}
              <div className="account-avatar-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="account-file-input"
                  onChange={handleAvatarUpload}
                />
                <button type="button" className="account-secondary-btn" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} />
                  Salvar
                </button>
                <button type="button" className="account-secondary-btn" onClick={removeAvatar}>
                  <X size={14} />
                  Remover foto
                </button>
              </div>
            </div>

            <label className="account-field">
              <span>Cidade</span>
              <input
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setCityCenterLat(null);
                  setCityCenterLng(null);
                }}
                minLength={2}
                required
              />
            </label>
            <div className="account-actions account-actions-start">
              <button type="button" className="account-secondary-btn" onClick={detectCurrentCity} disabled={detectingCity}>
                {detectingCity ? 'Detectando cidade...' : 'Usar minha cidade atual'}
              </button>
            </div>

            <label className="account-field">
              <span>Bio</span>
              <textarea value={bio} onChange={(event) => setBio(event.target.value.slice(0, 160))} maxLength={160} rows={4} />
              <small>{countBio(bio)}/160</small>
            </label>

            <div className="account-actions">
              <button type="button" className="account-primary-btn" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'seguranca' && (
          <div id="tab-panel-seguranca" role="tabpanel" aria-labelledby="tab-seguranca" className="account-panel">
            <label className="account-field">
              <span>Senha atual</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
            </label>
            <label className="account-field">
              <span>Nova senha</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <label className="account-field">
              <span>Confirmar nova senha</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </label>

            <label className="account-toggle">
              <input type="checkbox" checked={locationEnabled} onChange={(event) => setLocationEnabled(event.target.checked)} />
              <span>Habilitar localização</span>
            </label>
            <p className="account-note">A localização exibida no mapa é randômica de acordo com a cidade escolhida.</p>

            <label className="account-toggle">
              <input type="checkbox" checked={showMusicHistory} onChange={(event) => setShowMusicHistory(event.target.checked)} />
              <span>Mostrar histórico de músicas ouvidas</span>
            </label>

            <div className="account-actions">
              <button type="button" className="account-primary-btn" onClick={saveSecurity} disabled={savingSecurity}>
                {savingSecurity ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        <div className="account-actions account-footer-actions">
          <button type="button" className="account-logout-btn" onClick={onLogout}>
            Sair
          </button>
        </div>
      </section>
    </main>
  );
}
