import { Disc3, Radio, Sparkles } from 'lucide-react';
import muusicLogo from '../assets/logo-muusic.png';

export default function MusicOnboardingPage({
  authUser,
  onConnectLastfm,
  onConnectSpotify,
  onSkip,
  lastfmConnecting,
  spotifyConnecting,
  lastfmError,
  spotifyError
}) {
  return (
    <main className="music-onboarding-page">
      <div className="music-onboarding-backdrop" />
      <section className="music-onboarding-shell">
        <header className="music-onboarding-header">
          <img src={muusicLogo} alt="Muusic" className="music-onboarding-logo" />
          <div>
            <p className="music-onboarding-kicker">Conecte sua música ao mapa</p>
            <h1>Olá, {authUser?.name || 'você'}.</h1>
            <p className="music-onboarding-copy">
              Use o Last.fm para mostrar o que você está ouvindo em tempo real e aparecer no mapa com a mesma vibe de outras pessoas.
            </p>
          </div>
        </header>

        <div className="music-onboarding-grid">
          <article className="music-provider-card is-primary">
            <div className="music-provider-icon">
              <Radio size={22} />
            </div>
            <div className="music-provider-head">
              <p className="music-provider-badge">Recomendado</p>
              <h2>Last.fm</h2>
            </div>
            <p className="music-provider-description">
              Fonte principal da presença musical. É o que usamos para identificar sua escuta e te colocar no mapa.
            </p>
            <ul className="music-provider-list">
              <li>Sincroniza o que você está ouvindo</li>
              <li>Ativa matches musicais no mapa</li>
              <li>Você pode criar a conta no próprio fluxo</li>
            </ul>
            {lastfmError ? <p className="music-provider-error">{lastfmError}</p> : null}
            <button type="button" className="music-provider-button" onClick={onConnectLastfm} disabled={lastfmConnecting}>
              {lastfmConnecting ? 'Conectando Last.fm...' : 'Conectar Last.fm'}
            </button>
          </article>

          <article className="music-provider-card">
            <div className="music-provider-icon is-secondary">
              <Disc3 size={22} />
            </div>
            <div className="music-provider-head">
              <p className="music-provider-badge is-secondary">Complementar</p>
              <h2>Spotify</h2>
            </div>
            <p className="music-provider-description">
              Enriquecimento visual e reprodução. Use para capas, álbuns, faixas e links que complementam a experiência.
            </p>
            <ul className="music-provider-list">
              <li>Melhora catálogo e embeds</li>
              <li>Continua opcional nesse fluxo</li>
              <li>Você pode conectar agora ou depois</li>
            </ul>
            {spotifyError ? <p className="music-provider-error">{spotifyError}</p> : null}
            <button type="button" className="music-provider-button is-secondary" onClick={onConnectSpotify} disabled={spotifyConnecting}>
              {spotifyConnecting ? 'Conectando Spotify...' : 'Conectar Spotify'}
            </button>
          </article>
        </div>

        <footer className="music-onboarding-footer">
          <div className="music-onboarding-note">
            <Sparkles size={16} />
            <span>Você pode entrar agora e conectar depois em Minha conta.</span>
          </div>
          <button type="button" className="music-onboarding-skip" onClick={onSkip}>
            Entrar sem conectar agora
          </button>
        </footer>
      </section>
    </main>
  );
}
